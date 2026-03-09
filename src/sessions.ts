import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createConnection } from "@playwright/mcp";

export interface Session {
  id: string;
  profileId: string;
  client: Client;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private currentSessionId: string | null = null;
  private nextId = 1;
  private closeHandlers = new Map<string, () => Promise<void>>();
  private _browserToolsRegistered = false;

  get browserToolsRegistered(): boolean {
    return this._browserToolsRegistered;
  }

  markBrowserToolsRegistered(): void {
    this._browserToolsRegistered = true;
  }

  async createSession(
    cdpEndpoint: string,
    profileId: string
  ): Promise<Session> {
    const id = `session-${this.nextId++}`;

    let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
    try {
      connection = await createConnection({
        browser: { cdpEndpoint },
      });

      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await connection.connect(serverTransport);

      const client = new Client({
        name: "nstbrowser-internal",
        version: "1.0.0",
      });
      await client.connect(clientTransport);

      const session: Session = { id, profileId, client };
      this.sessions.set(id, session);
      this.closeHandlers.set(id, async () => {
        await client.close();
        await connection!.close();
      });
      this.currentSessionId = id;
      return session;
    } catch (err) {
      await connection?.close().catch(() => {});
      throw err;
    }
  }

  getCurrent(): Session {
    if (!this.currentSessionId) {
      throw new Error("No active session. Call create_session first.");
    }
    const session = this.sessions.get(this.currentSessionId);
    if (!session) throw new Error("Current session not found.");
    return session;
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
    if (!session) throw new Error(`Session ${id} not found.`);

    // Delete synchronously first to prevent concurrent double-close
    this.sessions.delete(id);
    const closeHandler = this.closeHandlers.get(id);
    this.closeHandlers.delete(id);
    if (this.currentSessionId === id) {
      const remaining = this.sessions.keys().next();
      this.currentSessionId = remaining.done ? null : remaining.value;
    }

    if (closeHandler) {
      await closeHandler().catch((err) => {
        console.error(`Warning: error closing session ${id}:`, err);
      });
    }
  }

  listAll(): Array<{ id: string; profileId: string; isCurrent: boolean }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      profileId: s.profileId,
      isCurrent: s.id === this.currentSessionId,
    }));
  }

  get sessionCount(): number {
    return this.sessions.size;
  }
}
