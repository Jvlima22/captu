// Centralização de configurações e credenciais do projeto

// Em produção (Vercel), o backend roda no mesmo domínio via vercel.json (rotas /api/*),
// portanto a URL base deve ser vazia para usar paths relativos (ex: /api/leads).
// Em desenvolvimento local, o backend sobe separado em localhost:3000.
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

export const API_URL = isLocal ? (import.meta.env.VITE_API_URL || "http://localhost:3000") : "";

// As credenciais do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
// são lidas diretamente no arquivo de inicialização do cliente Supabase,
// localizado em 'src/integrations/supabase/client.ts'.
