import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Integration } from "@/components/integrations/types";
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  ExternalLink, 
  Fingerprint, 
  ShieldCheck, 
  User, 
  X 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationDetailModalProps {
  integration: Integration | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (id: string, token?: string) => void;
  onDisconnect?: (id: string) => void;
}

export function IntegrationDetailModal({ 
  integration, 
  isOpen, 
  onClose, 
  onConnect,
  onDisconnect 
} : IntegrationDetailModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [apiKey, setApiKey] = useState("");

  if (!integration) return null;

  // Logic: Browser login (OAuth) vs. Manual API Key/Token
  const requiresManualInput = integration.category === 'api' || integration.category === 'mcp' || integration.id === 'webhooks';
  const isBrowserLogin = !requiresManualInput;

  const handleConnectAction = () => {
    onConnect(integration.id, requiresManualInput ? apiKey : undefined);
    setApiKey(""); // clear after submission
  };

  const handleDisconnectAction = () => {
    if (onDisconnect) {
      onDisconnect(integration.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-2xl [&>button:last-child]:hidden">
        {/* Custom Close Button for premium feel */}
        <DialogClose className="absolute right-6 top-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogClose>

        <div className="relative p-8 flex flex-col items-center">
          {/* Icon Container */}
          <div className="w-24 h-24 rounded-2xl bg-secondary/30 flex items-center justify-center p-3 mb-6 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <img 
              src={integration.icon} 
              alt={integration.name} 
              className="w-full h-full object-contain"
            />
          </div>

          <DialogHeader className="w-full space-y-2 mb-6 items-center text-center">
            <DialogTitle className="text-2xl font-bold text-foreground/90">
              {integration.name}
            </DialogTitle>
            <p className="text-muted-foreground text-center text-sm px-4">
              {integration.description}
            </p>
          </DialogHeader>

          {/* Authentication Section */}
          <div className="w-full flex flex-col gap-4 mb-4">
            {integration.status === 'connected' ? (
              <Button 
                onClick={handleDisconnectAction}
                variant="destructive"
                className="w-full h-12 rounded-xl font-semibold gap-2 transition-all active:scale-[0.98] shadow-md bg-red-500 hover:bg-red-600 focus-visible:ring-red-500"
              >
                Desconectar {integration.name}
              </Button>
            ) : (
              <>
                {requiresManualInput ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-foreground px-1">Insira sua API Key ({integration.name}):</p>
                    <Input 
                      type="password" 
                      placeholder="sk-..." 
                      className="h-12 rounded-xl bg-background border-border/50 text-foreground"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <Button 
                      onClick={handleConnectAction}
                      disabled={!apiKey.trim()}
                      className="w-full h-12 rounded-xl font-semibold gap-2 transition-all active:scale-[0.98] shadow-md bg-primary hover:bg-primary/90 text-white mt-2"
                    >
                      Salvar e Conectar
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={handleConnectAction}
                    disabled={integration.isDisabled}
                    className="w-full h-12 rounded-xl font-semibold gap-2 transition-all active:scale-[0.98] shadow-md bg-primary hover:bg-primary/90 text-white"
                  >
                    Conectar Conta do {integration.name}
                    <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                  </Button>
                )}
              </>
            )}

            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1 mt-2"
            >
              {showDetails ? 'Ocultar detalhes técnicos' : 'Mostrar detalhes técnicos'}
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Details Section (Retractable) */}
          <div className={cn(
            "w-full transition-all duration-300 ease-in-out overflow-hidden border-t border-border/40",
            showDetails ? "max-h-[500px] mt-2 opacity-100" : "max-h-0 opacity-0"
          )}>
            <div className="pt-6 space-y-4">
              <div className="bg-secondary/20 rounded-xl p-4 space-y-3 border border-border/40 shadow-sm">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Tipo de Autorização</span>
                  </div>
                  <span className="font-medium text-foreground">{isBrowserLogin ? 'OAuth 2.0 / Browser' : 'API Token'}</span>
                </div>
                
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>Mantenedor</span>
                  </div>
                  <span className="font-medium text-foreground">{integration.author || 'CAPTU Official'}</span>
                </div>

                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ExternalLink className="w-4 h-4" />
                    <span>Website Oficial</span>
                  </div>
                  <a 
                    href={integration.website || '#'} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    {integration.website ? new URL(integration.website).hostname : 'captu.io'}
                  </a>
                </div>
              </div>
              
              <div className="w-full text-center pb-2">
                <button className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 mx-auto">
                  Problemas com a conexão? Fale conosco
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
