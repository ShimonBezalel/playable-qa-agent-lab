import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdownReport, writeRunReport } from "../src/harness/reportWriter.js";
import type { QaRunReport } from "../src/harness/reportTypes.js";

describe("report writer", () => {
  it("writes JSON and Markdown reports with run id and screenshots listed", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qa-report-"));
    const report: QaRunReport = {
      runId: "run-test",
      playableName: "good",
      playablePath: "/tmp/playable.html",
      startedAt: "2026-06-03T00:00:00.000Z",
      finishedAt: "2026-06-03T00:00:01.000Z",
      status: "pass",
      checks: [{ name: "loaded", status: "pass", evidence: "event emitted" }],
      consoleMessages: [],
      screenshots: ["screenshots/final.png"]
    };

    try {
      const result = await writeRunReport(report, dir);

      await expect(stat(result.jsonPath)).resolves.toBeTruthy();
      await expect(stat(result.markdownPath)).resolves.toBeTruthy();

      const json = await readFile(result.jsonPath, "utf8");
      expect(json).toContain("\"runId\": \"run-test\"");
      expect(json.endsWith("\n")).toBe(true);
      await expect(readFile(result.markdownPath, "utf8")).resolves.toContain("Run ID: run-test");
      await expect(readFile(result.markdownPath, "utf8")).resolves.toContain("screenshots/final.png");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("renders failure summary, suggested failure class, and console messages", () => {
    const markdown = renderMarkdownReport({
      runId: "run-failure",
      playableName: "blocked-click-target",
      playablePath: "/tmp/blocked-click-target/index.html",
      startedAt: "2026-06-03T00:00:00.000Z",
      finishedAt: "2026-06-03T00:00:01.000Z",
      status: "fail",
      checks: [
        {
          name: "cta is clickable",
          status: "fail",
          evidence: "click intercepted",
          details: "overlay covers the cta"
        }
      ],
      consoleMessages: [
        {
          type: "error",
          text: "CTA target failed",
          location: "/tmp/blocked-click-target/playable.js:42",
          timestamp: "2026-06-03T00:00:00.500Z"
        }
      ],
      screenshots: [],
      failureSummary: "CTA cannot be clicked because it is covered.",
      suggestedFailureClass: "blocked-click-target"
    });

    expect(markdown).toContain("Failure Summary: CTA cannot be clicked because it is covered.");
    expect(markdown).toContain("Suggested Failure Class: blocked-click-target");
    expect(markdown).toContain("## Console Messages");
    expect(markdown).toContain("ERROR CTA target failed");
    expect(markdown).toContain("/tmp/blocked-click-target/playable.js:42");
  });
});
