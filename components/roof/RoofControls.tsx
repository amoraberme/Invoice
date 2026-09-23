'use client'

import React, { useState } from 'react'
import {
  Undo2,
  Redo2,
  PenTool,
  MousePointer,
  Ruler,
  Maximize2,
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
  Keyboard,
  ChevronRight,
  ChevronLeft,
  Upload,
  Sun,
  Eye,
  Box,
  PanelRightClose,
  PanelRightOpen,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoofTool, PanelOrientation, RoofMetrics, RoofPolygon, PlacedPanel } from '@/types/roof'
import { sqmToSqft } from '@/utils/geometry'
import { cn } from '@/lib/utils'

export interface RoofControlsProps {
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
  enableSnapping?: boolean
  onToggleSnapping?: () => void
  isRoofLocked?: boolean
  onToggleRoofLock?: () => void
  onDownloadLayout?: () => void
  selectedPanelId?: string | null
  selectedPanelIds?: string[]
  onSelectPanels?: (ids: string[]) => void
  onSelectAll?: () => void
  onGroupSelected?: () => void
  onUngroupSelected?: () => void
  onDuplicateSelected?: () => void
  onApplyPerspectivePreset?: (preset: 'pitch-up' | 'pitch-down' | 'pitch-left' | 'pitch-right' | 'reset') => void
  currentTiltAngle?: number
  currentRotation?: number
  onCycleTilt?: () => void
  onApplyTiltToAll?: (tiltAngle: number) => void
  onRotateSelected?: (delta: number) => void
  onSetSelectedRotation?: (angle: number) => void
  onRotateAllPanels?: (delta: number) => void
  onApplyRotationToAll?: (tiltAngle: number) => void
  onAlignCollinear?: () => void
  metrics?: RoofMetrics
  activePanelInfo?: {
    dimensions: {
      lengthMm: number
      widthMm: number
      wattage: number
      modelName: string
    }
    quantity: number
  }
  polygon?: RoofPolygon
  placedPanels?: PlacedPanel[]
  onUploadImageClick?: () => void
  activeDockTab?: 'properties' | 'layers' | 'shortcuts'
  onSelectDockTab?: (tab: 'properties' | 'layers' | 'shortcuts') => void
  isDockCollapsed?: boolean
  onToggleDockCollapsed?: () => void
  canUndo?: boolean
  onUndo?: () => void
  canRedo?: boolean
  onRedo?: () => void
}

/**
 * 1. Photoshop Tool Palette (Left Vertical Toolbar)
 * Iconic Photoshop vertical rail with active blue highlights, hotkeys, and tooltips.
 */
export const RoofToolPalette: React.FC<{
  activeTool: RoofTool
  onSelectTool: (tool: RoofTool) => void
  isDrawingPolygon?: boolean
  onClosePolygon?: () => void
  isCalibrated: boolean
  pixelsPerMeter: number
  canAddPanel: boolean
  onAddSinglePanel: () => void
  canAutoFill: boolean
  onAutoFill: () => void
  targetBoqCount: number
  onPlaceBoqPanels: () => void
  enableSnapping?: boolean
  onToggleSnapping?: () => void
  hasBoundary?: boolean
  isRoofLocked?: boolean
  onToggleRoofLock?: () => void
  canUndo?: boolean
  onUndo?: () => void
  canRedo?: boolean
  onRedo?: () => void
}> = ({
  activeTool,
  onSelectTool,
  isDrawingPolygon,
  onClosePolygon,
  isCalibrated,
  pixelsPerMeter,
  canAddPanel,
  onAddSinglePanel,
  canAutoFill,
  onAutoFill,
  targetBoqCount,
  onPlaceBoqPanels,
  enableSnapping = true,
  onToggleSnapping,
  hasBoundary = false,
  isRoofLocked = false,
  onToggleRoofLock,
  canUndo = false,
  onUndo,
  canRedo = false,
  onRedo,
}) => {
  return (
    <div className="w-12 bg-[#1e1e20] border-r border-zinc-800/90 flex flex-col items-center py-2.5 gap-1.5 select-none z-20 shrink-0 shadow-md">
      {/* Tool Group 1: Drafting & Manipulation */}
      <button
        type="button"
        onClick={() => onSelectTool('select')}
        className={cn(
          'size-9 rounded-md flex items-center justify-center transition-all cursor-pointer relative group',
          activeTool === 'select'
            ? 'bg-sky-600 text-white shadow-xs font-semibold'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
        )}
        title="Move & Select Tool (V): Click and drag placed panels or polygon vertices"
      >
        <MousePointer className="size-4" />
        <span className="sr-only">Select</span>
        <span className="absolute left-12 ml-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono shadow-md">
          Move / Select (V)
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('rect')}
        className={cn(
          'size-9 rounded-md flex items-center justify-center transition-all cursor-pointer relative group',
          activeTool === 'rect'
            ? 'bg-sky-600 text-white shadow-xs font-semibold'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
        )}
        title="Roof Box Marquee (R): Click and drag to create rectangular roof perimeter"
      >
        <Maximize2 className="size-4" />
        <span className="sr-only">Box Roof</span>
        <span className="absolute left-12 ml-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono shadow-md">
          Roof Box Marquee (R)
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('pen')}
        className={cn(
          'size-9 rounded-md flex items-center justify-center transition-all cursor-pointer relative group',
          activeTool === 'pen'
            ? 'bg-sky-600 text-white shadow-xs font-semibold'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
        )}
        title="Pen Tool (P): Click vertices to trace precise roof boundary. Enter or click Point 1 to close."
      >
        <PenTool className="size-4" />
        <span className="sr-only">Pen Tool</span>
        <span className="absolute left-12 ml-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono shadow-md">
          Pen Tool (P)
        </span>
      </button>

      {/* Pulsing Finish/Close Badge when drawing with Pen Tool */}
      {isDrawingPolygon && onClosePolygon && (
        <button
          type="button"
          onClick={onClosePolygon}
          className="size-8 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all animate-pulse shadow-md cursor-pointer"
          title="Click or press Enter to close roof perimeter"
        >
          <CheckCircle2 className="size-4" />
        </button>
      )}

      <button
        type="button"
        onClick={() => onSelectTool('scale')}
        className={cn(
          'size-9 rounded-md flex items-center justify-center transition-all cursor-pointer relative group',
          activeTool === 'scale'
            ? 'bg-amber-600 text-white shadow-xs font-semibold'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
        )}
        title={`Ruler / Scale Calibration (S): ${isCalibrated ? `${pixelsPerMeter.toFixed(1)} px/m` : 'Draw reference line'}`}
      >
        <Ruler className="size-4" />
        {isCalibrated && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-emerald-400" />
        )}
        <span className="sr-only">Ruler Scale</span>
        <span className="absolute left-12 ml-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono shadow-md">
          Ruler / Scale (S) • {isCalibrated ? `${pixelsPerMeter.toFixed(1)} px/m` : 'Uncalibrated'}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTool('pan')}
        className={cn(
          'size-9 rounded-md flex items-center justify-center transition-all cursor-pointer relative group',
          activeTool === 'pan'
            ? 'bg-sky-600 text-white shadow-xs font-semibold'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
        )}
        title="Hand Tool (H or Spacebar): Click and drag to pan canvas viewport"
      >
        <Hand className="size-4" />
        <span className="sr-only">Hand Tool</span>
        <span className="absolute left-12 ml-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono shadow-md">
          Hand Tool (H or Space)
        </span>
      </button>

      {/* Separator */}
      <div className="w-6 h-px bg-zinc-800 my-1" />

      {/* Tool Group 4: Snapping & Locking Toggles */}
      {onToggleSnapping && (
        <button
          type="button"
          onClick={onToggleSnapping}
          className={cn(
            'size-9 rounded-md flex items-center justify-center transition-all cursor-pointer relative group',
            enableSnapping
              ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/70'
          )}
          title={`Magnet Snapping: ${enableSnapping ? 'ON (20mm)' : 'OFF (Manual)'}`}
        >
          <Magnet className="size-4" />
          <span className="sr-only">Magnet Snap</span>
          <span className="absolute left-12 ml-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono shadow-md">
            Magnet Snap: {enableSnapping ? 'ON' : 'OFF'} (Hold Alt to invert)
          </span>
        </button>
      )}

      {hasBoundary && onToggleRoofLock && (
        <button
          type="button"
          onClick={onToggleRoofLock}
          className={cn(
            'size-9 rounded-md flex items-center justify-center transition-all cursor-pointer relative group',
            isRoofLocked
              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
              : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
          )}
          title={`Roof Boundary: ${isRoofLocked ? 'Locked' : 'Unlocked'}`}
        >
          {isRoofLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          <span className="sr-only">Roof Lock</span>
          <span className="absolute left-12 ml-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono shadow-md">
            Roof: {isRoofLocked ? 'Locked 🔒' : 'Unlocked 🔓'}
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * 2. Photoshop Contextual Options Bar (Top Horizontal Strip)
 * Adapts contextually to the currently selected tool and panel transformation.
 */
export const RoofOptionsBar: React.FC<{
  activeTool: RoofTool
  onSelectTool: (tool: RoofTool) => void
  selectedPanelId?: string | null
  selectedPanelIds?: string[]
  onSelectPanels?: (ids: string[]) => void
  onSelectAll?: () => void
  onGroupSelected?: () => void
  onUngroupSelected?: () => void
  onDuplicateSelected?: () => void
  onApplyPerspectivePreset?: (preset: 'pitch-up' | 'pitch-down' | 'pitch-left' | 'pitch-right' | 'reset') => void
  placedPanels?: PlacedPanel[]
  currentRotation: number
  currentTiltAngle: number
  orientation: PanelOrientation
  onToggleOrientation: () => void
  onCycleTilt?: () => void
  onApplyTiltToAll?: (tilt: number) => void
  onRotateSelected?: (delta: number) => void
  onSetSelectedRotation?: (angle: number) => void
  onRotateAllPanels?: (delta: number) => void
  onApplyRotationToAll?: (angle: number) => void
  onAlignCollinear?: () => void
  isDrawingPolygon?: boolean
  onClosePolygon?: () => void
  onOpenRoofSizeModal: () => void
  isCalibrated: boolean
  pixelsPerMeter: number
  enableSnapping?: boolean
  onToggleSnapping?: () => void
  isRoofLocked?: boolean
  onToggleRoofLock?: () => void
  hasBoundary?: boolean
  polygon?: RoofPolygon
  canAutoFill: boolean
  onAutoFill: () => void
  targetBoqCount: number
  onPlaceBoqPanels: () => void
  canAddPanel: boolean
  onAddSinglePanel: () => void
  canUndo?: boolean
  onUndo?: () => void
  canRedo?: boolean
  onRedo?: () => void
}> = ({
  activeTool,
  onSelectTool,
  selectedPanelId,
  selectedPanelIds,
  onSelectPanels,
  onSelectAll,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateSelected,
  onApplyPerspectivePreset,
  placedPanels,
  currentRotation,
  currentTiltAngle,
  orientation,
  onToggleOrientation,
  onCycleTilt,
  onApplyTiltToAll,
  onRotateSelected,
  onSetSelectedRotation,
  onRotateAllPanels,
  onApplyRotationToAll,
  onAlignCollinear,
  isDrawingPolygon,
  onClosePolygon,
  onOpenRoofSizeModal,
  isCalibrated,
  pixelsPerMeter,
  enableSnapping = true,
  onToggleSnapping,
  isRoofLocked = false,
  onToggleRoofLock,
  hasBoundary = false,
  polygon,
  canAutoFill,
  onAutoFill,
  targetBoqCount,
  onPlaceBoqPanels,
  canAddPanel,
  onAddSinglePanel,
  canUndo = false,
  onUndo,
  canRedo = false,
  onRedo,
}) => {
  const effectiveSelectedIds = selectedPanelIds || (selectedPanelId ? [selectedPanelId] : [])
  const selectedCount = effectiveSelectedIds.length
  const totalPanelsCount = placedPanels ? placedPanels.length : 0
  const isAllSelected = totalPanelsCount > 0 && selectedCount === totalPanelsCount

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll()
    } else if (placedPanels && onSelectPanels) {
      onSelectPanels(placedPanels.map((p) => p.id))
    }
  }

  const handleDeselectAll = () => {
    if (onSelectPanels) {
      onSelectPanels([])
    }
  }

  const isGrouped = Boolean(
    placedPanels &&
      selectedCount > 1 &&
      effectiveSelectedIds.every((id) => {
        const p = placedPanels.find((panel) => panel.id === id)
        const first = placedPanels.find((x) => x.id === effectiveSelectedIds[0])
        return p && p.groupId && first && p.groupId === first.groupId
      })
  )
  return (
    <div className="w-full h-10 bg-[#252528] border-b border-zinc-800/90 px-3 flex items-center justify-between gap-3 text-xs text-zinc-300 select-none overflow-x-auto no-scrollbar shrink-0 shadow-xs">
      {/* Left: Active Tool Mode & Contextual Tool Identity */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-700/70 text-zinc-200 font-medium font-mono text-[11px]">
          {activeTool === 'select' && <MousePointer className="size-3.5 text-sky-400" />}
          {activeTool === 'rect' && <Maximize2 className="size-3.5 text-sky-400" />}
          {activeTool === 'pen' && <PenTool className="size-3.5 text-sky-400" />}
          {activeTool === 'scale' && <Ruler className="size-3.5 text-amber-400" />}
          {activeTool === 'pan' && <Hand className="size-3.5 text-sky-400" />}
          <span className="uppercase font-semibold tracking-wider text-zinc-100">
            {activeTool === 'select'
              ? 'Move / Select'
              : activeTool === 'rect'
              ? 'Box Marquee'
              : activeTool === 'pen'
              ? 'Pen Tool'
              : activeTool === 'scale'
              ? 'Ruler / Scale'
              : 'Hand Tool'}
          </span>
        </div>

        {/* Dynamic Contextual Action: Enter to Close boundary */}
        {isDrawingPolygon && onClosePolygon && (
          <button
            type="button"
            onClick={onClosePolygon}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer animate-pulse"
            title="Close boundary polygon (Enter key)"
          >
            <CheckCircle2 className="size-3" />
            <span>Close Boundary (Enter)</span>
          </button>
        )}

        {/* Roof Sizing Modal Button */}
        <button
          type="button"
          onClick={onOpenRoofSizeModal}
          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer text-xs"
          title="Set exact roof size in meters or feet"
        >
          <Ruler className="size-3 text-blue-400" />
          <span>Roof Size</span>
        </button>
      </div>

      {/* Middle: Transform Controls (Azimuth Angle, Mounting Rack Tilt, Orientation) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Azimuth / Rotation Controller */}
        <div className="flex items-center bg-zinc-900/90 rounded border border-zinc-700/80 p-0.5 gap-0.5 shadow-2xs">
          <div className="flex items-center pl-1.5 pr-0.5 text-zinc-400" title="Planar Azimuth Angle">
            <Compass className="size-3.5 text-sky-400" />
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedCount > 0 && onRotateSelected) onRotateSelected(-1)
              else if (onRotateAllPanels) onRotateAllPanels(-1)
              else if (onRotateSelected) onRotateSelected(-1)
            }}
            className="px-1 h-6 rounded text-[11px] font-mono font-semibold hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Fine rotate -1° (Shift+[)"
          >
            -1°
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedCount > 0 && onRotateSelected) onRotateSelected(-15)
              else if (onRotateAllPanels) onRotateAllPanels(-15)
              else if (onRotateSelected) onRotateSelected(-15)
            }}
            className="px-1 h-6 rounded text-[11px] font-mono text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Rotate -15° ([)"
          >
            -15°
          </button>

          {/* Numeric angle input */}
          <div className="relative flex items-center">
            <input
              type="number"
              min={0}
              max={359}
              step="any"
              value={currentRotation}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) {
                  const norm = Math.round((((val % 360) + 360) % 360) * 10) / 10
                  if (selectedCount > 0 && onSetSelectedRotation) {
                    onSetSelectedRotation(norm)
                  } else if (onApplyRotationToAll) {
                    onApplyRotationToAll(norm)
                  } else if (onSetSelectedRotation) {
                    onSetSelectedRotation(norm)
                  }
                }
              }}
              className="w-12 h-6 px-0.5 text-center text-xs font-mono font-bold text-sky-400 bg-zinc-950 rounded border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Custom rotation angle (0° - 359°)"
            />
            <span className="text-[10px] font-mono text-zinc-400 ml-0.5 mr-1 font-bold select-none">°</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedCount > 0 && onRotateSelected) onRotateSelected(15)
              else if (onRotateAllPanels) onRotateAllPanels(15)
              else if (onRotateSelected) onRotateSelected(15)
            }}
            className="px-1 h-6 rounded text-[11px] font-mono text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Rotate +15° (])"
          >
            +15°
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedCount > 0 && onRotateSelected) onRotateSelected(1)
              else if (onRotateAllPanels) onRotateAllPanels(1)
              else if (onRotateSelected) onRotateSelected(1)
            }}
            className="px-1 h-6 rounded text-[11px] font-mono font-semibold hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Fine rotate +1° (Shift+])"
          >
            +1°
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedCount > 0 && onRotateSelected) onRotateSelected(90)
              else if (onRotateAllPanels) onRotateAllPanels(90)
              else if (onRotateSelected) onRotateSelected(90)
            }}
            className="px-1.5 h-6 rounded text-[11px] font-mono font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition-colors cursor-pointer"
            title="Rotate +90° Orientation"
          >
            90°
          </button>

          {/* Straighten / Align Collinear */}
          {onAlignCollinear && (
            <button
              type="button"
              onClick={onAlignCollinear}
              className="px-1.5 h-6 rounded text-[10px] font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition-colors cursor-pointer ml-0.5"
              title="Straighten panels into a collinear row along angle"
            >
              Straighten
            </button>
          )}

          {/* Apply to All Panels */}
          {(selectedCount > 0 || totalPanelsCount > 0) && onApplyRotationToAll && (
            <button
              type="button"
              onClick={() => onApplyRotationToAll(currentRotation)}
              className="px-1.5 h-6 rounded text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-zinc-700 ml-0.5"
              title={`Apply ${currentRotation}° to all panels in the array`}
            >
              All
            </button>
          )}
        </div>

        {/* Rack Tilt Cycler */}
        <div className="flex items-center bg-zinc-900/90 rounded border border-zinc-700/80 p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={onCycleTilt}
            className="flex items-center gap-1 px-2 h-6 rounded text-xs font-semibold text-purple-400 hover:bg-purple-500/10 cursor-pointer transition-colors"
            title={`Mounting Rack Pitch Tilt: ${currentTiltAngle}°. Click to cycle (0°, 10°, 15°, 20°, 25°, 30°) / Shortcut: T`}
          >
            <span className="font-mono text-[11px] font-bold">∠</span>
            <span>Tilt: {currentTiltAngle}°</span>
          </button>
          {(selectedCount > 0 || totalPanelsCount > 0) && onApplyTiltToAll && (
            <button
              type="button"
              onClick={() => onApplyTiltToAll(currentTiltAngle)}
              className="px-1.5 h-6 text-[10px] font-medium text-zinc-400 hover:text-purple-300 hover:bg-zinc-800 rounded transition-colors ml-0.5 border-l border-zinc-700"
              title={`Apply ${currentTiltAngle}° tilt to all panels in the array`}
            >
              All
            </button>
          )}
        </div>

        {/* Orientation Toggle */}
        <button
          type="button"
          onClick={onToggleOrientation}
          className="flex items-center gap-1 px-2.5 h-7 rounded bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white cursor-pointer transition-colors text-xs"
          title="Toggle panel placement orientation (Landscape / Portrait)"
        >
          <RotateCw className="size-3 text-zinc-400" />
          <span className="capitalize">{orientation}</span>
        </button>

        {/* Selection Actions & 3D Perspective Controls */}
        {totalPanelsCount > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Prominent Select All / Deselect button */}
            <button
              type="button"
              onClick={isAllSelected ? handleDeselectAll : handleSelectAll}
              className={cn(
                "px-2 h-7 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border",
                isAllSelected
                  ? "bg-sky-600/30 text-sky-200 border-sky-500/50 hover:bg-sky-600/40"
                  : selectedCount > 0
                  ? "bg-zinc-900/90 text-sky-400 border-sky-500/40 hover:bg-zinc-800"
                  : "bg-zinc-900/90 text-zinc-300 border-zinc-700/80 hover:bg-zinc-800 hover:text-white"
              )}
              title={isAllSelected ? "Deselect all panels (Escape)" : `Select all ${totalPanelsCount} panels (Ctrl+A)`}
            >
              <MousePointer className="size-3 text-sky-400" />
              <span>
                {isAllSelected
                  ? `All Selected (${totalPanelsCount})`
                  : `Select All (${totalPanelsCount})`}
              </span>
            </button>

            {selectedCount > 0 && (
              <div className="flex items-center bg-zinc-900/90 rounded border border-zinc-700/80 px-2 py-0.5 gap-1.5 shadow-2xs">
                <span className="text-[11px] font-semibold text-sky-400 font-mono">
                  {selectedCount} Selected
                </span>

            <div className="w-px h-3.5 bg-zinc-700" />

            {/* Group / Ungroup Button */}
            {(onGroupSelected || onUngroupSelected) && (
              <button
                type="button"
                onClick={isGrouped ? onUngroupSelected : onGroupSelected}
                disabled={selectedCount < 2 && !isGrouped}
                className="px-2 h-6 rounded text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 cursor-pointer flex items-center gap-1 transition-colors"
                title={isGrouped ? "Ungroup selected panels (Ctrl+Shift+G)" : "Group selected panels together (Ctrl+G)"}
              >
                <Layers className="size-3 text-sky-400" />
                <span>{isGrouped ? 'Ungroup' : 'Group (Ctrl+G)'}</span>
              </button>
            )}

            {/* Duplicate Button */}
            {onDuplicateSelected && (
              <button
                type="button"
                onClick={onDuplicateSelected}
                className="px-2 h-6 rounded text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer flex items-center gap-1 transition-colors"
                title="Duplicate selected panels (Ctrl+D)"
              >
                <Plus className="size-3 text-emerald-400" />
                <span>Duplicate (Ctrl+D)</span>
              </button>
            )}

            <div className="w-px h-3.5 bg-zinc-700" />

            {/* Selection 3D Perspective Slope Presets */}
            {onApplyPerspectivePreset && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-400 font-medium">3D Slope:</span>
                <button
                  type="button"
                  onClick={() => onApplyPerspectivePreset('pitch-up')}
                  className="px-1.5 h-5 rounded text-[10px] font-mono font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors cursor-pointer"
                  title="3D Slope Up (pitch top ridge narrower)"
                >
                  ▲ Up
                </button>
                <button
                  type="button"
                  onClick={() => onApplyPerspectivePreset('pitch-down')}
                  className="px-1.5 h-5 rounded text-[10px] font-mono font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors cursor-pointer"
                  title="3D Slope Down (pitch bottom eave narrower)"
                >
                  ▼ Down
                </button>
                <button
                  type="button"
                  onClick={() => onApplyPerspectivePreset('pitch-left')}
                  className="px-1.5 h-5 rounded text-[10px] font-mono font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors cursor-pointer"
                  title="3D Slope Left"
                >
                  ◀ Left
                </button>
                <button
                  type="button"
                  onClick={() => onApplyPerspectivePreset('pitch-right')}
                  className="px-1.5 h-5 rounded text-[10px] font-mono font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors cursor-pointer"
                  title="3D Slope Right"
                >
                  ▶ Right
                </button>
                <button
                  type="button"
                  onClick={() => onApplyPerspectivePreset('reset')}
                  className="px-1.5 h-5 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
                  title="Reset to 2D flat rectangle"
                >
                  ↺ Flat
                </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

      {/* Right: Quick Array Action Triggers */}
      <div className="flex items-center gap-1.5 shrink-0">
        {targetBoqCount > 0 && (
          <button
            type="button"
            onClick={onPlaceBoqPanels}
            className="flex items-center gap-1.5 px-2.5 h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            title={`Place all ${targetBoqCount} modules configured in Items BoQ`}
          >
            <Grid className="size-3.5" />
            <span>Place BoQ ({targetBoqCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={onAutoFill}
          disabled={!canAutoFill}
          className="flex items-center gap-1 px-2.5 h-7 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-40"
          title="Auto-Fill fitting panels inside roof boundary"
        >
          <Sparkles className="size-3.5" />
          <span>Auto-Fill</span>
        </button>

        <button
          type="button"
          onClick={onAddSinglePanel}
          disabled={!canAddPanel}
          className="flex items-center gap-1 px-2 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition-colors cursor-pointer disabled:opacity-40"
          title="Add a single panel at center of roof"
        >
          <Plus className="size-3.5 text-zinc-400" />
          <span>Panel</span>
        </button>
      </div>
    </div>
  )
}

/**
 * 3. Photoshop Studio Dock (Right Sidebar Inspector)
 * Houses Properties, Photoshop Layers, and the dedicated Keyboard Shortcuts Guide!
 */
export const RoofStudioDock: React.FC<{
  activeTab: 'properties' | 'layers' | 'shortcuts'
  onSelectTab: (tab: 'properties' | 'layers' | 'shortcuts') => void
  isCollapsed: boolean
  onToggleCollapsed: () => void
  metrics?: RoofMetrics
  activePanelInfo?: {
    dimensions: {
      lengthMm: number
      widthMm: number
      wattage: number
      modelName: string
    }
    quantity: number
  }
  polygon?: RoofPolygon
  placedPanels?: PlacedPanel[]
  selectedPanelId?: string | null
  currentRotation: number
  currentTiltAngle: number
  orientation: PanelOrientation
  onToggleOrientation: () => void
  onCycleTilt?: () => void
  onApplyTiltToAll?: (tilt: number) => void
  onRotateSelected?: (delta: number) => void
  onSetSelectedRotation?: (angle: number) => void
  onApplyRotationToAll?: (angle: number) => void
  onRotateAllPanels?: (delta: number) => void
  onAlignCollinear?: () => void
  hasBoundary: boolean
  isRoofLocked?: boolean
  onToggleRoofLock?: () => void
  onClearBoundary: () => void
  hasPanels: boolean
  onClearPanels: () => void
  onResetAll: () => void
  onOpenRoofSizeModal: () => void
  imageOpacity: number
  onChangeOpacity: (val: number) => void
  onUploadImageClick?: () => void
  selectedPanelIds?: string[]
  onSelectPanels?: (ids: string[]) => void
  onSelectAll?: () => void
  onGroupSelected?: () => void
  onUngroupSelected?: () => void
  onDuplicateSelected?: () => void
  onApplyPerspectivePreset?: (preset: 'pitch-up' | 'pitch-down' | 'pitch-left' | 'pitch-right' | 'reset') => void
  onSelectTool?: (tool: RoofTool) => void
}> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapsed,
  metrics,
  activePanelInfo,
  polygon,
  placedPanels = [],
  selectedPanelId,
  selectedPanelIds,
  onSelectPanels,
  onSelectAll,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateSelected,
  onApplyPerspectivePreset,
  currentRotation,
  currentTiltAngle,
  orientation,
  onToggleOrientation,
  onCycleTilt,
  onApplyTiltToAll,
  onRotateSelected,
  onSetSelectedRotation,
  onApplyRotationToAll,
  onRotateAllPanels,
  onAlignCollinear,
  hasBoundary,
  isRoofLocked = false,
  onToggleRoofLock,
  onClearBoundary,
  hasPanels,
  onClearPanels,
  onResetAll,
  onOpenRoofSizeModal,
  imageOpacity,
  onChangeOpacity,
  onUploadImageClick,
  onSelectTool,
}) => {
  const effectiveSelectedIds = selectedPanelIds || (selectedPanelId ? [selectedPanelId] : [])
  const selectedCount = effectiveSelectedIds.length
  const totalPanelsCount = placedPanels.length
  const isAllSelected = totalPanelsCount > 0 && selectedCount === totalPanelsCount

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll()
    } else if (onSelectPanels) {
      onSelectPanels(placedPanels.map((p) => p.id))
    }
  }

  const handleDeselectAll = () => {
    if (onSelectPanels) {
      onSelectPanels([])
    }
  }

  const isGrouped = Boolean(
    placedPanels &&
      selectedCount > 1 &&
      effectiveSelectedIds.every((id) => {
        const p = placedPanels.find((panel) => panel.id === id)
        const first = placedPanels.find((x) => x.id === effectiveSelectedIds[0])
        return p && p.groupId && first && p.groupId === first.groupId
      })
  )
  const clampedOpacity = Math.min(0.8, Math.max(0.2, imageOpacity))
  const opacityPercent = Math.round(clampedOpacity * 100)

  if (isCollapsed) {
    return (
      <div className="w-10 bg-[#1e1e20] border-l border-zinc-800 flex flex-col items-center py-2.5 gap-2 select-none z-20 shrink-0">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          title="Expand Photoshop Studio Dock"
        >
          <PanelRightOpen className="size-4" />
        </button>
        <div className="w-6 h-px bg-zinc-800" />
        <button
          type="button"
          onClick={() => {
            onSelectTab('properties')
            onToggleCollapsed()
          }}
          className={cn(
            'p-1.5 rounded transition-colors cursor-pointer',
            activeTab === 'properties' ? 'text-sky-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-200'
          )}
          title="Properties Inspector"
        >
          <Sliders className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectTab('layers')
            onToggleCollapsed()
          }}
          className={cn(
            'p-1.5 rounded transition-colors cursor-pointer',
            activeTab === 'layers' ? 'text-sky-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-200'
          )}
          title="Layers Panel"
        >
          <Layers className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectTab('shortcuts')
            onToggleCollapsed()
          }}
          className={cn(
            'p-1.5 rounded transition-colors cursor-pointer',
            activeTab === 'shortcuts' ? 'text-sky-400 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-200'
          )}
          title="Keyboard Shortcuts Guide"
        >
          <Keyboard className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-72 sm:w-80 bg-[#1e1e20] border-l border-zinc-800 flex flex-col z-20 shrink-0 select-none shadow-xl text-zinc-300 text-xs">
      {/* Dock Tabs Header */}
      <div className="h-10 bg-[#252528] border-b border-zinc-800 flex items-center justify-between px-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectTab('properties')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-t text-xs font-medium transition-colors cursor-pointer border-b-2',
              activeTab === 'properties'
                ? 'text-sky-400 border-sky-500 bg-[#1e1e20] font-semibold'
                : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-800/50'
            )}
          >
            <Sliders className="size-3.5" />
            <span>Properties</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('layers')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-t text-xs font-medium transition-colors cursor-pointer border-b-2',
              activeTab === 'layers'
                ? 'text-sky-400 border-sky-500 bg-[#1e1e20] font-semibold'
                : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-800/50'
            )}
          >
            <Layers className="size-3.5" />
            <span>Layers</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('shortcuts')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-t text-xs font-medium transition-colors cursor-pointer border-b-2',
              activeTab === 'shortcuts'
                ? 'text-sky-400 border-sky-500 bg-[#1e1e20] font-semibold'
                : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-800/50'
            )}
            title="Keyboard Shortcuts Reference Guide"
          >
            <Keyboard className="size-3.5" />
            <span>Shortcuts</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          title="Collapse Panel"
        >
          <PanelRightClose className="size-3.5" />
        </button>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
        {/* TAB 1: PROPERTIES */}
        {activeTab === 'properties' && (
          <div className="space-y-4">
            {/* Engineering Output Overview Cards */}
            {metrics && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Array Output & Utilization
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                      Panels Placed
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-base font-bold font-mono text-zinc-100">
                        {metrics.validPanelsCount}
                      </span>
                      {activePanelInfo && (
                        <span className="text-xs text-zinc-400 font-mono">
                          / {activePanelInfo.quantity}
                        </span>
                      )}
                    </div>
                    {activePanelInfo && metrics.validPanelsCount === activePanelInfo.quantity && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 px-1 py-0.2 rounded mt-1">
                        ✓ BoQ Matched
                      </span>
                    )}
                  </div>

                  <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                      Capacity
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-base font-bold font-mono text-sky-400">
                        {metrics.totalCapacityKwp.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">kWp</span>
                    </div>
                    {currentTiltAngle > 0 && (
                      <span className="inline-flex items-center text-[9px] font-semibold text-purple-400 bg-purple-500/15 px-1 py-0.2 rounded mt-1 font-mono">
                        ∠{currentTiltAngle}° Tilt
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                      Roof Coverage
                    </span>
                    <span className="text-sm font-bold font-mono text-zinc-100">
                      {metrics.panelsTotalAreaM2.toFixed(1)} m²
                    </span>
                  </div>
                  {metrics.roofPolygonAreaM2 > 0 && (
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold block">
                        Utilization
                      </span>
                      <span className="text-sm font-bold font-mono text-emerald-400">
                        {metrics.utilizationRatePercent.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Active Solar Module Specification */}
            {activePanelInfo && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Module Specification
                </span>
                <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Model:</span>
                    <span className="font-semibold text-zinc-200 text-right truncate max-w-[170px]" title={activePanelInfo.dimensions.modelName}>
                      {activePanelInfo.dimensions.modelName.replace(/\(.*?\)/g, '').trim()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Dimensions:</span>
                    <span className="font-mono text-zinc-200">
                      {activePanelInfo.dimensions.lengthMm} × {activePanelInfo.dimensions.widthMm} mm
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Wattage Rating:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {activePanelInfo.dimensions.wattage}W
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Array Alignment & Layout Specifications */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {selectedPanelId ? 'Selected Panel Specs' : 'Array Alignment Specs'}
              </span>
              <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Orientation:</span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-semibold font-mono text-xs border border-zinc-700 capitalize">
                    {orientation}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Azimuth Angle:</span>
                  <span className="font-bold text-sky-400 font-mono text-xs px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/60">
                    {currentRotation}°
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Mounting Pitch:</span>
                  <span className="font-semibold text-purple-300 font-mono text-xs px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30">
                    ∠ {currentTiltAngle}°
                  </span>
                </div>
              </div>
            </div>

            {/* Roof Perimeter Specifications */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Roof Geometry & Sizing
              </span>
              <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Boundary Area:</span>
                  <span className="font-mono text-zinc-100 font-semibold">
                    {metrics ? `${metrics.roofPolygonAreaM2.toFixed(1)} m²` : '0 m²'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Vertices:</span>
                  <span className="font-mono text-zinc-300">
                    {polygon ? polygon.points.length : 0} points
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenRoofSizeModal}
                  className="w-full py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 font-semibold transition-colors cursor-pointer text-xs flex items-center justify-center gap-1.5"
                >
                  <Ruler className="size-3.5" />
                  <span>Set Exact Roof Size (m / ft)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PHOTOSHOP LAYERS */}
        {activeTab === 'layers' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Workspace Layers
            </span>

            {/* Layer 1: Solar Panels Layer */}
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="size-4 text-amber-400" />
                  <span className="font-semibold text-zinc-200">Solar Panels Layer</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-[10px] text-zinc-300">
                  {placedPanels.length} placed
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400">Actions:</span>
                <div className="flex items-center gap-1.5">
                  {totalPanelsCount > 0 && (
                    <button
                      type="button"
                      onClick={isAllSelected ? handleDeselectAll : handleSelectAll}
                      className="px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      {isAllSelected ? 'Deselect All' : `Select All (${totalPanelsCount})`}
                    </button>
                  )}
                  {hasPanels && (
                    <button
                      type="button"
                      onClick={onClearPanels}
                      className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      Clear Panels
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Layer 2: Roof Boundary Layer */}
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="size-4 text-sky-400" />
                  <span className="font-semibold text-zinc-200">Roof Perimeter Layer</span>
                </div>
                {hasBoundary && onToggleRoofLock && (
                  <button
                    type="button"
                    onClick={onToggleRoofLock}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                    title={isRoofLocked ? 'Locked' : 'Unlocked'}
                  >
                    {isRoofLocked ? <Lock className="size-3 text-amber-400" /> : <Unlock className="size-3 text-emerald-400" />}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400">
                  {polygon ? `${polygon.points.length} vertices` : 'Empty'}
                </span>
                {hasBoundary && (
                  <button
                    type="button"
                    onClick={onClearBoundary}
                    className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    Clear Roof
                  </button>
                )}
              </div>
            </div>

            {/* Layer 3: Aerial Background Photo */}
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-zinc-400" />
                  <span className="font-semibold text-zinc-200">Background Imagery</span>
                </div>
                {onUploadImageClick && (
                  <button
                    type="button"
                    onClick={onUploadImageClick}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium cursor-pointer transition-colors border border-zinc-700"
                  >
                    Change Photo
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Photo Opacity:</span>
                  <span className="font-mono font-semibold text-zinc-200">{opacityPercent}%</span>
                </div>
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
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            {/* Global Reset */}
            {(hasBoundary || hasPanels) && (
              <button
                type="button"
                onClick={onResetAll}
                className="w-full py-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 font-medium transition-colors cursor-pointer text-xs flex items-center justify-center gap-1.5 mt-4"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Entire Workspace</span>
              </button>
            )}
          </div>
        )}

        {/* TAB 3: KEYBOARD SHORTCUTS GUIDE (Requested: stay the guide of shortcut keys) */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Photoshop & CAD Shortcuts
              </span>
              <span className="text-[10px] text-sky-400 font-mono">Reference Guide</span>
            </div>

            {/* Group: Tools */}
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Primary Tool Selection
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Move & Select Tool</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-sky-300 font-bold">V</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Pen Boundary Tool</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-sky-300 font-bold">P</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Roof Box Marquee</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-sky-300 font-bold">R</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Ruler / Scale Calibration</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-sky-300 font-bold">S</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Hand / Pan View</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-sky-300 font-bold">H / Space</kbd>
                </div>
              </div>
            </div>

            {/* Group: Panel Manipulation */}
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Panel Transform & Tilt
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Rotate Angle (±15°)</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300">[ / ]</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Fine Rotate Angle (±1°)</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300">Shift + [ / ]</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Cycle Rack Pitch Tilt</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-purple-300 font-bold">T</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Delete Selected Panel</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-rose-300 font-bold">Del / Backspace</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Invert Snapping</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300">Hold Alt</kbd>
                </div>
              </div>
            </div>

            {/* Group: History & Undo */}
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                History & Revert
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Undo Last Change</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-amber-300 font-bold">Ctrl + Z</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Redo Change</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-amber-300 font-bold">Ctrl + Y</kbd>
                </div>
              </div>
            </div>

            {/* Group: Canvas Viewport */}
            <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Canvas & Viewport
              </span>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Pan Canvas</span>
                  <span className="text-zinc-400 font-mono text-[11px]">Spacebar + Drag</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Zoom In / Out</span>
                  <span className="text-zinc-400 font-mono text-[11px]">Mouse Scroll</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Close Pen Boundary</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-emerald-300 font-bold">Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Deselect / Cancel</span>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono text-zinc-300">Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 4. Photoshop Document Status Bar (Bottom Canvas HUD)
 * Displays tool mode, scale, snapping, plane pitch, zoom controls, and quick shortcuts toggle.
 */
export const RoofStatusBar: React.FC<{
  activeTool: RoofTool
  scalePixelsPerMeter: number
  isCalibrated: boolean
  enableSnapping: boolean
  onToggleSnapping?: () => void
  isRoofLocked: boolean
  onToggleRoofLock?: () => void
  selectedCount?: number
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onCenterFitView: () => void
  onOpenShortcutsGuide?: () => void
}> = ({
  activeTool,
  scalePixelsPerMeter,
  isCalibrated,
  enableSnapping,
  onToggleSnapping,
  isRoofLocked,
  onToggleRoofLock,
  selectedCount = 0,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCenterFitView,
  onOpenShortcutsGuide,
}) => {
  return (
    <div className="w-full h-8 bg-[#1e1e20] border-t border-zinc-800/90 px-3 flex items-center justify-between text-xs text-zinc-400 select-none font-mono shrink-0 shadow-xs z-10">
      {/* Left: Document CAD Status Readouts */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-zinc-400">Tool:</span>
          <span className="text-zinc-100 font-semibold uppercase">{activeTool}</span>
        </div>

        <div className="w-px h-3 bg-zinc-700 hidden sm:block" />

        <div className="hidden sm:flex items-center gap-1">
          <span className="text-zinc-400">Scale:</span>
          <span className="text-amber-400 font-semibold">
            {isCalibrated ? `${scalePixelsPerMeter.toFixed(1)} px/m` : 'Default (50 px/m)'}
          </span>
        </div>

        <div className="w-px h-3 bg-zinc-700 hidden sm:block" />

        {onToggleSnapping ? (
          <button
            type="button"
            onClick={onToggleSnapping}
            className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Toggle Magnet Snapping"
          >
            <span className="text-zinc-400">Snap:</span>
            <span className={cn('font-semibold', enableSnapping ? 'text-blue-400' : 'text-amber-300')}>
              {enableSnapping ? 'ON (20mm)' : 'OFF'}
            </span>
          </button>
        ) : (
          <div>
            <span className="text-zinc-400">Snap:</span>{' '}
            <span className={cn('font-semibold', enableSnapping ? 'text-blue-400' : 'text-amber-300')}>
              {enableSnapping ? 'ON' : 'OFF'}
            </span>
          </div>
        )}

        <div className="w-px h-3 bg-zinc-700 hidden md:block" />

        {/* Selection Status Readout */}
        <div className="hidden md:flex items-center gap-1">
          <span className="text-zinc-400">Selected:</span>
          <span className={cn('font-semibold', selectedCount > 0 ? 'text-sky-400' : 'text-zinc-400')}>
            {selectedCount > 0 ? `${selectedCount} Panel${selectedCount > 1 ? 's' : ''}` : 'None'}
          </span>
        </div>
      </div>

      {/* Right: Photoshop Viewport Zoom & Shortcuts Quick Button */}
      <div className="flex items-center gap-2">
        {onOpenShortcutsGuide && (
          <button
            type="button"
            onClick={onOpenShortcutsGuide}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px]"
            title="Show Keyboard Shortcuts Reference Guide"
          >
            <HelpCircle className="size-3 text-sky-400" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="px-1 bg-zinc-900 border border-zinc-700 rounded text-[9px] font-mono text-zinc-300 font-bold">?</kbd>
          </button>
        )}

        <div className="w-px h-3 bg-zinc-700" />

        <div className="flex items-center bg-zinc-900 rounded border border-zinc-700/80 p-0.5">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="size-3" />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="px-1.5 text-[11px] font-mono font-medium hover:bg-zinc-800 text-zinc-200 rounded transition-colors cursor-pointer"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="size-3" />
          </button>
          <button
            type="button"
            onClick={onCenterFitView}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer ml-0.5"
            title="Fit Roof Boundary to Screen"
          >
            <Maximize className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 4. Photoshop Shortcuts Quick Reference Banner (Bottom Legend Strip)
 */
export const RoofShortcutsCheatSheet: React.FC<{
  onOpenFullGuide?: () => void
}> = ({ onOpenFullGuide }) => {
  return (
    <div className="w-full h-7 bg-[#18181b] border-t border-zinc-800/80 px-3 flex items-center justify-between text-[11px] text-zinc-400 select-none overflow-x-auto no-scrollbar shrink-0">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-sky-300 font-bold">V</kbd>
          Move / Select
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-sky-300 font-bold">P</kbd>
          Pen Tool
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-sky-300 font-bold">R</kbd>
          Box Tool
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-sky-300 font-bold">S</kbd>
          Scale
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-sky-300 font-bold">Ctrl+G</kbd>
          Group
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-emerald-300 font-bold">Ctrl+D</kbd>
          Duplicate
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">[ / ]</kbd>
          Tilt (±15°)
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-purple-300 font-bold">T</kbd>
          Rack Pitch
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-sky-300 font-bold">Ctrl+A</kbd>
          Select All
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">Shift+Click</kbd>
          Multi-Select
        </span>
        <span className="flex items-center gap-1 font-mono">
          <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">Space</kbd>
          Pan
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-500" />
          Active Module
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rose-500" />
          Out of Roof
        </span>
        {onOpenFullGuide && (
          <button
            type="button"
            onClick={onOpenFullGuide}
            className="text-sky-400 hover:text-sky-300 underline underline-offset-2 ml-2 cursor-pointer font-sans"
          >
            Full Hotkey Guide
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Backward-compatible default RoofControls component
 */
export const RoofControls: React.FC<RoofControlsProps> = (props) => {
  return (
    <RoofOptionsBar
      activeTool={props.activeTool}
      onSelectTool={props.onSelectTool}
      selectedPanelId={props.selectedPanelId}
      selectedPanelIds={props.selectedPanelIds}
      onSelectPanels={props.onSelectPanels}
      onGroupSelected={props.onGroupSelected}
      onUngroupSelected={props.onUngroupSelected}
      onDuplicateSelected={props.onDuplicateSelected}
      onApplyPerspectivePreset={props.onApplyPerspectivePreset}
      placedPanels={props.placedPanels}
      currentRotation={props.currentRotation || 0}
      currentTiltAngle={props.currentTiltAngle || 0}
      orientation={props.orientation}
      onToggleOrientation={props.onToggleOrientation}
      onCycleTilt={props.onCycleTilt}
      onApplyTiltToAll={props.onApplyTiltToAll}
      onRotateSelected={props.onRotateSelected}
      onSetSelectedRotation={props.onSetSelectedRotation}
      onRotateAllPanels={props.onRotateAllPanels}
      onApplyRotationToAll={props.onApplyRotationToAll}
      onAlignCollinear={props.onAlignCollinear}
      isDrawingPolygon={props.isDrawingPolygon}
      onClosePolygon={props.onClosePolygon}
      onOpenRoofSizeModal={props.onOpenRoofSizeModal}
      isCalibrated={props.isCalibrated}
      pixelsPerMeter={props.pixelsPerMeter}
      enableSnapping={props.enableSnapping}
      onToggleSnapping={props.onToggleSnapping}
      isRoofLocked={props.isRoofLocked}
      onToggleRoofLock={props.onToggleRoofLock}
      hasBoundary={props.hasBoundary}
      canAutoFill={props.canAutoFill}
      onAutoFill={props.onAutoFill}
      targetBoqCount={props.targetBoqCount}
      onPlaceBoqPanels={props.onPlaceBoqPanels}
      canAddPanel={props.canAddPanel}
      onAddSinglePanel={props.onAddSinglePanel}
      canUndo={props.canUndo}
      onUndo={props.onUndo}
      canRedo={props.canRedo}
      onRedo={props.onRedo}
    />
  )
}
