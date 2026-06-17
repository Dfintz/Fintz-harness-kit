#!/usr/bin/env node
/**
 * Prompt router — kit-shipped policy helper for sending prompts through the harness stage machine.
 *
 * It does not intercept editor prompts on its own. Instead it gives operators and wrapper commands
 * a deterministic stage/model handoff plan that mirrors the harness environment policy.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const configPath = join(repoRoot, "harness.config.json");
const runsDir = join(repoRoot, ".github", "harness", "runs");
const promptPacksDir = join(runsDir, "prompt-packs");

const STAGE_PROMPT_METADATA = {
  understand: {
    title: "Understand",
    outputFile: "understand-notes.md",
    deliverable: "Component/layer impact map and graph freshness status.",
    instructions: [
      "Load the understand-process skill before analysis.",
      "Run the graph freshness gate and document whether it is up to date or blocked.",
      "Map changed components, one-hop affected components, affected layers, and hotspots.",
      "Record missing context and reduced-confidence assumptions explicitly.",
    ],
  },
  architect: {
    title: "Architect",
    outputFile: "architecture-brief.md",
    deliverable:
      "Architecture Brief with gate decisions, files, constraints, Do-NOTs, assumptions.",
    instructions: [
      "Read understand-notes.md first.",
      "Run gates 1-5 (and gate 4b when applicable) with explicit pass/fail reasoning.",
      "Define exactly which files change and why they belong there.",
      "Persist the settled brief in the repository memory briefs folder when implementation proceeds.",
    ],
  },
  "architect-challenge": {
    title: "Architect Challenge",
    outputFile: "architect-challenge-findings.md",
    deliverable:
      "Cross-model challenge of the Brief: agree/dispute per gate, plus a uniform VERDICT (APPROVED | REVISE). Material disputes route back to Architect; accepted ones are logged as risks.",
    instructions: [
      "Read architecture-brief.md as a hostile, independent reviewer — do not assume it is correct.",
      "Re-run gates 1-5 (and gate 4b when applicable) against the Brief; emit AGREE/DISPUTE per gate with concrete evidence.",
      "Quote the part of the Brief you object to; do not edit the Brief (read-only).",
      "Close with VERDICT: APPROVED or VERDICT: REVISE listing what still blocks it.",
      "Run via plan-review --lens plan against the persisted Brief.",
    ],
  },
  implement: {
    title: "Implement",
    outputFile: "implementation-notes.md",
    deliverable:
      "Applied changes plus pre-implementation and self-review notes.",
    instructions: [
      "Read architecture-brief.md and stay within its ownership boundaries.",
      "Load relevant domain skills before editing.",
      "Complete pre-implementation discovery, then apply the smallest rooted code change.",
      "Record validation commands run and self-review checklist outcomes.",
    ],
  },
  "review-breadth": {
    title: "Review Breadth",
    outputFile: "review-breadth-findings.md",
    deliverable:
      "Severity-tagged findings covering correctness, regressions, tests, and standards.",
    instructions: [
      "Read architecture-brief.md and implementation-notes.md.",
      "List findings first, ordered by severity, with concrete file references.",
      "If no findings exist, state that explicitly and note residual gaps.",
    ],
  },
  "review-depth": {
    title: "Review Depth",
    outputFile: "review-depth-findings.md",
    deliverable:
      "Gate verdicts and structural findings checked against the Architecture Brief.",
    instructions: [
      "Read architecture-brief.md and review-breadth-findings.md.",
      "Re-run the architectural gates against the implemented diff.",
      "Trace ownership, boundaries, and systemic risks.",
    ],
  },
  feedback: {
    title: "Feedback",
    outputFile: "feedback-verdict.md",
    deliverable:
      "Verdict table, decision updates, and refreshed next-steps summary.",
    instructions: [
      "Read Architecture Brief plus both review outputs.",
      "Produce a verdict table with accepted/rejected/deferred findings.",
      "Update the brief if decisions changed.",
      "Refresh next-steps.md with what shipped, what remains, and next loop focus.",
    ],
  },
};

const SIDECAR_PROMPT_METADATA = {
  scout: {
    title: "Scout",
    promptFile: "optional-scout.md",
    outputFile: "scout-notes.md",
    recommendedModel: "claude-opus-4.8",
    purpose:
      "Parallel research sidecar for reuse opportunities, missing context, and adjacent risks.",
    timing:
      "Run any time after pack generation; highest value before or during Understand and Architect.",
    instructions: [
      "Read manifest.json and next-steps.md first.",
      "Find relevant patterns, lessons, docs, and adjacent surfaces the main chain may miss.",
      "Prefer actionable findings with concrete file references.",
      "Write distilled output to scout-notes.md.",
    ],
  },
  challenger: {
    title: "Challenger",
    promptFile: "optional-challenger.md",
    outputFile: "challenger-findings.md",
    recommendedModel: "claude-opus-4.8",
    purpose:
      "Independent challenge sidecar that pressure-tests assumptions, risks, and review blind spots.",
    timing:
      "Best run after architecture or implementation artifacts exist; can run in parallel with breadth review.",
    instructions: [
      "Read manifest.json plus architecture/implementation notes when available.",
      "Challenge assumptions, boundaries, missing tests, and safety gaps.",
      "Focus on findings that could change plan, tests, or review outcomes.",
      "Write concise severity-oriented findings to challenger-findings.md.",
    ],
  },
};

function fail(message, code = 2) {
  process.stderr.write(`[prompt-router] ${message}\n`);
  process.exit(code);
}

export function loadConfig() {
  if (!existsSync(configPath)) {
    fail(`missing harness.config.json at ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json" || arg === "--stdin" || arg === "--help") {
      flags[arg.slice(2)] = true;
    } else if (arg === "--out") {
      flags.out = argv[++i];
    } else if (arg === "--profile") {
      flags.profile = argv[++i];
    } else if (arg === "--task") {
      flags.task = argv[++i];
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function readStdin() {
  return new Promise((resolveText) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveText(data));
  });
}

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase();
}

function getModelAssignments(config) {
  return {
    implementer: config.models?.implementer?.model ?? "gpt-5.3-codex",
    reviewer: config.models?.reviewer?.model ?? "claude-opus-4.8",
    // Optional dedicated arbiter for Feedback. When unset, Feedback falls back to the implementer
    // model so it still differs from the reviewer it adjudicates. Set models.arbiter to a third
    // model that authored neither the review nor the implementation for true fresh-eyes separation.
    arbiter: config.models?.arbiter?.model || null,
  };
}

function getProfile(config, profileName) {
  if (!profileName) {
    return null;
  }

  const profile = config.routing?.profiles?.[profileName] ?? null;
  if (!profile) {
    fail(`unknown profile: ${profileName}`);
  }
  return profile;
}

function validateModelSeparation(config) {
  const { implementer, reviewer, arbiter } = getModelAssignments(config);
  const mustDiffer =
    config.routing?.requireDistinctReviewerAndImplementer !== false;
  if (mustDiffer && implementer === reviewer) {
    fail(
      `implementer and reviewer must be different models in this repo (both are ${implementer}). Update harness.config.json.`,
    );
  }
  return { implementer, reviewer, arbiter, feedback: arbiter ?? implementer };
}

// Per-stage independence pairs (shared with the config wizard so the rules never drift):
//  - the Architect Challenge must differ from the Architect (no grading your own plan),
//  - the reviewers must differ from the implementer,
//  - Feedback must differ from the reviewers it adjudicates.
export const STAGE_SEPARATION_PAIRS = [
  ["implement", "review-breadth"],
  ["implement", "review-depth"],
  ["architect-challenge", "architect"],
  ["feedback", "review-breadth"],
  ["feedback", "review-depth"],
];

/** Pure check: returns a list of human-readable separation violations for a stage->model map. */
export function stageSeparationErrors(routing) {
  const errors = [];
  for (const [a, b] of STAGE_SEPARATION_PAIRS) {
    if (routing[a] && routing[b] && routing[a] === routing[b]) {
      errors.push(
        `stage "${a}" and stage "${b}" must use different models (both are ${routing[a]})`,
      );
    }
  }
  return errors;
}

// Checked on the RESOLVED per-stage models so it holds whether routing comes from role defaults or
// explicit stageModels overrides.
function validateStageSeparation(routing, mustDiffer) {
  if (!mustDiffer) return;
  for (const e of stageSeparationErrors(routing)) {
    fail(`${e}; adjust routing.stageModels or the model roles.`);
  }
}

function buildModelRouting(config) {
  const { implementer, reviewer, feedback } = validateModelSeparation(config);
  const routing = {
    understand: reviewer,
    architect: reviewer,
    // Cross-model challenge of the Brief: the rival model pressure-tests the Architect's plan before
    // any code exists. Mirrors cross-model review, but at the cheapest point to fix a mistake.
    "architect-challenge": implementer,
    implement: implementer,
    "review-breadth": reviewer,
    "review-depth": reviewer,
    feedback,
    "build-fix": implementer,
    "test-fix": implementer,
  };
  // Optional benchmark-tuned per-stage assignment overlays the role defaults (see docs/HARNESS.md).
  const stageModels = config.routing?.stageModels ?? {};
  for (const [stage, model] of Object.entries(stageModels)) {
    if (model) routing[stage] = model;
  }
  validateStageSeparation(
    routing,
    config.routing?.requireDistinctReviewerAndImplementer !== false,
  );
  routing["cross-model-review"] = `${routing.implement} -> ${routing["review-depth"]}`;
  return routing;
}

function resolveTaskText(flags) {
  if (flags.task) {
    return flags.task;
  }

  if (flags._.length > 1) {
    return flags._.slice(1).join(" ");
  }

  return "";
}

export function planTask(taskText, config, options = {}) {
  const text = normalize(taskText);
  const routing = config.routing ?? {};
  const trivialKeywords = routing.trivialKeywords ?? [];
  const nonTrivialKeywords = routing.nonTrivialKeywords ?? [];
  const profileName = options.profile ?? null;
  const profile = getProfile(config, profileName);

  const trivialHit = trivialKeywords.find((keyword) => text.includes(keyword));
  const nonTrivialHit = nonTrivialKeywords.find((keyword) =>
    text.includes(keyword),
  );

  const trivial =
    !profile && Boolean(trivialHit) && !nonTrivialHit && text.length < 180;
  const stages =
    profile?.stages ??
    (trivial
      ? [routing.trivialStartsAt ?? "implement"]
      : (routing.nonTrivialStages ?? [
          "understand",
          "architect",
          "architect-challenge",
          "implement",
          "review-breadth",
          "review-depth",
          "feedback",
        ]));

  const modelRouting = buildModelRouting(config);

  let why;
  if (profile) {
    why = profile.description ?? `profile-selected handoff: ${profileName}`;
  } else if (trivial) {
    why = `matched trivial keyword: ${trivialHit}`;
  } else if (nonTrivialHit) {
    why = `matched non-trivial keyword: ${nonTrivialHit}`;
  } else {
    why =
      "default harness-first routing for any prompt that is not obviously trivial";
  }

  return {
    task: String(taskText ?? "").trim(),
    profile: profileName,
    mode: profile?.mode ?? (trivial ? "trivial" : "non-trivial"),
    why,
    stages,
    models: Object.fromEntries(
      stages.map((stage) => [
        stage,
        modelRouting[stage] ?? modelRouting.implement,
      ]),
    ),
    crossModelReview: modelRouting["cross-model-review"],
  };
}

function slugifyTask(taskText) {
  const slug = normalize(taskText)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "task";
}

function resolvePromptPackDir(slug, outDir) {
  const dirName = outDir ? slugifyTask(outDir) : slug;
  return join(promptPacksDir, dirName); // NOSONAR: sanitized filename under fixed prompt-packs root.
}

function packFilePath(packDir, fileName) {
  return join(packDir, fileName); // NOSONAR: constrained script output path.
}

function writePackFile(packDir, fileName, contents) {
  writeFileSync(packFilePath(packDir, fileName), contents, "utf8");
}

function buildPromptPack(route, outDir) {
  const slug = slugifyTask(route.task || route.profile || "task");
  const packDir = resolvePromptPackDir(slug, outDir);
  const stageFiles = route.stages.map((stage, index) => {
    const meta = STAGE_PROMPT_METADATA[stage] ?? {
      title: stage,
      outputFile: `${stage}.md`,
      deliverable: "Document output for this stage.",
      instructions: ["Follow the harness stage instructions for this step."],
    };
    return {
      stage,
      index: index + 1,
      model: route.models[stage] ?? "unspecified",
      promptFile: `${String(index + 1).padStart(2, "0")}-${stage}.md`,
      outputFile: meta.outputFile,
      title: meta.title,
      deliverable: meta.deliverable,
      instructions: meta.instructions,
    };
  });

  return {
    slug,
    packDir,
    route,
    stageFiles,
    sidecarFiles: Object.entries(SIDECAR_PROMPT_METADATA).map(
      ([key, meta]) => ({
        key,
        ...meta,
      }),
    ),
    nextStepsFile: "next-steps.md",
    logFile: "orchestrator-log.md",
    manifestFile: "manifest.json",
    readmeFile: "README.md",
    orchestratorFile: "orchestrator.md",
  };
}

function renderPromptPackReadme(pack) {
  const stageLines = pack.stageFiles
    .map(
      (stage) =>
        `- ${stage.promptFile} -> ${stage.outputFile} (${stage.title}; model ${stage.model})`,
    )
    .join("\n");
  const sidecarLines = pack.sidecarFiles
    .map(
      (sidecar) =>
        `- ${sidecar.promptFile} -> ${sidecar.outputFile} (optional ${sidecar.title}; model ${sidecar.recommendedModel})`,
    )
    .join("\n");

  return `# Harness Prompt Pack\n\nTask: ${pack.route.task}\n\nRoute: ${pack.route.stages.join(" -> ")}\n\nFiles:\n${stageLines}\n${sidecarLines}\n- ${pack.orchestratorFile} -> orchestrator control prompt\n- ${pack.nextStepsFile} -> rolling cycle memory\n- ${pack.logFile} -> delegation/completion log\n- ${pack.manifestFile} -> machine-readable plan\n`;
}

function renderOrchestratorPrompt(pack) {
  const stageTable = pack.stageFiles
    .map(
      (stage) =>
        `${stage.index}. ${stage.title} (${stage.model})\n   - Prompt: ${stage.promptFile}\n   - Required output: ${stage.outputFile}`,
    )
    .join("\n");
  const sidecarTable = pack.sidecarFiles
    .map(
      (sidecar) =>
        `- ${sidecar.title} (${sidecar.recommendedModel})\n  - Prompt: ${sidecar.promptFile}\n  - Optional output: ${sidecar.outputFile}\n  - Use when: ${sidecar.timing}`,
    )
    .join("\n");

  return `# Orchestrator Prompt\n\nYou are the harness orchestrator for this task:\n\n${pack.route.task}\n\nBefore doing anything:\n1. Read ${pack.nextStepsFile} if it already contains notes from a previous cycle.\n2. Treat ${pack.manifestFile} as the source of truth for file names and stage order.\n3. Append every delegation and completion event to ${pack.logFile}.\n\nExecution protocol:\n1. Follow this exact stage sequence and do not skip ahead:\n${stageTable}\n2. Do not start a stage until its upstream required output file exists and has substantive content.\n3. Keep implementation aligned with the repository harness contract and Architecture Brief.\n4. After feedback, refresh ${pack.nextStepsFile} with changed outcomes, top 3 next actions, and unresolved risks.\n\nOptional parallel sidecars:\n${sidecarTable}\n- Sidecars are advisory and do not replace canonical stage outputs.\n\nLoop discipline:\n- Reuse prior cycle memory rather than re-deriving settled decisions.\n- If a stage is blocked, record it and mark next action in ${pack.nextStepsFile}.\n- Prefer small, testable progress over reopening the whole plan.\n`;
}

function renderStagePrompt(pack, stageFile) {
  const requiredInputs = [];
  if (stageFile.index > 1) {
    requiredInputs.push(pack.stageFiles[stageFile.index - 2].outputFile);
  }
  // Implement and the Architect Challenge both work off the Brief, even when an upstream stage sits
  // between them and Architect — list it explicitly so it is never dropped.
  if (stageFile.stage === "implement" || stageFile.stage === "architect-challenge") {
    requiredInputs.push("architecture-brief.md");
  }
  if (stageFile.stage === "review-depth") {
    requiredInputs.push("review-breadth-findings.md");
  }
  if (stageFile.stage === "feedback") {
    requiredInputs.push(
      "review-breadth-findings.md",
      "review-depth-findings.md",
    );
  }

  const dedupedInputs = [...new Set(requiredInputs)];
  const requiredInputsBlock = dedupedInputs.length
    ? dedupedInputs.map((name) => `- ${name}`).join("\n")
    : "- manifest.json\n- next-steps.md (if present)";
  const instructionBlock = stageFile.instructions
    .map((line) => `- ${line}`)
    .join("\n");

  return `# Stage ${stageFile.index}: ${stageFile.title}\n\nTask: ${pack.route.task}\nModel owner: ${stageFile.model}\nRoute profile: ${pack.route.profile ?? pack.route.mode}\n\nRequired inputs:\n${requiredInputsBlock}\n\nRequired output:\n- ${stageFile.outputFile}\n\nDeliverable:\n${stageFile.deliverable}\n\nInstructions:\n${instructionBlock}\n\nGuardrails:\n- Follow the repository harness stage contract for ${stageFile.stage}.\n- Keep output grounded in real files and repository state.\n- Do not perform the next stage in the same session; stop after writing ${stageFile.outputFile}.\n`;
}

function renderNextStepsTemplate(pack) {
  return `# Next Steps\n\n## Latest cycle\n- Task: ${pack.route.task}\n- Status: Not started\n\n## Top 3 next actions\n1. Run ${pack.stageFiles[0].promptFile}.\n2. Decide whether ${pack.sidecarFiles[0].promptFile} or ${pack.sidecarFiles[1].promptFile} adds value this cycle.\n3. Capture Architecture Brief before implementation.\n\n## Open risks\n- Knowledge graph freshness or missing context blockers go here.\n\n## Optional sidecar notes\n- Scout output: ${pack.sidecarFiles[0].outputFile}\n- Challenger output: ${pack.sidecarFiles[1].outputFile}\n\n## Notes from previous cycles\n- Add carry-forward notes here for the next orchestrator run.\n`;
}

function renderOrchestratorLog(pack) {
  return `# Orchestrator Log\n\n- ${new Date().toISOString()} generated prompt pack for task: ${pack.route.task}\n- Optional sidecars available: ${pack.sidecarFiles.map((s) => s.title).join(", ")}\n`;
}

function renderSidecarPrompt(pack, sidecar) {
  const suggestedInputs = [pack.manifestFile, pack.nextStepsFile];
  if (sidecar.key === "challenger") {
    suggestedInputs.push("architecture-brief.md", "implementation-notes.md");
  }
  const suggestedInputsBlock = suggestedInputs
    .map((name) => `- ${name}`)
    .join("\n");
  const instructionsBlock = sidecar.instructions
    .map((line) => `- ${line}`)
    .join("\n");

  return `# Optional Sidecar: ${sidecar.title}\n\nTask: ${pack.route.task}\nRecommended model: ${sidecar.recommendedModel}\n\nPurpose:\n${sidecar.purpose}\n\nSuggested inputs:\n${suggestedInputsBlock}\n\nOptional output:\n- ${sidecar.outputFile}\n\nWhen to use:\n${sidecar.timing}\n\nInstructions:\n${instructionsBlock}\n\nGuardrails:\n- This is a sidecar, not a replacement for canonical harness stages.\n- Keep output concise, file-grounded, and actionable by the orchestrator.\n- Stop after writing ${sidecar.outputFile}.\n`;
}

function writePromptPack(route, outDir) {
  const pack = buildPromptPack(route, outDir);
  mkdirSync(pack.packDir, { recursive: true });

  const manifest = {
    task: pack.route.task,
    profile: pack.route.profile ?? null,
    mode: pack.route.mode,
    rationale: pack.route.why,
    stages: pack.route.stages,
    models: pack.route.models,
    crossModelReview: pack.route.crossModelReview,
    generatedAt: new Date().toISOString(),
    packDir: pack.packDir,
    files: {
      readme: pack.readmeFile,
      orchestrator: pack.orchestratorFile,
      nextSteps: pack.nextStepsFile,
      log: pack.logFile,
      sidecars: pack.sidecarFiles.map((sidecar) => ({
        key: sidecar.key,
        promptFile: sidecar.promptFile,
        outputFile: sidecar.outputFile,
        recommendedModel: sidecar.recommendedModel,
      })),
      stagePrompts: pack.stageFiles.map((stage) => ({
        stage: stage.stage,
        promptFile: stage.promptFile,
        outputFile: stage.outputFile,
        model: stage.model,
      })),
    },
  };

  writePackFile(pack.packDir, pack.readmeFile, renderPromptPackReadme(pack));
  writePackFile(
    pack.packDir,
    pack.orchestratorFile,
    renderOrchestratorPrompt(pack),
  );
  writePackFile(
    pack.packDir,
    pack.nextStepsFile,
    renderNextStepsTemplate(pack),
  );
  writePackFile(pack.packDir, pack.logFile, renderOrchestratorLog(pack));
  writePackFile(
    pack.packDir,
    pack.manifestFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  for (const stageFile of pack.stageFiles) {
    writePackFile(
      pack.packDir,
      stageFile.promptFile,
      renderStagePrompt(pack, stageFile),
    );
  }
  for (const sidecar of pack.sidecarFiles) {
    writePackFile(
      pack.packDir,
      sidecar.promptFile,
      renderSidecarPrompt(pack, sidecar),
    );
  }

  return pack;
}

function renderPromptPackSummary(pack) {
  const lines = [
    `[prompt-router] prompt pack created`,
    `[prompt-router] task: ${pack.route.task || "<stdin>"}`,
    `[prompt-router] output: ${pack.packDir}`,
    `[prompt-router] stages: ${pack.route.stages.join(" -> ")}`,
  ];

  for (const stageFile of pack.stageFiles) {
    lines.push(
      `[prompt-router] ${stageFile.promptFile} -> ${stageFile.outputFile} (${stageFile.model})`,
    );
  }
  for (const sidecar of pack.sidecarFiles) {
    lines.push(
      `[prompt-router] ${sidecar.promptFile} -> ${sidecar.outputFile} (optional ${sidecar.recommendedModel})`,
    );
  }
  lines.push(
    `[prompt-router] orchestrator: ${pack.orchestratorFile}`,
    `[prompt-router] memory: ${pack.nextStepsFile}`,
  );
  return `${lines.join("\n")}\n`;
}

export function renderCompactRoute(route) {
  return (
    `[prompt-router] ${route.mode.toUpperCase()} — ${route.why}\n` +
    `[prompt-router] stages: ${route.stages.join(" -> ")}\n` +
    `[prompt-router] models: ${Object.entries(route.models)
      .map(([stage, model]) => `${stage}=${model}`)
      .join(", ")}\n` +
    `[prompt-router] cross-model review: ${route.crossModelReview}\n`
  );
}

export function renderHandoffPlan(route) {
  const profileSuffix = route.profile ? ` (${route.profile})` : "";
  const lines = [
    `[prompt-router] operator handoff plan${profileSuffix}`,
    `[prompt-router] task: ${route.task || "<stdin>"}`,
    `[prompt-router] rationale: ${route.why}`,
  ];

  route.stages.forEach((stage, index) => {
    lines.push(
      `[prompt-router] ${index + 1}. ${stage} -> ${route.models[stage]}`,
    );
  });

  lines.push(`[prompt-router] cross-model review: ${route.crossModelReview}`);
  return `${lines.join("\n")}\n`;
}

function printBanner(config) {
  const r = buildModelRouting(config);
  process.stdout.write(
    `[prompt-router] Harness-first mode is ON for this repo.\n` +
      `[prompt-router] Non-trivial prompts route: understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback\n` +
      `[prompt-router] Stage models: understand=${r.understand}; architect=${r.architect}; architect-challenge=${r["architect-challenge"]}; implement=${r.implement}; review-breadth=${r["review-breadth"]}; review-depth=${r["review-depth"]}; feedback=${r.feedback}\n` +
      `[prompt-router] cross-model review: ${r["cross-model-review"]}\n` +
      `[prompt-router] Trivial prompts may start at implement only when they are clearly one-file/low-risk.\n`,
  );
}

function printReminder() {
  process.stdout.write(
    `[prompt-router] Operator shortcuts:\n` +
      `[prompt-router]   npm run harness:feature -- --task "<feature task>"\n` +
      `[prompt-router]   npm run harness:handoff:review -- --task "<review task>"\n` +
      `[prompt-router]   npm run harness:route -- --task "<any prompt>" --json\n` +
      `[prompt-router]   npm run harness:prompt-pack -- --profile feature --task "<task>"\n`,
  );
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: [
          "node scripts/harness/prompt-router.mjs banner",
          'node scripts/harness/prompt-router.mjs route --task "fix auth middleware race"',
          'node scripts/harness/prompt-router.mjs handoff --profile feature --task "ship auth audit"',
          'node scripts/harness/prompt-router.mjs handoff --profile review --task "review auth audit"',
          'node scripts/harness/prompt-router.mjs prompt-pack --profile feature --task "ship auth audit"',
          'echo "typo in README" | node scripts/harness/prompt-router.mjs route --stdin --json',
        ],
        note: "Deterministic repo policy helper. It does not intercept editor prompts by itself; use it via session hooks and repo instructions.",
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const command = flags._[0] ?? "banner";
  const config = loadConfig();

  if (command === "banner") {
    printBanner(config);
    return;
  }

  if (command === "remind") {
    printReminder();
    return;
  }

  if (
    command !== "route" &&
    command !== "handoff" &&
    command !== "prompt-pack"
  ) {
    fail(`unknown command: ${command}`);
  }

  const task = flags.stdin ? await readStdin() : resolveTaskText(flags);
  if (!task || !String(task).trim()) {
    fail(`${command} requires --task "..." or --stdin`);
  }

  const route = planTask(task, config, { profile: flags.profile });
  if (command === "prompt-pack") {
    const pack = writePromptPack(route, flags.out);
    if (flags.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            task: pack.route.task,
            profile: pack.route.profile ?? null,
            output: pack.packDir,
            stages: pack.stageFiles.map((stage) => ({
              stage: stage.stage,
              model: stage.model,
              promptFile: stage.promptFile,
              outputFile: stage.outputFile,
            })),
            sidecars: pack.sidecarFiles.map((sidecar) => ({
              key: sidecar.key,
              promptFile: sidecar.promptFile,
              outputFile: sidecar.outputFile,
              recommendedModel: sidecar.recommendedModel,
            })),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }
    process.stdout.write(renderPromptPackSummary(pack));
    return;
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(route, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    command === "handoff"
      ? renderHandoffPlan(route)
      : renderCompactRoute(route),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), 1);
  }
}
