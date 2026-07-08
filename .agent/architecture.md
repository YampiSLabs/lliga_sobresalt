# Architecture

## Overview

La Lliga del Sobresalt is a monorepo for a satirical civic/news gamification site.

## Frontend

- Location: `apps/web`.
- Framework: Astro.
- UI runtime: Preact.
- State/utilities: Nanostores, ky, Zod, Fuse.js, Day.js, UI/animation libraries.
- Build command: `pnpm --filter @lliga/web build`.

## Backend

- Location: `apps/backend`.
- Framework: Django 5.2+.
- API/admin apps include `core`, `league`, `press`, and `satire`.
- Background processing: Celery.
- Persistence: PostgreSQL.
- Broker/cache: Redis.
- Media/static handling: WhiteNoise/Pillow/media volume in Docker.

## Data and AI flow

- Press scraping and extraction live under `apps/backend/press`.
- Satirical headline generation lives under `apps/backend/satire`.
- LLM providers are configured through environment variable names for OpenRouter, OpenCode-compatible API, and Ollama-compatible endpoints.

## Deployment shape

- Development Docker Compose includes backend, PostgreSQL, Redis, Celery workers, and Celery beat.
- Production Compose uses Traefik labels for `sobresalt.yampi.eu`.
- Production deployment path previously observed on this VPS: `/opt/lliga_sobresalt`.

## Agent notes

- Prefer `.agent/repo-map.md` and `rg` before opening many files.
- Treat Docker and migration commands as approval-required.
- Keep repo memory files current after meaningful work.
