import { useEffect, useState } from "preact/hooks";
import { getIncidents } from "../lib/api";

export default function BreakingNewsTicker({ lang = "ca" }: { lang?: "ca" | "es" | "en" }) {
  const [headlines, setHeadlines] = useState<string[]>([]);

  useEffect(() => {
    getIncidents(lang)
      .then((incidents) => {
        const realHeadlines = incidents
          .filter((inc) => inc.satirical_headline || inc.canonical_title)
          .map((inc) => {
            const cityName = inc.city?.name ? inc.city.name.toUpperCase() : lang === "en" ? "CATALONIA" : "CATALUNYA";
            const title = (inc.satirical_headline || inc.canonical_title).toUpperCase();
            return `${cityName}: ${title}`;
          });
        setHeadlines(realHeadlines);
      })
      .catch((err) => {
        console.error("Error fetching live headlines for ticker:", err);
        setHeadlines([]);
      });
  }, [lang]);

  if (!headlines.length) return null;

  const tickerText = [...headlines, ...headlines].join("  *  ");

  const badgeText =
    {
      ca: "ULTIMA HORA",
      es: "ULTIMA HORA",
      en: "BREAKING",
    }[lang] || "ULTIMA HORA";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-10 md:h-12 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md flex items-center select-none overflow-hidden font-mono text-xs shadow-[0_-10px_30px_rgba(0,0,0,0.5)] sobresalt-ticker-container">
      <div className="absolute left-0 top-0 bottom-0 z-10 px-4 bg-amber-500 text-slate-950 font-black tracking-widest flex items-center gap-1.5 shadow-[5px_0_15px_rgba(245,158,11,0.3)] sobresalt-ticker-badge">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-950 animate-pulse" />
        <span className="font-sans font-black text-[10px] md:text-xs">{badgeText}</span>
      </div>

      <div className="flex-1 w-full pl-36 md:pl-40 flex items-center sobresalt-ticker-wrapper">
        <div className="whitespace-nowrap flex items-center gap-4 text-amber-500 font-extrabold tracking-wider animate-marquee sobresalt-ticker-text">
          {tickerText}
        </div>
      </div>

      <div className="hidden md:flex absolute right-0 top-0 bottom-0 z-10 px-4 bg-slate-950 border-l border-slate-900 text-slate-400 items-center gap-2 text-[9px] font-black tracking-widest sobresalt-ticker-live-status">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
        <span>LIVE FEED</span>
      </div>
    </div>
  );
}
