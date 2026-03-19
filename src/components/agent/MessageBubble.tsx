import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, Sparkles, Pencil, RotateCcw, Copy, Check } from 'lucide-react';
import { useTheme } from "@/components/ThemeProvider";

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

function renderMarkdown(text: string) {
  // 1. Uniformiza quebras de linha excessivas (mais de 2 pra 2)
  let parsed = text.replace(/\n{3,}/g, '\n\n');

  // 2. Formatações Inline e Headers
  parsed = parsed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-secondary/60 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-5 mb-2">$1</h1>')
    .replace(/^---$/gm, '<hr class="border-border/40 my-5" />');

  // 3. Agrupa Itens de Lista que a IA manda separados por \n\n
  parsed = parsed.replace(/^([-•] .+?)\n+(?=[-•] )/gm, '$1\n');
  parsed = parsed.replace(/^(\d+\. .+?)\n+(?=\d+\. )/gm, '$1\n');

  // 4. Converte listas
  parsed = parsed
    .replace(/^[-•] (.+)$/gm, '<li class="ml-4 list-disc pl-1 mb-1">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal pl-1 mb-1">$1</li>');

  // Agrupa os <li> subsequentes dentro de um <ul> ou <ol> contíguo
  // Isso evita que a tag pegue todo o resto do texto
  parsed = parsed.replace(/(<li class="[^"]*list-disc[^"]*">.*?<\/li>\n?)+/g, match => `<ul class="my-3 space-y-1">\n${match}</ul>\n`);
  parsed = parsed.replace(/(<li class="[^"]*list-decimal[^"]*">.*?<\/li>\n?)+/g, match => `<ol class="my-3 space-y-1">\n${match}</ol>\n`);

  // 5. Converte \n soltos para <br />
  parsed = parsed.replace(/\n/g, '<br />');

  // 6. Limpeza de <br /> criados indevidamente ao lado de elementos de bloco
  parsed = parsed.replace(/(<\/?(?:ul|ol|li|h1|h2|h3|hr)[^>]*>)<br \/>/g, '$1');
  parsed = parsed.replace(/<br \/>(<\/?(?:ul|ol|li|h1|h2|h3|hr)[^>]*>)/g, '$1');
  parsed = parsed.replace(/(<\/?(?:ul|ol|li|h1|h2|h3|hr)[^>]*>)<br \/>/g, '$1'); // passe duplo para garantir
  
  // Limpa múltiplos br seguidos (max 2)
  parsed = parsed.replace(/(<br \/>){3,}/g, '<br /><br />');

  return parsed;
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
  }).replace('.', ''); // Remove o ponto do mês se houver

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
      <div className={cn("relative max-w-[80%] flex flex-col", isUser ? "items-end" : "items-start")}>
        <div 
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
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
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
            />
          )}
        </div>

        {/* User Actions - Estilo ChatGPT/Premium */}
        {isUser && !message.isLoading && (
          <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all mt-1.5 mr-0.5">
            <div className="relative group/date">
              <span className="text-[10px] text-muted-foreground/70 font-medium mr-2 cursor-default select-none transition-colors hover:text-muted-foreground">
                {formattedDate}.
              </span>
              
              {/* Custom Tooltip */}
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
