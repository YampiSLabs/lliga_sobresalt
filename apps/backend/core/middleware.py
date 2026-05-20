from __future__ import annotations

import time
from collections.abc import Callable

from django.conf import settings
from django.core.cache import cache
from django.http import HttpRequest, HttpResponse
from django.http import JsonResponse


class SecurityHeadersMiddleware:
    """Add small, low-risk browser security headers for public/admin pages."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        )
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        if should_add_public_csp(request, response):
            response.headers.setdefault("Content-Security-Policy", public_content_security_policy())
        return response


class PublicApiRateLimitMiddleware:
    """Apply a small per-client rate limit to unauthenticated public API reads."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path.startswith("/api/"):
            limit = int(getattr(settings, "PUBLIC_API_RATE_LIMIT_PER_MINUTE", 120))
            window_seconds = int(getattr(settings, "PUBLIC_API_RATE_LIMIT_WINDOW_SECONDS", 60))
            if limit > 0 and window_seconds > 0:
                window = int(time.time() // window_seconds)
                client_ip = client_ip_for(request)
                cache_key = f"public-api-rate:{client_ip}:{window}"
                added = cache.add(cache_key, 1, timeout=window_seconds + 1)
                count = 1 if added else cache.incr(cache_key)
                if count > limit:
                    return JsonResponse(
                        {"error": "Rate limit exceeded"},
                        status=429,
                        headers={"Retry-After": str(window_seconds)},
                    )
        return self.get_response(request)


def client_ip_for(request: HttpRequest) -> str:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def should_add_public_csp(request: HttpRequest, response: HttpResponse) -> bool:
    if request.path.startswith("/admin/"):
        return False
    content_type = response.headers.get("Content-Type", "")
    return "text/html" in content_type


def public_content_security_policy() -> str:
    return (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "upgrade-insecure-requests"
    )
