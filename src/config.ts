// Centralização de configurações e credenciais do projeto

// API_URL aponta para o backend correto automaticamente:
// - Em localhost: usa http://localhost:3000 (ou VITE_API_URL do .env)
// - Em produção (captu.vercel.app ou qualquer outro host): usa o backend da Vercel
const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

export const API_URL = isLocalhost
    ? (import.meta.env.VITE_API_URL || "http://localhost:3000")
    : "https://captu-jqjg.vercel.app";

// As credenciais do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
// são lidas diretamente no arquivo de inicialização do cliente Supabase,
// localizado em 'src/integrations/supabase/client.ts'.
