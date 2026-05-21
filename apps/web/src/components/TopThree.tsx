import { Award, Trophy } from "lucide-preact";
import type { CityScore } from "../lib/schemas";

type Props = {
  podium: CityScore[];
};

const colors = ["text-yellow-400", "text-slate-300", "text-amber-600"];

const medalIcons = [
  <Trophy class="h-6 w-6 text-yellow-400" />,
  <Award class="h-6 w-6 text-slate-300" />,
  <Award class="h-6 w-6 text-amber-600" />,
];

export default function TopThree({ podium }: Props) {
  const top = podium.slice(0, 3);
  if (!top.length) return null;

  return (
    <div className="mb-8 grid grid-cols-3 gap-4">
      {top.map((entry, i) => (
        <div
          key={entry.city.slug}
          className={`rounded-xl border p-4 text-center transition-all duration-300 transform hover:-translate-y-1 ${
            i === 0
              ? "border-yellow-500/30 bg-yellow-500/10 shadow-lg shadow-yellow-500/5"
              : "border-slate-700 bg-slate-900"
          }`}
        >
          <div className="text-2xl flex justify-center">{medalIcons[i]}</div>
          <div className={`mt-1 text-lg font-black ${colors[i]}`}>
            {entry.city.name}
          </div>
          <div className="mt-1 text-sm text-slate-400 font-medium">
            {entry.points} pts · {entry.incidents_count} inc.
          </div>
        </div>
      ))}
    </div>
  );
}
