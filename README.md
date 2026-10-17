# AI QA Copilot

AI QA Copilot is a planned tool for QA engineers. It inspects a web application
with Playwright, ingests existing test cases, retrieves relevant context with a
local retrieval-augmented generation (RAG) pipeline, and uses a local LLM (via
Ollama) to generate new, validated test cases that can be exported to CSV.

## Status

**Scaffold only - implementation has not started.**

This repository currently contains the project skeleton: directories and
configuration files only. No application logic, RAG pipeline, MCP server, or
browser automation has been implemented yet. **No dependencies have been
installed.**

## Planned flow

```
requirement -> retrieval -> LLM generation -> validation -> export
```

Website inspection is a supporting, context-gathering stage: it supplies the
page structure and element context that retrieval and generation depend on.

See [docs/architecture.md](./docs/architecture.md) for details.

## Project layout

```
AI_QA_Copilot/
  src/
    browser/      Browser inspection (Playwright)
    ingestion/    Test-case ingestion
    rag/          Retrieval-augmented generation
    generation/   LLM-based test-case generation
    mcp/          Custom QA MCP server
    validation/   Generated test-case validation
    export/       CSV export
    config/       Shared configuration
  data/
    seed/         Seed data (committed)
    generated/    Generated data (local, ignored)
  tests/
    unit/
    integration/
    fixtures/
  scripts/
  docs/
  exports/        CSV exports (local, ignored)
```

## Prerequisites (target environment)

- Node.js >= 24
- npm
- Ollama running locally, with the chat model available locally (`llama3.2:3b`)
- An embedding model must be verified or selected before RAG implementation
- Playwright browsers available locally

## Configuration

Copy `.env.example` to `.env` and fill in values locally. Do not commit real
environment files.

The template documents:

- `OLLAMA_BASE_URL` - base URL of the local Ollama runtime
- `OLLAMA_CHAT_MODEL` - the local chat model used for generation
- `OLLAMA_EMBED_MODEL` - empty placeholder; an embedding model must be selected
  and verified before RAG implementation
- `DEMO_SITE_URL` - the demo website inspected during context gathering
- `N8N_BASE_URL` - n8n base URL for local workflow orchestration integration

See [docs/architecture.md](./docs/architecture.md) for the full design.

## Scripts

- `npm run build` - compile TypeScript to `dist/`
- `npm run typecheck` - type-check without emitting output
- `npm test` - run the test suite
