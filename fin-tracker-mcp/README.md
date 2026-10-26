# Finance MCP Server

The Finance MCP server provides standalone stdio and Streamable HTTP
transports. It does not construct an LLM or retain conversation memory. It
owns its own read-only Google Sheets OAuth configuration and exposes only these
bounded operations:

- `get_expenses` for requested transaction details;
- `analyze_expenses` for deterministic aggregation and grouping; and
- `compare_spending_periods` for caller-ordered period totals and adjacent
  comparisons.

Install dependencies, then configure the workbook and complete OAuth:

```sh
npm install
npm run google-auth
```

Copy `.env.example` to `.env` before authorizing. This creates the ignored
local `token.json`.

For a shared local endpoint, run this in its own terminal:

```sh
npm run start:http
```

It listens on `http://127.0.0.1:3002/mcp` by default. `FINANCE_MCP_HOST` is
restricted to a loopback address until HTTP authentication is intentionally
implemented; do not expose this service directly to a network.

For an isolated stdio client process, run:

```sh
npm start
```

It communicates over standard input/output and diagnostics go to standard
error, so do not use it interactively.

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
