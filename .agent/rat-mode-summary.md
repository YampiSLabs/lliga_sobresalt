# Rat Mode Summary

## Context used

Focused inspection only. Full source files were not read broadly.

## Files inspected

- `README.md` header/overview earlier in session.
- `package.json`
- `pnpm-workspace.yaml`
- `apps/web/package.json`
- `apps/backend/requirements.txt`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- Generated `.agent/repo-map.md`

## Cheapest way to continue

1. Use `.agent/repo-map.md` and `.agent/file-tree.txt` as the first repo map.
2. Use `rg` for symbols/routes/components before reading source files.
3. Read only the target file plus immediate dependencies.
4. Run the narrowest command first, then one broader check.
5. Update `SESSION.md` and `.agent/current-state.md` after each meaningful step.

## Avoid

- Reading entire `apps/web/src` or `apps/backend` without a concrete task.
- Starting Docker Compose without approval.
- Installing dependencies unless the next task requires checks or browser QA.
