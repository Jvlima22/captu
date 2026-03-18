import express from 'express';
// import { IntegrationService } from '../services/integrationService.js';

const router = express.Router();

// ─── ROTAS DE WEBHOOKS (INBOUND) ────────────────────────────────────────────────
// Estas rotas recebem eventos de ferramentas como n8n, Slack, Trello, etc.

router.post('/:provider', async (req, res) => {
    const { provider } = req.params;
    const body = req.body;
    
    console.log(`\n[Webhook Recebido] Provider: ${provider}`);
    console.log('Payload:', JSON.stringify(body, null, 2));
    
    try {
        // Validação básica de cabeçalhos / assinaturas poderia ocorrer aqui
        // const signature = req.headers['x-provider-signature'];

        // Exemplo: Rotear a lógica dependendo do provedor
        if (provider === 'n8n') {
            // Processar os dados vindos do n8n (ex: Lead adicionado na planilha)
            console.log('Processando webhook do n8n...');
        } else if (provider === 'slack') {
            // Processar resposta do usuário pelo Slack
            console.log('Processando webhook do Slack...');
        } else {
            console.log(`Provedor '${provider}' não possui lógica customizada ainda.`);
        }

        // Responder rapidamente para não dar timeout no provedor emissor
        res.status(200).json({ status: 'success', message: `Webhook processed for ${provider}` });
    } catch (error) {
        console.error(`[Webhook Erro - ${provider}]:`, error);
        res.status(500).json({ status: 'error', error: 'Internal server error while processing webhook' });
    }
});

// GET Route para validações de webhook (alguns providers enviam um GET inicial de verificação, tipo Facebook/Slack)
router.get('/:provider', (req, res) => {
    const { provider } = req.params;
    console.log(`[Webhook Verificação] Provider: ${provider}`, req.query);
    
    // Retornar challenge token se exigido (Exemplo Slack/Meta)
    if (req.query.challenge) {
        res.send(req.query.challenge);
    } else {
        res.status(200).send('Webhook endpoint on standby.');
    }
});

export default router;
