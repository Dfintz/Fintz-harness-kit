#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateSkillRoutingCoverage } from '../skill-routing-eval.mjs';

const root = mkdtempSync(join(process.cwd(), '.tmp', 'skill-routing-eval-'));
const evalDir = join(root, 'eval-sets');
mkdirSync(evalDir, { recursive: true });
const skillDir = join(root, 'skills', 'alpha');
mkdirSync(skillDir, { recursive: true });
writeFileSync(join(skillDir, 'SKILL.md'), '# alpha\n');
const configPath = join(root, 'harness.config.json');
const config = { skillModelMapping: { mappings: { alpha: { primary: 'model', tier: 'balanced-coding', fallback: ['fallback'] } } } };
writeFileSync(configPath, `${JSON.stringify(config)}\n`);

const validSet = {
  name: 'alpha',
  tests: Array.from({ length: 5 }, (_, index) => ({ id: `T${index + 1}`, prompt: `task ${index + 1}` })),
  expected: { stageSequence: ['understand', 'implement'] },
};
writeFileSync(join(evalDir, 'alpha.json'), `${JSON.stringify(validSet)}\n`);

try {
  const valid = validateSkillRoutingCoverage({ configPath, evalDir, skillDirs: [join(root, 'skills')] });
  assert.equal(valid.ok, true, 'valid mapped skill coverage should pass');
  assert.equal(valid.skills[0].testCount, 5);

  writeFileSync(join(evalDir, 'alpha.json'), JSON.stringify({ ...validSet, tests: validSet.tests.slice(0, 1) }));
  assert.equal(validateSkillRoutingCoverage({ configPath, evalDir, skillDirs: [join(root, 'skills')] }).ok, false, 'too-small eval set should fail');

  rmSync(join(evalDir, 'alpha.json'));
  assert.equal(validateSkillRoutingCoverage({ configPath, evalDir, skillDirs: [join(root, 'skills')] }).ok, false, 'missing eval set should fail');

  writeFileSync(join(evalDir, 'alpha.json'), JSON.stringify({ ...validSet, expected: { stageSequence: ['unknown-stage'] } }));
  assert.equal(validateSkillRoutingCoverage({ configPath, evalDir, skillDirs: [join(root, 'skills')] }).ok, false, 'invalid stage should fail');

  rmSync(join(evalDir, 'alpha.json'));
  writeFileSync(join(skillDir, 'eval-set.json'), JSON.stringify(validSet));
  assert.equal(validateSkillRoutingCoverage({ configPath, evalDir, skillDirs: [join(root, 'skills')] }).ok, true, 'optimizer-local eval set should be accepted');

  console.log('PASS skill-routing-eval test suite');
} finally {
  rmSync(root, { recursive: true, force: true });
}
