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
  rotateSinglePanel,
  rotatePanelsAsArray,
} from '@/utils/geometry'
import {
  Quad,
  getSelectionBounds,
  warpPanelsWithQuad,
  applyPresetPerspectiveToPanels,
  isQuadInsidePolygon,
} from '@/utils/homography'
import { Button } from '@/components/ui/button'
import {
  AlertCircle,
  RotateCw,
  Trash2,
  Upload,
  Move,
  Check,
  Layers,
  Plus,
  Box,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
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
  selectedPanelIds?: string[]
  onSelectPanels?: (ids: string[]) => void
  onGroupSelected?: () => void
  onUngroupSelected?: () => void
  onDuplicateSelected?: () => void
  onApplyPerspectivePreset?: (preset: 'pitch-up' | 'pitch-down' | 'pitch-left' | 'pitch-right' | 'reset') => void
  onRotateSelected?: (delta: number) => void
  onRotateAllPanels?: (delta: number) => void
  onSetSelectedRotation?: (rotation: number) => void
  hideStatusHud?: boolean
  onSnapshotBeforeChange?: () => void
  onUndo?: () => void
  onRedo?: () => void
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
  selectedPanelIds: propSelectedPanelIds,
  onSelectPanels,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateSelected,
  onApplyPerspectivePreset,
  onRotateSelected,
  onRotateAllPanels,
  onSetSelectedRotation,
  hideStatusHud = false,
  onSnapshotBeforeChange,
  onUndo,
  onRedo,
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

  // Multi-Selection state
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([])
  const selectedPanelIds = useMemo(() => {
    if (propSelectedPanelIds !== undefined) return propSelectedPanelIds
    if (propSelectedPanelId) return [propSelectedPanelId]
    return internalSelectedIds
  }, [propSelectedPanelIds, propSelectedPanelId, internalSelectedIds])

  const setSelectedPanelIds = useCallback(
    (ids: string[]) => {
      setInternalSelectedIds(ids)
      if (onSelectPanels) {
        onSelectPanels(ids)
      } else if (onSelectPanel) {
        onSelectPanel(ids[0] || null)
      }
    },
    [onSelectPanels, onSelectPanel]
  )

  const selectedPanelId = selectedPanelIds[0] || null

  // Click vs drag candidate tracking for panels
  const panelClickCandidateRef = useRef<{ panel: PlacedPanel; isModifier: boolean; startPt: Point } | null>(null)

  // Marquee selection box state
  const [marqueeBox, setMarqueeBox] = useState<{ start: Point; current: Point } | null>(null)

  // Multi-panel drag state
  const [isDraggingPanels, setIsDraggingPanels] = useState(false)
  const dragStartPointerRef = useRef<Point>({ x: 0, y: 0 })
  const draggedPanelsInitialRef = useRef<
    { id: string; x: number; y: number; customQuad?: [Point, Point, Point, Point] }[]
  >([])

  // Rotation dragging state (manual CAD handle & live rotation)
  const [draggingRotationPanelId, setDraggingRotationPanelId] = useState<string | null>(null)
  const [isDraggingRotation, setIsDraggingRotation] = useState(false)
  const [liveRotationAngle, setLiveRotationAngle] = useState<number | null>(null)
  const rotationDragInitialRef = useRef<{
    centroid: Point
    startPointerAngle: number
    panels: PlacedPanel[]
    selectedIds: string[]
  } | null>(null)

  // 3D Perspective corner pin dragging state for selection transform box
  const [draggingPerspectivePinIndex, setDraggingPerspectivePinIndex] = useState<number | null>(null)
  const perspectivePinDragStartRef = useRef<{
    initialQuad: [Point, Point, Point, Point]
    initialPanels: PlacedPanel[]
  } | null>(null)

  // Panning state
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 })
  const isSpacePressedRef = useRef(false)

  // Rect Tool & Whole Polygon Drag State
  const [rectStart, setRectStart] = useState<Point | null>(null)
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false)
  const [polyDragStart, setPolyDragStart] = useState<Point>({ x: 0, y: 0 })

  // Scale calibration interaction state
  const [scaleTempStart, setScaleTempStart] = useState<Point | null>(null)
  const [scaleModalOpen, setScaleModalOpen] = useState(false)
  const [scaleDistanceInput, setScaleDistanceInput] = useState('5.0')
  const [pendingScalePoints, setPendingScalePoints] = useState<{ p1: Point; p2: Point } | null>(null)

  // Selected Panels array
  const selectedPanels = useMemo(
    () => placedPanels.filter((p) => selectedPanelIds.includes(p.id)),
    [placedPanels, selectedPanelIds]
  )

  // Check if selected panels are currently grouped
  const isSelectionGrouped = useMemo(() => {
    if (selectedPanels.length < 2) return false
    const g0 = selectedPanels[0].groupId
    return !!g0 && selectedPanels.every((p) => p.groupId === g0)
  }, [selectedPanels])

  // Selection bounding box / quad for 3D Perspective Transform Box
  const selectionBounds = useMemo(() => {
    if (selectedPanels.length === 0) return null
    return getSelectionBounds(selectedPanels)
  }, [selectedPanels])

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
      return panels.map((panel) => {
        if (panel.customQuad) {
          return {
            ...panel,
            isValid: isQuadInsidePolygon(panel.customQuad, currentPolygon.points),
          }
        }
        return {
          ...panel,
          isValid: isPanelInsidePolygon(panel, currentPolygon.points),
        }
      })
    },
    []
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

  // Pointer Down (Pen click, Vertex drag, Marquee selection, Scale measurement, or Pan)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary button clicks
    if (e.button !== 0) return

    const canvasPt = screenToCanvas(e.clientX, e.clientY)

    // Mode: Pan
    if (activeTool === 'pan' || e.shiftKey && e.altKey || isSpacePressedRef.current) {
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
      const snapRadius = 24 / viewport.zoom

      if (polygon.isClosed) {
        if (isRoofLocked) {
          alert('Roof boundary is locked. Click "Unlock" in the toolbar to redraw or modify the roof boundary.')
          return
        }
        if (polygon.points.length >= 3) {
          const ok = window.confirm('Start drawing a new roof boundary? This will replace the current boundary.')
          if (!ok) return
        }
        onSnapshotBeforeChange?.()
        onUpdatePolygon({ points: [canvasPt], isClosed: false })
        return
      }

      // If clicking near first point, close the polygon
      if (polygon.points.length >= 3) {
        const firstPoint = polygon.points[0]
        if (getDistance(canvasPt, firstPoint) <= snapRadius) {
          onSnapshotBeforeChange?.()
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

    // Default Select Mode: Clicking empty canvas starts Marquee Selection
    if (activeTool === 'select') {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        setSelectedPanelIds([])
      }
      setMarqueeBox({ start: canvasPt, current: canvasPt })
    }
  }

  // Pointer Move (Tracking, vertex dragging, multi-panel dragging, marquee, 3D perspective pin dragging)
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

      const updatedPanels = placedPanels.map((p) => {
        let newCustomQuad = p.customQuad
        if (p.customQuad) {
          newCustomQuad = [
            { x: p.customQuad[0].x + dx, y: p.customQuad[0].y + dy },
            { x: p.customQuad[1].x + dx, y: p.customQuad[1].y + dy },
            { x: p.customQuad[2].x + dx, y: p.customQuad[2].y + dy },
            { x: p.customQuad[3].x + dx, y: p.customQuad[3].y + dy },
          ]
        }
        return {
          ...p,
          x: p.x + dx,
          y: p.y + dy,
          customQuad: newCustomQuad,
        }
      })
      onUpdatePanels(recheckAllPanelsValidity(updatedPoly, updatedPanels))
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

    // Handle Marquee Box dragging
    if (marqueeBox) {
      setMarqueeBox((prev) => (prev ? { ...prev, current: canvasPt } : null))
      return
    }

    // Handle 3D Perspective Corner Pin Dragging (Resizing/warping selection in 3D perspective!)
    if (draggingPerspectivePinIndex !== null && perspectivePinDragStartRef.current) {
      const { initialQuad, initialPanels } = perspectivePinDragStartRef.current
      const targetQuad: [Point, Point, Point, Point] = [
        { ...initialQuad[0] },
        { ...initialQuad[1] },
        { ...initialQuad[2] },
        { ...initialQuad[3] },
      ]
      targetQuad[draggingPerspectivePinIndex] = {
        x: Math.round(canvasPt.x),
        y: Math.round(canvasPt.y),
      }

      const warpedSelected = warpPanelsWithQuad(initialPanels, initialQuad, targetQuad)
      const warpedMap = new Map<string, PlacedPanel>()
      warpedSelected.forEach((p) => {
        const isValid = polygon.isClosed
          ? p.customQuad
            ? isQuadInsidePolygon(p.customQuad, polygon.points)
            : isPanelInsidePolygon(p, polygon.points)
          : false
        warpedMap.set(p.id, { ...p, isValid })
      })

      onUpdatePanels(
        placedPanels.map((p) => (warpedMap.has(p.id) ? warpedMap.get(p.id)! : p))
      )
      return
    }

    // Handle manual CAD rotation dragging (single or multi-panel selection)
    if ((isDraggingRotation || draggingRotationPanelId !== null) && rotationDragInitialRef.current) {
      const { centroid, startPointerAngle, panels, selectedIds } = rotationDragInitialRef.current
      const currentPointerAngle = Math.atan2(canvasPt.y - centroid.y, canvasPt.x - centroid.x)
      let deltaDeg = ((currentPointerAngle - startPointerAngle) * 180) / Math.PI

      const effectiveSnap = e.shiftKey || (enableSnapping && !e.altKey)
      if (effectiveSnap) {
        deltaDeg = Math.round(deltaDeg / 15) * 15
      } else {
        deltaDeg = Math.round(deltaDeg * 10) / 10
      }

      const selectedIdSet = new Set(selectedIds)
      const selectedPanelsInitial = panels.filter((p) => selectedIdSet.has(p.id))

      let rotatedSelected: PlacedPanel[]
      if (selectedPanelsInitial.length === 1) {
        const single = selectedPanelsInitial[0]
        const singleCenter = {
          x: single.x + single.width / 2,
          y: single.y + single.height / 2,
        }
        rotatedSelected = [
          rotateSinglePanel(single, deltaDeg, singleCenter, polygon.points),
        ]
        setLiveRotationAngle(Math.round(rotatedSelected[0].rotation ?? 0))
      } else {
        rotatedSelected = rotatePanelsAsArray(
          selectedPanelsInitial,
          deltaDeg,
          polygon.points,
          centroid
        )
        const dispAngle = Math.round(((deltaDeg % 360) + 360) % 360)
        setLiveRotationAngle(dispAngle)
      }

      const updatedPanels = panels.map((p) => {
        const found = rotatedSelected.find((r) => r.id === p.id)
        return found || p
      })

      onUpdatePanels(recheckAllPanelsValidity(polygon, updatedPanels))
      return
    }

    // Handle multi-panel dragging
    if (isDraggingPanels && draggedPanelsInitialRef.current.length > 0) {
      const rawDx = canvasPt.x - dragStartPointerRef.current.x
      const rawDy = canvasPt.y - dragStartPointerRef.current.y

      let finalDx = rawDx
      let finalDy = rawDy

      // If single panel dragged with snapping enabled, snap lead panel
      const effectiveSnap = e.altKey ? !enableSnapping : !!enableSnapping
      if (effectiveSnap && draggedPanelsInitialRef.current.length === 1) {
        const leadInit = draggedPanelsInitialRef.current[0]
        const currentLead = placedPanels.find((p) => p.id === leadInit.id)
        if (currentLead && !currentLead.customQuad) {
          const gapPx = (interPanelGapMm / 1000) * scale.pixelsPerMeter
          const snapResult = getAdjacentSnapPosition(
            {
              id: currentLead.id,
              x: leadInit.x + rawDx,
              y: leadInit.y + rawDy,
              width: currentLead.width,
              height: currentLead.height,
              rotation: currentLead.rotation,
            },
            placedPanels,
            14 / viewport.zoom,
            gapPx
          )
          if (snapResult.snapped) {
            finalDx = snapResult.x - leadInit.x
            finalDy = snapResult.y - leadInit.y
          }
        }
      }

      const initialMap = new Map(draggedPanelsInitialRef.current.map((item) => [item.id, item]))

      const updated = placedPanels.map((panel) => {
        const init = initialMap.get(panel.id)
        if (!init) return panel

        const newX = Math.round(init.x + finalDx)
        const newY = Math.round(init.y + finalDy)

        let newCustomQuad: [Point, Point, Point, Point] | undefined
        if (init.customQuad) {
          newCustomQuad = [
            { x: Math.round(init.customQuad[0].x + finalDx), y: Math.round(init.customQuad[0].y + finalDy) },
            { x: Math.round(init.customQuad[1].x + finalDx), y: Math.round(init.customQuad[1].y + finalDy) },
            { x: Math.round(init.customQuad[2].x + finalDx), y: Math.round(init.customQuad[2].y + finalDy) },
            { x: Math.round(init.customQuad[3].x + finalDx), y: Math.round(init.customQuad[3].y + finalDy) },
          ]
        }

        const candidate: PlacedPanel = {
          ...panel,
          x: newX,
          y: newY,
          customQuad: newCustomQuad,
        }

        const isValid = polygon.isClosed
          ? newCustomQuad
            ? isQuadInsidePolygon(newCustomQuad, polygon.points)
            : isPanelInsidePolygon(candidate, polygon.points)
          : false

        return { ...candidate, isValid }
      })

      onUpdatePanels(updated)
    }
  }

  // Pointer Up (Complete marquee, drop vertex, drop panels, drop 3D perspective corner pins)
  const handlePointerUp = (e?: React.PointerEvent) => {
    if (e) {
      try {
        (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
      } catch (_) {}
    }

    setIsPanning(false)
    setDraggingVertexIdx(null)
    setIsDraggingPolygon(false)
    setDraggingRotationPanelId(null)
    setIsDraggingRotation(false)
    setLiveRotationAngle(null)
    rotationDragInitialRef.current = null

    // Complete Multi-panel drag
    if (isDraggingPanels) {
      setIsDraggingPanels(false)
      draggedPanelsInitialRef.current = []
    }

    // Check if user did a simple click on an already-selected panel without dragging
    if (panelClickCandidateRef.current) {
      const { panel: clickedPanel, isModifier, startPt } = panelClickCandidateRef.current
      panelClickCandidateRef.current = null

      const currentCanvasPt = cursorPos || startPt
      const dist = Math.hypot(currentCanvasPt.x - startPt.x, currentCanvasPt.y - startPt.y)

      if (dist < 4 && !isModifier) {
        const groupMembers = clickedPanel.groupId
          ? placedPanels.filter((p) => p.groupId === clickedPanel.groupId).map((p) => p.id)
          : [clickedPanel.id]
        setSelectedPanelIds(groupMembers)
      }
    }

    // Complete 3D Perspective Corner Pin Drag
    if (draggingPerspectivePinIndex !== null) {
      setDraggingPerspectivePinIndex(null)
      perspectivePinDragStartRef.current = null
      onUpdatePanels(recheckAllPanelsValidity(polygon, placedPanels))
    }

    // Complete Marquee selection
    if (marqueeBox) {
      const minX = Math.min(marqueeBox.start.x, marqueeBox.current.x)
      const maxX = Math.max(marqueeBox.start.x, marqueeBox.current.x)
      const minY = Math.min(marqueeBox.start.y, marqueeBox.current.y)
      const maxY = Math.max(marqueeBox.start.y, marqueeBox.current.y)

      if (maxX - minX > 5 || maxY - minY > 5) {
        const newlySelected: string[] = []

        placedPanels.forEach((p) => {
          let intersects = false
          if (p.customQuad) {
            const [q0, q1, q2, q3] = p.customQuad
            const qMinX = Math.min(q0.x, q1.x, q2.x, q3.x)
            const qMaxX = Math.max(q0.x, q1.x, q2.x, q3.x)
            const qMinY = Math.min(q0.y, q1.y, q2.y, q3.y)
            const qMaxY = Math.max(q0.y, q1.y, q2.y, q3.y)
            intersects = !(qMaxX < minX || qMinX > maxX || qMaxY < minY || qMinY > maxY)
          } else {
            const pMinX = p.x
            const pMaxX = p.x + p.width
            const pMinY = p.y
            const pMaxY = p.y + p.height
            intersects = !(pMaxX < minX || pMinX > maxX || pMaxY < minY || pMinY > maxY)
          }

          if (intersects) {
            if (p.groupId) {
              placedPanels.filter((item) => item.groupId === p.groupId).forEach((g) => {
                if (!newlySelected.includes(g.id)) newlySelected.push(g.id)
              })
            } else {
              if (!newlySelected.includes(p.id)) newlySelected.push(p.id)
            }
          }
        })

        if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
          const union = Array.from(new Set([...selectedPanelIds, ...newlySelected]))
          setSelectedPanelIds(union)
        } else {
          setSelectedPanelIds(newlySelected)
        }
      }
      setMarqueeBox(null)
    }

    // Complete Rect tool drag
    if (activeTool === 'rect' && rectStart && cursorPos) {
      const minX = Math.min(rectStart.x, cursorPos.x)
      const maxX = Math.max(rectStart.x, cursorPos.x)
      const minY = Math.min(rectStart.y, cursorPos.y)
      const maxY = Math.max(rectStart.y, cursorPos.y)

      if (maxX - minX > 20 && maxY - minY > 20) {
        onSnapshotBeforeChange?.()
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

  // Panel Pointer Down (Select panel, multi-select, group selection, initiate panel drag)
  const handlePanelPointerDown = (panel: PlacedPanel, e: React.PointerEvent) => {
    if (activeTool !== 'select') return
    e.stopPropagation()
    onSnapshotBeforeChange?.()

    try {
      (e.currentTarget as Element)?.setPointerCapture(e.pointerId)
    } catch (_) {}

    const isModifier = e.shiftKey || e.ctrlKey || e.metaKey
    let nextSelected = [...selectedPanelIds]

    // If panel is part of a group, resolve all group members
    const groupMemberIds = panel.groupId
      ? placedPanels.filter((p) => p.groupId === panel.groupId).map((p) => p.id)
      : [panel.id]

    if (isModifier) {
      const isAlreadySelected = nextSelected.includes(panel.id)
      if (isAlreadySelected) {
        nextSelected = nextSelected.filter((id) => !groupMemberIds.includes(id))
      } else {
        nextSelected = Array.from(new Set([...nextSelected, ...groupMemberIds]))
      }
    } else {
      // If clicked panel is not in current selection, select it or its group
      if (!nextSelected.includes(panel.id)) {
        nextSelected = groupMemberIds
      }
    }

    setSelectedPanelIds(nextSelected)

    // Prepare drag movement for all currently selected panels
    const canvasPt = screenToCanvas(e.clientX, e.clientY)
    panelClickCandidateRef.current = { panel, isModifier, startPt: canvasPt }
    dragStartPointerRef.current = canvasPt
    draggedPanelsInitialRef.current = placedPanels
      .filter((p) => nextSelected.includes(p.id))
      .map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        customQuad: p.customQuad ? [...p.customQuad] : undefined,
      }))

    setIsDraggingPanels(true)
  }

  // Rotate panel 90 degrees
  const handleRotatePanel = (panelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSnapshotBeforeChange?.()
    const updated = placedPanels.map((panel) => {
      if (panel.id !== panelId) return panel
      const newOrientation: PanelOrientation =
        panel.orientation === 'portrait' ? 'landscape' : 'portrait'
      const newWidth = panel.height
      const newHeight = panel.width
      return {
        ...panel,
        orientation: newOrientation,
        width: newWidth,
        height: newHeight,
      }
    })
    onUpdatePanels(recheckAllPanelsValidity(polygon, updated))
  }

  // Incremental angle rotation
  const handleRotatePanelBy = (panelId: string, delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onSnapshotBeforeChange?.()
    const updated = placedPanels.map((panel) => {
      if (panel.id !== panelId) return panel
      const newRotation = Math.round((((panel.rotation || 0) + delta) % 360 + 360) % 360)
      return { ...panel, rotation: newRotation }
    })
    onUpdatePanels(recheckAllPanelsValidity(polygon, updated))
  }

  // Common rack pitch tilt angles
  const TILT_ANGLES = [0, 10, 15, 20, 25, 30]

  // Cycle mounting rack pitch tilt angle
  const handleCyclePanelTilt = (panelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onSnapshotBeforeChange?.()
    const updated = placedPanels.map((panel) => {
      if (panel.id !== panelId) return panel
      const currentTilt = panel.tiltAngle || 0
      const nextIdx = (TILT_ANGLES.indexOf(currentTilt) + 1) % TILT_ANGLES.length
      const newTilt = TILT_ANGLES[nextIdx]
      return {
        ...panel,
        tiltAngle: newTilt,
      }
    })
    onUpdatePanels(recheckAllPanelsValidity(polygon, updated))
  }

  // Delete single panel or selection
  const handleDeletePanel = (panelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSnapshotBeforeChange?.()
    onUpdatePanels(placedPanels.filter((p) => p.id !== panelId))
    setSelectedPanelIds(selectedPanelIds.filter((id) => id !== panelId))
  }

  const handleDeleteSelectedPanels = useCallback(() => {
    if (selectedPanelIds.length === 0) return
    onSnapshotBeforeChange?.()
    onUpdatePanels(placedPanels.filter((p) => !selectedPanelIds.includes(p.id)))
    setSelectedPanelIds([])
  }, [selectedPanelIds, placedPanels, onUpdatePanels, onSnapshotBeforeChange, setSelectedPanelIds])

  // Confirm Scale Calibration Dialog
  const handleConfirmScale = () => {
    if (!pendingScalePoints) return
    const parsedMeters = parseFloat(scaleDistanceInput)
    if (isNaN(parsedMeters) || parsedMeters <= 0) return

    onSnapshotBeforeChange?.()
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
      onSnapshotBeforeChange?.()
      const closedPoly = { ...polygon, isClosed: true }
      onUpdatePolygon(closedPoly)
      onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
      if (onSelectTool) onSelectTool('select')
    }
  }

  // Keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      // History: Ctrl+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) onRedo?.()
        else onUndo?.()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        onRedo?.()
        return
      }

      // Select All: Ctrl+A
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        setSelectedPanelIds(placedPanels.map((p) => p.id))
        return
      }

      // Group: Ctrl+G
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        onGroupSelected?.()
        return
      }

      // Ungroup: Ctrl+Shift+G or Ctrl+U
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'g' || e.key === 'G')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault()
        onUngroupSelected?.()
        return
      }

      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        onDuplicateSelected?.()
        return
      }

      // Rotation shortcuts: [ and ] (delta: -15 / +15, Shift: -1 / +1)
      if (e.key === '[' || e.key === ']') {
        e.preventDefault()
        const step = e.shiftKey ? 1 : 15
        const delta = e.key === '[' ? -step : step
        if (selectedPanelIds.length > 0 && onRotateSelected) {
          onRotateSelected(delta)
        } else if (onRotateAllPanels) {
          onRotateAllPanels(delta)
        } else if (onRotateSelected) {
          onRotateSelected(delta)
        }
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
        if (selectedPanelIds.length > 0) {
          setSelectedPanelIds([])
        } else if (scaleModalOpen) {
          setScaleModalOpen(false)
          setPendingScalePoints(null)
        } else if (scaleTempStart) {
          setScaleTempStart(null)
        } else if (rectStart) {
          setRectStart(null)
        } else if (activeTool === 'pen' && !polygon.isClosed) {
          onSnapshotBeforeChange?.()
          onUpdatePolygon({ points: [], isClosed: false })
          if (onSelectTool) onSelectTool('select')
        }
      }

      if (e.key === 'Enter' && !polygon.isClosed && polygon.points.length >= 3) {
        onSnapshotBeforeChange?.()
        const closedPoly = { ...polygon, isClosed: true }
        onUpdatePolygon(closedPoly)
        onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
        if (onSelectTool) onSelectTool('select')
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPanelIds.length > 0) {
          handleDeleteSelectedPanels()
          return
        }
        if (e.key === 'Backspace' && activeTool === 'pen' && !polygon.isClosed && polygon.points.length > 0) {
          onSnapshotBeforeChange?.()
          onUpdatePolygon({
            ...polygon,
            points: polygon.points.slice(0, -1),
          })
          return
        }
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
  }, [
    selectedPanelIds,
    placedPanels,
    onUpdatePanels,
    polygon,
    recheckAllPanelsValidity,
    onUpdatePolygon,
    onSelectTool,
    onGroupSelected,
    onUngroupSelected,
    onDuplicateSelected,
    handleDeleteSelectedPanels,
    setSelectedPanelIds,
    onUndo,
    onRedo,
    onRotateSelected,
    onRotateAllPanels,
    activeTool,
    rectStart,
    scaleModalOpen,
    scaleTempStart,
  ])

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
        {/* Background Image Layer */}
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
          /* Blueprint Grid Canvas */
          <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] bg-zinc-950/90 pointer-events-none" />
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
            {/* Standard Flat/Flush Panel Gradient */}
            <linearGradient id="standard-panel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.94" />
              <stop offset="100%" stopColor="#172554" stopOpacity="0.90" />
            </linearGradient>
            {/* Selection Highlight Glow Filter */}
            <filter id="selection-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" />
            </filter>
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
                <text x="0" y="4" fill="#60a5fa" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="'Lilex', monospace">
                  {(Math.abs(cursorPos.x - rectStart.x) / scale.pixelsPerMeter).toFixed(1)}m × {(Math.abs(cursorPos.y - rectStart.y) / scale.pixelsPerMeter).toFixed(1)}m
                </text>
              </g>
            </g>
          )}

          {/* Traced Roof Polygon Layer */}
          {polygon.points.length > 0 && (
            <g className="roof-polygon-layer">
              {polygon.isClosed ? (
                <>
                  <polygon
                    points={polygon.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="rgba(37, 99, 235, 0.16)"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    className="filter drop-shadow-sm pointer-events-none"
                  />
                  {activeTool === 'select' && !isRoofLocked && (
                    <g
                      transform={`translate(${getPolygonCentroid(polygon.points).x}, ${getPolygonCentroid(polygon.points).y})`}
                      className="cursor-move select-none"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        onSnapshotBeforeChange?.()
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
                <>
                  <polyline
                    points={polygon.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    strokeDasharray="5,5"
                  />
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
                      fontFamily="'Lilex', monospace"
                      textAnchor="middle"
                    >
                      {distM.toFixed(1)}m
                    </text>
                  </g>
                )
              })}

              {/* Polygon Vertices */}
              {polygon.points.map((pt, idx) => {
                const isFirst = idx === 0
                const isHovered = hoveredPointIdx === idx
                const canClose = !polygon.isClosed && isFirst && polygon.points.length >= 3

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
                      onSnapshotBeforeChange?.()
                      if (canClose) {
                        const closedPoly = { ...polygon, isClosed: true }
                        onUpdatePolygon(closedPoly)
                        onUpdatePanels(recheckAllPanelsValidity(closedPoly, placedPanels))
                        if (onSelectTool) onSelectTool('select')
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
                      r={canClose ? 10 : isHovered ? 8 : 6}
                      fill={canClose ? '#22c55e' : isHovered ? '#60a5fa' : '#3b82f6'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className={canClose ? 'animate-pulse' : ''}
                    />

                    {canClose && (
                      <g transform={`translate(${pt.x + 14}, ${pt.y + 4})`} pointerEvents="none">
                        <rect x="-3" y="-11" width={polygon.points.length === 4 ? 142 : 88} height="16" rx="4" fill="#052e16" stroke="#22c55e" strokeWidth="1" />
                        <text
                          x={polygon.points.length === 4 ? 68 : 41}
                          y="1"
                          fill="#4ade80"
                          fontSize="10"
                          fontWeight="700"
                          fontFamily="'Lilex', monospace"
                          textAnchor="middle"
                        >
                          {polygon.points.length === 4 ? '✓ Finish 4-Pt Roof' : '✓ Click to Close'}
                        </text>
                      </g>
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
              const isSelected = selectedPanelIds.includes(panel.id)
              const isValid = panel.isValid
              const rot = panel.rotation || 0
              const tilt = panel.tiltAngle || 0

              // CASE 1: 3D Perspective Slanted Panel (customQuad is set)
              if (panel.customQuad) {
                const [p0, p1, p2, p3] = panel.customQuad
                const quadPoints = `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`
                const centerPt = {
                  x: (p0.x + p1.x + p2.x + p3.x) / 4,
                  y: (p0.y + p1.y + p2.y + p3.y) / 4,
                }

                // Internal perspective solar cell grid lines
                const cellLines: { pA: Point; pB: Point }[] = []
                for (let r = 1; r < 5; r++) {
                  const frac = r / 5
                  cellLines.push({
                    pA: {
                      x: p0.x + (p3.x - p0.x) * frac,
                      y: p0.y + (p3.y - p0.y) * frac,
                    },
                    pB: {
                      x: p1.x + (p2.x - p1.x) * frac,
                      y: p1.y + (p2.y - p1.y) * frac,
                    },
                  })
                }
                cellLines.push({
                  pA: {
                    x: (p0.x + p1.x) / 2,
                    y: (p0.y + p1.y) / 2,
                  },
                  pB: {
                    x: (p3.x + p2.x) / 2,
                    y: (p3.y + p2.y) / 2,
                  },
                })

                return (
                  <g
                    key={panel.id}
                    onPointerDown={(e) => handlePanelPointerDown(panel, e)}
                    className="cursor-move group"
                  >
                    {/* Warped 3D Panel Polygon */}
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
                      filter={isSelected ? 'url(#selection-glow)' : undefined}
                      className="transition-colors duration-100"
                    />

                    {/* 3D Extruded Frame Edge / Bevel */}
                    {isValid && (
                      <polygon
                        points={`${p3.x},${p3.y} ${p2.x},${p2.y} ${p2.x},${p2.y + 3} ${p3.x},${p3.y + 3}`}
                        fill="#0f172a"
                        stroke="#334155"
                        strokeWidth="0.5"
                        pointerEvents="none"
                      />
                    )}

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

                    {/* Group Badge / 3D Tag */}
                    {panel.groupId && (
                      <g transform={`translate(${p0.x + 6}, ${p0.y + 6})`} pointerEvents="none">
                        <rect x="-2" y="-8" width="16" height="12" rx="3" fill="#0369a1" fillOpacity="0.8" />
                        <text x="6" y="1" fill="#e0f2fe" fontSize="8" fontWeight="bold" textAnchor="middle">
                          G
                        </text>
                      </g>
                    )}

                    {/* Wattage Readout */}
                    {isValid && (
                      <text
                        x={centerPt.x}
                        y={centerPt.y + 3}
                        fill="#93c5fd"
                        fontSize="9"
                        fontWeight="600"
                        fontFamily="'Lilex', monospace"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {panelDimensions.wattage}W
                      </text>
                    )}
                  </g>
                )
              }

              // CASE 2: Standard Flat 2D Panel
              return (
                <g
                  key={panel.id}
                  transform={`translate(${panel.x}, ${panel.y}) rotate(${rot}, ${panel.width / 2}, ${panel.height / 2})`}
                  onPointerDown={(e) => handlePanelPointerDown(panel, e)}
                  className="cursor-move group"
                >
                  {/* 3D Elevated Racking Standoff Legs when tilt > 0 */}
                  {tilt > 0 && isValid && (
                    <g className="rack-standoff-elevation pointer-events-none">
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
                      <rect x="4" y="-7" width="5" height="7" rx="1" fill="#334155" stroke="#64748b" strokeWidth="0.5" />
                      <rect x={Math.max(10, panel.width - 9)} y="-7" width="5" height="7" rx="1" fill="#334155" stroke="#64748b" strokeWidth="0.5" />
                      <rect x="0" y="0" width={panel.width} height="3" fill="rgba(0,0,0,0.4)" />
                    </g>
                  )}

                  {/* Panel Background Rectangle */}
                  <rect
                    width={panel.width}
                    height={panel.height}
                    rx="2"
                    fill={
                      isValid
                        ? isSelected
                          ? 'rgba(30, 58, 138, 0.98)'
                          : 'url(#standard-panel-grad)'
                        : 'url(#invalid-stripe)'
                    }
                    stroke={
                      isValid
                        ? isSelected
                          ? '#38bdf8'
                          : '#60a5fa'
                        : '#ef4444'
                    }
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    filter={isSelected ? 'url(#selection-glow)' : undefined}
                    className="transition-colors duration-100"
                  />

                  {/* Internal Solar Cell Grid Texture */}
                  {isValid && (
                    <rect
                      x="1.5"
                      y="1.5"
                      width={Math.max(0, panel.width - 3)}
                      height={Math.max(0, panel.height - 3)}
                      fill="url(#solar-cell-pattern)"
                      pointerEvents="none"
                    />
                  )}

                  {/* Group Badge */}
                  {panel.groupId && (
                    <g transform="translate(4, 10)" pointerEvents="none">
                      <rect x="-2" y="-8" width="16" height="12" rx="3" fill="#0369a1" fillOpacity="0.8" />
                      <text x="6" y="1" fill="#e0f2fe" fontSize="8" fontWeight="bold" textAnchor="middle">
                        G
                      </text>
                    </g>
                  )}

                  {/* Warning Icon if Out of Bounds */}
                  {!isValid && (
                    <g transform={`translate(${panel.width / 2}, ${panel.height / 2})`} pointerEvents="none">
                      <circle r="10" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                      <text x="0" y="4" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">
                        !
                      </text>
                    </g>
                  )}

                  {/* Panel Spec Readout */}
                  {isValid && (
                    <text
                      x={panel.width / 2}
                      y={panel.height / 2 + 3}
                      fill="#93c5fd"
                      fontSize="9"
                      fontWeight="600"
                      fontFamily="'Lilex', monospace"
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {panelDimensions.wattage}W{rot !== 0 ? ` • ${rot}°` : ''}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Active Marquee Selection Drag Rectangle */}
          {marqueeBox && (
            <g className="marquee-selection-layer pointer-events-none">
              <rect
                x={Math.min(marqueeBox.start.x, marqueeBox.current.x)}
                y={Math.min(marqueeBox.start.y, marqueeBox.current.y)}
                width={Math.abs(marqueeBox.current.x - marqueeBox.start.x)}
                height={Math.abs(marqueeBox.current.y - marqueeBox.start.y)}
                fill="rgba(56, 189, 248, 0.12)"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            </g>
          )}

          {/* Selection Transform Box & Draggable 3D Perspective Corner Pins */}
          {selectionBounds && selectedPanels.length > 0 && (
            <g className="selection-transform-box">
              {/* Outer Bounding Quad Connecting Line */}
              <polygon
                points={selectionBounds.quad.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(56, 189, 248, 0.04)"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="5,4"
                pointerEvents="none"
              />

              {/* 4 Draggable 3D Perspective Corner Pins */}
              {selectionBounds.quad.map((pin, pinIdx) => {
                const cornerNames = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left']
                const isDraggingThis = draggingPerspectivePinIndex === pinIdx

                return (
                  <g
                    key={`selection-pin-${pinIdx}`}
                    transform={`translate(${pin.x}, ${pin.y})`}
                    className="cursor-crosshair group/pin select-none"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      onSnapshotBeforeChange?.()
                      try {
                        (e.currentTarget as Element)?.setPointerCapture(e.pointerId)
                      } catch (_) {}
                      setDraggingPerspectivePinIndex(pinIdx)
                      perspectivePinDragStartRef.current = {
                        initialQuad: [
                          { ...selectionBounds.quad[0] },
                          { ...selectionBounds.quad[1] },
                          { ...selectionBounds.quad[2] },
                          { ...selectionBounds.quad[3] },
                        ],
                        initialPanels: [...selectedPanels],
                      }
                    }}
                    onPointerUp={(e) => {
                      try {
                        (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
                      } catch (_) {}
                      setDraggingPerspectivePinIndex(null)
                    }}
                  >
                    <title>{`Drag ${cornerNames[pinIdx]} corner to slant & resize panels in 3D perspective`}</title>
                    {/* Outer Target Glow Ring */}
                    <circle
                      r={isDraggingThis ? 16 : 12}
                      fill={isDraggingThis ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.2)'}
                      stroke="#38bdf8"
                      strokeWidth={isDraggingThis ? 2.5 : 1.5}
                      strokeDasharray={isDraggingThis ? 'none' : '3,2'}
                      className="transition-all"
                    />
                    {/* Inner Solid Handle */}
                    <circle
                      r={isDraggingThis ? 7 : 5.5}
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="group-hover/pin:scale-125 transition-transform"
                    />
                    <circle r="1.5" fill="#ffffff" pointerEvents="none" />
                  </g>
                )
              })}

              {/* CAD Manual Rotation Handle Stem & Grip */}
              {(() => {
                const q = selectionBounds.quad
                const topMidX = (q[0].x + q[1].x) / 2
                const topMidY = (q[0].y + q[1].y) / 2
                const centroidX = (q[0].x + q[1].x + q[2].x + q[3].x) / 4
                const centroidY = (q[0].y + q[1].y + q[2].y + q[3].y) / 4

                const dirX = topMidX - centroidX
                const dirY = topMidY - centroidY
                const distToTop = Math.hypot(dirX, dirY)
                const normX = distToTop > 0.001 ? dirX / distToTop : 0
                const normY = distToTop > 0.001 ? dirY / distToTop : -1

                const rotHandleX = topMidX + normX * 24
                const rotHandleY = topMidY + normY * 24

                const angleReadout =
                  liveRotationAngle !== null
                    ? `${liveRotationAngle}°`
                    : selectedPanels.length === 1 && typeof selectedPanels[0].rotation === 'number' && selectedPanels[0].rotation !== 0
                    ? `${Math.round(selectedPanels[0].rotation)}°`
                    : null

                return (
                  <g className="manual-rotation-cad-handle">
                    {/* Stem Line */}
                    <line
                      x1={topMidX}
                      y1={topMidY}
                      x2={rotHandleX}
                      y2={rotHandleY}
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      pointerEvents="none"
                    />

                    {/* Draggable Rotation Grip */}
                    <g
                      transform={`translate(${rotHandleX}, ${rotHandleY})`}
                      className="cursor-grab active:cursor-grabbing group/rot-handle select-none"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        onSnapshotBeforeChange?.()
                        try {
                          (e.currentTarget as Element)?.setPointerCapture(e.pointerId)
                        } catch (_) {}
                        setIsDraggingRotation(true)
                        const rect = svgRef.current?.getBoundingClientRect()
                        const pointerCanvasPt = rect
                          ? {
                              x: (e.clientX - rect.left - viewport.panX) / viewport.zoom,
                              y: (e.clientY - rect.top - viewport.panY) / viewport.zoom,
                            }
                          : { x: rotHandleX, y: rotHandleY }

                        rotationDragInitialRef.current = {
                          centroid: { x: centroidX, y: centroidY },
                          startPointerAngle: Math.atan2(
                            pointerCanvasPt.y - centroidY,
                            pointerCanvasPt.x - centroidX
                          ),
                          panels: placedPanels.map((p) => ({
                            ...p,
                            customQuad: p.customQuad
                              ? ([...p.customQuad] as [Point, Point, Point, Point])
                              : undefined,
                          })),
                          selectedIds: [...selectedPanelIds],
                        }
                      }}
                      onPointerUp={(e) => {
                        try {
                          (e.currentTarget as Element)?.releasePointerCapture(e.pointerId)
                        } catch (_) {}
                        setIsDraggingRotation(false)
                        setLiveRotationAngle(null)
                        rotationDragInitialRef.current = null
                      }}
                    >
                      <title>Drag to rotate selection manually (15° snap, Alt for freeform)</title>
                      {/* Touch target area */}
                      <circle r="14" fill="transparent" />
                      {/* Outer glow ring */}
                      <circle
                        r={isDraggingRotation ? 11 : 9}
                        fill={isDraggingRotation ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.2)'}
                        stroke="#38bdf8"
                        strokeWidth={isDraggingRotation ? 2 : 1.5}
                        className="group-hover/rot-handle:scale-125 transition-transform"
                      />
                      {/* Solid Knob */}
                      <circle
                        r="5.5"
                        fill="#0284c7"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      {/* Curved Rotation Arrow Icon */}
                      <path
                        d="M -2.5 -1.2 A 2.8 2.8 0 1 1 -2 2.2"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                      <polygon
                        points="-3.5,-1.8 -1.2,-1.2 -2.5,-3"
                        fill="#ffffff"
                        pointerEvents="none"
                      />

                      {/* Live Angle Readout Bubble */}
                      {angleReadout && (
                        <g transform="translate(14, -10)" pointerEvents="none">
                          <rect
                            x="0"
                            y="0"
                            width="40"
                            height="18"
                            rx="4"
                            fill="#0f172a"
                            stroke="#38bdf8"
                            strokeWidth="1"
                            className="filter drop-shadow-md"
                          />
                          <text
                            x="20"
                            y="9"
                            fill="#38bdf8"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily="'Lilex', monospace"
                          >
                            {angleReadout}
                          </text>
                        </g>
                      )}
                    </g>
                  </g>
                )
              })()}

              {/* Floating Quick Action Toolbar over Selection */}
              {(() => {
                const q = selectionBounds.quad
                const topMidX = (q[0].x + q[1].x) / 2
                const topMidY = (q[0].y + q[1].y) / 2
                const centroidX = (q[0].x + q[1].x + q[2].x + q[3].x) / 4
                const centroidY = (q[0].y + q[1].y + q[2].y + q[3].y) / 4

                const dirX = topMidX - centroidX
                const dirY = topMidY - centroidY
                const distToTop = Math.hypot(dirX, dirY)
                const normY = distToTop > 0.001 ? dirY / distToTop : -1
                const rotHandleY = topMidY + normY * 24

                const toolbarWidth = 496
                const toolbarHeight = 32
                const topAnchor = Math.min(selectionBounds.minY, rotHandleY)
                const toolbarX = selectionBounds.minX + (selectionBounds.maxX - selectionBounds.minX) / 2 - toolbarWidth / 2
                const toolbarY = topAnchor - 42

                return (
                  <g
                    transform={`translate(${toolbarX}, ${toolbarY})`}
                    className="cursor-pointer select-none"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <rect
                      x="0"
                      y="0"
                      width={toolbarWidth}
                      height={toolbarHeight}
                      rx="8"
                      fill="#18181b"
                      stroke="#3f3f46"
                      strokeWidth="1.2"
                      className="filter drop-shadow-2xl"
                    />

                    {/* 1. Panel Count Badge */}
                    <rect
                      x="6"
                      y="5"
                      width="74"
                      height="22"
                      rx="4"
                      fill="#0f172a"
                      stroke="#0284c7"
                      strokeWidth="0.8"
                    />
                    <text
                      x="43"
                      y="16"
                      fill="#38bdf8"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="'Lilex', monospace"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {selectedPanels.length} Selected
                    </text>

                    {/* Divider 1 */}
                    <line x1="86" y1="6" x2="86" y2="26" stroke="#3f3f46" strokeWidth="1" />

                    {/* 2. Group / Ungroup */}
                    <g
                      onClick={() => {
                        if (isSelectionGrouped) onUngroupSelected?.()
                        else onGroupSelected?.()
                      }}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>{isSelectionGrouped ? 'Ungroup panels (Ctrl+Shift+G)' : 'Group panels together (Ctrl+G)'}</title>
                      <rect x="92" y="5" width="56" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="120" y="16" fill="#e0f2fe" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        {isSelectionGrouped ? 'Ungroup' : 'Group'}
                      </text>
                    </g>

                    {/* 3. Duplicate */}
                    <g
                      onClick={() => onDuplicateSelected?.()}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>Duplicate selected (Ctrl+D)</title>
                      <rect x="152" y="5" width="44" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="174" y="16" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        + Dup
                      </text>
                    </g>

                    {/* Divider 2 */}
                    <line x1="202" y1="6" x2="202" y2="26" stroke="#3f3f46" strokeWidth="1" />

                    {/* 4. 3D Slopes: Up, Down, Left, Right, Reset Flat */}
                    <g
                      onClick={() => onApplyPerspectivePreset?.('pitch-up')}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>3D Slope Pitch Up</title>
                      <rect x="208" y="5" width="20" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="218" y="16" fill="#67e8f9" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        ▲
                      </text>
                    </g>

                    <g
                      onClick={() => onApplyPerspectivePreset?.('pitch-down')}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>3D Slope Pitch Down</title>
                      <rect x="232" y="5" width="20" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="242" y="16" fill="#67e8f9" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        ▼
                      </text>
                    </g>

                    <g
                      onClick={() => onApplyPerspectivePreset?.('pitch-left')}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>3D Slope Pitch Left</title>
                      <rect x="256" y="5" width="20" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="266" y="16" fill="#67e8f9" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        ◀
                      </text>
                    </g>

                    <g
                      onClick={() => onApplyPerspectivePreset?.('pitch-right')}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>3D Slope Pitch Right</title>
                      <rect x="280" y="5" width="20" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="290" y="16" fill="#67e8f9" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        ▶
                      </text>
                    </g>

                    <g
                      onClick={() => onApplyPerspectivePreset?.('reset')}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>Reset Flat (Remove 3D Perspective)</title>
                      <rect x="304" y="5" width="20" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="314" y="16" fill="#a1a1aa" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        ↺
                      </text>
                    </g>

                    {/* Divider 3 */}
                    <line x1="330" y1="6" x2="330" y2="26" stroke="#3f3f46" strokeWidth="1" />

                    {/* 5. Rotation Controls: -15°, +15°, 90° */}
                    <g
                      onClick={() => onRotateSelected?.(-15)}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>Rotate -15° Counter-Clockwise ([ key)</title>
                      <rect x="336" y="5" width="34" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="353" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        -15°
                      </text>
                    </g>

                    <g
                      onClick={() => onRotateSelected?.(15)}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>Rotate +15° Clockwise (] key)</title>
                      <rect x="374" y="5" width="34" height="22" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="0.8" />
                      <text x="391" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        +15°
                      </text>
                    </g>

                    {/* Normal 90° Rotation Button */}
                    <g
                      onClick={() => onRotateSelected?.(90)}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>Rotate 90° Clockwise</title>
                      <rect x="412" y="5" width="38" height="22" rx="4" fill="rgba(14, 165, 233, 0.15)" stroke="#0284c7" strokeWidth="0.8" />
                      <text x="431" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        90°
                      </text>
                    </g>

                    {/* Divider 4 */}
                    <line x1="456" y1="6" x2="456" y2="26" stroke="#3f3f46" strokeWidth="1" />

                    {/* 6. Quick Delete Button */}
                    <g
                      onClick={handleDeleteSelectedPanels}
                      className="hover:opacity-80 transition-opacity"
                      role="button"
                    >
                      <title>Delete selected panels (Del / Backspace)</title>
                      <rect x="462" y="5" width="28" height="22" rx="4" fill="#27272a" stroke="#ef4444" strokeWidth="0.8" />
                      <text x="476" y="16" fill="#f87171" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        ✕
                      </text>
                    </g>
                  </g>
                )
              })()}
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
      {!hideStatusHud && (
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
      )}
    </div>
  )
}
