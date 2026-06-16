#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const registryPath = join(repoRoot, '.github', 'harness', 'registry.json');
const schemaPath = join(repoRoot, '.github', 'harness', 'schemas', 'skill-metadata.schema.json');

const skillRoots = [
  join(repoRoot, 'skills'),
  join(repoRoot, '.github', 'skills'),
  join(repoRoot, '.claude', 'skills'),
].filter(rootPath => existsSync(rootPath));

function fail(message, code = 2) {
  console.error(`[validate-skill-metadata] ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    strict: argv.includes('--strict'),
  };
}

function isWithin(basePath, candidatePath) {
  const normalizedBase = resolve(basePath);
  const normalizedCandidate = resolve(candidatePath);
  return (
    normalizedCandidate === normalizedBase ||
    normalizedCandidate.startsWith(`${normalizedBase}${sep}`)
  );
}

function assertWithin(basePath, candidatePath, label) {
  if (!isWithin(basePath, candidatePath)) {
    fail(`${label} resolves outside allowed root: ${candidatePath}`);
  }
}

function joinWithin(basePath, ...parts) {
  const candidatePath = join(basePath, ...parts);
  assertWithin(basePath, candidatePath, 'joined path');
  return candidatePath;
}

function readJson(path, label) {
  try {
    assertWithin(repoRoot, path, label);
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`cannot parse ${label}: ${error.message}`);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSemverLike(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function pushIf(errors, condition, message) {
  if (condition) {
    errors.push(message);
  }
}

function validateRequiredFields(metadata) {
  const required = [
    'slug',
    'name',
    'description',
    'version',
    'status',
    'owner',
    'entrypoint',
    'tags',
    'triggers',
  ];

  return required.filter(key => !(key in metadata)).map(key => `missing required field: ${key}`);
}

function validateMetadataShape(skillDir, metadata) {
  const errors = validateRequiredFields(metadata);

  pushIf(errors, metadata.slug !== skillDir, `slug must match directory name (${skillDir})`);
  pushIf(errors, !isNonEmptyString(metadata.name), 'name must be a non-empty string');
  pushIf(errors, !isNonEmptyString(metadata.description), 'description must be a non-empty string');
  pushIf(errors, !isSemverLike(metadata.version), 'version must use semver format x.y.z');
  pushIf(
    errors,
    !['active', 'experimental', 'deprecated'].includes(metadata.status),
    'status must be one of: active, experimental, deprecated'
  );
  pushIf(
    errors,
    typeof metadata.owner !== 'object' ||
      metadata.owner === null ||
      !isNonEmptyString(metadata.owner.team),
    'owner.team must be a non-empty string'
  );
  pushIf(errors, !isNonEmptyString(metadata.entrypoint), 'entrypoint must be a non-empty string');
  pushIf(
    errors,
    !Array.isArray(metadata.tags) || metadata.tags.length < 1,
    'tags must be a non-empty array of strings'
  );
  pushIf(
    errors,
    !Array.isArray(metadata.triggers) || metadata.triggers.length < 1,
    'triggers must be a non-empty array of strings'
  );
  pushIf(
    errors,
    Array.isArray(metadata.tags) && metadata.tags.some(tag => !isNonEmptyString(tag)),
    'tags must contain only non-empty strings'
  );
  pushIf(
    errors,
    Array.isArray(metadata.triggers) &&
      metadata.triggers.some(trigger => !isNonEmptyString(trigger)),
    'triggers must contain only non-empty strings'
  );
  pushIf(
    errors,
    metadata.requires_skills !== undefined &&
      (!Array.isArray(metadata.requires_skills) ||
        metadata.requires_skills.some(dep => !isNonEmptyString(dep))),
    'requires_skills must be an array of non-empty strings when provided'
  );

  return errors;
}

function listSkillDirs(rootPath) {
  return readdirSync(rootPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function extractSkillSlug(skillPath) {
  const match = /(?:^|\/)(?:skills|\.github\/skills|\.claude\/skills)\/([^/]+)\/SKILL\.md$/.exec(
    String(skillPath)
  );
  return match?.[1] ?? null;
}

function loadRegistrySkills() {
  if (!existsSync(registryPath)) {
    return new Set();
  }

  const registry = readJson(registryPath, 'registry.json');
  const slugs = new Set();

  const stageEntries = Object.values(registry.workflow?.stages ?? {});
  for (const entry of stageEntries) {
    const stageSkill = extractSkillSlug(entry?.skill);
    if (stageSkill) {
      slugs.add(stageSkill);
    }
  }

  const provided = Array.isArray(registry.skills?.provided) ? registry.skills.provided : [];
  for (const item of provided) {
    const slug = isNonEmptyString(item?.slug) ? item.slug : null;
    if (slug) {
      slugs.add(slug);
    }
  }

  return slugs;
}

function validateSingleSkill(skillDir, skillRoot, knownSkills, registrySkills) {
  const errors = [];
  const warnings = [];

  const skillPath = joinWithin(skillRoot, skillDir);
  const skillMarkdownPath = joinWithin(skillPath, 'SKILL.md');
  const metadataPath = joinWithin(skillPath, 'metadata.json');

  if (!existsSync(skillMarkdownPath)) {
    warnings.push(`${relative(repoRoot, skillPath)}: missing SKILL.md`);
    return { errors, warnings, validated: null };
  }

  if (!existsSync(metadataPath)) {
    warnings.push(`${relative(repoRoot, skillPath)}: missing metadata.json`);
    return { errors, warnings, validated: null };
  }

  const metadata = readJson(metadataPath, `${skillDir}/metadata.json`);
  for (const shapeError of validateMetadataShape(skillDir, metadata)) {
    errors.push(`${skillDir}: ${shapeError}`);
  }

  const entrypointPath = joinWithin(skillPath, String(metadata.entrypoint || ''));
  pushIf(
    errors,
    !existsSync(entrypointPath),
    `${skillDir}: entrypoint not found (${metadata.entrypoint})`
  );

  const dependencies = Array.isArray(metadata.requires_skills) ? metadata.requires_skills : [];
  for (const dependency of dependencies) {
    if (!knownSkills.has(dependency)) {
      errors.push(`${skillDir}: requires_skills references unknown skill (${dependency})`);
    }
  }

  if (!registrySkills.has(skillDir)) {
    warnings.push(`${skillDir}: not referenced in .github/harness/registry.json skills.provided`);
  }

  return {
    errors,
    warnings,
    validated: {
      skill: skillDir,
      metadataPath: relative(repoRoot, metadataPath),
      dependencyCount: dependencies.length,
    },
  };
}

function printHumanSummary(result) {
  console.log(
    `[validate-skill-metadata] validated ${result.validatedCount} skill metadata file(s)`
  );
  if (result.warnings.length) {
    console.log(`[validate-skill-metadata] warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
  if (result.errors.length) {
    console.log(`[validate-skill-metadata] errors (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  } else {
    console.log('[validate-skill-metadata] PASS');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (skillRoots.length === 0) {
    fail('no skill roots found (expected at least skills/, .github/skills, or .claude/skills)');
  }

  const schema = existsSync(schemaPath) ? readJson(schemaPath, 'skill metadata schema') : null;
  const registrySkills = loadRegistrySkills();

  const allKnownSkills = new Set(skillRoots.flatMap(root => listSkillDirs(root)));
  const errors = [];
  const warnings = [];
  const validated = [];

  for (const root of skillRoots) {
    const skillDirs = listSkillDirs(root);
    for (const skillDir of skillDirs) {
      const result = validateSingleSkill(skillDir, root, allKnownSkills, registrySkills);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      if (result.validated) {
        validated.push(result.validated);
      }
    }
  }

  const result = {
    ok: errors.length === 0,
    schema: schema
      ? {
          path: relative(repoRoot, schemaPath),
          title: schema.title ?? 'Harness Skill Metadata',
          id: schema.$id ?? null,
        }
      : null,
    validatedCount: validated.length,
    errors,
    warnings,
    validated,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanSummary(result);
  }

  if (errors.length > 0) {
    process.exit(1);
  }
  if (args.strict && warnings.length > 0) {
    process.exit(1);
  }
}

main();
