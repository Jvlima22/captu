import express from 'express';
import cors from 'cors';
import path from 'path';
import leadRoutes from './routes/leads.js';
import campaignRoutes from './routes/campaigns.js';
import chatRoutes from './routes/chat.js';

// Carrega o .env da raiz do projeto quando rodando localmente
// __dirname está disponível pois o backend compila com module: commonjs
if (!process.env.VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/leads', leadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
    res.send('CAPTU Backend API is running');
});

// Export the Express API
export default app;

// Start the server only if run directly (não na Vercel)
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
