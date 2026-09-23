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
  Quad,
} from '@/types/roof'
import {
  calculatePolygonAreaM2,
  generateAutoGrid,
  isPanelInsidePolygon,
  createRectangularRoofPolygon,
  generateTargetBoqPanels,
  sqmToSqft,
  rotatePanelsAsArray,
  setPanelsArrayRotation,
  rotateSinglePanel,
  alignPanelsCollinear,
  getPanelCorners,
} from '@/utils/geometry'
import {
  isQuadInsidePolygon,
  applyPresetPerspectiveToPanels,
} from '@/utils/homography'
import { downloadRoofLayoutPng } from '@/utils/roofExport'
import {
  saveRoofWorkspace,
  loadRoofWorkspaceSync,
  loadRoofWorkspaceAsync,
  clearRoofWorkspace,
  toLightweightRoofState,
} from '@/utils/roofStorage'
import { RoofCanvas } from './RoofCanvas'
import {
  RoofControls,
  RoofToolPalette,
  RoofOptionsBar,
  RoofStudioDock,
  RoofStatusBar,
  RoofShortcutsCheatSheet,
} from './RoofControls'
import { RoofSizeModal } from './RoofSizeModal'
import { LineItem, Invoice } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Sun,
  Monitor,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Upload,
  Info,
  CheckCircle2,
  HelpCircle,
  Grid,
  Ruler,
  X,
  Download,
  Save,
  Undo2,
  Redo2,
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

export const isPlaceholderAerialImage = (url: string | null | undefined): boolean => {
  if (!url) return false
  return url === DEFAULT_AERIAL_IMAGE || url === '/roof-aerial-default.webp'
}

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
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(() => {
    const cached = initialWorkspace?.backgroundImageUrl
    if (isPlaceholderAerialImage(cached)) {
      return null
    }
    return cached ?? null
  })
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
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([])
  const selectedPanelId = selectedPanelIds[0] || null
  const [defaultTiltAngle, setDefaultTiltAngle] = useState<number>(
    () => (typeof initialWorkspace?.defaultTiltAngle === 'number' ? initialWorkspace.defaultTiltAngle : 0)
  )
  const [defaultRotation, setDefaultRotation] = useState<number>(
    () => (typeof initialWorkspace?.defaultRotation === 'number' ? initialWorkspace.defaultRotation : 0)
  )

  // Helper to accurately verify panel validity in polygon (checks customQuad if warped, else rectangular corners)
  const checkPanelValidity = useCallback(
    (panel: PlacedPanel, poly: RoofPolygon): boolean => {
      if (!poly.isClosed || poly.points.length < 3) return false
      if (panel.customQuad) {
        return isQuadInsidePolygon(panel.customQuad, poly.points)
      }
      return isPanelInsidePolygon(panel, poly.points)
    },
    []
  )

  const [syncSuccess, setSyncSuccess] = useState(false)
  const [roofSizeModalOpen, setRoofSizeModalOpen] = useState(false)
  const [centerFitTrigger, setCenterFitTrigger] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)
  const [activeDockTab, setActiveDockTab] = useState<'properties' | 'layers' | 'shortcuts'>('properties')
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false)

  // Undo / Redo History Stack Management
  const [undoStack, setUndoStack] = useState<{
    polygon: RoofPolygon
    placedPanels: PlacedPanel[]
    scale: ScaleCalibration
    orientation: PanelOrientation
    defaultRotation: number
    defaultTiltAngle: number
  }[]>([])
  const [redoStack, setRedoStack] = useState<{
    polygon: RoofPolygon
    placedPanels: PlacedPanel[]
    scale: ScaleCalibration
    orientation: PanelOrientation
    defaultRotation: number
    defaultTiltAngle: number
  }[]>([])

  const historyStateRef = useRef({
    polygon,
    placedPanels,
    scale,
    orientation,
    defaultRotation,
    defaultTiltAngle,
  })

  const lastSavedStateJsonRef = useRef<string>('')
  const lastSyncedInvoiceJsonRef = useRef<string>('')

  useEffect(() => {
    historyStateRef.current = {
      polygon,
      placedPanels,
      scale,
      orientation,
      defaultRotation,
      defaultTiltAngle,
    }
  }, [
    polygon,
    placedPanels,
    scale,
    orientation,
    defaultRotation,
    defaultTiltAngle,
  ])

  const takeSnapshot = useCallback(() => {
    const s = historyStateRef.current
    return {
      polygon: JSON.parse(JSON.stringify(s.polygon)),
      placedPanels: JSON.parse(JSON.stringify(s.placedPanels)),
      scale: JSON.parse(JSON.stringify(s.scale)),
      orientation: s.orientation,
      defaultRotation: s.defaultRotation,
      defaultTiltAngle: s.defaultTiltAngle,
    }
  }, [])

  const pushHistorySnapshot = useCallback(() => {
    const current = takeSnapshot()
    setUndoStack((prev) => {
      const last = prev[prev.length - 1]
      if (
        last &&
        JSON.stringify(last.polygon) === JSON.stringify(current.polygon) &&
        JSON.stringify(last.placedPanels) === JSON.stringify(current.placedPanels) &&
        JSON.stringify(last.scale) === JSON.stringify(current.scale) &&
        last.orientation === current.orientation &&
        last.defaultRotation === current.defaultRotation &&
        last.defaultTiltAngle === current.defaultTiltAngle
      ) {
        return prev
      }
      const next = [...prev, current]
      if (next.length > 50) return next.slice(next.length - 50)
      return next
    })
    setRedoStack([])
  }, [takeSnapshot])

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo
      const previousSnapshot = prevUndo[prevUndo.length - 1]
      const nextUndo = prevUndo.slice(0, prevUndo.length - 1)

      const currentSnapshot = takeSnapshot()
      setRedoStack((prevRedo) => [...prevRedo, currentSnapshot])

      setPolygon(previousSnapshot.polygon)
      setPlacedPanels(previousSnapshot.placedPanels)
      setScale(previousSnapshot.scale)
      setOrientation(previousSnapshot.orientation)
      setDefaultRotation(previousSnapshot.defaultRotation)
      setDefaultTiltAngle(previousSnapshot.defaultTiltAngle)

      return nextUndo
    })
  }, [takeSnapshot])

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo
      const nextSnapshot = prevRedo[prevRedo.length - 1]
      const nextRedo = prevRedo.slice(0, prevRedo.length - 1)

      const currentSnapshot = takeSnapshot()
      setUndoStack((prevUndo) => [...prevUndo, currentSnapshot])

      setPolygon(nextSnapshot.polygon)
      setPlacedPanels(nextSnapshot.placedPanels)
      setScale(nextSnapshot.scale)
      setOrientation(nextSnapshot.orientation)
      setDefaultRotation(nextSnapshot.defaultRotation)
      setDefaultTiltAngle(nextSnapshot.defaultTiltAngle)

      return nextRedo
    })
  }, [takeSnapshot])

  // Select all placed panels
  const handleSelectAll = useCallback(() => {
    setSelectedPanelIds(placedPanels.map((p) => p.id))
  }, [placedPanels])

  // Group / Ungroup / Duplicate / 3D Perspective Preset Handlers
  const handleGroupSelected = useCallback(() => {
    if (selectedPanelIds.length < 2) return
    pushHistorySnapshot()
    const newGroupId = `group-${Date.now()}`
    setPlacedPanels((prev) =>
      prev.map((p) =>
        selectedPanelIds.includes(p.id)
          ? { ...p, groupId: newGroupId }
          : p
      )
    )
  }, [selectedPanelIds, pushHistorySnapshot])

  const handleUngroupSelected = useCallback(() => {
    if (selectedPanelIds.length === 0) return
    pushHistorySnapshot()
    setPlacedPanels((prev) =>
      prev.map((p) => {
        if (selectedPanelIds.includes(p.id)) {
          const { groupId, ...rest } = p
          return rest
        }
        return p
      })
    )
  }, [selectedPanelIds, pushHistorySnapshot])

  const handleDuplicateSelected = useCallback(() => {
    if (selectedPanelIds.length === 0) return
    pushHistorySnapshot()

    const toDuplicate = placedPanels.filter((p) => selectedPanelIds.includes(p.id))
    if (toDuplicate.length === 0) return

    const oldGroupId = toDuplicate[0]?.groupId
    const allSameGroup = oldGroupId && toDuplicate.every((p) => p.groupId === oldGroupId)
    const newGroupId = allSameGroup ? `group-${Date.now()}` : undefined

    const clonedIds: string[] = []
    const clonedPanels: PlacedPanel[] = toDuplicate.map((p, idx) => {
      const newId = `panel-cloned-${Date.now()}-${idx}`
      clonedIds.push(newId)

      let newCustomQuad: [Point, Point, Point, Point] | undefined
      if (p.customQuad) {
        newCustomQuad = [
          { x: p.customQuad[0].x + 25, y: p.customQuad[0].y + 25 },
          { x: p.customQuad[1].x + 25, y: p.customQuad[1].y + 25 },
          { x: p.customQuad[2].x + 25, y: p.customQuad[2].y + 25 },
          { x: p.customQuad[3].x + 25, y: p.customQuad[3].y + 25 },
        ]
      }

      const candidate: PlacedPanel = {
        ...p,
        id: newId,
        x: p.x + 25,
        y: p.y + 25,
        groupId: p.groupId ? (newGroupId ?? `group-${Date.now()}-${idx}`) : undefined,
        customQuad: newCustomQuad,
        isValid: false,
      }
      candidate.isValid = checkPanelValidity(candidate, polygon)
      return candidate
    })

    setPlacedPanels((prev) => [...prev, ...clonedPanels])
    setSelectedPanelIds(clonedIds)
  }, [selectedPanelIds, placedPanels, polygon, checkPanelValidity, pushHistorySnapshot])

  const handleApplyPerspectivePreset = useCallback(
    (preset: 'pitch-up' | 'pitch-down' | 'pitch-left' | 'pitch-right' | 'reset') => {
      if (selectedPanelIds.length === 0) return
      pushHistorySnapshot()

      const selectedPanels = placedPanels.filter((p) => selectedPanelIds.includes(p.id))
      const warpedSelected = applyPresetPerspectiveToPanels(selectedPanels, preset)

      const updatedMap = new Map<string, PlacedPanel>()
      warpedSelected.forEach((p) => {
        updatedMap.set(p.id, {
          ...p,
          isValid: checkPanelValidity(p, polygon),
        })
      })

      setPlacedPanels((prev) =>
        prev.map((p) => (updatedMap.has(p.id) ? updatedMap.get(p.id)! : p))
      )
    },
    [selectedPanelIds, placedPanels, polygon, checkPanelValidity, pushHistorySnapshot]
  )



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
      if (asyncState?.backgroundImageUrl && !isPlaceholderAerialImage(asyncState.backgroundImageUrl)) {
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

    const timer = setTimeout(() => {
      const lightweight = toLightweightRoofState(currentState)
      const lightweightJson = JSON.stringify(lightweight)

      // Exclude viewport from save trigger so simple canvas panning doesn't trigger multi-tier storage
      const stateToCompare = { ...currentState, viewport: null }
      const stateJson = JSON.stringify(stateToCompare)

      if (stateJson !== lastSavedStateJsonRef.current) {
        lastSavedStateJsonRef.current = stateJson
        setIsSaving(true)
        saveRoofWorkspace(currentState, invoice.invoiceNumber).then(() => {
          setIsSaving(false)
          const d = new Date()
          setLastSavedTime(
            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
          )
        })
      }

      // Sync lightweight version into invoice record only when meaningful changes occurred
      if (lightweightJson !== lastSyncedInvoiceJsonRef.current) {
        lastSyncedInvoiceJsonRef.current = lightweightJson
        onUpdateInvoice('roofLayout', lightweight)
      }
    }, 400)

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

  // Rotate selected panels by delta (e.g. +/- 1° or +/- 15°), or rotate entire array around centroid if none selected
  const handleRotateSelected = useCallback(
    (delta: number) => {
      pushHistorySnapshot()
      const polyPts = polygon.isClosed ? polygon.points : undefined

      // If no panels selected, rotate ALL panels around array centroid
      if (selectedPanelIds.length === 0) {
        setDefaultRotation((prevRot) => Math.round(((((prevRot + delta) % 360) + 360) % 360) * 10) / 10)
        setPlacedPanels((prev) => rotatePanelsAsArray(prev, delta, polyPts))
        return
      }

      // If only 1 panel selected, rotate it around its own center
      if (selectedPanelIds.length === 1) {
        const targetId = selectedPanelIds[0]
        setPlacedPanels((prev) =>
          prev.map((panel) => {
            if (panel.id !== targetId) return panel
            return rotateSinglePanel(panel, delta, undefined, polyPts)
          })
        )
        return
      }

      // If multiple panels selected, rotate the selected panels together around their collective centroid!
      const selectedPanels = placedPanels.filter((p) => selectedPanelIds.includes(p.id))
      const rotatedSelected = rotatePanelsAsArray(selectedPanels, delta, polyPts)
      const rotatedMap = new Map(rotatedSelected.map((p) => [p.id, p]))

      setPlacedPanels((prev) =>
        prev.map((panel) => (rotatedMap.has(panel.id) ? rotatedMap.get(panel.id)! : panel))
      )
    },
    [selectedPanelIds, placedPanels, polygon, pushHistorySnapshot]
  )

  // Set rotation directly (for selected panels, or all panels if none selected)
  const handleSetSelectedRotation = useCallback(
    (angle: number) => {
      pushHistorySnapshot()
      const normalized = Math.round((((angle % 360) + 360) % 360) * 10) / 10
      const polyPts = polygon.isClosed ? polygon.points : undefined

      if (selectedPanelIds.length === 0) {
        setDefaultRotation(normalized)
        setPlacedPanels((prev) => setPanelsArrayRotation(prev, normalized, polyPts))
        return
      }

      if (selectedPanelIds.length === 1) {
        const targetId = selectedPanelIds[0]
        setPlacedPanels((prev) =>
          prev.map((panel) => {
            if (panel.id !== targetId) return panel
            const currentRot = panel.rotation || 0
            let delta = normalized - currentRot
            while (delta > 180) delta -= 360
            while (delta < -180) delta += 360
            return rotateSinglePanel(panel, delta, undefined, polyPts)
          })
        )
        return
      }

      // Multiple panels selected: rotate them so the lead panel matches normalized
      const selectedPanels = placedPanels.filter((p) => selectedPanelIds.includes(p.id))
      const refAngle = selectedPanels[0]?.rotation || 0
      let delta = normalized - refAngle
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360

      const rotatedSelected = rotatePanelsAsArray(selectedPanels, delta, polyPts)
      const rotatedMap = new Map(rotatedSelected.map((p) => [p.id, p]))

      setPlacedPanels((prev) =>
        prev.map((panel) => (rotatedMap.has(panel.id) ? rotatedMap.get(panel.id)! : panel))
      )
    },
    [selectedPanelIds, placedPanels, polygon, pushHistorySnapshot]
  )

  // Apply rotation to all panels in the array (rotates entire array around centroid + aligns collinear)
  const handleApplyRotationToAll = useCallback(
    (angle: number) => {
      pushHistorySnapshot()
      const normalized = Math.round((((angle % 360) + 360) % 360) * 10) / 10
      setDefaultRotation(normalized)
      setPlacedPanels((prev) => setPanelsArrayRotation(prev, normalized, polygon.isClosed ? polygon.points : undefined))
    },
    [polygon, pushHistorySnapshot]
  )

  // Set selected panels tilt directly
  const handleSetSelectedTilt = useCallback(
    (tiltAngle: number) => {
      if (selectedPanelIds.length === 0) return
      pushHistorySnapshot()
      setPlacedPanels((prev) =>
        prev.map((panel) => {
          if (!selectedPanelIds.includes(panel.id)) return panel
          return {
            ...panel,
            tiltAngle,
          }
        })
      )
    },
    [selectedPanelIds, pushHistorySnapshot]
  )

  // Cycle tilt
  const TILT_ANGLES = [0, 10, 15, 20, 25, 30]
  const handleCycleTilt = useCallback(() => {
    pushHistorySnapshot()
    if (selectedPanelIds.length > 0) {
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
  }, [selectedPanelIds, selectedPanel, defaultTiltAngle, handleSetSelectedTilt, pushHistorySnapshot])

  // Apply tilt to all panels in the array
  const handleApplyTiltToAll = useCallback(
    (tiltAngle: number) => {
      pushHistorySnapshot()
      setDefaultTiltAngle(tiltAngle)
      setPlacedPanels((prev) =>
        prev.map((panel) => ({
          ...panel,
          tiltAngle,
        }))
      )
    },
    [pushHistorySnapshot]
  )

  // Rotate all panels in the array by delta around the array centroid
  const handleRotateAllPanels = useCallback(
    (delta: number) => {
      pushHistorySnapshot()
      setDefaultRotation((prevRot) => Math.round(((((prevRot + delta) % 360) + 360) % 360) * 10) / 10)
      setPlacedPanels((prev) => rotatePanelsAsArray(prev, delta, polygon.isClosed ? polygon.points : undefined))
    },
    [polygon, pushHistorySnapshot]
  )

  // Straighten / Collinear Align All Panels in Rows
  const handleAlignCollinear = useCallback(() => {
    pushHistorySnapshot()
    setPlacedPanels((prev) => alignPanelsCollinear(prev, polygon.isClosed ? polygon.points : undefined))
  }, [polygon, pushHistorySnapshot])

  // Window keydown listener for global shortcuts: Undo, Redo, Select All, Group, Ungroup, Duplicate, Rotate ([ / ])
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        handleRedo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        handleSelectAll()
      } else if (e.key === 'Escape') {
        setSelectedPanelIds([])
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault()
        handleGroupSelected()
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'g' || e.key === 'G')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault()
        handleUngroupSelected()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        handleDuplicateSelected()
      } else if (e.key === '[' || e.key === '{') {
        e.preventDefault()
        handleRotateSelected(e.shiftKey ? -1 : -15)
      } else if (e.key === ']' || e.key === '}') {
        e.preventDefault()
        handleRotateSelected(e.shiftKey ? 1 : 15)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    handleUndo,
    handleRedo,
    handleSelectAll,
    handleGroupSelected,
    handleUngroupSelected,
    handleDuplicateSelected,
    handleRotateSelected,
  ])

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
    pushHistorySnapshot()

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
    setSelectedPanelIds(newGrid.map((p) => p.id))
    setActiveTool('select')
  }

  // Place BoQ Target Panels (e.g. exactly 6 panels for 4kW setup)
  const handlePlaceBoqPanels = useCallback(() => {
    pushHistorySnapshot()
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
      setSelectedPanelIds(panels.map((p) => p.id))
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
    setSelectedPanelIds(panels.map((p) => p.id))
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
    pushHistorySnapshot,
  ])

  // Apply user-defined Roof Dimensions from RoofSizeModal (meters, feet, or sqm)
  const handleApplyRoofSize = (widthM: number, lengthM: number, autoPlaceBoq: boolean) => {
    pushHistorySnapshot()
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
      setSelectedPanelIds(panels.map((p) => p.id))
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
    pushHistorySnapshot()
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
    setSelectedPanelIds([newPanel.id])
    setActiveTool('select')
  }

  // Clear Boundary
  const handleClearBoundary = () => {
    if (confirm('Clear the traced roof boundary?')) {
      pushHistorySnapshot()
      const emptyPoly: RoofPolygon = { points: [], isClosed: false }
      setPolygon(emptyPoly)
      setPlacedPanels((prev) => prev.map((p) => ({ ...p, isValid: false })))
    }
  }

  // Clear Panels
  const handleClearPanels = () => {
    if (confirm('Remove all placed solar panels from the canvas?')) {
      pushHistorySnapshot()
      setPlacedPanels([])
      setSelectedPanelIds([])
    }
  }

  // Reset All
  const handleResetAll = () => {
    if (confirm('Reset roof layout workspace? (Boundary and panels will be cleared)')) {
      pushHistorySnapshot()
      setPolygon({ points: [], isClosed: false })
      setPlacedPanels([])
      setSelectedPanelIds([])
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

      {/* Non-PC / Mobile / Tablet Fallback Screen */}
      <div className="lg:hidden flex flex-col items-center justify-center p-8 text-center min-h-[480px] bg-[#18181b] text-zinc-300 gap-4 flex-1 select-none">
        <div className="size-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-lg">
          <Monitor className="size-8" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-lg font-bold text-zinc-100 font-mono">
            PC View Required
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The Solar Roof Studio & CAD Planner is designed specifically for desktop and PC displays (minimum 1,024px width). Precision mouse drafting, homography perspective alignment, and keyboard shortcuts require a larger display.
          </p>
        </div>
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 max-w-xs w-full text-left text-[11px] text-zinc-400 space-y-2 font-mono">
          <div className="flex items-center gap-2 text-zinc-300 font-semibold">
            <span className="size-1.5 rounded-full bg-sky-400" />
            <span>4-Point Homography Perspective</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-300 font-semibold">
            <span className="size-1.5 rounded-full bg-sky-400" />
            <span>Photoshop Hotkeys (V, P, R, S, T)</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-300 font-semibold">
            <span className="size-1.5 rounded-full bg-sky-400" />
            <span>High-Res Aerial Solar CAD</span>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => onSwitchTab('items')}
          className="mt-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-md"
        >
          <span>Return to Items Tab</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {/* PC View Workspace (Strictly visible on lg: and above) */}
      <div className="hidden lg:flex flex-col flex-1 min-h-0 w-full">
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

      {/* 1. Photoshop Application & Document Header */}
      <div className="w-full bg-[#18181b] border-b border-zinc-800 px-3 py-1.5 flex items-center justify-between text-zinc-300 gap-2 shrink-0 select-none shadow-xs">
        {/* Left: Document Tab & Spec Readout */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {/* Photoshop Document Tab */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#252528] border-t-2 border-t-sky-500 border-x border-b-0 border-zinc-700/80 rounded-t text-xs font-semibold text-zinc-100 shadow-xs">
            <Sun className="size-3.5 text-amber-400" />
            <span className="font-mono">
              PV Plan — #{invoice.invoiceNumber || 'Workspace'}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              ({Math.round(viewport.zoom * 100)}%)
            </span>
          </div>

          {/* Module Specs Tag */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
            <span className="text-zinc-200 font-medium truncate max-w-[150px]">
              {activePanelInfo.dimensions.modelName.replace(/\(.*?\)/g, '').trim()}
            </span>
            <span className="text-zinc-400 font-mono">
              {activePanelInfo.dimensions.wattage}W • {activePanelInfo.quantity} pcs
            </span>
          </div>

          {targetBoqKwp > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
              {targetBoqKwp.toFixed(2)} kWp Target
            </span>
          )}

          {/* Live Multi-Tier Cache Status */}
          <div
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono text-zinc-400 select-none"
            title="Continuous auto-save (Memory, LocalStorage, IndexedDB, Invoice)"
          >
            <span className={cn('size-1.5 rounded-full transition-colors', isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500')} />
            <span className="hidden md:inline">{isSaving ? 'Saving...' : lastSavedTime ? `Cached ${lastSavedTime}` : 'Live Cached'}</span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 rounded border border-zinc-700/80 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-900/90"
            title="Undo last change (Ctrl+Z)"
          >
            <Undo2 className="size-3 text-amber-400" />
            <span className="hidden sm:inline">Undo</span>
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 rounded border border-zinc-700/80 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-900/90"
            title="Redo change (Ctrl+Y)"
          >
            <Redo2 className="size-3 text-amber-400" />
            <span className="hidden sm:inline">Redo</span>
          </button>

          <button
            type="button"
            onClick={triggerImageUpload}
            className="h-7 px-2.5 text-xs text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 rounded border border-zinc-700/80 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Upload aerial roof imagery or satellite photo"
          >
            <Upload className="size-3 text-zinc-400" />
            <span className="hidden sm:inline">{backgroundImageUrl ? 'Change Photo' : 'Upload Photo'}</span>
            <span className="sm:hidden">Photo</span>
          </button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleDownloadPlan}
            className="h-7 px-2.5 text-xs border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white flex items-center gap-1.5 cursor-pointer shadow-2xs font-medium"
            title="Download architectural solar plan (PNG)"
          >
            <Download className="size-3 text-sky-400" />
            <span className="hidden sm:inline">Download Plan</span>
            <span className="sm:hidden">Plan</span>
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
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              )}
              title="Sync valid placed panels count to invoice items"
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

      {/* 2. Photoshop Dynamic Contextual Options Bar */}
      <RoofOptionsBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        selectedPanelId={selectedPanelId}
        selectedPanelIds={selectedPanelIds}
        onSelectPanels={setSelectedPanelIds}
        placedPanels={placedPanels}
        onSelectAll={handleSelectAll}
        onGroupSelected={handleGroupSelected}
        onUngroupSelected={handleUngroupSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onApplyPerspectivePreset={handleApplyPerspectivePreset}
        currentRotation={currentRotation}
        currentTiltAngle={currentTiltAngle}
        orientation={orientation}
        onToggleOrientation={() => {
          pushHistorySnapshot()
          setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))
        }}
        onCycleTilt={handleCycleTilt}
        onApplyTiltToAll={handleApplyTiltToAll}
        onRotateSelected={handleRotateSelected}
        onSetSelectedRotation={handleSetSelectedRotation}
        onRotateAllPanels={handleRotateAllPanels}
        onApplyRotationToAll={handleApplyRotationToAll}
        onAlignCollinear={handleAlignCollinear}
        isDrawingPolygon={!polygon.isClosed && polygon.points.length >= 3}
        onClosePolygon={() => {
          if (!polygon.isClosed && polygon.points.length >= 3) {
            pushHistorySnapshot()
            const closedPoly: RoofPolygon = { ...polygon, isClosed: true }
            setPolygon(closedPoly)
            setPlacedPanels((prev) =>
              prev.map((p) => ({
                ...p,
                isValid: checkPanelValidity(p, closedPoly),
              }))
            )
            setActiveTool('select')
          }
        }}
        onOpenRoofSizeModal={() => setRoofSizeModalOpen(true)}
        isCalibrated={scale.isCalibrated}
        pixelsPerMeter={scale.pixelsPerMeter}
        enableSnapping={enableSnapping}
        onToggleSnapping={() => setEnableSnapping((prev) => !prev)}
        isRoofLocked={isRoofLocked}
        onToggleRoofLock={() => setIsRoofLocked((prev) => !prev)}
        hasBoundary={polygon.points.length > 0}
        polygon={polygon}
        canAutoFill={polygon.isClosed && polygon.points.length >= 3}
        onAutoFill={handleAutoFill}
        targetBoqCount={activePanelInfo.quantity}
        onPlaceBoqPanels={handlePlaceBoqPanels}
        canAddPanel={true}
        onAddSinglePanel={handleAddSinglePanel}
        canUndo={undoStack.length > 0}
        onUndo={handleUndo}
        canRedo={redoStack.length > 0}
        onRedo={handleRedo}
      />

      {/* 3. Photoshop Studio Workspace (Left Palette + Center Canvas + Right Studio Dock) */}
      <div className="w-full flex flex-1 relative overflow-hidden bg-[#18181b] min-h-[580px]">
        {/* Left: Photoshop Vertical Tool Palette */}
        <RoofToolPalette
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          isDrawingPolygon={!polygon.isClosed && polygon.points.length >= 3}
          onClosePolygon={() => {
            if (!polygon.isClosed && polygon.points.length >= 3) {
              pushHistorySnapshot()
              const closedPoly: RoofPolygon = { ...polygon, isClosed: true }
              setPolygon(closedPoly)
              setPlacedPanels((prev) =>
                prev.map((p) => ({
                  ...p,
                  isValid: checkPanelValidity(p, closedPoly),
                }))
              )
              setActiveTool('select')
            }
          }}
          isCalibrated={scale.isCalibrated}
          pixelsPerMeter={scale.pixelsPerMeter}
          canAddPanel={true}
          onAddSinglePanel={handleAddSinglePanel}
          canAutoFill={polygon.isClosed && polygon.points.length >= 3}
          onAutoFill={handleAutoFill}
          targetBoqCount={activePanelInfo.quantity}
          onPlaceBoqPanels={handlePlaceBoqPanels}
          enableSnapping={enableSnapping}
          onToggleSnapping={() => setEnableSnapping((prev) => !prev)}
          hasBoundary={polygon.points.length > 0}
          isRoofLocked={isRoofLocked}
          onToggleRoofLock={() => setIsRoofLocked((prev) => !prev)}
          canUndo={undoStack.length > 0}
          onUndo={handleUndo}
          canRedo={redoStack.length > 0}
          onRedo={handleRedo}
        />

        {/* Center: Canvas Viewport & Bottom Status Bar */}
        <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
          <div className="relative flex-1 w-full h-full overflow-hidden">
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
              selectedPanelIds={selectedPanelIds}
              onSelectPanels={setSelectedPanelIds}
              onGroupSelected={handleGroupSelected}
              onUngroupSelected={handleUngroupSelected}
              onDuplicateSelected={handleDuplicateSelected}
              onApplyPerspectivePreset={handleApplyPerspectivePreset}
              onRotateSelected={handleRotateSelected}
              onRotateAllPanels={handleRotateAllPanels}
              onSetSelectedRotation={handleSetSelectedRotation}
              hideStatusHud={true}
              onSnapshotBeforeChange={pushHistorySnapshot}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
          </div>

          {/* Bottom Photoshop Document Status Bar */}
          <RoofStatusBar
            activeTool={activeTool}
            scalePixelsPerMeter={scale.pixelsPerMeter}
            isCalibrated={scale.isCalibrated}
            enableSnapping={enableSnapping}
            onToggleSnapping={() => setEnableSnapping((prev) => !prev)}
            isRoofLocked={isRoofLocked}
            onToggleRoofLock={() => setIsRoofLocked((prev) => !prev)}
            selectedCount={selectedPanelIds.length}
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
            onOpenShortcutsGuide={() => {
              setActiveDockTab('shortcuts')
              setIsDockCollapsed(false)
            }}
          />
        </div>

        {/* Right: Photoshop Studio Dock (Properties, Layers, Shortcuts) */}
        <RoofStudioDock
          activeTab={activeDockTab}
          onSelectTab={setActiveDockTab}
          isCollapsed={isDockCollapsed}
          onToggleCollapsed={() => setIsDockCollapsed((prev) => !prev)}
          metrics={metrics}
          activePanelInfo={activePanelInfo}
          polygon={polygon}
          placedPanels={placedPanels}
          selectedPanelId={selectedPanelId}
          selectedPanelIds={selectedPanelIds}
          onSelectPanels={setSelectedPanelIds}
          onSelectAll={handleSelectAll}
          onGroupSelected={handleGroupSelected}
          onUngroupSelected={handleUngroupSelected}
          onDuplicateSelected={handleDuplicateSelected}
          onApplyPerspectivePreset={handleApplyPerspectivePreset}
          currentRotation={currentRotation}
          currentTiltAngle={currentTiltAngle}
          orientation={orientation}
          onToggleOrientation={() =>
            setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))
          }
          onCycleTilt={handleCycleTilt}
          onApplyTiltToAll={handleApplyTiltToAll}
          onRotateSelected={handleRotateSelected}
          onSetSelectedRotation={handleSetSelectedRotation}
          onRotateAllPanels={handleRotateAllPanels}
          onApplyRotationToAll={handleApplyRotationToAll}
          onAlignCollinear={handleAlignCollinear}
          hasBoundary={polygon.points.length > 0}
          isRoofLocked={isRoofLocked}
          onToggleRoofLock={() => setIsRoofLocked((prev) => !prev)}
          onClearBoundary={handleClearBoundary}
          hasPanels={placedPanels.length > 0}
          onClearPanels={handleClearPanels}
          onResetAll={handleResetAll}
          onOpenRoofSizeModal={() => setRoofSizeModalOpen(true)}
          imageOpacity={imageOpacity}
          onChangeOpacity={handleOpacityChange}
          onUploadImageClick={triggerImageUpload}
          onSelectTool={setActiveTool}
        />
      </div>

      {/* 4. Persistent Shortcuts Guide Footer */}
      <RoofShortcutsCheatSheet
        onOpenFullGuide={() => {
          setActiveDockTab('shortcuts')
          setIsDockCollapsed(false)
        }}
      />
      </div>
    </div>
  )
}
