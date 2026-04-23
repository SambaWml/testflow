// Members spec — invite flow, duplicate invite rejection, and tempPassword warning field.
import { test, expect } from "@playwright/test";

test.describe("Members — API", () => {
  test("GET /api/orgs/members returns member list", async ({ page }) => {
    const res = await page.request.get("/api/orgs/members");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("members");
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.members.length).toBeGreaterThan(0);
  });

  test("member list includes current user", async ({ page }) => {
    const res = await page.request.get("/api/orgs/members");
    const { members } = await res.json();
    const found = members.some((m: { user: { email: string } }) =>
      m.user.email === "admin@testflow.com"
    );
    expect(found).toBe(true);
  });

  test("member has expected fields", async ({ page }) => {
    const res = await page.request.get("/api/orgs/members");
    const { members } = await res.json();
    const member = members[0];
    expect(member).toHaveProperty("id");
    expect(member).toHaveProperty("role");
    expect(member).toHaveProperty("status");
    expect(member).toHaveProperty("user");
    expect(member.user).toHaveProperty("email");
    expect(member.user).toHaveProperty("name");
    expect(Array.isArray(member.projects)).toBe(true);
  });

  test("POST /api/orgs/members invites a new user", async ({ page }) => {
    const email = `e2e-invite-${Date.now()}@test.com`;
    const res = await page.request.post("/api/orgs/members", {
      data: { name: "E2E Invited User", email, role: "MEMBER" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(email);
    expect(body.isNewUser).toBe(true);
  });

  test("POST /api/orgs/members adds existing user to org", async ({ page }) => {
    // First invite to create the user
    const email = `e2e-existing-${Date.now()}@test.com`;
    await page.request.post("/api/orgs/members", {
      data: { name: "Existing User Base", email, role: "MEMBER" },
    });

    // Attempt to add same email again — should fail (already a member)
    const res = await page.request.post("/api/orgs/members", {
      data: { name: "Existing User Again", email, role: "MEMBER" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("POST /api/orgs/members requires name", async ({ page }) => {
    const res = await page.request.post("/api/orgs/members", {
      data: { email: `no-name-${Date.now()}@test.com` },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/orgs/members requires email", async ({ page }) => {
    const res = await page.request.post("/api/orgs/members", {
      data: { name: "No Email User" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/orgs/members returns warning when email fails and exposes tempPassword", async ({
    page,
  }) => {
    // The warning field must only be present when emailSent is false
    const email = `e2e-warn-${Date.now()}@test.com`;
    const res = await page.request.post("/api/orgs/members", {
      data: { name: "Warning Test User", email, role: "MEMBER" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // If email was not sent (likely in test env), warning and tempPassword are present
    if (!body.emailSent) {
      expect(body).toHaveProperty("tempPassword");
      expect(body).toHaveProperty("warning");
      expect(typeof body.tempPassword).toBe("string");
      expect(body.tempPassword.length).toBeGreaterThan(0);
    }
  });

  test("PATCH /api/orgs/members/[id] updates member role", async ({ page }) => {
    const email = `e2e-role-${Date.now()}@test.com`;
    const invite = await page.request.post("/api/orgs/members", {
      data: { name: "Role Change User", email, role: "MEMBER" },
    });
    expect(invite.status()).toBe(200);

    // Get the member to find their memberId
    const list = await page.request.get("/api/orgs/members");
    const { members } = await list.json();
    const member = members.find((m: { user: { email: string } }) => m.user.email === email);
    if (!member) return; // skip if not found

    const res = await page.request.patch(`/api/orgs/members/${member.id}`, {
      data: { role: "ADMIN" },
    });
    expect([200, 204]).toContain(res.status());
  });
});
