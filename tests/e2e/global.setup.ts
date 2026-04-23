// Global setup runs once before all test projects.
// It seeds the isolated-org fixture and saves three auth state files:
//   tests/.auth/admin.json       → admin@testflow.com (Demo Org)
//   tests/.auth/superadmin.json  → superadmin@testflow.com (cross-org access)
//   tests/.auth/isolated.json    → e2e-isolated@test.com (E2E Isolated Org — for IDOR tests)

import { test as setup, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";

const ADMIN_AUTH = "tests/.auth/admin.json";
const SUPERADMIN_AUTH = "tests/.auth/superadmin.json";
const ISOLATED_AUTH = "tests/.auth/isolated.json";

setup("seed test fixtures and save auth states", async ({ page }) => {
  // Ensure output dir exists — Playwright won't create it automatically.
  fs.mkdirSync("tests/.auth", { recursive: true });

  // Use Prisma directly (bypassing HTTP) so setup doesn't depend on the server being up yet.
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({
      where: { email: "e2e-isolated@test.com" },
    });
    // Idempotent — skip creation if the user already exists from a previous run.
    if (!existing) {
      const hash = await bcrypt.hash("E2eTest123!", 12);
      const user = await prisma.user.create({
        data: {
          name: "E2E Isolated",
          email: "e2e-isolated@test.com",
          passwordHash: hash,
          role: "ADMIN",
        },
      });
      const org = await prisma.organization.create({
        data: {
          name: "E2E Isolated Org",
          slug: "e2e-isolated-org",
          plan: "FREE",
          code: 8888,
        },
      });
      await prisma.orgMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "OWNER",
          joinedAt: new Date(),
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  // Log in as admin and capture the session cookie.
  await page.goto("/login");
  await page.fill('input[type="email"]', "admin@testflow.com");
  await page.fill('input[type="password"]', "admin123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/", { timeout: 15_000 });
  await page.context().storageState({ path: ADMIN_AUTH });

  // Clear cookies before each new login to avoid session leakage between users.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[type="email"]', "superadmin@testflow.com");
  await page.fill('input[type="password"]', "admin123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/", { timeout: 15_000 });
  await page.context().storageState({ path: SUPERADMIN_AUTH });

  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[type="email"]', "e2e-isolated@test.com");
  await page.fill('input[type="password"]', "E2eTest123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/", { timeout: 15_000 });
  await page.context().storageState({ path: ISOLATED_AUTH });
});
