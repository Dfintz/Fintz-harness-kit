"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderShutdownSteps = orderShutdownSteps;
exports.runBotShutdownSteps = runBotShutdownSteps;
const logger_1 = require("../utils/logger");
function indexStepsById(steps, warnings) {
    const idToIndex = new Map();
    for (const [index, step] of steps.entries()) {
        if (step.id === undefined) {
            continue;
        }
        if (idToIndex.has(step.id)) {
            warnings.push(`Duplicate shutdown step id "${step.id}"; using declared order`);
            return null;
        }
        idToIndex.set(step.id, index);
    }
    return idToIndex;
}
function buildDependencyGraph(steps, idToIndex, warnings) {
    const adjacency = steps.map(() => []);
    const inDegree = new Array(steps.length).fill(0);
    for (const [index, step] of steps.entries()) {
        for (const depId of step.dependsOn ?? []) {
            const target = idToIndex.get(depId);
            if (target === undefined) {
                const label = step.id ?? step.successMessage;
                warnings.push(`Shutdown step "${label}" depends on unknown id "${depId}"; using declared order`);
                return null;
            }
            adjacency[index].push(target);
            inDegree[target] += 1;
        }
    }
    return { adjacency, inDegree };
}
function topologicalOrder(steps, graph) {
    const { adjacency, inDegree } = graph;
    const ready = [];
    for (const [index, degree] of inDegree.entries()) {
        if (degree === 0) {
            ready.push(index);
        }
    }
    const ordered = [];
    while (ready.length > 0) {
        ready.sort((a, b) => a - b);
        const node = ready.shift();
        ordered.push(steps[node]);
        for (const next of adjacency[node]) {
            inDegree[next] -= 1;
            if (inDegree[next] === 0) {
                ready.push(next);
            }
        }
    }
    return ordered;
}
function orderShutdownSteps(steps) {
    const warnings = [];
    const idToIndex = indexStepsById(steps, warnings);
    if (idToIndex === null) {
        return { ordered: steps, warnings };
    }
    const graph = buildDependencyGraph(steps, idToIndex, warnings);
    if (graph === null) {
        return { ordered: steps, warnings };
    }
    const ordered = topologicalOrder(steps, graph);
    if (ordered.length !== steps.length) {
        warnings.push('Cyclic shutdown dependencies detected; using declared order');
        return { ordered: steps, warnings };
    }
    return { ordered, warnings };
}
async function runBotShutdownSteps(processName, steps) {
    const { ordered, warnings } = orderShutdownSteps(steps);
    for (const warning of warnings) {
        logger_1.logger.warn(`[${processName}] ${warning}`);
    }
    for (const step of ordered) {
        try {
            await step.run();
            logger_1.logger.info(`[${processName}] ${step.successMessage}`);
        }
        catch (error) {
            const failureMessage = step.failureMessage ?? `${step.successMessage} failed (non-fatal)`;
            logger_1.logger.warn(`[${processName}] ${failureMessage}:`, error);
        }
    }
}
//# sourceMappingURL=botShutdownCoordinator.js.map