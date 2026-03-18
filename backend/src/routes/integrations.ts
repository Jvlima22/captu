import express from 'express';
import axios from 'axios';

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

/**
 * GET /api/auth/integrations/:id
 * Initiates the OAuth flow for a specific integration
 */
router.get('/integrations/:id', (req, res) => {
  const { id } = req.params;
  
  if (id === 'hubspot') {
    const scopes = 'crm.objects.contacts.read crm.objects.contacts.write';
    const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI as string)}&scope=${scopes}`;
    return res.redirect(authUrl);
  }

  if (id === 'pipedrive') {
    const authUrl = `https://oauth.pipedrive.com/oauth/authorize?client_id=${PIPEDRIVE_CLIENT_ID}&redirect_uri=${encodeURIComponent(PIPEDRIVE_REDIRECT_URI as string)}`;
    console.log('[Pipedrive] Redirecting to:', authUrl);
    return res.redirect(authUrl);
  }
  
  // Fallback or other tools
  res.status(404).json({ error: 'Integration flow not implemented yet for ' + id });
});

/**
 * GET /api/auth/callback/:id
 * Handles the callback from the third-party tool
 */
router.get('/callback/:id', async (req, res) => {
  const { id } = req.params;
  const { code } = req.query;

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
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code: code as string,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // TODO: Save tokens to database (tenant_integrations table)
      console.log('HubSpot Auth Success:', { access_token: access_token.substring(0, 10) + '...', refresh_token: '...' });

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
        redirect_uri: PIPEDRIVE_REDIRECT_URI,
        code: code as string,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`
        }
      });

      const { access_token, refresh_token, api_domain } = response.data;

      // TODO: Save tokens to database
      console.log('Pipedrive Auth Success for domain:', api_domain);

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

  res.status(404).send('<h1>Não encontrado</h1>');
});

export default router;
