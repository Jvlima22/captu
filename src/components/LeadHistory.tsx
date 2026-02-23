import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, CheckCircle2, Clock, Maximize2, Copy, Check, CheckCheck, Smile, Paperclip, Send, Search, MoreVertical } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/config";

interface HistoryItem {
    id: string;
    type: string;
    message: string;
    status: string;
    direction?: 'inbound' | 'outbound';
    data_envio: string;
}

export function LeadHistory({ leadId, phone }: { leadId: string, phone?: string }) {
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const { data: history, isLoading } = useQuery({
        queryKey: ["history", leadId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("contact_history")
                .select("*")
                .eq("company_id", leadId)
                .order("data_envio", { ascending: true });

            if (error) throw error;
            return data as HistoryItem[];
        },
        enabled: !!leadId,
    });

    // Configuração do Real-time do Supabase
    useEffect(() => {
        if (!leadId) return;

        // Criar canal de escuta para este lead específico
        const channel = supabase
            .channel(`chat-lead-${leadId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'contact_history',
                    filter: `company_id=eq.${leadId}`
                },
                () => {
                    // Quando houver uma nova mensagem, invalidamos a query para atualizar a lista
                    queryClient.invalidateQueries({ queryKey: ["history", leadId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [leadId, queryClient]);

    // Scroll to bottom when history changes or first load
    useEffect(() => {
        if (history) {
            setTimeout(scrollToBottom, 100);
        }
    }, [history]);

    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !phone || isSending) return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_URL}/api/chat/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadId,
                    phone,
                    message: newMessage.trim()
                }),
            });

            if (!response.ok) throw new Error("Erro ao enviar mensagem");

            setNewMessage("");
            queryClient.invalidateQueries({ queryKey: ["history", leadId] });
            toast.success("Mensagem enviada!");
        } catch (error: any) {
            toast.error("Erro ao enviar", { description: error.message });
        } finally {
            setIsSending(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Mensagem copiada para a área de transferência!");
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
    }

    if (!history || history.length === 0) {
        return (
            <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-border">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Nenhum contato registrado ainda.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Inicie uma automação para ver o histórico.</p>
            </div>
        );
    }

    return (
        <>
            <div
                ref={scrollRef}
                className="space-y-2 flex-1 h-full overflow-y-auto pr-2 custom-scrollbar flex flex-col bg-[#efeae2] dark:bg-[#0b141a]/95 p-4 rounded-xl border border-black/5 dark:border-white/5 relative scroll-smooth"
            >
                {/* Background Pattern Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat" />

                {history.map((item, index) => {
                    const isOutbound = item.direction !== 'inbound';
                    const showDate = index === 0 || new Date(history[index - 1].data_envio).toLocaleDateString() !== new Date(item.data_envio).toLocaleDateString();

                    return (
                        <div key={item.id} className="relative z-10">
                            {showDate && (
                                <div className="flex justify-center my-4 mb-6">
                                    <span className="bg-white/80 dark:bg-[#182229] text-[#667781] dark:text-[#8696a0] text-[11px] px-3 py-1 rounded-lg shadow-sm font-medium uppercase tracking-wide border border-black/5 dark:border-white/5">
                                        {new Date(item.data_envio).toLocaleDateString() === new Date().toLocaleDateString() ? 'Hoje' : new Date(item.data_envio).toLocaleDateString()}
                                    </span>
                                </div>
                            )}

                            <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} w-full mb-1`}>
                                <div
                                    className={`
                                        relative max-w-[85%] px-2.5 py-1.5 rounded-xl shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-all group cursor-pointer
                                        ${isOutbound
                                            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none'
                                            : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none'
                                        }
                                    `}
                                    onClick={() => navigate(`/chat?leadId=${leadId}`)}
                                >
                                    {/* Triangle Tail */}
                                    <div className={`
                                        absolute top-0 h-0 w-0
                                        ${isOutbound
                                            ? '-right-[8px] border-l-[10px] border-l-[#d9fdd3] dark:border-l-[#005c4b] border-b-[10px] border-b-transparent'
                                            : '-left-[8px] border-r-[10px] border-r-white dark:border-r-[#202c33] border-b-[10px] border-b-transparent'
                                        }
                                    `} />

                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words pr-12">
                                            {item.message}
                                        </div>

                                        <div className="flex items-center gap-1 self-end -mt-2 -mr-1">
                                            <span className="text-[10px] text-black/50 dark:text-white/60 font-normal">
                                                {new Date(item.data_envio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {isOutbound && item.status === 'sent' && (
                                                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                                            )}
                                            <Maximize2 className="h-3 w-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

        </>
    );
}
