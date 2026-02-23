import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

export default function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  return (
    <div className="glass-card rounded-xl p-4 md:p-5 metric-glow animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-0.5 md:space-y-1 min-w-0 flex-1">
          <p className="text-[10px] md:text-[11px] font-medium text-muted-foreground whitespace-nowrap truncate">{title}</p>
          <p className="text-lg md:text-xl font-bold tracking-tight text-foreground">{value}</p>
          {change && (
            <p
              className={cn(
                "text-[9px] md:text-[10px] font-medium whitespace-nowrap truncate",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-destructive",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-lg bg-accent ml-2">
          <Icon className="h-3.5 w-3.5 md:h-4 w-4 text-accent-foreground" />
        </div>
      </div>
    </div>
  );
}
