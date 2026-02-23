import { useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Info, MapPin, Phone, Mail, Globe, Star, Calendar, Send, Loader2, MessageSquare, Sparkles, Copy, Wand2, Activity } from "lucide-react";
import ScoreBadge from "@/components/ScoreBadge";
import { LeadHistory } from "@/components/LeadHistory";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL } from "@/config";
import { AICopyReviewDialog } from "./AICopyReviewDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, MessageSquareText } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  segment?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  has_own_website?: boolean;
  score?: number;
  rating?: number;
  user_ratings_total?: number;
  created_at?: string;
  updated_at?: string;
  status?: string;
  image_url?: string | null;
  digital_health?: {
    has_website: boolean;
    is_social_only: boolean;
    has_phone: boolean;
    rating_quality: string;
  };
}

interface LeadDetailsDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailsDialog({ lead, open, onOpenChange }: LeadDetailsDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [generatedCopy, setGeneratedCopy] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("perfil");

  const generateCopyMutation = useMutation({
    mutationFn: async (leadId: string) => {
      console.log("Solicitando copy para:", leadId);
      const response = await fetch(`${API_URL}/api/leads/${leadId}/generate-copy`, {
        method: "POST",
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Falha ao gerar abordagem");
      }
      const data = await response.json();
      console.log("Copy recebida:", data);
      return data.copy as string;
    },
    onSuccess: (copy) => {
      console.log("Sucesso! Copy:", copy);
      setGeneratedCopy(copy);
      setIsReviewOpen(true);
      toast.success("Abordagem gerada pela IA!");
    },
    onError: (error: any) => {
      console.error("Erro detalhado ao gerar abordagem:", error);
      toast.error(`Falha na IA: ${error.message}`);
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ leadId, copy }: { leadId: string; copy?: string | null }) => {
      const response = await fetch(`${API_URL}/api/leads/${leadId}/send-to-n8n`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copy }),
      });
      if (!response.ok) throw new Error("Falha ao disparar n8n");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Automação disparada!", {
        description: "O lead foi enviado para o fluxo com a abordagem personalizada.",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => {
      toast.error("Erro na automação", {
        description: "Verifique se o backend e o n8n estão configurados corretamente.",
      });
    },
  });

  const sendWhatsApp = () => {
    if (!lead?.phone) {
      toast.error("Este lead não possui telefone cadastrado.");
      return;
    }
    const cleanPhone = lead.phone.replace(/\D/g, "");
    const text = generatedCopy || "Olá, tudo bem?";
    // Adicionando o prefixo 55 se o telefone tiver apenas 11 dígitos
    const finalPhone = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;
    const wpUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}`;
    window.open(wpUrl, "_blank");
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setGeneratedCopy(null);
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-4xl w-[calc(100%-2rem)] h-[90vh] md:h-[95vh] flex flex-col p-0 gap-0 overflow-hidden border-border bg-background rounded-2xl md:rounded-xl">
        {/* Header Dialog w/ Gradient */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border px-6 py-4">
          {lead.image_url && (
            <div className="absolute right-0 top-0 h-full w-1/3 opacity-20 pointer-events-none overflow-hidden">
              <img src={lead.image_url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/100"></div>
            </div>
          )}
          <div className="flex items-center gap-4 relative z-10">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/20 shadow-inner overflow-hidden">
              {lead.image_url ? (
                <img src={lead.image_url} alt={lead.name} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <DialogTitle
                className="font-bold text-foreground whitespace-nowrap overflow-hidden text-[clamp(0.7rem,3.5vw,1.25rem)]"
                title={lead.name}
              >
                {lead.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <DialogDescription className="text-sm text-muted-foreground tracking-tight">{lead.segment || "Lead Coletado"}</DialogDescription>
                <Separator orientation="vertical" className="h-3.5 bg-muted-foreground/30" />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {lead.city}, {lead.state}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Tabs Header */}
          <div className="md:hidden border-b border-border/50 bg-background px-6 pt-2 shrink-0">
            <TabsList className="w-full justify-start h-11 bg-transparent gap-8 p-0">
              <TabsTrigger
                value="perfil"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-bold uppercase tracking-wider px-0 py-3 gap-2"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Perfil
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-bold uppercase tracking-wider px-0 py-3 gap-2"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Inteligência
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto md:overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 h-full">
              {/* Perfil Content (Column 1) */}
              <div
                className={cn(
                  "m-0 md:col-span-1 bg-muted/30 p-6 space-y-6 border-r border-border/50 h-full overflow-y-auto",
                  activeTab !== "perfil" && "hidden md:block"
                )}
              >
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Info className="h-3 w-3" />
                    Detalhes do Lead
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-background p-1 rounded-md border border-border shadow-sm">
                        <MapPin className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Localização</p>
                        <p className="text-xs font-medium text-foreground leading-snug">{lead.address || `${lead.city}, ${lead.state}`}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-background p-1 rounded-md border border-border shadow-sm">
                        <Phone className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Telefone</p>
                        <p className="text-xs font-medium text-foreground">{lead.phone || "Não informado"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-background p-1 rounded-md border border-border shadow-sm">
                        <Globe className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Website</p>
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline break-all">
                            {lead.website}
                          </a>
                        ) : (
                          <p className="text-xs font-medium text-muted-foreground italic">Não disponível</p>
                        )}
                      </div>
                    </div>

                    {lead.email && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 bg-background p-1 rounded-md border border-border shadow-sm">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Email</p>
                          <p className="text-xs font-medium text-foreground break-all">{lead.email}</p>
                        </div>
                      </div>
                    )}
                    {/* Mobile Only: Coletado em */}
                    <div className="md:hidden flex items-start gap-3 pt-1">
                      <div className="mt-0.5 bg-background p-1 rounded-md border border-border shadow-sm">
                        <Calendar className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Coletado em</p>
                        <p className="text-xs font-medium text-foreground">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Star className="h-3 w-3" />
                    Qualificação
                  </h4>
                  <div className="glass-card p-4 rounded-xl space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-medium text-foreground">Score</span>
                        <ScoreBadge score={lead.score || 0} />
                      </div>
                    </div>

                    <div className="pt-2 space-y-2 border-t border-border/50">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground">Rating Google:</span>
                        <span className="font-medium text-foreground">⭐ {lead.rating || "N/A"}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-foreground">
                        <span className="text-muted-foreground">Avaliações:</span>
                        <span className="font-medium">{lead.user_ratings_total || 0} total</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-foreground">
                        <span className="text-muted-foreground">Site Próprio:</span>
                        <Badge variant={lead.has_own_website ? "outline" : "destructive"} className="text-[9px] h-3.5 px-1">
                          {lead.has_own_website ? "Sim" : "Não"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnóstico Digital - CAPTU 3.0 */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Activity className="h-3 w-3" />
                    Diagnóstico Digital
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/50">
                      <span className="text-[10px] font-medium text-muted-foreground">Presença Web</span>
                      {lead.digital_health?.has_website ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-[9px] h-4">Excelente</Badge>
                      ) : lead.digital_health?.is_social_only ? (
                        <Badge className="bg-warning/10 text-warning border-warning/20 text-[9px] h-4">Só Redes</Badge>
                      ) : (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[9px] h-4">Inexistente</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/50">
                      <span className="text-[10px] font-medium text-muted-foreground">Reputação</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={cn("h-2.5 w-2.5", s <= (lead.rating || 0) ? "fill-amber-500 text-amber-500" : "text-muted")} />
                        ))}
                      </div>
                    </div>
                    {!lead.has_own_website && (
                      <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-[9px] text-primary font-bold leading-tight">
                          💡 OPORTUNIDADE: Lead não possui site próprio. Abordagem sugerida: Desenvolvimento Web.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inteligência & Chat (Column 2-3) */}
              <div
                className={cn(
                  "m-0 md:col-span-2 p-4 md:p-6 flex flex-col min-h-0 overflow-hidden h-full bg-background outline-none",
                  activeTab !== "ai" && "hidden md:flex"
                )}
              >
                <div className="mb-4 md:mb-6 bg-primary/5 border border-primary/20 rounded-xl p-3 md:p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[12px] sm:text-sm font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse shrink-0" />
                      <span className="leading-tight">Sugestão de Abordagem com IA</span>
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[10px] font-bold border-primary/30 hover:bg-primary/10 shrink-0 w-fit shadow-sm px-4 mt-0"
                      onClick={() => generateCopyMutation.mutate(lead.id)}
                      disabled={generateCopyMutation.isPending}
                    >
                      {generateCopyMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Wand2 className="h-3 w-3 mr-1" />
                      )}
                      <span className="whitespace-nowrap">
                        {generateCopyMutation.isPending ? "Analisando..." : (generatedCopy ? "Regerar" : "Gerar com IA")}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Histórico de Contatos
                  </h4>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded-sm tracking-widest">
                    Atividade: {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "-"}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  <LeadHistory leadId={lead.id} phone={lead.phone} />
                </div>
              </div>
            </div>
          </div>
        </Tabs>

        <Separator className="my-0 bg-border/50" />

        <div className="px-6 py-4 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
            <Calendar className="h-3 w-3" />
            <span>Coletado em: {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</span>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
            <Button variant="ghost" size="sm" className="font-semibold text-xs h-9" onClick={() => onOpenChange(false)}>Fechar</Button>

            <div className="flex-1 sm:flex-none flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none font-bold text-[10px] sm:text-xs border-primary/20 hover:bg-primary/5 text-primary h-9 px-2 sm:px-3"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/chat?leadId=${lead.id}`);
                }}
              >
                <MessageSquare className="h-3 w-3 mr-1.5" />
                Chat
              </Button>

              {generatedCopy && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none font-bold text-[10px] sm:text-xs border-green-500/50 hover:bg-green-500/10 text-green-600 dark:text-green-400 h-9 px-2 sm:px-3"
                  onClick={sendWhatsApp}
                >
                  <MessageSquare className="h-3 w-3 mr-1.5" />
                  Whats
                </Button>
              )}

              <Button
                size="sm"
                className="flex-[1.5] sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 px-4 text-[10px] sm:text-xs h-9"
                onClick={() => {
                  mutation.mutate({ leadId: lead.id, copy: generatedCopy });
                }}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Send className="h-3 w-3 mr-1.5" />}
                {generatedCopy ? "Enviar IA" : "Prospecção"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      <AICopyReviewDialog
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        copy={generatedCopy || ""}
        leadName={lead.name}
        onSend={() => {
          mutation.mutate({ leadId: lead.id, copy: generatedCopy });
          setIsReviewOpen(false);
        }}
        onRegenerate={() => {
          generateCopyMutation.mutate(lead.id);
        }}
        isSending={mutation.isPending}
        isRegenerating={generateCopyMutation.isPending}
        onWhatsApp={sendWhatsApp}
      />
    </Dialog >
  );
}
