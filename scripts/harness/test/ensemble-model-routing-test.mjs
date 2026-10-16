#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { renderCompactRoute, renderHandoffPlan } from "../prompt-router.mjs";

const harnessRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const routerPath = resolve(harnessRoot, "scripts", "harness", "prompt-router.mjs");
const baseConfig = JSON.parse(readFileSync(resolve(harnessRoot, "harness.config.json"), "utf8"));
const tempRoot = mkdtempSync(join(tmpdir(), "harness-ensemble-routing-"));
const task = "add a retry option to the loop runner and update its tests";

after(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

function writeCase(name, configure = () => {}) {
  const root = join(tempRoot, name);
  mkdirSync(root, { recursive: true });
  const config = structuredClone(baseConfig);
  config.graph.pluginRoot = join(root, "graph-plugin");
  configure(config);
  writeFileSync(join(root, "harness.config.json"), JSON.stringify(config, null, 2));
  return root;
}

function route(root, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [routerPath, "route", "--task", task, "--json", "--repo-root", root, ...extraArgs],
    { cwd: harnessRoot, encoding: "utf8" },
  );
}

test("ensemble implementer keeps review stages fixed and marks membership uncertainty", () => {
  const root = writeCase("unknown-members", (config) => {
    config.skillModelMapping.mappings.implement.primary = "hydrafusion";
    config.skillModelMapping.mappings["review-breadth"].primary = "claude-opus-5-5";
  });
  const first = route(root);
  const second = route(root);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout, "routing must remain deterministic");

  const routed = JSON.parse(first.stdout);
  assert.equal(routed.models.implement, "hydrafusion");
  assert.equal(routed.modelAssurance.implementationMode, "ensemble");
  assert.equal(routed.modelAssurance.routingDeterminism, "deterministic-configured-targets");
  assert.equal(routed.modelAssurance.reviewIndependence, "ensemble-membership-unverified");
  assert.equal(routed.modelAssurance.runtimeIdentity, "not-observable-by-router");
  assert.match(routed.crossModelReview, /ensemble membership and runtime identity unverified/);
  assert.ok(
    routed.modelAssurance.reviewModels.every((review) => review.executionMode === "fixed"),
    "all active reviewers must have fixed model identities",
  );
});

test("dynamic implementation identity is explicitly unverified", () => {
  const root = writeCase("dynamic-implementer", (config) => {
    config.skillModelMapping.mappings.implement.primary = "auto";
    config.skillModelMapping.mappings["review-breadth"].primary = "claude-opus-5-5";
  });
  const result = route(root);
  assert.equal(result.status, 0, result.stderr);
  const routed = JSON.parse(result.stdout);
  assert.equal(routed.modelAssurance.implementationMode, "dynamic");
  assert.equal(routed.modelAssurance.reviewIndependence, "dynamic-execution-identity-unverified");
  assert.match(routed.crossModelReview, /dynamic selection; runtime identity unverified/);
});

test("fixed-model receipts record only the comparison the router made", () => {
  const root = writeCase("fixed-models");
  const feature = route(root);
  assert.equal(feature.status, 0, feature.stderr);
  const featureRoute = JSON.parse(feature.stdout);
  assert.equal(featureRoute.modelAssurance.implementationMode, "fixed");
  assert.equal(
    featureRoute.modelAssurance.reviewIndependence,
    "configured-model-ids-distinct-runtime-unverified",
  );

  const review = route(root, ["--profile", "review"]);
  assert.equal(review.status, 0, review.stderr);
  const reviewRoute = JSON.parse(review.stdout);
  assert.equal(reviewRoute.modelAssurance.implementationModel, null);
  assert.equal(reviewRoute.modelAssurance.reviewIndependence, "not-applicable");
  assert.equal(reviewRoute.modelAssurance.runtimeIdentity, "not-observable-by-router");
});

test("fixed-model receipts report an id overlap the router does not reject", () => {
  const root = writeCase("fix-review-overlap", (config) => {
    config.routing.profiles["fix-review"] = {
      description: "Custom convergence plus review path without an Implement stage.",
      mode: "non-trivial",
      stages: ["build-fix", "review-breadth"],
    };
    config.skillModelMapping.mappings["review-breadth"].primary = config.models.implementer.model;
  });
  const result = route(root, ["--profile", "fix-review"]);
  assert.equal(result.status, 0, result.stderr);
  const routed = JSON.parse(result.stdout);
  assert.equal(routed.models["build-fix"], routed.models["review-breadth"]);
  assert.equal(routed.modelAssurance.implementationMode, "fixed");
  assert.equal(routed.modelAssurance.reviewIndependence, "configured-model-id-overlap");
});

test("ensemble model is rejected as an active reviewer", () => {
  const root = writeCase("ensemble-reviewer", (config) => {
    config.skillModelMapping.mappings["review-breadth"].primary = "hydrafusion";
  });
  const result = route(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /active review stages must use a fixed model identity/);
  assert.match(result.stderr, /review-breadth=hydrafusion/);
});

test("dynamic model selection is rejected as an active reviewer", () => {
  const root = writeCase("dynamic-reviewer", (config) => {
    config.skillModelMapping.mappings["review-breadth"].primary = "auto";
  });
  const result = route(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /active review stages must use a fixed model identity/);
  assert.match(result.stderr, /review-breadth=auto/);
});

test("ensemble review guardrail also applies to review-only routes", () => {
  const root = writeCase("review-only-ensemble", (config) => {
    config.skillModelMapping.mappings["review-breadth"].primary = "hydrafusion";
  });
  const result = route(root, ["--profile", "review"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /active review stages must use a fixed model identity/);
});

test("a tag suffix does not hide an ensemble reviewer", () => {
  const root = writeCase("tagged-ensemble-reviewer", (config) => {
    config.skillModelMapping.mappings["review-breadth"].primary = "hydrafusion:latest";
  });
  const result = route(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /active review stages must use a fixed model identity/);
  assert.match(result.stderr, /review-breadth=hydrafusion:latest/);
});

test("route renderers report missing model assurance instead of throwing", () => {
  const legacyRoute = {
    mode: "feature",
    why: "route built without model assurance",
    stages: ["implement"],
    models: { implement: "gpt-5.4" },
    crossModelReview: "not applicable",
  };
  assert.match(renderCompactRoute(legacyRoute), /model assurance: unavailable/);
  assert.match(renderHandoffPlan(legacyRoute), /model assurance: unavailable/);
});

test("reviewer declared as an ensemble member fails closed", () => {
  const root = writeCase("member-overlap", (config) => {
    config.skillModelMapping.mappings.implement.primary = "hydrafusion";
    config.skillModelMapping.modelFamilies.families.ensemble.members = ["claude-opus-5-5"];
    config.skillModelMapping.mappings["review-breadth"].primary = "claude-opus-5-5";
  });
  const result = route(root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /declares an active reviewer as an ensemble member/);
  assert.match(result.stderr, /review-breadth=claude-opus-5-5/);
});

test("declared disjoint ensemble members are recorded without claiming runtime verification", () => {
  const root = writeCase("declared-members", (config) => {
    config.skillModelMapping.mappings.implement.primary = "hydrafusion";
    config.skillModelMapping.modelFamilies.families.ensemble.members = ["gpt-5.4"];
    config.skillModelMapping.mappings["review-breadth"].primary = "claude-opus-5-5";
  });
  const result = route(root);
  assert.equal(result.status, 0, result.stderr);
  const routed = JSON.parse(result.stdout);
  assert.equal(
    routed.modelAssurance.reviewIndependence,
    "declared-members-disjoint-runtime-unverified",
  );
  assert.match(routed.crossModelReview, /declared members disjoint; runtime identity unverified/);
});
