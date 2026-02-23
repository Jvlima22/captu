import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateSalesCopy = async (lead: any) => {
    try {
        if (!lead) return "Lead não encontrado.";

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key faltante");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const name = lead.name || "Empresa";
        const segment = lead.segment || "Serviços";
        const city = lead.city || "sua região";
        const hasWebsite = lead.has_own_website;
        const rating = lead.rating;

        const systemPrompt = `Você é um Copywriter B2B mestre em brevidade para WhatsApp. 
        Gere uma abordagem ULTRA-RESUMIDA em EXATAMENTE 3 PARÁGRAFOS curtos (máximo 2 linhas cada).

        ESTRUTURA:
        1. APRESENTAÇÃO: "Olá, somos da **TGL Solutions** e ajudamos [nicho] em [cidade] a [resultado direto]".
        2. DIAGNÓSTICO: Foque no ponto crítico da **${name}** (nota ${rating || 'baixa'} ou falta de site) e diga como vocês resolvem isso para evitar perda de clientes. Seja cirúrgico.
        3. CTA: Uma pergunta de 1 linha para agendar um papo.

        REGRAS RÍGIDAS:
        - Responda APENAS o texto.
        - Sem introduções.
        - Negrito apenas em **TGL Solutions** e **${name}**.
        - Linguagem rápida, profissional e sem "encher linguiça".`;

        const userPrompt = `
        Empresa: **${name}**
        Nicho: ${segment} em ${city}
        Diagnóstico: ${hasWebsite ? "Tem site mas pode converter mais" : "NÃO possui site institucional"}
        Google: Nota ${rating || "N/A"}
        
        Gere a mensagem curta.`;

        const result = await model.generateContent([systemPrompt, userPrompt]);
        const text = result.response.text();

        return text.trim();

    } catch (err: any) {
        console.error("ERRO GEMINI ULTRA COMPACTO:", err.message);
        const name = lead.name || "Empresa";
        return `Olá, somos da **TGL Solutions**. Ajudamos a **${name}** a converter buscas no Google em vendas reais. Vi que falta um site profissional para vocês pararem de perder leads. Topa um papo de 2 min?`;
    }
};
