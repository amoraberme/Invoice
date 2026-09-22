'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Point,
  RoofPolygon,
  PlacedPanel,
  ScaleCalibration,
  RoofTool,
  PanelDimensions,
  RoofViewport,
  PanelOrientation,
} from '@/types/roof'
import {
  isPointInPolygon,
  isPanelInsidePolygon,
  getAdjacentSnapPosition,
  getDistance,
  calculatePolygonAreaM2,
  getPolygonCentroid,
  getPanelCorners,
} from '@/utils/geometry'
import {
  Quad,
  getHomographyMatrix,
  invertHomography,
  projectPoint,
  projectPanelQuad,
  isConvexQuad,
  isQuadInsidePolygon,
} from '@/utils/homography'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCw, Trash2, Upload, Move, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoofCanvasProps {
  backgroundImageUrl: string | null
  imageOpacity: number
  polygon: RoofPolygon
  onUpdatePolygon: (polygon: RoofPolygon) => void
  placedPanels: PlacedPanel[]
  onUpdatePanels: (panels: PlacedPanel[]) => void
  scale: ScaleCalibration
  onUpdateScale: (scale: ScaleCalibration) => void
  activeTool: RoofTool
  onSelectTool?: (tool: RoofTool) => void
  panelDimensions: PanelDimensions
  orientation: PanelOrientation
  interPanelGapMm: number
  viewport: RoofViewport
  onUpdateViewport: (viewport: RoofViewport) => void
  onUploadImageClick: () => void
  centerFitTrigger?: number
  enableSnapping?: boolean
  onToggleSnapping?: () => void
  isRoofLocked?: boolean
  onToggleRoofLock?: () => void
  selectedPanelId?: string | null
  onSelectPanel?: (panelId: string | null) => void
  isPerspectiveEnabled?: boolean
  perspectiveQuad?: Quad
  onUpdatePerspectiveQuad?: (quad: Quad) => void
}

export const RoofCanvas: React.FC<RoofCanvasProps> = ({
  backgroundImageUrl,
  imageOpacity,
  polygon,
  onUpdatePolygon,
  placedPanels,
  onUpdatePanels,
  scale,
  onUpdateScale,
  activeTool,
  onSelectTool,
  panelDimensions,
  orientation,
  interPanelGapMm,
  viewport,
  onUpdateViewport,
  onUploadImageClick,
  centerFitTrigger,
  enableSnapping = true,
  onToggleSnapping,
  isRoofLocked = true,
  onToggleRoofLock,
  selectedPanelId: propSelectedPanelId,
  onSelectPanel,
  isPerspectiveEnabled = false,
  perspectiveQuad,
  onUpdatePerspectiveQuad,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Clamp opacity strictly between 0.20 and 0.80
  const clampedOpacity = Math.min(0.8, Math.max(0.2, imageOpacity))

  // Natural image dimensions for auto-centering
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  // Interaction states
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null)
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null)
  const [cursorPos, setCursorPos] = useState<Point | null>(null)
  const [internalSelectedPanelId, setInternalSelectedPanelId] = useState<string | null>(null)
  const selectedPanelId = propSelectedPanelId !== undefined ? propSelectedPanelId : internalSelectedPanelId
  const setSelectedPanelId = useCallback((id: string | null) => {
    setInternalSelectedPanelId(id)
    if (onSelectPanel) onSelectPanel(id)
  }, [onSelectPanel])

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null)
  const [draggingRotationPanelId, setDraggingRotationPanelId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 })
  const isSpacePressedRef = useRef(false)

  // Rect Tool & Whole Polygon Drag State
  const [rectStart, setRectStart] = useState<Point | null>(null)
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false)
  const [polyDragStart, setPolyDragStart] = useState<Point>({ x: 0, y: 0 })

  // Perspective Plane Control State
  const [draggingPerspectiveIdx, setDraggingPerspectiveIdx] = useState<number | null>(null)

  // Compute Homography Matrices when Perspective Mode is Active
  const perspectiveMetrics = useMemo(() => {
    if (!isPerspectiveEnabled || !perspectiveQuad || !isConvexQuad(perspectiveQuad)) {
      return null
    }
    const [tl, tr, br, bl] = perspectiveQuad
    const topW = getDistance(tl, tr)
    const botW = getDistance(bl, br)
    const leftH = getDistance(tl, bl)
    const rightH = getDistance(tr, br)
    const flatWidth = Math.max(50, Math.round((topW + botW) / 2))
    const flatHeight = Math.max(50, Math.round((leftH + rightH) / 2))

    const srcQuad: Quad = [
      { x: 0, y: 0 },
      { x: flatWidth, y: 0 },
      { x: flatWidth, y: flatHeight },
      { x: 0, y: flatHeight },
    ]
    const H = getHomographyMatrix(srcQuad, perspectiveQuad)
    const H_inv = invertHomography(H)

    return {
      flatWidth,
      flatHeight,
      srcQuad,
      H,
      H_inv,
    }
  }, [isPerspectiveEnabled, perspectiveQuad])

  // Track image load
  useEffect(() => {
    if (!backgroundImageUrl) return
    const img = new Image()
    img.src = backgroundImageUrl
    img.onload = () => {
      setImageDims({ width: img.naturalWidth || 1200, height: img.naturalHeight || 800 })
    }
  }, [backgroundImageUrl])

  // Center and fit view helper
  const centerAndFit = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cw = rect.width || 1200
    const ch = rect.height || 700

    // Priority 1: Fit polygon if closed
    if (polygon.points.length >= 3) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const pt of polygon.points) {
        if (pt.x < minX) minX = pt.x
        if (pt.x > maxX) maxX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.y > maxY) maxY = pt.y
      }
      const polyW = Math.max(120, maxX - minX)
      const polyH = Math.max(120, maxY - minY)
      const padding = 140
      const scaleX = (cw - padding) / polyW
      const scaleY = (ch - padding) / polyH
      const fitZoom = Math.min(2.5, Math.max(0.35, Math.min(scaleX, scaleY)))
      const polyCenterX = (minX + maxX) / 2
      const polyCenterY = (minY + maxY) / 2

      onUpdateViewport({
        zoom: fitZoom,
        panX: cw / 2 - polyCenterX * fitZoom,
        panY: ch / 2 - polyCenterY * fitZoom,
      })
      return
    }

    // Priority 2: Fit background image if present
    if (imageDims.width > 0 && imageDims.height > 0) {
      const padding = 100
      const scaleX = (cw - padding) / imageDims.width
      const scaleY = (ch - padding) / imageDims.height
      const fitZoom = Math.min(1.5, Math.max(0.3, Math.min(scaleX, scaleY)))
      onUpdateViewport({
        zoom: fitZoom,
        panX: (cw - imageDims.width * fitZoom) / 2,
        panY: (ch - imageDims.height * fitZoom) / 2,
      })
      return
    }

    // Fallback: Center canvas
    onUpdateViewport({
      zoom: 1.0,
      panX: cw / 2 - 400,
      panY: ch / 2 - 300,
    })
  }, [polygon, imageDims, onUpdateViewport])

  // Respond to centerFitTrigger from parent
  useEffect(() => {
    if (centerFitTrigger !== undefined && centerFitTrigger > 0) {
      centerAndFit()
    }
  }, [centerFitTrigger, centerAndFit])

  // Scale calibration interaction state
  const [scaleTempStart, setScaleTempStart] = useState<Point | null>(null)
  const [scaleModalOpen, setScaleModalOpen] = useState(false)
  const [scaleDistanceInput, setScaleDistanceInput] = useState('5.0')
  const [pendingScalePoints, setPendingScalePoints] = useState<{ p1: Point; p2: Point } | null>(null)

  // Convert client mouse coordinates to local canvas coordinate space
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 }
      const rect = containerRef.current.getBoundingClientRect()
      const rawX = clientX - rect.left
      const rawY = clientY - rect.top
      return {
        x: (rawX - viewport.panX) / viewport.zoom,
        y: (rawY - viewport.panY) / viewport.zoom,
      }
    },
    [viewport]
  )

  // Re-verify validity of all panels whenever polygon vertices or scale changes
  const recheckAllPanelsValidity = useCallback(
    (currentPolygon: RoofPolygon, panels: PlacedPanel[]) => {
      if (!currentPolygon.isClosed || currentPolygon.points.length < 3) {
        return panels.map((p) => ({ ...p, isValid: false }))
      }
      if (isPerspectiveEnabled && perspectiveMetrics) {
        return panels.map((panel) => {
          const corners = getPanelCorners(panel) as [Point, Point, Point, Point]
          const projQuad = projectPanelQuad(perspectiveMetrics.H, corners)
          return {
            ...panel,
            isValid: isQuadInsidePolygon(projQuad, currentPolygon.points),
          }
        })
      }
      return panels.map((panel) => ({
        ...panel,
        isValid: isPanelInsidePolygon(panel, currentPolygon.points),
      }))
    },
    [isPerspectiveEnabled, perspectiveMetrics]
  )

  // Handle Wheel Zoom (Zoom in/out centered on mouse cursor)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89
    const newZoom = Math.min(4.0, Math.max(0.3, viewport.zoom * zoomFactor))

    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Adjust pan so mouse point remains invariant
    const newPanX = mouseX - ((mouseX - viewport.panX) / viewport.zoom) * newZoom
    const newPanY = mouseY - ((mouseY - viewport.panY) / viewport.zoom) * newZoom

    onUpdateViewport({
      zoom: newZoom,
      panX: newPanX,
      panY: newPanY,
    })
  }

  // Pointer Down (Pen click, Vertex drag, Panel drag, Scale measurement, or Pan)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary button clicks
    if (e.button !== 0) return

    const canvasPt = screenToCanvas(e.clientX, e.clientY)

    // Mode: Pan
    if (activeTool === 'pan' || e.shiftKey || isSpacePressedRef.current) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY })
      return
    }

    // Mode: Rect Tool (Draw Roof Box by dragging)
    if (activeTool === 'rect') {
      setRectStart(canvasPt)
      return
    }

    // Mode: Scale Calibration
    if (activeTool === 'scale') {
      if (!scaleTempStart) {
        setScaleTempStart(canvasPt)
      } else {
        const p1 = scaleTempStart
        const p2 = canvasPt
        const distPx = getDistance(p1, p2)
        if (distPx > 10) {
          setPendingScalePoints({ p1, p2 })
          setScaleModalOpen(true)
        }
        setScaleTempStart(null)
      }
      return
    }

    // Mode: Pen Tool (Polygon Boundary Tracing)
    if (activeTool === 'pen') {
      const snapRadius = 18 / viewport.zoom

      if (polygon.isClosed) {
        if (isRoofLocked) {
          alert('Roof boundary is locked. Click "Unlock" in the toolbar to redraw or modify the roof boundary.')
          return
        }
        if (polygon.points.length >= 3) {
          const ok = window.confirm('Start drawing a new roof boundary? This will replace the current boundary.')
          if (!ok) return
        }
        // Automatically start fresh polygon
        onUpdatePolygon({ points: [canvasPt], isClosed: false })
        return
      }

      // If clicking near first point, close the polygon
      if (polygon.points.length >= 3) {
        const firstPoint = polygon.points[0]
        if (getDistance(canvasPt, firstPoint) <= snapRadius) {
          const closedPoly: RoofPolygon = { ...polygon, isClosed: true }
          onUpdatePolygon(closedPoly)
          onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
          if (onSelectTool) onSelectTool('select')
          return
        }
      }

      // Otherwise append new vertex
      const newPoints = [...polygon.points, canvasPt]
      onUpdatePolygon({ ...polygon, points: newPoints })
      return
    }

    // Default Select Mode: Clicking empty canvas deselects panel
    if (activeTool === 'select') {
      setSelectedPanelId(null)
    }
  }

  // Pointer Move (Live tracking, rubberbanding, vertex dragging, panel dragging, canvas panning)
  const handlePointerMove = (e: React.PointerEvent) => {
    const canvasPt = screenToCanvas(e.clientX, e.clientY)
    setCursorPos(canvasPt)

    // Handle canvas panning
    if (isPanning) {
      onUpdateViewport({
        ...viewport,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y,
      })
      return
    }

    // Handle whole polygon dragging
    if (isDraggingPolygon && polygon.points.length > 0) {
      const dx = canvasPt.x - polyDragStart.x
      const dy = canvasPt.y - polyDragStart.y
      setPolyDragStart(canvasPt)

      const updatedPoints = polygon.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
      const updatedPoly = { ...polygon, points: updatedPoints }
      onUpdatePolygon(updatedPoly)

      const updatedPanels = placedPanels.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
      onUpdatePanels(recheckAllPanelsValidity(updatedPoly, updatedPanels))
      return
    }

    // Handle perspective plane corner dragging
    if (draggingPerspectiveIdx !== null && perspectiveQuad && onUpdatePerspectiveQuad) {
      const updatedQuad: Quad = [
        perspectiveQuad[0],
        perspectiveQuad[1],
        perspectiveQuad[2],
        perspectiveQuad[3],
      ]
      updatedQuad[draggingPerspectiveIdx] = canvasPt
      if (isConvexQuad(updatedQuad)) {
        onUpdatePerspectiveQuad(updatedQuad)
        if (perspectiveMetrics) {
          const newH = getHomographyMatrix(perspectiveMetrics.srcQuad, updatedQuad)
          onUpdatePanels(
            placedPanels.map((p) => {
              const corners = getPanelCorners(p) as [Point, Point, Point, Point]
              const projQuad = projectPanelQuad(newH, corners)
              return {
                ...p,
                isValid: polygon.isClosed ? isQuadInsidePolygon(projQuad, polygon.points) : false,
              }
            })
          )
        }
      }
      return
    }

    // Handle vertex dragging
    if (draggingVertexIdx !== null && polygon.points[draggingVertexIdx]) {
      const updatedPoints = [...polygon.points]
      updatedPoints[draggingVertexIdx] = canvasPt
      const updatedPoly = { ...polygon, points: updatedPoints }
      onUpdatePolygon(updatedPoly)
      onUpdatePanels(recheckAllPanelsValidity(updatedPoly, placedPanels))
      return
    }

    // Handle panel rotation dragging (fluid custom rotation)
    if (draggingRotationPanelId !== null) {
      const currentPanel = placedPanels.find((p) => p.id === draggingRotationPanelId)
      if (!currentPanel) return

      const cx = currentPanel.x + currentPanel.width / 2
      const cy = currentPanel.y + currentPanel.height / 2
      const rad = Math.atan2(canvasPt.y - cy, canvasPt.x - cx)
      const deg = (rad * 180) / Math.PI + 90
      
      // Calculate continuous custom angle (1 degree precision)
      let customAngle = Math.round(((deg % 360) + 360) % 360)
      if (customAngle === 360) customAngle = 0

      // If user holds Shift, snap to 15-degree steps (standard CAD convention)
      if (e.shiftKey) {
        customAngle = (Math.round(customAngle / 15) * 15) % 360
      } else if (enableSnapping && !e.altKey) {
        // Soft magnetic snap within 2 degrees of major cardinal axes only (0°, 90°, 180°, 270°)
        if (Math.abs(customAngle - 0) <= 2 || Math.abs(customAngle - 360) <= 2) {
          customAngle = 0
        } else if (Math.abs(customAngle - 90) <= 2) {
          customAngle = 90
        } else if (Math.abs(customAngle - 180) <= 2) {
          customAngle = 180
        } else if (Math.abs(customAngle - 270) <= 2) {
          customAngle = 270
        }
      }

      const candidatePanel = {
        ...currentPanel,
        rotation: customAngle,
      }

      let isValid = false
      if (polygon.isClosed) {
        if (isPerspectiveEnabled && perspectiveMetrics) {
          const corners = getPanelCorners(candidatePanel) as [Point, Point, Point, Point]
          const projQuad = projectPanelQuad(perspectiveMetrics.H, corners)
          isValid = isQuadInsidePolygon(projQuad, polygon.points)
        } else {
          isValid = isPanelInsidePolygon(candidatePanel, polygon.points)
        }
      }

      onUpdatePanels(
        placedPanels.map((p) =>
          p.id === draggingRotationPanelId
            ? { ...p, rotation: customAngle, isValid }
            : p
        )
      )
      return
    }

    // Handle panel dragging with real-time snap-to-adjacent logic or manual freeform
    if (draggingPanelId !== null) {
      const currentPanel = placedPanels.find((p) => p.id === draggingPanelId)
      if (!currentPanel) return

      // Perspective Mode Panel Dragging
      if (isPerspectiveEnabled && perspectiveMetrics) {
        const flatPt = projectPoint(perspectiveMetrics.H_inv, canvasPt)
        const rawX = flatPt.x - dragOffset.x
        const rawY = flatPt.y - dragOffset.y

        const effectiveSnap = e.altKey ? !enableSnapping : !!enableSnapping
        let targetX = rawX
        let targetY = rawY
        let targetRot = currentPanel.rotation || 0

        if (effectiveSnap) {
          const gapPx = (interPanelGapMm / 1000) * scale.pixelsPerMeter
          const snapResult = getAdjacentSnapPosition(
            {
              id: currentPanel.id,
              x: rawX,
              y: rawY,
              width: currentPanel.width,
              height: currentPanel.height,
              rotation: currentPanel.rotation,
            },
            placedPanels,
            14 / viewport.zoom,
            gapPx
          )
          if (snapResult.snapped) {
            targetX = snapResult.x
            targetY = snapResult.y
            if (snapResult.matchedRotation !== undefined) {
              targetRot = snapResult.matchedRotation
            }
          }
        }

        const candidatePanel = {
          ...currentPanel,
          x: targetX,
          y: targetY,
          rotation: targetRot,
        }

        const corners = getPanelCorners(candidatePanel) as [Point, Point, Point, Point]
        const projQuad = projectPanelQuad(perspectiveMetrics.H, corners)
        const isValid = polygon.isClosed
          ? isQuadInsidePolygon(projQuad, polygon.points)
          : false

        onUpdatePanels(
          placedPanels.map((p) =>
            p.id === draggingPanelId
              ? { ...p, x: targetX, y: targetY, rotation: targetRot, isValid }
              : p
          )
        )
        return
      }

      // Flat 2D Mode Panel Dragging
      const rawX = canvasPt.x - dragOffset.x
      const rawY = canvasPt.y - dragOffset.y

      // Snapping condition: can be globally enabled/disabled, and holding Alt inverts it temporarily
      const effectiveSnap = e.altKey ? !enableSnapping : !!enableSnapping

      let targetX = rawX
      let targetY = rawY
      let targetRot = currentPanel.rotation || 0

      if (effectiveSnap) {
        const gapPx = (interPanelGapMm / 1000) * scale.pixelsPerMeter
        const snapResult = getAdjacentSnapPosition(
          {
            id: currentPanel.id,
            x: rawX,
            y: rawY,
            width: currentPanel.width,
            height: currentPanel.height,
            rotation: currentPanel.rotation,
          },
          placedPanels,
          14 / viewport.zoom, // threshold in screen coordinates
          gapPx
        )
        if (snapResult.snapped) {
          targetX = snapResult.x
          targetY = snapResult.y
          if (snapResult.matchedRotation !== undefined) {
            targetRot = snapResult.matchedRotation
          }
        }
      }

      const candidatePanel = {
        ...currentPanel,
        x: targetX,
        y: targetY,
        rotation: targetRot,
      }

      const isValid = polygon.isClosed
        ? isPanelInsidePolygon(candidatePanel, polygon.points)
        : false

      onUpdatePanels(
        placedPanels.map((p) =>
          p.id === draggingPanelId
            ? { ...p, x: targetX, y: targetY, rotation: targetRot, isValid }
            : p
        )
      )
    }
  }

  // Pointer Up (Release vertex, panel, rotation, or pan)
  const handlePointerUp = (e?: React.PointerEvent) => {
    if (e) {
      try {
        (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
      } catch (_) {}
    }
    setIsPanning(false)
    setDraggingVertexIdx(null)
    setDraggingPanelId(null)
    setDraggingRotationPanelId(null)
    setIsDraggingPolygon(false)
    setDraggingPerspectiveIdx(null)

    // Complete Rect tool drag
    if (activeTool === 'rect' && rectStart && cursorPos) {
      const minX = Math.min(rectStart.x, cursorPos.x)
      const maxX = Math.max(rectStart.x, cursorPos.x)
      const minY = Math.min(rectStart.y, cursorPos.y)
      const maxY = Math.max(rectStart.y, cursorPos.y)

      if (maxX - minX > 20 && maxY - minY > 20) {
        const newPoints = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ]
        const closedPoly: RoofPolygon = { points: newPoints, isClosed: true }
        onUpdatePolygon(closedPoly)
        onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
        if (onSelectTool) onSelectTool('select')
      }
      setRectStart(null)
    }
  }

  // Panel drag start
  const handlePanelPointerDown = (panel: PlacedPanel, e: React.PointerEvent) => {
    if (activeTool !== 'select') return
    e.stopPropagation()
    try {
      (e.currentTarget as Element)?.setPointerCapture(e.pointerId)
    } catch (_) {}
    setSelectedPanelId(panel.id)
    setDraggingPanelId(panel.id)
    const canvasPt = screenToCanvas(e.clientX, e.clientY)
    if (isPerspectiveEnabled && perspectiveMetrics) {
      const flatPt = projectPoint(perspectiveMetrics.H_inv, canvasPt)
      setDragOffset({
        x: flatPt.x - panel.x,
        y: flatPt.y - panel.y,
      })
    } else {
      setDragOffset({
        x: canvasPt.x - panel.x,
        y: canvasPt.y - panel.y,
      })
    }
  }

  // Rotate panel 90 degrees
  const handleRotatePanel = (panelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdatePanels(
      placedPanels.map((panel) => {
        if (panel.id !== panelId) return panel
        const newOrientation: PanelOrientation =
          panel.orientation === 'portrait' ? 'landscape' : 'portrait'
        const newWidth = panel.height
        const newHeight = panel.width
        const updated = {
          ...panel,
          orientation: newOrientation,
          width: newWidth,
          height: newHeight,
        }
        return {
          ...updated,
          isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
        }
      })
    )
  }

  // Incremental angle rotation (e.g. +/- 1° or +/- 15°)
  const handleRotatePanelBy = (panelId: string, delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onUpdatePanels(
      placedPanels.map((panel) => {
        if (panel.id !== panelId) return panel
        const newRotation = Math.round((((panel.rotation || 0) + delta) % 360 + 360) % 360)
        const updated = { ...panel, rotation: newRotation }
        return {
          ...updated,
          isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
        }
      })
    )
  }

  // Set exact custom angle on a panel
  const handleSetPanelRotation = (panelId: string, angle: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const normalized = Math.round((((angle % 360) + 360) % 360) * 10) / 10
    onUpdatePanels(
      placedPanels.map((panel) => {
        if (panel.id !== panelId) return panel
        const updated = { ...panel, rotation: normalized }
        return {
          ...updated,
          isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
        }
      })
    )
  }

  // Prompt user for custom angle entry
  const handlePromptCustomRotation = (panelId: string, currentAngle: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const input = prompt('Enter custom rotation angle in degrees (0° to 359°):', String(currentAngle || 0))
    if (input !== null) {
      const parsed = parseFloat(input)
      if (!isNaN(parsed)) {
        handleSetPanelRotation(panelId, parsed)
      }
    }
  }

  // Common rack pitch tilt angles
  const TILT_ANGLES = [0, 10, 15, 20, 25, 30]

  // Cycle mounting rack pitch tilt angle (0° -> 10° -> 15° -> 20° -> 25° -> 30° -> 0°)
  const handleCyclePanelTilt = (panelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onUpdatePanels(
      placedPanels.map((panel) => {
        if (panel.id !== panelId) return panel
        const currentTilt = panel.tiltAngle || 0
        const nextIdx = (TILT_ANGLES.indexOf(currentTilt) + 1) % TILT_ANGLES.length
        const newTilt = TILT_ANGLES[nextIdx]
        return {
          ...panel,
          tiltAngle: newTilt,
        }
      })
    )
  }

  // Delete single panel
  const handleDeletePanel = (panelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdatePanels(placedPanels.filter((p) => p.id !== panelId))
    if (selectedPanelId === panelId) setSelectedPanelId(null)
  }

  // Confirm Scale Calibration Dialog
  const handleConfirmScale = () => {
    if (!pendingScalePoints) return
    const parsedMeters = parseFloat(scaleDistanceInput)
    if (isNaN(parsedMeters) || parsedMeters <= 0) return

    const distPx = getDistance(pendingScalePoints.p1, pendingScalePoints.p2)
    const pxPerMeter = distPx / parsedMeters

    onUpdateScale({
      pointA: pendingScalePoints.p1,
      pointB: pendingScalePoints.p2,
      realWorldDistanceMeters: parsedMeters,
      pixelsPerMeter: pxPerMeter,
      isCalibrated: true,
    })

    // Resize existing panels to match calibrated physical dimensions
    const widthM = (orientation === 'portrait' ? panelDimensions.widthMm : panelDimensions.lengthMm) / 1000
    const heightM = (orientation === 'portrait' ? panelDimensions.lengthMm : panelDimensions.widthMm) / 1000
    const newPanelW = widthM * pxPerMeter
    const newPanelH = heightM * pxPerMeter

    onUpdatePanels(
      placedPanels.map((panel) => {
        const pW = panel.orientation === 'portrait' ? newPanelW : newPanelH
        const pH = panel.orientation === 'portrait' ? newPanelH : newPanelW
        const updated = { ...panel, width: pW, height: pH }
        return {
          ...updated,
          isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
        }
      })
    )

    setScaleModalOpen(false)
    setPendingScalePoints(null)
  }

  // Double-click to close active polygon
  const handleDoubleClick = () => {
    if (!polygon.isClosed && polygon.points.length >= 3) {
      const closedPoly = { ...polygon, isClosed: true }
      onUpdatePolygon(closedPoly)
      onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
      if (onSelectTool) onSelectTool('select')
    }
  }

  // Keyboard shortcut support (Delete / Backspace to delete selected panel, Space for pan, Enter to close polygon)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger tool shortcuts if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.code === 'Space') {
        isSpacePressedRef.current = true
      }
      if (e.key === 'r' || e.key === 'R') {
        if (onSelectTool) onSelectTool('rect')
      } else if (e.key === 'p' || e.key === 'P') {
        if (onSelectTool) onSelectTool('pen')
      } else if (e.key === 'v' || e.key === 'V') {
        if (onSelectTool) onSelectTool('select')
      } else if (e.key === 's' || e.key === 'S') {
        if (onSelectTool) onSelectTool('scale')
      } else if (e.key === 'h' || e.key === 'H') {
        if (onSelectTool) onSelectTool('pan')
      }
      if (e.key === 'Escape') {
        if (selectedPanelId) {
          setSelectedPanelId(null)
        } else if (scaleModalOpen) {
          setScaleModalOpen(false)
          setPendingScalePoints(null)
        } else if (scaleTempStart) {
          setScaleTempStart(null)
        } else if (rectStart) {
          setRectStart(null)
        } else if (activeTool === 'pen' && !polygon.isClosed) {
          onUpdatePolygon({ points: [], isClosed: false })
          if (onSelectTool) onSelectTool('select')
        }
      }
      if (e.key === 'Enter' && !polygon.isClosed && polygon.points.length >= 3) {
        const closedPoly = { ...polygon, isClosed: true }
        onUpdatePolygon(closedPoly)
        onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
        if (onSelectTool) onSelectTool('select')
      }
      if ((e.key === '[' || e.key === '<') && selectedPanelId) {
        handleRotatePanelBy(selectedPanelId, e.shiftKey ? -1 : -15)
      } else if ((e.key === ']' || e.key === '>') && selectedPanelId) {
        handleRotatePanelBy(selectedPanelId, e.shiftKey ? 1 : 15)
      } else if ((e.key === ',' || e.key === '{') && selectedPanelId) {
        handleRotatePanelBy(selectedPanelId, -1)
      } else if ((e.key === '.' || e.key === '}') && selectedPanelId) {
        handleRotatePanelBy(selectedPanelId, 1)
      } else if ((e.key === 't' || e.key === 'T') && selectedPanelId) {
        handleCyclePanelTilt(selectedPanelId)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPanelId) {
        onUpdatePanels(placedPanels.filter((p) => p.id !== selectedPanelId))
        setSelectedPanelId(null)
      } else if (e.key === 'Backspace' && activeTool === 'pen' && !polygon.isClosed && polygon.points.length > 0) {
        onUpdatePolygon({
          ...polygon,
          points: polygon.points.slice(0, -1),
        })
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedPanelId, placedPanels, onUpdatePanels, polygon, recheckAllPanelsValidity, onUpdatePolygon, onSelectTool, handleRotatePanelBy, handleCyclePanelTilt])

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      className="relative w-full h-full min-h-[480px] flex-1 bg-zinc-950 overflow-hidden select-none cursor-crosshair"
      style={{
        cursor:
          activeTool === 'pan' || isPanning
            ? 'grab'
            : activeTool === 'pen' || activeTool === 'rect' || activeTool === 'scale'
            ? 'crosshair'
            : isDraggingPolygon
            ? 'move'
            : 'default',
      }}
    >
      {/* Visual Canvas Transform Layer */}
      <div
        className="absolute inset-0 origin-top-left transition-transform duration-75"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          width: '3200px',
          height: '2400px',
        }}
      >
        {/* Background Image Layer with Strictly Clamped Opacity (0.20 to 0.80) */}
        {backgroundImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backgroundImageUrl}
            alt="Roof aerial background"
            className="absolute top-0 left-0 max-w-none pointer-events-none transition-opacity duration-150"
            style={{
              opacity: clampedOpacity,
            }}
          />
        ) : (
          /* Blueprint Grid Placeholder */
          <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] bg-zinc-950/90 flex flex-col items-center justify-center pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-3 p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl max-w-md text-center backdrop-blur-md">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Upload className="size-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Upload Roof Aerial / Satellite Photo</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Upload an overhead view (PNG, JPEG, or WEBP) to trace boundary planes and plan PV modules.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={onUploadImageClick}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 cursor-pointer mt-1"
              >
                <Upload className="size-3.5" />
                <span>Upload Roof Image</span>
              </Button>
            </div>
          </div>
        )}

        {/* DOM / SVG Overlay Engine */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible"
          style={{ width: '3200px', height: '2400px' }}
        >
          <defs>
            {/* Grid Pattern for Solar Cells */}
            <pattern id="solar-cell-pattern" width="8" height="12" patternUnits="userSpaceOnUse">
              <rect width="8" height="12" fill="none" stroke="#2563eb" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            {/* Invalid Red Stripe Pattern */}
            <pattern id="invalid-stripe" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="8" fill="rgba(239, 68, 68, 0.35)" />
            </pattern>
            {/* 3D Tilted Solar Panel Rack Elevation Gradient */}
            <linearGradient id="tilted-panel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.98" />
              <stop offset="30%" stopColor="#1e40af" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.90" />
            </linearGradient>
            {/* Standard Flat/Flush Panel Gradient */}
            <linearGradient id="standard-panel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#172554" stopOpacity="0.88" />
            </linearGradient>
          </defs>

          {/* Active Rect Tool Drag Preview */}
          {activeTool === 'rect' && rectStart && cursorPos && (
            <g className="roof-rect-drag-preview pointer-events-none">
              <rect
                x={Math.min(rectStart.x, cursorPos.x)}
                y={Math.min(rectStart.y, cursorPos.y)}
                width={Math.abs(cursorPos.x - rectStart.x)}
                height={Math.abs(cursorPos.y - rectStart.y)}
                fill="rgba(59, 130, 246, 0.22)"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeDasharray="6,4"
              />
              <g transform={`translate(${(rectStart.x + cursorPos.x) / 2}, ${(rectStart.y + cursorPos.y) / 2})`}>
                <rect x="-46" y="-12" width="92" height="24" rx="5" fill="#18181b" stroke="#3b82f6" strokeWidth="1" />
                <text x="0" y="4" fill="#60a5fa" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  {(Math.abs(cursorPos.x - rectStart.x) / scale.pixelsPerMeter).toFixed(1)}m × {(Math.abs(cursorPos.y - rectStart.y) / scale.pixelsPerMeter).toFixed(1)}m
                </text>
              </g>
            </g>
          )}

          {/* Traced Roof Polygon Layer */}
          {polygon.points.length > 0 && (
            <g className="roof-polygon-layer">
              {polygon.isClosed ? (
                /* Closed Polygon Boundary */
                <>
                  <polygon
                    points={polygon.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="rgba(37, 99, 235, 0.16)"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    className="filter drop-shadow-sm pointer-events-none"
                  />
                  {/* Explicit Center Move Handle in Select Mode (Only when UNLOCKED) */}
                  {activeTool === 'select' && !isRoofLocked && (
                    <g
                      transform={`translate(${getPolygonCentroid(polygon.points).x}, ${getPolygonCentroid(polygon.points).y})`}
                      className="cursor-move select-none"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        const canvasPt = screenToCanvas(e.clientX, e.clientY)
                        setIsDraggingPolygon(true)
                        setPolyDragStart(canvasPt)
                      }}
                    >
                      <rect x="-48" y="-12" width="96" height="24" rx="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" fillOpacity="0.95" className="filter drop-shadow-md" />
                      <text x="0" y="4" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
                        ✜ Move Roof
                      </text>
                    </g>
                  )}
                </>
              ) : (
                /* Active Drawing Path */
                <>
                  <polyline
                    points={polygon.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    strokeDasharray="5,5"
                  />
                  {/* Dynamic rubberband line to cursor */}
                  {cursorPos && polygon.points.length > 0 && activeTool === 'pen' && (
                    <line
                      x1={polygon.points[polygon.points.length - 1].x}
                      y1={polygon.points[polygon.points.length - 1].y}
                      x2={cursorPos.x}
                      y2={cursorPos.y}
                      stroke="#93c5fd"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  )}
                </>
              )}

              {/* Edge Dimension Labels */}
              {polygon.points.map((pt, idx) => {
                const nextPt =
                  polygon.isClosed || idx < polygon.points.length - 1
                    ? polygon.points[(idx + 1) % polygon.points.length]
                    : null
                if (!nextPt) return null

                const midX = (pt.x + nextPt.x) / 2
                const midY = (pt.y + nextPt.y) / 2
                const distM = getDistance(pt, nextPt) / scale.pixelsPerMeter

                return (
                  <g key={`edge-${idx}`} transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
                    <rect
                      x="-22"
                      y="-10"
                      width="44"
                      height="18"
                      rx="4"
                      fill="#18181b"
                      fillOpacity="0.85"
                      stroke="#3f3f46"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3"
                      fill="#e4e4e7"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {distM.toFixed(1)}m
                    </text>
                  </g>
                )
              })}

              {/* Polygon Vertices (Draggable handles) */}
              {polygon.points.map((pt, idx) => {
                const isFirst = idx === 0
                const isHovered = hoveredPointIdx === idx
                const canClose = !polygon.isClosed && isFirst && polygon.points.length >= 3

                // If roof is closed and locked, render non-interactive subtle corner markers
                if (polygon.isClosed && isRoofLocked) {
                  return (
                    <g key={`vertex-${idx}`} className="pointer-events-none">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={4}
                        fill="#3b82f6"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        opacity="0.8"
                      />
                    </g>
                  )
                }

                return (
                  <g
                    key={`vertex-${idx}`}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      if (canClose) {
                        const closedPoly = { ...polygon, isClosed: true }
                        onUpdatePolygon(closedPoly)
                        onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
                      } else {
                        setDraggingVertexIdx(idx)
                      }
                    }}
                    onPointerEnter={() => setHoveredPointIdx(idx)}
                    onPointerLeave={() => setHoveredPointIdx(null)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={canClose ? 9 : isHovered ? 8 : 6}
                      fill={canClose ? '#22c55e' : isHovered ? '#60a5fa' : '#3b82f6'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className={canClose ? 'animate-pulse' : ''}
                    />
                    {canClose && (
                      <text
                        x={pt.x + 14}
                        y={pt.y + 4}
                        fill="#4ade80"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="sans-serif"
                        className="filter drop-shadow-md"
                      >
                        Click to Close
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )}

          {/* Scale Calibration Reference Line */}
          {scale.pointA && scale.pointB && (
            <g className="scale-reference-layer pointer-events-none">
              <line
                x1={scale.pointA.x}
                y1={scale.pointA.y}
                x2={scale.pointB.x}
                y2={scale.pointB.y}
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="6,4"
              />
              <circle cx={scale.pointA.x} cy={scale.pointA.y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
              <circle cx={scale.pointB.x} cy={scale.pointB.y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
              <g
                transform={`translate(${(scale.pointA.x + scale.pointB.x) / 2}, ${
                  (scale.pointA.y + scale.pointB.y) / 2 - 14
                })`}
              >
                <rect x="-30" y="-10" width="60" height="18" rx="4" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
                <text x="0" y="3" fill="#fef3c7" fontSize="10" fontWeight="bold" textAnchor="middle">
                  {scale.realWorldDistanceMeters.toFixed(1)}m Ref
                </text>
              </g>
            </g>
          )}

          {/* Active Scale Drawing Rubberband Line */}
          {activeTool === 'scale' && scaleTempStart && cursorPos && (
            <g className="scale-active-rubberband pointer-events-none">
              <line
                x1={scaleTempStart.x}
                y1={scaleTempStart.y}
                x2={cursorPos.x}
                y2={cursorPos.y}
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
              <circle cx={scaleTempStart.x} cy={scaleTempStart.y} r="4" fill="#f59e0b" />
              <circle cx={cursorPos.x} cy={cursorPos.y} r="4" fill="#f59e0b" />
            </g>
          )}

          {/* Solar Array Placed Panels Layer */}
          <g className="placed-panels-layer">
            {placedPanels.map((panel) => {
              const isSelected = selectedPanelId === panel.id
              const isValid = panel.isValid
              const rot = panel.rotation || 0
              const tilt = panel.tiltAngle || 0

              if (isPerspectiveEnabled && perspectiveMetrics) {
                const flatCorners = getPanelCorners(panel) as [Point, Point, Point, Point]
                const quad = projectPanelQuad(perspectiveMetrics.H, flatCorners)
                const [p0, p1, p2, p3] = quad
                const quadPoints = `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`
                const centerPt = {
                  x: (p0.x + p1.x + p2.x + p3.x) / 4,
                  y: (p0.y + p1.y + p2.y + p3.y) / 4,
                }
                const topMid = {
                  x: (p0.x + p1.x) / 2,
                  y: (p0.y + p1.y) / 2,
                }

                // Solar cell internal grid lines in perspective
                const rad = ((rot || 0) * Math.PI) / 180
                const cos = Math.cos(rad)
                const sin = Math.sin(rad)
                const fcx = panel.x + panel.width / 2
                const fcy = panel.y + panel.height / 2
                const rotatePt = (px: number, py: number) => ({
                  x: fcx + (px - fcx) * cos - (py - fcy) * sin,
                  y: fcy + (px - fcx) * sin + (py - fcy) * cos,
                })

                const cellLines: { pA: Point; pB: Point }[] = []
                if (isValid && panel.width > 20 && panel.height > 20) {
                  for (let r = 1; r < 6; r++) {
                    const flatA = rotatePt(panel.x, panel.y + (r * panel.height) / 6)
                    const flatB = rotatePt(panel.x + panel.width, panel.y + (r * panel.height) / 6)
                    cellLines.push({
                      pA: projectPoint(perspectiveMetrics.H, flatA),
                      pB: projectPoint(perspectiveMetrics.H, flatB),
                    })
                  }
                  const midFlatA = rotatePt(panel.x + panel.width / 2, panel.y)
                  const midFlatB = rotatePt(panel.x + panel.width / 2, panel.y + panel.height)
                  cellLines.push({
                    pA: projectPoint(perspectiveMetrics.H, midFlatA),
                    pB: projectPoint(perspectiveMetrics.H, midFlatB),
                  })
                }

                return (
                  <g
                    key={panel.id}
                    onPointerDown={(e) => handlePanelPointerDown(panel, e)}
                    onPointerUp={(e) => {
                      try {
                        (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
                      } catch (_) {}
                      setDraggingPanelId(null)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPanelId(panel.id)
                    }}
                    className="cursor-move group"
                  >
                    {/* Warped Panel Polygon */}
                    <polygon
                      points={quadPoints}
                      fill={
                        isValid
                          ? isSelected
                            ? 'rgba(30, 58, 138, 0.96)'
                            : 'rgba(23, 37, 84, 0.92)'
                          : 'rgba(239, 68, 68, 0.55)'
                      }
                      stroke={
                        isValid
                          ? isSelected
                            ? '#38bdf8'
                            : '#60a5fa'
                          : '#ef4444'
                      }
                      strokeWidth={isSelected ? 2.5 : isValid ? 1.5 : 2.5}
                      strokeLinejoin="round"
                      className="transition-colors duration-100"
                    />

                    {/* Perspective Cell Grid Texture */}
                    {isValid &&
                      cellLines.map((line, lIdx) => (
                        <line
                          key={lIdx}
                          x1={line.pA.x}
                          y1={line.pA.y}
                          x2={line.pB.x}
                          y2={line.pB.y}
                          stroke="rgba(96, 165, 250, 0.45)"
                          strokeWidth="0.75"
                          pointerEvents="none"
                        />
                      ))}

                    {/* Invalid Stripe / Warning Mark */}
                    {!isValid && (
                      <g transform={`translate(${centerPt.x}, ${centerPt.y})`} pointerEvents="none">
                        <circle r="10" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        <text x="0" y="4" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">
                          !
                        </text>
                      </g>
                    )}

                    {/* Wattage / ID & Rotation Label */}
                    {isValid && (
                      <text
                        x={centerPt.x}
                        y={centerPt.y + 3}
                        fill="#93c5fd"
                        fontSize="9"
                        fontWeight="600"
                        fontFamily="monospace"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {panelDimensions.wattage}W{rot !== 0 ? ` • ${rot}°` : ''}
                      </text>
                    )}

                    {/* Selection Ring & Floating Quick Actions */}
                    {isSelected && (
                      <g className="panel-actions-overlay">
                        {/* Interactive CAD Rotation Stem & Handle */}
                        <line
                          x1={topMid.x}
                          y1={topMid.y}
                          x2={topMid.x}
                          y2={topMid.y - 18}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="2,2"
                          pointerEvents="none"
                        />
                        <g
                          transform={`translate(${topMid.x}, ${topMid.y - 20})`}
                          className="cursor-crosshair group/handle"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            try {
                              (e.currentTarget as Element)?.setPointerCapture(e.pointerId)
                            } catch (_) {}
                            setDraggingRotationPanelId(panel.id)
                          }}
                          onPointerUp={(e) => {
                            try {
                              (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
                            } catch (_) {}
                            setDraggingRotationPanelId(null)
                          }}
                        >
                          <circle
                            r="7"
                            fill="#0284c7"
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="hover:scale-125 transition-transform"
                          />
                          <path
                            d="M -2 -1 A 3 3 0 1 1 -2 2"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="1"
                            pointerEvents="none"
                          />
                          {(draggingRotationPanelId === panel.id || rot !== 0) && (
                            <g
                              transform="translate(12, -1)"
                              className="cursor-pointer hover:opacity-90"
                              onClick={(e) => handlePromptCustomRotation(panel.id, rot, e)}
                              role="button"
                              aria-label={`Current rotation: ${rot} degrees. Click to enter custom angle.`}
                            >
                              <title>Current rotation: {rot}°. Click to enter custom degree angle.</title>
                              <rect x="-2" y="-8" width="36" height="15" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
                              <text x="16" y="3" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                {rot}°
                              </text>
                            </g>
                          )}
                        </g>

                        {/* Floating Quick Action Toolbar: Fine -1°, Custom Degree, Fine +1°, 90°, Rack Tilt, Delete */}
                        <g
                          transform={`translate(${topMid.x - 105}, ${topMid.y - 50})`}
                          className="cursor-pointer select-none"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <rect
                            x="0"
                            y="0"
                            width="210"
                            height="24"
                            rx="6"
                            fill="#18181b"
                            stroke="#3f3f46"
                            strokeWidth="1"
                            className="filter drop-shadow-lg"
                          />

                          {/* Fine Rotate -1° */}
                          <g
                            onClick={(e) => handleRotatePanelBy(panel.id, -1, e)}
                            className="hover:opacity-80"
                            role="button"
                            aria-label="Rotate -1 degree"
                          >
                            <title>Fine Rotate -1° (Shift+[ or ,)</title>
                            <rect x="2" y="2" width="22" height="20" rx="3" fill="transparent" />
                            <text x="13" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              -1°
                            </text>
                          </g>

                          {/* Custom Degree Readout Button (Click to Enter Any Angle) */}
                          <g
                            onClick={(e) => handlePromptCustomRotation(panel.id, rot, e)}
                            className="hover:opacity-80"
                            role="button"
                            aria-label="Set custom rotation angle"
                          >
                            <title>Current rotation: {rot}°. Click to type any custom angle!</title>
                            <rect x="26" y="2" width="38" height="20" rx="3" fill="#0369a1" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="0.75" />
                            <text x="45" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              {rot}°
                            </text>
                          </g>

                          {/* Fine Rotate +1° */}
                          <g
                            onClick={(e) => handleRotatePanelBy(panel.id, 1, e)}
                            className="hover:opacity-80"
                            role="button"
                            aria-label="Rotate +1 degree"
                          >
                            <title>Fine Rotate +1° (Shift+] or .)</title>
                            <rect x="66" y="2" width="22" height="20" rx="3" fill="transparent" />
                            <text x="77" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              +1°
                            </text>
                          </g>

                          <line x1="90" y1="4" x2="90" y2="20" stroke="#27272a" strokeWidth="1" />

                          {/* Rotate 90° Orientation */}
                          <g
                            onClick={(e) => handleRotatePanel(panel.id, e)}
                            className="hover:opacity-80"
                            role="button"
                            aria-label="Rotate 90 degrees"
                          >
                            <title>Rotate 90° Orientation</title>
                            <rect x="92" y="2" width="24" height="20" rx="3" fill="transparent" />
                            <path
                              d="M 104 8 A 4 4 0 1 1 100 12 M 100 9 L 100 12 L 103 12"
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="1.5"
                            />
                          </g>

                          <line x1="118" y1="4" x2="118" y2="20" stroke="#27272a" strokeWidth="1" />

                          {/* Rack Tilt Cycler */}
                          <g
                            onClick={(e) => handleCyclePanelTilt(panel.id, e)}
                            className="hover:opacity-80"
                            role="button"
                            aria-label="Cycle mounting rack tilt"
                          >
                            <title>Cycle Rack Tilt Pitch (0°, 10°, 15°, 20°, 25°, 30° / T)</title>
                            <rect x="120" y="2" width="42" height="20" rx="3" fill="transparent" />
                            <text x="141" y="15" fill="#a855f7" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                              ∠{tilt}°
                            </text>
                          </g>

                          <line x1="164" y1="4" x2="164" y2="20" stroke="#27272a" strokeWidth="1" />

                          {/* Delete */}
                          <g
                            onClick={(e) => handleDeletePanel(panel.id, e)}
                            className="hover:opacity-80"
                            role="button"
                            aria-label="Delete panel"
                          >
                            <title>Delete panel (Del)</title>
                            <rect x="166" y="2" width="40" height="20" rx="3" fill="transparent" />
                            <path
                              d="M 181 7 L 191 17 M 191 7 L 181 17"
                              fill="none"
                              stroke="#f87171"
                              strokeWidth="1.5"
                            />
                          </g>
                        </g>
                      </g>
                    )}
                  </g>
                )
              }

              return (
                <g
                  key={panel.id}
                  transform={`translate(${panel.x}, ${panel.y}) rotate(${rot}, ${panel.width / 2}, ${panel.height / 2})`}
                  onPointerDown={(e) => handlePanelPointerDown(panel, e)}
                  onPointerUp={(e) => {
                    try {
                      (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
                    } catch (_) {}
                    setDraggingPanelId(null)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedPanelId(panel.id)
                  }}
                  className="cursor-move group"
                >
                  {/* 3D Elevated Racking Standoff Legs when tilt > 0 */}
                  {tilt > 0 && isValid && (
                    <g className="rack-standoff-elevation pointer-events-none">
                      {/* Top mounting rail / bracket line */}
                      <rect
                        x="2"
                        y="-4"
                        width={Math.max(0, panel.width - 4)}
                        height="4"
                        rx="1"
                        fill="#475569"
                        stroke="#64748b"
                        strokeWidth="0.75"
                      />
                      {/* Left & Right Elevated Standoff Bracket Feet */}
                      <rect x="4" y="-7" width="5" height="7" rx="1" fill="#334155" stroke="#64748b" strokeWidth="0.5" />
                      <rect x={Math.max(10, panel.width - 9)} y="-7" width="5" height="7" rx="1" fill="#334155" stroke="#64748b" strokeWidth="0.5" />
                      {/* Shadow underneath elevated side */}
                      <rect
                        x="0"
                        y="0"
                        width={panel.width}
                        height="3"
                        fill="rgba(0,0,0,0.4)"
                      />
                    </g>
                  )}

                  {/* Panel Background Rectangle */}
                  <rect
                    width={panel.width}
                    height={panel.height}
                    rx="2"
                    fill={
                      isValid
                        ? tilt > 0
                          ? 'url(#tilted-panel-grad)'
                          : 'url(#standard-panel-grad)'
                        : 'rgba(239, 68, 68, 0.50)'
                    }
                    stroke={
                      isValid
                        ? isSelected
                          ? '#38bdf8'
                          : '#60a5fa'
                        : '#ef4444'
                    }
                    strokeWidth={isSelected ? '2.5' : isValid ? '1.5' : '2.5'}
                    className="transition-colors duration-100"
                  />

                  {/* Silicon Cells Grid Graphic Texture */}
                  {isValid && (
                    <rect
                      x="1"
                      y="1"
                      width={Math.max(0, panel.width - 2)}
                      height={Math.max(0, panel.height - 2)}
                      fill="url(#solar-cell-pattern)"
                      pointerEvents="none"
                    />
                  )}

                  {/* Invalid Boundary Flag Striping & Indicator */}
                  {!isValid && (
                    <>
                      <rect
                        width={panel.width}
                        height={panel.height}
                        fill="url(#invalid-stripe)"
                        pointerEvents="none"
                      />
                      <g transform={`translate(${panel.width / 2}, ${panel.height / 2})`} pointerEvents="none">
                        <circle r="10" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        <text x="0" y="4" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">
                          !
                        </text>
                      </g>
                    </>
                  )}

                  {/* Tilt Angle Badge (Top Right Corner) */}
                  {tilt > 0 && isValid && panel.width >= 36 && (
                    <g transform={`translate(${panel.width - 34}, 3)`} pointerEvents="none">
                      <rect width="31" height="13" rx="3" fill="rgba(2, 132, 199, 0.92)" stroke="#38bdf8" strokeWidth="0.6" />
                      <text x="15.5" y="9.5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                        ∠{tilt}°
                      </text>
                    </g>
                  )}

                  {/* Wattage / ID & Rotation Label */}
                  {panel.width > 24 && panel.height > 20 && (
                    <text
                      x="4"
                      y={panel.height - 4}
                      fill={isValid ? '#93c5fd' : '#fee2e2'}
                      fontSize="9"
                      fontWeight="600"
                      fontFamily="monospace"
                      pointerEvents="none"
                    >
                      {panelDimensions.wattage}W{rot !== 0 ? ` • ${rot}°` : ''}
                    </text>
                  )}

                  {/* Selection Ring & Floating Quick Actions */}
                  {isSelected && (
                    <g className="panel-actions-overlay">
                      {/* Interactive CAD Rotation Stem & Handle */}
                      <line
                        x1={panel.width / 2}
                        y1={0}
                        x2={panel.width / 2}
                        y2={-20}
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="2,2"
                        pointerEvents="none"
                      />
                      <g
                        transform={`translate(${panel.width / 2}, -22)`}
                        className="cursor-crosshair group/handle"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          try {
                            (e.currentTarget as Element)?.setPointerCapture(e.pointerId)
                          } catch (_) {}
                          setDraggingRotationPanelId(panel.id)
                        }}
                        onPointerUp={(e) => {
                          try {
                            (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
                          } catch (_) {}
                          setDraggingRotationPanelId(null)
                        }}
                      >
                        <circle
                          r="7"
                          fill="#0284c7"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="hover:scale-125 transition-transform"
                        />
                        <path
                          d="M -2 -1 A 3 3 0 1 1 -2 2"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1"
                          pointerEvents="none"
                        />
                        {/* Rotation Angle Readout Bubble - Clickable for custom degree entry */}
                        {(draggingRotationPanelId === panel.id || rot !== 0) && (
                          <g
                            transform="translate(12, -1)"
                            className="cursor-pointer hover:opacity-90"
                            onClick={(e) => handlePromptCustomRotation(panel.id, rot, e)}
                            role="button"
                            aria-label={`Current rotation: ${rot} degrees. Click to enter custom angle.`}
                          >
                            <title>Current rotation: {rot}°. Click to enter custom degree angle.</title>
                            <rect x="-2" y="-8" width="36" height="15" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
                            <text x="16" y="3" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              {rot}°
                            </text>
                          </g>
                        )}
                      </g>

                      {/* Floating Quick Action Toolbar: Fine -1°, Custom Degree, Fine +1°, 90°, Rack Tilt, Delete */}
                      <g
                        transform={`translate(${panel.width / 2 - 105}, -52)`}
                        className="cursor-pointer select-none"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <rect
                          x="0"
                          y="0"
                          width="210"
                          height="24"
                          rx="6"
                          fill="#18181b"
                          stroke="#3f3f46"
                          strokeWidth="1"
                          className="filter drop-shadow-lg"
                        />

                        {/* Fine Rotate -1° */}
                        <g
                          onClick={(e) => handleRotatePanelBy(panel.id, -1, e)}
                          className="hover:opacity-80"
                          role="button"
                          aria-label="Rotate -1 degree"
                        >
                          <title>Fine Rotate -1° (Shift+[ or ,)</title>
                          <rect x="2" y="2" width="22" height="20" rx="3" fill="transparent" />
                          <text x="13" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            -1°
                          </text>
                        </g>

                        {/* Custom Degree Readout Button (Click to Enter Any Angle) */}
                        <g
                          onClick={(e) => handlePromptCustomRotation(panel.id, rot, e)}
                          className="hover:opacity-80"
                          role="button"
                          aria-label="Set custom rotation angle"
                        >
                          <title>Current rotation: {rot}°. Click to type any custom angle!</title>
                          <rect x="26" y="2" width="38" height="20" rx="3" fill="#0369a1" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="0.75" />
                          <text x="45" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            {rot}°
                          </text>
                        </g>

                        {/* Fine Rotate +1° */}
                        <g
                          onClick={(e) => handleRotatePanelBy(panel.id, 1, e)}
                          className="hover:opacity-80"
                          role="button"
                          aria-label="Rotate +1 degree"
                        >
                          <title>Fine Rotate +1° (Shift+] or .)</title>
                          <rect x="66" y="2" width="22" height="20" rx="3" fill="transparent" />
                          <text x="77" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            +1°
                          </text>
                        </g>

                        <line x1="90" y1="4" x2="90" y2="20" stroke="#27272a" strokeWidth="1" />

                        {/* Rotate 90° Orientation */}
                        <g
                          onClick={(e) => handleRotatePanel(panel.id, e)}
                          className="hover:opacity-80"
                          role="button"
                          aria-label="Rotate 90 degrees"
                        >
                          <title>Rotate 90° Orientation</title>
                          <rect x="92" y="2" width="24" height="20" rx="3" fill="transparent" />
                          <path
                            d="M 104 8 A 4 4 0 1 1 100 12 M 100 9 L 100 12 L 103 12"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                          />
                        </g>

                        <line x1="118" y1="4" x2="118" y2="20" stroke="#27272a" strokeWidth="1" />

                        {/* Rack Tilt Cycler */}
                        <g
                          onClick={(e) => handleCyclePanelTilt(panel.id, e)}
                          className="hover:opacity-80"
                          role="button"
                          aria-label="Cycle mounting rack tilt"
                        >
                          <title>Cycle Rack Tilt Pitch (0°, 10°, 15°, 20°, 25°, 30° / T)</title>
                          <rect x="120" y="2" width="42" height="20" rx="3" fill="transparent" />
                          <text x="141" y="15" fill="#a855f7" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                            ∠{tilt}°
                          </text>
                        </g>

                        <line x1="164" y1="4" x2="164" y2="20" stroke="#27272a" strokeWidth="1" />

                        {/* Delete */}
                        <g
                          onClick={(e) => handleDeletePanel(panel.id, e)}
                          className="hover:opacity-80"
                          role="button"
                          aria-label="Delete panel"
                        >
                          <title>Delete panel (Del)</title>
                          <rect x="166" y="2" width="40" height="20" rx="3" fill="transparent" />
                          <path
                            d="M 181 7 L 191 17 M 191 7 L 181 17"
                            fill="none"
                            stroke="#f87171"
                            strokeWidth="1.5"
                          />
                        </g>
                      </g>
                    </g>
                  )}
                </g>
              )
            })}
          </g>

          {/* Perspective Plane Control Layer (4 Draggable Corner Handles + Pitch Vanishing Grid) */}
          {isPerspectiveEnabled && perspectiveQuad && (
            <g className="perspective-plane-control-layer">
              {/* 4-Point Plane Boundary */}
              <polygon
                points={perspectiveQuad.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(6, 182, 212, 0.05)"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeDasharray="6,4"
                className="pointer-events-none"
              />

              {/* Pitch Vanishing Guide Lines (25%, 50%, 75% between top edge and bottom edge) */}
              {[0.25, 0.5, 0.75].map((ratio, rIdx) => {
                const topPt = {
                  x: perspectiveQuad[0].x + (perspectiveQuad[1].x - perspectiveQuad[0].x) * ratio,
                  y: perspectiveQuad[0].y + (perspectiveQuad[1].y - perspectiveQuad[0].y) * ratio,
                }
                const botPt = {
                  x: perspectiveQuad[3].x + (perspectiveQuad[2].x - perspectiveQuad[3].x) * ratio,
                  y: perspectiveQuad[3].y + (perspectiveQuad[2].y - perspectiveQuad[3].y) * ratio,
                }
                return (
                  <line
                    key={`p-guide-${rIdx}`}
                    x1={topPt.x}
                    y1={topPt.y}
                    x2={botPt.x}
                    y2={botPt.y}
                    stroke="#06b6d4"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    strokeOpacity="0.4"
                    className="pointer-events-none"
                  />
                )
              })}

              {/* Draggable Corner Handles */}
              {perspectiveQuad.map((pt, pIdx) => {
                const labels = ['TL (Ridge)', 'TR (Ridge)', 'BR (Eave)', 'BL (Eave)']
                const isDragging = draggingPerspectiveIdx === pIdx
                return (
                  <g
                    key={`persp-handle-${pIdx}`}
                    transform={`translate(${pt.x}, ${pt.y})`}
                    className="cursor-pointer select-none"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      try {
                        (e.currentTarget as Element)?.setPointerCapture(e.pointerId)
                      } catch (_) {}
                      setDraggingPerspectiveIdx(pIdx)
                    }}
                    onPointerUp={(e) => {
                      try {
                        (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
                      } catch (_) {}
                      setDraggingPerspectiveIdx(null)
                    }}
                  >
                    {/* Touch / Hit Target Area */}
                    <circle r="14" fill="transparent" />
                    {/* Glow Ring */}
                    <circle
                      r={isDragging ? 11 : 9}
                      fill="rgba(6, 182, 212, 0.25)"
                      stroke="#06b6d4"
                      strokeWidth="1"
                    />
                    {/* Center Handle Knob */}
                    <circle
                      r="5"
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="transition-transform hover:scale-125"
                    />
                    {/* Handle Position Badge */}
                    <g transform="translate(10, -10)" pointerEvents="none">
                      <rect
                        x="-2"
                        y="-8"
                        width="54"
                        height="14"
                        rx="3"
                        fill="#083344"
                        stroke="#06b6d4"
                        strokeWidth="0.8"
                        fillOpacity="0.9"
                      />
                      <text
                        x="25"
                        y="2.5"
                        fill="#67e8f9"
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {labels[pIdx]}
                      </text>
                    </g>
                  </g>
                )
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Scale Calibration Reference Modal */}
      {scaleModalOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Set Reference Scale</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Enter the real-world physical distance between the two points you selected in meters.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Known Length (Meters):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="100"
                  value={scaleDistanceInput}
                  onChange={(e) => setScaleDistanceInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-md bg-input/40 border border-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <span className="text-xs font-semibold text-muted-foreground">m</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setScaleModalOpen(false)
                  setPendingScalePoints(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleConfirmScale}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Apply Calibration
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Viewport status HUD badge (Bottom-left) */}
      <div className="absolute bottom-3 left-3 bg-zinc-900/85 backdrop-blur-sm border border-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-3 shadow-lg">
        <div>
          Tool:{' '}
          <span className="text-zinc-100 font-semibold uppercase">
            {activeTool}
          </span>
        </div>
        <div className="w-px h-3 bg-zinc-700" />
        <div>
          Scale:{' '}
          <span className="text-amber-400 font-semibold">
            {scale.isCalibrated ? `${scale.pixelsPerMeter.toFixed(1)} px/m` : 'Default (50 px/m)'}
          </span>
        </div>
        <div className="w-px h-3 bg-zinc-700" />
        {onToggleSnapping ? (
          <button
            type="button"
            onClick={onToggleSnapping}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
            title="Click to toggle Magnet Snapping (or hold Alt while dragging)"
          >
            <span>Snap:</span>
            <span className={cn('font-semibold', enableSnapping ? 'text-blue-400' : 'text-amber-300')}>
              {enableSnapping ? 'ON (20mm)' : 'OFF (Manual)'}
            </span>
          </button>
        ) : (
          <div>
            Snap:{' '}
            <span className={cn('font-semibold', enableSnapping ? 'text-blue-400' : 'text-amber-300')}>
              {enableSnapping ? 'ON' : 'OFF'}
            </span>
          </div>
        )}
        <div className="w-px h-3 bg-zinc-700" />
        {onToggleRoofLock ? (
          <button
            type="button"
            onClick={onToggleRoofLock}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
            title="Click to toggle roof lock (prevent moving roof while dragging panels)"
          >
            <span>Roof:</span>
            <span className={cn('font-semibold', isRoofLocked ? 'text-emerald-400' : 'text-amber-400')}>
              {isRoofLocked ? 'Locked 🔒' : 'Unlocked 🔓'}
            </span>
          </button>
        ) : (
          <div>
            Roof:{' '}
            <span className={cn('font-semibold', isRoofLocked ? 'text-emerald-400' : 'text-amber-400')}>
              {isRoofLocked ? 'Locked 🔒' : 'Unlocked 🔓'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
