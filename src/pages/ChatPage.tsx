import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Search,
    MoreVertical,
    Phone,
    Video,
    Info,
    CheckCheck,
    Smile,
    Paperclip,
    Send,
    Loader2,
    Volume2,
    ChevronLeft,
    MessageSquare,
    User,
    Filter,
    MapPin,
    Globe,
    Star,
    Archive,
    Trash,
    VideoOff,
    ExternalLink,
    Image as ImageIcon,
    FileText
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { API_URL } from "@/config";
import ScoreBadge from "@/components/ScoreBadge";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatLead {
    id: string;
    name: string;
    phone: string;
    segment: string;
    score: number;
    status: string;
    city: string;
    state: string;
    last_message?: string;
    last_message_time?: string;
    unread_count?: number;
    image_url?: string;
}

interface Message {
    id: string;
    message: string;
    direction: 'inbound' | 'outbound';
    status: string;
    data_envio: string;
}

export default function ChatPage() {
    const [searchParams] = useSearchParams();
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get("leadId"));
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showLeadInfo, setShowLeadInfo] = useState(true);
    const [presenceMap, setPresenceMap] = useState<Record<string, { status: string, timestamp: string }>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Sync selectedLeadId with search params
    useEffect(() => {
        const urlLeadId = searchParams.get("leadId");
        if (urlLeadId && urlLeadId !== selectedLeadId) {
            setSelectedLeadId(urlLeadId);
        }
    }, [searchParams, selectedLeadId]);

    const commonEmojis = ["😊", "👍", "🤝", "🚀", "💡", "📅", "✅", "📍", "💰", "🙏", "📞", "👋"];

    // Fetch leads that have history
    const { data: chatLeads, isLoading: loadingLeads } = useQuery({
        queryKey: ["chat-leads"],
        queryFn: async () => {
            // 1. Get all leads
            const { data: leads, error: leadsError } = await supabase
                .from("leads")
                .select("*")
                .order("name");

            if (leadsError) throw leadsError;

            // 2. Get latest message for each lead to show in sidebar
            // This is a bit complex in Supabase without a specific view, 
            // so we'll fetch recent history and map it.
            const { data: history, error: historyError } = await supabase
                .from("contact_history")
                .select("company_id, message, data_envio, direction")
                .order("data_envio", { ascending: false });

            if (historyError) throw historyError;

            // Map leads to lead with last message
            const leadsWithHistory = leads.map(lead => {
                const leadHistory = history.filter(h => h.company_id === lead.id);
                if (leadHistory.length === 0) return null;

                return {
                    ...lead,
                    last_message: leadHistory[0].message,
                    last_message_time: leadHistory[0].data_envio,
                };
            }).filter(Boolean) as ChatLead[];

            // Sort by last message time
            return leadsWithHistory.sort((a, b) => {
                return new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime();
            });
        }
    });

    const selectedLead = useMemo(() =>
        chatLeads?.find(l => l.id === selectedLeadId),
        [chatLeads, selectedLeadId]
    );

    // Fetch messages for selected lead
    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["messages", selectedLeadId],
        queryFn: async () => {
            if (!selectedLeadId) return [];
            const { data, error } = await supabase
                .from("contact_history")
                .select("*")
                .eq("company_id", selectedLeadId)
                .order("data_envio", { ascending: true });

            if (error) throw error;
            return data as Message[];
        },
        enabled: !!selectedLeadId,
    });

    // Realtime Presence Subscription
    useEffect(() => {
        const channel = supabase.channel('presence-global')
            .on('broadcast', { event: 'presence-status' }, (payload) => {
                const { phone, presence, timestamp } = payload.payload;
                setPresenceMap(prev => ({
                    ...prev,
                    [phone]: { status: presence, timestamp }
                }));

                // Limpar status de "digitando" após 5 segundos se não houver novo update
                if (presence === 'composing') {
                    setTimeout(() => {
                        setPresenceMap(prev => {
                            if (prev[phone]?.status === 'composing') {
                                return { ...prev, [phone]: { ...prev[phone], status: 'available' } };
                            }
                            return prev;
                        });
                    }, 5000);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Real-time subscription for messages
    useEffect(() => {
        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'contact_history'
                },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ["chat-leads"] });
                    if (selectedLeadId && (payload.new as any).company_id === selectedLeadId) {
                        queryClient.invalidateQueries({ queryKey: ["messages", selectedLeadId] });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedLeadId, queryClient]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedLead || isSending) return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_URL}/api/chat/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadId: selectedLead.id,
                    phone: selectedLead.phone,
                    message: newMessage.trim()
                }),
            });

            if (!response.ok) throw new Error("Erro ao enviar mensagem");

            setNewMessage("");
            queryClient.invalidateQueries({ queryKey: ["messages", selectedLead.id] });
            queryClient.invalidateQueries({ queryKey: ["chat-leads"] });
        } catch (error: any) {
            toast.error("Erro ao enviar", { description: error.message });
        } finally {
            setIsSending(false);
        }
    };

    const filteredLeads = useMemo(() => {
        if (!chatLeads) return [];
        return chatLeads.filter(l => {
            const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone.includes(searchQuery);
            const matchesStatus = !statusFilter || l.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [chatLeads, searchQuery, statusFilter]);

    const handleEmojiClick = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            toast.success(`Arquivo "${file.name}" selecionado!`, {
                description: "O suporte para envio de anexos está sendo implementado no backend."
            });
        }
    };

    const handleArchiveLead = (leadId: string) => {
        toast.info("Lead arquivado com sucesso!", {
            description: "Esta ação mudará o status do lead no banco de dados futuramente."
        });
    };

    const handleCall = (phone: string) => {
        window.location.href = `tel:${phone.replace(/\D/g, "")}`;
    };

    return (
        <div className={cn(
            "flex overflow-hidden bg-card transition-all w-full flex-1 h-full"
        )}>
            {/* Sidebar - Conversation List */}
            <div className={cn(
                "w-full md:w-[350px] lg:w-[400px] flex flex-col border-r border-border bg-muted/10 shrink-0",
                selectedLeadId ? "hidden md:flex" : "flex"
            )}>
                <div className="p-4 space-y-4 bg-background/50 backdrop-blur-sm border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Central de Chat</h1>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className={cn("rounded-full", statusFilter ? "text-primary bg-primary/10" : "text-muted-foreground")}>
                                    <Filter className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                                    Todas as conversas
                                    {!statusFilter && <CheckCheck className="h-3 w-3 ml-auto text-primary" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("new")}>
                                    Novos Leads
                                    {statusFilter === "new" && <CheckCheck className="h-3 w-3 ml-auto text-primary" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("contacted")}>
                                    Contatados
                                    {statusFilter === "contacted" && <CheckCheck className="h-3 w-3 ml-auto text-primary" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("replied")}>
                                    Respondidos
                                    {statusFilter === "replied" && <CheckCheck className="h-3 w-3 ml-auto text-primary" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar conversas..."
                            className="pl-10 bg-background/50 border-border/50 focus:ring-primary/20 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="divide-y divide-border/30">
                        {loadingLeads ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="p-8 text-center space-y-2">
                                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/20" />
                                <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
                            </div>
                        ) : (
                            filteredLeads.map((lead) => (
                                <div
                                    key={lead.id}
                                    onClick={() => setSelectedLeadId(lead.id)}
                                    className={cn(
                                        "p-4 flex gap-4 cursor-pointer transition-all hover:bg-primary/5 relative group",
                                        selectedLeadId === lead.id ? "bg-primary/10" : ""
                                    )}
                                >
                                    {selectedLeadId === lead.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                    )}

                                    <div className="relative">
                                        <Avatar className="h-12 w-12 border border-border/50 shadow-sm">
                                            <AvatarImage src={lead.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=random&color=fff`} />
                                            <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                                {lead.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {(lead.phone && (presenceMap[lead.phone.replace(/\D/g, '')]?.status === 'available' || presenceMap[lead.phone.replace(/\D/g, '')]?.status === 'composing')) && (
                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {lead.last_message_time ? format(new Date(lead.last_message_time), "HH:mm", { locale: ptBR }) : ""}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/20 bg-primary/5 text-primary">
                                                {lead.segment?.split(' ')[0] || "Nicho"}
                                            </Badge>
                                            <ScoreBadge score={lead.score} className="scale-75 origin-left" />
                                        </div>

                                        <p className="text-xs text-muted-foreground truncate line-clamp-1">
                                            {lead.phone && presenceMap[lead.phone.replace(/\D/g, '')]?.status === 'composing' ? (
                                                <span className="text-emerald-500 font-medium animate-pulse">Digitando...</span>
                                            ) : (
                                                lead.last_message || "Iniciar conversa..."
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col min-w-0 bg-background relative chat-pattern",
                !selectedLeadId ? "hidden md:flex" : "flex"
            )}>
                {/* Chat Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat" />

                {selectedLead ? (
                    <>
                        {/* Chat Header */}
                        <header className="px-4 md:px-6 py-3 flex items-center justify-between bg-background/80 backdrop-blur-md border-b border-border/50 z-10 shrink-0">
                            <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden -ml-2 rounded-full h-8 w-8"
                                    onClick={() => setSelectedLeadId(null)}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Avatar className="h-9 w-9 md:h-10 md:w-10 border border-primary/10 shrink-0">
                                    <AvatarImage src={selectedLead.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.name)}&background=random&color=fff`} />
                                    <AvatarFallback className="bg-primary/5 text-primary font-bold">{selectedLead.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="font-bold text-sm leading-tight">{selectedLead.name}</h2>
                                    <div className="flex items-center gap-2">
                                        {selectedLead.phone && presenceMap[selectedLead.phone.replace(/\D/g, '')]?.status === 'composing' ? (
                                            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium lowercase">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                                                Digitando...
                                            </span>
                                        ) : selectedLead.phone && presenceMap[selectedLead.phone.replace(/\D/g, '')]?.status === 'available' ? (
                                            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium lowercase">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                Online agora
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium lowercase">
                                                Offline
                                            </span>
                                        )}
                                        <span className="text-[10px] text-muted-foreground">•</span>
                                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{selectedLead.segment}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 md:gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full text-muted-foreground hover:bg-primary/5 hover:text-primary h-9 w-9 md:h-10 md:w-10"
                                    onClick={() => handleCall(selectedLead.phone)}
                                >
                                    <Phone className="h-4 w-4" />
                                </Button>

                                {/* Info Button - Sheet on Mobile, Toggle on Desktop */}
                                <div className="lg:hidden">
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-primary/5 hover:text-primary h-9 w-9">
                                                <Info className="h-4 w-4" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="right" className="w-[85%] sm:w-[400px] p-0 border-l-border">
                                            <div className="h-full flex flex-col">
                                                {/* Reusing lead details content here */}
                                                <div className="p-6 text-center border-b border-border/50 bg-muted/5">
                                                    <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-background shadow-xl">
                                                        <AvatarImage src={selectedLead.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.name)}&background=random&color=fff`} />
                                                        <AvatarFallback className="text-2xl font-bold bg-primary/5 text-primary">
                                                            {selectedLead.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <h2 className="font-bold text-lg mb-1">{selectedLead.name}</h2>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <StatusBadge status={selectedLead.status as any} />
                                                        <ScoreBadge score={selectedLead.score} />
                                                    </div>
                                                </div>
                                                <ScrollArea className="flex-1 p-6">
                                                    <div className="space-y-6">
                                                        <div className="space-y-3">
                                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Atalhos de Contato</h4>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl border-border/50 hover:bg-primary/5 w-full" asChild>
                                                                    <a href={`tel:${selectedLead.phone}`}>
                                                                        <Phone className="h-3.5 w-3.5 text-primary" />
                                                                        Ligar
                                                                    </a>
                                                                </Button>
                                                                <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl border-border/50 hover:bg-primary/5 w-full" asChild>
                                                                    <a href={`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                                                                        <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                                                                        Whats
                                                                    </a>
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Informações do Lead</h4>
                                                            <div className="space-y-3">
                                                                <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border/50">
                                                                    <div className="mt-0.5 p-1.5 rounded-lg bg-primary/10 text-primary">
                                                                        <MapPin className="h-3.5 w-3.5" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Localização</p>
                                                                        <p className="text-xs font-bold">{selectedLead.city}, {selectedLead.state}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border/50">
                                                                    <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                                                                        <Globe className="h-3.5 w-3.5" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Segmento</p>
                                                                        <p className="text-xs font-bold">{selectedLead.segment}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/20 border border-primary/10 space-y-2">
                                                            <p className="text-[10px] font-bold uppercase tracking-wide">Dica de Atendimento</p>
                                                            <p className="text-xs leading-relaxed text-foreground/80">
                                                                Foco na proposta de valor rápida para converter este lead do segmento <strong>{selectedLead.segment}</strong> agora.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hidden md:flex rounded-full text-muted-foreground hover:bg-primary/5 hover:text-primary"
                                    onClick={() => toast.info("Chamada de vídeo", { description: "Em breve: Integração nativa de vídeo ou link direto para Meet." })}
                                >
                                    <Video className="h-4 w-4" />
                                </Button>

                                <div className="hidden lg:flex items-center gap-1">
                                    <Separator orientation="vertical" className="h-6 mx-1" />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn("rounded-full transition-colors", showLeadInfo ? "text-primary bg-primary/10" : "text-muted-foreground")}
                                        onClick={() => setShowLeadInfo(!showLeadInfo)}
                                    >
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground h-9 w-9 md:h-10 md:w-10">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                        <DropdownMenuLabel>Ações do Lead</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => window.open(`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`, '_blank')}>
                                            <ExternalLink className="h-4 w-4 mr-2" /> Abrir no WhatsApp Web
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleArchiveLead(selectedLead.id)}>
                                            <Archive className="h-4 w-4 mr-2" /> Arquivar Conversa
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                                            <Trash className="h-4 w-4 mr-2" /> Bloquear/Excluir
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </header>

                        {/* Messages */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <ScrollArea className="flex-1 px-6 py-6" ref={scrollRef}>
                                <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                                    {loadingMessages ? (
                                        <div className="flex flex-col items-center justify-center p-12 space-y-4">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                                            <p className="text-sm text-muted-foreground">Sincronizando histórico...</p>
                                        </div>
                                    ) : messages?.length === 0 ? (
                                        <div className="text-center p-12 space-y-4">
                                            <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto">
                                                <MessageSquare className="h-8 w-8 text-primary/40" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-semibold">Inicie uma conversa</h3>
                                                <p className="text-xs text-muted-foreground">O lead já foi qualificado. Envie a primeira mensagem personalizada.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        messages?.map((msg, idx) => {
                                            const isOutbound = msg.direction !== 'inbound';
                                            const showDate = idx === 0 || format(new Date(messages[idx - 1].data_envio), 'yyyy-MM-dd') !== format(new Date(msg.data_envio), 'yyyy-MM-dd');

                                            return (
                                                <div key={msg.id} className="w-full">
                                                    {showDate && (
                                                        <div className="flex justify-center my-6">
                                                            <span className="px-3 py-1 rounded-full bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-border/50">
                                                                {format(new Date(msg.data_envio), "EEEE, d 'de' MMMM", { locale: ptBR })}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
                                                        <div className={cn(
                                                            "relative max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm text-sm group transition-transform active:scale-[0.98]",
                                                            isOutbound
                                                                ? "bg-primary text-primary-foreground rounded-tr-none shadow-primary/20"
                                                                : "bg-muted/80 backdrop-blur-sm text-foreground rounded-tl-none border border-border/50"
                                                        )}>
                                                            {/* Bubble Tail */}
                                                            <svg
                                                                className={cn(
                                                                    "absolute top-0 h-4 w-4",
                                                                    isOutbound ? "-right-2 text-primary" : "-left-2 text-muted/80"
                                                                )}
                                                                viewBox="0 0 16 16"
                                                                fill="currentColor"
                                                            >
                                                                {isOutbound ? (
                                                                    <path d="M0 0 L16 0 L8 16 Z" />
                                                                ) : (
                                                                    <path d="M16 0 L0 0 L8 16 Z" />
                                                                )}
                                                            </svg>

                                                            <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>

                                                            <div className={cn(
                                                                "flex items-center gap-1.5 justify-end mt-1.5 opacity-60",
                                                                isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                                                            )}>
                                                                <span className="text-[9px] font-medium">
                                                                    {format(new Date(msg.data_envio), "HH:mm")}
                                                                </span>
                                                                {isOutbound && (
                                                                    <CheckCheck className="h-3.5 w-3.5" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        <footer className="p-4 bg-background/80 backdrop-blur-md border-t border-border/50 z-10 shrink-0">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                                accept="image/*,.pdf,.doc,.docx"
                            />
                            <div className="max-w-4xl mx-auto flex items-center gap-3 px-2">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 hover:text-primary">
                                                <Smile className="h-5 w-5" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent side="top" className="w-64 p-2 bg-background border-border/50 shadow-xl">
                                            <div className="grid grid-cols-6 gap-1">
                                                {commonEmojis.map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => handleEmojiClick(emoji)}
                                                        className="h-9 w-9 flex items-center justify-center hover:bg-primary/10 rounded-lg transition-colors text-xl"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 hover:text-primary">
                                                <Paperclip className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent side="top" align="start" className="w-48">
                                            <DropdownMenuItem onClick={handleFileClick}>
                                                <ImageIcon className="h-4 w-4 mr-2" /> Imagem ou Vídeo
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleFileClick}>
                                                <FileText className="h-4 w-4 mr-2" /> Documento (PDF)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem disabled>
                                                <Volume2 className="h-4 w-4 mr-2" /> Áudio (Em breve)
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex-1 relative">
                                    <textarea
                                        placeholder="Digite sua mensagem aqui..."
                                        className="w-full bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-2xl px-4 py-3 text-sm min-h-[44px] max-h-32 resize-none custom-scrollbar transition-all flex items-center"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        rows={1}
                                    />
                                </div>

                                <Button
                                    className={cn(
                                        "rounded-full h-11 w-11 p-0 shadow-lg shadow-primary/20 transition-all shrink-0 flex items-center justify-center",
                                        !newMessage.trim() || isSending ? "opacity-50" : "hover:scale-110 active:scale-95"
                                    )}
                                    disabled={!newMessage.trim() || isSending}
                                    onClick={handleSendMessage}
                                >
                                    {isSending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Send className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                        </footer>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-fade-in">
                        <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center relative">
                            <div className="absolute inset-0 border-2 border-primary/20 border-dashed rounded-full animate-spin-slow" />
                            <MessageSquare className="h-10 w-10 text-primary animate-pulse" />
                        </div>
                        <div className="text-center space-y-2 max-w-sm">
                            <h2 className="text-2xl font-bold">Inicie sua Prospecção</h2>
                            <p className="text-muted-foreground text-sm">Selecione uma conversa ao lado para visualizar o histórico de mensagens e continuar o atendimento.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Sidebar - Lead Details */}
            {selectedLead && showLeadInfo && (
                <div className="hidden lg:flex w-[320px] flex-col border-l border-border bg-muted/5 animate-in slide-in-from-right duration-300">
                    <header className="p-6 text-center">
                        <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-background shadow-xl scale-110">
                            <AvatarImage src={selectedLead.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.name)}&background=random&color=fff`} />
                            <AvatarFallback className="text-2xl font-bold bg-primary/5 text-primary">
                                {selectedLead.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <h2 className="font-bold text-lg mb-1">{selectedLead.name}</h2>
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <StatusBadge status={selectedLead.status as any} />
                            <ScoreBadge score={selectedLead.score} />
                        </div>
                    </header>

                    <ScrollArea className="flex-1 px-6 pb-6">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Atalhos de Contato</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl border-border/50 hover:bg-primary/5" asChild>
                                        <a href={`tel:${selectedLead.phone}`}>
                                            <Phone className="h-3.5 w-3.5 text-primary" />
                                            Ligar
                                        </a>
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl border-border/50 hover:bg-primary/5" asChild>
                                        <a href={`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                                            <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                                            Whats
                                        </a>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Informações do Lead</h4>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border/50">
                                        <div className="mt-0.5 p-1.5 rounded-lg bg-primary/10 text-primary">
                                            <MapPin className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Localização</p>
                                            <p className="text-xs font-bold">{selectedLead.city}, {selectedLead.state}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border/50">
                                        <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                                            <Globe className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Segmento</p>
                                            <p className="text-xs font-bold">{selectedLead.segment}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border/50">
                                        <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                                            <Star className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Qualificação</p>
                                            <p className="text-xs font-bold">{selectedLead.score >= 60 ? "Hot Lead" : "Lead em Aquecimento"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/20 border border-primary/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-primary rounded-full" />
                                    <p className="text-[10px] font-bold uppercase tracking-wide">Dica de Atendimento</p>
                                </div>
                                <p className="text-xs leading-relaxed text-foreground/80">
                                    Este lead demonstrou interesse em <strong>{selectedLead.segment}</strong>.
                                    Foco na proposta de valor rápida para converter agora.
                                </p>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
    );
}
