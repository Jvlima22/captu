
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: creds } = await supabase.from('whatsapp_auth').select('id, data').eq('id', 'main_creds').single();
    if (!creds) {
        console.log('Creds NOT found in DB');
    } else {
        const isPaired = creds.data && (creds.data.me || creds.data.pairingCode);
        console.log('Creds found. Paired (has "me"):', !!creds.data.me);
        if (creds.data.me) console.log('Account:', creds.data.me.id);
    }
}
check();
