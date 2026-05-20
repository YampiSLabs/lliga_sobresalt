import { useState } from "preact/hooks";
import { useAutoAnimate } from "@formkit/auto-animate/preact";
import type { CityScore } from "../lib/schemas";
import { getCityShieldSrc } from "../lib/cityShields";
import { useTranslations } from "../lib/i18n";

type RankingTableProps = {
  rows?: CityScore[];
  activeCitySlug?: string | null;
  setActiveCitySlug?: (slug: string | null) => void;
  setSelectedCitySlug?: (slug: string | null) => void;
  fullRankingView?: boolean;
  lang?: "ca" | "es" | "en";
};

type CityRow = {
  position: number;
  name: string;
  slug: string;
  points: number;
  incidentsCount: number;
  streak: number;
  trend: "up" | "down" | "stable";
  delta: number;
};

export default function RankingTable({
  rows,
  activeCitySlug,
  setActiveCitySlug,
  setSelectedCitySlug,
  fullRankingView = false,
  lang = "ca",
}: RankingTableProps) {
  const [localActiveRow, setLocalActiveRow] = useState<string | null>(null);
  const [animationParent] = useAutoAnimate();
  const t = useTranslations(lang);

  const displayRows: CityRow[] = (fullRankingView ? (rows || []) : (rows || []).slice(0, 5)).map((row, index) => {
        const slug = row.city.slug;
        const position = row.position || (index + 1);

        // Dynamic calculations based on real database scores
        // Streak: higher points -> higher streak (min 1, max 4)
        const streak = Math.max(1, Math.min(4, Math.floor(row.points / 10) + 1));

        // Trend and delta: based on position and points
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
          position: position,
          name: row.city.name,
          slug: slug,
          points: row.points,
          incidentsCount: row.incidents_count,
          streak: streak,
          trend: trend,
          delta: delta,
        };
      });

  // Localized column names & headers
  const textMunicipis = {
    ca: "MUNICIPIS",
    es: "MUNICIPIOS",
    en: "MUNICIPALITIES",
  }[lang] || "MUNICIPIS";

  const textRacha = {
    ca: "RATXA",
    es: "RACHA",
    en: "STREAK",
  }[lang] || "RATXA";

  const textTendencia = {
    ca: "TENDÈNCIA",
    es: "TENDENCIA",
    en: "TREND",
  }[lang] || "TENDÈNCIA";

  const textNoMatch = {
    ca: "Cap municipi coincideix.",
    es: "Ningún municipio coincide.",
    en: "No municipality matches.",
  }[lang] || "Cap municipi coincideix.";

  const textRoundTitle = {
    ca: "CLASSIFICACIÓ DE LA TEMPORADA",
    es: "CLASIFICACIÓN DE LA TEMPORADA",
    en: "SEASON LEADERBOARD",
  }[lang] || "CLASSIFICACIÓ DE LA TEMPORADA";

  const textRoundLabel = {
    ca: "JORNADA 12",
    es: "JORNADA 12",
    en: "ROUND 12",
  }[lang] || "JORNADA 12";

  return (
    <div className="w-full rounded-2xl border border-slate-900 bg-slate-950/40 p-5 shadow-lg select-none sobresalt-ranking-table">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4 sobresalt-ranking-header">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
            {fullRankingView ? textRoundTitle : t("label.ranking_table")}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-bold font-mono">
          <span className="rounded bg-slate-900 border border-slate-800/80 px-2 py-0.5">{textRoundLabel}</span>
          <span>LIVE HUD</span>
        </div>
      </div>

      {/* Grid Headers */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-900/60 font-mono sobresalt-ranking-column-titles">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-4">{textMunicipis}</div>
        <div className="col-span-2 text-right">{t("label.points").toUpperCase()}</div>
        <div className="col-span-2 text-center">{t("label.incidents").toUpperCase()}</div>
        <div className="col-span-1 text-center">{textRacha}</div>
        <div className="col-span-2 text-right">{textTendencia}</div>
      </div>

      {/* Rows list with Auto-Animate parent */}
      <div ref={animationParent} className="space-y-1.5 mt-2">
        {displayRows.length ? (
          displayRows.map((row) => {
            const currentActiveSlug = activeCitySlug !== undefined ? activeCitySlug : localActiveRow;
            const isHovered = currentActiveSlug === row.slug;
            const isPodium = row.position <= 3;
            const shieldSrc = getCityShieldSrc(row.slug);

            return (
              <div
                key={row.slug}
                onClick={() => {
                  if (setSelectedCitySlug) {
                    setSelectedCitySlug(row.slug);
                  }
                }}
                onMouseEnter={() => {
                  if (setActiveCitySlug) {
                    setActiveCitySlug(row.slug);
                  } else {
                    setLocalActiveRow(row.slug);
                  }
                }}
                onMouseLeave={() => {
                  if (setActiveCitySlug) {
                    setActiveCitySlug(null);
                  } else {
                    setLocalActiveRow(null);
                  }
                }}
                className={`grid grid-cols-12 gap-2 items-center py-3 px-4 rounded-lg bg-slate-950/40 border transition-all duration-300 ease-out cursor-pointer relative overflow-hidden group sobresalt-ranking-row sobresalt-ranking-row-${row.slug} ${
                  isHovered
                    ? "border-amber-500/80 bg-slate-900/40 scale-[1.01] shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    : "border-slate-900/80 hover:border-slate-800 hover:bg-slate-900/25"
                }`}
              >
                {/* Visual Accent Bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 bg-amber-500 transition-all duration-300 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                />

                {/* Position badge */}
                <div className="col-span-1 flex justify-center font-mono font-bold sobresalt-ranking-cell-position">
                  {isPodium ? (
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black border ${
                      row.position === 1 ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : row.position === 2 ? "bg-slate-400/10 text-slate-200 border-slate-400/20"
                      : "bg-amber-700/10 text-amber-500 border-amber-700/20"
                    }`}>
                      {row.position}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">{row.position}</span>
                  )}
                </div>

                {/* Shield & City name */}
                <div className="col-span-4 flex items-center gap-2.5 sobresalt-ranking-cell-municipality">
                  {shieldSrc ? (
                    <img
                      src={shieldSrc}
                      alt=""
                      className="h-5 w-5 shrink-0 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.18)]"
                      // Set transition-name on the shield to enable View Transitions!
                      style={{ viewTransitionName: `shield-${row.slug}` }}
                    />
                  ) : (
                    <div className="h-4.5 w-4.5 rounded-full bg-slate-800 border border-slate-700 shrink-0" />
                  )}
                  <span className="font-extrabold text-xs text-slate-200 group-hover:text-amber-400 transition-colors uppercase tracking-tight font-display">
                    {row.name}
                  </span>
                </div>

                {/* Points (Amber maximalist) */}
                <div className="col-span-2 text-right font-mono font-black text-amber-500 text-sm tracking-tight sobresalt-ranking-cell-points">
                  {row.points}
                </div>

                {/* Incident count */}
                <div className="col-span-2 text-center font-mono text-xs font-bold text-slate-400 sobresalt-ranking-cell-incidents">
                  {row.incidentsCount}
                </div>

                {/* Racha flames */}
                <div className="col-span-1 text-center text-xs sobresalt-ranking-cell-streak">
                  {"🔥".repeat(row.streak)}
                </div>

                {/* Trend Badge */}
                <div className="col-span-2 text-right font-mono text-[9px] font-black sobresalt-ranking-cell-trend">
                  {row.trend === "up" ? (
                    <span className="text-green-400">▲ +{row.delta}</span>
                  ) : row.trend === "down" ? (
                    <span className="text-red-400">▼ {row.delta}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-slate-500 font-mono text-xs">
            {textNoMatch}
          </div>
        )}
      </div>
    </div>
  );
}
