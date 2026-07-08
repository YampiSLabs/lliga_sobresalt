# Browser QA Check

## Route/server command detected

- Dev server: `pnpm dev` -> `pnpm --filter @lliga/web dev` -> `astro dev --host 0.0.0.0`.
- Preview server: `pnpm preview` -> `pnpm --filter @lliga/web preview` -> `astro preview --host 0.0.0.0`.

## Verification attempted

No persistent browser server was started.

## Reason

Local dependencies are now installed and the static frontend build passes with `PUBLIC_API_BASE_URL=http://localhost:8000`.

Browser server startup was still skipped to avoid leaving a long-running process behind without a concrete UI task.

## Safe next browser QA steps

1. Start the dev server in a documented tmux pane or with logs redirected: `PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev`.
2. Record PID/port in `SESSION.md`.
3. Open the relevant route and check console/runtime errors.
4. Stop the server and document the result.

## Pass/fail

Not executed. Dependencies are ready; browser QA should be run when there is a concrete UI route/flow to verify.
