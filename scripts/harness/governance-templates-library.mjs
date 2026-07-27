#!/usr/bin/env node

/**
 * governance-templates-library.mjs
 *
 * Reusable governance decision templates for Phase 3+ governance workflows.
 * Provides factory functions to retrieve, clone, and export governance templates.
 *
 * Usage:
 *   Programmatic: const template = getTemplate('questionnaire', '3');
 *   CLI: node governance-templates-library.mjs --get questionnaire --phase 3
 */

/**
 * Phase 2b Governance Questionnaire Template
 * Source: phase2b-evaluation-questionnaire.md
 */
const QUESTIONNAIRE_TEMPLATE = {
  version: '2b',
  readOnly: true,
  name: 'Phase 2b Governance Questionnaire',
  description: 'Stakeholder input template for Phase 2b decision framework',
  questions: [
    {
      id: 'Q1',
      gate: 'Validation',
      prompt: 'Has Claude Code validated the need for graph edges (data model + traversal examples)?',
      scoringOptions: [
        { value: '+3', label: 'Yes, explicit validation received' },
        { value: '+3', label: 'Yes, implicit validation in requirements' },
        { value: '+1', label: 'Partial validation, some ambiguity' },
        { value: '-2', label: 'No validation, unclear need' },
      ],
      required: true,
    },
    {
      id: 'Q2',
      gate: 'Capacity',
      prompt: 'Do we have ≥120 engineering hours available for Phase 2b?',
      scoringOptions: [
        { value: '+3', label: 'Yes, ≥140 hours available' },
        { value: '+1', label: 'Yes, 120–140 hours available' },
        { value: '-2', label: 'No, <120 hours available' },
      ],
      required: true,
    },
    {
      id: 'Q3',
      gate: 'External Deadlines',
      prompt: 'Is Claude Code shipping within the next 30 days?',
      scoringOptions: [
        { value: '+3', label: 'Yes, ships <30 days' },
        { value: '+1', label: 'Yes, ships 30–45 days' },
        { value: '-2', label: 'No, ships >45 days' },
      ],
      required: true,
    },
    {
      id: 'Q4',
      gate: 'Priority',
      prompt: 'On a 1–10 scale, how urgent is Phase 2b versus Phase 3 metrics and other work?',
      scoringOptions: [
        { value: '9-10', label: 'Critical, must ship with Phase 2a (9–10)' },
        { value: '7-8', label: 'High priority, strong preference (7–8)' },
        { value: '5-6', label: 'Medium priority, can defer (5–6)' },
        { value: '1-4', label: 'Low priority, should defer (1–4)' },
      ],
      required: true,
    },
    {
      id: 'Q5',
      gate: 'Risk',
      prompt:
        'What is your confidence level that Phase 2b implementation will be successful on schedule?',
      scoringOptions: [
        { value: '90+%', label: 'High confidence, 90%+' },
        { value: '70%', label: 'Medium confidence, ~70%' },
        { value: '50%', label: 'Low confidence, ~50%' },
        { value: '<50%', label: 'Very low confidence, <50%' },
      ],
      required: true,
    },
    {
      id: 'Q6',
      gate: 'Alignment',
      prompt: 'How aligned is Phase 2b with your strategic priorities?',
      scoringOptions: [
        { value: 'Strongly', label: 'Strongly aligned' },
        { value: 'Aligned', label: 'Aligned' },
        { value: 'Neutral', label: 'Neutral' },
        { value: 'Misaligned', label: 'Misaligned' },
      ],
      required: true,
    },
    {
      id: 'Q7',
      gate: 'Authority',
      prompt: 'Who should make the final go/no-go decision on Phase 2b?',
      scoringOptions: [
        { value: 'Author', label: 'Feature author' },
        { value: 'PM', label: 'Product lead' },
        { value: 'EM', label: 'Engineering manager' },
        { value: 'Executive', label: 'Executive leadership' },
      ],
      required: true,
    },
  ],
  gateMapping: {
    Validation: { questionIds: ['Q1'], threshold: '+3' },
    Capacity: { questionIds: ['Q2'], threshold: '≥120' },
    'External Deadlines': { questionIds: ['Q3'], threshold: '+1' },
    Priority: { questionIds: ['Q4'], threshold: 'consensus' },
    Risk: { questionIds: ['Q5'], threshold: '≥70%' },
    Alignment: { questionIds: ['Q6'], threshold: 'Aligned or Strongly' },
    Authority: { questionIds: ['Q7'], threshold: 'appointed role' },
  },
};

/**
 * Phase 2b Voting Template
 * Source: phase2b-decision-voting-template.md
 */
const VOTING_TEMPLATE = {
  version: '2b',
  readOnly: true,
  name: 'Phase 2b Decision Voting Template',
  description: 'Response aggregation and go/no-go matrix',
  responseAggregation: {
    format: 'CSV or inline JSON',
    columns: [
      'Stakeholder Name',
      'Q1 Score',
      'Q2 Score',
      'Q3 Score',
      'Q4 Score',
      'Q5 Score',
      'Q6 Score',
      'Q7 Authority',
    ],
  },
  decisionMatrix: {
    goConditions: [
      'Validation gate passes: Q1 ≥ +3',
      'Capacity gate passes: Q2 ≥ 120 hours',
      'At least 3 stakeholders vote "Aligned" or "Strongly" for Q6',
      'Majority of stakeholders vote 7+ on Priority (Q4)',
      'Average confidence (Q5) ≥ 70%',
    ],
    nogoConditions: [
      'Q1 score is -2 (no validation)',
      'Q2 score is -2 (<120 hours)',
      'Majority vote "Misaligned" on Q6',
      'Average confidence (Q5) < 50%',
      'Decision Authority votes against Phase 2b',
    ],
    deferConditions: [
      'Mixed signals (some gates pass, some marginal)',
      'Risk confidence (Q5) between 50–70%',
      'Phase 2a dependencies need clarification',
    ],
  },
  conditionalRoadmap: {
    ifGo: 'Phase 2b ships with Phase 2a (hold release 1 week to 2026-08-08)',
    ifDefer: 'Phase 2b → Phase 3 backlog (August–September 2026)',
    ifNoGo: 'Feature deprioritized; resources reallocated to Phase 3 metrics',
  },
};

/**
 * Phase 2b Conditional Roadmap
 * Source: phase2b-conditional-roadmap.md
 */
const ROADMAP_TEMPLATE = {
  version: '2b',
  readOnly: true,
  name: 'Phase 2b Conditional Roadmap',
  description: 'Phase 3 backlog if Phase 2b is deferred',
  ifDeferred: {
    scope: [
      {
        name: 'Graph Edges (edges.mjs)',
        effort: '150 LOC',
        phase: 'Phase 3 Sprint 1',
        priority: 'P1',
      },
      {
        name: 'Per-Node Details (details.mjs)',
        effort: '80 LOC',
        phase: 'Phase 3 Sprint 1',
        priority: 'P1',
      },
      {
        name: 'Advanced Caching (caching.mjs)',
        effort: '150 LOC',
        phase: 'Phase 3 Sprint 2',
        priority: 'P2',
      },
    ],
    parallelActivities: [
      'Phase 2a ship (2026-08-01, independent)',
      'Phase 3 metrics implementation (2026-08-15)',
      'Phase 2b design review if needed (2026-08-08)',
    ],
    timeline: {
      phase2aShip: '2026-08-01 (regardless of Phase 2b decision)',
      phase3Planning: '2026-08-05 to 2026-08-08',
      phase3Sprint1: '2026-08-12 to 2026-08-26',
      phase3Sprint2: '2026-08-27 to 2026-09-09',
    },
  },
};

/**
 * Get template by name and phase
 * @param {string} templateName - 'questionnaire', 'voting', or 'roadmap'
 * @param {string} phase - Target phase (e.g., '3', '4'); if not provided, returns Phase 2b template
 * @returns {object} Template object
 */
export function getTemplate(templateName, phase) {
  // Phase 3+ can retrieve Phase 2b templates as base for customization
  // Default to Phase 2b if phase not specified
  const templates = {
    questionnaire: QUESTIONNAIRE_TEMPLATE,
    voting: VOTING_TEMPLATE,
    roadmap: ROADMAP_TEMPLATE,
  };

  if (!templates[templateName]) {
    throw new Error(`Unknown template: ${templateName}. Available: questionnaire, voting, roadmap`);
  }

  return JSON.parse(JSON.stringify(templates[templateName])); // Deep copy
}

/**
 * Clone template with customizations (Phase 3+ use)
 * @param {string} templateName - Template name
 * @param {string} phase - Target phase (e.g., '3')
 * @param {object} customizations - Custom fields to merge
 * @returns {object} New template with customizations applied
 */
export function cloneTemplate(templateName, phase, customizations = {}) {
  const base = getTemplate(templateName, phase);

  // Allow customization for Phase 3+
  if (phase && phase !== '2b') {
    base.version = phase;
    base.readOnly = false; // Phase 3+ templates are customizable
    base.name = `${base.name} (Phase ${phase})`;
    Object.assign(base, customizations);
  } else {
    throw new Error(
      'Cannot customize Phase 2b templates. Use cloneTemplate() with phase !== "2b" for new templates.',
    );
  }

  return base;
}

/**
 * Validate template structure
 * @param {object} template - Template to validate
 * @returns {object} Validation result: { valid, errors }
 */
export function validateTemplate(template) {
  const errors = [];

  if (!template || typeof template !== 'object') {
    return { valid: false, errors: ['Template must be a non-empty object'] };
  }

  if (!template.version) {
    errors.push('Template missing required field: version');
  }
  if (!template.name) {
    errors.push('Template missing required field: name');
  }
  if (template.version === '2b' && template.readOnly !== true) {
    errors.push('Phase 2b templates must be readOnly: true');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export template to Markdown
 * @param {object} template - Template to export
 * @returns {string} Markdown representation
 */
export function exportToMarkdown(template) {
  let md = `# ${template.name}\n\n`;
  md += `**Version:** ${template.version}\n`;
  md += `**Read-Only:** ${template.readOnly ? 'Yes' : 'No'}\n\n`;
  md += `${template.description}\n\n`;

  if (template.questions) {
    md += `## Questions\n\n`;
    template.questions.forEach((q) => {
      md += `### ${q.id}: ${q.prompt}\n\n`;
      md += `Gate: ${q.gate}\n\n`;
      md += `Options:\n`;
      q.scoringOptions.forEach((opt) => {
        md += `- ${opt.value}: ${opt.label}\n`;
      });
      md += `\n`;
    });
  }

  if (template.gateMapping) {
    md += `## Gate Mapping\n\n`;
    Object.entries(template.gateMapping).forEach(([gate, config]) => {
      md += `- **${gate}:** Questions ${config.questionIds.join(', ')}, threshold: ${config.threshold}\n`;
    });
    md += `\n`;
  }

  return md;
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      args[process.argv[i].slice(2)] = process.argv[i + 1];
      i++;
    }
  }

  if (args.get) {
    const template = getTemplate(args.get, args.phase);
    console.log(JSON.stringify(template, null, 2));
  } else if (args.clone) {
    const customizations = args.customizations ? JSON.parse(args.customizations) : {};
    const template = cloneTemplate(args.clone, args.phase || '3', customizations);
    console.log(JSON.stringify(template, null, 2));
  } else if (args.validate) {
    const templateData = JSON.parse(args.validate);
    const result = validateTemplate(templateData);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      'Usage:\n  --get <name> [--phase P] : Retrieve template\n  --clone <name> --phase P [--customizations JSON] : Clone & customize\n  --validate JSON : Validate template',
    );
  }
}
