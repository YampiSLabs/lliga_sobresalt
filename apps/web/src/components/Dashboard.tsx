import { useState, useMemo } from "preact/hooks";
import type { CityScore, Incident } from "../lib/schemas";
import { getCityShieldSrc } from "../lib/cityShields";
import CataloniaMap from "./CataloniaMap";
import ScoreChart from "./ScoreChart";
import { 
  Search, Trophy, MapPin, Calendar, Flame, Link2, X, 
  AlertTriangle, ArrowRight, ShieldAlert, Award, TrendingUp, Info, HelpCircle
} from "lucide-preact";

type DashboardProps = {
  initialRanking: CityScore[];
  initialIncidents: Incident[];
  fullRankingView?: boolean;
};

// Map categories to user-friendly tags and color styles
const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string; bg: string; border: string; barBg: string; badge: string }> = {
  apunyalament: { label: "Arma blanca", icon: "🔪", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", barBg: "bg-red-500", badge: "Ganivet d'Or 🏆" },
  arma_blanca: { label: "Arma blanca", icon: "🔪", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", barBg: "bg-red-500", badge: "Ganivet d'Or 🏆" },
  homicidio: { label: "Violència", icon: "👊", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", barBg: "bg-rose-500", badge: "Punteria Fina 🎯" },
  robo_violento: { label: "Robos", icon: "👤", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", barBg: "bg-amber-500", badge: "Robo Maestro 👑" },
  pelea: { label: "Peleas", icon: "👊", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", barBg: "bg-yellow-500", badge: "Picante 🌶️" },
  agresion: { label: "Peleas", icon: "👊", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", barBg: "bg-yellow-500", badge: "Picante 🌶️" },
  incivismo: { label: "Incivismo", icon: "🗑️", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", barBg: "bg-blue-500", badge: "Vandalismo 💥" },
  disturbios: { label: "Peleas", icon: "👊", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", barBg: "bg-yellow-500", badge: "Picante 🌶️" },
  transporte_publico: { label: "Incivismo", icon: "🗑️", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", barBg: "bg-blue-500", badge: "Vandalismo 💥" },
  otro_suceso: { label: "Otros", icon: "💬", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", barBg: "bg-slate-400", badge: "Otros 💬" },
  no_relevante: { label: "Otros", icon: "💬", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", barBg: "bg-slate-400", badge: "Otros 💬" },
};

const FALLBACK_SHIELD_CLASS =
  "bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950 shadow-[0_0_8px_rgba(148,163,184,0.2)]";

// Satirical Quotes for Cities in Streak
const CITY_QUOTES: Record<string, string> = {
  badalona: "“No falla ni en el descuento”",
  barcelona: "“Dominio absoluto de la posesión”",
  lleida: "“Rendimiento constante bajo la niebla”",
  tarragona: "“Haciendo historia jornada tras jornada”",
  lhospitalet: "“Presión alta en campo contrario”",
};

export default function Dashboard({ initialRanking, initialIncidents, fullRankingView = false }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHowToScore, setShowHowToScore] = useState(false);
  
  // Active city for Map + Telemetry Showcase
  const [activeCitySlug, setActiveCitySlug] = useState<string | null>("badalona");
  
  // Drawer details states
  const [selectedCitySlug, setSelectedCitySlug] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);

  // Filter ranking based on search query
  const filteredRanking = useMemo(() => {
    if (!searchQuery) return initialRanking;
    const query = searchQuery.toLowerCase();
    return initialRanking.filter(
      item => item.city.name.toLowerCase().includes(query)
    );
  }, [initialRanking, searchQuery]);

  // Filter incidents based on search query AND selected category
  const filteredIncidents = useMemo(() => {
    return initialIncidents.filter(incident => {
      const matchesCategory = !selectedCategory || incident.category === selectedCategory;
      
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        incident.canonical_title.toLowerCase().includes(query) ||
        (incident.satirical_headline && incident.satirical_headline.toLowerCase().includes(query)) ||
        (incident.city?.name && incident.city.name.toLowerCase().includes(query)) ||
        (incident.short_neutral_summary && incident.short_neutral_summary.toLowerCase().includes(query));
      
      return matchesCategory && matchesSearch;
    });
  }, [initialIncidents, selectedCategory, searchQuery]);

  // City in Streak Data (dynamic selector or Badalona default)
  const featuredCityData = useMemo(() => {
    const slug = activeCitySlug || "badalona";
    const scoreInfo = initialRanking.find(item => item.city.slug === slug);
    
    // Simulate streak rounds (e.g. 3 rounds for Badalona)
    let streakRounds = 3;
    if (slug === "barcelona") streakRounds = 4;
    else if (slug === "lleida") streakRounds = 2;
    else if (slug === "lhospitalet") streakRounds = 2;

    return {
      name: scoreInfo?.city.name ?? slug.toUpperCase(),
      slug: slug,
      streak: streakRounds,
      quote: CITY_QUOTES[slug] ?? "“Defensa férrea y contragolpes letales”",
    };
  }, [activeCitySlug, initialRanking]);

  // Calculate dynamic "Top Categorías" telemetry based on current incidents
  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    initialIncidents.forEach(incident => {
      const cat = incident.category;
      counts[cat] = (counts[cat] || 0) + incident.points;
    });

    const list = Object.entries(counts).map(([catKey, totalPoints]) => {
      const mapped = CATEGORY_MAP[catKey] || { label: "Otros", icon: "💬", barBg: "bg-slate-500" };
      return {
        key: catKey,
        label: mapped.label,
        icon: mapped.icon,
        points: totalPoints,
        barBg: mapped.barBg,
      };
    });

    // Group matching categories (e.g., apunyalament + arma_blanca = Arma blanca)
    const grouped: Record<string, { label: string; icon: string; points: number; barBg: string }> = {};
    list.forEach(item => {
      const key = item.label;
      if (!grouped[key]) {
        grouped[key] = { label: item.label, icon: item.icon, points: 0, barBg: item.barBg };
      }
      grouped[key].points += item.points;
    });

    return Object.values(grouped).sort((a, b) => b.points - a.points);
  }, [initialIncidents]);

  // Get data for the selected city (for City Drawer)
  const selectedCityData = useMemo(() => {
    if (!selectedCitySlug) return null;
    const scoreInfo = initialRanking.find(item => item.city.slug === selectedCitySlug);
    const cityIncidents = initialIncidents.filter(incident => incident.city?.slug === selectedCitySlug);
    
    if (!scoreInfo && cityIncidents.length === 0) return null;

    return {
      name: scoreInfo?.city.name || cityIncidents[0]?.city?.name || "Ciutat desconeguda",
      slug: selectedCitySlug,
      points: scoreInfo?.points ?? cityIncidents.reduce((sum, i) => sum + i.points, 0),
      incidents_count: scoreInfo?.incidents_count ?? cityIncidents.length,
      position: scoreInfo?.position ?? null,
      incidents: cityIncidents,
    };
  }, [selectedCitySlug, initialRanking, initialIncidents]);

  // Get data for the selected incident (for Incident Drawer)
  const selectedIncidentData = useMemo(() => {
    if (!selectedIncidentId) return null;
    return initialIncidents.find(incident => incident.id === selectedIncidentId) || null;
  }, [selectedIncidentId, initialIncidents]);

  // Format date strings in Catalan
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Data desconeguda";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ca-ES", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div class="space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. TOP LIVE TICKER BANNER (CAMBIOS EN DIRECTO) */}
      {/* ========================================================================= */}
      <div class="relative w-full rounded-2xl border border-slate-900 bg-slate-950/80 p-3 select-none flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        
        {/* Ticker Row */}
        <div class="flex items-center gap-4 flex-wrap text-[10px] font-black uppercase tracking-wider">
          <div class="flex items-center gap-2 text-red-500 pr-2 border-r border-slate-900 shrink-0">
            <span class="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span class="font-display tracking-widest">CAMBIOS EN DIRECTO</span>
          </div>

          <div class="flex items-center gap-6 flex-wrap text-slate-300">
            <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug("lhospitalet")}>
              <span class="text-green-500">▲</span>
              <span>SUBE:</span>
              <strong class="text-white">L'Hospitalet</strong>
              <span class="text-green-400 font-mono">+7</span>
            </div>
            <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug("badalona")}>
              <span class="text-red-500">▼</span>
              <span>BAJA:</span>
              <strong class="text-white">Badalona</strong>
              <span class="text-red-400 font-mono">-1</span>
            </div>
            <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug("barcelona")}>
              <span class="text-amber-400">★</span>
              <span>LÍDER:</span>
              <strong class="text-white">Barcelona</strong>
              <span class="text-amber-400 font-mono">+12</span>
            </div>
            <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug("lleida")}>
              <span class="text-red-500">🔥</span>
              <span>EN RACHA:</span>
              <strong class="text-white">Lleida</strong>
              <span class="text-green-400 font-mono">+2</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => setShowHowToScore(!showHowToScore)}
          class="shrink-0 flex items-center justify-center gap-1.5 border border-slate-800 bg-slate-900/35 hover:bg-slate-900/80 hover:border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-lg px-3 py-2 transition-all"
        >
          <HelpCircle class="h-3.5 w-3.5" />
          ¿CÓMO SE PUNTÚA?
        </button>
      </div>

      {/* Ticker Interactive Instructions Box */}
      {showHowToScore && (
        <div class="p-5 rounded-2xl border border-slate-900 bg-slate-950/70 backdrop-blur-md space-y-3 animate-slide-in">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Info class="h-4 w-4" /> Sistema de Puntuació de la Lliga
            </h4>
            <button onClick={() => setShowHowToScore(false)} class="text-slate-500 hover:text-slate-300">
              <X class="h-4 w-4" />
            </button>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            La classificació s'elabora de forma totalment automàtica a partir dels successos reals publicats als mitjans de premsa que superen el nostre filtre. Cada tipus d'incident atorga punts positius al municipi:
          </p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold">
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-red-400">🔪 Arma blanca: +12 pts</div>
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-rose-400">👊 Agressions i baralles: +8 pts</div>
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-amber-400">👤 Robatoris violents: +6 pts</div>
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-blue-400">🗑️ Incivisme públic: +4 pts</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FILTRO DE BÚSQUEDA INTERACTIVO (GLASS HEADER) */}
      {/* ========================================================================= */}
      <div class="relative w-full rounded-2xl border border-slate-900/60 bg-slate-950/20 p-4 select-none flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Search Field */}
        <div class="relative flex-1 max-w-md">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search class="h-4.5 w-4.5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cerca municipis, titulars, successos..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            class="block w-full rounded-xl border border-slate-800 bg-slate-900/30 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:border-red-500/50 focus:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all duration-200"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
            >
              <X class="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dynamic Category Buttons */}
        <div class="flex flex-wrap gap-2 items-center text-[10px]">
          <span class="text-slate-500 font-bold uppercase tracking-wider mr-1">Filtre:</span>
          <button
            onClick={() => setSelectedCategory(null)}
            class={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all duration-200 ${
              selectedCategory === null
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            Tots
          </button>
          {["apunyalament", "pelea", "robo_violento", "incivismo"].map((catKey) => {
            const mapped = CATEGORY_MAP[catKey];
            if (!mapped) return null;
            const isActive = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                class={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all duration-200 ${
                  isActive
                    ? `${mapped.bg} ${mapped.border} ${mapped.color}`
                    : "border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                {mapped.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECCIÓN PRINCIPAL - TRIPLE COLUMNA EN DESKTOP */}
      {/* ========================================================================= */}
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        
        {/* COLUMNA 1 (IZQUIERDA): Clasificación (Leaderboard) - lg:col-span-6 */}
        <div class={`${fullRankingView ? "lg:col-span-12" : "lg:col-span-6"} space-y-4`}>
          
          {/* Header Row Table */}
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-900 pb-2">
            <h2 class="text-md font-black tracking-widest uppercase font-display flex items-center gap-2">
              <Trophy class="h-4.5 w-4.5 text-red-500" />
              {fullRankingView ? "CLASSIFICACIÓ DE LA TEMPORADA" : "CLASIFICACIÓN DE LA JORNADA"}
            </h2>
            
            <div class="flex items-center gap-2 text-[10px] text-slate-400 select-none">
              <span class="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-bold">JORNADA 12</span>
              <span>hoy a las 18:40</span>
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          </div>

          {/* Classification Leaderboard Table */}
          <div class="overflow-hidden rounded-xl border border-slate-900 bg-slate-950/20 backdrop-blur-md shadow-lg">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-900 bg-slate-950/50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <th class="px-4 py-3 text-center w-12">#</th>
                  <th class="px-4 py-3">Ciudad</th>
                  <th class="px-4 py-3 text-right">Pts</th>
                  <th class="px-4 py-3 text-center w-24">Incidentes</th>
                  <th class="px-4 py-3 text-center w-24">Racha</th>
                  <th class="px-4 py-3 text-center w-28">Movimiento</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-900/60 font-semibold">
                {filteredRanking.length ? (
                  (fullRankingView ? filteredRanking : filteredRanking.slice(0, 5)).map((row, index) => {
                    const pos = row.position || (index + 1);
                    const isPodium = pos <= 3;
                    const isHovered = activeCitySlug === row.city.slug;
                    
                    // Simulate flames and delta motion to match mockup
                    let flamesCount = 1;
                    let movementHTML = <span class="text-slate-500 font-mono">—</span>;
                    if (row.city.slug === "barcelona") {
                      flamesCount = 4;
                      movementHTML = <span class="text-green-400 font-mono flex items-center justify-center gap-0.5">▲ +12</span>;
                    } else if (row.city.slug === "badalona") {
                      flamesCount = 3;
                      movementHTML = <span class="text-red-400 font-mono flex items-center justify-center gap-0.5">▼ -1</span>;
                    } else if (row.city.slug === "lleida") {
                      flamesCount = 2;
                      movementHTML = <span class="text-green-400 font-mono flex items-center justify-center gap-0.5">▲ +2</span>;
                    } else if (row.city.slug === "lhospitalet") {
                      flamesCount = 2;
                      movementHTML = <span class="text-green-400 font-mono flex items-center justify-center gap-0.5">▲ +7</span>;
                    }

                    const shieldSrc = getCityShieldSrc(row.city.slug);

                    return (
                      <tr 
                        key={row.city.slug} 
                        onClick={() => setSelectedCitySlug(row.city.slug)}
                        onMouseEnter={() => setActiveCitySlug(row.city.slug)}
                        class={`cursor-pointer group transition-all duration-150 ${
                          isHovered 
                            ? "bg-red-500/5 text-slate-100" 
                            : "hover:bg-slate-900/30 text-slate-300"
                        }`}
                      >
                        {/* Position */}
                        <td class="px-4 py-3 text-center font-bold">
                          {isPodium ? (
                            <span class={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black border ${
                              pos === 1 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" 
                              : pos === 2 ? "bg-slate-400/10 text-slate-200 border-slate-400/20" 
                              : "bg-amber-700/10 text-amber-500 border-amber-700/20"
                            }`}>
                              {pos}
                            </span>
                          ) : (
                            <span class="text-slate-500 text-[10px] font-mono">{pos}</span>
                          )}
                        </td>
                        
                        {/* Shield & City Name */}
                        <td class="px-4 py-3">
                          <div class="flex items-center gap-2">
                            {shieldSrc ? (
                              <img
                                src={shieldSrc}
                                alt=""
                                loading="lazy"
                                class="h-5 w-5 shrink-0 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.18)]"
                              />
                            ) : (
                              <div class={`h-4.5 w-4.5 rounded-full ${FALLBACK_SHIELD_CLASS} border border-slate-950 shrink-0`} />
                            )}
                            <span class="font-extrabold group-hover:text-red-400 transition-colors">
                              {row.city.name}
                            </span>
                          </div>
                        </td>
 
                        {/* Points (Red and big!) */}
                        <td class="px-4 py-3 text-right font-black text-red-500 text-sm tabular-nums">
                          {row.points}
                        </td>

                        {/* Incidents */}
                        <td class="px-4 py-3 text-center font-bold text-slate-400 tabular-nums">
                          {row.incidents_count}
                        </td>

                        {/* Racha Flames */}
                        <td class="px-4 py-3 text-center text-orange-500">
                          {"🔥".repeat(flamesCount)}
                        </td>

                        {/* Movement */}
                        <td class="px-4 py-3 text-center text-[10px] font-black">
                          {movementHTML}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} class="px-4 py-8 text-center text-slate-500">
                      <div class="flex flex-col items-center justify-center gap-1.5 py-4">
                        <AlertTriangle class="h-6 w-6 text-red-500/50" />
                        <p class="font-medium">Cap municipi coincideix.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Full ranking link */}
          {!fullRankingView && (
            <a 
              href="./ranking/" 
              class="w-full flex items-center justify-center gap-1.5 border border-slate-900 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-800 text-[9px] font-black uppercase tracking-widest text-red-400 py-3 rounded-xl transition-all"
            >
              VER CLASIFICACIÓN COMPLETA
              <ArrowRight class="h-3 w-3" />
            </a>
          )}
        </div>

        {/* COLUMNA 2 (CENTRAL): Featured City Showcase (Ciudad en Racha) - lg:col-span-3 */}
        {!fullRankingView && (
          <div class="lg:col-span-3 space-y-4">
            
            <div class="border-b border-slate-900 pb-2">
              <h2 class="text-md font-black tracking-widest uppercase font-display flex items-center gap-2 text-slate-400">
                <Flame class="h-4.5 w-4.5 text-amber-500" />
                CIUDAD EN RACHA
              </h2>
            </div>

            {/* Glowing Featured Card */}
            <div class="glass-panel p-4.5 rounded-xl border border-slate-900 flex flex-col justify-between gap-3 shadow-lg relative overflow-hidden select-none min-h-[352px]">
              
              {/* Highlight Headers */}
              <div>
                <span class="block text-[8px] font-black text-amber-400 uppercase tracking-widest mb-0.5">HOT LEADERSHIP</span>
                <h3 class="text-2xl font-black font-display text-amber-500 tracking-tight leading-none uppercase">
                  {featuredCityData.name}
                </h3>
                <span class="inline-block text-[9px] font-black text-white mt-1 border-b border-amber-500/20 pb-0.5">
                  {featuredCityData.streak} JORNADES PUNTUANT
                </span>
              </div>

              {/* Satirical Quote */}
              <blockquote class="text-[11px] font-extrabold italic text-slate-400 border-l-2 border-slate-800 pl-2 py-1 leading-snug">
                {featuredCityData.quote}
              </blockquote>

              {/* SVG Map of Catalonia */}
              <div class="w-full">
                <CataloniaMap 
                  activeCitySlug={featuredCityData.slug} 
                  onCityClick={(slug) => setActiveCitySlug(slug)}
                />
              </div>

              {/* Action Button */}
              <button 
                onClick={() => setSelectedCitySlug(featuredCityData.slug)}
                class="w-full flex items-center justify-center gap-1.5 border border-slate-900 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white py-2.5 rounded-xl transition-all"
              >
                VER PERFIL DE CIUDAD
                <ArrowRight class="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* COLUMNA 3 (DERECHA): Sidebar Widgets (Categories & Score Chart) - lg:col-span-3 */}
        {!fullRankingView && (
          <div class="lg:col-span-3 space-y-5">
            
            {/* Widget A: TOP CATEGORÍAS (JORNADA) */}
            <div class="space-y-3">
              <div class="border-b border-slate-900 pb-2">
                <h3 class="text-[10px] font-black tracking-widest uppercase font-display text-slate-400">
                  TOP CATEGORÍAS (JORNADA)
                </h3>
              </div>

              <div class="rounded-xl border border-slate-900 bg-slate-950/20 p-4 space-y-3 shadow-md">
                {topCategories.slice(0, 5).map((item, idx) => {
                  // Calculate percentage relative to top category score
                  const topScore = topCategories[0]?.points || 100;
                  const pct = Math.max(12, Math.min(100, (item.points / topScore) * 100));
                  
                  return (
                    <div key={idx} class="space-y-1 text-[10px] font-bold">
                      <div class="flex items-center justify-between text-slate-300">
                        <span class="flex items-center gap-1">
                          <span class="text-xs">{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <span class="font-mono text-slate-100">{item.points} pts</span>
                      </div>
                      {/* Technical visual progress bar */}
                      <div class="h-1.5 w-full rounded bg-slate-900 overflow-hidden border border-slate-950">
                        <div 
                          class={`h-full rounded ${item.barBg} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Widget B: EVOLUCIÓN DE PUNTOS LINE CHART */}
            <div class="space-y-3">
              <div class="border-b border-slate-900 pb-2">
                <h3 class="text-[10px] font-black tracking-widest uppercase font-display text-slate-400">
                  EVOLUCIÓN DE PUNTOS
                </h3>
              </div>

              {/* Line Chart */}
              <ScoreChart />
            </div>

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. SECCIÓN SECUNDARIA - FILA 2 (NOTICIAS Y TIMELINE) */}
      {/* ========================================================================= */}
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start border-t border-slate-900 pt-6">
        
        {/* ROW 2 LEFT (EDITORIAL NEWS CARDS GRID): lg:col-span-9 */}
        <div class="lg:col-span-9 space-y-4">
          
          {/* Header Row */}
          <div class="border-b border-slate-900 pb-2">
            <h2 class="text-md font-black tracking-widest uppercase font-display flex items-center gap-2">
              <TrendingUp class="h-4.5 w-4.5 text-red-500" />
              ÚLTIMOS TITULARES QUE SUMAN
            </h2>
          </div>

          {/* Cards Grid */}
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filteredIncidents.slice(0, 4).map((incident, index) => {
              const mappedCat = CATEGORY_MAP[incident.category] || { label: incident.category, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", badge: "Sobresalt 💫" };
              
              // Simulate different stock photography light styles using elegant gradient borders
              const cardBorderColor = index === 0 ? "hover:border-red-500/40" 
                : index === 1 ? "hover:border-amber-500/40" 
                : index === 2 ? "hover:border-emerald-500/40" 
                : "hover:border-purple-500/40";

              return (
                <article 
                  key={incident.id} 
                  onClick={() => setSelectedIncidentId(incident.id)}
                  class={`relative flex flex-col justify-between gap-4 p-4 rounded-xl border border-slate-900 bg-slate-950/60 overflow-hidden cursor-pointer transition-all duration-300 min-h-[260px] ${cardBorderColor} hover:-translate-y-0.5 group`}
                >
                  {/* Incident Background Image with Premium Blending */}
                  {incident.image_url && (
                    <img 
                      src={incident.image_url} 
                      alt="" 
                      class="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-35 group-hover:scale-105 transition-all duration-500 z-0 pointer-events-none" 
                    />
                  )}
                  
                  {/* Visual Editorial Grid Backdrop overlay */}
                  <div class="absolute inset-0 bg-radial-gradient from-slate-900/10 via-slate-950/80 to-slate-950 pointer-events-none z-0" />
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent pointer-events-none z-0" />

                  {/* Card Header (Floating Points & Satirical Badges) */}
                  <div class="flex items-center justify-between gap-2 z-10 select-none">
                    <span class="rounded bg-red-600/10 border border-red-500/35 text-red-400 font-extrabold text-[9px] px-2 py-0.5">
                      +{incident.points} PTS
                    </span>
                    <span class="rounded-full bg-slate-900/90 border border-slate-800 text-[8px] font-black uppercase text-amber-400 px-2.5 py-0.5 tracking-wider">
                      {mappedCat.badge}
                    </span>
                  </div>

                  {/* Card Content (Headline and Summary) */}
                  <div class="space-y-1.5 z-10 mt-auto">
                    <h3 class="font-extrabold text-[13px] leading-snug text-slate-100 group-hover:text-red-400 transition-colors font-display line-clamp-3">
                      {incident.satirical_headline || incident.canonical_title}
                    </h3>
                    <p class="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-3">
                      {incident.short_neutral_summary || "El succés ha sumat punts decisius a la taula general de la temporada."}
                    </p>
                  </div>

                  {/* Card Footer (Source and Relative time) */}
                  <div class="flex items-center justify-between text-[8px] font-black uppercase text-slate-500 border-t border-slate-900 pt-2 z-10 select-none">
                    <span>
                      FUENTE: <strong class="text-slate-400">{incident.sources?.[0]?.outlet_name || "Premsa"}</strong>
                    </span>
                    <span>Hace {2 + index}h</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* More headlines trigger */}
          <div class="flex justify-center pt-2">
            <button 
              onClick={() => {
                alert("Filtratge activat. Fes servir la barra de cerca de dalt per examinar l'historial complet!");
              }}
              class="flex items-center justify-center gap-1.5 border border-slate-900 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white px-5 py-3 rounded-xl transition-all"
            >
              VER MÁS TITULARES
              <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ROW 2 RIGHT (ÚLTIMA HORA FEED): lg:col-span-3 */}
        <div class="lg:col-span-3 space-y-4">
          
          <div class="border-b border-slate-900 pb-2">
            <h2 class="text-md font-black tracking-widest uppercase font-display flex items-center gap-2 text-slate-400">
              <Calendar class="h-4.5 w-4.5 text-slate-500" />
              ÚLTIMA HORA
            </h2>
          </div>

          {/* Timeline Feed Container */}
          <div class="rounded-xl border border-slate-900 bg-slate-950/20 p-4 space-y-4 shadow-md max-h-[294px] overflow-y-auto pr-1 select-none">
            {filteredIncidents.slice(0, 5).map((incident, idx) => {
              const hourStr = `${Math.floor((21 - idx * 1.5 + 24) % 24)}:${String(Math.floor((30 - idx * 12 + 60) % 60)).padStart(2, "0")}`;
              
              return (
                <div 
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  class="flex gap-3 text-[10px] items-start hover:bg-slate-900/20 p-1.5 rounded transition-all cursor-pointer group"
                >
                  {/* Time stamp */}
                  <span class="font-mono text-slate-500 font-bold shrink-0 mt-0.5">{hourStr}</span>
                  
                  {/* Content line */}
                  <div class="space-y-0.5 leading-snug">
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-red-500 font-bold font-mono">+{incident.points} pts</span>
                      <strong class="text-slate-200 group-hover:text-red-400 transition-colors uppercase tracking-wide">
                        {incident.city?.name || "Catalunya"}
                      </strong>
                    </div>
                    <p class="text-slate-400 text-[9px] line-clamp-1 font-medium">{incident.canonical_title}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* View all button */}
          <button 
            onClick={() => {
              alert("Mostrant successos de la jornada 12. Escriu dalt al cercador per buscar de forma interactiva!");
            }}
            class="w-full flex items-center justify-center gap-1.5 border border-slate-900 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-800 text-[9px] font-black uppercase tracking-widest text-red-400 py-3 rounded-xl transition-all"
          >
            VER TODOS LOS INCIDENTES
            <ArrowRight class="h-3 w-3" />
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. PREMIUM GLASS DRAWER SYSTEM (SLIDE-OVER SHEET) */}
      {/* ========================================================================= */}
      
      {/* City Drawer Overlay */}
      {selectedCityData && (
        <div class="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedCitySlug(null)}
            class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          />
          
          {/* Content Pane */}
          <div class="relative w-full max-w-lg h-full glass-panel border-l border-slate-800 flex flex-col text-slate-100 shadow-2xl z-10 transition-transform duration-300 animate-slide-in">
            {/* Header */}
            <div class="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <MapPin class="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <span class="text-[10px] font-black uppercase text-red-500 tracking-wider">Historial del Municipi</span>
                  <h3 class="text-xl font-bold font-display">{selectedCityData.name}</h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCitySlug(null)}
                class="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
            
            {/* Stats Summary Bar */}
            <div class="grid grid-cols-3 divide-x divide-slate-800 bg-slate-950/40 py-4 border-b border-slate-800 text-center select-none">
              <div>
                <span class="block text-[10px] font-bold text-slate-400 uppercase">Classificació</span>
                <span class="text-lg font-black text-white flex items-center justify-center gap-1">
                  {selectedCityData.position ? (
                    <>
                      <Award class="h-4 w-4 text-red-400" />
                      #{selectedCityData.position}
                    </>
                  ) : "-"}
                </span>
              </div>
              <div>
                <span class="block text-[10px] font-bold text-slate-400 uppercase">Punts Totals</span>
                <span class="text-lg font-black text-red-400">{selectedCityData.points} pts</span>
              </div>
              <div>
                <span class="block text-[10px] font-bold text-slate-400 uppercase">Incidentes</span>
                <span class="text-lg font-black text-white">{selectedCityData.incidents_count}</span>
              </div>
            </div>

            {/* List of Incidents in the City */}
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 select-none">Cronologia de Successos</h4>
              
              {selectedCityData.incidents.length ? (
                selectedCityData.incidents.map((incident) => {
                  const mappedCat = CATEGORY_MAP[incident.category] || { label: incident.category, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" };
                  
                  return (
                    <div 
                      key={incident.id}
                      onClick={() => setSelectedIncidentId(incident.id)}
                      class="p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-900/30 hover:border-slate-700 transition-all cursor-pointer space-y-2 relative overflow-hidden group"
                    >
                      <div class="flex justify-between items-center text-xs">
                        <span class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${mappedCat.color} ${mappedCat.bg} ${mappedCat.border}`}>
                          {mappedCat.label}
                        </span>
                        <span class="font-extrabold text-red-400">+{incident.points} pts</span>
                      </div>
                      
                      <h5 class="font-extrabold text-sm leading-snug text-slate-200">
                        {incident.satirical_headline || incident.canonical_title}
                      </h5>
                      
                      {incident.short_neutral_summary && (
                        <p class="text-xs text-slate-400 line-clamp-2">
                          {incident.short_neutral_summary}
                        </p>
                      )}
                      
                      <div class="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-900/60">
                        <span>Ver más detalles</span>
                        <ArrowRight class="h-3 w-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div class="py-12 text-center text-slate-500 text-xs">
                  Aquest municipi encara no té cap incident aprovat en el rànquing actual.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Incident Drawer Overlay */}
      {selectedIncidentData && (
        <div class="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedIncidentId(null)}
            class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          />
          
          {/* Content Pane */}
          <div class="relative w-full max-w-lg h-full glass-panel border-l border-slate-800 flex flex-col text-slate-100 shadow-2xl z-10 transition-transform duration-300 animate-slide-in">
            {/* Header */}
            <div class="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Flame class="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <span class="text-[10px] font-black uppercase text-red-500 tracking-wider">Detall del Sobresalt</span>
                  <h3 class="text-lg font-bold font-display">Verificació Satírica</h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedIncidentId(null)}
                class="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
            
            {/* Details Panel */}
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Optional Incident Image Banner */}
              {selectedIncidentData.image_url && (
                <div class="relative w-full h-44 rounded-xl overflow-hidden border border-slate-900 shadow-lg select-none mb-2">
                  <img 
                    src={selectedIncidentData.image_url} 
                    alt={selectedIncidentData.canonical_title} 
                    class="w-full h-full object-cover" 
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
                </div>
              )}

              {/* Category, points and City */}
              <div class="flex items-center justify-between gap-3 flex-wrap bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                {selectedIncidentData.city && (
                  <div 
                    onClick={() => {
                      setSelectedCitySlug(selectedIncidentData.city!.slug);
                      setSelectedIncidentId(null); // Close current drawer
                    }}
                    class="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase cursor-pointer hover:underline"
                  >
                    <MapPin class="h-4 w-4" />
                    <span>{selectedIncidentData.city.name}</span>
                  </div>
                )}
                <div class="flex items-center gap-2">
                  <span class={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${
                    CATEGORY_MAP[selectedIncidentData.category]?.color || "text-slate-400"
                  } ${
                    CATEGORY_MAP[selectedIncidentData.category]?.bg || "bg-slate-500/10"
                  } ${
                    CATEGORY_MAP[selectedIncidentData.category]?.border || "border-slate-500/20"
                  }`}>
                    {CATEGORY_MAP[selectedIncidentData.category]?.label || selectedIncidentData.category}
                  </span>
                  <span class="rounded-lg bg-red-500/25 border border-red-500/35 text-red-400 px-2 py-0.5 text-xs font-black">
                    +{selectedIncidentData.points} pts
                  </span>
                </div>
              </div>

              {/* Satirical Headline (Prioritized) */}
              <div class="space-y-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">Titular Satíric de la Lliga</h4>
                <div class="p-5 rounded-2xl bg-red-500/5 border border-red-500/15 relative overflow-hidden pulse-glow-border">
                  <blockquote class="text-lg font-extrabold leading-snug text-red-100 italic">
                    “{selectedIncidentData.satirical_headline || "Estem processant el titular satíric..."}”
                  </blockquote>
                </div>
              </div>

              {/* Canonical Facts */}
              <div class="space-y-4 border-t border-slate-800/80 pt-5">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">Fets Reals Publicats</h4>
                
                <div class="space-y-2">
                  <h5 class="text-xs font-bold text-slate-400 select-none">Titular de la Premsa Original:</h5>
                  <p class="text-sm font-semibold text-slate-200">{selectedIncidentData.canonical_title}</p>
                </div>
                
                {selectedIncidentData.short_neutral_summary && (
                  <div class="space-y-2 bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <h5 class="text-xs font-bold text-slate-400 select-none">Resum Neutre:</h5>
                    <p class="text-xs text-slate-300 leading-relaxed">{selectedIncidentData.short_neutral_summary}</p>
                  </div>
                )}
                
                <div class="flex items-center gap-4 text-xs text-slate-400 border-b border-slate-850 pb-4 select-none">
                  <div class="flex items-center gap-1.5">
                    <Calendar class="h-4 w-4 text-slate-500" />
                    <span>Succeït: {formatDate(selectedIncidentData.happened_at)}</span>
                  </div>
                </div>
              </div>

              {/* Whitelisted News Sources */}
              <div class="space-y-4 border-t border-slate-800/80 pt-5">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
                  <ShieldAlert class="h-4 w-4 text-emerald-500" />
                  Fonts Verificades de Premsa
                </h4>
                
                <p class="text-[11px] text-slate-400 leading-relaxed select-none">
                  Aquesta puntuació es basa únicament en successos publicats oficialment per mitjans de premsa. Pots verificar la notícia als mitjans associats a continuació:
                </p>
                
                <div class="space-y-2">
                  {selectedIncidentData.sources && selectedIncidentData.sources.length > 0 ? (
                    selectedIncidentData.sources.map((src: { outlet_name: string; url: string }, index: number) => (
                      <a 
                        key={index}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 hover:border-slate-700 hover:text-amber-400 transition-all text-sm group"
                      >
                        <div class="flex items-center gap-2">
                          <Link2 class="h-4 w-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                          <span class="font-bold text-slate-200 group-hover:text-amber-300">{src.outlet_name}</span>
                        </div>
                        <span class="text-xs text-slate-500 flex items-center gap-1 group-hover:text-amber-400">
                          Llegir notícia
                          <ArrowRight class="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </a>
                    ))
                  ) : (
                    <div class="text-xs text-slate-500 bg-slate-900/10 p-4 rounded-xl border border-slate-850 text-center">
                      No hi ha cap enllaç font associat registrat encara.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Dynamic Slide-in style inject */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (max-width: 640px) {
          @keyframes slideIn {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .animate-slide-in {
            position: fixed;
            bottom: 0;
            right: 0;
            left: 0;
            height: 85vh;
            width: 100% !important;
            max-width: 100% !important;
            border-t: 1px solid rgba(255, 255, 255, 0.08);
            border-l: none !important;
            border-radius: 20px 20px 0 0;
          }
        }
      `}</style>
    </div>
  );
}
