from __future__ import annotations

import json
import logging
import re
import unicodedata
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

from core.choices import IncidentCategory
from core.llm import chat_completion_json
from press.models import RawArticle

logger = logging.getLogger(__name__)

MAX_RAW_TEXT_CHARS = 6000
CATEGORY_KEYWORDS = {
    IncidentCategory.APUNYALAMENT: [
        "apunalamiento", "apunyalament", "ganivetada"
    ],
    IncidentCategory.ARMA_BLANCA: [
        "arma blanca", "navaja", "cuchillo", "machete", "ganivet", "navalla", "machet"
    ],
    IncidentCategory.HOMICIDIO: [
        "homicidio", "homicidi", "asesinato", "assassinat", "muerto", "mort", "crimen", "crim"
    ],
    IncidentCategory.ROBO_VIOLENTO: [
        "robo con violencia", "robatori violent", "atraco", "atracament", "tiron", "estirada", "intimidacion", "intimidacio"
    ],
    IncidentCategory.PELEA: [
        "pelea", "baralla", "reyerta", "batahola", "agresion multitudinaria", "agressio multitudinaria"
    ],
    IncidentCategory.AGRESION: [
        "agresion", "agressio", "apuñalar", "apunyalar", "herido", "ferit", "paliza", "pallissa", "ataque", "atemptat"
    ],
    IncidentCategory.INCIVISMO: [
        "incivismo", "incivisme", "botellon", "botellot", "vandalismo", "vandalisme", "pintadas", "pintades", "graffiti", "destrozos", "danos", "danys", "orinar", "pipi", "ruido", "soroll", "basura", "escombraries", "molestias", "molesties"
    ],
    IncidentCategory.DISTURBIOS: [
        "aldarulls", "disturbios", "contenidors cremats", "contenedores quemados", "barricada", "quema", "crema", "cargas", "carregues", "policia", "antidisturbios", "mossos"
    ],
    IncidentCategory.TRANSPORTE_PUBLICO: [
        "metro", "tren", "estacion de metro", "estacion de tren", "estacio de metro", "estacio de tren", "autobus", "bus", "renfe", "rodalies", "ferrocarrils", "fgc"
    ],
    IncidentCategory.OTRO_SUCESO: [
        "incidente", "incident", "suceso", "fets", "detencion", "detingut", "detenido", "arrestado", "arrestat"
    ]
}

SYSTEM_PROMPT = """
Eres un clasificador y extractor de noticias para "La Lliga del Sobresalt", una web satirica basada solo en noticias ya publicadas por medios catalanes.

Tu trabajo NO es redactar, opinar ni investigar. Tu trabajo es decidir si una noticia sirve como incidente revisable y devolver un JSON limpio para Django con soporte multilingue.

Devuelve SIEMPRE un unico objeto JSON valido. No uses markdown. No anadas texto antes ni despues del JSON. No inventes claves nuevas.

CRITERIO DE RELEVANCIA
- Marca is_relevant=true solo si el texto describe un suceso concreto ocurrido en Catalunya o claramente vinculado a Catalunya.
- Suceso concreto significa: agresion, pelea, apunalamiento, arma blanca, homicidio, robo violento, disturbios, incivismo relevante, incidente en transporte publico o hecho similar.
- Marca is_relevant=false si la noticia es solo politica, opinion, tribunales sin hecho nuevo, economia, deportes, meteorologia, cultura, trafico ordinario, prevencion, estadistica, entrevista, sucesos fuera de Catalunya o texto demasiado ambiguo.
- Si is_relevant=false, category debe ser "no_relevante", severity_1_5 debe ser 1, confidence_0_1 debe reflejar la confianza del descarte, y el resto de campos no confirmados deben ser null.

REGLAS DE EXTRACCION
- No inventes datos. Extrae solo lo que aparezca claramente en titular, entradilla o texto.
- Si ciudad, barrio, provincia o fecha no aparecen claramente, usa null.
- happened_at debe ser ISO 8601 si hay fecha/hora clara. Si solo hay fecha, usa "YYYY-MM-DD". Si es relativo ("ayer", "esta madrugada") y no se puede resolver con seguridad, usa null.
- No atribuyas culpabilidad. No conviertas detenidos, investigados o sospechosos en culpables.
- No incluyas nombres de victimas, sospechosos, detenidos, testigos ni menores.
- No menciones nacionalidad, etnia, religion, origen, situacion migratoria ni rasgos protegidos, aunque aparezcan en el texto.
- Diferencia hechos confirmados de especulacion. Si algo no esta confirmado, baja confidence_0_1 y explicalo en scoring_notes.
- Si parece actualizacion, seguimiento, repeticion de otra noticia o pieza basada en otro medio, marca is_duplicate_or_update=true.
- Si menciona fuente policial, mossos, guardia urbana, policia local, SEM, ayuntamiento o juzgado como confirmacion, marca mentions_police_confirmation=true solo cuando sea fuente del hecho.
- Si cita otro medio como origen de la noticia, marca mentions_other_media_as_source=true y rellena source_media_mentioned si el nombre esta claro.

CATEGORIAS EXACTAS
category debe ser exactamente uno de estos valores:
- "apunyalament": apunalamiento o agresion con cuchillo/navaja claramente usada.
- "arma_blanca": presencia, amenaza o uso de arma blanca sin apunalamiento claro.
- "homicidio": muerte violenta, asesinato, homicidio o investigacion por muerte criminal.
- "robo_violento": robo con violencia, intimidacion, atraco o tiron con agresion.
- "pelea": pelea, reyerta, batalla campal o enfrentamiento entre varias personas.
- "agresion": agresion fisica individual sin arma blanca clara.
- "incivismo": vandalismo, danos, quema de contenedores leve, ocupacion conflictiva o conducta incivica relevante.
- "disturbios": altercados colectivos, cargas, disturbios, grandes danos o desorden publico.
- "transporte_publico": incidente relevante en metro, tren, bus, estacion o infraestructura de transporte publico. Si ademas hay apunalamiento/homicidio, prioriza la categoria mas grave.
- "otro_suceso": suceso relevante que no encaja mejor en categorias anteriores.
- "no_relevante": noticia descartada.

SEVERIDAD
- 1: incidente leve, sin violencia fisica clara o descarte no relevante.
- 2: incivismo o altercado menor con poca afectacion.
- 3: pelea/agresion/robo violento sin lesiones graves confirmadas.
- 4: arma blanca, apunalamiento no mortal, disturbios graves o lesiones graves.
- 5: homicidio, muerte violenta o violencia extrema confirmada.

CONFIANZA
- 0.0-0.3: texto insuficiente, ambiguo o solo indicios.
- 0.4-0.6: suceso probable, pero faltan datos clave o hay mucha ambiguedad.
- 0.7-0.85: titular y texto sostienen bien la extraccion.
- 0.86-1.0: datos claros, categoria inequivoca, ubicacion y fuente consistentes.

SALIDA Y TRADUCCION
- short_neutral_summary_ca: una frase breve, neutral y sin morbo en Catalan.
- short_neutral_summary_es: una frase breve, neutral y sin morbo en Espanol.
- short_neutral_summary_en: una frase breve, neutral y sin morbo en Ingles.
- scoring_notes_ca: explicacion en Catalan de por que asignas categoria, severidad y confianza.
- scoring_notes_es: explicacion en Espanol de por que asignas categoria, severidad y confianza.
- scoring_notes_en: explicacion en Ingles de por que asignas categoria, severidad y confianza.
- Usa null, no cadenas vacias, cuando falte un dato.
- Usa booleanos reales, numeros reales e integer real; no strings para booleanos o numeros.

Devuelve exactamente este JSON:

{
  "is_relevant": boolean,
  "category": string,
  "city": string | null,
  "neighborhood": string | null,
  "province": string | null,
  "happened_at": string | null,
  "severity_1_5": integer,
  "confidence_0_1": number,
  "is_duplicate_or_update": boolean,
  "mentions_police_confirmation": boolean,
  "mentions_other_media_as_source": boolean,
  "source_media_mentioned": string | null,
  "short_neutral_summary_ca": string | null,
  "short_neutral_summary_es": string | null,
  "short_neutral_summary_en": string | null,
  "scoring_notes_ca": string | null,
  "scoring_notes_es": string | null,
  "scoring_notes_en": string | null
}
""".strip()


class ExtractedIncident(BaseModel):
    is_relevant: bool
    category: str
    city: str | None
    neighborhood: str | None
    province: str | None
    happened_at: str | None
    severity_1_5: int = Field(ge=1, le=5)
    confidence_0_1: float = Field(ge=0, le=1)
    is_duplicate_or_update: bool
    mentions_police_confirmation: bool
    mentions_other_media_as_source: bool
    source_media_mentioned: str | None
    short_neutral_summary_ca: str | None
    short_neutral_summary_es: str | None
    short_neutral_summary_en: str | None
    scoring_notes_ca: str | None
    scoring_notes_es: str | None
    scoring_notes_en: str | None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        valid = {choice.value for choice in IncidentCategory}
        if value not in valid:
            raise ValueError(f"Invalid category: {value}")
        return value


def extraction_to_dict(extraction: ExtractedIncident) -> dict[str, Any]:
    return extraction.model_dump(mode="json")


def text_matches_keywords(*parts: str | None) -> bool:
    """
    Checks if the provided text parts contain any of the keywords
    from the categorized dictionary (case-insensitive and normalized).
    """
    haystack = normalize_text(" ".join(part or "" for part in parts))
    
    for keywords in CATEGORY_KEYWORDS.values():
        for keyword in keywords:
            if keyword_matches(haystack, keyword):
                return True
                
    return False


def text_matches_cities(*parts: str | None) -> bool:
    """
    Checks if the provided text parts mention any of the active cities
    or their aliases in a normalized, case-insensitive way with word boundaries.
    """
    from league.models import City
    
    haystack = normalize_text(" ".join(part or "" for part in parts))
    active_cities = City.objects.filter(is_active=True)
    
    for city in active_cities:
        # Check main name
        normalized_name = normalize_text(city.name)
        pattern = rf"(?<!\w){re.escape(normalized_name)}(?!\w)"
        if re.search(pattern, haystack):
            return True
            
        # Check aliases
        for alias in city.aliases:
            normalized_alias = normalize_text(alias)
            pattern_alias = rf"(?<!\w){re.escape(normalized_alias)}(?!\w)"
            if re.search(pattern_alias, haystack):
                return True
                
    return False


def keyword_matches(haystack: str, keyword: str) -> bool:
    normalized_keyword = normalize_text(keyword)
    pattern = rf"(?<!\w){re.escape(normalized_keyword)}(?!\w)"
    return bool(re.search(pattern, haystack))


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def build_user_prompt(article: RawArticle) -> str:
    raw_text = (article.raw_text or "")[:MAX_RAW_TEXT_CHARS]
    return (
        f"Medio: {article.outlet.name}\n"
        f"URL: {article.url}\n"
        f"Titular: {article.headline}\n"
        f"Entradilla: {article.excerpt or ''}\n"
        f"Texto limitado:\n{raw_text}"
    )


def extract_article(article: RawArticle) -> ExtractedIncident:
    payload = call_ollama(messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(article)},
    ])
    return parse_extraction_json(payload)


def parse_extraction_json(payload: str) -> ExtractedIncident:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Ollama returned invalid JSON: {exc}") from exc
    try:
        return ExtractedIncident.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"Ollama JSON failed validation: {exc}") from exc


def call_ollama(messages: list[dict[str, str]], retries: int = 2) -> str:
    return chat_completion_json(
        messages,
        temperature=0,
        purpose="incident extraction",
        retries=retries,
    )
