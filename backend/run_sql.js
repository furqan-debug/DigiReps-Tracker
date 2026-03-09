import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Creating invoices table...");
    const { error: e1 } = await supabase.rpc('execute_sql', {
        sql_text: `CREATE TABLE IF NOT EXISTS invoices (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      amount      NUMERIC(10,2) NOT NULL,
      status      TEXT NOT NULL DEFAULT 'Draft',
      title       TEXT NOT NULL DEFAULT 'Invoice',
      issue_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date    DATE NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
    });
    if (e1) console.error(e1);

    console.log("Creating expenses table...");
    const { error: e2 } = await supabase.rpc('execute_sql', {
        sql_text: `CREATE TABLE IF NOT EXISTS expenses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
      amount      NUMERIC(10,2) NOT NULL,
      category    TEXT NOT NULL,
      description TEXT,
      date        DATE NOT NULL DEFAULT CURRENT_DATE,
      status      TEXT NOT NULL DEFAULT 'Pending',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
    });
    if (e2) console.error(e2);
    console.log("Tables created via rpc (if execute_sql exists).");
}

run();
