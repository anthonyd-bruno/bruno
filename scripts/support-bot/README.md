# Support bot scripts

Repo-local operational scripts for scheduled support-bot workflows.

- `run-support-bot-sync.js` reads the built `@usebruno/support-indexer` package,
  executes the scheduler-friendly sync runner, writes machine-readable JSON output,
  and updates a persisted sync-state file for stale-index detection.
- `run-support-bot-feedback-report.js` reads repo-local support-bot telemetry/eval JSON,
  normalizes negative signals, and writes a triage-ready JSON + Markdown backlog artifact.
- Set `GITHUB_TOKEN` when running the script or workflow so the GitHub ingester can
  include repository discussions in addition to releases and issues.
- Build `packages/bruno-support-indexer` before invoking the sync script directly.
- Build `packages/bruno-support-evals` before invoking the feedback script directly.
- `run-support-bot-api.js` starts a thin local-only support-bot API launcher for manual
  smoke testing. It wraps the built `@usebruno/support-bot-api` server seam, serves a tiny
  same-origin prototype chat shell, and runs on the existing local retrieval/generation path.
- `start-local-support-bot.js` is the one-command local wrapper that builds the required
  support-bot packages, refreshes `artifacts/support-bot-local-index.json`, and then starts
  the local launcher.
- Build `packages/bruno-support-bot-api`, `packages/bruno-support-indexer`, and
  `packages/bruno-support-retrieval` before starting the local API launcher.
- The scheduled GitHub workflow for this lives at `.github/workflows/support-bot-sync.yml`.

## Local support-bot API + prototype shell smoke testing

From the repo root:

1. Fast path:
   - `npm run support-bot:local`
2. Equivalent manual flow if you want to run each step separately:
   - Build the required packages:
     - `npm run build --workspace=packages/bruno-support-indexer`
     - `npm run build --workspace=packages/bruno-support-retrieval`
     - `npm run build --workspace=packages/bruno-support-bot-api`
   - Refresh the local support-bot index:
     - `node scripts/support-bot/run-support-bot-sync.js --index-output artifacts/support-bot-local-index.json`
   - Start the local launcher:
     - `node scripts/support-bot/run-support-bot-api.js --index-file artifacts/support-bot-local-index.json --port 8787`
3. Open the local prototype shell:
   - `http://127.0.0.1:8787/`
4. Use the shell or hit the API locally if you prefer curl:
   - `curl http://127.0.0.1:8787/health`
   - `curl "http://127.0.0.1:8787/sources?query=How%20do%20I%20install%20Bruno%3F"`
   - `curl -X POST http://127.0.0.1:8787/chat -H 'content-type: application/json' -d '{"query":"How do I install Bruno?"}'`

Notes:

- This launcher is optional repo-local developer tooling only.
- The shell is intentionally a local prototype surface for exercising `/health`, `/sources`, and `/chat` on the existing local path.
- The prototype shell keeps a chat-shaped transcript plus dedicated health/sources/response inspectors with citations, fallback reason, and raw response/debug JSON.
- Try a pricing or vague troubleshooting query if you want to inspect fallback behavior.