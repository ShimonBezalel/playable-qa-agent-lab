# Playable QA Agent Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a runnable public `playable-qa-agent-lab` repository with a playable-ad sandbox, deterministic Playwright QA, evidence reports, a five-skill Claude/Codex bundle, skill-boundary evals, docs, CI, and an interview demo path.

**Architecture:** Static playables provide a stable local target; a TypeScript Playwright harness validates behavior and writes reports; deterministic skill evals verify that `.claude/skills` artifacts remain concise and non-overlapping. Computer use is documented as an optional higher QA layer, not a required external dependency.

**Tech Stack:** Node 20, TypeScript, Playwright, Vitest, Markdown, JSON fixtures, GitHub Actions, GitHub CLI.

---

## Execution Protocol

- Use `superpowers:using-git-worktrees` before each implementation task.
- Work on feature branches created from `main` in `.worktrees/<branch-name>`.
- Commit each task independently.
- Push each task branch and create a GitHub PR into `main`.
- Do not wait for user approval before merging a PR once local tests, spec review, and code-quality review are clean.
- Do not overwrite or commit local `research/`, `specs/`, or `.DS_Store` inputs unless a task explicitly says to.
- Subagents are not alone in the codebase: never revert another branch's merged work; pull/rebase `main` before starting each task.

## File Structure

Create or modify these files:

```text
.claude/skills/modeling-playable-experience/SKILL.md
.claude/skills/routing-qa-layer-strategy/SKILL.md
.claude/skills/designing-computer-use-evaluator/SKILL.md
.claude/skills/defining-evidence-harness/SKILL.md
.claude/skills/triaging-playable-failures/SKILL.md
.github/workflows/ci.yml
.gitignore
README.md
docs/architecture.md
docs/computer-use-evaluator.md
docs/interview-demo-guide.md
docs/playable-contract.md
docs/qa-layering.md
docs/skill-boundaries.md
evals/negative-control-cases.json
evals/pairwise-confusion-cases.json
evals/skill-activation-cases.json
package.json
playables/good/index.html
playables/good/playable.js
playables/good/style.css
playables/bugs/blocked-click-target/index.html
playables/bugs/blocked-click-target/playable.js
playables/bugs/blocked-click-target/style.css
playables/bugs/console-error/index.html
playables/bugs/console-error/playable.js
playables/bugs/console-error/style.css
playables/bugs/frozen-feedback/index.html
playables/bugs/frozen-feedback/playable.js
playables/bugs/frozen-feedback/style.css
playables/bugs/hidden-cta/index.html
playables/bugs/hidden-cta/playable.js
playables/bugs/hidden-cta/style.css
playables/bugs/misleading-instruction/index.html
playables/bugs/misleading-instruction/playable.js
playables/bugs/misleading-instruction/style.css
playables/bugs/missing-end-card/index.html
playables/bugs/missing-end-card/playable.js
playables/bugs/missing-end-card/style.css
playwright.config.ts
prompts/computer-use-naive-user-evaluator.md
prompts/failure-analysis-agent.md
prompts/perceptual-qa-report-schema.md
qa_reports/.gitkeep
src/demo/runDemo.ts
src/harness/cli.ts
src/harness/collectEvidence.ts
src/harness/playableCatalog.ts
src/harness/reportTypes.ts
src/harness/reportWriter.ts
src/harness/runPlayableQa.ts
src/skill-evals/evalTypes.ts
src/skill-evals/runSkillEvals.ts
tests/harness.test.ts
tests/reports.test.ts
tests/skill-evals.test.ts
tsconfig.json
vitest.config.ts
```

## Shared Type Contracts

Use these report types consistently:

```ts
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
```

Use this playable catalog shape:

```ts
export type ExpectedOutcome = {
  status: "pass" | "fail" | "warning";
  failureClass?: string;
  requiredFailedChecks?: string[];
  warningChecks?: string[];
};

export type PlayableCase = {
  name: string;
  relativePath: string;
  expected: ExpectedOutcome;
};
```

---

### Task 1: Repo Tooling, Baseline, And GitHub Remote

**Files:**
- Create/modify: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `qa_reports/.gitkeep`

- [ ] **Step 1: Start isolated branch**

Run:

```bash
git checkout main
git pull --ff-only || true
git worktree add .worktrees/feat-repo-tooling -b feat/repo-tooling
cd .worktrees/feat-repo-tooling
```

Expected: a clean worktree on `feat/repo-tooling`.

- [ ] **Step 2: Add package metadata**

Create `package.json` with:

```json
{
  "name": "playable-qa-agent-lab",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "description": "Local lab for deterministic QA and agent-skill evaluation of playable ads.",
  "scripts": {
    "test": "vitest run",
    "qa:good": "tsx src/harness/cli.ts good",
    "qa:bugs": "tsx src/harness/cli.ts bugs",
    "qa:all": "tsx src/harness/cli.ts all",
    "eval:skills": "tsx src/skill-evals/runSkillEvals.ts",
    "demo": "tsx src/demo/runDemo.ts"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Add TypeScript and test config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "playwright.config.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 45_000,
    passWithNoTests: true
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 },
    ...devices["Desktop Chrome"]
  }
});
```

- [ ] **Step 4: Add generated-artifact ignores**

Ensure `.gitignore` contains:

```gitignore
.DS_Store
.worktrees/
node_modules/
dist/
qa_reports/runs/
test-results/
playwright-report/
coverage/
```

Create `qa_reports/.gitkeep`.

- [ ] **Step 5: Install and smoke test**

Run:

```bash
npm install
npm test
```

Expected: dependency install succeeds; `npm test` exits 0 because `vitest.config.ts` sets `passWithNoTests: true` until later tasks add real tests.

- [ ] **Step 6: Commit and PR**

Run:

```bash
git add .gitignore package.json package-lock.json tsconfig.json vitest.config.ts playwright.config.ts qa_reports/.gitkeep
git commit -m "chore: add node qa lab tooling"
git push -u origin feat/repo-tooling
gh pr create --base main --head feat/repo-tooling --title "chore: add node qa lab tooling" --body "Adds Node, TypeScript, Playwright, Vitest, and artifact ignore baseline."
```

Expected: branch pushed and PR open. The coordinator runs spec and code-quality review before merging.

---

### Task 2: Playable Sandbox And Seeded Bug Variants

**Files:**
- Create: `playables/good/index.html`
- Create: `playables/good/playable.js`
- Create: `playables/good/style.css`
- Create: each `playables/bugs/<bug>/index.html`
- Create: each `playables/bugs/<bug>/playable.js`
- Create: each `playables/bugs/<bug>/style.css`
- Create: `src/harness/playableCatalog.ts`

- [ ] **Step 1: Start isolated branch from updated main**

Run:

```bash
git checkout main
git pull --ff-only
git worktree add .worktrees/feat-playables -b feat/playables
cd .worktrees/feat-playables
```

- [ ] **Step 2: Implement the good playable**

The good playable must expose these test IDs:

```text
instruction
coin-button
progress
end-card
cta-button
event-log
```

The good `playable.js` must:

```js
const events = [];
let score = 0;
let firstInteractionEmitted = false;

function emitEvent(name, payload = {}) {
  const event = { name, payload, timestamp: new Date().toISOString() };
  events.push(event);
  window.playableEvents = events;
  window.dispatchEvent(new CustomEvent("playable:event", { detail: event }));
  document.querySelector("[data-testid='event-log']").textContent = JSON.stringify(events);
}
```

It must emit `playable_loaded` on load, `first_interaction` on the first coin click, `progress` on each successful click, `end_card_shown` at score 3, and `cta_clicked` when CTA is clicked.

- [ ] **Step 3: Implement seeded bugs**

Implement the required variants by copying the good playable and making one targeted behavior change per folder:

```text
blocked-click-target: add transparent overlay above the coin button.
hidden-cta: reveal end card but keep CTA hidden/offscreen or disabled.
misleading-instruction: instruction says "Drag the coin into the basket" while click still works.
missing-end-card: score reaches 3 but end-card remains hidden.
frozen-feedback: internal score/events progress but visible progress text stays at 0/3.
console-error: emit a console error or throw during interaction.
```

- [ ] **Step 4: Add playable catalog**

Create `src/harness/playableCatalog.ts` with the seven cases and expected outcomes:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ExpectedOutcome = {
  status: "pass" | "fail" | "warning";
  failureClass?: string;
  requiredFailedChecks?: string[];
  warningChecks?: string[];
};

export type PlayableCase = {
  name: string;
  relativePath: string;
  expected: ExpectedOutcome;
};

export const playableCases: PlayableCase[] = [
  { name: "good", relativePath: "playables/good/index.html", expected: { status: "pass" } },
  { name: "blocked-click-target", relativePath: "playables/bugs/blocked-click-target/index.html", expected: { status: "fail", failureClass: "logic/state bug", requiredFailedChecks: ["first interaction event", "progress event"] } },
  { name: "hidden-cta", relativePath: "playables/bugs/hidden-cta/index.html", expected: { status: "fail", failureClass: "broken CTA flow", requiredFailedChecks: ["cta visible", "cta clickable"] } },
  { name: "misleading-instruction", relativePath: "playables/bugs/misleading-instruction/index.html", expected: { status: "warning", failureClass: "discoverability/UX confusion", warningChecks: ["instruction clarity"] } },
  { name: "missing-end-card", relativePath: "playables/bugs/missing-end-card/index.html", expected: { status: "fail", failureClass: "missing end state", requiredFailedChecks: ["end card visible"] } },
  { name: "frozen-feedback", relativePath: "playables/bugs/frozen-feedback/index.html", expected: { status: "fail", failureClass: "visual/rendering bug", requiredFailedChecks: ["visible progress changed"] } },
  { name: "console-error", relativePath: "playables/bugs/console-error/index.html", expected: { status: "fail", failureClass: "logic/state bug", requiredFailedChecks: ["console errors absent"] } }
];

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

export function playableAbsolutePath(playable: PlayableCase): string {
  return path.join(repoRoot(), playable.relativePath);
}
```

- [ ] **Step 5: Verify manually**

Run:

```bash
node -e "const fs=require('fs'); for (const p of ['playables/good/index.html','playables/bugs/hidden-cta/index.html']) console.log(p, fs.existsSync(p))"
```

Expected: both paths print `true`.

- [ ] **Step 6: Commit and PR**

Run:

```bash
git add playables src/harness/playableCatalog.ts
git commit -m "feat: add playable sandbox variants"
git push -u origin feat/playables
gh pr create --base main --head feat/playables --title "feat: add playable sandbox variants" --body "Adds good playable, six seeded bug variants, and the playable catalog."
```

---

### Task 3: Report Types And Report Writer

**Files:**
- Create: `src/harness/reportTypes.ts`
- Create: `src/harness/reportWriter.ts`
- Create: `tests/reports.test.ts`

- [ ] **Step 1: Start isolated branch**

Run:

```bash
git checkout main
git pull --ff-only
git worktree add .worktrees/feat-report-writer -b feat/report-writer
cd .worktrees/feat-report-writer
```

- [ ] **Step 2: Write failing report tests**

Create `tests/reports.test.ts` with tests that:

```ts
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { writeRunReport } from "../src/harness/reportWriter";
import type { QaRunReport } from "../src/harness/reportTypes";

describe("report writer", () => {
  it("writes JSON and Markdown reports with screenshots listed", async () => {
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

    const result = await writeRunReport(report, dir);
    await expect(stat(result.jsonPath)).resolves.toBeTruthy();
    await expect(stat(result.markdownPath)).resolves.toBeTruthy();
    await expect(readFile(result.jsonPath, "utf8")).resolves.toContain("\"runId\": \"run-test\"");
    await expect(readFile(result.markdownPath, "utf8")).resolves.toContain("screenshots/final.png");
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Implement types and writer**

Create `src/harness/reportTypes.ts` using the shared type contract above.

Create `src/harness/reportWriter.ts` with:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { QaRunReport } from "./reportTypes";

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
  const checks = report.checks
    .map((check) => `- ${check.status.toUpperCase()} ${check.name}${check.evidence ? `: ${check.evidence}` : ""}${check.details ? ` (${check.details})` : ""}`)
    .join("\n");
  const screenshots = report.screenshots.map((screenshot) => `- ${screenshot}`).join("\n") || "- none";
  const consoleMessages = report.consoleMessages.map((message) => `- ${message.type}: ${message.text}`).join("\n") || "- none";

  return [
    `# QA Report: ${report.playableName}`,
    "",
    `- Run ID: ${report.runId}`,
    `- Status: ${report.status}`,
    `- Playable: ${report.playablePath}`,
    report.failureSummary ? `- Failure summary: ${report.failureSummary}` : undefined,
    report.suggestedFailureClass ? `- Suggested failure class: ${report.suggestedFailureClass}` : undefined,
    "",
    "## Checks",
    checks,
    "",
    "## Console Messages",
    consoleMessages,
    "",
    "## Screenshots",
    screenshots,
    ""
  ].filter((line) => line !== undefined).join("\n");
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/reports.test.ts
```

Expected: report writer test passes.

- [ ] **Step 5: Commit and PR**

Run:

```bash
git add src/harness/reportTypes.ts src/harness/reportWriter.ts tests/reports.test.ts
git commit -m "feat: add qa report writer"
git push -u origin feat/report-writer
gh pr create --base main --head feat/report-writer --title "feat: add qa report writer" --body "Adds typed QA reports and JSON/Markdown report writing tests."
```

---

### Task 4: Playwright QA Harness And CLI

**Files:**
- Create: `src/harness/collectEvidence.ts`
- Create: `src/harness/runPlayableQa.ts`
- Create: `src/harness/cli.ts`
- Create: `tests/harness.test.ts`

- [ ] **Step 1: Start isolated branch**

Run:

```bash
git checkout main
git pull --ff-only
git worktree add .worktrees/feat-qa-harness -b feat/qa-harness
cd .worktrees/feat-qa-harness
```

- [ ] **Step 2: Write failing harness tests**

Create `tests/harness.test.ts` with tests that:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { playableCases } from "../src/harness/playableCatalog";
import { runPlayableQa } from "../src/harness/runPlayableQa";

describe("playable QA harness", () => {
  it("passes the good playable", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qa-good-"));
    const playable = playableCases.find((item) => item.name === "good");
    expect(playable).toBeDefined();
    const result = await runPlayableQa(playable!, { reportRoot: dir });
    expect(result.report.status).toBe("pass");
    expect(result.report.screenshots.length).toBeGreaterThan(0);
    await rm(dir, { recursive: true, force: true });
  });

  it("matches expected seeded bug outcomes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qa-bugs-"));
    for (const playable of playableCases.filter((item) => item.name !== "good")) {
      const result = await runPlayableQa(playable, { reportRoot: dir });
      expect(result.report.status).toBe(playable.expected.status);
      if (playable.expected.failureClass) {
        expect(result.report.suggestedFailureClass).toBe(playable.expected.failureClass);
      }
    }
    await rm(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Implement evidence capture helper**

Create `src/harness/collectEvidence.ts` with helpers to:

```ts
export function createRunId(playableName: string): string {
  const safeName = playableName.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeName}`;
}

export function summarizeFailedChecks(checks: { name: string; status: string }[]): string | undefined {
  const failed = checks.filter((check) => check.status === "fail").map((check) => check.name);
  return failed.length > 0 ? `Failed checks: ${failed.join(", ")}` : undefined;
}
```

- [ ] **Step 4: Implement Playwright runner**

Create `src/harness/runPlayableQa.ts`. It must:

```ts
import { chromium, type Browser, type Page } from "@playwright/test";
```

Use a single Chromium browser per run, `page.goto(fileUrl)`, event listeners for `console` and `pageerror`, and check names matching the catalog:

```text
page loaded
playable_loaded event
instruction clarity
first interaction event
progress event
visible progress changed
end card visible
cta visible
cta clickable
console errors absent
```

The runner should compute final status:

```ts
function statusFromChecks(checks: QaCheckResult[], expectedStatus: "pass" | "fail" | "warning"): QaStatus {
  if (expectedStatus === "warning") return checks.some((check) => check.status === "fail") ? "fail" : "warning";
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "pass";
}
```

For `misleading-instruction`, add a warning check when the instruction text contains `drag` while scripted clicks work.

- [ ] **Step 5: Implement CLI**

Create `src/harness/cli.ts` with mode parsing:

```ts
const mode = process.argv[2] ?? "all";
```

Modes:

```text
good -> run only good
bugs -> run all non-good variants
all -> run every case
```

Print one line per playable:

```text
PASS good qa_reports/runs/<runId>/report.json
FAIL hidden-cta qa_reports/runs/<runId>/report.json
```

Exit non-zero only when an actual outcome does not match the expected profile. Seeded expected failures should not make `qa:bugs` or `qa:all` fail.

- [ ] **Step 6: Run harness tests and commands**

Run:

```bash
npx playwright install chromium
npm test -- tests/harness.test.ts
npm run qa:good
npm run qa:bugs
npm run qa:all
```

Expected: all commands succeed; good passes; seeded bugs produce expected fail/warning reports.

- [ ] **Step 7: Commit and PR**

Run:

```bash
git add src/harness tests/harness.test.ts
git commit -m "feat: add deterministic playable qa harness"
git push -u origin feat/qa-harness
gh pr create --base main --head feat/qa-harness --title "feat: add deterministic playable qa harness" --body "Adds Playwright QA execution, evidence capture, CLI modes, and seeded bug outcome tests."
```

---

### Task 5: Skill Bundle And Boundary Documentation

**Files:**
- Create: `.claude/skills/modeling-playable-experience/SKILL.md`
- Create: `.claude/skills/routing-qa-layer-strategy/SKILL.md`
- Create: `.claude/skills/designing-computer-use-evaluator/SKILL.md`
- Create: `.claude/skills/defining-evidence-harness/SKILL.md`
- Create: `.claude/skills/triaging-playable-failures/SKILL.md`
- Create: `docs/skill-boundaries.md`

- [ ] **Step 1: Start isolated branch**

Run:

```bash
git checkout main
git pull --ff-only
git worktree add .worktrees/feat-skill-bundle -b feat/skill-bundle
cd .worktrees/feat-skill-bundle
```

- [ ] **Step 2: Create concise SKILL.md files**

Each skill frontmatter must match its folder:

```yaml
---
name: modeling-playable-experience
description: Use when an agent needs to turn a playable brief, screenshot set, or toy implementation into a player-facing QA contract.
---
```

Use the required section template from the design. Keep each skill under 900 words. Put safety/permissions detail only in `defining-evidence-harness`.

- [ ] **Step 3: Preserve one artifact per skill**

Each `# Produces` section must contain exactly one of:

```text
playable contract
QA ownership map
computer-use evaluator charter
run contract / evidence harness spec
normalized failure record
```

Each `# Never produces` section must include adjacent artifacts it does not own.

- [ ] **Step 4: Create boundary doc**

Create `docs/skill-boundaries.md` with:

```text
one-artifact-per-skill rule
primary artifact table
never-produces boundary table
responsibility matrix
```

Responsibility matrix columns:

```text
define playable anatomy
choose deterministic vs perceptual QA
design computer-use behavior constraints
define trace/log artifacts
classify failures
propose repair path
define sandbox/safety boundary
decide when human review is needed
decide when live metrics are needed
```

Every responsibility must have one primary owner.

- [ ] **Step 5: Manual boundary check**

Run:

```bash
rg -n "Playwright|permission|severity|patch|computer use" .claude/skills docs/skill-boundaries.md
```

Expected:

```text
modeling skill does not mention Playwright
computer-use skill does not decide whether to use computer use
triage skill does not write patches
safety language concentrates in defining-evidence-harness
```

- [ ] **Step 6: Commit and PR**

Run:

```bash
git add .claude/skills docs/skill-boundaries.md
git commit -m "feat: add playable qa agent skills"
git push -u origin feat/skill-bundle
gh pr create --base main --head feat/skill-bundle --title "feat: add playable qa agent skills" --body "Adds five bounded Claude/Codex skills and the skill responsibility matrix."
```

---

### Task 6: Skill Eval Fixtures And Runner

**Files:**
- Create: `evals/skill-activation-cases.json`
- Create: `evals/pairwise-confusion-cases.json`
- Create: `evals/negative-control-cases.json`
- Create: `src/skill-evals/evalTypes.ts`
- Create: `src/skill-evals/runSkillEvals.ts`
- Create: `tests/skill-evals.test.ts`

- [ ] **Step 1: Start isolated branch**

Run:

```bash
git checkout main
git pull --ff-only
git worktree add .worktrees/feat-skill-evals -b feat/skill-evals
cd .worktrees/feat-skill-evals
```

- [ ] **Step 2: Write fixtures**

Positive fixtures: at least two cases per skill with:

```json
{
  "id": "modeling-001",
  "prompt": "Given this toy playable brief, map the must-pass user journey and observable states.",
  "expectedSkill": "modeling-playable-experience",
  "expectedArtifact": "playable contract"
}
```

Pairwise fixtures: at least these adjacent pairs:

```text
modeling vs strategy
strategy vs computer-use evaluator
strategy vs evidence harness
evidence harness vs triage
modeling vs triage
```

Negative controls: at least four script-shaped prompts, including:

```text
Run Playwright QA.
Capture screenshots.
Start the local server.
Inject the hidden CTA bug.
```

- [ ] **Step 3: Write failing eval tests**

Create `tests/skill-evals.test.ts` that imports `runSkillEvalSuite()` and asserts:

```ts
expect(result.status).toBe("pass");
expect(result.checks.some((check) => check.name.includes("overlap"))).toBe(true);
```

- [ ] **Step 4: Implement eval types and runner**

Create `src/skill-evals/evalTypes.ts` with fixture/result types.

Create `src/skill-evals/runSkillEvals.ts` that:

```text
reads .claude/skills/*/SKILL.md
parses YAML-like frontmatter without adding a dependency
checks required sections
extracts Produces and Never produces sections
validates JSON fixtures
computes token Jaccard overlap for each pair
checks overlong files
checks ownership anti-pattern phrases
prints a clear pass/fail report
exits 1 on failure when run as CLI
```

Use a Jaccard helper:

```ts
export function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (value: string) => new Set(value.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []);
  const left = tokenize(a);
  const right = tokenize(b);
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}
```

Fail above an overlap threshold of `0.42` unless the overlapping words are section headings.

- [ ] **Step 5: Run eval tests and CLI**

Run:

```bash
npm test -- tests/skill-evals.test.ts
npm run eval:skills
```

Expected: eval suite passes and prints all checks.

- [ ] **Step 6: Commit and PR**

Run:

```bash
git add evals src/skill-evals tests/skill-evals.test.ts
git commit -m "feat: add skill boundary evals"
git push -u origin feat/skill-evals
gh pr create --base main --head feat/skill-evals --title "feat: add skill boundary evals" --body "Adds positive, negative, and pairwise skill fixtures plus deterministic overlap and boundary checks."
```

---

### Task 7: Docs, Prompts, README, And Demo Script

**Files:**
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/playable-contract.md`
- Create: `docs/qa-layering.md`
- Create: `docs/computer-use-evaluator.md`
- Create: `docs/interview-demo-guide.md`
- Create: `prompts/computer-use-naive-user-evaluator.md`
- Create: `prompts/perceptual-qa-report-schema.md`
- Create: `prompts/failure-analysis-agent.md`
- Create: `src/demo/runDemo.ts`

- [ ] **Step 1: Start isolated branch**

Run:

```bash
git checkout main
git pull --ff-only
git worktree add .worktrees/feat-docs-demo -b feat/docs-demo
cd .worktrees/feat-docs-demo
```

- [ ] **Step 2: Create README**

README must include:

```text
what this repo is
why playable QA needs layered evaluation
why computer use is not the first layer
install commands
deterministic QA commands
skill eval command
demo command
generated artifacts
agentic engineering mapping
out of scope
```

- [ ] **Step 3: Create required docs**

Use the design doc as source. `docs/computer-use-evaluator.md` must include an optional Claude Code auth/status exercise:

```bash
claude --version
claude auth status
```

If those commands are unavailable, instruct the user to skip the exercise and use the provided prompts manually. Do not include or request tokens.

- [ ] **Step 4: Create prompts**

`prompts/computer-use-naive-user-evaluator.md` must instruct the agent to:

```text
act like a first-time user
use only visible UI
do not inspect source code
use limited time/actions
report confusion
verify after each action
produce structured result
```

`prompts/perceptual-qa-report-schema.md` must include the JSON schema shape from the spec.

`prompts/failure-analysis-agent.md` must tell the agent to inspect evidence, classify failure, assign severity/confidence, recommend owner/action, and define rerun rule.

- [ ] **Step 5: Implement demo runner**

Create `src/demo/runDemo.ts` that:

```text
runs npm run qa:good
runs npm run qa:bugs
runs npm run eval:skills
prints report root locations
prints a concise interview talk track
exits non-zero if any child command fails
```

Use `node:child_process` `spawnSync` with inherited stdio.

- [ ] **Step 6: Run demo**

Run:

```bash
npm run demo
```

Expected: compact end-to-end demo passes.

- [ ] **Step 7: Commit and PR**

Run:

```bash
git add README.md docs prompts src/demo/runDemo.ts
git commit -m "docs: add interview demo guide"
git push -u origin feat/docs-demo
gh pr create --base main --head feat/docs-demo --title "docs: add interview demo guide" --body "Adds README, architecture docs, prompts, optional Claude Code hands-on notes, and demo runner."
```

---

### Task 8: CI, Final Verification, And Public Repo Polish

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` if final command output needs clarification.

- [ ] **Step 1: Start isolated branch**

Run:

```bash
git checkout main
git pull --ff-only
git worktree add .worktrees/feat-ci-polish -b feat/ci-polish
cd .worktrees/feat-ci-polish
```

- [ ] **Step 2: Add GitHub Actions workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm test
      - run: npm run eval:skills
      - run: npm run qa:all
```

- [ ] **Step 3: Run full local verification**

Run:

```bash
npm test
npm run eval:skills
npm run qa:all
npm run demo
```

Expected: all commands pass.

- [ ] **Step 4: Commit and PR**

Run:

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: add qa lab verification workflow"
git push -u origin feat/ci-polish
gh pr create --base main --head feat/ci-polish --title "ci: add qa lab verification workflow" --body "Adds CI that runs tests, skill evals, and deterministic QA."
```

- [ ] **Step 5: Verify main and publish state**

Run from the primary repo:

```bash
git checkout main
git pull --ff-only
npm test
npm run eval:skills
npm run qa:all
npm run demo
gh repo view ShimmyBezalel/playable-qa-agent-lab --web=false
```

Expected: all local commands pass and GitHub repo is visible.

---

## Final Self-Review Checklist

- [ ] `npm test` passes.
- [ ] `npm run eval:skills` passes.
- [ ] `npm run qa:good` passes and writes a report.
- [ ] `npm run qa:bugs` succeeds while showing expected seeded failures/warnings.
- [ ] `npm run qa:all` succeeds.
- [ ] `npm run demo` succeeds.
- [ ] `qa_reports/runs/` is ignored.
- [ ] `.worktrees/` is ignored.
- [ ] Five skill files exist with valid frontmatter and required sections.
- [ ] No two skills produce the same artifact.
- [ ] Skill evals would fail if skill bodies overlap heavily.
- [ ] README supports a five-minute interview demo.
- [ ] CI exists and requires no secrets.
- [ ] Public repo URL is `https://github.com/ShimmyBezalel/playable-qa-agent-lab`.
