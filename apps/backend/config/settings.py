from pathlib import Path
import sys

import environ
from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
)
for env_file in (ROOT_DIR / ".env", BASE_DIR / ".env"):
    if env_file.exists():
        environ.Env.read_env(env_file)

DEBUG = env.bool("DEBUG", default=False)
IS_TESTING = "test" in sys.argv


def required_env(name: str) -> str:
    value = env(name, default="")
    if not value:
        raise RuntimeError(f"{name} must be set when DEBUG=False")
    return value


SECRET_KEY = env("SECRET_KEY", default="dev-only-change-me") if DEBUG else required_env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"] if DEBUG else [])
if not DEBUG:
    if SECRET_KEY == "dev-only-change-me":
        raise RuntimeError("SECRET_KEY must be a real production value when DEBUG=False")
    if not ALLOWED_HOSTS:
        raise RuntimeError("ALLOWED_HOSTS must be set when DEBUG=False")

INSTALLED_APPS = [
    "jazzmin",
    "modeltranslation",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_filters",
    "import_export",
    "core",
    "league",
    "press",
    "satire",
]

JAZZMIN_SETTINGS = {
    "site_title": "La Lliga Admin",
    "site_header": "La Lliga del Sobresalt",
    "site_brand": "La Lliga",
    "welcome_sign": "Panell de control",
    "copyright": "La Lliga del Sobresalt",
    "search_model": ["press.RawArticle", "press.Incident", "league.City"],
    "topmenu_links": [
        {"name": "Dashboard", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"name": "Web publica", "url": "/", "new_window": True},
    ],
    "order_with_respect_to": [
        "press",
        "press.Outlet",
        "press.RawArticle",
        "press.Incident",
        "press.IncidentSource",
        "satire",
        "league",
        "auth",
    ],
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user",
        "auth.Group": "fas fa-users",
        "league.City": "fas fa-city",
        "league.LeagueSeason": "fas fa-calendar",
        "league.LeagueRound": "fas fa-stopwatch",
        "league.CityScore": "fas fa-ranking-star",
        "league.ScoringRule": "fas fa-scale-balanced",
        "press.Outlet": "fas fa-newspaper",
        "press.RawArticle": "fas fa-rss",
        "press.Incident": "fas fa-triangle-exclamation",
        "press.IncidentSource": "fas fa-link",
        "satire.SatiricalHeadline": "fas fa-quote-left",
    },
    "show_sidebar": True,
    "navigation_expanded": True,
    "hide_apps": [],
    "hide_models": [],
}

JAZZMIN_UI_TWEAKS = {
    "theme": "darkly",
    "dark_mode_theme": "darkly",
    "navbar": "navbar-dark",
    "sidebar": "sidebar-dark-warning",
    "accent": "accent-warning",
    "brand_colour": "navbar-dark",
    "button_classes": {
        "primary": "btn-warning",
        "secondary": "btn-outline-light",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
    "actions_sticky_top": True,
}

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "core.middleware.PublicApiRateLimitMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.SecurityHeadersMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "core" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

if IS_TESTING:
    DATABASE_URL = env("TEST_DATABASE_URL", default="sqlite:///:memory:")
else:
    DATABASE_URL = env("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}") if DEBUG else required_env("DATABASE_URL")
DATABASES = {
    "default": env.db_url("TEST_DATABASE_URL" if IS_TESTING else "DATABASE_URL", default=DATABASE_URL)
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ca"
TIME_ZONE = "Europe/Madrid"
USE_I18N = True
USE_TZ = True

from django.utils.translation import gettext_lazy as _

LANGUAGES = [
    ("ca", _("Catalan")),
    ("es", _("Spanish")),
    ("en", _("English")),
]

MODELTRANSLATION_DEFAULT_LANGUAGE = "ca"
MODELTRANSLATION_LANGUAGES = ("ca", "es", "en")
MODELTRANSLATION_FALLBACK_LANGUAGES = ("ca",)

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = env("MEDIA_URL", default="/media/")
if not MEDIA_URL.startswith("/"):
    MEDIA_URL = f"/{MEDIA_URL}"
if not MEDIA_URL.endswith("/"):
    MEDIA_URL = f"{MEDIA_URL}/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))
SERVE_MEDIA_FILES = env.bool("SERVE_MEDIA_FILES", default=DEBUG)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
}

PUBLIC_API_RATE_LIMIT_PER_MINUTE = env.int("PUBLIC_API_RATE_LIMIT_PER_MINUTE", default=120)
PUBLIC_API_RATE_LIMIT_WINDOW_SECONDS = env.int("PUBLIC_API_RATE_LIMIT_WINDOW_SECONDS", default=60)

REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0") if DEBUG else required_env("REDIS_URL")
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_IGNORE_RESULT = True
CELERY_TASK_ROUTES = {
    "process_article_task": {"queue": "llm"},
    "generate_headline_task": {"queue": "llm"},
}

CELERY_BEAT_SCHEDULE = {
    "scrape-press-hourly": {
        "task": "scrape_press_task",
        "schedule": crontab(minute=0),
    },
    "process-articles-every-3-minutes": {
        "task": "process_articles_task",
        "schedule": crontab(minute="*/3"),
    },
    "recalculate-rankings-hourly": {
        "task": "recalculate_rankings_task",
        "schedule": crontab(minute=55),
    },
}

OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", default="http://localhost:11434/v1")
OLLAMA_MODEL = env("OLLAMA_MODEL", default="qwen3:4b")
OLLAMA_TIMEOUT_SECONDS = env.int("OLLAMA_TIMEOUT_SECONDS", default=60)
OPENROUTER_API_KEY = env("OPENROUTER_API_KEY", default="")
OPENROUTER_BASE_URL = env("OPENROUTER_BASE_URL", default="https://openrouter.ai/api/v1")
OPENROUTER_MODEL = env("OPENROUTER_MODEL", default="openrouter/free")
OPENROUTER_TIMEOUT_SECONDS = env.int("OPENROUTER_TIMEOUT_SECONDS", default=60)
OPENROUTER_MAX_ARTICLES_PER_BATCH = env.int("OPENROUTER_MAX_ARTICLES_PER_BATCH", default=5)
OPENROUTER_DAILY_CALL_LIMIT = env.int("OPENROUTER_DAILY_CALL_LIMIT", default=300)
OPENROUTER_RATE_LIMIT_PER_MINUTE = env.int("OPENROUTER_RATE_LIMIT_PER_MINUTE", default=18)
OPENROUTER_ESTIMATED_CALLS_PER_ARTICLE = env.int("OPENROUTER_ESTIMATED_CALLS_PER_ARTICLE", default=2)
OPENROUTER_SITE_URL = env("OPENROUTER_SITE_URL", default="")
OPENROUTER_APP_NAME = env("OPENROUTER_APP_NAME", default="La Lliga del Sobresalt")
OPENCODE_API_KEY = env("OPENCODE_API_KEY", default="")
OPENCODE_BASE_URL = env("OPENCODE_BASE_URL", default="https://opencode.ai/zen/v1")
OPENCODE_MODEL = env("OPENCODE_MODEL", default="big-pickle")
OPENCODE_TIMEOUT_SECONDS = env.int("OPENCODE_TIMEOUT_SECONDS", default=60)
AUTO_APPROVE_EXTRACTED_INCIDENTS = env.bool("AUTO_APPROVE_EXTRACTED_INCIDENTS", default=False)
SCRAPER_MAX_IMAGE_BYTES = env.int("SCRAPER_MAX_IMAGE_BYTES", default=5 * 1024 * 1024)

CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[] if not DEBUG else ["http://localhost:8000"])
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=False)
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[] if not DEBUG else ["http://localhost:4321"])
if not DEBUG:
    if not CSRF_TRUSTED_ORIGINS:
        raise RuntimeError("CSRF_TRUSTED_ORIGINS must be set when DEBUG=False")
    if not CORS_ALLOW_ALL_ORIGINS and not CORS_ALLOWED_ORIGINS:
        raise RuntimeError("CORS_ALLOWED_ORIGINS must be set when DEBUG=False")
CORS_ALLOW_CREDENTIALS = False
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=not DEBUG)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=not DEBUG)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=0 if DEBUG else 31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=not DEBUG)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
