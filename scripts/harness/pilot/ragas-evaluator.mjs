#!/usr/bin/env node
/**
 * RAGAS Evaluator — Tier 2 Semantic Quality Scoring
 * 
 * Measures instruction response quality using:
 * - Coherence: Response structure and flow
 * - Relevance: How well response addresses the task
 * - Faithfulness: Alignment with harness domain
 * 
 * Output: { coherence, relevance, faithfulness, avg, confidence }
 */

import fs from 'fs';
import path from 'path';

/**
 * Compute semantic similarity between two texts
 * (simplified: use keyword overlap + length ratio)
 */
function semanticSimilarity(text1, text2) {
  const normalize = (t) => t.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = words1.size + words2.size - intersection;
  
  return union === 0 ? 1 : intersection / union;
}

/**
 * Evaluate coherence: Is the response well-structured?
 */
function evaluateCoherence(response) {
  if (!response || response.trim().length === 0) return 0;
  
  // Check for basic structure markers
  const hasHeadings = /^#+\s/m.test(response);
  const hasBullets = /^[\*\-]\s/m.test(response);
  const hasNumbers = /^\d+\.\s/m.test(response);
  const hasCodeBlocks = /```/g.test(response);
  
  const structureScore = [hasHeadings, hasBullets, hasNumbers, hasCodeBlocks]
    .filter(Boolean).length / 4;
  
  // Check sentence length variance (good coherence has varied length)
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 2) return structureScore * 0.5;
  
  const lengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  
  // Higher variance = more varied sentence structure = better coherence
  const varianceScore = Math.min(variance / 50, 1); // Normalize to 0-1
  
  return (structureScore * 0.5 + varianceScore * 0.5);
}

/**
 * Evaluate relevance: Does response address the task?
 */
function evaluateRelevance(taskPrompt, response) {
  if (!response || response.trim().length === 0) return 0;
  
  // Semantic similarity between prompt and response
  const similarity = semanticSimilarity(taskPrompt, response);
  
  // Check for task-specific keywords
  const taskKeywords = taskPrompt
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 4);
  
  const responseWords = new Set(response.toLowerCase().split(/\W+/));
  const keywordCoverage = taskKeywords.filter(k => responseWords.has(k)).length / Math.max(taskKeywords.length, 1);
  
  return (similarity * 0.6 + keywordCoverage * 0.4);
}

/**
 * Evaluate faithfulness: Is response true to harness domain?
 */
function evaluateFaithfulness(skillDomain, response) {
  if (!response || response.trim().length === 0) return 0;
  
  // Domain-specific keywords to expect
  const domainKeywords = {
    architect: ['stage', 'brief', 'architecture', 'boundary', 'contract', 'reuse'],
    'eval-first-tuning': ['baseline', 'metric', 'evaluation', 'comparison', 'decision'],
    'run-loop': ['loop', 'convergence', 'bounds', 'error', 'recovery', 'trace']
  };
  
  const keywords = domainKeywords[skillDomain] || [];
  if (keywords.length === 0) return 0.5; // Unknown domain
  
  const responseWords = new Set(response.toLowerCase().split(/\W+/));
  const keywordMatch = keywords.filter(k => responseWords.has(k)).length / keywords.length;
  
  // Check for harness-specific patterns
  const hasStageRef = /stage|workflow|pipeline/.test(response.toLowerCase());
  const hasBriefRef = /brief|architecture|contract/.test(response.toLowerCase());
  const hasLoopRef = /loop|convergence|iterate/.test(response.toLowerCase());
  
  const patternScore = [hasStageRef, hasBriefRef, hasLoopRef]
    .filter(Boolean).length / 3;
  
  return (keywordMatch * 0.7 + patternScore * 0.3);
}

/**
 * RAGAS evaluation: Complete scoring
 */
export function ragasEvaluate(taskPrompt, response, skillDomain = 'unknown') {
  const coherence = evaluateCoherence(response);
  const relevance = evaluateRelevance(taskPrompt, response);
  const faithfulness = evaluateFaithfulness(skillDomain, response);
  
  const avg = (coherence + relevance + faithfulness) / 3;
  
  // Confidence: higher if all three components agree
  const variance = [coherence, relevance, faithfulness]
    .reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / 3;
  const confidence = Math.max(0, 1 - Math.sqrt(variance));
  
  return {
    coherence: parseFloat(coherence.toFixed(3)),
    relevance: parseFloat(relevance.toFixed(3)),
    faithfulness: parseFloat(faithfulness.toFixed(3)),
    avg: parseFloat(avg.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(3))
  };
}

/**
 * Batch evaluate multiple responses
 */
export function ragasEvaluateBatch(tasks, skillDomain = 'unknown') {
  return tasks.map((task, idx) => ({
    taskId: task.id || `task-${idx}`,
    prompt: task.prompt || task.input || '',
    response: task.response || task.output || '',
    scores: ragasEvaluate(
      task.prompt || task.input || '',
      task.response || task.output || '',
      skillDomain
    )
  }));
}

// CLI execution
async function main() {
  const skillDomain = process.argv[2] || 'unknown';
  const testFile = process.argv[3] || '.github/harness/pilot/synthetic-tests/architect-synthetic.json';
  
  if (!fs.existsSync(testFile)) {
    console.error(`❌ Test file not found: ${testFile}`);
    process.exit(1);
  }
  
  const testData = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
  const tasks = testData.tests || [];
  
  console.log(`📊 RAGAS Evaluation: ${skillDomain}`);
  console.log(`   Tasks: ${tasks.length}`);
  
  const results = ragasEvaluateBatch(tasks, skillDomain);
  
  const avgScores = {
    coherence: results.reduce((sum, r) => sum + r.scores.coherence, 0) / results.length,
    relevance: results.reduce((sum, r) => sum + r.scores.relevance, 0) / results.length,
    faithfulness: results.reduce((sum, r) => sum + r.scores.faithfulness, 0) / results.length,
  };
  avgScores.avg = (avgScores.coherence + avgScores.relevance + avgScores.faithfulness) / 3;
  
  console.log(`\n✅ RAGAS Scores (Aggregate):`);
  console.log(`   Coherence:    ${(avgScores.coherence * 100).toFixed(1)}%`);
  console.log(`   Relevance:    ${(avgScores.relevance * 100).toFixed(1)}%`);
  console.log(`   Faithfulness: ${(avgScores.faithfulness * 100).toFixed(1)}%`);
  console.log(`   Average:      ${(avgScores.avg * 100).toFixed(1)}%`);
  
  // Output JSON
  const outputPath = `.github/harness/pilot/results/RAGAS-SCORES-${skillDomain}-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(outputPath, JSON.stringify({ skill: skillDomain, scores: avgScores, details: results }, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
