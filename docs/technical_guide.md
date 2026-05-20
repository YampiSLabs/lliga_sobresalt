# 🛠️ Guía Técnica de Desarrollo y Despliegue

Este documento contiene la documentación técnica completa para el desarrollo local, despliegue en producción y mantenimiento del backend y frontend de **La Lliga del Sobresalt**.

---

## 🧭 Tabla de Contenidos
- [Desarrollo Local con Docker](#desarrollo-local-con-docker)
- [Backend Django](#backend-django)
- [Frontend Astro](#frontend-astro)
- [Servicio de Ollama](#ollama)
- [Orquestación con Celery](#celery)
- [CI/CD y Despliegue en VPS](#cicd-y-despliegue-en-vps)
- [Seguridad y Producción](#seguridad-y-producción)
- [Mapeo de CodeGraph](#codegraph)
- [Checklist de Lanzamiento](#checklist-de-lanzamiento)

---

## 🐳 Desarrollo Local con Docker

Para iniciar rápidamente la base de datos PostgreSQL, el broker Redis, Celery y el backend monolítico de Django dentro de un entorno unificado:

```powershell
# 1. Copiar el entorno base de Docker
Copy-Item .env.docker.example .env

# 2. Levantar el cluster en segundo plano
docker compose --env-file .env up -d --build
```

### Arquitectura de Servicios Locales
- **Astro dev**: Se ejecuta nativamente en el host de desarrollo (fuera de Docker) en `http://localhost:4321`.
- **Django backend**: Se ejecuta dentro del contenedor de Docker expuesto en `http://localhost:8000`.
- **Postgres, Redis, Celery worker y Celery beat**: Comparten la red interna bridge `lliga_backend_bridge`.

### Comandos Clave en Docker

```powershell
# Instalar dependencias globales del monorepo
pnpm install

# Iniciar el entorno de desarrollo del frontend Astro
pnpm dev

# Crear un usuario administrador en el contenedor de Django
docker compose --env-file .env exec backend python manage.py createsuperuser

# Ejecutar agentes manualmente dentro del contenedor
docker compose --env-file .env exec backend python manage.py scrape_press
docker compose --env-file .env exec backend python manage.py process_articles
docker compose --env-file .env exec backend python manage.py recalculate_rankings
```

---

## 🐍 Backend Django

Si prefieres correr el backend directamente sobre tu sistema de archivos de Windows (sin usar contenedores Docker) utilizando el entorno virtual nativo:

```powershell
# 1. Crear e inicializar el entorno virtual
py -3.14 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r apps/backend/requirements.txt

# 2. Copiar variables de entorno locales
Copy-Item .env.example .env

# 3. Migrar base de datos y lanzar servidor de desarrollo
cd apps/backend
..\..\.venv\Scripts\python manage.py migrate
..\..\.venv\Scripts\python manage.py createsuperuser
..\..\.venv\Scripts\python manage.py runserver
```

### Endpoints Públicos de la API
El frontend Astro consume datos estructurados desde los siguientes endpoints del backend (ninguno expone `raw_text` por seguridad y licencias):
- `GET /api/ranking/`: Retorna el marcador general agregando puntos y posiciones.
- `GET /api/incidents/`: Listado factual de incidentes validados con sus titulares satíricos.

---

## 🚀 Frontend Astro

Astro genera un sitio web estático optimizado para subirse y servirse directamente a través de GitHub Pages.

```powershell
# Levantar servidor de desarrollo local
pnpm dev

# Compilar estáticamente el sitio web
pnpm build

# Previsualizar el bundle de producción compilado localmente
pnpm preview
```

### Configuración del Entorno Frontend (`apps/web/.env`)
```env
PUBLIC_SITE_URL=https://yampislabs.github.io/lliga_sobresalt
PUBLIC_BASE_PATH=/lliga_sobresalt
PUBLIC_API_BASE_URL=https://sobresalt.yampi.eu
```

---

## 🦙 Ollama (Procesamiento Local de LLMs)

Para correr las tareas de análisis e incidentes de forma 100% gratuita y privada en local, utiliza Ollama:

```powershell
# Descargar el modelo ligero de análisis optimizado
ollama pull qwen3:4b

# Levantar el servicio local de Ollama
ollama serve
```

### Configuración de Proveedores en `.env`
El backend tiene una cadena de fallbacks inteligentes. Si existe `OPENROUTER_API_KEY`, se prioriza. De lo contrario, cae a `OPENCODE` y finalmente a `OLLAMA` en local:

```env
# Configuración del proveedor de Fallback Local
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
OLLAMA_MODEL=qwen3:4b
OLLAMA_TIMEOUT_SECONDS=60

# Configuración de Proveedores en la Nube (Opcionales)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct:free
OPENROUTER_TIMEOUT_SECONDS=60
OPENROUTER_APP_NAME="La Lliga del Sobresalt"

OPENCODE_API_KEY=
OPENCODE_BASE_URL=https://opencode.ai/zen/v1
OPENCODE_MODEL=big-pickle
OPENCODE_TIMEOUT_SECONDS=60
```

---

## ⏱️ Orquestación con Celery

Las tareas periódicas del sistema corren de forma asíncrona mediante Celery workers coordinados con Celery Beat:

```powershell
# Levantar workers y scheduler en segundo plano con Docker
docker compose --env-file .env up -d celery_worker celery_beat
```

### Tareas Registradas
- **`scrape_press_task`**: Despierta periódicamente el Scraper para buscar artículos en fuentes deportivas.
- **`process_articles_task`**: Pasa artículos pendientes por el agente analizador de LLM.
- **`recalculate_rankings_task`**: Regenera y recalcula los marcadores agregados.

---

## 🌐 CI/CD y Despliegue en VPS

El monorepo cuenta con flujos automatizados de despliegue mediante **GitHub Actions**.

### 1. Despliegue del Frontend
El workflow `.github/workflows/deploy-pages.yml` compila el bundle estático en `apps/web/dist` y lo publica automáticamente en GitHub Pages ante cualquier cambio en `apps/web/**`.

### 2. Despliegue del Backend
El workflow `.github/workflows/deploy-backend.yml` se activa cuando ocurre un commit a `main` que modifique el backend o los ficheros de operaciones de Docker. Construye y despliega el backend en el VPS.

#### Secretos requeridos en GitHub para VPS
```env
SOBRESALT_VPS_HOST=46.202.171.172
SOBRESALT_VPS_SSH_USER=deploy
SOBRESALT_VPS_SSH_PORT=22
SOBRESALT_VPS_DEPLOY_KEY=<private_deploy_key>
SOBRESALT_VPS_HOST_KEY=<pinned_known_hosts_line>
```

#### Restricciones de Seguridad en el VPS
> [!WARNING]
> No uses el usuario `root` para despliegues SSH. Crea un usuario `deploy` sin privilegios e introduce una restricción estricta de comando en su archivo `authorized_keys` que solo ejecute el script de despliegue (`/usr/local/bin/deploy-lliga-sobresalt-backend`).
>
> Regla mínima recomendada en `/etc/sudoers.d/deploy`:
> ```
> deploy ALL=(root) NOPASSWD: /usr/bin/docker compose
> ```

---

## 🔒 Seguridad y Producción

- **Protección de Contenidos**: No se expone `raw_text` ni se saltan muros de pago (*paywalls*) al raspar prensa.
- **Variables Críticas**: En producción, configura `DEBUG=False`, `DATABASE_URL` y `REDIS_URL`.
- **Orígenes Permitidos (CORS/CSRF)**:
  - `ALLOWED_HOSTS` debe contener el subdominio del VPS (ej: `sobresalt.yampi.eu`).
  - `CORS_ALLOWED_ORIGINS` debe incluir el subdominio de GitHub Pages donde está el frontend.
  - `CSRF_TRUSTED_ORIGINS` debe incluir la URI HTTPS del backend VPS.
- **Seguridad en Cookies**: Cookies de sesión y CSRF se configuran como `HttpOnly` y `Secure=True`.
- **Cabeceras HTTP Activas**: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, y `X_FRAME_OPTIONS=DENY`.

---

## 🔎 Mapeo de CodeGraph

El repositorio incluye un índice local mapeado en `.codegraph/` para indexación contextual semántica rápida de tus herramientas de IA integradas:

```powershell
# Estado del índice de grafos local
pnpm codegraph:status

# Sincronizar el grafo de dependencias
pnpm codegraph:sync

# Probar queries de consultas sobre entidades
pnpm exec codegraph query Incident --limit 5
```

---

## 🚀 Checklist de Lanzamiento (Producción)

1. **Rotación de Keys**: Asegúrate de que no haya filtraciones de `OPENROUTER_API_KEY` en logs o configuraciones locales de Docker expuestas.
2. **Entorno de VPS**: Verifica que el entorno del VPS esté configurado mediante Dokploy o `.env.production` (no versionado).
3. **Variables de Seguridad**: Asegúrate de que `DEBUG=False`, `ALLOWED_HOSTS=sobresalt.yampi.eu`, `CORS_ALLOWED_ORIGINS=https://yampislabs.github.io` y `CSRF_TRUSTED_ORIGINS=https://sobresalt.yampi.eu` estén configurados.
4. **Smoke Tests**:
   - Backend: `curl https://sobresalt.yampi.eu/api/ranking/`
   - Frontend: Inspecciona la consola del navegador en producción y confirma que no haya referencias cruzadas de llamadas locales (`localhost:8000`).
