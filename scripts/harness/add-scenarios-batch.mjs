#!/usr/bin/env node
/**
 * Batch add usage scenarios to registry.json skills
 * Generates realistic scenarios for all 38 skills based on their triggers
 */

import fs from 'fs';

const REGISTRY_PATH = './.github/harness/registry.json';

const scenarioMap = {
  remember: [
    {
      input: 'How do I save a hard-won debugging lesson so future sessions do not rediscover it?',
      skill: 'remember',
      explanation:
        'Demonstrates using remember skill to persist lessons to .github/harness/memory/',
    },
    {
      input: 'I found the root cause of a production issue. How do I document it for the team?',
      skill: 'remember',
      explanation: 'Shows persisting Architecture Briefs and lessons with proper formatting',
    },
  ],
  'understand-process': [
    {
      input: 'I need to understand the blast radius of a database change before implementing.',
      skill: 'understand-process',
      explanation: 'Demonstrates graph-first discovery and dependency impact analysis',
    },
    {
      input: 'What files are affected if I rename a core service?',
      skill: 'understand-process',
      explanation: 'Shows how to trace cross-domain dependencies and usage patterns',
    },
  ],
  architect: [
    {
      input: 'I have a feature idea. How do I design where the code should live?',
      skill: 'architect',
      explanation:
        'Shows Architecture Brief creation with 5 gates: domain, generality, ownership, layers, reuse',
    },
    {
      input: 'Should this logic go in the service or controller?',
      skill: 'architect',
      explanation: 'Demonstrates gate analysis for correct layer placement',
    },
  ],
  'design-system': [
    {
      input: 'How should I apply the brand color palette to a new dashboard?',
      skill: 'design-system',
      explanation: 'Shows design token reference and visual consistency patterns',
    },
    {
      input: 'What spacing and typography standards should I follow?',
      skill: 'design-system',
      explanation: 'Demonstrates design system constraints for accessible layouts',
    },
  ],
  'full-stack-feature': [
    {
      input: 'How do I build a new real-time feature from database to React UI?',
      skill: 'full-stack-feature',
      explanation: 'Covers entity, service, controller, route, and React component patterns',
    },
    {
      input: 'I need to add a new API endpoint and UI. Where do I start?',
      skill: 'full-stack-feature',
      explanation: 'Shows the vertical slice: entity → service → controller → route → component',
    },
  ],
  testing: [
    {
      input: 'How do I write unit tests for a service with mocked dependencies?',
      skill: 'testing',
      explanation: 'Demonstrates Jest patterns, mocking, and test-utils fixtures',
    },
    {
      input: 'How do I test a React component with React Query hooks?',
      skill: 'testing',
      explanation: 'Shows component testing with mock query clients and user-centric assertions',
    },
  ],
  implement: [
    {
      input: 'I have an Architecture Brief. How do I implement the changes?',
      skill: 'implement',
      explanation: 'Shows discovery checklist, implementation steps, and self-review gates',
    },
    {
      input: 'How do I validate my implementation before submitting for review?',
      skill: 'implement',
      explanation: 'Demonstrates self-review checklist covering TypeScript, security, and testing',
    },
  ],
  'review-breadth': [
    {
      input: 'I need to do a first-pass code review. What should I check?',
      skill: 'review-breadth',
      explanation:
        'Shows standards compliance, naming conventions, type safety, and security checks',
    },
    {
      input: 'How do I categorize issues by severity in a code review?',
      skill: 'review-breadth',
      explanation: 'Demonstrates severity-tagged findings lists with compliance categories',
    },
  ],
  'review-depth': [
    {
      input: 'How do I verify that a service is in the right domain?',
      skill: 'review-depth',
      explanation: 'Shows architectural gate analysis: ownership, data, and reuse verification',
    },
    {
      input: 'How do I check for cross-tenant data leakage?',
      skill: 'review-depth',
      explanation:
        'Demonstrates multi-tenant isolation checks and tenant-scoped query verification',
    },
  ],
  feedback: [
    {
      input: 'A reviewer challenged my service placement. How do I respond?',
      skill: 'feedback',
      explanation: 'Shows how to justify placement decisions using architectural gates',
    },
    {
      input: 'I got feedback about my Architecture Brief. Should I revise?',
      skill: 'feedback',
      explanation: 'Demonstrates verdict interpretation and brief update decision-making',
    },
  ],
  'run-loop': [
    {
      input: 'My build is failing. How do I use the build-fix loop?',
      skill: 'run-loop',
      explanation: 'Shows bounded iteration: compile → analyze → fix → recompile until green',
    },
    {
      input: 'Tests are failing in CI. How do I drive the test-fix loop?',
      skill: 'run-loop',
      explanation: 'Demonstrates test iteration with root cause analysis before each fix',
    },
  ],
  'ai-techniques-radar': [
    {
      input: 'I found a new AI technique. How do I track and evaluate it?',
      skill: 'ai-techniques-radar',
      explanation: 'Shows logging techniques, setting evaluation criteria, and adoption triaging',
    },
    {
      input: 'Should we adopt this new vector search approach?',
      skill: 'ai-techniques-radar',
      explanation: 'Demonstrates technique evaluation and integration decisions',
    },
  ],
  'context-engineering': [
    {
      input: 'I am switching to a new task. How do I preserve context?',
      skill: 'context-engineering',
      explanation: 'Shows session memory saving and task-switch checkpoint creation',
    },
    {
      input: 'My output quality is declining. Is it a context issue?',
      skill: 'context-engineering',
      explanation: 'Demonstrates context inventory analysis and refresh patterns',
    },
  ],
  'deterministic-validation': [
    {
      input: 'How do I prove that my code changes are complete?',
      skill: 'deterministic-validation',
      explanation: 'Shows objective proof methods and phase exit criteria',
    },
    {
      input: 'Tests fail but I think implementation is correct. What now?',
      skill: 'deterministic-validation',
      explanation: 'Demonstrates re-plan on failure: identify root cause, never skip checks',
    },
  ],
  'eval-first-tuning': [
    {
      input: 'Should I adopt this new library or stick with the current approach?',
      skill: 'eval-first-tuning',
      explanation: 'Shows baseline establishment and comparative evaluation methodology',
    },
    {
      input: 'How do I measure if an optimization actually improves our system?',
      skill: 'eval-first-tuning',
      explanation: 'Demonstrates adoption readiness checks and metric selection',
    },
  ],
  'doubt-driven-development': [
    {
      input: 'I need to change encryption keys. How do I ensure zero data loss?',
      skill: 'doubt-driven-development',
      explanation: 'Shows high-stakes patterns: assumption checks, reversibility analysis',
    },
    {
      input: 'I want a security expert to review my auth change before deploy.',
      skill: 'doubt-driven-development',
      explanation: 'Demonstrates cross-model review for production security changes',
    },
  ],
  'observability-and-instrumentation': [
    {
      input: 'How do I add Application Insights telemetry to my service?',
      skill: 'observability-and-instrumentation',
      explanation: 'Shows Winston logging, Application Insights SDK setup, and custom metrics',
    },
    {
      input: 'I need to debug a production issue. What telemetry should I check?',
      skill: 'observability-and-instrumentation',
      explanation: 'Demonstrates correlation IDs, structured logging, and trace analysis',
    },
  ],
  'budget-aware-execution': [
    {
      input: 'How do I ensure my implementation stays within token budget?',
      skill: 'budget-aware-execution',
      explanation: 'Shows token counting, context sizing, and efficient tool use',
    },
    {
      input: 'I am running out of tokens. What should I prioritize?',
      skill: 'budget-aware-execution',
      explanation: 'Demonstrates budget triage and essential-only task sequencing',
    },
  ],
  'setup-harness-bootstrap': [
    {
      input: 'How do I initialize the harness for a new project?',
      skill: 'setup-harness-bootstrap',
      explanation: 'Shows harness setup: registry, skills tree, workflows, validation',
    },
    {
      input: 'What documentation should I set up for issue-tracking mode?',
      skill: 'setup-harness-bootstrap',
      explanation: 'Demonstrates issue template setup, label configuration, and routing',
    },
  ],
  graphql: [
    {
      input: 'How do I implement a new GraphQL resolver?',
      skill: 'graphql',
      explanation: 'Shows Apollo Server patterns, type definitions, persisted queries',
    },
    {
      input: 'How do I prevent N+1 queries in my GraphQL resolvers?',
      skill: 'graphql',
      explanation: 'Demonstrates DataLoader usage and batch loading patterns',
    },
  ],
  'background-jobs': [
    {
      input: 'How do I schedule a background cleanup job?',
      skill: 'background-jobs',
      explanation: 'Shows job creation in backend/src/jobs/, cron patterns, error handling',
    },
    {
      input: 'I need to process a large dataset asynchronously. Where do I start?',
      skill: 'background-jobs',
      explanation: 'Demonstrates queue patterns, retry logic, and job monitoring',
    },
  ],
  websocket: [
    {
      input: 'How do I implement a real-time notification system with WebSockets?',
      skill: 'websocket',
      explanation: 'Shows Socket.io setup, room-based broadcasting, tenant scoping',
    },
    {
      input: 'How do I handle WebSocket disconnections and reconnections?',
      skill: 'websocket',
      explanation: 'Demonstrates heartbeat patterns, exponential backoff, and state recovery',
    },
  ],
  'discord-bot': [
    {
      input: 'How do I add a new slash command to the Discord bot?',
      skill: 'discord-bot',
      explanation: 'Shows slash command registration, permission checks, response handling',
    },
    {
      input: 'I need cross-guild commands. How do I implement sharding?',
      skill: 'discord-bot',
      explanation: 'Demonstrates bot sharding, IPC messaging, and guild management',
    },
  ],
  infrastructure: [
    {
      input: 'How do I deploy the application to Azure?',
      skill: 'infrastructure',
      explanation: 'Shows Bicep IaC, Azure Container Apps, multi-RG architecture',
    },
    {
      input: 'How do I set up CI/CD with GitHub Actions?',
      skill: 'infrastructure',
      explanation: 'Demonstrates workflow setup, Azure authentication, deployment stages',
    },
  ],
  'security-encryption': [
    {
      input: 'How do I implement end-to-end encryption in the application?',
      skill: 'security-encryption',
      explanation: 'Shows AES-256-GCM patterns, key management, Azure Key Vault',
    },
    {
      input: 'I need to add TOTP 2FA. How do I implement it?',
      skill: 'security-encryption',
      explanation: 'Demonstrates TOTP setup, backup codes, session binding',
    },
  ],
  'star-citizen-domain': [
    {
      input: 'How do I model a Star Citizen ship in the database?',
      skill: 'star-citizen-domain',
      explanation: 'Shows ship specs, role categorization, mining/combat equipment patterns',
    },
    {
      input: 'I need to sync with RSI data. How does that integration work?',
      skill: 'star-citizen-domain',
      explanation: 'Demonstrates RSI API patterns, fleet composition, activity lifecycle',
    },
  ],
  pr: [
    {
      input: 'My feature is ready. How do I open a pull request?',
      skill: 'pr',
      explanation: 'Shows PR creation, branch naming, commit message conventions',
    },
    {
      input: 'How do I request a Copilot review before human review?',
      skill: 'pr',
      explanation: 'Demonstrates automated code review and feedback addressing',
    },
  ],
  'backend-service': [
    {
      input: 'How do I create a new backend service?',
      skill: 'backend-service',
      explanation: 'Shows entity, service, controller, schema, route registration pattern',
    },
    {
      input: 'Where does business logic belong in a service-based architecture?',
      skill: 'backend-service',
      explanation: 'Demonstrates service layer patterns and controller responsibilities',
    },
  ],
  'frontend-component': [
    {
      input: 'How do I build a new React component with MUI?',
      skill: 'frontend-component',
      explanation: 'Shows component structure, hooks, styling with MUI v7, testing patterns',
    },
    {
      input: 'How do I fetch data in a React component?',
      skill: 'frontend-component',
      explanation: 'Demonstrates React Query hooks, error boundaries, loading states',
    },
  ],
  'federation-system': [
    {
      input: 'How do I handle multi-organization data isolation?',
      skill: 'federation-system',
      explanation: 'Shows tenant scoping, cross-org queries, permission checks',
    },
    {
      input: 'I need to implement org-to-org relationships. Where do I start?',
      skill: 'federation-system',
      explanation: 'Demonstrates diplomacy patterns, membership roles, org hierarchies',
    },
  ],
  'intel-operations': [
    {
      input: 'How do I implement intelligence gathering for corporations?',
      skill: 'intel-operations',
      explanation: 'Shows intel entity relationships, security levels, access controls',
    },
    {
      input: 'I need to add intel sharing between organizations. How?',
      skill: 'intel-operations',
      explanation: 'Demonstrates sharing level semantics and cross-org visibility',
    },
  ],
  'mining-operations': [
    {
      input: 'How do I calculate mining profitability for a loadout?',
      skill: 'mining-operations',
      explanation: 'Shows ore types, refinery patterns, profit calculations',
    },
    {
      input: 'I need to track mining activity over time. Where do I start?',
      skill: 'mining-operations',
      explanation: 'Demonstrates activity logging, productivity metrics, historical analysis',
    },
  ],
};

async function main() {
  try {
    // Read registry
    const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const registry = JSON.parse(registryContent);

    // Update skills with scenarios
    let updated = 0;
    for (const skill of registry.skills) {
      if (scenarioMap[skill.name]) {
        skill.scenarios = scenarioMap[skill.name];
        updated++;
      }
    }

    // Write back
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    console.log(`✅ Added scenarios to ${updated}/${registry.skills.length} skills`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
