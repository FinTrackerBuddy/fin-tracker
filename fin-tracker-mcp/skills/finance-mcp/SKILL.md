---
name: finance-mcp
description: Answer debit-expense questions using the read-only Finance MCP tools with deterministic analysis and privacy-safe presentation.
---

# Finance MCP

Use this skill when a user asks about debit expenses held in the configured
Google Sheets workbook. The Finance MCP server is read-only: it has no
arbitrary spreadsheet-range access and cannot modify financial records. For a
write request, say that the connected server does not support it; do not imply
that a record was changed.

## Context, categories, and dates

Read `finance://expense-categories` before selecting category labels for a
broad spending concept. Use literal labels from that live vocabulary; never
invent a category or silently map a near match. If the user's wording exactly
matches a category, prefer it. Include multiple categories only when each is
directly relevant. If the request is ambiguous and a category choice would
materially change the result, ask for clarification.

Cash is a payment-method/account filter, not an expense category. For cash
spending, use `paymentMethod: "cash"`; owner-prefixed cash accounts are
included even when `Cash` is absent from the category vocabulary.

Resolve relative dates such as “this month” and “last month” from the host's
current date in `Asia/Kolkata`. Calendar adjacency is chronological, not the
workbook's April–March display order. If the harness cannot supply a reliable
current date or timezone and it matters to the requested result, ask the user
for an explicit period instead of guessing.

## Expense interpretation and tool use

Use `get_expenses` only for individual transaction detail. It supports literal
workbook categories, configured month-tab names, an ISO date, and the `cash`
payment method. Do not total returned rows in reasoning when an analysis tool
can answer the question.

Use `analyze_expenses` for totals, grouped or ranked spending, top-N results,
monthly trends, frequency, and average-monthly spending. It deterministically
filters, groups, counts/sums, sorts, limits, and calculates monthly averages.
Its closed specification supports filters; `groupBy` values of month,
day-of-week, category, account, or description; sum/count aggregation; a
matching total/count sort; an optional limit; and deterministic monthly
averages. Put literal labels in `filter.categories` and exclusions in
`filter.excludeCategories`.

For “average monthly” or “based on months already passed,” make one
`analyze_expenses` call with `groupBy: "month"`, `aggregation: "sum"`,
`averageMonthly: true`, the exact elapsed financial-year months, and every
requested exclusion. The tool returns the average; do not make separate calls
or calculate it yourself. For an additive follow-up such as “exclude
electronic items as well,” retain the earlier analysis shape and exclusions,
add the new exclusion, and again use one monthly-average call.

Description filtering and grouping are exact ledger text only. Use
`filter.descriptions` only when the user supplied an exact description; never
invent, normalize, or merge free-text variants. `analyze_expenses` performs
all filtering, grouping, aggregation, sorting, and calculations—never derive
those values from `get_expenses` rows yourself.

Use `compare_spending_periods` for ordered period totals, increases/decreases,
differences, or percentage changes. For category- or exact-description-filtered
comparisons, make one filtered call with the requested periods; never follow it
with an unfiltered comparison. Preserve the requested period order; the tool
compares adjacent periods only.

For “this month versus the prior N months,” or when the user requests the last
N months individually, pass each earlier month and the current month as
separate chronological single-month periods—not one combined baseline. Report
each month's deterministic total. A null percentage change means the earlier
period was zero, not infinity.

## Response scope

Treat tool output as the authority for monetary values. Do not calculate,
validate, or reinterpret totals in the model. Do not expose financial details
the user did not request, log raw transaction data, or invent category mappings.
Whenever naming an individual transaction, include its amount in currency.

Answer only the question asked. Do not append suggestions, invitations, or a
follow-up question unless the user explicitly requests recommendations or
options. When the user explicitly requests JSON, HTML, or XML, return only a
valid document in that requested format with no Markdown fence or explanatory
text. Otherwise return ordinary plain text.
