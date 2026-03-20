import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { EvolutionService } from '../services/evolution.js';
import multer from 'multer';
import axios from 'axios';

const router = Router();
const upload = multer();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

// Inicialização segura
let supabase: any;
try {
    supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
} catch (e) {
    console.error('Failed to create Supabase client in chat route');
    supabase = null;
}

// Helper para obter a instância do usuário (Multi-tenant)
const getInstance = (req: any) => {
    const instance = req.headers['x-instance-name'] || req.query.instance || 'CaptuGlobal';
    return instance;
};

// POST /api/chat/send - Envia uma mensagem manualmente pela Evolution
router.post('/send', async (req, res) => {
    const { leadId, message, phone, quoted } = req.body;
    const instance = getInstance(req);
    
    if (!message || !phone) {
        return res.status(400).json({ error: 'message and phone are required' });
    }

    try {
        const formattedPhone = phone.includes('@') ? phone : phone.replace(/\D/g, '');
        await EvolutionService.sendMessage(formattedPhone, message, instance);
        res.json({ success: true, message: `Message sent via Evolution (${instance})` });
    } catch (error: any) {
        console.error('Evolution Send Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/chat/send/media - Envia uma mídia pela Evolution
router.post('/send/media', upload.single('file'), async (req, res) => {
    const { caption, phone } = req.body;
    const file = req.file;
    const instance = getInstance(req);

    if (!phone || !file) {
        return res.status(400).json({ error: 'phone and file are required' });
    }

    try {
        const formattedPhone = phone.includes('@') ? phone : phone.replace(/\D/g, '');
        await EvolutionService.sendMedia(formattedPhone, file.buffer, file.mimetype, file.originalname, instance, caption);
        res.json({ success: true, message: `Media sent via Evolution (${instance})` });
    } catch (error: any) {
        console.error('Evolution Media Send Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/chat/status - Retorna o status atual da Evolution
router.get('/status', async (req, res) => {
    const instance = getInstance(req);
    console.log(`[Chat] Verificando status para: ${instance}`);
    
    try {
        const status = await EvolutionService.getInstanceStatus(instance);
        const currentState = status.instance?.state || 'disconnected';
        console.log(`[Chat] Status atual de ${instance}: ${currentState}`);
        
        if (currentState !== 'open') {
            let qrCode = null;
            
            try {
                console.log(`[Chat] Tentando obter QR de conexão existente para: ${instance}`);
                const connection = await EvolutionService.connectInstance(instance);
                qrCode = connection.qrcode?.data || connection.qrcode?.base64 || connection.base64 || null;
            } catch (err: any) {
                console.log(`[Chat] Instância não conectada ou inexistente. Tentando criar/recriar.`);
                try {
                    const createResult = await EvolutionService.createInstance(instance);
                    qrCode = createResult.qrcode?.data || createResult.qrcode?.base64 || null;
                } catch (createErr: any) {
                    console.error(`[Chat] Erro fatal ao criar instância:`, createErr.message);
                }
            }

            console.log(`[Chat] Retornando estado '${currentState}' com QR: ${qrCode ? 'SIM (Base64)' : 'NÃO'}`);
            return res.json({
                state: currentState === 'connecting' ? 'connecting' : 'disconnected',
                qrcode: qrCode
            });
        }

        console.log(`[Chat] Instância ${instance} está aberta. Pronta para uso.`);
        res.json({
            state: 'open',
            status: currentState,
            qrcode: null
        });
    } catch (error: any) {
        console.error('[Chat Status Fatal Error]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/chat/history - Retorna os chats da Evolution
router.get('/history', async (req, res) => {
    const instance = getInstance(req);
    try {
        const chats = await EvolutionService.fetchChats(instance);
        res.json({ chats, messages: {}, contacts: [] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/chat/messages/:jid - Retorna histórico de mensagens de um chat específico
router.get('/messages/:jid', async (req, res) => {
    const instance = getInstance(req);
    const jid = req.params.jid;
    try {
        const messages = await EvolutionService.fetchHistory(instance, jid);
        res.json(messages);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/chat/debug/:jid - Endpoint de diagnóstico: inspeciona resposta bruta da Evolution API
router.get('/debug/:jid', async (req, res) => {
    const instance = getInstance(req);
    const jid = decodeURIComponent(req.params.jid);

    try {
        // Busca sem cache para testar o formato correto
        EvolutionService.invalidateCache(instance, jid);

        const testResults: any[] = [];

        const queryFormats = [
            { label: 'F1: where.key.remoteJid', body: { where: { key: { remoteJid: jid } }, limit: 10 } },
            { label: 'F2: where.remoteJid',     body: { where: { remoteJid: jid }, limit: 10 } },
            { label: 'F3: remoteJid + count',   body: { remoteJid: jid, count: 10, page: 1 } },
            { label: 'F4: remoteJid (legado)',   body: { remoteJid: jid } },
        ];

        for (const fmt of queryFormats) {
            try {
                const r = await axios.post(
                    `${EVOLUTION_API_URL}/chat/findMessages/${instance}`,
                    fmt.body,
                    { headers: { 'apiKey': EVOLUTION_API_KEY } }
                );

                let msgs: any[] = [];
                const d = r.data;
                if (d?.messages?.records) msgs = d.messages.records;
                else if (d?.records)      msgs = d.records;
                else if (Array.isArray(d)) msgs = d;
                else if (Array.isArray(d?.messages)) msgs = d.messages;

                const uniqueJids = [...new Set(msgs.map((m: any) => m.key?.remoteJid).filter(Boolean))];
                const matchingJid = msgs.filter((m: any) => m.key?.remoteJid === jid).length;

                testResults.push({
                    format: fmt.label,
                    totalMsgs: msgs.length,
                    uniqueJids,
                    matchingTarget: matchingJid,
                    filterWorked: matchingJid > 0 && matchingJid === msgs.length,
                    sampleJids: uniqueJids.slice(0, 5),
                });
            } catch (err: any) {
                testResults.push({ format: fmt.label, error: err.message });
            }
        }

        res.json({
            targetJid: jid,
            instance,
            results: testResults,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/chat/cache - Limpa o cache de mensagens
router.delete('/cache', async (req, res) => {
    EvolutionService.clearCache();
    res.json({ success: true, message: 'Cache limpo' });
});

// POST /api/chat/disconnect - Logout da Evolution
router.post('/disconnect', async (req, res) => {
    const instance = getInstance(req);
    try {
        await EvolutionService.logout(instance);
        EvolutionService.clearCache();
        res.json({ success: true, message: `Evolution Instance ${instance} Deleted` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/chat/react - Reage a uma mensagem
router.post('/react', async (req, res) => {
    const { phone, messageKey, reaction } = req.body;
    const instance = getInstance(req);
    try {
        const r = await axios.post(
            `${EVOLUTION_API_URL}/message/sendReaction/${instance}`,
            { key: messageKey, reaction },
            { headers: { 'apiKey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
        );
        res.json({ success: true, data: r.data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/chat/delete-message - Apaga uma mensagem para todos
router.post('/delete-message', async (req, res) => {
    const { phone, messageKey } = req.body;
    const instance = getInstance(req);
    try {
        const r = await axios.delete(
            `${EVOLUTION_API_URL}/message/delete/${instance}`,
            {
                data: { key: messageKey },
                headers: { 'apiKey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' }
            }
        );
        res.json({ success: true, data: r.data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/chat/webhook - Recebe eventos da Evolution API
router.post('/webhook', async (req, res) => {
    const event = req.body;
    const instance = event.instance;
    try {
        const jid = event.data?.key?.remoteJid;
        const pushName = event.data?.pushName;
        
        // Invalida o cache e tenta atualizar os metadados se houver um nome disponível
        if (jid) {
            EvolutionService.invalidateCache(instance, jid);
            
            // Se recebemos um pushName real, atualizamos o cache de metadados
            if (pushName && !/^\d+$/.test(pushName)) {
                // Tenta atualizar o cache de metadados existente ou criar novo
                (EvolutionService as any).metadataCache?.set(jid, { 
                    name: pushName, 
                    avatar: event.data?.profilePicUrl || '', 
                    ts: Date.now() 
                });
            }
        }
        
        // Broadcast segmentado por instância
        if (supabase && instance) {
            supabase.channel('presence-global').send({
                type: 'broadcast',
                event: `whatsapp-message:${instance}`,
                payload: event,
            });
        }
        res.status(200).send('OK');
    } catch (error: any) {
        res.status(500).send('Error');
    }
});

// GET /api/chat/media/:jid/:messageId - Proxy de mídia da Evolution API
router.get('/media/:jid/:messageId', async (req, res) => {
    const instance = getInstance(req);
    const { jid, messageId } = req.params;
    const { type = 'image', mime = '', name = '', fromMe = 'false', participant = '' } = req.query as any;

    try {
        // Normaliza o JID para garantir que a Evolution API localize a mensagem
        const cleanJid = jid.split(':')[0].trim().toLowerCase().replace('@c.us', '@s.whatsapp.net');
        const cleanParticipant = participant ? participant.split(':')[0].trim().toLowerCase().replace('@c.us', '@s.whatsapp.net') : undefined;

        const payload = {
            message: {
                key: {
                    remoteJid: cleanJid,
                    id: messageId,
                    fromMe: fromMe === 'true',
                    participant: cleanParticipant
                }
            },
            convertToMp4: false
        };

        console.log(`[Media Proxy] Buscando mídia para ${cleanJid}, ID: ${messageId}, fromMe: ${fromMe}, participant: ${cleanParticipant}`);

        const r = await axios.post(
            `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instance}`,
            payload,
            { headers: { 'apiKey': EVOLUTION_API_KEY } }
        );

        const base64Data = r.data?.base64 || r.data?.data;
        if (!base64Data) {
            console.warn(`[Media Proxy] Evolution não retornou base64 para ${messageId}`);
            return res.status(404).json({ error: 'Mídia não encontrada na Evolution' });
        }

        const buffer = Buffer.from(base64Data, 'base64');
        
        let contentType = mime || '';
        if (!contentType) {
            if (type === 'image') contentType = 'image/jpeg';
            else if (type === 'audio') contentType = 'audio/ogg';
            else if (type === 'sticker') contentType = 'image/webp';
            else if (type === 'video') contentType = 'video/mp4';
            else contentType = 'application/octet-stream';
        }

        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400'); // 24h cache
        
        if (name) {
            const encodedName = encodeURIComponent(name);
            res.set('Content-Disposition', `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
        }
        
        console.log(`[Media Proxy] Sucesso ao enviar mídia: ${name || messageId} (${buffer.length} bytes)`);
        res.send(buffer);
    } catch (error: any) {
        const status = error.response?.status || 500;
        const errMsg = error.response?.data?.message || error.message;
        console.error(`[Media Proxy] Erro (${status}):`, errMsg);
        res.status(status).json({ error: errMsg });
    }
});

export default router;
