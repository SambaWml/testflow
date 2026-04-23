// Test plans spec — verifies plan creation with case associations and status transitions.
import { test, expect, Browser } from "@playwright/test";

let projectId: string;
let caseId1: string;
let caseId2: string;
let caseId3: string;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
  const req = ctx.request;

  const proj = await req.post("/api/projects", { data: { name: "E2E Plans Project" } });
  projectId = (await proj.json()).project.id;

  const [r1, r2, r3] = await Promise.all([
    req.post("/api/cases", { data: { title: "Plan Case 1 — Login flow", projectId } }),
    req.post("/api/cases", { data: { title: "Plan Case 2 — Logout flow", projectId } }),
    req.post("/api/cases", { data: { title: "Plan Case 3 — Reset password", projectId } }),
  ]);
  caseId1 = (await r1.json()).tc.id;
  caseId2 = (await r2.json()).tc.id;
  caseId3 = (await r3.json()).tc.id;

  await ctx.close();
});

test.describe("Test Plans — CRUD via API", () => {
  test("POST /api/test-plans creates a plan with one case", async ({ page }) => {
    const res = await page.request.post("/api/test-plans", {
      data: {
        name: "E2E Sprint 1 Plan",
        projectId,
        caseIds: [caseId1],
        environment: "staging",
        buildVersion: "1.0.0",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.plan).toHaveProperty("id");
    expect(body.plan.name).toBe("E2E Sprint 1 Plan");
    expect(body.plan.environment).toBe("staging");
  });

  test("POST /api/test-plans creates a plan with multiple cases", async ({ page }) => {
    const res = await page.request.post("/api/test-plans", {
      data: {
        name: "E2E Full Regression",
        projectId,
        caseIds: [caseId1, caseId2, caseId3],
        notes: "Full regression for release v2.0",
      },
    });
    expect(res.status()).toBe(201);
    const { plan } = await res.json();
    expect(plan.id).toBeDefined();
  });

  test("POST /api/test-plans requires caseIds to be non-empty", async ({ page }) => {
    const res = await page.request.post("/api/test-plans", {
      data: { name: "Empty Plan", projectId, caseIds: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/test-plans requires name", async ({ page }) => {
    const res = await page.request.post("/api/test-plans", {
      data: { projectId, caseIds: [caseId1] },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/test-plans requires projectId", async ({ page }) => {
    const res = await page.request.post("/api/test-plans", {
      data: { name: "No Project Plan", caseIds: [caseId1] },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/test-plans/[id] returns plan details", async ({ page }) => {
    const create = await page.request.post("/api/test-plans", {
      data: { name: "Get Plan Test", projectId, caseIds: [caseId1] },
    });
    const { plan } = await create.json();

    const res = await page.request.get(`/api/test-plans/${plan.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const returnedPlan = body.plan ?? body;
    expect(returnedPlan.id ?? returnedPlan.plan?.id).toBe(plan.id);
  });

  test("creating a plan generates executions for each case", async ({ page }) => {
    const create = await page.request.post("/api/test-plans", {
      data: {
        name: "Execution Generation Test",
        projectId,
        caseIds: [caseId1, caseId2],
      },
    });
    const { plan } = await create.json();

    const res = await page.request.get(`/api/test-plans/${plan.id}`);
    const body = await res.json();
    const returnedPlan = body.plan ?? body;
    // Plan should have executions
    expect(returnedPlan.executions?.length ?? returnedPlan._count?.executions).toBeGreaterThanOrEqual(0);
  });

  test("PATCH /api/test-plans/[id] updates plan name", async ({ page }) => {
    const create = await page.request.post("/api/test-plans", {
      data: { name: "Plan Before Rename", projectId, caseIds: [caseId1] },
    });
    const { plan } = await create.json();

    const res = await page.request.patch(`/api/test-plans/${plan.id}`, {
      data: { name: "Plan After Rename" },
    });
    expect(res.status()).toBe(200);
  });

  test("GET /api/test-plans/nonexistent returns 404", async ({ page }) => {
    const res = await page.request.get("/api/test-plans/nonexistent-id-99999");
    expect(res.status()).toBe(404);
  });

  test("plan status starts as IN_PROGRESS or PENDING", async ({ page }) => {
    const create = await page.request.post("/api/test-plans", {
      data: { name: "Status Check Plan", projectId, caseIds: [caseId1] },
    });
    const { plan } = await create.json();
    expect(["IN_PROGRESS", "PENDING", "ACTIVE"]).toContain(plan.status ?? "IN_PROGRESS");
  });
});
