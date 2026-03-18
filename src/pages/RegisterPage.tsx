import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        password: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { theme } = useTheme();

    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const logoSrc = isDark ? "/captu-white.png" : "/captu.png";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handlePhoneChange = (value: string | undefined) => {
        setFormData({
            ...formData,
            phone: value || "",
        });
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast({
                title: "Senhas não coincidem",
                description: "Por favor, verifique se as senhas digitadas são iguais.",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        try {
            const { data: authData, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        phone: formData.phone,
                        company: formData.company,
                    },
                },
            });

            if (error) throw error;

            // Criar perfil manualmente na tabela profiles para garantir persistência dos dados
            if (authData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            first_name: formData.firstName,
                            last_name: formData.lastName,
                            company: formData.company,
                            phone: formData.phone,
                            email: formData.email,
                        }
                    ]);

                if (profileError) {
                    console.error("Erro ao criar perfil automaticamente:", profileError);
                    // Não lançar erro aqui para não bloquear o cadastro principal, 
                    // pois o auth user já foi criado. O trigger do banco pode ter cuidado disso.
                }
            }

            toast({
                title: "Conta criada com sucesso!",
                description: "Verifique seu e-mail para confirmar o cadastro.",
            });

            navigate("/login");
        } catch (error: any) {
            toast({
                title: "Erro ao criar conta",
                description: error.message || "Tente novamente mais tarde.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleMicrosoftSignup = async () => {
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
                title: "Erro ao cadastrar com Microsoft",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side - Registration Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    {/* Logo */}
                    <div className="flex justify-start mb-8">
                        <img
                            src={logoSrc}
                            alt="CAPTU Logo"
                            className="h-12 w-auto"
                        />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold text-[">
                            Crie sua conta gratuita!
                        </h1>
                    </div>

                    {/* Registration Form */}
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="space-y-4">
                            <Label className="text-sm font-medium text-gray-700">
                                Qual seu nome?
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    name="firstName"
                                    type="text"
                                    placeholder="Digite seu nome"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                                />
                                <Input
                                    name="lastName"
                                    type="text"
                                    placeholder="Digite seu sobrenome"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                Qual o e-mail corporativo?
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="Digite seu e-mail"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                                Qual seu telefone?
                            </Label>
                            <div className="flex gap-2">
                                <PhoneNumberInput
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    className="border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                                    Crie uma senha
                                </Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="Digite sua senha"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                                    Confirme sua senha
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="Digite sua senha novamente"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    className="h-11 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-gradient-to-r from-[#182B41] to-[#182B41] hover:from-[#182B41] hover:to-[#182B41] text-white font-medium text-base"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando conta...
                                </>
                            ) : (
                                "Cadastrar"
                            )}
                        </Button>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">OU</span>
                            </div>
                        </div>

                        {/* Microsoft Signup */}
                        <Button
                            type="button"
                            onClick={handleMicrosoftSignup}
                            variant="outline"
                            className="w-full h-12 border-gray-300 hover:bg-gray-100 hover:text-gray-900 font-medium transition-colors"
                        >
                            <svg className="mr-2 h-5 w-5" viewBox="0 0 23 23">
                                <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                                <path fill="#f35325" d="M1 1h10v10H1z" />
                                <path fill="#81bc06" d="M12 1h10v10H12z" />
                                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                <path fill="#ffba08" d="M12 12h10v10H12z" />
                            </svg>
                            Cadastre com Microsoft
                        </Button>

                        <p className="text-xs text-center text-gray-500">
                            Ao avançar, estou concordando com os{" "}
                            <Link to="/terms-service" className="text-[#182B41] hover:text-primary transition-colors">
                                Termos de Serviço
                            </Link>{" "}
                            da Captu.
                        </p>
                    </form>

                    <div className="text-center pt-0">
                        <Link
                            to="/login"
                            className="text-sm text-gray-600 hover:text-gray-900"
                        >
                            Já tem uma conta? <span className="text-[#182B41] hover:text-[#5784F3] transition-colors">Entre.</span>
                        </Link>
                    </div>

                    <div className="pt-8 flex justify-center gap-6 text-xs text-gray-500 font-medium">
                        <Link to="/terms-service" className="hover:text-primary transition-colors">Termos de Serviço</Link>
                        <Link to="/privacy" className="hover:text-primary transition-colors">Aviso de Privacidade</Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Social Proof */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-50 to-white items-center justify-center p-12">
                <div className="max-w-lg space-y-8">
                    <div className="space-y-4">
                        <h2 className="text-3xl font-bold text-gray-900">
                            Algumas das empresas que
                        </h2>
                        <div className="flex justify-center">
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                                confiam na Captu.
                            </h2>
                        </div>
                    </div>

                    {/* Company Logos Grid */}
                    <div className="grid grid-cols-3 gap-8 items-center opacity-60">
                        <div className="h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 font-semibold">
                            LOGO
                        </div>
                        <div className="h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 font-semibold">
                            LOGO
                        </div>
                        <div className="h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 font-semibold">
                            LOGO
                        </div>
                        <div className="h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 font-semibold">
                            LOGO
                        </div>
                        <div className="h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 font-semibold">
                            LOGO
                        </div>
                        <div className="h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 font-semibold">
                            LOGO
                        </div>
                    </div>

                    <div className="text-center pt-8">
                        <p className="text-4xl font-bold text-orange-500">+10000 usuários ativos</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
