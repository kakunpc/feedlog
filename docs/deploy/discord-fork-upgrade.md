# Updating the Discord OAuth fork

This integration is based on `linkcraftstudio/feedlog` main commit
`33a081a8273125f7305c19330e44fe1cceadd114` (2026-10-20), after the
v0.6.0 release. The PR targets `discord_oauth` and keeps its custom features.
All three Docker stages pin Node 22.23.4 and the official multi-platform
base digest for the 2026-10-21 security release.

## Compatibility

- Keep `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`; the callback remains
  `<BETTER_AUTH_URL>/api/auth/callback/discord`. With only Discord configured,
  email login remains disabled unless explicitly enabled. As with upstream's
  Google/GitHub providers, subsequent sign-ins preserve in-app profile edits.
- Japanese remains the portal default. Existing Japanese translations remain;
  new upstream strings currently use English fallback text in the Japanese
  catalog. Full translation of new upstream features is separate work.
- Reusable invitation URLs, assignees, status/assignee comment history, cancelled
  status, email hiding, email-free feedback/comment notifications, and PNG/JPEG
  plus MP4 attachments are retained. Upstream's status picker replaces the old
  closed-items checkbox; cancelled remains available alongside upstream statuses.
- Upstream replaces the old widget message API with Agent conversations. Old
  widget clients receive its `410 upgrade_required` response and must reload.
  Historical MP4 HTML remains playable; the new editor uses its source-preserving
  mode for that HTML instead of discarding it.
- Upstream adds Help, Inbox, MCP and their migrations/dependencies. No additional
  unrelated package upgrade was requested or performed.
- Upstream application scheduling configuration is included. Docker uses local
  Node timers, restores pending deliveries from PostgreSQL on startup, and runs
  recovery checks every five minutes. Cloudflare Workers and Vercel have their
  own cron/queue settings; these are unused by the Docker deployment and no
  external infrastructure is provisioned by this PR.
- `.github/workflows` remains identical to the fork's base. Upstream's editor
  and widget-framing CI steps were excluded; these tests run locally instead.

## Existing data and deployment

Do not replace this fork with the official upstream image: it lacks the fork's
custom code. Build the reviewed commit for the deployment host's architecture.
No image is published by this change.

Before deployment, retain the existing Compose/project identity, environment,
secrets, host port mapping, reverse proxy configuration, PostgreSQL volume,
and `/app/.data` uploads volume (or the existing S3 bucket configuration).
Back up PostgreSQL and uploads and record the currently deployed image digest.
Do not rotate `BETTER_AUTH_SECRET` or recreate volumes as part of this update.

The migration journal retains the fork's existing first eleven entries and
appends upstream migrations. The two upstream migrations whose timestamps
predate the fork's last migration receive later timestamps so Drizzle actually
executes them. Original SQL remains unchanged. The latest generated schema snapshot also
includes the existing fork tables/columns, preventing future generation from
trying to recreate them. This journal is for upgrading
this fork, not an unrelated database already migrated with upstream's journal.

Test the reviewed build against a restored copy first. After approval, recreate
only the application service using the existing configuration (for example,
`docker compose up -d --no-deps app` in the existing project after updating its
image reference). Startup runs migrations automatically. Do not use
`docker compose down -v`. Check `/health`, sign-in, existing posts, invitations,
assignees, and image/video uploads. A rollback after migrations may require the
pre-update database backup as well as the previous application image.

Local verification uses OrbStack, disposable PostgreSQL/pgvector data, fake OAuth
credentials, and no production access. Generating the Discord authorization URL
and handling a cancelled callback do not prove real Discord login/token exchange;
verify that flow separately with a test account after deployment approval.

## Verification performed

- OrbStack `linux/arm64` production Docker build; embedded runtime Node 22.23.4.
- 63 offline editor, framing, widget, locale, MCP-output and media tests pass;
  all three locale catalogs have matching keys.
- Disposable PostgreSQL 17/pgvector: fork baseline → integrated migrations,
  preserved sample data/account/invitation, and repeat migration all pass.
- Real local app: health, Discord-only provider configuration, authorization URL
  generation and cancelled callback, assignment/status audit comments, author-email
  privacy, and MP4 upload/download pass with fake credentials.
- Drizzle generation reports no schema changes after snapshot reconciliation.
- Full `vue-tsc --build --noEmit` is not clean. Untouched upstream reproduces
  existing strict type diagnostics (including store optional values, auth,
  schema/custom types, password hashing and Nuxt route rules). Merge-specific
  missing avatar helpers and post/assignee response mismatches were corrected;
  unrelated upstream typing cleanup is outside this integration.

Tests do not establish real Discord token exchange, external S3/email/AI/MCP
integration, complete UI behavior, or production compatibility. The built
application was executed on arm64; the deployment architecture remains unconfirmed.
