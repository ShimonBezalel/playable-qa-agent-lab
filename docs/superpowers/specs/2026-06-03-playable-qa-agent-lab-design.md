# Playable QA Agent Lab Design

Date: 2026-06-03

## Purpose

Build a public, runnable GitHub repository named `playable-qa-agent-lab` for interview preparation around playable-ad QA, agentic engineering, Claude/Codex skills, deterministic browser automation, and evidence-backed evaluation.

The repository should feel like a serious small lab, not a showcase of disconnected artifacts. Its demo should prove that a local playable can be modeled, tested, broken in seeded ways, reported with evidence, and connected to a reusable five-skill agent bundle with clean boundaries.

## Success Criteria

- `npm install`, `npm test`, `npm run qa:all`, `npm run eval:skills`, and `npm run demo` work locally.
- One good playable passes deterministic QA.
- Six seeded bug playables fail or warn in the expected ways.
- JSON and Markdown reports are written under `qa_reports/runs/<runId>/`.
- Screenshots and useful debugging artifacts are captured.
- Five `.claude/skills/.../SKILL.md` files exist, are concise, and have non-overlapping responsibilities.
- Skill evals check structure, artifact ownership, fixture validity, negative controls, pairwise confusion cases, and body overlap.
- CI runs tests, skill evals, and deterministic QA.
- The final repo is public under `ShimmyBezalel/playable-qa-agent-lab`.
- No secrets, ad-platform credentials, real spend, or required external LLM API integration are introduced.

## Non-Goals

- Do not build a production ad platform.
- Do not integrate with real ad networks.
- Do not require external Claude, Codex, or Anthropic API keys for the repo to pass.
- Do not implement an unsupervised live computer-use agent as part of the MVP.
- Do not let the skill bundle become a generic manifesto. Each skill must own one reasoning artifact.

## Architecture

The repo has five connected subsystems.

1. **Playable sandbox.** Static HTML/CSS/JS pages define one good playable and six seeded bug variants. Each variant uses the same basic DOM and instrumentation contract so the QA harness can compare outcomes.
2. **Deterministic QA harness.** A TypeScript Playwright runner opens each playable, captures console/page errors, performs scripted interactions, checks events and visible states, and writes evidence.
3. **Skill bundle.** Five Claude/Codex-style skills live in `.claude/skills/`, each producing exactly one artifact.
4. **Skill evals.** A deterministic eval runner validates skill structure, boundary sharpness, fixture correctness, negative controls, and overlap.
5. **Docs, prompts, demo, CI, and GitHub publishing.** Documentation explains the layered QA judgment, prompt files support manual agent use, CI proves repeatability, and the demo path can be shown in five minutes.

## Playable Contract

The good playable is a small "collect 3 coins" ad-like interaction.

Required player-facing flow:

- First frame shows a clear instruction.
- One obvious interactive object is visible.
- The first valid user action emits `first_interaction`.
- Each successful interaction emits `progress` and visibly updates progress or score.
- After 3 successful interactions, an end card appears and emits `end_card_shown`.
- The CTA is visible, enabled, clickable, and emits `cta_clicked`.

Required instrumentation events:

- `playable_loaded`
- `first_interaction`
- `progress`
- `end_card_shown`
- `cta_clicked`

The implementation should prefer semantic roles, labels, stable `data-testid` attributes, and visible state that can be checked without brittle pixel matching.

## Seeded Bugs

Each bug variant is a standalone static page under `playables/bugs/<bug-name>/`.

| Variant | Expected deterministic outcome |
| --- | --- |
| `blocked-click-target` | Fail because first interaction or progress never happens. |
| `hidden-cta` | Fail because the CTA is hidden, offscreen, disabled, or not clickable. |
| `misleading-instruction` | Warn because scripted QA can still click, while perceptual/computer-use review should flag user confusion. |
| `missing-end-card` | Fail because progress reaches target but no end card appears. |
| `frozen-feedback` | Fail because visible progress does not update even if internal events may fire. |
| `console-error` | Fail because console or page errors are captured. |

## QA Harness

The harness should expose scripts for:

- `npm run qa:good`
- `npm run qa:bugs`
- `npm run qa:all`
- `npm run demo`

For each playable run, it should:

- create a unique run ID.
- open the playable through a local static route or file-compatible URL.
- capture console messages and page errors.
- perform the scripted interaction sequence.
- validate required instrumentation events.
- validate visible progress changes.
- validate end-card appearance.
- validate CTA visibility and clickability.
- capture screenshots at meaningful checkpoints.
- capture a Playwright trace when practical without making CI flaky.
- write JSON and Markdown reports.

The harness should use Playwright in the way the current docs recommend: user-facing locators where possible, web-first assertions, isolated runs, and traces for debugging rather than only screenshots.

## Report Schema

`QaRunReport` should include:

- `runId`
- `playableName`
- `playablePath`
- `startedAt`
- `finishedAt`
- `status`: `pass`, `fail`, or `warning`
- `checks`
- `consoleMessages`
- `screenshots`
- optional `tracePath`
- optional `failureSummary`
- optional `suggestedFailureClass`

`QaCheckResult` should include:

- `name`
- `status`: `pass`, `fail`, `warning`, or `skipped`
- optional `evidence`
- optional `details`

Reports live under `qa_reports/runs/<runId>/`. Generated reports are ignored by git except `qa_reports/.gitkeep`.

## Skill Bundle

The skill bundle contains exactly five skills.

| Skill directory | Primary artifact | Never produces |
| --- | --- | --- |
| `modeling-playable-experience` | playable contract | QA ownership map, evaluator prompt, permission policy, failure triage report |
| `routing-qa-layer-strategy` | QA ownership map | evaluator charter, trace/log schema, code patch, severity classification |
| `designing-computer-use-evaluator` | computer-use evaluator charter | QA routing map, Playwright locator strategy, permission policy, repair patch |
| `defining-evidence-harness` | run contract / evidence harness spec | playable UX contract, QA ownership decision, failure class/severity, computer-use persona |
| `triaging-playable-failures` | normalized failure record | first-pass playable contract, QA strategy, permission policy, automatic code patch |

Every skill must use this section template:

- `# Purpose`
- `# Use when`
- `# Do not use when`
- `# Produces`
- `# Never produces`
- `# Core principles`
- `# Decision rules`
- `# Inputs`
- `# Outputs`
- `# Definition of done`
- `# Failure modes`
- `# Example activations`
- `# Anti-patterns`

The files should be concise, operational, and trigger-rich. The design should follow Claude skill guidance that `SKILL.md` files are discovered from `.claude/skills/` and that metadata descriptions are a key activation signal.

## Skill Evals

The eval system is deterministic and does not call an LLM. It should be strong enough to support the interview claim that the skill bundle has clean activation boundaries.

Fixture files:

- `evals/skill-activation-cases.json`
- `evals/pairwise-confusion-cases.json`
- `evals/negative-control-cases.json`

The runner should validate:

- all required skill files exist.
- each skill has valid frontmatter with `name` and `description`.
- each skill has all required sections.
- every skill has `Produces`, `Never produces`, and `Do not use when`.
- each primary artifact is unique.
- positive fixtures reference existing skills and expected artifacts.
- pairwise fixtures reference existing skills and distinct adjacent skills.
- negative controls are script/command-shaped and expect no skill.
- no skill body is overlong.
- no two skills have excessive token/Jaccard overlap.
- no skill repeats another skill's ownership in a way that blurs boundaries.

Specific anti-overlap checks should catch:

- the computer-use evaluator skill deciding whether to use computer use.
- the failure triage skill writing patches.
- the modeling skill discussing Playwright ownership.
- duplicated safety boilerplate outside the evidence-harness skill.
- any two skills producing the same artifact.

`npm run eval:skills` should print a clear pass/fail report with actionable diagnostics.

## Documentation And Prompts

Required docs:

- `docs/architecture.md`
- `docs/playable-contract.md`
- `docs/qa-layering.md`
- `docs/computer-use-evaluator.md`
- `docs/skill-boundaries.md`
- `docs/interview-demo-guide.md`

Required prompts:

- `prompts/computer-use-naive-user-evaluator.md`
- `prompts/perceptual-qa-report-schema.md`
- `prompts/failure-analysis-agent.md`

The docs should preserve the interview framing: deterministic browser QA first, screenshot/evidence capture second, optional computer-use/perceptual evaluation above that, and human/live metrics outside the local lab.

## Claude Code And Computer-Use Hands-On Track

The repo should not depend on external Claude Computer Use, but interview prep benefits from hands-on experience. Add a supervised optional track:

- verify local Claude Code installation/auth status with non-secret commands.
- document the result in the interview guide without printing tokens or secrets.
- include an optional exercise that asks Claude Code to inspect the generated reports and reason about which seeded bug belongs to which failure class.
- if a first-party computer-use feature or adapter is available locally without new secrets, document a minimal naive-user exercise against the good playable and `misleading-instruction` variant.
- if it is unavailable, document the fallback: use the provided computer-use prompt manually and explain why the repo keeps computer use optional.

This track must not block `npm test`, `npm run qa:all`, `npm run eval:skills`, CI, or the public GitHub repo.

## Test Plan

Minimum tests:

- good playable passes deterministic QA.
- every required seeded bug fails or warns in the expected way.
- reports include all required fields.
- screenshots are saved.
- console errors are detected.
- skill evals pass.
- demo script runs the compact flow.

The deterministic QA should be behavior-based rather than pixel-perfect. Visual evidence is for debugging and higher-layer review, not brittle screenshot baselines.

## CI

GitHub Actions should:

- check out the repo.
- use Node 20.
- run `npm ci`.
- install Playwright Chromium dependencies.
- run `npm test`.
- run `npm run eval:skills`.
- run `npm run qa:all`.

CI should not require secrets.

## Implementation Workflow

After this design is approved and reviewed, invoke `superpowers:writing-plans` to produce the implementation plan. Then use `superpowers:subagent-driven-development` because the work can be split into mostly independent tasks.

Proposed subagent task boundaries:

1. repo/tooling/bootstrap.
2. playable sandbox and bug variants.
3. QA harness, report types, and report writer.
4. harness/report tests.
5. skill bundle and skill-boundary docs.
6. skill eval fixtures and eval runner.
7. docs, prompts, README, and demo guide.
8. CI, final demo validation, and GitHub publishing.

Each task should receive a spec-compliance review and then a code-quality review before moving on.

## GitHub Publishing

After local validation passes:

- initialize git if needed.
- commit the implementation.
- create or inspect `ShimmyBezalel/playable-qa-agent-lab`.
- push safely without overwriting unrelated work.

If the repo already exists, inspect it first and avoid destructive operations.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Spec-max turns into uncontrolled overbuild | Treat spec-max as deeper proof of the requested artifacts, not production platform expansion. |
| Skill evals become superficial | Add structural, fixture, artifact, ownership, length, and overlap checks. |
| Computer use distracts from runnable QA | Keep it optional and supervised; deterministic QA remains the local/CI backbone. |
| Seeded bugs are too hard to detect deterministically | Use explicit expected profiles and mark semantic confusion as warning where appropriate. |
| Reports are pass/fail only | Include screenshots, console messages, check details, failure summary, and suggested failure class. |
| GitHub publishing introduces auth/token risk | Use existing `gh` auth only; never ask for, print, store, or create tokens. |

## Review Gate

Before implementation starts, the user should review this design file. After approval, the next step is a written implementation plan, followed by subagent-driven execution.
