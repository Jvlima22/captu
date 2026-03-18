-- Criação da Tabela tenant_integrations para salvar as chaves de API / Integrações dos usuários

CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL, -- Ex: 'n8n', 'slack', 'trello', 'elevenlabs'
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb, -- Vai guardar { "api_key": "...", "workspace": "..." }
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Um usuário só pode ter uma configuração por provedor (opcional, dependendo caso queira múltiplas contas do Slack)
  CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Politica: Usuários podem apenas ler/atualizar suas próprias integrações
CREATE POLICY "Users can manage their own integrations" 
  ON public.tenant_integrations
  FOR ALL
  USING (auth.uid() = user_id);

-- Função / Trigger para atualizar `updated_at` automaticamente
CREATE OR REPLACE FUNCTION public.handle_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_integrations_updated_at ON public.tenant_integrations;
CREATE TRIGGER tr_integrations_updated_at
BEFORE UPDATE ON public.tenant_integrations
FOR EACH ROW EXECUTE PROCEDURE public.handle_integrations_updated_at();

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_user_id ON public.tenant_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider ON public.tenant_integrations(provider);
