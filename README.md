# Fin Tracker

A personal finance assistant for read-only analysis of an Expenses Google
Sheets workbook. The repository separates conversational AI from deterministic
financial data access and calculations.

## Components

| Component | Responsibility |
| --- | --- |
| `fin-tracker-agent/` | Provider-neutral LangChain HTTP agent. It accepts natural-language questions, manages bounded in-process conversation context, and calls the Finance MCP server. |
| `fin-tracker-mcp/` | Standalone stdio Model Context Protocol (MCP) server. It owns read-only Google Sheets OAuth, ledger reads, validation, and deterministic calculations. |

The current source is an **Expenses** workbook. It supports debit-expense
analysis; it is not a general portfolio, income, or wealth tracker.

## What it can do

- Retrieve debit-expense transactions with bounded filters.
- Analyze expenses with workbook-backed filters, grouping, sums/counts,
  sorting, and a bounded top-N result.
- Compare caller-ordered spending periods and calculate sequential changes.
- Analyze exact transaction descriptions without silently merging free-text
  variants.
- Preserve bounded context within an optional API `conversationId` while the
  agent process is running.

Financial calculations run in TypeScript. The LLM interprets the question,
selects a tool, and explains its structured result; it does not calculate from
raw transactions.

## Architecture

```text
Client
  │ POST /api/query
  ▼
Finance Agent (LangChain, provider-neutral)
  │ stdio MCP
  ▼
Finance MCP Server
  │ read-only OAuth
  ▼
Google Sheets Expenses workbook
```

The MCP server exposes only high-level, validated operations:
`get_expenses`, `analyze_expenses`, and `compare_spending_periods`. It does not
expose arbitrary Sheet ranges or write access.

## Prerequisites

- Node.js compatible with the projects' TypeScript/Node dependencies.
- A Google Cloud Desktop/Installed OAuth client, stored locally as
  `fin-tracker-mcp/credentials.json`.
- A Google account with **Viewer** access to the Expenses workbook.
- An API key for the selected LLM provider (OpenAI or Gemini).

## Local setup

Install dependencies separately for each component:

```sh
cd fin-tracker-mcp
npm install
cp .env.example .env

cd ../fin-tracker-agent
npm install
cp .env.example .env
```

Configure `fin-tracker-mcp/.env` with the spreadsheet ID. Its default ledger
range is `A9:G` and its month tabs are April–March. Run the one-time OAuth
authorization from that component:

```sh
cd fin-tracker-mcp
npm run google-auth
```

This stores an ignored local `token.json`. Reauthorize intentionally with:

```sh
npm run google-auth -- --force
```

Configure `fin-tracker-agent/.env` with:

- `LLM_PROVIDER` (`openai` or `gemini`) and a compatible `LLM_MODEL`
- Only the selected provider's API key
- A long random `API_AUTH_TOKEN`
- `FINANCE_MCP_COMMAND`, `FINANCE_MCP_ARGS`, and `FINANCE_MCP_CWD` pointing to
  this repository's `fin-tracker-mcp` directory

The checked-in `.env.example` files document every supported setting. Never
commit `.env`, `credentials.json`, `token.json`, or provider keys.

## Run the HTTP agent

The agent starts its configured Finance MCP process as needed:

```sh
cd fin-tracker-agent
npm start
```

The API listens on `http://localhost:3001` and exposes only `POST /api/query`.

```sh
curl --request POST http://localhost:3001/api/query \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <API_AUTH_TOKEN>' \
  --data '{"query":"How much did I spend on dining out this month?"}'
```

Successful responses have the shape:

```json
{ "text": "..." }
```

To retain bounded context for follow-up questions in the same running process,
reuse a valid client-generated `conversationId`:

```json
{
  "query": "How much was it in September?",
  "conversationId": "budget-review-2026"
}
```

Conversation memory is process-local, excludes tool results and raw financial
rows, and is not persistent semantic memory.

## Run the MCP server directly

This is useful when connecting an external MCP-capable client:

```sh
cd fin-tracker-mcp
npm start
```

It communicates over standard input/output; diagnostics are written to standard
error. See [the MCP component README](fin-tracker-mcp/README.md) and
`fin-tracker-mcp/skills/finance-mcp/SKILL.md` for connection and tool-use
guidance.

## Verification

Run checks from each component directory:

```sh
npm run typecheck
npm run build
npm test
```

The agent also provides focused checks such as `npm run test:api`,
`npm run test:finance-agent`, and `npm run test:expenses`. These unit tests use
fake/in-memory sources and do not require live Sheets or LLM access.

## Data and privacy

- Google Sheets access is read-only OAuth; no write endpoint is available.
- The monthly ledger is the transaction-detail authority; the formula-backed
  debit summary is used for category/month monetary totals.
- Transaction descriptions are sensitive financial data, not user memories.
  Description matching is exact until a separately designed normalization
  capability exists.
- Logs retain correlation and timing information without raw financial rows,
  prompts, OAuth tokens, or API keys.

## Project documentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — product direction, architecture, and roadmap.
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — current implementation and operational status.
- [WORKBOOK_DATA_MAP.md](WORKBOOK_DATA_MAP.md) — observed source-workbook schema and limitations.
- [AGENTS.md](AGENTS.md) — repository conventions for contributors and agents.

Phase 3C (portable Finance MCP server and skill packaging) is complete. Phase
3D persistent semantic memory and Phase 4 advanced architecture remain future
work.
