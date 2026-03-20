import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const instance = 'user_uki6smc';

async function deepInspect() {
    try {
        console.log('--- Scanning All Contacts for LID "24812076409062" ---');
        const response = await axios.post(
            `${EVOLUTION_API_URL}/chat/findContacts/${instance}`,
            {},
            { headers: { 'apiKey': EVOLUTION_API_KEY } }
        );
        
        const allContacts = response.data;
        const searchId = '24812076409062';
        
        // Procura em qualquer campo do objeto
        const match = allContacts.find((c: any) => JSON.stringify(c).includes(searchId));
        
        if (match) {
            console.log('Match Found for ID:', searchId);
            console.log(JSON.stringify(match, null, 2));
        } else {
            console.log('ID not found directly in contacts list. Trying to find "Le Viola" again to check all her fields...');
            const viola = allContacts.find((c: any) => (c.name || '').includes('Le Viola') || (c.pushName || '').includes('Le Viola'));
            if (viola) {
                console.log('Le Viola Object (FULL):');
                console.log(JSON.stringify(viola, null, 2));
            } else {
                console.log('Le Viola not found by name.');
            }
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

deepInspect();
