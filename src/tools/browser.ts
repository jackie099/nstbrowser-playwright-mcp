import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { SessionManager } from "../sessions.js";
import type { ToolDef } from "../types.js";

const EXCLUDED_TOOLS = new Set(["browser_close", "browser_install"]);

export async function registerBrowserProxyTools(
  toolRegistry: Map<string, ToolDef>,
  sessions: SessionManager,
  server: Server
): Promise<void> {
  const session = sessions.getCurrent();
  const { tools } = await session.client.listTools();

  for (const tool of tools) {
    if (EXCLUDED_TOOLS.has(tool.name)) continue;

    toolRegistry.set(tool.name, {
      name: tool.name,
      description: tool.description || tool.name,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      handler: async (args) => {
        try {
          const current = sessions.getCurrent();
          const result = await current.client.callTool({
            name: tool.name,
            arguments: args,
          });
          return result as ReturnType<ToolDef["handler"]> extends Promise<
            infer R
          >
            ? R
            : never;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    });
  }

  await server.sendToolListChanged();
}
