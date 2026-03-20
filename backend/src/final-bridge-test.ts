import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const instance = 'user_uki6smc';

async function finalTest() {
    try {
        const response = await axios.post(
            `${EVOLUTION_API_URL}/chat/findContacts/${instance}`,
            {},
            { headers: { 'apiKey': EVOLUTION_API_KEY } }
        );
        
        const contacts = response.data;
        console.log('Total contacts:', contacts.length);

        // Verifica se algum contato tem um array de JIDs ou algo do tipo
        contacts.slice(0, 10).forEach((c: any, i: number) => {
            console.log(`Contact ${i} keys:`, Object.keys(c));
        });

        // Procura especificamente por "Le Viola" e mostra TUDO nela de novo
        const viola = contacts.find((c: any) => JSON.stringify(c).includes('Le Viola'));
        if (viola) {
           console.log('FULL VIOLA DATA (Keys Only):', Object.keys(viola));
           // Procura por qualquer campo que tenha o formato de LID (14-15 digitos)
           for (const [key, value] of Object.entries(viola)) {
               if (typeof value === 'string' && value.match(/\d{14,}/)) {
                   console.log(`POTENTIAL BRIDGE FOUND in key "${key}":`, value);
               }
           }
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

finalTest();
