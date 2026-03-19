import { createClient } from '@supabase/supabase-js';

// Usar credenciais do Supabase, de preferência a Service Role para operações de admin
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export class IntegrationService {
    /**
     * Salva ou atualiza as credenciais de uma integração para um usuário/tenant.
     * @param userId ID do usuário no Supabase
     * @param provider Nome do provedor (ex: 'slack', 'n8n', 'trello')
     * @param credentials Objeto contendo os tokens/chaves de API
     * @param isActive Se a integração está ativa no momento
     */
    static async saveIntegration(userId: string, provider: string, credentials: Record<string, any>, isActive: boolean = true) {
        // Atenção: Em produção, você deve criptografar o objeto `credentials` aqui antes de salvar no banco
        const { data, error } = await supabase
            .from('tenant_integrations')
            .upsert({
                user_id: userId,
                provider: provider,
                credentials: credentials,
                is_active: isActive,
            }, { onConflict: 'user_id,provider' });
            
        if (error) {
            console.error(`[Integration Service] Erro ao salvar integração para ${provider}:`, error);
            throw new Error('Falha ao salvar integração: ' + error.message);
        }
        return data;
    }

    /**
     * Recupera as credenciais de uma integração específica de um usuário.
     * @param userId ID do usuário no Supabase
     * @param provider Nome do provedor
     */
    static async getIntegration(userId: string, provider: string) {
        const { data, error } = await supabase
            .from('tenant_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', provider)
            .single();
            
        if (error) {
            if (error.code === 'PGRST116') return null; // PGRST116: Nenhuma linha retornada
            console.error(`[Integration Service] Erro ao buscar integração para ${provider}:`, error);
            throw new Error('Falha ao recuperar integração: ' + error.message);
        }
        
        // Se aplicou criptografia no saveIntegration, descriptografar as credenciais aqui antes de retornar
        return data;
    }

    /**
     * Desativa ou reativa uma integração sem apagar as credenciais.
     */
    static async toggleIntegration(userId: string, provider: string, isActive: boolean) {
        const { error } = await supabase
            .from('tenant_integrations')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('provider', provider);

        if (error) {
            console.error(`[Integration Service] Erro ao alternar status da integração ${provider}:`, error);
            throw error;
        }
    }

    /**
     * Retorna a lista de nomes de integrações ativas para um usuário.
     */
    static async getActiveIntegrations(userId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('tenant_integrations')
            .select('provider')
            .eq('user_id', userId)
            .eq('is_active', true);
            
        if (error) {
            console.error('[Integration Service] Erro ao listar integrações ativas:', error);
            throw new Error('Falha ao listar integrações: ' + error.message);
        }
        
        return data.map(i => i.provider);
    }
}
