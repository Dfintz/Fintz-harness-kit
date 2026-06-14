# Security review — vulnerable.js

## Finding 1 — Arbitrary code execution (Critical)

- **Construct:** `eval(expression)` on **line 4**.
- **Cause:** `expression` comes directly from `request.query.expr` (untrusted user input) and is
  passed to `eval`, allowing an attacker to execute arbitrary JavaScript in the process.
- **Fix:** remove `eval`; parse the expected input explicitly (e.g. a numeric parser or an allow-list
  of operations) instead of evaluating raw user strings.
