import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

// Load .env from project root
dotenv.config({ path: path.resolve('c:/Users/TGL Solutions/Desktop/CAPTU/.env') });

const clientId = process.env.SALESFORCE_CLIENT_ID;
const redirectUri = process.env.SALESFORCE_REDIRECT_URI;

async function runDebug() {
  console.log('--- SALESFORCE DEBUG ---');
  console.log('Client ID (Consumer Key):', clientId);
  console.log('Redirect URI (Callback URL):', redirectUri);
  console.log('--- VERIFYING ---');

  const authUrl = `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri as string)}`;
  
  console.log('Final Auth URL (Generated):', authUrl);
  
  try {
    console.log('Testing connectivity (HEAD request)...');
    const response = await axios.head(authUrl, {
      validateStatus: () => true, // Don't throw on non-200
      maxRedirects: 0
    });
    
    console.log('Salesforce Response Status:', response.status);
    console.log('Headers (to identify region):', response.headers.server || 'No server header');
    
    if (response.status >= 400) {
      console.log('CAUTION: Salesforce might be blocking this URL immediately.');
    } else {
      console.log('SUCCESS: Reachable! If you see mismatch, the URL is NOT in your Salesforce Dashboard list.');
    }
  } catch (error: any) {
    console.error('CRITICAL ERROR:', error.message);
  }
}

runDebug();
