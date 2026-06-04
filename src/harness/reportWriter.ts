import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ConsoleMessageRecord, QaCheckResult, QaRunReport } from "./reportTypes.js";

export type WrittenReportPaths = {
  jsonPath: string;
  markdownPath: string;
};

export async function writeRunReport(report: QaRunReport, runDir: string): Promise<WrittenReportPaths> {
  await mkdir(runDir, { recursive: true });

  const jsonPath = path.join(runDir, "report.json");
  const markdownPath = path.join(runDir, "summary.md");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdownReport(report), "utf8");

  return { jsonPath, markdownPath };
}

export function renderMarkdownReport(report: QaRunReport): string {
  const summaryLines = [
    `# QA Report: ${report.playableName}`,
    "",
    `- Status: ${formatStatus(report.status)}`,
    `- Run ID: ${report.runId}`,
    `- Playable Path: ${report.playablePath}`,
    `- Started At: ${report.startedAt}`,
    `- Finished At: ${report.finishedAt}`,
    report.tracePath ? `- Trace Path: ${report.tracePath}` : undefined,
    report.failureSummary ? `- Failure Summary: ${report.failureSummary}` : undefined,
    report.suggestedFailureClass ? `- Suggested Failure Class: ${report.suggestedFailureClass}` : undefined
  ].filter((line): line is string => line !== undefined);

  return [
    ...summaryLines,
    "",
    "## Checks",
    renderChecks(report.checks),
    "",
    "## Console Messages",
    renderConsoleMessages(report.consoleMessages),
    "",
    "## Screenshots",
    renderScreenshots(report.screenshots),
    ""
  ].join("\n");
}

function renderChecks(checks: QaCheckResult[]): string {
  if (checks.length === 0) {
    return "- none";
  }

  return checks
    .map((check) => {
      const evidence = check.evidence ? `: ${check.evidence}` : "";
      const details = check.details ? ` (${check.details})` : "";

      return `- ${formatStatus(check.status)} ${check.name}${evidence}${details}`;
    })
    .join("\n");
}

function renderConsoleMessages(messages: ConsoleMessageRecord[]): string {
  if (messages.length === 0) {
    return "- none";
  }

  return messages
    .map((message) => {
      const location = message.location ? ` at ${message.location}` : "";

      return `- ${formatStatus(message.type)} ${message.text} (${message.timestamp})${location}`;
    })
    .join("\n");
}

function renderScreenshots(screenshots: string[]): string {
  if (screenshots.length === 0) {
    return "- none";
  }

  return screenshots.map((screenshot, index) => `- ![Screenshot ${index + 1}](${screenshot})`).join("\n");
}

function formatStatus(status: string): string {
  return status.toUpperCase();
}
