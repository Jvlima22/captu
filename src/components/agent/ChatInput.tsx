import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from "@/components/ThemeProvider";

interface ChatInputProps {
  onSend: (text: string, file?: { name: string; content: string }) => void;
  isLoading: boolean;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

export interface ChatInputHandle {
  setText: (text: string) => void;
}

const QUICK_COMMANDS = [
  { label: '📊 Relatório', value: 'Gere um relatório completo sobre as métricas de prospecção do meu time de vendas.' },
  { label: '✍️ Script de vendas', value: 'Crie um script de prospecção B2B para abordar o decisor de uma empresa de tecnologia.' },
  { label: '📧 E-mail frio', value: 'Escreva um e-mail frio para prospecção B2B que seja curto, direto e com alta taxa de abertura.' },
  { label: '🔍 Análise de lead', value: 'Como devo analisar um lead para saber se ele é qualificado para o meu produto?' },
  { label: '🗓️ Follow-up', value: 'Crie uma sequência de follow-up de 5 etapas para um lead que não respondeu meu primeiro contato.' },
];

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({ onSend, isLoading, isEditing, onCancelEdit }, ref) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useImperativeHandle(ref, () => ({
    setText: (newText: string) => {
      setText(newText);
      // Ajustar altura após o react renderizar o novo texto
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
          textareaRef.current.focus();
        }
      }, 0);
    }
  }));

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    onSend(trimmed || '(Arquivo enviado)', file || undefined);
    setText('');
    setFile(null);
    setShowCommands(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: f.name, content: reader.result as string });
    };
    reader.readAsText(f);
    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleQuickCommand = (value: string) => {
    setText(value);
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Editing indicator */}
      {isEditing && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-1.5 text-xs animate-in slide-in-from-bottom-1">
          <div className="flex items-center gap-2 text-primary font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Editando mensagem...
          </div>
          <button 
            onClick={() => {
              onCancelEdit?.();
            }} 
            className="text-muted-foreground hover:text-foreground transition-colors font-medium border-l border-border/50 pl-2 ml-2"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Quick Commands */}
      {showCommands && (
        <div className="flex flex-wrap gap-2 px-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => handleQuickCommand(cmd.value)}
              className="text-xs bg-secondary/60 hover:bg-primary/10 hover:text-primary border border-border/50 hover:border-primary/30 rounded-full px-3 py-1.5 transition-all font-medium"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      )}

      {/* File attachment preview */}
      {file && (
        <div className="flex items-center gap-2 bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm animate-in fade-in">
          <Paperclip className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground/80 truncate flex-1">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Input */}
      <div className="flex items-end gap-2 bg-card border border-border/60 rounded-2xl p-2 shadow-sm focus-within:border-primary/40 transition-colors">
        {/* Attachment Button */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all mb-0.5"
          title="Anexar arquivo"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.pdf,.md,.json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Quick Commands Toggle */}
        <button
          onClick={() => setShowCommands((v) => !v)}
          className={cn(
            'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all mb-0.5',
            showCommands
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
          )}
          title="Comandos rápidos"
        >
          /
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo ao CAPTU AI... (Enter para enviar, Shift+Enter para nova linha)"
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none outline-none py-2 max-h-[200px] leading-relaxed"
        />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && !file)}
          size="icon"
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 shadow-sm mb-0.5"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        CAPTU AI pode cometer erros. Verifique informações importantes.
      </p>
    </div>
  );
});
