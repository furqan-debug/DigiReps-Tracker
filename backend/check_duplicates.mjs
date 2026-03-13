import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const email = 'furqancryptotrader@gmail.com';
    const { data: members, error } = await supabase.from('members').select('*').eq('email', email);
    
    if (error) {
        console.error('Error fetching members:', error);
        return;
    }

    console.log('Duplicate check results for', email);
    console.log(JSON.stringify(members, null, 2));

    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    console.log('Auth user:', authUser ? { id: authUser.id, email: authUser.email } : 'Not found in Auth');
}

check();
