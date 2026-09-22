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
  Magnet,
  Lock,
  Unlock,
  Download,
  Compass,
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
  enableSnapping?: boolean
  onToggleSnapping?: () => void
  isRoofLocked?: boolean
  onToggleRoofLock?: () => void
  onDownloadLayout?: () => void
  selectedPanelId?: string | null
  currentTiltAngle?: number
  currentRotation?: number
  onCycleTilt?: () => void
  onRotateSelected?: (delta: number) => void
  onSetSelectedRotation?: (angle: number) => void
  onRotateAllPanels?: (delta: number) => void
  onApplyTiltToAll?: (tiltAngle: number) => void
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
  enableSnapping = true,
  onToggleSnapping,
  isRoofLocked = true,
  onToggleRoofLock,
  onDownloadLayout,
  selectedPanelId,
  currentTiltAngle = 0,
  currentRotation = 0,
  onCycleTilt,
  onRotateSelected,
  onSetSelectedRotation,
  onRotateAllPanels,
  onApplyTiltToAll,
}) => {
  // Clamp strictly between 0.20 and 0.80
  const clampedOpacity = Math.min(0.8, Math.max(0.2, imageOpacity))
  const opacityPercent = Math.round(clampedOpacity * 100)

  return (
    <div className="w-full flex flex-col shrink-0 select-none border-b border-border bg-card">
      {/* Tier 1: Primary CAD Tools & Solar Array Actions (Smooth horizontal scroll on mobile, no messy vertical wrap) */}
      <div className="w-full px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        {/* Left: Drafting Tools & Measurement */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Segmented Tool Selector Pill */}
          <div className="flex items-center gap-0.5 bg-muted/70 p-0.5 rounded-lg border border-border/80 shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => onSelectTool('select')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                activeTool === 'select'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
              title="Select & Move Panels (V)"
            >
              <MousePointer className="size-3.5" />
              <span>Select</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('rect')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                activeTool === 'rect'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
              title="Draw Roof Box: Click and drag over roof plane (R)"
            >
              <Maximize2 className="size-3.5" />
              <span>Box</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('pen')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                activeTool === 'pen'
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
              title="Pen Tool: Click vertices to trace perimeter (P)"
            >
              <PenTool className="size-3.5" />
              <span>Pen</span>
            </button>

            {/* Pulsing Close Boundary Button while Pen tool is drawing */}
            {isDrawingPolygon && (
              <button
                type="button"
                onClick={onClosePolygon}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 transition-colors animate-pulse cursor-pointer"
                title="Click or press Enter to close roof boundary"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Close</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectTool('scale')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                activeTool === 'scale'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
              title="Calibrate Scale: Draw reference line to set scale (S)"
            >
              <Ruler className="size-3.5" />
              <span className="hidden sm:inline">
                {isCalibrated ? `${pixelsPerMeter.toFixed(1)} px/m` : 'Scale'}
              </span>
              <span className="sm:hidden">Scale</span>
              {isCalibrated && <CheckCircle2 className="size-3 text-emerald-400 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('pan')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                activeTool === 'pan'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
              title="Pan Canvas View (H or Spacebar)"
            >
              <Hand className="size-3.5" />
              <span>Pan</span>
            </button>
          </div>

          {/* Roof Sizing Modal Button */}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onOpenRoofSizeModal}
            className="h-7 text-xs gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium shrink-0 cursor-pointer"
            title="Set exact roof size in meters, feet, or square meters"
          >
            <Ruler className="size-3.5" />
            <span>Roof Size</span>
          </Button>

          {/* Snapping Mode Toggle */}
          {onToggleSnapping && (
            <button
              type="button"
              onClick={onToggleSnapping}
              className={cn(
                'flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium transition-all cursor-pointer shrink-0 border',
                enableSnapping
                  ? 'bg-blue-600/10 border-blue-500/40 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs hover:bg-blue-600/20'
                  : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              title={
                enableSnapping
                  ? 'Snapping is ON (20mm clamp gap). Click for Manual Freeform (or hold Alt while dragging)'
                  : 'Snapping is OFF (Manual Freeform). Click to enable Magnet Snap (or hold Alt to snap)'
              }
            >
              <Magnet className={cn('size-3.5 transition-transform', enableSnapping ? 'text-blue-600 dark:text-blue-400 rotate-45' : 'text-muted-foreground opacity-50')} />
              <span>{enableSnapping ? 'Snap: ON' : 'Snap: OFF'}</span>
            </button>
          )}

          {/* Roof Lock / Unlock Toggle */}
          {hasBoundary && onToggleRoofLock && (
            <button
              type="button"
              onClick={onToggleRoofLock}
              className={cn(
                'flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium transition-all cursor-pointer shrink-0 border',
                isRoofLocked
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold shadow-2xs hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs hover:bg-emerald-500/20'
              )}
              title={
                isRoofLocked
                  ? 'Roof boundary is LOCKED (prevents moving roof while dragging panels). Click to Unlock.'
                  : 'Roof boundary is UNLOCKED (vertices & center can be edited). Click to Lock.'
              }
            >
              {isRoofLocked ? <Lock className="size-3.5 text-amber-500" /> : <Unlock className="size-3.5 text-emerald-500" />}
              <span>{isRoofLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
          )}
        </div>

        {/* Right: Array Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* High-visibility Place BoQ Modules */}
          {targetBoqCount > 0 && (
            <Button
              type="button"
              size="xs"
              onClick={onPlaceBoqPanels}
              className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs shrink-0 cursor-pointer"
              title={`Place all ${targetBoqCount} modules configured in Items BoQ`}
            >
              <Grid className="size-3.5" />
              <span>Place BoQ ({targetBoqCount})</span>
            </Button>
          )}

          {/* Auto-Fill Max */}
          <Button
            type="button"
            variant="default"
            size="xs"
            onClick={onAutoFill}
            disabled={!canAutoFill}
            className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs disabled:opacity-50 shrink-0 cursor-pointer"
            title="Automatically tile maximum fitting panels inside roof boundary"
          >
            <Sparkles className="size-3.5" />
            <span>Auto-Fill</span>
          </Button>

          {/* Add Single Panel */}
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={onAddSinglePanel}
            disabled={!canAddPanel}
            className="h-7 text-xs gap-1 shrink-0 cursor-pointer"
            title="Add a single panel at center of roof"
          >
            <Plus className="size-3.5" />
            <span>Panel</span>
          </Button>

          {/* Orientation Toggle */}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onToggleOrientation}
            className="h-7 text-xs gap-1 shrink-0 cursor-pointer"
            title="Toggle panel placement orientation"
          >
            <RotateCw className="size-3.5 text-muted-foreground" />
            <span className="capitalize">{orientation}</span>
          </Button>

          {/* Rack Tilt Pitch Button & Cycler */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/80 shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={onCycleTilt}
              className="flex items-center gap-1 px-2 h-6 rounded text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer transition-colors"
              title={`Mounting Rack Pitch Tilt: ${currentTiltAngle}°. Click to cycle 0° (Flush), 10°, 15°, 20°, 25°, 30°. (T)${selectedPanelId ? ' • Selected Panel' : ' • Array Default'}`}
            >
              <span className="font-mono text-[11px] font-bold">∠</span>
              <span>{selectedPanelId ? `Tilt: ${currentTiltAngle}°` : `Rack: ${currentTiltAngle}°`}</span>
            </button>
            {selectedPanelId && onApplyTiltToAll && (
              <button
                type="button"
                onClick={() => onApplyTiltToAll(currentTiltAngle)}
                className="px-1.5 h-6 text-[10px] font-medium text-muted-foreground hover:text-purple-500 hover:bg-background rounded cursor-pointer transition-colors ml-0.5 border-l border-border/60"
                title={`Apply ${currentTiltAngle}° tilt to all panels in the array`}
              >
                All
              </button>
            )}
          </div>

          {/* Azimuth / Rotation Stepper */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/80 shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                if (selectedPanelId && onRotateSelected) {
                  onRotateSelected(-15)
                } else if (onRotateAllPanels) {
                  onRotateAllPanels(-15)
                }
              }}
              className="px-1.5 h-6 rounded text-xs font-mono font-medium hover:bg-background text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Rotate -15° (Tilt Left / [)"
            >
              -15°
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedPanelId && onSetSelectedRotation) {
                  onSetSelectedRotation(0)
                } else if (onRotateAllPanels) {
                  onSetSelectedRotation?.(0)
                }
              }}
              className="px-1.5 h-6 text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 hover:bg-background rounded cursor-pointer transition-colors"
              title="Planar rotation angle. Click to reset to 0°"
            >
              {currentRotation}°
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedPanelId && onRotateSelected) {
                  onRotateSelected(15)
                } else if (onRotateAllPanels) {
                  onRotateAllPanels(15)
                }
              }}
              className="px-1.5 h-6 rounded text-xs font-mono font-medium hover:bg-background text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Rotate +15° (Tilt Right / ])"
            >
              +15°
            </button>
          </div>

          {/* Download Layout Plan */}
          {onDownloadLayout && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onDownloadLayout}
              className="h-7 text-xs gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium shrink-0 cursor-pointer shadow-2xs"
              title="Download high-resolution PNG architectural solar plan"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tier 2: Viewport, Opacity & Maintenance Utility Strip */}
      <div className="w-full px-3 py-1 bg-muted/30 border-t border-border/60 flex items-center justify-between text-xs gap-2 shrink-0">
        {/* Left: Aerial Photo Opacity Slider */}
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px] shrink-0">
          <Layers className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Roof Photo:</span>
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
            className="w-18 sm:w-24 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            title="Roof aerial background photo opacity slider (20% - 80%)"
          />
          <span className="font-mono font-semibold min-w-[28px] text-[11px]">
            {opacityPercent}%
          </span>
        </div>

        {/* Center/Right: Viewport Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-background rounded-md border border-border/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="size-3" />
            </button>
            <button
              type="button"
              onClick={onResetZoom}
              className="px-1 text-[11px] font-mono font-medium hover:bg-muted rounded transition-colors cursor-pointer"
              title="Reset Zoom (100%)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="size-3" />
            </button>
            <button
              type="button"
              onClick={onCenterFitView}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-0.5"
              title="Fit Roof Plane to Screen"
            >
              <Maximize className="size-3" />
            </button>
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className={cn(
                  "p-1 rounded transition-colors cursor-pointer ml-0.5",
                  isFullscreen
                    ? "bg-blue-600 text-white"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand / Fullscreen Canvas"}
              >
                {isFullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
              </button>
            )}
          </div>

          {/* Clear & Reset Actions Group */}
          <div className="flex items-center gap-1 pl-1 border-l border-border/60">
            {hasBoundary && (
              <button
                type="button"
                onClick={onClearBoundary}
                className="px-1.5 py-0.5 rounded text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Clear traced roof boundary"
              >
                Clear Roof
              </button>
            )}

            {hasPanels && (
              <button
                type="button"
                onClick={onClearPanels}
                className="px-1.5 py-0.5 rounded text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                title="Remove all placed solar panels"
              >
                Clear Panels
              </button>
            )}

            {(hasBoundary || hasPanels) && (
              <button
                type="button"
                onClick={onResetAll}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Reset roof layout workspace"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
