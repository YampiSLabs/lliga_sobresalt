# Context7 Check

## Status

Passed via Context7 MCP and `ctx7` CLI.

## Stack detected

- Frontend: Astro 6, Preact 10, Tailwind CSS 4, Vitest.
- Backend: Django, Django REST Framework, Celery, PostgreSQL, Redis.
- Package manager: pnpm workspace.

## Docs queried

- `npx ctx7 library astro "Astro pages routing"`
- `npx ctx7 docs /withastro/docs "Astro pages routing static build"`
- `npx ctx7 library "tailwind css" "configuration content paths"`
- `npx ctx7 docs /tailwindlabs/tailwindcss.com "configuration content paths"`
- Context7 MCP `resolve-library-id` for `Astro`
- Context7 MCP `query-docs` for `/withastro/docs` and `getStaticPaths()`

## Useful notes

- Astro dynamic/static routes should use `getStaticPaths()` for parameterized routes generated at build time.
- Astro static output can be configured with `output: 'static'` when appropriate.
- Tailwind CSS 4 supports automatic content detection and CSS `@source` directives for explicit source inclusion/exclusion.

## Failures

- None for CLI docs lookup.
- None for docs lookup.

## Next usage recommendation

Use the `context7` MCP before changing Astro routing, Tailwind configuration, Preact components, Django APIs, or other external-library code.
