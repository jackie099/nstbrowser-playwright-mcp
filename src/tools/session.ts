import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { SessionManager } from "../sessions.js";
import { connectToProfile, connectOnce } from "../nstbrowser.js";
import { registerBrowserProxyTools } from "./browser.js";
import type { ToolDef } from "../types.js";

const createSessionParams = z.object({
  profileId: z.string().optional(),
  name: z.string().optional(),
  kernel: z.enum(["chromium"]).optional(),
  kernelMilestone: z.string().optional(),
  platform: z.enum(["linux", "mac", "windows"]).optional(),
  headless: z.boolean().optional(),
  proxy: z.string().optional(),
});

export function registerSessionTools(
  toolRegistry: Map<string, ToolDef>,
  sessions: SessionManager,
  server: Server
): void {
  toolRegistry.set("create_session", {
    name: "create_session",
    description:
      "Create a browser session by connecting to an NSTBrowser profile via CDP. Provide profileId for an existing profile, or name+kernel+platform to create a temporary one.",
    inputSchema: {
      type: "object",
      properties: {
        profileId: {
          type: "string",
          description: "Existing NSTBrowser profile ID to connect to",
        },
        name: {
          type: "string",
          description:
            "Name for a temporary profile (used if no profileId)",
        },
        kernel: {
          type: "string",
          enum: ["chromium"],
          description: "Browser kernel (default: chromium)",
        },
        kernelMilestone: {
          type: "string",
          description: "Kernel version milestone, e.g. '128'",
        },
        platform: {
          type: "string",
          enum: ["linux", "mac", "windows"],
          description: "Target platform",
        },
        headless: { type: "boolean", description: "Run headless" },
        proxy: { type: "string", description: "Proxy string" },
      },
    },
    handler: async (args) => {
      try {
        const params = createSessionParams.parse(args);
        let cdpData;
        let resolvedProfileId: string;

        if (params.profileId) {
          const config: Record<string, unknown> = {};
          if (params.headless !== undefined) config.headless = params.headless;
          cdpData = await connectToProfile(
            params.profileId,
            Object.keys(config).length > 0 ? config : undefined
          );
          resolvedProfileId = params.profileId;
        } else {
          const config: Record<string, unknown> = {
            name: params.name || "mcp-temp",
            kernel: params.kernel || "chromium",
            kernelMilestone: params.kernelMilestone || "128",
            platform: params.platform || "mac",
          };
          if (params.headless !== undefined) config.headless = params.headless;
          if (params.proxy !== undefined) config.proxy = params.proxy;
          cdpData = await connectOnce(config);
          resolvedProfileId = cdpData.profileId;
        }

        const session = await sessions.createSession(
          cdpData.webSocketDebuggerUrl,
          resolvedProfileId
        );

        // Register browser proxy tools on first session creation
        if (!sessions.browserToolsRegistered) {
          sessions.markBrowserToolsRegistered();
          await registerBrowserProxyTools(toolRegistry, sessions, server);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { sessionId: session.id, profileId: resolvedProfileId },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  toolRegistry.set("list_sessions", {
    name: "list_sessions",
    description: "List all active browser sessions",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const list = sessions.listAll();
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(list, null, 2) },
        ],
      };
    },
  });

  toolRegistry.set("switch_session", {
    name: "switch_session",
    description: "Switch the active browser session",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID to switch to",
        },
      },
      required: ["sessionId"],
    },
    handler: async (args) => {
      try {
        const { sessionId } = z
          .object({ sessionId: z.string() })
          .parse(args);
        const session = sessions.switchTo(sessionId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Switched to ${session.id} (profile: ${session.profileId})`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  toolRegistry.set("close_session", {
    name: "close_session",
    description: "Close a browser session and disconnect from NSTBrowser",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID to close",
        },
      },
      required: ["sessionId"],
    },
    handler: async (args) => {
      try {
        const { sessionId } = z
          .object({ sessionId: z.string() })
          .parse(args);
        await sessions.closeSession(sessionId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Session ${sessionId} closed.`,
            },
          ],
        };
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
