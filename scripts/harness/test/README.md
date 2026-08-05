# MCP Resources Test Suite

## Test Execution Order

All tests in this directory must run **sequentially**. Do not run tests in parallel.

### Why Sequential Execution?

The cache and streaming tests use the `_flushCache()` fixture to reset state deterministically between test scenarios. This ensures:

- Each test starts with a clean cache state
- TTL expiry tests are reproducible
- Concurrent access patterns are measured without state leakage from other tests

### If Tests Run in Parallel

Running tests in parallel **may cause cache state leakage** (expected behavior):

- Test A flushes cache; Test B sees empty cache
- Test C sets cache; Test A reads stale data
- Latency measurements become non-deterministic

This is a feature, not a bug — it validates that cache isolation works correctly. However, for consistent benchmark results, always use sequential execution.

### Running Tests

```bash
# Sequential (recommended for consistent results)
node scripts/harness/test/mcp-resources-streaming-test.mjs
node scripts/harness/test/mcp-resources-streaming-latency.mjs
node scripts/harness/test/mcp-resources-cache-benchmark.mjs
node scripts/harness/test/mcp-resources-graph-latency.mjs

# Or all at once (sequential runner)
for test in scripts/harness/test/mcp-resources-*.mjs; do node "$test"; done
```

## Test Coverage

| Test File | Purpose | Isolation |
|-----------|---------|-----------|
| mcp-resources-streaming-test.mjs | Streaming + buffered modes, cache behavior | _flushCache() between tests |
| mcp-resources-streaming-latency.mjs | Mock chunking plus live `resource_chunk` first-chunk SLA validation (25/50/100 items) | Initialized SDK client per chunk size |
| mcp-resources-cache-benchmark.mjs | Cache hit/miss/expiry patterns | _flushCache() between scenarios |
| mcp-resources-graph-latency.mjs | Graph adapter latency + graceful degradation | Reads only; no state mutation |

## Cache Isolation Validation

See `mcp-resources-cache-benchmark.mjs` for validation of:

- Cache hit latency <1ms (1000 samples, P99)
- Cache miss + populate behavior
- TTL expiry and refresh cycles
- Concurrent read safety
- Flush mechanism determinism

## Sidecar Validator Edge Cases

The sidecar validator regression fixture is `sidecar-validator-edge-cases-test.mjs`.

Expected failure codes asserted by this test:

- `missing-sidecar` - fixture skill is present but `agents/openai.yaml` is absent.
- `invalid-sidecar-yaml` - unsupported YAML shape (for example scalar instead of object mapping).
- `invalid-sidecar-contract` - schema contract violation (for example missing policy key, missing `behavior_class`, or wrong scalar types).
- `invalid-sidecar-policy-semantics` - policy class and invocation flag disagree (for example explicit-only class with implicit invocation set to true).
- `invalid-model-invoked-allowlist` - sidecar declared `model-invoked-eligible` for a skill not listed in `harness.config.json` `sidecarPolicy.modelInvokedEligibleSkills`.
- `invalid-pilot-sidecar-policy` - strict pilot mode (`--strict-pilot-policy`) detected a pilot skill that is not `user-invoked-only`.

Strict command:

- `npm run harness:docs:check:strict-pilot`

