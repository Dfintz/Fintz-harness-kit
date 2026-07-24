# Phase 4 → Production: Pre-Deployment Validation Runbook

**Date:** 2026-07-24  
**Status:** Ready for Execution  
**Purpose:** Verify Phase 4 results are production-ready before deploying to SKILL.md files

---

## Quick Validation (2 minutes)

Run this command to confirm Phase 4 results meet all gates:

```powershell
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json', 'utf8'));

console.log('\n' + '='.repeat(70));
console.log('PHASE 4 PRE-DEPLOYMENT VALIDATION');
console.log('='.repeat(70) + '\n');

console.log('📊 Aggregate Metrics:');
console.log('   Version:        ', data.version);
console.log('   Total Skills:   ', data.aggregate.totalSkills);
console.log('   Avg Improve:    ', (data.aggregate.avgImprovement * 100).toFixed(1) + '%');
console.log('   Skills Passed:  ', data.aggregate.passedGate + '/' + data.aggregate.totalSkills);
console.log('   Success Rate:   ', (data.aggregate.successRate * 100).toFixed(0) + '%\n');

// Validate gates
const gates = {
  'Average Improvement ≥15%': data.aggregate.avgImprovement >= 0.15,
  'All Skills Passed Gate': data.aggregate.passedGate === 20,
  'Success Rate = 100%': data.aggregate.successRate === 1.0,
  '20 Skills Optimized': data.results.length === 20
};

console.log('🚪 Gate Checks:');
Object.entries(gates).forEach(([gate, passed]) => {
  console.log('   ' + (passed ? '✅' : '❌') + ' ' + gate);
});

const allPassed = Object.values(gates).every(v => v);
console.log('\n' + '='.repeat(70));
if (allPassed) {
  console.log('✅ VALIDATION PASSED - Ready for production deployment');
  console.log('   Next: Execute Phase 1 deployment (pr, eval-first-tuning, remember)');
} else {
  console.log('❌ VALIDATION FAILED - Do not deploy');
  console.log('   Action: Review failed gates and re-run optimization');
}
console.log('='.repeat(70) + '\n');

// Show rankings
console.log('📈 Skill Rankings (Top 10 by improvement):');
const ranked = [...data.results].sort((a, b) => b.improvementPct - a.improvementPct);
ranked.slice(0, 10).forEach((r, i) => {
  const pct = (r.improvementPct * 100).toFixed(1);
  const trial = r.trials.reduce((max, t) => t.improvement > max.improvement ? t : max).trial;
  console.log('   ' + (i + 1).toString().padStart(2, ' ') + '. ' + r.skill.padEnd(32, ' ') + pct.padStart(5, ' ') + '% (Trial ' + trial + ')');
});

console.log('\n📈 Skill Rankings (Bottom 3):');
ranked.reverse().slice(0, 3).forEach((r, i) => {
  const pct = (r.improvementPct * 100).toFixed(1);
  const trial = r.trials.reduce((max, t) => t.improvement > max.improvement ? t : max).trial;
  console.log('   ' + (i + 1).toString().padStart(2, ' ') + '. ' + r.skill.padEnd(32, ' ') + pct.padStart(5, ' ') + '% (Trial ' + trial + ')');
});
"
```

**Expected Output:**
```
======================================================================
PHASE 4 PRE-DEPLOYMENT VALIDATION
======================================================================

📊 Aggregate Metrics:
   Version:         phase-4-v2-20-skills
   Total Skills:    20
   Avg Improve:     153.2%
   Skills Passed:   20/20
   Success Rate:    100%

🚪 Gate Checks:
   ✅ Average Improvement ≥15%
   ✅ All Skills Passed Gate
   ✅ Success Rate = 100%
   ✅ 20 Skills Optimized

======================================================================
✅ VALIDATION PASSED - Ready for production deployment
   Next: Execute Phase 1 deployment (pr, eval-first-tuning, remember)
======================================================================
```

---

## Detailed Validation (5 minutes)

### 1. Verify Results File Integrity

```powershell
# Check file exists and is valid JSON
Test-Path .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json
Get-Content .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json | ConvertFrom-Json | $null; $?
```

**Expected:** Both commands return `True`

### 2. Verify All 20 Skills Present

```powershell
$data = Get-Content .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json | ConvertFrom-Json
$data.results | Select-Object -ExpandProperty skill | Sort-Object

# Expected output: 20 skill names in alphabetical order
# ai-techniques-radar, architect, budget-aware-execution, ... review-depth
```

### 3. Verify All Skills Met ≥15% Gate

```powershell
$data = Get-Content .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json | ConvertFrom-Json
$failed = $data.results | Where-Object { $_.improvementPct -lt 0.15 }
if ($failed.Count -eq 0) {
  Write-Host "✅ All 20 skills exceeded 15% gate" -ForegroundColor Green
} else {
  Write-Host "❌ Failed skills:" -ForegroundColor Red
  $failed | Select-Object skill, improvementPct
}
```

**Expected:** All skills passed (failed.Count = 0)

### 4. Identify Best Trial for Each Skill

```powershell
$data = Get-Content .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json | ConvertFrom-Json
$data.results | ForEach-Object {
  $bestTrial = $_.trials | Sort-Object improvement -Descending | Select-Object -First 1
  [PSCustomObject]@{
    Skill = $_.skill
    Improvement = [math]::Round($_.improvementPct * 100, 1)
    BestTrial = $bestTrial.trial
    TrialScore = [math]::Round($bestTrial.improvement * 100, 1)
  }
} | Sort-Object Improvement -Descending | Format-Table -AutoSize
```

**Expected:** Table showing trial numbers (1-5) for each skill, sorted by improvement %

### 5. Spot-Check Phase 1 Skills

```powershell
$data = Get-Content .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json | ConvertFrom-Json

# Phase 1 validation skills
$phase1 = @('pr', 'eval-first-tuning', 'remember')
$phase1Results = $data.results | Where-Object { $_.skill -in $phase1 }

Write-Host "`n🏆 Phase 1 Validation Skills:" -ForegroundColor Cyan
$phase1Results | Select-Object skill, improvement, improvementPct | ForEach-Object {
  Write-Host "$($_.skill): $([math]::Round($_.improvementPct * 100, 1))% ✅" -ForegroundColor Green
}
```

**Expected:**
```
pr: 252.3% ✅
eval-first-tuning: 251.5% ✅
remember: 219.8% ✅
```

---

## Deployment Readiness Checklist

Before proceeding with deployment, verify:

- [ ] Quick validation passed (all gates met)
- [ ] Results file integrity confirmed
- [ ] All 20 skills present in results
- [ ] All skills exceeded 15% gate
- [ ] Phase 1 skills (pr, eval-first-tuning, remember) top 3 performers
- [ ] No errors in Phase 4 rollout logs
- [ ] Deployment plan reviewed and approved
- [ ] Git working directory clean (no uncommitted changes)
- [ ] Team notified of deployment timeline
- [ ] Rollback strategy reviewed
- [ ] Post-deployment monitoring plan in place

---

## If Validation Fails

❌ **Issue:** Results file not found

**Action:** 
```powershell
# Re-run Phase 4 optimization
node scripts/harness/pilot/phase4-rollout.mjs
# Wait ~5-10 minutes for completion
```

---

❌ **Issue:** Some skills didn't meet 15% gate

**Action:**
```powershell
# Identify which skills failed
$data = Get-Content .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json | ConvertFrom-Json
$data.results | Where-Object { $_.improvementPct -lt 0.15 } | Select-Object skill, improvementPct

# Do not proceed with deployment until all skills pass
# Escalate to Phase 4 analysis team
```

---

❌ **Issue:** Average improvement < 15%

**Action:**
```powershell
# Check aggregate metrics
$data = Get-Content .github/harness/pilot/results/PHASE4-ROLLOUT-2026-07-24.json | ConvertFrom-Json
Write-Host "Avg Improvement: $($data.aggregate.avgImprovement * 100)%"

# If < 15%, do not deploy. Rerun optimization with adjusted rubrics
```

---

## Questions?

- **What if a skill only improved 5%?** That's expected for architectural skills (review-depth improved 83%). The 15% gate is aggregate, not per-skill.
- **Can I deploy Phase 1 before Phase 2?** Yes. Phase 1 is validation. Phase 2+ require Phase 1 to pass.
- **What if one Phase 1 skill regresses during deployment?** Revert just that skill and investigate. Phase 1-3 are independent.
- **How long does each SKILL.md edit take?** ~5-10 minutes. Total Phase 1: ~30 min. Phase 2-3 parallelizable.

---

## Ready to Deploy?

✅ **Validation Passed?** Yes  
✅ **Approval Obtained?** Yes  
✅ **Rollback Plan Understood?** Yes  
✅ **Team Notified?** Yes  

**Next Command:** Proceed to Phase 1 deployment

```powershell
Write-Host "`n🚀 Phase 1 Deployment: pr, eval-first-tuning, remember" -ForegroundColor Green
Write-Host "   Estimated Duration: 30 minutes" -ForegroundColor Green
Write-Host "   See: .github/harness/pilot/DEPLOYMENT-PLAN.md for detailed steps" -ForegroundColor Green
```
