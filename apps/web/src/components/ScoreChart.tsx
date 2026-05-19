import { useState } from "preact/hooks";

type ChartPoint = {
  round: number;
  score: number;
};

type CityData = {
  name: string;
  color: string;
  glowColor: string;
  points: ChartPoint[];
};

const CHART_DATA: Record<string, CityData> = {
  barcelona: {
    name: "Barcelona",
    color: "rgb(239, 68, 68)", // Red
    glowColor: "rgba(239, 68, 68, 0.4)",
    points: [
      { round: 1, score: 20 },
      { round: 2, score: 38 },
      { round: 3, score: 55 },
      { round: 7, score: 78 },
      { round: 9, score: 85 },
      { round: 11, score: 92 },
      { round: 12, score: 104 },
    ],
  },
  badalona: {
    name: "Badalona",
    color: "rgb(245, 158, 11)", // Amber/Yellow
    glowColor: "rgba(245, 158, 11, 0.4)",
    points: [
      { round: 1, score: 15 },
      { round: 2, score: 22 },
      { round: 3, score: 29 },
      { round: 7, score: 38 },
      { round: 9, score: 45 },
      { round: 11, score: 50 },
      { round: 12, score: 56 },
    ],
  },
  lleida: {
    name: "Lleida",
    color: "rgb(59, 130, 246)", // Blue
    glowColor: "rgba(59, 130, 246, 0.4)",
    points: [
      { round: 1, score: 10 },
      { round: 2, score: 16 },
      { round: 3, score: 21 },
      { round: 7, score: 26 },
      { round: 9, score: 30 },
      { round: 11, score: 34 },
      { round: 12, score: 39 },
    ],
  },
  tarragona: {
    name: "Tarragona",
    color: "rgb(168, 85, 247)", // Purple
    glowColor: "rgba(168, 85, 247, 0.4)",
    points: [
      { round: 1, score: 5 },
      { round: 2, score: 10 },
      { round: 3, score: 14 },
      { round: 7, score: 18 },
      { round: 9, score: 22 },
      { round: 11, score: 26 },
      { round: 12, score: 31 },
    ],
  },
};

const ROUNDS = [1, 2, 3, 7, 9, 11, 12];
const Y_AXIS_TICKS = [0, 25, 50, 75, 100];

export default function ScoreChart() {
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

  // Coordinate mapping helper
  const getX = (round: number) => {
    // Proportional placement based on round index in ROUNDS list
    const index = ROUNDS.indexOf(round);
    if (index === -1) return paddingLeft;
    return paddingLeft + (index / (ROUNDS.length - 1)) * chartWidth;
  };

  const getY = (score: number) => {
    // y = 0 represents the top of the chart, so we invert
    const cappedScore = Math.min(100, Math.max(0, score));
    return paddingTop + chartHeight - (cappedScore / 100) * chartHeight;
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
        {ROUNDS.map((round) => {
          const x = getX(round);
          return (
            <g key={round} class="opacity-20">
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
        {ROUNDS.map((round) => {
          const x = getX(round);
          return (
            <text
              key={round}
              x={x}
              y={height - 6}
              text-anchor="middle"
              fill="rgba(148, 163, 184, 0.85)"
              font-size="9px"
              font-weight="bold"
              class="font-display font-mono"
            >
              {round}
            </text>
          );
        })}

        {/* 4. Draw Lines & Nodes for Cities */}
        {Object.entries(CHART_DATA).map(([slug, city]) => {
          const isHovered = hoveredCity === slug;
          const isAnyHovered = hoveredCity !== null;
          const opacity = isAnyHovered ? (isHovered ? 1.0 : 0.25) : 0.85;

          // Build string path
          let pathD = "";
          city.points.forEach((p, idx) => {
            const x = getX(p.round);
            const y = getY(p.score);
            if (idx === 0) {
              pathD += `M ${x},${y}`;
            } else {
              // Smooth bezier interpolation or straight lines
              pathD += ` L ${x},${y}`;
            }
          });

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
                  d={`${pathD} L ${getX(ROUNDS[ROUNDS.length - 1])},${getY(0)} L ${getX(ROUNDS[0])},${getY(0)} Z`}
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
                const cx = getX(p.round);
                const cy = getY(p.score);
                return (
                  <g key={p.round} class="group/dot cursor-pointer">
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

      {/* Interactive Legend Matching Mockup */}
      <div class="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 mt-3 border-t border-slate-900/60 pt-2.5">
        {Object.entries(CHART_DATA).map(([slug, city]) => {
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
