// Bugs spec — verifies type is always BUG, status always OPEN on creation, and CRUD lifecycle.
import { test, expect, Browser } from "@playwright/test";

let projectId: string;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
  const res = await ctx.request.post("/api/projects", { data: { name: "E2E Bugs Project" } });
  projectId = (await res.json()).project.id;
  await ctx.close();
});

test.describe("Bugs — CRUD via API", () => {
  test("POST /api/bugs creates a bug", async ({ page }) => {
    const res = await page.request.post("/api/bugs", {
      data: {
        title: "BUG-E2E-001 — Login fails on Safari 17",
        projectId,
        priority: "HIGH",
        description: "Login button does nothing when clicked on Safari 17.4+",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const bug = body.item ?? body.bug;
    expect(bug).toHaveProperty("id");
    expect(bug.title).toBe("BUG-E2E-001 — Login fails on Safari 17");
  });

  test("bug type is always set to BUG", async ({ page }) => {
    const res = await page.request.post("/api/bugs", {
      data: { title: "Type Enforcement Bug", projectId },
    });
    const body = await res.json();
    expect((body.item ?? body.bug).type).toBe("BUG");
  });

  test("bug status defaults to OPEN", async ({ page }) => {
    const res = await page.request.post("/api/bugs", {
      data: { title: "Default Status Bug", projectId },
    });
    const body = await res.json();
    expect((body.item ?? body.bug).status).toBe("OPEN");
  });

  test("bug priority defaults to MEDIUM", async ({ page }) => {
    const res = await page.request.post("/api/bugs", {
      data: { title: "Default Priority Bug", projectId },
    });
    const body = await res.json();
    expect((body.item ?? body.bug).priority).toBe("MEDIUM");
  });

  test("POST /api/bugs creates HIGH priority bug", async ({ page }) => {
    const res = await page.request.post("/api/bugs", {
      data: { title: "Critical Bug", projectId, priority: "HIGH" },
    });
    expect((await res.json()).item?.priority ?? (await res.json()).bug?.priority).toBe("HIGH");
  });

  test("POST /api/bugs requires title", async ({ page }) => {
    const res = await page.request.post("/api/bugs", { data: { projectId } });
    expect(res.status()).toBe(400);
  });

  test("POST /api/bugs requires projectId", async ({ page }) => {
    const res = await page.request.post("/api/bugs", {
      data: { title: "Bug Without Project" },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /api/bugs returns list with type filter", async ({ page }) => {
    const res = await page.request.get("/api/bugs");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const bugs = body.items ?? body.bugs ?? body;
    expect(Array.isArray(bugs)).toBe(true);
  });

  test("multiple bugs can be created for same project", async ({ page }) => {
    const bugData = [
      { title: "Bug Alpha", projectId, priority: "LOW" },
      { title: "Bug Beta", projectId, priority: "MEDIUM" },
      { title: "Bug Gamma", projectId, priority: "HIGH" },
    ];
    const results = await Promise.all(
      bugData.map((data) => page.request.post("/api/bugs", { data }))
    );
    for (const res of results) {
      expect(res.status()).toBe(201);
    }
  });

  test("bug can be updated via PATCH /api/items/[id]", async ({ page }) => {
    const create = await page.request.post("/api/bugs", {
      data: { title: "Bug to Update", projectId },
    });
    const { item, bug } = await create.json();
    const bugId = (item ?? bug).id;

    const res = await page.request.patch(`/api/items/${bugId}`, {
      data: { title: "Updated Bug Title", notes: "Root cause: null check missing" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).item.title).toBe("Updated Bug Title");
  });

  test("bug can be deleted via DELETE /api/items/[id]", async ({ page }) => {
    const create = await page.request.post("/api/bugs", {
      data: { title: "Bug to Delete", projectId },
    });
    const { item, bug } = await create.json();
    const bugId = (item ?? bug).id;

    const del = await page.request.delete(`/api/items/${bugId}`);
    expect(del.status()).toBe(200);
  });
});
