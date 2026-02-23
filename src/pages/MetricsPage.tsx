import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import { Target, MessageCircle, CalendarCheck, Users, Loader2, PieChart as PieChartIcon, BarChart3, TrendingUp, Calendar, MapPin, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area
} from "recharts";
import { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { subDays, startOfDay, isAfter, format, eachDayOfInterval, eachMonthOfInterval, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function MetricsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "all">("30d");

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: contactHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["contact-history-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_history")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const metrics = useMemo(() => {
    if (!leads) return null;

    const now = new Date();
    const filterDate = period === "today" ? startOfDay(now) :
      period === "7d" ? subDays(now, 7) :
        period === "30d" ? subDays(now, 30) :
          new Date(0);

    const filteredLeads = leads.filter(l => isAfter(new Date(l.created_at), filterDate));
    const previousLeads = leads.filter(l => !isAfter(new Date(l.created_at), filterDate));

    const totalLeads = filteredLeads.length;
    const qualifiedLeads = filteredLeads.filter(l => l.score >= 60).length;
    const contactedLeads = filteredLeads.filter(l => l.status !== 'new').length;
    const respondedLeads = filteredLeads.filter(l => l.status === 'responded' || l.status === 'negotiating' || l.status === 'won').length;
    const wonLeads = filteredLeads.filter(l => l.status === 'won').length;

    const responseRate = contactedLeads > 0
      ? ((respondedLeads / contactedLeads) * 100).toFixed(1)
      : "0.0";

    const conversionRate = contactedLeads > 0
      ? ((wonLeads / contactedLeads) * 100).toFixed(1)
      : "0.0";

    // 1. Trend Data
    let trendData: { date: string, count: number }[] = [];

    if (period === "all") {
      // Group by month for 'All' view (last 6 months)
      const monthsInterval = eachMonthOfInterval({
        start: subMonths(now, 5),
        end: now
      });

      trendData = monthsInterval.map(date => {
        const monthStr = format(date, "yyyy-MM");
        const count = leads.filter(l => format(new Date(l.created_at), "yyyy-MM") === monthStr).length;
        return {
          date: format(date, "MMM/yy", { locale: ptBR }),
          count
        };
      });
    } else {
      // Group by day for other periods
      const daysToGenerate = period === "today" ? 1 :
        period === "7d" ? 7 :
          period === "30d" ? 30 : 30;

      const daysInterval = eachDayOfInterval({
        start: subDays(now, daysToGenerate - 1),
        end: now
      });

      trendData = daysInterval.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const count = leads.filter(l => format(new Date(l.created_at), "yyyy-MM-dd") === dateStr).length;
        return {
          date: format(date, "dd MMM", { locale: ptBR }),
          count
        };
      });
    }

    // 2. Niche Performance calculation (top 5)
    const nicheMap: Record<string, { niche: string, leads: number, contacted: number, won: number }> = {};
    filteredLeads.forEach(lead => {
      const segment = lead.segment || "Outros";
      if (!nicheMap[segment]) {
        nicheMap[segment] = { niche: segment, leads: 0, contacted: 0, won: 0 };
      }
      nicheMap[segment].leads++;
      if (lead.status !== 'new') nicheMap[segment].contacted++;
      if (lead.status === 'won') nicheMap[segment].won++;
    });

    const nichePerformance = Object.values(nicheMap)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

    // 3. Status Distribution calculation
    const statusData = [
      { name: "Novos leads", value: filteredLeads.filter(l => l.status === 'new').length, color: "#3B82F6" },
      { name: "Leads contatados", value: filteredLeads.filter(l => l.status === 'contacted').length, color: "#8B5CF6" },
      { name: "Respondidos", value: filteredLeads.filter(l => l.status === 'responded').length, color: "#D946EF" },
      { name: "Em Negociação", value: filteredLeads.filter(l => l.status === 'negotiating').length, color: "#F97316" },
      { name: "Fechados", value: filteredLeads.filter(l => l.status === 'won').length, color: "#22C55E" },
    ].filter(item => item.value > 0);

    // 4. City Distribution
    const cityMap: Record<string, number> = {};
    filteredLeads.forEach(lead => {
      const city = lead.city || "Outros";
      cityMap[city] = (cityMap[city] || 0) + 1;
    });

    const cityPerformance = Object.entries(cityMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalLeads,
      qualifiedLeads,
      contactedLeads,
      responseRate,
      conversionRate,
      nichePerformance,
      statusData,
      wonLeads,
      trendData,
      cityPerformance,
      growth: totalLeads > 0 ? ((totalLeads / (previousLeads.length || 1)) * 100).toFixed(0) : "0"
    };
  }, [leads, period]);

  if (leadsLoading || historyLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Full empty state only if no leads exist in database at all
  if (!leads || leads.length === 0) {
    return (
      <>
        <PageHeader title="Métricas" description="Acompanhe o desempenho das suas campanhas" />
        <div className="glass-card rounded-xl p-12 text-center border border-slate-300 dark:border-slate-700">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum lead encontrado</h3>
          <p className="text-muted-foreground">Você ainda não possui leads coletados no sistema.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <PageHeader
          title="Métricas"
          description="Acompanhe o desempenho das suas campanhas em tempo real"
          className="mb-0"
        />

        {/* Period Filter with Mobile Optimization */}
        <div className="w-full md:w-auto">
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
            {[
              { id: "today", label: "Hoje" },
              { id: "7d", label: "7 Dias" },
              { id: "30d", label: "30 Dias" },
              { id: "all", label: "Tudo" }
            ].map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "flex-1 md:flex-none h-8 px-2 md:px-4 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  period === p.id
                    ? "bg-background text-primary shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setPeriod(p.id as any)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {!metrics || metrics.totalLeads === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-300 dark:border-slate-700">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-30" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Sem atividade neste período</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Não encontramos leads coletados ou interagindo no período selecionado ({period === 'today' ? 'Hoje' : period === '7d' ? 'últimos 7 dias' : 'últimos 30 dias'}).
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
            <MetricCard
              icon={Users}
              title="Total de Leads"
              value={metrics.totalLeads.toString()}
              change={`${metrics.qualifiedLeads} qualificados`}
              changeType="positive"
            />
            <MetricCard
              icon={MessageCircle}
              title="Contatados"
              value={metrics.contactedLeads.toString()}
              change={`${metrics.totalLeads > 0 ? ((metrics.contactedLeads / metrics.totalLeads) * 100).toFixed(1) : "0"}% do total`}
              changeType="positive"
            />
            <MetricCard
              icon={Target}
              title="Taxa de Resposta"
              value={`${metrics.responseRate}%`}
              change="leads que interagiram"
              changeType="positive"
            />
            <MetricCard
              icon={CalendarCheck}
              title="Conversão"
              value={`${metrics.conversionRate}%`}
              change={`${metrics.wonLeads} fechamentos`}
              changeType="positive"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Trend Chart (Leads per Day) */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-4 md:p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-primary rotate-12 transition-transform group-hover:scale-110 duration-500 hidden sm:block">
                <TrendingUp className="h-24 w-24" />
              </div>
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-3.5 w-3.5 md:h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-foreground">Coleta de Leads</h3>
                    <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-semibold">Volume diário no período</p>
                  </div>
                </div>
                {metrics.growth !== "0" && (
                  <div className="flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                    <ArrowUpRight className="h-2.5 w-2.5 md:h-3 w-3" />
                    <span className="text-[9px] md:text-[10px] font-black">{metrics.growth}%</span>
                  </div>
                )}
              </div>
              <div className="h-[220px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.trendData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                      dy={10}
                      interval={typeof window !== 'undefined' && window.innerWidth < 640 ? 4 : 2}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? "#1e293b" : "#fff",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        fontSize: "11px"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorCount)"
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="glass-card rounded-2xl p-4 md:p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-6 md:mb-8">
                <div className="p-1.5 md:p-2 bg-purple-500/10 rounded-lg">
                  <PieChartIcon className="h-3.5 w-3.5 md:h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-bold text-foreground">Funil de Vendas</h3>
                  <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-semibold">Distribuição por estágio</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="h-[200px] md:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={6}
                        dataKey="value"
                        stroke="none"
                      >
                        {metrics.statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#1e293b" : "#fff",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                          fontSize: "11px"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 px-1 md:px-2">
                  {metrics.statusData.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/20 border border-slate-200 dark:border-slate-700 w-full transition-colors hover:bg-muted/30">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tight truncate mr-2">{s.name}</span>
                        <span className="text-xs font-bold text-foreground leading-none">{s.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
            {/* Niche performance */}
            <div className="glass-card rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6 md:mb-8">
                <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-lg">
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-bold text-foreground">Top Nichos</h3>
                  <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-semibold">Desempenho por segmento</p>
                </div>
              </div>
              <div className="h-[280px] md:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.nichePerformance} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      dataKey="niche"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: "hsl(var(--foreground))", fontWeight: 700 }}
                      width={90}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{
                        backgroundColor: isDark ? "#1e293b" : "#fff",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "11px"
                      }}
                    />
                    <Bar dataKey="leads" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Total Leads" barSize={10} />
                    <Bar dataKey="contacted" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Contatados" barSize={10} />
                    <Bar dataKey="won" fill="#22C55E" radius={[0, 4, 4, 0]} name="Fechados" barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* City Distribution */}
            <div className="glass-card rounded-2xl p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6 md:mb-8">
                <div className="p-1.5 md:p-2 bg-amber-500/10 rounded-lg">
                  <MapPin className="h-3.5 w-3.5 md:h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-bold text-foreground">Geolocalização (Top 5)</h3>
                  <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-semibold">Cidades com mais leads</p>
                </div>
              </div>
              <div className="space-y-4 md:space-y-6">
                {metrics.cityPerformance.map((city, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-foreground truncate mr-2">{city.name}</span>
                      <span className="text-[10px] text-muted-foreground font-black whitespace-nowrap">{city.value} leads</span>
                    </div>
                    <div className="h-1.5 md:h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/30">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(city.value / metrics.totalLeads) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {metrics.cityPerformance.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                    <MapPin className="h-6 w-6 mb-2 opacity-20" />
                    <p className="text-xs">Sem dados de localização</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
