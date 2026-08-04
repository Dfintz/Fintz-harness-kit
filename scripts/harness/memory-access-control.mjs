#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const POLICY_RELATIVE_PATH = ".github/harness/memory/access-policy.json";

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function parseFrontmatterTags(content = "") {
  const match = /^---\n([\s\S]*?)\n---/.exec(String(content));
  if (!match) return [];

  const lines = match[1].split(/\r?\n/);
  const tags = [];
  let inTagsBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (inTagsBlock) {
      if (line.startsWith("- ")) {
        tags.push(line.slice(2).trim().toLowerCase());
        continue;
      }
      if (!line) continue;
      inTagsBlock = false;
    }

    if (line.startsWith("tags:")) {
      const inline = line.slice("tags:".length).trim();
      if (!inline) {
        inTagsBlock = true;
        continue;
      }
      if (inline.startsWith("[") && inline.endsWith("]")) {
        const inner = inline.slice(1, -1);
        tags.push(...normalizeStringList(inner));
      } else {
        tags.push(...normalizeStringList(inline));
      }
    }
  }

  return [...new Set(tags.filter(Boolean))];
}

export function loadMemoryAccessPolicy(repoRoot) {
  const policyPath = resolve(repoRoot, POLICY_RELATIVE_PATH);
  const policyRelPath = relative(repoRoot, policyPath).replaceAll("\\", "/");
  if (!policyRelPath || policyRelPath.startsWith("..")) {
    return {
      enabled: false,
      defaultAllow: true,
      zones: [],
      policyPath,
      source: "invalid",
    };
  }

  if (!existsSync(policyPath)) {
    return {
      enabled: false,
      defaultAllow: true,
      zones: [],
      policyPath,
      source: "default",
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(policyPath, "utf8"));
    const zones = Array.isArray(parsed.zones) ? parsed.zones : [];
    const rolloutProfiles = parsed.rolloutProfiles && typeof parsed.rolloutProfiles === "object"
      ? parsed.rolloutProfiles
      : {};
    const rolloutProfile = typeof parsed.rolloutProfile === "string"
      ? parsed.rolloutProfile.trim()
      : "";

    let defaultAllow = parsed.defaultAllow !== false;
    if (rolloutProfile && rolloutProfiles[rolloutProfile] && typeof rolloutProfiles[rolloutProfile] === "object") {
      const profileConfig = rolloutProfiles[rolloutProfile];
      if (typeof profileConfig.defaultAllow === "boolean") {
        defaultAllow = profileConfig.defaultAllow;
      }
    }

    return {
      enabled: parsed.enabled === true,
      defaultAllow,
      starterTags: Array.isArray(parsed.starterTags) ? parsed.starterTags : [],
      rolloutProfile,
      zones,
      policyPath,
      source: "file",
    };
  } catch {
    return {
      enabled: false,
      defaultAllow: true,
      zones: [],
      policyPath,
      source: "invalid",
    };
  }
}

export function buildCallerAccessContext(callerInfo = {}, mcpContext = {}) {
  const caller = mcpContext?.caller && typeof mcpContext.caller === "object" ? mcpContext.caller : {};
  const callerId =
    String(callerInfo.callerId || caller.id || caller.userId || "anonymous").trim() || "anonymous";
  const role = String(callerInfo.role || caller.role || "auditor").trim().toLowerCase() || "auditor";

  const teams = new Set([
    ...normalizeStringList(callerInfo.teams),
    ...normalizeStringList(caller.teams),
    ...normalizeStringList(caller.team),
  ]);

  return {
    callerId,
    role,
    teams: [...teams],
  };
}

function normalizePath(pathValue = "") {
  return String(pathValue).trim().replaceAll("\\", "/").toLowerCase();
}

function normalizeTags(tags = [], content = "") {
  const values = Array.isArray(tags) ? tags : normalizeStringList(tags);
  if (values.length > 0) return [...new Set(values.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  return parseFrontmatterTags(content);
}

function matchList(values = [], candidate = "") {
  const lowerSet = new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
  if (lowerSet.size === 0) return false;
  return lowerSet.has(String(candidate || "").trim().toLowerCase());
}

function principalMatches(rule = {}, caller = {}) {
  const hasRoleRules = Array.isArray(rule.roles) && rule.roles.length > 0;
  const hasCallerRules = Array.isArray(rule.callers) && rule.callers.length > 0;
  const teamsRule = normalizeStringList(rule.teams);
  const hasTeamRules = teamsRule.length > 0;

  if (!hasRoleRules && !hasCallerRules && !hasTeamRules) {
    return true;
  }

  const roleMatches = hasRoleRules ? matchList(rule.roles, caller.role) : false;
  const callerMatches = hasCallerRules ? matchList(rule.callers, caller.callerId) : false;
  const callerTeams = new Set(normalizeStringList(caller.teams));
  const teamMatches = hasTeamRules
    ? teamsRule.some((team) => callerTeams.has(String(team).toLowerCase()))
    : false;

  return roleMatches || callerMatches || teamMatches;
}

function zoneMatches(zone = {}, entry = {}) {
  const match = zone.match && typeof zone.match === "object" ? zone.match : {};
  const path = normalizePath(entry.path);
  const scope = String(entry.scope || "").trim().toLowerCase();
  const tags = new Set(normalizeTags(entry.tags, entry.content));

  if (Array.isArray(match.pathPrefixes) && match.pathPrefixes.length > 0) {
    const prefixes = match.pathPrefixes.map((item) => normalizePath(item));
    if (!prefixes.some((prefix) => path.startsWith(prefix))) return false;
  }

  if (Array.isArray(match.scopes) && match.scopes.length > 0) {
    if (!matchList(match.scopes, scope)) return false;
  }

  if (Array.isArray(match.tags) && match.tags.length > 0) {
    const required = normalizeStringList(match.tags);
    if (!required.some((tag) => tags.has(tag))) return false;
  }

  return true;
}

export function evaluateMemoryAccess(entry = {}, caller = {}, policy = {}) {
  if (policy?.enabled !== true) {
    return { allowed: true, reason: "policy-disabled", zoneId: null };
  }

  const zones = Array.isArray(policy.zones) ? policy.zones : [];
  for (const zone of zones) {
    if (!zoneMatches(zone, entry)) continue;

    if (zone.deny && principalMatches(zone.deny, caller)) {
      return {
        allowed: false,
        reason: "zone-deny",
        zoneId: zone.id || null,
      };
    }

    const hasAllowRules = zone.allow && typeof zone.allow === "object";
    if (hasAllowRules) {
      const allowed = principalMatches(zone.allow, caller);
      return {
        allowed,
        reason: allowed ? "zone-allow" : "zone-allow-miss",
        zoneId: zone.id || null,
      };
    }

    const fallbackAllowed = zone.defaultAllow !== false;
    return {
      allowed: fallbackAllowed,
      reason: fallbackAllowed ? "zone-default-allow" : "zone-default-deny",
      zoneId: zone.id || null,
    };
  }

  const allowed = policy.defaultAllow !== false;
  return {
    allowed,
    reason: allowed ? "policy-default-allow" : "policy-default-deny",
    zoneId: null,
  };
}
