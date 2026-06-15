// notes.js — TODO debt reduced to 2 by resolving validation (behavior preserved/strengthened).
function requirePositive(label, value) {
  if (typeof value !== 'number' || value <= 0) {
    throw new TypeError(`${label} must be a positive number`);
  }
}

export function area(width, height) {
  requirePositive('width', width);
  requirePositive('height', height);
  return width * height;
}

export function perimeter(width, height) {
  requirePositive('width', width);
  requirePositive('height', height);
  return 2 * (width + height);
}

export function describe(width, height) {
  // TODO: format the description nicely
  // TODO: include units
  return `${width}x${height}`;
}
