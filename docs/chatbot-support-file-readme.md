`# Bruno Support Chatbot Implementation Backlog

## Objective

Build a grounded chatbot that answers Bruno questions using:

- this repository `usebruno`)
- `https://docs.usebruno.com`
- `https://www.usebruno.com`
- additional official/community sources (GitHub releases/issues/discussions, Stack Overflow)

All answers must include citations and confidence-aware fallback behavior.

## Proposed Monorepo Additions

- `packages/bruno-support-bot-api/`
- `packages/bruno-support-indexer/`
- `packages/bruno-support-retrieval/`
- `packages/bruno-support-evals/`
- `scripts/support-bot/`
- `docs/chatbot-support-bot-backlog.md`

## Milestones

- M1 (Week 1): scaffolding, schema, local repo ingestion
- M2 (Week 2): website/docs/community ingestion + indexing
- M3 (Week 3): retrieval, answer generation, API
- M4 (Week 4): evals, hardening, launch readiness

## Epic 1: Foundation and Scaffolding

### BOT-001 Create workspace packages

Priority: P0

Estimate: 1 day

Dependencies: none

Tasks:

1. Add new workspaces in root `package.json`.
2. Create package skeletons for `api`, `indexer`, `retrieval`, and `evals`.
3. Add shared lint/test/build scripts.

Acceptance criteria:

1. `npm run lint` and tests pass with new packages included.
2. Each package has a runnable `dev` or `test` entrypoint.

### BOT-002 Define shared data contracts

Priority: P0

Estimate: 1 day

Dependencies: BOT-001

Tasks:

1. Create TypeScript interfaces for `SourceDocument`, `Chunk`, `Citation`, `Answer`, `EvalCase`.
2. Add schema validation for ingested docs and generated answers.

Acceptance criteria:

1. Invalid records are rejected with explicit validation errors.
2. All downstream packages import shared contracts.

### BOT-003 Config and secrets handling

Priority: P0

Estimate: 0.5 day

Dependencies: BOT-001

Tasks:

1. Define environment variables for LLM provider, embedding provider, vector store, crawl config.
2. Add startup validation and clear error output.

Acceptance criteria:

1. Missing required env vars fail fast.
2. No secrets are logged.

## Epic 2: Source Ingestion

### BOT-010 Ingest local repo knowledge

Priority: P0

Estimate: 1.5 days

Dependencies: BOT-002

Tasks:

1. Parse markdown files from root docs and package READMEs.
2. Parse selected source/test metadata to capture feature behavior `tests/`, CLI flags, schema files).
3. Attach `source_path`, `git_sha`, and `last_modified` metadata.

Acceptance criteria:

1. Ingestion includes core files like root `readme.md`, `security.md`, CLI docs, and selected test suites.
2. Records include path-based citations.

### BOT-011 Ingest docs site `docs.usebruno.com`)

Priority: P0

Estimate: 1.5 days

Dependencies: BOT-002

Tasks:

1. Implement crawler constrained to docs domain.
2. Extract clean article content, heading anchors, and canonical URLs.
3. Track `last_seen` and content hash for incremental updates.

Acceptance criteria:

1. Crawl stays within docs domain.
2. Duplicate pages are deduplicated by canonical URL/hash.

### BOT-012 Ingest website `usebruno.com`)

Priority: P0

Estimate: 1 day

Dependencies: BOT-002

Tasks:

1. Crawl key pages: downloads, pricing, changelog, roadmap, support.
2. Mark pages with higher freshness requirements (downloads/changelog/pricing).

Acceptance criteria:

1. Freshness metadata exists per document.
2. Website content is queryable with citations.

### BOT-013 Ingest GitHub releases/issues/discussions

Priority: P1

Estimate: 1.5 days

Dependencies: BOT-002

Tasks:

1. Pull releases and release notes from `usebruno/bruno`.
2. Pull issue/discussion excerpts tagged as solved or frequently referenced.
3. Store source URLs and timestamps.

Acceptance criteria:

1. Release-related questions return release citations.
2. Community content is marked lower trust than official docs.

### BOT-014 Ingest Stack Overflow tag content

Priority: P2

Estimate: 1 day

Dependencies: BOT-002

Tasks:

1. Collect accepted answers from `bruno` tag.
2. Filter stale/low-score content.

Acceptance criteria:

1. Each entry stores score, accepted status, and date.
2. Content is only used when higher-tier sources do not fully answer.

## Epic 3: Chunking, Embeddings, and Indexing

### BOT-020 Chunking strategy

Priority: P0

Estimate: 1 day

Dependencies: BOT-010, BOT-011, BOT-012

Tasks:

1. Implement markdown-aware chunking (headings preserved).
2. Add overlap and chunk-size configuration.
3. Include chunk-level metadata for source and heading.

Acceptance criteria:

1. Chunks preserve enough context for standalone retrieval.
2. Heading anchors are returned in citations when available.

### BOT-021 Embedding pipeline

Priority: P0

Estimate: 1 day

Dependencies: BOT-020

Tasks:

1. Generate embeddings per chunk.
2. Skip unchanged chunks using content hash.
3. Add retry logic for transient provider failures.

Acceptance criteria:

1. Re-index runs are incremental.
2. Failed embeddings are retried and logged.

### BOT-022 Hybrid index (vector + keyword)

Priority: P0

Estimate: 1 day

Dependencies: BOT-021

Tasks:

1. Store vectors and build BM25/keyword index.
2. Add source filtering and metadata filtering (trust tier, date).

Acceptance criteria:

1. Queries can run vector-only, keyword-only, and hybrid modes.
2. Hybrid mode outperforms either single mode on eval set.

## Epic 4: Retrieval and Ranking

### BOT-030 Intent classifier and query routing

Priority: P1

Estimate: 1 day

Dependencies: BOT-022

Tasks:

1. Classify intent categories: install, CLI, scripting, auth, pricing, troubleshooting, version/release.
2. Route queries to source subsets by intent.

Acceptance criteria:

1. Misroutes under threshold on validation dataset.
2. Routing rules are configurable.

### BOT-031 Trust and freshness ranking

Priority: P0

Estimate: 1 day

Dependencies: BOT-022

Tasks:

1. Implement ranking weights for trust tier and freshness.
2. Apply page-specific freshness windows (changelog/downloads/pricing stricter).

Acceptance criteria:

1. Recent official content outranks stale or community content.
2. Ranking rationale is logged for top results.

### BOT-032 Citation packer

Priority: P0

Estimate: 0.5 day

Dependencies: BOT-022

Tasks:

1. Bundle top supporting chunks with URLs/paths.
2. Enforce minimum citation count before answer generation.

Acceptance criteria:

1. Every non-trivial answer includes citations.
2. Answers without sufficient evidence return fallback behavior.

## Epic 5: Answer Generation API

### BOT-040 Grounded prompt policy

Priority: P0

Estimate: 1 day

Dependencies: BOT-032

Tasks:

1. Create system prompt for grounded responses, no hallucinated features, explicit uncertainty.
2. Add response template with: short answer, steps/commands, citations, confidence.

Acceptance criteria:

1. Model refuses unsupported claims when evidence is weak.
2. Prompts are versioned and test-covered.

### BOT-041 Chat API endpoints

Priority: P0

Estimate: 1 day

Dependencies: BOT-040

Tasks:

1. Implement `/chat`, `/health`, `/sources` endpoints.
2. Return machine-readable answer schema.

Acceptance criteria:

1. API validates request/response schemas.
2. `/chat` returns citations and confidence score.

### BOT-042 Safety and escalation behavior

Priority: P1

Estimate: 0.5 day

Dependencies: BOT-041

Tasks:

1. Add fallback messages for low confidence.
2. Provide escalation links: support, GitHub issues/discussions, security email when relevant.

Acceptance criteria:

1. Security questions route to official reporting channel.
2. Low-confidence answers are clearly labeled.

## Epic 6: Evaluation and Release Gates

### BOT-050 Build eval dataset

Priority: P0

Estimate: 1.5 days

Dependencies: BOT-041

Tasks:

1. Create 200+ QA cases from docs, README, changelog, common issue themes, CLI usage.
2. Label expected citations and answer rubric.

Acceptance criteria:

1. Dataset covers all key intents.
2. Dataset is versioned in repo.

### BOT-051 Automated eval runner

Priority: P0

Estimate: 1 day

Dependencies: BOT-050

Tasks:

1. Implement command to run eval suite and output metrics.
2. Track groundedness, citation precision, correctness, fallback quality.

Acceptance criteria:

1. Eval output is CI-friendly (JSON + markdown summary).
2. Historical results can be compared.

### BOT-052 Launch quality gates

Priority: P0

Estimate: 0.5 day

Dependencies: BOT-051

Tasks:

1. Define minimum thresholds for release.
2. Fail CI when thresholds are not met.

Acceptance criteria:

1. Launch cannot proceed without passing thresholds.
2. Gate thresholds are documented and configurable.

## Epic 7: Operations and Continuous Improvement

### BOT-060 Scheduled sync jobs

Priority: P0

Estimate: 1 day

Dependencies: BOT-022

Tasks:

1. Schedule sync cadence:

- docs/repo daily
- changelog/downloads/pricing every 1-6 hours
- releases/issues/discussions daily

1. Add stale-index alerts.

Acceptance criteria:

1. Scheduler runs are observable and retry on failure.
2. Stale data conditions raise alerts.

### BOT-061 Observability and analytics

Priority: P1

Estimate: 1 day

Dependencies: BOT-041

Tasks:

1. Add structured logs for retrieval/generation latency and failures.
2. Track unanswered questions and citation misses.

Acceptance criteria:

1. Dashboards show top failed intents and data gaps.
2. PII-safe logging rules are enforced.

### BOT-062 Feedback loop backlog automation

Priority: P2

Estimate: 1 day

Dependencies: BOT-061

Tasks:

1. Collect user feedback signals (thumbs up/down, unresolved).
2. Auto-generate triage items for missing content.

Acceptance criteria:

1. Repeated failures surface as prioritized content tasks.
2. Feedback can be mapped back to source gaps.

## Suggested Sprint Order

### Sprint 1 (M1)

1. BOT-001, BOT-002, BOT-003
2. BOT-010
3. BOT-020

### Sprint 2 (M2)

1. BOT-011, BOT-012, BOT-013
2. BOT-021, BOT-022
3. BOT-031, BOT-032

### Sprint 3 (M3)

1. BOT-030, BOT-040, BOT-041, BOT-042
2. BOT-060

### Sprint 4 (M4)

1. BOT-050, BOT-051, BOT-052
2. BOT-061, BOT-062
3. Launch readiness review

## Definition of Done

1. Answers are grounded in retrieved evidence.
2. Every substantive answer includes citations.
3. Low-confidence cases are explicitly labeled and safely escalated.
4. Eval thresholds pass in CI.
5. Source sync is automated and monitored.

## Initial Risk Register

1. Docs drift between repo and website.

- Mitigation: trust/freshness ranking + scheduled sync + stale alerts.

1. Community content conflict with official docs.

- Mitigation: lower trust tier and explicit provenance labels.

1. Hallucinated feature claims.

- Mitigation: citation-required answer policy and fallback behavior.

1. High operational cost from frequent indexing.

- Mitigation: incremental hashing and tiered refresh cadence.

## Open Decisions

1. Hosting target for chatbot API (self-hosted vs managed platform).
2. Preferred vector store.
3. LLM/embedding provider choice and budget ceilings.
4. Initial user surface (docs widget, website support chat, or internal only).