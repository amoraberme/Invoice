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
} from '@/types/roof'
import {
  calculatePolygonAreaM2,
  generateAutoGrid,
  isPanelInsidePolygon,
  createRectangularRoofPolygon,
  generateTargetBoqPanels,
  sqmToSqft,
} from '@/utils/geometry'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoofTabProps {
  invoice: Invoice
  onUpdateInvoice: (field: keyof Invoice, value: any) => void
  onSwitchTab: (tabId: string) => void
}

const STORAGE_KEY = 'mg_invoice_roof_layout_v2'

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

    // Standard physical panel dimensions
    const isLargeFormat = wattage >= 720
    const lengthMm = isLargeFormat ? 2384 : 2278
    const widthMm = isLargeFormat ? 1303 : 1134

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

  // Roof state
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(DEFAULT_AERIAL_IMAGE)
  // Strict Opacity Clamping: 20% (0.2) to 80% (0.8), default 60% (0.6)
  const [imageOpacity, setImageOpacity] = useState<number>(0.6)
  const [polygon, setPolygon] = useState<RoofPolygon>({ points: DEFAULT_ROOF_POINTS, isClosed: true })
  const [placedPanels, setPlacedPanels] = useState<PlacedPanel[]>([])
  const [scale, setScale] = useState<ScaleCalibration>(DEFAULT_SCALE)
  const [activeTool, setActiveTool] = useState<RoofTool>('select')
  const [orientation, setOrientation] = useState<PanelOrientation>('landscape')
  const [interPanelGapMm, setInterPanelGapMm] = useState<number>(20) // 20mm standard clamp gap
  const [enableSnapping, setEnableSnapping] = useState<boolean>(true)
  const [viewport, setViewport] = useState<RoofViewport>(INITIAL_VIEWPORT)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [roofSizeModalOpen, setRoofSizeModalOpen] = useState(false)
  const [centerFitTrigger, setCenterFitTrigger] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Target BoQ capacity
  const targetBoqKwp = (activePanelInfo.quantity * activePanelInfo.dimensions.wattage) / 1000

  // Load persisted roof state from localStorage or auto-seed BoQ panels
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      let loadedImage = DEFAULT_AERIAL_IMAGE
      let loadedOpacity = 0.6
      let loadedPoly: RoofPolygon = { points: DEFAULT_ROOF_POINTS, isClosed: true }
      let loadedPanels: PlacedPanel[] = []
      let loadedScale: ScaleCalibration = DEFAULT_SCALE
      let loadedOrientation: PanelOrientation = 'landscape'
      let loadedSnapping = true

      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.backgroundImageUrl) loadedImage = parsed.backgroundImageUrl
        if (typeof parsed.imageOpacity === 'number') {
          loadedOpacity = Math.min(0.8, Math.max(0.2, parsed.imageOpacity))
        }
        if (
          parsed.polygon &&
          Array.isArray(parsed.polygon.points) &&
          parsed.polygon.points.length >= 3 &&
          parsed.polygon.isClosed
        ) {
          loadedPoly = parsed.polygon
        }
        if (Array.isArray(parsed.placedPanels) && parsed.placedPanels.length > 0) {
          loadedPanels = parsed.placedPanels
        }
        if (parsed.scale && parsed.scale.pixelsPerMeter && parsed.scale.isCalibrated) {
          loadedScale = parsed.scale
        }
        if (parsed.orientation) {
          loadedOrientation = parsed.orientation
        }
        if (typeof parsed.enableSnapping === 'boolean') {
          loadedSnapping = parsed.enableSnapping
        }
      }

      // If no panels loaded yet (or empty in storage), auto-seed the BoQ modules (e.g. 6 panels for 4kW)
      const targetCount = activePanelInfo.quantity > 0 ? activePanelInfo.quantity : 6
      if (loadedPanels.length === 0) {
        loadedPanels = generateTargetBoqPanels(
          loadedPoly.points,
          activePanelInfo.dimensions,
          targetCount,
          loadedOrientation,
          loadedScale.pixelsPerMeter,
          20,
          DEFAULT_ROOF_CENTER
        )
      }

      setBackgroundImageUrl(loadedImage)
      setImageOpacity(loadedOpacity)
      setPolygon(loadedPoly)
      setPlacedPanels(loadedPanels)
      setScale(loadedScale)
      setOrientation(loadedOrientation)
      setEnableSnapping(loadedSnapping)
      setTimeout(() => setCenterFitTrigger((prev) => prev + 1), 100)
    } catch (e) {
      console.error('Failed to load roof layout state', e)
    }
  }, [activePanelInfo.quantity, activePanelInfo.dimensions])

  // Persist roof state on change
  useEffect(() => {
    try {
      const stateToSave = {
        backgroundImageUrl,
        imageOpacity,
        polygon,
        placedPanels,
        scale,
        orientation,
        enableSnapping,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch (e) {
      console.warn('Could not persist roof layout state', e)
    }
  }, [backgroundImageUrl, imageOpacity, polygon, placedPanels, scale, orientation, enableSnapping])

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
      interPanelGapMm
    )

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
        centerPt
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
      centerPt
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
        centerPt
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

  // Synchronize placed valid panels count back to the Items Tab
  const handleSyncToInvoice = () => {
    if (activePanelInfo.panelItem && metrics.validPanelsCount > 0) {
      const updatedLineItems = invoice.lineItems.map((item) => {
        if (item.id === activePanelInfo.panelItem?.id) {
          return { ...item, quantity: metrics.validPanelsCount }
        }
        return item
      })
      onUpdateInvoice('lineItems', updatedLineItems)
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 2500)
    }
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
      {!activePanelInfo.found ? (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-amber-900 dark:text-amber-200 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>No panel detected in Items:</strong> Using fallback{' '}
              <span className="font-mono font-semibold">2,278mm × 1,134mm (625W)</span>.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onSwitchTab('items')}
            className="text-xs gap-1 border-amber-500/30 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100 cursor-pointer"
          >
            <span>Items Tab</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      ) : (
        <div className="bg-muted/40 border-b border-border/80 px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground shrink-0">
              <Sun className="size-3.5 text-amber-500" />
              <span className="hidden sm:inline">Active Module:</span>
            </span>
            <span className="font-medium bg-background px-1.5 py-0.5 rounded border border-border text-foreground truncate max-w-[190px] sm:max-w-none">
              {activePanelInfo.dimensions.modelName}
            </span>
            <span className="text-muted-foreground font-mono text-[11px] shrink-0">
              ({activePanelInfo.dimensions.wattage}W • {activePanelInfo.quantity} pcs)
            </span>
            {targetBoqKwp > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                {targetBoqKwp.toFixed(2)} kWp Target
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={triggerImageUpload}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Upload className="size-3" />
              <span className="hidden sm:inline">{backgroundImageUrl ? 'Change Roof Photo' : 'Upload Roof Photo'}</span>
              <span className="sm:hidden">Photo</span>
            </button>
          </div>
        </div>
      )}

      {/* Prominent Quick Action Banner if 0 panels placed but BoQ has panels */}
      {activePanelInfo.quantity > 0 && metrics.validPanelsCount === 0 && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-emerald-950 dark:text-emerald-100 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>{activePanelInfo.quantity} Panels ({targetBoqKwp.toFixed(2)} kWp)</strong> selected in BoQ. Click below to place automatically:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              onClick={handlePlaceBoqPanels}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 text-xs cursor-pointer shadow-xs"
            >
              <Grid className="size-3.5" />
              <span>Place {activePanelInfo.quantity} BoQ Panels</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setRoofSizeModalOpen(true)}
              className="border-emerald-500/30 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/20 text-xs cursor-pointer"
            >
              <Ruler className="size-3.5" />
              <span>Set Roof Size</span>
            </Button>
          </div>
        </div>
      )}

      {/* Real-Time Sizing Metrics Bar */}
      <div className="w-full bg-card border-b border-border px-3 sm:px-6 py-2 shadow-xs shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-6 lg:gap-8">
            {/* Metric 1: Total Panels Placed vs Target */}
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Panels Placed
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg sm:text-xl font-bold font-mono text-foreground">
                  {metrics.validPanelsCount}
                </span>
                {activePanelInfo.quantity > 0 && (
                  <span className="text-xs text-muted-foreground font-mono">
                    / {activePanelInfo.quantity}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground hidden sm:inline">modules</span>

                {activePanelInfo.quantity > 0 && metrics.validPanelsCount === activePanelInfo.quantity && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20 ml-1">
                    <CheckCircle2 className="size-2.5" />
                    <span>Matched</span>
                  </span>
                )}

                {metrics.invalidPanelsCount > 0 && (
                  <span className="text-[10px] text-rose-500 font-medium ml-0.5">
                    (+{metrics.invalidPanelsCount})
                  </span>
                )}
              </div>
            </div>

            <div className="w-px h-7 bg-border hidden sm:block" />

            {/* Metric 2: Total System Capacity */}
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Array kWp
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg sm:text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  {metrics.totalCapacityKwp.toFixed(2)}
                </span>
                <span className="text-[11px] text-muted-foreground">kWp</span>
              </div>
            </div>

            <div className="w-px h-7 bg-border hidden sm:block" />

            {/* Metric 3: Roof Utilization Area */}
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Roof Area
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm sm:text-base font-bold font-mono text-foreground">
                  {metrics.panelsTotalAreaM2.toFixed(1)}m²
                </span>
                {metrics.roofPolygonAreaM2 > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    ({metrics.utilizationRatePercent.toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sync Button */}
          {activePanelInfo.found && metrics.validPanelsCount > 0 && (
            <div className="flex items-center justify-end sm:justify-start gap-2">
              <Button
                type="button"
                variant={syncSuccess ? 'default' : 'outline'}
                size="xs"
                onClick={handleSyncToInvoice}
                className={cn(
                  'text-xs gap-1.5 transition-all cursor-pointer h-7',
                  syncSuccess
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'hover:bg-primary/5'
                )}
                title="Update the quotation line item quantity to match placed valid panels"
              >
                {syncSuccess ? (
                  <>
                    <CheckCircle2 className="size-3" />
                    <span>Updated ({metrics.validPanelsCount} pcs)</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3 text-blue-600" />
                    <span>Sync to Invoice ({metrics.validPanelsCount} pcs)</span>
                  </>
                )}
              </Button>
            </div>
          )}
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
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Alt</kbd>
            Hold to Invert Snap
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">S</kbd>
            Calibrate Scale
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
