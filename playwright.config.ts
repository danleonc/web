import { defineConfig, devices } from "@playwright/test";
const port = process.env.NEXAFIA_TEST_PORT || '4173';
if (!/^[1-9]\d{0,4}$/.test(port) || Number(port)>65535) throw Error('Puerto de pruebas inválido');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/pilot*.spec.ts", "**/staging-gate.spec.ts"],
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_BUNDLED_BROWSER
        ? undefined
        : process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      testIgnore: ["**/shared.spec.ts", "**/pilot*.spec.ts", "**/staging-gate.spec.ts"],
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev:api",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
