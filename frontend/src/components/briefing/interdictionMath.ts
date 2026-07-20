/**
 * Quantum Interdiction Route Planning — pure math utilities.
 *
 * Star Citizen quantum travel follows straight-line paths between locations.
 * A QED-Snare (Quantum Enforcement Device) creates an interdiction zone that
 * pulls ships out of quantum travel when they pass through.
 *
 * This module calculates the optimal QED-Snare placement given:
 *   - Multiple possible origin locations (where the target might depart from)
 *   - A single destination
 *   - The QED effective range (radius)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Route {
  readonly origin: Point2D;
  readonly destination: Point2D;
}

export interface InterdictionResult {
  /** Optimal QED-Snare position */
  position: Point2D;
  /** Maximum perpendicular distance from the optimal point to any route */
  maxRouteDistance: number;
  /** Per-route perpendicular distances to the optimal point */
  routeDistances: number[];
  /** Whether all routes fall within QED range */
  viable: boolean;
  /** Distance from the interdiction point to the destination */
  distanceToDestination: number;
  /** Angular span (radians) of the route fan at the destination */
  fanAngle: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Euclidean distance between two points. */
export function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Perpendicular distance from point P to line segment A→B.
 * Returns distance to the closest point on the segment (clamped).
 */
export function pointToSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return dist(p, a);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Returns the closest point on line segment A→B to point P.
 * Used to draw perpendicular distance indicators on the map.
 */
export function closestPointOnSegment(p: Point2D, a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return { x: a.x, y: a.y };

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// ---------------------------------------------------------------------------
// Angular bisector — analytic approach
// ---------------------------------------------------------------------------

/**
 * Normalise an angle to the range [-π, π).
 */
function normaliseAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r >= Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

/**
 * Find the angular bisector and half-angle of the route fan as seen from the
 * destination.  Each route points from D toward an origin O_i; the "fan"
 * is the smallest arc that contains all those directions.
 */
function routeFanGeometry(
  origins: Point2D[],
  destination: Point2D
): { bisector: number; halfAngle: number } {
  if (origins.length === 0) return { bisector: 0, halfAngle: 0 };

  if (origins.length === 1) {
    const angle = Math.atan2(origins[0].y - destination.y, origins[0].x - destination.x);
    return { bisector: angle, halfAngle: 0 };
  }

  // Angles from D toward each origin
  const angles = origins
    .map(o => Math.atan2(o.y - destination.y, o.x - destination.x))
    .sort((a, b) => a - b);

  // Find the largest gap between consecutive angles (with wrap-around)
  let maxGap = 0;
  let gapEndIndex = 0;
  const lastAngle = angles.at(-1) ?? 0;
  for (let i = 0; i < angles.length; i++) {
    const next = (i + 1) % angles.length;
    const gap = next === 0 ? 2 * Math.PI - (lastAngle - angles[0]) : angles[next] - angles[i];
    if (gap > maxGap) {
      maxGap = gap;
      gapEndIndex = next;
    }
  }

  const arcSpan = 2 * Math.PI - maxGap;
  const halfAngle = arcSpan / 2;
  const bisector = normaliseAngle(angles[gapEndIndex] + halfAngle);

  return { bisector, halfAngle };
}

// ---------------------------------------------------------------------------
// Optimal interdiction finder
// ---------------------------------------------------------------------------

/**
 * Calculate the optimal QED-Snare position for intercepting quantum routes
 * from any of the given origins to the destination.
 *
 * **Algorithm (hybrid analytic + refinement):**
 * 1. Compute the angular bisector of the route fan at the destination.
 * 2. Place the initial candidate along that bisector at the maximum distance
 *    where QED range still covers the full fan.
 * 3. Refine with a local grid search to account for segment-length effects.
 *
 * @param origins    Possible departure locations of the target.
 * @param destination  Where the target is heading.
 * @param qedRange   Effective QED range (map-px).
 */
export function findOptimalInterdiction(
  origins: Point2D[],
  destination: Point2D,
  qedRange: number
): InterdictionResult {
  if (origins.length === 0) {
    return {
      position: destination,
      maxRouteDistance: 0,
      routeDistances: [],
      viable: true,
      distanceToDestination: 0,
      fanAngle: 0,
    };
  }

  const { bisector, halfAngle } = routeFanGeometry(origins, destination);
  const routes: Route[] = origins.map(o => ({ origin: o, destination }));

  // --- Single-route shortcut: place at 75% along the route ----------------
  if (origins.length === 1) {
    const o = origins[0];
    const t = 0.75;
    const pos: Point2D = {
      x: destination.x + t * (o.x - destination.x),
      y: destination.y + t * (o.y - destination.y),
    };
    return {
      position: pos,
      maxRouteDistance: 0,
      routeDistances: [0],
      viable: true,
      distanceToDestination: dist(pos, destination),
      fanAngle: 0,
    };
  }

  // --- Analytic seed -------------------------------------------------------
  // Max distance from D where QED covers the fan:
  //   d * sin(halfAngle) = qedRange  →  d = qedRange / sin(halfAngle)
  const sinHalf = Math.sin(halfAngle);
  const analyticDist = sinHalf > 0.01 ? Math.min(qedRange / sinHalf, 350) : 350;
  const seed: Point2D = {
    x: destination.x + analyticDist * Math.cos(bisector),
    y: destination.y + analyticDist * Math.sin(bisector),
  };

  // --- Refinement via local grid search ------------------------------------
  let bestPoint = seed;
  let bestMaxDist = evaluateMaxDist(seed, routes);
  let searchRadius = analyticDist * 0.5;

  for (let pass = 0; pass < 3; pass++) {
    const res = 30;
    for (let gx = 0; gx <= res; gx++) {
      for (let gy = 0; gy <= res; gy++) {
        const p: Point2D = {
          x: bestPoint.x - searchRadius + (2 * searchRadius * gx) / res,
          y: bestPoint.y - searchRadius + (2 * searchRadius * gy) / res,
        };
        const md = evaluateMaxDist(p, routes);
        if (md < bestMaxDist) {
          bestMaxDist = md;
          bestPoint = p;
        }
      }
    }
    searchRadius *= 0.3;
  }

  const routeDistances = routes.map(r =>
    pointToSegmentDistance(bestPoint, r.origin, r.destination)
  );

  return {
    position: bestPoint,
    maxRouteDistance: bestMaxDist,
    routeDistances,
    viable: bestMaxDist <= qedRange,
    distanceToDestination: dist(bestPoint, destination),
    fanAngle: halfAngle * 2,
  };
}

function evaluateMaxDist(p: Point2D, routes: Route[]): number {
  let max = 0;
  for (const r of routes) {
    const d = pointToSegmentDistance(p, r.origin, r.destination);
    if (d > max) max = d;
  }
  return max;
}
