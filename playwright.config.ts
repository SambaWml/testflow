import { defineConfig, devices } from "@playwright/test";

// Three test projects share a single "setup" dependency that logs in as three different users
// and saves their session cookies to tests/.auth/*.json before any spec runs.
//
// Project layout:
//   setup           → global.setup.ts — seeds DB fixtures + saves auth states
//   admin-tests     → all specs except isolation.spec and admin.spec (runs as admin@testflow.com)
//   superadmin-tests→ admin.spec only (needs super-admin privileges)
//   isolation-tests → isolation.spec only (runs as e2e-isolated@test.com in a separate org)

export default defineConfig({
  testDir: "./tests/e2e",
  // Sequential workers in CI to avoid race conditions on shared DB state.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "admin-tests",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/admin.json",
      },
      dependencies: ["setup"],
      // Isolation and admin specs need their own user contexts — exclude them here.
      testIgnore: [/isolation\.spec/, /admin\.spec/],
    },
    {
      name: "superadmin-tests",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/superadmin.json",
      },
      dependencies: ["setup"],
      testMatch: /admin\.spec/,
    },
    {
      name: "isolation-tests",
      use: {
        ...devices["Desktop Chrome"],
        // e2e-isolated@test.com belongs to "E2E Isolated Org", separate from the demo org.
        storageState: "tests/.auth/isolated.json",
      },
      dependencies: ["setup"],
      testMatch: /isolation\.spec/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reuse the dev server locally to avoid the startup overhead on every run.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
