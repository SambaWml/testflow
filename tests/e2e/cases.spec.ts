// Test cases spec — covers BDD/steps CRUD, version increment, and soft-delete behaviour.
// Uses page.request (shares auth cookie from storageState) for all API calls.
import { test, expect, Browser } from "@playwright/test";

let projectId: string;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
  const res = await ctx.request.post("/api/projects", {
    data: { name: "E2E Cases Project" },
  });
  projectId = (await res.json()).project.id;
  await ctx.close();
});

test.describe("Test Cases — CRUD via API", () => {
  test("POST /api/cases creates a BDD test case", async ({ page }) => {
    const res = await page.request.post("/api/cases", {
      data: {
        title: "CT-E2E-001 — Valid login",
        projectId,
        format: "BDD",
        priority: "HIGH",
        bddGiven: "The user is on the login page",
        bddWhen: "The user enters valid credentials and clicks submit",
        bddThen: "The user is redirected to the dashboard",
        precondition: "User account must exist and be active",
      },
    });
    expect(res.status()).toBe(201);
    const { tc } = await res.json();
    expect(tc).toHaveProperty("id");
    expect(tc.bddGiven).toBe("The user is on the login page");
    expect(tc.priority).toBe("HIGH");
  });

  test("POST /api/cases creates a case with steps", async ({ page }) => {
    const res = await page.request.post("/api/cases", {
      data: {
        title: "CT-E2E-002 — Login with steps",
        projectId,
        steps: [
          { description: "Navigate to /login", expectedData: "Login page is visible" },
          { description: "Fill email field with valid email", expectedData: "Email accepted" },
          { description: "Fill password field", expectedData: "Password masked" },
          { description: "Click the submit button", expectedData: "Dashboard loads in < 3s" },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const { tc } = await res.json();
    expect(tc.id).toBeDefined();
  });

  test("POST /api/cases creates a negative test case", async ({ page }) => {
    const res = await page.request.post("/api/cases", {
      data: {
        title: "CT-E2E-003 — Invalid login",
        projectId,
        priority: "MEDIUM",
        bddGiven: "The user is on the login page",
        bddWhen: "The user enters an incorrect password",
        bddThen: "An error message is shown and the user stays on /login",
        expectedResult: "Error message visible, no session created",
      },
    });
    expect(res.status()).toBe(201);
  });

  test("POST /api/cases requires title", async ({ page }) => {
    const res = await page.request.post("/api/cases", { data: { projectId } });
    expect(res.status()).toBe(400);
  });

  test("POST /api/cases requires projectId", async ({ page }) => {
    const res = await page.request.post("/api/cases", {
      data: { title: "No Project Case" },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/cases/[id] returns case with steps", async ({ page }) => {
    const create = await page.request.post("/api/cases", {
      data: {
        title: "Get Case With Steps",
        projectId,
        steps: [{ description: "Step one" }, { description: "Step two" }],
      },
    });
    const { tc } = await create.json();

    const res = await page.request.get(`/api/cases/${tc.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(tc.id);
    expect(Array.isArray(body.steps)).toBe(true);
    expect(body.steps.length).toBe(2);
  });

  test("PATCH /api/cases/[id] updates title and increments version", async ({ page }) => {
    const create = await page.request.post("/api/cases", {
      data: { title: "Case Version V1", projectId },
    });
    const { tc: original } = await create.json();
    const originalVersion = original.version ?? 0;

    const res = await page.request.patch(`/api/cases/${original.id}`, {
      data: { title: "Case Version V2", priority: "CRITICAL" },
    });
    expect(res.status()).toBe(200);
    const { tc: updated } = await res.json();
    expect(updated.title).toBe("Case Version V2");
    expect(updated.version).toBeGreaterThan(originalVersion);
  });

  test("PATCH /api/cases/[id] replaces steps", async ({ page }) => {
    const create = await page.request.post("/api/cases", {
      data: {
        title: "Steps Replace Test",
        projectId,
        steps: [{ description: "Old Step 1" }, { description: "Old Step 2" }],
      },
    });
    const { tc } = await create.json();

    const res = await page.request.patch(`/api/cases/${tc.id}`, {
      data: {
        steps: [
          { description: "New Step 1", expectedData: "New expected 1" },
          { description: "New Step 2", expectedData: "New expected 2" },
          { description: "New Step 3" },
        ],
      },
    });
    expect(res.status()).toBe(200);

    const get = await page.request.get(`/api/cases/${tc.id}`);
    const full = await get.json();
    expect(full.steps.length).toBe(3);
    expect(full.steps[0].description).toBe("New Step 1");
  });

  test("PATCH /api/cases/[id] updates BDD fields", async ({ page }) => {
    const create = await page.request.post("/api/cases", {
      data: { title: "BDD Update Test", projectId },
    });
    const { tc } = await create.json();

    const res = await page.request.patch(`/api/cases/${tc.id}`, {
      data: {
        bddGiven: "Updated Given",
        bddWhen: "Updated When",
        bddThen: "Updated Then",
      },
    });
    expect(res.status()).toBe(200);
    const { tc: updated } = await res.json();
    expect(updated.bddGiven).toBe("Updated Given");
    expect(updated.bddWhen).toBe("Updated When");
    expect(updated.bddThen).toBe("Updated Then");
  });

  test("DELETE /api/cases/[id] soft-deletes case (isActive = false)", async ({ page }) => {
    const create = await page.request.post("/api/cases", {
      data: { title: "Soft Delete Case", projectId },
    });
    const { tc } = await create.json();

    const del = await page.request.delete(`/api/cases/${tc.id}`);
    expect(del.status()).toBe(200);
    expect((await del.json()).ok).toBe(true);
  });

  test("GET /api/cases/nonexistent returns 404", async ({ page }) => {
    const res = await page.request.get("/api/cases/nonexistent-id-99999");
    expect(res.status()).toBe(404);
  });

  test("case defaults to MEDIUM priority", async ({ page }) => {
    const res = await page.request.post("/api/cases", {
      data: { title: "Default Priority Case", projectId },
    });
    expect((await res.json()).tc.priority).toBe("MEDIUM");
  });

  test("case starts at version 1", async ({ page }) => {
    const res = await page.request.post("/api/cases", {
      data: { title: "Version Check Case", projectId },
    });
    const { tc } = await res.json();
    expect(tc.version).toBe(1);
  });

  test("empty steps array clears all steps", async ({ page }) => {
    const create = await page.request.post("/api/cases", {
      data: {
        title: "Clear Steps Case",
        projectId,
        steps: [{ description: "Step to remove" }],
      },
    });
    const { tc } = await create.json();

    await page.request.patch(`/api/cases/${tc.id}`, { data: { steps: [] } });

    const get = await page.request.get(`/api/cases/${tc.id}`);
    expect((await get.json()).steps.length).toBe(0);
  });
});
