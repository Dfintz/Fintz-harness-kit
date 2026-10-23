#!/usr/bin/env node
import assert from 'node:assert/strict';
import { evaluateSecurityReviewGate } from '../security-review-gate.mjs';

function securityReport(overrides = {}) {
  return {
    status: 'ok',
    checklist: {
      policy: 'evidence-only',
      items: [
        { id: 'diff-report-generated', status: 'pass' },
        { id: 'scanner-command-recorded', status: 'pass' },
        { id: 'base-and-head-scans-recorded', status: 'pass' },
        { id: 'drift-summary-captured', status: 'pass' },
      ],
    },
    ...overrides,
  };
}

function reviewReport(overrides = {}) {
  return { terminalState: 'converged', finalVerdict: 'APPROVED', ...overrides };
}

function assertBlockedCheck(name, security, review = reviewReport()) {
  const result = evaluateSecurityReviewGate(security, review);
  assert.equal(result.ok, false, `${name} must block approval`);
  assert.equal(result.checks.find(item => item.name === name)?.ok, false, `${name} must report its own failure`);
  return result;
}

const approved = evaluateSecurityReviewGate(securityReport(), { terminalState: 'converged', review: { finalVerdict: 'APPROVED' } });
assert.equal(approved.ok, true, 'complete evidence and approved review should pass');
assert.equal(approved.checks.length, 6, 'gate should report all contract checks');

const lurkrShape = evaluateSecurityReviewGate(
  {
    checklist: securityReport().checklist,
    scans: {
      base: { exitCode: 0, spawnError: null },
      head: { exitCode: 0, spawnError: null },
    },
  },
  reviewReport(),
);
assert.equal(lurkrShape.ok, true, 'normal lurkr-diff shape should pass without top-level status');

const skipped = evaluateSecurityReviewGate(
  securityReport({ status: 'skipped' }),
  reviewReport(),
);
assert.equal(skipped.ok, false, 'skipped security evidence must fail closed');

const failedChecklist = evaluateSecurityReviewGate(
  securityReport({ checklist: { policy: 'evidence-only', items: [{ id: 'scan', status: 'fail' }] } }),
  reviewReport(),
);
assert.equal(failedChecklist.ok, false, 'failed checklist item must block approval');

const unapproved = evaluateSecurityReviewGate(securityReport(), { terminalState: 'exhausted', finalVerdict: 'REVISE' });
assert.equal(unapproved.ok, false, 'unapproved review must block approval');

const malformed = evaluateSecurityReviewGate(
  securityReport({ checklist: { policy: 'evidence-only', items: [{ id: 'unknown', status: 'wat' }] } }),
  reviewReport(),
);
assert.equal(malformed.ok, false, 'malformed checklist rows must block approval');

assertBlockedCheck('review-final-verdict', securityReport(), reviewReport({ finalVerdict: 'REVISE' }));
assertBlockedCheck('review-terminal-state', securityReport(), reviewReport({ terminalState: 'exhausted' }));
assertBlockedCheck('review-final-verdict', securityReport(), reviewReport({ finalVerdict: 'REVISE', review: { finalVerdict: 'APPROVED' } }));

const successfulScans = {
  base: { exitCode: 0, spawnError: null },
  head: { exitCode: 0, spawnError: null },
};
for (const side of ['base', 'head']) {
  for (const failure of [{ exitCode: 1 }, { spawnError: 'fixture scan error' }]) {
    const scans = structuredClone(successfulScans);
    Object.assign(scans[side], failure);
    assertBlockedCheck('security-report-status', { checklist: securityReport().checklist, scans });
  }
}
assertBlockedCheck('security-report-status', securityReport({ status: 'skipped', scans: successfulScans }));
assertBlockedCheck('security-report-status', { checklist: securityReport().checklist });
const ungenerated = securityReport().checklist;
ungenerated.items[0].status = 'warn';
assertBlockedCheck('security-report-status', { checklist: ungenerated, scans: successfulScans });

for (const policy of ['unexpected', undefined]) {
  assertBlockedCheck('security-checklist-present', securityReport({ checklist: { policy, items: securityReport().checklist.items } }));
}
assertBlockedCheck('security-checklist-present', securityReport({ checklist: { policy: 'evidence-only', items: [] } }));
assertBlockedCheck('security-checklist-schema', securityReport({ checklist: { policy: 'evidence-only', items: securityReport().checklist.items.slice(1) } }));
for (const invalid of [{ id: 'unknown', status: 'pass' }, null, 'invalid-row']) {
  const checklist = securityReport().checklist;
  checklist.items.push(invalid);
  assertBlockedCheck('security-checklist-schema', securityReport({ checklist }));
}
const invalidStatus = securityReport().checklist;
invalidStatus.items[0].status = 'unexpected';
assertBlockedCheck('security-checklist-schema', securityReport({ checklist: invalidStatus }));
const knownFailure = securityReport().checklist;
knownFailure.items[0].status = 'fail';
assertBlockedCheck('security-checklist-no-failures', securityReport({ checklist: knownFailure }));
const allowedWarning = securityReport().checklist;
allowedWarning.items[1].status = 'warn';
assert.equal(evaluateSecurityReviewGate(securityReport({ checklist: allowedWarning }), reviewReport()).ok, true, 'warnings remain valid evidence-only rows');

for (const [name, details] of [
  ['security-report-status', 'status=ok'],
  ['security-checklist-present', 'policy=evidence-only, items=4'],
  ['review-terminal-state', 'terminalState=converged'],
  ['review-final-verdict', 'finalVerdict=APPROVED'],
]) {
  assert.equal(approved.checks.find(item => item.name === name)?.details, details, 'diagnostics must describe the evaluated value');
}
assert.equal(lurkrShape.checks[0].details, 'status=derived', 'legacy report status must remain explicit');

console.log('PASS security-review-gate test suite');
