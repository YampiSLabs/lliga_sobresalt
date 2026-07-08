# Caverman Check

## Symptom

Command executed:

```bash
pnpm --filter @lliga/web build
```

Initial result: failed because dependencies were missing.

## Evidence

```text
sh: 1: astro: not found
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @lliga/web@ build: `astro check && astro build`
Local package.json exists, but node_modules missing, did you mean to install?
```

## Root cause

Initial root cause: local dependencies were not installed in this checkout. `node_modules` was missing, so the `astro` binary was unavailable.

After `pnpm install --frozen-lockfile`, the build command reached Astro and then required `PUBLIC_API_BASE_URL` for production builds.

## Files changed

No product files changed to fix this. The result is documented for future agents.

## Verification command

Commands run after installing local dependencies:

```bash
PUBLIC_API_BASE_URL=http://localhost:8000 pnpm --filter @lliga/web build
pnpm --filter @lliga/web test -- --run
```

Result: build passed and tests passed.

## Remaining risk

The successful build logged fallback warnings for `/api/seasons/` because no local backend was running. This is acceptable for static build verification but not a full integration check.
