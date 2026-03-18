import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars in Vercel
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server misconfiguration: Missing Supabase credentials' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create service role client for admin actions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    // Create a regular client to verify the user token
    const supabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');

    try {
        // 1. Verify the requester is logged in
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized token' });
        }

        // 2. Verify the requester is an Admin or Manager
        const { data: profile } = await supabaseAdmin
            .from('members')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || (profile.role !== 'Admin' && profile.role !== 'Manager')) {
            return res.status(403).json({ error: 'Forbidden: Only Admins and Managers can invite users' });
        }

        const { email, role, pay_rate, bill_rate, weekly_limit, daily_limit } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // 3. Invite the user via Supabase Auth (This securely sends the email via the configured SMTP/Resend)
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
        if (inviteError) {
            return res.status(400).json({ error: inviteError.message });
        }

        if (!inviteData.user) {
            return res.status(500).json({ error: 'Failed to create user' });
        }

        // 4. Create or update the pending member profile
        const { error: memberError } = await supabaseAdmin
            .from('members')
            .upsert({
                id: inviteData.user.id,
                email: email,
                full_name: email.split('@')[0], // Placeholder until they set it
                role: role || 'User',
                status: 'Pending',
                pay_rate: pay_rate || null,
                bill_rate: bill_rate || null,
                weekly_limit: weekly_limit || 40,
                daily_limit: daily_limit || 8,
            });

        if (memberError) {
            console.error("Member creation error:", memberError);
            return res.status(500).json({ error: 'Failed to create member record' });
        }

        return res.status(200).json({ success: true, member: { email } });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
