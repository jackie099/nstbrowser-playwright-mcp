import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chromium } from "playwright-core";
import { SessionManager } from "../sessions.js";
import { connectToProfile, connectOnce } from "../nstbrowser.js";

export function registerSessionTools(
  server: McpServer,
  sessions: SessionManager
): void {
  server.tool(
    "create_session",
    "Create a browser session by connecting to an NSTBrowser profile via CDP. Provide profileId for an existing profile, or name+kernel+platform to create a temporary one.",
    {
      profileId: z.string().optional().describe("Existing NSTBrowser profile ID to connect to"),
      name: z.string().optional().describe("Name for a temporary profile (used if no profileId)"),
      kernel: z.enum(["chromium"]).optional().describe("Browser kernel (default: chromium)"),
      kernelMilestone: z.string().optional().describe("Kernel version milestone, e.g. '128'"),
      platform: z.enum(["linux", "mac", "windows"]).optional().describe("Target platform"),
      headless: z.boolean().optional().describe("Run headless"),
      proxy: z.string().optional().describe("Proxy string"),
    },
    async (params) => {
      try {
        let cdpData;
        let resolvedProfileId: string;

        if (params.profileId) {
          cdpData = await connectToProfile(params.profileId, {
            headless: params.headless,
          });
          resolvedProfileId = params.profileId;
        } else {
          const config = {
            name: params.name || "mcp-temp",
            kernel: params.kernel || "chromium",
            kernelMilestone: params.kernelMilestone || "128",
            platform: params.platform || "mac",
            headless: params.headless,
            proxy: params.proxy,
          };
          cdpData = await connectOnce(config);
          resolvedProfileId = cdpData.profileId;
        }

        const browser = await chromium.connectOverCDP(cdpData.webSocketDebuggerUrl);
        const session = await sessions.createSession(browser, resolvedProfileId);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ sessionId: session.id, profileId: resolvedProfileId, url: session.activePage.url() }, null, 2),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("list_sessions", "List all active browser sessions", {}, async () => {
    const list = sessions.listAll();
    return { content: [{ type: "text" as const, text: JSON.stringify(list, null, 2) }] };
  });

  server.tool(
    "switch_session",
    "Switch the active browser session",
    { sessionId: z.string().describe("Session ID to switch to") },
    async ({ sessionId }) => {
      try {
        const session = sessions.switchTo(sessionId);
        return { content: [{ type: "text" as const, text: `Switched to ${session.id} (profile: ${session.profileId}, url: ${session.activePage.url()})` }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "close_session",
    "Close a browser session and disconnect from NSTBrowser",
    { sessionId: z.string().describe("Session ID to close") },
    async ({ sessionId }) => {
      try {
        await sessions.closeSession(sessionId);
        return { content: [{ type: "text" as const, text: `Session ${sessionId} closed.` }] };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
