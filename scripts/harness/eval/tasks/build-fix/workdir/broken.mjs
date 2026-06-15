// Intentionally broken: missing ")" in the parameter list. `node --check` must fail here.
export function add(a, b {
  return a + b;
}

export function double(n) {
  return add(n, n);
}
