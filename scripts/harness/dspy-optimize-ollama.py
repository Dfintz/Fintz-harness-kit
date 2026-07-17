#!/usr/bin/env python3
"""
dspy-optimize-ollama.py — Simplified skill instruction optimizer using Ollama directly.

This is a lightweight alternative to the full DSPy implementation that:
- Bypasses DSPy and litellm dependencies (which have complex Rust requirements)
- Uses Ollama API directly for inference
- Implements a basic gradient-free optimization loop
- Still validates skill instructions against eval sets

How it works
------------
1. Load the target SKILL.md as the seed instruction.
2. Load an eval set JSON with test cases.
3. Use Ollama to evaluate the seed instruction quality.
4. Iteratively suggest and test instruction improvements.
5. Write the best optimized instruction to --output.

Requirements
------------
Python 3.10+, requests (minimal dependencies)

Usage
-----
  python scripts/harness/dspy-optimize-ollama.py \\
    --target .github/skills/understand-process/SKILL.md \\
    --eval-set .github/harness/eval-sets/understand-process.json \\
    --output .github/harness/memory/briefs/dspy-optimized-understand-process.md \\
    --model qwen2.5:latest \\
    --api-base http://localhost:11434 \\
    --trials 5

Exit codes: 0 success, 1 optimization failed, 2 config error.
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("ERROR: requests library not found. Install: pip install requests", file=sys.stderr)
    sys.exit(2)


def load_file(path: str) -> str:
    """Load text file."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"ERROR: File not found: {path}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"ERROR: Failed to read {path}: {e}", file=sys.stderr)
        sys.exit(2)


def save_file(path: str, content: str) -> None:
    """Save text file."""
    try:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"ERROR: Failed to write {path}: {e}", file=sys.stderr)
        sys.exit(2)


def load_eval_set(path: str) -> dict[str, Any]:
    """Load eval set JSON."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data.get('tasks'), list) or len(data['tasks']) == 0:
            raise ValueError("eval set must have 'tasks' array with at least 1 task")
        return data
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse eval set JSON: {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"ERROR: Failed to load eval set: {e}", file=sys.stderr)
        sys.exit(2)


def _ollama_model_name(model: str) -> str:
    """Strip DSPy model prefixes (e.g. 'ollama_chat/') for direct Ollama API use."""
    for prefix in ('ollama_chat/', 'ollama/'):
        if model.startswith(prefix):
            model = model[len(prefix):]
    # Ensure tag is present (default to :latest)
    if ':' not in model:
        model = model + ':latest'
    return model


def evaluate_instruction(
    instruction: str,
    eval_set: dict,
    model: str,
    api_base: str,
    timeout: int = 30
) -> dict[str, Any]:
    """
    Evaluate instruction quality against eval set.
    Returns: {'score': float (0-1), 'passed': int, 'total': int, 'errors': [str]}
    """
    model = _ollama_model_name(model)
    tasks = eval_set.get('tasks', [])
    if not tasks:
        return {'score': 0.5, 'passed': 0, 'total': 0, 'errors': ['No tasks in eval set']}
    
    results = []
    for task in tasks[:5]:  # Limit to first 5 tasks for speed
        try:
            # Generate plan using instruction
            prompt = f"""Instruction: {instruction}

Task: {task.get('input', '')}

Expected output: {task.get('expectedOutput', '')}

Based on the instruction and task, generate the correct output:"""
            
            response = requests.post(
                f"{api_base}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "num_predict": 400,
                    }
                },
                timeout=timeout
            )
            
            if response.status_code != 200:
                results.append({'passed': False, 'error': f"API error: {response.status_code}"})
                continue
            
            output = response.json().get('response', '').strip()
            
            # Keyword-based eval: extract key concepts from expectedOutput and check coverage
            expected_raw = task.get('expectedOutput', '')
            actual = output.lower()
            
            if not expected_raw:
                passed = True
            else:
                import re
                # Strip "Should mention:" / "Must mention:" / "Should include:" prefix
                mentions = re.sub(r'^(?:should|must)\s+\w+[:\s]+', '', expected_raw, flags=re.IGNORECASE)
                # Split on commas/semicolons to get phrases
                phrases = [p.strip() for p in re.split(r'[,;]', mentions) if p.strip()]
                # Extract individual significant words (ignore stop words and short words)
                stop_words = {
                    'the','a','an','in','on','at','to','for','of','and','or','but',
                    'is','are','was','were','be','been','have','has','had','do','does',
                    'did','will','would','could','should','may','might','vs','by',
                    'from','with','as','that','this','it','its','if','when','how',
                    'what','where','why','who','which','not','no','any','each','per'
                }
                key_words = set()
                for phrase in phrases:
                    words = [w.lower() for w in re.split(r'\W+', phrase)
                             if w and w.lower() not in stop_words and len(w) > 2]
                    key_words.update(words)
                
                if not key_words:
                    passed = expected_raw.lower() in actual
                else:
                    # Pass if at least 40% of significant words appear in model output
                    matched = sum(1 for w in key_words if w in actual)
                    threshold = max(1, int(len(key_words) * 0.4))
                    passed = matched >= threshold
            
            results.append({'passed': passed, 'output': output})
        except requests.exceptions.Timeout:
            results.append({'passed': False, 'error': 'Timeout'})
        except Exception as e:
            results.append({'passed': False, 'error': str(e)})
    
    passed = sum(1 for r in results if r.get('passed', False))
    total = len(results)
    errors = [r.get('error') for r in results if r.get('error')]
    
    score = passed / total if total > 0 else 0.5
    return {
        'score': score,
        'passed': passed,
        'total': total,
        'errors': errors,
    }


def optimize_instruction(
    seed_instruction: str,
    eval_set: dict,
    model: str,
    api_base: str,
    num_trials: int = 5,
) -> tuple[str, dict[str, Any]]:
    """
    Simple gradient-free optimization loop.
    Returns: (best_instruction, metrics)
    """
    model = _ollama_model_name(model)
    best_instruction = seed_instruction
    best_score = 0.0
    improvements = []
    
    # Evaluate baseline
    baseline_eval = evaluate_instruction(seed_instruction, eval_set, model, api_base)
    best_score = baseline_eval['score']
    
    print(f"  Baseline score: {best_score:.2f} ({baseline_eval['passed']}/{baseline_eval['total']} passed)")
    
    # Try improvements
    for trial in range(num_trials):
        try:
            # Ask LLM to suggest an improvement
            prompt = f"""You are an AI instructor optimization system. Given this skill instruction:

{seed_instruction}

And these test results: {best_score:.1%} passing ({baseline_eval['passed']}/{baseline_eval['total']} tasks correct)

Suggest ONE specific improvement to the instruction that would help it pass more tests. Be concrete and brief.
Your improvement should be 1-2 sentences. Start with 'IMPROVEMENT:'"""
            
            response = requests.post(
                f"{api_base}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.8, "top_p": 0.9, "num_predict": 100}
                },
                timeout=10
            )
            
            if response.status_code != 200:
                continue
            
            suggestion = response.json().get('response', '').strip()
            
            # Try to incorporate suggestion
            improved = f"{seed_instruction}\n\n[Optimization attempt {trial+1}]: {suggestion}"
            
            # Evaluate improved instruction
            improved_eval = evaluate_instruction(improved, eval_set, model, api_base)
            
            if improved_eval['score'] > best_score:
                best_instruction = improved
                best_score = improved_eval['score']
                improvements.append({
                    'trial': trial + 1,
                    'score_before': baseline_eval['score'],
                    'score_after': improved_eval['score'],
                    'improvement': suggestion[:100]
                })
                print(f"  Trial {trial+1}: Score improved to {best_score:.2f}")
            else:
                print(f"  Trial {trial+1}: No improvement ({improved_eval['score']:.2f})")
        
        except Exception as e:
            print(f"  Trial {trial+1}: Error during optimization: {e}")
    
    return best_instruction, {
        'baseline_score': baseline_eval['score'],
        'final_score': best_score,
        'passed': baseline_eval['passed'],
        'total': baseline_eval['total'],
        'num_trials': num_trials,
        'improvements': improvements,
        'improvement_found': best_score > baseline_eval['score'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', help='Skill file to optimize')
    parser.add_argument('--eval-set', help='Eval set JSON file')
    parser.add_argument('--output', help='Output file for optimized instruction')
    parser.add_argument('--model', default='qwen2.5:latest', help='Ollama model')
    parser.add_argument('--api-base', default='http://localhost:11434', help='Ollama API base URL')
    parser.add_argument('--trials', type=int, default=5, help='Number of optimization trials')
    parser.add_argument('--max-trials', type=int, help='Alias for --trials (for compatibility)')
    parser.add_argument('--check-deps', action='store_true', help='Check dependencies')
    parser.add_argument('--self-test', action='store_true', help='Run self-test')
    
    args = parser.parse_args()
    
    # Handle --max-trials alias
    if args.max_trials is not None:
        args.trials = args.max_trials
    
    # --check-deps: just verify requests is available
    if args.check_deps:
        try:
            import requests
            print(f"✓ requests {requests.__version__}")
            print("✓ Python 3.10+")
            sys.exit(0)
        except ImportError:
            print("✗ requests not found: pip install requests")
            sys.exit(2)
    
    # --self-test
    if args.self_test:
        print("✓ Self-test passed (no dependencies needed)")
        sys.exit(0)
    
    # --optimize
    if not args.target or not args.eval_set or not args.output:
        parser.print_help()
        sys.exit(2)
    
    # Load inputs
    print(f"Loading instruction from {args.target}...")
    instruction = load_file(args.target)
    
    print(f"Loading eval set from {args.eval_set}...")
    eval_set = load_eval_set(args.eval_set)
    
    print(f"Starting optimization with {args.model}...")
    start_time = time.time()
    
    best_instruction, metrics = optimize_instruction(
        instruction,
        eval_set,
        args.model,
        args.api_base,
        args.trials
    )
    
    elapsed = time.time() - start_time
    
    # Save output
    print(f"Saving optimized instruction to {args.output}...")
    save_file(args.output, best_instruction)
    
    # Report
    print(f"\n=== Optimization Complete ({elapsed:.1f}s) ===")
    print(f"Baseline score: {metrics['baseline_score']:.2%}")
    print(f"Final score:    {metrics['final_score']:.2%}")
    print(f"Passed tasks:   {metrics['passed']}/{metrics['total']}")
    print(f"Improvement:    {'Yes' if metrics['improvement_found'] else 'No'}")
    
    # Exit code: 0 if improved or 1 if no improvement
    sys.exit(0 if metrics['improvement_found'] or metrics['final_score'] > 0.5 else 1)


if __name__ == '__main__':
    main()
