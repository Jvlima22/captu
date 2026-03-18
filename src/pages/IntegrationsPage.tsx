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

import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { IntegrationDetailModal } from "@/components/integrations/IntegrationDetailModal";
import { IntegrationOverview } from "@/components/integrations/IntegrationOverview";
import { Integration } from "@/components/integrations/types";

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
    isNew: true,
    author: "CAPTU Official",
    website: "https://pipedrive.com",
    privacyPolicy: "https://pipedrive.com/privacy",
    uuid: "crm-pipe-01"
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
    icon: "https://www.google.com/s2/favicons?domain=salesforce.com&sz=128",
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
    id: "whatsapp",
    name: "WhatsApp Hub",
    description: "Inicie conversas via Evolution API assim que o lead for descoberto.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
    category: "apps",
    type: "Mensageria",
    status: "connected",
    author: "CAPTU Official",
    website: "https://evolution-api.com",
    privacyPolicy: "https://evolution-api.com/privacy",
    uuid: "comm-wa-04"
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
    status: "connected",
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
    icon: "https://cdn-icons-png.flaticon.com/512/2885/2885417.png",
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
    name: "n8n Hub",
    description: "Conecte-se com mais de 400 aplicativos através da nossa bridge n8n.",
    icon: "https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.svg",
    category: "api",
    type: "Automação",
    status: "connected",
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
    name: "OpenAI GPT-4",
    description: "O cérebro por trás dos seus scripts de vendas e análises de mercado.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
    category: "mcp",
    type: "AI Model",
    status: "connected",
    author: "OpenAI",
    website: "https://openai.com",
    privacyPolicy: "https://openai.com/privacy",
    uuid: "ai-oai-09"
  },
  {
    id: "anthropic",
    name: "Claude 3.5",
    description: "Geração de cópias ultra-personalizadas focadas em conversão B2B.",
    icon: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Anthropic_logo.svg",
    category: "mcp",
    type: "AI Model",
    status: "not_connected",
    isNew: true,
    author: "Anthropic",
    website: "https://anthropic.com",
    privacyPolicy: "https://anthropic.com/privacy",
    uuid: "ai-ant-10"
  }
];

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("apps");
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredIntegrations = useMemo(() => {
    return INITIAL_INTEGRATIONS.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = item.category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [searchQuery, activeTab]);

  const recommendedIntegrations = useMemo(() => {
    return INITIAL_INTEGRATIONS.filter(item => item.isNew || item.status === 'not_connected').slice(0, 2);
  }, []);

  const handleCardClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setIsModalOpen(true);
  };

  const handleConnect = React.useCallback((id: string) => {
    setIsModalOpen(false);
    toast({
      title: "Iniciando conexão",
      description: `Estamos redirecionando você para a autenticação do ${id}.`,
    });
  }, [toast]);

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
