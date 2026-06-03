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
  {
    name: "blocked-click-target",
    relativePath: "playables/bugs/blocked-click-target/index.html",
    expected: {
      status: "fail",
      failureClass: "logic/state bug",
      requiredFailedChecks: ["first interaction event", "progress event"]
    }
  },
  {
    name: "hidden-cta",
    relativePath: "playables/bugs/hidden-cta/index.html",
    expected: {
      status: "fail",
      failureClass: "broken CTA flow",
      requiredFailedChecks: ["cta visible", "cta clickable"]
    }
  },
  {
    name: "misleading-instruction",
    relativePath: "playables/bugs/misleading-instruction/index.html",
    expected: {
      status: "warning",
      failureClass: "discoverability/UX confusion",
      warningChecks: ["instruction clarity"]
    }
  },
  {
    name: "missing-end-card",
    relativePath: "playables/bugs/missing-end-card/index.html",
    expected: {
      status: "fail",
      failureClass: "missing end state",
      requiredFailedChecks: ["end card visible"]
    }
  },
  {
    name: "frozen-feedback",
    relativePath: "playables/bugs/frozen-feedback/index.html",
    expected: {
      status: "fail",
      failureClass: "visual/rendering bug",
      requiredFailedChecks: ["visible progress changed"]
    }
  },
  {
    name: "console-error",
    relativePath: "playables/bugs/console-error/index.html",
    expected: {
      status: "fail",
      failureClass: "logic/state bug",
      requiredFailedChecks: ["console errors absent"]
    }
  }
];

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

export function playableAbsolutePath(playable: PlayableCase): string {
  return path.join(repoRoot(), playable.relativePath);
}
