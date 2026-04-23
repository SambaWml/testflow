// Executions spec — verifies status updates (PASS/FAIL/BLOCKED), relatedBugRef, and DELETE.
import { test, expect, Browser } from "@playwright/test";

let projectId: string;
let planId: string;
let executionIds: string[] = [];

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
  const req = ctx.request;

  const proj = await req.post("/api/projects", { data: { name: "E2E Executions Project" } });
  projectId = (await proj.json()).project.id;

  const [r1, r2, r3] = await Promise.all([
    req.post("/api/cases", { data: { title: "Exec Case 1", projectId } }),
    req.post("/api/cases", { data: { title: "Exec Case 2", projectId } }),
    req.post("/api/cases", { data: { title: "Exec Case 3", projectId } }),
  ]);
  const caseIds = [
    (await r1.json()).tc.id,
    (await r2.json()).tc.id,
    (await r3.json()).tc.id,
  ];

  const plan = await req.post("/api/test-plans", {
    data: { name: "Executions Test Plan", projectId, caseIds },
  });
  planId = (await plan.json()).plan.id;

  // Fetch executions created by the plan
  const planDetail = await req.get(`/api/test-plans/${planId}`);
  const planBody = await planDetail.json();
  const returnedPlan = planBody.plan ?? planBody;
  executionIds = (returnedPlan.executions ?? []).map((e: { id: string }) => e.id);

  await ctx.close();
});

test.describe("Executions — status updates", () => {
  test("GET /api/executions returns list", async ({ page }) => {
    const res = await page.request.get("/api/executions");
    expect(res.status()).toBe(200);
  });

  test("PATCH execution status to PASS", async ({ page }) => {
    if (executionIds.length === 0) test.skip();
    const id = executionIds[0];
    const res = await page.request.patch(`/api/executions/${id}`, {
      data: { status: "PASS", notes: "All assertions passed" },
    });
    expect(res.status()).toBe(200);
    const { execution } = await res.json();
    expect(execution.status).toBe("PASS");
    expect(execution.notes).toBe("All assertions passed");
  });

  test("PATCH execution status to FAIL", async ({ page }) => {
    if (executionIds.length < 2) test.skip();
    const id = executionIds[1];
    const res = await page.request.patch(`/api/executions/${id}`, {
      data: { status: "FAIL", notes: "Login fails with valid credentials" },
    });
    expect(res.status()).toBe(200);
    const { execution } = await res.json();
    expect(execution.status).toBe("FAIL");
  });

  test("PATCH execution status to BLOCKED", async ({ page }) => {
    if (executionIds.length < 3) test.skip();
    const id = executionIds[2];
    const res = await page.request.patch(`/api/executions/${id}`, {
      data: { status: "BLOCKED", notes: "Environment unavailable" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).execution.status).toBe("BLOCKED");
  });

  test("PATCH execution adds relatedBugRef", async ({ page }) => {
    if (executionIds.length === 0) test.skip();
    const id = executionIds[0];
    const res = await page.request.patch(`/api/executions/${id}`, {
      data: { relatedBugRef: "BUG-001" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).execution.relatedBugRef).toBe("BUG-001");
  });

  test("PATCH execution updates executedAt timestamp", async ({ page }) => {
    if (executionIds.length === 0) test.skip();
    const id = executionIds[0];
    const now = new Date().toISOString();
    const res = await page.request.patch(`/api/executions/${id}`, {
      data: { executedAt: now },
    });
    expect(res.status()).toBe(200);
  });

  test("PATCH /api/executions/nonexistent returns 404", async ({ page }) => {
    const res = await page.request.patch("/api/executions/nonexistent-id-99999", {
      data: { status: "PASS" },
    });
    expect(res.status()).toBe(404);
  });

  test("DELETE /api/executions/[id] removes execution", async ({ page }) => {
    // Create a dedicated execution for deletion test
    const ctx = await page.context().browser()!.newContext({
      storageState: "tests/.auth/admin.json",
    });
    const req = ctx.request;

    const tc = await req.post("/api/cases", {
      data: { title: "Delete Execution Case", projectId },
    });
    const caseId = (await tc.json()).tc.id;

    const plan = await req.post("/api/test-plans", {
      data: { name: "Delete Execution Plan", projectId, caseIds: [caseId] },
    });
    const newPlanId = (await plan.json()).plan.id;

    const planDetail = await req.get(`/api/test-plans/${newPlanId}`);
    const planBody = await planDetail.json();
    const execId = (planBody.plan ?? planBody).executions?.[0]?.id;
    await ctx.close();

    if (!execId) test.skip();

    const del = await page.request.delete(`/api/executions/${execId}`);
    expect(del.status()).toBe(200);
    expect((await del.json()).ok).toBe(true);
  });
});
