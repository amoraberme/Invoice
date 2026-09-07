'use client'

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Zap,
  Search,
  Check,
  Copy,
  Layers,
  ArrowRight,
  SunMedium,
  Gauge,
  Sparkles,
  SlidersHorizontal,
  Table as TableIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SizingReferenceV2Item {
  kw: number
  commercialPackage: string
  packageModules: string
  panelCount: number
  actualDcCapacity: string
  inverterAcOutput: string
  electricalGrid: string
  targetMonthlyKwh: string
  derivedElectricBill: string
  derivedElectricBillShort: string
  estMonthlyGen: string
  targetSolarOffset: string
  phase: '1-Phase' | '3-Phase'
}

export const SIZING_REFERENCE_V2: SizingReferenceV2Item[] = [
  {
    kw: 1.5,
    commercialPackage: '1.5 kW Package',
    packageModules: '3 pcs',
    panelCount: 3,
    actualDcCapacity: '1.86 kWp',
    inverterAcOutput: '1.5 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '180 - 330 kWh',
    derivedElectricBill: '₱2,700 – ₱5,000',
    derivedElectricBillShort: '₱2.7k–₱5.0k',
    estMonthlyGen: '182.8 kWh/mo',
    targetSolarOffset: '55% - 85%',
    phase: '1-Phase',
  },
  {
    kw: 3.0,
    commercialPackage: '3.0 kW Package',
    packageModules: '5 pcs',
    panelCount: 5,
    actualDcCapacity: '3.10 kWp',
    inverterAcOutput: '3.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '330 - 450 kWh',
    derivedElectricBill: '₱5,000 – ₱6,700',
    derivedElectricBillShort: '₱5.0k–₱6.7k',
    estMonthlyGen: '304.7 kWh/mo',
    targetSolarOffset: '68% - 85%',
    phase: '1-Phase',
  },
  {
    kw: 4.0,
    commercialPackage: '4.0 kW Package',
    packageModules: '6 pcs',
    panelCount: 6,
    actualDcCapacity: '3.72 kWp',
    inverterAcOutput: '4.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '450 - 600 kWh',
    derivedElectricBill: '₱6,700 – ₱9,000',
    derivedElectricBillShort: '₱6.7k–₱9.0k',
    estMonthlyGen: '365.6 kWh/mo',
    targetSolarOffset: '61% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 5.0,
    commercialPackage: '5.0 kW Package',
    packageModules: '8 pcs',
    panelCount: 8,
    actualDcCapacity: '4.96 kWp',
    inverterAcOutput: '5.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '600 - 750 kWh',
    derivedElectricBill: '₱9,000 – ₱11,200',
    derivedElectricBillShort: '₱9.0k–₱11.2k',
    estMonthlyGen: '487.5 kWh/mo',
    targetSolarOffset: '65% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 6.0,
    commercialPackage: '6.0 kW Package',
    packageModules: '10 pcs',
    panelCount: 10,
    actualDcCapacity: '6.20 kWp',
    inverterAcOutput: '6.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '750 - 1,000 kWh',
    derivedElectricBill: '₱11,200 – ₱15,000',
    derivedElectricBillShort: '₱11.2k–₱15.0k',
    estMonthlyGen: '609.3 kWh/mo',
    targetSolarOffset: '61% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 8.0,
    commercialPackage: '8.0 kW Package',
    packageModules: '13 pcs (2 Str)',
    panelCount: 13,
    actualDcCapacity: '8.06 kWp',
    inverterAcOutput: '8.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '1,000 - 1,250 kWh',
    derivedElectricBill: '₱15,000 – ₱18,700',
    derivedElectricBillShort: '₱15.0k–₱18.7k',
    estMonthlyGen: '792.1 kWh/mo',
    targetSolarOffset: '63% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 10.0,
    commercialPackage: '10.0 kW Package',
    packageModules: '16 pcs (2 Str)',
    panelCount: 16,
    actualDcCapacity: '9.92 kWp',
    inverterAcOutput: '10.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '1,250 - 1,600 kWh',
    derivedElectricBill: '₱18,700 – ₱24,000',
    derivedElectricBillShort: '₱18.7k–₱24.0k',
    estMonthlyGen: '974.9 kWh/mo',
    targetSolarOffset: '61% - 80%',
    phase: '3-Phase',
  },
  {
    kw: 12.0,
    commercialPackage: '12.0 kW Package',
    packageModules: '20 pcs (2 Str)',
    panelCount: 20,
    actualDcCapacity: '12.40 kWp',
    inverterAcOutput: '12.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '1,600 - 2,100 kWh',
    derivedElectricBill: '₱24,000 – ₱31,500',
    derivedElectricBillShort: '₱24.0k–₱31.5k',
    estMonthlyGen: '1,218.7 kWh/mo',
    targetSolarOffset: '58% - 80%',
    phase: '3-Phase',
  },
  {
    kw: 16.0,
    commercialPackage: '16.0 kW Package',
    packageModules: '26 pcs (2 Str)',
    panelCount: 26,
    actualDcCapacity: '16.12 kWp',
    inverterAcOutput: '16.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '2,100 - 2,600 kWh',
    derivedElectricBill: '₱31,500 – ₱39,000',
    derivedElectricBillShort: '₱31.5k–₱39.0k',
    estMonthlyGen: '1,584.3 kWh/mo',
    targetSolarOffset: '61% - 75%',
    phase: '3-Phase',
  },
  {
    kw: 20.0,
    commercialPackage: '20.0 kW Package',
    packageModules: '32 pcs (2 Str)',
    panelCount: 32,
    actualDcCapacity: '19.84 kWp',
    inverterAcOutput: '20.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '2,600 - 3,600 kWh',
    derivedElectricBill: '₱39,000 – ₱54,000',
    derivedElectricBillShort: '₱39.0k–₱54.0k',
    estMonthlyGen: '1,949.9 kWh/mo',
    targetSolarOffset: '54% - 75%',
    phase: '3-Phase',
  },
  {
    kw: 30.0,
    commercialPackage: '30.0 kW Package',
    packageModules: '48 pcs (3 Str)',
    panelCount: 48,
    actualDcCapacity: '29.76 kWp',
    inverterAcOutput: '30.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '3,600 - 5,000 kWh',
    derivedElectricBill: '₱54,000 – ₱75,000',
    derivedElectricBillShort: '₱54.0k–₱75.0k',
    estMonthlyGen: '2,924.8 kWh/mo',
    targetSolarOffset: '58% - 75%',
    phase: '3-Phase',
  },
  {
    kw: 50.0,
    commercialPackage: '50.0 kW Package',
    packageModules: '81 pcs (5 Str)',
    panelCount: 81,
    actualDcCapacity: '50.22 kWp',
    inverterAcOutput: '50.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '5,000 - 8,000 kWh',
    derivedElectricBill: '₱75,000 – ₱120,000',
    derivedElectricBillShort: '₱75.0k–₱120k',
    estMonthlyGen: '4,935.6 kWh/mo',
    targetSolarOffset: '62% - 75%',
    phase: '3-Phase',
  },
]


export const KW_TO_ELECTRIC_BILL_V1: Record<number, string> = {
  1.5: '₱3,000',
  3: '₱5,000',
  4: '₱6,500',
  5: '₱8,000',
  6: '₱9,000',
  8: '₱10,000',
  10: '₱15,000',
  12: '₱20,000',
  16: '₱30,000',
  20: '₱40,000',
  30: '₱60,000',
  50: '₱100,000',
}

export function getElectricBillRefV2(kw: number, short = true): string {
  const item = SIZING_REFERENCE_V2.find(s => Math.abs(s.kw - kw) < 0.1)
  if (item) {
    return short ? item.derivedElectricBillShort : item.derivedElectricBill
  }
  return `₱${Math.round(kw * 1600).toLocaleString()}`
}

export function getSizingReferenceItem(kw: number): SizingReferenceV2Item | undefined {
  return SIZING_REFERENCE_V2.find(s => Math.abs(s.kw - kw) < 0.1)
}

interface SizingReferenceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeKw?: number
  onSelectKw?: (kw: number) => void
  currentRefVersion?: 'v1' | 'v2'
  onToggleVersion?: (ver: 'v1' | 'v2') => void
}

export function SizingReferenceModal({
  open,
  onOpenChange,
  activeKw,
  onSelectKw,
  currentRefVersion = 'v2',
  onToggleVersion,
}: SizingReferenceModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<'all' | '1-Phase' | '3-Phase'>('all')
  const [copiedKw, setCopiedKw] = useState<number | null>(null)

  const filteredItems = useMemo(() => {
    return SIZING_REFERENCE_V2.filter((item) => {
      const matchesPhase = phaseFilter === 'all' || item.phase === phaseFilter
      if (!matchesPhase) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        item.commercialPackage.toLowerCase().includes(q) ||
        item.packageModules.toLowerCase().includes(q) ||
        item.actualDcCapacity.toLowerCase().includes(q) ||
        item.inverterAcOutput.toLowerCase().includes(q) ||
        item.electricalGrid.toLowerCase().includes(q) ||
        item.targetMonthlyKwh.toLowerCase().includes(q) ||
        item.derivedElectricBill.toLowerCase().includes(q) ||
        item.estMonthlyGen.toLowerCase().includes(q) ||
        item.targetSolarOffset.toLowerCase().includes(q)
      )
    })
  }, [searchQuery, phaseFilter])

  const handleCopyRow = (item: SizingReferenceV2Item) => {
    const text = `${item.commercialPackage} | Modules: ${item.packageModules} | DC: ${item.actualDcCapacity} | Inverter: ${item.inverterAcOutput} | Grid: ${item.electricalGrid} | Target: ${item.targetMonthlyKwh} | Bill: ${item.derivedElectricBill} | Gen: ${item.estMonthlyGen} | Offset: ${item.targetSolarOffset}`
    navigator.clipboard.writeText(text)
    setCopiedKw(item.kw)
    setTimeout(() => setCopiedKw(null), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl! w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-[18px]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-[10px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Zap size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    Electric Bill & Sizing Reference
                  </DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Standard commercial packages, DC/AC capacities, monthly targets, derived electric bill, and solar offset matrix.
                </p>
              </div>
            </div>
          </div>

          {/* Search & Phase Filters */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search packages, kW, modules, bill, grid connection..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background rounded-[8px] border border-border focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-[8px] border border-border shrink-0">
              {(['all', '1-Phase', '3-Phase'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPhaseFilter(p)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded-[6px] transition-all cursor-pointer capitalize",
                    phaseFilter === p
                      ? "bg-background text-foreground shadow-2xs font-extrabold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === 'all' ? 'All Phases' : p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-5">
          <div className="border border-border rounded-[14px] overflow-x-auto bg-card shadow-2xs">
            <table className="w-full border-collapse text-left text-xs min-w-[900px]">
              <thead>
                <tr className="bg-secondary/70 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                  <th className="py-2.5 px-3.5 font-bold">Commercial Package</th>
                  <th className="py-2.5 px-3 font-bold text-center">Package Modules</th>
                  <th className="py-2.5 px-3 font-bold text-center">Actual DC Cap</th>
                  <th className="py-2.5 px-3 font-bold text-center">Inverter AC</th>
                  <th className="py-2.5 px-3 font-bold text-center">Electrical Grid</th>
                  <th className="py-2.5 px-3 font-bold text-center">Target Monthly</th>
                  <th className="py-2.5 px-3.5 font-bold text-center text-primary">Derived Electric Bill</th>
                  <th className="py-2.5 px-3 font-bold text-center">Est. Monthly Gen</th>
                  <th className="py-2.5 px-3 font-bold text-center">Target Solar</th>
                  <th className="py-2.5 px-3 font-bold text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {filteredItems.map((item) => {
                  const isSelected = activeKw === item.kw
                  const isThreePhase = item.phase === '3-Phase'

                  return (
                    <tr
                      key={item.kw}
                      className={cn(
                        "transition-colors group",
                        isSelected
                          ? "bg-primary/10 dark:bg-primary/15 font-semibold"
                          : "hover:bg-secondary/40"
                      )}
                    >
                      {/* Package Name */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              isSelected ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
                            )}
                          />
                          <div>
                            <span className="font-bold text-foreground text-xs">{item.commercialPackage}</span>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {item.kw} kW Inverter System
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Package Modules */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-foreground bg-secondary/80 px-2 py-0.5 rounded-[6px] border border-border">
                          {item.packageModules}
                        </span>
                      </td>

                      {/* Actual DC Capacity */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                        {item.actualDcCapacity}
                      </td>

                      {/* Inverter AC Output */}
                      <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                        {item.inverterAcOutput}
                      </td>

                      {/* Electrical Grid Connection */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border inline-block whitespace-nowrap",
                            isThreePhase
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                          )}
                        >
                          {item.electricalGrid}
                        </span>
                      </td>

                      {/* Target Monthly Consumption */}
                      <td className="py-3 px-3 text-center font-mono text-foreground text-[11px]">
                        {item.targetMonthlyKwh}
                      </td>

                      {/* Derived Electric Bill */}
                      <td className="py-3 px-3.5 text-center">
                        <span className="font-mono font-extrabold text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-[8px] border border-primary/20 whitespace-nowrap">
                          {item.derivedElectricBill}
                        </span>
                      </td>

                      {/* Est. Monthly Generation */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {item.estMonthlyGen}
                      </td>

                      {/* Target Solar Offset */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {item.targetSolarOffset}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => handleCopyRow(item)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Copy package details to clipboard"
                          >
                            {copiedKw === item.kw ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </Button>
                          {onSelectKw && (
                            <Button
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="xs"
                              onClick={() => {
                                onSelectKw(item.kw)
                                onOpenChange(false)
                              }}
                              className={cn(
                                "h-7 px-2 text-[10px] font-bold cursor-pointer transition-all",
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow-xs"
                                  : "hover:bg-primary hover:text-primary-foreground"
                              )}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border bg-card/60 flex items-center justify-between text-xs text-muted-foreground shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> 1-Phase (1.5kW – 8.0kW)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> 3-Phase (10.0kW – 50.0kW)
            </span>
            <span className="text-[11px] font-mono">
              Total {SIZING_REFERENCE_V2.length} Standard Commercial Packages
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 cursor-pointer"
          >
            Close Reference
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
