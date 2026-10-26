# Finance MCP Server — Project Specification

## Goal

Provide a standalone, read-only Model Context Protocol (MCP) server for the
deterministic debit-expense capabilities used by Fin Tracker and compatible
external agent harnesses. This repository owns the finance data-access and
calculation boundary; it does not contain an LLM, HTTP query API, session
memory, or conversational policy.

## Architecture

```text
MCP client (Fin Tracker agent or external harness)
                    |
      stdio or Streamable HTTP MCP transport
                    |
             Finance MCP server
                    |
   deterministic validation, filtering, grouping, calculation
                    |
       read-only Google Sheets REST OAuth integration
```

The server exposes only bounded, typed operations:

- `get_expenses` for requested debit-transaction detail;
- `analyze_expenses` for deterministic filtering, grouping, aggregation,
  sorting, bounded results, and monthly averages; and
- `compare_spending_periods` for caller-ordered period totals and adjacent
  comparisons.

It also exposes the `finance://expense-categories` read-only resource so a
client can obtain the current literal category vocabulary without reading
Google Sheets directly.

## Rules

- Keep all financial calculations and validation in TypeScript. An MCP client
  must not calculate totals from returned rows.
- The server is strictly read-only. Do not add spreadsheet writes, arbitrary
  ranges, generic Sheets tools, or credential-returning operations.
- Preserve the existing read-only REST OAuth data layer. Google's preview
  Sheets MCP server is out of scope.
- Treat transaction descriptions as financial data. Exact-description filters
  and grouping must not silently merge variants or create semantic memories.
- Retrieve only the detail needed for the requested operation. Do not log raw
  rows, descriptions, OAuth tokens, API keys, or prompts.
- Keep the three high-level tool contracts composable and bounded; do not add
  a specialized endpoint for each finance question.

## Client integration

The Fin Tracker agent maps its existing internal LangChain tool names to the
MCP operation names. It can use stdio for an isolated child process or
Streamable HTTP for a separately started shared local service. The HTTP server
binds only to loopback until authentication and deployment hardening are
explicitly scoped. External clients configure either supported transport and
use `skills/finance-mcp/SKILL.md` for tool selection and presentation guidance.
The skill does not replace schemas, server-side validation, or deterministic
implementation.

## Configuration and verification

Copy `.env.example` to a local ignored `.env`, set the workbook configuration,
and complete `npm run google-auth` to create the ignored local token. Run
`npm run typecheck` and `npm test` before shipping changes. Tests must use fake
data sources and never call live Google Sheets or an LLM.
