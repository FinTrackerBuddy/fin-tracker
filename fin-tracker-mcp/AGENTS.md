# fin-tracker-mcp — Project Instructions

## Scope and source of truth

Read `PROJECT_SPEC.md` and `README.md` before changing this repository. This
project owns the standalone, read-only Finance MCP server and its deterministic
Google Sheets finance domain. It does not own an LLM, HTTP API, conversation
memory, or agent orchestration.

## Architecture and financial-data rules

- Keep finance calculations, validation, filtering, grouping, aggregation,
  sorting, and comparison in deterministic TypeScript.
- Expose only bounded high-level MCP operations and approved read-only
  resources. Do not add arbitrary Sheets-range access, generic Sheets tools,
  spreadsheet writes, or credential-returning endpoints.
- Retain the existing read-only Google Sheets REST OAuth integration. Google's
  preview Sheets MCP server is out of scope.
- Transaction descriptions are financial data. Exact-description operations
  must not normalize or silently merge variants, and transactions must never
  become persistent semantic memory automatically.
- Retrieve and return only the detail required by the requested operation.
  Never log raw financial rows/descriptions, access or refresh tokens,
  authorization headers, credentials, API keys, or full prompts.
- The Finance MCP server is the authority for tool schemas and financial
  results. Clients and skills select and explain operations; they must not
  calculate values from returned transactions.

## Configuration and testing

- `.env` is local and ignored. `.env.example` is the template. Keep local
  OAuth files (`credentials.json` and `token.json`) ignored and never expose
  their contents.
- Add deterministic tests for meaningful behavior changes. Tests must use fake
  sources and must not make live Sheets or LLM requests.
- Run `npm run typecheck` and `npm test` for implementation changes when
  practical.

## Git discipline

- Do **not** commit, push, create branches, open pull requests, or otherwise
  modify Git remote state unless the user specifically asks for that action in
  the current prompt.
- Preserve unrelated working-tree changes. Do not reset, discard, or overwrite
  user changes without explicit authorization.
