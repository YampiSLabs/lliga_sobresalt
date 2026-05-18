from __future__ import annotations

import json
import logging
import time
import unicodedata
from typing import Any

import httpx
from django.conf import settings
from pydantic import BaseModel, Field, ValidationError, field_validator

from core.choices import IncidentCategory
from press.models import RawArticle

logger = logging.getLogger(__name__)

MAX_RAW_TEXT_CHARS = 6000
KEYWORDS = [
    "apuñalamiento",
    "apunyalament",
    "ganivetada",
    "arma blanca",
    "robo con violencia",
    "robatori violent",
    "atraco",
    "atracament",
    "pelea",
    "baralla",
    "reyerta",
    "agresión",
    "agressió",
    "homicidio",
    "homicidi",
    "asesinato",
    "assassinat",
    "incivismo",
    "incivisme",
    "aldarulls",
    "disturbios",
    "contenidors cremats",
    "contenedores quemados",
    "metro",
    "tren",
    "estación",
    "estació",
]

SYSTEM_PROMPT = """
Eres un extractor de incidentes de prensa catalana para una web satírica de ranking de titulares de sucesos.

Tu tarea es analizar titulares, entradillas y fragmentos de noticias publicadas por medios catalanes.

Devuelve SIEMPRE JSON válido. No escribas markdown. No expliques nada fuera del JSON.

Reglas estrictas:
- No inventes datos.
- Si la ciudad no aparece claramente, usa null.
- Si la fecha del incidente no aparece claramente, usa null.
- No atribuyas culpabilidad. Usa lenguaje neutral.
- No incluyas nombres de víctimas, sospechosos ni menores.
- No menciones nacionalidad, etnia, religión u origen, aunque aparezca en el texto.
- Si el artículo solo habla de política, opinión, economía, deportes, meteorología o sucesos fuera de Catalunya, marca is_relevant=false.
- Si parece duplicado, actualización o noticia basada en otro medio, indícalo.
- Diferencia entre hecho confirmado por el medio y especulación.
- La salida debe servir para una liga satírica de titulares, no para una estadística oficial.

Categorías válidas:
- apunyalament
- arma_blanca
- homicidio
- robo_violento
- pelea
- agresion
- incivismo
- disturbios
- transporte_publico
- otro_suceso
- no_relevante

Devuelve este JSON:

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
  "short_neutral_summary": string | null,
  "scoring_notes": string | null
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
    short_neutral_summary: str | None
    scoring_notes: str | None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        valid = {choice.value for choice in IncidentCategory}
        if value not in valid:
            raise ValueError(f"Invalid category: {value}")
        return value


def text_matches_keywords(*parts: str | None) -> bool:
    haystack = normalize_text(" ".join(part or "" for part in parts))
    return any(normalize_text(keyword) in haystack for keyword in KEYWORDS)


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
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/chat/completions"
    body: dict[str, Any] = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages,
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
                response = client.post(url, json=body)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            last_error = exc
            logger.warning("ollama extraction call failed attempt=%s", attempt + 1, exc_info=True)
            if attempt < retries:
                time.sleep(1)
    raise RuntimeError(f"Ollama extraction failed: {last_error}")

