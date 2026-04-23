// Projects spec — full CRUD lifecycle and list visibility checks.
import { test, expect } from "@playwright/test";

test.describe("Projects — CRUD via API", () => {
  test("GET /api/projects returns project list", async ({ page }) => {
    const res = await page.request.get("/api/projects");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("projects");
    expect(Array.isArray(body.projects)).toBe(true);
  });

  test("POST /api/projects creates a project", async ({ page }) => {
    const res = await page.request.post("/api/projects", {
      data: { name: "E2E Project CRUD", description: "Created by Playwright" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.project).toHaveProperty("id");
    expect(body.project.name).toBe("E2E Project CRUD");
    expect(body.project.description).toBe("Created by Playwright");
  });

  test("POST /api/projects requires name", async ({ page }) => {
    const res = await page.request.post("/api/projects", {
      data: { description: "No name provided" },
    });
    expect(res.status()).toBe(400);
  });

  test("PATCH /api/projects/[id] updates project name", async ({ page }) => {
    const create = await page.request.post("/api/projects", {
      data: { name: "Project Before Update" },
    });
    const { project } = await create.json();

    const res = await page.request.patch(`/api/projects/${project.id}`, {
      data: { name: "Project After Update" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.project.name).toBe("Project After Update");
  });

  test("GET /api/projects/[id] returns project details", async ({ page }) => {
    const create = await page.request.post("/api/projects", {
      data: { name: "Get Project Test" },
    });
    const { project } = await create.json();

    const res = await page.request.get(`/api/projects/${project.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.project?.id ?? body.id).toBe(project.id);
  });

  test("DELETE /api/projects/[id] deletes an empty project", async ({ page }) => {
    const create = await page.request.post("/api/projects", {
      data: { name: "Project to Delete" },
    });
    const { project } = await create.json();

    const del = await page.request.delete(`/api/projects/${project.id}`);
    expect(del.status()).toBe(200);
  });

  test("GET /api/projects/nonexistent returns 404", async ({ page }) => {
    const res = await page.request.get("/api/projects/nonexistent-id-99999");
    expect(res.status()).toBe(404);
  });

  test("PATCH /api/projects/nonexistent returns 404", async ({ page }) => {
    const res = await page.request.patch("/api/projects/nonexistent-id-99999", {
      data: { name: "Ghost Project" },
    });
    expect(res.status()).toBe(404);
  });

  test("created project appears in project list", async ({ page }) => {
    const uniqueName = `E2E List Check ${Date.now()}`;
    await page.request.post("/api/projects", { data: { name: uniqueName } });

    const list = await page.request.get("/api/projects");
    const { projects } = await list.json();
    const found = projects.some((p: { name: string }) => p.name === uniqueName);
    expect(found).toBe(true);
  });
});
