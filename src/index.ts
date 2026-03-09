#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SessionManager } from "./sessions.js";
import { registerSessionTools } from "./tools/session.js";
import { registerNstTools } from "./tools/nstbrowser.js";
import type { ToolDef } from "./types.js";

if (!process.env.NSTBROWSER_API_KEY) {
  console.error("NSTBROWSER_API_KEY environment variable is required");
  process.exit(1);
}

const server = new Server(
  { name: "nstbrowser-playwright-mcp", version: "1.0.0" },
  { capabilities: { tools: { listChanged: true } } }
);

const toolRegistry = new Map<string, ToolDef>();
const sessions = new SessionManager();

registerSessionTools(toolRegistry, sessions, server);
registerNstTools(toolRegistry);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Array.from(toolRegistry.values()).map(
    ({ name, description, inputSchema, annotations }) => ({
      name,
      description,
      inputSchema,
      ...(annotations ? { annotations } : {}),
    })
  ),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolRegistry.get(name);
  if (!tool) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  return tool.handler(args ?? {});
});

const transport = new StdioServerTransport();
await server.connect(transport);
