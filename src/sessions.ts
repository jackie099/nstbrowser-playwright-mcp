import type { Browser, BrowserContext, Page, Locator } from "playwright-core";

export interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: number;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status?: number;
  timestamp: number;
}

export interface Session {
  id: string;
  profileId: string;
  browser: Browser;
  context: BrowserContext;
  activePage: Page;
  consoleLogs: ConsoleEntry[];
  networkRequests: NetworkEntry[];
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private currentSessionId: string | null = null;
  private nextId = 1;

  async createSession(
    browser: Browser,
    profileId: string
  ): Promise<Session> {
    const id = `session-${this.nextId++}`;
    const context =
      browser.contexts().length > 0
        ? browser.contexts()[0]
        : await browser.newContext();
    const pages = context.pages();
    const activePage =
      pages.length > 0 ? pages[0] : await context.newPage();

    const session: Session = {
      id,
      profileId,
      browser,
      context,
      activePage,
      consoleLogs: [],
      networkRequests: [],
    };

    this.setupPageListeners(session, activePage);

    context.on("page", (page) => {
      this.setupPageListeners(session, page);
    });

    this.sessions.set(id, session);
    this.currentSessionId = id;
    return session;
  }

  setupPageListeners(session: Session, page: Page): void {
    page.on("console", (msg) => {
      session.consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    });
    page.on("requestfinished", async (req) => {
      try {
        const response = await req.response();
        session.networkRequests.push({
          method: req.method(),
          url: req.url(),
          status: response?.status(),
          timestamp: Date.now(),
        });
      } catch {
        // Request may have been aborted
      }
    });
  }

  getCurrent(): Session {
    if (!this.currentSessionId) {
      throw new Error("No active session. Call create_session first.");
    }
    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      throw new Error("Current session not found.");
    }
    return session;
  }

  getActivePage(): Page {
    return this.getCurrent().activePage;
  }

  switchTo(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(
        `Session ${id} not found. Use list_sessions to see available sessions.`
      );
    }
    this.currentSessionId = id;
    return session;
  }

  async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found.`);
    }
    await session.browser.close().catch(() => {});
    this.sessions.delete(id);
    if (this.currentSessionId === id) {
      const remaining = this.sessions.keys().next();
      this.currentSessionId = remaining.done ? null : remaining.value;
    }
  }

  listAll(): Array<{
    id: string;
    profileId: string;
    url: string;
    isCurrent: boolean;
  }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      profileId: s.profileId,
      url: s.activePage.url(),
      isCurrent: s.id === this.currentSessionId,
    }));
  }
}

export function resolveLocator(page: Page, selector: string): Locator {
  if (selector.startsWith("text=")) {
    return page.getByText(selector.slice(5));
  }
  if (selector.startsWith("role=")) {
    const match = selector.match(
      /^role=(\w+)(?:\[name=["']?(.+?)["']?\])?$/
    );
    if (match) {
      const [, role, name] = match;
      return page.getByRole(role as any, name ? { name } : undefined);
    }
  }
  if (selector.startsWith("data-testid=")) {
    return page.getByTestId(selector.slice(12));
  }
  return page.locator(selector);
}
