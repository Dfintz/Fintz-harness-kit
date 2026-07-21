import { logger } from '../utils/logger';

export interface BotShutdownStep {
  /**
   * Stable identifier used to declare dependency ordering. Only steps that
   * declare an `id` can be referenced by another step's `dependsOn`.
   */
  readonly id?: string;
  /**
   * Ids of components that must remain available *while this step runs*, so
   * they are torn down strictly after it (dependency-ordered shutdown, ARCH-10).
   * Example: the IPC step lists the Discord-client id because IPC handlers send
   * via the client, so the client must outlive IPC teardown. Ordering is derived
   * from these declarations rather than array position, so reordering the step
   * array can never silently break the teardown contract.
   */
  readonly dependsOn?: readonly string[];
  readonly successMessage: string;
  readonly run: () => Promise<void> | void;
  readonly failureMessage?: string;
}

export interface OrderedShutdownPlan {
  readonly ordered: readonly BotShutdownStep[];
  readonly warnings: readonly string[];
}

interface DependencyGraph {
  readonly adjacency: number[][];
  readonly inDegree: number[];
}

/** Index id-bearing steps; returns null (with a warning) on a duplicate id. */
function indexStepsById(
  steps: readonly BotShutdownStep[],
  warnings: string[]
): Map<string, number> | null {
  const idToIndex = new Map<string, number>();
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

/**
 * Build the "must run before" graph: edge i -> target means step i runs before
 * `target` (i depends on it). Returns null (with a warning) on an unknown id.
 */
function buildDependencyGraph(
  steps: readonly BotShutdownStep[],
  idToIndex: ReadonlyMap<string, number>,
  warnings: string[]
): DependencyGraph | null {
  const adjacency: number[][] = steps.map(() => []);
  const inDegree = new Array<number>(steps.length).fill(0);

  for (const [index, step] of steps.entries()) {
    for (const depId of step.dependsOn ?? []) {
      const target = idToIndex.get(depId);
      if (target === undefined) {
        const label = step.id ?? step.successMessage;
        warnings.push(
          `Shutdown step "${label}" depends on unknown id "${depId}"; using declared order`
        );
        return null;
      }
      adjacency[index].push(target);
      inDegree[target] += 1;
    }
  }
  return { adjacency, inDegree };
}

/**
 * Kahn's algorithm with a stable tiebreak on the original index, so steps with
 * no ordering constraint preserve their declared order. A result shorter than
 * `steps` signals a dependency cycle.
 */
function topologicalOrder(
  steps: readonly BotShutdownStep[],
  graph: DependencyGraph
): BotShutdownStep[] {
  const { adjacency, inDegree } = graph;
  const ready: number[] = [];
  for (const [index, degree] of inDegree.entries()) {
    if (degree === 0) {
      ready.push(index);
    }
  }

  const ordered: BotShutdownStep[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => a - b);
    const node = ready.shift() as number;
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

/**
 * Order shutdown steps so every step runs before the components it `dependsOn`
 * (dependents first), regardless of array position. Pure and side-effect-free
 * for unit testing.
 *
 * Robustness during shutdown is paramount: any anomaly (duplicate id, unknown
 * dependency, or a dependency cycle) falls back to the caller's declared array
 * order — which is the historically-correct order — and surfaces a warning,
 * so this can only *improve* teardown safety, never block it. Steps without an
 * `id`/`dependsOn` keep their relative array order (stable sort).
 */
export function orderShutdownSteps(steps: readonly BotShutdownStep[]): OrderedShutdownPlan {
  const warnings: string[] = [];

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

export async function runBotShutdownSteps(
  processName: string,
  steps: readonly BotShutdownStep[]
): Promise<void> {
  const { ordered, warnings } = orderShutdownSteps(steps);
  for (const warning of warnings) {
    logger.warn(`[${processName}] ${warning}`);
  }
  for (const step of ordered) {
    try {
      await step.run();
      logger.info(`[${processName}] ${step.successMessage}`);
    } catch (error) {
      const failureMessage = step.failureMessage ?? `${step.successMessage} failed (non-fatal)`;
      logger.warn(`[${processName}] ${failureMessage}:`, error);
    }
  }
}
