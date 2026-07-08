# Services

## Application services

- Frontend: Astro + Preact app in `apps/web`.
- Backend: Django app in `apps/backend`.
- Queue workers: Celery workers and Celery beat.
- Database: PostgreSQL, configured in Docker Compose for development and production.
- Cache/queue broker: Redis.
- LLM integrations: OpenRouter, OpenCode-compatible API, Ollama-compatible endpoint.

## Docker Compose

- Development compose file: `docker-compose.yml`.
- Production compose file: `docker-compose.prod.yml`.
- Development services include `backend`, `db`, `redis`, `celery_worker`, `celery_worker_llm`, and `celery_beat`.
- Production compose uses Traefik labels for `sobresalt.yampi.eu`.

## Safety notes

- Do not run Docker Compose without approval because backend startup includes `python manage.py migrate`.
- Do not print values from `.env` files.
- Docker CLI exists on the VPS, but the current `yampi` user cannot access the Docker daemon without elevated permissions.

## VPS ports observed

- `22/tcp`: SSH.
- `80/tcp` and `443/tcp`: web ingress.
- `3000/tcp`: active listener on VPS.
- `2377/tcp`, `7946/tcp/udp`, `4789/udp`: Docker Swarm-related listeners.
- `53/tcp/udp`: local resolver.
