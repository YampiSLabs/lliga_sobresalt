from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


def chat_completion_json(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    purpose: str,
    retries: int = 2,
) -> str:
    configs = get_llm_configs()
    last_error: Exception | None = None
    attempted_providers: list[str] = []

    for config in configs:
        attempted_providers.append(config["provider"])
        body: dict[str, Any] = {
            "model": config["model"],
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        for attempt in range(retries + 1):
            try:
                with httpx.Client(timeout=config["timeout"]) as client:
                    response = client.post(config["url"], json=body, headers=config["headers"])
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
            except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "%s call failed provider=%s attempt=%s",
                    purpose,
                    config["provider"],
                    attempt + 1,
                    exc_info=True,
                )
                if attempt < retries:
                    sleep_time = (2 ** attempt) * 2
                    logger.info(
                        "Sleeping %s seconds before retrying %s call...",
                        sleep_time,
                        purpose,
                    )
                    time.sleep(sleep_time)
        logger.warning("%s provider exhausted provider=%s", purpose, config["provider"])
    raise RuntimeError(f"{purpose} failed via providers {attempted_providers}: {last_error}")


def get_llm_config() -> dict[str, Any]:
    return get_llm_configs()[0]


def get_llm_configs() -> list[dict[str, Any]]:
    configs: list[dict[str, Any]] = []
    if settings.OPENROUTER_API_KEY:
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        }
        if settings.OPENROUTER_SITE_URL:
            headers["HTTP-Referer"] = settings.OPENROUTER_SITE_URL
        if settings.OPENROUTER_APP_NAME:
            headers["X-Title"] = settings.OPENROUTER_APP_NAME
        configs.append(
            {
                "provider": "openrouter",
                "url": f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions",
                "model": settings.OPENROUTER_MODEL,
                "timeout": settings.OPENROUTER_TIMEOUT_SECONDS,
                "headers": headers,
            }
        )
    if settings.OPENCODE_API_KEY:
        configs.append(
            {
                "provider": "opencode",
                "url": f"{settings.OPENCODE_BASE_URL.rstrip('/')}/chat/completions",
                "model": settings.OPENCODE_MODEL,
                "timeout": settings.OPENCODE_TIMEOUT_SECONDS,
                "headers": {"Authorization": f"Bearer {settings.OPENCODE_API_KEY}"},
            }
        )
    configs.append(
        {
            "provider": "ollama",
            "url": f"{settings.OLLAMA_BASE_URL.rstrip('/')}/chat/completions",
            "model": settings.OLLAMA_MODEL,
            "timeout": settings.OLLAMA_TIMEOUT_SECONDS,
            "headers": {},
        }
    )
    return configs
