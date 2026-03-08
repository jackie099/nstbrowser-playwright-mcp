import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProfiles, getBrowsers } from "../nstbrowser.js";

export function registerNstTools(server: McpServer): void {
  server.tool(
    "nst_get_profiles",
    "List available NSTBrowser profiles",
    {
      page: z.string().optional().describe("Page number"),
      pageSize: z.string().optional().describe("Results per page"),
      s: z.string().optional().describe("Search query"),
      groupId: z.string().optional().describe("Filter by group ID"),
    },
    async (params) => {
      try {
        const res = await getProfiles(params);
        if (res.err) {
          return {
            content: [{ type: "text" as const, text: `Error: ${res.msg} (code: ${res.code})` }],
            isError: true,
          };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "nst_get_browsers",
    "List running NSTBrowser instances",
    {
      status: z.enum(["starting", "running", "stopping"]).optional().describe("Filter by browser status"),
    },
    async ({ status }) => {
      try {
        const res = await getBrowsers(status);
        if (res.err) {
          return {
            content: [{ type: "text" as const, text: `Error: ${res.msg} (code: ${res.code})` }],
            isError: true,
          };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(res.data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
