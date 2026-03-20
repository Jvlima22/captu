import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, Sparkles, Pencil, RotateCcw, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  onEdit?: (text: string) => void;
  onResend?: (text: string) => void;
}

export function MessageBubble({ message, onEdit, onResend }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

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
      <div className={cn("relative max-w-[92%] sm:max-w-[85%] flex flex-col", isUser ? "items-end" : "items-start")}>
        <div 
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm overflow-x-auto min-w-0',
            isUser
              ? 'bg-secondary text-secondary-foreground rounded-tr-sm border border-border/30'
              : 'bg-card border border-border/60 text-foreground rounded-tl-sm'
          )}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-1.5 py-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-table:border prose-table:border-border/50 prose-th:bg-muted/30 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                   table({node, ...props}) {
                     return <div className="overflow-x-auto my-6 rounded-xl border border-border/60 shadow-sm"><table className="w-full border-collapse text-left table-auto" {...props} /></div>
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
                   p({node, ...props}) { return <p className="mb-4 last:mb-0" {...props} /> },
                   hr({node, ...props}) { return <hr className="my-8 border-border/50" {...props} /> },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

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
