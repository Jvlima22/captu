import { cn } from "@/lib/utils";

export default function PageHeader({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-8", className)}>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0 mt-1 sm:mt-0">{children}</div>}
    </div>
  );
}
