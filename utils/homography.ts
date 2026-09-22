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
 * Validates that four points form a non-self-intersecting, convex quadrilateral
 * using cross-product signs of consecutive edges.
 */
export function isConvexQuad(quad: Quad): boolean {
  if (!quad || quad.length !== 4) return false

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
      // Degenerate collinear points
      return false
    }

    const currentSign = cross > 0 ? 1 : -1
    if (sign === null) {
      sign = currentSign
    } else if (sign !== currentSign) {
      // Sign change means non-convex or self-intersecting polygon
      return false
    }
  }

  return true
}

/**
 * Sorts/arranges 4 arbitrary points into canonical clockwise order:
 * [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 */
export function orderQuadClockwise(points: Point2D[]): Quad {
  if (points.length !== 4) {
    throw new Error('orderQuadClockwise requires exactly 4 points')
  }

  // Calculate centroid
  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4

  // Sort by polar angle around centroid: Math.atan2(y - cy, x - cx)
  const sorted = [...points].sort((a, b) => {
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  })

  // Find the top-left vertex: minimum (x + y)
  let tlIdx = 0
  let minSum = Infinity
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y
    if (sum < minSum) {
      minSum = sum
      tlIdx = i
    }
  }

  // Rotate array so Top-Left is index 0
  return [
    sorted[tlIdx],
    sorted[(tlIdx + 1) % 4],
    sorted[(tlIdx + 2) % 4],
    sorted[(tlIdx + 3) % 4],
  ]
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
