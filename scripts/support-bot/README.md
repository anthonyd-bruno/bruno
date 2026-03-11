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
  same-origin prototype chat shell, loads a persisted local retrieval index, and uses live
  OpenAI-backed answer generation.
- Build `packages/bruno-support-bot-api`, `packages/bruno-support-indexer`, and
  `packages/bruno-support-retrieval` before starting the local API launcher.
- `run-support-bot-sync.js --index-output <path>` can also build the persisted local
  retrieval index artifact used by the launcher/playground.
- The scheduled GitHub workflow for this lives at `.github/workflows/support-bot-sync.yml`.

## Local support-bot API + prototype shell smoke testing

From the repo root:

1. Build the required packages:
   - `npm run build --workspace=packages/bruno-support-indexer`
   - `npm run build --workspace=packages/bruno-support-retrieval`
   - `npm run build --workspace=packages/bruno-support-bot-api`
2. Export `OPENAI_API_KEY`.
   - Required for both local index embeddings and live answer generation.
3. Optional but recommended: export `GITHUB_TOKEN` if you want GitHub discussions included.
   - Releases/issues still ingest without it.
4. Build or refresh the local retrieval index artifact:
   - `node scripts/support-bot/run-support-bot-sync.js --index-output artifacts/support-bot-local-index.json`
5. Start the local launcher:
   - `node scripts/support-bot/run-support-bot-api.js --index-file artifacts/support-bot-local-index.json --port 8787`
6. Open the local prototype shell:
   - `http://127.0.0.1:8787/`
7. Hit the API locally if you prefer curl:
   - `curl http://127.0.0.1:8787/health`
   - `curl "http://127.0.0.1:8787/sources?query=How%20do%20I%20install%20Bruno%3F"`
   - `curl -X POST http://127.0.0.1:8787/chat -H 'content-type: application/json' -d '{"query":"How do I install Bruno?"}'`

Notes:

- This launcher is optional repo-local developer tooling only.
- "Real local" means `/sources` and `/chat` run through the real routing + hybrid
  retrieval stack over a locally persisted index artifact, while `/chat` also uses a live
  OpenAI call for grounded answer generation.
- The launcher does not crawl or embed sources at startup; regenerate the local index file
  with `run-support-bot-sync.js --index-output ...` whenever you want fresher retrieval.
- Optional environment variables:
  - `SUPPORT_BOT_OPENAI_MODEL` to override the answer-generation model
  - `SUPPORT_BOT_OPENAI_EMBEDDING_MODEL` to override the embedding model used when building the local index
  - `SUPPORT_BOT_OPENAI_EMBEDDING_DIMENSIONS` to override embedding dimensions during local index build
- The prototype shell keeps a chat-shaped transcript plus dedicated health/sources/response inspectors with citations, fallback reason, and raw response/debug JSON.
- Try a pricing or vague troubleshooting query if you want to inspect fallback behavior.