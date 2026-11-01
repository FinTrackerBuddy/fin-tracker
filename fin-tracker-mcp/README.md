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

## Connect an external agent

The server and bundled `skills/finance-mcp/SKILL.md` use the standard MCP
tool protocol, so any local MCP-capable harness can connect. The skill is
workflow guidance; the server's published schemas remain the authoritative
contract.

### Shared Streamable HTTP service (recommended)

Start the service from this component after completing the local OAuth setup:

```sh
npm run start:http
```

Then add the local URL to the harness running on this same computer:

```sh
# Codex CLI
codex mcp add finance --url http://127.0.0.1:3002/mcp

# Claude Code
claude mcp add --transport http finance http://127.0.0.1:3002/mcp
```

Use the harness's connection/status command to verify that `finance` is
connected and that it discovers the three read-only tools. The URL is bound to
loopback, so it is intentionally unavailable to hosted/cloud harnesses or
other machines. Do not change the host setting to expose this unauthenticated
service to a network.

Codex users can also load this component as a local portable plugin: its root
`plugin.json`, `mcp.json`, and `skills/finance-mcp/` package the connection and
skill together. Start the local service first; the plugin does not start it or
carry credentials. Claude Code uses the connection command above and should be
given the skill file through its normal project instructions or skill-discovery
mechanism.

### Isolated stdio service

For a client that starts its own private MCP process, configure this working
directory and command:

```json
{
  "command": "npm",
  "args": ["start"],
  "cwd": "/Users/airfi/Documents/Pratheek/fin-tracker/fin-tracker-mcp"
}
```

Make `skills/finance-mcp/SKILL.md` discoverable alongside that MCP connection.
It guides tool selection and privacy-safe presentation; the MCP input schemas
and server enforce executable validation and all financial calculations.
