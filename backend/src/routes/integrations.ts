import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { IntegrationService } from '../services/integrationService.js';

const router = express.Router();

// HubSpot Configuration
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://captu.vercel.app/api/auth/callback/hubspot' 
    : 'http://localhost:3000/api/auth/callback/hubspot');

// Pipedrive Configuration
const PIPEDRIVE_CLIENT_ID = process.env.PIPEDRIVE_CLIENT_ID;
const PIPEDRIVE_CLIENT_SECRET = process.env.PIPEDRIVE_CLIENT_SECRET;
const PIPEDRIVE_REDIRECT_URI = process.env.PIPEDRIVE_REDIRECT_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://captu.vercel.app/api/auth/callback/pipedrive' 
    : 'http://localhost:3000/api/auth/callback/pipedrive');

// Salesforce Configuration
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const SALESFORCE_REDIRECT_URI = process.env.SALESFORCE_REDIRECT_URI || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://captu.vercel.app/api/auth/callback/salesforce' 
    : 'http://localhost:3000/api/auth/callback/salesforce');

// Helper to generate dynamic Redirect URI
const getRedirectUri = (req: any, id: string) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/api/auth/callback/${id}`;
};

// Helper to encode/decode state safely for OAuth (carries userId and optional PKCE verifier)
const encodeState = (userId?: string, verifier?: string) => {
  return Buffer.from(JSON.stringify({ u: userId || '', v: verifier || '' })).toString('base64url');
};

const decodeState = (stateString?: string) => {
  if (!stateString) return { u: '', v: '' };
  try {
    return JSON.parse(Buffer.from(stateString, 'base64url').toString('utf-8'));
  } catch (e) {
    return { u: stateString, v: stateString }; // Fallback
  }
};

/**
 * GET /api/auth/integrations/:id
 * Initiates the OAuth flow for a specific integration
 */
router.get('/integrations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string || '';
    
    if (id === 'hubspot') {
      const scopes = 'crm.objects.contacts.read crm.objects.contacts.write';
      const state = encodeState(userId);
      const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI as string)}&scope=${scopes}&state=${state}`;
      return res.redirect(authUrl);
    }

    if (id === 'pipedrive') {
      const state = encodeState(userId);
      const authUrl = `https://oauth.pipedrive.com/oauth/authorize?client_id=${PIPEDRIVE_CLIENT_ID}&redirect_uri=${encodeURIComponent(getRedirectUri(req, id))}&state=${state}`;
      console.log('[Pipedrive] Redirecting to:', authUrl);
      return res.redirect(authUrl);
    }

    if (id === 'salesforce') {
      // 1. Gerar PKCE: Verifier e Challenge
      const verifier = crypto.randomBytes(32).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      
      // 2. Montar URL - Passamos o VERIFIER e USER_ID no 'state'
      const state = encodeState(userId, verifier);
      const authUrl = `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${SALESFORCE_CLIENT_ID}&redirect_uri=${encodeURIComponent(getRedirectUri(req, id))}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;
      
      console.log('[Salesforce] Redirecting with PKCE:', authUrl);
      return res.redirect(authUrl);
    }
    
    // Fallback or other tools
    res.status(404).json({ error: 'Integration flow not implemented yet for ' + id });
  } catch (error: any) {
    console.error('Initiation Error:', error);
    res.status(500).send('<h1>Erro Interno</h1><p>Ocorreu uma falha ao iniciar a conexão.</p>');
  }
});

/**
 * GET /api/auth/callback/:id
 * Handles the callback from the third-party tool
 */
router.get('/callback/:id', async (req, res) => {
  const { id } = req.params;
  const { code, state: stateQuery } = req.query;
  const { u: userId, v: verifier } = decodeState(stateQuery as string);

  if (!code) {
    return res.status(400).send('<h1>Erro de Autenticação</h1><p>Código não fornecido.</p>');
  }

  if (id === 'hubspot') {
    try {
      // Exchange code for access token
      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID!,
        client_secret: HUBSPOT_CLIENT_SECRET!,
        redirect_uri: getRedirectUri(req, id),
        code: code as string,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens = response.data;
      
      if (userId) {
         await IntegrationService.saveIntegration(userId, 'hubspot', tokens);
      }
      
      console.log('HubSpot Auth Success:', { access_token: tokens.access_token.substring(0, 10) + '...' });

      // Return a script that sends a message to the opener window and closes the popup
      return res.send(`
        <html>
          <body>
            <h1>Conectado com sucesso!</h1>
            <p>Você pode fechar esta janela agora.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'AUTH_SUCCESS', 
                  integrationId: 'hubspot' 
                }, '*');
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('HubSpot Auth Error:', error.response?.data || error.message);
      return res.status(500).send('<h1>Erro na Autenticação</h1><p>Não foi possível conectar ao HubSpot.</p>');
    }
  }

  if (id === 'pipedrive') {
    try {
      // Exchange code for access token using Basic Auth as recommended by Pipedrive
      const authHeader = Buffer.from(`${PIPEDRIVE_CLIENT_ID}:${PIPEDRIVE_CLIENT_SECRET}`).toString('base64');
      
      const response = await axios.post('https://oauth.pipedrive.com/oauth/token', new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(req, id),
        code: code as string,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`
        }
      });

      const tokens = response.data;
      
      if (userId) {
         await IntegrationService.saveIntegration(userId, 'pipedrive', tokens);
      }
      
      console.log('Pipedrive Auth Success for domain:', tokens.api_domain);

      return res.send(`
        <html>
          <body>
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h1 style="color: #0dcf72;">Pipedrive Conectado!</h1>
              <p>O CAPTU já está sincronizado com sua conta do Pipedrive.</p>
              <p>Você pode fechar esta janela agora.</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'AUTH_SUCCESS', 
                  integrationId: 'pipedrive' 
                }, '*');
              }
              setTimeout(() => window.close(), 2500);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error('[Pipedrive] Auth Error details:', errorData);
      
      // Detailed error for debugging on Vercel
      return res.status(500).send(`
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ff0000; border-radius: 8px; background: #fff5f5; max-width: 600px; margin: 40px auto;">
          <h1 style="color: #d32f2f; margin-top: 0;">Erro na Autenticação (Pipedrive)</h1>
          <p>Não foi possível concluir a conexão com o Pipedrive.</p>
          <div style="background: #eee; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #333; overflow-x: auto;">
            <strong>Mensagem:</strong> ${JSON.stringify(errorData)}<br><br>
            <strong>Diagnóstico de Ambiente:</strong><br>
            - CLIENT_ID: ${PIPEDRIVE_CLIENT_ID ? 'Configurado (OK)' : 'FALTANDO (ERRO)'}<br>
            - CLIENT_SECRET: ${PIPEDRIVE_CLIENT_SECRET ? 'Configurado (OK)' : 'FALTANDO (ERRO)'}<br>
            - REDIRECT_URI: ${PIPEDRIVE_REDIRECT_URI}<br>
            - MODO: ${process.env.NODE_ENV}
          </div>
          <p style="margin-top: 20px; font-size: 14px;"><strong>Como corrigir:</strong> Verifique se estas chaves estão no Dashboard da Vercel e se a <code>Callback URL</code> no Pipedrive é exatamente a mesma mostrada acima.</p>
        </div>
      `);
    }
  }

  if (id === 'salesforce') {
    try {
      // Exchange code for access token using PKCE verifier
      const response = await axios.post('https://login.salesforce.com/services/oauth2/token', new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: SALESFORCE_CLIENT_ID!,
        client_secret: SALESFORCE_CLIENT_SECRET!,
        redirect_uri: getRedirectUri(req, id),
        code: code as string,
        code_verifier: verifier as string, // OBRIGATÓRIO pelo Salesforce quando PKCE está ativo
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens = response.data;

      if (userId) {
         await IntegrationService.saveIntegration(userId, 'salesforce', tokens);
      }
      
      console.log('Salesforce Auth Success for instance:', tokens.instance_url);

      return res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h1 style="color: #00A1E0;">Salesforce Conectado!</h1>
            <p>O CAPTU já está sincronizado com sua conta do Salesforce.</p>
            <p>Você pode fechar esta janela agora.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'AUTH_SUCCESS', 
                  integrationId: 'salesforce' 
                }, '*');
              }
              setTimeout(() => window.close(), 2500);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Salesforce Auth Error:', error.response?.data || error.message);
      return res.status(500).send('<h1>Erro na Autenticação (Salesforce)</h1><p>Não foi possível conectar ao Salesforce.</p>');
    }
  }

  res.status(404).send('<h1>Não encontrado</h1>');
});

/**
 * GET /api/auth/status/:userId
 * Returns a list of active integrations for the given user
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    
    // In a real scenario, make sure to validate permissions using a Bearer token
    // For now, IntegrationService gets it from tenant_integrations by user_id
    const activeIntegrations = await IntegrationService.getActiveIntegrations(userId);
    res.json({ active_integrations: activeIntegrations });
  } catch (error: any) {
    console.error('Error fetching integration status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/disconnect/:userId
 * Sets an integration as inactive for the user
 */
router.post('/disconnect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { provider } = req.body;
    if (!userId || !provider) return res.status(400).json({ error: 'Missing parameters' });
    
    await IntegrationService.toggleIntegration(userId, provider, false);
    res.json({ success: true, message: `Integração com ${provider} desativada.` });
  } catch (error: any) {
    console.error(`Error disconnecting ${req.body.provider}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/save-token
 * Saves an API Token manually (e.g., for AI providers)
 */
router.post('/save-token', async (req, res) => {
  try {
    const { userId, provider, token } = req.body;
    if (!userId || !provider || !token) {
      return res.status(400).json({ error: 'Missing userId, provider, or token' });
    }

    await IntegrationService.saveIntegration(userId, provider, { apiKey: token }, true);
    res.json({ success: true, message: `Token do ${provider} salvo com sucesso.` });
  } catch (error: any) {
    console.error(`Error saving token for ${req.body.provider}:`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
