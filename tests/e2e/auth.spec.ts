// Auth spec — verifies unauthenticated users are redirected and APIs return 401.
// storageState is overridden to empty so these tests run without any session cookie,
// regardless of what the parent project configured.
import { test, expect } from "@playwright/test";

// Override project-level storageState — these tests require a clean, unauthenticated browser.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication — unauthenticated redirects", () => {
  test("GET / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("GET /cases redirects to /login", async ({ page }) => {
    await page.goto("/cases");
    await expect(page).toHaveURL(/\/login/);
  });

  test("GET /projects redirects to /login", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("GET /executions redirects to /login", async ({ page }) => {
    await page.goto("/executions");
    await expect(page).toHaveURL(/\/login/);
  });

  test("GET /bugs redirects to /login", async ({ page }) => {
    await page.goto("/bugs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("GET /settings/members redirects to /login", async ({ page }) => {
    await page.goto("/settings/members");
    await expect(page).toHaveURL(/\/login/);
  });

  test("GET /admin redirects to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authentication — API endpoints return 401", () => {
  test("GET /api/cases → 401", async ({ request }) => {
    expect((await request.get("/api/cases")).status()).toBe(401);
  });

  test("GET /api/projects → 401", async ({ request }) => {
    expect((await request.get("/api/projects")).status()).toBe(401);
  });

  test("GET /api/bugs → 401", async ({ request }) => {
    expect((await request.get("/api/bugs")).status()).toBe(401);
  });

  test("GET /api/orgs/members → 401", async ({ request }) => {
    expect((await request.get("/api/orgs/members")).status()).toBe(401);
  });

  test("GET /api/ai-status → 401", async ({ request }) => {
    expect((await request.get("/api/ai-status")).status()).toBe(401);
  });

  test("GET /api/executions → 401", async ({ request }) => {
    expect((await request.get("/api/executions")).status()).toBe(401);
  });

  test("GET /api/items → 401", async ({ request }) => {
    expect((await request.get("/api/items")).status()).toBe(401);
  });

  test("GET /api/test-plans → 401", async ({ request }) => {
    expect((await request.get("/api/test-plans")).status()).toBe(401);
  });

  test("GET /api/reports → 401", async ({ request }) => {
    expect((await request.get("/api/reports")).status()).toBe(401);
  });

  test("GET /api/dashboard → 401", async ({ request }) => {
    expect((await request.get("/api/dashboard")).status()).toBe(401);
  });

  test("GET /api/test-plans/any-id → 401", async ({ request }) => {
    expect((await request.get("/api/test-plans/any-id")).status()).toBe(401);
  });

  test("PATCH /api/test-plans/any-id → 401", async ({ request }) => {
    expect((await request.patch("/api/test-plans/any-id", { data: {} })).status()).toBe(401);
  });

  test("DELETE /api/test-plans/any-id → 401", async ({ request }) => {
    expect((await request.delete("/api/test-plans/any-id")).status()).toBe(401);
  });

  test("PATCH /api/projects/any-id → 401", async ({ request }) => {
    expect((await request.patch("/api/projects/any-id", { data: {} })).status()).toBe(401);
  });

  test("DELETE /api/projects/any-id → 401", async ({ request }) => {
    expect((await request.delete("/api/projects/any-id")).status()).toBe(401);
  });

  test("GET /api/notifications → 401", async ({ request }) => {
    expect((await request.get("/api/notifications")).status()).toBe(401);
  });
});

test.describe("Authentication — login form", () => {
  test("login with invalid credentials shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "nonexistent@email.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("p.text-red-600")).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with wrong password for existing user shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@testflow.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("p.text-red-600")).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@testflow.com");
    await page.fill('input[type="password"]', "admin123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });

  test("login form requires email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
