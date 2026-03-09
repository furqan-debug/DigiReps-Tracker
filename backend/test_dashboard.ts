import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    const { data: mem } = await supabase.from('members').select('*').limit(1);
    const { data: screens } = await supabase.from('screenshots').select('*').limit(1);

    fs.writeFileSync('schema_debug.json', JSON.stringify({
        members: mem && mem.length ? Object.keys(mem[0]) : [],
        screenshots: screens && screens.length ? Object.keys(screens[0]) : []
    }, null, 2));
}
run();
