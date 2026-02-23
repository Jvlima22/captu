// ─── Configuração Central de URLs ────────────────────────────────────────────
//
// Esta lógica detecta o ambiente automaticamente:
//
//  LOCAL  → frontend em localhost (qualquer porta) → usa http://localhost:3000
//  VERCEL → frontend em captu.vercel.app            → usa https://captu-jqjg.vercel.app
//
// Para alterar a URL do backend de produção, basta mudar VITE_BACKEND_URL
// nas variáveis de ambiente da Vercel (Settings → Environment Variables).
// ─────────────────────────────────────────────────────────────────────────────

const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||  // rede local
        window.location.hostname.startsWith('10.'));        // rede local corporativa

// VITE_BACKEND_URL → variável de ambiente do Vite (opcional, sobrescreve tudo)
// Em desenvolvimento, o .env.local pode definir isso para um backend alternativo.
const envBackendUrl = import.meta.env.VITE_API_URL as string | undefined;

// URL pública do backend em produção na Vercel
const PRODUCTION_BACKEND_URL = 'https://captu-jqjg.vercel.app';

// URL do backend local (padrão Express na porta 3000)
const LOCAL_BACKEND_URL = 'http://localhost:3000';

export const API_URL: string = envBackendUrl
    ? envBackendUrl                                        // Variável de ambiente prevalece
    : isLocalhost
        ? LOCAL_BACKEND_URL                                // Desenvolvimento local
        : PRODUCTION_BACKEND_URL;                         // Produção (Vercel)

// ─── Supabase ─────────────────────────────────────────────────────────────────
// Lidas no cliente Supabase em src/integrations/supabase/client.ts
// ─────────────────────────────────────────────────────────────────────────────
