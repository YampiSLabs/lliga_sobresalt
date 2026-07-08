# AGENTS.md

## Project-specific agent rules

This repository is managed from a remote VPS vibecoding harness.

Always:
- Read SESSION.md before work.
- Use `/srv/vibecode/AGENTS.md` global rules.
- Use safe-vps-dev for all edits.
- Use ponytrail before large changes.
- Use codegraph-navigator before reading many files.
- Use caverman for failing tests/builds/bugs.
- Use rat-mode to minimize context.
- Update SESSION.md after meaningful progress.

## Before editing

1. Check git status.
2. Read `.agent/repo-map.md`.
3. Read `.agent/commands.md`.
4. Identify the smallest safe change.

## Verification

Use the commands documented in `.agent/commands.md`.
If commands are unknown, inspect package files and document them first.

## Never without approval

- git push
- production deploy
- destructive database migration
- deleting user data
- editing secrets
- publishing packages
