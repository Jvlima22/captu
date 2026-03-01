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
import { createServer } from 'http';
import { Server } from 'socket.io';
import leadRoutes from './routes/leads';
import campaignRoutes from './routes/campaigns';
import chatRoutes from './routes/chat';
import { WhatsAppService } from './services/whatsapp';

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3000;

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
    cors: {
        origin: '*', // Ajuste para produção se necessário
        methods: ['GET', 'POST']
    }
});

const whatsapp = WhatsAppService.getInstance();
whatsapp.setIO(io);

io.on('connection', (socket) => {
    console.log(`\n[Navegador] Tela do Painel conectada (WebSocket ID: ${socket.id})`);
    
    // Obter status para log explícito
    const status = whatsapp.getStatus();
    if (status.isPaired) {
        console.log(`[WhatsApp Status] ✅ CELULAR VINCULADO e ativo. Sincronizando tela...`);
    } else {
        console.log(`[WhatsApp Status] ❌ NENHUM CELULAR VINCULADO. Aguardando leitura do QR Code.`);
    }
    
    // Enviar status atual ao conectar
    socket.emit('whatsapp-connection-update', status);
    
    // Enviar histórico em cache se já existir (conecta quase instantâneo)
    const history = whatsapp.getHistoryCache();
    if (history && (history.chats.length > 0 || history.messages.length > 0)) {
        socket.emit('whatsapp-history', history);
    }

    socket.on('disconnect', () => {
        console.log(`[Navegador] Tela do Painel desconectada (WebSocket ID: ${socket.id})`);
    });
});

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    'https://captu.vercel.app',
    'https://captu-jqjg.vercel.app',
    'http://localhost:5173',
    'http://localhost:8081',
    'http://localhost:3000',
    'https://n8n.tglsolutions.com.br',
];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Liberal absoluto para teste de produção e debug
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'apikey'],
    credentials: true,
};

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
    httpServer.listen(port, () => {
        console.log(`\n🚀 Backend CAPTU rodando → http://localhost:${port}`);
        console.log('─'.repeat(50));
        console.log(`   SUPABASE_URL          : ${process.env.SUPABASE_URL ? '✅' : '❌ FALTANDO'}`);
        console.log(`   SUPABASE_SERVICE_KEY  : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌ FALTANDO'}`);
        console.log(`   GEMINI_API_KEY        : ${process.env.GEMINI_API_KEY ? '✅' : '❌ FALTANDO'}`);
        console.log(`   GOOGLE_PLACES_API_KEY : ${process.env.GOOGLE_PLACES_API_KEY ? '✅' : '❌ FALTANDO'}`);
        console.log(`   EVOLUTION_API_URL     : ${process.env.EVOLUTION_API_URL ? '✅' : '❌ FALTANDO'}`);
        console.log('─'.repeat(50));

        // Inicializar WhatsApp após o servidor estar de pé
        whatsapp.initialize().catch(err => {
            console.error('[WhatsApp] Falha ao inicializar motor nativo:', err);
        });
    });
}

// Export para Vercel Serverless Functions
export default app;

