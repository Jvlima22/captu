import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Integration } from "@/components/integrations/types";
import { cn } from "@/lib/utils";

interface IntegrationCardProps {
  integration: Integration;
  onClick: (integration: Integration) => void;
}

export function IntegrationCard({ integration, onClick }: IntegrationCardProps) {
  return (
    <div 
      onClick={() => !integration.isDisabled && onClick(integration)}
      className={cn(
        "group relative bg-card border border-border/50 rounded-xl p-5 transition-all duration-300 overflow-hidden",
        integration.isDisabled 
          ? "cursor-not-allowed filter-none" 
          : "cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-1",
        "flex flex-row items-center gap-4"
      )}
    >
      {/* Tooltip for disabled state */}
      {integration.isDisabled && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/10 backdrop-blur-[1px] group-hover:bg-background/20 transition-all opacity-0 group-hover:opacity-100">
           <span className="bg-foreground/90 text-background text-[10px] font-bold px-2 py-1 rounded uppercase tracking-tighter shadow-lg">
             Em breve
           </span>
        </div>
      )}
      {/* Icon Container */}
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center p-1 transition-transform group-hover:scale-110">
        <img 
          src={integration.icon} 
          alt={integration.name} 
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/2885/2885417.png";
          }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-foreground/90 group-hover:text-primary transition-colors truncate">
            {integration.name}
          </h3>
          {integration.isNew && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-none text-[10px] font-bold px-1.5 py-0 h-4 leading-none uppercase tracking-wider">
              NOVO
            </Badge>
          )}
          {integration.status === 'connected' && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-none text-[10px] font-bold px-1.5 py-0 h-4 leading-none uppercase tracking-wider">
              CONECTADO
            </Badge>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-snug">
          {integration.description}
        </p>
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
