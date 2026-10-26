import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

import { type ExpenseCategoryVocabularyProvider } from "../google-sheets/expense-category-vocabulary.js";
import { type ApplicationLogger } from "../logging/application-logger.js";
import { expenseAnalysisInputSchema } from "../tools/analyze-expenses.js";
import { compareSpendingPeriodsInputSchema } from "../tools/compare-spending-periods.js";
import { getExpensesInputSchema } from "../tools/get-expenses.js";

const CATEGORY_RESOURCE_URI = "finance://expense-categories";

export interface FinanceMcpClient {
  callTool(name: string, input: Record<string, unknown>): Promise<unknown>;
  listCategories(): Promise<readonly string[]>;
}

export function createFinanceMcpClientFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): FinanceMcpClient {
  return new LazyFinanceMcpClient(() => {
    const transport = environment.FINANCE_MCP_TRANSPORT?.trim() || "stdio";
    if (transport === "streamable-http") {
      const url = required(environment.FINANCE_MCP_URL, "FINANCE_MCP_URL");
      return new StreamableHttpFinanceMcpClient(url);
    }
    if (transport !== "stdio") {
      throw new Error("FINANCE_MCP_TRANSPORT must be either stdio or streamable-http.");
    }
    const command = required(environment.FINANCE_MCP_COMMAND, "FINANCE_MCP_COMMAND");
    const cwd = required(environment.FINANCE_MCP_CWD, "FINANCE_MCP_CWD");
    const args = required(environment.FINANCE_MCP_ARGS, "FINANCE_MCP_ARGS")
      .split(",").map((value) => value.trim()).filter(Boolean);
    if (args.length === 0) throw new Error("FINANCE_MCP_ARGS must contain at least one comma-separated argument.");
    return new StdioFinanceMcpClient(command, args, cwd);
  });
}

export function createMcpFinanceTools(client: FinanceMcpClient, logger: ApplicationLogger): {
  expenseTool: StructuredToolInterface;
  comparisonTool: StructuredToolInterface;
  analysisTool: StructuredToolInterface;
  categoryVocabulary: ExpenseCategoryVocabularyProvider;
} {
  return {
    expenseTool: createMcpTool("getExpenses", "get_expenses", getExpensesInputSchema, client, logger),
    comparisonTool: createMcpTool("compareSpendingPeriods", "compare_spending_periods", compareSpendingPeriodsInputSchema, client, logger),
    analysisTool: createMcpTool("analyzeExpenses", "analyze_expenses", expenseAnalysisInputSchema, client, logger),
    categoryVocabulary: { listCategories: () => client.listCategories() },
  };
}

function createMcpTool(name: string, remoteName: string, schema: z.ZodType, client: FinanceMcpClient, logger: ApplicationLogger): StructuredToolInterface {
  return tool(async (input) => {
    const startedAt = performance.now();
    logger.info("Tool", "MCP tool execution started", { tool: name, mcpTool: remoteName });
    const result = await client.callTool(remoteName, input as Record<string, unknown>);
    logger.info("Tool", "MCP tool execution completed", { tool: name, mcpTool: remoteName, durationMs: Math.round(performance.now() - startedAt) });
    return result;
  }, { name, description: `Remote Finance MCP adapter for ${remoteName}.`, schema });
}

class StdioFinanceMcpClient implements FinanceMcpClient {
  private readonly client = new Client({ name: "fin-tracker-agent", version: "0.1.0" });
  private connection?: Promise<void>;

  public constructor(private readonly command: string, private readonly args: string[], private readonly cwd: string) {}

  public async callTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    await this.connect();
    const result = await this.client.callTool({ name, arguments: input }) as unknown as McpToolResult;
    if (result.isError) throw new Error(result.content.map((item) => item.type === "text" ? item.text ?? "" : "").join(" "));
    if (result.structuredContent !== undefined) return result.structuredContent;
    const text = result.content.find((item) => item.type === "text")?.text;
    if (!text) throw new Error(`Finance MCP tool ${name} returned no structured content.`);
    return JSON.parse(text) as unknown;
  }

  public async listCategories(): Promise<readonly string[]> {
    await this.connect();
    const result = await this.client.readResource({ uri: CATEGORY_RESOURCE_URI });
    const firstContent = result.contents[0];
    const text = firstContent && "text" in firstContent ? firstContent.text : undefined;
    const categories = text ? JSON.parse(text) : undefined;
    if (!Array.isArray(categories) || !categories.every((category) => typeof category === "string")) {
      throw new Error("Finance MCP category resource returned an invalid response.");
    }
    return categories;
  }

  private connect(): Promise<void> {
    this.connection ??= this.client.connect(new StdioClientTransport({ command: this.command, args: this.args, cwd: this.cwd }));
    return this.connection;
  }
}

class StreamableHttpFinanceMcpClient implements FinanceMcpClient {
  private readonly client = new Client({ name: "fin-tracker-agent", version: "0.1.0" });
  private connection?: Promise<void>;
  private readonly endpoint: URL;

  public constructor(url: string) {
    try {
      this.endpoint = new URL(url);
    } catch {
      throw new Error("FINANCE_MCP_URL must be an absolute URL.");
    }
    if (this.endpoint.protocol !== "http:" && this.endpoint.protocol !== "https:") {
      throw new Error("FINANCE_MCP_URL must use http or https.");
    }
  }

  public async callTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    await this.connect();
    const result = await this.client.callTool({ name, arguments: input }) as unknown as McpToolResult;
    return parseToolResult(name, result);
  }

  public async listCategories(): Promise<readonly string[]> {
    await this.connect();
    return parseCategories(await this.client.readResource({ uri: CATEGORY_RESOURCE_URI }));
  }

  private connect(): Promise<void> {
    this.connection ??= this.client.connect(new StreamableHTTPClientTransport(this.endpoint));
    return this.connection;
  }
}

class LazyFinanceMcpClient implements FinanceMcpClient {
  private client?: FinanceMcpClient;

  public constructor(private readonly factory: () => FinanceMcpClient) {}

  public callTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    return this.getClient().callTool(name, input);
  }

  public listCategories(): Promise<readonly string[]> {
    return this.getClient().listCategories();
  }

  private getClient(): FinanceMcpClient {
    this.client ??= this.factory();
    return this.client;
  }
}

interface McpToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
}

function parseToolResult(name: string, result: McpToolResult): unknown {
  if (result.isError) throw new Error(result.content.map((item) => item.type === "text" ? item.text ?? "" : "").join(" "));
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`Finance MCP tool ${name} returned no structured content.`);
  return JSON.parse(text) as unknown;
}

function parseCategories(result: unknown): readonly string[] {
  const firstContent = typeof result === "object" && result !== null && "contents" in result
    && Array.isArray(result.contents) ? result.contents[0] : undefined;
  const text = typeof firstContent === "object" && firstContent !== null && "text" in firstContent
    && typeof firstContent.text === "string" ? firstContent.text : undefined;
  const categories = text ? JSON.parse(text) : undefined;
  if (!Array.isArray(categories) || !categories.every((category) => typeof category === "string")) {
    throw new Error("Finance MCP category resource returned an invalid response.");
  }
  return categories;
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required to connect to the Finance MCP server.`);
  return value.trim();
}
