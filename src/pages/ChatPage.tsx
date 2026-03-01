import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Search,
    CheckCheck,
    Smile,
    Paperclip,
    Send,
    Loader2,
    MessageSquare,
    Filter,
    MapPin,
    Globe,
    Star,
    Archive,
    Trash,
    ChevronLeft,
    ExternalLink,
    Image as ImageIcon,
    FileText,
    QrCode,
    LogOut,
    Users,
    Pin
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
    SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { API_URL } from "@/config";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { io } from "socket.io-client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// ─── Interfaces de Tipagem Baseadas no Proxy ────────────────────────────────

interface ProxyContact {
    id: string; // JID
    name?: string;
    pushName?: string;
    imgUrl?: string;
}

interface ProxyMessage {
    id: string; // Message ID
    text: string;
    direction: 'inbound' | 'outbound';
    timestamp: number;
    status: string; // sent, delivered, read (opcional)
    sender?: string; // JID de quem enviou (útil para grupos)
}

interface ProxyChat {
    id: string; // JID
    name?: string; // Nome derivado (contato > pushName > JID)
    lastMessage?: string;
    lastMessageSender?: string; // PushName de quem mandou a última msgs no grupo
    lastMessageTime?: number;
    pinned?: number; // Timestamp se for fixado
    unreadCount: number;
    type: 'individual' | 'group' | 'community';
}

// ─── Funções Auxiliares ─────────────────────────────────────────────────────

function extractTextFromWhatsAppMessage(msg: any): string {
    if (!msg.message) return "";
    return msg.message?.conversation ||
           msg.message?.extendedTextMessage?.text ||
           msg.message?.imageMessage?.caption ||
           msg.message?.videoMessage?.caption ||
           (msg.message?.buttonsResponseMessage ? `Botão: ${msg.message.buttonsResponseMessage.selectedDisplayText}` : '') ||
           (msg.message?.imageMessage ? '[Imagem]' : 
            msg.message?.videoMessage ? '[Vídeo]' : 
            msg.message?.audioMessage ? '[Áudio]' : 
            msg.message?.documentMessage ? '[Documento]' : 
            msg.message?.contactMessage ? '[Contato]' : 
            msg.message?.locationMessage ? '[Localização]' : 
            msg.message?.stickerMessage ? '[Figurinha]' : 
            msg.message?.reactionMessage ? '[Reação]' : 
            msg.message?.pollCreationMessage ? '[Enquete]' : 
            msg.message?.protocolMessage ? '[Mensagem de Sistema]' : '');
}

export default function ChatPage() {
    const [searchParams] = useSearchParams();
    const [selectedJid, setSelectedJid] = useState<string | null>(searchParams.get("leadId"));
    
    // Estados do Proxy (In-Memory Database)
    const [chats, setChats] = useState<Record<string, ProxyChat>>({});
    const [messagesByChat, setMessagesByChat] = useState<Record<string, ProxyMessage[]>>({});
    const [contacts, setContacts] = useState<Record<string, ProxyContact>>({});

    const [searchQuery, setSearchQuery] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showLeadInfo, setShowLeadInfo] = useState(true);
    
    // Status do Motor WhatsApp
    const [waStatus, setWaStatus] = useState<string>("close");
    const [waQr, setWaQr] = useState<string | null>(null);
    const [isPaired, setIsPaired] = useState<boolean>(false);
    const [isWaModalOpen, setIsWaModalOpen] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(true);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (waStatus === 'open') {
            timeout = setTimeout(() => setIsSyncing(false), 8000);
        } else {
            setIsSyncing(true);
        }
        return () => clearTimeout(timeout);
    }, [waStatus]);

    // ─── Conexão Socket.IO ──────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(API_URL);
        
        // Cache local temporário para a sessão garantir o mapeamento
        const localLidMap: Record<string, string> = {};

        // 1. Atualizações de Conexão
        socket.on('whatsapp-connection-update', ({ connection, qr, isPaired }) => {
            setWaStatus(connection);
            setWaQr(qr);
            setIsPaired(!!isPaired);

            if (connection === 'close') {
                // ESTRATÉGIA PROXY: Limpa TODOS os estados em memória ao desconectar!
                // Assim as mensagens da conta anterior não vazam para a próxima.
                setChats({});
                setMessagesByChat({});
                setContacts({});
                setSelectedJid(null);
                setIsSyncing(true);
                // Limpar cache local do LID Map
                for (const key in localLidMap) delete localLidMap[key];
            }
        });

        // 2. Histórico Inicial (Sincronização Web)
        socket.on('whatsapp-history', ({ chats: rawChats, messages: rawMessages, contacts: rawContacts }) => {
            // Processa Contatos e cria o Mapeamento LID -> JID
            const contactsMap: Record<string, ProxyContact> = {};
            if (rawContacts) {
                rawContacts.forEach((c: any) => {
                    const id = c.id;
                    const name = c.name || c.notify || c.verifiedName || id.split('@')[0];
                    contactsMap[id] = { id, name, pushName: c.notify };
                    
                    if (c.lid) {
                        localLidMap[c.lid] = id;
                        contactsMap[c.lid] = { id, name, pushName: c.notify };
                    }
                });
            }
            setContacts(prev => ({ ...prev, ...contactsMap }));

            // Processa Mensagens
            const messagesMap: Record<string, ProxyMessage[]> = {};
            if (rawMessages) {
                rawMessages.forEach((msg: any) => {
                    if (!msg.key || !msg.key.remoteJid) return;
                    let jid = msg.key.remoteJid;
                    jid = localLidMap[jid] || jid; // Resolve LID para JID se aplicável

                    const text = extractTextFromWhatsAppMessage(msg);
                    if (!text) return;

                    const proxyMsg: ProxyMessage = {
                        id: msg.key.id,
                        text: text,
                        direction: msg.key.fromMe ? 'outbound' : 'inbound',
                        timestamp: msg.messageTimestamp ? (typeof msg.messageTimestamp === 'object' ? Number(msg.messageTimestamp.low || 0) * 1000 : Number(msg.messageTimestamp) * 1000) : Date.now(),
                        status: 'delivered',
                        sender: msg.key.participant || jid
                    };

                    if (!messagesMap[jid]) messagesMap[jid] = [];
                    messagesMap[jid].push(proxyMsg);
                });
                
                // Ordena histórico
                Object.keys(messagesMap).forEach(jid => {
                    messagesMap[jid].sort((a,b) => a.timestamp - b.timestamp);
                });
            }
            setMessagesByChat(prev => ({ ...prev, ...messagesMap }));

            // Processa Chats
            const chatsMap: Record<string, ProxyChat> = {};
            if (rawChats) {
                rawChats.forEach((chat: any) => {
                    let jid = chat.id;
                    jid = localLidMap[jid] || jid; // Resolve LID para JID se aplicável
                    
                    const type = jid.endsWith('@g.us') ? 'group' : jid.endsWith('@newsletter') ? 'community' : 'individual';
                    const contactName = contactsMap[jid]?.name || chat.name || chat.verifiedName || jid.split('@')[0];
                    
                    const jidMsgs = messagesMap[jid];
                    const lastMsgObj = jidMsgs && jidMsgs.length > 0 ? jidMsgs[jidMsgs.length - 1] : null;
                    const lastText = lastMsgObj ? lastMsgObj.text : '';
                    
                    let lastMessageSender = '';
                    if (type === 'group' && lastMsgObj && lastMsgObj.direction === 'inbound' && lastMsgObj.sender) {
                        const senderContact = contactsMap[lastMsgObj.sender];
                        lastMessageSender = senderContact?.pushName || senderContact?.name || lastMsgObj.sender.split('@')[0];
                    }

                    const lastTime = chat.conversationTimestamp ? 
                        (typeof chat.conversationTimestamp === 'object' ? Number(chat.conversationTimestamp.low || 0) * 1000 : Number(chat.conversationTimestamp) * 1000) : 
                        (lastMsgObj ? lastMsgObj.timestamp : 0);
                    
                    chatsMap[jid] = {
                        id: jid,
                        name: contactName,
                        lastMessage: lastText,
                        lastMessageSender: lastMessageSender,
                        lastMessageTime: lastTime,
                        pinned: chat.pinned ? Number(chat.pinned) : 0,
                        unreadCount: chat.unreadCount || 0,
                        type: type as any
                    };
                });
            }
            setChats(prev => ({ ...prev, ...chatsMap }));
            
            setIsSyncing(false); // Recebeu a carga, encerra o loading!
        });

        // 3. Atualização de Contatos Dinâmicos
        socket.on('whatsapp-contacts-upsert', (newContacts: any[]) => {
            const updates: Record<string, ProxyContact> = {};
            newContacts.forEach(c => {
                const id = c.id;
                const name = c.name || c.notify;
                updates[id] = { id, name, pushName: c.notify };
                if (c.lid) {
                    localLidMap[c.lid] = id;
                    updates[c.lid] = { id, name, pushName: c.notify };
                }
            });
            setContacts(prev => ({ ...prev, ...updates }));
        });

        // 4. Nova Mensagem em Tempo Real (Pass-through do Servidor)
        socket.on('whatsapp-message', (msg: any) => {
            if (!msg.key || !msg.key.remoteJid) return;
            let jid = msg.key.remoteJid;
            jid = localLidMap[jid] || jid; // Resolve LID para JID se aplicável
            
            const text = extractTextFromWhatsAppMessage(msg);
            if (!text) return;

            const isOutbound = msg.key.fromMe;
            const timestamp = msg.messageTimestamp ? (typeof msg.messageTimestamp === 'object' ? Number(msg.messageTimestamp.low || 0) * 1000 : Number(msg.messageTimestamp) * 1000) : Date.now();
            
            const proxyMsg: ProxyMessage = {
                id: msg.key.id,
                text: text,
                direction: isOutbound ? 'outbound' : 'inbound',
                timestamp: timestamp,
                status: 'delivered',
                sender: msg.key.participant || jid
            };

            // Adiciona a mensagem à lista da conversa
            setMessagesByChat(prev => {
                const current = prev[jid] || [];
                // Evita duplicatas se o ID já existir
                if (current.find(m => m.id === proxyMsg.id)) return prev;
                return { ...prev, [jid]: [...current, proxyMsg] };
            });

            // Promove o Chat para o topo e atualiza a última mensagem
            setChats(prev => {
                const existing = prev[jid];
                const type = jid.endsWith('@g.us') ? 'group' : 'individual';
                
                let lastMessageSender = '';
                if (type === 'group' && !isOutbound && (msg.key.participant || jid)) {
                    const senderJid = msg.key.participant || jid;
                    const senderContact = contacts[senderJid];
                    lastMessageSender = senderContact?.pushName || senderContact?.name || senderJid.split('@')[0];
                }

                return {
                    ...prev,
                    [jid]: {
                        id: jid,
                        name: existing?.name || msg.pushName || jid.split('@')[0],
                        lastMessage: text,
                        lastMessageSender: lastMessageSender || existing?.lastMessageSender,
                        lastMessageTime: timestamp,
                        pinned: existing?.pinned || 0,
                        unreadCount: isOutbound ? 0 : ((existing?.unreadCount || 0) + 1),
                        type: existing?.type || type as any
                    }
                };
            });
            
            // Registra contato temporário se não existir (para pegar o PushName)
            if (msg.pushName) {
                setContacts(prev => {
                    if (prev[jid]?.name) return prev;
                    return { ...prev, [jid]: { id: jid, name: msg.pushName, pushName: msg.pushName } };
                });
            }
        });

        return () => { socket.disconnect(); };
    }, []);

    // Busca foto do perfil sob demanda (Lazy Loading)
    useEffect(() => {
        const fetchProfiles = async () => {
            const neededJids = Object.keys(chats).filter(jid => !contacts[jid]?.imgUrl);
            // Pegue apenas os primeiros visíveis ou de quem você clicou para não sobrecarregar
            // Por simplicidade, faremos isso no on-click ou para todos
            if (selectedJid && chats[selectedJid] && !contacts[selectedJid]?.imgUrl) {
                try {
                    const res = await fetch(`${API_URL}/api/chat/profile-pic/${selectedJid}`);
                    if (res.ok) {
                        const { url } = await res.json();
                        setContacts(prev => ({
                            ...prev,
                            [selectedJid]: { ...prev[selectedJid], id: selectedJid, imgUrl: url }
                        }));
                    }
                } catch (e) {}
            }
        };
        fetchProfiles();
    }, [selectedJid, chats]);

    // ─── Efeitos de UI ────────────────────────────────────────────────────────

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messagesByChat, selectedJid]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedJid || isSending || waStatus !== 'open') return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_URL}/api/chat/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadId: "proxy-bypass", // Ignorado no backend proxy
                    phone: selectedJid,
                    message: newMessage.trim()
                }),
            });

            if (!response.ok) throw new Error("Erro ao enviar mensagem");

            // A mensagem será recebida via socket localmente também (echo) se fromMe estiver habilitado no baileys
            setNewMessage("");
            
            // Adicionamos otimisticamente caso o echo falhe
            const proxyMsg: ProxyMessage = {
                id: `opt_${Date.now()}`,
                text: newMessage.trim(),
                direction: 'outbound',
                timestamp: Date.now(),
                status: 'sent'
            };
            
            setMessagesByChat(prev => ({
                ...prev,
                [selectedJid]: [...(prev[selectedJid] || []), proxyMsg]
            }));

        } catch (error: any) {
            toast.error("Erro ao enviar", { description: error.message });
        } finally {
            setIsSending(false);
        }
    };

    const handleDisconnect = async () => {
        setIsDisconnecting(true);
        try {
            const response = await fetch(`${API_URL}/api/chat/disconnect`, { method: "POST" });
            if (!response.ok) throw new Error("Erro ao desconectar");
            toast.success("Sessão do WhatsApp encerrada e tela limpa!");
        } catch (error: any) {
            toast.error("Erro ao desconectar", { description: error.message });
        } finally {
            setIsDisconnecting(false);
        }
    };

    // ─── Renderização Baseada nos Estados Proxy ─────────────────────────────

    // Ordenar Chats do mais recente para o mais antigo, com fixados no topo e filtrar inválidos
    const sortedChats = useMemo(() => {
        return Object.values(chats)
            .filter(c => {
                // Remove chats sem mensagens reais (time 0 e não fixado vazios)
                if (!c.lastMessageTime && !c.pinned) return false;
                
                // Filtro de Busca Local em RAM
                const contact = contacts[c.id];
                const displayName = contact?.name || contact?.pushName || c.name || c.id;
                return displayName.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.includes(searchQuery);
            })
            .sort((a, b) => {
                // Chats Fixados (Pinned) vem primeiro na ordem do Timestamp
                const pinnedA = a.pinned || 0;
                const pinnedB = b.pinned || 0;
                
                if (pinnedA > 0 || pinnedB > 0) {
                    if (pinnedA !== pinnedB) return pinnedB - pinnedA;
                }
                
                // Secundário: Ordena por última mensagem
                return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
            });
    }, [chats, contacts, searchQuery]);

    const selectedChat = selectedJid ? chats[selectedJid] : null;
    const currentMessages = selectedJid ? (messagesByChat[selectedJid] || []) : [];
    const currentContactInfo = selectedJid ? contacts[selectedJid] : null;
    
    // Nome do chat selecionado
    const displaySelectedName = currentContactInfo?.name || currentContactInfo?.pushName || selectedChat?.name || selectedJid?.split('@')[0] || 'Desconhecido';

    const commonEmojis = ["😊", "👍", "🤝", "🚀", "💡", "📅", "✅", "📍", "💰", "🙏", "📞", "👋"];

    return (
        <div className={cn("flex overflow-hidden bg-card transition-all w-full flex-1 h-full")}>
            
            {/* Sidebar Esquerda - Lista de Conversas (Em RAM) */}
            <div className={cn(
                "w-full md:w-[350px] lg:w-[400px] flex flex-col border-r border-border bg-muted/10 shrink-0",
                selectedJid ? "hidden md:flex" : "flex"
            )}>
                <div className="p-4 space-y-4 bg-background/50 backdrop-blur-sm border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-emerald-500" />
                            Conversas 
                        </h1>
                        <div className="flex items-center gap-1">
                            {/* Gatilho do QR Code */}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("rounded-full", waStatus !== 'open' ? "text-amber-500 bg-amber-500/10 animate-pulse" : "text-emerald-500 bg-emerald-500/10")}
                                onClick={() => setIsWaModalOpen(true)}
                            >
                                <QrCode className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar contatos ou números..."
                            className="pl-10 bg-background/50 border-border/50 focus:ring-emerald-500/20 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="divide-y divide-border/30">
                        {waStatus !== 'open' ? (
                            <div className="p-8 text-center space-y-4">
                                <p className="text-sm text-muted-foreground">Conecte seu WhatsApp para carregar suas conversas do celular.</p>
                                <Button variant="outline" onClick={() => setIsWaModalOpen(true)}>Vincular Agora</Button>
                            </div>
                        ) : sortedChats.length === 0 && isSyncing ? (
                            <div className="p-8 text-center space-y-4">
                                <Loader2 className="h-10 w-10 mx-auto animate-spin text-emerald-500/50" />
                                <p className="text-sm font-semibold text-emerald-600/80">Obtendo banco de mensagens...</p>
                                <p className="text-xs text-muted-foreground mx-auto">Isso leva apenas alguns instantes.</p>
                            </div>
                        ) : sortedChats.length === 0 && !isSyncing ? (
                            <div className="p-8 text-center space-y-2">
                                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30" />
                                <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada recentemente.</p>
                            </div>
                        ) : (
                            sortedChats.map((chat) => {
                                const contact = contacts[chat.id];
                                const displayName = contact?.name || contact?.pushName || chat.name || chat.id.split('@')[0];
                                
                                return (
                                    <div
                                        key={chat.id}
                                        onClick={() => setSelectedJid(chat.id)}
                                        className={cn(
                                            "p-4 flex gap-4 cursor-pointer transition-all hover:bg-emerald-500/5 relative group",
                                            selectedJid === chat.id ? "bg-emerald-500/10" : ""
                                        )}
                                    >
                                        {selectedJid === chat.id && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                                        )}

                                        <div className="relative">
                                            <Avatar className="h-12 w-12 border border-border/50 shadow-sm">
                                                <AvatarImage src={contact?.imgUrl} />
                                                <AvatarFallback className="bg-emerald-500/10 text-emerald-600 font-bold">
                                                    {chat.type === 'group' ? <Users className="h-5 w-5" /> : displayName.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {chat.unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white border-2 border-background">
                                                    {chat.unreadCount}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h3 className="font-semibold text-sm truncate">{displayName}</h3>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {chat.lastMessageTime ? format(new Date(chat.lastMessageTime), "HH:mm") : ""}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-4 uppercase tracking-widest", 
                                                    chat.type === 'group' ? "border-indigo-500/30 text-indigo-500" :
                                                    chat.type === 'community' ? "border-amber-500/30 text-amber-500" :
                                                    "border-muted")}>
                                                    {chat.type === 'group' ? 'Grupo' : chat.type === 'community' ? 'Comunidade' : 'Contato'}
                                                </Badge>
                                            </div>

                                            <p className="text-xs text-muted-foreground truncate line-clamp-1">
                                                {chat.lastMessage || "Toque para ver..."}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Painel Central - Área de Chat */}
            <div className={cn(
                "flex-1 flex flex-col min-w-0 bg-background relative chat-pattern",
                !selectedJid ? "hidden md:flex" : "flex"
            )}>
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://whatsapp.com/favicon.ico')] bg-repeat opacity-5" />

                {selectedJid ? (
                    <>
                        {/* Chat Header */}
                        <header className="px-4 md:px-6 py-3 flex items-center justify-between bg-muted/30 backdrop-blur-md border-b border-border/50 z-10 shrink-0">
                            <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden -ml-2 rounded-full h-8 w-8"
                                    onClick={() => setSelectedJid(null)}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Avatar className="h-9 w-9 md:h-10 md:w-10 border border-border shrink-0">
                                    <AvatarImage src={currentContactInfo?.imgUrl} />
                                    <AvatarFallback className="bg-emerald-500/10 text-emerald-600 font-bold">
                                        {selectedChat?.type === 'group' ? <Users className="h-4 w-4" /> : displaySelectedName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="font-bold text-sm leading-tight">{displaySelectedName}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                                            {selectedJid.split('@')[0]}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </header>

                        {/* Messages List em RAM */}
                        <div className="flex-1 overflow-hidden flex flex-col pt-4">
                            <ScrollArea className="flex-1 px-4 md:px-6 pb-6" ref={scrollRef}>
                                <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                                    {currentMessages.length === 0 ? (
                                        <div className="text-center p-12 space-y-4">
                                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                                                <MessageSquare className="h-8 w-8 text-emerald-500/60" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-semibold">Chat Protegido (Proxy Mode)</h3>
                                                <p className="text-xs text-muted-foreground">O histórico detalhado deste contato está carregando em memória ou precisa de novas mensagens.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        currentMessages.map((msg, idx) => {
                                            const isOutbound = msg.direction === 'outbound';
                                            const showDate = idx === 0 || format(new Date(currentMessages[idx - 1].timestamp), 'yyyy-MM-dd') !== format(new Date(msg.timestamp), 'yyyy-MM-dd');

                                            return (
                                                <div key={msg.id} className="w-full flex flex-col">
                                                    {showDate && (
                                                        <div className="flex justify-center my-4">
                                                            <span className="px-3 py-1 rounded-full bg-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-widest shadow-sm">
                                                                {format(new Date(msg.timestamp), "d 'de' MMMM", { locale: ptBR })}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
                                                        <div className={cn(
                                                            "relative max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-[14px] text-sm group",
                                                            isOutbound
                                                                ? "bg-[#005c4b] text-white rounded-tr-sm shadow-sm"
                                                                : "bg-[#202c33] text-white rounded-tl-sm shadow-sm"
                                                        )}>
                                                            <p className="leading-relaxed whitespace-pre-wrap pr-12">{msg.text}</p>

                                                            <div className={cn(
                                                                "absolute bottom-1 right-2 flex items-center gap-1 opacity-70",
                                                                isOutbound ? "text-white" : "text-white/70"
                                                            )}>
                                                                <span className="text-[9px] font-medium leading-none mt-1">
                                                                    {format(new Date(msg.timestamp), "HH:mm")}
                                                                </span>
                                                                {isOutbound && (
                                                                    <CheckCheck className="h-[14px] w-[14px]" />
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

                        {/* Message Input Box */}
                        <footer className="p-3 md:p-4 bg-muted/40 backdrop-blur-md border-t border-border/50 z-10 shrink-0">
                            <div className="max-w-4xl mx-auto flex items-center gap-2 px-1">
                                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-border/50">
                                    <Smile className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-border/50">
                                    <Paperclip className="h-5 w-5" />
                                </Button>

                                <div className="flex-1 relative">
                                    <textarea
                                        placeholder="Digite uma mensagem..."
                                        className="w-full bg-background border border-border/60 focus-visible:ring-1 focus-visible:ring-emerald-500/50 rounded-2xl px-4 py-[10px] text-sm min-h-[44px] max-h-32 resize-none transition-all flex items-center shadow-sm"
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
                                        "rounded-full h-11 w-11 p-0 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shrink-0 flex items-center justify-center",
                                        !newMessage.trim() || isSending ? "opacity-50" : "hover:scale-105 active:scale-95"
                                    )}
                                    disabled={!newMessage.trim() || isSending || waStatus !== 'open'}
                                    onClick={handleSendMessage}
                                >
                                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-[18px] w-[18px] ml-1" />}
                                </Button>
                            </div>
                        </footer>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-fade-in bg-muted/10">
                        <div className="w-48 h-48 mx-auto flex flex-col items-center justify-center opacity-80 gap-6">
                            <img src="https://cdn-icons-png.flaticon.com/512/3670/3670051.png" alt="WhatsApp Web Logo" className="w-24 h-24 filter drop-shadow-lg opacity-70 saturate-0" />
                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-light text-muted-foreground">WhatsApp Proxy</h2>
                                <p className="text-muted-foreground/60 text-xs px-8">Suas mensagens agora são renderizadas diretamente do aparelho, sem guardar no banco de dados.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Conexão (Inalterado/Minimalista) */}
            <Dialog open={isWaModalOpen} onOpenChange={setIsWaModalOpen}>
                <DialogContent className="sm:max-w-md border-border/50 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-center font-black text-2xl tracking-tight">Vincular dispositivo</DialogTitle>
                        <DialogDescription className="text-center text-muted-foreground">
                            Escaneie o QR Code abaixo para exibir suas conversas na memória. Nenhuma mensagem será salva.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-6 space-y-6">
                        {waStatus === 'open' ? (
                            <div className="w-full space-y-6 animate-in fade-in">
                                <div className="w-48 h-48 mx-auto flex items-center justify-center bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                    <CheckCheck className="w-16 h-16 text-emerald-500" />
                                </div>
                                <div className="text-center">
                                    <Badge className="bg-emerald-500/10 text-emerald-600 mb-4 border-emerald-500/20">Sincronizado com sucesso</Badge>
                                    <Button 
                                        variant="destructive" 
                                        className="w-full font-bold gap-2"
                                        onClick={handleDisconnect}
                                        disabled={isDisconnecting}
                                    >
                                        {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                        Sair e Desconectar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full space-y-6">
                                {waQr ? (
                                    <div className="p-4 bg-white rounded-2xl mx-auto w-fit">
                                        <img src={waQr} alt="QR Code" className="w-56 h-56" />
                                    </div>
                                ) : (
                                    <div className="w-56 h-56 mx-auto flex items-center justify-center bg-muted rounded-2xl">
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                                <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                                    {waStatus === 'connecting' ? 'Iniciando Bridge' : 'Aguardando Leitura'}
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
