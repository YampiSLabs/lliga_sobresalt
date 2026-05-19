import { useMemo } from "preact/hooks";

type CityLocation = {
  name: string;
  x: number;
  y: number;
};

const CITY_COORDINATES: Record<string, CityLocation> = {
  barcelona: { name: "Barcelona", x: 342, y: 220 },
  badalona: { name: "Badalona", x: 362, y: 211 },
  lleida: { name: "Lleida", x: 160, y: 190 },
  tarragona: { name: "Tarragona", x: 242, y: 275 },
  lhospitalet: { name: "L'Hospitalet de Llobregat", x: 330, y: 224 },
  girona: { name: "Girona", x: 422, y: 115 },
  sabadell: { name: "Sabadell", x: 325, y: 195 },
  terrassa: { name: "Terrassa", x: 310, y: 190 },
  mataro: { name: "Mataró", x: 385, y: 195 },
  reus: { name: "Reus", x: 220, y: 270 },
};

type CataloniaMapProps = {
  activeCitySlug: string | null;
  onCityClick?: (slug: string) => void;
};

export default function CataloniaMap({ activeCitySlug, onCityClick }: CataloniaMapProps) {
  // Normalize slug to match keys
  const normalizedSlug = useMemo(() => {
    if (!activeCitySlug) return null;
    return activeCitySlug.toLowerCase().replace(/[^a-z0-9]/g, "");
  }, [activeCitySlug]);

  const activeCity = normalizedSlug ? CITY_COORDINATES[normalizedSlug] : null;

  return (
    <div class="relative w-full h-[240px] rounded-xl overflow-hidden bg-slate-950/40 border border-slate-900 flex items-center justify-center p-2 group/map">
      {/* Dynamic glow in background */}
      <div class="absolute inset-0 bg-radial-gradient from-amber-500/5 to-transparent pointer-events-none" />

      {/* SVG Map of Catalonia */}
      <svg
        viewBox="0 0 500 380"
        class="w-full h-full max-w-[340px] max-h-[220px] transition-transform duration-500 group-hover/map:scale-[1.03]"
        style={{ filter: "drop-shadow(0 0 12px rgba(245, 158, 11, 0.05))" }}
      >
        <defs>
          <filter id="glow-heavy" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-light" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="map-fill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(30, 41, 59, 0.4)" />
            <stop offset="100%" stop-color="rgba(15, 23, 42, 0.7)" />
          </linearGradient>
        </defs>

        {/* 1. Base Outline of Catalonia */}
        <path
          d="M 80,60 L 160,50 L 250,60 L 300,50 L 330,65 L 420,70 L 485,90 L 460,130 L 440,160 L 390,200 L 352,230 L 290,270 L 242,286 L 170,360 L 140,370 L 130,340 L 145,290 L 120,240 L 150,170 L 100,140 L 80,60 Z"
          fill="url(#map-fill)"
          stroke="rgba(245, 158, 11, 0.2)"
          stroke-width="2.5"
          stroke-linejoin="round"
          class="transition-all duration-300"
        />

        {/* 2. Provincial Division Lines (Technical HUD styling) */}
        {/* Lleida West division */}
        <path
          d="M 250,60 L 230,170 L 242,286"
          fill="none"
          stroke="rgba(245, 158, 11, 0.08)"
          stroke-width="1.5"
          stroke-dasharray="3,3"
        />
        {/* Girona East division */}
        <path
          d="M 300,50 L 340,140 L 390,200"
          fill="none"
          stroke="rgba(245, 158, 11, 0.08)"
          stroke-width="1.5"
          stroke-dasharray="3,3"
        />
        {/* Barcelona - Tarragona division */}
        <path
          d="M 230,170 L 290,270"
          fill="none"
          stroke="rgba(245, 158, 11, 0.08)"
          stroke-width="1.5"
          stroke-dasharray="3,3"
        />

        {/* 3. Render all selectable city nodes as subtle background beacons */}
        {Object.entries(CITY_COORDINATES).map(([slug, city]) => {
          const isActive = normalizedSlug === slug;
          if (isActive) return null; // Render active beacon on top separately
          return (
            <g
              key={slug}
              class="cursor-pointer group/node"
              onClick={() => onCityClick?.(slug)}
            >
              <circle
                cx={city.x}
                cy={city.y}
                r="4.5"
                fill="rgba(51, 65, 85, 0.6)"
                stroke="rgba(245, 158, 11, 0.25)"
                stroke-width="1"
                class="transition-all duration-200 group-hover/node:fill-amber-500/40 group-hover/node:r-[6]"
              />
              {/* Micro-label on hover */}
              <text
                x={city.x}
                y={city.y - 10}
                text-anchor="middle"
                fill="rgba(203, 213, 225, 0.8)"
                font-size="8px"
                font-weight="bold"
                class="opacity-0 pointer-events-none group-hover/node:opacity-100 transition-opacity duration-200 font-display"
              >
                {city.name}
              </text>
            </g>
          );
        })}

        {/* 4. Active Highlight Beacon with smooth glowing/pulsing animations */}
        {activeCity && (
          <g>
            {/* Outer Pulse Ring */}
            <circle
              cx={activeCity.x}
              cy={activeCity.y}
              r="24"
              fill="none"
              stroke="rgba(245, 158, 11, 0.25)"
              stroke-width="1"
              style={{ filter: "url(#glow-light)" }}
            >
              <animate
                attributeName="r"
                values="8;24"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Inner Glow Anchor */}
            <circle
              cx={activeCity.x}
              cy={activeCity.y}
              r="7"
              fill="rgba(245, 158, 11, 0.4)"
              stroke="rgb(251, 191, 36)"
              stroke-width="1.5"
              style={{ filter: "url(#glow-heavy)" }}
            />

            {/* Solid Center Dot */}
            <circle
              cx={activeCity.x}
              cy={activeCity.y}
              r="3.5"
              fill="rgb(255, 255, 255)"
            />

            {/* Tech HUD crosshair around active node */}
            <path
              d={`M ${activeCity.x - 12},${activeCity.y} L ${activeCity.x - 8},${activeCity.y} M ${activeCity.x + 8},${activeCity.y} L ${activeCity.x + 12},${activeCity.y} M ${activeCity.x},${activeCity.y - 12} L ${activeCity.x},${activeCity.y - 8} M ${activeCity.x},${activeCity.y + 8} L ${activeCity.x},${activeCity.y + 12}`}
              fill="none"
              stroke="rgb(251, 191, 36)"
              stroke-width="1"
              opacity="0.8"
            />
          </g>
        )}
      </svg>

      {/* Floating active city name HUD in bottom-left */}
      <div class="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-900 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 flex items-center gap-1.5 shadow-lg select-none">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span>MAP TELEMETRY:</span>
        <strong class="text-amber-400 font-display">
          {activeCity ? activeCity.name.toUpperCase() : "SELECCIONA CIUTAT"}
        </strong>
      </div>
    </div>
  );
}
