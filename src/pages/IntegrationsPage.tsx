import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowRight, 
  Info, 
  Plus,
  Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { IntegrationDetailModal } from "@/components/integrations/IntegrationDetailModal";
import { IntegrationOverview } from "@/components/integrations/IntegrationOverview";
import { Integration } from "@/components/integrations/types";
import { API_URL } from "@/config";

const INITIAL_INTEGRATIONS: Integration[] = [
  // APPS - CRMs
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Mantenha o CAPTU e o seu funil de vendas sincronizados em tempo real.",
    icon: "https://www.google.com/s2/favicons?domain=pipedrive.com&sz=128",
    category: "apps",
    type: "CRM",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://pipedrive.com",
    privacyPolicy: "https://pipedrive.com/privacy",
    uuid: "crm-pipe-01",
    isDisabled: true
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Envie leads diretamente para o seu CRM preferido sem sair do buscador.",
    icon: "https://www.vectorlogo.zone/logos/hubspot/hubspot-icon.svg",
    category: "apps",
    type: "CRM",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://hubspot.com",
    privacyPolicy: "https://hubspot.com/privacy",
    uuid: "crm-hub-02",
    isDisabled: true
  },
  {
    id: "rdstation",
    name: "RD Station CRM",
    description: "Sincronize seus leads com o CRM líder no mercado brasileiro.",
    icon: "https://www.google.com/s2/favicons?domain=rdstation.com&sz=128",
    category: "apps",
    type: "CRM",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://rdstation.com",
    privacyPolicy: "https://rdstation.com/privacy",
    uuid: "crm-rd-11"
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "A plataforma de CRM líder mundial para grandes empresas e operações.",
    icon: "https://pluspng.com/img-png/logo-salesforce-png--366.png",
    category: "apps",
    type: "CRM",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://salesforce.com",
    privacyPolicy: "https://salesforce.com/privacy",
    uuid: "crm-sf-12"
  },
  
  // APPS - Communication
  {
    id: "slack",
    name: "Slack",
    description: "Receba notificações imediatas no seu canal do Slack a cada novo lead qualificado.",
    icon: "https://www.google.com/s2/favicons?domain=slack.com&sz=128",
    category: "apps",
    type: "Comunicação",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://slack.com",
    privacyPolicy: "https://slack.com/privacy",
    uuid: "comm-slack-03"
  },
  {
    id: "discord",
    name: "Discord",
    description: "Notifique seu time de vendas via webhooks diretamente em seus servidores.",
    icon: "https://www.google.com/s2/favicons?domain=discord.com&sz=128",
    category: "apps",
    type: "Comunicação",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://discord.com",
    privacyPolicy: "https://discord.com/privacy",
    uuid: "comm-disc-13"
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Receba alertas instantâneos de novos leads no seu BOT do Telegram.",
    icon: "https://www.google.com/s2/favicons?domain=telegram.org&sz=128",
    category: "apps",
    type: "Comunicação",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://telegram.org",
    privacyPolicy: "https://telegram.org/privacy",
    uuid: "comm-tg-14"
  },

  // APPS - Productivity
  {
    id: "calendly",
    name: "Calendly",
    description: "Sincronize o agendamento de reuniões com as abordagens automatizadas.",
    icon: "https://www.google.com/s2/favicons?domain=calendly.com&sz=128",
    category: "apps",
    type: "Agendamento",
    status: "not_connected",
    isNew: true,
    author: "CAPTU Official",
    website: "https://calendly.com",
    privacyPolicy: "https://calendly.com/privacy",
    uuid: "prod-cal-05"
  },
  {
    id: "google_meet",
    name: "Google Meet",
    description: "Crie reuniões de vídeo automaticamente para seus agendamentos.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg",
    category: "apps",
    type: "Produtividade",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://meet.google.com",
    privacyPolicy: "https://google.com/privacy",
    uuid: "prod-meet-15"
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Gere links de conferência via Zoom para cada novo agendamento de prospecção.",
    icon: "https://www.google.com/s2/favicons?domain=zoom.us&sz=128",
    category: "apps",
    type: "Produtividade",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://zoom.us",
    privacyPolicy: "https://zoom.us/privacy",
    uuid: "prod-zoom-16"
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Gerencie sua agenda e bloqueie horários de follow-up automaticamente.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg",
    category: "apps",
    type: "Agendamento",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://calendar.google.com",
    privacyPolicy: "https://google.com/privacy",
    uuid: "prod-cal-17"
  },

  // APPS - Organization
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Exportação em tempo real para as suas planilhas favoritas.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg",
    category: "apps",
    type: "Dados",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://sheets.google.com",
    privacyPolicy: "https://google.com/privacy",
    uuid: "prod-gs-06"
  },
  {
    id: "notion",
    name: "Notion",
    description: "Crie bancos de dados de leads e páginas de contexto automaticamente.",
    icon: "https://www.google.com/s2/favicons?domain=notion.so&sz=128",
    category: "apps",
    type: "Organização",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://notion.so",
    privacyPolicy: "https://notion.so/privacy",
    uuid: "prod-not-18"
  },
  {
    id: "trello",
    name: "Trello",
    description: "Crie cartões e checklists de prospecção manual em seus quadros.",
    icon: "https://www.google.com/s2/favicons?domain=trello.com&sz=128",
    category: "apps",
    type: "Organização",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://trello.com",
    privacyPolicy: "https://trello.com/privacy",
    uuid: "prod-trello-19"
  },
  {
    id: "monday",
    name: "Monday.com",
    description: "Organize tarefas de prospecção e acompanhamento em seus boards.",
    icon: "https://www.google.com/s2/favicons?domain=monday.com&sz=128",
    category: "apps",
    type: "Organização",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://monday.com",
    privacyPolicy: "https://monday.com/privacy",
    uuid: "prod-mon-20"
  },

  // APPS - Marketing
  {
    id: "rdstation_marketing",
    name: "RD Station Marketing",
    description: "Envie leads direto para suas listas de nutrição e automação de e-mail.",
    icon: "https://www.google.com/s2/favicons?domain=rdstation.com&sz=128",
    category: "apps",
    type: "Marketing",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://rdstation.com",
    privacyPolicy: "https://rdstation.com/privacy",
    uuid: "mark-rd-21"
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Sincronize contatos coletados com suas audiências do Mailchimp.",
    icon: "https://www.google.com/s2/favicons?domain=mailchimp.com&sz=128",
    category: "apps",
    type: "Marketing",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://mailchimp.com",
    privacyPolicy: "https://mailchimp.com/privacy",
    uuid: "mark-mc-22"
  },

  // API - Custom
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Configure gatilhos personalizados para enviar dados a qualquer sistema externo.",
    icon: "https://p.kindpng.com/picc/s/404-4042143_webhook-logo-png-transparent-png.png",
    category: "api",
    type: "Infra",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://captu.io/docs/webhooks",
    privacyPolicy: "https://captu.io/privacy",
    uuid: "api-webhook-07"
  },
  {
    id: "n8n_hub",
    name: "N8n",
    description: "Conecte-se com mais de 400 aplicativos através da nossa bridge n8n.",
    icon: "https://n8n-brasil.github.io/n8n-Doc-PT-BR/img/n8n-color_dark.webp",
    category: "api",
    type: "Automação",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://n8n.io",
    privacyPolicy: "https://n8n.io/privacy",
    uuid: "api-n8n-08"
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "A ponte universal para conectar o CAPTU a milhares de outros apps.",
    icon: "https://www.google.com/s2/favicons?domain=zapier.com&sz=128",
    category: "api",
    type: "Automação",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://zapier.com",
    privacyPolicy: "https://zapier.com/privacy",
    uuid: "api-zap-23"
  },
  {
    id: "make",
    name: "Make.com",
    description: "Crie fluxos de trabalho visuais complexos conectando o CAPTU.",
    icon: "https://www.google.com/s2/favicons?domain=make.com&sz=128",
    category: "api",
    type: "Automação",
    status: "not_connected",
    author: "CAPTU Official",
    website: "https://make.com",
    privacyPolicy: "https://make.com/privacy",
    uuid: "api-make-24"
  },

  // AI / MCP
  {
    id: "openai",
    name: "OpenAI",
    description: "O modelo mais avançado da OpenAI para geração de scripts, análise de leads e resumos automáticos.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
    category: "mcp",
    type: "AI Model",
    status: "not_connected",
    author: "OpenAI",
    website: "https://openai.com",
    privacyPolicy: "https://openai.com/privacy",
    uuid: "ai-oai-09"
  },
  {
    id: "anthropic",
    name: "Claude",
    description: "Geração de cópias ultra-personalizadas e análise de contexto para conversão B2B.",
    icon: "https://img.utdstc.com/icon/9c5/6fe/9c56fe2b44e1d0367b98c2c5ee2255aebbd7093902bffed36aa36e3431b40fb5:500",
    category: "mcp",
    type: "AI Model",
    status: "not_connected",
    author: "Anthropic",
    website: "https://anthropic.com",
    privacyPolicy: "https://anthropic.com/privacy",
    uuid: "ai-ant-10"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "A IA do Google com integração nativa ao Workspace para pesquisa e análise de dados de leads.",
    icon: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
    category: "mcp",
    type: "AI Model",
    status: "not_connected",
    isNew: true,
    author: "Google",
    website: "https://gemini.google.com",
    privacyPolicy: "https://policies.google.com/privacy",
    uuid: "ai-gem-25"
  },
  {
    id: "grok",
    name: "Grok",
    description: "A IA da xAI com acesso em tempo real ao X (Twitter) para monitorar tendências e leads.",
    icon: "https://www.google.com/s2/favicons?domain=x.ai&sz=128",
    category: "mcp",
    type: "AI Model",
    status: "not_connected",
    isNew: true,
    author: "xAI",
    website: "https://x.ai",
    privacyPolicy: "https://x.ai/privacy",
    uuid: "ai-grok-26"
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    description: "Pesquisa de empresas, concorrentes e mercados em tempo real com citações verificadas.",
    icon: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=128",
    category: "mcp",
    type: "AI Research",
    status: "not_connected",
    isNew: true,
    author: "Perplexity AI",
    website: "https://perplexity.ai",
    privacyPolicy: "https://perplexity.ai/privacy",
    uuid: "ai-perp-27"
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Gere áudios de prospecção com voz ultra-realista para abordagens personalizadas em escala.",
    icon: "https://www.google.com/s2/favicons?domain=elevenlabs.io&sz=128",
    category: "mcp",
    type: "AI Voice",
    status: "not_connected",
    isNew: true,
    author: "ElevenLabs",
    website: "https://elevenlabs.io",
    privacyPolicy: "https://elevenlabs.io/privacy",
    uuid: "ai-eleven-28"
  },
  {
    id: "manus",
    name: "Manus",
    description: "Agente de IA autônomo para executar tarefas complexas de pesquisa e prospecção no piloto automático.",
    icon: "https://www.google.com/s2/favicons?domain=manus.ai&sz=128",
    category: "mcp",
    type: "AI Agent",
    status: "not_connected",
    isNew: true,
    author: "Manus AI",
    website: "https://manus.ai",
    privacyPolicy: "https://manus.ai/privacy",
    uuid: "ai-manus-29"
  }
];

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("apps");
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  React.useEffect(() => {
    // 1. Fetch current user and their active integrations
    const fetchUserAndStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        
        try {
          const res = await fetch(`${API_URL}/api/auth/status/${session.user.id}`);
          if (res.ok) {
            const data = await res.json();
            const activeIds: string[] = data.active_integrations || [];
            
            setIntegrations(prev => prev.map(item => 
              activeIds.includes(item.id) ? { ...item, status: 'connected' as const } : item
            ));
          }
        } catch (error) {
          console.error('Failed to fetch integration status:', error);
        }
      }
    };

    fetchUserAndStatus();

    // 2. Listen for messages from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AUTH_SUCCESS') {
        const id = event.data.integrationId;
        
        setIntegrations(prev => prev.map(item => 
          item.id === id ? { ...item, status: 'connected' as const } : item
        ));
        
        toast({
          title: "Conectado com sucesso!",
          description: `A integração com o ${id} agora está ativa.`,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  const filteredIntegrations = useMemo(() => {
    return integrations.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = item.category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [integrations, searchQuery, activeTab]);

  const recommendedIntegrations = useMemo(() => {
    return integrations.filter(item => item.isNew || item.status === 'not_connected').slice(0, 2);
  }, [integrations]);

  const handleCardClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setIsModalOpen(true);
  };

  const handleConnect = React.useCallback((id: string, token?: string) => {
    setIsModalOpen(false);

    if (token) {
      toast({
        title: "Salvando chave...",
        description: `Conectando ao provedor ${id}...`,
      });

      const saveToken = async () => {
        try {
          const res = await fetch(`${API_URL}/api/auth/save-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, provider: id, token })
          });
          if (res.ok) {
            setIntegrations(prev => prev.map(item => item.id === id ? { ...item, status: 'connected' as const } : item));
            toast({ title: "Conectado com sucesso", description: "A chave API foi criptografada e salva.", variant: "default" });
          } else {
            throw new Error("Failed to save token");
          }
        } catch (e) {
          toast({ title: "Erro ao salvar", description: "Não foi possível sincronizar sua chave API.", variant: "destructive" });
        }
      };
      saveToken();
      return;
    }
    
    // Lista de integrações que utilizam o nosso fluxo de OAuth
    const oauthIntegrations = ['hubspot', 'pipedrive', 'salesforce', 'slack'];
    
    if (oauthIntegrations.includes(id)) {
      toast({
        title: "Iniciando conexão",
        description: `Conectando ao ${id}...`,
      });
      
      const width = 600;
      const height = 750;
      const left = window.innerWidth / 2 - width / 2 + window.screenX;
      const top = window.innerHeight / 2 - height / 2 + window.screenY;

      // Abrir em popup para manter o contexto da página principal
      window.open(
        `${API_URL}/api/auth/integrations/${id}?userId=${userId || ''}`,
        `Connect${id}`,
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );
    } else {
      toast({
        title: "Em breve",
        description: "Essa integração estará disponível nas próximas atualizações.",
      });
    }
  }, [toast, userId]);

  const handleDisconnect = React.useCallback(async (id: string) => {
    if (!userId) return;

    try {
      const res = await fetch(`${API_URL}/api/auth/disconnect/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provider: id })
      });

      if (res.ok) {
        setIntegrations(prev => prev.map(item => 
          item.id === id ? { ...item, status: 'not_connected' as const } : item
        ));
        setIsModalOpen(false);
        toast({
          title: "Desconectado",
          description: `Integração com ${id} foi desativada com sucesso.`,
          variant: "destructive"
        });
      } else {
        throw new Error('Falha ao desconectar');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível desconectar a ferramenta.",
        variant: "destructive"
      });
    }
  }, [toast, userId]);

  return (
    <div className="flex flex-col h-full space-y-10 max-w-6xl mx-auto w-full pb-20 px-4 pt-4 text-foreground">
      {/* Overview Section */}
      <IntegrationOverview />

      {/* Main Connectors Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Conectores</h1>
            <p className="text-muted-foreground mt-1">
              Explore e gerencie as integrações que potencializam o seu fluxo de prospecção.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar aplicativos..." 
                className="pl-9 bg-card border-border/50 h-10 transition-all focus:ring-primary/20 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-10 px-4 rounded-xl gap-2 font-medium hover:bg-secondary/50 border-border/50">
              <Filter className="h-4 w-4" />
              Filtrar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="apps" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/30 p-1 h-12 rounded-xl mb-8 border border-border/20">
            <TabsTrigger value="apps" className="rounded-lg px-8 h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Aplicativos
            </TabsTrigger>
            <TabsTrigger value="api" className="rounded-lg px-8 h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              API personalizada
            </TabsTrigger>
            <TabsTrigger value="mcp" className="rounded-lg px-8 h-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Modelos de IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {/* Recommended Section (Only on main view or when no search) */}
            {!searchQuery && activeTab === 'apps' && (
              <div className="mb-10">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-primary" />
                  Recomendado para você
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendedIntegrations.map((item) => (
                    <IntegrationCard 
                      key={item.id} 
                      integration={item} 
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main Grid */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {searchQuery ? `Resultados para "${searchQuery}"` : 'Todos os Aplicativos'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIntegrations.map((item) => (
                  <IntegrationCard 
                    key={item.id} 
                    integration={item} 
                    onClick={handleCardClick}
                  />
                ))}
              </div>

              {filteredIntegrations.length === 0 && (
                <div className="py-20 text-center bg-secondary/10 rounded-3xl border border-dashed border-border/60">
                  <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-secondary/30 mb-4">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground/80">Nenhuma integração encontrada</h3>
                  <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                    Tente ajustar os termos da busca ou mude a categoria acima.
                  </p>
                  <Button variant="link" className="mt-4 text-primary font-semibold gap-1">
                    Solicitar nova integração
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Integration Detail Modal */}
      <IntegrationDetailModal 
        integration={selectedIntegration}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Footer Info Hub */}
      <div className="bg-[#111827] rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2">Não encontrou o que precisava?</h2>
          <p className="text-gray-400 max-w-md">
            O CAPTU suporta integrações via Webhook e API que podem se conectar a milhares de outras ferramentas através de bridges como n8n, Zapier e Make.
          </p>
        </div>
        <div className="flex gap-4 relative z-10 shrink-0">
          <Button className="bg-white text-black hover:bg-gray-200 rounded-xl h-12 px-6 font-bold flex items-center gap-2">
            Ler Documentação API
            <Info className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="bg-transparent border-gray-700 text-white hover:bg-white/10 rounded-xl h-12 px-6 font-bold flex items-center gap-2">
            Falar com Suporte
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 blur-[80px] translate-y-1/2 -translate-x-1/2" />
      </div>
    </div>
  );
}
