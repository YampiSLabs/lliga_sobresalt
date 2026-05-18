# La Lliga del Sobresalt

Monorepo para una web satírica de ranking/liga basada solo en noticias publicadas por medios whitelisted.

- `apps/web`: Astro estático para GitHub Pages.
- `apps/backend`: Django monolith para VPS, admin, scraping, scoring, API pública y Celery.
- PostgreSQL + Redis viven junto al backend en Docker/VPS.

El sitio no mide criminalidad real ni usa fuentes oficiales como fuente primaria.

## Desarrollo Local Con Docker

```powershell
Copy-Item .env.docker.example .env
docker compose --env-file .env up -d --build
```

Servicios:

- Astro dev se ejecuta fuera de Docker con pnpm en `http://localhost:4321`.
- Django backend se ejecuta en Docker en `http://localhost:8000`.
- Postgres, Redis, Celery worker y Celery beat comparten la bridge `lliga_backend_bridge`.

```powershell
pnpm install
pnpm dev
docker compose --env-file .env exec backend python manage.py createsuperuser
docker compose --env-file .env exec backend python manage.py scrape_press
docker compose --env-file .env exec backend python manage.py process_articles
docker compose --env-file .env exec backend python manage.py recalculate_rankings
```

Ollama corre fuera de Docker en Windows; `.env.docker.example` usa:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
```

## Frontend Astro

Astro genera HTML estático apto para GitHub Pages.

```powershell
pnpm dev
pnpm build
pnpm preview
```

Variables:

```env
PUBLIC_SITE_URL=https://beatrizagent.github.io/lliga_sobresalt
PUBLIC_BASE_PATH=/lliga_sobresalt
PUBLIC_API_BASE_URL=https://tu-vps.example.com
```

El workflow `.github/workflows/deploy-pages.yml` publica `apps/web/dist` en GitHub Pages.
Configura `PUBLIC_API_BASE_URL` como GitHub Actions variable del repo apuntando al backend del VPS.

## Backend Django

```powershell
py -3.14 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r apps/backend/requirements.txt
Copy-Item .env.example .env
cd apps/backend
..\..\.venv\Scripts\python manage.py migrate
..\..\.venv\Scripts\python manage.py createsuperuser
..\..\.venv\Scripts\python manage.py runserver
```

Endpoints públicos para Astro:

- `GET /api/ranking/`
- `GET /api/incidents/`

No exponen `raw_text`.

## Flujo MVP

1. Crea `Outlet` en admin con `rss_url` o `section_url`.
2. Crea `LeagueSeason` y `LeagueRound` abierta.
3. Ejecuta:

```powershell
docker compose --env-file .env exec backend python manage.py scrape_press
docker compose --env-file .env exec backend python manage.py process_articles
docker compose --env-file .env exec backend python manage.py recalculate_rankings
```

4. Revisa `Incident` y `SatiricalHeadline` en admin.
5. Aprueba incidentes y titulares.
6. Astro consume API pública desde GitHub Pages.

## Ollama

```powershell
ollama pull qwen3:4b
ollama serve
```

No se usa OpenAI API, OpenRouter ni servicios de pago.

## Celery

```powershell
docker compose --env-file .env up -d celery_worker celery_beat
```

Tareas:

- `scrape_press_task`
- `process_articles_task`
- `recalculate_rankings_task`

## Tests Y Checks

```powershell
pnpm build
pnpm backend:check
pnpm backend:test
docker compose --env-file .env config
```

## CodeGraph

```powershell
pnpm codegraph:status
pnpm codegraph:sync
pnpm exec codegraph query Incident --limit 5
```

CodeGraph está configurado globalmente en Codex/Gemini/opencode y este repo tiene índice local en `.codegraph/`.

## Seguridad Y Despliegue

- Backend en VPS detrás de HTTPS.
- `DEBUG=False` exige `SECRET_KEY` real.
- `ALLOWED_HOSTS` debe incluir dominio/API VPS.
- `CSRF_TRUSTED_ORIGINS` debe incluir dominio API.
- `CORS_ALLOWED_ORIGINS` debe incluir GitHub Pages y dominio Astro.
- Cookies de sesión y CSRF son `HttpOnly`; en producción usa `Secure=True`.
- Headers activos: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X_FRAME_OPTIONS=DENY`.
- No se publican artículos completos ni `raw_text`.
- No se intenta saltar paywalls.
