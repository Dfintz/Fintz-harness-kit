// Fixed: parameter list closed. `node --check` passes.
export function add(a, b) {
  return a + b;
}

export function double(n) {
  return add(n, n);
}
