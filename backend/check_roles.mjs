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

import fs from 'fs';

async function listAll() {
    const output = { auth: [], db: [] };

    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) console.error('Auth Error:', authError);
    else output.auth = users.map(u => ({ email: u.email, id: u.id, metadata: u.user_metadata }));

    const { data: members, error: dbError } = await supabase.from('members').select('*');
    if (dbError) console.error('DB Error:', dbError);
    else output.db = members;

    fs.writeFileSync('users_dump.json', JSON.stringify(output, null, 2));
    console.log('Dumped to users_dump.json');
}

listAll();
