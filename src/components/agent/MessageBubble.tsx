import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { 
  Bot, User, Sparkles, Pencil, RotateCcw, Copy, Check, Brain, Terminal, 
  Globe, Database, Code, Code2, GitBranch, CheckCircle2, ThumbsUp, ThumbsDown, RefreshCw 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AgentTraceTimeline } from './AgentTraceTimeline';
import { AgentArtifact, ArtifactType } from './AgentArtifact';
import { API_URL } from '@/config';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  localId?: string; // ID estável para React Keys
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isComplex?: boolean;
  rating?: 'up' | 'down' | null;
}

interface MessageBubbleProps {
  message: Message;
  onEdit?: (text: string) => void;
  onResend?: (text: string) => void;
}

// Componente para renderizar a mensagem do assistente com foco em artefatos
function AssistantContent({ message, isComplex, onResend }: { message: Message; isComplex: boolean; onResend?: (text: string) => void }) {
  const { content } = message;
  // Regex universal para Artefatos: [ARTIFACT type="..." title="..." id="..."] ... [/ARTIFACT]
  const artifactRegex = /\[ARTIFACT\s+type="([^"]+)"\s+title="([^"]+)"(?:\s+id="([^"]+)")?\]([\s\S]*?)\[\/ARTIFACT\]/gi;
  
  // Função auxiliar para limpar tags de sistema e técnicos do texto final
  const cleanSystemTags = (text: string) => {
    if (!text) return "";
    
    // Lista exaustiva de tags de sistema para remoção completa da linha
    const systemLineRegex = /\[(PLAN|STEP_START|STEP_DONE|PENSANDO|TERMINAL|WEB|SUPABASE|CODE|GIT|PRISMA|ANALISANDO|RESEARCH|BUSCANDO)\]/i;
    
    return text
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return true; // Mantém linhas vazias para espaçamento
        
        // Remove se a linha contiver uma tag de sistema entre colchetes
        if (systemLineRegex.test(trimmed)) return false;
        
        // Remove se a linha for apenas um número isolado ou lista de steps técnica
        if (/^\d{1,2}$/.test(trimmed)) return false;
        if (trimmed.startsWith('["') && trimmed.endsWith('"]')) return false; // Remove arrays de plano puros
        
        // Remove tags específicas sem colchetes que a IA às vezes gera
        if (trimmed.startsWith('PLAN ') || trimmed.startsWith('STEP_START ') || trimmed.startsWith('STEP_DONE ')) return false;
        
        return true;
      })
      .join('\n')
      .trim();
  };

  // Parsing do conteúdo para separar texto de artefatos
  const segments: { type: 'text' | 'artifact', content: string, artifactType?: ArtifactType, title?: string, id?: string }[] = [];
  let lastIndex = 0;
  let match;

  // Reinicia o índice do regex global
  artifactRegex.lastIndex = 0;

  while ((match = artifactRegex.exec(content)) !== null) {
    // Texto antes do artefato
    const textBefore = content.slice(lastIndex, match.index);
    if (textBefore) segments.push({ type: 'text', content: textBefore });

    // O Artefato em si
    segments.push({ 
      type: 'artifact', 
      artifactType: match[1] as ArtifactType, 
      title: match[2], 
      id: match[3],
      content: match[4] 
    });

    lastIndex = artifactRegex.lastIndex;
  }

  // Texto restante depois do último artefato
  const textAfter = content.slice(lastIndex);
  if (textAfter) segments.push({ type: 'text', content: textAfter });

  // Se não houver segmentos (conteúdo vazio durante stream inicial), cria um segmento de texto
  if (segments.length === 0 && content) {
    segments.push({ type: 'text', content });
  }

  return (
    <div className={cn(
      "prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-table:border prose-table:border-border/50 prose-th:bg-muted/30 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2",
      isComplex ? "px-2 py-1" : ""
    )}>
      {/* ─── RENDERIZAR TIMELINE DE ATIVIDADE (ESTILO MANUS) ────────────── */}
      {isComplex && (
        <>
          <AgentTraceTimeline content={content} />
          <div className="h-4" /> {/* Espaço extra após raciocínio */}
        </>
      )}

      {segments.map((seg, idx) => {
        if (seg.type === 'artifact') {
          return (
            <AgentArtifact 
              key={idx} 
              type={seg.artifactType || 'script'} 
              title={seg.title || 'Resultado'} 
              content={seg.content} 
              id={seg.id}
            />
          );
        }

        const cleanPart = cleanSystemTags(seg.content);
        if (!cleanPart) return null;

        return (
          <React.Fragment key={idx}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                table({node, ...props}) {
                  return <div className="my-6 rounded-xl border border-border/60 shadow-sm overflow-hidden"><table className="w-full border-collapse text-left table-auto" {...props} /></div>
                },
                thead({node, ...props}) {
                  return <thead className="bg-muted/60 text-muted-foreground" {...props} />
                },
                th({node, ...props}) {
                  return <th className="px-5 py-3 font-bold text-[11px] border-b border-border/50 uppercase tracking-wider align-middle" {...props} />
                },
                td({node, ...props}) {
                  return <td className="px-5 py-4 border-b border-secondary/40 text-[13.5px] align-top leading-6" {...props} />
                },
                tr({node, ...props}) {
                  return <tr className="hover:bg-muted/10 transition-colors last:border-b-0" {...props} />
                },
                h1({node, ...props}) { return <h1 className="text-xl font-bold mt-7 mb-4 border-b border-border/30 pb-2" {...props} /> },
                h2({node, ...props}) { return <h2 className="text-lg font-bold mt-6 mb-3" {...props} /> },
                h3({node, ...props}) { return <h3 className="text-base font-bold mt-5 mb-2.5 text-primary" {...props} /> },
                h4({node, ...props}) { return <h4 className="text-[15px] font-bold mt-4 mb-2" {...props} /> },
                h5({node, ...props}) { return <h5 className="text-[11px] font-extrabold mt-3 mb-1 uppercase text-muted-foreground/90 tracking-widest border-l-2 border-primary pl-2" {...props} /> },
                p({node, ...props}) { return <p className="mb-4 last:mb-0 whitespace-pre-wrap break-words" {...props} /> },
                hr({node, ...props}) { return <hr className="my-8 border-border/50" {...props} /> },
                code({node, className, children, ...props}: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const codeContent = String(children).replace(/\n$/, '');
                  
                  // Fallback para versões mais recentes do ReactMarkdown
                  // Consideramos inline se NÃO tem quebra de linha E NÃO especificou language
                  const isInline = !match && !codeContent.includes('\n');
                  
                  // Se for um bloco de código (ex: ```json ou tem multi-linhas)
                  if (!isInline) {
                    // Critérios para transformar em Artifact Card: 
                    // 1. Ser multi-linha (código real estruturado)
                    // 2. Ter um comprimento substancial (comandos complexos)
                    const isMultiLine = codeContent.includes('\n');
                    const isSubstantial = codeContent.length > 40 || isMultiLine;

                    if (isSubstantial) {
                      const title = language ? `Snippet ${language.toUpperCase()}` : 'Configuração Técnica';
                      return (
                        <AgentArtifact 
                          type="code" 
                          title={title} 
                          content={`\`\`\`${language}\n${codeContent}\n\`\`\``} 
                        />
                      );
                    }
                    
                    // Fallback para blocos de código curtos/simples (sem ser Artifact) mas ainda blocos
                    return (
                      <pre className="p-3 bg-muted/50 rounded-lg border border-border/40 my-2 overflow-x-auto block">
                        <code className={cn("text-[13px] font-mono", className)} {...props}>{children}</code>
                      </pre>
                    );
                  }
                  
                  // Código inline simples (como `main` ou `.vscode/`)
                  return <code className={cn("bg-[#1e1e1e] border border-[#30363d] text-[#e6edf3] px-1.5 py-0.5 mx-0.5 rounded-md text-[13px] font-mono font-medium shadow-sm break-keep", className)} {...props}>{children}</code>;
                }
              }}
            >
              {cleanPart}
            </ReactMarkdown>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function MessageActions({ message, onResend }: { message: Message; onResend?: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<'up' | 'down' | null>(message.rating || null);

  // Sincroniza o estado local se a prop message mudar (importante para mensagens recém-salvas)
  useEffect(() => {
    setRating(message.rating || null);
  }, [message.rating]);

  const handleCopy = () => {
    // Limpa tags de sistema e artefatos para a cópia pura
    const cleanContent = message.content.replace(/\[(PLAN|STEP_START|STEP_DONE|PENSANDO|TERMINAL|WEB|SUPABASE|CODE|GIT|PRISMA|ARTIFACT).*?\]|\[\/ARTIFACT\]/gi, '').trim();
    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRate = async (type: 'up' | 'down') => {
    if (message.id === 'streaming-res') return;
    
    const newRating = rating === type ? null : type;
    setRating(newRating);
    
    try {
      // Usamos nosso backend para bypassar restrições de RLS do Supabase
      const response = await axios.post(`${window.location.protocol}//${window.location.hostname}:3000/api/agent/chat/rate`, {
        messageId: message.id,
        rating: newRating
      });

      if (response.status !== 200) throw new Error('Falha na resposta do servidor');
    } catch (err) {
      console.error('Erro ao salvar avaliação via API:', err);
      // Fallback em caso de erro na API: tenta via Supabase direto (pode falhar por RLS mas é melhor que nada)
      await supabase
        .from('agent_messages')
        .update({ rating: newRating })
        .eq('id', message.id);
    }
  };

  const formattedTimestamp = message.timestamp ? formatDistanceToNow(new Date(message.timestamp), { addSuffix: true, locale: ptBR }) : '';
  const isStreaming = message.id === 'streaming-res';

  return (
    <div className={cn(
      "flex flex-col gap-1.5 mt-4 px-1 transition-all duration-300",
      rating ? "opacity-100" : "opacity-40 group-hover/msg:opacity-100"
    )}>
      <div className="flex items-center gap-1.5">
        {onResend && (
          <button 
            onClick={() => onResend(message.content)}
            className="p-1.5 rounded-lg hover:bg-secondary/70 text-muted-foreground/60 hover:text-foreground transition-all"
            title="Regenerar resposta"
          >
            <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-500" />
          </button>
        )}

        <button 
          onClick={() => handleRate('up')}
          className={cn(
            "p-1.5 rounded-lg transition-all flex items-center justify-center", 
            rating === 'up' 
              ? "text-green-500 scale-110" 
              : "text-muted-foreground/60 hover:bg-secondary/60 hover:text-foreground"
          )}
          title="Bom conteúdo"
        >
          <ThumbsUp size={14} fill={rating === 'up' ? "currentColor" : "none"} strokeWidth={rating === 'up' ? 2.5 : 2} />
        </button>

        <button 
          onClick={() => handleRate('down')}
          className={cn(
            "p-1.5 rounded-lg transition-all flex items-center justify-center", 
            rating === 'down' 
              ? "text-red-500 scale-110" 
              : "text-muted-foreground/60 hover:bg-secondary/60 hover:text-foreground"
          )}
          title="Ruim/Incorreto"
        >
          <ThumbsDown size={14} fill={rating === 'down' ? "currentColor" : "none"} strokeWidth={rating === 'down' ? 2.5 : 2} />
        </button>

        <button 
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground/60 hover:text-foreground transition-all flex items-center gap-2"
          title="Copiar texto limpo"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied && <span className="text-[10px] font-bold text-green-500 animate-in fade-in slide-in-from-left-1 duration-300">Copiado</span>}
        </button>
      </div>

      {formattedTimestamp && (
        <span className="text-[10px] text-muted-foreground/30 font-medium italic select-none pl-1.5">
          {formattedTimestamp}
        </span>
      )}
    </div>
  );
}

export function MessageBubble({ message, onEdit, onResend }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  
  // Detecção de complexidade com fallback para histórico (checa se há tags de sistema)
  const isComplex = message.isComplex ?? /\[(PLAN|STEP_START|STEP_DONE|PENSANDO|TERMINAL|WEB|SUPABASE|CODE|GIT|PRISMA|BUSCANDO|ANALISANDO|RESEARCH)\]/i.test(message.content);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = message.timestamp.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).replace('.', '');

  const formattedTime = message.timestamp.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const fullDateTime = `${message.timestamp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}. de ${message.timestamp.getFullYear()}, ${formattedTime}`;

  const assistantText = message.content.split('\n').filter(line => !line.match(/^\s*\[(PLAN|STEP_START|STEP_DONE|PENSANDO|TERMINAL|WEB|SUPABASE|CODE|GIT|PRISMA|BUSCANDO|ANALISANDO|RESEARCH)\]/i)).join('\n').trim();
  const hasAssistantText = assistantText.length > 0;

  return (
    <div className={cn('flex items-start gap-3 w-full group/msg', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center">
          <img src="/sidebar-logo.png" alt="AI" className="w-6 h-6 object-contain" />
          <div className="absolute -top-0.5 right-0">
             <Sparkles 
              color={message.isLoading ? "url(#sparkle-animated)" : "url(#sparkle-static)"} 
              className="w-3 h-3 transition-all duration-300" 
            />
          </div>
        </div>
      )}

      {/* Bubble */}
      <div className={cn(
        "relative flex flex-col transition-all duration-300", 
        isUser 
          ? "max-w-[92%] sm:max-w-[85%] items-end" 
          : (message.content.includes('|') || message.content.includes('<table>')) 
            ? "max-w-full w-full items-start" 
            : isComplex ? "max-w-[92%] sm:max-w-[85%] w-full items-start" : "max-w-[92%] sm:max-w-[85%] items-start"
      )}>
        <div 
          className={cn(
            'px-2 pt-0 pb-1 text-sm leading-relaxed break-words min-w-0 transition-all duration-300',
            isUser
              ? 'rounded-2xl px-4 py-3 bg-secondary text-secondary-foreground rounded-tr-sm border border-border/30 shadow-sm'
              : cn('text-foreground w-full py-2 px-1')
          )}
        >
          {/* Lógica de Carregamento Condicional */}
          {!isUser && !isComplex && !hasAssistantText ? (
            <div className="flex items-center gap-1.5 py-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <AssistantContent message={message} isComplex={isComplex} onResend={onResend} />
          )}
        </div>

        {/* Assistant Actions (Externo à bolha) - Liberado para exibição instantânea */}
        {!isUser && !message.isLoading && (
          <MessageActions message={message} onResend={onResend} />
        )}

        {/* User Actions */}
        {isUser && !message.isLoading && (
          <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all mt-1.5 mr-0.5">
            <div className="relative group/date">
              <span className="text-[10px] text-muted-foreground/70 font-medium mr-2 cursor-default select-none transition-colors hover:text-muted-foreground">
                {formattedDate}.
              </span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black text-white text-[10px] rounded flex items-center whitespace-nowrap opacity-0 group-hover/date:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                {fullDateTime}
              </div>
            </div>

            <button
              onClick={() => onResend?.(message.content)}
              className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
              title="Reenviar mensagem"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onEdit?.(message.content)}
              className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
              title="Copiar texto"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
