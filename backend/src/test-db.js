
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuth() {
    const { data, error } = await supabase
        .from('whatsapp_auth')
        .select('id, updated_at')
        .like('id', 'main_%')
        .limit(20);

    if (error) {
        console.error('Error fetching auth:', error);
        return;
    }

    console.log('Found auth records:', data.length);
    data.forEach(r => console.log(`- ${r.id} (Updated: ${r.updated_at})`));
}

checkAuth();
