import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MoreHorizontal,
  Loader2,
  Play,
  Pause,
  Eye,
  Copy,
  Trash2,
  Users,
  MessageSquare,
  TrendingUp,
  Calendar,
  LayoutGrid,
  List,
  Columns2,
  Clock,
  ArrowRight,
  Pencil
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { CreateCampaignDialog } from "@/components/CreateCampaignDialog";
import { CampaignDetailsDialog } from "@/components/CampaignDetailsDialog";
import { EditCampaignDialog } from "@/components/EditCampaignDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

type CampaignStatus = "draft" | "active" | "paused" | "completed";
type CampaignFilter = "all" | CampaignStatus;
type ViewMode = "grid" | "list";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  niche: string;
  daily_limit: number;
  sent_count: number;
  replies_count: number;
  meetings_count: number;
  created_at: string;
  updated_at: string;
}

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<CampaignFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CampaignStatus }) => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Status da campanha atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha excluída com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir campanha");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (campaign: Campaign) => {
      const { error } = await supabase.from("campaigns").insert({
        name: `${campaign.name} (Cópia)`,
        status: "draft",
        niche: campaign.niche,
        daily_limit: campaign.daily_limit
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha duplicada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao duplicar campanha");
    },
  });

  const bulkStatusUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: CampaignStatus }) => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setSelectedCampaignIds([]);
      toast.success(`${variables.ids.length} campanhas atualizadas para ${getStatusLabel(variables.status)}`);
    },
    onError: () => {
      toast.error("Erro ao atualizar campanhas em massa");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("campaigns").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setSelectedCampaignIds([]);
      toast.success(`${ids.length} campanhas excluídas com sucesso!`);
    },
    onError: () => {
      toast.error("Erro ao excluir campanhas em massa");
    },
  });

  const toggleCampaignSelection = (id: string) => {
    setSelectedCampaignIds(prev =>
      prev.includes(id) ? prev.filter(cur => cur !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedCampaignIds.length === filteredCampaigns?.length) {
      setSelectedCampaignIds([]);
    } else {
      setSelectedCampaignIds(filteredCampaigns?.map(c => c.id) || []);
    }
  };

  const filteredCampaigns = campaigns?.filter((c) =>
    statusFilter === "all" ? true : c.status === statusFilter
  );

  const stats = {
    all: campaigns?.length || 0,
    active: campaigns?.filter((c) => c.status === "active").length || 0,
    paused: campaigns?.filter((c) => c.status === "paused").length || 0,
    draft: campaigns?.filter((c) => c.status === "draft").length || 0,
    completed: campaigns?.filter((c) => c.status === "completed").length || 0,
  };

  const getStatusColor = (status: CampaignStatus) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "paused":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "draft":
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
      case "completed":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  const getStatusLabel = (status: CampaignStatus) => {
    switch (status) {
      case "active":
        return "Ativa";
      case "paused":
        return "Pausada";
      case "draft":
        return "Rascunho";
      case "completed":
        return "Concluída";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Campanhas" description="Gerencie suas campanhas de prospecção automatizada">
        <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="h-9 px-3 sm:px-4 mt-2">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Nova Campanha</span>
        </Button>
      </PageHeader>

      {/* Status Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none items-center">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
            className="h-9 whitespace-nowrap"
          >
            Todas
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 h-4 min-w-[20px] justify-center">
              {stats.all}
            </Badge>
          </Button>
          <Button
            variant={statusFilter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("active")}
            className="h-9 whitespace-nowrap"
          >
            Ativas
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 h-4 min-w-[20px] justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </Badge>
          </Button>
          <Button
            variant={statusFilter === "paused" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("paused")}
            className="h-9 whitespace-nowrap"
          >
            Pausadas
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 h-4 min-w-[20px] justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {stats.paused}
            </Badge>
          </Button>
          <Button
            variant={statusFilter === "draft" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("draft")}
            className="h-9 whitespace-nowrap"
          >
            Rascunhos
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 h-4 min-w-[20px] justify-center">
              {stats.draft}
            </Badge>
          </Button>
          <Button
            variant={statusFilter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("completed")}
            className="h-9 whitespace-nowrap"
          >
            Concluídas
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 h-4 min-w-[20px] justify-center">
              {stats.completed}
            </Badge>
          </Button>
        </div>

        <div className="hidden md:flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-slate-300 dark:border-slate-700">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("list")}
            title="Lista"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("grid")}
            title="Grade"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns?.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {statusFilter === "all" ? "Nenhuma campanha criada" : `Nenhuma campanha ${statusFilter === "active" ? "ativa" : statusFilter === "paused" ? "pausada" : statusFilter === "draft" ? "em rascunho" : "concluída"}`}
          </h3>
          <p className="text-muted-foreground mb-4">
            Crie sua primeira campanha de prospecção automatizada!
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        </div>
      ) : (viewMode === "grid" || (typeof window !== 'undefined' && window.innerWidth < 768)) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns?.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="py-4 px-4 w-10 text-center">
                  <Checkbox
                    checked={filteredCampaigns && filteredCampaigns.length > 0 && selectedCampaignIds.length === filteredCampaigns.length}
                    onCheckedChange={toggleAllSelection}
                  />
                </th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase">Campanha</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase text-center">Status</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase text-center">Métricas (E/R/M)</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase text-center">Taxa</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-muted-foreground uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns?.map((campaign) => (
                <tr
                  key={campaign.id}
                  className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${selectedCampaignIds.includes(campaign.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="py-4 px-4 text-center">
                    <Checkbox
                      checked={selectedCampaignIds.includes(campaign.id)}
                      onCheckedChange={() => toggleCampaignSelection(campaign.id)}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-semibold text-foreground">{campaign.name}</p>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge className={`text-[10px] px-1.5 py-0 ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-2 font-mono text-xs">
                      <span title="Enviados">{campaign.sent_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span title="Respostas">{campaign.replies_count}</span>
                      <span className="text-muted-foreground">/</span>
                      <span title="Reuniões">{campaign.meetings_count}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {campaign.sent_count > 0 ? (
                      <span className="text-xs font-bold text-emerald-500">
                        {((campaign.replies_count / campaign.sent_count) * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <CampaignActions campaign={campaign} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Campaign Details Dialog */}
      {selectedCampaign && (
        <CampaignDetailsDialog
          campaign={selectedCampaign}
          open={!!selectedCampaign}
          onOpenChange={(open) => !open && setSelectedCampaign(null)}
        />
      )}

      {editingCampaign && (
        <EditCampaignDialog
          campaign={editingCampaign}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingCampaign(null);
          }}
        />
      )}

      {/* Floating Action Bar */}
      {selectedCampaignIds.length > 0 && (
        <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-[calc(100%-2rem)] md:w-auto">
          <div className="bg-foreground text-background md:px-6 py-4 md:py-3 rounded-2xl md:rounded-full shadow-2xl flex flex-col md:flex-row items-center gap-4 md:gap-6 border border-white/10 backdrop-blur-md bg-opacity-90 px-4">
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary text-primary-foreground h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                  {selectedCampaignIds.length}
                </div>
                <span className="text-sm font-medium">Selecionadas</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-background hover:text-background hover:bg-white/10 md:hidden"
                onClick={() => setSelectedCampaignIds([])}
              >
                Limpar
              </Button>
            </div>

            <Separator orientation="vertical" className="hidden md:block h-4 bg-white/20" />

            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none justify-center">
              <Button
                size="sm"
                variant="ghost"
                className="hidden md:flex text-background hover:text-background hover:bg-white/10"
                onClick={() => setSelectedCampaignIds([])}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-emerald-400 hover:text-emerald-400 hover:bg-emerald-400/10 h-10 md:h-9"
                onClick={() => bulkStatusUpdateMutation.mutate({ ids: selectedCampaignIds, status: "active" })}
                disabled={bulkStatusUpdateMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Ativar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-400 hover:text-amber-400 hover:bg-amber-400/10 h-10 md:h-9"
                onClick={() => bulkStatusUpdateMutation.mutate({ ids: selectedCampaignIds, status: "paused" })}
                disabled={bulkStatusUpdateMutation.isPending}
              >
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-400 hover:bg-red-400/10 h-10 md:h-9"
                onClick={() => {
                  if (confirm(`Excluir ${selectedCampaignIds.length} campanhas permanentemente?`)) {
                    bulkDeleteMutation.mutate(selectedCampaignIds);
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Sub-component for Campaign Card to keep main render clean
  function CampaignCard({ campaign }: { campaign: Campaign }) {
    const isSelected = selectedCampaignIds.includes(campaign.id);
    return (
      <div className={`glass-card rounded-xl p-5 hover:shadow-lg transition-all border ${isSelected ? 'border-primary shadow-md bg-primary/5' : 'border-slate-300 dark:border-slate-700'}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleCampaignSelection(campaign.id)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-1 truncate">{campaign.name}</h3>
              <Badge className={`text-[10px] px-1.5 py-0 ${getStatusColor(campaign.status)}`}>
                {getStatusLabel(campaign.status)}
              </Badge>
            </div>
          </div>
          <CampaignActions campaign={campaign} />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-muted/20 rounded-lg">
            <p className="text-[10px] text-muted-foreground mb-0.5 uppercase font-bold tracking-tight">Enviados</p>
            <p className="text-lg font-bold text-foreground">{campaign.sent_count}</p>
          </div>
          <div className="text-center p-2 bg-muted/20 rounded-lg">
            <p className="text-[10px] text-muted-foreground mb-0.5 uppercase font-bold tracking-tight">Respostas</p>
            <p className="text-lg font-bold text-foreground">{campaign.replies_count}</p>
            {campaign.sent_count > 0 && (
              <p className="text-[10px] font-bold text-emerald-500">
                {((campaign.replies_count / campaign.sent_count) * 100).toFixed(0)}%
              </p>
            )}
          </div>
          <div className="text-center p-2 bg-muted/20 rounded-lg">
            <p className="text-[10px] text-muted-foreground mb-0.5 uppercase font-bold tracking-tight">Reuniões</p>
            <p className="text-lg font-bold text-foreground">{campaign.meetings_count}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(campaign.created_at).toLocaleDateString()}
          </span>
          <span>Limite: {campaign.daily_limit}/DIA</span>
        </div>
      </div>
    );
  }

  // Sub-component for Campaign Actions to avoid duplication
  function CampaignActions({ campaign }: { campaign: Campaign }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setSelectedCampaign(campaign)}>
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            setEditingCampaign(campaign);
            setEditDialogOpen(true);
          }}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          {campaign.status === "active" ? (
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "paused" })}
            >
              <Pause className="h-4 w-4 mr-2" />
              Pausar
            </DropdownMenuItem>
          ) : campaign.status === "paused" || campaign.status === "draft" ? (
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "active" })}
            >
              <Play className="h-4 w-4 mr-2" />
              Ativar
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => duplicateMutation.mutate(campaign)}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => deleteMutation.mutate(campaign.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
