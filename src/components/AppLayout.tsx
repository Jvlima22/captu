import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  Users,
  Megaphone,
  MessageSquare,
  BarChart3,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Menu,
  Blocks,
  Sparkles
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/search", icon: Search, label: "Buscar" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/campaigns", icon: Megaphone, label: "Campanhas" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/contacts", icon: Users, label: "Pipeline" },
  { to: "/metrics", icon: BarChart3, label: "Métricas" },
  { to: "/automations", icon: Zap, label: "Automações" },
  { to: "/agent", icon: Sparkles, label: "CAPTU AI" },
  { to: "/integrations", icon: Blocks, label: "Integrações" },
];

const bottomItems = [
  { to: "/settings", icon: Settings, label: "Configurações" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isPipeline = location.pathname === "/contacts";

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const logoSrc = isDark ? "/captu-white.png" : "/captu.png";

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Logout realizado com sucesso",
        description: "Até logo!",
      });

      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Erro ao fazer logout",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-4 overflow-hidden">
          <Link to="/" className="flex items-center gap-2 overflow-hidden">
            <img
              src={collapsed ? "/sidebar-logo.png" : logoSrc}
              alt="CAPTU Logo"
              className={cn(
                "h-50 w-auto transition-all duration-300",
                collapsed ? "min-w-[16px]" : "min-w-[120px]"
              )}
            />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="animate-fade-in">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="space-y-1 border-t border-sidebar-border px-2 py-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5 shrink-0" />
                <span>Recolher</span>
              </>
            )}
          </button>
          {bottomItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Modo Claro</span>}
              </>
            ) : (
              <>
                <Moon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Modo Escuro</span>}
              </>
            )}
          </button>

          <button
            onClick={() => setLogoutDialogOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex h-20 items-center justify-between border-b border-sidebar-border bg-sidebar px-6 shrink-0 relative">
          <div className="w-12" /> {/* Spacer */}
          <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img src={logoSrc} alt="CAPTU Logo" className="h-11 w-auto" />
          </Link>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-sidebar-border text-sidebar-foreground bg-background/50 shadow-sm transition-transform active:scale-90">
                <Menu className="h-7 w-7" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 border-r-sidebar-border bg-sidebar">
              <SheetHeader className="h-20 border-b border-sidebar-border px-6 flex-row items-center justify-between space-y-0">
                <SheetTitle className="text-left">
                  <img src={logoSrc} alt="CAPTU Logo" className="h-12 w-auto" />
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-[calc(100vh-80px)]">
                <nav className="flex-1 space-y-1 px-2 py-4">
                  {navItems.map((item) => {
                    const active = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="space-y-1 border-t border-sidebar-border px-2 py-4">
                  {bottomItems.map((item) => {
                    const active = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun className="h-5 w-5 shrink-0" />
                        <span>Modo Claro</span>
                      </>
                    ) : (
                      <>
                        <Moon className="h-5 w-5 shrink-0" />
                        <span>Modo Escuro</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setLogoutDialogOpen(true)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-auto bg-background flex flex-col">
          <div className={cn(
            "flex-1 flex flex-col mx-auto w-full",
            location.pathname === "/chat" || location.pathname === "/agent" ? "max-w-full p-0 overflow-hidden" : (isPipeline ? "max-w-full p-4 md:p-6 lg:p-8" : "max-w-7xl p-4 md:p-6 lg:p-8")
          )}>
            {children}
          </div>
          
          <footer className="w-full py-4 text-center text-xs text-sidebar-muted-foreground/60 border-t border-sidebar-border/30 mt-auto">
            <div className="flex justify-center gap-4 mb-1">
              <Link to="/terms-service" className="hover:text-primary transition-colors">Termos de Serviço</Link>
              <Link to="/privacy" className="hover:text-primary transition-colors">Aviso de Privacidade</Link>
            </div>
            <p>© 2026 CAPTU - Inteligência de Mercado</p>
          </footer>
        </main>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será desconectado da sua conta e precisará fazer login novamente para acessar a plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
