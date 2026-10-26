# Finance MCP Server

The Finance MCP server is a standalone stdio process. It does not start an
HTTP API, construct an LLM, or retain conversation memory. It owns its own
read-only Google Sheets OAuth configuration and exposes only these bounded
operations:

- `get_expenses` for requested transaction details;
- `analyze_expenses` for deterministic aggregation and grouping; and
- `compare_spending_periods` for caller-ordered period totals and adjacent
  comparisons.

Install dependencies, then build and run it from the repository root:

```sh
npm install
npm start
```

It communicates with its client over standard input/output. Diagnostic logs
go to standard error, so do not use it interactively. Copy `.env.example` to
`.env`, configure the workbook, and use `npm run google-auth` once to create
the ignored local `token.json`.

For a compatible MCP client, configure a local stdio server with this working
directory and command:

```json
{
  "command": "npm",
  "args": ["start"],
  "cwd": "/Users/airfi/Documents/Pratheek/fin-tracker-mcp"
}
```

Install or make discoverable `skills/finance-mcp/SKILL.md` alongside that MCP
connection. The skill guides tool selection and privacy-safe presentation; the
MCP input schemas and server enforce the executable validation and all
financial calculations.
