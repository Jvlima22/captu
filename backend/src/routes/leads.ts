import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { searchLeads } from '../services/googlePlaces.js';
import { searchLinkedinCompanies } from '../services/linkedinSearch.js';
import { generateSalesCopy } from '../services/aiService.js';


const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Supabase environment variables are missing!');
}

// Inicialização segura para evitar crash imediato na Vercel
export const supabase = (supabaseUrl && supabaseKey) 
    ? createClient(supabaseUrl, supabaseKey)
    : null as any;

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

        if (!leads || leads.length === 0) {
            return res.json({ message: 'Nenhum lead encontrado', count: 0, data: [] });
        }

        // Formata os dados para o banco
        const formattedLeads = leads.map((l: any) => ({
            ...l,
            origin: 'google_places'
        }));

        // Tenta upsert por place_id (ID único do Google Places)
        let savedData: any[] = [];
        let savedCount = 0;

        // Verifica se os leads possuem place_id para usar como chave de conflito
        const leadsWithPlaceId = formattedLeads.filter((l: any) => l.place_id);
        const leadsWithoutPlaceId = formattedLeads.filter((l: any) => !l.place_id);

        if (leadsWithPlaceId.length > 0) {
            const { data: upsertData, error: upsertError } = await supabase
                .from('leads')
                .upsert(leadsWithPlaceId, { onConflict: 'place_id', ignoreDuplicates: false })
                .select();

            if (upsertError) {
                console.error('Upsert error (place_id):', upsertError.message);
                // Fallback: insert simples ignorando duplicatas
                const { data: insertData, error: insertError } = await supabase
                    .from('leads')
                    .insert(leadsWithPlaceId)
                    .select();

                if (!insertError && insertData) {
                    savedData = [...savedData, ...insertData];
                    savedCount += insertData.length;
                }
            } else if (upsertData) {
                savedData = [...savedData, ...upsertData];
                savedCount += upsertData.length;
            }
        }

        if (leadsWithoutPlaceId.length > 0) {
            const { data: insertData, error: insertError } = await supabase
                .from('leads')
                .insert(leadsWithoutPlaceId)
                .select();

            if (!insertError && insertData) {
                savedData = [...savedData, ...insertData];
                savedCount += insertData.length;
            }
        }

        res.json({ message: 'Leads coletados e salvos com sucesso', count: leads.length, data: savedData });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/leads/collect-linkedin - Coleta leads do LinkedIn via Tavily/Search
router.post('/collect-linkedin', async (req, res) => {
    const { query, city } = req.body;

    if (!query || !city) {
        return res.status(400).json({ error: 'Query and city are required' });
    }

    try {
        console.log(`[LinkedIn] Buscando empresas para: ${query} em ${city}`);
        const leads = await searchLinkedinCompanies(query, city);

        if (!leads || leads.length === 0) {
            return res.json({ message: 'Nenhuma empresa encontrada no LinkedIn', count: 0, data: [] });
        }

        // Salva os leads no banco
        const { data: savedData, error: upsertError } = await supabase
            .from('leads')
            .upsert(leads, { onConflict: 'website', ignoreDuplicates: true }) // No LinkedIn, a URL é o ID único
            .select();

        if (upsertError) {
            console.error('Erro ao salvar leads do LinkedIn:', upsertError);
            // Fallback para insert simples
            await supabase.from('leads').insert(leads);
        }

        res.json({ 
            message: 'Empresas do LinkedIn coletadas com sucesso', 
            count: leads.length, 
            data: savedData || leads 
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/leads/:id/send-to-n8n - Dispara automação no n8n para um lead específico
router.post('/:id/send-to-n8n', async (req, res) => {
    const { id } = req.params;

    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase client not initialized. Check Env Vars.' });
        }
        // 1. Busca dados completos do lead
        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // 2. Lógica Dinâmica de Webhook baseada na Origem
        let n8nWebhookUrl = process.env.N8N_WEBHOOK_URL; // URL Padrão (Google Maps)
        const linkedinWebhookUrl = process.env.N8N_LINKEDIN_WEBHOOK_URL; // URL Nova (LinkedIn)

        if (lead.origin === 'linkedin' && linkedinWebhookUrl && !linkedinWebhookUrl.includes('...')) {
            console.log(`[Webhook Router] Lead do LinkedIn detectado. Redirecionando para: ${linkedinWebhookUrl}`);
            n8nWebhookUrl = linkedinWebhookUrl;
        } else {
            console.log(`[Webhook Router] Usando webhook padrão. Origem: ${lead.origin || 'google_places'}`);
        }

        if (!n8nWebhookUrl || n8nWebhookUrl.includes('...')) {
            return res.status(400).json({ error: 'Webhook URL not configured for this origin' });
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

// POST /api/leads/n8n-trigger - Dispara a Busca Avançada no n8n
router.post('/n8n-trigger', async (req, res) => {
    const payload = req.body;
    try {
        // Tentamos usar a variável de ambiente ou o default apontando pro n8n em PRODUÇÃO (sem -test)
        const n8nWebhookUrl = process.env.N8N_ADVANCED_SEARCH_WEBHOOK || 'https://n8n.tglsolutions.com.br/webhook/captu-busca-ia';
        
        console.log(`[n8n-trigger] Mandando requisição para Busca Avançada em: ${n8nWebhookUrl}`);
        
        // Dispara o payload diretamente! N8n já engole o json root em $json.body
        const response = await axios.post(n8nWebhookUrl, payload);
        
        res.status(200).json({ 
            message: 'Automação iniciada com sucesso. Os leads serão salvos no banco de dados.', 
            n8n_status: response.status 
        });
    } catch (error: any) {
        console.error('[n8n-trigger] Erro ao comunicar com n8n:', error.message);
        res.status(500).json({ error: 'Erro de comunicação com o webhook do n8n.' });
    }
});

export default router;
