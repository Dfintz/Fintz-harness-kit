export interface TreeNodeLike {
  children?: unknown[];
}

/** Count all nodes in a tree recursively. */
export function countTreeNodes(nodes: unknown[]): number {
  return nodes.reduce((count: number, node: unknown) => {
    const current = node as TreeNodeLike;
    return count + 1 + countTreeNodes(current.children ?? []);
  }, 0);
}
