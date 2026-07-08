import { useEffect, useMemo, useState } from "preact/hooks";
import {
  Search,
  MapPin,
  TrendingUp,
  Calendar,
  HelpCircle,
  ArrowRight,
  X,
  Flame,
  Link2,
  Info,
  ShieldAlert,
  Star,
  Diamond,
  Crosshair,
  Zap,
  User,
  Trash2
} from "lucide-preact";
import CataloniaMap from "./CataloniaMap";
import RankingTable from "./RankingTable";
import CityDashboard from "./CityDashboard";
import ScoreChart from "./ScoreChart";
import { getRanking, getMediaUrl } from "../lib/api";
import { shouldRefreshInitialRanking } from "../lib/rankingRefresh";
import type { CityScore, Incident, Season, RoundBrief } from "../lib/schemas";
import { type LanguageCode, useCategory, formatRelativeTime } from "../lib/i18n";

interface Props {
  initialRanking: CityScore[];
  initialIncidents: Incident[];
  initialSeasons?: Season[];
  fullRankingView?: boolean;
  lang?: LanguageCode;
}

export default function Dashboard({ initialRanking, initialIncidents, initialSeasons = [], fullRankingView = false, lang = "ca" }: Props) {

  const CATEGORY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
    apunyalament: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
    pelea: { color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    robo_violento: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    incivismo: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  };
  // --- STATE ---
  const [ranking, setRanking] = useState<CityScore[]>(initialRanking);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [activeCitySlug, setActiveCitySlug] = useState<string | null>("barcelona");
  const [selectedCitySlug, setSelectedCitySlug] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHowToScore, setShowHowToScore] = useState(false);

  useEffect(() => {
    if (!shouldRefreshInitialRanking(initialRanking)) return;

    let isCancelled = false;
    setIsLoadingRanking(true);
    getRanking(undefined, lang)
      .then((data) => {
        if (!isCancelled) {
          setRanking(data);
        }
      })
      .catch((err) => {
        console.error("Error refreshing initial ranking:", err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingRanking(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [initialRanking, lang]);

  // --- DERIVED DATA ---

  // Find active season or default to first season
  const activeSeason = useMemo(() => {
    if (!initialSeasons || initialSeasons.length === 0) return null;
    return initialSeasons.find(s => s.status === "Activa") || initialSeasons[0];
  }, [initialSeasons]);

  // Extract rounds from API data only. Public builds must not invent rounds.
  const rounds = useMemo((): RoundBrief[] => {
    if (activeSeason && activeSeason.rounds && activeSeason.rounds.length > 0) {
      return activeSeason.rounds.map(r => ({
        ...r,
        name: lang === "en" ? r.name.replace("Jornada", "Round") : r.name
      }));
    }
    return [];
  }, [activeSeason, lang]);

  const selectedRoundObj = useMemo(() => {
    if (selectedRoundId === null) return null;
    return rounds.find(r => r.id === selectedRoundId) || null;
  }, [rounds, selectedRoundId]);

  // Handle switching rounds dynamically
  const handleSelectRound = async (roundId: number | null) => {
    setSelectedRoundId(roundId);
    setIsLoadingRanking(true);
    try {
      const data = await getRanking(roundId || undefined);
      setRanking(data);
    } catch (err) {
      console.error("Error loading ranking for round:", err);
    } finally {
      setIsLoadingRanking(false);
    }
  };

  // 1. Filtering Logic (Search & Category & Round Dates)
  const filteredRanking = useMemo(() => {
    return ranking.filter(item =>
      item.city.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ranking, searchQuery]);

  const filteredIncidents = useMemo(() => {
    return initialIncidents.filter(incident => {
      // Filter by round dates if a round is selected
      if (selectedRoundObj && selectedRoundObj.starts_at && selectedRoundObj.ends_at) {
        if (!incident.happened_at) return false;
        const incTime = new Date(incident.happened_at).getTime();
        const start = new Date(selectedRoundObj.starts_at).getTime();
        const end = new Date(selectedRoundObj.ends_at).getTime();
        if (incTime < start || incTime > end) return false;
      }

      const matchesSearch =
        incident.canonical_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.city?.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = !selectedCategory || incident.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [initialIncidents, searchQuery, selectedCategory, selectedRoundObj]);

  // 2. Statistics for Sidebar
  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIncidents.forEach(inc => {
      counts[inc.category] = (counts[inc.category] || 0) + inc.points;
    });
    return Object.entries(counts)
      .map(([key, points]) => ({
        key,
        points,
        style: CATEGORY_STYLES[key] || { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
        barBg: (CATEGORY_STYLES[key]?.bg.replace("/10", "/40") || "bg-slate-700")
      }))
      .sort((a, b) => b.points - a.points);
  }, [filteredIncidents]);

  // 3. Featured City Data
  const featuredCityData = useMemo(() => {
    const leader = ranking[0];
    if (!leader) return null;
    const streak = Math.max(1, Math.min(4, Math.floor(leader.points / 10) + 1));
    return {
      ...leader,
      name: leader.city.name,
      slug: leader.city.slug,
      streak: streak,
      quote: {
        ca: "S'ha consolidat com a líder indiscutible gràcies a una jornada d'infart als carrers.",
        es: "Se ha consolidado como líder indiscutible gracias a una jornada de infarto en las calles.",
        en: "It has consolidated itself as the undisputed leader thanks to a heart-stopping round on the streets."
      }[lang]
    };
  }, [ranking, lang]);

  // 3b. Ticker Data for top bar ("CAMBIOS EN DIRECTO")
  const tickerData = useMemo(() => {
    const mapped = ranking.map((row, index) => {
      const position = row.position || (index + 1);
      const streak = Math.max(1, Math.min(4, Math.floor(row.points / 10) + 1));

      let trend: "up" | "down" | "stable" = "stable";
      let delta = 0;

      if (row.points > 0) {
        if (position <= 2) {
          trend = "up";
          delta = row.points;
        } else if (position >= 5) {
          trend = "down";
          delta = -Math.round(row.points * 0.1 * 10) / 10 || -1;
        } else {
          trend = "stable";
          delta = 0;
        }
      }
      return {
        ...row,
        position,
        streak,
        trend,
        delta
      };
    });

    const leader = mapped[0] || null;
    if (!leader) return null;

    const sube = mapped.find(r => r.trend === "up" && r.city.slug !== leader.city.slug) ||
                 mapped[1] ||
                 { ...leader, delta: leader.points };

    const baja = mapped.find(r => r.trend === "down") ||
                 (mapped.length > 2 ? mapped[mapped.length - 1] : leader);

    const enRacha = [...mapped].sort((a, b) => b.streak - a.streak)[0] || leader;

    return { leader, sube, baja, enRacha };
  }, [ranking]);

  // 3c. Points progression Chart Data for ScoreChart
  const chartData = useMemo(() => {
    const chronologicalRounds = [...rounds].reverse();
    const roundsNames = chronologicalRounds.map(r => r.name);

    const topCities = ranking.slice(0, 4).map(item => ({
      name: item.city.name,
      slug: item.city.slug
    }));

    const finalCities = [...topCities];

    const colors = [
      { color: "rgb(239, 68, 68)", glowColor: "rgba(239, 68, 68, 0.4)" }, // Red
      { color: "rgb(245, 158, 11)", glowColor: "rgba(245, 158, 11, 0.4)" }, // Amber
      { color: "rgb(59, 130, 246)", glowColor: "rgba(59, 130, 246, 0.4)" }, // Blue
      { color: "rgb(168, 85, 247)", glowColor: "rgba(168, 85, 247, 0.4)" }  // Purple
    ];

    const citiesData = finalCities.map((city, cityIdx) => {
      let cumulativeScore = 0;
      const points = chronologicalRounds.map((round, rIdx) => {
        let roundScore = 0;
        if (round.starts_at && round.ends_at) {
          const start = new Date(round.starts_at).getTime();
          const end = new Date(round.ends_at).getTime();

          const roundIncidents = initialIncidents.filter(inc => {
            if (!inc.city || inc.city.slug !== city.slug || !inc.happened_at) return false;
            const incTime = new Date(inc.happened_at).getTime();
            return incTime >= start && incTime <= end;
          });

          roundScore = roundIncidents.reduce((sum, inc) => sum + inc.points, 0);
        }
        cumulativeScore += roundScore;
        return {
          roundIndex: rIdx,
          score: cumulativeScore
        };
      });

      return {
        name: city.name,
        slug: city.slug,
        color: colors[cityIdx]?.color || "rgb(148, 163, 184)",
        glowColor: colors[cityIdx]?.glowColor || "rgba(148, 163, 184, 0.4)",
        points
      };
    });

    return { citiesData, roundsNames };
  }, [rounds, ranking, initialIncidents]);

  // 4. Detailed Data for Modal/Drawers
  const selectedCityData = useMemo(() => {
    if (!selectedCitySlug) return null;
    const item = ranking.find(c => c.city.slug === selectedCitySlug);
    if (!item) return null;

    // Find incidents for this city
    const cityIncidents = filteredIncidents.filter(inc => inc.city?.slug === selectedCitySlug);

    return { ...item, incidents: cityIncidents };
  }, [selectedCitySlug, ranking, filteredIncidents]);

  // 4b. Dynamic points progression for the selected city profile chart
  const selectedCityChartData = useMemo(() => {
    if (!selectedCitySlug) return null;
    const chronologicalRounds = [...rounds].reverse();
    const roundsNames = chronologicalRounds.map(r => r.name.replace("Jornada ", "J"));

    let cumulativeScore = 0;
    const historyPoints = chronologicalRounds.map(round => {
      let roundScore = 0;
      if (round.starts_at && round.ends_at) {
        const start = new Date(round.starts_at).getTime();
        const end = new Date(round.ends_at).getTime();

        const roundIncidents = initialIncidents.filter(inc => {
          if (!inc.city || inc.city.slug !== selectedCitySlug || !inc.happened_at) return false;
          const incTime = new Date(inc.happened_at).getTime();
          return incTime >= start && incTime <= end;
        });

        roundScore = roundIncidents.reduce((sum, inc) => sum + inc.points, 0);
      }
      cumulativeScore += roundScore;
      return cumulativeScore;
    });

    return { historyPoints, roundsNames };
  }, [selectedCitySlug, rounds, initialIncidents]);

  const selectedIncidentData = useMemo(() => {
    if (!selectedIncidentId) return null;
    return initialIncidents.find(incident => incident.id === selectedIncidentId) || null;
  }, [selectedIncidentId, initialIncidents]);

  // Format date strings dynamically
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) {
      return { ca: "Data desconeguda", es: "Fecha desconocida", en: "Unknown date" }[lang];
    }
    try {
      const d = new Date(dateStr);
      const localeMap = { ca: "ca-ES", es: "es-ES", en: "en-US" };
      return d.toLocaleDateString(localeMap[lang], { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div class="space-y-6">

      {/* ========================================================================= */}
      {/* 1. TOP LIVE TICKER BANNER (CAMBIOS EN DIRECTO) */}
      {/* ========================================================================= */}
      <div
        class="relative w-full rounded-2xl border border-slate-900 bg-slate-950/80 p-3 select-none flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      >

        {/* Ticker Row */}
        <div class="flex items-center gap-4 flex-wrap text-[10px] font-black uppercase tracking-wider">
          <div class="flex items-center gap-2 text-red-500 pr-2 border-r border-slate-900 shrink-0">
            <span class="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span class="font-display tracking-widest">
              {{ ca: "CANVIS EN DIRECTE", es: "CAMBIOS EN DIRECTO", en: "LIVE CHANGES" }[lang]}
            </span>
          </div>

          {tickerData ? (
            <div class="flex items-center gap-6 flex-wrap text-slate-300">
              <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug(tickerData.sube.city.slug)}>
                <span class="text-green-500">▲</span>
                <span>{{ ca: "PUJA:", es: "SUBE:", en: "UP:" }[lang]}</span>
                <strong class="text-white">{tickerData.sube.city.name}</strong>
                <span class="text-green-400 font-mono">+{tickerData.sube.delta}</span>
              </div>
              <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug(tickerData.baja.city.slug)}>
                <span class="text-red-500">▼</span>
                <span>{{ ca: "BAIXA:", es: "BAJA:", en: "DOWN:" }[lang]}</span>
                <strong class="text-white">{tickerData.baja.city.name}</strong>
                <span class="text-red-400 font-mono">{tickerData.baja.delta < 0 ? tickerData.baja.delta : `-${tickerData.baja.delta}`}</span>
              </div>
              <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug(tickerData.leader.city.slug)}>
                <Star class="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span>{{ ca: "LÍDER:", es: "LÍDER:", en: "LEADER:" }[lang]}</span>
                <strong class="text-white">{tickerData.leader.city.name}</strong>
                <span class="text-amber-400 font-mono">+{tickerData.leader.points}</span>
              </div>
              <div class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => setActiveCitySlug(tickerData.enRacha.city.slug)}>
                <Flame class="h-3.5 w-3.5 text-red-500 fill-red-500" />
                <span>{{ ca: "EN RATXA:", es: "EN RACHA:", en: "ON FIRE:" }[lang]}</span>
                <strong class="text-white">{tickerData.enRacha.city.name}</strong>
                <span class="text-green-400 font-mono">+{tickerData.enRacha.delta || 0}</span>
              </div>
            </div>
          ) : (
            <div class="text-slate-500">
              {{ ca: "SENSE DADES EN DIRECTE", es: "SIN DATOS EN DIRECTO", en: "NO LIVE DATA" }[lang]}
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowHowToScore(!showHowToScore)}
          class="shrink-0 flex items-center justify-center gap-1.5 border border-slate-800 bg-slate-900/35 hover:bg-slate-900/80 hover:border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-lg px-3 py-2 transition-all"
        >
          <HelpCircle class="h-3.5 w-3.5" />
          {{ ca: "COM ES PUNTUA?", es: "¿CÓMO SE PUNTÚA?", en: "HOW IS IT SCORED?" }[lang]}
        </button>
      </div>

      {/* Ticker Interactive Instructions Box */}
      {showHowToScore && (
        <div
          class="p-5 rounded-2xl border border-slate-900 bg-slate-950/70 backdrop-blur-md space-y-3 overflow-hidden"
        >
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Info class="h-4 w-4" /> {{ ca: "Sistema de Puntuació de la Lliga", es: "Sistema de Puntuación de la Liga", en: "League Scoring System" }[lang]}
            </h4>
            <button onClick={() => setShowHowToScore(false)} class="text-slate-500 hover:text-slate-300">
              <X class="h-4 w-4" />
            </button>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            {{
              ca: "La classificació s'elabora de forma totalment automàtica a partir dels successos reals publicats als mitjans de premsa que superen el nostre filtre. Cada tipus d'incident atorga punts positius al municipi:",
              es: "La clasificación se elabora de forma totalmente automática a partir de los sucesos reales publicados en los medios de prensa que superan nuestro filtro. Cada tipo de incidente otorga puntos positivos al municipio:",
              en: "The ranking is compiled fully automatically based on real events published in news media that pass our filter. Each type of incident grants positive points to the municipality:"
            }[lang]}
          </p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold">
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-red-400 flex items-center gap-1.5">
              <Crosshair class="h-3 w-3 shrink-0" /> {{ ca: "Arma blanca: +12 pts", es: "Arma blanca: +12 pts", en: "Knife: +12 pts" }[lang]}
            </div>
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-rose-400 flex items-center gap-1.5">
              <Zap class="h-3 w-3 shrink-0" /> {{ ca: "Agressions i baralles: +8 pts", es: "Agresiones y peleas: +8 pts", en: "Assaults and fights: +8 pts" }[lang]}
            </div>
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-amber-400 flex items-center gap-1.5">
              <User class="h-3 w-3 shrink-0" /> {{ ca: "Robatoris violents: +6 pts", es: "Robos violentos: +6 pts", en: "Violent robberies: +6 pts" }[lang]}
            </div>
            <div class="bg-slate-900/30 p-2.5 rounded-lg border border-slate-900 text-blue-400 flex items-center gap-1.5">
              <Trash2 class="h-3 w-3 shrink-0" /> {{ ca: "Incivisme públic: +4 pts", es: "Incivismo público: +4 pts", en: "Public vandalism: +4 pts" }[lang]}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ROUNDS SELECTOR HUD (LOBBY DE VIDEOJOC / E-SPORTS) */}
      {/* ========================================================================= */}
      <div id="jornades" class="scroll-mt-24 space-y-3">
        <div class="flex items-center justify-between border-b border-slate-900 pb-2 select-none">
          <h2 class="text-[10px] font-black tracking-widest uppercase font-display flex items-center gap-2 text-slate-400">
            <Calendar class="h-4 w-4 text-amber-500 animate-pulse" />
            {{ ca: "CONTROL DE JORNADES (SOCIETAT IL·LIMITADA)", es: "CONTROL DE JORNADAS (SOCIEDAD ILIMITADA)", en: "ROUND CONTROL (UNLIMITED SOCIETY)" }[lang]}
          </h2>
          {selectedRoundObj ? (
            <span class="font-mono text-[9px] text-amber-500 font-extrabold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
              {{ ca: `MOSTRANT: ${selectedRoundObj.name}`, es: `MOSTRANDO: ${selectedRoundObj.name}`, en: `SHOWING: ${selectedRoundObj.name}` }[lang]}
            </span>
          ) : (
            <span class="font-mono text-[9px] text-slate-500 font-extrabold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase">
              {{ ca: "MOSTRANT: ACUMULAT GENERAL", es: "MOSTRANDO: ACUMULADO GENERAL", en: "SHOWING: GENERAL ACCUMULATION" }[lang]}
            </span>
          )}
        </div>

        <div class="relative w-full">
          <div class="flex overflow-x-auto gap-3.5 scrollbar-none pb-2 select-none px-1">
            {/* General Tab */}
            <button
              onClick={() => handleSelectRound(null)}
              aria-pressed={selectedRoundId === null}
              aria-label={{ ca: "Mostrar acumulat general", es: "Mostrar acumulado general", en: "Show general accumulation" }[lang]}
              class={`flex-shrink-0 flex flex-col justify-between items-start p-4 rounded-xl border min-w-[140px] transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                selectedRoundId === null
                  ? "bg-amber-500/5 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                  : "bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
              }`}
            >
              <span class="font-mono text-[8px] font-black uppercase tracking-wider text-slate-500">
                {{ ca: "TEMPORADA COMPLETA", es: "TEMPORADA COMPLETA", en: "FULL SEASON" }[lang]}
              </span>
              <span class="font-display font-black text-xs uppercase tracking-tight mt-1 text-slate-100">
                {{ ca: "ACUMULAT", es: "ACUMULADO", en: "ACCUMULATED" }[lang]}
              </span>
              <span class="inline-flex items-center gap-1.5 font-mono text-[8px] font-bold text-slate-400 mt-2 bg-slate-900/60 border border-slate-800 px-1.5 py-0.5 rounded">
                <Zap class="h-3 w-3 shrink-0" /> {{ ca: "GENERAL", es: "GENERAL", en: "GENERAL" }[lang]}
              </span>
            </button>

            {/* Rounds List */}
            {rounds.map((rnd) => {
              const isSelected = selectedRoundId === rnd.id;
              const isActive = rnd.status === "active" || rnd.status === "open" || rnd.status === "Activa";
              const isClosed = rnd.status === "closed" || rnd.status === "completed" || rnd.status === "Finalitzada";

              return (
                <button
                  key={rnd.id}
                  onClick={() => handleSelectRound(rnd.id)}
                  aria-pressed={isSelected}
                  aria-label={`${lang === "en" ? "Show round" : "Mostrar"} ${rnd.name}`}
                  class={`flex-shrink-0 flex flex-col justify-between items-start p-4 rounded-xl border min-w-[160px] transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/5 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : "bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span class="font-mono text-[8px] font-black uppercase tracking-wider text-slate-500">
                    {{ ca: "SOCIETAT LIMITADA", es: "SOCIEDAD LIMITADA", en: "LIMITED SOCIETY" }[lang]}
                  </span>
                  <span class="font-display font-black text-xs uppercase tracking-tight mt-1 text-slate-100">{rnd.name}</span>

                  <div class="mt-2.5 flex items-center justify-between w-full">
                    {isActive ? (
                      <span class="inline-flex items-center gap-1.5 font-mono text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase animate-pulse">
                        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {{ ca: "EN DIRECTE", es: "EN DIRECTO", en: "LIVE" }[lang]}
                      </span>
                    ) : isClosed ? (
                      <span class="inline-flex items-center gap-1.5 font-mono text-[8px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase">
                        {{ ca: "COMPLETADA", es: "COMPLETADA", en: "COMPLETED" }[lang]}
                      </span>
                    ) : (
                      <span class="inline-flex items-center gap-1.5 font-mono text-[8px] font-black text-slate-500 bg-slate-900 border border-slate-855 px-1.5 py-0.5 rounded uppercase">
                        {{ ca: "PROPERAMENT", es: "PRÓXIMAMENTE", en: "COMING SOON" }[lang]}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTRO DE BÚSQUEDA INTERACTIVO (GLASS HEADER) */}
      {/* ========================================================================= */}
      <div
        class="relative w-full rounded-2xl border border-slate-900/60 bg-slate-950/20 p-4 select-none flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >

        {/* Search Field */}
        <div class="relative flex-1 max-w-md">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search class="h-4.5 w-4.5 text-slate-400" />
          </div>
          <input
            type="text"
            aria-label={{ ca: "Cerca municipis, titulars, successos", es: "Busca municipios, titulares, sucesos", en: "Search municipalities, headlines, events" }[lang]}
            placeholder={{ ca: "Cerca municipis, titulars, successos...", es: "Busca municipios, titulares, sucesos...", en: "Search municipalities, headlines, events..." }[lang]}
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            class="block w-full rounded-xl border border-slate-800 bg-slate-900/30 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:border-red-500/50 focus:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label={{ ca: "Netejar cerca", es: "Limpiar búsqueda", en: "Clear search" }[lang]}
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
            >
              <X class="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dynamic Category Buttons */}
        <div class="flex flex-wrap gap-2 items-center text-[10px]">
          <span class="text-slate-500 font-bold uppercase tracking-wider mr-1">
            {{ ca: "Filtre:", es: "Filtro:", en: "Filter:" }[lang]}
          </span>
          <button
            onClick={() => setSelectedCategory(null)}
            aria-pressed={selectedCategory === null}
            class={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border transition-all duration-200 ${
              selectedCategory === null
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {{ ca: "Tots", es: "Todos", en: "All" }[lang]}
          </button>
          {["apunyalament", "pelea", "robo_violento", "incivismo"].map((catKey) => {
            const mapped = useCategory(catKey, lang);
            const isActive = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                aria-pressed={isActive}
                aria-label={`${mapped.label} ${isActive ? "(" + (lang === "en" ? "active" : "actiu") + ")" : ""}`}
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
      <div
        class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start"
      >

        {/* COLUMNA 1 (IZQUIERDA): Clasificación (Leaderboard) - lg:col-span-6 */}
        <div class={`${fullRankingView ? "lg:col-span-12" : "lg:col-span-6"} space-y-4`}>

          <div class="relative">
            {isLoadingRanking && (
              <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl border border-slate-800">
                <div class="flex flex-col items-center gap-2">
                  <span class="h-6 w-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></span>
                  <span class="font-mono text-[9px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                    {{ ca: "DESCARREGANT DADES DE JORNADA...", es: "DESCARGANDO DATOS DE JORNADA...", en: "DOWNLOADING ROUND DATA..." }[lang]}
                  </span>
                </div>
              </div>
            )}
            <RankingTable
              rows={filteredRanking}
              activeCitySlug={activeCitySlug}
              setActiveCitySlug={setActiveCitySlug}
              setSelectedCitySlug={setSelectedCitySlug}
              fullRankingView={fullRankingView}
              lang={lang}
            />
          </div>

          {/* Full ranking link */}
          {!fullRankingView && (
            <a
              href="./ranking/"
              class="w-full flex items-center justify-center gap-1.5 border border-slate-900 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-800 text-[9px] font-black uppercase tracking-widest text-amber-500 py-3 rounded-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            >
              {{ ca: "VEURE CLASSIFICACIÓ COMPLETA", es: "VER CLASIFICACIÓN COMPLETA", en: "VIEW FULL RANKING" }[lang]}
              <ArrowRight class="h-3 w-3" />
            </a>
          )}
        </div>

        {/* COLUMNA 2 (CENTRAL): Featured City Showcase (Ciudad en Racha) - lg:col-span-3 */}
        {!fullRankingView && featuredCityData && (
          <div class="lg:col-span-3 space-y-4">

            <div class="border-b border-slate-900 pb-2">
              <h2 class="text-md font-black tracking-widest uppercase font-display flex items-center gap-2 text-slate-400">
                <Flame class="h-4.5 w-4.5 text-amber-500" />
                {{ ca: "CIUTAT EN RATXA", es: "CIUDAD EN RACHA", en: "CITY ON FIRE" }[lang]}
              </h2>
            </div>

            {/* Glowing Featured Card */}
            <div
              class="glass-panel p-4.5 rounded-xl border border-slate-900 flex flex-col justify-between gap-3 shadow-lg relative overflow-hidden select-none min-h-[352px]"
            >
              <div class="scanner-line"></div>

              {/* Highlight Headers */}
              <div>
                <span class="block text-[8px] font-black text-amber-400 uppercase tracking-widest mb-0.5">
                  {{ ca: "LIDERATGE CALENT", es: "LIDERAZGO CALIENTE", en: "HOT LEADERSHIP" }[lang]}
                </span>
                <h3 class="text-2xl font-black font-display text-amber-500 tracking-tight leading-none uppercase">
                  {featuredCityData.name}
                </h3>
                <span class="inline-block text-[9px] font-black text-white mt-1 border-b border-amber-500/20 pb-0.5">
                  {{ ca: `${featuredCityData.streak} JORNADES PUNTUANT`, es: `${featuredCityData.streak} JORNADAS PUNTUANDO`, en: `${featuredCityData.streak} ROUNDS SCORING` }[lang]}
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
                {{ ca: "VEURE PERFIL DE CIUTAT", es: "VER PERFIL DE CIUDAD", en: "VIEW CITY PROFILE" }[lang]}
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
                  {{ ca: "TOP CATEGORIES (JORNADA)", es: "TOP CATEGORÍAS (JORNADA)", en: "TOP CATEGORIES (ROUND)" }[lang]}
                </h3>
              </div>

              <div class="rounded-xl border border-slate-900 bg-slate-950/20 p-4 space-y-3 shadow-md">
                {topCategories.slice(0, 5).map((item, idx) => {
                  const catStyle = useCategory(item.key, lang);
                  const topScore = topCategories[0]?.points || 100;
                  const pct = Math.max(12, Math.min(100, (item.points / topScore) * 100));

                  return (
                    <div key={idx} class="space-y-1 text-[10px] font-bold">
                      <div class="flex items-center justify-between text-slate-300">
                        <span class="flex items-center gap-1">
                          <span class="text-xs"><Diamond class="h-3.5 w-3.5 text-amber-500" /></span>
                          <span>{catStyle.label}</span>
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
                  {{ ca: "EVOLUCIÓ DE PUNTS", es: "EVOLUCIÓN DE PUNTOS", en: "POINTS EVOLUTION" }[lang]}
                </h3>
              </div>

              {/* Line Chart */}
              <ScoreChart citiesData={chartData.citiesData} roundsNames={chartData.roundsNames} />
            </div>

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. SECCIÓN SECUNDARIA - FILA 2 (NOTICIAS Y TIMELINE) */}
      {/* ========================================================================= */}
      <div
        class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start border-t border-slate-900 pt-6"
      >

        {/* ROW 2 LEFT (EDITORIAL NEWS CARDS GRID): lg:col-span-9 */}
        <div class="lg:col-span-9 space-y-4">

          {/* Header Row */}
          <div class="border-b border-slate-900 pb-2">
            <h2 class="text-md font-black tracking-widest uppercase font-display flex items-center gap-2">
              <TrendingUp class="h-4.5 w-4.5 text-red-500" />
              {{ ca: "ÚLTIMS TITULARS QUE SUMEN", es: "ÚLTIMOS TITULARES QUE SUMAN", en: "LATEST HEADLINES THAT ADD POINTS" }[lang]}
            </h2>
          </div>

          {/* Cards Grid */}
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filteredIncidents.slice(0, 4).map((incident, index) => {
              const mappedCat = useCategory(incident.category, lang);

              return (
                <article
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  style={{ animationDelay: `${index * 60}ms` }}
                  class={`stagger-fade-in relative flex flex-col justify-between gap-4 p-4 rounded-xl border border-slate-900 bg-slate-950/60 overflow-hidden cursor-pointer transition-all duration-300 min-h-[260px] hover:border-amber-500/40 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] group`}
                >
                  {/* Incident Background Image with Premium Blending */}
                  {(incident.thumbnail_url || incident.image_url) && (
                    <img
                      src={getMediaUrl(incident.thumbnail_url || incident.image_url) || ""}
                      alt=""
                      class="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-30 group-hover:scale-110 transition-all duration-700 z-0 pointer-events-none"
                    />
                  )}

                  {/* Visual Editorial Grid Backdrop overlay */}
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pointer-events-none z-0" />

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
                    <h3 class="font-extrabold text-[13px] leading-snug text-slate-100 group-hover:text-amber-400 transition-colors font-display line-clamp-3">
                      {incident.satirical_headline || incident.canonical_title}
                    </h3>
                    <p class="text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-3">
                      {incident.short_neutral_summary || { ca: "El succés ha sumat punts decisius a la taula general de la temporada.", es: "El suceso ha sumado puntos decisivos en la tabla general de la temporada.", en: "The event has added decisive points to the overall season scoreboard." }[lang]}
                    </p>
                  </div>

                  {/* Card Footer (Source and Relative time) */}
                  <div class="flex items-center justify-between text-[8px] font-black uppercase text-slate-500 border-t border-slate-900 pt-2 z-10 select-none">
                    <span>
                      {{ ca: "FONT:", es: "FUENTE:", en: "SOURCE:" }[lang]} <strong class="text-slate-400">{incident.sources?.[0]?.outlet_name || { ca: "Premsa", es: "Prensa", en: "Press" }[lang]}</strong>
                    </span>
                    <span>{incident.happened_at ? formatRelativeTime(incident.happened_at, lang) : ""}</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* More headlines trigger */}
          <div class="flex justify-center pt-2">
            <a
              href={lang === "en" ? "/en/incidents/" : lang === "es" ? "/es/incidents/" : "/incidents/"}
              class="flex items-center justify-center gap-1.5 border border-slate-900 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white px-5 py-3 rounded-xl transition-all"
            >
              {{ ca: "VEURE MÉS TITULARS", es: "VER MÁS TITULARES", en: "VIEW MORE HEADLINES" }[lang]}
              <ArrowRight class="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* ROW 2 RIGHT (ÚLTIMA HORA FEED): lg:col-span-3 */}
        <div class="lg:col-span-3 space-y-4">

          <div class="border-b border-slate-900 pb-2">
            <h2 class="text-md font-black tracking-widest uppercase font-display flex items-center gap-2 text-slate-400">
              <Calendar class="h-4.5 w-4.5 text-slate-500" />
              {{ ca: "ÚLTIMA HORA", es: "ÚLTIMA HORA", en: "BREAKING NEWS" }[lang]}
            </h2>
          </div>

          {/* Timeline Feed Container */}
          <div class="rounded-xl border border-slate-900 bg-slate-950/20 p-4 space-y-4 shadow-md max-h-[294px] overflow-y-auto pr-1 select-none">
            {filteredIncidents.slice(0, 5).map((incident) => {
              const happenedDate = incident.happened_at ? new Date(incident.happened_at) : null;
              const hourStr = happenedDate
                ? happenedDate.toLocaleTimeString(lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "ca-ES", { hour: "2-digit", minute: "2-digit" })
                : "--:--";

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
          <a
            href={lang === "en" ? "/en/incidents/" : lang === "es" ? "/es/incidents/" : "/incidents/"}
            class="w-full flex items-center justify-center gap-1.5 border border-slate-900 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-800 text-[9px] font-black uppercase tracking-widest text-red-400 py-3 rounded-xl transition-all"
          >
            {{ ca: "VEURE TOTS ELS INCIDENTS", es: "VER TODOS LOS INCIDENTES", en: "VIEW ALL INCIDENTS" }[lang]}
            <ArrowRight class="h-3 w-3" />
          </a>
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
          <div class="relative w-full max-w-4xl h-full glass-panel border-l border-slate-900 flex flex-col text-slate-100 shadow-2xl z-10 transition-transform duration-300 animate-slide-in">
            {/* Header */}
            <div class="px-6 py-5 border-b border-slate-900 bg-slate-950/90 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <MapPin class="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <span class="text-[10px] font-black uppercase text-amber-500 tracking-wider">
                    {{ ca: "PANEL DE CIUTAT", es: "PANEL DE CIUDAD", en: "CITY PANEL" }[lang]}
                  </span>
                  <h3 class="text-xl font-bold font-display text-white uppercase tracking-tight">{selectedCityData.city.name}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedCitySlug(null)}
                class="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            {/* Bento Grid Dashboard Body */}
            <div class="flex-1 overflow-y-auto p-6 bg-[#020617] hud-grid">
              <CityDashboard
                citySlug={selectedCityData.city.slug}
                cityName={selectedCityData.city.name}
                points={selectedCityData.points}
                position={selectedCityData.position || 0}
                incidents={selectedCityData.incidents}
                historyPoints={selectedCityChartData?.historyPoints}
                roundsNames={selectedCityChartData?.roundsNames}
                lang={lang}
              />
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
                  <span class="text-[10px] font-black uppercase text-red-500 tracking-wider">
                    {{ ca: "Detall del Sobresalt", es: "Detalle del Sobresalto", en: "Shaking Detail" }[lang]}
                  </span>
                  <h3 class="text-lg font-bold font-display">
                    {{ ca: "Verificació Satírica", es: "Verificación Satírica", en: "Satirical Verification" }[lang]}
                  </h3>
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
                <div class="space-y-2 select-none mb-2">
                  <div class="relative w-full h-44 rounded-xl overflow-hidden border border-slate-900 shadow-lg">
                    <img
                      src={getMediaUrl(selectedIncidentData.image_url) || ""}
                      alt={selectedIncidentData.canonical_title}
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
                  {(() => {
                    const catStyle = useCategory(selectedIncidentData.category, lang);
                    return (
                      <span class={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${catStyle.color} ${catStyle.bg} ${catStyle.border}`}>
                        {catStyle.label}
                      </span>
                    );
                  })()}
                  <span class="rounded-lg bg-red-500/25 border border-red-500/35 text-red-400 px-2 py-0.5 text-xs font-black">
                    +{selectedIncidentData.points} pts
                  </span>
                </div>
              </div>

              {/* Satirical Headline (Prioritized) */}
              <div class="space-y-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">
                  {{ ca: "Titular Satíric de la Lliga", es: "Titular Satírico de la Liga", en: "League Satirical Headline" }[lang]}
                </h4>
                <div class="p-5 rounded-2xl bg-red-500/5 border border-red-500/15 relative overflow-hidden pulse-glow-border">
                  <blockquote class="text-lg font-extrabold leading-snug text-red-100 italic">
                    “{selectedIncidentData.satirical_headline || { ca: "Estem processant el titular satíric...", es: "Estamos procesando el titular satírico...", en: "Processing satirical headline..." }[lang]}”
                  </blockquote>
                </div>
              </div>

              {/* Canonical Facts */}
              <div class="space-y-4 border-t border-slate-800/80 pt-5">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">
                  {{ ca: "Fets Reals Publicats", es: "Hechos Reales Publicados", en: "Published Real Facts" }[lang]}
                </h4>

                <div class="space-y-2">
                  <h5 class="text-xs font-bold text-slate-400 select-none">
                    {{ ca: "Titular de la Premsa Original:", es: "Titular de la Prensa Original:", en: "Original Press Headline:" }[lang]}
                  </h5>
                  <p class="text-sm font-semibold text-slate-200">{selectedIncidentData.canonical_title}</p>
                </div>

                {selectedIncidentData.short_neutral_summary && (
                  <div class="space-y-2 bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <h5 class="text-xs font-bold text-slate-400 select-none">
                      {{ ca: "Resum Neutre:", es: "Resumen Neutro:", en: "Neutral Summary:" }[lang]}
                    </h5>
                    <p class="text-xs text-slate-300 leading-relaxed">{selectedIncidentData.short_neutral_summary}</p>
                  </div>
                )}

                <div class="flex items-center gap-4 text-xs text-slate-400 border-b border-slate-850 pb-4 select-none">
                  <div class="flex items-center gap-1.5">
                    <Calendar class="h-4 w-4 text-slate-500" />
                    <span>
                      {{ ca: "Succeït:", es: "Sucedido:", en: "Happened:" }[lang]} {formatDate(selectedIncidentData.happened_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Whitelisted News Sources */}
              <div class="space-y-4 border-t border-slate-800/80 pt-5">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 select-none">
                  <ShieldAlert class="h-4 w-4 text-emerald-500" />
                  {{ ca: "Fonts Verificades de Premsa", es: "Fuentes Verificadas de Prensa", en: "Verified Press Sources" }[lang]}
                </h4>

                <p class="text-[11px] text-slate-400 leading-relaxed select-none">
                  {{
                    ca: "Aquesta puntuació es basa únicament en successos publicats oficialment per mitjans de premsa. Pots verificar la notícia als mitjans associats a continuació:",
                    es: "Esta puntuación se basa únicamente en sucesos publicados oficialmente por medios de prensa. Puedes verificar la noticia en los medios asociados a continuación:",
                    en: "This score is based solely on events officially published by press media. You can verify the news in the associated media below:"
                  }[lang]}
                </p>

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
                          {{ ca: "Llegir notícia", es: "Leer noticia", en: "Read news" }[lang]}
                          <ArrowRight class="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </a>
                    ))
                  ) : (
                    <div class="text-xs text-slate-500 bg-slate-900/10 p-4 rounded-xl border border-slate-850 text-center">
                      {{ ca: "No hi ha cap enllaç font associat registrat encara.", es: "No hay ningún enlace fuente asociado registrado todavía.", en: "No associated source link registered yet." }[lang]}
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
