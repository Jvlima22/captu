import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { EvolutionService } from '../services/evolution';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// POST /api/chat/send - Envia uma mensagem manualmente pelo sistema
router.post('/send', async (req, res) => {
    const { leadId, message, phone } = req.body;
    console.log('Sending message to:', phone, 'leadId:', leadId);

    if (!leadId || !message || !phone) {
        return res.status(400).json({ error: 'leadId, message and phone are required' });
    }

    try {
        // 1. Limpar o telefone (apenas números)
        const cleanPhone = phone.replace(/\D/g, '');
        // Adicionar DDI 55 se necessário (estratégia básica)
        const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
        console.log('Formatted phone:', formattedPhone);

        // 2. Enviar via Evolution API
        try {
            await EvolutionService.sendMessage(formattedPhone, message);
            console.log('Message sent via Evolution API');
        } catch (evoError: any) {
            console.error('Evolution API Error details:', evoError.response?.data || evoError.message);
            throw new Error(`Erro na Evolution API: ${evoError.response?.data?.message || evoError.message}`);
        }

        // 3. Salvar no histórico de contatos (Supabase)
        const { error: historyError } = await supabase
            .from('contact_history')
            .insert({
                company_id: leadId,
                type: 'whatsapp',
                message: message,
                status: 'sent',
                direction: 'outbound',
                data_envio: new Date().toISOString()
            });

        if (historyError) {
            console.error('Supabase Error details:', historyError);
            throw historyError;
        }

        res.json({ success: true, message: 'Message sent and recorded' });
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
            channel.subscribe(async (status) => {
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

            // Extração robusta de texto (suporta texto direto, mensagens de texto estendidas, legendas de mídia e botões)
            const text = messageData.message?.conversation ||
                messageData.message?.extendedTextMessage?.text ||
                messageData.message?.imageMessage?.caption ||
                messageData.message?.videoMessage?.caption ||
                messageData.message?.buttonsResponseMessage?.selectedButtonId ||
                messageData.message?.listResponseMessage?.title ||
                'Mensagem de mídia/não suportada';

            console.log(`[Webhook] Mensagem de ${phone}: ${text.substring(0, 50)}...`);

            // Buscar lead limpando o telefone recebido e comparando com o final do número no banco
            const cleanIncomingPhone = phone.replace(/\D/g, '');
            // Pegamos os últimos 8 dígitos para uma busca mais segura contra variações de DDD e DDI
            const phoneSuffix = cleanIncomingPhone.slice(-8);

            const { data: leads, error: leadError } = await supabase
                .from('leads')
                .select('id, name')
                .ilike('phone', `%${phoneSuffix}%`)
                .limit(1);

            if (leadError) {
                console.error('[Webhook] Erro ao buscar lead:', leadError);
            }

            if (leads && leads.length > 0) {
                const leadId = leads[0].id;
                console.log(`[Webhook] Lead identificado: ${leads[0].name} (ID: ${leadId})`);

                // 1. Registrar a mensagem recebida no histórico
                const { error: historyError } = await supabase
                    .from('contact_history')
                    .insert({
                        company_id: leadId,
                        type: 'whatsapp',
                        message: text,
                        status: 'received',
                        direction: 'inbound',
                        data_envio: new Date().toISOString()
                    });

                if (historyError) {
                    console.error('[Webhook] Erro ao salvar histórico:', historyError);
                }

                // 2. Atualizar o status do lead para 'replied'
                await supabase
                    .from('leads')
                    .update({ status: 'replied', updated_at: new Date().toISOString() })
                    .eq('id', leadId);

                // 3. Atualizar campaign_leads e incrementar contador de respostas
                const { data: latestCampaignLead } = await supabase
                    .from('campaign_leads')
                    .select('campaign_id, status')
                    .eq('lead_id', leadId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (latestCampaignLead && latestCampaignLead.status !== 'replied') {
                    await supabase
                        .from('campaign_leads')
                        .update({ status: 'replied' })
                        .eq('lead_id', leadId)
                        .eq('campaign_id', latestCampaignLead.campaign_id);

                    const { data: campaign } = await supabase
                        .from('campaigns')
                        .select('replies_count')
                        .eq('id', latestCampaignLead.campaign_id)
                        .single();

                    if (campaign) {
                        await supabase
                            .from('campaigns')
                            .update({
                                replies_count: (campaign.replies_count || 0) + 1,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', latestCampaignLead.campaign_id);
                    }
                }
            } else {
                console.log(`[Webhook] Nenhum lead encontrado para o telefone ${phone}`);
            }
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error('[Webhook] Falha crítica:', error.message);
        res.status(500).send('Error');
    }
});

export default router;
