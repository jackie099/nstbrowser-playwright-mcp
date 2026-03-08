#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SessionManager } from "./sessions.js";
import { registerSessionTools } from "./tools/session.js";
import { registerBrowserTools } from "./tools/browser.js";
import { registerNstTools } from "./tools/nstbrowser.js";

if (!process.env.NSTBROWSER_API_KEY) {
  console.error("NSTBROWSER_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "nstbrowser-playwright-mcp",
  version: "1.0.0",
});

const sessions = new SessionManager();

registerSessionTools(server, sessions);
registerBrowserTools(server, sessions);
registerNstTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
