# CodeGraph Navigator Test

## Command used

```bash
/srv/vibecode/harness/scripts/build-codegraph.sh /home/yampi/.opencode-work/lligasobresalt-pr
```

## Result

Pass. Basic CodeGraph artifacts were generated under `.agent/` without installing dependencies.

## Entry points

- Root monorepo: `package.json`.
- Frontend app: `apps/web/package.json`, `apps/web/astro.config.mjs`, `apps/web/src`.
- Backend app: `apps/backend/manage.py`, `apps/backend/config/settings.py`.
- Docker services: `docker-compose.yml`, `docker-compose.prod.yml`.

## Relevant modules

- Frontend: `apps/web/src`.
- Backend core/API: `apps/backend/core`.
- League domain: `apps/backend/league`.
- Press ingestion/extraction: `apps/backend/press`.
- Satire generation: `apps/backend/satire`.

## Files to read next

- `.agent/commands.md`
- `.agent/services.md`
- `apps/web/src` targeted files using `rg`.
- `apps/backend/config/settings.py` only when backend configuration is relevant.

## Files likely to edit for harness work

- `SESSION.md`
- `.agent/current-state.md`
- `.agent/commands.md`

## Risky areas

- Docker Compose commands that run migrations.
- Backend settings and environment handling.
- LLM provider configuration and secret-bearing variables.
