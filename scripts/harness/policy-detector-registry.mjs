function fencedCode(text) {
  const source = String(text ?? "").replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const blocks = [];
  let collecting = false;
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!collecting && trimmed.startsWith("```")) {
      collecting = true;
      current = [];
      continue;
    }

    if (collecting && trimmed.startsWith("```")) {
      blocks.push(current.join("\n"));
      collecting = false;
      current = [];
      continue;
    }

    if (collecting) current.push(line);
  }

  return blocks.join("\n");
}

function hasDestructiveShellExample(text) {
  const block = fencedCode(text);
  if (!block) return false;

  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith("rm -rf")) return true;
    if (trimmed.startsWith("git reset --hard")) return true;
    if (trimmed.startsWith("git clean -d") || trimmed.startsWith("git clean -f")) return true;
  }
  return false;
}

function convergenceBlockIsUnbounded(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  return lines.some((line, index) => {
    if (!/^\s*kind\s*:\s*["']?convergence["']?\s*$/i.test(line)) return false;
    const window = lines.slice(index, index + 8).join("\n");
    return !/maxIterations\s*:\s*([1-9]\d*)\s*$/im.test(window);
  });
}

function ambiguousGateStatus(text) {
  return /\b(?:gate|stage)\b[\s\S]{0,120}?status\s*:\s*["']?(?:pass|ok|done)["']?/i.test(String(text ?? "")) && !/verdict|terminalState/i.test(text);
}

const RULES = [
  { id: "unsafe-shell-example", severity: "error", scope: "document", advisory: false, test: (text) => /\beval\s*\(|child_process\.exec\s*\(/i.test(text), message: "Document contains an unsafe shell/eval example." },
  { id: "unbounded-loop-field", severity: "error", scope: "document", advisory: false, test: (text) => /maxIterations\s*:\s*(?:0|null|undefined|-\d+)/i.test(text), message: "Loop example has no positive iteration bound." },
  { id: "ambiguous-gate-status", severity: "warn", scope: "document", advisory: true, test: ambiguousGateStatus, message: "Gate status wording is ambiguous; prefer an explicit verdict or terminal state." },
  { id: "destructive-shell-example", severity: "warn", scope: "document", advisory: true, test: hasDestructiveShellExample, message: "Fenced example contains a destructive shell command; explain safeguards or use a non-destructive alternative." },
  { id: "convergence-loop-unbounded", severity: "error", scope: "document", advisory: false, test: convergenceBlockIsUnbounded, message: "Convergence loop examples must declare a positive maxIterations bound." },
];

const ALLOWED_SEVERITIES = new Set(["warn", "error"]);
const ALLOWED_SCOPES = new Set(["document", "repository"]);

for (const rule of RULES) {
  if (!rule.id || !ALLOWED_SEVERITIES.has(rule.severity) || !ALLOWED_SCOPES.has(rule.scope) || typeof rule.advisory !== "boolean" || typeof rule.message !== "string" || typeof rule.test !== "function") {
    throw new Error(`invalid policy detector metadata: ${rule.id ?? "<missing-id>"}`);
  }
  if (rule.advisory && rule.severity !== "warn") {
    throw new Error(`advisory policy detector must use warn severity: ${rule.id}`);
  }
}

export function listPolicyRules(scope = null) {
  return RULES.filter((rule) => !scope || rule.scope === scope).map(({ id, severity, scope: ruleScope, advisory, message }) => ({ id, severity, scope: ruleScope, advisory, message }));
}

export function runPolicyDetectors(text, scope = "document") {
  return RULES.filter((rule) => rule.scope === scope).flatMap((rule) => rule.test(String(text ?? "")) ? [{ id: rule.id, severity: rule.severity, scope: rule.scope, advisory: rule.advisory, message: rule.message }] : []);
}
