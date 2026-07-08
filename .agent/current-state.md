# Current State

## Repository

- Path: `/home/yampi/.opencode-work/lligasobresalt-pr`.
- Branch: `master`.
- Remote: `https://github.com/YampiSLabs/lliga_sobresalt.git`.
- Status at setup start: clean except newly generated harness memory files.

## Harness state

- Global harness path: `/srv/vibecode`.
- Global skills path: `/srv/vibecode/harness/skills`.
- CodeGraph script: `/srv/vibecode/harness/scripts/build-codegraph.sh`.

## Checks

- Basic CodeGraph generation succeeded.
- `pnpm install --frozen-lockfile` succeeded and installed local dependencies.
- `pnpm --filter @lliga/web build` without environment failed because `PUBLIC_API_BASE_URL` is required for production builds.
- `PUBLIC_API_BASE_URL=http://localhost:8000 pnpm --filter @lliga/web build` passed and built 2860 pages; it logged fallback warnings for `/api/seasons/` because no local backend is running.
- `pnpm --filter @lliga/web test -- --run` passed: 2 files, 8 tests.
- Docker daemon is not accessible to user `yampi` without elevated permissions.

## Current risks

- Docker Compose startup runs migrations; approval required.
- Backend root scripts use Windows `.venv` paths and need Linux-safe equivalents before use on VPS.
- Existing production deployment is separate from this checkout; do not edit `/opt/lliga_sobresalt` without approval.

## How to resume

1. `cd /home/yampi/.opencode-work/lligasobresalt-pr`.
2. Read `AGENTS.md`, `SESSION.md`, `.agent/commands.md`, and `.agent/current-state.md`.
3. Run `git status --short --branch`.
4. Continue from documented checks or ask before Docker/deploy/push actions.
5. For frontend verification, use `PUBLIC_API_BASE_URL=http://localhost:8000 pnpm --filter @lliga/web build` or set an intentional public API URL.
