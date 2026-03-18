import React from 'react';
import { 
  Users, 
  Zap, 
  CheckCircle2, 
  Activity,
  ArrowUpRight
} from "lucide-react";
import MetricCard from "@/components/MetricCard";

export function IntegrationOverview() {
  // Metrics data for the integrations overview
  const metrics = [
    {
      title: "Conexões Ativas",
      value: "14",
      change: "+2 novos",
      changeType: "positive" as const,
      icon: Zap
    },
    {
      title: "Leads Capturados (24h)",
      value: "842",
      change: "12.5% de aumento",
      changeType: "positive" as const,
      icon: Users
    },
    {
      title: "Automações Disparadas",
      value: "5.231",
      change: "4.2% de aumento",
      changeType: "positive" as const,
      icon: Zap
    },
    {
      title: "Taxa de Sucesso",
      value: "99.8%",
      change: "0.1% de melhora",
      changeType: "positive" as const,
      icon: CheckCircle2
    }
  ];

  return (
    <div className="w-full">
      <div className="flex flex-col mb-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Visão Geral do Projeto
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitoramento em tempo real das conexões e fluxos de dados do CAPTU.
        </p>
      </div>
      
      {/* Metrics Grid matching Dashboard layout */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            change={metric.change}
            changeType={metric.changeType}
            icon={metric.icon}
          />
        ))}
      </div>
    </div>
  );
}
