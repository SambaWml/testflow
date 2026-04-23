import { test, expect } from "@playwright/test";

// This file runs under "superadmin-tests" project (storageState: superadmin.json)

test.describe("Admin panel — super admin access", () => {
  test("/admin page loads for super admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("GET /api/admin/orgs returns org list", async ({ page }) => {
    const res = await page.request.get("/api/admin/orgs");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const orgs = body.orgs ?? body.organizations ?? body;
    expect(Array.isArray(orgs)).toBe(true);
    expect(orgs.length).toBeGreaterThan(0);
  });

  test("GET /api/admin/superadmins returns super admin list", async ({ page }) => {
    const res = await page.request.get("/api/admin/superadmins");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const admins = body.superAdmins ?? body.admins ?? body;
    expect(Array.isArray(admins)).toBe(true);
  });

  test("super admin org list includes Demo Org", async ({ page }) => {
    const res = await page.request.get("/api/admin/orgs");
    const body = await res.json();
    const orgs = body.orgs ?? body.organizations ?? body;
    const found = orgs.some(
      (o: { name?: string; slug?: string }) =>
        o.name === "Demo Org" || o.slug === "demo-org"
    );
    expect(found).toBe(true);
  });

  test("GET /api/admin/orgs/[id] returns org details", async ({ page }) => {
    const list = await page.request.get("/api/admin/orgs");
    const body = await list.json();
    const orgs = body.orgs ?? body.organizations ?? body;
    const demoOrg = orgs.find((o: { slug?: string }) => o.slug === "demo-org");
    if (!demoOrg) test.skip();

    const res = await page.request.get(`/api/admin/orgs/${demoOrg.id}`);
    expect(res.status()).toBe(200);
  });

  test("GET /api/admin/orgs/[id]/members returns org members", async ({ page }) => {
    const list = await page.request.get("/api/admin/orgs");
    const body = await list.json();
    const orgs = body.orgs ?? body.organizations ?? body;
    const demoOrg = orgs.find((o: { slug?: string }) => o.slug === "demo-org");
    if (!demoOrg) test.skip();

    const res = await page.request.get(`/api/admin/orgs/${demoOrg.id}/members`);
    expect(res.status()).toBe(200);
  });
});

test.describe("Admin panel — regular admin is blocked", () => {
  test.use({ storageState: "tests/.auth/admin.json" });

  test("/admin redirects regular admin to login or forbidden", async ({ page }) => {
    await page.goto("/admin");
    // Must not be on /admin
    const url = page.url();
    expect(url).not.toMatch(/\/admin$/);
  });

  test("GET /api/admin/orgs returns 403 for regular admin", async ({ page }) => {
    const res = await page.request.get("/api/admin/orgs");
    expect(res.status()).toBe(403);
  });

  test("GET /api/admin/superadmins returns 403 for regular admin", async ({ page }) => {
    const res = await page.request.get("/api/admin/superadmins");
    expect(res.status()).toBe(403);
  });

  test("POST /api/admin/superadmins returns 403 for regular admin", async ({ page }) => {
    const res = await page.request.post("/api/admin/superadmins", {
      data: { userId: "any-user-id" },
    });
    expect(res.status()).toBe(403);
  });
});
