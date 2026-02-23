// Centralização de configurações e credenciais do projeto

// Verifica se o projeto está rodando localmente
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Lê as URLs da API a partir das variáveis de ambiente definidas no arquivo .env
const apiUrlDev = import.meta.env.VITE_API_URL;
const apiUrlProd = import.meta.env.VITE_API_URL_PRODUCTION;

// Define a URL da API baseada no contexto (Local vs Rede/Produção)
// Esta lógica permite que o mesmo build funcione em ambos os ambientes.
export const API_URL = isLocal ? apiUrlDev : apiUrlProd;

// As credenciais do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
// são lidas diretamente no arquivo de inicialização do cliente Supabase,
// localizado em 'src/integrations/supabase/client.ts'.
