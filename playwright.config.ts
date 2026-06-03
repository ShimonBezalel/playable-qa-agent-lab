import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 }
  }
});
