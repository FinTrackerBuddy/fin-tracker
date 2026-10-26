import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { type ExpenseDataSource } from "../google-sheets/expense-data-source.js";
import { expenseCategoryVocabulary } from "../google-sheets/expense-category-vocabulary.js";
import { consoleApplicationLogger, summarizeError, type ApplicationLogger } from "../logging/application-logger.js";
import {
  analyzeExpenses,
  expenseAnalysisInputSchema,
  type ExpenseAnalysisSpec,
} from "../tools/analyze-expenses.js";
import {
  compareSpendingPeriods,
  compareSpendingPeriodsInputSchema,
  type CompareSpendingPeriodsInput,
} from "../tools/compare-spending-periods.js";
import {
  getExpenses,
  getExpensesInputSchema,
  type GetExpensesInput,
} from "../tools/get-expenses.js";

export interface FinanceMcpServerDependencies {
  /** Optional only for deterministic tests; production uses the Sheets OAuth source. */
  source?: ExpenseDataSource;
  logger?: ApplicationLogger;
}

/**
 * A read-only MCP transport adapter over the established finance domain tools.
 * It deliberately exposes high-level financial operations, never Sheets ranges
 * or write operations.
 */
export function createFinanceMcpServer(dependencies: FinanceMcpServerDependencies = {}): McpServer {
  const logger = dependencies.logger ?? consoleApplicationLogger;
  const server = new McpServer(
    { name: "finance-mcp", version: "0.1.0" },
    { maxToolInputElements: 200 },
  );

  server.registerResource("expense-categories", "finance://expense-categories", {
    title: "Expense category vocabulary",
    description: "Current literal debit-expense category labels from the configured workbook.",
    mimeType: "application/json",
  }, async () => ({
    contents: [{ uri: "finance://expense-categories", mimeType: "application/json", text: JSON.stringify(await expenseCategoryVocabulary.listCategories()) }],
  }));

  server.registerTool("get_expenses", {
    title: "Get expenses",
    description: "Read individual debit expenses with bounded category, month, ISO-date, or cash filters. Use only when transaction-level detail is needed.",
    inputSchema: getExpensesInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (input) => runMcpOperation("get_expenses", () => getExpenses(input as GetExpensesInput, dependencies.source, logger), logger));

  server.registerTool("analyze_expenses", {
    title: "Analyze expenses",
    description: "Run deterministic filtering, grouping, sum/count aggregation, sorting, top-N, and monthly-average analysis over debit expenses. Never calculate from transaction rows in the client.",
    inputSchema: expenseAnalysisInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (input) => runMcpOperation("analyze_expenses", () => analyzeExpenses(input as ExpenseAnalysisSpec, dependencies.source, logger), logger));

  server.registerTool("compare_spending_periods", {
    title: "Compare spending periods",
    description: "Return deterministic totals for caller-ordered periods and comparisons only between adjacent periods. Category filters use literal workbook labels; description filters require exact ledger text.",
    inputSchema: compareSpendingPeriodsInputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (input) => runMcpOperation("compare_spending_periods", () => compareSpendingPeriods(input as CompareSpendingPeriodsInput, dependencies.source, logger), logger));

  return server;
}

async function runMcpOperation(name: string, operation: () => Promise<unknown>, logger: ApplicationLogger) {
  const startedAt = performance.now();
  try {
    const result = await operation();
    logger.info("Tool", "MCP tool execution completed", { tool: name, durationMs: Math.round(performance.now() - startedAt) });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (error) {
    logger.error("Error", "MCP tool execution failed", {
      tool: name,
      durationMs: Math.round(performance.now() - startedAt),
      errorType: error instanceof Error ? error.name : "UnknownError",
      errorMessage: summarizeError(error),
    });
    return {
      content: [{ type: "text" as const, text: `Finance tool failed: ${summarizeError(error)}` }],
      isError: true,
    };
  }
}

async function main(): Promise<void> {
  const server = createFinanceMcpServer();
  await server.connect(new StdioServerTransport());
  console.error("Finance MCP server is running on stdio.");
}

if (import.meta.url === new URL(process.argv[1]!, "file:").href) {
  void main().catch((error: unknown) => {
    console.error(`Finance MCP server failed to start: ${summarizeError(error)}`);
    process.exitCode = 1;
  });
}
