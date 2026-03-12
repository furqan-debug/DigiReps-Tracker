import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testInvite() {
    const email = 'test_invite_' + Date.now() + '@example.com';
    console.log(`Inviting ${email}...`);
    
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'http://localhost:5174/accept-invite',
    });

    if (error) {
        console.error('Invite failed:', JSON.stringify(error, null, 2));
    } else {
        console.log('Invite successful:', JSON.stringify(data, null, 2));
    }
}

testInvite();
