export type QaStatus = "pass" | "fail" | "warning";

export type QaCheckStatus = "pass" | "fail" | "warning" | "skipped";

export type QaCheckResult = {
  name: string;
  status: QaCheckStatus;
  evidence?: string;
  details?: string;
};

export type ConsoleMessageRecord = {
  type: string;
  text: string;
  location?: string;
  timestamp: string;
};

export type QaRunReport = {
  runId: string;
  playableName: string;
  playablePath: string;
  startedAt: string;
  finishedAt: string;
  status: QaStatus;
  checks: QaCheckResult[];
  consoleMessages: ConsoleMessageRecord[];
  screenshots: string[];
  tracePath?: string;
  failureSummary?: string;
  suggestedFailureClass?: string;
};
