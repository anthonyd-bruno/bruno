# Support bot scripts

Repo-local operational scripts for scheduled support-bot workflows.

- `run-support-bot-sync.js` reads the built `@usebruno/support-indexer` package,
  executes the scheduler-friendly sync runner, writes machine-readable JSON output,
  and updates a persisted sync-state file for stale-index detection.
- `run-support-bot-sync.js` stays strict by default, but local smoke runs can pass
  `--skip-github` to exclude GitHub ingest from both the sync report and local index build.
- `run-support-bot-feedback-report.js` reads repo-local support-bot telemetry/eval JSON,
  normalizes negative signals, and writes a triage-ready JSON + Markdown backlog artifact.
- Set `GITHUB_TOKEN` when running the strict/default sync path or when you want local
  startup to include GitHub content; otherwise the repo-local startup wrapper now skips
  GitHub ingest by default for smoke testing.
- Build `packages/bruno-support-indexer` before invoking the sync script directly.
- Build `packages/bruno-support-evals` before invoking the feedback script directly.
- `run-support-bot-api.js` starts a thin local-only support-bot API launcher for manual
  smoke testing. It wraps the built `@usebruno/support-bot-api` server seam, serves a tiny
  same-origin prototype chat shell, and runs on the existing local retrieval/generation path.
- `start-local-support-bot.js` is the one-command local wrapper that builds the required
  support-bot packages, refreshes `artifacts/support-bot-local-index.json`, and then starts
  the local launcher.
- `start-local-support-bot.js` now skips GitHub ingest by default during that local sync
  refresh so missing/invalid/rate-limited GitHub auth does not block local startup.
- Pass `--include-github` to `start-local-support-bot.js` (or
  `npm run support-bot:local -- --include-github`) if you want the local wrapper to include
  GitHub content and you have a working `GITHUB_TOKEN`.
- Local support-bot scripts try repo-root `.env` first and fall back to repo-root
  `.env.example` for non-secret defaults when `.env` is absent.
- Precedence for local support-bot config remains: CLI flags override existing process env
  where supported, existing process env overrides loaded file values, and repo-root `.env`
  overrides repo-root `.env.example`.
- Local Ollama index builds now use smaller chunks (`maxChunkSize: 800`, which keeps
  later chunks around ~1000 chars once the default overlap is applied) plus smaller
  embedding batches (`8` chunks/request). If Ollama returns a context-length-related 400
  for a multi-input embeddings request, the provider still retries by splitting that batch
  down to smaller groups. If a single chunk still exceeds the model context limit, the
  local index build still fails and you must reduce chunk size/content.
- The website daily sync targets intentionally omit retired `/about` and use
  `/privacy-policy` instead of `/privacy` because the old URLs now 404 upstream.
- The docs crawl excludes retired `/git-integration/provider` and
  `/git-integration/consumer`; the live replacements are
  `/git-integration/using-gui/provider` and
  `/git-integration/using-gui/consumer`.
- The docs crawler normalizes retired `/bruno-basics/*` links to
  `/get-started/bruno-basics/*` so stale links like
  `/bruno-basics/run-a-collection`, `/bruno-basics/create-a-request`, and
  `/bruno-basics/create-a-workspace` resolve to the live docs pages.
- The docs crawler also normalizes retired `/import-export-data/*` links to
  `/get-started/import-export-data/*` so stale links like
  `/import-export-data/import-export-environments` and
  `/import-export-data/postman-migration` resolve to the live docs pages.
- The docs crawler also normalizes retired `/license-management/*` links by
  mapping `/license-management/overview` to `/license-overview` and otherwise
  removing that stale prefix, so paths like
  `/license-management/license-administrators/saml-sso/overview` and
  `/license-management/license-administrators/license-portal` resolve to the
  live license docs pages.
- The docs crawler also treats dot-relative links on slashless section-alias
  pages as children of that section so secret-manager pages like
  `./adding-a-secret-provider` resolve to the live provider-specific docs path
  instead of a stale parent-level URL.
- Build `packages/bruno-support-bot-api`, `packages/bruno-support-indexer`, and
  `packages/bruno-support-retrieval` before starting the local API launcher.
- The scheduled GitHub workflow for this lives at `.github/workflows/support-bot-sync.yml`.

## Local support-bot API + prototype shell smoke testing

From the repo root:

1. Fast path:
   - `npm run support-bot:local`
   - This local wrapper skips GitHub ingest by default so local smoke tests can proceed
     without a working `GITHUB_TOKEN`.
   - If you do want GitHub content locally, run: `npm run support-bot:local -- --include-github`
2. Equivalent manual flow if you want to run each step separately:
   - Build the required packages:
     - `npm run build --workspace=packages/bruno-support-indexer`
     - `npm run build --workspace=packages/bruno-support-retrieval`
     - `npm run build --workspace=packages/bruno-support-bot-api`
   - Refresh the local support-bot index for the usual local smoke-test path:
     - `node scripts/support-bot/run-support-bot-sync.js --skip-github --index-output artifacts/support-bot-local-index.json`
   - Or run the strict/default sync path instead if you want GitHub content too:
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
- If repo-root `.env` is absent, the launcher/sync scripts automatically use the checked-in
  `.env.example` Ollama defaults until you add your own repo-root `.env` or shell overrides.
- `npm run support-bot:local` is intentionally local-only behavior: it skips GitHub ingest by
  default, while direct/default `run-support-bot-sync.js` runs remain strict unless you
  explicitly pass `--skip-github`.
- The shell is intentionally a local prototype surface for exercising `/health`, `/sources`, and `/chat` on the existing local path.
- The prototype shell keeps a chat-shaped transcript plus dedicated health/sources/response inspectors with citations, fallback reason, and raw response/debug JSON.
- Try a pricing or vague troubleshooting query if you want to inspect fallback behavior.