import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Trash2, Download, Plus, MessageSquare, PanelLeft, PanelLeftClose, Search, Brain, Share2, Globe, Terminal } from 'lucide-react';
import { AgentContextManager } from '@/components/agent/AgentContextManager';
import { TerminalPanel } from '@/components/agent/TerminalPanel';
import { Button } from '@/components/ui/button';
import { MessageBubble, Message } from '@/components/agent/MessageBubble';
import { ChatInput, ChatInputHandle } from '@/components/agent/ChatInput';
import { AgentPendingChanges } from '@/components/agent/AgentPendingChanges';
import { AIModelSelector, AI_MODELS_CONFIG, AIModel } from '@/components/agent/AIModelSelector';
import { API_URL, isLocalhost } from '@/config';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const WELCOME_SUGGESTIONS = [
  '📋 Criar script de prospecção B2B',
  '📊 Analisar métricas de conversão',
  '📧 Escrever e-mail de cold outreach',
  '🎯 Qualificar leads do meu pipeline',
  '🔄 Sequência de follow-up automática',
  '📈 Estratégia para aumentar reply rate',
];

interface ChatSession {
  id: string;
  title: string;
  created_at: Date;
}

const isComplexPrompt = (prompt: string): boolean => {
  const complexKeywords = [
    'pesquis', 'analis', 'cri', 'script', 'lead', 'empresa', 'cnpj', 
    'linkedin', 'google', 'estratég', 'relatór', 'busqu',
    'prospec', 'campanh', 'automac', 'encontr', 'verific'
  ];
  const lowerPrompt = prompt.toLowerCase();
  const hasKeyword = complexKeywords.some(keyword => lowerPrompt.includes(keyword));
  return prompt.length > 25 || hasKeyword;
};

export default function AgentPage() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS_CONFIG[0]);
  const [userSession, setUserSession] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const { toast } = useToast();
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      
      // Remove loading messages if any
      setMessages(prev => prev.filter(m => m.id !== 'loading' && m.id !== 'streaming-res'));
      
      toast({
        title: "Geração interrompida",
        description: "A IA parou de processar sua solicitação.",
      });
    }
  }, [toast]);

  // Keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load User session and History of Chats
  useEffect(() => {
    const fetchSessionAndChats = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserSession(session);
      
      if (session?.user?.id) {
        try {
          const { data, error } = await supabase
            .from('agent_chats')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
          
          if (!error && data) {
            setChats(data.map(c => ({
              id: c.id,
              title: c.title,
              created_at: new Date(c.created_at)
            })));
          }
        } catch (err) {
          console.error("No table found or error fetching history", err);
        }
      }
    };
    fetchSessionAndChats();
  }, []);

  // Update ref to avoid stale closures in fetch effect
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Fetch messages when activeChatId changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    // Se estivermos no meio de um chat recém-criado pelo usuário, 
    // a bolhinha de "Loading" já está na array e não queremos 
    // que o banco puxe o estado vazio apagando a animação da IA pensando.
    if (messagesRef.current.some(m => m.isLoading)) {
      return;
    }

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('agent_messages')
          .select('*')
          .eq('chat_id', activeChatId)
          .order('created_at', { ascending: true });
        
        if (!error && data) {
          setMessages(data.map(msg => ({
            id: msg.id,
            localId: msg.id, // Para mensagens vindas do banco, localId = id
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            rating: msg.rating // Carregar a curtida do banco
          })));
        }
      } catch (err) {
        console.error("Error loading chat messages", err);
      }
    };
    fetchMessages();
  }, [activeChatId]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string, file?: { name: string; content: string }, overrideEditingId?: string) => {
    if (!text.trim() && !file) return;

    setIsLoading(true);
    let currentChatId = activeChatId;
    const userContent = file ? `${text}\n\n[Arquivo: ${file.name}]` : text;

    let updatedHistory: Message[] = [];

    const effectiveEditId = overrideEditingId || editingMessageId;

    // 1. Lógica de Mensagem de Usuário (Nova ou Editada)
    if (effectiveEditId) {
      // Fluxo de EDIÇÃO ou REENVIO (Sobrescreve no mesmo ID)
      const editIndex = messages.findIndex(m => m.id === effectiveEditId);
      if (editIndex === -1) {
        setIsLoading(false);
        setEditingMessageId(null);
        return;
      }

      const updatedUserMessage: Message = {
        ...messages[editIndex],
        content: userContent,
        timestamp: new Date()
      };

      // Removemos tudo que veio após a mensagem editada
      updatedHistory = [...messages.slice(0, editIndex), updatedUserMessage];

      // Atualizar no Banco
      if (userSession?.user?.id && activeChatId) {
        // Atualiza a mensagem
        supabase.from('agent_messages').update({ content: userContent }).eq('id', editingMessageId).then();
        
        // Remove as posteriores para manter coerência
        const idsToDelete = messages.slice(editIndex + 1).map(m => m.id);
        if (idsToDelete.length > 0) {
          supabase.from('agent_messages').delete().in('id', idsToDelete).then();
        }
      }
      setEditingMessageId(null);
    } else {
      const userMsgId = crypto.randomUUID();
      const userMessage: Message = {
        id: userMsgId,
        localId: userMsgId,
        role: 'user',
        content: userContent,
        timestamp: new Date(),
      };

      if (!currentChatId && userSession?.user?.id) {
        const chatTitle = text.trim() ? text.trim().substring(0, 30) + (text.length > 30 ? '...' : '') : 'Novo Chat';
        const { data: newChat } = await supabase.from('agent_chats').insert({
          user_id: userSession.user.id,
          title: chatTitle
        }).select().single();
        
        if (newChat) {
          currentChatId = newChat.id;
          setActiveChatId(newChat.id);
          setChats(prev => [{ id: newChat.id, title: chatTitle, created_at: new Date() }, ...prev]);
        }
      }

      updatedHistory = [...messages, userMessage];

      if (userSession?.user?.id && currentChatId) {
        supabase.from('agent_messages').insert({
          id: userMsgId, // FORÇAMOS O ID UUID
          user_id: userSession.user.id,
          chat_id: currentChatId,
          role: 'user',
          content: userContent,
          provider: selectedModel.id
        }).then();
      }
    }
    const isComplex = isComplexPrompt(userContent);
    const assistantMsgId = crypto.randomUUID();

    const loadingMessage: Message = {
      id: assistantMsgId, // Inicialmente usamos o localId como ID temporário
      localId: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      isComplex,
    };

    setMessages([...updatedHistory, loadingMessage]);

    try {
      const historyForApi = updatedHistory.slice(-20);

      // Criar novo AbortController para esta requisição
      abortControllerRef.current = new AbortController();

      const response = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          userId: userSession?.user?.id,
          chatId: currentChatId,
          messages: historyForApi.map((m) => ({ role: m.role, content: m.content })),
          provider: selectedModel.id,
          fileContent: file?.content,
          assistantMessageId: assistantMsgId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao obter resposta da IA.');
      }

      // ─── LEITURA DO STREAM (SSE) ──────────────────────────────────────────
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantReply = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.openTerminal) {
                  setIsTerminalOpen(true);
                }

                if (data.part) {
                  assistantReply += data.part;
                  
                  // Re-calcula isComplex dinamicamente se novos logs técnicos surgirem no conteúdo
                  const currentIsComplex = isComplex || /\[(PLAN|STEP_START|STEP_DONE|PENSANDO|TERMINAL|WEB|SUPABASE|CODE|GIT|PRISMA|BUSCANDO|ANALISANDO|RESEARCH)\]/i.test(assistantReply);

                  // Atualiza a interface em tempo real utilizando o ID fixo
                  setMessages((prev) => {
                    return prev.map(m => m.id === assistantMsgId ? {
                      ...m,
                      content: assistantReply,
                      isComplex: currentIsComplex
                    } : m);
                  });
                }
                if (data.error) throw new Error(data.error);
              } catch (e) {
                // Ignore empty or unparseable chunks
              }
            }
          }
        }
      }

      // O SALVAMENTO AGORA É FEITO NO BACKEND (MAIS SEGURO)
      // O frontend apenas aguarda o fim do stream para liberar as ações
      setIsLoading(false);
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
        ...m, 
        isLoading: false
      } : m));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[CAPTU AI] Geração cancelada pelo usuário.');
        return;
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Erro:** ${error.message}\n\nTente novamente ou verifique sua conexão.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== 'loading' && m.id !== 'streaming-res'), errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, selectedModel, userSession, activeChatId, editingMessageId]);

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  const startNewChat = () => {
    setActiveChatId(null);
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (userSession?.user?.id) {
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) setActiveChatId(null);
      await supabase.from('agent_chats').delete().eq('id', id).eq('user_id', userSession.user.id);
    }
  };

  const handleExport = () => {
    const content = messages
      .map((m) => `[${m.role === 'user' ? 'Você' : 'CAPTU AI'}] ${m.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captu-ai-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isEmpty = messages.length === 0 && !activeChatId;

  return (
    <div className="flex h-full w-full bg-background relative overflow-hidden">
      
      {/* Definições de Gradiente SVG para o ícone de Sparkles */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="sparkle-static" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#4EA4EB" offset="0%" />
            <stop stopColor="#8B5CF6" offset="100%" />
          </linearGradient>
          
          <linearGradient id="sparkle-animated" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#4EA4EB" offset="0%">
              <animate attributeName="stop-color" values="#4EA4EB;#8B5CF6;#E879F9;#4EA4EB" dur="1.5s" repeatCount="indefinite" />
            </stop>
            <stop stopColor="#8B5CF6" offset="100%">
              <animate attributeName="stop-color" values="#8B5CF6;#E879F9;#4EA4EB;#8B5CF6" dur="1.5s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>
      </svg>

      {/* Sidebar de Histórico (Esquerda) */}
      <div 
        className={cn(
          "flex-shrink-0 border-r border-border/40 bg-muted/10 h-full transition-all duration-300 ease-in-out overflow-hidden hidden lg:block relative",
          isSidebarOpen ? "w-[260px]" : "w-0 border-r-0"
        )}
      >
        <div className={cn("flex flex-col h-full w-[260px] transition-opacity duration-300", isSidebarOpen ? "opacity-100" : "opacity-0")}>
          <div className="p-4">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 shadow-sm border-border/50 bg-background hover:bg-muted text-foreground" 
            onClick={startNewChat}
          >
            <Plus className="w-4 h-4" />
            Novo bate-papo
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 custom-scrollbar">
          <p className="px-3 text-xs font-semibold text-muted-foreground mb-3 mt-1 uppercase tracking-wider">Recentes</p>
          {chats.map(chat => (
            <button 
              key={chat.id} 
              onClick={() => setActiveChatId(chat.id)} 
              className={cn(
                "flex items-center w-full px-3 py-2.5 text-sm text-left rounded-lg transition-colors overflow-hidden relative group", 
                activeChatId === chat.id 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-4 h-4 mr-2.5 shrink-0 opacity-70" />
              <span className="truncate flex-1">{chat.title}</span>
              <Trash2 
                className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 shrink-0 ml-2 text-muted-foreground hover:text-red-500 transition-opacity" 
                onClick={(e) => handleDeleteChat(e, chat.id)} 
              />
            </button>
          ))}
          {chats.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhuma conversa salva.
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Main Chat Area - Workspace Wrapper */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-x-hidden relative bg-background">
        
        {/* Centered Chat Container */}
        <div className={cn(
          "flex flex-col h-full mx-auto w-full transition-all duration-500 ease-in-out",
          messages.some(m => m.content.includes('|') || m.content.includes('<table>')) ? "max-w-7xl" : "max-w-4xl"
        )}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-9 h-9 -ml-2 text-muted-foreground hover:text-foreground hidden lg:flex shrink-0" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Alternar barra lateral (Ctrl + \)"
            >
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </Button>

            <div className="relative">
              <div className="w-10 h-10 flex items-center justify-center">
                <img src="/sidebar-logo.png" alt="CAPTU AI" className="w-8 h-8 object-contain" />
              </div>
              <div className="absolute -top-1 right-0">
                <Sparkles 
                  color={isLoading ? "url(#sparkle-animated)" : "url(#sparkle-static)"} 
                  className="w-4 h-4 transition-all duration-300" 
                />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">CAPTU AI</h1>
              <p className="text-xs text-muted-foreground">Assistente de prospecção inteligente</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Botão de Terminal — só aparece em ambiente local */}
            {isLocalhost && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-9 h-9 rounded-xl transition-all",
                  isTerminalOpen
                    ? "text-[#3fb950] bg-[#3fb950]/10 hover:bg-[#3fb950]/20"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                onClick={() => setIsTerminalOpen(prev => !prev)}
                title="Abrir Terminal (PowerShell — apenas local)"
              >
                <Terminal className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              onClick={() => setIsContextOpen(true)}
              title="Ajustar Base de Conhecimento (Contexto)"
            >
              
              <Brain className="w-4 h-4 text-muted-foreground"/>
            </Button>

            <AIModelSelector selected={selectedModel} onSelect={setSelectedModel} />
            
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={handleExport}
                title="Exportar conversa"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/40 mx-4 flex-shrink-0" />

        {/* Chat Messages Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-6 space-y-5 custom-scrollbar">
          {isEmpty ? (
            /* Welcome Screen */
            <div className="flex flex-col items-center justify-center h-full gap-8 text-center pb-10 animate-in fade-in duration-500">
              <div className="space-y-3">
                <div className="relative mx-auto w-max">
                  <div className="w-16 h-16 flex items-center justify-center">
                    <img src="/sidebar-logo.png" alt="CAPTU AI" className="w-12 h-12 object-contain" />
                  </div>
                  <div className="absolute top-0 -right-0.5">
                    <Sparkles 
                      color={isLoading ? "url(#sparkle-animated)" : "url(#sparkle-static)"} 
                      className="w-6 h-6 transition-all duration-300" 
                    />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Olá! Sou o CAPTU AI</h2>
                <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
                  Seu assistente especializado em prospecção B2B. Posso criar scripts, analisar leads, gerar relatórios e muito mais.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {WELCOME_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestion(suggestion.replace(/^[\p{Emoji}\s]+/u, '').trim())}
                    className={cn(
                      'text-left text-sm px-4 py-3 rounded-xl border border-border/50 bg-card',
                      'hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
                      'transition-all duration-200 active:scale-[0.98]'
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Powered by {selectedModel.name} · {selectedModel.provider}</span>
              </div>
            </div>
          ) : (
            /* Messages */
            <>
              {messages.map((message) => (
                <MessageBubble 
                  key={message.localId || message.id} 
                  message={message} 
                  onEdit={(text) => {
                    setEditingMessageId(message.id);
                    chatInputRef.current?.setText(text);
                  }}
                  onResend={(text) => {
                    sendMessage(text, undefined, message.id);
                  }}
                />
              ))}
              <div ref={bottomRef} className="h-4" />
            </>
          )}
        </div>
        {/* Input Area */}
        <div className="flex-shrink-0 px-4 pb-6 pt-2">
          <AgentPendingChanges chatId={activeChatId || ''} isTyping={isLoading} />
          <ChatInput 
            ref={chatInputRef} 
            onSend={sendMessage} 
            onCancel={stopGeneration}
            isLoading={isLoading} 
            isEditing={!!editingMessageId}
            onCancelEdit={() => setEditingMessageId(null)}
          />
        </div>
        </div>
      </div>

      <AgentContextManager 
        userId={userSession?.user?.id || ''} 
        isOpen={isContextOpen} 
        onClose={() => setIsContextOpen(false)} 
      />

      {/* Terminal Embutido — apenas local */}
      {isLocalhost && (
        <TerminalPanel
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
        />
      )}
    </div>
  );
}
