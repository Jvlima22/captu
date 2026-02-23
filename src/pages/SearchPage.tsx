import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, MapPin, Building2, Loader2, CheckCircle2, ChevronDown, ChevronUp, Star, Globe, Phone, Filter } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config";

export default function SearchPage() {
  const navigate = useNavigate();
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filtros Avançados
  const [radius, setRadius] = useState([15]); // km
  const [minRating, setMinRating] = useState([0]); // 0-5
  const [minReviews, setMinReviews] = useState(0);
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);

  const handleSearch = async () => {
    if (!niche || !city) return;
    setSearching(true);
    setShowAdvanced(false); // Oculta filtros avançados ao buscar

    try {
      const response = await fetch(`${API_URL}/api/leads/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: niche,
          city: city,
          radius: radius[0] * 1000, // converter km para metros
          minRating: minRating[0],
          minReviews: minReviews,
          onlyWithoutWebsite: onlyWithoutWebsite,
          onlyWithPhone: onlyWithPhone
        }),
      });

      if (!response.ok) throw new Error("Erro na coleta de leads");

      const data = await response.json();
      setResults(data.data || []);

      toast.success(`${data.count || 0} leads coletados e qualificados com sucesso!`, {
        description: "Os leads foram salvos no seu banco de dados.",
        action: {
          label: "Ver Leads",
          onClick: () => navigate("/leads"),
        },
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao conectar com o backend", {
        description: "Verifique se o seu servidor backend está rodando em http://localhost:3000",
      });
    } finally {
      setSearching(false);
    }
  };

  const resetFilters = () => {
    setRadius([15]);
    setMinRating([0]);
    setMinReviews(0);
    setOnlyWithoutWebsite(false);
    setOnlyWithPhone(false);
  };

  return (
    <>
      <PageHeader title="Buscar Empresas" description="Encontre empresas qualificadas por nicho e região usando Google Places" />

      <div className="glass-card rounded-xl p-6 mb-8 max-w-4xl">
        {/* Filtros Básicos */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Nicho / Segmento
              </Label>
              <div className="relative group">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Ex: Oficina Mecânica, Restaurante..."
                  className="pl-10 h-12 md:h-11 transition-all"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Cidade
              </Label>
              <div className="relative group">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Ex: São Paulo, SP"
                  className="pl-10 h-12 md:h-11 transition-all"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Toggle Filtros Avançados */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="bg-background px-4 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showAdvanced ? "Ocultar Filtros Avançados" : "Mostrar Filtros Avançados"}
                {showAdvanced ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>

          {/* Filtros Avançados */}
          {showAdvanced && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              {/* Grid de Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card: Raio de Busca */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-slate-300 dark:border-slate-700 hover:border-primary/30 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-foreground">Raio de Busca</Label>
                        <p className="text-[10px] text-muted-foreground">Distância máxima</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-primary">
                      {radius[0]} km
                    </span>
                  </div>
                  <Slider
                    value={radius}
                    onValueChange={setRadius}
                    min={5}
                    max={50}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                    <span>5 km</span>
                    <span>25 km</span>
                    <span>50 km</span>
                  </div>
                </div>

                {/* Card: Avaliação Mínima */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-500/5 to-transparent border border-slate-300 dark:border-slate-700 hover:border-amber-500/30 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Star className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-foreground">Avaliação Mínima</Label>
                        <p className="text-[10px] text-muted-foreground">Qualidade do negócio</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      {minRating[0] === 0 ? (
                        <span className="text-sm text-muted-foreground">Todas</span>
                      ) : (
                        <>
                          {minRating[0].toFixed(1)}
                          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                        </>
                      )}
                    </span>
                  </div>
                  <Slider
                    value={minRating}
                    onValueChange={setMinRating}
                    min={0}
                    max={5}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                    <span>Sem filtro</span>
                    <span>3.0 ⭐</span>
                    <span>5.0 ⭐</span>
                  </div>
                </div>

                {/* Card: Número Mínimo de Avaliações */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/5 to-transparent border border-slate-300 dark:border-slate-700 hover:border-blue-500/30 transition-all space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Star className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-bold text-foreground">Mínimo de Avaliações</Label>
                      <p className="text-[10px] text-muted-foreground">Evita perfis fantasmas</p>
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ex: 10 avaliações"
                    value={minReviews || ""}
                    onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                    className="w-full h-11 text-center font-bold text-lg"
                  />
                  {minReviews > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium text-center">
                      Apenas empresas com {minReviews}+ avaliações
                    </p>
                  )}
                </div>

                {/* Card: Filtros Rápidos */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-muted/50 to-transparent border border-slate-300 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <Filter className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <Label className="text-sm font-bold text-foreground">Filtros Rápidos</Label>
                      <p className="text-[10px] text-muted-foreground">Critérios especiais</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-destructive/50 hover:bg-destructive/5 transition-all cursor-pointer">
                      <Checkbox
                        id="no-website"
                        checked={onlyWithoutWebsite}
                        onCheckedChange={(checked) => setOnlyWithoutWebsite(checked as boolean)}
                      />
                      <label
                        htmlFor="no-website"
                        className="flex-1 text-sm font-medium cursor-pointer flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-destructive" />
                          Sem site próprio
                        </span>
                        <span className="text-[9px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Oportunidade
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-success/50 hover:bg-success/5 transition-all cursor-pointer">
                      <Checkbox
                        id="with-phone"
                        checked={onlyWithPhone}
                        onCheckedChange={(checked) => setOnlyWithPhone(checked as boolean)}
                      />
                      <label
                        htmlFor="with-phone"
                        className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4 text-success" />
                        Com telefone
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo dos Filtros Ativos */}
              {(radius[0] !== 15 || minRating[0] > 0 || minReviews > 0 || onlyWithoutWebsite || onlyWithPhone) && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtros Ativos:</span>
                      {radius[0] !== 15 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                          Raio: {radius[0]}km
                        </span>
                      )}
                      {minRating[0] > 0 && (
                        <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-medium">
                          Min. {minRating[0]}⭐
                        </span>
                      )}
                      {minReviews > 0 && (
                        <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                          {minReviews}+ avaliações
                        </span>
                      )}
                      {onlyWithoutWebsite && (
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
                          Sem site
                        </span>
                      )}
                      {onlyWithPhone && (
                        <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full font-medium">
                          Com telefone
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="text-xs h-8"
                    >
                      Limpar Tudo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botão de Busca */}
          <Button
            onClick={handleSearch}
            disabled={!niche || !city || searching}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 h-12 text-base"
            size="lg"
          >
            {searching ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Coletando e Qualificando...
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                Buscar e Salvar Leads
              </>
            )}
          </Button>
        </div>
      </div>

      {results && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <p className="text-sm text-muted-foreground">
              {results.length} empresas processadas para <span className="font-bold text-foreground">"{niche}"</span> em <span className="font-bold text-foreground">"{city}"</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/leads")} className="w-full sm:w-auto">
              Ver todos na lista de Leads
            </Button>
          </div>
          {results.slice(0, 10).map((r, i) => (
            <div key={i} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-lg transition-shadow border border-border/50">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-foreground leading-tight">{r.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Score: <span className="text-primary font-bold">{r.score}</span></span>
                    {r.rating && <span className="flex items-center gap-0.5">⭐ {r.rating}</span>}
                    {r.user_ratings_total && <span>({r.user_ratings_total})</span>}
                  </p>
                  {r.phone && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-mono">
                    <Phone className="h-3 w-3" /> {r.phone}
                  </p>}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:justify-end ml-14 sm:ml-0">
                {!r.website ? (
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive text-[10px] font-bold py-0.5 border-destructive/20 uppercase tracking-tighter">Oportunidade: Sem site</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Qualificado</Badge>
                )}
              </div>
            </div>
          ))}
          {results.length > 10 && (
            <p className="text-center text-xs text-muted-foreground pt-4 font-medium italic">...e mais {results.length - 10} leads processados com sucesso.</p>
          )}
        </div>
      )}
    </>
  );
}
