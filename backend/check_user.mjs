import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const email = 'contact.furqan.siddiqui@gmail.com';
    const { data: member, error } = await supabase.from('members').select('*').eq('email', email).maybeSingle();
    console.log('Member record:', member);

    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);
    console.log('Auth user record:', authUser ? { id: authUser.id, email: authUser.email, email_confirmed_at: authUser.email_confirmed_at } : 'Not found');
}

check();