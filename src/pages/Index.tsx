import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MetricCard from "@/components/MetricCard";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Users, Target, MessageSquare, TrendingUp, Handshake, Trophy, Loader2, Activity, Sparkles, Wand2, Globe, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadMap from "@/components/LeadMap";
import { LeadDetailsDialog } from "@/components/LeadDetailsDialog";
import { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Lead {
  id: string;
  name: string;
  segment: string;
  city: string;
  state: string;
  score: number;
  status: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  address?: string;
  has_own_website?: boolean;
  image_url?: string | null;
}

export default function Dashboard() {
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleViewDetails = (lead: Lead) => {
    setSelectedLeadDetails(lead);
    setIsDetailsOpen(true);
  };
  // Fetch all leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  // Fetch app settings for API key
  const { data: appSettings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const mapsApiKey = appSettings?.find(s => s.key_name === "google_places_api_key")?.value || "";

  // Fetch contact history
  const { data: contactHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["dashboard-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_history")
        .select("*")
        .order("data_envio", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const totalLeads = leads?.length || 0;
  const qualifiedLeads = leads?.filter((l) => l.score >= 60).length || 0;
  const contactedLeads = leads?.filter((l) => l.status !== "new").length || 0;
  const respondedLeads = leads?.filter((l) => l.status === "responded").length || 0;
  const negotiatingLeads = leads?.filter((l) => l.status === "negotiating").length || 0;
  const wonLeads = leads?.filter((l) => l.status === "won").length || 0;
  const totalMessages = contactHistory?.length || 0;
  const responseRate = contactedLeads > 0 ? ((respondedLeads / contactedLeads) * 100).toFixed(1) : "0.0";

  // Oportunidades de Alto Valor: Sem site e bons scores
  const highValueOpportunities = leads?.filter(l => !l.has_own_website && l.score >= 40).slice(0, 4) || [];

  // Calculate weekly funnel data (last 4 weeks, Sem 1 = current week)
  const funnelData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(new Date(), i), { locale: ptBR });
    const weekEnd = endOfWeek(subWeeks(new Date(), i), { locale: ptBR });

    const weekLeads = leads?.filter((l) => {
      const createdAt = new Date(l.created_at);
      return createdAt >= weekStart && createdAt <= weekEnd;
    }) || [];

    return {
      name: `Sem ${i + 1}`, // Sem 1 = current, Sem 2 = -1 week, etc
      leads: weekLeads.length,
      qualificados: weekLeads.filter((l) => l.score >= 60).length,
      contatados: weekLeads.filter((l) => l.status !== "new").length,
      fechados: weekLeads.filter((l) => l.status === "won").length,
    };
  });

  // Calculate monthly trend data (last 6 months)
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const monthStart = startOfMonth(subMonths(new Date(), 5 - i));
    const monthEnd = endOfMonth(subMonths(new Date(), 5 - i));

    const monthContacted = leads?.filter((l) => {
      const createdAt = new Date(l.created_at);
      return createdAt >= monthStart && createdAt <= monthEnd && l.status !== "new";
    }).length || 0;

    return {
      name: format(monthStart, "MMM", { locale: ptBR }),
      valor: monthContacted,
    };
  });

  // Get recent leads (top 5)
  const recentLeads = leads?.slice(0, 5) || [];

  const isLoading = leadsLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Visão geral da sua prospecção B2B em tempo real" />

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 mb-8">
        <MetricCard
          icon={Target}
          title="Leads coletados"
          value={totalLeads.toString()}
          change={totalLeads > 0 ? "Total no sistema" : "Nenhum lead ainda"}
          changeType={totalLeads > 0 ? "positive" : "neutral"}
        />
        <MetricCard
          icon={TrendingUp}
          title="Qualificados"
          value={qualifiedLeads.toString()}
          change={`${totalLeads > 0 ? ((qualifiedLeads / totalLeads) * 100).toFixed(0) : 0}% do total`}
          changeType={qualifiedLeads > 0 ? "positive" : "neutral"}
        />
        <MetricCard
          icon={MessageSquare}
          title="Mensagens enviadas"
          value={totalMessages.toString()}
          change={totalMessages > 0 ? "Via WhatsApp" : "Nenhuma ainda"}
          changeType={totalMessages > 0 ? "positive" : "neutral"}
        />
        <MetricCard
          icon={Users}
          title="Taxa de Resposta"
          value={`${responseRate}%`}
          change={contactedLeads > 0 ? `${respondedLeads} de ${contactedLeads}` : "Sem dados"}
          changeType={parseFloat(responseRate) > 15 ? "positive" : "neutral"}
        />
        <MetricCard
          icon={Handshake}
          title="Em negociação"
          value={negotiatingLeads.toString()}
          change={negotiatingLeads > 0 ? "Ativos agora" : "Nenhum ainda"}
          changeType={negotiatingLeads > 0 ? "positive" : "neutral"}
        />
        <MetricCard
          icon={Trophy}
          title="Fechados"
          value={wonLeads.toString()}
          change={wonLeads > 0 ? "Vendas realizadas" : "Nenhum ainda"}
          changeType={wonLeads > 0 ? "positive" : "neutral"}
        />
      </div>

      {/* High Value Opportunities - Estratégia CAPTU 3.0 */}
      {highValueOpportunities.length > 0 && (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Oportunidades de Alto Valor (Sem Site)
            </h3>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {highValueOpportunities.length} Sugestões
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {highValueOpportunities.map((opportunity) => (
              <div
                key={opportunity.id}
                className="glass-card group p-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
                onClick={() => handleViewDetails(opportunity)}
              >
                <div className="flex items-start gap-3 relative z-10">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-muted overflow-hidden border border-border">
                    {opportunity.image_url ? (
                      <img src={opportunity.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-foreground truncate">{opportunity.name}</h4>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3 w-3 text-destructive" />
                      Sem Site Próprio
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-primary">{opportunity.score}</div>
                    <div className="text-[8px] text-muted-foreground uppercase font-bold">Score</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {opportunity.city}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {/* Visual highlight for "Opportunity" */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 -mr-8 -mt-8 rounded-full blur-2xl group-hover:bg-primary/20 transition-all"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Funnel Chart */}
        <div className="glass-card rounded-xl p-4 md:p-6 border border-slate-300 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-foreground mb-4">Funil de Conversão (Últimas 4 Semanas)</h3>
          {totalLeads > 0 ? (
            <div className="h-[220px] md:h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="leads" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Leads" />
                  <Bar dataKey="qualificados" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Qualificados" />
                  <Bar dataKey="contatados" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="Contatados" />
                  <Bar dataKey="fechados" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} name="Fechados" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[220px] md:h-[260px] text-muted-foreground text-sm">
              Colete leads para visualizar o funil
            </div>
          )}
        </div>

        {/* Trend */}
        <div className="glass-card rounded-xl p-4 md:p-6 border border-slate-300 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-foreground mb-4">Leads Contatados (Últimos 6 Meses)</h3>
          {contactedLeads > 0 ? (
            <div className="h-[220px] md:h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" fill="url(#colorVal)" strokeWidth={2} name="Contatados" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[220px] md:h-[260px] text-muted-foreground text-sm">
              Inicie contatos para visualizar a tendência
            </div>
          )}
        </div>
      </div>

      {/* Map View */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            Localização dos Leads
            {leads?.filter(l => l.latitude && l.longitude).length === 0 && (
              <span className="text-[10px] font-normal text-muted-foreground">(Nenhum com coordenada)</span>
            )}
          </div>
        </h3>
        <div className="rounded-xl overflow-hidden border border-border shadow-sm">
          <LeadMap leads={leads || []} apiKey={mapsApiKey} onViewDetails={handleViewDetails} />
        </div>
      </div>

      {/* Recent Leads */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 md:p-6 border-b border-border/50 bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground">Leads Recentes</h3>
        </div>
        {recentLeads.length > 0 ? (
          <>
            {/* Desktop View - Table restored */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cidade</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Segmento</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleViewDetails(lead)}>
                      <td className="py-4 px-4 font-medium text-foreground">{lead.name}</td>
                      <td className="py-4 px-4 text-muted-foreground">{lead.city}, {lead.state}</td>
                      <td className="py-4 px-4 text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] font-normal border-primary/20 bg-primary/5 text-primary">
                          {lead.segment || "Sem segmento"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4"><ScoreBadge score={lead.score} /></td>
                      <td className="py-4 px-4"><StatusBadge status={lead.status as any} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Cards with Border and Shadow */}
            <div className="md:hidden flex flex-col p-4 space-y-3">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-card rounded-xl border border-border/50 shadow-sm py-5 px-4 flex flex-col gap-2.5 active:bg-muted/50 transition-all active:scale-[0.98]"
                  onClick={() => handleViewDetails(lead)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <h4 className="font-bold text-foreground leading-tight truncate">{lead.name}</h4>
                        <div className="shrink-0">
                          <StatusBadge status={lead.status as any} />
                        </div>
                      </div>
                      <div className="shrink-0">
                        <ScoreBadge score={lead.score} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <p className="text-[11px] text-muted-foreground leading-none">{lead.segment || "Sem segmento"}</p>
                        <span className="text-[10px] text-muted-foreground/30">•</span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-80">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{lead.city}, {lead.state}</span>
                        </div>
                      </div>
                      <button className="text-[10px] font-bold text-primary flex items-center gap-0.5 shrink-0 hover:underline">
                        Ver detalhes <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Nenhum lead coletado ainda. Vá para a página de Leads para começar!
          </div>
        )}
      </div>

      <LeadDetailsDialog
        lead={selectedLeadDetails}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
