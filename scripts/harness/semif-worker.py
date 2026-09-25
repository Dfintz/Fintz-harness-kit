#!/usr/bin/env python3
"""Persistent JSONL worker for SemIf direct typed-option scoring."""

from __future__ import annotations

import argparse
import json
import math
import sys
from typing import Any


def write_frame(frame: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(frame, allow_nan=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if hasattr(value, "item"):
        return json_safe(value.item())
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("SemIf returned a non-finite number")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--device", choices=("auto", "cuda", "mps", "cpu"), default="cuda")
    parser.add_argument("--dtype", choices=("bfloat16", "float16", "float32"), default="bfloat16")
    parser.add_argument("--max-tokens", type=int, default=4096)
    args = parser.parse_args()
    if args.max_tokens < 1:
        parser.error("--max-tokens must be positive")
    return args


def main() -> None:
    args = parse_args()
    try:
        from semif_phase1.core import load_causal_model
        from semif_phase1.direct import score
    except ImportError as error:
        raise SystemExit(f"SemIf is not installed in this Python environment: {error}") from error

    model, tokenizer, loaded = load_causal_model(
        args.model,
        args.revision,
        args.device,
        args.dtype,
    )
    metadata = {
        **json_safe(loaded),
        "source": args.model,
        "revision": args.revision,
        "backend": "torch",
        "device": args.device,
        "dtype": args.dtype,
    }
    write_frame({"version": 1, "type": "ready", "model": metadata})

    for line in sys.stdin:
        if not line.strip():
            continue
        request_id = None
        try:
            frame = json.loads(line)
            request_id = frame.get("id")
            if frame.get("version") != 1 or not isinstance(request_id, str) or not request_id:
                raise ValueError("invalid worker request envelope")
            max_tokens = frame.get("maxTokens", args.max_tokens)
            if not isinstance(max_tokens, int) or max_tokens < 1:
                raise ValueError("maxTokens must be a positive integer")
            result = score(model, tokenizer, frame["row"], metadata, max_tokens)
            write_frame({
                "version": 1,
                "id": request_id,
                "ok": True,
                "result": json_safe(result),
            })
        except Exception as error:  # The protocol reports one bounded error per request.
            write_frame({
                "version": 1,
                "id": request_id,
                "ok": False,
                "error": {"code": "scoring_failed", "message": str(error)[:500]},
            })


if __name__ == "__main__":
    main()