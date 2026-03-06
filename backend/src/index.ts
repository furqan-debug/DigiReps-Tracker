import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for base64 screenshot payloads

// Initialize Supabase client lazily (won't crash if env vars are missing at startup)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY is not set. DB writes will be skipped.');
    console.warn('    → Copy backend/.env.example to backend/.env and fill in your credentials.');
}

// Service-role client: for DB writes (bypasses RLS)
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

// Anon client: for Supabase Auth operations (signInWithPassword, getUser)
const supabaseAuth = (SUPABASE_URL && SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : (supabase); // fall back to service client — still works for auth in dev

/** Helper — throws a readable error instead of crashing with 'null' */
function getDb() {
    if (!supabase) throw new Error('Supabase is not configured. Check your .env file.');
    return supabase;
}

/** Extract bearer token from Authorization header */
function extractToken(req: express.Request): string | null {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
}

/** Middleware: verify JWT and attach user to req */
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    try {
        const db = getDb();
        const { data: { user }, error } = await db.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
        (req as any).authUser = user;
        next();
    } catch (e: any) {
        res.status(401).json({ error: e.message });
    }
}

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'DigiReps Ingestion API', version: '1.0.0', time: new Date().toISOString() });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'DigiReps Ingestion API is running' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'DigiReps Ingestion API', version: '1.0.0', time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id, email, full_name, role, ... }, projects[] }
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

        const db = getDb();

        // 1. Authenticate with Supabase Auth
        const { data: authData, error: authError } = await db.auth.signInWithPassword({ email, password });
        if (authError || !authData.session) {
            return res.status(401).json({ error: authError?.message || 'Invalid credentials' });
        }

        const token = authData.session.access_token;
        const authUserId = authData.user.id;

        // 2. Fetch member profile from our members table
        const { data: member, error: memberError } = await db
            .from('members')
            .select('*')
            .eq('auth_user_id', authUserId)
            .eq('status', 'Active')
            .single();

        if (memberError || !member) {
            return res.status(403).json({ error: 'Your account is not active or not found. Contact your admin.' });
        }

        if (!member.tracking_enabled) {
            return res.status(403).json({ error: 'Time tracking is disabled for your account.' });
        }

        // 3. Fetch projects assigned to this member
        const { data: assignments } = await db
            .from('project_members')
            .select('project_id, projects(id, name, description, color, status)')
            .eq('member_id', member.id);

        const projects = (assignments || [])
            .map((a: any) => a.projects)
            .filter((p: any) => p && p.status === 'Active');

        console.log(`✅ Login: ${email} — ${projects.length} project(s)`);

        res.json({
            token,
            user: {
                id: member.id,
                email: member.email,
                full_name: member.full_name,
                role: member.role,
                pay_rate: member.pay_rate,
                weekly_limit: member.weekly_limit,
                daily_limit: member.daily_limit,
            },
            projects,
        });
    } catch (e: any) {
        console.error('Login error:', e);
        res.status(500).json({ error: e.message || 'Internal server error' });
    }
});

/**
 * GET /api/auth/me
 * Returns current user's profile + projects (token in Authorization header)
 */
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const authUser = (req as any).authUser;
        const db = getDb();

        const { data: member } = await db.from('members').select('*').eq('auth_user_id', authUser.id).single();
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const { data: assignments } = await db
            .from('project_members')
            .select('project_id, projects(id, name, description, color, status)')
            .eq('member_id', member.id);

        const projects = (assignments || []).map((a: any) => a.projects).filter((p: any) => p?.status === 'Active');

        res.json({ user: member, projects });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MEMBERS ENDPOINTS (Admin only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/members — list all members
 */
app.get('/api/members', async (req, res) => {
    try {
        const { data, error } = await getDb().from('members').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/members — admin invites a new member via Supabase email invite
 * Body: { email, role, pay_rate, bill_rate, weekly_limit, daily_limit }
 * Supabase sends an invite email; no temp password is generated.
 */
app.post('/api/members', async (req, res) => {
    try {
        const { email, role = 'User', pay_rate, bill_rate, weekly_limit = 40, daily_limit = 8 } = req.body;
        if (!email) return res.status(400).json({ error: 'email is required' });

        const db = getDb();

        // Send Supabase invite email (user will receive a magic link)
        const adminPortalUrl = process.env.ADMIN_PORTAL_URL || 'http://localhost:5174';
        const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${adminPortalUrl}/accept-invite`,
        });

        if (inviteError) {
            // If already registered, still proceed to create the member row
            if (!inviteError.message.toLowerCase().includes('already registered') &&
                !inviteError.message.toLowerCase().includes('already been invited')) {
                throw inviteError;
            }
        }

        const authUserId = inviteData?.user?.id || null;

        // Check if a member row already exists for this email
        const { data: existing } = await db.from('members').select('id').eq('email', email).maybeSingle();
        if (existing) {
            return res.status(409).json({ error: 'A member with this email already exists.' });
        }

        // Insert a pending member row — full_name will be filled in by user during onboarding
        const { data: member, error: memberError } = await db.from('members').insert([{
            email,
            full_name: email, // placeholder until user completes setup
            role,
            pay_rate,
            bill_rate,
            weekly_limit,
            daily_limit,
            auth_user_id: authUserId,
            status: 'Pending',
        }]).select().single();

        if (memberError) throw memberError;

        console.log(`📧 Invite sent to: ${email}`);
        res.status(201).json({ member, invited: true });
    } catch (e: any) {
        console.error('Invite member error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/members/complete-setup
 * Called by the AcceptInvite page after the user sets their password.
 * Body: { auth_user_id, full_name, phone? }
 * Activates the member account.
 */
app.post('/api/members/complete-setup', async (req, res) => {
    try {
        const { auth_user_id, full_name, phone } = req.body;
        if (!auth_user_id || !full_name) {
            return res.status(400).json({ error: 'auth_user_id and full_name are required' });
        }

        const db = getDb();

        const { data: member, error } = await db
            .from('members')
            .update({ full_name, phone: phone || null, status: 'Active' })
            .eq('auth_user_id', auth_user_id)
            .select()
            .single();

        if (error) throw error;
        if (!member) return res.status(404).json({ error: 'Member record not found for this user.' });

        console.log(`✅ Member setup complete: ${full_name} (${member.email})`);
        res.json({ member });
    } catch (e: any) {
        console.error('Complete-setup error:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/members/:id — update member profile
 */
app.put('/api/members/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, role, status, pay_rate, bill_rate, weekly_limit, daily_limit, tracking_enabled } = req.body;
        const { data, error } = await getDb().from('members').update({
            full_name, role, status, pay_rate, bill_rate, weekly_limit, daily_limit, tracking_enabled
        }).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/projects — list all projects (admin view)
 */
app.get('/api/projects', async (req, res) => {
    try {
        const { data, error } = await getDb().from('projects').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/projects — admin creates a project
 * Body: { name, description, color }
 */
app.post('/api/projects', async (req, res) => {
    try {
        const { name, description, color = '#3b82f6' } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const { data, error } = await getDb().from('projects').insert([{ name, description, color }]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/projects/:id — update project
 */
app.put('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color, status } = req.body;
        const { data, error } = await getDb().from('projects').update({ name, description, color, status }).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/projects/:id/members — set member assignments for a project
 * Body: { member_ids: string[] }
 */
app.put('/api/projects/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        const { member_ids = [] } = req.body;
        const db = getDb();

        // Replace all assignments for this project
        await db.from('project_members').delete().eq('project_id', id);
        if (member_ids.length > 0) {
            const rows = member_ids.map((mid: string) => ({ project_id: id, member_id: mid }));
            const { error } = await db.from('project_members').insert(rows);
            if (error) throw error;
        }

        res.json({ project_id: id, member_ids });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/sessions', async (req, res) => {
    try {
        const { user_id, project_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Capture the real client IP for location tracking
        const ip_address = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || null;

        const session_id = uuidv4();
        const started_at = new Date().toISOString();

        const { error } = await getDb()
            .from('sessions')
            .insert([{ id: session_id, user_id, project_id, started_at, ip_address }]);

        if (error) throw error;

        console.log(`✅ Created session ${session_id} for user ${user_id} from IP ${ip_address}`);
        res.status(201).json({ session_id, started_at });
    } catch (error: any) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ─────────────────────────────────────────
// End a tracking session
// POST /api/sessions/:id/end
// ─────────────────────────────────────────
app.post('/api/sessions/:id/end', async (req, res) => {
    try {
        const { id } = req.params;
        const ended_at = new Date().toISOString();
        const { error } = await getDb()
            .from('sessions')
            .update({ ended_at })
            .eq('id', id);
        if (error) throw error;
        console.log(`🏁 Session ${id} ended at ${ended_at}`);
        res.json({ session_id: id, ended_at });
    } catch (error: any) {
        console.error('Error ending session:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ─────────────────────────────────────────
// Upload a single screenshot
// POST /api/screenshot
// Body: { session_id, timestamp, base64 }
// ─────────────────────────────────────────
app.post('/api/screenshot', async (req, res) => {
    try {
        const { session_id, timestamp, base64 } = req.body;

        if (!session_id || !base64) {
            return res.status(400).json({ error: 'session_id and base64 are required' });
        }

        const db = getDb();

        // Strip data URL prefix if present (e.g. "data:image/png;base64,...")
        const raw = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(raw, 'base64');
        const filename = `${session_id}/${Date.now()}.png`;

        // Upload to Supabase Storage bucket named 'screenshots'
        const { error: uploadError } = await db.storage
            .from('screenshots')
            .upload(filename, buffer, { contentType: 'image/png', upsert: false });

        if (uploadError) {
            console.error('📸 Screenshot storage upload error:', uploadError.message);
            return res.status(500).json({ error: uploadError.message });
        }

        // Get the public URL
        const { data: urlData } = db.storage
            .from('screenshots')
            .getPublicUrl(filename);

        // Save metadata row to screenshots table
        const { error: dbError } = await db.from('screenshots').insert([{
            session_id,
            recorded_at: timestamp || new Date().toISOString(),
            file_url: urlData.publicUrl,
        }]);

        if (dbError) {
            console.error('📸 Screenshot DB insert error:', dbError.message);
            // Don't fail — we already uploaded the file
        }

        console.log(`📸 Screenshot saved: ${filename} → ${urlData.publicUrl}`);
        res.status(201).json({ success: true, file_url: urlData.publicUrl });
    } catch (error: any) {
        console.error('Screenshot endpoint error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Body: Array<{ session_id, timestamp, mouse_count, keyboard_count, app_name, window_title, idle_flag, file_url? }>
// ─────────────────────────────────────────
app.post('/api/heartbeats', async (req, res) => {
    try {
        const heartbeats: any[] = req.body;

        if (!Array.isArray(heartbeats) || heartbeats.length === 0) {
            return res.status(400).json({ error: 'Expected a non-empty array of heartbeats' });
        }

        // Separate activity samples from screenshot-only entries
        const activitySamples = heartbeats.filter(h => h.session_id && h.timestamp && !h.type);
        const screenshotSamples = heartbeats.filter(h => h.type === 'screenshot');

        // ── Insert activity samples ──
        if (activitySamples.length > 0) {
            const rows = activitySamples.map(h => ({
                session_id: h.session_id,
                recorded_at: h.timestamp,
                mouse_clicks: h.mouse_count ?? 0,
                key_presses: h.keyboard_count ?? 0,
                app_name: h.app_name ?? '',
                window_title: h.window_title ?? '',
                domain: h.domain ?? '',
                idle: h.idle_flag ?? false,
                activity_percent: calculateActivity(h.mouse_count, h.keyboard_count),
            }));

            const { error } = await getDb().from('activity_samples').insert(rows);
            if (error) {
                console.error('Error inserting activity samples:', error);
                // Don't throw — keep processing screenshots
            } else {
                console.log(`✅ Inserted ${rows.length} activity samples`);
            }
        }

        // ── Handle inline screenshots (base64 data URLs) ──
        const screenshotResults: { session_id: string; url: string }[] = [];
        for (const snap of screenshotSamples) {
            if (!snap.file_url || !snap.session_id) continue;

            try {
                const base64Data = snap.file_url.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `${snap.session_id}/${Date.now()}.png`;

                const { error: uploadError } = await getDb().storage
                    .from('screenshots')
                    .upload(filename, buffer, { contentType: 'image/png', upsert: false });

                if (uploadError) {
                    console.error('Screenshot upload error:', uploadError.message);
                    continue;
                }

                const { data: urlData } = getDb().storage
                    .from('screenshots')
                    .getPublicUrl(filename);

                // Save screenshot metadata to DB
                await getDb().from('screenshots').insert([{
                    session_id: snap.session_id,
                    recorded_at: snap.timestamp || new Date().toISOString(),
                    file_url: urlData.publicUrl,
                }]);

                screenshotResults.push({ session_id: snap.session_id, url: urlData.publicUrl });
                console.log(`📸 Screenshot uploaded: ${filename}`);
            } catch (err) {
                console.error('Failed to process screenshot:', err);
            }
        }

        res.status(200).json({
            success: true,
            processed_activity: activitySamples.length,
            processed_screenshots: screenshotResults.length,
        });
    } catch (error: any) {
        console.error('Error processing heartbeats:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ─────────────────────────────────────────
// Upload a single screenshot directly
// POST /api/screenshot
// Body: { session_id, timestamp, base64 }
// ─────────────────────────────────────────
app.post('/api/screenshot', async (req, res) => {
    try {
        const { session_id, timestamp, base64 } = req.body;
        if (!session_id || !base64) {
            return res.status(400).json({ error: 'session_id and base64 are required' });
        }

        const raw = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(raw, 'base64');
        const filename = `${session_id}/${Date.now()}.png`;

        const { error: uploadError } = await getDb()
            .storage
            .from('screenshots')
            .upload(filename, buffer, { contentType: 'image/png', upsert: false });

        if (uploadError) {
            console.error('Screenshot upload error:', uploadError.message);
            return res.status(500).json({ error: uploadError.message });
        }

        const { data: urlData } = getDb()
            .storage
            .from('screenshots')
            .getPublicUrl(filename);

        await getDb().from('screenshots').insert([{
            session_id,
            recorded_at: timestamp || new Date().toISOString(),
            file_url: urlData.publicUrl,
        }]);

        console.log(`📸 Screenshot saved: ${filename}`);
        res.status(201).json({ url: urlData.publicUrl });
    } catch (error: any) {
        console.error('Error saving screenshot:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ─────────────────────────────────────────
// Get presigned upload URL for screenshot
// POST /api/screenshots/presign
// Body: { session_id, filename }
// ─────────────────────────────────────────
app.post('/api/screenshots/presign', async (req, res) => {
    try {
        const { session_id, filename } = req.body;
        if (!session_id || !filename) {
            return res.status(400).json({ error: 'session_id and filename are required' });
        }

        const filePath = `${session_id}/${filename}`;
        const { data, error } = await getDb().storage
            .from('screenshots')
            .createSignedUploadUrl(filePath);

        if (error) throw error;

        res.json({ upload_url: data.signedUrl, path: filePath });
    } catch (error: any) {
        console.error('Error creating presigned URL:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ─────────────────────────────────────────
// Helper: Calculate activity percentage
// ─────────────────────────────────────────
function calculateActivity(mouseCount: number = 0, keyboardCount: number = 0): number {
    const total = mouseCount + keyboardCount;
    // Cap at 100 — 100 total events = 100% active (arbitrary scale)
    return Math.min(100, Math.round((total / 100) * 100));
}

app.listen(PORT, () => {
    console.log(`🚀 DigiReps Ingestion API running on http://localhost:${PORT}`);
});
