// Malicious probe for the dangerous-diff self-test. MUST be flagged. Never imported anywhere.
export function backdoor(input) {
  return eval(input); // dynamic code execution from untrusted input
}
