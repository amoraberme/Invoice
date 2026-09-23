/**
 * Zero-dependency Projective Transformation (Homography) Utility for Solar PV Perspective Projection.
 * Solves the 8-unknown linear system using Gaussian elimination with partial pivoting (h33 = 1).
 */

export interface Point2D {
  x: number
  y: number
}

// Clockwise quad: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
export type Quad = [Point2D, Point2D, Point2D, Point2D]

// 3x3 Row-major transformation matrix:
// [ h0, h1, h2,
//   h3, h4, h5,
//   h6, h7, h8 ]
export type Matrix3x3 = [
  number, number, number,
  number, number, number,
  number, number, number
]

/**
 * Standard unit quad [(0,0), (1,0), (1,1), (0,1)]
 */
export function getUnitQuad(): Quad {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
}

/**
 * Flat rectangular metric quad [(0,0), (W,0), (W,H), (0,H)]
 */
export function getRectQuad(width: number, height: number, origin: Point2D = { x: 0, y: 0 }): Quad {
  return [
    { x: origin.x, y: origin.y },
    { x: origin.x + width, y: origin.y },
    { x: origin.x + width, y: origin.y + height },
    { x: origin.x, y: origin.y + height },
  ]
}

/**
 * Identity 3x3 Matrix
 */
export const IDENTITY_MATRIX: Matrix3x3 = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
]

/**
 * Computes the 3x3 projective transformation matrix H that maps a source quad (src)
 * to a destination quad (dst) on the canvas using Gaussian elimination with partial pivoting.
 * Normalizes so that H[8] = 1.
 */
export function getHomographyMatrix(src: Quad, dst: Quad): Matrix3x3 {
  // Construct 8x8 system A * h = b for 8 unknowns h0..h7 with h8 = 1
  // For each point correspondence (x_i, y_i) -> (u_i, v_i):
  // Row 2i:   [ x_i, y_i, 1,   0,   0, 0, -x_i*u_i, -y_i*u_i ] * h = u_i
  // Row 2i+1: [   0,   0, 0, x_i, y_i, 1, -x_i*v_i, -y_i*v_i ] * h = v_i

  const A: number[][] = []
  const b: number[] = []

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]

    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
    b.push(u)

    A.push([0, 0, 0, x, y, 1, -x * v, -y * v])
    b.push(v)
  }

  // Solve A * h = b using Gaussian Elimination with Partial Pivoting
  const n = 8

  for (let col = 0; col < n; col++) {
    // Find pivot row with maximum absolute value in current column
    let maxRow = col
    let maxVal = Math.abs(A[col][col])

    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col])
      if (val > maxVal) {
        maxVal = val
        maxRow = row
      }
    }

    if (maxVal < 1e-12) {
      // Degenerate collinear or coincident points; return identity fallback
      return [...IDENTITY_MATRIX]
    }

    // Swap current row with pivot row
    if (maxRow !== col) {
      const tempA = A[col]
      A[col] = A[maxRow]
      A[maxRow] = tempA

      const tempB = b[col]
      b[col] = b[maxRow]
      b[maxRow] = tempB
    }

    // Eliminate column entries below pivot
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col]
      b[row] -= factor * b[col]
      for (let k = col; k < n; k++) {
        A[row][k] -= factor * A[col][k]
      }
    }
  }

  // Back substitution
  const h: number[] = new Array(8).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row]
    for (let k = row + 1; k < n; k++) {
      sum -= A[row][k] * h[k]
    }
    h[row] = sum / A[row][row]
  }

  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1.0,
  ]
}

/**
 * Solves the overdetermined linear system for N >= 4 point correspondences
 * using Direct Linear Transformation (DLT) via normal equations (M^T * M) * h = M^T * b.
 * Finds the single best-fit projective homography matrix H that minimizes projection error
 * across all control points in the perspective frame.
 */
export function solveDLTHomography(src: Point2D[], dst: Point2D[]): Matrix3x3 {
  const N = Math.min(src.length, dst.length)
  if (N < 4) return [...IDENTITY_MATRIX]
  if (N === 4) {
    return getHomographyMatrix(src as unknown as Quad, dst as unknown as Quad)
  }

  // Construct normal equations: AtA * h = AtB (8x8 system)
  const AtA: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0))
  const AtB: number[] = new Array(8).fill(0)

  for (let i = 0; i < N; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]

    // Row 1: [x, y, 1, 0, 0, 0, -x*u, -y*u] * h = u
    const r1 = [x, y, 1, 0, 0, 0, -x * u, -y * u]
    for (let r = 0; r < 8; r++) {
      AtB[r] += r1[r] * u
      for (let c = 0; c < 8; c++) {
        AtA[r][c] += r1[r] * r1[c]
      }
    }

    // Row 2: [0, 0, 0, x, y, 1, -x*v, -y*v] * h = v
    const r2 = [0, 0, 0, x, y, 1, -x * v, -y * v]
    for (let r = 0; r < 8; r++) {
      AtB[r] += r2[r] * v
      for (let c = 0; c < 8; c++) {
        AtA[r][c] += r2[r] * r2[c]
      }
    }
  }

  // Solve 8x8 system with Gaussian elimination with partial pivoting
  const n = 8
  for (let col = 0; col < n; col++) {
    let maxRow = col
    let maxVal = Math.abs(AtA[col][col])
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(AtA[row][col])
      if (val > maxVal) {
        maxVal = val
        maxRow = row
      }
    }

    if (maxVal < 1e-12) {
      return [...IDENTITY_MATRIX]
    }

    if (maxRow !== col) {
      const tempA = AtA[col]
      AtA[col] = AtA[maxRow]
      AtA[maxRow] = tempA

      const tempB = AtB[col]
      AtB[col] = AtB[maxRow]
      AtB[maxRow] = tempB
    }

    for (let row = col + 1; row < n; row++) {
      const factor = AtA[row][col] / AtA[col][col]
      AtB[row] -= factor * AtB[col]
      for (let k = col; k < n; k++) {
        AtA[row][k] -= factor * AtA[col][k]
      }
    }
  }

  // Back substitution
  const h: number[] = new Array(8).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = AtB[row]
    for (let k = row + 1; k < n; k++) {
      sum -= AtA[row][k] * h[k]
    }
    h[row] = sum / AtA[row][row]
  }

  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1.0,
  ]
}

/**
 * Universal homography solver supporting 4 or more points
 */
export function getHomographyFromPoints(src: Point2D[], dst: Point2D[]): Matrix3x3 {
  if (src.length === 4 && dst.length === 4) {
    return getHomographyMatrix(src as unknown as Quad, dst as unknown as Quad)
  }
  return solveDLTHomography(src, dst)
}

/**
 * Derives unwarped metric source points for an arbitrary N-point frame polygon.
 */
export function deriveSourcePointsForPolygon(dstPoints: Point2D[]): {
  flatWidth: number
  flatHeight: number
  srcPoints: Point2D[]
} {
  if (!dstPoints || dstPoints.length < 3) {
    return {
      flatWidth: 100,
      flatHeight: 100,
      srcPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    }
  }

  if (dstPoints.length === 4) {
    const [tl, tr, br, bl] = dstPoints
    const topW = Math.hypot(tr.x - tl.x, tr.y - tl.y)
    const botW = Math.hypot(br.x - bl.x, br.y - bl.y)
    const leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y)
    const rightH = Math.hypot(br.x - tr.x, br.y - tr.y)
    const flatWidth = Math.max(50, Math.round((topW + botW) / 2))
    const flatHeight = Math.max(50, Math.round((leftH + rightH) / 2))

    return {
      flatWidth,
      flatHeight,
      srcPoints: [
        { x: 0, y: 0 },
        { x: flatWidth, y: 0 },
        { x: flatWidth, y: flatHeight },
        { x: 0, y: flatHeight },
      ],
    }
  }

  // N > 4 points: compute bounding box
  const xs = dstPoints.map((p) => p.x)
  const ys = dstPoints.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const flatWidth = Math.max(50, Math.round(maxX - minX))
  const flatHeight = Math.max(50, Math.round(maxY - minY))

  const srcPoints = dstPoints.map((p) => ({
    x: Math.round(p.x - minX),
    y: Math.round(p.y - minY),
  }))

  return {
    flatWidth,
    flatHeight,
    srcPoints,
  }
}

/**
 * Inverts the 3x3 matrix using the classical adjugate / cofactor method.
 * Maps screen coordinates back to flat metric coordinates.
 */
export function invertHomography(H: Matrix3x3): Matrix3x3 {
  const [
    m00, m01, m02,
    m10, m11, m12,
    m20, m21, m22,
  ] = H

  // Compute cofactors
  const c00 = m11 * m22 - m12 * m21
  const c01 = -(m10 * m22 - m12 * m20)
  const c02 = m10 * m21 - m11 * m20

  const c10 = -(m01 * m22 - m02 * m21)
  const c11 = m00 * m22 - m02 * m20
  const c12 = -(m00 * m21 - m01 * m20)

  const c20 = m01 * m12 - m02 * m11
  const c21 = -(m00 * m12 - m02 * m10)
  const c22 = m00 * m11 - m01 * m10

  const det = m00 * c00 + m01 * c01 + m02 * c02

  if (Math.abs(det) < 1e-12) {
    return [...IDENTITY_MATRIX]
  }

  const invDet = 1.0 / det

  return [
    c00 * invDet, c10 * invDet, c20 * invDet,
    c01 * invDet, c11 * invDet, c21 * invDet,
    c02 * invDet, c12 * invDet, c22 * invDet,
  ]
}

/**
 * Applies the projective equation with normalization by homogeneous coordinate w:
 * x' = (H0*x + H1*y + H2) / (H6*x + H7*y + H8)
 * y' = (H3*x + H4*y + H5) / (H6*x + H7*y + H8)
 */
export function projectPoint(H: Matrix3x3, pt: Point2D): Point2D {
  const { x, y } = pt
  const w = H[6] * x + H[7] * y + H[8]

  // Prevent divide-by-zero near the vanishing horizon
  const safeW = Math.abs(w) < 1e-10 ? (w < 0 ? -1e-10 : 1e-10) : w

  return {
    x: (H[0] * x + H[1] * y + H[2]) / safeW,
    y: (H[3] * x + H[4] * y + H[5]) / safeW,
  }
}

/**
 * Transforms all four corners of a rectangular panel into the warped perspective quadrilateral.
 */
export function projectPanelQuad(H: Matrix3x3, flatCorners: Quad): Quad {
  return [
    projectPoint(H, flatCorners[0]),
    projectPoint(H, flatCorners[1]),
    projectPoint(H, flatCorners[2]),
    projectPoint(H, flatCorners[3]),
  ]
}

/**
 * Validates that points form a non-degenerate, non-self-intersecting perspective frame
 * (supporting 4-point quads and N-point polygons).
 */
export function isConvexQuad(quad: Point2D[]): boolean {
  if (!quad || quad.length < 4) return false

  if (quad.length === 4) {
    let sign: number | null = null

    for (let i = 0; i < 4; i++) {
      const p1 = quad[i]
      const p2 = quad[(i + 1) % 4]
      const p3 = quad[(i + 2) % 4]

      const dx1 = p2.x - p1.x
      const dy1 = p2.y - p1.y
      const dx2 = p3.x - p2.x
      const dy2 = p3.y - p2.y

      // 2D cross product of edge (p1->p2) and (p2->p3)
      const cross = dx1 * dy2 - dy1 * dx2

      if (Math.abs(cross) < 1e-7) {
        return false
      }

      const currentSign = cross > 0 ? 1 : -1
      if (sign === null) {
        sign = currentSign
      } else if (sign !== currentSign) {
        return false
      }
    }

    return true
  }

  // For N > 4 vertices: verify non-degenerate area and non-zero perimeter
  const area = Math.abs(getPolygonSignedArea(quad))
  return area > 100
}

/**
 * Calculates distance from a point to a line segment [p1, p2],
 * along with the nearest projection point and parametric t in [0, 1].
 */
export function getDistanceToSegment(
  pt: Point2D,
  p1: Point2D,
  p2: Point2D
): { distance: number; projection: Point2D; t: number } {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-9) {
    const d = Math.hypot(pt.x - p1.x, pt.y - p1.y)
    return { distance: d, projection: { x: p1.x, y: p1.y }, t: 0 }
  }
  let t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const proj = {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
  }
  return {
    distance: Math.hypot(pt.x - proj.x, pt.y - proj.y),
    projection: proj,
    t,
  }
}

/**
 * Calculates the signed area of a 2D polygon using the Shoelace formula.
 * In screen coordinates (Y down):
 * - Area > 0 indicates Clockwise vertex winding.
 * - Area < 0 indicates Counter-Clockwise vertex winding.
 */
export function getPolygonSignedArea(points: Point2D[]): number {
  if (!points || points.length < 3) return 0
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y - points[j].x * points[i].y
  }
  return area / 2
}

/**
 * Orders 4 points drawn by the user into canonical clockwise quad:
 * [Top-Left, Top-Right, Bottom-Right, Bottom-Left].
 *
 * Faithfully preserves the user's intended starting pen point and perimeter direction:
 * - If user drew Clockwise: [P0, P1, P2, P3] -> P0 is TL (Ridge L), edge P0->P1 is Top/Ridge.
 * - If user drew Counter-Clockwise: [P0, P3, P2, P1] -> P0 is TL (Ridge L), edge P0->P3 is Top/Ridge.
 * - If orientationOffset (0, 1, 2, 3) is provided, rotates starting index by 90° increments
 *   allowing the user to change which edge is the Ridge/Top without redrawing.
 */
export function orderQuadFromPoints(points: Point2D[], orientationOffset: number = 0): Quad {
  if (!points || points.length !== 4) {
    throw new Error('orderQuadFromPoints requires exactly 4 points')
  }

  const signedArea = getPolygonSignedArea(points)

  // Direct perimeter preservation based on winding
  let baseQuad: Quad = signedArea >= 0
    ? [points[0], points[1], points[2], points[3]]
    : [points[0], points[3], points[2], points[1]]

  // If the user's drawing order created a self-intersecting bow-tie, untangle via polar angle around centroid
  if (!isConvexQuad(baseQuad)) {
    const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4
    const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4
    const sorted = [...points].sort((a, b) => {
      return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
    })
    // Find vertex closest to original points[0] to preserve starting corner
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < 4; i++) {
      const d = Math.hypot(sorted[i].x - points[0].x, sorted[i].y - points[0].y)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    baseQuad = [
      sorted[bestIdx],
      sorted[(bestIdx + 1) % 4],
      sorted[(bestIdx + 2) % 4],
      sorted[(bestIdx + 3) % 4],
    ]
  }

  // Apply pitch orientation offset (0=0°, 1=90°, 2=180°, 3=270°)
  const offset = ((orientationOffset % 4) + 4) % 4
  return [
    baseQuad[offset],
    baseQuad[(offset + 1) % 4],
    baseQuad[(offset + 2) % 4],
    baseQuad[(offset + 3) % 4],
  ]
}

/**
 * Backward-compatible wrapper for orderQuadFromPoints.
 */
export function orderQuadClockwise(points: Point2D[], orientationOffset: number = 0): Quad {
  return orderQuadFromPoints(points, orientationOffset)
}

/**
 * Calculates the bounding box of a Quad in screen coordinates.
 */
export function getQuadBoundingBox(quad: Quad): {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
} {
  const xs = quad.map((p) => p.x)
  const ys = quad.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Checks whether all four corners of a projected panel quad lie inside a 2D polygon.
 */
export function isQuadInsidePolygon(quad: Quad, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false

  // Ray casting test for a point
  const isInside = (pt: Point2D): boolean => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x
      const yi = polygon[i].y
      const xj = polygon[j].x
      const yj = polygon[j].y

      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  // 1. All 4 corners must be inside
  for (const corner of quad) {
    if (!isInside(corner)) return false
  }

  // 2. Center must be inside
  const center: Point2D = {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  }
  if (!isInside(center)) return false

  return true
}

/**
 * Resolves a 4-point Quad directly from traced pen points / polygon:
 * - If 4 vertices: returns orderQuadFromPoints(polygon, orientationOffset)
 * - If 5 vertices and 5th vertex is closing point near 1st: extracts clean 4-point quad
 * - If other vertex counts: returns 4-corner bounding quad
 */
/**
 * Applies a 3D perspective pitch keystoning to a 4-point quad.
 * pitchAngleDeg: 0° (flat) to 45° (steep)
 * Tapers the Ridge (top) relative to the Eave (bottom) based on the camera tilt angle,
 * creating natural foreshortening that matches real aerial/drone roof photography.
 */
export function applyPerspectivePitchToQuad(quad: Quad, pitchAngleDeg: number = 20): Quad {
  if (!quad || quad.length !== 4) return quad
  if (pitchAngleDeg <= 0) return quad

  const [tl, tr, br, bl] = quad
  const clampedPitch = Math.min(50, Math.max(0, pitchAngleDeg))
  const pitchRad = (clampedPitch * Math.PI) / 180

  // Taper factor: 20° yields ~14% narrowing on each side (total ~28% convergence)
  const taper = Math.sin(pitchRad) * 0.38

  const ridgeCenter = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 }
  const eaveCenter = { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 }
  const heightVec = { x: eaveCenter.x - ridgeCenter.x, y: eaveCenter.y - ridgeCenter.y }

  // Taper the ridge corners towards the ridge center
  const newTl = {
    x: tl.x + (ridgeCenter.x - tl.x) * taper - heightVec.x * (taper * 0.08),
    y: tl.y + (ridgeCenter.y - tl.y) * taper - heightVec.y * (taper * 0.08),
  }
  const newTr = {
    x: tr.x + (ridgeCenter.x - tr.x) * taper - heightVec.x * (taper * 0.08),
    y: tr.y + (ridgeCenter.y - tr.y) * taper - heightVec.y * (taper * 0.08),
  }

  // Slightly widen the eave corners (closer to viewer)
  const newBl = {
    x: bl.x - (ridgeCenter.x - bl.x) * (taper * 0.25) + heightVec.x * (taper * 0.05),
    y: bl.y - (ridgeCenter.y - bl.y) * (taper * 0.25) + heightVec.y * (taper * 0.05),
  }
  const newBr = {
    x: br.x - (ridgeCenter.x - br.x) * (taper * 0.25) + heightVec.x * (taper * 0.05),
    y: br.y - (ridgeCenter.y - br.y) * (taper * 0.25) + heightVec.y * (taper * 0.05),
  }

  const result: Quad = [newTl, newTr, newBr, newBl]
  return isConvexQuad(result) ? result : quad
}

/**
 * Resolves a 4-point Quad directly from traced pen points / polygon:
 * - If 4 vertices: returns orderQuadFromPoints(polygon, orientationOffset)
 * - If 5 vertices and 5th vertex is closing point near 1st: extracts clean 4-point quad
 * - If other vertex counts: returns 4-corner bounding quad with optional perspective pitch
 */
export function getQuadFromPolygon(points: Point2D[], orientationOffset: number = 0, defaultPitchDeg: number = 0): Quad | null {
  if (!points || points.length < 3) return null

  // Case 1: Exactly 4 points
  if (points.length === 4) {
    const q = orderQuadFromPoints(points, orientationOffset)
    return defaultPitchDeg > 0 ? applyPerspectivePitchToQuad(q, defaultPitchDeg) : q
  }

  // Case 2: 5 points where 5th point is the closure of a 4-point polygon near points[0]
  if (points.length === 5) {
    const closureDist = Math.hypot(points[4].x - points[0].x, points[4].y - points[0].y)
    if (closureDist < 40) {
      const q = orderQuadFromPoints(points.slice(0, 4), orientationOffset)
      return defaultPitchDeg > 0 ? applyPerspectivePitchToQuad(q, defaultPitchDeg) : q
    }
  }

  // Case 3: More than 4 vertices: compute bounding quad
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const boxQuad: Quad = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  const offset = ((orientationOffset % 4) + 4) % 4
  const ordered: Quad = [
    boxQuad[offset],
    boxQuad[(offset + 1) % 4],
    boxQuad[(offset + 2) % 4],
    boxQuad[(offset + 3) % 4],
  ]
  return defaultPitchDeg > 0 ? applyPerspectivePitchToQuad(ordered, defaultPitchDeg) : ordered
}

export interface TransformablePanel {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  tiltAngle?: number
  customQuad?: [Point2D, Point2D, Point2D, Point2D]
  [key: string]: any
}

/**
 * Computes bounding rectangle and 4-corner bounding quad of a set of panels
 */
export function getSelectionBounds<T extends TransformablePanel>(panels: T[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  center: Point2D
  quad: Quad
} | null {
  if (!panels || panels.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const p of panels) {
    if (p.customQuad) {
      for (const pt of p.customQuad) {
        if (pt.x < minX) minX = pt.x
        if (pt.x > maxX) maxX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.y > maxY) maxY = pt.y
      }
    } else {
      const rot = p.rotation || 0
      if (rot !== 0) {
        const cx = p.x + p.width / 2
        const cy = p.y + p.height / 2
        const rad = (rot * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const hw = p.width / 2
        const hh = p.height / 2
        const corners = [
          { x: cx - hw * cos + hh * sin, y: cy - hw * sin - hh * cos },
          { x: cx + hw * cos + hh * sin, y: cy + hw * sin - hh * cos },
          { x: cx + hw * cos - hh * sin, y: cy + hw * sin + hh * cos },
          { x: cx - hw * cos - hh * sin, y: cy - hw * sin + hh * cos },
        ]
        for (const pt of corners) {
          if (pt.x < minX) minX = pt.x
          if (pt.x > maxX) maxX = pt.x
          if (pt.y < minY) minY = pt.y
          if (pt.y > maxY) maxY = pt.y
        }
      } else {
        if (p.x < minX) minX = p.x
        if (p.x + p.width > maxX) maxX = p.x + p.width
        if (p.y < minY) minY = p.y
        if (p.y + p.height > maxY) maxY = p.y + p.height
      }
    }
  }

  const width = Math.max(10, maxX - minX)
  const height = Math.max(10, maxY - minY)
  const center = { x: minX + width / 2, y: minY + height / 2 }
  const quad: Quad = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]

  return { minX, minY, maxX, maxY, width, height, center, quad }
}

/**
 * Warps a set of panels into a 3D perspective quad via Homography
 */
export function warpPanelsWithQuad<T extends TransformablePanel>(
  panels: T[],
  origBoundsQuad: Quad,
  targetQuad: Quad
): T[] {
  if (!panels || panels.length === 0) return panels
  if (!isConvexQuad(targetQuad)) return panels

  const H = getHomographyMatrix(origBoundsQuad, targetQuad)

  return panels.map((panel) => {
    let baseCorners: [Point2D, Point2D, Point2D, Point2D]
    if (panel.customQuad) {
      baseCorners = [
        { ...panel.customQuad[0] },
        { ...panel.customQuad[1] },
        { ...panel.customQuad[2] },
        { ...panel.customQuad[3] },
      ]
    } else {
      const rot = (panel.rotation || 0) * (Math.PI / 180)
      const cx = panel.x + panel.width / 2
      const cy = panel.y + panel.height / 2
      const hw = panel.width / 2
      const hh = panel.height / 2

      const rotateLocal = (lx: number, ly: number): Point2D => {
        const rx = lx * Math.cos(rot) - ly * Math.sin(rot)
        const ry = lx * Math.sin(rot) + ly * Math.cos(rot)
        return { x: cx + rx, y: cy + ry }
      }

      baseCorners = [
        rotateLocal(-hw, -hh),
        rotateLocal(hw, -hh),
        rotateLocal(hw, hh),
        rotateLocal(-hw, hh),
      ]
    }

    const projectedCorners: [Point2D, Point2D, Point2D, Point2D] = [
      projectPoint(H, baseCorners[0]),
      projectPoint(H, baseCorners[1]),
      projectPoint(H, baseCorners[2]),
      projectPoint(H, baseCorners[3]),
    ]

    const xs = projectedCorners.map((p) => p.x)
    const ys = projectedCorners.map((p) => p.y)
    const pMinX = Math.min(...xs)
    const pMaxX = Math.max(...xs)
    const pMinY = Math.min(...ys)
    const pMaxY = Math.max(...ys)

    return {
      ...panel,
      x: pMinX,
      y: pMinY,
      width: Math.max(10, pMaxX - pMinX),
      height: Math.max(10, pMaxY - pMinY),
      customQuad: projectedCorners,
    }
  })
}

/**
 * Applies quick 3D perspective preset slope to selected panels
 */
export function applyPresetPerspectiveToPanels<T extends TransformablePanel>(
  panels: T[],
  preset: 'pitch-up' | 'pitch-down' | 'pitch-left' | 'pitch-right' | 'reset',
  taperRatio: number = 0.18
): T[] {
  if (!panels || panels.length === 0) return panels

  if (preset === 'reset') {
    return panels.map((p) => {
      const copy: any = { ...p }
      delete copy.customQuad
      return copy as T
    })
  }

  const bounds = getSelectionBounds(panels)
  if (!bounds) return panels

  const { minX, maxX, minY, maxY, width, height, quad: origQuad } = bounds
  const targetQuad: Quad = [
    { ...origQuad[0] },
    { ...origQuad[1] },
    { ...origQuad[2] },
    { ...origQuad[3] },
  ]

  const dx = width * taperRatio
  const dy = height * taperRatio

  if (preset === 'pitch-up') {
    // 3D Roof Slope Up: Ridge (top) is tapered narrower, Eave (bottom) is wider
    targetQuad[0] = { x: minX + dx, y: minY }
    targetQuad[1] = { x: maxX - dx, y: minY }
    targetQuad[2] = { x: maxX + dx * 0.4, y: maxY }
    targetQuad[3] = { x: minX - dx * 0.4, y: maxY }
  } else if (preset === 'pitch-down') {
    // 3D Roof Slope Down: Top is wider, Bottom is narrower
    targetQuad[0] = { x: minX - dx * 0.4, y: minY }
    targetQuad[1] = { x: maxX + dx * 0.4, y: minY }
    targetQuad[2] = { x: maxX - dx, y: maxY }
    targetQuad[3] = { x: minX + dx, y: maxY }
  } else if (preset === 'pitch-left') {
    // Slope Left: Left side narrower, Right side wider
    targetQuad[0] = { x: minX, y: minY + dy }
    targetQuad[1] = { x: maxX, y: minY - dy * 0.4 }
    targetQuad[2] = { x: maxX, y: maxY + dy * 0.4 }
    targetQuad[3] = { x: minX, y: maxY - dy }
  } else if (preset === 'pitch-right') {
    // Slope Right: Right side narrower, Left side wider
    targetQuad[0] = { x: minX, y: minY - dy * 0.4 }
    targetQuad[1] = { x: maxX, y: minY + dy }
    targetQuad[2] = { x: maxX, y: maxY - dy }
    targetQuad[3] = { x: minX, y: maxY + dy * 0.4 }
  }

  return warpPanelsWithQuad(panels, origQuad, targetQuad)
}

/**
 * Proportional scale transform of panels and their customQuads within a bounding box
 */
export function scalePanelsWithBounds<T extends TransformablePanel>(
  panels: T[],
  origBounds: { minX: number; minY: number; maxX: number; maxY: number },
  newBounds: { minX: number; minY: number; maxX: number; maxY: number }
): T[] {
  const origW = Math.max(1, origBounds.maxX - origBounds.minX)
  const origH = Math.max(1, origBounds.maxY - origBounds.minY)
  const newW = Math.max(10, newBounds.maxX - newBounds.minX)
  const newH = Math.max(10, newBounds.maxY - newBounds.minY)

  const scaleX = newW / origW
  const scaleY = newH / origH

  return panels.map((panel) => {
    const relX = (panel.x - origBounds.minX) * scaleX
    const relY = (panel.y - origBounds.minY) * scaleY
    const pW = panel.width * scaleX
    const pH = panel.height * scaleY

    let updatedQuad: [Point2D, Point2D, Point2D, Point2D] | undefined
    if (panel.customQuad) {
      updatedQuad = panel.customQuad.map((pt) => ({
        x: newBounds.minX + (pt.x - origBounds.minX) * scaleX,
        y: newBounds.minY + (pt.y - origBounds.minY) * scaleY,
      })) as [Point2D, Point2D, Point2D, Point2D]
    }

    return {
      ...panel,
      x: newBounds.minX + relX,
      y: newBounds.minY + relY,
      width: Math.max(8, pW),
      height: Math.max(8, pH),
      customQuad: updatedQuad,
    }
  })
}
