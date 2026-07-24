#!/usr/bin/env node
/**
 * Tier 2 Optimizer — Integrated RAGAS + LLM-as-Judge
 * 
 * Orchestrates:
 * 1. Baseline evaluation (RAGAS + Rubric)
 * 2. Contrastive optimization (5 trials)
 * 3. Final scoring and comparison
 * 
 * Success gate: ≥2% improvement with 0-1 consensus score
 */

import fs from 'fs';
import path from 'path';
import { ragasEvaluate } from './ragas-evaluator.mjs';
import { scoreAgainstRubric } from './llm-judge-evaluator.mjs';

/**
 * Consensus scoring: Combine RAGAS + Rubric
 */
function consensusScore(ragasResult, rubricResult) {
  if (rubricResult.error) {
    // Fallback to RAGAS only
    return {
      ragas: ragasResult.avg,
      rubric: null,
      consensus: ragasResult.avg,
      confidence: ragasResult.confidence
    };
  }
  
  // Both available: average with equal weight
  const consensus = (ragasResult.avg + rubricResult.score) / 2;
  
  // Confidence: lower if RAGAS and Rubric disagree
  const disagreement = Math.abs(ragasResult.avg - rubricResult.score);
  const confidence = Math.max(0, ragasResult.confidence - disagreement * 0.2);
  
  return {
    ragas: ragasResult.avg,
    rubric: rubricResult.score,
    consensus: parseFloat(consensus.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(3))
  };
}

/**
 * Load instruction from SKILL.md
 */
function loadInstruction(skillName) {
  // Try multiple possible locations
  const possiblePaths = [
    `.github/skills/${skillName}/SKILL.md`,
    `skills/harness/SKILL.md`,
    `.github/harness/skills/${skillName}/SKILL.md`
  ];
  
  for (const skillPath of possiblePaths) {
    if (fs.existsSync(skillPath)) {
      console.log(`   Loaded instruction from: ${skillPath}`);
      return fs.readFileSync(skillPath, 'utf-8');
    }
  }
  
  console.log(`   ⚠️ Using placeholder instruction (files not found)`);
  return `Guidance for ${skillName}: Apply harness principles systematically.`;
}

/**
 * Evaluate instruction against eval-set
 */
function evaluateInstruction(instruction, evalSet, skillName) {
  const tests = evalSet.tests || [];
  let totalRagasScore = 0;
  let totalRubricScore = 0;
  let evaluatedCount = 0;
  
  for (const test of tests) {
    try {
      // Simulate response by combining instruction + prompt
      const response = `${instruction}\n\n--- Task: ${test.prompt} ---\nApplying the above guidance to solve this task...`;
      
      const ragasResult = ragasEvaluate(test.prompt, response, skillName);
      const rubricResult = scoreAgainstRubric(skillName, response);
      
      if (!rubricResult.error) {
        totalRagasScore += ragasResult.avg;
        totalRubricScore += rubricResult.score;
        evaluatedCount++;
      }
    } catch (e) {
      console.error(`  ❌ Error evaluating test: ${e.message}`);
    }
  }
  
  if (evaluatedCount === 0) {
    return { ragas: 0, rubric: 0, consensus: 0 };
  }
  
  const avgRagas = totalRagasScore / evaluatedCount;
  const avgRubric = totalRubricScore / evaluatedCount;
  const consensus = (avgRagas + avgRubric) / 2;
  
  return {
    ragas: parseFloat(avgRagas.toFixed(3)),
    rubric: parseFloat(avgRubric.toFixed(3)),
    consensus: parseFloat(consensus.toFixed(3)),
    samplesEvaluated: evaluatedCount
  };
}

/**
 * Generate instruction variant
 */
function generateVariant(baseInstruction, trial) {
  const variants = [
    () => `${baseInstruction}\n\n**Tier 2 Refinement ${trial}**: Emphasize clarity and concrete examples.`,
    () => `Enhanced guidance: ${baseInstruction}\n\nKey principle: Apply systematically at each stage.`,
    () => `${baseInstruction}\n\nAdditional consideration: Validate against domain boundaries.`,
    () => `${baseInstruction}\n\nRefinement: Include error handling and recovery strategies.`,
    () => `${baseInstruction}\n\nImprovement: Cross-reference with stage machine for alignment.`
  ];
  
  return variants[trial % variants.length]();
}

/**
 * Run Tier 2 optimization on a single skill
 */
async function optimizeSkill(skillName, evalSetPath, dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TIER 2 OPTIMIZATION: ${skillName}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Load eval-set
  if (!fs.existsSync(evalSetPath)) {
    console.error(`❌ Eval-set not found: ${evalSetPath}`);
    return null;
  }
  
  const evalSet = JSON.parse(fs.readFileSync(evalSetPath, 'utf-8'));
  console.log(`📋 Eval-set: ${evalSet.tests.length} tests`);
  
  // Load baseline instruction
  const baselineInstruction = loadInstruction(skillName);
  if (!baselineInstruction) {
    console.error(`❌ Could not load instruction for ${skillName}`);
    return null;
  }
  
  // Evaluate baseline
  console.log(`\n📊 Evaluating baseline instruction...`);
  const baselineScore = evaluateInstruction(baselineInstruction, evalSet, skillName);
  console.log(`  RAGAS:     ${(baselineScore.ragas * 100).toFixed(1)}%`);
  console.log(`  Rubric:    ${(baselineScore.rubric * 100).toFixed(1)}%`);
  console.log(`  Consensus: ${(baselineScore.consensus * 100).toFixed(1)}%`);
  
  if (dryRun) {
    console.log(`\n[DRY-RUN] Skipping optimization trials`);
    return {
      skill: skillName,
      baseline: baselineScore.consensus,
      final: baselineScore.consensus,
      improvement: 0,
      trials: []
    };
  }
  
  // Run optimization trials
  console.log(`\n🔄 Running 5 optimization trials...`);
  let bestScore = baselineScore.consensus;
  let bestVariant = null;
  const trials = [];
  
  for (let i = 1; i <= 5; i++) {
    process.stdout.write(`  Trial ${i}/5: `);
    
    const variant = generateVariant(baselineInstruction, i);
    const variantScore = evaluateInstruction(variant, evalSet, skillName);
    
    const improvement = variantScore.consensus - baselineScore.consensus;
    const improved = improvement >= 0.05; // 5% threshold
    
    if (improved && variantScore.consensus > bestScore) {
      bestScore = variantScore.consensus;
      bestVariant = variant;
      console.log(`✓ Improved (+${(improvement * 100).toFixed(1)}%)`);
    } else {
      console.log(`✗ Rejected (${improvement > 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%)`);
    }
    
    trials.push({
      trial: i,
      ragas: variantScore.ragas,
      rubric: variantScore.rubric,
      consensus: variantScore.consensus,
      improvement: parseFloat(improvement.toFixed(4))
    });
  }
  
  const finalScore = bestScore;
  const totalImprovement = finalScore - baselineScore.consensus;
  const improvementPct = totalImprovement / Math.max(baselineScore.consensus, 0.001);
  
  // Results
  console.log(`\n📈 Tier 2 Results:`);
  console.log(`  Baseline:    ${(baselineScore.consensus * 100).toFixed(1)}%`);
  console.log(`  Final:       ${(finalScore * 100).toFixed(1)}%`);
  console.log(`  Improvement: ${improvementPct > 0 ? '+' : ''}${(improvementPct * 100).toFixed(1)}%`);
  
  return {
    skill: skillName,
    baseline: baselineScore.consensus,
    final: finalScore,
    improvement: totalImprovement,
    improvementPct: parseFloat(improvementPct.toFixed(4)),
    trials,
    passed: improvementPct >= 0.02 // 2% gate
  };
}

/**
 * Main: Run pilot on 3 skills
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const baseDir = '.github/harness/pilot/synthetic-tests-v2';
  
  const skills = ['architect', 'eval-first-tuning', 'run-loop'];
  const results = [];
  
  console.log(`🚀 Starting Tier 2 Pilot Optimization`);
  console.log(`   Mode: ${dryRun ? 'DRY-RUN' : 'REAL'}`);
  console.log(`   Skills: ${skills.join(', ')}`);
  console.log(`   Trials: 5 per skill`);
  
  for (const skill of skills) {
    const evalSetPath = path.join(baseDir, `${skill}-synthetic.json`);
    const result = await optimizeSkill(skill, evalSetPath, dryRun);
    if (result) results.push(result);
  }
  
  // Aggregate results
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TIER 2 PILOT SUMMARY`);
  console.log(`${'='.repeat(60)}\n`);
  
  const avgImprovement = results.reduce((sum, r) => sum + r.improvementPct, 0) / results.length;
  const passedGate = results.filter(r => r.improvementPct >= 0.02).length;
  
  console.log(`📊 Aggregate Metrics:`);
  console.log(`  Average Improvement: ${avgImprovement > 0 ? '+' : ''}${(avgImprovement * 100).toFixed(1)}%`);
  console.log(`  Skills meeting gate: ${passedGate}/${results.length}`);
  
  for (const result of results) {
    const status = result.improvementPct >= 0.02 ? '✓' : '✗';
    console.log(`  ${status} ${result.skill}: ${result.improvementPct > 0 ? '+' : ''}${(result.improvementPct * 100).toFixed(1)}%`);
  }
  
  // Save results
  const outputPath = `.github/harness/pilot/results/TIER2-PILOT-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(outputPath, JSON.stringify({ timestamp: new Date().toISOString(), results, avgImprovement }, null, 2));
  console.log(`\n✅ Results saved to: ${outputPath}`);
  
  // Decision gate
  console.log(`\n${'='.repeat(60)}`);
  if (avgImprovement >= 0.15) {
    console.log(`✅ APPROVAL GATE MET (avg improvement ≥15%)`);
    console.log(`   Ready for Phase 4: Full 20-skill rollout`);
  } else if (avgImprovement >= 0.02) {
    console.log(`⚠️ PARTIAL SUCCESS (2% ≤ avg improvement < 15%)`);
    console.log(`   Recommend: Fine-tune rubrics and re-run`);
  } else {
    console.log(`❌ APPROVAL GATE NOT MET (avg improvement < 2%)`);
    console.log(`   Recommend: Reconsider approach or model tuning`);
  }
  console.log(`${'='.repeat(60)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
