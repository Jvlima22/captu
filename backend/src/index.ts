/**
 * CAPTU Backend - Entry Point
 */

import './env.js'; // MUST be first to load environment variables
import express from 'express';
import cors from 'cors';
import leadRoutes from './routes/leads.js';
import campaignRoutes from './routes/campaigns.js';
import chatRoutes from './routes/chat.js';
import webhookRoutes from './routes/webhooks.js';
import integrationRoutes from './routes/integrations.js';

const app = express();
const port = process.env.PORT || 3000;

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Permitir Vercel, Localhost (qualquer porta) e requisições sem origin
        const allowedOrigins = [
            'https://captu.vercel.app',
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:8081'
        ];
        
        const isLocalhost = origin ? /^http:\/\/localhost:\d+$/.test(origin) : true;

        if (!origin || allowedOrigins.includes(origin) || isLocalhost || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'apikey', 'x-instance-name'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/auth', integrationRoutes);

// Health check - responde IMEDIATAMENTE (nunca bloqueia o startup)
app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'CAPTU Backend API is operational',
        engine: 'Express',
        environment: process.env.VERCEL ? 'vercel-serverless' : 'persistent-active',
        whatsapp_supported: !process.env.VERCEL,
        timestamp: new Date().toISOString(),
    });
});

// ─── Inicialização ────────────────────────────────────────────────────────────
if (process.env.VERCEL) {
    console.log('[Vercel] ☁️ Rodando em ambiente Serverless (Somente API REST)');
} else {
    // O servidor escuta a porta PRIMEIRO — garante que o healthcheck passe imediatamente
    const server = app.listen(port, () => {
        console.log(`\n🚀 Backend CAPTU rodando → http://localhost:${port}`);
        console.log('─'.repeat(50));
    });

    server.on('error', (err: Error) => {
        console.error('[Server] Erro ao iniciar:', err);
        process.exit(1);
    });

    // Inicializa o WhatsApp DEPOIS que o servidor já está ouvindo
    // O delay garante que o healthcheck do Railway passe antes de qualquer operação pesada
    // Desativado motor Baileys local — agora usamos Evolution API
    /*
    setTimeout(async () => {
        try {
            const { WhatsAppService } = await import('./services/whatsapp.js');
            const whatsapp = WhatsAppService.getInstance();
            await whatsapp.initialize();
            console.log('[WhatsApp] ✅ Motor inicializado com sucesso');
        } catch (err) {
            console.error('[WhatsApp] ⚠️ Falha ao inicializar motor (servidor continua rodando):', err);
        }
    }, 2000);
    */
}

export default app;
