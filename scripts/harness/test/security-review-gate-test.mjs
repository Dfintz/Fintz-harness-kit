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

console.log('PASS security-review-gate test suite');
