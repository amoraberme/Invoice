'use client'

import React from 'react'
import {
  PenTool,
  MousePointer,
  Ruler,
  Maximize2,
  Minimize2,
  Sparkles,
  RotateCw,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  CheckCircle2,
  Hand,
  Sliders,
  Maximize,
  Grid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoofTool, PanelOrientation } from '@/types/roof'
import { cn } from '@/lib/utils'

interface RoofControlsProps {
  activeTool: RoofTool
  onSelectTool: (tool: RoofTool) => void
  imageOpacity: number
  onChangeOpacity: (val: number) => void
  orientation: PanelOrientation
  onToggleOrientation: () => void
  onAutoFill: () => void
  canAutoFill: boolean
  onAddSinglePanel: () => void
  canAddPanel: boolean
  onClearBoundary: () => void
  hasBoundary: boolean
  onClearPanels: () => void
  hasPanels: boolean
  onResetAll: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onCenterFitView: () => void
  isCalibrated: boolean
  pixelsPerMeter: number
  onOpenScaleModal: () => void
  onOpenRoofSizeModal: () => void
  onPlaceBoqPanels: () => void
  targetBoqCount: number
  isDrawingPolygon?: boolean
  onClosePolygon?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export const RoofControls: React.FC<RoofControlsProps> = ({
  activeTool,
  onSelectTool,
  imageOpacity,
  onChangeOpacity,
  orientation,
  onToggleOrientation,
  onAutoFill,
  canAutoFill,
  onAddSinglePanel,
  canAddPanel,
  onClearBoundary,
  hasBoundary,
  onClearPanels,
  hasPanels,
  onResetAll,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCenterFitView,
  isCalibrated,
  pixelsPerMeter,
  onOpenScaleModal,
  onOpenRoofSizeModal,
  onPlaceBoqPanels,
  targetBoqCount,
  isDrawingPolygon,
  onClosePolygon,
  isFullscreen,
  onToggleFullscreen,
}) => {
  // Clamp strictly between 0.20 and 0.80
  const clampedOpacity = Math.min(0.8, Math.max(0.2, imageOpacity))
  const opacityPercent = Math.round(clampedOpacity * 100)

  return (
    <div className="w-full bg-card border-b border-border px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
      {/* Group 1: Primary Tools & Dimensions */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-0.5 shrink-0">
        {/* Tool Selector Bar */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/80 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTool('select')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
              activeTool === 'select'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            title="Select & Drag Panels (V)"
          >
            <MousePointer className="size-3.5" />
            <span>Select & Snap</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('rect')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
              activeTool === 'rect'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            title="Draw Roof Box: Click and drag directly over the roof plane on photo (R)"
          >
            <Maximize2 className="size-3.5" />
            <span>Draw Roof Box</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('pen')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
              activeTool === 'pen'
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            title="Pen Tool: Click vertices to trace arbitrary roof perimeter (P)"
          >
            <PenTool className="size-3.5" />
            <span>Trace Polygon</span>
          </button>

          {/* Close Boundary Button while Pen tool is actively drawing points */}
          {isDrawingPolygon && (
            <button
              type="button"
              onClick={onClosePolygon}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 transition-colors animate-pulse cursor-pointer"
              title="Click or press Enter/Double-click to close roof polygon"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Close Boundary</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectTool('scale')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
              activeTool === 'scale'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            title="Set Reference Scale: Draw reference line to calibrate meters (S)"
          >
            <Ruler className="size-3.5" />
            <span>
              {isCalibrated ? `${pixelsPerMeter.toFixed(1)} px/m` : 'Calibrate Scale'}
            </span>
            {isCalibrated && <CheckCircle2 className="size-3 text-emerald-400 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => onSelectTool('pan')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
              activeTool === 'pan'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            title="Pan Tool: Drag canvas view (H or Spacebar)"
          >
            <Hand className="size-3.5" />
            <span>Pan</span>
          </button>
        </div>

        {/* Set Roof Size (m / ft / sqm) Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenRoofSizeModal}
          className="h-8 text-xs gap-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium cursor-pointer"
          title="Input specific roof size in meters, feet, or square meters"
        >
          <Ruler className="size-3.5" />
          <span>Roof Size (m / ft / m²)</span>
        </Button>
      </div>

      {/* Group 2: Array Placement & Auto Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Orientation Toggle */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleOrientation}
          className="h-8 text-xs gap-1.5 cursor-pointer"
          title="Toggle panel placement orientation"
        >
          <RotateCw className="size-3.5 text-muted-foreground" />
          <span className="capitalize">{orientation}</span>
        </Button>

        {/* Auto-Place BoQ Modules (e.g. 6 panels for 4kW) */}
        {targetBoqCount > 0 && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onPlaceBoqPanels}
            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs cursor-pointer"
            title={`Automatically place all ${targetBoqCount} modules configured in your Items BoQ`}
          >
            <Grid className="size-3.5" />
            <span>Place BoQ Panels ({targetBoqCount})</span>
          </Button>
        )}

        {/* Auto-Fill Roof Button */}
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onAutoFill}
          disabled={!canAutoFill}
          className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs disabled:opacity-50 cursor-pointer"
          title={
            canAutoFill
              ? 'Programmatically calculate maximum fitting panels inside roof polygon'
              : 'Trace and close a roof boundary polygon to use Auto-Fill'
          }
        >
          <Sparkles className="size-3.5" />
          <span>Auto-Fill Max</span>
        </Button>

        {/* Add Single Panel Button */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddSinglePanel}
          disabled={!canAddPanel}
          className="h-8 text-xs gap-1.5 cursor-pointer"
          title="Manually place a single solar panel"
        >
          <Plus className="size-3.5" />
          <span>Add Panel</span>
        </Button>
      </div>

      {/* Group 3: Opacity Controller Slider (Strictly clamped 20% to 80%) */}
      <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60">
        <Layers className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
          Roof Image Opacity:
        </span>
        <input
          type="range"
          min="0.20"
          max="0.80"
          step="0.05"
          value={clampedOpacity}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value)
            const clamped = Math.min(0.8, Math.max(0.2, isNaN(parsed) ? 0.5 : parsed))
            onChangeOpacity(clamped)
          }}
          className="w-20 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          title="Background aerial image opacity slider (Strictly clamped 20% - 80%)"
        />
        <span className="text-xs font-mono font-semibold min-w-[32px] text-right">
          {opacityPercent}%
        </span>
      </div>

      {/* Group 4: Zoom, Fit, and Clear Actions */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center bg-muted/60 rounded-md border border-border/60 p-0.5">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="px-1.5 text-[11px] font-mono font-medium hover:bg-background rounded transition-colors cursor-pointer"
            title="Reset Zoom (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onCenterFitView}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-0.5"
            title="Fit Roof / Image to Screen"
          >
            <Maximize className="size-3.5" />
          </button>
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={cn(
                "p-1 rounded transition-colors cursor-pointer ml-0.5",
                isFullscreen
                  ? "bg-blue-600 text-white"
                  : "hover:bg-background text-muted-foreground hover:text-foreground"
              )}
              title={isFullscreen ? "Exit Fullscreen Canvas (Esc)" : "Expand / Fullscreen Canvas View"}
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          )}
        </div>

        {/* Clear Boundary Button */}
        {hasBoundary && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClearBoundary}
            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
            title="Clear traced roof boundary"
          >
            Clear Boundary
          </Button>
        )}

        {/* Clear Panels Button */}
        {hasPanels && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClearPanels}
            className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
            title="Remove all placed panels"
          >
            Clear Panels
          </Button>
        )}

        {/* Reset All */}
        {(hasBoundary || hasPanels) && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onResetAll}
            className="text-xs gap-1 cursor-pointer"
            title="Reset roof boundary and all placed panels"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </Button>
        )}
      </div>
    </div>
  )
}
