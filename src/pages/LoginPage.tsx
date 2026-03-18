import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { theme } = useTheme();

    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const logoSrc = isDark ? "/captu.png" : "/captu.png";

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            toast({
                title: "Login realizado com sucesso!",
                description: "Bem-vindo de volta.",
            });

            navigate("/");
        } catch (error: any) {
            toast({
                title: "Erro ao fazer login",
                description: error.message || "Verifique suas credenciais e tente novamente.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/`,
                },
            });

            if (error) throw error;
        } catch (error: any) {
            toast({
                title: "Erro ao fazer login com Google",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleMicrosoftLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "azure",
                options: {
                    redirectTo: `${window.location.origin}/`,
                },
            });

            if (error) throw error;
        } catch (error: any) {
            toast({
                title: "Erro ao fazer login com Microsoft",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Login Form */}
            <div className="w-full lg:w-1/1 flex items-center justify-center bg-[#E3E7E8] p-8">
                <div className="w-full max-w-md space-y-6">
                    {/* Logo */}
                    <div className="flex justify-start mb-0 mt-10 mr-20">
                        <img
                            src={logoSrc}
                            alt="CAPTU Logo"
                            className="h-16 w-auto"
                        />
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-[#182B41] text-sm">
                                E-mail
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Digite seu e-mail"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-[white] border-0 h-10 w-[340px] text-[gray-900] placeholder:text-gray-400"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-[#182B41] text-sm">
                                Senha
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Digite sua senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-white border-0 h-10 w-[340px] text-gray-900 placeholder:text-gray-400"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Link
                                to="/forgot-password"
                                className="text-sm text-[#182B41] hover:text-[#5784F3] transition-colors"
                            >
                                Esqueceu a senha?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-[340px] h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium text-base"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                "Entrar"
                            )}
                        </Button>

                        <div className="text-start ">
                            <Link
                                to="/register"
                                className="text-sm text-[#182B41] hover:text-[#5784F3] transition-colors"
                            >
                                Não possui uma conta na Captu? Cadastre-se aqui!
                            </Link>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-[340px] border-t border-gray-600"></div>
                            </div>
                            <div className="relative w-[340px] flex justify-center text-sm">
                                <span className="px-2 bg-[#E3E7E8] text-gray-400">OU</span>
                            </div>
                        </div>

                        {/* Social Login Buttons */}
                        <div className="space-y-3">
                            <Button
                                type="button"
                                onClick={handleMicrosoftLogin}
                                variant="outline"
                                className="w-[340px] h-12 bg-white hover:bg-gray-100 hover:text-gray-900 text-gray-900 border-0 font-medium transition-colors"
                            >
                                <svg className="mr-2 h-5 w-5" viewBox="0 0 23 23">
                                    <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                                    <path fill="#f35325" d="M1 1h10v10H1z" />
                                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                                </svg>
                                Entrar com Microsoft
                            </Button>

                            <Button
                                type="button"
                                onClick={handleGoogleLogin}
                                variant="outline"
                                className="w-[340px] h-12 bg-white hover:bg-gray-100 hover:text-gray-900 text-gray-900 border-0 font-medium transition-colors"
                            >
                                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Entrar com Google
                            </Button>
                        </div>
                    </form>
                    
                    <div className="pt-8 flex justify-center gap-6 text-xs text-gray-500 font-medium">
                        <Link to="/terms-service" className="hover:text-primary transition-colors">Termos de Serviço</Link>
                        <Link to="/privacy" className="hover:text-primary transition-colors">Aviso de Privacidade</Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Decorative */}
            <div className="hidden lg:block lg:w-1/2 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full">
                    <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[#1e293b] to-transparent opacity-80 transform rotate-12 translate-x-1/4 -translate-y-1/4"></div>
                    <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-purple-400 via-cyan-400 to-transparent opacity-60 rounded-full transform -translate-x-1/3 translate-y-1/3"></div>
                </div>
            </div>
        </div>
    );
}
