## Implementation Notes

### Delivered
- Added canonical stdio semantic command:
  - `test:mcp:stdio:mrtr`
- Preserved compatibility alias:
  - `test:mcp:stdio:mrtr` -> `npm run test:mcp:stdio:mrtr`

### Modified files
- `package.json`

### Validation proof
- `npm run harness:commands:check` -> PASS
- `npm run test:mcp:stdio:mrtr` -> PASS
- `npm run test:mcp:stdio:mrtr` -> PASS (alias chain)
- `npm run harness:docs:check` -> PASS

### Notes
- This pass is non-breaking and keeps existing automation compatibility.
