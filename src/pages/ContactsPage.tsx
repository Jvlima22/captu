import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Building2, Phone, Mail, MapPin, Loader2, Eye, Trash2, MoreHorizontal, Search, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import ScoreBadge from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LeadDetailsDialog } from "@/components/LeadDetailsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { LeadHistory } from "@/components/LeadHistory";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type FunnelStage = "contacted" | "responded" | "negotiating" | "won" | "lost";

interface Lead {
  id: string;
  name: string;
  segment: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  website: string;
  score: number;
  status: string;
  address: string;
  rating: number;
  user_ratings_total: number;
  updated_at: string;
  image_url?: string | null;
}

const FUNNEL_STAGES: { id: FunnelStage; label: string; color: string; headerColor: string; icon: string }[] = [
  {
    id: "contacted",
    label: "Contatado",
    color: "bg-blue-50/50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/10",
    headerColor: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20",
    icon: "📩"
  },
  {
    id: "responded",
    label: "Respondido",
    color: "bg-purple-50/50 dark:bg-purple-500/5 border-purple-100 dark:border-purple-500/10",
    headerColor: "text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20",
    icon: "💬"
  },
  {
    id: "negotiating",
    label: "Em negociação",
    color: "bg-orange-50/50 dark:bg-orange-500/5 border-orange-100 dark:border-orange-500/10",
    headerColor: "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20",
    icon: "🤝"
  },
  {
    id: "won",
    label: "Fechado",
    color: "bg-green-50/50 dark:bg-green-500/5 border-green-100 dark:border-green-500/10",
    headerColor: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-500/20",
    icon: "⭐"
  },
  {
    id: "lost",
    label: "Perdido",
    color: "bg-red-50/50 dark:bg-red-500/5 border-red-100 dark:border-red-500/10",
    headerColor: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/20",
    icon: "❌"
  },
];

export default function ContactsPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .neq("status", "new")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead excluído com sucesso!");
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir lead", {
        description: error.message,
      });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const leadId = result.draggableId;
    const newStatus = result.destination.droppableId as FunnelStage;

    if (newStatus === leads?.find(l => l.id === leadId)?.status) return;

    updateStatusMutation.mutate({ leadId, newStatus });
  };

  const filteredLeads = leads?.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.segment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.city.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCity = selectedCity === "all" || lead.city === selectedCity;
    const matchesSegment = selectedSegment === "all" || lead.segment === selectedSegment;

    return matchesSearch && matchesCity && matchesSegment;
  }) || [];

  const getLeadsByStage = (stage: FunnelStage) => {
    return filteredLeads.filter((lead) => lead.status === stage);
  };

  const cities = Array.from(new Set(leads?.map(l => l.city) || [])).sort();
  const segments = Array.from(new Set(leads?.map(l => l.segment) || [])).sort();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Carregando pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <PageHeader
        title="Pipeline de Vendas"
        description="Gerencie suas oportunidades e acompanhe o progresso de cada negociação."
        className="mb-0"
      />

      <div className="flex flex-col lg:flex-row gap-4 mb-6 bg-muted/20 p-4 rounded-2xl border border-border/50 items-center justify-between">
        {/* Busca Ampliada */}
        <div className="relative w-full lg:max-w-xl group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Buscar leads por nome, nicho ou cidade..."
            className="pl-10 bg-background/50 border-slate-300 dark:border-slate-700 focus-visible:ring-primary/20 focus-visible:border-primary transition-all rounded-xl h-10 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Grupo de Filtros Alinhado ao Final */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:justify-end">
          <Separator orientation="vertical" className="hidden lg:block h-6 bg-border/50 mx-1" />

          {/* Filtro por Nicho */}
          <div className="relative flex-1 sm:flex-none">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <select
              className="pl-10 pr-4 h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-background/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none min-w-[140px] w-full cursor-pointer hover:bg-background/80"
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
            >
              <option value="all">Todos os Nichos</option>
              {segments.map(seg => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Cidade */}
          <div className="relative flex-1 sm:flex-none">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <select
              className="pl-10 pr-4 h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-background/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none min-w-[140px] w-full cursor-pointer hover:bg-background/80"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="all">Todas as Cidades</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Limpar Filtros */}
          {(searchTerm || selectedCity !== "all" || selectedSegment !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-3 text-muted-foreground hover:text-destructive transition-colors text-[10px] font-bold uppercase tracking-wider"
              onClick={() => {
                setSearchTerm("");
                setSelectedCity("all");
                setSelectedSegment("all");
              }}
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 pb-4 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full overflow-x-auto pb-4 px-1 snap-x snap-mandatory md:snap-none md:overflow-x-auto custom-scrollbar">
            {FUNNEL_STAGES.map((stage) => {
              const stageLeads = getLeadsByStage(stage.id);
              return (
                <div key={stage.id} className="flex flex-col flex-none w-[85vw] md:w-auto md:flex-1 md:min-w-[280px] snap-center md:snap-align-none first:ml-4 last:mr-4 md:ml-0 md:mr-0 group/column">
                  {/* Column Header */}
                  <div className={`p-4 rounded-t-xl border-b flex items-center justify-between mb-2 bg-background/60 backdrop-blur-md shadow-sm border-border/50 sticky top-0 z-10`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm transition-transform group-hover/column:scale-110 duration-300 ${stage.headerColor}`}>
                        {stage.icon}
                      </div>
                      <h3 className="font-bold text-foreground text-sm uppercase tracking-tight">
                        {stage.label}
                      </h3>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ring-1 ring-inset transition-all ${stage.headerColor} min-w-[24px] text-center`}>
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-2 rounded-xl transition-all duration-300 relative ${snapshot.isDraggingOver
                          ? "bg-primary/5 ring-2 ring-primary/20 ring-inset"
                          : "bg-muted/30"
                          }`}
                      >
                        <div className="space-y-3 h-full overflow-y-auto max-h-[calc(100vh-250px)] pr-1 custom-scrollbar">
                          {stageLeads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`group relative bg-card p-4 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer active:cursor-grabbing ${snapshot.isDragging ? "shadow-2xl rotate-2 scale-105 z-50 ring-2 ring-primary" : ""
                                    }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                    borderLeftWidth: '4px',
                                    borderLeftColor: stage.id === 'won' ? '#22c55e' : stage.id === 'lost' ? '#ef4444' : stage.id === 'negotiating' ? '#f97316' : stage.id === 'responded' ? '#a855f7' : '#3b82f6'
                                  }}
                                  onClick={() => setSelectedLead(lead)}
                                  onMouseEnter={() => setHoveredCard(lead.id)}
                                  onMouseLeave={() => setHoveredCard(null)}
                                >
                                  {/* Glass highlight on hover */}
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl" />
                                  {/* Header do Card */}
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <Avatar className="h-8 w-8 bg-muted border border-border shrink-0">
                                        {lead.image_url && <AvatarImage src={lead.image_url} alt={lead.name} />}
                                        <AvatarFallback className="text-xs font-bold text-muted-foreground bg-muted/50">
                                          {getInitials(lead.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <h4 className="font-semibold text-sm text-foreground truncate" title={lead.name}>
                                          {lead.name}
                                        </h4>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <span className="truncate">{lead.segment}</span>
                                          <span className="shrink-0 opacity-40">•</span>
                                          <span className="truncate">{lead.city}, {lead.state}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Actions Menu */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground transition-opacity"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setSelectedLead(lead)}>
                                          <Eye className="h-3.5 w-3.5 mr-2 text-blue-500" />
                                          Ver detalhes
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                          onClick={() => {
                                            setLeadToDelete(lead);
                                            setDeleteDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>

                                  {/* Footer Info */}
                                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                                      <span className="text-[10px]">Atualizado em {
                                        lead.updated_at
                                          ? format(new Date(lead.updated_at), "dd MMM 'às' HH:mm", { locale: ptBR })
                                          : "-"
                                      }</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {stageLeads.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                              <span className="text-2xl opacity-20 mb-2">{stage.icon}</span>
                              <span className="text-sm font-medium">Vazio</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      <LeadDetailsDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente <strong>{leadToDelete?.name}</strong> e todo o seu histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leadToDelete && deleteMutation.mutate(leadToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
