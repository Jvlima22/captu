import express from 'express';
import axios from 'axios';
import { IntegrationService } from '../services/integrationService.js';

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const MANUS_API_KEY = process.env.MANUS_API_KEY || '';

// ─── FERRAMENTAS DO CAPTU (REUTILIZÁVEIS) ──────────────────────────────────
const CAPTU_TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_leads_qualificados",
      description: "Consulta o banco de dados do CAPTU para retornar a lista de contatos/leads mais recentes que o usuário possui. Use isso sempre que o usuário perguntar sobre leads, quem são os contatos, pesquisas do google maps ou linkedin, ou estatísticas da base dele.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade máxima de leads a consultar. O padrão é 10 e o máximo razoável é 50." },
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_campanhas_ativas",
      description: "Consulta o banco de dados do CAPTU para retornar as campanhas ativas de prospecção do projeto. Retorna Nomes, Status, Limites Diários, e Nicho de envio.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade máxima de campanhas a consultar. O padrão é 5." },
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "relatorio_geral_projeto",
      description: "Retorna um resumo estatístico profundo de todo o projeto CAPTU do usuário: contagem total de leads, total de campanhas, total de disparos/histórico e leads em fila. Use isso se o usuário pedir dados em geral da plataforma, resumos ou estatísticas do projeto todo.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_historico_contatos",
      description: "Consulta o banco de dados para retornar o histórico de mensagens enviadas recentemente aos leads. Use isso para ver o que foi falado nas conversas e qual o status de envio no whatsapp ou email.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade máxima de históricos a consultar. Padrão 5." },
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_canais_slack",
      description: "Retorna a lista de canais públicos (nome e ID) disponíveis no Workspace do Slack do usuário para que o agente saiba onde pode postar mensagens.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "enviar_mensagem_slack",
      description: "Envia uma mensagem de texto profissional para um canal específico do Slack do usuário. Use isso para notificar o time sobre leads, mandar resumos estratégicos ou alertas de conversão.",
      parameters: {
        type: "object",
        properties: {
          channel_id: { type: "string", description: "O ID do canal do Slack (ex: C12345). Obtenha este ID usando a ferramenta listar_canais_slack primeiro se não souber." },
          text: { type: "string", description: "O conteúdo formatado da mensagem." }
        },
        required: ["channel_id", "text"]
      }
    }
  }
];

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * GET /api/agent/available-models
 * Returns which models have active API keys configured
 */
router.get('/available-models', (_req, res) => {
  res.json({
    available: [
      { id: 'gemini', available: !!GEMINI_API_KEY },
      { id: 'openai', available: !!OPENAI_API_KEY },
      { id: 'claude', available: !!ANTHROPIC_API_KEY },
      { id: 'elevenlabs', available: !!ELEVENLABS_API_KEY },
      { id: 'manus', available: !!MANUS_API_KEY },
      { id: 'grok', available: false },
      { id: 'perplexity', available: false },
    ]
  });
});

/**
 * POST /api/agent/chat
 * Proxy para as APIs de IA com suporte a múltiplos provedores
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, provider = 'gemini', systemPrompt, fileContent, userId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Carregar Chave Customizada do Cliente se existir (OpenAI, Anthropic, Gemini, etc)
    let customKey = null;
    if (userId) {
      try {
        const integ = await IntegrationService.getIntegration(userId, provider);
        if (integ && integ.is_active && integ.credentials?.apiKey) {
          customKey = integ.credentials.apiKey;
        }
      } catch (err) {
        console.warn(`[CAPTU AI] Erro ao buscar chave customizada para ${provider}:`, err);
      }
    }

    // Contexto base do CAPTU injetado em todas as conversas
    let captuContext = systemPrompt || `Você é o CAPTU AI, um assistente de inteligência artificial especializado em prospecção B2B e vendas.
Você tem acesso ao contexto da plataforma CAPTU, que é uma ferramenta de prospecção de leads.
Você pode ajudar com:
- Geração de scripts de prospecção personalizados
- Análise de leads e empresas
- Criação de relatórios de vendas
- Estratégias de abordagem B2B
- Análise de campanhas e métricas
- Sugestões de follow-up e automações
- Qualificação de leads por perfil de empresa

Seja direto, profissional e focado em resultados de vendas. Responda sempre em português do Brasil.
Use markdown quando útil: negrito para termos importantes, listas para sequências, tabelas para comparações.
${fileContent ? `\n\nO usuário enviou um arquivo com o seguinte conteúdo:\n${fileContent}` : ''}`;

    // ─── INJEÇÃO DE CONTEXTO VIVO DO PROJETO ──────────────────────────────────
    try {
      if (userId) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
        const { createClient } = await import('@supabase/supabase-js');
        const db = createClient(supabaseUrl, supabaseKey);

        const [leadsRes, campsRes] = await Promise.all([
          db.from('leads').select('*', { count: 'exact', head: true }),
          db.from('campaigns').select('*').limit(10).order('created_at', { ascending: false })
        ]);

        const totalLeads = leadsRes.count || 0;
        const recentCampaigns = (campsRes.data || []).map(c => `- ${c.name} (${c.status}): ${c.niche || 'Geral'}`).join('\n');

        captuContext += `\n\n--- DADOS EM REAL-TIME DO PROJETO ---\nNo momento, o usuário possui ${totalLeads} leads capturados no banco de dados.\nCampanhas recentes:\n${recentCampaigns || 'Nenhuma campanha criada ainda.'}\n-------------------------------------\n
INSTRUÇÕES ESTRATÉGICAS (MANDATÓRIO):
1. Você é o BRAÇO DIREITO do usuário na prospecção B2B. Suas respostas devem ser COMPLETAS, PROFUNDAS e ESTRUTURADAS como um relatório de consultoria de alto nível. NUNCA dê respostas curtas ou apenas uma tabela isolada.
2. ESTRUTURA PADRÃO DE RESPOSTA:
   - **Introdução Profissional**: Resumo da situação atual do projeto baseado nos dados em tempo real.
   - **📋 Tabela de Resumo**: Listagem clara organizada por Campanha, Status, Nicho e Objetivo.
   - **🔍 Análise Estratégica**: Decomponha os nichos (Barbearias, Vinícolas, etc.), analise o que está funcionando e o que pode melhorar.
   - **💡 Insight do CAPTU AI**: Forneça recomendações acionáveis para scripts, fluxos de cadência ou prospecção de nichos.
3. Use os dados de forma NATURAL (como se você estivesse logado no CAPTU). Não diga "conforme os dados que recebi".
4. Seja proativo: se vir uma campanha pausada ou um nicho pouco explorado, sugira como reativar ou expandir.`;
      }
    } catch (dbErr) {
      console.warn('[CAPTU AI] Falha ao injetar contexto vivo:', dbErr);
    }

    // ─── GEMINI ───────────────────────────────────────────────────────────────
    if (provider === 'gemini') {
      const activeKey = customKey || GEMINI_API_KEY;
      if (!activeKey) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no sistema nem no seu painel de Integrações.' });

      const geminiContents = messages.map((msg: Message) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${activeKey}`,
        {
          contents: geminiContents,
          systemInstruction: { parts: [{ text: captuContext }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
      return res.json({ reply: text, provider: 'gemini' });
    }

    // ─── OPENAI ───────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const activeKey = customKey || OPENAI_API_KEY;
      if (!activeKey) return res.status(500).json({ error: 'OPENAI_API_KEY não configurada no sistema nem no seu painel de Integrações.' });

      console.log(`[CAPTU AI] OpenAI Key ${customKey ? '(Custom Tenant)' : '(Global Env)'}: ${activeKey.substring(0, 12)}...`);

      const openaiMessages = [
        { role: 'system', content: captuContext },
        ...messages.map((msg: Message) => ({ role: msg.role, content: msg.content }))
      ];

      const makeOpenAICall = async (msgs: any[]) => axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: msgs,
          max_tokens: 2048,
          temperature: 0.7,
          tools: CAPTU_TOOLS,
          tool_choice: "auto"
        },
        {
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let response = await makeOpenAICall(openaiMessages);
      let responseMsg = response.data.choices?.[0]?.message;

      // Se a IA decidiu que precisa rodar a função no nosso banco:
      if (responseMsg?.tool_calls) {
        console.log('[CAPTU AI] A IA solicitou acesso ao DB via Tools:', responseMsg.tool_calls.map((t:any) => t.function.name));
        
        // Conexão temporária com Supabase no server (usando Service Role para contornar RLS no back-end, cuidado se a arquitetura for Multi-Tenant sem ID no schema)
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
        const { createClient } = await import('@supabase/supabase-js');
        const dbClient = createClient(supabaseUrl, supabaseKey);

        const toolMessages: any[] = [];

        for (const tool of responseMsg.tool_calls) {
          let toolResult: any;
          if (tool.function.name === 'buscar_leads_qualificados') {
            const args = JSON.parse(tool.function.arguments || '{}');
            const limit = args.limit || 10;
            
            console.log(`[CAPTU AI] Rodando query no Supabase: leads limit ${limit}`);
            let query = dbClient.from('leads').select('*').limit(limit).order('created_at', { ascending: false });
            
            // Segurança: caso a tabela leads tenha user_id, nós filtaríamos aqui pelo `userId` do loop atual do backend: 
            // if (userId) query = query.eq('user_id', userId);

            const { data, error } = await query;

            if (error) {
              toolResult = { erro: error.message };
            } else {
              // Criptografar e minimizar colunas descartando nulls ou links Giga pra economizar Token e Dinheiro:
              toolResult = (data || []).map((lead: any) => ({
                id: lead.id,
                n: lead.name,
                emp: lead.company,
                ph: lead.phone,
                st: lead.status
              }));
              if (toolResult.length === 0) toolResult = "A tabela de leads está vazia. Informe que não há leads capturados no momento.";
            }

          } else if (tool.function.name === 'buscar_campanhas_ativas') {
            const args = JSON.parse(tool.function.arguments || '{}');
            const limit = args.limit || 5;
            
            console.log(`[CAPTU AI] Rodando query no Supabase: campaigns limit ${limit}`);
            let query = dbClient.from('campaigns').select('*').limit(limit).order('created_at', { ascending: false });
            
            // Segurança por userId se existir
            // if (userId) query = query.eq('user_id', userId);

            const { data, error } = await query;

            if (error) {
              toolResult = { erro: error.message };
            } else {
              toolResult = (data || []).map((camp: any) => ({
                id: camp.id,
                name: camp.name,
                status: camp.status,
                daily_limit: camp.daily_limit,
                sent_count: camp.sent_count,
                niche: camp.niche
              }));
              if (toolResult.length === 0) toolResult = "Não há campanhas ativas no momento.";
            }

          } else if (tool.function.name === 'relatorio_geral_projeto') {
            console.log(`[CAPTU AI] Rodando query no Supabase: relatorio geral`);
            try {
              const [leads, camps, hist, campLeads] = await Promise.all([
                  dbClient.from('leads').select('*', { count: 'exact', head: true }),
                  dbClient.from('campaigns').select('*', { count: 'exact', head: true }),
                  dbClient.from('contact_history').select('*', { count: 'exact', head: true }),
                  dbClient.from('campaign_leads').select('*', { count: 'exact', head: true })
              ]);
              toolResult = {
                total_leads_capturados: leads.count || 0,
                total_campanhas_criadas: camps.count || 0,
                total_veces_que_um_lead_foi_contactado: hist.count || 0,
                total_leads_em_fila_das_campanhas: campLeads.count || 0
              };
            } catch (err: any) {
              toolResult = { erro: err.message };
            }

          } else if (tool.function.name === 'buscar_historico_contatos') {
            const args = JSON.parse(tool.function.arguments || '{}');
            const limit = args.limit || 5;
            
            console.log(`[CAPTU AI] Rodando query no Supabase: contact history limit ${limit}`);
            const { data, error } = await dbClient.from('contact_history').select('*').limit(limit).order('data_envio', { ascending: false });
            
            if (error) {
              toolResult = { erro: error.message };
            } else {
              toolResult = (data || []).map((h: any) => ({
                id: h.company_id,
                tipo_canal: h.type,
                status_envio: h.status,
                detalhe_mensagem: h.message,
                data_hora: h.data_envio
              }));
              if (toolResult.length === 0) toolResult = "Nenhum histórico de contato encontrado. Nenhuma mensagem foi enviada ainda.";
            }

          } else if (tool.function.name === 'listar_canais_slack') {
            console.log(`[CAPTU AI] Slack: Listando canais para o usuário ${userId}`);
            try {
              if (!userId) throw new Error("Usuário não identificado.");
              const slackIntegration = await IntegrationService.getIntegration(userId, 'slack');
              if (!slackIntegration || !slackIntegration.is_active || !slackIntegration.credentials?.access_token) {
                throw new Error("Slack não conectado. Peça ao usuário para conectar o Slack na aba de Integrações.");
              }
              
              const slackRes = await axios.get('https://slack.com/api/conversations.list', {
                headers: { 'Authorization': `Bearer ${slackIntegration.credentials.access_token}` }
              });

              if (!slackRes.data.ok) throw new Error(slackRes.data.error || 'Erro na API do Slack');
              
              toolResult = (slackRes.data.channels || [])
                .filter((c: any) => c.is_channel && !c.is_archived)
                .map((c: any) => ({ id: c.id, name: c.name }));
              
            } catch (err: any) {
              toolResult = { erro: err.message };
            }

          } else if (tool.function.name === 'enviar_mensagem_slack') {
            const args = JSON.parse(tool.function.arguments || '{}');
            console.log(`[CAPTU AI] Slack: Enviando mensagem para o canal ${args.channel_id}`);
            try {
              if (!userId) throw new Error("Usuário não identificado.");
              const slackIntegration = await IntegrationService.getIntegration(userId, 'slack');
              if (!slackIntegration || !slackIntegration.is_active || !slackIntegration.credentials?.access_token) {
                throw new Error("Slack não conectado.");
              }

              const slackRes = await axios.post('https://slack.com/api/chat.postMessage', {
                channel: args.channel_id,
                text: args.text
              }, {
                headers: { 'Authorization': `Bearer ${slackIntegration.credentials.access_token}` }
              });

              if (!slackRes.data.ok) throw new Error(slackRes.data.error || 'Erro na API do Slack');
              toolResult = { ok: true, ts: slackRes.data.ts, channel: args.channel_id };

            } catch (err: any) {
              toolResult = { erro: err.message };
            }

          } else {
             toolResult = { erro: "Função não suportada" };
          }

          toolMessages.push({
            role: "tool",
            tool_call_id: tool.id,
            content: JSON.stringify(toolResult)
          });
        }

        // Fazer a segunda chamada de IA com os dados do banco
        console.log('[CAPTU AI] Devolvendo dados do Supabase para a OpenAI montar a resposta...');
        response = await makeOpenAICall([ ...openaiMessages, responseMsg, ...toolMessages ]);
        responseMsg = response.data.choices?.[0]?.message;
      }

      const text = responseMsg?.content || 'Sem resposta após consultar os dados.';
      return res.json({ reply: text, provider: 'openai' });
    }

    // ─── CLAUDE (ANTHROPIC) ───────────────────────────────────────────────────
    if (provider === 'claude') {
      const activeKey = customKey || ANTHROPIC_API_KEY;
      if (!activeKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada.' });

      const claudeMessages = messages.map((msg: Message) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          system: captuContext,
          messages: claudeMessages
        },
        {
          headers: {
            'x-api-key': activeKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      const text = response.data.content?.[0]?.text || 'Sem resposta.';
      return res.json({ reply: text, provider: 'claude' });
    }

    // ─── ELEVENLABS (Text to Speech) ──────────────────────────────────────────
    if (provider === 'elevenlabs') {
      const activeKey = customKey || ELEVENLABS_API_KEY;
      if (!activeKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY não configurada.' });

      // Para ElevenLabs, primeiro usamos Gemini para gerar o script e depois convertemos em áudio
      let scriptText = messages[messages.length - 1]?.content || '';

      // Se a mensagem for uma solicitação de criação, gera o script com Gemini
      const elevenLabsPrompt = `${captuContext}\n\nGere um script de áudio curto e profissional (máximo 200 palavras) para ser narrado. Escreva apenas o texto do script, sem formatação markdown, sem títulos. O texto deve ser natural para fala.`;

      if (GEMINI_API_KEY) {
        try {
          const scriptResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              contents: [{ role: 'user', parts: [{ text: scriptText }] }],
              systemInstruction: { parts: [{ text: elevenLabsPrompt }] },
              generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
            },
            { headers: { 'Content-Type': 'application/json' } }
          );
          scriptText = scriptResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || scriptText;
        } catch (geminiError) {
          console.warn('[ElevenLabs] Gemini text generation failed, falling back to raw text. Error:', geminiError);
        }
      }

      // Converter para áudio com ElevenLabs (Voz: Rachel - profissional e clara)
      const audioResponse = await axios.post(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
        {
          text: scriptText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        },
        {
          headers: {
            'xi-api-key': activeKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'arraybuffer'
        }
      );

      const base64Audio = Buffer.from(audioResponse.data).toString('base64');
      return res.json({
        reply: `🔊 **Script de áudio gerado com sucesso!**\n\n_Texto narrado:_\n\n${scriptText}`,
        provider: 'elevenlabs',
        audio: `data:audio/mpeg;base64,${base64Audio}`,
        script: scriptText
      });
    }

    // ─── MANUS AI (Autonomous Agent) ──────────────────────────────────────────
    if (provider === 'manus') {
      const activeKey = customKey || MANUS_API_KEY;
      if (!activeKey) return res.status(500).json({ error: 'MANUS_API_KEY não configurada.' });

      // O Manus é um agente autônomo. Vamos enviar o histórico e o contexto.
      const lastMessage = messages[messages.length - 1]?.content || '';
      const prompt = `${captuContext}\n\nHistórico da conversa:\n${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}\n\nUsuário: ${lastMessage}`;

      console.log('[CAPTU AI] Iniciando tarefa no Manus AI...');

      try {
        // 1. Criar a Tarefa
        const createResponse = await axios.post(
          'https://api.manus.ai/v1/tasks',
          {
            prompt: prompt,
            agentProfile: 'manus-1.6',
            task_mode: 'agent',
            tools: CAPTU_TOOLS // Tenta passar as ferramentas do CAPTU
          },
          {
            headers: {
              'API_KEY': activeKey,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('[CAPTU AI] Resposta da criação no Manus:', JSON.stringify(createResponse.data));

        // Tentar extrair o ID de qualquer lugar possível na estrutura comum de APIs
        const taskId = createResponse.data.id || 
                       createResponse.data.taskId || 
                       createResponse.data.data?.id || 
                       createResponse.data.task_id;

        const taskUrl = createResponse.data.task_url || `https://manus.im/app/${taskId}`;

        if (!taskId) {
           console.error('[CAPTU AI] Resposta do Manus não contém ID:', createResponse.data);
           const apiError = createResponse.data.error || createResponse.data.message;
           throw new Error(apiError ? `Erro na API do Manus: ${apiError}` : 'Falha ao obter ID da tarefa do Manus. Estrutura de resposta inesperada.');
        }

        console.log(`[CAPTU AI] Tarefa ${taskId} criada no Manus. Aguardando conclusão...`);

        // 2. Polling (Aguardar conclusão)
        let status = 'pending';
        let result = null;
        let attempts = 0;
        const maxAttempts = 120; // ~6 minutos total (120 * 3s)

        while ((status === 'pending' || status === 'processing' || status === 'running') && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          attempts++;

          const statusResponse = await axios.get(
            `https://api.manus.ai/v1/tasks/${taskId}`,
            { headers: { 'API_KEY': activeKey } }
          );

          status = statusResponse.data.status;
          console.log(`[CAPTU AI] Status Manus (${taskId}): ${status} (Tentativa ${attempts})`);

          if (status === 'completed') {
            result = statusResponse.data.output || statusResponse.data.results;
            break;
          }

          if (status === 'failed' || status === 'error') {
            throw new Error(`A tarefa no Manus falhou com status: ${status}`);
          }
        }

        if (status !== 'completed') {
          return res.json({
            reply: `⏳ **O Manus AI ainda está processando sua solicitação.**\n\nDevido à complexidade da pesquisa, ele pode demorar alguns minutos. \n\nVocê pode acompanhar o progresso em tempo real aqui: [Abrir Tarefa no Manus](${taskUrl})\n\nTarefa ID: \`${taskId}\``,
            provider: 'manus'
          });
        }

        // Se o resultado for um objeto complexo, vamos tentar extrair o texto de forma inteligente
        let finalReply = '';
        
        if (typeof result === 'string') {
          finalReply = result;
        } else if (Array.isArray(result)) {
          // No Manus, o 'output' costuma ser uma lista de mensagens. 
          // Queremos a última mensagem do 'assistant'.
          const assistantMessages = result.filter((m: any) => m.role === 'assistant');
          if (assistantMessages.length > 0) {
            const lastMsg = assistantMessages[assistantMessages.length - 1];
            // O conteúdo pode ser um array (com type: output_text)
            if (Array.isArray(lastMsg.content)) {
              finalReply = lastMsg.content.map((c: any) => c.text || '').join('\n');
            } else {
              finalReply = lastMsg.content || '';
            }
          } else {
            // Fallback: se não achou assistant, mas tem mensagens, pega a última
            const lastMsg = result[result.length - 1];
            if (lastMsg && lastMsg.content) {
               finalReply = Array.isArray(lastMsg.content) ? lastMsg.content[0]?.text : lastMsg.content;
            }
          }
        }
        
        // Se ainda estiver vazio ou não for array, usa o stringify como último recurso
        if (!finalReply) {
          finalReply = JSON.stringify(result, null, 2);
        }

        return res.json({
          reply: finalReply || 'O Manus concluiu a tarefa, mas não retornou um conteúdo textual claro.',
          provider: 'manus'
        });

      } catch (manusError: any) {
        console.error('[CAPTU AI] Erro no Manus:', manusError.response?.data || manusError.message);
        throw new Error(`Erro na integração com Manus: ${manusError.response?.data?.message || manusError.message}`);
      }
    }

    // ─── PROVEDOR NÃO DISPONÍVEL ──────────────────────────────────────────────
    return res.json({
      reply: `⚠️ A integração com **${provider}** ainda não está disponível. Use **Gemini**, **OpenAI** ou **Claude** por enquanto.`,
      provider
    });

  } catch (error: any) {
    console.error('[CAPTU AI] Erro:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Falha ao obter resposta da IA.',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;
