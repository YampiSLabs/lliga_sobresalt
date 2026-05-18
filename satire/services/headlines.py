from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx
from django.conf import settings
from pydantic import BaseModel, Field, ValidationError, field_validator

from core.choices import HeadlineTone, IncidentStatus, RiskLevel
from press.models import Incident
from satire.models import SatiricalHeadline

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
Eres un redactor satírico de una liga ficticia llamada "La Lliga del Sobresalt".

Generas titulares breves con tono de crónica deportiva absurda a partir de incidentes publicados en prensa catalana.

Reglas:
- Máximo 110 caracteres.
- Tono de liga, jornada, derbi, clasificación, VAR, descuento o playoff.
- No añadas hechos nuevos.
- No bromees sobre víctimas, lesiones graves o muertes.
- No uses nombres de personas.
- No menciones nacionalidad, etnia, religión u origen.
- No conviertas sospechas en hechos.
- Debe quedar claro que es sátira.
- Evita odio, deshumanización o culpabilización colectiva.

Devuelve solo JSON:

{
  "headline": string,
  "tone": "deportivo|absurdo|irónico|suave",
  "risk_level": "low|medium|high",
  "why_safe": string
}
""".strip()


class HeadlineDraft(BaseModel):
    headline: str = Field(max_length=110)
    tone: str
    risk_level: str
    why_safe: str

    @field_validator("tone")
    @classmethod
    def validate_tone(cls, value: str) -> str:
        normalized = "ironico" if value == "irónico" else value
        if normalized not in {choice.value for choice in HeadlineTone}:
            raise ValueError(f"Invalid tone: {value}")
        return normalized

    @field_validator("risk_level")
    @classmethod
    def validate_risk_level(cls, value: str) -> str:
        if value not in {choice.value for choice in RiskLevel}:
            raise ValueError(f"Invalid risk level: {value}")
        return value


def can_generate_headline(incident: Incident) -> bool:
    return (
        incident.status in {IncidentStatus.PENDING_REVIEW, IncidentStatus.APPROVED}
        and incident.category != "no_relevante"
        and not incident.is_duplicate_of_id
    )


def generate_headline_for_incident(incident: Incident) -> SatiricalHeadline | None:
    if not can_generate_headline(incident):
        return None
    draft = parse_headline_json(call_ollama(build_prompt(incident)))
    return SatiricalHeadline.objects.create(
        incident=incident,
        text=draft.headline,
        tone=draft.tone,
        risk_level=draft.risk_level,
        why_safe=draft.why_safe,
        approved=False,
    )


def build_prompt(incident: Incident) -> str:
    return (
        f"Título neutral: {incident.canonical_title}\n"
        f"Resumen neutral: {incident.short_neutral_summary or ''}\n"
        f"Ciudad: {incident.city.name if incident.city else ''}\n"
        f"Categoría: {incident.category}\n"
        f"Gravedad: {incident.severity_1_5}\n"
        f"Confianza: {incident.confidence_0_1}"
    )


def parse_headline_json(payload: str) -> HeadlineDraft:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Ollama returned invalid headline JSON: {exc}") from exc
    try:
        return HeadlineDraft.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"Ollama headline JSON failed validation: {exc}") from exc


def call_ollama(prompt: str, retries: int = 2) -> str:
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/chat/completions"
    body: dict[str, Any] = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
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
            logger.warning("ollama headline call failed attempt=%s", attempt + 1, exc_info=True)
            if attempt < retries:
                time.sleep(1)
    raise RuntimeError(f"Ollama headline generation failed: {last_error}")

