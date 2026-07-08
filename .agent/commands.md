# Commands

## Package manager

- Root package manager: `pnpm@10.30.3`.
- Workspace file: `pnpm-workspace.yaml`, packages under `apps/*`.

## Root scripts

- `pnpm dev`: runs `pnpm --filter @lliga/web dev`.
- `pnpm build`: runs `pnpm --filter @lliga/web build`.
- `pnpm preview`: runs `pnpm --filter @lliga/web preview`.
- `pnpm sync:shields`: runs `node scripts/sync-shields.mjs`.
- `pnpm codegraph:init`: runs `codegraph init -i`.
- `pnpm codegraph:sync`: runs `codegraph sync`.
- `pnpm codegraph:status`: runs `codegraph status`.

## Web scripts

From `apps/web/package.json`:

- `pnpm --filter @lliga/web dev`: Astro dev server on `0.0.0.0`.
- `pnpm --filter @lliga/web build`: `astro check && astro build`.
- `pnpm --filter @lliga/web preview`: Astro preview on `0.0.0.0`.
- `pnpm --filter @lliga/web test`: Vitest.
- `pnpm --filter @lliga/web format`: Prettier write mode.

## Backend scripts

- Root `backend:check` and `backend:test` scripts currently use Windows-style `.venv\\Scripts\\python` paths and are not directly suitable for Linux VPS execution.
- Linux-safe backend checks should be documented after creating a local Python venv or using an approved Docker workflow.

## Safety

- Do not run `docker compose up` without approval: the backend command applies migrations.
- Do not run production deploy scripts without approval.
- Do not run commands that require real secrets unless the user explicitly approves and secrets are already configured safely.
