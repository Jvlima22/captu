import axios from 'axios';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega .env da raiz do projeto
dotenv.config({ path: resolve(__dirname, '../../.env') });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

async function testTavily() {
    console.log('--- TESTE DE CONEXÃO TAVILY ---');
    
    if (!TAVILY_API_KEY || TAVILY_API_KEY.includes('...')) {
        console.error('❌ ERRO: TAVILY_API_KEY não encontrada no .env ou é inválida.');
        console.error('Valor atual:', TAVILY_API_KEY);
        return;
    }

    console.log('Chave encontrada. Iniciando requisição de teste...');

    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: "LinkedIn TGL Solutions",
            max_results: 1
        });

        if (response.status === 200) {
            console.log('✅ SUCESSO! Conexão com Tavily estabelecida.');
            console.log('Resultado do teste:', response.data.results?.[0]?.title || 'Sem resultados, mas API respondeu.');
        } else {
            console.error('⚠️ AVISO: API respondeu com status:', response.status);
        }
    } catch (error: any) {
        if (error.response) {
            console.error('❌ ERRO DE API (Tavily):');
            console.error('Status:', error.response.status);
            console.error('Mensagem:', error.response.data);
        } else {
            console.error('❌ ERRO DE CONEXÃO:', error.message);
        }
    }
}

testTavily();
