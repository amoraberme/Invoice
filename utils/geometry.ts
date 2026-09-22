import type { Point, PlacedPanel, PanelOrientation } from '../types/roof'

/**
 * Calculates Euclidean distance between two 2D points.
 */
export function getDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Tests whether a point lies inside an arbitrary 2D polygon using the Ray-Casting algorithm.
 * Handles edge and vertex boundaries.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    // Check if point is exactly on vertex
    if (point.x === xi && point.y === yi) return true

    // Check if point is on horizontal edge
    if (yi === yj && point.y === yi && point.x >= Math.min(xi, xj) && point.x <= Math.max(xi, xj)) {
      return true
    }

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersect) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Calculates the 2D area of a polygon in pixels using the Shoelace (Gauss) formula.
 */
export function calculatePolygonAreaPixels(polygon: Point[]): number {
  const n = polygon.length
  if (n < 3) return 0

  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += polygon[i].x * polygon[j].y
    area -= polygon[j].x * polygon[i].y
  }

  return Math.abs(area) / 2
}

/**
 * Calculates polygon area in square meters based on pixelsPerMeter calibration.
 */
export function calculatePolygonAreaM2(polygon: Point[], pixelsPerMeter: number): number {
  if (pixelsPerMeter <= 0) return 0
  const areaPx = calculatePolygonAreaPixels(polygon)
  return areaPx / (pixelsPerMeter * pixelsPerMeter)
}

/**
 * Calculates polygon perimeter in meters based on pixelsPerMeter.
 */
export function calculatePolygonPerimeterM(polygon: Point[], pixelsPerMeter: number): number {
  if (polygon.length < 2 || pixelsPerMeter <= 0) return 0
  let perimeterPx = 0
  for (let i = 0; i < polygon.length; i++) {
    const next = polygon[(i + 1) % polygon.length]
    perimeterPx += getDistance(polygon[i], next)
  }
  return perimeterPx / pixelsPerMeter
}

/**
 * Helper to determine if three points are listed in counter-clockwise order.
 */
function ccw(p1: Point, p2: Point, p3: Point): boolean {
  return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x)
}

/**
 * Checks if point q lies on segment pr.
 */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  )
}

/**
 * Returns true if line segments (p1, p2) and (p3, p4) intersect.
 */
export function doLineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = (p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y)
  const o2 = (p2.y - p1.y) * (p4.x - p2.x) - (p2.x - p1.x) * (p4.y - p2.y)
  const o3 = (p4.y - p3.y) * (p1.x - p4.x) - (p4.x - p3.x) * (p1.y - p4.y)
  const o4 = (p4.y - p3.y) * (p2.x - p4.x) - (p4.x - p3.x) * (p2.y - p4.y)

  // General intersection case
  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
    return true
  }

  // Collinear and on segment cases
  if (Math.abs(o1) < 1e-9 && onSegment(p1, p3, p2)) return true
  if (Math.abs(o2) < 1e-9 && onSegment(p1, p4, p2)) return true
  if (Math.abs(o3) < 1e-9 && onSegment(p3, p1, p4)) return true
  if (Math.abs(o4) < 1e-9 && onSegment(p3, p2, p4)) return true

  return false
}

/**
 * Returns the four corner vertices of a placed panel rectangle.
 */
export function getPanelCorners(panel: { x: number; y: number; width: number; height: number; rotation?: number }): Point[] {
  const { x, y, width, height, rotation = 0 } = panel
  const corners: Point[] = [
    { x, y }, // Top-left
    { x: x + width, y }, // Top-right
    { x: x + width, y: y + height }, // Bottom-right
    { x, y: y + height }, // Bottom-left
  ]

  if (!rotation || rotation % 360 === 0) {
    return corners
  }

  const cx = x + width / 2
  const cy = y + height / 2
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return corners.map((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    }
  })
}

/**
 * Strict boundary constraint check:
 * Returns true if the panel is fully contained within the polygon:
 * 1. All 4 corners must be inside the polygon.
 * 2. The panel center must be inside the polygon.
 * 3. None of the 4 panel boundary edges intersect with any polygon boundary edges.
 */
export function isPanelInsidePolygon(
  panel: { x: number; y: number; width: number; height: number; rotation?: number },
  polygon: Point[]
): boolean {
  if (polygon.length < 3) return false

  const corners = getPanelCorners(panel)

  // 1. All 4 corners must be strictly inside the polygon
  for (const corner of corners) {
    if (!isPointInPolygon(corner, polygon)) {
      return false
    }
  }

  // 2. Check center point
  const center: Point = {
    x: panel.x + panel.width / 2,
    y: panel.y + panel.height / 2,
  }
  if (!isPointInPolygon(center, polygon)) {
    return false
  }

  // 3. None of the rectangle's 4 edges can intersect any polygon edge
  const panelEdges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ]

  const polyEdges: [Point, Point][] = []
  for (let i = 0; i < polygon.length; i++) {
    polyEdges.push([polygon[i], polygon[(i + 1) % polygon.length]])
  }

  for (const [p1, p2] of panelEdges) {
    for (const [q1, q2] of polyEdges) {
      if (doLineSegmentsIntersect(p1, p2, q1, q2)) {
        return false
      }
    }
  }

  return true
}

/**
 * Calculates adjacent panel snap position when dragging a panel.
 * If the dragged panel is within snapThreshold (default 10px) of another panel's edge,
 * it snaps flush (accounting for optional inter-panel gap).
 */
export function getAdjacentSnapPosition(
  dragged: { id: string; x: number; y: number; width: number; height: number },
  otherPanels: PlacedPanel[],
  snapThreshold: number = 10,
  gapPx: number = 0
): { x: number; y: number; snapped: boolean; snapType?: 'x' | 'y' | 'both' } {
  let targetX = dragged.x
  let targetY = dragged.y
  let snappedX = false
  let snappedY = false
  let minDiffX = snapThreshold + 1
  let minDiffY = snapThreshold + 1

  const overlapMargin = 5 // Minimum overlap to consider an adjacent snap

  for (const other of otherPanels) {
    if (other.id === dragged.id) continue

    // Vertical overlap check for horizontal snap
    const hasVerticalOverlap =
      dragged.y + dragged.height > other.y - overlapMargin &&
      dragged.y < other.y + other.height + overlapMargin

    if (hasVerticalOverlap) {
      // 1. Flush right of other panel: dragged.x snaps to other.x + other.width + gapPx
      const distRight = Math.abs(dragged.x - (other.x + other.width + gapPx))
      if (distRight <= snapThreshold && distRight < minDiffX) {
        minDiffX = distRight
        targetX = other.x + other.width + gapPx
        snappedX = true
      }

      // 2. Flush left of other panel: dragged.x + dragged.width snaps to other.x - gapPx
      const distLeft = Math.abs(dragged.x + dragged.width - (other.x - gapPx))
      if (distLeft <= snapThreshold && distLeft < minDiffX) {
        minDiffX = distLeft
        targetX = other.x - dragged.width - gapPx
        snappedX = true
      }

      // 3. Align left edges
      const distAlignLeft = Math.abs(dragged.x - other.x)
      if (distAlignLeft <= snapThreshold && distAlignLeft < minDiffX) {
        minDiffX = distAlignLeft
        targetX = other.x
        snappedX = true
      }

      // 4. Align right edges
      const distAlignRight = Math.abs(dragged.x + dragged.width - (other.x + other.width))
      if (distAlignRight <= snapThreshold && distAlignRight < minDiffX) {
        minDiffX = distAlignRight
        targetX = other.x + other.width - dragged.width
        snappedX = true
      }
    }

    // Horizontal overlap check for vertical snap
    const hasHorizontalOverlap =
      dragged.x + dragged.width > other.x - overlapMargin &&
      dragged.x < other.x + other.width + overlapMargin

    if (hasHorizontalOverlap) {
      // 1. Flush below other panel: dragged.y snaps to other.y + other.height + gapPx
      const distBottom = Math.abs(dragged.y - (other.y + other.height + gapPx))
      if (distBottom <= snapThreshold && distBottom < minDiffY) {
        minDiffY = distBottom
        targetY = other.y + other.height + gapPx
        snappedY = true
      }

      // 2. Flush above other panel: dragged.y + dragged.height snaps to other.y - gapPx
      const distTop = Math.abs(dragged.y + dragged.height - (other.y - gapPx))
      if (distTop <= snapThreshold && distTop < minDiffY) {
        minDiffY = distTop
        targetY = other.y - dragged.height - gapPx
        snappedY = true
      }

      // 3. Align top edges
      const distAlignTop = Math.abs(dragged.y - other.y)
      if (distAlignTop <= snapThreshold && distAlignTop < minDiffY) {
        minDiffY = distAlignTop
        targetY = other.y
        snappedY = true
      }

      // 4. Align bottom edges
      const distAlignBottom = Math.abs(dragged.y + dragged.height - (other.y + other.height))
      if (distAlignBottom <= snapThreshold && distAlignBottom < minDiffY) {
        minDiffY = distAlignBottom
        targetY = other.y + other.height - dragged.height
        snappedY = true
      }
    }
  }

  const snapped = snappedX || snappedY
  const snapType = snappedX && snappedY ? 'both' : snappedX ? 'x' : snappedY ? 'y' : undefined

  return {
    x: targetX,
    y: targetY,
    snapped,
    snapType,
  }
}

/**
 * Automated grid tiling generation:
 * Programmatically calculates solar panel placements within the defined polygon using
 * 2D bounding-box slicing and strict polygon clipping checks.
 * Explores phase offsets to maximize panel packing density.
 */
export function generateAutoGrid(
  polygon: Point[],
  panelDims: { lengthMm: number; widthMm: number },
  orientation: PanelOrientation,
  pixelsPerMeter: number,
  gapMm: number = 20
): PlacedPanel[] {
  if (polygon.length < 3 || pixelsPerMeter <= 0) return []

  // Physical dimension to pixel conversion
  const widthM = (orientation === 'portrait' ? panelDims.widthMm : panelDims.lengthMm) / 1000
  const heightM = (orientation === 'portrait' ? panelDims.lengthMm : panelDims.widthMm) / 1000

  const panelWidthPx = widthM * pixelsPerMeter
  const panelHeightPx = heightM * pixelsPerMeter
  const gapPx = (gapMm / 1000) * pixelsPerMeter

  if (panelWidthPx <= 0 || panelHeightPx <= 0) return []

  // Determine bounding box of the polygon
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pt of polygon) {
    if (pt.x < minX) minX = pt.x
    if (pt.x > maxX) maxX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.y > maxY) maxY = pt.y
  }

  const stepX = panelWidthPx + gapPx
  const stepY = panelHeightPx + gapPx

  let bestGrid: PlacedPanel[] = []
  let maxCount = -1

  // Multi-phase search offsets (test 4 horizontal and 4 vertical offsets to maximize yield)
  const numPhases = 4
  const offsetXSteps = [0, 0.25, 0.5, 0.75]
  const offsetYSteps = [0, 0.25, 0.5, 0.75]

  for (let ox = 0; ox < numPhases; ox++) {
    for (let oy = 0; oy < numPhases; oy++) {
      const startX = minX + offsetXSteps[ox] * stepX
      const startY = minY + offsetYSteps[oy] * stepY

      const currentCandidate: PlacedPanel[] = []
      let panelIndex = 1

      for (let y = startY; y + panelHeightPx <= maxY; y += stepY) {
        for (let x = startX; x + panelWidthPx <= maxX; x += stepX) {
          const candidate = {
            x,
            y,
            width: panelWidthPx,
            height: panelHeightPx,
          }

          if (isPanelInsidePolygon(candidate, polygon)) {
            currentCandidate.push({
              id: `panel-auto-${ox}-${oy}-${panelIndex++}`,
              x,
              y,
              width: panelWidthPx,
              height: panelHeightPx,
              orientation,
              isValid: true,
            })
          }
        }
      }

      if (currentCandidate.length > maxCount) {
        maxCount = currentCandidate.length
        bestGrid = currentCandidate
      }
    }
  }

  // Renumber the IDs sequentially for clean display and state management
  return bestGrid.map((panel, idx) => ({
    ...panel,
    id: `panel-${idx + 1}`,
  }))
}

/**
 * Calculates centroid of a polygon.
 */
export function getPolygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 }
  let sumX = 0
  let sumY = 0
  for (const pt of polygon) {
    sumX += pt.x
    sumY += pt.y
  }
  return {
    x: sumX / polygon.length,
    y: sumY / polygon.length,
  }
}

/**
 * Unit conversion helpers: meters, feet, square meters, square feet
 */
export function feetToMeters(feet: number): number {
  return feet * 0.3048
}

export function metersToFeet(meters: number): number {
  return meters / 0.3048
}

export function sqmToSqft(sqm: number): number {
  return sqm * 10.7639
}

export function sqftToSqm(sqft: number): number {
  return sqft / 10.7639
}

/**
 * Creates a rectangular roof plane polygon in canvas pixels centered around center point.
 */
export function createRectangularRoofPolygon(
  widthM: number,
  lengthM: number,
  center: Point,
  pixelsPerMeter: number
): Point[] {
  const halfW = (widthM * pixelsPerMeter) / 2
  const halfH = (lengthM * pixelsPerMeter) / 2

  return [
    { x: Math.round(center.x - halfW), y: Math.round(center.y - halfH) }, // Top-Left
    { x: Math.round(center.x + halfW), y: Math.round(center.y - halfH) }, // Top-Right
    { x: Math.round(center.x + halfW), y: Math.round(center.y + halfH) }, // Bottom-Right
    { x: Math.round(center.x - halfW), y: Math.round(center.y + halfH) }, // Bottom-Left
  ]
}

/**
 * Generates an array of exactly targetCount panels (e.g. 6 panels for 4kW setup).
 * If a polygon exists, centers and places the targetCount panels neatly inside it.
 */
export function generateTargetBoqPanels(
  polygon: Point[],
  panelDims: { lengthMm: number; widthMm: number },
  targetCount: number,
  orientation: PanelOrientation,
  pixelsPerMeter: number,
  gapMm: number = 20,
  centerFallback: Point = { x: 700, y: 500 }
): PlacedPanel[] {
  if (targetCount <= 0 || pixelsPerMeter <= 0) return []

  const widthM = (orientation === 'portrait' ? panelDims.widthMm : panelDims.lengthMm) / 1000
  const heightM = (orientation === 'portrait' ? panelDims.lengthMm : panelDims.widthMm) / 1000

  const panelWidthPx = widthM * pixelsPerMeter
  const panelHeightPx = heightM * pixelsPerMeter
  const gapPx = (gapMm / 1000) * pixelsPerMeter

  // Determine grid layout columns & rows for targetCount (e.g. 6 -> 3 cols x 2 rows)
  let cols = 3
  let rows = 2

  if (targetCount === 6) {
    cols = 3
    rows = 2
  } else if (targetCount <= 4) {
    cols = targetCount
    rows = 1
  } else if (targetCount <= 8) {
    cols = 4
    rows = 2
  } else if (targetCount <= 12) {
    cols = 4
    rows = 3
  } else if (targetCount <= 16) {
    cols = 4
    rows = 4
  } else {
    cols = Math.ceil(Math.sqrt(targetCount))
    rows = Math.ceil(targetCount / cols)
  }

  // If polygon is provided and closed, center inside polygon
  const center = polygon.length >= 3 ? getPolygonCentroid(polygon) : centerFallback

  const totalGridWidth = cols * panelWidthPx + (cols - 1) * gapPx
  const totalGridHeight = rows * panelHeightPx + (rows - 1) * gapPx

  const startX = center.x - totalGridWidth / 2
  const startY = center.y - totalGridHeight / 2

  const panels: PlacedPanel[] = []
  let placed = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (placed >= targetCount) break

      const x = startX + c * (panelWidthPx + gapPx)
      const y = startY + r * (panelHeightPx + gapPx)

      const candidate = {
        x,
        y,
        width: panelWidthPx,
        height: panelHeightPx,
      }

      const isValid = polygon.length >= 3 ? isPanelInsidePolygon(candidate, polygon) : true

      panels.push({
        id: `panel-boq-${placed + 1}`,
        x,
        y,
        width: panelWidthPx,
        height: panelHeightPx,
        orientation,
        isValid,
      })

      placed++
    }
  }

  return panels
}
