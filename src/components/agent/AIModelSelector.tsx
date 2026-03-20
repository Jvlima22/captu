import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/config';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  icon: string;
  description: string;
  isAvailable: boolean;
  badge?: string;
}

export const AI_MODELS_CONFIG: AIModel[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'Google',
    icon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
    description: 'Gemini 2.0 Flash · Rápido',
    isAvailable: true,
    badge: 'Grátis',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'OpenAI',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
    description: 'GPT-4o · Mais avançado',
    isAvailable: false,
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    icon: 'https://img.utdstc.com/icon/9c5/6fe/9c56fe2b44e1d0367b98c2c5ee2255aebbd7093902bffed36aa36e3431b40fb5:500',
    description: 'Claude 3.5 Sonnet · Textos longos',
    isAvailable: false,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    provider: 'ElevenLabs',
    icon: 'https://www.google.com/s2/favicons?domain=elevenlabs.io&sz=128',
    description: 'Voz ultra-realista · TTS',
    isAvailable: false,
    badge: '🔊 Áudio',
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    icon: 'https://www.google.com/s2/favicons?domain=x.ai&sz=128',
    description: 'Tempo real · Em breve',
    isAvailable: false,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=128',
    description: 'Pesquisa web · Em breve',
    isAvailable: false,
  },
  {
    id: 'manus',
    name: 'Manus',
    provider: 'Manus AI',
    icon: 'https://www.google.com/s2/favicons?domain=manus.ai&sz=128',
    description: 'Agente autônomo · Pesquisa',
    isAvailable: false, // Will be updated by useEffect/backend check
    badge: 'Agent',
  },
];

interface AIModelSelectorProps {
  selected: AIModel;
  onSelect: (model: AIModel) => void;
}

export function AIModelSelector({ selected, onSelect }: AIModelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [models, setModels] = useState<AIModel[]>(AI_MODELS_CONFIG);

  // Fetch available models from backend on mount
  useEffect(() => {
    const fetchAvailable = async () => {
      try {
        const res = await fetch(`${API_URL}/api/agent/available-models`);
        if (!res.ok) return;
        const data = await res.json();
        const availableIds: string[] = data.available
          .filter((m: { id: string; available: boolean }) => m.available)
          .map((m: { id: string; available: boolean }) => m.id);

        setModels(AI_MODELS_CONFIG.map((m) => ({
          ...m,
          isAvailable: availableIds.includes(m.id),
        })));
      } catch {
        // Fail silently — use defaults
      }
    };
    fetchAvailable();
  }, []);

  const availableModels = models.filter((m) => m.isAvailable);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary border border-border/50 rounded-xl px-3 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <img
          src={selected.icon}
          alt={selected.name}
          className="w-4 h-4 object-contain"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <span>{selected.name}</span>
        {selected.badge && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
            {selected.badge}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border/60 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Available */}
            {availableModels.length > 0 && (
              <>
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Disponíveis
                  </p>
                </div>
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => { onSelect(model); setOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-secondary/60 cursor-pointer',
                      selected.id === model.id && 'bg-primary/5'
                    )}
                  >
                    <img
                      src={model.icon}
                      alt={model.name}
                      className="w-5 h-5 object-contain flex-shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium leading-none">{model.name}</p>
                        {model.badge && (
                          <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded-full font-bold leading-none">
                            {model.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{model.description}</p>
                    </div>
                    {selected.id === model.id && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </button>
                ))}
              </>
            )}

            {/* Unavailable */}
            <div className="px-3 pt-2.5 pb-1 border-t border-border/40 mt-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Em breve</p>
            </div>
            {models.filter(m => !m.isAvailable).map((model) => (
              <button
                key={model.id}
                disabled
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left opacity-40 cursor-not-allowed"
              >
                <img
                  src={model.icon}
                  alt={model.name}
                  className="w-5 h-5 object-contain flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-none">{model.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{model.description}</p>
                </div>
              </button>
            ))}

            <div className="h-2" />
          </div>
        </>
      )}
    </div>
  );
}
