import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set GH_TOKEN before importing
process.env.GH_TOKEN = "test-token";

describe("GET /api/github/repos", () => {
  let githubRouter;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    // Re-import to get fresh cache
    const mod = await import("../server/routes/github.js");
    githubRouter = mod.githubRouter;
  });

  function makeReq(query = {}) {
    return { query };
  }

  function makeRes() {
    const res = {
      _status: 200,
      _body: null,
      status(code) { res._status = code; return res; },
      json(data) { res._body = data; return res; },
    };
    return res;
  }

  it("returns repos for empty query (recently updated)", async () => {
    const fakeRepos = [
      { full_name: "dante-alpha-assistant/foo", name: "foo", description: "Foo repo", language: "JavaScript", updated_at: "2026-03-10T00:00:00Z", default_branch: "main", extra_field: true },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeRepos,
    });

    const handler = githubRouter.stack.find(l => l.route?.path === "/repos").route.stack[0].handle;
    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toHaveLength(1);
    expect(res._body[0].full_name).toBe("dante-alpha-assistant/foo");
    // Should not include extra fields
    expect(res._body[0].extra_field).toBeUndefined();
    // Should have called the users/repos endpoint
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/users/dante-alpha-assistant/repos"),
      expect.any(Object)
    );
  });

  it("returns search results when q is provided", async () => {
    const fakeSearch = {
      items: [
        { full_name: "dante-alpha-assistant/queue-dashboard", name: "queue-dashboard", description: null, language: "TypeScript", updated_at: "2026-03-11T00:00:00Z", default_branch: "main" },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeSearch,
    });

    const handler = githubRouter.stack.find(l => l.route?.path === "/repos").route.stack[0].handle;
    const req = makeReq({ q: "queue" });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toHaveLength(1);
    expect(res._body[0].name).toBe("queue-dashboard");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("search/repositories"),
      expect.any(Object)
    );
  });

  it("returns 500 when GH_TOKEN is missing", async () => {
    const origToken = process.env.GH_TOKEN;
    delete process.env.GH_TOKEN;

    // Re-import with missing token
    vi.resetModules();
    const mod = await import("../server/routes/github.js");
    const handler = mod.githubRouter.stack.find(l => l.route?.path === "/repos").route.stack[0].handle;

    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._body.error).toContain("GH_TOKEN");

    process.env.GH_TOKEN = origToken;
  });

  it("forwards GitHub API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "rate limit exceeded",
    });

    const handler = githubRouter.stack.find(l => l.route?.path === "/repos").route.stack[0].handle;
    const req = makeReq({ q: "test" });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toBe(403);
    expect(res._body.error).toContain("403");
  });
});
