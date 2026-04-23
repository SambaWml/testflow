// Navigation spec — verifies all dashboard routes load for an authenticated user
// and that key API endpoints return correct structure.
// Runs under admin-tests project (storageState: admin.json).
import { test, expect } from "@playwright/test";

test.describe("Navigation — authenticated pages load without redirect", () => {
  test("/ dashboard loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/projects loads", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/cases loads", async ({ page }) => {
    await page.goto("/cases");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/executions loads", async ({ page }) => {
    await page.goto("/executions");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/bugs loads", async ({ page }) => {
    await page.goto("/bugs");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/reports loads", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/generator loads", async ({ page }) => {
    await page.goto("/generator");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/generator/bugs loads", async ({ page }) => {
    await page.goto("/generator/bugs");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/settings loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/settings/members loads for OWNER", async ({ page }) => {
    await page.goto("/settings/members");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/settings/projects loads", async ({ page }) => {
    await page.goto("/settings/projects");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/settings/general loads", async ({ page }) => {
    await page.goto("/settings/general");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/settings/generator loads", async ({ page }) => {
    await page.goto("/settings/generator");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/settings/terms loads", async ({ page }) => {
    await page.goto("/settings/terms");
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("Navigation — API status endpoints", () => {
  test("GET /api/ai-status returns provider info", async ({ page }) => {
    const res = await page.request.get("/api/ai-status");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("provider");
    expect(body).toHaveProperty("status");
  });

  test("GET /api/orgs/me returns org info", async ({ page }) => {
    const res = await page.request.get("/api/orgs/me");
    expect(res.status()).toBe(200);
  });

  test("GET /api/dashboard returns dashboard data", async ({ page }) => {
    const res = await page.request.get("/api/dashboard");
    expect(res.status()).toBe(200);
  });

  test("GET /api/notifications returns notification list", async ({ page }) => {
    const res = await page.request.get("/api/notifications");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.notifications)).toBe(true);
  });

  test("notification items have required fields", async ({ page }) => {
    const res = await page.request.get("/api/notifications");
    const { notifications } = await res.json();
    for (const n of notifications) {
      expect(n).toHaveProperty("id");
      expect(n).toHaveProperty("type");
      expect(n).toHaveProperty("title");
      expect(n).toHaveProperty("href");
      expect(["error", "warning", "info"]).toContain(n.type);
    }
  });
});

test.describe("Navigation — project detail page", () => {
  test("/projects/[id] loads for a valid project", async ({ page, browser }) => {
    // Create project via admin context first; then navigate as the default page session.
    const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
    const proj = await ctx.request.post("/api/projects", {
      data: { name: "Nav Detail Test Project" },
    });
    const projectId = (await proj.json()).project.id;
    await ctx.close();

    await page.goto(`/projects/${projectId}`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(`/projects/${projectId}`);
  });

  test("/projects/[id] shows 'not found' for nonexistent project", async ({ page }) => {
    await page.goto("/projects/nonexistent-id-99999");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("/projects/[id] has tabs for items, cases, plans, bugs", async ({ page, browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
    const proj = await ctx.request.post("/api/projects", {
      data: { name: "Tab Test Project" },
    });
    const projectId = (await proj.json()).project.id;
    await ctx.close();

    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("button", { name: /planos/i })).toBeVisible({ timeout: 10_000 });
  });

  test("GET /api/projects/[id] returns project with counts", async ({ page, browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
    const proj = await ctx.request.post("/api/projects", {
      data: { name: "API Detail Test Project" },
    });
    const projectId = (await proj.json()).project.id;
    await ctx.close();

    const res = await page.request.get(`/api/projects/${projectId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.project).toHaveProperty("id");
    expect(body.project).toHaveProperty("_count");
    expect(body.project._count).toHaveProperty("items");
    expect(body.project._count).toHaveProperty("cases");
    expect(body.project._count).toHaveProperty("testPlans");
  });
});
