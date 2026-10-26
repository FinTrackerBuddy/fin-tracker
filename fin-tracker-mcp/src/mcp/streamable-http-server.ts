import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createFinanceMcpServer, type FinanceMcpServerDependencies } from "./finance-mcp-server.js";
import { summarizeError } from "../logging/application-logger.js";

const MCP_PATH = "/mcp";
const MAX_REQUEST_BODY_BYTES = 1_000_000;

/**
 * Creates a loopback-safe Streamable HTTP MCP endpoint.
 *
 * The server is intentionally stateless: finance operations are read-only and
 * do not need MCP session affinity. A fresh MCP server/transport is created
 * per HTTP request, allowing multiple independent agent harnesses to connect.
 */
export function createFinanceMcpHttpServer(dependencies: FinanceMcpServerDependencies = {}): Server {
  return createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== MCP_PATH) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    if (request.method !== "POST" && request.method !== "GET" && request.method !== "DELETE") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    let body: unknown;
    try {
      body = request.method === "POST" ? await readJsonBody(request) : undefined;
    } catch (error) {
      sendJson(response, 400, { jsonrpc: "2.0", error: { code: -32700, message: summarizeError(error) }, id: null });
      return;
    }

    const mcpServer = createFinanceMcpServer(dependencies);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    response.once("close", () => {
      void transport.close();
      void mcpServer.close();
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, 500, { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error." }, id: null });
      }
      console.error(`Finance MCP HTTP request failed: ${summarizeError(error)}`);
    }
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) throw new Error("Request body is required.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Request body must contain valid JSON.");
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function loadPort(environment: NodeJS.ProcessEnv = process.env): number {
  const value = environment.FINANCE_MCP_PORT?.trim() || "3002";
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("FINANCE_MCP_PORT must be an integer from 1 to 65535.");
  return port;
}

function loadHost(environment: NodeJS.ProcessEnv = process.env): string {
  const host = environment.FINANCE_MCP_HOST?.trim() || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    throw new Error("FINANCE_MCP_HOST must be a loopback address until HTTP authentication is configured.");
  }
  return host;
}

async function main(): Promise<void> {
  const port = loadPort();
  const host = loadHost();
  const server = createFinanceMcpHttpServer();
  server.listen(port, host, () => {
    console.error(`Finance MCP Streamable HTTP server is listening at http://${host}:${port}${MCP_PATH}.`);
  });
}

if (import.meta.url === new URL(process.argv[1]!, "file:").href) {
  void main().catch((error: unknown) => {
    console.error(`Finance MCP HTTP server failed to start: ${summarizeError(error)}`);
    process.exitCode = 1;
  });
}
