import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { IntegrationService } from '../services/integrationService.js';
import { searchLeads } from '../services/googlePlaces.js';
import { searchLinkedinCompanies } from '../services/linkedinSearch.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AgentDevService } from '../services/agentDevService.js';
import { TerminalSessionManager } from '../services/terminalSessionManager.js';

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
      name: "criar_nova_campanha",
      description: "Cria uma nova campanha de prospecção no banco de dados. Use isso quando o usuário der o 'OK' para o seu plano estratégico. IMPORTANTE: O campo niche é usado para salvar o Script/Template da mensagem.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da campanha (ex: Prospecção Barbearias SP)" },
          message_script: { type: "string", description: "O script de prospecção completo com placeholders {{segment}}, {{city}}, etc." },
          daily_limit: { type: "number", description: "Limite de envios por dia. Padrão 50." },
          city: { type: "string", description: "Cidade alvo opcional." }
        },
        required: ["name", "message_script"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pesquisar_leads_google",
      description: "Inicia uma pesquisa técnica e salvamento automático de leads via Google Maps. Use parâmetros idênticos à interface manual.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nicho ou segmento (ex: 'Oficinas Mecânicas')" },
          location: { type: "string", description: "Cidade/Região (ex: 'São Paulo, SP')" },
          radius: { type: "number", description: "Raio de busca em metros (ex: 15000 para 15km). Padrão 15000." },
          min_rating: { type: "number", description: "Avaliação mínima (0 a 5). Padrão 0." },
          min_reviews: { type: "number", description: "Mínimo de avaliações. Padrão 0." },
          only_without_website: { type: "boolean", description: "Se verdadeiro, busca apenas empresas sem site próprio." },
          only_with_phone: { type: "boolean", description: "Se verdadeiro, busca apenas empresas com telefone listado." }
        },
        required: ["query", "location"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pesquisar_leads_linkedin",
      description: "Inicia uma pesquisa técnica e salvamento automático de leads/empresas via LinkedIn.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Setor ou cargo (ex: 'Diretores de Marketing')" },
          city: { type: "string", description: "Cidade de busca (ex: 'Curitiba')" }
        },
        required: ["query", "city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "adicionar_leads_campanha",
      description: "Adiciona uma lista de IDs de leads a uma campanha específica. Use isso quando o usuário der o OK para incluir leads encontrados em uma campanha.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "O ID da campanha de destino." },
          lead_ids: { type: "array", items: { type: "string" }, description: "Lista de IDs dos leads a serem adicionados." }
        },
        required: ["campaign_id", "lead_ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verificar_ferramentas_conectadas",
      description: "Consulta quais ferramentas externas (CRMs, Planilhas, etc) o usuário possui conectadas no CAPTU (ex: Pipedrive, HubSpot, Google Sheets). Use isso sempre que o usuário perguntar o que está conectado ou se a IA tem acesso a tal ferramenta.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "propose_patch",
      description: "Propõe uma alteração parcial no código. NÃO use write_file diretamente.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho do arquivo." },
          search: { type: "string", description: "Código exato a substituir." },
          replace: { type: "string", description: "Novo código." },
          description: { type: "string", description: "Explicação." }
        },
        required: ["path", "search", "replace", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description: "AVISO: Use propose_patch em vez de patch_file para mudanças de UI/Lógica para que o usuário possa aprovar.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho do arquivo." },
          search: { type: "string", description: "Trecho a remover." },
          replace: { type: "string", description: "Trecho a inserir." }
        },
        required: ["path", "search", "replace"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "AVISO: Evite se possível. Proponha mudanças atômicas via propose_patch.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho." },
          content: { type: "string", description: "Conteúdo completo." }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Lê o conteúdo de um arquivo específico do projeto. Use isso sempre antes de editar um arquivo ou para entender a lógica existente.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho relativo do arquivo (ex: 'src/App.tsx')" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "terminal_execute",
      description: "Executa comandos no terminal do servidor (CMD/Powershell). Use para rodar installs, builds, testes ou operações git.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "O comando real a ser executado (ex: 'npm install' ou 'git commit -m ...')" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "acessar_web",
      description: "Lê o conteúdo textual de qualquer URL da internet. Use quando o usuário fornecer um link ou pedir para consultar um site externo/GitHub.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "A URL completa da página web a ser consultada." }
        },
        required: ["url"]
      }
    }
  }
];

// ─── DESPACHANTE CENTRAL DE FERRAMENTAS ──────────────────────────────────────
async function handleToolCalls(toolCalls: any[], userId: string | undefined, dbClient: any, chatId?: string, sendChunk?: (data: any) => void) {
  const results: any[] = [];
  
  console.log(`[CAPTU AI] ToolCalls recebidos brutos:`, JSON.stringify(toolCalls, null, 2));

  for (const tool of toolCalls) {
    let toolResult: any;
    
    // Fallbacks melhores para name
    let name = tool.function?.name || tool.name; 
    if (!name && tool.function && typeof tool.function === 'string') name = tool.function; // Caso de formato esquisito
    
    // Tenta arrumar argumentos
    let argsStr = tool.function?.arguments || tool.arguments || '{}';
    if (typeof argsStr !== 'string') argsStr = JSON.stringify(argsStr);
    
    const args = typeof tool.function?.arguments === 'string' 
       ? JSON.parse(tool.function.arguments || '{}') 
       : (tool.args || tool.function?.arguments || tool.arguments || {});

    console.log(`[CAPTU AI] Executando Tool: ${name}`, args);

    if (!name) {
      console.error("[CAPTU AI] Nome da tool ausente! Ignorando chamada.", tool);
      results.push({ name: 'unknown', callId: tool.id || 'unknown', result: { erro: 'Tool name missing' } });
      continue;
    }

    if (name === 'buscar_leads_qualificados') {
      const limit = args.limit || 10;
      const { data, error } = await dbClient.from('leads').select('*').limit(limit).order('created_at', { ascending: false });
      toolResult = error ? { erro: error.message } : (data || []).map((l: any) => ({ id: l.id, n: l.name, ph: l.phone, st: l.status }));

    } else if (name === 'buscar_campanhas_ativas') {
      const limit = args.limit || 5;
      const { data, error } = await dbClient.from('campaigns').select('*').limit(limit).order('created_at', { ascending: false });
      toolResult = error ? { erro: error.message } : (data || []).map((c: any) => ({ id: c.id, name: c.name, status: c.status, niche: c.niche }));

    } else if (name === 'relatorio_geral_projeto') {
      try {
        const [leads, camps, hist] = await Promise.all([
          dbClient.from('leads').select('*', { count: 'exact', head: true }),
          dbClient.from('campaigns').select('*', { count: 'exact', head: true }),
          dbClient.from('contact_history').select('*', { count: 'exact', head: true })
        ]);
        toolResult = { total_leads: leads.count || 0, total_campanhas: camps.count || 0, total_contatos: hist.count || 0 };
      } catch (e: any) { toolResult = { erro: e.message }; }

    } else if (name === 'criar_nova_campanha') {
      const { data, error } = await dbClient.from('campaigns').insert({
        name: args.name,
        niche: args.message_script,
        daily_limit: args.daily_limit || 50,
        city: args.city || null,
        status: 'Pausada'
      }).select();
      toolResult = error ? { erro: error.message } : { sucesso: true, mensagem: `Campanha '${args.name}' criada.`, id: data?.[0]?.id };

    } else if (name === 'pesquisar_leads_google') {
      try {
        const filters = { radius: args.radius || 15000, minRating: args.min_rating || 0, minReviews: args.min_reviews || 0, onlyWithoutWebsite: args.only_without_website || false, onlyWithPhone: args.only_with_phone || false };
        const leads = await searchLeads(args.query, args.location, filters);
        if (leads && leads.length > 0) {
          const leadsToSave = leads.map((l: any) => ({ ...l, origin: 'google_places' }));
          await dbClient.from('leads').upsert(leadsToSave, { onConflict: 'place_id', ignoreDuplicates: true });
          toolResult = { sucesso: true, mensagem: `${leads.length} leads salvos com sucesso.` };
        } else { toolResult = { message: "Nenhum lead encontrado." }; }
      } catch (e: any) { toolResult = { erro: e.message }; }

    } else if (name === 'pesquisar_leads_linkedin') {
      try {
        const leads = await searchLinkedinCompanies(args.query, args.city);
        if (leads && leads.length > 0) {
          await dbClient.from('leads').upsert(leads, { onConflict: 'website', ignoreDuplicates: true });
          toolResult = { sucesso: true, mensagem: `${leads.length} leads do LinkedIn salvos.` };
        } else { toolResult = { message: "Nada no LinkedIn." }; }
      } catch (e: any) { toolResult = { erro: e.message }; }

    } else if (name === 'adicionar_leads_campanha') {
      try {
        const records = args.lead_ids.map((lid: string) => ({ campaign_id: args.campaign_id, lead_id: lid, status: 'pending' }));
        const { error } = await dbClient.from('campaign_leads').upsert(records, { onConflict: 'campaign_id, lead_id' });
        toolResult = error ? { erro: error.message } : { sucesso: true, mensagem: `${args.lead_ids.length} leads vinculados.` };
      } catch (e: any) { toolResult = { erro: e.message }; }
    } else if (name === 'verificar_ferramentas_conectadas') {
      try {
        const { data, error } = await dbClient.from('tenant_integrations').select('provider, is_active').eq('user_id', userId);
        if (error) throw error;
        toolResult = {
          conectadas: (data || []).map((i: any) => ({ ferramenta: i.provider, status: i.is_active ? 'Ativa' : 'Inativa' }))
        };
      } catch (e: any) { toolResult = { erro: e.message }; }
    } else if (name === 'read_file') {
      const content = await AgentDevService.readFile(args.path);
      toolResult = content ? { content } : { erro: 'Arquivo não encontrado ou erro na leitura.' };
    } else if (name === 'write_file') {
      const success = await AgentDevService.writeFile(args.path, args.content);
      toolResult = { sucesso: success };
    } else if (name === 'terminal_execute') {
      let output = '';
      if (sendChunk) sendChunk({ part: `\n[PENSANDO] Executando comando em background...\n` });
      
      const res = await TerminalSessionManager.getInstance().executeCommandInTerminal(args.command, (line, isStderr) => {
        output += line + '\n';
      });
      toolResult = { ...res, fullOutput: output };
    } else if (name === 'acessar_web') {
      try {
        if (sendChunk) sendChunk({ part: `\n[RESEARCH] Acessando URL: ${args.url}...\n` });
        const { data: html } = await axios.get(args.url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, timeout: 15000 });
        const $ = cheerio.load(html);
        $('script, style, noscript, svg, nav, footer, header').remove(); // limpa 
        let text = $('body').text().replace(/\s+/g, ' ').trim();
        if (text.length > 20000) text = text.substring(0, 20000) + '...[CONTEÚDO TRUNCADO DEVIDO AO TAMANHO]';
        toolResult = { sucesso: true, content: text };
      } catch (e: any) {
        toolResult = { error: `Erro ao acessar URL: ${e.message}` };
      }
    } else if (name === 'read_codebase') {
      const tree = await AgentDevService.getFileTree();
      toolResult = { tree };
    } else if (name === 'patch_file') {
      const success = await AgentDevService.patchFile(args.path, args.search, args.replace);
      toolResult = { sucesso: success };
    } else if (name === 'propose_patch') {
      const { data, error } = await dbClient.from('agent_proposals').insert([{
        user_id: userId,
        path: args.path,
        type: 'patch',
        search: args.search,
        replace: args.replace,
        description: args.description,
        status: 'pending'
      }]).select().single();

      if (!error && data) {
         console.log(`[CAPTU AI] Aplicando Live Preview no arquivo: ${args.path}`);
         await AgentDevService.patchFile(args.path, args.search, args.replace);
      }
      toolResult = error ? { error: `Erro ao salvar proposta: ${error.message}` } : { proposal_id: data.id, message: 'Proposta enviada e aplicada. AGUARDE aprovação.' };
    }

    results.push({ name, callId: tool.id || name, result: toolResult });
  }
  return results;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────
router.get('/available-models', (_req, res) => {
  res.json({
    available: [
      { id: 'gemini', available: !!GEMINI_API_KEY },
      { id: 'openai', available: !!OPENAI_API_KEY },
      { id: 'claude', available: !!ANTHROPIC_API_KEY },
      { id: 'elevenlabs', available: !!ELEVENLABS_API_KEY },
      { id: 'manus', available: !!MANUS_API_KEY },
    ]
  });
});

router.post('/chat', async (req, res) => {
  try {
    const { messages, provider = 'gemini', systemPrompt, fileContent, userId, chatId, assistantMessageId } = req.body;

    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array is required' });

    let customKey = null;
    if (userId) {
      const integ = await IntegrationService.getIntegration(userId, provider);
      if (integ?.is_active && integ.credentials?.apiKey) customKey = integ.credentials.apiKey;
    }

    let captuContext = systemPrompt || `Você é o CAPTU AI, assistente de prospecção B2B. Responda em português. 
Sempre chame propose_patch para mudanças de código. Artefatos: [ARTIFACT type="proposal" title="..." id="..."] [/ARTIFACT]`;

    // ─── INJEÇÃO DE CONTEXTO ───
    if (userId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const [leadsRes, campsRes] = await Promise.all([
          db.from('leads').select('*', { count: 'exact', head: true }),
          db.from('campaigns').select('*').limit(3).order('created_at', { ascending: false })
        ]);
        captuContext += `\n\nContexto Projeto: Leads=${leadsRes.count || 0}. Campanhas Recentes: ${(campsRes.data || []).map(c => c.name).join(', ')}`;
      } catch (e) {}
    }

    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendChunk = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const { createClient } = await import('@supabase/supabase-js');
    const dbClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    let assistantReply = "";

    // ─── STREAMING FLOWS ───
    if (provider === 'gemini') {
      const activeKey = customKey || GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(activeKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: captuContext, tools: [{ functionDeclarations: CAPTU_TOOLS.map(t => t.function) }] as any });
      const chat = model.startChat({ history: messages.slice(0, -1).map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) });
      
      let iterations = 0;
      async function processGemini(message: any) {
        if (iterations++ >= 10) return;
        if (iterations === 1) sendChunk({ part: '[PLAN] ["Processar"]\n[STEP_START] 1\n' });
        
        const result = await chat.sendMessageStream(message);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) { assistantReply += text; sendChunk({ part: text }); }

          const calls = chunk.candidates?.[0]?.content?.parts?.filter(p => p.functionCall);
          for (const call of (calls || [])) {
            const toolName = call.functionCall!.name;
            const log = `\n[PENSANDO] Executando ${toolName}...\n`;
            assistantReply += log; sendChunk({ part: log });
            const toolResults = await handleToolCalls([call.functionCall], userId, dbClient, chatId, sendChunk);
            await processGemini([{ functionResponse: { name: toolResults[0].name, response: { content: toolResults[0].result } } }]);
          }
        }
      }
      await processGemini(messages[messages.length - 1].content);

    } else if (provider === 'openai') {
      const activeKey = customKey || OPENAI_API_KEY;
      let currentMessages: any[] = [{ role: 'system', content: captuContext }, ...messages.map((m: any) => ({ role: m.role, content: m.content }))];
      
      for (let i = 0; i < 5; i++) {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', { model: 'gpt-4o', messages: currentMessages, tools: CAPTU_TOOLS, stream: true }, { headers: { Authorization: `Bearer ${activeKey}` }, responseType: 'stream' });
        
        let responseMsg: any = { role: 'assistant', content: '', tool_calls: [] };
        let toolBuffer: any = {};

        await new Promise((resolve) => {
          let sseBuffer = '';
          response.data.on('data', (chunk: any) => {
            sseBuffer += chunk.toString();
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || ''; // O último fragmento fica no buffer
            
            for (const line of lines) {
              if (!line.trim().startsWith('data: ')) continue;
              const dataStr = line.replace(/^data:\s*/, '').trim();
              if (dataStr === '[DONE]') continue;
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                const delta = data.choices[0]?.delta;
                if (delta?.content) { assistantReply += delta.content; responseMsg.content += delta.content; sendChunk({ part: delta.content }); }
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolBuffer[tc.index]) toolBuffer[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
                    if (tc.id) toolBuffer[tc.index].id = tc.id;
                    if (tc.function?.name) toolBuffer[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) toolBuffer[tc.index].function.arguments += tc.function.arguments;
                  }
                }
              } catch (e) {
                 console.error("[CAPTU AI] Erro ao fazer parse de chunk SSE:", e, "Data:", dataStr);
              }
            }
          });
          response.data.on('end', resolve);
        });

        const toolCalls = Object.values(toolBuffer).map((t: any) => ({ id: t.id, type: 'function', function: t.function }));
        if (toolCalls.length > 0) {
          responseMsg.tool_calls = toolCalls;
          const log = `\n[PENSANDO] Executando ferramentas...\n`;
          assistantReply += log; sendChunk({ part: log });
          const toolResults = await handleToolCalls(toolCalls, userId, dbClient, chatId, sendChunk);
          currentMessages.push(responseMsg);
          toolResults.forEach(r => currentMessages.push({ role: 'tool', tool_call_id: r.callId, content: JSON.stringify(r.result) }));
        } else break;
      }
    }

    // FINAL SAVE
    if (userId && chatId && assistantReply) {
      const insertData: any = { user_id: userId, chat_id: chatId, role: 'assistant', content: assistantReply, provider };
      if (assistantMessageId) insertData.id = assistantMessageId;
      await dbClient.from('agent_messages').insert(insertData);
    }

    sendChunk({ part: '' }); // Final empty chunk
    res.write('event: end\ndata: {}\n\n');
    res.end();

  } catch (error: any) {
    console.error('[CAPTU AI Error]:', error.message);
    // Para erros em streaming, tentamos enviar uma mensagem de erro SSE
    try {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    } catch (e) {}
    res.end();
  }
});

router.post('/chat/rate', async (req: any, res: any) => {
  const { messageId, rating } = req.body;
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  try {
    console.log(`[CAPTU DB] Atualizando rating para ${messageId}: ${rating}`);
    const { error } = await db.from('agent_messages').update({ rating }).eq('id', messageId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('[CAPTU DB] Erro ao atualizar rating:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proposals Management
router.get('/proposals/pending', async (req, res) => {
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await db.from('agent_proposals').select('*').eq('status', 'pending');
  res.json(data || []);
});

router.post('/proposals/bulk-action', async (req, res) => {
  const { action } = req.body;
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: proposals } = await db.from('agent_proposals').select('*').eq('status', 'pending');
  
  if (proposals) {
    for (const p of proposals) {
      if (action === 'reject') {
        console.log(`[ROLLBACK] ${p.path}`);
        await AgentDevService.patchFile(p.path, p.replace || '', p.search || '');
      }
      await db.from('agent_proposals').update({ status: action === 'approve' ? 'accepted' : 'rejected' }).eq('id', p.id);
    }
  }
  res.json({ success: true });
});

export default router;
