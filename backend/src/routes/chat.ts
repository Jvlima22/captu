import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppService } from '../services/whatsapp';

const router = Router();
const whatsapp = WhatsAppService.getInstance();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Inicialização segura
let supabase: any;
try {
    supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
} catch (e) {
    console.error('Failed to create Supabase client in chat route');
    supabase = null;
}

// POST /api/chat/send - Envia uma mensagem manualmente pelo sistema
router.post('/send', async (req, res) => {
    const { leadId, message, phone } = req.body;
    console.log('Sending message to:', phone, 'leadId:', leadId);

    if (!leadId || !message || !phone) {
        return res.status(400).json({ error: 'leadId, message and phone are required' });
    }

    try {
        // 1. Formatar telefone ou manter JID
        const formattedPhone = phone.includes('@') 
            ? phone 
            : (phone.replace(/\D/g, '').startsWith('55') 
                ? phone.replace(/\D/g, '') 
                : '55' + phone.replace(/\D/g, ''));
        
        console.log('[Chat Route] Alvo do envio:', formattedPhone);

        // 2. Enviar via Motor Nativo (WhatsAppService)
        try {
            await whatsapp.sendMessage(formattedPhone, message);
            console.log('Message sent via Native Engine');
        } catch (waError: any) {
            console.error('WhatsApp Error:', waError.message);
            throw new Error(`Erro no WhatsApp: ${waError.message}`);
        }

        res.json({ success: true, message: 'Message sent via WhatsApp Engine' });
    } catch (error: any) {
        console.error('General Route Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// POST /api/chat/webhook - Recebe mensagens do WhatsApp via Evolution API
router.post('/webhook', async (req, res) => {
    const event = req.body;

    // Log detalhado para debug no console do servidor
    console.log(`[Webhook] Evento recebido: ${event.event} de ${event.data?.key?.remoteJid}`);

    try {
        // Lógica de Presença Realtime (Broadcast)
        if (event.event === 'presence.update') {
            const presenceData = event.data;
            const phone = presenceData.id.split('@')[0];
            const presence = presenceData.presences[presenceData.id]?.lastKnownPresence || 'unavailable';

            console.log(`[Presence] ${phone} está ${presence}`);

            // Criar canal de broadcast para notificar o frontend sem tocar no banco
            const channel = supabase.channel('presence-global');
            channel.subscribe(async (status: any) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'presence-status',
                        payload: { phone, presence, timestamp: new Date().toISOString() },
                    });
                    // Desinscrever após o envio para não manter conexões abertas no backend (stateless)
                    supabase.removeChannel(channel);
                }
            });
        }

        // Filtramos apenas por mensagens recebidas (upsert)
        if (event.event === 'messages.upsert' && !event.data.key.fromMe) {
            const messageData = event.data;
            const remoteJid = messageData.key.remoteJid;
            const phone = remoteJid.split('@')[0];

            // Extração robusta de texto
            const text = messageData.message?.conversation ||
                messageData.message?.extendedTextMessage?.text ||
                messageData.message?.imageMessage?.caption ||
                messageData.message?.videoMessage?.caption ||
                messageData.message?.buttonsResponseMessage?.selectedButtonId ||
                messageData.message?.listResponseMessage?.title ||
                'Mensagem de mídia/não suportada';

            console.log(`[Webhook] Mensagem de ${phone}: ${text.substring(0, 50)}...`);

            // Emite para o Frontend em memória
            supabase.channel('presence-global').send({
                type: 'broadcast',
                event: 'whatsapp-message',
                payload: messageData,
            });
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error('[Webhook] Falha crítica:', error.message);
        res.status(500).send('Error');
    }
});

// POST /api/chat/disconnect - Encerra a sessão e apaga autenticação no banco
router.post('/disconnect', async (req, res) => {
    try {
        await whatsapp.disconnect();
        res.json({ success: true, message: 'WhatsApp session cleared and restarting' });
    } catch (error: any) {
        console.error('Logout error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/chat/profile-pic/:jid
router.get('/profile-pic/:jid', async (req, res) => {
    try {
        const url = await whatsapp.getProfilePicture(req.params.jid);
        if (url) {
            res.json({ url });
        } else {
            res.status(404).json({ error: 'Profile picture not found' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
