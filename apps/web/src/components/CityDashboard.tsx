import { useEffect, useRef } from "preact/hooks";
import type { Incident } from "../lib/schemas";
import { getCityShieldSrc } from "../lib/cityShields";
import { useTranslations } from "../lib/i18n";
import uPlot from "uplot";
import { getMediaUrl } from "../lib/api";


type CityDashboardProps = {
  citySlug: string;
  cityName: string;
  points: number;
  position: number | null;
  incidents: Incident[];
  historyPoints?: number[];
  roundsNames?: string[];
  lang?: "ca" | "es" | "en";
};

const DEFAULT_ROUNDS = [1];

const getOutletStyle = (name: string) => {
  const clean = name.toLowerCase().trim();
  if (clean.includes("caso")) {
    return "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/25 hover:border-rose-500/40";
  }
  if (clean.includes("nacional")) {
    return "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/25 hover:border-blue-500/40";
  }
  if (clean.includes("ara")) {
    return "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/25 hover:border-orange-500/40";
  }
  if (clean.includes("beteve") || clean.includes("betevé")) {
    return "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/25 hover:border-fuchsia-500/40";
  }
  if (clean.includes("segre")) {
    return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/40";
  }
  if (clean.includes("tarragona")) {
    return "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/25 hover:border-cyan-500/40";
  }
  if (clean.includes("girona")) {
    return "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 hover:border-indigo-500/40";
  }
  return "bg-slate-500/10 border-slate-500/20 text-slate-400 hover:bg-slate-500/25 hover:border-slate-500/40";
};

const getCategoryFallbackGradient = (category: string) => {
  const cat = category.toLowerCase().trim();
  if (cat.includes("apunyalament") || cat.includes("arma_blanca")) {
    return {
      gradient: "from-red-950/80 to-rose-900/40 text-rose-400 border-rose-950",
      label: "🔪 AB"
    };
  }
  if (cat.includes("pelea") || cat.includes("agressió") || cat.includes("agressio") || cat.includes("agresión") || cat.includes("agresion")) {
    return {
      gradient: "from-amber-950/80 to-orange-900/40 text-orange-400 border-orange-950",
      label: "👊 AG"
    };
  }
  if (cat.includes("robo") || cat.includes("violència") || cat.includes("violencia")) {
    return {
      gradient: "from-violet-950/80 to-indigo-900/40 text-indigo-400 border-indigo-950",
      label: "👤 RO"
    };
  }
  if (cat.includes("incivisme") || cat.includes("incivismo") || cat.includes("vandalismo") || cat.includes("vandalisme")) {
    return {
      gradient: "from-yellow-950/80 to-amber-900/40 text-amber-400 border-amber-950",
      label: "🗑️ IN"
    };
  }
  return {
    gradient: "from-slate-900 to-slate-800 text-slate-400 border-slate-950",
    label: "💫 SO"
  };
};

export default function CityDashboard({

  citySlug,
  cityName,
  points,
  position,
  incidents,
  historyPoints,
  roundsNames,
  lang = "ca",
}: CityDashboardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const uplotInstance = useRef<uPlot | null>(null);
  const t = useTranslations(lang);

  const shieldSrc = getCityShieldSrc(citySlug);

  // Dynamic calculations based on live props only.
  const dynamicRounds = roundsNames && roundsNames.length
    ? roundsNames.map((_, i) => i + 1)
    : DEFAULT_ROUNDS;

  const cityHistory = historyPoints && historyPoints.length
    ? historyPoints
    : [points];

  // uPlot initialization effect
  useEffect(() => {
    if (!chartRef.current) return;

    // Clean previous instance if any
    if (uplotInstance.current) {
      uplotInstance.current.destroy();
      uplotInstance.current = null;
    }

    const container = chartRef.current;
    const width = container.offsetWidth;

    const data: uPlot.AlignedData = [
      dynamicRounds,
      cityHistory,
    ];

    const textRoundChart = {
      ca: "Jornada",
      es: "Jornada",
      en: "Round",
    }[lang];

    const textPointsChart = {
      ca: "Punts",
      es: "Puntos",
      en: "Points",
    }[lang];

    const opts: uPlot.Options = {
      width: width || 400,
      height: 160,
      scales: {
        x: { time: false },
        y: { auto: true }
      },
      series: [
        {
          label: textRoundChart,
        },
        {
          label: textPointsChart,
          stroke: "#f59e0b", // Amber 500
          width: 2.5,
          fill: "rgba(245, 158, 11, 0.08)",
          points: {
            show: true,
            size: 6,
            stroke: "#f59e0b",
            fill: "#020617",
          }
        }
      ],
      axes: [
        {
          stroke: "#475569",
          font: "10px Share Tech Mono",
          grid: {
            stroke: "rgba(71, 85, 105, 0.15)",
          },
          values: (_, splits) => {
            return splits.map(val => {
              const idx = Math.round(val) - 1;
              if (roundsNames && roundsNames[idx]) {
                return roundsNames[idx];
              }
              const prefix = lang === "en" ? "R" : "J";
              return `${prefix}${val}`;
            });
          }
        },
        {
          stroke: "#475569",
          font: "10px Share Tech Mono",
          grid: {
            stroke: "rgba(71, 85, 105, 0.15)",
          }
        }
      ]
    };

    const plot = new uPlot(opts, data, container);
    uplotInstance.current = plot;

    // Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (uplotInstance.current) {
          uplotInstance.current.setSize({
            width: entry.contentRect.width,
            height: 160
          });
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (uplotInstance.current) {
        uplotInstance.current.destroy();
        uplotInstance.current = null;
      }
    };
  }, [citySlug, cityHistory, dynamicRounds, roundsNames, lang]);

  // Take the 3 latest incidents
  const latestIncidents = incidents.slice(0, 3);

  // Localized UI Labels
  const textProfileHUD = {
    ca: "PERFIL DE LA CIUTAT HUD",
    es: "PERFIL DE LA CIUDAD HUD",
    en: "CITY PROFILE HUD",
  }[lang] || "PERFIL DE LA CIUTAT HUD";

  const textPointsTotals = {
    ca: "PUNTS TOTALS",
    es: "PUNTOS TOTALES",
    en: "TOTAL POINTS",
  }[lang] || "PUNTS TOTALS";

  const textHistoryTitle = {
    ca: "HISTÒRIC DE PUNTUACIÓ (TEMPORADA)",
    es: "HISTÓRICO DE PUNTUACIÓN (TEMPORADA)",
    en: "SCORE HISTORY (SEASON)",
  }[lang] || "HISTÒRIC DE PUNTUACIÓ (TEMPORADA)";

  const textTelemetryActive = {
    ca: "TELEMETRIA ACTIVA",
    es: "TELEMETRÍA ACTIVA",
    en: "ACTIVE TELEMETRY",
  }[lang] || "TELEMETRIA ACTIVA";

  const textRegisteredIncidents = {
    ca: "INCIDENTS SATÍRICS REGISTRATS",
    es: "INCIDENTES SATÍRICOS REGISTRADOS",
    en: "REGISTERED SATIRICAL INCIDENTS",
  }[lang] || "INCIDENTS SATÍRICS REGISTRATS";

  const textLatestThree = {
    ca: "ÚLTIMS 3",
    es: "ÚLTIMOS 3",
    en: "LATEST 3",
  }[lang] || "ÚLTIMS 3";

  const textNoIncidents = {
    ca: "Cap incident satíric publicat en aquesta ciutat encara.",
    es: "Ningún incidente satírico publicado en esta ciudad todavía.",
    en: "No satirical incidents published in this city yet.",
  }[lang] || "Cap incident satíric publicat en aquesta ciutat encara.";

  const textNoDesc = {
    ca: "Sense descripció ampliada.",
    es: "Sin descripción ampliada.",
    en: "No detailed description available.",
  }[lang] || "Sense descripció ampliada.";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full select-none hud-panel p-4 md:p-6 rounded-2xl bg-slate-950/20 border border-slate-900/60 shadow-xl animate-fade-in">

      {/* CARD A: HERO CITY SCORE */}
      <div className="col-span-1 flex flex-col justify-between p-5 rounded-xl border border-slate-900 bg-slate-950/40 relative overflow-hidden min-h-[250px]">
        {/* Decorative Grid Panel line */}
        <div className="absolute inset-0 hud-grid opacity-10 pointer-events-none" />

        {/* Header telemetry badge */}
        <div className="flex items-center justify-between w-full border-b border-slate-900/60 pb-2 mb-3">
          <span className="font-mono text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">{textProfileHUD}</span>
          {position !== null && (
            <span className="font-mono text-[9px] font-black bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded">
              RANKING #{position}
            </span>
          )}
        </div>

        {/* Shield and City Name */}
        <div className="flex flex-col items-center justify-center my-auto">
          {shieldSrc ? (
            <img
              src={shieldSrc}
              alt=""
              className="h-16 w-16 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.25)] mb-3"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-400 mb-3">
              {cityName.slice(0, 2)}
            </div>
          )}

          <h3 className="text-xl md:text-2xl font-black font-display text-white uppercase tracking-tighter text-center">
            {cityName}
          </h3>
        </div>

        {/* Huge score */}
        <div className="border-t border-slate-900/60 pt-2 flex flex-col items-center mt-3">
          <span className="font-mono text-[8px] text-slate-500 uppercase font-black">{textPointsTotals}</span>
          <span className="text-5xl font-black font-mono text-amber-500 tracking-tighter leading-none">
            {points}
          </span>
        </div>
      </div>

      {/* CARD B: HISTORICAL CHART WITH uPLOT */}
      <div className="col-span-1 md:col-span-2 flex flex-col justify-between p-5 rounded-xl border border-slate-900 bg-slate-950/40 min-h-[250px]">
        {/* Top header badge */}
        <div className="flex items-center justify-between w-full border-b border-slate-900/60 pb-2 mb-4">
          <span className="font-mono text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">
            {textHistoryTitle}
          </span>
          <span className="font-mono text-[9px] text-slate-400">{textTelemetryActive}</span>
        </div>

        {/* uPlot Target */}
        <div className="flex-1 w-full flex items-center justify-center">
          <div ref={chartRef} className="w-full h-[160px] uplot-dark-container" />
        </div>
      </div>

      {/* CARD C: INTERNAL SCROLL LIST OF SATIRICAL INCIDENTS */}
      <div className="col-span-1 md:col-span-3 flex flex-col p-5 rounded-xl border border-slate-900 bg-slate-950/40">
        {/* Header telemetry badge */}
        <div className="flex items-center justify-between w-full border-b border-slate-900/60 pb-2 mb-3">
          <span className="font-mono text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">
            {textRegisteredIncidents} ({incidents.length})
          </span>
          <span className="font-mono text-[9px] text-amber-500 font-black animate-pulse flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {textLatestThree}
          </span>
        </div>

        {/* Scroll internal content */}
        <div className="max-h-[290px] overflow-y-auto pr-1 space-y-2 mt-2 scrollbar-thin">
          {latestIncidents.length ? (
            latestIncidents.map((incident) => {
              const localeStr = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "ca-ES";
              const formattedDate = incident.happened_at
                ? new Date(incident.happened_at).toLocaleDateString(localeStr, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : (lang === "en" ? "Round 12" : "Jornada 12");

              const fallback = getCategoryFallbackGradient(incident.category);
              const resolvedImg = getMediaUrl(incident.thumbnail_url || incident.image_url);

              return (
                <div
                  key={incident.id}
                  className="p-3 rounded-lg border border-slate-900/80 bg-slate-950/60 hover:border-slate-800/80 transition-all flex items-start gap-3 group hover:bg-slate-900/20"
                >
                  {/* Thumbnail / Cyberpunk Fallback */}
                  <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-lg overflow-hidden border border-slate-900/80 bg-slate-950 relative shadow-inner select-none">
                    {resolvedImg ? (
                      <img
                        src={resolvedImg}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${fallback.gradient} flex items-center justify-center font-mono font-black text-[10px] tracking-tight relative border-t`}>
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] opacity-30" />
                        <span className="relative z-10 drop-shadow-[0_0_8px_currentColor]">{fallback.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Main Content Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap select-none">
                      <span className="inline-block text-[8px] font-mono font-black text-amber-500/80 uppercase tracking-widest bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20">
                        {t(`cat.${incident.category}` as any) || incident.category}
                      </span>

                      {/* Brand-Colored Media Tag Links */}
                      {incident.sources && incident.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-0.5 text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-all ${getOutletStyle(src.outlet_name)}`}
                        >
                          {src.outlet_name} <span className="text-[7px]">↗</span>
                        </a>
                      ))}
                    </div>

                    <h4 className="text-xs font-extrabold text-slate-100 group-hover:text-amber-400 transition-colors font-display line-clamp-2 leading-snug">
                      {incident.satirical_headline || incident.canonical_title}
                    </h4>

                    <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-snug">
                      {incident.short_neutral_summary || textNoDesc}
                    </p>
                  </div>

                  {/* Points & Date aligned perfectly */}
                  <div className="flex flex-col items-end shrink-0 justify-between h-14 md:h-16 pl-1 select-none">
                    <span className="text-[10px] font-black text-amber-500 font-mono tracking-tighter bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 leading-none">
                      +{incident.points} PTS
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 font-bold whitespace-nowrap">
                      {formattedDate}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs font-mono">
              {textNoIncidents}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
