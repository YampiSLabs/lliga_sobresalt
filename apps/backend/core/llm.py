from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class OpenRouterQuotaExceeded(Exception):
    pass


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
                if config["provider"] == "openrouter":
                    reserve_openrouter_call()
                with httpx.Client(timeout=config["timeout"]) as client:
                    response = client.post(config["url"], json=body, headers=config["headers"])
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    if not content or not content.strip():
                        raise ValueError("Received empty or None content from LLM provider")
                    return content
            except OpenRouterQuotaExceeded as exc:
                last_error = exc
                logger.info(
                    "%s provider skipped provider=%s: %s",
                    purpose,
                    config["provider"],
                    exc,
                )
                break
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


def reserve_openrouter_call(now=None) -> None:
    from core.models import LlmProviderUsage

    current = now or timezone.now()
    day_start, minute_start = openrouter_window_starts(current)
    daily_limit = int(getattr(settings, "OPENROUTER_DAILY_CALL_LIMIT", 300))
    minute_limit = int(getattr(settings, "OPENROUTER_RATE_LIMIT_PER_MINUTE", 18))

    with transaction.atomic():
        day_usage, _ = LlmProviderUsage.objects.select_for_update().get_or_create(
            provider="openrouter",
            window_kind=LlmProviderUsage.WINDOW_DAY,
            window_start=day_start,
            defaults={"attempts": 0, "updated_at": current},
        )
        minute_usage, _ = LlmProviderUsage.objects.select_for_update().get_or_create(
            provider="openrouter",
            window_kind=LlmProviderUsage.WINDOW_MINUTE,
            window_start=minute_start,
            defaults={"attempts": 0, "updated_at": current},
        )
        if day_usage.attempts >= daily_limit:
            raise OpenRouterQuotaExceeded("OpenRouter daily call limit reached")
        if minute_usage.attempts >= minute_limit:
            raise OpenRouterQuotaExceeded("OpenRouter per-minute rate limit reached")
        day_usage.attempts += 1
        minute_usage.attempts += 1
        day_usage.updated_at = current
        minute_usage.updated_at = current
        day_usage.save(update_fields=["attempts", "updated_at"])
        minute_usage.save(update_fields=["attempts", "updated_at"])


def openrouter_window_starts(now=None) -> tuple[Any, Any]:
    current = timezone.localtime(now or timezone.now())
    day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    minute_start = current.replace(second=0, microsecond=0)
    return day_start, minute_start


def openrouter_usage_count(window_kind: str, now=None) -> int:
    from core.models import LlmProviderUsage

    day_start, minute_start = openrouter_window_starts(now)
    window_start = day_start if window_kind == LlmProviderUsage.WINDOW_DAY else minute_start
    usage = LlmProviderUsage.objects.filter(
        provider="openrouter",
        window_kind=window_kind,
        window_start=window_start,
    ).first()
    return usage.attempts if usage else 0


def openrouter_dispatch_capacity(max_articles: int | None = None, now=None) -> int:
    if not getattr(settings, "OPENROUTER_API_KEY", ""):
        return max_articles if max_articles is not None else int(getattr(settings, "OPENROUTER_MAX_ARTICLES_PER_BATCH", 5))

    batch_limit = max_articles if max_articles is not None else int(getattr(settings, "OPENROUTER_MAX_ARTICLES_PER_BATCH", 5))
    daily_limit = int(getattr(settings, "OPENROUTER_DAILY_CALL_LIMIT", 300))
    estimated_calls = max(1, int(getattr(settings, "OPENROUTER_ESTIMATED_CALLS_PER_ARTICLE", 2)))
    current = timezone.localtime(now or timezone.now())
    day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    elapsed_seconds = max(0, int((current - day_start).total_seconds()))
    allowed_now = min(daily_limit, max(1, (daily_limit * elapsed_seconds) // 86400))
    used_today = openrouter_usage_count("day", current)
    available_calls = max(0, allowed_now - used_today)
    return min(batch_limit, available_calls // estimated_calls)
