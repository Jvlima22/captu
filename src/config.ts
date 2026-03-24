// ─── Configuração Central de URLs ────────────────────────────────────────────
//
//  ARQUITETURA DE DOIS BACKENDS:
//
//  1. VERCEL (Serverless)  → captu-jqjg.vercel.app
//     └── /api/leads       → CRUD de leads
//     └── /api/campaigns   → CRUD de campanhas
//
//  2. RAILWAY (Persistent) → definido em VITE_WA_BACKEND_URL
//     └── /api/chat/*      → QR Code, status, envio de mensagens WhatsApp
//
//  O WhatsApp (Baileys) exige conexão TCP persistente → Railway/Render/VPS
//  A Vercel Serverless mata processos após 30s → INCOMPATÍVEL com Baileys
//
//  Para configurar em produção:
//    - VITE_API_URL     → URL do backend Vercel (se diferente do padrão)
//    - VITE_WA_API_URL  → URL do backend Railway com WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

export const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.'));

// Variáveis de ambiente do Vite (opcionais, sobrescrevem tudo)
const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const envWaApiUrl = import.meta.env.VITE_WA_API_URL as string | undefined;

// URLs padrão por ambiente
const PRODUCTION_BACKEND_URL = 'https://captu-jqjg.vercel.app';
const LOCAL_BACKEND_URL = 'http://localhost:3000';

// Backend REST (Leads, Campanhas) → Vercel Serverless
export const API_URL: string = envApiUrl
    ? envApiUrl
    : isLocalhost
        ? LOCAL_BACKEND_URL
        : PRODUCTION_BACKEND_URL;

// Backend WhatsApp (QR Code, Chat) → Railway / servidor persistente
export const WA_API_URL: string = envWaApiUrl
    ? envWaApiUrl
    : isLocalhost
        ? LOCAL_BACKEND_URL
        : 'https://captu-backend-production.up.railway.app'; // URL do Railway (Ajustar se necessário)
