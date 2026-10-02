# Feedback — Hosted Agent for Skill Adapter Eval (2026-10-02)

| Point | Source | Verdict |
|---|---|---|
| Keys could reach an arbitrary `--base-url` host | Challenge | Upheld → trusted hosts plus `--allow-host`, no redirects |
| Model id in the Gemini URL path | Challenge | Upheld → strict pattern plus `encodeURIComponent` |
| `auto` misroutes non-GPT ids | Challenge | Upheld → only claude-/gemini-/gpt-/o<digit> inferred |
| Failed or mismatched runs counted as evidence | Challenge | Upheld → invalid runs excluded; undeclared or mismatched forced inconclusive |
| `ollama run` guard is lexical | Challenge (non-blocking) | Accepted as best-effort |
| No hosted results yet | Breadth #1 | Deferred to operator (needs a vendor key) |
| `measure-phase5c-real.mjs` uses a retired endpoint | Breadth #2 | Deferred follow-up |

Brief unchanged. Operator next step, from the repo root:

```powershell
node scripts/harness/skill-adapter-eval.mjs --agent "node scripts/harness/hosted-agent.mjs" `
  --pass-env OPENAI_API_KEY --family openai-coding --model openai-coding=gpt-5.6-terra
```
