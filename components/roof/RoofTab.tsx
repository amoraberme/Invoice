'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Point,
  RoofPolygon,
  PlacedPanel,
  ScaleCalibration,
  PanelDimensions,
  RoofTool,
  PanelOrientation,
  RoofViewport,
  RoofMetrics,
  RoofState,
} from '@/types/roof'
import {
  calculatePolygonAreaM2,
  generateAutoGrid,
  isPanelInsidePolygon,
  createRectangularRoofPolygon,
  generateTargetBoqPanels,
  sqmToSqft,
} from '@/utils/geometry'
import { downloadRoofLayoutPng } from '@/utils/roofExport'
import {
  saveRoofWorkspace,
  loadRoofWorkspaceSync,
  loadRoofWorkspaceAsync,
  clearRoofWorkspace,
  toLightweightRoofState,
} from '@/utils/roofStorage'
import { RoofCanvas } from './RoofCanvas'
import { RoofControls } from './RoofControls'
import { RoofSizeModal } from './RoofSizeModal'
import { LineItem, Invoice } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Sun,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Upload,
  Info,
  CheckCircle2,
  Maximize,
  HelpCircle,
  Grid,
  Ruler,
  X,
  Download,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoofTabProps {
  invoice: Invoice
  onUpdateInvoice: (field: keyof Invoice, value: any) => void
  onSwitchTab: (tabId: string) => void
}

const DEFAULT_PANEL_DIMS: PanelDimensions = {
  lengthMm: 2278,
  widthMm: 1134,
  wattage: 625,
  modelName: 'Tongwei Panel 625W (7.82ft x 3.72ft)',
}

export const DEFAULT_AERIAL_IMAGE = '/roof-aerial-default.webp'

// Calibrated to the ~4.8m SUV in the driveway of roof-aerial-default.webp (1024x576)
export const DEFAULT_SCALE: ScaleCalibration = {
  pointA: { x: 740, y: 440 },
  pointB: { x: 890, y: 520 },
  realWorldDistanceMeters: 4.8,
  pixelsPerMeter: 35.0,
  isCalibrated: true,
}

// Front / south-facing roof plane of the residential hip roof in roof-aerial-default.webp
export const DEFAULT_ROOF_POINTS: Point[] = [
  { x: 360, y: 260 },
  { x: 660, y: 260 },
  { x: 695, y: 400 },
  { x: 325, y: 400 },
]

export const DEFAULT_ROOF_CENTER: Point = { x: 510, y: 330 }

const INITIAL_SCALE: ScaleCalibration = DEFAULT_SCALE

const INITIAL_VIEWPORT: RoofViewport = {
  zoom: 1.0,
  panX: 80,
  panY: 40,
}

export const RoofTab: React.FC<RoofTabProps> = ({
  invoice,
  onUpdateInvoice,
  onSwitchTab,
}) => {
  // 1. Selected Panel State Linkage: Read active panel and BoQ quantity from Items tab state
  const activePanelInfo = useMemo(() => {
    const items = invoice.lineItems || []
    
    // Find all panel items in BoQ
    const panelItems = items.filter((it) => {
      const desc = (it?.description || '').toLowerCase()
      return (
        desc.includes('panel') ||
        desc.includes('module') ||
        desc.includes('tongwei') ||
        desc.includes('ja solar') ||
        desc.includes('jinko') ||
        desc.includes('longi') ||
        desc.includes('pv module') ||
        desc.includes('solar panel')
      )
    })

    const panelItem = panelItems[0] || null
    let totalQty = panelItems.reduce((sum, it) => sum + (it.quantity || 0), 0)

    // Smart fallback if panel quantity is 0: inspect inverter kW or package notes
    if (totalQty === 0) {
      const inverterItem = items.find((it) => {
        const desc = (it?.description || '').toLowerCase()
        return (
          desc.includes('inverter') ||
          desc.includes('solis') ||
          desc.includes('goodwe') ||
          desc.includes('deye') ||
          desc.includes('anern') ||
          desc.includes('growatt')
        )
      })
      if (inverterItem) {
        const match = inverterItem.description.match(/(\d+(?:\.\d+)?)\s*kw/i)
        if (match) {
          const kw = parseFloat(match[1])
          if (kw === 4) totalQty = 6
          else if (kw === 3) totalQty = 5
          else if (kw === 5) totalQty = 8
          else if (kw === 6) totalQty = 10
          else if (kw === 8) totalQty = 14
          else if (kw === 10) totalQty = 18
          else totalQty = Math.round((kw * 1000) / 625)
        }
      }
    }

    // Default to 6 modules for 4kW setup if still 0
    const finalQuantity = totalQty > 0 ? totalQty : 6
    const desc = panelItem?.description || 'Tongwei Panel 625W (7.82ft x 3.72ft)'
    const wattMatch = desc.match(/(\d{3,4})\s*w/i)
    const wattage = wattMatch ? parseInt(wattMatch[1], 10) : 625

    // Standard physical panel dimensions with smart extraction from description if available
    const isLargeFormat = wattage >= 720
    let lengthMm = isLargeFormat ? 2384 : 2278
    let widthMm = isLargeFormat ? 1303 : 1134

    // Check if description has explicit dimensions in ft (e.g. 7.82ft x 3.72ft)
    const ftMatch = desc.match(/(\d+(?:\.\d+)?)\s*ft\s*[x×*]\s*(\d+(?:\.\d+)?)\s*ft/i)
    if (ftMatch) {
      const ft1 = parseFloat(ftMatch[1])
      const ft2 = parseFloat(ftMatch[2])
      lengthMm = Math.round(Math.max(ft1, ft2) * 304.8)
      widthMm = Math.round(Math.min(ft1, ft2) * 304.8)
    } else {
      // Check if description has explicit dimensions in mm (e.g. 2278 x 1134 mm or 2278x1134)
      const mmMatch = desc.match(/(\d{3,4})\s*(?:mm)?\s*[x×*]\s*(\d{3,4})\s*(?:mm)?/i)
      if (mmMatch) {
        const mm1 = parseInt(mmMatch[1], 10)
        const mm2 = parseInt(mmMatch[2], 10)
        lengthMm = Math.max(mm1, mm2)
        widthMm = Math.min(mm1, mm2)
      }
    }

    return {
      found: panelItems.length > 0 || totalQty > 0,
      panelItem,
      dimensions: {
        lengthMm,
        widthMm,
        wattage,
        modelName: desc,
      },
      quantity: finalQuantity,
    }
  }, [invoice.lineItems])

  // Synchronous cache resolution for immediate zero-latency mount/render
  const initialWorkspace = useMemo(() => {
    if (invoice.roofLayout) return invoice.roofLayout
    return loadRoofWorkspaceSync(invoice.invoiceNumber)
  }, [invoice.invoiceNumber, invoice.roofLayout])

  // Roof state initialized lazily to preserve current working layout without race conditions
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    () => initialWorkspace?.backgroundImageUrl ?? DEFAULT_AERIAL_IMAGE
  )
  const [imageOpacity, setImageOpacity] = useState<number>(
    () => (typeof initialWorkspace?.imageOpacity === 'number' ? initialWorkspace.imageOpacity : 0.6)
  )
  const [polygon, setPolygon] = useState<RoofPolygon>(() => {
    if (
      initialWorkspace?.polygon &&
      Array.isArray(initialWorkspace.polygon.points) &&
      initialWorkspace.polygon.points.length >= 3 &&
      initialWorkspace.polygon.isClosed
    ) {
      return initialWorkspace.polygon
    }
    return { points: DEFAULT_ROOF_POINTS, isClosed: true }
  })
  const [placedPanels, setPlacedPanels] = useState<PlacedPanel[]>(
    () => (Array.isArray(initialWorkspace?.placedPanels) ? initialWorkspace!.placedPanels : [])
  )
  const [scale, setScale] = useState<ScaleCalibration>(
    () => (initialWorkspace?.scale && initialWorkspace.scale.isCalibrated ? initialWorkspace.scale : DEFAULT_SCALE)
  )
  const [activeTool, setActiveTool] = useState<RoofTool>(
    () => initialWorkspace?.activeTool ?? 'select'
  )
  const [orientation, setOrientation] = useState<PanelOrientation>(
    () => initialWorkspace?.defaultOrientation ?? 'landscape'
  )
  const [interPanelGapMm, setInterPanelGapMm] = useState<number>(
    () => (typeof initialWorkspace?.interPanelGapMm === 'number' ? initialWorkspace.interPanelGapMm : 20)
  )
  const [enableSnapping, setEnableSnapping] = useState<boolean>(
    () => (typeof initialWorkspace?.enableSnapping === 'boolean' ? initialWorkspace.enableSnapping : true)
  )
  const [isRoofLocked, setIsRoofLocked] = useState<boolean>(
    () => (typeof initialWorkspace?.isRoofLocked === 'boolean' ? initialWorkspace.isRoofLocked : true)
  )
  const [viewport, setViewport] = useState<RoofViewport>(
    () => initialWorkspace?.viewport ?? INITIAL_VIEWPORT
  )
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null)
  const [defaultTiltAngle, setDefaultTiltAngle] = useState<number>(
    () => (typeof initialWorkspace?.defaultTiltAngle === 'number' ? initialWorkspace.defaultTiltAngle : 0)
  )
  const [defaultRotation, setDefaultRotation] = useState<number>(
    () => (typeof initialWorkspace?.defaultRotation === 'number' ? initialWorkspace.defaultRotation : 0)
  )
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [roofSizeModalOpen, setRoofSizeModalOpen] = useState(false)
  const [centerFitTrigger, setCenterFitTrigger] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  const selectedPanel = useMemo(
    () => placedPanels.find((p) => p.id === selectedPanelId) || null,
    [placedPanels, selectedPanelId]
  )

  const currentTiltAngle = selectedPanel ? selectedPanel.tiltAngle || 0 : defaultTiltAngle
  const currentRotation = selectedPanel ? selectedPanel.rotation || 0 : defaultRotation

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Target BoQ capacity
  const targetBoqKwp = (activePanelInfo.quantity * activePanelInfo.dimensions.wattage) / 1000

  // Asynchronously hydrate large imagery from IndexedDB (handles megabyte images without localStorage quota limits)
  useEffect(() => {
    loadRoofWorkspaceAsync(invoice.invoiceNumber).then((asyncState) => {
      if (asyncState && asyncState.backgroundImageUrl && !backgroundImageUrl) {
        setBackgroundImageUrl(asyncState.backgroundImageUrl)
      }
    })
  }, [invoice.invoiceNumber])

  // Auto-seed BoQ panels ONLY on a completely fresh/empty workspace
  const hasCheckedSeedingRef = useRef(placedPanels.length > 0)
  useEffect(() => {
    if (!hasCheckedSeedingRef.current && placedPanels.length === 0) {
      hasCheckedSeedingRef.current = true
      const targetCount = activePanelInfo.quantity > 0 ? activePanelInfo.quantity : 6
      const seeded = generateTargetBoqPanels(
        polygon.points,
        activePanelInfo.dimensions,
        targetCount,
        orientation,
        scale.pixelsPerMeter,
        interPanelGapMm,
        DEFAULT_ROOF_CENTER
      )
      setPlacedPanels(seeded)
    }
  }, [activePanelInfo.quantity, activePanelInfo.dimensions])

  // Persist current working state to multi-tier cache (Memory, LocalStorage, IndexedDB) & Invoice
  useEffect(() => {
    const currentState: RoofState = {
      backgroundImageUrl,
      imageOpacity,
      polygon,
      placedPanels,
      scale,
      panelDimensions: activePanelInfo.dimensions,
      activeTool,
      interPanelGapMm,
      defaultOrientation: orientation,
      viewport,
      enableSnapping,
      isRoofLocked,
      defaultTiltAngle,
      defaultRotation,
    }

    setIsSaving(true)
    const timer = setTimeout(() => {
      saveRoofWorkspace(currentState, invoice.invoiceNumber).then(() => {
        setIsSaving(false)
        const d = new Date()
        setLastSavedTime(
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        )
      })
      // Sync lightweight version into invoice record (keeps invoice localStorage < 20KB)
      onUpdateInvoice('roofLayout', toLightweightRoofState(currentState))
    }, 350)

    return () => clearTimeout(timer)
  }, [
    backgroundImageUrl,
    imageOpacity,
    polygon,
    placedPanels,
    scale,
    activePanelInfo.dimensions,
    activeTool,
    interPanelGapMm,
    orientation,
    viewport,
    enableSnapping,
    isRoofLocked,
    defaultTiltAngle,
    defaultRotation,
    invoice.invoiceNumber,
  ])

  // Flush save synchronously before page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentState: RoofState = {
        backgroundImageUrl,
        imageOpacity,
        polygon,
        placedPanels,
        scale,
        panelDimensions: activePanelInfo.dimensions,
        activeTool,
        interPanelGapMm,
        defaultOrientation: orientation,
        viewport,
        enableSnapping,
        isRoofLocked,
        defaultTiltAngle,
        defaultRotation,
      }
      saveRoofWorkspace(currentState, invoice.invoiceNumber)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [
    backgroundImageUrl,
    imageOpacity,
    polygon,
    placedPanels,
    scale,
    activePanelInfo.dimensions,
    activeTool,
    interPanelGapMm,
    orientation,
    viewport,
    enableSnapping,
    isRoofLocked,
    defaultTiltAngle,
    defaultRotation,
    invoice.invoiceNumber,
  ])

  // Rotate selected panel by delta (e.g. +/- 1° or +/- 15°)
  const handleRotateSelected = useCallback(
    (delta: number) => {
      if (!selectedPanelId) {
        setDefaultRotation((prevRot) => Math.round(((((prevRot + delta) % 360) + 360) % 360) * 10) / 10)
        setPlacedPanels((prev) =>
          prev.map((panel) => {
            const newRotation = Math.round(((((panel.rotation || 0) + delta) % 360 + 360) % 360) * 10) / 10
            const updated = { ...panel, rotation: newRotation }
            return {
              ...updated,
              isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
            }
          })
        )
        return
      }
      setPlacedPanels((prev) =>
        prev.map((panel) => {
          if (panel.id !== selectedPanelId) return panel
          const newRotation = Math.round(((((panel.rotation || 0) + delta) % 360 + 360) % 360) * 10) / 10
          const updated = { ...panel, rotation: newRotation }
          return {
            ...updated,
            isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
          }
        })
      )
    },
    [selectedPanelId, polygon]
  )

  // Set rotation directly (for selected panel, or all panels if none selected)
  const handleSetSelectedRotation = useCallback(
    (angle: number) => {
      const normalized = Math.round((((angle % 360) + 360) % 360) * 10) / 10
      if (!selectedPanelId) {
        setDefaultRotation(normalized)
        setPlacedPanels((prev) =>
          prev.map((panel) => {
            const updated = { ...panel, rotation: normalized }
            return {
              ...updated,
              isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
            }
          })
        )
        return
      }
      setPlacedPanels((prev) =>
        prev.map((panel) => {
          if (panel.id !== selectedPanelId) return panel
          const updated = { ...panel, rotation: normalized }
          return {
            ...updated,
            isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
          }
        })
      )
    },
    [selectedPanelId, polygon]
  )

  // Apply rotation to all panels in the array
  const handleApplyRotationToAll = useCallback(
    (angle: number) => {
      const normalized = Math.round((((angle % 360) + 360) % 360) * 10) / 10
      setDefaultRotation(normalized)
      setPlacedPanels((prev) =>
        prev.map((panel) => {
          const updated = { ...panel, rotation: normalized }
          return {
            ...updated,
            isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
          }
        })
      )
    },
    [polygon]
  )

  // Set selected panel tilt directly
  const handleSetSelectedTilt = useCallback(
    (tiltAngle: number) => {
      if (!selectedPanelId) return
      setPlacedPanels((prev) =>
        prev.map((panel) => {
          if (panel.id !== selectedPanelId) return panel
          return {
            ...panel,
            tiltAngle,
          }
        })
      )
    },
    [selectedPanelId]
  )

  // Cycle tilt
  const TILT_ANGLES = [0, 10, 15, 20, 25, 30]
  const handleCycleTilt = useCallback(() => {
    if (selectedPanelId) {
      const curTilt = selectedPanel?.tiltAngle || 0
      const nextIdx = (TILT_ANGLES.indexOf(curTilt) + 1) % TILT_ANGLES.length
      const nextTilt = TILT_ANGLES[nextIdx]
      handleSetSelectedTilt(nextTilt)
    } else {
      const nextIdx = (TILT_ANGLES.indexOf(defaultTiltAngle) + 1) % TILT_ANGLES.length
      const nextTilt = TILT_ANGLES[nextIdx]
      setDefaultTiltAngle(nextTilt)
      setPlacedPanels((prev) =>
        prev.map((p) => ({
          ...p,
          tiltAngle: nextTilt,
        }))
      )
    }
  }, [selectedPanelId, selectedPanel, defaultTiltAngle, handleSetSelectedTilt])

  // Apply tilt to all panels in the array
  const handleApplyTiltToAll = useCallback(
    (tiltAngle: number) => {
      setDefaultTiltAngle(tiltAngle)
      setPlacedPanels((prev) =>
        prev.map((panel) => ({
          ...panel,
          tiltAngle,
        }))
      )
    },
    []
  )

  // Rotate all panels in the array by delta
  const handleRotateAllPanels = useCallback(
    (delta: number) => {
      setDefaultRotation((prevRot) => (((prevRot + delta) % 360) + 360) % 360)
      setPlacedPanels((prev) =>
        prev.map((panel) => {
          const newRotation = (((panel.rotation || 0) + delta) % 360 + 360) % 360
          const updated = { ...panel, rotation: newRotation }
          return {
            ...updated,
            isValid: polygon.isClosed ? isPanelInsidePolygon(updated, polygon.points) : false,
          }
        })
      )
    },
    [polygon]
  )

  // Opacity change with strict clamping [0.2, 0.8]
  const handleOpacityChange = (val: number) => {
    const clamped = Math.min(0.8, Math.max(0.2, val))
    setImageOpacity(clamped)
  }

  // Handle Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
      alert('Please upload a valid image file (PNG, JPEG, or WEBP).')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setBackgroundImageUrl(event.target.result)
        setTimeout(() => setCenterFitTrigger((prev) => prev + 1), 100)
      }
    }
    reader.readAsDataURL(file)
  }

  const triggerImageUpload = () => {
    fileInputRef.current?.click()
  }

  // Auto-Fill Roof Action: Programmatically fills maximum fitting panels inside polygon
  const handleAutoFill = () => {
    if (!polygon.isClosed || polygon.points.length < 3) return

    const newGrid = generateAutoGrid(
      polygon.points,
      activePanelInfo.dimensions,
      orientation,
      scale.pixelsPerMeter,
      interPanelGapMm,
      defaultRotation,
      defaultTiltAngle
    )

    if (newGrid.length === 0) {
      alert('No panels could fit within the current roof boundary and scale. Try expanding the roof boundary, calibrating scale, or toggling orientation.')
      return
    }

    setPlacedPanels(newGrid)
    setActiveTool('select')
  }

  // Place BoQ Target Panels (e.g. exactly 6 panels for 4kW setup)
  const handlePlaceBoqPanels = useCallback(() => {
    const targetCount = activePanelInfo.quantity > 0 ? activePanelInfo.quantity : 6
    const pxPerMeter = scale.pixelsPerMeter || 35
    const centerPt = backgroundImageUrl ? DEFAULT_ROOF_CENTER : { x: 700, y: 500 }

    // Case 1: Polygon already exists
    if (polygon.isClosed && polygon.points.length >= 3) {
      const panels = generateTargetBoqPanels(
        polygon.points,
        activePanelInfo.dimensions,
        targetCount,
        orientation,
        pxPerMeter,
        interPanelGapMm,
        centerPt,
        defaultRotation,
        defaultTiltAngle
      )
      setPlacedPanels(panels)
      setActiveTool('select')
      setCenterFitTrigger((prev) => prev + 1)
      return
    }

    // Case 2: No polygon yet -> create standard roof plane and place panels
    const points = DEFAULT_ROOF_POINTS
    const newPoly: RoofPolygon = { points, isClosed: true }
    setPolygon(newPoly)

    const panels = generateTargetBoqPanels(
      points,
      activePanelInfo.dimensions,
      targetCount,
      orientation,
      pxPerMeter,
      interPanelGapMm,
      centerPt,
      defaultRotation,
      defaultTiltAngle
    )
    setPlacedPanels(panels)
    setActiveTool('select')
    setTimeout(() => setCenterFitTrigger((prev) => prev + 1), 100)
  }, [
    activePanelInfo.quantity,
    activePanelInfo.dimensions,
    polygon,
    scale.pixelsPerMeter,
    orientation,
    interPanelGapMm,
    backgroundImageUrl,
    defaultRotation,
    defaultTiltAngle,
  ])

  // Apply user-defined Roof Dimensions from RoofSizeModal (meters, feet, or sqm)
  const handleApplyRoofSize = (widthM: number, lengthM: number, autoPlaceBoq: boolean) => {
    const pxPerMeter = scale.pixelsPerMeter || 35
    const centerPt = backgroundImageUrl ? DEFAULT_ROOF_CENTER : { x: 700, y: 500 }
    const points = createRectangularRoofPolygon(widthM, lengthM, centerPt, pxPerMeter)
    const newPoly: RoofPolygon = { points, isClosed: true }
    setPolygon(newPoly)

    if (autoPlaceBoq) {
      const targetCount = activePanelInfo.quantity > 0 ? activePanelInfo.quantity : 6
      const panels = generateTargetBoqPanels(
        points,
        activePanelInfo.dimensions,
        targetCount,
        orientation,
        pxPerMeter,
        interPanelGapMm,
        centerPt,
        defaultRotation,
        defaultTiltAngle
      )
      setPlacedPanels(panels)
    } else {
      // Recheck validity of any existing panels
      setPlacedPanels((prev) =>
        prev.map((p) => ({
          ...p,
          isValid: isPanelInsidePolygon(p, points),
        }))
      )
    }

    setActiveTool('select')
    setTimeout(() => setCenterFitTrigger((prev) => prev + 1), 100)
  }

  // Add Single Panel manually at centroid of roof polygon
  const handleAddSinglePanel = () => {
    const widthM =
      (orientation === 'portrait'
        ? activePanelInfo.dimensions.widthMm
        : activePanelInfo.dimensions.lengthMm) / 1000
    const heightM =
      (orientation === 'portrait'
        ? activePanelInfo.dimensions.lengthMm
        : activePanelInfo.dimensions.widthMm) / 1000

    const pW = widthM * scale.pixelsPerMeter
    const pH = heightM * scale.pixelsPerMeter

    let posX = 600
    let posY = 400

    if (polygon.points.length > 0) {
      const avgX = polygon.points.reduce((acc, pt) => acc + pt.x, 0) / polygon.points.length
      const avgY = polygon.points.reduce((acc, pt) => acc + pt.y, 0) / polygon.points.length
      posX = avgX - pW / 2
      posY = avgY - pH / 2
    }

    const candidate = {
      x: posX,
      y: posY,
      width: pW,
      height: pH,
      rotation: defaultRotation,
    }

    const isValid = polygon.isClosed
      ? isPanelInsidePolygon(candidate, polygon.points)
      : false

    const newPanel: PlacedPanel = {
      id: `panel-manual-${Date.now()}`,
      x: posX,
      y: posY,
      width: pW,
      height: pH,
      orientation,
      isValid,
      rotation: defaultRotation,
      tiltAngle: defaultTiltAngle,
    }

    setPlacedPanels((prev) => [...prev, newPanel])
    setActiveTool('select')
  }

  // Clear Boundary
  const handleClearBoundary = () => {
    if (confirm('Clear the traced roof boundary?')) {
      const emptyPoly: RoofPolygon = { points: [], isClosed: false }
      setPolygon(emptyPoly)
      setPlacedPanels((prev) => prev.map((p) => ({ ...p, isValid: false })))
    }
  }

  // Clear Panels
  const handleClearPanels = () => {
    if (confirm('Remove all placed solar panels from the canvas?')) {
      setPlacedPanels([])
    }
  }

  // Reset All
  const handleResetAll = () => {
    if (confirm('Reset roof layout workspace? (Boundary and panels will be cleared)')) {
      setPolygon({ points: [], isClosed: false })
      setPlacedPanels([])
      setScale(INITIAL_SCALE)
      setViewport(INITIAL_VIEWPORT)
      clearRoofWorkspace(invoice.invoiceNumber)
    }
  }

  // Real-Time Sizing Metrics Calculation
  const metrics: RoofMetrics = useMemo(() => {
    const totalPanelsCount = placedPanels.length
    // Strict Boundary Constraint: panels intersecting or outside are excluded from power tally
    const validPanelsCount = placedPanels.filter((p) => p.isValid).length
    const invalidPanelsCount = totalPanelsCount - validPanelsCount

    const wattage = activePanelInfo.dimensions.wattage
    const totalCapacityKwp = (validPanelsCount * wattage) / 1000

    const roofPolygonAreaM2 = polygon.isClosed
      ? calculatePolygonAreaM2(polygon.points, scale.pixelsPerMeter)
      : 0

    const singlePanelAreaM2 =
      (activePanelInfo.dimensions.lengthMm / 1000) *
      (activePanelInfo.dimensions.widthMm / 1000)
    const panelsTotalAreaM2 = validPanelsCount * singlePanelAreaM2

    const utilizationRatePercent =
      roofPolygonAreaM2 > 0 ? (panelsTotalAreaM2 / roofPolygonAreaM2) * 100 : 0

    return {
      totalPanelsCount,
      validPanelsCount,
      invalidPanelsCount,
      totalCapacityKwp,
      roofPolygonAreaM2,
      panelsTotalAreaM2,
      utilizationRatePercent,
      targetBoqCount: activePanelInfo.quantity,
      targetBoqKwp,
    }
  }, [placedPanels, activePanelInfo, polygon, scale.pixelsPerMeter, targetBoqKwp])

  // Download high-resolution architectural layout plan
  const handleDownloadPlan = async () => {
    try {
      await downloadRoofLayoutPng({
        polygon,
        placedPanels,
        scale,
        panelDimensions: activePanelInfo.dimensions,
        backgroundImageUrl,
        imageOpacity,
        metrics,
        projectName: invoice.invoiceNumber ? `Quotation #${invoice.invoiceNumber}` : 'Solar PV Array Layout',
      })
    } catch (err) {
      console.error('Failed to export layout image', err)
      alert('Could not export layout image. Please try again.')
    }
  }

  // Synchronize placed valid panels count back to the Items Tab
  const handleSyncToInvoice = () => {
    if (metrics.validPanelsCount <= 0) return

    if (activePanelInfo.panelItem) {
      const updatedLineItems = invoice.lineItems.map((item) => {
        if (item.id === activePanelInfo.panelItem?.id) {
          return { ...item, quantity: metrics.validPanelsCount }
        }
        return item
      })
      onUpdateInvoice('lineItems', updatedLineItems)
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 2500)
    } else {
      const newLineItem: LineItem = {
        id: `item-${Date.now()}`,
        description: `${activePanelInfo.dimensions.modelName} (${activePanelInfo.dimensions.wattage}W Solar PV Module)`,
        quantity: metrics.validPanelsCount,
        rate: 7500,
        unit: 'pcs',
      }
      onUpdateInvoice('lineItems', [...(invoice.lineItems || []), newLineItem])
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 2500)
    }
  }

  if (!isMounted) {
    return (
      <div className="w-full h-full flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground min-h-[460px]">
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading solar roof layout...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex-1 flex flex-col bg-background text-foreground min-h-0 overflow-y-auto">
      {/* Hidden File Input for Aerial Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Roof Dimensions Modal (Meters / Feet / Sqm) */}
      <RoofSizeModal
        isOpen={roofSizeModalOpen}
        onClose={() => setRoofSizeModalOpen(false)}
        onApplyRoofSize={handleApplyRoofSize}
        targetBoqCount={activePanelInfo.quantity}
        targetBoqWattage={activePanelInfo.dimensions.wattage}
      />

      {/* Selected Panel State Linkage Banner / Fallback */}
      {!activePanelInfo.found && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-amber-900 dark:text-amber-200 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>No panel detected in BoQ:</strong> Using standard{' '}
              <span className="font-mono font-semibold">2,278mm × 1,134mm (625W)</span>.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onSwitchTab('items')}
            className="text-xs gap-1 border-amber-500/30 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100 cursor-pointer h-6"
          >
            <span>Items Tab</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      )}

      {/* Executive Solar Summary & Metrics Bar */}
      <div className="w-full bg-card border-b border-border px-3 sm:px-4 py-2 shadow-2xs shrink-0 flex flex-col gap-2">
        {/* Upper Row: Active Module Info, Target Capacity, Upload & Sync Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Active Module Chip */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 text-xs font-medium text-foreground">
              <Sun className="size-3.5 text-amber-500 shrink-0" />
              <span className="font-semibold truncate max-w-[170px] sm:max-w-xs">
                {activePanelInfo.dimensions.modelName.replace(/\(.*?\)/g, '').trim() || 'Solar PV Module'}
              </span>
              <span className="text-muted-foreground font-mono text-[11px] shrink-0">
                {activePanelInfo.dimensions.wattage}W • {activePanelInfo.quantity} pcs
              </span>
            </div>

            {targetBoqKwp > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono shrink-0">
                {targetBoqKwp.toFixed(2)} kWp Target
              </span>
            )}

            {/* Live Multi-Tier Cache Status Indicator */}
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border/70 text-[11px] font-mono text-muted-foreground shrink-0 select-none"
              title="Continuous multi-tier persistence (Memory, LocalStorage, IndexedDB, Invoice)"
            >
              <span className={cn('size-2 rounded-full transition-colors', isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500')} />
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : lastSavedTime ? `Cached ${lastSavedTime}` : 'Live Cached'}</span>
              <span className="sm:hidden">{isSaving ? '...' : 'Saved'}</span>
            </div>
          </div>

          {/* Right: Upload Photo & Sync to BoQ CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={triggerImageUpload}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md border border-border/80 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Upload aerial roof imagery or satellite photo"
            >
              <Upload className="size-3 text-muted-foreground" />
              <span className="hidden sm:inline">{backgroundImageUrl ? 'Change Photo' : 'Upload Photo'}</span>
              <span className="sm:hidden">Photo</span>
            </button>

            {/* Download Plan CTA */}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleDownloadPlan}
              className="h-7 px-2.5 text-xs border-border/80 hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer shadow-2xs font-medium"
              title="Download high-resolution architectural solar plan (PNG)"
            >
              <Download className="size-3 text-blue-500" />
              <span className="hidden sm:inline">Download Plan</span>
              <span className="sm:hidden">Download</span>
            </Button>

            {metrics.validPanelsCount > 0 && (
              <Button
                type="button"
                variant="default"
                size="xs"
                onClick={handleSyncToInvoice}
                className={cn(
                  'text-xs gap-1.5 transition-all cursor-pointer h-7 font-semibold shadow-xs',
                  syncSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
                title="Update the quotation line item quantity in Items tab to match placed valid panels"
              >
                {syncSuccess ? (
                  <>
                    <CheckCircle2 className="size-3.5 animate-bounce" />
                    <span>Updated BoQ!</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5" />
                    <span>Sync to BoQ ({metrics.validPanelsCount} pcs)</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Lower Row: 3-Column Engineering Metrics Widget */}
        <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2 rounded-lg border border-border/60 items-center">
          {/* Metric 1: Panels Placed */}
          <div className="flex flex-col pl-1 sm:pl-2">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Panels Placed
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-bold font-mono text-foreground">
                {metrics.validPanelsCount}
              </span>
              {activePanelInfo.quantity > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  / {activePanelInfo.quantity}
                </span>
              )}
              {activePanelInfo.quantity > 0 && metrics.validPanelsCount === activePanelInfo.quantity && (
                <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded ml-1">
                  ✓ Matched
                </span>
              )}
              {metrics.invalidPanelsCount > 0 && (
                <span className="text-[10px] text-rose-500 font-medium ml-0.5" title="Panels outside roof boundary">
                  (+{metrics.invalidPanelsCount})
                </span>
              )}
            </div>
          </div>

          {/* Metric 2: Array Output kWp */}
          <div className="flex flex-col border-x border-border/60 px-2 sm:px-4">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Array Output
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                {metrics.totalCapacityKwp.toFixed(2)}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">kWp</span>
              {currentTiltAngle > 0 && (
                <span className="hidden sm:inline-flex items-center text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/15 px-1 py-0.2 rounded ml-1 font-mono">
                  ∠{currentTiltAngle}°
                </span>
              )}
            </div>
          </div>

          {/* Metric 3: Roof Area & Coverage */}
          <div className="flex flex-col pr-1 sm:pr-2">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Roof Coverage
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm sm:text-base font-bold font-mono text-foreground">
                {metrics.panelsTotalAreaM2.toFixed(1)}m²
              </span>
              {metrics.roofPolygonAreaM2 > 0 && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ({metrics.utilizationRatePercent.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar Controls */}
      <RoofControls
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        imageOpacity={imageOpacity}
        onChangeOpacity={handleOpacityChange}
        orientation={orientation}
        onToggleOrientation={() =>
          setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))
        }
        onAutoFill={handleAutoFill}
        canAutoFill={polygon.isClosed && polygon.points.length >= 3}
        onAddSinglePanel={handleAddSinglePanel}
        canAddPanel={true}
        onClearBoundary={handleClearBoundary}
        hasBoundary={polygon.points.length > 0}
        onClearPanels={handleClearPanels}
        hasPanels={placedPanels.length > 0}
        onResetAll={handleResetAll}
        zoom={viewport.zoom}
        onZoomIn={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: Math.min(4.0, prev.zoom * 1.2),
          }))
        }
        onZoomOut={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: Math.max(0.3, prev.zoom * 0.83),
          }))
        }
        onResetZoom={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: 1.0,
          }))
        }
        onCenterFitView={() => setCenterFitTrigger((prev) => prev + 1)}
        isCalibrated={scale.isCalibrated}
        pixelsPerMeter={scale.pixelsPerMeter}
        onOpenScaleModal={() => setActiveTool('scale')}
        onOpenRoofSizeModal={() => setRoofSizeModalOpen(true)}
        onPlaceBoqPanels={handlePlaceBoqPanels}
        targetBoqCount={activePanelInfo.quantity}
        isDrawingPolygon={!polygon.isClosed && polygon.points.length >= 3}
        onClosePolygon={() => {
          if (!polygon.isClosed && polygon.points.length >= 3) {
            const closedPoly: RoofPolygon = { ...polygon, isClosed: true }
            setPolygon(closedPoly)
            setPlacedPanels((prev) =>
              prev.map((p) => ({
                ...p,
                isValid: isPanelInsidePolygon(p, closedPoly.points),
              }))
            )
            setActiveTool('select')
          }
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        enableSnapping={enableSnapping}
        onToggleSnapping={() => setEnableSnapping((prev) => !prev)}
        isRoofLocked={isRoofLocked}
        onToggleRoofLock={() => setIsRoofLocked((prev) => !prev)}
        onDownloadLayout={handleDownloadPlan}
        selectedPanelId={selectedPanelId}
        currentTiltAngle={currentTiltAngle}
        currentRotation={currentRotation}
        onCycleTilt={handleCycleTilt}
        onRotateSelected={handleRotateSelected}
        onSetSelectedRotation={handleSetSelectedRotation}
        onRotateAllPanels={handleRotateAllPanels}
        onApplyTiltToAll={handleApplyTiltToAll}
        onApplyRotationToAll={handleApplyRotationToAll}
      />

      {/* Main Canvas Viewport (Responsive height on mobile, full flex on desktop, fullscreen modal support) */}
      <div
        className={cn(
          "w-full transition-all duration-200 shrink-0",
          isFullscreen
            ? "fixed inset-0 z-50 bg-zinc-950 flex flex-col h-screen w-screen"
            : "relative h-[520px] sm:h-[600px] lg:h-full min-h-[460px] sm:min-h-[520px] flex-1 overflow-hidden"
        )}
      >
        {isFullscreen && (
          <div className="absolute top-3 right-3 z-50 flex items-center gap-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 px-3 py-1.5 rounded-lg shadow-2xl">
            <span className="text-xs text-zinc-300 font-medium font-mono">
              {metrics.validPanelsCount}/{activePanelInfo.quantity} Modules ({metrics.totalCapacityKwp.toFixed(2)} kWp)
            </span>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold ml-2"
            >
              <span>Exit Fullscreen</span>
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <RoofCanvas
          backgroundImageUrl={backgroundImageUrl}
          imageOpacity={imageOpacity}
          polygon={polygon}
          onUpdatePolygon={setPolygon}
          placedPanels={placedPanels}
          onUpdatePanels={setPlacedPanels}
          scale={scale}
          onUpdateScale={setScale}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          panelDimensions={activePanelInfo.dimensions}
          orientation={orientation}
          interPanelGapMm={interPanelGapMm}
          viewport={viewport}
          onUpdateViewport={setViewport}
          onUploadImageClick={triggerImageUpload}
          centerFitTrigger={centerFitTrigger}
          enableSnapping={enableSnapping}
          onToggleSnapping={() => setEnableSnapping((prev) => !prev)}
          isRoofLocked={isRoofLocked}
          onToggleRoofLock={() => setIsRoofLocked((prev) => !prev)}
          selectedPanelId={selectedPanelId}
          onSelectPanel={setSelectedPanelId}
        />
      </div>

      {/* Helpful Keyboard & Interaction Guide Footer */}
      <div className="border-t border-border px-4 py-1.5 bg-muted/30 hidden sm:flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">R</kbd>
            Draw Roof Box
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">P</kbd>
            Trace Boundary
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">V</kbd>
            Select & Drag
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">[ / ]</kbd>
            Tilt Angle (±15°)
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">T</kbd>
            Rack Tilt
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">S</kbd>
            Calibrate Scale
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Alt</kbd>
            Hold to Invert Snap
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Space</kbd>
            Pan Canvas
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Del</kbd>
            Delete Panel
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500" />
            Valid Active Module
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            Out of Boundary (Excluded from kWp)
          </span>
        </div>
      </div>
    </div>
  )
}
