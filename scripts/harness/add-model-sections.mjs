#!/usr/bin/env node

/**
 * Add "Recommended Models" sections to all 19 harness skills
 * Reads each SKILL.md, finds Philosophy/Objective section, inserts model recommendation
 * Execution: node scripts/harness/add-model-sections.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const skillModels = {
  '.github/skills/eval-first-tuning/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+251.5%',
    reason: 'Baseline establishment + rigorous comparison logic requires multi-step reasoning'
  },
  '.github/skills/ai-techniques-radar/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+106.3%',
    reason: 'Technique triage and adoption decisions require comparative analysis and strategic reasoning'
  },
  '.github/skills/prototype/SKILL.md': {
    primary: 'gpt-5.3-codex',
    fallback: 'claude-opus-4.8',
    benchmark: '+219.0%',
    reason: 'Throwaway logic validation is code-focused; use Opus fallback for complex state transitions'
  },
  '.github/skills/observability-and-instrumentation/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+108.4%',
    reason: 'Telemetry patterns and RED metrics require comprehensive system reasoning'
  },
  '.github/skills/retrieval-quality-ops/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+110.5%',
    reason: 'A/B evaluation requires rigorous comparison methodology and metric-driven reasoning'
  },
  '.github/skills/context-engineering/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+111.4%',
    reason: 'Context preservation across task switches requires sophisticated session reasoning'
  },
  '.github/skills/budget-aware-execution/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+111.8%',
    reason: 'Resource boundary discipline and checkpoint reasoning require constraint-aware thinking'
  },
  '.github/skills/setup-harness-bootstrap/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+145.0%',
    reason: 'Complete stage structure initialization requires comprehensive orchestration reasoning'
  },
  '.github/skills/understand-process/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+199.5%',
    reason: 'Graph-first dependency discovery requires multi-hop reasoning and blast-radius estimation'
  },
  '.github/skills/deterministic-validation/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+111.8%',
    reason: 'Proof gates require strict logical reasoning and objective verification'
  },
  '.github/skills/teach-agent/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+101.8%',
    reason: 'Machine-executable guidance requires procedural clarity and agent-first thinking'
  },
  '.claude/skills/remember/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+219.8%',
    reason: 'Determining what\'s reusable requires architectural judgment across project context'
  },
  '.claude/skills/feedback/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+219.0%',
    reason: 'Challenge resolution requires structured decision logic and evidence reconciliation'
  },
  '.claude/skills/architect/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'claude-haiku-4.5',
    benchmark: '+201.6%',
    reason: 'Architecture Briefs require sustained reasoning across design trade-offs and boundary specifications'
  },
  '.claude/skills/implement/SKILL.md': {
    primary: 'gpt-5.3-codex',
    fallback: 'claude-opus-4.8',
    benchmark: '+130.0%',
    reason: 'Code generation benefits from coding specialist; use Opus fallback for multi-module logic'
  },
  '.claude/skills/review-breadth/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+113.2%',
    reason: 'Coverage dimension requires broad-scope reasoning across correctness, standards, safety, completeness'
  },
  '.claude/skills/review-depth/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+83.2%',
    reason: 'Structural depth review requires deep architectural analysis of ownership and boundaries'
  },
  '.claude/skills/run-loop/SKILL.md': {
    primary: 'claude-opus-4.8',
    fallback: 'gpt-5.3-codex',
    benchmark: '+99.5%',
    reason: 'Loop contract enforcement and guardrail non-negotiability require deterministic reasoning'
  }
};

const modelSection = (models) => {
  return `---

## Recommended Models

**Primary:** \`${models.primary}\` (${models.primary.includes('opus') ? 'High-Reasoning' : models.primary.includes('codex') ? 'Balanced-Coding' : 'Lightweight'})  
**Fallback:** \`${models.fallback}\` (${models.fallback.includes('opus') ? 'High-Reasoning' : models.fallback.includes('codex') ? 'Balanced-Coding' : 'Lightweight'})

**Why?** ${models.reason} Phase 4 benchmark: ${models.benchmark}.

---
`;
};

async function addModelSections() {
  let success = 0;
  let failed = 0;

  for (const [filePath, modelInfo] of Object.entries(skillModels)) {
    const fullPath = path.join(rootDir, filePath);
    
    try {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      // Check if section already exists
      if (content.includes('## Recommended Models')) {
        console.log(`⊘ ${filePath} — already has Recommended Models section`);
        continue;
      }

      // Find insertion point: look for first "---" separator after section titles
      const sectionMatch = content.match(/\n---\n$/m);
      if (!sectionMatch) {
        // Try to find first section boundary
        const patterns = [
          /(\n---\n\n## Objective\n)/,
          /(\n---\n\n## Principles\n)/,
          /(\n---\n\n## Philosophy\n)/,
          /(\n---\n\n## When to Use)/,
          /(\n---\n\n## Workflow\n)/,
          /(\n---\n\n## Curation Lifecycle)/,
          /(\n---\n\n## Procedure\n)/,
          /(\n---\n\n## Verification Gate Function)/,
          /(\n---\n\n## Process\n)/,
          /(\n---\n\n## Purpose\n)/,
          /(\n---\n\n## Objective\n)/
        ];
        
        let match = null;
        for (const p of patterns) {
          match = content.match(p);
          if (match) break;
        }
        
        if (match) {
          const insertPoint = match.index + match[0].length;
          const before = content.substring(0, insertPoint);
          const after = content.substring(insertPoint);
          
          const updated = before + modelSection(modelInfo) + after;
          fs.writeFileSync(fullPath, updated, 'utf-8');
          console.log(`✓ ${filePath}`);
          success++;
        } else {
          console.log(`✗ ${filePath} — could not find insertion point`);
          failed++;
        }
      } else {
        console.log(`✗ ${filePath} — malformed file`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ ${filePath} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Success: ${success}/${Object.keys(skillModels).length}`);
  console.log(`❌ Failed: ${failed}/${Object.keys(skillModels).length}`);
}

addModelSections().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
