---
name: finance-mcp
description: Use the read-only Finance MCP tools for deterministic expense retrieval, analysis, and period comparison.
---

# Finance MCP

Use this skill when a user asks about debit expenses held in the configured
Google Sheets workbook. The Finance MCP server is read-only: it has no
arbitrary spreadsheet-range access and cannot modify financial records.

Use `get_expenses` only for individual transaction detail. It supports literal
workbook categories, configured month-tab names, an ISO date, and the `cash`
payment method. Do not total returned rows in reasoning when an analysis tool
can answer the question.

Use `analyze_expenses` for totals, grouped or ranked spending, top-N results,
monthly trends, frequency, and average-monthly spending. It deterministically
filters, groups, counts/sums, sorts, limits, and calculates monthly averages.
Use literal workbook category labels. Description filtering and grouping are
exact ledger text only; do not treat variants as the same item.

Use `compare_spending_periods` for ordered period totals, increases/decreases,
differences, and percentage changes. Preserve the requested period order; the
tool compares adjacent periods only. For “this month versus the prior N
months,” pass each month as its own chronological single-month period, not one
combined baseline period. A null percentage change means the earlier period
was zero, not infinity.

Treat tool output as the authority for monetary values. Do not calculate,
validate, or reinterpret totals in the model. Do not expose financial details
the user did not request, log raw transaction data, or invent category mappings.
Whenever naming an individual transaction, include its amount. Answer only the
question asked; do not append suggestions or invitations.
