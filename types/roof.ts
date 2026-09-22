export interface Point {
  x: number
  y: number
}

export interface RoofPolygon {
  points: Point[]
  isClosed: boolean
}

export interface PanelDimensions {
  lengthMm: number // Physical length in millimeters (e.g. 2278)
  widthMm: number  // Physical width in millimeters (e.g. 1134)
  wattage: number  // Power rating in Watts (e.g. 620)
  modelName: string // Active model or brand name
}

export type PanelOrientation = 'portrait' | 'landscape'

export interface PlacedPanel {
  id: string
  x: number // Top-left x coordinate in canvas coordinate space (pixels)
  y: number // Top-left y coordinate in canvas coordinate space (pixels)
  width: number // Rendered width in canvas pixels
  height: number // Rendered height in canvas pixels
  orientation: PanelOrientation
  isValid: boolean // True if fully inside polygon; false if extending/intersecting outside
  rotation?: number // Planar azimuth/rotation angle in degrees (e.g. -45°, 0°, 15°, 90°)
  tiltAngle?: number // Mounting pitch tilt angle in degrees (e.g. 0° flush, 10°, 15°, 20°, 25°, 30°)
}

export interface ScaleCalibration {
  pointA: Point | null
  pointB: Point | null
  realWorldDistanceMeters: number
  pixelsPerMeter: number
  isCalibrated: boolean
}

export type RoofTool = 'select' | 'pen' | 'rect' | 'scale' | 'pan'

export interface RoofViewport {
  zoom: number
  panX: number
  panY: number
}

import type { Quad, Point2D, Matrix3x3 } from '@/utils/homography'
export { getQuadFromPolygon } from '@/utils/homography'
export type { Quad, Point2D, Matrix3x3 }

export interface RoofState {
  backgroundImageUrl: string | null
  imageOpacity: number // Clamped strictly between 0.20 and 0.80, default 0.50
  polygon: RoofPolygon
  placedPanels: PlacedPanel[]
  scale: ScaleCalibration
  panelDimensions: PanelDimensions
  activeTool: RoofTool
  interPanelGapMm: number // Default 20mm inter-panel clamp gap
  defaultOrientation: PanelOrientation
  viewport: RoofViewport
  enableSnapping?: boolean
  isRoofLocked?: boolean
  defaultTiltAngle?: number // Default mounting pitch angle (0° flush, 10°, 15°, 20°, 25°, 30°)
  defaultRotation?: number // Default planar rotation angle in degrees
  // Perspective plane projection extensions
  isPerspectiveEnabled?: boolean
  perspectiveQuad?: Quad
}

export type SavedRoofState = RoofState


export interface RoofMetrics {
  totalPanelsCount: number
  validPanelsCount: number
  invalidPanelsCount: number
  totalCapacityKwp: number // Based strictly on valid panels: (validCount * wattage) / 1000
  roofPolygonAreaM2: number
  panelsTotalAreaM2: number
  utilizationRatePercent: number
  targetBoqCount?: number
  targetBoqKwp?: number
}

export type DimensionUnit = 'meters' | 'feet'
export type AreaUnit = 'sqm' | 'sqft'

export interface RoofSizePreset {
  name: string
  widthM: number
  lengthM: number
  description?: string
}
