import { z } from "zod";
import { getProfiles, getBrowsers } from "../nstbrowser.js";
import type { ToolDef } from "../types.js";

export function registerNstTools(toolRegistry: Map<string, ToolDef>): void {
  toolRegistry.set("nst_get_profiles", {
    name: "nst_get_profiles",
    description: "List available NSTBrowser profiles",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        pageSize: { type: "number", description: "Results per page" },
        s: { type: "string", description: "Search query" },
        groupId: { type: "string", description: "Filter by group ID" },
      },
    },
    handler: async (args) => {
      try {
        const params = z
          .object({
            page: z.number().int().positive().optional(),
            pageSize: z.number().int().positive().optional(),
            s: z.string().optional(),
            groupId: z.string().optional(),
          })
          .parse(args);

        const queryParams: Record<string, string | undefined> = {
          page: params.page?.toString(),
          pageSize: params.pageSize?.toString(),
          s: params.s,
          groupId: params.groupId,
        };
        const res = await getProfiles(queryParams);
        if (res.err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${res.msg} (code: ${res.code})`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(res.data, null, 2),
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

  toolRegistry.set("nst_get_browsers", {
    name: "nst_get_browsers",
    description: "List running NSTBrowser instances",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["starting", "running", "stopping"],
          description: "Filter by browser status",
        },
      },
    },
    handler: async (args) => {
      try {
        const { status } = z
          .object({
            status: z
              .enum(["starting", "running", "stopping"])
              .optional(),
          })
          .parse(args);
        const res = await getBrowsers(status);
        if (res.err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${res.msg} (code: ${res.code})`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(res.data, null, 2),
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
