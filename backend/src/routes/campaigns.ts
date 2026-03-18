import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Inicialização segura para suportar deploy sem env vars
let supabase: any;
try {
    supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
} catch (e) {
    console.error('Failed to create Supabase client in campaigns route');
    supabase = null;
}

/**
 * GET /api/campaigns/active-tasks
 * Rota principal para o n8n buscar o que precisa ser enviado agora.
 * Esta rota atua como o "Cérebro" do sistema.
 */
router.get('/active-tasks', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    try {
        // 1. Buscar todas as campanhas ativas
        const { data: activeCampaigns, error: campError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('status', 'active');

        if (campError) throw campError;

        const tasks: any[] = [];
        const today = new Date().toISOString().split('T')[0];

        for (const campaign of activeCampaigns) {
            // 2. Verificar quantos leads ainda podemos enviar hoje (respeitando daily_limit)
            // Aqui buscamos quantos foram enviados HOJE para esta campanha específica
            const { count: sentToday, error: countError } = await supabase
                .from('campaign_leads')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)
                .gte('sent_at', `${today}T00:00:00Z`);

            if (countError) throw countError;

            const remainingQuota = campaign.daily_limit - (sentToday || 0);

            if (remainingQuota > 0) {
                // 3a. PRIORIDADE: Buscar leads que foram adicionados MANUALMENTE (status 'pending' na campaign_leads)
                const { data: manualLeads, error: manualError } = await supabase
                    .from('campaign_leads')
                    .select('lead_id, leads(*)')
                    .eq('campaign_id', campaign.id)
                    .eq('status', 'pending')
                    .limit(remainingQuota);

                if (manualError) throw manualError;

                let processedManualCount = 0;
                if (manualLeads && manualLeads.length > 0) {
                    for (const row of manualLeads) {
                        const lead = row.leads as any;
                        if (!lead) continue;

                        const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
                        const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                        // Processar template de mensagem
                        let message = campaign.niche || '';
                        const websiteStatus = lead.has_own_website ? 'já possui um site' : 'ainda não possui um site próprio';

                        message = message.replace(/{{name}}/g, ''); // Limpa o nome
                        message = message.replace(/{{segment}}/g, lead.segment || '');
                        message = message.replace(/{{city}}/g, lead.city || '');
                        message = message.replace(/{{state}}/g, lead.state || '');
                        message = message.replace(/{{website_status}}/g, websiteStatus);

                        tasks.push({
                            campaign_id: campaign.id,
                            campaign_name: campaign.name,
                            lead_id: lead.id,
                            lead_name: lead.name,
                            phone: formattedPhone,
                            email: lead.email,
                            city: lead.city,
                            segment: lead.segment,
                            origin: lead.origin, // Inclui a origem no disparo manual também
                            message: message, // Texto já processado
                            channel: 'whatsapp',
                            step: 1
                        });
                        processedManualCount++;
                    }
                }

                const quotaForAuto = remainingQuota - processedManualCount;

                if (quotaForAuto > 0) {
                    // 3b. AUTOMÁTICO: Buscar leads que batem com o filtro da campanha
                    const { data: alreadyContactedOrPending } = await supabase
                        .from('campaign_leads')
                        .select('lead_id')
                        .eq('campaign_id', campaign.id);

                    const excludedIds = alreadyContactedOrPending?.map((c: any) => c.lead_id) || [];

                    let query = supabase.from('leads').select('*').eq('status', 'new').not('phone', 'is', null);

                    if (campaign.filters?.score_min) {
                        query = query.gte('score', campaign.filters.score_min);
                    }
                    if (campaign.filters?.segments && campaign.filters.segments.length > 0) {
                        query = query.in('segment', campaign.filters.segments);
                    }

                    if (excludedIds.length > 0) {
                        query = query.not('id', 'in', `(${excludedIds.join(',')})`);
                    }

                    const { data: leadPool, error: leadError } = await query.limit(quotaForAuto);

                    if (leadError) throw leadError;

                    if (leadPool && leadPool.length > 0) {
                        for (const lead of leadPool) {
                            const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';

                            // Validação rigorosa: Celular Brasil (DDD + 9 + 8 dígitos = 11 caracteres)
                            // Remove o 55 inicial se existir para validar o padrão local
                            const localPhone = cleanPhone.startsWith('55') ? cleanPhone.substring(2) : cleanPhone;

                            const isMobile = localPhone.length === 11 && localPhone.startsWith('9');

                            if (isMobile) {
                                const formattedPhone = '55' + localPhone;

                                // Processar template de mensagem
                                let message = campaign.niche || '';
                                const websiteStatus = lead.has_own_website ? 'já possui um site' : 'ainda não possui um site próprio';

                                // Limpeza profunda do placeholder de nome
                                message = message.replace(/{{name}}/g, '');
                                message = message.replace(/\s*,/g, ','); // Remove qualquer espaço ANTES da vírgula
                                message = message.replace(/Olá,/g, 'Olá, '); // Garante espaço DEPOIS da vírgula
                                message = message.replace(/\s\s+/g, ' ').trim(); // Remove múltiplos espaços

                                message = message.replace(/{{segment}}/g, lead.segment || '');
                                message = message.replace(/{{city}}/g, lead.city || '');
                                message = message.replace(/{{state}}/g, lead.state || '');
                                message = message.replace(/{{website_status}}/g, websiteStatus);

                                tasks.push({
                                    campaign_id: campaign.id,
                                    campaign_name: campaign.name,
                                    lead_id: lead.id,
                                    lead_name: lead.name,
                                    phone: formattedPhone,
                                    email: lead.email,
                                    city: lead.city,
                                    segment: lead.segment,
                                    origin: lead.origin, // Inclui a origem para routing
                                    message: message,
                                    channel: 'whatsapp',
                                    step: 1
                                });
                            }
                        }
                    }
                }
            }
        }

        // Retorna o array diretamente para o n8n não dar erro de undefined
        res.json(tasks);

    } catch (error: any) {
        console.error('Error fetching active tasks:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/campaigns/:id/track-send
 * Registra o sucesso de um envio e atualiza as métricas da campanha.
 */
router.post('/:id/track-send', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });
    const { id: campaignId } = req.params;
    const { lead_id, status = 'sent', message } = req.body;

    try {
        // 1. Registrar na tabela campaign_leads (Upsert para suportar leads manuais que estavam 'pending')
        const { error: trackError } = await supabase
            .from('campaign_leads')
            .upsert({
                campaign_id: campaignId,
                lead_id: lead_id,
                status: status,
                sent_at: new Date().toISOString()
            }, { onConflict: 'campaign_id, lead_id' });

        if (trackError) throw trackError;

        // 2. Atualizar contador global da campanha
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('sent_count')
            .eq('id', campaignId)
            .single();

        await supabase
            .from('campaigns')
            .update({ sent_count: (campaign?.sent_count || 0) + 1 })
            .eq('id', campaignId);

        // 3. Registrar no histórico geral de contatos (com trava de duplicidade de 30s)
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        const { data: existingChat } = await supabase
            .from('contact_history')
            .select('id')
            .eq('company_id', lead_id)
            .eq('message', message)
            .gte('data_envio', thirtySecondsAgo)
            .limit(1);

        if (!existingChat || existingChat.length === 0) {
            await supabase
                .from('contact_history')
                .insert({
                    company_id: lead_id,
                    type: 'whatsapp',
                    message: message,
                    status: 'sent',
                    direction: 'outbound',
                    data_envio: new Date().toISOString()
                });
        }

        // 4. Atualizar o status do lead para 'contacted'
        await supabase
            .from('leads')
            .update({ status: 'contacted' })
            .eq('id', lead_id);

        res.json({ success: true, message: 'Send tracked successfully' });

    } catch (error: any) {
        console.error('Error tracking campaign send:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/campaigns/:id/add-leads
 * Adiciona leads manualmente à fila de uma campanha.
 */
router.post('/:id/add-leads', async (req, res) => {
    const { id: campaignId } = req.params;
    const { leadIds } = req.body; // Array de IDs de leads

    if (!leadIds || !Array.isArray(leadIds)) {
        return res.status(400).json({ error: 'leadIds must be an array' });
    }

    try {
        const records = leadIds.map(leadId => ({
            campaign_id: campaignId,
            lead_id: leadId,
            status: 'pending'
        }));

        const { error } = await supabase
            .from('campaign_leads')
            .upsert(records, { onConflict: 'campaign_id, lead_id' });

        if (error) throw error;

        res.json({ success: true, message: `${leadIds.length} leads added to campaign queue` });
    } catch (error: any) {
        console.error('Error adding leads to campaign:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/campaigns/:id/leads
 * Remove um ou mais leads de uma campanha específica.
 */
router.delete('/:id/leads', async (req, res) => {
    const { id: campaignId } = req.params;
    const { leadIds } = req.body; // Array de IDs de leads

    if (!leadIds || !Array.isArray(leadIds)) {
        return res.status(400).json({ error: 'leadIds must be an array' });
    }

    try {
        const { error } = await supabase
            .from('campaign_leads')
            .delete()
            .eq('campaign_id', campaignId)
            .in('lead_id', leadIds);

        if (error) throw error;

        res.json({ success: true, message: `${leadIds.length} leads removed from campaign` });
    } catch (error: any) {
        console.error('Error removing leads from campaign:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
