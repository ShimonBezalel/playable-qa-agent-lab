import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { playableCases } from "../src/harness/playableCatalog.js";
import { runPlayableQa } from "../src/harness/runPlayableQa.js";

const expectedCheckNames = [
  "page loaded",
  "playable_loaded event",
  "instruction clarity",
  "first interaction event",
  "progress event",
  "visible progress changed",
  "end card visible",
  "cta visible",
  "cta clickable",
  "console errors absent"
];

describe("playable QA harness", () => {
  it("passes the good playable and writes report evidence with screenshots", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qa-good-"));
    const playable = playableCases.find((item) => item.name === "good");
    expect(playable).toBeDefined();

    try {
      const result = await runPlayableQa(playable!, { reportRoot: dir });

      expect(result.report.status).toBe("pass");
      expect(result.report.checks.map((check) => check.name)).toEqual(expectedCheckNames);
      expect(result.report.checks.every((check) => check.status === "pass")).toBe(true);
      expect(result.report.screenshots.length).toBeGreaterThanOrEqual(2);

      await expect(stat(result.reportPath)).resolves.toBeTruthy();
      await expect(stat(result.markdownPath)).resolves.toBeTruthy();
      await expect(readFile(result.markdownPath, "utf8")).resolves.toContain("QA Report: good");

      for (const screenshot of result.report.screenshots) {
        await expect(stat(path.join(result.runDir, screenshot))).resolves.toBeTruthy();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("matches every seeded bug outcome and suggested failure class", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qa-bugs-"));

    try {
      for (const playable of playableCases.filter((item) => item.name !== "good")) {
        const result = await runPlayableQa(playable, { reportRoot: dir });

        expect(result.report.status, playable.name).toBe(playable.expected.status);
        expect(result.report.checks.map((check) => check.name), playable.name).toEqual(expectedCheckNames);
        expect(result.report.suggestedFailureClass, playable.name).toBe(playable.expected.failureClass);
        await expect(stat(result.reportPath), playable.name).resolves.toBeTruthy();
        await expect(stat(result.markdownPath), playable.name).resolves.toBeTruthy();

        for (const requiredCheck of playable.expected.requiredFailedChecks ?? []) {
          expect(
            result.report.checks.find((check) => check.name === requiredCheck)?.status,
            `${playable.name}: ${requiredCheck}`
          ).toBe("fail");
        }

        for (const warningCheck of playable.expected.warningChecks ?? []) {
          expect(
            result.report.checks.find((check) => check.name === warningCheck)?.status,
            `${playable.name}: ${warningCheck}`
          ).toBe("warning");
        }

        if (playable.name === "misleading-instruction") {
          expect(
            result.report.checks.filter((check) => check.status !== "pass").map((check) => check.name),
            playable.name
          ).toEqual(["instruction clarity"]);
          expect(result.report.status, playable.name).toBe("warning");
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not report warning solely because the playable expected profile is warning", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qa-warning-profile-"));
    const goodPlayable = playableCases.find((item) => item.name === "good");
    expect(goodPlayable).toBeDefined();

    try {
      const result = await runPlayableQa(
        {
          ...goodPlayable!,
          name: "clean-expected-warning",
          expected: {
            status: "warning",
            failureClass: "discoverability/UX confusion"
          }
        },
        { reportRoot: dir }
      );

      expect(result.report.checks.every((check) => check.status === "pass")).toBe(true);
      expect(result.report.status).toBe("pass");
      expect(result.report.suggestedFailureClass).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
