import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

export function createRunId(playableName: string): string {
  const safeName = playableName.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeName}`;
}

export function summarizeFailedChecks(checks: { name: string; status: string }[]): string | undefined {
  const failed = checks.filter((check) => check.status === "fail").map((check) => check.name);
  return failed.length > 0 ? `Failed checks: ${failed.join(", ")}` : undefined;
}

export async function captureScreenshot(
  page: Page,
  runDir: string,
  screenshots: string[],
  name: string
): Promise<void> {
  const screenshotPath = path.join("screenshots", `${name}.png`);
  await mkdir(path.join(runDir, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(runDir, screenshotPath), fullPage: true });
  screenshots.push(screenshotPath);
}
