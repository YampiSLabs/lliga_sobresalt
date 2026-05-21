import { useState, useMemo } from "preact/hooks";
import {
  Search,
  MapPin,
  Calendar,
  X,
  Flame,
  Link2,
  ArrowRight,
  ShieldAlert,
  ChevronDown
} from "lucide-preact";
import type { Incident } from "../lib/schemas";
import { getMediaUrl } from "../lib/api";

interface Props {
  initialIncidents: Incident[];
  lang?: "ca" | "es" | "en";
}

type SortOption = "date_desc" | "date_asc" | "points_desc" | "points_asc";

export default function IncidentsCatalog({ initialIncidents, lang = "ca" }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minPoints, setMinPoints] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);



  // Dynamic Category Mapping per language
  const CATEGORY_MAP: Record<string, any> = {
    apunyalament: {
      label: { ca: "Navalles", es: "Navajas", en: "Knives" }[lang],
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      badge: { ca: "Ganivets d'Or", es: "Cuchillos de Oro", en: "Golden Knives" }[lang]
    },
    pelea: {
      label: { ca: "Baralles", es: "Peleas", en: "Fights" }[lang],
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      badge: { ca: "Combat Urbà", es: "Combate Urbano", en: "Urban Combat" }[lang]
    },
    robo_violento: {
      label: { ca: "Robatoris", es: "Robos", en: "Robberies" }[lang],
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      badge: { ca: "Saqueig VIP", es: "Saqueo VIP", en: "VIP Looting" }[lang]
    },
    incivismo: {
      label: { ca: "Incivisme", es: "Incivismo", en: "Vandalism" }[lang],
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      badge: { ca: "Mala Vida", es: "Mala Vida", en: "Trashy Life" }[lang]
    },
  };

  // Filter & Sort Logic
  const filteredAndSorted = useMemo(() => {
    let result = [...initialIncidents];

    // Filter by search query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        inc =>
          inc.canonical_title.toLowerCase().includes(q) ||
          inc.satirical_headline?.toLowerCase().includes(q) ||
          inc.short_neutral_summary?.toLowerCase().includes(q) ||
          inc.city?.name.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter(inc => inc.category === selectedCategory);
    }

    // Filter by min points
    if (minPoints > 0) {
      result = result.filter(inc => inc.points >= minPoints);
    }

    // Sort results
    result.sort((a, b) => {
      if (sortBy === "date_desc") {
        const da = a.happened_at ? new Date(a.happened_at).getTime() : 0;
        const db = b.happened_at ? new Date(b.happened_at).getTime() : 0;
        return db - da;
      }
      if (sortBy === "date_asc") {
        const da = a.happened_at ? new Date(a.happened_at).getTime() : 0;
        const db = b.happened_at ? new Date(b.happened_at).getTime() : 0;
        return da - db;
      }
      if (sortBy === "points_desc") {
        return b.points - a.points;
      }
      if (sortBy === "points_asc") {
        return a.points - b.points;
      }
      return 0;
    });

    return result;
  }, [initialIncidents, searchQuery, selectedCategory, minPoints, sortBy]);

  const selectedIncidentData = useMemo(() => {
    if (!selectedIncidentId) return null;
    return initialIncidents.find(inc => inc.id === selectedIncidentId) || null;
  }, [selectedIncidentId, initialIncidents]);

  const formatDateLabel = (dateStr: string | null) => {
    const fallbackText = { ca: "Data desconeguda", es: "Fecha desconocida", en: "Unknown date" }[lang];
    if (!dateStr) return fallbackText;
    try {
      const d = new Date(dateStr);
      const localeStr = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "ca-ES";
      return d.toLocaleDateString(localeStr, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  // Localized general texts
  const textPlaceholder = {
    ca: "Cerca per municipi, paraula clau o titular...",
    es: "Busca por municipio, palabra clave o titular...",
    en: "Search by municipality, keyword or headline...",
  }[lang];

  const textSort = {
    ca: "ORDENA:",
    es: "ORDENA:",
    en: "SORT BY:",
  }[lang];

  const textSortRecent = { ca: "Més recents", es: "Más recientes", en: "Most recent" }[lang];
  const textSortOldest = { ca: "Més antics", es: "Más antiguos", en: "Oldest" }[lang];
  const textSortHighest = { ca: "Màxima puntuació", es: "Máxima puntuación", en: "Highest score" }[lang];
  const textSortLowest = { ca: "Mínima puntuació", es: "Mínima puntuación", en: "Lowest score" }[lang];

  const textMinPoints = {
    ca: "MÍN. PUNTS:",
    es: "MÍN. PUNTOS:",
    en: "MIN. POINTS:",
  }[lang];

  const textFilterCategory = {
    ca: "Filtre Categoria:",
    es: "Filtrar Categoría:",
    en: "Filter Category:",
  }[lang];

  const textAllIncidents = {
    ca: "Tots els sobresalts",
    es: "Todos los sobresaltos",
    en: "All incidents",
  }[lang];

  const textNoResults = {
    ca: "Sense resultats",
    es: "Sin resultados",
    en: "No results",
  }[lang];

  const textNoResultsDesc = {
    ca: "Cap incident s'ajusta a la combinació actual de cerca, puntuació mínima o filtre de categoria seleccionat.",
    es: "Ningún incidente se ajusta a la combinación actual de búsqueda, puntuación mínima o filtro de categoría seleccionado.",
    en: "No incidents match the current search, minimum score, or category filter combination.",
  }[lang];

  const textDrawerLabel = {
    ca: "Detall del Sobresalt",
    es: "Detalle del Sobresalto",
    en: "Incident Details",
  }[lang];

  const textDrawerVerify = {
    ca: "Verificació Satírica",
    es: "Verificación Satírica",
    en: "Satirical Verification",
  }[lang];

  const textDrawerSatQuote = {
    ca: "Titular Satíric de la Lliga",
    es: "Titular Satírico de la Liga",
    en: "League's Satirical Headline",
  }[lang];

  const textDrawerProcessing = {
    ca: "Estem processant el titular satíric...",
    es: "Estamos procesando el titular satírico...",
    en: "Processing satirical headline...",
  }[lang];

  const textDrawerRealFacts = {
    ca: "Fets Reals Publicats",
    es: "Hechos Reales Publicados",
    en: "Published Real Facts",
  }[lang];

  const textDrawerOriginalTitle = {
    ca: "Titular de la Premsa Original:",
    es: "Titular de la Prensa Original:",
    en: "Original Press Headline:",
  }[lang];

  const textDrawerNeutralSummary = {
    ca: "Resum Neutre:",
    es: "Resumen Neutro:",
    en: "Neutral Summary:",
  }[lang];

  const textDrawerHappened = {
    ca: "Succeït:",
    es: "Sucedido:",
    en: "Happened:",
  }[lang];

  const textDrawerVerifiedSources = {
    ca: "Fonts Verificades de Premsa",
    es: "Fuentes Verificadas de Prensa",
    en: "Verified Press Sources",
  }[lang];

  const textDrawerReadArticle = {
    ca: "Llegir notícia",
    es: "Leer noticia",
    en: "Read article",
  }[lang];

  const textDrawerNoSources = {
    ca: "No hi ha cap enllaç font associat registrat.",
    es: "No hay ningún enlace fuente asociado registrado.",
    en: "No associated source link registered.",
  }[lang];

  return (
    <div class="space-y-6 sobresalt-catalog-container">
      {/* 1. Glass Filter & Control HUD Panel */}
      <div class="hud-panel p-5 rounded-2xl bg-slate-950/20 border border-slate-900/60 space-y-4 sobresalt-catalog-filters">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Cyber Search Field */}
          <div class="relative flex-1 max-w-lg">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Search class="h-4.5 w-4.5 text-slate-400" />
            </div>
            <input
              type="text"
              aria-label={textPlaceholder}
              placeholder={textPlaceholder}
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              class="block w-full rounded-xl border border-slate-800 bg-slate-900/30 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:border-amber-500/50 focus:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all duration-200 sobresalt-catalog-search"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label={lang === "en" ? "Clear search" : "Netejar cerca"}
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
              >
                <X class="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sort Selection & Min Points sliders */}
          <div class="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div class="flex items-center gap-2">
              <span class="text-slate-500 font-bold uppercase">{textSort}</span>
              <div class="relative">
                <select
                  value={sortBy}
                  aria-label={textSort}
                  onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as SortOption)}
                  class="appearance-none rounded-lg border border-slate-800 bg-slate-900/40 text-slate-200 px-3 py-1.5 pr-8 text-[11px] font-bold focus:outline-none focus:border-amber-500/50 cursor-pointer sobresalt-catalog-sort"
                >
                  <option value="date_desc">{textSortRecent}</option>
                  <option value="date_asc">{textSortOldest}</option>
                  <option value="points_desc">{textSortHighest}</option>
                  <option value="points_asc">{textSortLowest}</option>
                </select>
                <ChevronDown class="absolute right-2.5 top-2.5 h-3 w-3 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-slate-500 font-bold uppercase">{textMinPoints}</span>
              <input
                type="range"
                min="0"
                max="20"
                step="2"
                value={minPoints}
                aria-label={textMinPoints}
                onInput={(e) => setMinPoints(parseInt((e.target as HTMLInputElement).value))}
                class="w-24 accent-amber-500 cursor-pointer sobresalt-catalog-points-slider"
              />
              <span class="text-amber-500 font-bold font-mono min-w-[20px]">{minPoints}</span>
            </div>
          </div>
        </div>

        {/* Categories filters grid */}
        <div class="flex flex-wrap gap-2 items-center text-[10px] pt-2 border-t border-slate-900/60 sobresalt-catalog-category-tabs">
          <span class="text-slate-500 font-bold uppercase tracking-wider mr-1">{textFilterCategory}</span>
          <button
            onClick={() => setSelectedCategory(null)}
            aria-pressed={selectedCategory === null}
            class={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all duration-200 sobresalt-catalog-category-btn ${
              selectedCategory === null
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {textAllIncidents}
          </button>
          {["apunyalament", "pelea", "robo_violento", "incivismo"].map((catKey) => {
            const mapped = CATEGORY_MAP[catKey];
            if (!mapped) return null;
            const isActive = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                aria-pressed={isActive}
                class={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all duration-200 sobresalt-catalog-category-btn ${
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

      {/* 2. Grid of Incidents */}
      {filteredAndSorted.length > 0 ? (
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 sobresalt-catalog-grid">
          {filteredAndSorted.map((incident, idx) => {
            const mappedCat = CATEGORY_MAP[incident.category] || { label: incident.category, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", badge: "Altres" };
            const isFeatured = idx === 0 && filteredAndSorted.length > 1;
            const colSpan = isFeatured ? "sm:col-span-2 md:col-span-2" : "";
            const minHeight = isFeatured ? "min-h-[320px]" : (idx % 3 === 2 ? "min-h-[300px]" : "min-h-[260px]");
            return (
              <article
                key={incident.id}
                style={{ animationDelay: `${idx * 50}ms` }}
                class={`${colSpan} ${minHeight} hud-panel p-5 rounded-2xl bg-slate-950/20 border border-slate-900/60 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.06)] cursor-pointer sobresalt-catalog-card sobresalt-catalog-card-${incident.id} stagger-fade-in`}
                onClick={() => setSelectedIncidentId(incident.id)}
              >
                {(incident.thumbnail_url || incident.image_url) && (
                  <img
                    src={getMediaUrl(incident.thumbnail_url || incident.image_url) || ""}
                    alt=""
                    class="absolute inset-0 w-full h-full object-cover opacity-5 group-hover:opacity-15 group-hover:scale-105 transition-all duration-750 z-0 pointer-events-none"
                  />
                )}
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none z-0" />

                {/* Header elements */}
                <div class="flex items-center justify-between gap-2 z-10 select-none">
                  <span class="rounded bg-red-500/10 border border-red-500/30 text-red-400 font-extrabold text-[9px] px-2 py-0.5">
                    +{incident.points} PTS
                  </span>
                  <span class="rounded-full bg-slate-900/90 border border-slate-800 text-[8px] font-black uppercase text-amber-400 px-2.5 py-0.5 tracking-wider">
                    {mappedCat.badge}
                  </span>
                </div>

                {/* Satirical Headline & summary */}
                <div class="space-y-2 my-auto pt-6 pb-4 z-10">
                  <h3 class="font-extrabold text-sm leading-snug text-slate-100 group-hover:text-amber-400 transition-colors font-display line-clamp-3 uppercase">
                    {incident.satirical_headline || incident.canonical_title}
                  </h3>
                  <p class="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-3">
                    {incident.short_neutral_summary || "El succés ha sumat punts decisius a la taula general de la temporada."}
                  </p>
                </div>

                {/* Footer specs */}
                <div class="border-t border-slate-900/60 pt-3 flex items-center justify-between mt-auto z-10 text-[8px] font-mono text-slate-500 select-none">
                  <div class="flex items-center gap-1">
                    <MapPin class="h-3 w-3 text-slate-600" />
                    <span class="font-bold text-slate-400">{incident.city?.name || "Catalunya"}</span>
                  </div>
                  <span>
                    {incident.happened_at ? new Date(incident.happened_at).toLocaleDateString(lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "ca-ES", { day: "numeric", month: "short" }) : (lang === "en" ? "Round 12" : "Jornada 12")}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div class="hud-panel p-16 rounded-2xl bg-slate-950/10 border border-slate-900/60 text-center select-none space-y-4">
          <ShieldAlert class="h-12 w-12 text-slate-700 mx-auto" />
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">{textNoResults}</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {textNoResultsDesc}
          </p>
          {(searchQuery || selectedCategory || minPoints > 0) && (
            <button
              onClick={() => { setSearchQuery(""); setSelectedCategory(null); setMinPoints(0); }}
              class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest px-4 py-2 transition-all"
            >
              <X class="h-3 w-3" />
              {lang === "en" ? "Clear all filters" : "Netejar filtres"}
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DETAILED INCIDENT DRAWER OVERLAY */}
      {/* ========================================================================= */}
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
                  <span class="text-[10px] font-black uppercase text-red-500 tracking-wider">{textDrawerLabel}</span>
                  <h3 class="text-lg font-bold font-display">{textDrawerVerify}</h3>
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
              {selectedIncidentData.image_url && (
                <div class="space-y-2 select-none mb-2">
                  <div class="relative w-full h-44 rounded-xl overflow-hidden border border-slate-900 shadow-lg">
                    <img
                      src={getMediaUrl(selectedIncidentData.image_url) || ""}
                      alt=""
                      class="w-full h-full object-cover"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
                  </div>
                  {selectedIncidentData.image_disclaimer && (
                    <p class="text-[10px] text-slate-500 italic text-right font-mono tracking-wide px-1">
                      * {selectedIncidentData.image_disclaimer}
                    </p>
                  )}
                </div>
              )}

              <div class="flex items-center justify-between gap-3 flex-wrap bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                {selectedIncidentData.city && (
                  <div class="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase">
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

              {/* Satirical Headline */}
              <div class="space-y-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">{textDrawerSatQuote}</h4>
                <div class="p-5 rounded-2xl bg-red-500/5 border border-red-500/15 relative overflow-hidden pulse-glow-border">
                  <blockquote class="text-lg font-extrabold leading-snug text-red-100 italic">
                    “{selectedIncidentData.satirical_headline || textDrawerProcessing}”
                  </blockquote>
                </div>
              </div>

              {/* Canonical Facts */}
              <div class="space-y-4 border-t border-slate-800/80 pt-5">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">{textDrawerRealFacts}</h4>

                <div class="space-y-2">
                  <h5 class="text-xs font-bold text-slate-400 select-none">{textDrawerOriginalTitle}</h5>
                  <p class="text-sm font-semibold text-slate-200">{selectedIncidentData.canonical_title}</p>
                </div>

                {selectedIncidentData.short_neutral_summary && (
                  <div class="space-y-2 bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <h5 class="text-xs font-bold text-slate-400 select-none">{textDrawerNeutralSummary}</h5>
                    <p class="text-xs text-slate-300 leading-relaxed">{selectedIncidentData.short_neutral_summary}</p>
                  </div>
                )}

                <div class="flex items-center gap-4 text-xs text-slate-400 border-b border-slate-850 pb-4 select-none">
                  <div class="flex items-center gap-1.5">
                    <Calendar class="h-4 w-4 text-slate-500" />
                    <span>{textDrawerHappened} {formatDateLabel(selectedIncidentData.happened_at)}</span>
                  </div>
                </div>
              </div>

              {/* Whitelisted News Sources */}
              <div class="space-y-4 border-t border-slate-800/80 pt-5">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
                  <ShieldAlert class="h-4 w-4 text-emerald-500" />
                  {textDrawerVerifiedSources}
                </h4>

                <div class="space-y-2">
                  {selectedIncidentData.sources && selectedIncidentData.sources.length > 0 ? (
                    selectedIncidentData.sources.map((src, index) => (
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
                          {textDrawerReadArticle}
                          <ArrowRight class="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </a>
                    ))
                  ) : (
                    <div class="text-xs text-slate-500 bg-slate-900/10 p-4 rounded-xl border border-slate-850 text-center">
                      {textDrawerNoSources}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
