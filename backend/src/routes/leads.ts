import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { searchLeads } from '../services/googlePlaces';
import { generateSalesCopy } from '../services/aiService';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Supabase environment variables are missing in backend/.env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/leads - Busca leads do banco
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/leads/:id - Busca detalhes de um lead específico
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Lead not found' });

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/leads/collect - Coleta novos leads via Google Places
router.post('/collect', async (req, res) => {
    const { query, city, radius, minRating, minReviews, onlyWithoutWebsite, onlyWithPhone } = req.body;

    if (!query || !city) {
        return res.status(400).json({ error: 'Query and city are required' });
    }

    try {
        // Monta objeto de filtros
        const filters = {
            radius: radius || 10000,
            minRating: minRating || 0,
            minReviews: minReviews || 0,
            onlyWithoutWebsite: onlyWithoutWebsite || false,
            onlyWithPhone: onlyWithPhone || false
        };

        console.log('Buscando leads com filtros:', filters);

        const leads = await searchLeads(query, city, filters);

        // Formata os dados para o banco conforme a estratégia
        const formattedLeads = leads.map((l: any) => ({
            ...l,
            origin: 'google_places'
        }));

        const { data, error } = await supabase
            .from('leads')
            .upsert(formattedLeads, { onConflict: 'name, city' })
            .select();

        if (error) {
            const { data: insertData, error: insertError } = await supabase
                .from('leads')
                .insert(formattedLeads)
                .select();

            if (insertError) throw insertError;
            return res.json({ message: 'Leads collected', count: leads.length, data: insertData });
        }

        res.json({ message: 'Leads collected and synced', count: leads.length, data });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/leads/:id/send-to-n8n - Dispara automação no n8n para um lead específico
router.post('/:id/send-to-n8n', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Busca dados completos do lead
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // 2. Dispara webhook para o n8n
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

        if (!n8nWebhookUrl || n8nWebhookUrl.includes('...')) {
            return res.status(400).json({ error: 'n8n Webhook URL not configured' });
        }

        const response = await axios.post(n8nWebhookUrl, {
            lead: lead,
            action: 'start_outreach',
            timestamp: new Date().toISOString()
        });

        // 3. Atualiza status para 'contacted'
        await supabase
            .from('leads')
            .update({ status: 'contacted' })
            .eq('id', id);

        res.json({ message: 'Lead sent to n8n successfully', n8n_response: response.data });

    } catch (error: any) {
        console.error('Error in send-to-n8n:', error.message);
        if (error.response) {
            console.error('n8n Response data:', error.response.data);
            console.error('n8n Response status:', error.response.status);
        } else if (error.request) {
            console.error('No response received from n8n (Connection refused? Is n8n running?)');
        }
        res.status(500).json({ error: error.message, details: 'Check backend console for more info' });
    }
});

// POST /api/leads/:id/history - Registra histórico de contato
router.post('/:id/history', async (req, res) => {
    const { id } = req.params;
    const { channel, message, status } = req.body;

    try {
        const { error } = await supabase
            .from('contact_history')
            .insert({
                company_id: id,
                type: channel,
                message,
                status,
                data_envio: new Date().toISOString() // Ajustado para bater com o PDF (data_envio)
            });

        if (error) throw error;
        res.json({ message: 'History recorded' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/leads/bulk-delete - Exclui leads em massa
router.delete('/bulk-delete', async (req, res) => {
    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'leadIds array is required' });
    }

    try {
        // Primeiro deletamos as dependências se não houver cascade
        await supabase.from('contact_history').delete().in('company_id', leadIds);
        await supabase.from('campaign_leads').delete().in('lead_id', leadIds);

        // Então deletamos os leads
        const { error } = await supabase
            .from('leads')
            .delete()
            .in('id', leadIds);

        if (error) throw error;

        res.json({ message: 'Leads deleted successfully', count: leadIds.length });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/leads/:id/generate-copy - Gera abordagem personalizada via IA
router.post('/:id/generate-copy', async (req, res) => {
    const { id } = req.params;
    console.log(`[AI Copy] Requested for lead ID: ${id}`);
    try {
        const { data: lead, error } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !lead) {
            console.error(`[AI Copy] Lead not found: ${id}`, error);
            return res.status(404).json({ error: 'Lead not found' });
        }

        const copy = await generateSalesCopy(lead);
        console.log(`[AI Copy] Generated successfully for: ${lead.name}`);

        res.json({ copy });
    } catch (error: any) {
        console.error(`[AI Copy] Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

export default router;

