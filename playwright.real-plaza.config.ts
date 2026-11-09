import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: "**/pilot-real-plaza.spec.ts", workers: 1, reporter: "list",
  use: { baseURL: "http://127.0.0.1:4190", launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] }, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node scripts/test-pilot-server.mjs", url: "http://127.0.0.1:4190/api/health", reuseExistingServer: false, env: { ...process.env, NEXAFIA_TEST_PLAZA: "1" } },
});
