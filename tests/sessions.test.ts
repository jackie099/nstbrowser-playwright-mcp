import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionManager } from "../src/sessions.js";

// Mock @playwright/mcp
vi.mock("@playwright/mcp", () => ({
  createConnection: vi.fn(),
}));

// Mock InMemoryTransport
vi.mock("@modelcontextprotocol/sdk/inMemory.js", () => ({
  InMemoryTransport: {
    createLinkedPair: vi.fn(),
  },
}));

// Mock Client
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(),
}));

import { createConnection } from "@playwright/mcp";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

function setupMocks() {
  const mockConnection = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    }),
  };
  const mockClientTransport = {};
  const mockServerTransport = {};

  vi.mocked(createConnection).mockResolvedValue(mockConnection as never);
  vi.mocked(InMemoryTransport.createLinkedPair).mockReturnValue([
    mockClientTransport,
    mockServerTransport,
  ] as never);
  vi.mocked(Client).mockImplementation(() => mockClient as never);

  return { mockConnection, mockClient };
}

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SessionManager();
  });

  it("creates a session and sets it as current", async () => {
    setupMocks();
    const session = await manager.createSession(
      "ws://localhost:9222/devtools/browser/abc",
      "profile-1"
    );

    expect(session.id).toBe("session-1");
    expect(session.profileId).toBe("profile-1");
    expect(session.client).toBeDefined();
    expect(manager.getCurrent()).toBe(session);
  });

  it("creates Playwright MCP connection with CDP endpoint", async () => {
    setupMocks();
    const wsUrl = "ws://localhost:9222/devtools/browser/abc";
    await manager.createSession(wsUrl, "profile-1");

    expect(createConnection).toHaveBeenCalledWith({
      browser: { cdpEndpoint: wsUrl },
    });
  });

  it("creates multiple sessions with incrementing IDs", async () => {
    setupMocks();
    const s1 = await manager.createSession("ws://a", "p1");
    const s2 = await manager.createSession("ws://b", "p2");

    expect(s1.id).toBe("session-1");
    expect(s2.id).toBe("session-2");
    expect(manager.getCurrent()).toBe(s2);
  });

  it("throws when no active session", () => {
    expect(() => manager.getCurrent()).toThrow("No active session");
  });

  it("switches between sessions", async () => {
    setupMocks();
    const s1 = await manager.createSession("ws://a", "p1");
    await manager.createSession("ws://b", "p2");

    const switched = manager.switchTo(s1.id);
    expect(switched).toBe(s1);
    expect(manager.getCurrent()).toBe(s1);
  });

  it("throws when switching to non-existent session", () => {
    expect(() => manager.switchTo("session-999")).toThrow("not found");
  });

  it("closes a session and updates current", async () => {
    const { mockClient, mockConnection } = setupMocks();
    const s1 = await manager.createSession("ws://a", "p1");
    const s2 = await manager.createSession("ws://b", "p2");

    await manager.closeSession(s2.id);

    expect(mockClient.close).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
    expect(manager.getCurrent()).toBe(s1);
  });

  it("closes last session and clears current", async () => {
    setupMocks();
    const session = await manager.createSession("ws://a", "p1");

    await manager.closeSession(session.id);

    expect(() => manager.getCurrent()).toThrow("No active session");
  });

  it("handles close errors gracefully", async () => {
    const { mockClient } = setupMocks();
    mockClient.close.mockRejectedValueOnce(new Error("already closed"));

    const session = await manager.createSession("ws://a", "p1");
    // Should not throw
    await manager.closeSession(session.id);
  });

  it("throws when closing non-existent session", async () => {
    await expect(manager.closeSession("session-999")).rejects.toThrow(
      "not found"
    );
  });

  it("lists all sessions", async () => {
    setupMocks();
    await manager.createSession("ws://a", "p1");
    await manager.createSession("ws://b", "p2");

    const list = manager.listAll();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: "session-1",
      profileId: "p1",
      isCurrent: false,
    });
    expect(list[1]).toEqual({
      id: "session-2",
      profileId: "p2",
      isCurrent: true,
    });
  });

  it("tracks browser tools registration flag", async () => {
    setupMocks();
    expect(manager.browserToolsRegistered).toBe(false);

    manager.markBrowserToolsRegistered();
    expect(manager.browserToolsRegistered).toBe(true);
  });

  it("tracks session count", async () => {
    setupMocks();
    expect(manager.sessionCount).toBe(0);

    await manager.createSession("ws://a", "p1");
    expect(manager.sessionCount).toBe(1);

    await manager.createSession("ws://b", "p2");
    expect(manager.sessionCount).toBe(2);
  });

  it("cleans up connection on createSession failure", async () => {
    const { mockConnection } = setupMocks();
    // Make client.connect fail
    vi.mocked(Client).mockImplementationOnce(
      () =>
        ({
          connect: vi.fn().mockRejectedValue(new Error("connect failed")),
          close: vi.fn(),
        }) as never
    );

    await expect(
      manager.createSession("ws://a", "p1")
    ).rejects.toThrow("connect failed");

    expect(mockConnection.close).toHaveBeenCalled();
    expect(manager.sessionCount).toBe(0);
  });
});
