import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const instance = 'user_uki6smc';

async function historyInspect() {
    try {
        const lid = '24812076409062@lid';
        console.log(`--- Fetching Message History for LID: ${lid} ---`);
        
        const response = await axios.post(
            `${EVOLUTION_API_URL}/chat/findMessages/${instance}`,
            { remoteJid: lid, limit: 5 },
            { headers: { 'apiKey': EVOLUTION_API_KEY } }
        );
        
        let messages = [];
        if (response.data?.records) messages = response.data.records;
        else if (Array.isArray(response.data)) messages = response.data;
        else if (response.data?.messages) messages = response.data.messages;

        if (messages.length > 0) {
            console.log('Sample Message Data (Looking for alternate IDs):');
            console.log(JSON.stringify(messages[0], null, 2));
        } else {
            console.log('No messages found for this LID in history.');
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

historyInspect();
