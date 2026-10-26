import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createFinanceMcpServer } from "./finance-mcp-server.js";
import type { ExpenseDataSource } from "../google-sheets/expense-data-source.js";

const source: ExpenseDataSource = {
  monthTabs: ["April", "May"],
  async listExpenses() {
    return [
      { date: "2026-04-01", category: "Food", description: "Lunch", amount: 120, sourceSheet: "April", sourceRow: 9, account: "Cash" },
      { date: "2026-05-01", category: "Food", description: "Lunch", amount: 200, sourceSheet: "May", sourceRow: 9, account: "Cash" },
    ];
  },
};

test("Finance MCP server exposes only the bounded read-only finance operations", async () => {
  const server = createFinanceMcpServer({ source });
  const client = new Client({ name: "finance-mcp-test", version: "1.0.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
    "analyze_expenses",
    "compare_spending_periods",
    "get_expenses",
  ]);
  assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint));

  const result = await client.callTool({
    name: "compare_spending_periods",
    arguments: { periods: [{ label: "April", months: ["April"] }, { label: "May", months: ["May"] }] },
  });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    periods: [
      { label: "April", months: ["April"], total: 120 },
      { label: "May", months: ["May"], total: 200 },
    ],
    comparisons: [{ from: "April", to: "May", difference: 80, percentageChange: 66.66666666666666 }],
  });

  await Promise.all([client.close(), server.close()]);
});
