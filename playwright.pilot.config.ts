import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/pilot*.spec.ts",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4190",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_BUNDLED_BROWSER
        ? undefined
        : process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "pilot-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "pilot-mobile",
      testIgnore: "**/pilot-shared.spec.ts",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/test-pilot-server.mjs",
    url: "http://127.0.0.1:4190/api/health",
    reuseExistingServer: false,
  },
});
