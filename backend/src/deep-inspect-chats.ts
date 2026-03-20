import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const instance = 'user_uki6smc';

async function deepInspect() {
    try {
        console.log('--- Scanning All Chats for ID "24812076409062" ---');
        const response = await axios.post(
            `${EVOLUTION_API_URL}/chat/findChats/${instance}`,
            {},
            { headers: { 'apiKey': EVOLUTION_API_KEY } }
        );
        
        const allChats = response.data;
        const searchId = '24812076409062';
        
        const match = allChats.find((c: any) => JSON.stringify(c).includes(searchId));
        
        if (match) {
            console.log('Chat Object Found:');
            console.log(JSON.stringify(match, null, 2));
        } else {
            console.log('ID not found directly in findChats. Printing a sample of chat fields...');
            if (allChats.length > 0) console.log(Object.keys(allChats[0]));
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

deepInspect();
