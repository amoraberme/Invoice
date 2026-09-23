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
 * Supports arbitrary panel rotation angles (0° to 360°).
 * Projects positions into the reference panel's local rotated coordinate frame,
 * ensuring panels snap flush with collinear top/bottom edges without jagged staircases.
 */
export function getAdjacentSnapPosition(
  dragged: { id: string; x: number; y: number; width: number; height: number; rotation?: number },
  otherPanels: PlacedPanel[],
  snapThreshold: number = 12,
  gapPx: number = 0
): { x: number; y: number; snapped: boolean; snapType?: 'x' | 'y' | 'both'; matchedRotation?: number } {
  let targetX = dragged.x
  let targetY = dragged.y
  let snapped = false
  let snapType: 'x' | 'y' | 'both' | undefined = undefined
  let matchedRotation: number | undefined = undefined

  const cxDrag = dragged.x + dragged.width / 2
  const cyDrag = dragged.y + dragged.height / 2

  let bestDist = snapThreshold + 1

  for (const other of otherPanels) {
    if (other.id === dragged.id) continue

    const otherRot = other.rotation || 0
    const cxOther = other.x + other.width / 2
    const cyOther = other.y + other.height / 2

    // Vector from other panel center to dragged panel center
    const dx = cxDrag - cxOther
    const dy = cyDrag - cyOther

    // Project into other panel's local rotated coordinate frame
    const rad = (otherRot * Math.PI) / 180
    const cosA = Math.cos(rad)
    const sinA = Math.sin(rad)

    // du is along width (row vector), dv is along height (column vector)
    const du = dx * cosA + dy * sinA
    const dv = -dx * sinA + dy * cosA

    const stepU = (other.width + dragged.width) / 2 + gapPx
    const stepV = (other.height + dragged.height) / 2 + gapPx

    const marginU = (other.width + dragged.width) / 2 + 16
    const marginV = (other.height + dragged.height) / 2 + 16

    let candTargetU = du
    let candTargetV = dv
    let didSnapU = false
    let didSnapV = false
    let distU = snapThreshold + 1
    let distV = snapThreshold + 1

    // 1. Horizontal Adjacent Snap (Placing side-by-side along row vector u)
    if (Math.abs(dv) < marginV) {
      // Flush Right of other panel
      const dRight = Math.abs(du - stepU)
      if (dRight <= snapThreshold && dRight < distU) {
        candTargetU = stepU
        distU = dRight
        didSnapU = true
      }
      // Flush Left of other panel
      const dLeft = Math.abs(du - (-stepU))
      if (dLeft <= snapThreshold && dLeft < distU) {
        candTargetU = -stepU
        distU = dLeft
        didSnapU = true
      }
      // Collinear row edge alignment (locks top/bottom edges into a straight continuous line)
      const dAlignRow = Math.abs(dv - 0)
      if (dAlignRow <= snapThreshold) {
        candTargetV = 0
        distV = dAlignRow
        didSnapV = true
      }
    }

    // 2. Vertical Adjacent Snap (Placing stacked above/below along column vector v)
    if (Math.abs(du) < marginU) {
      // Flush Below other panel
      const dBelow = Math.abs(dv - stepV)
      if (dBelow <= snapThreshold && dBelow < distV) {
        candTargetV = stepV
        distV = dBelow
        didSnapV = true
      }
      // Flush Above other panel
      const dAbove = Math.abs(dv - (-stepV))
      if (dAbove <= snapThreshold && dAbove < distV) {
        candTargetV = -stepV
        distV = dAbove
        didSnapV = true
      }
      // Collinear column edge alignment (locks left/right edges into a straight vertical column)
      const dAlignCol = Math.abs(du - 0)
      if (dAlignCol <= snapThreshold) {
        candTargetU = 0
        distU = dAlignCol
        didSnapU = true
      }
    }

    if (didSnapU || didSnapV) {
      const combinedDist = Math.min(distU, distV)
      if (combinedDist < bestDist) {
        bestDist = combinedDist
        snapped = true
        matchedRotation = otherRot

        // Transform back from local (candTargetU, candTargetV) to world canvas coordinates
        const snappedCx = cxOther + candTargetU * cosA - candTargetV * sinA
        const snappedCy = cyOther + candTargetU * sinA + candTargetV * cosA

        targetX = snappedCx - dragged.width / 2
        targetY = snappedCy - dragged.height / 2

        snapType = didSnapU && didSnapV ? 'both' : didSnapU ? 'x' : 'y'
      }
    }
  }

  return {
    x: targetX,
    y: targetY,
    snapped,
    snapType,
    matchedRotation,
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
  gapMm: number = 20,
  rotation: number = 0,
  tiltAngle: number = 0
): PlacedPanel[] {
  if (polygon.length < 3 || pixelsPerMeter <= 0) return []

  const widthM = (orientation === 'portrait' ? panelDims.widthMm : panelDims.lengthMm) / 1000
  const heightM = (orientation === 'portrait' ? panelDims.lengthMm : panelDims.widthMm) / 1000

  const panelWidthPx = widthM * pixelsPerMeter
  const panelHeightPx = heightM * pixelsPerMeter
  const gapPx = (gapMm / 1000) * pixelsPerMeter

  // Polygon centroid for rotated coordinate frame
  const center = getPolygonCentroid(polygon)
  const rad = (rotation * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)

  // Project polygon vertices into rotated coordinate frame
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity

  for (const pt of polygon) {
    const dx = pt.x - center.x
    const dy = pt.y - center.y
    const u = dx * cosA + dy * sinA
    const v = -dx * sinA + dy * cosA
    if (u < minU) minU = u
    if (u > maxU) maxU = u
    if (v < minV) minV = v
    if (v > maxV) maxV = v
  }

  const stepU = panelWidthPx + gapPx
  const stepV = panelHeightPx + gapPx

  let bestGrid: PlacedPanel[] = []
  let maxCount = -1

  // Multi-phase search offsets (test 4 horizontal and 4 vertical offsets to maximize yield)
  const numPhases = 4
  const offsetUSteps = [0, 0.25, 0.5, 0.75]
  const offsetVSteps = [0, 0.25, 0.5, 0.75]

  for (let ox = 0; ox < numPhases; ox++) {
    for (let oy = 0; oy < numPhases; oy++) {
      const startU = minU + offsetUSteps[ox] * stepU
      const startV = minV + offsetVSteps[oy] * stepV

      const currentCandidate: PlacedPanel[] = []
      let panelIndex = 1

      for (let v = startV; v + panelHeightPx <= maxV; v += stepV) {
        for (let u = startU; u + panelWidthPx <= maxU; u += stepU) {
          const cx = center.x + (u + panelWidthPx / 2) * cosA - (v + panelHeightPx / 2) * sinA
          const cy = center.y + (u + panelWidthPx / 2) * sinA + (v + panelHeightPx / 2) * cosA

          const candidate = {
            x: cx - panelWidthPx / 2,
            y: cy - panelHeightPx / 2,
            width: panelWidthPx,
            height: panelHeightPx,
            rotation,
          }

          if (isPanelInsidePolygon(candidate, polygon)) {
            currentCandidate.push({
              id: `panel-auto-${ox}-${oy}-${panelIndex++}`,
              x: candidate.x,
              y: candidate.y,
              width: panelWidthPx,
              height: panelHeightPx,
              orientation,
              isValid: true,
              rotation,
              tiltAngle,
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
  centerFallback: Point = { x: 700, y: 500 },
  rotation: number = 0,
  tiltAngle: number = 0
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

  const rad = (rotation * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)

  const panels: PlacedPanel[] = []
  let placed = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (placed >= targetCount) break

      // Grid offsets relative to grid centroid
      const relU = (c - (cols - 1) / 2) * (panelWidthPx + gapPx)
      const relV = (r - (rows - 1) / 2) * (panelHeightPx + gapPx)

      // Rotate around centroid by rotation angle
      const rotU = relU * cosA - relV * sinA
      const rotV = relU * sinA + relV * cosA

      const cx = center.x + rotU
      const cy = center.y + rotV

      const x = cx - panelWidthPx / 2
      const y = cy - panelHeightPx / 2

      const candidate = {
        x,
        y,
        width: panelWidthPx,
        height: panelHeightPx,
        rotation,
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
        rotation,
        tiltAngle,
      })

      placed++
    }
  }

  return panels
}

/**
 * Aligns panels into perfectly collinear rows along their rotation angle.
 * Completely eliminates any jagged "staircase" steps caused by uncoordinated rotation.
 */
export function alignPanelsCollinear(
  panels: PlacedPanel[],
  polygonPoints?: Point[]
): PlacedPanel[] {
  if (panels.length <= 1) return panels

  // Reference angle from first panel or dominant rotation
  const refAngle = panels[0].rotation || 0
  const rad = (refAngle * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)

  // Array collective centroid
  let sumCx = 0
  let sumCy = 0
  for (const p of panels) {
    sumCx += p.x + p.width / 2
    sumCy += p.y + p.height / 2
  }
  const C = { x: sumCx / panels.length, y: sumCy / panels.length }

  // Project all panels into local (u, v) coordinates relative to centroid
  const localPanels = panels.map((p) => {
    const cx = p.x + p.width / 2
    const cy = p.y + p.height / 2
    const dx = cx - C.x
    const dy = cy - C.y
    const u = dx * cosA + dy * sinA
    const v = -dx * sinA + dy * cosA
    return { panel: p, u, v }
  })

  // Group panels into rows based on v coordinate proximity
  const sortedByV = [...localPanels].sort((a, b) => a.v - b.v)
  const rows: (typeof localPanels)[] = []
  let currentRow: typeof localPanels = []
  const vThreshold = (panels[0].height || 40) * 0.6

  for (const item of sortedByV) {
    if (currentRow.length === 0) {
      currentRow.push(item)
    } else {
      const rowAvgV = currentRow.reduce((sum, i) => sum + i.v, 0) / currentRow.length
      if (Math.abs(item.v - rowAvgV) <= vThreshold) {
        currentRow.push(item)
      } else {
        rows.push(currentRow)
        currentRow = [item]
      }
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  // For each row, equalize v to row average and keep panels collinearly straight
  const aligned: PlacedPanel[] = []
  for (const row of rows) {
    const rowAvgV = row.reduce((sum, i) => sum + i.v, 0) / row.length

    for (const item of row) {
      const p = item.panel
      const finalU = item.u
      const finalV = rowAvgV

      // Transform back to world canvas coordinates
      const cx = C.x + finalU * cosA - finalV * sinA
      const cy = C.y + finalU * sinA + finalV * cosA

      const newX = Math.round(cx - p.width / 2)
      const newY = Math.round(cy - p.height / 2)
      const shiftX = newX - p.x
      const shiftY = newY - p.y

      let newCustomQuad = p.customQuad
      if (p.customQuad) {
        newCustomQuad = p.customQuad.map((pt) => ({
          x: Math.round(pt.x + shiftX),
          y: Math.round(pt.y + shiftY),
        })) as [Point, Point, Point, Point]
      }

      const updated: PlacedPanel = {
        ...p,
        x: newX,
        y: newY,
        rotation: refAngle,
        customQuad: newCustomQuad,
      }

      const isValid = polygonPoints && polygonPoints.length >= 3
        ? newCustomQuad
          ? newCustomQuad.every((pt) => isPointInPolygon(pt, polygonPoints))
          : isPanelInsidePolygon(updated, polygonPoints)
        : p.isValid

      aligned.push({ ...updated, isValid })
    }
  }

  return aligned
}

/**
 * Rotates a single panel around a given center point (or its own center) by deltaAngle degrees.
 * Seamlessly rotates both 2D standard orientation and any 3D perspective customQuad vertices.
 */
export function rotateSinglePanel(
  panel: PlacedPanel,
  deltaAngle: number,
  center?: Point,
  polygonPoints?: Point[]
): PlacedPanel {
  if (Math.abs(deltaAngle) < 0.0001) return panel

  const rad = (deltaAngle * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)

  // Compute panel center
  let panelCx: number
  let panelCy: number
  if (panel.customQuad) {
    const [q0, q1, q2, q3] = panel.customQuad
    panelCx = (q0.x + q1.x + q2.x + q3.x) / 4
    panelCy = (q0.y + q1.y + q2.y + q3.y) / 4
  } else {
    panelCx = panel.x + panel.width / 2
    panelCy = panel.y + panel.height / 2
  }

  const rotCx = center ? center.x : panelCx
  const rotCy = center ? center.y : panelCy

  // Rotate panel origin (x, y) around rotC
  const relX = panelCx - rotCx
  const relY = panelCy - rotCy
  const newCx = rotCx + relX * cosA - relY * sinA
  const newCy = rotCy + relX * sinA + relY * cosA

  const newRotation = Math.round(((((panel.rotation || 0) + deltaAngle) % 360) + 360) % 360 * 10) / 10

  let newCustomQuad: [Point, Point, Point, Point] | undefined = undefined
  if (panel.customQuad) {
    newCustomQuad = panel.customQuad.map((pt) => {
      const dx = pt.x - rotCx
      const dy = pt.y - rotCy
      return {
        x: Math.round(rotCx + dx * cosA - dy * sinA),
        y: Math.round(rotCy + dx * sinA + dy * cosA),
      }
    }) as [Point, Point, Point, Point]
  }

  const updated: PlacedPanel = {
    ...panel,
    x: Math.round(newCx - panel.width / 2),
    y: Math.round(newCy - panel.height / 2),
    rotation: newRotation,
    customQuad: newCustomQuad,
  }

  const isValid = polygonPoints && polygonPoints.length >= 3
    ? newCustomQuad
      ? newCustomQuad.every((pt) => isPointInPolygon(pt, polygonPoints))
      : isPanelInsidePolygon(updated, polygonPoints)
    : panel.isValid

  return {
    ...updated,
    isValid,
  }
}

/**
 * Rotates an array of panels around the collective centroid of the array by delta degrees.
 * Rigid-body rotation preserves all inter-panel distances, relative orientations, and 3D quads.
 */
export function rotatePanelsAsArray(
  panels: PlacedPanel[],
  deltaAngle: number,
  polygonPoints?: Point[],
  customCentroid?: Point
): PlacedPanel[] {
  if (panels.length === 0) return []
  if (Math.abs(deltaAngle) < 0.0001) return panels

  // Compute collective centroid
  let centroidX = 0
  let centroidY = 0
  if (customCentroid) {
    centroidX = customCentroid.x
    centroidY = customCentroid.y
  } else {
    let sumCx = 0
    let sumCy = 0
    for (const p of panels) {
      if (p.customQuad) {
        const [q0, q1, q2, q3] = p.customQuad
        sumCx += (q0.x + q1.x + q2.x + q3.x) / 4
        sumCy += (q0.y + q1.y + q2.y + q3.y) / 4
      } else {
        sumCx += p.x + p.width / 2
        sumCy += p.y + p.height / 2
      }
    }
    centroidX = sumCx / panels.length
    centroidY = sumCy / panels.length
  }

  const center: Point = { x: centroidX, y: centroidY }
  return panels.map((p) => rotateSinglePanel(p, deltaAngle, center, polygonPoints))
}

/**
 * Sets the absolute rotation angle of the panel array to targetAngle.
 * Rotates all panel positions around the collective centroid to match targetAngle.
 */
export function setPanelsArrayRotation(
  panels: PlacedPanel[],
  targetAngle: number,
  polygonPoints?: Point[],
  customCentroid?: Point
): PlacedPanel[] {
  if (panels.length === 0) return []
  const normTarget = Math.round((((targetAngle % 360) + 360) % 360) * 10) / 10

  const refAngle = panels[0].rotation || 0
  let delta = normTarget - refAngle
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360

  return rotatePanelsAsArray(panels, delta, polygonPoints, customCentroid)
}
