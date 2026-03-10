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
  same-origin playground page, and uses deterministic fixture wiring for retrieval and
  answer generation.
- Build `packages/bruno-support-bot-api` before starting the local API launcher.
- The scheduled GitHub workflow for this lives at `.github/workflows/support-bot-sync.yml`.

## Local support-bot API + playground smoke testing

From the repo root:

1. Build the API package:
   - `npm run build --workspace=packages/bruno-support-bot-api`
2. Start the local launcher:
   - `node scripts/support-bot/run-support-bot-api.js --port 8787`
3. Open the local playground:
   - `http://127.0.0.1:8787/`
4. Hit the API locally if you prefer curl:
   - `curl http://127.0.0.1:8787/health`
   - `curl "http://127.0.0.1:8787/sources?query=How%20do%20I%20install%20Bruno%3F"`
   - `curl -X POST http://127.0.0.1:8787/chat -H 'content-type: application/json' -d '{"query":"How do I install Bruno?"}'`

Notes:

- This launcher is optional repo-local developer tooling only.
- `/sources` and `/chat` use deterministic local fixtures so the smoke-test path is real
  and coherent without introducing new local infrastructure.
- The playground shows answer text, citations, fallback reason, and raw response/debug JSON.
- Try a pricing or vague troubleshooting query if you want to inspect fallback behavior.