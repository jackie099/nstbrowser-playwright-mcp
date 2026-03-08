import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SessionManager, resolveLocator } from "../sessions.js";

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: "image/png" };
type ToolResult = {
  content: (TextContent | ImageContent)[];
  isError?: boolean;
};

function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(err: any): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

async function pageSnapshot(sessions: SessionManager): Promise<string> {
  const page = sessions.getActivePage();
  const title = await page.title();
  const url = page.url();
  let snapshot: string;
  try {
    snapshot = await page.locator("body").ariaSnapshot();
  } catch {
    // Fallback if ariaSnapshot not available
    const text = await page.innerText("body").catch(() => "");
    snapshot = text.slice(0, 8000);
  }
  return `Page: ${title}\nURL: ${url}\n\n${snapshot}`;
}

export function registerBrowserTools(
  server: McpServer,
  sessions: SessionManager
): void {
  // --- Navigation ---

  server.tool(
    "browser_navigate",
    "Navigate to a URL in the current session's active page",
    { url: z.string().describe("URL to navigate to") },
    async ({ url }) => {
      try {
        const page = sessions.getActivePage();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const snap = await pageSnapshot(sessions);
        return textResult(snap);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_navigate_back",
    "Navigate back in browser history",
    {},
    async () => {
      try {
        const page = sessions.getActivePage();
        await page.goBack({ waitUntil: "domcontentloaded" });
        const snap = await pageSnapshot(sessions);
        return textResult(snap);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // --- Page Reading ---

  server.tool(
    "browser_snapshot",
    "Get an accessibility snapshot of the current page (how the AI sees the page structure)",
    {},
    async () => {
      try {
        const snap = await pageSnapshot(sessions);
        return textResult(snap);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_take_screenshot",
    "Take a screenshot of the current page",
    {},
    async () => {
      try {
        const page = sessions.getActivePage();
        const buffer = await page.screenshot({ type: "png" });
        const base64 = buffer.toString("base64");
        return {
          content: [
            { type: "image" as const, data: base64, mimeType: "image/png" as const },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_console_messages",
    "Read console messages from the current session",
    {
      clear: z.boolean().optional().describe("Clear messages after reading (default: false)"),
    },
    async ({ clear }) => {
      try {
        const session = sessions.getCurrent();
        const logs = session.consoleLogs.map(
          (l) => `[${l.type}] ${new Date(l.timestamp).toISOString()} ${l.text}`
        );
        if (clear) session.consoleLogs.length = 0;
        return textResult(logs.length > 0 ? logs.join("\n") : "No console messages.");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_network_requests",
    "Read network requests from the current session",
    {
      clear: z.boolean().optional().describe("Clear requests after reading (default: false)"),
    },
    async ({ clear }) => {
      try {
        const session = sessions.getCurrent();
        const reqs = session.networkRequests.map(
          (r) => `${r.method} ${r.url} → ${r.status ?? "pending"}`
        );
        if (clear) session.networkRequests.length = 0;
        return textResult(reqs.length > 0 ? reqs.join("\n") : "No network requests.");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // --- Interaction ---

  server.tool(
    "browser_click",
    "Click an element on the page. Selector formats: CSS (#id, .class), text=..., role=button[name=Submit], data-testid=...",
    { selector: z.string().describe("Element selector") },
    async ({ selector }) => {
      try {
        const page = sessions.getActivePage();
        const locator = resolveLocator(page, selector);
        await locator.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        const snap = await pageSnapshot(sessions);
        return textResult(snap);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_type",
    "Type text using the keyboard (into the currently focused element)",
    { text: z.string().describe("Text to type") },
    async ({ text }) => {
      try {
        const page = sessions.getActivePage();
        await page.keyboard.type(text);
        return textResult(`Typed: "${text}"`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_fill",
    "Fill a form field with a value (clears existing content first)",
    {
      selector: z.string().describe("Element selector"),
      value: z.string().describe("Value to fill"),
    },
    async ({ selector, value }) => {
      try {
        const page = sessions.getActivePage();
        const locator = resolveLocator(page, selector);
        await locator.fill(value);
        return textResult(`Filled "${selector}" with "${value}"`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_press_key",
    "Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown, Control+a)",
    { key: z.string().describe("Key to press") },
    async ({ key }) => {
      try {
        const page = sessions.getActivePage();
        await page.keyboard.press(key);
        return textResult(`Pressed: ${key}`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_hover",
    "Hover over an element",
    { selector: z.string().describe("Element selector") },
    async ({ selector }) => {
      try {
        const page = sessions.getActivePage();
        const locator = resolveLocator(page, selector);
        await locator.hover();
        return textResult(`Hovered over "${selector}"`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_select_option",
    "Select an option from a dropdown/select element",
    {
      selector: z.string().describe("Select element selector"),
      value: z.string().describe("Option value or label to select"),
    },
    async ({ selector, value }) => {
      try {
        const page = sessions.getActivePage();
        const locator = resolveLocator(page, selector);
        await locator.selectOption(value);
        return textResult(`Selected "${value}" in "${selector}"`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_file_upload",
    "Upload files to a file input element",
    {
      selector: z.string().describe("File input selector"),
      paths: z.array(z.string()).describe("Absolute file paths to upload"),
    },
    async ({ selector, paths }) => {
      try {
        const page = sessions.getActivePage();
        const locator = resolveLocator(page, selector);
        await locator.setInputFiles(paths);
        return textResult(`Uploaded ${paths.length} file(s) to "${selector}"`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // --- Scripting ---

  server.tool(
    "browser_evaluate",
    "Execute JavaScript in the page and return the result",
    { script: z.string().describe("JavaScript code to evaluate") },
    async ({ script }) => {
      try {
        const page = sessions.getActivePage();
        const result = await page.evaluate(script);
        return textResult(
          typeof result === "string" ? result : JSON.stringify(result, null, 2)
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.tool(
    "browser_wait_for",
    "Wait for a condition: a selector to appear, a URL pattern, or a load state",
    {
      selector: z.string().optional().describe("CSS selector to wait for"),
      url: z.string().optional().describe("URL string or pattern to wait for"),
      state: z.enum(["load", "domcontentloaded", "networkidle"]).optional().describe("Load state to wait for"),
      timeout: z.number().optional().describe("Timeout in milliseconds (default: 30000)"),
    },
    async ({ selector, url, state, timeout }) => {
      try {
        const page = sessions.getActivePage();
        const opts = { timeout: timeout ?? 30000 };

        if (selector) {
          await page.waitForSelector(selector, opts);
          return textResult(`Selector "${selector}" appeared.`);
        }
        if (url) {
          await page.waitForURL(url, opts);
          return textResult(`URL matched: ${page.url()}`);
        }
        if (state) {
          await page.waitForLoadState(state, opts);
          return textResult(`Load state "${state}" reached.`);
        }
        return textResult("No condition specified. Provide selector, url, or state.");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // --- Tabs ---

  server.tool(
    "browser_tabs",
    "Manage tabs in the current session: list, create, switch, or close",
    {
      action: z.enum(["list", "create", "switch", "close"]).describe("Tab action"),
      tabIndex: z.number().optional().describe("Tab index (for switch/close)"),
      url: z.string().optional().describe("URL to open (for create)"),
    },
    async ({ action, tabIndex, url }) => {
      try {
        const session = sessions.getCurrent();
        const pages = session.context.pages();

        switch (action) {
          case "list": {
            const tabs = await Promise.all(
              pages.map(async (p, i) => ({
                index: i,
                url: p.url(),
                title: await p.title(),
                active: p === session.activePage,
              }))
            );
            return textResult(JSON.stringify(tabs, null, 2));
          }
          case "create": {
            const newPage = await session.context.newPage();
            if (url) await newPage.goto(url, { waitUntil: "domcontentloaded" });
            sessions.setupPageListeners(session, newPage);
            session.activePage = newPage;
            return textResult(
              `Created new tab (index ${pages.length}). ${url ? `Navigated to ${url}` : ""}`
            );
          }
          case "switch": {
            if (tabIndex === undefined || tabIndex < 0 || tabIndex >= pages.length) {
              return errorResult(`Invalid tab index. Available: 0-${pages.length - 1}`);
            }
            session.activePage = pages[tabIndex];
            await pages[tabIndex].bringToFront();
            const snap = await pageSnapshot(sessions);
            return textResult(snap);
          }
          case "close": {
            if (tabIndex === undefined || tabIndex < 0 || tabIndex >= pages.length) {
              return errorResult(`Invalid tab index. Available: 0-${pages.length - 1}`);
            }
            if (pages.length === 1) {
              return errorResult("Cannot close the last tab.");
            }
            const closing = pages[tabIndex];
            await closing.close();
            if (closing === session.activePage) {
              const remaining = session.context.pages();
              session.activePage = remaining[0];
            }
            return textResult(`Closed tab ${tabIndex}.`);
          }
        }
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}
