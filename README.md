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
OLLAMA_MODEL=qwen3:4b
OLLAMA_TIMEOUT_SECONDS=60
```

Si `OPENROUTER_API_KEY` existe, Django usa OpenRouter antes que Ollama:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openrouter/free
OPENROUTER_TIMEOUT_SECONDS=60
OPENROUTER_APP_NAME=La Lliga del Sobresalt
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
PUBLIC_API_BASE_URL=https://sobresalt.yampi.eu
```

El workflow `.github/workflows/deploy-pages.yml` publica `apps/web/dist` en GitHub Pages.
Configura `PUBLIC_API_BASE_URL=https://sobresalt.yampi.eu` como GitHub Actions variable del repo apuntando al backend del VPS.
En builds de produccion, `PUBLIC_API_BASE_URL` es obligatorio. La web publica no usa datos mock si la API no responde.

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

## VPS Environment

Las credenciales reales del Postgres compartido del VPS se guardan localmente en `.env.vps`.
Ese archivo no se versiona. Para Dokploy/VPS, copia sus variables al entorno de la app backend.
No uses `.env` local para produccion. Usa variables de Dokploy o un `.env.production` local no versionado basado en `.env.production.example`.

La base de datos creada para este proyecto usa:

```env
DB_NAME=lliga_sobresalt_db
DB_USER=lliga_sobresalt_user
DB_HOST=app-postgres
DB_PORT=5432
REDIS_URL=redis://app-redis:6379/0
```

`DATABASE_URL` y `DB_PASSWORD` están en `.env.vps`.

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
$env:PUBLIC_API_BASE_URL="https://sobresalt.yampi.eu"; pnpm build
pnpm backend:check
pnpm backend:test
docker compose -f docker-compose.prod.yml --env-file .env.production.example config
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
- `DATABASE_URL` y `REDIS_URL` son obligatorias con `DEBUG=False`.
- `ALLOWED_HOSTS` debe incluir dominio/API VPS.
- `CSRF_TRUSTED_ORIGINS` debe incluir dominio API.
- `CORS_ALLOWED_ORIGINS` debe incluir GitHub Pages y dominio Astro.
- Cookies de sesión y CSRF son `HttpOnly`; en producción usa `Secure=True`.
- Headers activos: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X_FRAME_OPTIONS=DENY`.
- No se publican artículos completos ni `raw_text`.
- No se intenta saltar paywalls.

## Checklist Produccion

1. Rota cualquier `OPENROUTER_API_KEY` que haya pasado por `.env` local o por logs de `docker compose config`.
2. Crea `.env.production` local desde `.env.production.example` o configura las mismas variables en Dokploy.
3. Comprueba que `DEBUG=False`, `DATABASE_URL`, `REDIS_URL`, `ALLOWED_HOSTS=sobresalt.yampi.eu`, `CSRF_TRUSTED_ORIGINS=https://sobresalt.yampi.eu` y `CORS_ALLOWED_ORIGINS=https://beatrizagent.github.io`.
4. En GitHub, configura la variable del repo `PUBLIC_API_BASE_URL=https://sobresalt.yampi.eu`.
5. Despliega backend y confirma que el arranque ejecuta `python manage.py migrate` y `python manage.py collectstatic --noinput`.
6. Ejecuta smoke test del backend: `curl https://sobresalt.yampi.eu/api/ranking/`.
7. Ejecuta smoke test de GitHub Pages y confirma que no hay llamadas a `localhost:8000` en la consola del navegador.
