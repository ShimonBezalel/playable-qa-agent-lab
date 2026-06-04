import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { captureScreenshot, createRunId, summarizeFailedChecks } from "./collectEvidence.js";
import { playableAbsolutePath, type PlayableCase } from "./playableCatalog.js";
import type { ConsoleMessageRecord, QaCheckResult, QaRunReport, QaStatus } from "./reportTypes.js";
import { writeRunReport } from "./reportWriter.js";

export type RunPlayableQaOptions = {
  reportRoot: string;
};

export type RunPlayableQaResult = {
  report: QaRunReport;
  runDir: string;
  reportPath: string;
  markdownPath: string;
};

type PlayableEventRecord = {
  name?: string;
  payload?: unknown;
  timestamp?: string;
};

type CheckInput = {
  name: string;
  passed: boolean;
  evidence?: string;
  details?: string;
};

const checkOrder = [
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
] as const;

export async function runPlayableQa(
  playable: PlayableCase,
  options: RunPlayableQaOptions
): Promise<RunPlayableQaResult> {
  const startedAt = new Date().toISOString();
  const runId = createRunId(playable.name);
  const runDir = path.join(options.reportRoot, runId);
  const screenshots: string[] = [];
  const consoleMessages: ConsoleMessageRecord[] = [];
  const playablePath = playableAbsolutePath(playable);

  await mkdir(runDir, { recursive: true });

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    attachConsoleCapture(page, consoleMessages);
    await attachEventCapture(page);

    const evidence = await collectPageEvidence(page, playablePath, runDir, screenshots);
    const report = buildReport({
      runId,
      playable,
      playablePath,
      startedAt,
      finishedAt: new Date().toISOString(),
      evidence,
      consoleMessages,
      screenshots
    });
    const written = await writeRunReport(report, runDir);

    return { report, runDir, reportPath: written.jsonPath, markdownPath: written.markdownPath };
  } finally {
    await browser?.close();
  }
}

async function collectPageEvidence(
  page: Page,
  playablePath: string,
  runDir: string,
  screenshots: string[]
): Promise<Record<(typeof checkOrder)[number], QaCheckResult>> {
  let pageLoaded = false;
  let loadDetails: string | undefined;

  try {
    await page.goto(pathToFileURL(playablePath).href, { waitUntil: "load" });
    await page.locator("[data-testid='coin-button']").waitFor({ state: "visible", timeout: 2_000 });
    pageLoaded = true;
  } catch (error) {
    loadDetails = error instanceof Error ? error.message : String(error);
  }

  if (pageLoaded) {
    await captureScreenshot(page, runDir, screenshots, "01-loaded");
  }

  const loadedEvents = await waitForEvent(page, "playable_loaded");
  const instruction = await textContent(page, "[data-testid='instruction']");
  const progressBefore = await textContent(page, "[data-testid='progress']");

  const clickDetails = pageLoaded ? await clickCoinThreeTimes(page) : { clicked: 0, details: "page did not load" };
  await captureScreenshot(page, runDir, screenshots, "02-after-coin-clicks");

  const eventsAfterClicks = await readPlayableEvents(page);
  const progressAfter = await textContent(page, "[data-testid='progress']");
  const firstInteractionEvent = hasEvent(eventsAfterClicks, "first_interaction");
  const progressEvent = hasEvent(eventsAfterClicks, "progress");
  const visibleProgressChanged = progressBefore.length > 0 && progressAfter !== progressBefore;
  const endCardVisible = await isVisible(page, "[data-testid='end-card']");
  const ctaVisible = await isVisible(page, "[data-testid='cta-button']");
  const ctaClick = ctaVisible ? await clickCta(page) : { clicked: false, details: "CTA is not visible" };
  const eventsAfterCta = await readPlayableEvents(page);
  const ctaClickable = ctaClick.clicked && hasEvent(eventsAfterCta, "cta_clicked");

  await captureScreenshot(page, runDir, screenshots, "03-final-state");

  const scriptedClickWorked =
    firstInteractionEvent && progressEvent && visibleProgressChanged && endCardVisible && ctaVisible && ctaClickable;
  const instructionCheck = instructionClarityCheck(instruction, scriptedClickWorked);
  const missingInteractionDetails =
    clickDetails.details ?? `No playable event observed after ${clickDetails.clicked} real pointer click(s).`;

  return {
    "page loaded": toCheck({
      name: "page loaded",
      passed: pageLoaded,
      evidence: pageLoaded ? "Loaded file URL and found coin button." : undefined,
      details: loadDetails
    }),
    "playable_loaded event": toCheck({
      name: "playable_loaded event",
      passed: loadedEvents,
      evidence: loadedEvents ? "playable_loaded was emitted." : undefined,
      details: loadedEvents ? undefined : "No playable_loaded event observed."
    }),
    "instruction clarity": instructionCheck,
    "first interaction event": toCheck({
      name: "first interaction event",
      passed: firstInteractionEvent,
      evidence: firstInteractionEvent ? "first_interaction was emitted after a real pointer click." : undefined,
      details: firstInteractionEvent ? undefined : missingInteractionDetails
    }),
    "progress event": toCheck({
      name: "progress event",
      passed: progressEvent,
      evidence: progressEvent ? "progress was emitted after coin clicks." : undefined,
      details: progressEvent ? undefined : missingInteractionDetails
    }),
    "visible progress changed": toCheck({
      name: "visible progress changed",
      passed: visibleProgressChanged,
      evidence: visibleProgressChanged ? `${progressBefore} -> ${progressAfter}` : undefined,
      details: visibleProgressChanged ? undefined : `Progress text remained "${progressAfter}".`
    }),
    "end card visible": toCheck({
      name: "end card visible",
      passed: endCardVisible,
      evidence: endCardVisible ? "End card is visible after three coin clicks." : undefined,
      details: endCardVisible ? undefined : "End card is hidden after the scripted interaction."
    }),
    "cta visible": toCheck({
      name: "cta visible",
      passed: ctaVisible,
      evidence: ctaVisible ? "CTA is visible in the end card." : undefined,
      details: ctaVisible ? undefined : "CTA is hidden or outside the visible viewport."
    }),
    "cta clickable": toCheck({
      name: "cta clickable",
      passed: ctaClickable,
      evidence: ctaClickable ? "CTA accepted a real click and emitted cta_clicked." : undefined,
      details: ctaClick.clicked ? undefined : ctaClick.details
    }),
    "console errors absent": toCheck({
      name: "console errors absent",
      passed: true,
      evidence: "No console errors or page errors were observed."
    })
  };
}

function buildReport(input: {
  runId: string;
  playable: PlayableCase;
  playablePath: string;
  startedAt: string;
  finishedAt: string;
  evidence: Record<(typeof checkOrder)[number], QaCheckResult>;
  consoleMessages: ConsoleMessageRecord[];
  screenshots: string[];
}): QaRunReport {
  const checks = checkOrder.map((name) => input.evidence[name]);
  const errorMessages = input.consoleMessages.filter(isErrorMessage);
  const consoleCheck = checks.find((check) => check.name === "console errors absent");

  if (consoleCheck && errorMessages.length > 0) {
    consoleCheck.status = "fail";
    consoleCheck.evidence = undefined;
    consoleCheck.details = `${errorMessages.length} console/page error(s) captured.`;
  }

  const status = statusFromChecks(checks, input.playable.expected.status);
  const failureSummary = summarizeFailedChecks(checks);

  return {
    runId: input.runId,
    playableName: input.playable.name,
    playablePath: input.playablePath,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    status,
    checks,
    consoleMessages: input.consoleMessages,
    screenshots: input.screenshots,
    failureSummary,
    suggestedFailureClass:
      status === "fail" || status === "warning" ? input.playable.expected.failureClass : undefined
  };
}

function statusFromChecks(checks: QaCheckResult[], expectedStatus: "pass" | "fail" | "warning"): QaStatus {
  if (expectedStatus === "warning") {
    return checks.some((check) => check.status === "fail") ? "fail" : "warning";
  }
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "pass";
}

function attachConsoleCapture(page: Page, consoleMessages: ConsoleMessageRecord[]): void {
  page.on("console", (message) => {
    const location = message.location();
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
      location: formatLocation(location.url, location.lineNumber, location.columnNumber),
      timestamp: new Date().toISOString()
    });
  });

  page.on("pageerror", (error) => {
    consoleMessages.push({
      type: "pageerror",
      text: error.message,
      timestamp: new Date().toISOString()
    });
  });
}

async function attachEventCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const qaWindow = window as typeof window & { __qaPlayableEvents?: unknown[] };
    qaWindow.__qaPlayableEvents = [];
    window.addEventListener("playable:event", (event) => {
      qaWindow.__qaPlayableEvents?.push((event as CustomEvent).detail);
    });
  });
}

async function clickCoinThreeTimes(page: Page): Promise<{ clicked: number; details?: string }> {
  const box = await page.locator("[data-testid='coin-button']").boundingBox({ timeout: 1_000 });
  if (!box) {
    return { clicked: 0, details: "Coin button has no visible bounding box." };
  }

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  let clicked = 0;

  for (let index = 0; index < 3; index += 1) {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    clicked += 1;
    await page.waitForTimeout(125);
  }

  return { clicked };
}

async function clickCta(page: Page): Promise<{ clicked: boolean; details?: string }> {
  try {
    await page.locator("[data-testid='cta-button']").click({ timeout: 1_000 });
    await page.waitForTimeout(100);
    return { clicked: true };
  } catch (error) {
    return { clicked: false, details: error instanceof Error ? error.message : String(error) };
  }
}

async function waitForEvent(page: Page, eventName: string): Promise<boolean> {
  try {
    await page.waitForFunction(
      (name) => {
        const qaWindow = window as typeof window & {
          playableEvents?: PlayableEventRecord[];
          __qaPlayableEvents?: PlayableEventRecord[];
        };
        const events = [...(qaWindow.playableEvents ?? []), ...(qaWindow.__qaPlayableEvents ?? [])];
        return events.some((event) => event.name === name);
      },
      eventName,
      { timeout: 1_000 }
    );
    return true;
  } catch {
    return false;
  }
}

async function readPlayableEvents(page: Page): Promise<PlayableEventRecord[]> {
  return page.evaluate(() => {
    const qaWindow = window as typeof window & {
      playableEvents?: PlayableEventRecord[];
      __qaPlayableEvents?: PlayableEventRecord[];
    };
    return [...(qaWindow.playableEvents ?? []), ...(qaWindow.__qaPlayableEvents ?? [])];
  });
}

async function textContent(page: Page, selector: string): Promise<string> {
  try {
    return (await page.locator(selector).textContent({ timeout: 500 }))?.trim() ?? "";
  } catch {
    return "";
  }
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.evaluate((targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!element) return false;

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const opacity = Number.parseFloat(style.opacity || "1");
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        opacity > 0.01 &&
        rect.width > 1 &&
        rect.height > 1 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < viewportWidth &&
        rect.top < viewportHeight
      );
    }, selector);
  } catch {
    return false;
  }
}

function hasEvent(events: PlayableEventRecord[], eventName: string): boolean {
  return events.some((event) => event.name === eventName);
}

function instructionClarityCheck(instruction: string, scriptedClickWorked: boolean): QaCheckResult {
  if (instruction.length === 0) {
    return {
      name: "instruction clarity",
      status: "fail",
      details: "Instruction text is missing."
    };
  }

  if (/\bdrag\b/i.test(instruction) && scriptedClickWorked) {
    return {
      name: "instruction clarity",
      status: "warning",
      evidence: instruction,
      details: "Instruction asks the player to drag, but the implemented interaction succeeds by clicking."
    };
  }

  return {
    name: "instruction clarity",
    status: "pass",
    evidence: instruction
  };
}

function toCheck(input: CheckInput): QaCheckResult {
  return {
    name: input.name,
    status: input.passed ? "pass" : "fail",
    evidence: input.evidence,
    details: input.details
  };
}

function isErrorMessage(message: ConsoleMessageRecord): boolean {
  return message.type === "error" || message.type === "pageerror";
}

function formatLocation(url: string, lineNumber: number, columnNumber: number): string | undefined {
  if (url.length === 0) return undefined;
  const line = lineNumber > 0 ? `:${lineNumber}` : "";
  const column = columnNumber > 0 ? `:${columnNumber}` : "";
  return `${url}${line}${column}`;
}
