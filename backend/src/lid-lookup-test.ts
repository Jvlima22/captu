import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const instance = 'user_uki6smc';

async function lidLookup() {
    try {
        const lid = '24812076409062@lid';
        console.log(`--- Fetching Profile Info for: ${lid} ---`);
        
        // Tenta buscar foto de perfil
        const pic = await axios.get(`${EVOLUTION_API_URL}/chat/fetchProfilePicture/${instance}?number=${lid}`, { headers: { 'apiKey': EVOLUTION_API_KEY } });
        console.log('Profile Picture Response:', JSON.stringify(pic.data, null, 2));

    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

lidLookup();
