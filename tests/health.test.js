import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockFrom = vi.fn();
vi.mock("../server/supabase.js", () => ({
  default: { from: (...args) => mockFrom(...args) },
}));

// Build a chainable query mock
function chainMock(data = [], error = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve) => resolve({ data, error }),
  };
  // Make it thenable for await
  Object.defineProperty(chain, "then", {
    value: (resolve) => resolve({ data, error }),
    writable: true,
  });
  return chain;
}

describe("GET /api/health", () => {
  let healthRouter;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../server/routes/health.js");
    healthRouter = mod.healthRouter;
  });

  it("exports a router", () => {
    expect(healthRouter).toBeDefined();
    expect(typeof healthRouter).toBe("function");
  });

  it("has a GET / route", () => {
    const routes = healthRouter.stack.filter(
      (layer) => layer.route && layer.route.path === "/"
    );
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].route.methods.get).toBe(true);
  });

  it("returns health data shape", async () => {
    // Mock all three parallel queries
    const taskChain = chainMock([]);
    const agentChain = chainMock([
      { id: "neo-worker", name: "Neo", status: "online", capabilities: ["coding"], current_load: 0, max_capacity: 3, last_heartbeat: new Date().toISOString(), metadata: {} },
    ]);
    const failedChain = chainMock([]);

    let callCount = 0;
    mockFrom.mockImplementation((table) => {
      if (table === "agent_cards") return agentChain;
      return callCount++ === 0 ? taskChain : failedChain;
    });

    // Simulate express req/res
    const req = {};
    const resData = {};
    const res = {
      json: (d) => { resData.body = d; },
      status: (s) => ({ json: (d) => { resData.status = s; resData.body = d; } }),
    };

    // Get the route handler
    const route = healthRouter.stack.find(l => l.route?.path === "/");
    const handler = route.route.stack[0].handle;
    await handler(req, res);

    expect(resData.body).toBeDefined();
    expect(resData.body.health_score).toBeGreaterThanOrEqual(0);
    expect(resData.body.health_score).toBeLessThanOrEqual(100);
    expect(resData.body.health_level).toMatch(/^(green|yellow|red)$/);
    expect(resData.body.stuck_tasks).toEqual([]);
    expect(resData.body.agent_health).toHaveLength(1);
    expect(resData.body.summary).toBeDefined();
    expect(resData.body.merge_queue).toBeDefined();
  });
});
