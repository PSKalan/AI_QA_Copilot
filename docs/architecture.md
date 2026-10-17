# Architecture

> Status: **planned**. This document describes the intended design. Nothing below
> is implemented yet - the repository currently contains only a scaffold.

## Orchestration

**[n8n](https://n8n.io/) is the workflow orchestrator.** n8n drives the end-to-end
pipeline, sequencing each stage, passing artifacts between them, and triggering
exports. The TypeScript code in this repository provides the building blocks the
workflow calls into; n8n owns the control flow.

## Planned pipeline

```
requirement -> retrieval -> LLM generation -> validation -> export
```

1. **Requirement** (`src/ingestion/`)
   A requirement (or seed test case) enters the workflow. Existing test cases in
   `data/seed/` are normalized into a common shape for indexing.

2. **Retrieval** (`src/rag/`)
   Relevant context is retrieved for the requirement by embedding the ingested
   material and performing a similarity search against the local vector index.

3. **LLM generation** (`src/generation/`)
   A local chat model (via Ollama) is prompted with the retrieved context to
   produce candidate test cases.

4. **Validation** (`src/validation/`)
   Generated cases are validated (structure, required fields, and consistency
   against the inspected website) before being accepted.

5. **Export** (`src/export/`)
   Validated test cases are written to CSV under `exports/`.

Website inspection with Playwright (`src/browser/`) supplies the page structure
and element context that retrieval and generation depend on.

## MCP integrations

Playwright MCP and our custom QA MCP are **separate integrations with distinct
roles**:

- **Custom QA MCP** (`src/mcp/`) - our own MCP server. It exposes this project's
  QA-specific capabilities (test-case ingestion, retrieval, generation,
  validation, export) as MCP tools for the orchestrator and other clients.
- **Playwright MCP** - a third-party MCP server that provides generic browser
  automation and inspection. Our workflow consumes it as an integration; this
  project does not replace, wrap, or reconfigure it.

They are independent servers. The custom QA MCP covers QA-domain logic;
Playwright MCP covers browser interaction.

## Pending compatibility verification

The following decisions are **not yet made** and must be validated before
implementation:

- **MCP transport** - whether the custom QA MCP server communicates over stdio
  or HTTP/SSE is pending compatibility verification with the client and the
  playbook used by the orchestrator.
- **Vector-index technology** - the embedding store / vector index (library and
  on-disk location) is pending compatibility verification.

## Models

- **Chat model:** the currently available local Ollama chat model is
  `llama3.2:3b`.
- **Embedding model:** **no embedding model is assumed to be installed.** An
  embedding model must be selected and verified locally before retrieval can
  run.

## Data

- `data/seed/` - seed/input test cases (committed to the repository).
- `data/generated/` - locally generated artifacts (ignored by git).
- `exports/` - CSV output (ignored by git).
- Local vector index / embeddings store - local only (ignored by git).

## Configuration

Runtime configuration is read from environment variables (see `.env.example`):
the Ollama base URL, chat model, embedding model, the n8n base URL, and the demo
website URL.
