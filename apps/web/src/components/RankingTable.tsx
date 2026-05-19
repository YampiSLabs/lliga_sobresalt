import type { CityScore } from "../lib/schemas";

type Props = {
  rows: CityScore[];
  max?: number;
};

const positionColors: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-300",
  3: "text-amber-600",
};

function PositionBadge({ pos }: { pos: number | null }) {
  if (pos === null || pos === undefined) {
    return <span className="text-slate-500">—</span>;
  }
  return <span className={`font-mono font-bold ${positionColors[pos] ?? "text-slate-400"}`}>{pos}</span>;
}

export default function RankingTable({ rows, max }: Props) {
  const display = max ? rows.slice(0, max) : rows;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead class="bg-slate-900 text-slate-400">
          <tr>
            <th className="w-12 px-4 py-3">#</th>
            <th className="px-4 py-3">Ciudad</th>
            <th className="px-4 py-3 text-right">Puntos</th>
            <th className="px-4 py-3 text-right">Incidentes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {display.length ? (
            display.map((row) => (
              <tr
                key={row.city.slug}
                className="bg-slate-950/50 transition-colors hover:bg-slate-900/80 transition-all duration-200"
              >
                <td className="px-4 py-3">
                  <PositionBadge pos={row.position} />
                </td>
                <td className="px-4 py-3 font-semibold text-amber-200">
                  {row.city.name}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {row.points}
                </td>
                <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                  {row.incidents_count}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                Sin ranking publicado todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
