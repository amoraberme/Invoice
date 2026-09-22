'use client'

import React, { useState } from 'react'
import {
  DimensionUnit,
  AreaUnit,
  RoofSizePreset,
} from '@/types/roof'
import {
  feetToMeters,
  metersToFeet,
  sqmToSqft,
  sqftToSqm,
} from '@/utils/geometry'
import { Button } from '@/components/ui/button'
import {
  Maximize2,
  Sparkles,
  X,
  Ruler,
  Layers,
  Check,
  Building,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoofSizeModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyRoofSize: (widthM: number, lengthM: number, autoPlaceBoq: boolean) => void
  targetBoqCount: number
  targetBoqWattage: number
}

const PRESETS: RoofSizePreset[] = [
  {
    name: 'Small Residential (Ideal for 4kW / 6 Panels)',
    widthM: 7.5,
    lengthM: 5.0,
    description: '37.5 m² (403 sq ft) • 2 rows of 3 modules',
  },
  {
    name: 'Medium Residential (5kW–8kW / 8–12 Panels)',
    widthM: 9.5,
    lengthM: 6.0,
    description: '57.0 m² (613 sq ft) • 2–3 rows of 4 modules',
  },
  {
    name: 'Large Roof / Commercial (10kW+ / 16+ Panels)',
    widthM: 13.0,
    lengthM: 7.5,
    description: '97.5 m² (1,049 sq ft) • 4 rows of 4+ modules',
  },
]

export const RoofSizeModal: React.FC<RoofSizeModalProps> = ({
  isOpen,
  onClose,
  onApplyRoofSize,
  targetBoqCount,
  targetBoqWattage,
}) => {
  const [mode, setMode] = useState<'dimensions' | 'area'>('dimensions')
  const [dimUnit, setDimUnit] = useState<DimensionUnit>('meters')
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('sqm')

  // Input states in currently selected unit
  const [widthInput, setWidthInput] = useState<string>('7.5')
  const [lengthInput, setLengthInput] = useState<string>('5.0')
  const [areaInput, setAreaInput] = useState<string>('37.5')
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3) // 4:3
  const [autoPlaceBoq, setAutoPlaceBoq] = useState<boolean>(true)

  if (!isOpen) return null

  // Calculate values in meters
  let calculatedWidthM = 7.5
  let calculatedLengthM = 5.0

  if (mode === 'dimensions') {
    const rawW = parseFloat(widthInput) || 0
    const rawL = parseFloat(lengthInput) || 0
    calculatedWidthM = dimUnit === 'meters' ? rawW : feetToMeters(rawW)
    calculatedLengthM = dimUnit === 'meters' ? rawL : feetToMeters(rawL)
  } else {
    const rawArea = parseFloat(areaInput) || 0
    const areaM2 = areaUnit === 'sqm' ? rawArea : sqftToSqm(rawArea)
    // Area = W * L and W / L = aspectRatio => W = sqrt(Area * ratio), L = Area / W
    if (areaM2 > 0 && aspectRatio > 0) {
      calculatedWidthM = Math.sqrt(areaM2 * aspectRatio)
      calculatedLengthM = areaM2 / calculatedWidthM
    }
  }

  const calculatedAreaM2 = calculatedWidthM * calculatedLengthM
  const calculatedAreaSqFt = sqmToSqft(calculatedAreaM2)

  const handleApply = () => {
    if (calculatedWidthM <= 1 || calculatedLengthM <= 1) {
      alert('Please enter valid roof dimensions (at least 1m x 1m).')
      return
    }
    onApplyRoofSize(calculatedWidthM, calculatedLengthM, autoPlaceBoq)
    onClose()
  }

  const handleSelectPreset = (preset: RoofSizePreset) => {
    if (dimUnit === 'meters') {
      setWidthInput(preset.widthM.toFixed(1))
      setLengthInput(preset.lengthM.toFixed(1))
    } else {
      setWidthInput(metersToFeet(preset.widthM).toFixed(1))
      setLengthInput(metersToFeet(preset.lengthM).toFixed(1))
    }
    const areaM2 = preset.widthM * preset.lengthM
    setAreaInput(areaUnit === 'sqm' ? areaM2.toFixed(1) : sqmToSqft(areaM2).toFixed(1))
    setMode('dimensions')
  }

  const handleToggleDimUnit = (newUnit: DimensionUnit) => {
    if (newUnit === dimUnit) return
    const w = parseFloat(widthInput) || 0
    const l = parseFloat(lengthInput) || 0
    if (newUnit === 'feet') {
      setWidthInput(metersToFeet(w).toFixed(1))
      setLengthInput(metersToFeet(l).toFixed(1))
    } else {
      setWidthInput(feetToMeters(w).toFixed(1))
      setLengthInput(feetToMeters(l).toFixed(1))
    }
    setDimUnit(newUnit)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Ruler className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Set Roof Size & Dimensions
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Specify roof size in meters, feet, or square meters.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-muted p-1 border border-border">
            <button
              type="button"
              onClick={() => setMode('dimensions')}
              className={cn(
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer',
                mode === 'dimensions'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Width × Length (Dimensions)
            </button>
            <button
              type="button"
              onClick={() => setMode('area')}
              className={cn(
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer',
                mode === 'area'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Total Area (sqm / sq ft)
            </button>
          </div>

          {/* Mode 1: Width x Length */}
          {mode === 'dimensions' && (
            <div className="space-y-4">
              {/* Unit Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Measurement Unit:</span>
                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/50 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleDimUnit('meters')}
                    className={cn(
                      'px-3 py-1 rounded transition-colors font-medium cursor-pointer',
                      dimUnit === 'meters'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Meters (m)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleDimUnit('feet')}
                    className={cn(
                      'px-3 py-1 rounded transition-colors font-medium cursor-pointer',
                      dimUnit === 'feet'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Feet (ft)
                  </button>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>Roof Width (Eaves):</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {dimUnit === 'meters' ? 'Horizontal' : 'Width'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="100"
                      value={widthInput}
                      onChange={(e) => setWidthInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-input/40 border border-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-semibold">
                      {dimUnit === 'meters' ? 'm' : 'ft'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>Roof Length (Slope / Ridge):</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {dimUnit === 'meters' ? 'Vertical' : 'Length'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="100"
                      value={lengthInput}
                      onChange={(e) => setLengthInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-input/40 border border-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-semibold">
                      {dimUnit === 'meters' ? 'm' : 'ft'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Total Area */}
          {mode === 'area' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Area Unit:</span>
                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (areaUnit !== 'sqm') {
                        const val = parseFloat(areaInput) || 0
                        setAreaInput(sqftToSqm(val).toFixed(1))
                        setAreaUnit('sqm')
                      }
                    }}
                    className={cn(
                      'px-3 py-1 rounded transition-colors font-medium cursor-pointer',
                      areaUnit === 'sqm'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Square Meters (m²)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (areaUnit !== 'sqft') {
                        const val = parseFloat(areaInput) || 0
                        setAreaInput(sqmToSqft(val).toFixed(1))
                        setAreaUnit('sqft')
                      }
                    }}
                    className={cn(
                      'px-3 py-1 rounded transition-colors font-medium cursor-pointer',
                      areaUnit === 'sqft'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Square Feet (sq ft)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Total Roof Area:</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="5000"
                    value={areaInput}
                    onChange={(e) => setAreaInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-input/40 border border-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-semibold">
                    {areaUnit === 'sqm' ? 'm²' : 'sq ft'}
                  </span>
                </div>
              </div>

              {/* Aspect Ratio Options */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Roof Aspect Ratio:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '4:3 Standard', ratio: 4 / 3 },
                    { label: '16:9 Wide Gable', ratio: 16 / 9 },
                    { label: '1:1 Square', ratio: 1.0 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setAspectRatio(item.ratio)}
                      className={cn(
                        'py-1.5 px-2 rounded-md border text-xs text-center transition-all cursor-pointer font-medium',
                        Math.abs(aspectRatio - item.ratio) < 0.05
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live Calculated Dimensions Preview */}
          <div className="bg-muted/50 rounded-xl p-3.5 border border-border flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">Calculated Roof Plane:</span>
              <div className="text-sm font-bold font-mono text-foreground">
                {calculatedWidthM.toFixed(1)}m × {calculatedLengthM.toFixed(1)}m
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({metersToFeet(calculatedWidthM).toFixed(1)}ft × {metersToFeet(calculatedLengthM).toFixed(1)}ft)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium text-muted-foreground">Surface Area:</span>
              <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                {calculatedAreaM2.toFixed(1)} m²
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  ({calculatedAreaSqFt.toFixed(0)} sq ft)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Quick Standard Presets:</span>
            <div className="grid grid-cols-1 gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-blue-500/40 hover:bg-muted/40 transition-colors text-left cursor-pointer group"
                >
                  <div>
                    <span className="text-xs font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {preset.name}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{preset.description}</p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-muted-foreground shrink-0 ml-2">
                    {preset.widthM}m × {preset.lengthM}m
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Place BoQ Panels Checkbox */}
          {targetBoqCount > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-3">
              <input
                type="checkbox"
                id="auto-place-boq-check"
                checked={autoPlaceBoq}
                onChange={(e) => setAutoPlaceBoq(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="auto-place-boq-check" className="text-xs text-foreground cursor-pointer select-none">
                <span className="font-semibold block text-blue-700 dark:text-blue-300">
                  Auto-place all {targetBoqCount} BoQ panels immediately
                </span>
                <span className="text-muted-foreground text-[11px] block mt-0.5">
                  Neatly arrange the {targetBoqCount} panels ({((targetBoqCount * targetBoqWattage) / 1000).toFixed(2)} kWp) in rows centered inside this new roof boundary.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleApply}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
          >
            <Sparkles className="size-3.5" />
            <span>Generate Roof Plane</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
