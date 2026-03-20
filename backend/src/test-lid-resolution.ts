import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const instance = 'user_uki6smc';

async function testResolution() {
    try {
        const lid = '24812076409062@lid';
        console.log(`--- Testing Resolution Endpoints for LID: ${lid} ---`);
        
        const endpoints = [
            `chat/fetchContact/${instance}?number=${lid}`,
            `chat/fetchProfile/${instance}?number=${lid}`,
            `chat/fetchProfilePicture/${instance}?number=${lid}`
        ];

        for (const ep of endpoints) {
            try {
                const res = await axios.get(`${EVOLUTION_API_URL}/${ep}`, { headers: { 'apiKey': EVOLUTION_API_KEY } });
                console.log(`Endpoint ${ep} WORKED! Data:`, JSON.stringify(res.data, null, 2));
            } catch (err: any) {
                console.log(`Endpoint ${ep} FAILED:`, err.response?.status || err.message);
            }
        }

    } catch (error: any) {
        console.error('Fatal Error:', error.message);
    }
}

testResolution();
