// Multi-tenant isolation (IDOR) tests.
//
// These tests verify that e2e-isolated@test.com (member of "E2E Isolated Org")
// CANNOT read or mutate resources that belong to the Demo Org admin.
//
// Pattern: beforeAll creates Demo Org resources as admin (separate browser context),
// then each test runs as the isolated user and expects 404 on those resource IDs.
// 404 is used instead of 403 so callers can't confirm a resource exists in another org.
import { test, expect, Browser } from "@playwright/test";

const ADMIN_AUTH = "tests/.auth/admin.json";

let demoCaseId: string;
let demoItemId: string;
let demoProjectId: string;
let demoPlanId: string;
let demoExecutionId: string;

// beforeAll uses a fresh admin context (not the isolated-user page fixture) so that
// the resources created here belong to Demo Org, not E2E Isolated Org.
test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ storageState: ADMIN_AUTH });
  const req = ctx.request;

  // Create one of each resource type in Demo Org so we can test cross-org access below.
  const proj = await req.post("/api/projects", {
    data: { name: "Isolation Target Project" },
  });
  demoProjectId = (await proj.json()).project.id;

  const item = await req.post("/api/items", {
    data: { title: "Isolation Target Item", projectId: demoProjectId },
  });
  demoItemId = (await item.json()).item.id;

  const tc = await req.post("/api/cases", {
    data: { title: "Isolation Target Case", projectId: demoProjectId },
  });
  demoCaseId = (await tc.json()).tc.id;

  const plan = await req.post("/api/test-plans", {
    data: {
      name: "Isolation Target Plan",
      projectId: demoProjectId,
      caseIds: [demoCaseId],
    },
  });
  demoPlanId = (await plan.json()).plan.id;

  const planDetail = await req.get(`/api/test-plans/${demoPlanId}`);
  const planBody = await planDetail.json();
  demoExecutionId = (planBody.plan ?? planBody).executions?.[0]?.id ?? "";

  await ctx.close();
});

test.describe("IDOR — Cross-org case access blocked", () => {
  test("GET /api/cases/[demo-case-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.get(`/api/cases/${demoCaseId}`);
    expect(res.status()).toBe(404);
  });

  test("PATCH /api/cases/[demo-case-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.patch(`/api/cases/${demoCaseId}`, {
      data: { title: "Hijacked Case Title" },
    });
    expect(res.status()).toBe(404);
  });

  test("DELETE /api/cases/[demo-case-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.delete(`/api/cases/${demoCaseId}`);
    expect(res.status()).toBe(404);
  });
});

test.describe("IDOR — Cross-org item access blocked", () => {
  test("GET /api/items/[demo-item-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.get(`/api/items/${demoItemId}`);
    expect(res.status()).toBe(404);
  });

  test("PATCH /api/items/[demo-item-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.patch(`/api/items/${demoItemId}`, {
      data: { title: "Hijacked Item Title" },
    });
    expect(res.status()).toBe(404);
  });

  test("DELETE /api/items/[demo-item-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.delete(`/api/items/${demoItemId}`);
    expect(res.status()).toBe(404);
  });
});

test.describe("IDOR — Cross-org execution access blocked", () => {
  test("PATCH /api/executions/[demo-execution-id] returns 404 for isolated user", async ({
    page,
  }) => {
    if (!demoExecutionId) test.skip();
    const res = await page.request.patch(`/api/executions/${demoExecutionId}`, {
      data: { status: "PASS" },
    });
    expect(res.status()).toBe(404);
  });

  test("DELETE /api/executions/[demo-execution-id] returns 404 for isolated user", async ({
    page,
  }) => {
    if (!demoExecutionId) test.skip();
    const res = await page.request.delete(`/api/executions/${demoExecutionId}`);
    expect(res.status()).toBe(404);
  });
});

test.describe("IDOR — Cross-org test plan access blocked", () => {
  test("GET /api/test-plans/[demo-plan-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.get(`/api/test-plans/${demoPlanId}`);
    expect(res.status()).toBe(404);
  });

  test("PATCH /api/test-plans/[demo-plan-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.patch(`/api/test-plans/${demoPlanId}`, {
      data: { name: "Hijacked Plan" },
    });
    expect(res.status()).toBe(404);
  });

  test("DELETE /api/test-plans/[demo-plan-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.delete(`/api/test-plans/${demoPlanId}`);
    expect(res.status()).toBe(404);
  });
});

test.describe("IDOR — Cross-org project access blocked", () => {
  test("GET /api/projects/[demo-project-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.get(`/api/projects/${demoProjectId}`);
    expect(res.status()).toBe(404);
  });

  test("PATCH /api/projects/[demo-project-id] returns 404 for isolated user", async ({ page }) => {
    const res = await page.request.patch(`/api/projects/${demoProjectId}`, {
      data: { name: "Hijacked Project Name" },
    });
    expect(res.status()).toBe(404);
  });

  test("DELETE /api/projects/[demo-project-id] returns 404 for isolated user", async ({
    page,
  }) => {
    const res = await page.request.delete(`/api/projects/${demoProjectId}`);
    expect(res.status()).toBe(404);
  });
});

test.describe("Data leakage — org-scoped list endpoints", () => {
  test("GET /api/orgs/members does NOT return Demo Org members", async ({ page }) => {
    const res = await page.request.get("/api/orgs/members");
    expect(res.status()).toBe(200);
    const { members } = await res.json();
    const leaks = members.some(
      (m: { user: { email: string } }) => m.user.email === "admin@testflow.com"
    );
    expect(leaks).toBe(false);
  });

  test("GET /api/projects does NOT return Demo Org projects", async ({ page }) => {
    const res = await page.request.get("/api/projects");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const projects = body.projects ?? body;
    const leaks = projects.some((p: { id: string }) => p.id === demoProjectId);
    expect(leaks).toBe(false);
  });

  test("GET /api/cases does NOT return Demo Org cases", async ({ page }) => {
    const res = await page.request.get("/api/cases");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const cases = body.cases ?? body.items ?? body;
    if (Array.isArray(cases)) {
      const leaks = cases.some((c: { id: string }) => c.id === demoCaseId);
      expect(leaks).toBe(false);
    }
  });

  test("GET /api/items does NOT return Demo Org items", async ({ page }) => {
    const res = await page.request.get("/api/items");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = body.items ?? body;
    if (Array.isArray(items)) {
      const leaks = items.some((i: { id: string }) => i.id === demoItemId);
      expect(leaks).toBe(false);
    }
  });
});

test.describe("IDOR — Cross-org report creation blocked", () => {
  test("POST /api/reports with foreign testPlanId returns 404", async ({ page }) => {
    // demoPlanId belongs to Demo Org; isolated user should not be able to create a report from it
    const res = await page.request.post("/api/reports", {
      data: { testPlanId: demoPlanId, title: "Hijacked Report" },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("Isolated org — own resources accessible", () => {
  test("isolated user can create a project in their own org", async ({ page }) => {
    const res = await page.request.post("/api/projects", {
      data: { name: "Isolated Org Own Project" },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).project).toHaveProperty("id");
  });

  test("isolated user can list their own members", async ({ page }) => {
    const res = await page.request.get("/api/orgs/members");
    expect(res.status()).toBe(200);
    const { members } = await res.json();
    const self = members.find(
      (m: { user: { email: string } }) => m.user.email === "e2e-isolated@test.com"
    );
    expect(self).toBeDefined();
  });
});
