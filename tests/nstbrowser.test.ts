import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

process.env.NSTBROWSER_API_KEY = "test-api-key";

const { connectToProfile, connectOnce, getProfiles, getBrowsers } =
  await import("../src/nstbrowser.js");

describe("NSTBrowser API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockResponse(data: unknown, ok = true, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok,
      status,
      statusText: ok ? "OK" : "Internal Server Error",
      json: async () => data,
      text: async () => JSON.stringify(data),
    });
  }

  describe("connectToProfile", () => {
    it("returns CDP connection data on success", async () => {
      const cdpData = {
        port: 9222,
        webSocketDebuggerUrl: "ws://localhost:9222/devtools/browser/abc",
        profileId: "prof-1",
      };
      mockResponse({ data: cdpData, err: false, msg: "ok", code: 0 });

      const result = await connectToProfile("prof-1");
      expect(result).toEqual(cdpData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/connect/prof-1"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ "x-api-key": "test-api-key" }),
        })
      );
    });

    it("throws on API error response", async () => {
      mockResponse({
        data: null,
        err: true,
        msg: "Profile not found",
        code: 404,
      });
      await expect(connectToProfile("bad-id")).rejects.toThrow(
        "NSTBrowser: Profile not found"
      );
    });

    it("throws when API returns success but no data", async () => {
      mockResponse({ data: null, err: false, msg: "ok", code: 0 });
      await expect(connectToProfile("prof-1")).rejects.toThrow(
        "no connection data"
      );
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        text: async () => "<html>Bad Gateway</html>",
      });
      await expect(connectToProfile("prof-1")).rejects.toThrow("HTTP 502");
    });
  });

  describe("connectOnce", () => {
    it("returns CDP connection data on success", async () => {
      const cdpData = {
        port: 9222,
        webSocketDebuggerUrl: "ws://localhost:9222/devtools/browser/xyz",
        profileId: "temp-1",
      };
      mockResponse({ data: cdpData, err: false, msg: "ok", code: 0 });

      const result = await connectOnce({ name: "test", kernel: "chromium" });
      expect(result).toEqual(cdpData);
    });

    it("throws when API returns success but no data", async () => {
      mockResponse({ data: null, err: false, msg: "ok", code: 0 });
      await expect(connectOnce({ name: "test" })).rejects.toThrow(
        "no connection data"
      );
    });
  });

  describe("getProfiles", () => {
    it("returns profile list", async () => {
      const profileData = {
        list: [{ id: "p1", name: "Profile 1" }],
        total: 1,
      };
      mockResponse({ data: profileData, err: false, msg: "ok", code: 0 });

      const result = await getProfiles({ page: "1", pageSize: "10" });
      expect(result.data).toEqual(profileData);
      expect(result.err).toBe(false);
    });

    it("passes query parameters correctly", async () => {
      mockResponse({ data: [], err: false, msg: "ok", code: 0 });
      await getProfiles({ page: "2", pageSize: "5", s: "test" });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("page=2");
      expect(calledUrl).toContain("pageSize=5");
      expect(calledUrl).toContain("s=test");
    });

    it("omits undefined params from URL", async () => {
      mockResponse({ data: [], err: false, msg: "ok", code: 0 });
      await getProfiles({ page: "1", pageSize: undefined });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("page=1");
      expect(calledUrl).not.toContain("pageSize");
    });
  });

  describe("getBrowsers", () => {
    it("returns browser list", async () => {
      const browserData = [{ id: "b1", status: "running" }];
      mockResponse({ data: browserData, err: false, msg: "ok", code: 0 });

      const result = await getBrowsers("running");
      expect(result.data).toEqual(browserData);
    });

    it("works without status filter", async () => {
      mockResponse({ data: [], err: false, msg: "ok", code: 0 });
      const result = await getBrowsers();
      expect(result.err).toBe(false);
    });
  });
});
