# La Lliga del Sobresalt

MVP Django para una web satírica tipo liga/ranking basada solo en noticias publicadas por medios de prensa whitelisted. No usa fuentes oficiales como fuente primaria y no mide criminalidad real.

## Stack

- Python 3.12+ (este repo se verificó con `py -3.14`)
- Django 5.2 LTS
- PostgreSQL vía `DATABASE_URL`
- Redis + Celery + Celery Beat
- Ollama local compatible con OpenAI API en `http://localhost:11434/v1`

## Desarrollo local con Docker

La ruta recomendada para desarrollo local es Docker Compose. Todos los servicios backend comparten una red bridge explícita llamada `lliga_backend_bridge`.

```powershell
Copy-Item .env.docker.example .env
docker compose up --build
```

Servicios:

- `web`: Django en `http://localhost:8000`
- `db`: PostgreSQL 17
- `redis`: broker/cache local
- `celery_worker`: tareas en segundo plano
- `celery_beat`: scheduler

Comandos dentro del backend:

```powershell
docker compose exec web python manage.py createsuperuser
docker compose exec web python manage.py scrape_press
docker compose exec web python manage.py process_articles
docker compose exec web python manage.py recalculate_rankings
docker compose exec web python manage.py test
```

Ollama corre fuera de Docker en Windows. Por eso `.env.docker.example` usa:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
```

## Instalación local sin Docker

```powershell
py -3.14 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r requirements.txt
pnpm install
pnpm build:css
Copy-Item .env.example .env
```

Edita `.env`:

```env
SECRET_KEY=pon-una-clave-local
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://usuario:password@localhost:5432/lliga_sobresalt
REDIS_URL=redis://localhost:6379/0
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen3:4b
CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
SECURE_SSL_REDIRECT=False
CSRF_COOKIE_SECURE=False
SESSION_COOKIE_SECURE=False
SECURE_HSTS_SECONDS=0
```

Si no defines `DATABASE_URL`, Django cae a SQLite para desarrollo rápido y tests.

## Base de datos

Con PostgreSQL local:

```sql
CREATE DATABASE lliga_sobresalt;
```

Después:

```powershell
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py createsuperuser
.venv\Scripts\python manage.py runserver
```

## Ollama

```powershell
ollama pull qwen3:4b
ollama serve
```

La app llama a:

```text
http://localhost:11434/v1/chat/completions
```

No se usa OpenAI API, OpenRouter ni servicios de pago.

## Flujo MVP

1. Crea `Outlet` en admin con `rss_url` o `section_url`.
2. Crea `LeagueSeason` y `LeagueRound` abierta.
3. Ejecuta:

```powershell
.venv\Scripts\python manage.py scrape_press
.venv\Scripts\python manage.py process_articles
.venv\Scripts\python manage.py recalculate_rankings
```

4. Revisa `Incident` y `SatiricalHeadline` en admin.
5. Aprueba incidentes y titulares.
6. Visita `/`, `/ranking/`, `/ciutats/<slug>/`.

## Celery

```powershell
celery -A config worker -l info
celery -A config beat -l info
```

Tareas disponibles:

- `scrape_press_task`
- `process_articles_task`
- `recalculate_rankings_task`

La cadencia sugerida está comentada en `config/settings.py`: scrape cada hora, process cada hora, ranking cada 6 horas.

## Docker Compose

```powershell
Copy-Item .env.example .env
docker compose up
```

El `docker-compose.yml` levanta `web`, `db`, `redis`, `celery_worker` y `celery_beat`.

## Tests y checks

```powershell
pnpm build:css
.venv\Scripts\python manage.py check
.venv\Scripts\python manage.py makemigrations --check
.venv\Scripts\python manage.py test
```

## Frontend con pnpm

El CSS público se compila localmente con Tailwind y pnpm. No se usa Tailwind CDN.

```powershell
pnpm install
pnpm build:css
pnpm watch:css
```

Entrada: `assets/css/input.css`.
Salida versionable para el MVP: `static/css/app.css`.

## CodeGraph

CodeGraph está instalado como devDependency y este proyecto ya tiene índice local en `.codegraph/`.

```powershell
pnpm codegraph:status
pnpm codegraph:sync
pnpm exec codegraph query Incident --limit 5
```

También quedó configurado para Codex global en `C:\Users\elyam\.codex\config.toml`. Reinicia Codex para que aparezcan las herramientas MCP `codegraph_*`.

Para usarlo en otro proyecto:

```powershell
cd ruta\otro-proyecto
codegraph init -i
```

Nota: en esta máquina CodeGraph funciona con backend WASM porque `better-sqlite3` nativo no cargó con la versión actual de Node. Es correcto, solo más lento.

## Seguridad

- `DEBUG=False` exige `SECRET_KEY` real.
- Cookies de sesión y CSRF son `HttpOnly`; en producción deben ir con `Secure=True`.
- Headers activos: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy`.
- `X_FRAME_OPTIONS=DENY`.
- HSTS se activa por defecto cuando `DEBUG=False`, salvo override por entorno.
- `.env`, `.venv` y `node_modules` quedan fuera de git y del contexto Docker.
- Docker usa imagen propia con dependencias instaladas y usuario no-root.

## Límites editoriales

- El ranking es satírico y se basa únicamente en prensa publicada.
- No es estadística oficial ni mide criminalidad real.
- No se publican artículos completos ni `raw_text` en el frontend.
- No se intenta saltar paywalls.
- El modelo extrae datos y propone titulares; la puntuación final la calcula el código.
