# Playwright MCP Check

## Status

Configured. Firefox browser runtime route test passed via Playwright CLI. The current OpenCode MCP tool still needs an OpenCode restart to load the Firefox config.

## Dev command detected

- Root: `pnpm dev`
- Web package: `pnpm --filter @lliga/web dev`
- Astro command: `astro dev --host 0.0.0.0`

## Port

- Expected Astro dev default: `4321` unless already occupied or overridden by Astro.
- No dev server was started for this check.

## Routes tested

- Attempted `https://sobresalt.yampi.eu` through Playwright MCP; current session still tried Chrome and failed before page load.
- Tested `https://sobresalt.yampi.eu` successfully with Playwright Firefox CLI.

## Console errors

- Not checked through MCP because current session still launches Chrome.

## Screenshots/logs

- `/srv/vibecode/harness/logs/playwright/sobresalt-firefox-20260707.png`
- Attempted `/tmp/opencode/sobresalt-firefox.png`, but `/tmp/opencode` was not writable by `yampi`.

## Failures

- Initial Playwright MCP launch looked for Chrome at `/opt/google/chrome/chrome`, which is not installed.
- OpenCode Playwright MCP config was adjusted to `--browser firefox --headless --isolated` to avoid system Chrome/personal profiles.
- Firefox was downloaded to Playwright cache with `npx playwright install firefox` without sudo.
- After dependency installation, Playwright Firefox CLI can launch and capture the public route.
- The current OpenCode MCP process/config still tries Chrome; restart OpenCode to use the updated Firefox/headless/isolated MCP command.

## Next usage recommendation

Restart OpenCode and use Playwright MCP to visit `https://sobresalt.yampi.eu` or local `http://127.0.0.1:4321/`, check console errors, and stop or document any dev server PID/port in `SESSION.md`.
