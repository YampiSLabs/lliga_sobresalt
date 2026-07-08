# Ponytrail Initial Plan

## 1. Goal

Map the current project state, detect commands, identify risks, and propose the next 5 small maintenance tasks.

## 2. Assumptions

- Work happens from the VPS checkout at `/home/yampi/.opencode-work/lligasobresalt-pr`.
- No push, deploy, Docker Compose startup, or database migration should run without explicit approval.
- The production deployment path `/opt/lliga_sobresalt` is separate and should not be edited during normal development tasks.

## 3. Relevant files/modules

- `package.json`: root scripts and package manager.
- `apps/web/package.json`: Astro build/test/dev scripts.
- `apps/backend/requirements.txt`: Django backend dependencies.
- `docker-compose.yml`: local services, but includes migration on backend startup.
- `docker-compose.prod.yml`: production service shape and Traefik routing.
- `.agent/commands.md`: safe command map.
- `.agent/services.md`: service map and safety notes.

## 4. Step-by-step route

1. Keep repo memory current: update `.agent/*` and `SESSION.md` after meaningful work.
2. Normalize Linux-safe backend commands because root backend scripts use Windows `.venv` paths.
3. Decide whether local `pnpm install --frozen-lockfile` is allowed for this checkout.
4. Run frontend checks after dependencies exist: `pnpm --filter @lliga/web build` and targeted tests.
5. Review Docker Compose safety and split dev commands that do not auto-run migrations.

## 5. Verification commands

- `git status --short --branch`
- `/srv/vibecode/harness/scripts/build-codegraph.sh .`
- `pnpm --filter @lliga/web build` after local dependencies are installed.
- `pnpm --filter @lliga/web test` after local dependencies are installed.
- Backend verification pending Linux-safe Python environment or approved Docker workflow.

## 6. Risks

- Docker daemon is not accessible to `yampi` without elevated permissions.
- Docker Compose backend startup runs migrations.
- Secrets exist as environment variable names in examples; never print values from real `.env` files.
- Production path is separate from this checkout and must remain untouched without approval.

## 7. Recommended executor

- `safe-vps-dev` for ordinary edits.
- `caverman` for failing checks/builds.
- `codegraph-navigator` before broad architecture changes.
- `db-migration-guard` for schema or persistence changes.
- `browser-qa` for UI verification after dependencies are installed.

## Next 5 small tasks

1. Add Linux-safe backend check/test documentation once Python venv policy is decided.
2. Run local dependency install in the checkout if approved or requested.
3. Run frontend build and test after dependencies are present.
4. Add a non-migrating local backend check path for safe inspection.
5. Decide whether to clone/move the repo into `/srv/vibecode/repos` for the preferred workspace.
