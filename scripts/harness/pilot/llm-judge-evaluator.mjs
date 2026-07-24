#!/usr/bin/env node
/**
 * LLM-as-Judge Evaluator — Tier 2 Rubric-Based Scoring
 * 
 * Uses structured rubrics to score instruction quality across
 * skill-specific dimensions (clarity, completeness, alignment, etc.)
 * 
 * Output: { rubric_score, breakdown, reasoning }
 */

import fs from 'fs';

/**
 * Skill-specific rubric definitions
 */
const RUBRICS = {
  architect: {
    name: 'Architect Skill Rubric',
    criteria: [
      {
        name: 'Design Clarity',
        description: 'Does the instruction clearly specify the design decision and its rationale?',
        weight: 0.25,
        indicators: {
          strong: ['decision tree', 'tradeoff', 'rationale', 'constraint', 'option'],
          weak: ['vague', 'unclear', 'depends on', 'maybe', 'perhaps']
        }
      },
      {
        name: 'Stage Machine Alignment',
        description: 'How well does the instruction map to the 6-stage workflow?',
        weight: 0.25,
        indicators: {
          strong: ['understand', 'architect', 'implement', 'review', 'feedback', 'stage'],
          weak: ['ad-hoc', 'one-off', 'custom', 'bypass']
        }
      },
      {
        name: 'Boundary Specification',
        description: 'Are ownership and scope boundaries clearly defined?',
        weight: 0.2,
        indicators: {
          strong: ['owner', 'boundary', 'responsibility', 'scope', 'interface'],
          weak: ['shared', 'unclear', 'ambiguous', 'mixed']
        }
      },
      {
        name: 'Generality & Reuse',
        description: 'Can this design pattern apply to multiple contexts?',
        weight: 0.15,
        indicators: {
          strong: ['reusable', 'pattern', 'generic', 'abstraction', 'framework'],
          weak: ['one-time', 'specific', 'hardcoded', 'bespoke']
        }
      },
      {
        name: 'Risk Mitigation',
        description: 'Are potential risks and mitigations identified?',
        weight: 0.15,
        indicators: {
          strong: ['risk', 'mitigation', 'contingency', 'fallback', 'guard'],
          weak: ['risky', 'untested', 'unvalidated', 'fragile']
        }
      }
    ]
  },
  
  'eval-first-tuning': {
    name: 'Eval-First-Tuning Skill Rubric',
    criteria: [
      {
        name: 'Baseline Establishment',
        description: 'Is a clear baseline metric established before optimization?',
        weight: 0.25,
        indicators: {
          strong: ['baseline', 'current state', 'reference', 'metric', 'measurement'],
          weak: ['no baseline', 'assume', 'unclear starting point']
        }
      },
      {
        name: 'Metric Selection',
        description: 'Are evaluation metrics appropriate and well-defined?',
        weight: 0.25,
        indicators: {
          strong: ['accuracy', 'precision', 'recall', 'f1', 'metric', 'threshold', 'score'],
          weak: ['vague metric', 'undefined', 'qualitative only']
        }
      },
      {
        name: 'Comparison Methodology',
        description: 'Is the A/B or comparison approach rigorous?',
        weight: 0.2,
        indicators: {
          strong: ['a/b test', 'control', 'experiment', 'comparison', 'validation'],
          weak: ['informal', 'gut feeling', 'no control', 'cherry-picked']
        }
      },
      {
        name: 'Decision Framework',
        description: 'Are clear decision criteria provided?',
        weight: 0.15,
        indicators: {
          strong: ['decision', 'gate', 'criteria', 'threshold', 'if-then'],
          weak: ['maybe', 'could', 'might', 'subjective']
        }
      },
      {
        name: 'Actionability',
        description: 'Can someone follow the guidance to take action?',
        weight: 0.15,
        indicators: {
          strong: ['step', 'command', 'script', 'tool', 'procedure'],
          weak: ['abstract', 'conceptual', 'no examples']
        }
      }
    ]
  },
  
  'run-loop': {
    name: 'Run-Loop Skill Rubric',
    criteria: [
      {
        name: 'Contract Compliance',
        description: 'Does the instruction follow the loop JSON contract?',
        weight: 0.25,
        indicators: {
          strong: ['contract', 'schema', 'json', 'format', 'specification'],
          weak: ['ignore contract', 'custom format', 'incompatible']
        }
      },
      {
        name: 'Convergence Bounds',
        description: 'Are loop convergence and termination conditions clear?',
        weight: 0.25,
        indicators: {
          strong: ['convergence', 'bounds', 'max iterations', 'exit criteria', 'threshold'],
          weak: ['infinite loop', 'unclear exit', 'unbounded']
        }
      },
      {
        name: 'Error Recovery',
        description: 'Does the instruction handle errors and edge cases?',
        weight: 0.2,
        indicators: {
          strong: ['error', 'recovery', 'fallback', 'retry', 'exception'],
          weak: ['fails silently', 'no recovery', 'unhandled']
        }
      },
      {
        name: 'Tracing Quality',
        description: 'Is observability and tracing instrumented?',
        weight: 0.15,
        indicators: {
          strong: ['trace', 'log', 'debug', 'observability', 'telemetry'],
          weak: ['no logs', 'hidden', 'opaque']
        }
      },
      {
        name: 'Audit Trail',
        description: 'Can decisions and state changes be audited?',
        weight: 0.15,
        indicators: {
          strong: ['audit', 'history', 'checkpoint', 'record', 'trail'],
          weak: ['ephemeral', 'no record', 'lost on exit']
        }
      }
    ]
  }
};

/**
 * Score a response against a rubric
 */
export function scoreAgainstRubric(skillKey, response) {
  const rubric = RUBRICS[skillKey];
  if (!rubric) {
    return { error: `Unknown skill: ${skillKey}` };
  }
  
  const breakdown = {};
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const criterion of rubric.criteria) {
    const responseLower = response.toLowerCase();
    
    // Count strong indicators
    const strongCount = criterion.indicators.strong
      .filter(indicator => responseLower.includes(indicator)).length;
    
    // Count weak indicators
    const weakCount = criterion.indicators.weak
      .filter(indicator => responseLower.includes(indicator)).length;
    
    // Score: strong presence improves, weak presence degrades
    const strengthRatio = (strongCount + 1) / (criterion.indicators.strong.length + 1);
    const weaknessRatio = weakCount / (criterion.indicators.weak.length + 1);
    const score = Math.max(0, Math.min(1, strengthRatio - weaknessRatio * 0.3));
    
    breakdown[criterion.name] = {
      score: parseFloat(score.toFixed(3)),
      weight: criterion.weight,
      strongFound: strongCount,
      weakFound: weakCount
    };
    
    totalScore += score * criterion.weight;
    totalWeight += criterion.weight;
  }
  
  const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  
  return {
    skill: skillKey,
    rubric: rubric.name,
    score: parseFloat(normalizedScore.toFixed(3)),
    breakdown,
    reasoning: generateReasoning(rubric, breakdown, normalizedScore)
  };
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(rubric, breakdown, score) {
  const strengths = Object.entries(breakdown)
    .filter(([, data]) => data.score >= 0.7)
    .map(([name]) => name);
  
  const weaknesses = Object.entries(breakdown)
    .filter(([, data]) => data.score < 0.5)
    .map(([name]) => name);
  
  let reasoning = `Rubric Score: ${(score * 100).toFixed(0)}/100\n`;
  
  if (strengths.length > 0) {
    reasoning += `✅ Strengths: ${strengths.join(', ')}\n`;
  }
  
  if (weaknesses.length > 0) {
    reasoning += `⚠️ Areas for improvement: ${weaknesses.join(', ')}\n`;
  }
  
  if (score >= 0.8) {
    reasoning += `Overall: Excellent instruction with strong alignment to rubric.`;
  } else if (score >= 0.6) {
    reasoning += `Overall: Good instruction with some gaps to address.`;
  } else if (score >= 0.4) {
    reasoning += `Overall: Moderate instruction requiring significant refinement.`;
  } else {
    reasoning += `Overall: Poor instruction alignment to rubric criteria.`;
  }
  
  return reasoning;
}

/**
 * Batch score multiple responses
 */
export function scoreBatch(skillKey, responses) {
  return responses.map((response, idx) => ({
    responseId: response.id || `response-${idx}`,
    judgment: scoreAgainstRubric(skillKey, response.text || response)
  }));
}

// CLI execution
async function main() {
  const skillKey = process.argv[2] || 'architect';
  const responseFile = process.argv[3];
  
  // Demo: score a sample instruction
  const sampleInstructions = {
    architect: `
      Run the Architect stage: Define the design decision clearly.
      
      1. Understand the problem scope and constraints
      2. Identify potential architectural patterns
      3. Document ownership boundaries and interfaces
      4. Assess reusability across contexts
      5. Mitigate identified risks
      
      This approach ensures generality and clarity.
    `,
    'eval-first-tuning': `
      Establish baseline metrics before tuning. Measure accuracy on reference dataset.
      Compare against control group using A/B methodology with statistical significance testing.
      Decision gate: Accept improvement if p < 0.05 and effect size > 5%.
    `,
    'run-loop': `
      Execute the loop with convergence bounds. Max 10 iterations or threshold stability.
      Log all state transitions. On error, retry with exponential backoff up to 3 attempts.
      Checkpoint state at each iteration for audit trail.
    `
  };
  
  const instruction = sampleInstructions[skillKey] || sampleInstructions['architect'];
  
  console.log(`📋 LLM-as-Judge: ${skillKey}`);
  console.log(`\n${instruction}`);
  
  const result = scoreAgainstRubric(skillKey, instruction);
  
  console.log(`\n✅ Rubric Score: ${(result.score * 100).toFixed(0)}/100`);
  console.log(`\nBreakdown:`);
  
  for (const [criterion, data] of Object.entries(result.breakdown)) {
    console.log(`  ${criterion}: ${(data.score * 100).toFixed(0)}/100 (weight: ${data.weight * 100}%)`);
  }
  
  console.log(`\n${result.reasoning}`);
  
  // Save results
  const outputPath = `.github/harness/pilot/results/LLM-JUDGE-${skillKey}-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
