import path from "node:path";
import { playableCases, repoRoot, type PlayableCase } from "./playableCatalog.js";
import type { QaRunReport } from "./reportTypes.js";
import { runPlayableQa } from "./runPlayableQa.js";

type CliMode = "good" | "bugs" | "all";

const mode = process.argv[2] ?? "all";

if (!isCliMode(mode)) {
  console.error(`Unknown mode "${mode}". Expected one of: good, bugs, all.`);
  process.exitCode = 1;
} else {
  await runCli(mode);
}

async function runCli(mode: CliMode): Promise<void> {
  const reportRoot = path.join(repoRoot(), "qa_reports", "runs");
  const selected = selectPlayables(mode);
  let mismatchFound = false;

  for (const playable of selected) {
    const result = await runPlayableQa(playable, { reportRoot });
    const reportPath = path.relative(process.cwd(), result.reportPath);
    console.log(`${result.report.status.toUpperCase()} ${playable.name} ${reportPath}`);

    if (!matchesExpectedProfile(playable, result.report)) {
      mismatchFound = true;
    }
  }

  if (mismatchFound) {
    process.exitCode = 1;
  }
}

function selectPlayables(mode: CliMode): PlayableCase[] {
  if (mode === "good") return playableCases.filter((playable) => playable.name === "good");
  if (mode === "bugs") return playableCases.filter((playable) => playable.name !== "good");
  return playableCases;
}

function matchesExpectedProfile(playable: PlayableCase, report: QaRunReport): boolean {
  if (report.status !== playable.expected.status) return false;

  for (const checkName of playable.expected.requiredFailedChecks ?? []) {
    if (report.checks.find((check) => check.name === checkName)?.status !== "fail") {
      return false;
    }
  }

  for (const checkName of playable.expected.warningChecks ?? []) {
    if (report.checks.find((check) => check.name === checkName)?.status !== "warning") {
      return false;
    }
  }

  if (playable.expected.failureClass && report.suggestedFailureClass !== playable.expected.failureClass) {
    return false;
  }

  return true;
}

function isCliMode(value: string): value is CliMode {
  return value === "good" || value === "bugs" || value === "all";
}
