## Review Depth Gate Ledger

### Gate ledger
1. Path: command validation -> loop/review/eval executors
   Gates run: 1, 3, 4, 4b, 5
   Result: PASS (with residual note)
   Evidence: core executors now call parseValidatedCliCommand and spawn executable+args without shell mode.

2. Path: MCP contract chain (registry + harness docs + root docs)
   Gates run: 1, 3, 4, 5
   Result: PASS
   Evidence: command examples now match harness-mcp-tasks implementation (--query, --file).

3. Path: backup-code migration contract
   Gates run: 1, 3, 4b
   Result: PASS for contract alignment
   Evidence: unsupported phase-enforcement claims removed from source and dist migration logs.

4. Path: remaining graph refresh command execution
   Gates run: 4, 4b
   Result: PARTIAL FAIL
   Evidence: refresh-graph path still uses shell:true and string command.

### Structural findings ledger

#### Major
1. Artifact or path: scripts/harness/refresh-graph.mjs
   Gate/depth check failed: Gate 4 boundary integrity, Gate 4b isolation/safety boundary
   Evidence: remaining shell-based subprocess path in hardened command-execution family.
   Why structure is wrong: command execution hardening is inconsistent across adjacent orchestrator surfaces.
   Recommended fix: adopt shared parseValidatedCliCommand execution path in refresh-graph.
   Confidence: HIGH

#### Minor
1. Artifact or path: backend auth runtime policy ownership
   Gate/depth check failed: Gate 3 ownership (deferred implementation)
   Evidence: migration text aligned but runtime fallback policy still unchanged in this cycle.
   Why structure is wrong: policy ownership belongs in runtime auth service; migration should remain data-shape contract.
   Recommended fix: follow-up feature for runtime enforcement toggle with tests.
   Confidence: HIGH

### Brief divergence
- No material divergence from Architecture Brief. Changes remained within declared scope and constraints.