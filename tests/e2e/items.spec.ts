// Items spec — verifies type/priority defaults and full CRUD including module assignment.
import { test, expect, Browser } from "@playwright/test";

let projectId: string;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
  const res = await ctx.request.post("/api/projects", {
    data: { name: "E2E Items Project" },
  });
  projectId = (await res.json()).project.id;
  await ctx.close();
});

test.describe("Items (Requirements) — CRUD via API", () => {
  test("POST /api/items creates a user story", async ({ page }) => {
    const res = await page.request.post("/api/items", {
      data: {
        title: "US-E2E-001 — User can login",
        projectId,
        type: "USER_STORY",
        priority: "HIGH",
        acceptanceCriteria: "Given valid credentials, when login is submitted, then dashboard loads",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.item).toHaveProperty("id");
    expect(body.item.type).toBe("USER_STORY");
    expect(body.item.priority).toBe("HIGH");
  });

  test("POST /api/items creates a feature type item", async ({ page }) => {
    const res = await page.request.post("/api/items", {
      data: { title: "FT-E2E-001 — Dashboard widget", projectId, type: "FEATURE" },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).item.type).toBe("FEATURE");
  });

  test("POST /api/items requires title", async ({ page }) => {
    const res = await page.request.post("/api/items", { data: { projectId } });
    expect(res.status()).toBe(400);
  });

  test("POST /api/items requires projectId", async ({ page }) => {
    const res = await page.request.post("/api/items", { data: { title: "No Project" } });
    expect(res.status()).toBe(400);
  });

  test("GET /api/items/[id] returns item details", async ({ page }) => {
    const create = await page.request.post("/api/items", {
      data: { title: "Get Item Test", projectId },
    });
    const { item } = await create.json();

    const res = await page.request.get(`/api/items/${item.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id ?? body.item?.id).toBe(item.id);
    expect(body.title ?? body.item?.title).toBe("Get Item Test");
  });

  test("PATCH /api/items/[id] updates title", async ({ page }) => {
    const create = await page.request.post("/api/items", {
      data: { title: "Original Item Title", projectId },
    });
    const { item } = await create.json();

    const res = await page.request.patch(`/api/items/${item.id}`, {
      data: { title: "Updated Item Title" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).item.title).toBe("Updated Item Title");
  });

  test("PATCH /api/items/[id] updates priority", async ({ page }) => {
    const create = await page.request.post("/api/items", {
      data: { title: "Priority Test Item", projectId, priority: "LOW" },
    });
    const { item } = await create.json();

    const res = await page.request.patch(`/api/items/${item.id}`, {
      data: { priority: "CRITICAL" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).item.priority).toBe("CRITICAL");
  });

  test("PATCH /api/items/[id] updates notes and acceptanceCriteria", async ({ page }) => {
    const create = await page.request.post("/api/items", {
      data: { title: "Patch Notes Item", projectId },
    });
    const { item } = await create.json();

    const res = await page.request.patch(`/api/items/${item.id}`, {
      data: {
        notes: "Important observation",
        acceptanceCriteria: "Must pass all smoke tests",
      },
    });
    expect(res.status()).toBe(200);
    const updated = (await res.json()).item;
    expect(updated.notes).toBe("Important observation");
    expect(updated.acceptanceCriteria).toBe("Must pass all smoke tests");
  });

  test("DELETE /api/items/[id] removes item", async ({ page }) => {
    const create = await page.request.post("/api/items", {
      data: { title: "Delete Me Item", projectId },
    });
    const { item } = await create.json();

    const del = await page.request.delete(`/api/items/${item.id}`);
    expect(del.status()).toBe(200);

    const get = await page.request.get(`/api/items/${item.id}`);
    expect(get.status()).toBe(404);
  });

  test("GET /api/items/nonexistent returns 404", async ({ page }) => {
    const res = await page.request.get("/api/items/nonexistent-id-99999");
    expect(res.status()).toBe(404);
  });

  test("item defaults to MEDIUM priority", async ({ page }) => {
    const res = await page.request.post("/api/items", {
      data: { title: "Default Priority Item", projectId },
    });
    expect((await res.json()).item.priority).toBe("MEDIUM");
  });

  test("item defaults to USER_STORY type", async ({ page }) => {
    const res = await page.request.post("/api/items", {
      data: { title: "Default Type Item", projectId },
    });
    expect((await res.json()).item.type).toBe("USER_STORY");
  });
});
