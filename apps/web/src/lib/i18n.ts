export const LANGUAGES = {
  ca: { code: "ca", label: "CA", name: "Català" },
  es: { code: "es", label: "ES", name: "Español" },
  en: { code: "en", label: "EN", name: "English" },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export type CategoryKey = "apunyalament" | "pelea" | "robo_violento" | "incivismo";

export const CATEGORIES: Record<CategoryKey, {
  label: Record<LanguageCode, string>;
  color: string;
  bg: string;
  border: string;
  badge: Record<LanguageCode, string>;
}> = {
  apunyalament: {
    label: { ca: "Navalles", es: "Navajas", en: "Knives" },
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    badge: { ca: "Ganivets d'Or", es: "Cuchillos de Oro", en: "Golden Knives" },
  },
  pelea: {
    label: { ca: "Baralles", es: "Peleas", en: "Fights" },
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    badge: { ca: "Combat Urbà", es: "Combate Urbano", en: "Urban Combat" },
  },
  robo_violento: {
    label: { ca: "Robatoris", es: "Robos", en: "Robberies" },
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    badge: { ca: "Saqueig VIP", es: "Saqueo VIP", en: "VIP Looting" },
  },
  incivismo: {
    label: { ca: "Incivisme", es: "Incivismo", en: "Vandalism" },
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    badge: { ca: "Mala Vida", es: "Mala Vida", en: "Trashy Life" },
  },
};

export function useCategory(category: string, lang: LanguageCode = "ca") {
  const cat = CATEGORIES[category as CategoryKey];
  if (cat) {
    return {
      label: cat.label[lang],
      color: cat.color,
      bg: cat.bg,
      border: cat.border,
      badge: cat.badge[lang],
    };
  }
  return {
    label: category,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    badge: "Altres",
  };
}

const DICTIONARY = {
  ca: {
    "nav.ranking": "RANKING",
    "nav.jornades": "JORNADES",
    "nav.ciutats": "CIUTATS",
    "nav.incidents": "INCIDENTS",
    "nav.reglament": "REGLAMENT",
    "nav.sobre": "SOBRE EL PROJECTE",
    "nav.datacenter": "DATA CENTER ACTIU",
    "slogan": "LA CLASSIFICACIÓ NO OFICIAL DELS TITULARS MÉS MOGUTS DE CATALUNYA.",
    "disclaimer": "La Lliga del Sobresalt és un projecte satíric basat únicament en notícies publicades per mitjans de premsa. No és estadística oficial ni mesura la criminalitat real.",

    // Categorias
    "cat.apunyalament": "Navalles",
    "cat.arma_blanca": "Arma Blanca",
    "cat.homicidio": "Homicidi",
    "cat.robo_violento": "Robatoris",
    "cat.pelea": "Baralles",
    "cat.agresion": "Agressió",
    "cat.incivismo": "Incivisme",
    "cat.disturbios": "Aldarulls",
    "cat.transporte_publico": "Transport Públic",
    "cat.otro_suceso": "Altres Successos",
    "cat.no_relevante": "No Relevant",

    // UI Labels
    "label.points": "Punts",
    "label.incidents": "Incidents",
    "label.incidents_count": "Nre. Incidents",
    "label.official_act": "ACTA OFICIAL DEL VAR",
    "label.incident_details": "DETALLS DE L'INCIDENT",
    "label.sources": "FONTS DE PREMSA",
    "label.neutral_summary": "Resum neutral dels fets",
    "label.var_analysis": "Anàlisi del comitè de competició (VAR)",
    "label.category": "Categoria de l'incident",
    "label.severity": "Gravetat de la jugada",
    "label.confidence": "Certesa de l'àrbitre",
    "label.happened_at": "Data del succés",
    "label.score_added": "Punts afegits al marcador",
    "label.recalculating": "Recalculant marcador...",
    "label.search_city": "Cerca la teva ciutat...",
    "label.all_cities": "Totes les ciutats",
    "label.active_season": "Temporada Activa",
    "label.finished_season": "Temporada Finalitzada",
    "label.winner": "Campió de Lliga",
    "label.podium": "Podium General",
    "label.season": "Temporada",
    "label.round": "Jornada",
    "label.rules": "Reglament del Joc",
    "label.methodology": "Metodologia",
    "label.disclaimer": "Exempció de responsabilitat",
    "label.no_incidents": "No s'han trobat incidents amb els filtres seleccionats.",
    "label.clear_filters": "Netejar Filtres",
    "label.filter_category": "Filtra per Categoria",
    "label.filter_city": "Filtra per Ciutat",
    "label.filter_severity": "Filtra per Gravetat",
    "label.share": "Comparteix",
    "label.back": "Torna enrere",
    "label.view_more": "Veure detalls",
    "label.latest_incidents": "ÚLTIMS INCIDENTS REGISTRATS",
    "label.ranking_table": "CLASSIFICACIÓ GENERAL DE LA JORNADA",
    "label.points_short": "PTS",
  },
  es: {
    "nav.ranking": "RANKING",
    "nav.jornades": "JORNADAS",
    "nav.ciutats": "CIUDADES",
    "nav.incidents": "INCIDENTES",
    "nav.reglament": "REGLAMENTO",
    "nav.sobre": "SOBRE EL PROYECTO",
    "nav.datacenter": "DATA CENTER ACTIVO",
    "slogan": "LA CLASIFICACIÓN NO OFICIAL DE LOS TITULARES MÁS MOVIDOS DE CATALUÑA.",
    "disclaimer": "La Lliga del Sobresalt es un proyecto satírico basado únicamente en noticias publicadas por medios de prensa. No es estadística oficial ni mide la criminalidad real.",

    // Categorias
    "cat.apunyalament": "Navajas",
    "cat.arma_blanca": "Arma Blanca",
    "cat.homicidio": "Homicidio",
    "cat.robo_violento": "Robos",
    "cat.pelea": "Peleas",
    "cat.agresion": "Agresión",
    "cat.incivismo": "Incivismo",
    "cat.disturbios": "Disturbios",
    "cat.transporte_publico": "Transporte Público",
    "cat.otro_suceso": "Otros Sucesos",
    "cat.no_relevante": "No Relevante",

    // UI Labels
    "label.points": "Puntos",
    "label.incidents": "Incidentes",
    "label.incidents_count": "Nro. Incidentes",
    "label.official_act": "ACTA OFICIAL DEL VAR",
    "label.incident_details": "DETALLES DEL INCIDENTE",
    "label.sources": "FUENTES DE PRENSA",
    "label.neutral_summary": "Resumen neutral de los hechos",
    "label.var_analysis": "Análisis del comité de competición (VAR)",
    "label.category": "Categoría del incidente",
    "label.severity": "Gravedad de la jugada",
    "label.confidence": "Certeza del árbitro",
    "label.happened_at": "Fecha del suceso",
    "label.score_added": "Puntos sumados al marcador",
    "label.recalculating": "Recalculando marcador...",
    "label.search_city": "Busca tu ciudad...",
    "label.all_cities": "Todas las ciudades",
    "label.active_season": "Temporada Activa",
    "label.finished_season": "Temporada Finalizada",
    "label.winner": "Campeón de Liga",
    "label.podium": "Podio General",
    "label.season": "Temporada",
    "label.round": "Jornada",
    "label.rules": "Reglamento de Juego",
    "label.methodology": "Metodología",
    "label.disclaimer": "Exención de responsabilidad",
    "label.no_incidents": "No se encontraron incidentes con los filtros seleccionados.",
    "label.clear_filters": "Limpiar Filtros",
    "label.filter_category": "Filtrar por Categoría",
    "label.filter_city": "Filtrar por Ciudad",
    "label.filter_severity": "Filtrar por Gravedad",
    "label.share": "Compartir",
    "label.back": "Volver atrás",
    "label.view_more": "Ver detalles",
    "label.latest_incidents": "ÚLTIMOS INCIDENTES REGISTRADOS",
    "label.ranking_table": "CLASIFICACIÓN GENERAL DE LA JORNADA",
    "label.points_short": "PTS",
  },
  en: {
    "nav.ranking": "RANKING",
    "nav.jornades": "ROUNDS",
    "nav.ciutats": "CITIES",
    "nav.incidents": "INCIDENTS",
    "nav.reglament": "RULES",
    "nav.sobre": "ABOUT THE PROJECT",
    "nav.datacenter": "DATA CENTER ACTIVE",
    "slogan": "THE UNOFFICIAL RANKING OF CATALONIA'S MOST AGITATED HEADLINES.",
    "disclaimer": "La Lliga del Sobresalt is a satirical project based solely on news reports published by media outlets. It is not official statistics and does not measure actual crime rates.",

    // Categorias
    "cat.apunyalament": "Knives",
    "cat.arma_blanca": "Knife Presence",
    "cat.homicidio": "Homicide",
    "cat.robo_violento": "Robberies",
    "cat.pelea": "Fights",
    "cat.agresion": "Assault",
    "cat.incivismo": "Vandalism",
    "cat.disturbios": "Rioting",
    "cat.transporte_publico": "Public Transit",
    "cat.otro_suceso": "Other Incidents",
    "cat.no_relevante": "Not Relevant",

    // UI Labels
    "label.points": "Points",
    "label.incidents": "Incidents",
    "label.incidents_count": "No. Incidents",
    "label.official_act": "OFFICIAL VAR MATCH REPORT",
    "label.incident_details": "INCIDENT DETAILS",
    "label.sources": "MEDIA SOURCES",
    "label.neutral_summary": "Factual and neutral summary",
    "label.var_analysis": "Competition committee analysis (VAR)",
    "label.category": "Incident category",
    "label.severity": "Play severity",
    "label.confidence": "Referee certainty",
    "label.happened_at": "Incident date",
    "label.score_added": "Points added to scoreboard",
    "label.recalculating": "Recalculating scoreboard...",
    "label.search_city": "Search your city...",
    "label.all_cities": "All cities",
    "label.active_season": "Active Season",
    "label.finished_season": "Finished Season",
    "label.winner": "League Champion",
    "label.podium": "General Podium",
    "label.season": "Season",
    "label.round": "Round",
    "label.rules": "Official Rules",
    "label.methodology": "Methodology",
    "label.disclaimer": "Disclaimer",
    "label.no_incidents": "No incidents found with selected filters.",
    "label.clear_filters": "Clear Filters",
    "label.filter_category": "Filter by Category",
    "label.filter_city": "Filter by City",
    "label.filter_severity": "Filter by Severity",
    "label.share": "Share",
    "label.back": "Go back",
    "label.view_more": "View details",
    "label.latest_incidents": "LATEST REGISTERED INCIDENTS",
    "label.ranking_table": "ROUND SCOREBOARD",
    "label.points_short": "PTS",
  },
} as const;

export function useTranslations(lang: LanguageCode = "ca") {
  return function t(key: keyof typeof DICTIONARY.ca): string {
    const dict = DICTIONARY[lang] || DICTIONARY.ca;
    return dict[key] || DICTIONARY.ca[key] || key;
  };
}

const BASE_PATH = import.meta.env.BASE_URL && import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL.slice(0, -1)
  : import.meta.env.BASE_URL || "";

export function localizePath(path: string, lang: LanguageCode = "ca"): string {
  let cleanPath = path;
  // Remove base path if present
  if (BASE_PATH && cleanPath.startsWith(BASE_PATH)) {
    cleanPath = cleanPath.slice(BASE_PATH.length);
  }

  // Extract and strip any existing locale prefix
  cleanPath = cleanPath.replace(/^\/(es|en)(\/|$)/, "/");
  const formattedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;

  let localized = formattedPath;
  if (lang !== "ca") {
    localized = `/${lang}${formattedPath === "/" ? "" : formattedPath}`;
  }

  return `${BASE_PATH}${localized}`;
}

export function formatDate(dateStr: string | Date, lang: LanguageCode = "ca"): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  const localeMap = { ca: "ca-ES", es: "es-ES", en: "en-US" };
  return new Intl.DateTimeFormat(localeMap[lang], options).format(date);
}

export function formatRelativeTime(dateStr: string | Date, lang: LanguageCode = "ca"): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.round(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

  const localeMap = { ca: "ca-ES", es: "es-ES", en: "en-US" };
  const rtf = new Intl.RelativeTimeFormat(localeMap[lang], { numeric: "auto" });

  if (Math.abs(diffInHours) < 24) {
    return rtf.format(-diffInHours, "hour");
  }
  return rtf.format(-diffInDays, "day");
}
