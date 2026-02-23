/**
 * CAPTU Backend - Entry Point
 *
 * Carregamento de variáveis de ambiente:
 *  - LOCAL : lê o arquivo .env na raiz do monorepo (../../.env relativo a este arquivo compilado)
 *  - VERCEL: as variáveis são injetadas pela plataforma automaticamente
 *
 * IMPORTANTE: o dotenv.config() DEVE acontecer antes de qualquer outro require/import
 * que consuma process.env. Como o TypeScript compila para CommonJS e os imports
 * são transformados em require() síncronos no topo, usamos um truque: o dotenv
 * é chamado via require() condicional antes que os demais módulos sejam carregados.
 * Isso funciona porque no CommonJS o require() é síncrono e respeitado na ordem.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

if (!process.env.VERCEL) {
    // __dirname aponta para backend/src quando rodando via ts-node-dev
    // ou backend/dist/src após tsc. De ambos os casos, ../../ chega à raiz.
    const envPath = path.resolve(__dirname, '../../.env');
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.warn(`[dotenv] Não foi possível carregar .env em: ${envPath}`);
        console.warn('[dotenv] Rodando sem variáveis de ambiente locais.');
    } else {
        console.log(`[dotenv] ✅ Variáveis carregadas de: ${envPath}`);
    }
}

import express from 'express';
import cors from 'cors';
import leadRoutes from './routes/leads';
import campaignRoutes from './routes/campaigns';
import chatRoutes from './routes/chat';

const app = express();
const port = process.env.PORT || 3000;

// ─── CORS ────────────────────────────────────────────────────────────────────
// Lista de origens permitidas. Em produção, qualquer *.vercel.app também é
// aceito para suportar previews de deploy automáticos.
const allowedOrigins = [
    'https://captu.vercel.app',        // Frontend principal em produção
    'https://captu-jqjg.vercel.app',   // Backend em produção (acesso direto/testes)
    'http://localhost:5173',            // Vite dev (porta padrão)
    'http://localhost:8081',            // Vite dev (porta configurada em vite.config.ts)
    'http://localhost:3000',            // Backend Express local
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8081',
];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Permite requisições sem origin: curl, Postman, n8n (server-to-server), etc.
        if (!origin) return callback(null, true);

        // Origem exata na lista de permitidos
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // Qualquer preview/produção da Vercel (ex: captu-git-main-user.vercel.app)
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);

        // Bloqueia tudo o mais
        console.warn(`[CORS] Bloqueado → ${origin}`);
        callback(new Error(`CORS policy: origem não permitida → ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'apikey'],
    credentials: true,
    optionsSuccessStatus: 204,
};

// Pré-flight OPTIONS — deve vir antes de app.use(cors()) para cobrir todas as rotas
// Express 5 usa path-to-regexp v8: wildcard agora é '/{*path}' em vez de '*'
app.options('/{*path}', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'CAPTU Backend API is running',
        environment: process.env.VERCEL ? 'vercel' : 'local',
        timestamp: new Date().toISOString(),
    });
});

// ─── Inicialização local ──────────────────────────────────────────────────────
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`\n🚀 Backend CAPTU rodando → http://localhost:${port}`);
        console.log('─'.repeat(50));
        console.log(`   SUPABASE_URL          : ${process.env.SUPABASE_URL ? '✅' : '❌ FALTANDO'}`);
        console.log(`   SUPABASE_SERVICE_KEY  : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌ FALTANDO'}`);
        console.log(`   GEMINI_API_KEY        : ${process.env.GEMINI_API_KEY ? '✅' : '❌ FALTANDO'}`);
        console.log(`   GOOGLE_PLACES_API_KEY : ${process.env.GOOGLE_PLACES_API_KEY ? '✅' : '❌ FALTANDO'}`);
        console.log(`   EVOLUTION_API_URL     : ${process.env.EVOLUTION_API_URL ? '✅' : '❌ FALTANDO'}`);
        console.log('─'.repeat(50));
    });
}

// Export para Vercel Serverless Functions
export default app;
