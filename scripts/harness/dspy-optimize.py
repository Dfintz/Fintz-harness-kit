#!/usr/bin/env python3
"""
dspy-optimize.py — DSPy MIPROv2 instruction optimizer for harness skill files.

Uses DSPy's MIPROv2 optimizer (https://arxiv.org/abs/2406.11695) to improve a target skill
instruction by compiling a harness planning program against a labeled routing eval set.

How it works
------------
1. Load the target SKILL.md (or instruction file) as the seed instruction.
2. Load an eval set JSON (same format as eval-first-routing-*-task-tests-*.json).
3. Define a DSPy program (HarnessPlanner) whose Predict module uses the seed instruction.
4. Run MIPROv2 in 'light' mode to optimize the module's instructions against the eval set.
5. Write the optimized instruction text to --output.

Requirements
------------
Python 3.10+, dspy>=2.4,<3 (see requirements-dspy.txt)

Usage
-----
  python scripts/harness/dspy-optimize.py \\
    --target .github/skills/understand-process/SKILL.md \\
    --eval-set .github/harness/memory/briefs/eval-first-routing-10-task-tests-2026-07-17.json \\
    --output .github/harness/memory/briefs/dspy-optimized-understand-process.md \\
    --model ollama_chat/llama3.2 \\
    --api-base http://localhost:11434

  python scripts/harness/dspy-optimize.py --self-test
  python scripts/harness/dspy-optimize.py --check-deps

Exit codes: 0 success, 1 optimization failed or no improvement, 2 config/dependency error.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# ---- version guard (before importing dspy) --------------------------------

MIN_DSPY = (2, 4)
MAX_DSPY_MAJOR = 3


def _check_dspy_version() -> tuple[bool, str]:
    """Return (ok, message). Does not raise."""
    try:
        import importlib.metadata
        raw = importlib.metadata.version("dspy")
        parts = raw.split(".")
        major, minor = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        if major >= MAX_DSPY_MAJOR:
            return False, f"dspy {raw} is >=3 — this script targets dspy>=2.4,<3"
        if (major, minor) < MIN_DSPY:
            return False, f"dspy {raw} is below minimum 2.4 — run: pip install 'dspy>=2.4,<3'"
        return True, f"dspy {raw} OK"
    except Exception as e:  # noqa: BLE001
        return False, f"dspy not importable: {e}"


# ---- DSPy program definition ----------------------------------------------

def _build_program(seed_instruction: str):
    """Build a HarnessPlanner DSPy module seeded with the given instruction text."""
    import dspy

    class SkillGuidedPlanning(dspy.Signature):
        """Given a skill instruction and a task description, produce the correct harness stage plan."""

        skill_instruction: str = dspy.InputField(
            desc="The skill instruction that guides the harness agent"
        )
        task: str = dspy.InputField(desc="The harness task description to plan for")
        stage_plan: str = dspy.OutputField(
            desc=(
                "Comma-separated ordered list of harness stages. "
                "Valid stages: understand, architect, implement, review-breadth, review-depth, feedback"
            )
        )

    class HarnessPlanner(dspy.Module):
        def __init__(self):
            super().__init__()
            self.plan = dspy.Predict(SkillGuidedPlanning)
            # Seed the instruction from the target skill file
            self.plan.extended_signature.instructions = seed_instruction

        def forward(self, skill_instruction: str, task: str):
            return self.plan(skill_instruction=skill_instruction, task=task)

    return HarnessPlanner()


# ---- eval set loading -----------------------------------------------------

def _load_eval_set(path: Path) -> list[dict]:
    """Load eval set JSON and return list of {task, expected_stages} dicts."""
    data = json.loads(path.read_text(encoding="utf-8"))
    tasks = data.get("tests", [])
    result = []
    for t in tasks:
        prompt = t.get("prompt", "")
        # Expected stages from file or fall back to canonical feature sequence
        expected = data.get("expected", {}).get("stageSequence") or [
            "understand", "architect", "implement", "review-breadth", "review-depth", "feedback"
        ]
        result.append({"task": prompt, "expected_stages": ",".join(expected)})
    return result


# ---- metric ---------------------------------------------------------------

def _routing_metric(example, prediction, trace=None) -> int:  # noqa: ANN001
    """Return 1 if predicted stage plan matches the expected sequence, else 0."""
    expected = set(example.expected_stages.lower().replace(" ", "").split(","))
    raw = getattr(prediction, "stage_plan", "") or ""
    predicted = set(raw.lower().replace(" ", "").split(","))
    return int(expected == predicted)


# ---- main optimizer -------------------------------------------------------

def run_optimization(
    target: Path,
    eval_set: Path,
    output: Path,
    model: str,
    api_base: str,
    max_trials: int,
) -> int:
    """Run MIPROv2 optimization. Returns 0 on success, 1 on failure."""
    ok, msg = _check_dspy_version()
    if not ok:
        print(f"[dspy-optimize] ERROR: {msg}", file=sys.stderr)
        return 2

    import dspy
    from dspy.teleprompt import MIPROv2

    # Configure LM
    lm_kwargs: dict = {"model": model}
    if api_base:
        lm_kwargs["api_base"] = api_base
    lm = dspy.LM(**lm_kwargs)
    dspy.configure(lm=lm)

    # Load target skill instruction
    seed_instruction = target.read_text(encoding="utf-8")
    print(f"[dspy-optimize] target: {target} ({len(seed_instruction)} chars)")

    # Load eval set
    tasks = _load_eval_set(eval_set)
    print(f"[dspy-optimize] eval set: {eval_set} ({len(tasks)} tasks)")
    if not tasks:
        print("[dspy-optimize] ERROR: eval set is empty", file=sys.stderr)
        return 2

    # Build DSPy trainset
    trainset = [
        dspy.Example(
            skill_instruction=seed_instruction,
            task=t["task"],
            expected_stages=t["expected_stages"],
        ).with_inputs("skill_instruction", "task")
        for t in tasks
    ]

    # Build program
    program = _build_program(seed_instruction)

    # Run MIPROv2 in light mode
    print(f"[dspy-optimize] running MIPROv2 (auto=light, max_trials={max_trials})...")
    optimizer = MIPROv2(
        metric=_routing_metric,
        auto="light",
        num_threads=1,  # sequential — avoid overwhelming a local LLM server
        verbose=True,
    )

    try:
        optimized = optimizer.compile(
            program,
            trainset=trainset,
            max_bootstrapped_demos=2,
            max_labeled_demos=4,
            num_trials=max_trials,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[dspy-optimize] MIPROv2 compilation failed: {e}", file=sys.stderr)
        return 1

    # Extract the optimized instruction text
    optimized_instruction: str = (
        optimized.plan.extended_signature.instructions
        if hasattr(optimized, "plan")
        else seed_instruction
    )

    if optimized_instruction == seed_instruction:
        print("[dspy-optimize] WARNING: optimized instruction is identical to seed — no improvement found")
        output.write_text(seed_instruction, encoding="utf-8")
        return 1

    output.write_text(optimized_instruction, encoding="utf-8")
    print(f"[dspy-optimize] wrote optimized instruction to: {output}")
    return 0


# ---- self-test (no LLM, no dspy required) ---------------------------------

def run_self_test() -> int:
    """Validate module structure and argument parsing without importing dspy."""
    passed = 0
    total = 0

    def check(name: str, result: bool) -> None:
        nonlocal passed, total
        total += 1
        status = "✓" if result else "✗"
        print(f"  {status} {name}")
        if result:
            passed += 1

    print("[dspy-optimize] Running self-tests...")

    # 1. Version check function works without dspy installed
    ok, msg = _check_dspy_version()
    check("version check returns (bool, str)", isinstance(ok, bool) and isinstance(msg, str))

    # 2. Eval set loader handles valid JSON
    import tempfile, os
    sample = {
        "tests": [
            {"id": "T1", "prompt": "Add a backend fleet service"},
            {"id": "T2", "prompt": "Review harness docs"},
        ],
        "expected": {"stageSequence": ["understand", "architect", "implement"]},
    }
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(sample, f)
        tmp = f.name
    try:
        tasks = _load_eval_set(Path(tmp))
        check("eval set loader: returns 2 tasks", len(tasks) == 2)
        check("eval set loader: task has 'task' key", "task" in tasks[0])
        check("eval set loader: task has 'expected_stages' key", "expected_stages" in tasks[0])
        check(
            "eval set loader: expected_stages matches stageSequence",
            tasks[0]["expected_stages"] == "understand,architect,implement",
        )
    finally:
        os.unlink(tmp)

    # 3. Routing metric
    class FakeExample:
        expected_stages = "understand,architect,implement"
    class FakePrediction:
        stage_plan = "understand, architect, implement"
    check("routing metric: correct prediction returns 1", _routing_metric(FakeExample(), FakePrediction()) == 1)

    class FakePredictionWrong:
        stage_plan = "understand, implement"
    check("routing metric: wrong prediction returns 0", _routing_metric(FakeExample(), FakePredictionWrong()) == 0)

    # 4. Argument parser
    parser = _build_arg_parser()
    args = parser.parse_args(["--target", "x.md", "--eval-set", "e.json", "--output", "o.md"])
    check("arg parser: --target parsed", args.target == "x.md")
    check("arg parser: --eval-set parsed", args.eval_set == "e.json")
    check("arg parser: --max-trials default", args.max_trials == 10)

    print(f"\n[dspy-optimize] {passed}/{total} self-tests passed")
    return 0 if passed == total else 1


# ---- check-deps -----------------------------------------------------------

def check_deps() -> int:
    """Check Python version and DSPy availability. Exits 0 if OK, 2 if not."""
    print(f"[dspy-optimize] Python {sys.version}")
    major, minor = sys.version_info[:2]
    if (major, minor) < (3, 10):
        print(f"[dspy-optimize] ERROR: Python 3.10+ required, found {major}.{minor}", file=sys.stderr)
        return 2

    ok, msg = _check_dspy_version()
    if ok:
        print(f"[dspy-optimize] {msg}")
        print("[dspy-optimize] deps OK")
        return 0
    else:
        print(f"[dspy-optimize] MISSING: {msg}", file=sys.stderr)
        print("[dspy-optimize] Install: pip install -r scripts/harness/requirements-dspy.txt", file=sys.stderr)
        return 2


# ---- CLI ------------------------------------------------------------------

def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="DSPy MIPROv2 instruction optimizer for harness skill files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--target", help="Skill/instruction file to optimize")
    p.add_argument("--eval-set", dest="eval_set", help="Routing eval set JSON file")
    p.add_argument("--output", help="Write optimized instruction here")
    p.add_argument(
        "--model",
        default="ollama_chat/llama3.2",
        help="DSPy LM model string (default: ollama_chat/llama3.2)",
    )
    p.add_argument(
        "--api-base",
        dest="api_base",
        default="http://localhost:11434",
        help="LM API base URL (default: http://localhost:11434)",
    )
    p.add_argument(
        "--max-trials",
        dest="max_trials",
        type=int,
        default=10,
        help="MIPROv2 num_trials (default: 10; light mode uses ~10-20 LM calls total)",
    )
    p.add_argument("--self-test", action="store_true", help="Run deterministic validation and exit")
    p.add_argument("--check-deps", action="store_true", dest="check_deps", help="Check Python/DSPy availability and exit")
    return p


def main() -> int:
    parser = _build_arg_parser()
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()
    if args.check_deps:
        return check_deps()

    if not args.target or not args.eval_set or not args.output:
        parser.error("--target, --eval-set, and --output are required")

    target = Path(args.target)
    eval_set = Path(args.eval_set)
    output = Path(args.output)

    if not target.exists():
        print(f"[dspy-optimize] ERROR: --target not found: {target}", file=sys.stderr)
        return 2
    if not eval_set.exists():
        print(f"[dspy-optimize] ERROR: --eval-set not found: {eval_set}", file=sys.stderr)
        return 2

    output.parent.mkdir(parents=True, exist_ok=True)
    return run_optimization(target, eval_set, output, args.model, args.api_base, args.max_trials)


if __name__ == "__main__":
    sys.exit(main())
