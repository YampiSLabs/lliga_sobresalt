import type { Incident } from "../lib/schemas";

type Props = {
  incident: Incident;
};

const categoryLabels: Record<string, string> = {
  apunyalament: "Apunyalament",
  arma_blanca: "Arma blanca",
  homicidio: "Homicidio",
  robo_violento: "Robo violento",
  pelea: "Pelea",
  agresion: "Agresión",
  incivismo: "Incivismo",
  disturbios: "Disturbios",
  transporte_publico: "Transporte público",
  otro_suceso: "Otro suceso",
  no_relevante: "No relevante",
};

export default function IncidentCard({ incident }: Props) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700">
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <span>{incident.city?.name ?? "Sin ciudad"}</span>
        <span className="text-slate-600">·</span>
        <span>{categoryLabels[incident.category] ?? incident.category}</span>
        <span className="text-slate-600">·</span>
        <span className="font-semibold text-amber-400">{incident.points} pts</span>
      </div>
      <p className="mt-2 font-bold leading-snug text-slate-100">{incident.canonical_title}</p>
      {incident.short_neutral_summary && (
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{incident.short_neutral_summary}</p>
      )}
    </article>
  );
}
