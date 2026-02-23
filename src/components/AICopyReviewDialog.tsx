import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Send, MessageSquare, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AICopyReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    copy: string;
    leadName: string;
    onSend: () => void;
    onRegenerate: () => void;
    onWhatsApp: () => void;
    isSending: boolean;
    isRegenerating: boolean;
}

export function AICopyReviewDialog({
    open,
    onOpenChange,
    copy,
    leadName,
    onSend,
    onRegenerate,
    onWhatsApp,
    isSending,
    isRegenerating,
}: AICopyReviewDialogProps) {
    const handleCopy = () => {
        navigator.clipboard.writeText(copy);
        toast.success("Copiado!");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 overflow-hidden border-none bg-background shadow-2xl rounded-3xl">
                {/* Header with gradient and icon */}
                <div className="bg-gradient-to-br from-primary/20 via-primary/5 to-background p-8 pb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Sparkles className="h-24 w-24 text-primary animate-pulse" />
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
                            Estratégia IA Gerada
                        </DialogTitle>
                    </div>

                    <DialogDescription className="text-muted-foreground text-sm font-medium">
                        Personalizada exclusivamente para **{leadName}**. Revise e escolha o melhor canal de envio.
                    </DialogDescription>
                </div>

                {/* Content - The Copy */}
                <div className="px-8 py-2">
                    <div className={cn(
                        "relative bg-muted/30 border border-border/50 rounded-2xl p-6 min-h-[180px] transition-all duration-300",
                        isRegenerating && "opacity-50 grayscale"
                    )}>
                        {isRegenerating ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                <p className="text-xs font-bold text-primary uppercase tracking-widest animate-pulse">Refinando abordagem...</p>
                            </div>
                        ) : (
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap italic font-medium">
                                {copy}
                            </p>
                        )}

                        <div className="absolute top-4 right-4">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full hover:bg-background shadow-sm"
                                onClick={handleCopy}
                            >
                                <Copy className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Footer - Action Buttons */}
                <div className="p-8 pt-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className="h-12 border-primary/20 hover:bg-primary/5 text-primary font-bold rounded-2xl"
                            onClick={onRegenerate}
                            disabled={isRegenerating}
                        >
                            {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                            Regerar
                        </Button>

                        <Button
                            variant="outline"
                            className="h-12 border-green-500/30 hover:bg-green-500/5 text-green-600 dark:text-green-400 font-bold rounded-2xl"
                            onClick={onWhatsApp}
                            disabled={isRegenerating}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            WhatsApp
                        </Button>
                    </div>

                    <Button
                        size="lg"
                        className="h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-xl shadow-primary/20 rounded-2xl"
                        onClick={onSend}
                        disabled={isSending || isRegenerating}
                    >
                        {isSending ? (
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                        )}
                        {isSending ? "Iniciando Automação..." : "Confirmar e Enviar"}
                    </Button>

                    <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">
                        Powered by Gemini 2.0 Flash • TGL Solutions AI
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
