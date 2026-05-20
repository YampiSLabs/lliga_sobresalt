import { useState } from "preact/hooks";

type ChartPoint = {
  roundIndex: number;
  score: number;
};

type CityChartData = {
  name: string;
  slug: string;
  color: string;
  glowColor: string;
  points: ChartPoint[];
};

type ScoreChartProps = {
  citiesData?: CityChartData[];
  roundsNames?: string[];
};

export default function ScoreChart({ citiesData = [], roundsNames = [] }: ScoreChartProps) {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  // SVG dimensions
  const width = 330;
  const height = 160;
  const paddingLeft = 32;
  const paddingRight = 10;
  const paddingTop = 12;
  const paddingBottom = 22;

  // Internal chart dimensions
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find max score among all data points to scale Y axis dynamically
  const maxPlottedScore = Math.max(
    10,
    ...citiesData.flatMap(c => c.points.map(p => p.score))
  );
  // Round up to nearest nice interval (e.g. multiple of 25)
  const maxAxisVal = Math.ceil(maxPlottedScore / 25) * 25;
  const Y_AXIS_TICKS = [
    0,
    Math.round(maxAxisVal * 0.25),
    Math.round(maxAxisVal * 0.5),
    Math.round(maxAxisVal * 0.75),
    maxAxisVal
  ];

  // Coordinate mapping helpers
  const getX = (roundIndex: number) => {
    if (roundsNames.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (roundIndex / (roundsNames.length - 1)) * chartWidth;
  };

  const getY = (score: number) => {
    // y = 0 represents the top of the chart, so we invert
    const cappedScore = Math.min(maxAxisVal, Math.max(0, score));
    return paddingTop + chartHeight - (cappedScore / maxAxisVal) * chartHeight;
  };

  return (
    <div class="relative w-full rounded-xl border border-slate-900 bg-slate-950/40 p-4 flex flex-col justify-between select-none">
      {/* SVG Canvas */}
      <svg viewBox={`0 0 ${width} ${height}`} class="w-full h-auto overflow-visible">
        <defs>
          <filter id="glow-line-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Dotted Horizontal Grid lines */}
        {Y_AXIS_TICKS.map((val) => {
          const y = getY(val);
          return (
            <g key={val} class="opacity-30">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="rgba(148, 163, 184, 0.4)"
                stroke-width="1.2"
                stroke-dasharray="3,4"
              />
              {/* Y Axis Labels */}
              <text
                x={paddingLeft - 8}
                y={y + 3.5}
                text-anchor="end"
                fill="rgba(148, 163, 184, 0.85)"
                font-size="9px"
                font-weight="bold"
                class="font-display font-mono"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* 2. Dotted Vertical Round lines */}
        {roundsNames.map((_, index) => {
          const x = getX(index);
          return (
            <g key={index} class="opacity-20">
              <line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={height - paddingBottom}
                stroke="rgba(148, 163, 184, 0.3)"
                stroke-width="1"
                stroke-dasharray="3,4"
              />
            </g>
          );
        })}

        {/* 3. Render X Axis Round Labels */}
        {roundsNames.map((round, index) => {
          const x = getX(index);
          return (
            <text
              key={index}
              x={x}
              y={height - 6}
              text-anchor="middle"
              fill="rgba(148, 163, 184, 0.85)"
              font-size="9px"
              font-weight="bold"
              class="font-display font-mono"
            >
              {round.replace("Jornada ", "J")}
            </text>
          );
        })}

        {/* 4. Draw Lines & Nodes for Cities */}
        {citiesData.map((city) => {
          const slug = city.slug;
          const isHovered = hoveredCity === slug;
          const isAnyHovered = hoveredCity !== null;
          const opacity = isAnyHovered ? (isHovered ? 1.0 : 0.25) : 0.85;

          // Build string path
          let pathD = "";
          city.points.forEach((p, idx) => {
            const x = getX(p.roundIndex);
            const y = getY(p.score);
            if (idx === 0) {
              pathD += `M ${x},${y}`;
            } else {
              pathD += ` L ${x},${y}`;
            }
          });

          if (!pathD) return null;

          return (
            <g
              key={slug}
              class="transition-opacity duration-300"
              style={{ opacity }}
              onMouseEnter={() => setHoveredCity(slug)}
              onMouseLeave={() => setHoveredCity(null)}
            >
              {/* Background gradient area underneath the active line */}
              {isHovered && (
                <path
                  d={`${pathD} L ${getX(roundsNames.length - 1)},${getY(0)} L ${getX(0)},${getY(0)} Z`}
                  fill={`url(#area-${slug})`}
                  opacity="0.15"
                />
              )}

              {/* Gradient definition */}
              <defs>
                <linearGradient id={`area-${slug}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color={city.color} />
                  <stop offset="100%" stop-color="transparent" />
                </linearGradient>
              </defs>

              {/* The Glow Underlay Line */}
              <path
                d={pathD}
                fill="none"
                stroke={city.color}
                stroke-width={isHovered ? "4" : "2.5"}
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.45"
                style={{ filter: "url(#glow-line-filter)" }}
              />

              {/* Core Sharp Line */}
              <path
                d={pathD}
                fill="none"
                stroke={city.color}
                stroke-width={isHovered ? "3.2" : "2"}
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              {/* Nodes representing each round score */}
              {city.points.map((p) => {
                const cx = getX(p.roundIndex);
                const cy = getY(p.score);
                return (
                  <g key={p.roundIndex} class="group/dot cursor-pointer">
                    {/* Ring glow on hover */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? "6" : "4"}
                      fill={city.color}
                      opacity={isHovered ? "0.3" : "0"}
                      class="transition-all duration-200"
                    />
                    {/* Solid Dot */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? "3" : "2"}
                      fill="rgb(255, 255, 255)"
                      stroke={city.color}
                      stroke-width="1.5"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Interactive Legend */}
      <div class="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 mt-3 border-t border-slate-900/60 pt-2.5">
        {citiesData.map((city) => {
          const slug = city.slug;
          const isActive = hoveredCity === slug;
          return (
            <div
              key={slug}
              class={`flex items-center gap-1.5 text-[9px] font-extrabold cursor-pointer transition-all duration-200 ${
                isActive ? "text-slate-100 scale-105" : "text-slate-500 hover:text-slate-300"
              }`}
              onMouseEnter={() => setHoveredCity(slug)}
              onMouseLeave={() => setHoveredCity(null)}
            >
              <span
                class="h-2 w-2 rounded-full inline-block border border-black/35 shadow-sm transition-transform duration-200"
                style={{
                  backgroundColor: city.color,
                  transform: isActive ? "scale(1.2)" : "scale(1)",
                }}
              />
              <span class="font-display tracking-wider uppercase">{city.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
