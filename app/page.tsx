'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Download, Building, Users, FileText, List, CreditCard, StickyNote, Contact, Sparkles, Package, Wrench, Search, ClipboardCheck, CheckSquare, ArrowLeft, ArrowRight, Tag, Check, Copy, Printer, RefreshCw, Coins, DollarSign, Truck, Calculator, TrendingUp, History, Clock, RotateCcw, CheckCircle2, Eye, ShieldCheck, Loader2, Zap, Layers, MapPin, Table as TableIcon, Info } from 'lucide-react'
import { cn, generateDocumentId, formatCurrency, isLaborItem, isDeliveryItem, isBatteryItem, isBatteryUnit, isAtsItem, sortLineItems, calculateTotal, calculateSubtotal, calculateCommissionableBase, calculateSalesCommission, extractPanelInfoFromLineItems, addDays, getCondensedLineItems, generateDefaultScopesFromInvoice, generateDefaultWarrantiesFromInvoice } from '@/lib/utils'
import { useMGInvoice } from '@/lib/use-mg-invoice'
import { exportToPdfDirect, exportToPngDirect, saveBlobWithPicker } from '@/lib/pdf-export'
import JSZip from 'jszip'
import { type LineItem, type ExpenseItem, type InvoiceHistoryItem, type ChangelogItem, type WarrantyItem, type ScopeOfWorkItem, newWarrantyItem, newScopeItem, defaultWarranties, defaultInvoice } from '@/lib/types'
import { PHILIPPINE_LGUS, type PhilippineLGU, type PhilippineLocationItem, calculateDeliveryFee, searchPhilippineLocations, formatPhilippineAddress, SERVICEABLE_DISTANCE_KM, isWithinServiceableArea } from '@/lib/philippine-locations'
import { getInvoiceHistory, saveInvoiceToHistory, deleteHistoryItem, clearInvoiceHistory, getItemPricingInfo, getChangelogHistory, saveChangelogEntry, deleteChangelogItem, clearChangelogHistory, resetChangelogToInitial } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { MGInvoicePreview } from '@/components/mg-invoice-preview'
import { MGChecklistPreview } from '@/components/mg-checklist-preview'
import { MGCapitalPreview } from '@/components/mg-capital-preview'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  SIZING_REFERENCE_V2,
  KW_TO_ELECTRIC_BILL_V1,
  getElectricBillRefV2,
  getSizingReferenceItem,
  type SizingReferenceV2Item,
} from '@/components/SizingReferenceModal'





const PANEL_WATTAGE = 620
const PANEL_WIDTH_FT = 3.72

function getWireSize(inverterKw: number): string {
  if (inverterKw >= 10) return '#6 & #8'
  if (inverterKw === 8) return '6mm²'
  return '#8'
}

function getConduitDetails(systemKw: number, runLength: number = 30, isOld20Kw?: boolean) {
  if (systemKw <= 6) {
    return {
      description: 'Flexible hose 32mm',
      rate: 95.00,
      quantity: 25,
      unit: 'M',
      size: '32mm'
    }
  }
  if (systemKw <= 8) {
    return {
      description: 'Flexible hose 32mm',
      rate: 95.00,
      quantity: 50,
      unit: 'M',
      size: '32mm'
    }
  }
  if (systemKw >= 20) {
    return {
      description: 'Flexible hose 40mm',
      rate: 124.00,
      quantity: isOld20Kw ? 50 : 100,
      unit: 'M',
      size: '40mm'
    }
  }
  return {
    description: 'Flexible hose 40mm',
    rate: 124.00,
    quantity: 50,
    unit: 'M',
    size: '40mm'
  }
}

function getDynamicBreakerRatings(systemKw: number, batteryCountOverride?: number, batteryAh?: number, isOld20Kw?: boolean) {
  let acMcb = 'AC MCB 100A'
  let acMcbRate = 500.00
  let acMcbQty = 2

  if (systemKw <= 4) {
    acMcb = 'AC MCB 80A'
    acMcbRate = 450.00
    acMcbQty = 2
  } else if (systemKw <= 6) {
    acMcb = 'AC MCB 100A'
    acMcbRate = 500.00
    acMcbQty = 2
  } else if (systemKw <= 8) {
    acMcb = 'AC MCB 125A'
    acMcbRate = 500.00
    acMcbQty = 2
  } else if (systemKw >= 20) {
    acMcb = 'AC MCCB'
    acMcbRate = isOld20Kw ? 850.00 : 1300.00
    acMcbQty = isOld20Kw ? 4 : 8
  } else if (systemKw <= 16) {
    acMcb = 'AC MCCB'
    acMcbRate = 1300.00
    acMcbQty = 4
  }

  let ats = 'Automatic transfer switch 125A'
  let atsRate = 4000.00
  let atsAmp = 125
  let atsQty = (systemKw >= 20 && !isOld20Kw) ? 2 : 1

  if (systemKw <= 4) {
    ats = 'Automatic transfer switch 63A'
    atsRate = 1500.00
    atsAmp = 63
  } else if (systemKw <= 8) {
    ats = 'Automatic transfer switch 125A'
    atsRate = 2000.00
    atsAmp = 125
  } else {
    ats = 'Automatic transfer switch 125A'
    atsRate = 4000.00
    atsAmp = 125
  }

  const enclosure = systemKw <= 4
    ? 'Breaker box / Metal Enclosure 50x40'
    : 'Breaker box / Metal Enclosure 50x60'
  const enclosureRate = systemKw <= 4 ? 1500.00 : 3000.00
  const enclosureQty = (systemKw >= 20 && !isOld20Kw) ? 2 : 1

  let dcMcbQty = 2
  if (systemKw >= 20) {
    dcMcbQty = isOld20Kw ? 2 : 4
  } else if (systemKw >= 12) {
    dcMcbQty = 3
  } else {
    dcMcbQty = 2
  }

  let dcSpdQty = 2
  if (systemKw >= 20) {
    dcSpdQty = isOld20Kw ? 2 : 6
  } else if (systemKw >= 8) {
    dcSpdQty = 3
  } else {
    dcSpdQty = 2
  }

  const acSpdQty = (systemKw >= 20 && !isOld20Kw) ? 4 : 2
  const dcMccbQty = batteryCountOverride !== undefined && batteryCountOverride > 0
    ? batteryCountOverride
    : ((systemKw >= 20 && !isOld20Kw) ? 2 : 1)

  const dcMccb = isOld20Kw ? 'DC MCCB for battery' : 'DC MCCB 125A for battery'
  const dcMccbRate = isOld20Kw ? 2000.00 : 2500.00

  return {
    acMcb,
    acMcbRate,
    acMcbQty,
    ats,
    atsRate,
    atsAmp,
    atsQty,
    enclosure,
    enclosureRate,
    enclosureQty,
    dcMcbQty,
    dcMcbRate: 420.00,
    dcSpdQty,
    dcSpdRate: 790.00,
    acSpdQty,
    acSpdRate: 570.00,
    dcMccbQty,
    dcMccbRate,
    dcMccb,
    dcMcb: 'DC MCB',
    acSpd: 'AC SPD',
    dcSpd: 'DC SPD'
  }
}

function getDynamicWireSize(systemKw: number, runLength: number = 30, batteryCountOverride?: number, isOld20Kw?: boolean) {
  let groundWireMeters = 20
  if (systemKw === 4) groundWireMeters = 50
  else if (systemKw >= 20) groundWireMeters = 50
  else if (systemKw >= 8) groundWireMeters = 25

  let dcWireMeters = 60
  if (systemKw === 8) dcWireMeters = 60
  else if (systemKw >= 20) dcWireMeters = isOld20Kw ? 100 : 160
  else if (systemKw >= 10) dcWireMeters = 80

  let batteryCableMeters = 6
  let batteryCableDesc = 'Battery Cable (Black & Red) 50mm'
  let batteryCableRate = 700.00

  if (systemKw >= 20) {
    if (isOld20Kw) {
      batteryCableMeters = (batteryCountOverride !== undefined && batteryCountOverride > 0) ? batteryCountOverride * 2 : 2
    } else {
      batteryCableMeters = (batteryCountOverride !== undefined && batteryCountOverride > 0) ? batteryCountOverride * 10 : 20
    }
    batteryCableDesc = 'Battery Cable (Black & Red) 50mm'
    batteryCableRate = 700.00
  } else if (systemKw >= 16) {
    batteryCableMeters = (batteryCountOverride !== undefined && batteryCountOverride > 1) ? batteryCountOverride * 10 : 10
    batteryCableDesc = 'Battery Cable (Black & Red) 70mm'
    batteryCableRate = 820.00
  } else if (systemKw >= 8) {
    batteryCableMeters = (batteryCountOverride !== undefined && batteryCountOverride > 1) ? batteryCountOverride * 10 : 10
    batteryCableDesc = 'Battery Cable (Black & Red) 50mm'
    batteryCableRate = 700.00
  } else {
    batteryCableMeters = (batteryCountOverride !== undefined && batteryCountOverride > 1) ? batteryCountOverride * 6 : 6
    batteryCableDesc = 'Battery Cable (Black & Red) 50mm'
    batteryCableRate = 700.00
  }

  const groundWireDesc = systemKw >= 12 ? 'Ground Wire #8' : 'Ground Wire'
  const acWireGauge = systemKw >= 10 ? 'AC Wire #6 & AC Wire #8' : (systemKw === 8 ? 'AC Wire 6mm²' : 'AC Wire #8')

  return {
    dcCable: systemKw === 8 ? 'DC Wire 6mm²' : 'DC Wire',
    groundWire: groundWireDesc,
    groundWireDesc,
    acWire: acWireGauge,
    groundWireMeters,
    dcWireMeters,
    batteryCableMeters,
    batteryCableDesc,
    batteryCableRate
  }
}

export interface PricingReconciliationInfo {
  status: 'updated' | 'pending' | 'scaled' | 'deleted' | 'upgraded' | 'standard'
  actionBadge: string
  badgeClass: string
  title: string
  note: string
  oldPrice?: string
  newPrice?: string
  isPendingQuote?: boolean
}

export function getPricingReconciliationNote(
  item: LineItem,
  systemKw: number
): PricingReconciliationInfo | null {
  const d = (item.description || '').toLowerCase().trim()

  // Battery Cable 70mm² (Heavy-duty upgrade for 16kW: 5m Black + 5m Red)
  if (
    d.includes('70mm') ||
    (d.includes('battery cable') && systemKw >= 16 && !d.includes('50mm'))
  ) {
    return {
      status: 'upgraded',
      actionBadge: '70MM² HEAVY-DUTY',
      badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
      title: '16kW 70mm² Battery Cable (Black & Red)',
      note: '16kW maximum hybrid requires heavy-duty 70mm² cable (5m Black + 5m Red = 10m) @ ₱820.00/m (+35% copper gauge rating).',
      oldPrice: '50mm² @ ₱700.00/m',
      newPrice: '70mm² @ ₱820.00/m (10m)'
    }
  }

  return null
}

function getInverterKwFromLineItems(lineItems: LineItem[]): number {
  const inverterItem = lineItems.find(it => {
    if (isBatteryUnit(it.description)) return false
    const d = it.description.toLowerCase()
    return d.includes('inverter') || d.includes('solis') || d.includes('goodwe') || d.includes('deye') || d.includes('growatt') || d.includes('anern') || d.includes('hypontech') || d.includes('solax') || d.includes('foxess') || d.includes('sunways') || d.includes('sungrow')
  })
  if (inverterItem) {
    const match = inverterItem.description.match(/(\d+(?:\.\d+)?)\s*kW/i)
    if (match) {
      const baseKw = parseFloat(match[1])
      const qty = inverterItem.quantity && inverterItem.quantity > 1 ? inverterItem.quantity : 1
      return baseKw * qty
    }
  }
  const { totalWatts } = extractPanelInfoFromLineItems(lineItems)
  if (totalWatts > 0) {
    return Math.round(totalWatts / 1000)
  }
  return 5
}

function recalculateBoqAccessories(lineItems: LineItem[], rowsCountOverride?: number, twentyKwModeOverride?: 'parallel' | 'single'): { updated: boolean, items: LineItem[] } {
  const inverterKw = getInverterKwFromLineItems(lineItems)
  const inverterItem = lineItems.find(it => {
    if (isBatteryUnit(it.description)) return false
    const d = it.description.toLowerCase()
    return d.includes('inverter') || d.includes('solis') || d.includes('goodwe') || d.includes('deye') || d.includes('anern') || d.includes('growatt')
  })
  const isOld20Kw = inverterKw === 20 && (
    twentyKwModeOverride === 'single' ||
    (twentyKwModeOverride === undefined && inverterItem?.quantity === 1)
  )

  const runLength = 30
  const batteryItems = lineItems.filter(it => isBatteryUnit(it.description))
  const totalBatteryQty = batteryItems.reduce((sum, it) => sum + (it.quantity || 0), 0)
  const effectiveBatteryQty = totalBatteryQty > 0 ? totalBatteryQty : ((inverterKw >= 20 && !isOld20Kw) ? 2 : 1)

  let detectedBatteryAh: number | undefined
  if (batteryItems.length > 0) {
    const desc = batteryItems[0].description.toLowerCase()
    if (desc.includes('100ah') || desc.includes('100 ah')) detectedBatteryAh = 100
    else if (desc.includes('200ah') || desc.includes('200 ah')) detectedBatteryAh = 200
    else if (desc.includes('314ah') || desc.includes('314 ah')) detectedBatteryAh = 314
    else if (desc.includes('410ah') || desc.includes('410 ah')) detectedBatteryAh = 410
  }

  const wireInfo = getDynamicWireSize(inverterKw, runLength, effectiveBatteryQty, isOld20Kw)
  const breakers = getDynamicBreakerRatings(inverterKw, effectiveBatteryQty, detectedBatteryAh, isOld20Kw)

  const panelItem = lineItems.find(it => it.description.toLowerCase().includes('panel'))
  const panelQty = panelItem ? panelItem.quantity : 0
  
  const rows = panelQty <= 0 ? 0 : Math.ceil(panelQty / 2)
  const effectiveRows = (rowsCountOverride !== undefined && rowsCountOverride > 0 && (rowsCountOverride > 1 || rows <= 1)) ? rowsCountOverride : rows
  const extraQty = 0
  
  const newRailingQty = panelQty <= 0 ? 0 : Math.ceil((panelQty / 2) * 3) + extraQty
  const newMidClampQty = panelQty <= 0 ? 0 : Math.ceil(panelQty * 2.5)
  const newEndClampQty = effectiveRows * 6
  const newLFootQty = newRailingQty * 3
  const newSpliceConnectorQty = inverterKw <= 5 ? 6 : Math.ceil(newRailingQty / 2)
  
  const newMc4Qty = isOld20Kw ? 15 : (inverterKw >= 20 ? 30 : (inverterKw <= 5 ? 4 : (inverterKw === 6 ? 10 : 15)))
  const newGroundLugQty = isOld20Kw ? 5 : (inverterKw >= 20 ? 10 : ((inverterKw === 8 || inverterKw === 10) ? 5 : 2))
  const newGroundWireQty = wireInfo.groundWireMeters
  const newPvcMouldingQty = isOld20Kw ? 5 : (inverterKw >= 20 ? 10 : (inverterKw <= 5 ? 3 : 5))
  const newCableTrayQty = isOld20Kw ? 1 : (inverterKw >= 20 ? 4 : (inverterKw >= 8 ? 2 : 1))
  const newGroundRodQty = isOld20Kw ? 1 : (inverterKw >= 16 ? 2 : 1)
  let baseLugs50 = isOld20Kw ? 5 : (inverterKw >= 20 ? 32 : (inverterKw <= 6 ? 8 : (inverterKw <= 10 ? 16 : 20)))
  if (effectiveBatteryQty > 1 && inverterKw < 20) {
    baseLugs50 += (effectiveBatteryQty - 1) * 8
  }
  const newLugs50Qty = baseLugs50
  const newLugs25Qty = isOld20Kw ? 30 : (inverterKw >= 20 ? 72 : (inverterKw <= 6 ? 0 : 36))

  let changed = false
  let seenAcWire6 = false
  let seenAcWire8 = false
  let seenMccb100 = false
  let seenMccb125 = false

  const mappedItems = lineItems.map(item => {
    const descLower = item.description.toLowerCase().trim()
    if (
      descLower === 'flexible hose' ||
      descLower.startsWith('flexible hose') ||
      descLower.includes('flexcon') ||
      descLower.includes('hdpe') ||
      (descLower.includes('hose') && !descLower.includes('battery'))
    ) {
      const details = getConduitDetails(inverterKw, runLength, isOld20Kw)
      if (
        item.description !== details.description ||
        item.quantity !== details.quantity ||
        item.rate !== details.rate ||
        item.unit !== details.unit
      ) {
        changed = true
        return {
          ...item,
          description: details.description,
          quantity: details.quantity,
          rate: details.rate,
          unit: details.unit
        }
      }
    } else if (descLower === 'railings' || descLower === 'railing' || descLower.includes('railing')) {
      if (item.quantity !== newRailingQty || item.description !== 'Railings 2.4m') {
        changed = true
        return { ...item, description: 'Railings 2.4m', quantity: newRailingQty }
      }
    } else if (descLower === 'end clamp' || descLower.includes('end clamp') || descLower.startsWith('end clamp')) {
      if (item.quantity !== newEndClampQty || item.description !== 'End Clamp') {
        changed = true
        return { ...item, description: 'End Clamp', quantity: newEndClampQty }
      }
    } else if (descLower === 'mid clamp' || descLower.includes('mid clamp') || descLower.startsWith('mid clamp')) {
      if (item.quantity !== newMidClampQty || item.description !== 'Mid Clamp') {
        changed = true
        return { ...item, description: 'Mid Clamp', quantity: newMidClampQty }
      }
    } else if (descLower === 'l foot' || descLower.includes('l foot')) {
      if (item.quantity !== newLFootQty) {
        changed = true
        return { ...item, quantity: newLFootQty }
      }
    } else if (descLower === 'splice connector' || descLower === 'splice' || descLower.includes('splice connector') || descLower.includes('splice jumper')) {
      if (item.quantity !== newSpliceConnectorQty || item.description !== 'Splice Connector' || item.rate !== 90) {
        changed = true
        return { ...item, description: 'Splice Connector', quantity: newSpliceConnectorQty, rate: 90 }
      }
    } else if (descLower.includes('mc4 2 string') || descLower.includes('mc4 2-string') || descLower.includes('mc4 2string')) {
      const targetQty = (inverterKw >= 20 && !isOld20Kw) ? 4 : (inverterKw >= 10 ? 2 : 0)
      if (item.quantity !== targetQty || item.rate !== 550 || item.description !== 'MC4 2 String') {
        changed = true
        return { ...item, description: 'MC4 2 String', quantity: targetQty, rate: 550, unit: 'PCS' }
      }
    } else if (descLower.includes('clip lock') || descLower.includes('clip-lock')) {
      const targetQty = (inverterKw >= 20 && !isOld20Kw) ? 2 : 1
      if (item.description !== 'Clip lock 3/4' || item.quantity !== targetQty || item.rate !== 180 || item.unit !== 'SET') {
        changed = true
        return { ...item, description: 'Clip lock 3/4', quantity: targetQty, rate: 180, unit: 'SET' }
      }
    } else if ((descLower.startsWith('mc4') || descLower.includes('mc4')) && !descLower.includes('2 string') && !descLower.includes('2-string') && !descLower.includes('2string')) {
      if (item.quantity !== newMc4Qty || item.rate !== 60 || item.description !== 'MC4 1500V') {
        changed = true
        return { ...item, description: 'MC4 1500V', quantity: newMc4Qty, rate: 60 }
      }
    } else if (descLower.includes('grounding lug') || descLower.includes('solar grounding lug')) {
      if (item.quantity !== newGroundLugQty || item.rate !== 50) {
        changed = true
        return { ...item, description: 'Grounding Lugs', quantity: newGroundLugQty, rate: 50 }
      }
    } else if (descLower === 'cable tray' || descLower.includes('cable tray') || descLower === 'tray') {
      if (item.description !== 'Cable Tray 2m' || item.quantity !== newCableTrayQty || item.rate !== 560) {
        changed = true
        return { ...item, description: 'Cable Tray 2m', quantity: newCableTrayQty, rate: 560 }
      }
    } else if (
      descLower === 'grounding conductor' ||
      descLower === 'grounding connector' ||
      descLower === 'ground wire' ||
      descLower === 'ground wire #8' ||
      descLower === 'ground wire 30m' ||
      descLower.includes('grounding conductor') ||
      descLower.includes('grounding connector') ||
      descLower.includes('grounding copper wire') ||
      descLower.includes('ground wire') ||
      descLower.includes('equipment grounding') ||
      descLower.includes('grounding electrode')
    ) {
      const groundWireRate = 5888 / 150
      const targetDesc = wireInfo.groundWireDesc || (inverterKw >= 12 ? 'Ground Wire #8' : 'Ground Wire')
      if (
        item.quantity !== newGroundWireQty ||
        item.description !== targetDesc ||
        item.unit !== 'M' ||
        item.rate !== groundWireRate
      ) {
        changed = true
        return {
          ...item,
          description: targetDesc,
          unit: 'M',
          quantity: newGroundWireQty,
          rate: groundWireRate
        }
      }
    } else if (descLower === 'ground rod' || descLower.includes('ground rod')) {
      if (item.description !== 'Ground Rod w/ Clamp 1.5 Meters' || item.quantity !== newGroundRodQty || item.rate !== 750) {
        changed = true
        return { ...item, description: 'Ground Rod w/ Clamp 1.5 Meters', quantity: newGroundRodQty, rate: 750 }
      }
    } else if (
      descLower === 'ac' ||
      descLower === 'ac wire' ||
      descLower === 'ac cable' ||
      descLower.includes('ac wire') ||
      descLower.includes('ac cable')
    ) {
      if (inverterKw >= 10) {
        const isExplicit8 = descLower.includes('#8') || descLower.includes('awg 8') || descLower.includes('awg #8')
        const isExplicit6 = descLower.includes('#6') || descLower.includes('awg 6') || descLower.includes('awg #6')

        let targetDesc = 'AC Wire #6'
        let targetRate = 99.34
        let targetQty = (inverterKw >= 20 && !isOld20Kw) ? 120 : (isOld20Kw ? 50 : (inverterKw >= 12 ? 100 : 60))

        if (isExplicit8 || (seenAcWire6 && !seenAcWire8)) {
          targetDesc = 'AC Wire #8'
          targetRate = 60.04
          targetQty = (inverterKw >= 20 && !isOld20Kw) ? 120 : (isOld20Kw ? 50 : (inverterKw >= 12 ? 100 : 60))
          seenAcWire8 = true
        } else {
          targetDesc = 'AC Wire #6'
          targetRate = 99.34
          targetQty = (inverterKw >= 20 && !isOld20Kw) ? 120 : (isOld20Kw ? 50 : (inverterKw >= 12 ? 100 : 60))
          seenAcWire6 = true
        }

        if (item.description !== targetDesc || item.rate !== targetRate || item.quantity !== targetQty || item.unit !== 'M') {
          changed = true
          return { ...item, description: targetDesc, rate: targetRate, quantity: targetQty, unit: 'M' }
        }
      } else {
        if (seenAcWire8) {
          changed = true
          return null
        }
        seenAcWire8 = true
        const targetDesc = inverterKw === 8 ? 'AC Wire 6mm²' : 'AC Wire #8'
        if (item.description !== targetDesc || item.rate !== 60.04 || item.quantity !== 60 || item.unit !== 'M') {
          changed = true
          return { ...item, description: targetDesc, rate: 60.04, quantity: 60, unit: 'M' }
        }
      }
    } else if (
      descLower === 'dc' ||
      descLower === 'dc wire' ||
      descLower === 'dc/pv wire' ||
      descLower === 'pv wire' ||
      descLower === 'dc cable' ||
      descLower.includes('dc wire') ||
      descLower.includes('dc/pv wire') ||
      descLower.includes('pv wire') ||
      descLower.includes('dc cable')
    ) {
      const targetDesc = inverterKw === 8 ? 'DC Wire 6mm²' : 'DC Wire'
      const targetRate = 125
      const targetQty = wireInfo.dcWireMeters
      if (item.description !== targetDesc || item.rate !== targetRate || item.quantity !== targetQty) {
        changed = true
        return { ...item, description: targetDesc, rate: targetRate, quantity: targetQty, unit: 'M' }
      }
    } else if (
      descLower === 'ac mcb' ||
      descLower.startsWith('ac mcb') ||
      descLower.includes('ac mcb') ||
      descLower === 'ac mccb' ||
      descLower.startsWith('ac mccb') ||
      descLower.includes('ac mccb')
    ) {
      if (inverterKw === 16) {
        const isExplicit125 = descLower.includes('125')
        const isExplicit100 = descLower.includes('100')

        let targetDesc = 'AC MCCB 100A'
        if (isExplicit125 || (seenMccb100 && !seenMccb125)) {
          targetDesc = 'AC MCCB 125A'
          seenMccb125 = true
        } else {
          targetDesc = 'AC MCCB 100A'
          seenMccb100 = true
        }

        if (item.description !== targetDesc || item.quantity !== 2 || item.rate !== 1300 || item.unit !== 'PCS') {
          changed = true
          return { ...item, description: targetDesc, quantity: 2, rate: 1300, unit: 'PCS' }
        }
      } else {
        if (seenMccb100) {
          changed = true
          return null
        }
        seenMccb100 = true
        const targetDesc = breakers.acMcb
        const targetRate = breakers.acMcbRate
        const targetQty = breakers.acMcbQty
        if (item.description !== targetDesc || item.quantity !== targetQty || item.rate !== targetRate || item.unit !== 'PCS') {
          changed = true
          return { ...item, description: targetDesc, quantity: targetQty, rate: targetRate, unit: 'PCS' }
        }
      }
    } else if (descLower === 'ac spd' || descLower.startsWith('ac spd')) {
      const targetQty = breakers.acSpdQty
      if (item.description !== 'AC SPD' || item.quantity !== targetQty || item.rate !== 570) {
        changed = true
        return { ...item, description: 'AC SPD', quantity: targetQty, rate: 570 }
      }
    } else if (descLower === 'dc spd' || descLower.startsWith('dc spd')) {
      const targetQty = breakers.dcSpdQty
      if (item.description !== 'DC SPD' || item.quantity !== targetQty || item.rate !== 790) {
        changed = true
        return { ...item, description: 'DC SPD', quantity: targetQty, rate: 790 }
      }
    } else if (descLower === 'dc mcb' || descLower.startsWith('dc mcb')) {
      const targetQty = breakers.dcMcbQty
      if (item.description !== 'DC MCB' || item.quantity !== targetQty || item.rate !== 420) {
        changed = true
        return { ...item, description: 'DC MCB', quantity: targetQty, rate: 420 }
      }
    } else if (descLower.includes('dc mccb') || descLower.includes('mccb for battery')) {
      const targetDesc = breakers.dcMccb
      const targetQty = breakers.dcMccbQty
      const targetRate = breakers.dcMccbRate || 2500.00
      if (item.description !== targetDesc || item.quantity !== targetQty || item.rate !== targetRate) {
        changed = true
        return { ...item, description: targetDesc, quantity: targetQty, rate: targetRate }
      }
    } else if (descLower.includes('automatic transfer switch') || descLower.includes('ats')) {
      const targetDesc = breakers.ats
      const targetRate = breakers.atsRate
      const targetQty = breakers.atsQty
      if (item.description !== targetDesc || item.rate !== targetRate || item.quantity !== targetQty) {
        changed = true
        return { ...item, description: targetDesc, quantity: targetQty, rate: targetRate }
      }
    } else if (descLower.includes('breaker box') || descLower.includes('metal enclosure')) {
      const targetDesc = breakers.enclosure
      const targetRate = breakers.enclosureRate
      const targetQty = breakers.enclosureQty
      if (item.description !== targetDesc || item.rate !== targetRate || item.quantity !== targetQty) {
        changed = true
        return { ...item, description: targetDesc, quantity: targetQty, rate: targetRate }
      }
    } else if (descLower.includes('battery cable') || descLower.includes('battery wire')) {
      const targetDesc = wireInfo.batteryCableDesc
      const targetRate = wireInfo.batteryCableRate
      const targetQty = wireInfo.batteryCableMeters
      if (item.description !== targetDesc || item.rate !== targetRate || item.quantity !== targetQty) {
        changed = true
        return { ...item, description: targetDesc, rate: targetRate, quantity: targetQty }
      }
    } else if (descLower === 'pu sealant' || descLower.includes('pu sealant') || descLower.includes('sealant')) {
      const targetQty = (inverterKw >= 20 && !isOld20Kw) ? 2 : 1
      if (item.description !== 'PU Sealant' || item.quantity !== targetQty || item.rate !== 400) {
        changed = true
        return { ...item, description: 'PU Sealant', quantity: targetQty, rate: 400 }
      }
    } else if (descLower === 'pvc moulding' || descLower.includes('moulding') || descLower.includes('molding')) {
      if (item.description !== 'PVC Moulding' || item.quantity !== newPvcMouldingQty || item.rate !== 449 || item.unit !== 'M') {
        changed = true
        return { ...item, description: 'PVC Moulding', quantity: newPvcMouldingQty, rate: 449, unit: 'M' }
      }
    } else if (descLower.includes('terminal lugs 25mm') || (descLower.includes('terminal lug') && descLower.includes('25'))) {
      if (newLugs25Qty === 0) {
        changed = true
        return null // Delete for 3k-6k
      }
      if (item.quantity !== newLugs25Qty || item.rate !== 40) {
        changed = true
        return { ...item, description: 'Terminal lugs 25mm', quantity: newLugs25Qty, rate: 40 }
      }
    } else if (descLower.includes('terminal lugs 50mm') || (descLower.includes('terminal lug') && descLower.includes('50'))) {
      if (item.quantity !== newLugs50Qty || item.rate !== 50) {
        changed = true
        return { ...item, description: 'Terminal lugs 50mm', quantity: newLugs50Qty, rate: 50 }
      }
    } else if (descLower.includes('terminal block')) {
      if ((inverterKw <= 6 || inverterKw === 10) && !isOld20Kw) {
        changed = true
        return null // Delete for standard tiers
      }
    }
    return item
  })

  let items = mappedItems.filter((item): item is LineItem => item !== null)
  if (items.length !== lineItems.length) {
    changed = true
  }

  if (inverterKw >= 10) {
    const hasAc6 = items.some(it => it.description.toLowerCase().includes('ac wire #6'))
    const hasAc8 = items.some(it => it.description.toLowerCase().includes('ac wire #8'))
    const acWireTargetQty = (inverterKw >= 20 && !isOld20Kw) ? 120 : (isOld20Kw ? 50 : (inverterKw >= 12 ? 100 : 60))

    if (!hasAc6 && panelQty > 0) {
      changed = true
      const hoseIdx = items.findIndex(it => it.description.toLowerCase().includes('flexible hose') || it.description.toLowerCase().includes('hose'))
      const insertIdx = hoseIdx !== -1 ? hoseIdx + 1 : items.length
      items.splice(insertIdx, 0, {
        id: `boq-ac6-${Date.now()}`,
        description: 'AC Wire #6',
        quantity: acWireTargetQty,
        rate: 99.34,
        unit: 'M'
      })
    }

    if (!hasAc8 && panelQty > 0) {
      changed = true
      const ac6Idx = items.findIndex(it => it.description.toLowerCase().includes('ac wire #6'))
      const insertIdx = ac6Idx !== -1 ? ac6Idx + 1 : items.length
      items.splice(insertIdx, 0, {
        id: `boq-ac8-${Date.now()}`,
        description: 'AC Wire #8',
        quantity: acWireTargetQty,
        rate: 60.04,
        unit: 'M'
      })
    }
  }

  if (inverterKw === 16 && panelQty > 0) {
    const hasMccb100 = items.some(it => it.description.toLowerCase().includes('100a') && it.description.toLowerCase().includes('mccb'))
    const hasMccb125 = items.some(it => it.description.toLowerCase().includes('125a') && it.description.toLowerCase().includes('mccb'))

    if (!hasMccb100) {
      changed = true
      const encIdx = items.findIndex(it => it.description.toLowerCase().includes('enclosure') || it.description.toLowerCase().includes('breaker box'))
      const insertIdx = encIdx !== -1 ? encIdx + 1 : items.length
      items.splice(insertIdx, 0, {
        id: `boq-12-mccb100-${Date.now()}`,
        description: 'AC MCCB 100A',
        quantity: 2,
        rate: 1300.00,
        unit: 'PCS'
      })
    }

    if (!hasMccb125) {
      changed = true
      const mccb100Idx = items.findIndex(it => it.description.toLowerCase().includes('100a') && it.description.toLowerCase().includes('mccb'))
      const insertIdx = mccb100Idx !== -1 ? mccb100Idx + 1 : items.length
      items.splice(insertIdx, 0, {
        id: `boq-12-mccb125-${Date.now()}`,
        description: 'AC MCCB 125A',
        quantity: 2,
        rate: 1300.00,
        unit: 'PCS'
      })
    }
  }

  const hasSplice = items.some(it => it.description.toLowerCase().includes('splice'))
  if (!hasSplice && panelQty > 0) {
    changed = true
    const lFootIdx = items.findIndex(it => it.description.toLowerCase().includes('l foot'))
    const insertIdx = lFootIdx !== -1 ? lFootIdx + 1 : items.length
    items.splice(insertIdx, 0, {
      id: `boq-splice-${Date.now()}`,
      description: 'Splice Connector',
      quantity: newSpliceConnectorQty,
      rate: 90,
      unit: 'PCS'
    })
  }

  const hasSealant = items.some(it => it.description.toLowerCase().includes('sealant'))
  if (!hasSealant && panelQty > 0) {
    changed = true
    const spliceIdx = items.findIndex(it => it.description.toLowerCase().includes('splice'))
    const insertIdx = spliceIdx !== -1 ? spliceIdx + 1 : items.length
    items.splice(insertIdx, 0, {
      id: `boq-sealant-${Date.now()}`,
      description: 'PU Sealant',
      quantity: 1,
      rate: 400,
      unit: 'PC'
    })
  }

  const hasMoulding = items.some(it => it.description.toLowerCase().includes('moulding') || it.description.toLowerCase().includes('molding'))
  if (!hasMoulding && panelQty > 0) {
    changed = true
    const sealantIdx = items.findIndex(it => it.description.toLowerCase().includes('sealant'))
    const insertIdx = sealantIdx !== -1 ? sealantIdx + 1 : items.length
    items.splice(insertIdx, 0, {
      id: `boq-moulding-${Date.now()}`,
      description: 'PVC Moulding',
      quantity: newPvcMouldingQty,
      rate: 449,
      unit: 'M'
    })
  }

  const hasClipLock = items.some(it => it.description.toLowerCase().includes('clip lock') || it.description.toLowerCase().includes('clip-lock'))
  if (!hasClipLock && panelQty > 0) {
    changed = true
    const lFootIdx = items.findIndex(it => it.description.toLowerCase().includes('l foot'))
    const insertIdx = lFootIdx !== -1 ? lFootIdx + 1 : items.length
    items.splice(insertIdx, 0, {
      id: `boq-cliplock-${Date.now()}`,
      description: 'Clip lock 3/4',
      quantity: 1,
      rate: 180,
      unit: 'SET'
    })
  }

  const hasMc42String = items.some(it => {
    const d = it.description.toLowerCase()
    return d.includes('mc4 2 string') || d.includes('mc4 2-string') || d.includes('mc4 2string')
  })
  if (!hasMc42String && inverterKw >= 10) {
    changed = true
    const mc4Idx = items.findIndex(it => it.description.toLowerCase().includes('mc4'))
    const insertIdx = mc4Idx !== -1 ? mc4Idx + 1 : items.length
    const setsOf2Pcs = inverterKw >= 16 ? (1 + Math.floor((inverterKw - 16) / 4)) : 1
    items.splice(insertIdx, 0, {
      id: `boq-mc4-2string-${Date.now()}`,
      description: 'MC4 2 String',
      quantity: setsOf2Pcs * 2,
      rate: 550,
      unit: 'PCS'
    })
  }

  if (inverterKw >= 8) {
    const hasLugs25 = items.some(it => it.description.toLowerCase().includes('terminal lugs 25mm'))
    if (!hasLugs25) {
      changed = true
      const lugs50Idx = items.findIndex(it => it.description.toLowerCase().includes('terminal lugs 50mm'))
      const insertIdx = lugs50Idx !== -1 ? lugs50Idx : items.length
      items.splice(insertIdx, 0, {
        id: `boq-19-25mm-${Date.now()}`,
        description: 'Terminal lugs 25mm',
        quantity: 36,
        rate: 40,
        unit: 'PCS'
      })
    }
  }
  
  return { updated: changed, items }
}

interface CapitalCalcPopoverProps {
  title: string
  formula: string
  steps?: { label: string; value: string; note?: string; color?: string }[]
  result: { label: string; value: string; color?: string }
  description?: string
  badge?: string
}

function CapitalCalcPopover({
  title,
  formula,
  steps,
  result,
  description,
  badge,
}: CapitalCalcPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Calculation details for ${title}`}
          className="inline-flex items-center justify-center p-0.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 rounded transition-all cursor-pointer shrink-0 ml-1 select-none focus:outline-none focus:ring-1 focus:ring-amber-400"
          onClick={(e) => e.stopPropagation()}
        >
          <Info size={12} className="text-current shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-80 p-3.5 bg-zinc-950 text-zinc-100 border border-zinc-700 shadow-2xl rounded-xl font-mono text-xs space-y-2.5 z-50 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-sans">
          <span className="font-bold text-[11px] text-zinc-100 flex items-center gap-1.5">
            <Calculator size={13} className="text-amber-400 shrink-0" />
            {title}
          </span>
          {badge && (
            <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
              {badge}
            </span>
          )}
        </div>

        {/* Formula Box */}
        <div className="space-y-1">
          <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold tracking-wider">Formula</div>
          <div className="bg-zinc-900 px-2 py-1.5 rounded-md border border-zinc-800 text-[10px] text-amber-300 font-mono leading-relaxed break-words">
            {formula}
          </div>
        </div>

        {/* Breakdown Steps */}
        {steps && steps.length > 0 && (
          <div className="space-y-1">
            <div className="text-[9px] text-zinc-400 uppercase font-sans font-bold tracking-wider">Calculation Steps</div>
            <div className="space-y-1.5 bg-zinc-900/60 p-2 rounded-md border border-zinc-800/80">
              {steps.map((step, idx) => (
                <div key={idx} className="flex justify-between items-baseline text-[10px] gap-2">
                  <span className="text-zinc-400 font-sans truncate">{step.label}</span>
                  <div className="flex items-center gap-1 shrink-0 font-mono">
                    <span className={step.color || "text-zinc-200 font-bold"}>{step.value}</span>
                    {step.note && (
                      <span className="text-[8.5px] text-zinc-500 font-sans">({step.note})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final Result Box */}
        <div className="bg-zinc-900 border border-zinc-700/80 px-2.5 py-1.5 rounded-md flex justify-between items-center">
          <span className="text-[10px] font-bold text-zinc-300 font-sans uppercase tracking-wider">{result.label}:</span>
          <span className={cn("text-[11.5px] font-black font-mono", result.color || "text-amber-400")}>
            {result.value}
          </span>
        </div>

        {/* Explanatory Footer */}
        {description && (
          <p className="text-[9px] text-zinc-400 font-sans leading-tight pt-1 border-t border-zinc-800/80">
            {description}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
      {children}
    </h3>
  )
}

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  children: ReactNode
}

function Field({
  label,
  children,
  className,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <Label className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
        {label}
      </Label>
      {children}
    </div>
  )
}

const MG_COMPANY = 'M&G Non-Specialized Wholesale Trading'

const THEME_CHARACTERS: Record<string, string> = {
  barbie: '🎀',
  spiderman: '🕷️',
  minion: '🍌',
  violet: '🔮',
}

const SALESPEOPLE = [
  { id: 'custom', name: 'Custom / None', position: '', company: '', contact: '', email: '' },
  { id: 'charlotte', name: 'Charlotte C. Santos', position: 'Senior Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 928 1655 179', email: 'charlotte.mgtrading@gmail.com' },
  { id: 'famella', name: 'Famella D. Ylanan', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 927 9487 013', email: 'sales.mgtradingph@gmail.com' },
  { id: 'jeramae', name: 'Jeramae E. Broqueza', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 981 2206 849', email: 'jeramaemgtrading6@gmail.com' },
  { id: 'aya', name: 'Aya Rongavilla', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '09933746489', email: 'ayarongavilla021@gmail.com' },
  { id: 'ryan', name: 'Ryan M. Castillo', position: 'Liaison Officer', company: MG_COMPANY, contact: '09352956244', email: 'ry.manalo1111@gmail.com' },
  { id: 'renzel', name: 'Renzel G. Rongavilla', position: 'Liaison Officer', company: MG_COMPANY, contact: '09299606023', email: 'rongavillarenzel.gs@gmail.com' },
  { id: 'noel', name: 'Noel Jayson E. Santos', position: 'Chief Operating Officer', company: MG_COMPANY, contact: '09198718747', email: 'Santosnoel9999@gmail.com' },
  { id: 'james', name: 'James Vidal', position: 'Chief Operating Officer', company: MG_COMPANY, contact: '09998837203', email: 'jamesedwardvidal08@gmail.com' },
  { id: 'edwin', name: 'Edwin Vidal', position: 'Chief Finance Officer', company: MG_COMPANY, contact: '0912 383 9791', email: 'edwinvidal08@gmail.com' },
]

const loadPdfJs = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = async () => {
      const pdfjs = (window as any).pdfjsLib;
      try {
        const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        const response = await fetch(workerUrl);
        const blob = new Blob([await response.text()], { type: 'application/javascript' });
        pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch (e) {
        console.error('Failed to load PDF.js worker via Blob URL, falling back to direct URL', e);
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      }
      resolve(pdfjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const extractTextFromPdf = async (file: File, onProgress?: (pct: number) => void): Promise<string> => {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) return '';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
    fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
    if (onProgress) {
      onProgress(Math.round((i / pdf.numPages) * 100));
    }
  }
  return fullText;
};

interface ParsedSpec {
  brand: string;
  formFactor: string;
  coolingCapacity: string;
  breakerStatus: string;
}

function parseTechnicalSpec(text: string): ParsedSpec {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let brand = 'Unknown';
  let formFactor = 'Unknown';
  let coolingCapacity = 'Unknown';
  let breakerStatus = 'Not Detected';

  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Brand detection
    if (lower.includes('carrier')) brand = 'Carrier';
    else if (lower.includes('anern')) brand = 'Anern';
    else if (lower.includes('ja solar') || lower.includes('jasolar')) brand = 'JA Solar';
    else if (lower.includes('oliter')) brand = 'Oliter';
    else if (lower.includes('alpsolar') || lower.includes('alp solar')) brand = 'Alpsolar';
    else if (lower.includes('ubetter')) brand = 'Ubetter';
    else if (lower.includes('daikin')) brand = 'Daikin';
    else if (lower.includes('dyness')) brand = 'Dyness';
    else if (lower.includes('mitsubishi')) brand = 'Mitsubishi';
    else if (lower.includes('samsung')) brand = 'Samsung';
    else if (lower.includes('lg')) brand = 'LG';
    else if (lower.includes('panasonic')) brand = 'Panasonic';

    // Form Factor
    if (lower.includes('inverter')) formFactor = 'Inverter';
    else if (lower.includes('panel') || lower.includes('module')) formFactor = 'Solar Panel';
    else if (lower.includes('split')) formFactor = 'Split Type';
    else if (lower.includes('window')) formFactor = 'Window Type';
    else if (lower.includes('cassette')) formFactor = 'Cassette Type';

    // Capacity
    const capacityMatch = line.match(/(\d+(?:\.\d+)?\s*(?:hp|kw|w|ah|ton|btu|v|amp))/i);
    if (capacityMatch && coolingCapacity === 'Unknown') {
      coolingCapacity = capacityMatch[1];
    }

    // Breaker status
    if (lower.includes('breaker') || lower.includes('mcb') || lower.includes('mccb') || lower.includes('spd') || lower.includes('fuse')) {
      breakerStatus = 'Active / Present';
    }
  }

  return { brand, formFactor, coolingCapacity, breakerStatus };
}

function cleanRate(priceStr: string): number {
  if (!priceStr || priceStr === '-' || priceStr === 'TBD') return 0;
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function cleanQtyAndUnit(qtyStr: string): { quantity: number; unit: string } {
  if (!qtyStr || qtyStr === '-') return { quantity: 1, unit: '' };
  
  const numMatch = qtyStr.match(/(\d+(?:\.\d+)?)/);
  const quantity = numMatch ? parseFloat(numMatch[1]) : 1;
  
  let unit = '';
  const unitMatch = qtyStr.match(/[a-zA-Z]+/);
  if (unitMatch) {
    const rawUnit = unitMatch[0].toUpperCase();
    if (rawUnit === 'PCS' || rawUnit === 'PES') unit = 'PCS';
    else if (rawUnit === 'PC') unit = 'PC';
    else if (rawUnit === 'M') unit = 'M';
    else unit = rawUnit;
  }
  
  return { quantity, unit };
}

function getPanelDimensions(wattageStr: string): string {
  const num = parseInt(wattageStr.replace(/\D/g, ''), 10) || 620
  if (num >= 720) {
    return '7.82ft x 4.28ft'
  }
  return '7.82ft x 3.72ft'
}

function extractLineItemsFromText(text: string) {
  const SOLAR_EXACT_MAPPING: Record<number, { desc: string; qty: string; price: string; total: string }> = {
    1: { desc: "Inverter 12kW 1pc $68,000.00", qty: "1pc", price: "₱68,000.00", total: "₱68,000.00" },
    2: { desc: "Tongwei Panel 620W (7.82ft x 3.72ft)", qty: "10 pcs", price: "₱5,456.00", total: "₱54,560.00" },
    3: { desc: "Railings 2.4m", qty: "20 pcs", price: "₱490.00", total: "₱9,800.00" },
    4: { desc: "Mid Clamp", qty: "20 pcs", price: "₱32.00", total: "₱640.00" },
    5: { desc: "End Clamp", qty: "8 pcs", price: "₱65.00", total: "₱520.00" },
    6: { desc: "L Foot 25 pes.", qty: "25 pes", price: "₱75.00", total: "₱1,875.00" },
    7: { desc: "Flexible hose", qty: "5m", price: "₱215.00", total: "₱1,075.00" },
    8: { desc: "AC Wire #6 AWG 14mm", qty: "5m", price: "₱190.00", total: "₱950.00" },
    9: { desc: "DC/PV Wire #6 AWG 14mm", qty: "5m", price: "₱200.00", total: "₱1,000.00" },
    10: { desc: "MC4 50A", qty: "12 pcs", price: "₱80.00", total: "₱960.00" },
    11: { desc: "Breaker box / Metal Enclosure 1pc 3,000.00", qty: "1pc", price: "₱3,000.00", total: "₱3,000.00" },
    12: { desc: "AC MCB 63A", qty: "2 pcs", price: "₱350.00", total: "₱700.00" },
    13: { desc: "AC SPD 275V 40kA", qty: "2 pes", price: "₱400.00", total: "₱800.00" },
    14: { desc: "DC SPD 1000V 40kA", qty: "2 pcs", price: "₱400.00", total: "₱800.00" },
    15: { desc: "DC MCB 63A", qty: "2 pcs", price: "₱300.00", total: "₱600.00" },
    16: { desc: "DC MCCB for battery", qty: "1 pc", price: "₱2,000.00", total: "₱2,000.00" },
    17: { desc: "Cable raceway conduit 2 meters", qty: "1pc", price: "₱1,000.00", total: "₱1,000.00" },
    18: { desc: "Automatic transfer switch", qty: "1pc", price: "₱1,300.00", total: "₱1,300.00" },
    19: { desc: "Terminal lugs", qty: "12 pcs", price: "₱40.00", total: "₱480.00" },
    20: { desc: "Battery 314Ah (51.2V) 1pc $109,000.00", qty: "1pc", price: "₱109,000.00", total: "₱109,000.00" },
    21: { desc: "Terminal Block", qty: "5 pcs", price: "₱160.00", total: "₱800.00" },
    22: { desc: "Battery Cable (Black & Red)", qty: "4m", price: "₱600.00", total: "₱2,400.00" },
    23: { desc: "Splice Connector", qty: "10 pcs", price: "₱55.00", total: "₱550.00" },
    24: { desc: "PU Sealant", qty: "1pc", price: "₱400.00", total: "₱400.00" },
    25: { desc: "PVC Moulding 5m", qty: "5m", price: "₱449.00", total: "₱2,245.00" },
    26: { desc: "Clip lock 3/4", qty: "1 Set", price: "₱180.00", total: "₱180.00" },
    27: { desc: "MC4 2 String", qty: "2 pcs", price: "₱550.00", total: "₱1,100.00" },
    28: { desc: "Cable Tray", qty: "1 pc", price: "₱560.00", total: "₱560.00" },
    29: { desc: "Delivery Fees", qty: "1 Lot", price: "₱5,000.00", total: "₱5,000.00" }
  };

  const lineItems: LineItem[] = [];
  const addedIndices = new Set<number>();
  
  const isSolarQuote = text.includes('Anern') || text.includes('JA Solar') || text.includes('Dyness') || text.includes('Oliter') || text.includes('Alpsolar') || text.includes('Ubetter') || text.includes('Inverter') || text.includes('Railings');

  // Handle line breaks or inline text anomalies by normalizing line streams
  const normalizedText = text.replace(/(\d+)(Inverter|Panel|Railings|Mid|End|L Foot|Splice|Flexcon|AC wire|PV wire|MC4 2 String|MC4|Clip lock|Breaker|AC MCB|AC SPD|DC SPD|DC MCB|DC MCCB|Cable|Automatic|Terminal|Dyness|Genix|CESC|Oliter|Alpsolar|AlpSolarr|Ubetter|Battery|PU Sealant|Sealant|PVC Moulding|Moulding|Molding)/g, '\n$1 $2');

  const lines = normalizedText.split('\n');

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    if (isSolarQuote) {
      let targetIndex: number | null = null;
      const lowerLine = cleanLine.toLowerCase();

      // Precise keyword classification mapping
      if (lowerLine.includes('inverter') || lowerLine.includes('anern')) {
        targetIndex = 1;
      } else if (lowerLine.includes('panel') || lowerLine.includes('ja solar')) {
        targetIndex = 2;
      } else if (lowerLine.includes('railing')) {
        targetIndex = 3;
      } else if (lowerLine.includes('mid clamp')) {
        targetIndex = 4;
      } else if (lowerLine.includes('end clamp')) {
        targetIndex = 5;
      } else if (lowerLine.includes('l foot')) {
        targetIndex = 6;
      } else if (lowerLine.includes('splice connector') || lowerLine.includes('splice')) {
        targetIndex = 23;
      } else if (lowerLine.includes('clip lock') || lowerLine.includes('clip-lock')) {
        targetIndex = 26;
      } else if (lowerLine.includes('flexcon') || lowerLine.includes('hdpe')) {
        targetIndex = 7;
      } else if (lowerLine.includes('ac wire')) {
        targetIndex = 8;
      } else if (lowerLine.includes('pv wire')) {
        targetIndex = 9;
      } else if (lowerLine.includes('mc4 2 string') || lowerLine.includes('mc4 2-string') || lowerLine.includes('mc4 2string')) {
        targetIndex = 27;
      } else if (lowerLine.includes('mc4')) {
        targetIndex = 10;
      } else if (lowerLine.includes('breaker box') || lowerLine.includes('metal enclosure') || (lowerLine.includes('breaker') && lowerLine.includes('1pc') && lowerLine.includes('1,000'))) {
        targetIndex = 11;
      } else if (lowerLine.includes('ac mcb')) {
        targetIndex = 12;
      } else if (lowerLine.includes('ac spd')) {
        targetIndex = 13;
      } else if (lowerLine.includes('dc spd')) {
        targetIndex = 14;
      } else if (lowerLine.includes('dc mcb')) {
        targetIndex = 15;
      } else if (lowerLine.includes('dc mccb')) {
        targetIndex = 16;
      } else if (lowerLine.includes('raceway') || lowerLine.includes('conduit')) {
        targetIndex = 17;
      } else if (lowerLine.includes('automatic transfer') || lowerLine.includes('transfer switch') || lowerLine.includes('ats')) {
        targetIndex = 18;
      } else if (lowerLine.includes('terminal lugs') || (lowerLine.includes('lugs') && !lowerLine.includes('block'))) {
        targetIndex = 19;
      } else if (lowerLine.includes('dyness') || lowerLine.includes('oliter') || lowerLine.includes('alpsolar') || lowerLine.includes('cesc') || lowerLine.includes('ubetter') || ((lowerLine.includes('goodwe') || lowerLine.includes('deye')) && lowerLine.includes('battery')) || (lowerLine.includes('battery') && (lowerLine.includes('314ah') || lowerLine.includes('410ah')))) {
        targetIndex = 20;
      } else if (lowerLine.includes('terminal block')) {
        targetIndex = 21;
      } else if (lowerLine.includes('battery cable')) {
        targetIndex = 22;
      } else if (lowerLine.includes('pu sealant') || lowerLine.includes('sealant')) {
        targetIndex = 24;
      } else if (lowerLine.includes('pvc moulding') || lowerLine.includes('moulding') || lowerLine.includes('molding')) {
        targetIndex = 25;
      } else if (lowerLine.includes('cable tray') || lowerLine.includes('tray')) {
        targetIndex = 28;
      }

      if (targetIndex && SOLAR_EXACT_MAPPING[targetIndex]) {
        if (addedIndices.has(targetIndex)) continue;
        
        addedIndices.add(targetIndex);
        const mapped = SOLAR_EXACT_MAPPING[targetIndex];
        
        const cleanedRate = cleanRate(mapped.price);
        const { quantity, unit } = cleanQtyAndUnit(mapped.qty);

        lineItems.push({
          id: `ocr-${targetIndex}-${Date.now()}`,
          description: mapped.desc,
          quantity: quantity,
          rate: cleanedRate,
          unit: unit || 'PCS'
        });
        continue;
      }
    }

    // Fallback standard general parser
    const fallbackRegex = /(\d+)\s+([A-Za-z0-9\s().&,-]+?)\s+(\d+\s*(?:pcs|pc|pes|m|Ps)?)\s+([^0-9\s]*[\d,.]+|TBD)\s+([^0-9\s]*[\d,.]+|TBD)/i;
    const itemMatch = cleanLine.match(fallbackRegex);

    if (itemMatch) {
      const [, idStr, description, qtyStr, unitPriceStr] = itemMatch;
      const parsedId = parseInt(idStr, 10);
      if (addedIndices.has(parsedId)) continue;

      addedIndices.add(parsedId);
      const cleanedRate = cleanRate(unitPriceStr);
      const { quantity, unit } = cleanQtyAndUnit(qtyStr);

      lineItems.push({
        id: `ocr-fallback-${parsedId}-${Date.now()}`,
        description: description.trim(),
        quantity: quantity,
        rate: cleanedRate,
        unit: unit || 'PCS'
      });
    }
  }

  return lineItems;
}

const INVERTER_BRAND_PRICES_MAP: Record<number, { anern: number; solis: number; goodwe: number }> = {
  3: { anern: 14000, solis: 37000, goodwe: 35000 },
  4: { anern: 14000, solis: 37000, goodwe: 35000 },
  5: { anern: 16500, solis: 37000, goodwe: 45000 },
  6: { anern: 18000, solis: 44000, goodwe: 47000 },
  8: { anern: 25000, solis: 59000, goodwe: 62000 },
  9: { anern: 28000, solis: 97000, goodwe: 74000 },
  10: { anern: 28000, solis: 67000, goodwe: 74000 },
  12: { anern: 32500, solis: 79000, goodwe: 78000 },
  16: { anern: 45000, solis: 92000, goodwe: 150000 },
  18: { anern: 55000, solis: 97000, goodwe: 150000 },
  20: { anern: 65000, solis: 0, goodwe: 160000 },
  30: { anern: 95000, solis: 226000, goodwe: 140000 },
  50: { anern: 160000, solis: 288000, goodwe: 170000 },
  60: { anern: 200000, solis: 458000, goodwe: 220000 },
  75: { anern: 250000, solis: 515000, goodwe: 260000 },
  125: { anern: 350000, solis: 500000, goodwe: 400000 },
}

function getInverterBrandPrices(kw: number) {
  const keys = Object.keys(INVERTER_BRAND_PRICES_MAP).map(Number).sort((a, b) => a - b)
  const matchedKw = keys.find(k => k >= kw) || keys[keys.length - 1]
  return INVERTER_BRAND_PRICES_MAP[matchedKw] || { anern: 32500, solis: 79000, goodwe: 78000 }
}

interface OnGridBrandInfo {
  id: string
  name: string
  logo?: string
  getPrice: (kw: number) => number | null
}

const ON_GRID_BRANDS: OnGridBrandInfo[] = [
  {
    id: 'deye',
    name: 'Deye',
    logo: '/deye.svg',
    getPrice: (kw: number) => {
      if (Math.abs(kw - 3.6) < 0.1) return 16000
      if (kw === 6) return 25000
      if (kw === 8) return 28000
      if (kw === 10 || Math.abs(kw - 10.5) < 0.1) return 35000
      if (kw === 20) return 80000
      if (kw === 30) return 100000
      if (kw === 50) return 150000
      if (kw === 60) return 180000
      if (kw === 100) return 200000
      return null
    }
  },
  {
    id: 'goodwe',
    name: 'GoodWe',
    logo: '/goodwe.svg',
    getPrice: (kw: number) => {
      if (kw === 1.5) return 15000
      if (kw === 3) return 18000
      if (kw === 6) return 24000
      if (kw === 10) return 37000
      return null
    }
  },
  {
    id: 'solis',
    name: 'Solis',
    logo: '/solis.svg',
    getPrice: (kw: number) => {
      if (kw === 6) return 23000
      if (kw === 10) return 37500
      if (kw === 50) return 184000
      if (kw === 60) return 193000
      if (kw === 75) return 206000
      if (kw === 100) return 188000
      if (kw === 150) return 235000
      if (kw === 200) return 272000
      if (kw >= 3 && kw <= 5) return 23000
      return null
    }
  },
  {
    id: 'hypontech',
    name: 'Hypontech',
    logo: '/Hypontech.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 33000
      if (kw === 10 || Math.abs(kw - 10.5) < 0.1) return 41500
      return null
    }
  },
  {
    id: 'solax',
    name: 'SolaX',
    logo: '/SolaX.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 34500
      if (kw === 10) return 37500
      return null
    }
  },
  {
    id: 'foxess',
    name: 'FoxESS',
    logo: '/FoxESS.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 38000
      return null
    }
  },
  {
    id: 'sunways',
    name: 'Sunways',
    logo: '/Sunways.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 39500
      if (kw === 10) return 44500
      return null
    }
  },
  {
    id: 'sungrow',
    name: 'Sungrow',
    logo: '/sungrow.svg',
    getPrice: (kw: number) => {
      if (kw === 3 || kw === 4) return 34000
      if (kw === 5) return 44000
      if (kw === 6) return 46000
      if (kw === 8) return 48000
      if (kw === 10 || Math.abs(kw - 10.5) < 0.1) return 56000
      return null
    }
  }
]

interface HybridBrandInfo {
  id: string
  name: string
  logo?: string
  getPrice: (kw: number) => number | null
}

const HYBRID_BRANDS: HybridBrandInfo[] = [
  {
    id: 'deye',
    name: 'Deye',
    logo: '/deye.svg',
    getPrice: (kw: number) => {
      if (kw === 6) return 45000
      if (kw === 8) return 60000
      if (kw === 12) return 88000
      if (kw === 16) return 135000
      if (kw === 20) return 150000
      if (kw === 30) return 250000
      if (kw === 50) return 280000
      if (kw === 80) return 300000
      return null
    }
  },
  {
    id: 'anern',
    name: 'Anern',
    logo: '/anern.svg',
    getPrice: (kw: number) => {
      const prices = getInverterBrandPrices(kw)
      return prices.anern
    }
  },
  {
    id: 'solis',
    name: 'Solis',
    logo: '/solis.svg',
    getPrice: (kw: number) => {
      if (kw === 20) return null
      const prices = getInverterBrandPrices(kw)
      return prices.solis
    }
  },
  {
    id: 'goodwe',
    name: 'GoodWe',
    logo: '/goodwe.svg',
    getPrice: (kw: number) => {
      const prices = getInverterBrandPrices(kw)
      return prices.goodwe
    }
  },
  {
    id: 'sungrow',
    name: 'Sungrow',
    logo: '/sungrow.svg',
    getPrice: (kw: number) => {
      if (kw === 6) return 48000
      if (kw === 8) return 65000
      if (kw === 10 || Math.abs(kw - 10.5) < 0.1) return 82000
      return null
    }
  }
]

const KW_TO_ELECTRIC_BILL: Record<number, string> = KW_TO_ELECTRIC_BILL_V1

const ELECTRIC_BILL_PRICE_REFERENCES = [
  { bill: '₱3,000', kw: 1.5 },
  { bill: '₱5,000', kw: 3 },
  { bill: '₱6,500', kw: 4 },
  { bill: '₱8,000', kw: 5 },
  { bill: '₱9,000', kw: 6 },
  { bill: '₱10,000', kw: 8 },
  { bill: '₱15,000', kw: 10 },
  { bill: '₱20,000', kw: 12 },
  { bill: '₱30,000', kw: 16 },
  { bill: '₱40,000', kw: 20 },
  { bill: '₱60,000', kw: 30 },
  { bill: '₱100,000', kw: 50 },
]

function getElectricBillRef(kw: number, version: 'v1' | 'v2' = 'v2', short = true): string {
  if (version === 'v2') {
    return getElectricBillRefV2(kw, short)
  }
  return KW_TO_ELECTRIC_BILL[kw] || `₱${Math.round(kw * 1600).toLocaleString()}`
}


const SOLAR_PRICES = {
  Inverter: 67000.00,
  Panel: 5456.00,
  Railing: 490.00,
  MidClamp: 55.00,
  EndClamp: 55.00,
  LFoot: 90.00,
  SpliceConnector: 90.00,
  FlexconHDPE: 124.00,
  FlexconHDPE32: 124.00,
  FlexconHDPE40: 124.00,
  ACwire: 60.04,
  ACwire6: 99.34,
  PVwire: 125.00,
  DCwire: 125.00,
  MC4: 60.00,
  ClipLock34: 180.00,
  MC4_2String: 550.00,
  BreakerBox: 3000.00,
  BreakerBox50x40: 1500.00,
  BreakerBox50x60: 3000.00,
  ACMCB: 1300.00,
  ACMCB_80A: 450.00,
  ACMCB_100A: 500.00,
  ACMCB_125A: 500.00,
  ACMCB_100A_MCCB: 1300.00,
  ACMCB_125A_MCCB: 1300.00,
  ACSPD: 570.00,
  DCSPD: 790.00,
  DCMCB: 420.00,
  DCMCCB: 2500.00,
  Raceway: 360.00,
  CableTray: 560.00,
  ATS: 4000.00,
  ATS_63A: 1500.00,
  ATS_125A_Tier2: 2000.00,
  ATS_125A_Tier3: 4000.00,
  TerminalLugs25: 40.00,
  TerminalLugs50: 50.00,
  Genix100Ah: 38000.00,
  Genix200Ah: 65000.00,
  Cesc314Ah: 88000.00,
  Ubetter410Ah: 138000.00,
  DynessBattery: 88000.00,
  TerminalBlock: 160.00,
  BatteryCable: 700.00,
  BatteryCable50mm: 700.00,
  BatteryCable70mm: 820.00,
  GroundRod: 750.00,
  GroundingLugs: 50.00,
  GroundWire: 5888 / 150,
  PuSealant: 400.00,
  PvcMoulding: 449.00,
  DeliveryFees: 5000.00,
};

interface PanelOption {
  wattage: string
  rate: number
}

interface PanelBrandOption {
  id: string
  name: string
  logo?: string
  options: PanelOption[]
}

const SOLAR_PANEL_BRANDS: PanelBrandOption[] = [
  {
    id: 'tongwei',
    name: 'Tongwei',
    logo: '/TW.svg',
    options: [
      { wattage: '620W', rate: 5456 },
      { wattage: '625W', rate: 5500 },
      { wattage: '630W', rate: 5544 },
      { wattage: '720W', rate: 6336 },
      { wattage: '725W', rate: 6380 },
      { wattage: '730W', rate: 6424 },
    ],
  },
  {
    id: 'ja',
    name: 'JA Solar',
    logo: '/JaSo.svg',
    options: [
      { wattage: '625W', rate: 6400 },
      { wattage: '630W', rate: 6900 },
      { wattage: '720W', rate: 6900 },
    ],
  },
  {
    id: 'runergy',
    name: 'Runergy',
    logo: '/runergy.svg',
    options: [
      { wattage: '620W', rate: 4960 },
    ],
  },
  {
    id: 'jinko',
    name: 'Jinko',
    logo: '/jinko.svg',
    options: [
      { wattage: '620W', rate: 5750 },
      { wattage: '640W', rate: 5950 },
      { wattage: '650W', rate: 6050 },
    ],
  },
  {
    id: 'gokin',
    name: 'Gokin',
    logo: '/gokin.svg',
    options: [
      { wattage: '650W', rate: 6400 },
    ],
  },
  {
    id: 'longi',
    name: 'Longi',
    logo: '/longi.svg',
    options: [
      { wattage: '650W', rate: 6500 },
    ],
  },
  {
    id: 'ian',
    name: 'IAN Solar',
    logo: '/ian.svg',
    options: [
      { wattage: '660W', rate: 6300 },
      { wattage: '670W', rate: 6400 },
    ],
  },
  {
    id: 'seraphim',
    name: 'Seraphim',
    logo: '/Seraphim.svg',
    options: [
      { wattage: '630W', rate: 5500 },
    ],
  },
  {
    id: 'trina',
    name: 'Trina Solar',
    logo: '/TrinaSolar.svg',
    options: [
      { wattage: '615W', rate: 6000 },
      { wattage: '620W', rate: 6200 },
    ],
  },
  {
    id: 'lesso',
    name: 'Lesso',
    logo: '/Lesso.svg',
    options: [
      { wattage: '630W', rate: 5500 },
    ],
  },
]

function GoodweCountdownBadge({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      let target = new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0)
      if (now.getTime() >= target.getTime()) {
        target = new Date(now.getFullYear(), now.getMonth() + 1, 25, 0, 0, 0)
      }
      const diffMs = target.getTime() - now.getTime()
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diffMs / (1000 * 60)) % 60)
      const seconds = Math.floor((diffMs / 1000) % 60)
      setCountdown({ days, hours, minutes, seconds })
    }
    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [])

  const getUrgencyConfig = (days: number) => {
    if (days > 10) {
      return {
        badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/25',
        badgeText: 'text-emerald-800 dark:text-emerald-300 font-extrabold',
        badgeBorder: 'border-emerald-500/50 hover:border-emerald-500/80',
        pingBg: 'bg-emerald-400',
        dotBg: 'bg-emerald-500',
        shakeClass: '',
      }
    } else if (days > 3) {
      return {
        badgeBg: 'bg-amber-500/15 dark:bg-amber-500/25',
        badgeText: 'text-amber-800 dark:text-amber-300 font-extrabold',
        badgeBorder: 'border-amber-500/50 hover:border-amber-500/80',
        pingBg: 'bg-amber-400',
        dotBg: 'bg-amber-500',
        shakeClass: '',
      }
    } else if (days > 0) {
      return {
        badgeBg: 'bg-rose-500/20 dark:bg-rose-500/30',
        badgeText: 'text-rose-800 dark:text-rose-200 font-extrabold',
        badgeBorder: 'border-rose-500/70 hover:border-rose-500',
        pingBg: 'bg-rose-400',
        dotBg: 'bg-rose-500',
        shakeClass: '',
      }
    } else {
      return {
        badgeBg: 'bg-rose-600 text-white font-black',
        badgeText: 'text-white font-black',
        badgeBorder: 'border-rose-600',
        pingBg: 'bg-rose-300',
        dotBg: 'bg-white',
        shakeClass: 'animate-bounce duration-300',
      }
    }
  }

  const urgency = getUrgencyConfig(countdown.days)

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-mono cursor-pointer transition-all shrink-0 select-none",
          urgency.badgeBg,
          urgency.badgeText,
          urgency.badgeBorder,
          urgency.shakeClass
        )}
        title="Pricelist 25th Update Reminder"
      >
        <span className="flex h-1.5 w-1.5 relative shrink-0">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", urgency.pingBg)}></span>
          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", urgency.dotBg)}></span>
        </span>
        <span className="font-extrabold shrink-0">⚡ 25th: {countdown.days}d</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border rounded-full px-3 py-1 transition-all shadow-xs cursor-pointer group text-xs font-mono select-none",
        urgency.badgeBg,
        urgency.badgeText,
        urgency.badgeBorder,
        urgency.shakeClass
      )}
      title="Click for Pricelist Update Reminder"
    >
      <span className="flex h-2 w-2 relative shrink-0">
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", urgency.pingBg)}></span>
        <span className={cn("relative inline-flex rounded-full h-2 w-2", urgency.dotBg)}></span>
      </span>
      <span className="font-extrabold text-[11px] tracking-tight">
        ⚡ Pricelist 25th Update:
      </span>
      <span className="font-mono text-[11px] font-extrabold">
        {countdown.days}d {String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m {String(countdown.seconds).padStart(2, '0')}s
      </span>
    </button>
  )
}

function GoodweReminderModal({
  open,
  onOpenChange,
  theme,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme?: string
}) {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    if (!open) return
    const updateCountdown = () => {
      const now = new Date()
      let target = new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0)
      if (now.getTime() >= target.getTime()) {
        target = new Date(now.getFullYear(), now.getMonth() + 1, 25, 0, 0, 0)
      }
      const diffMs = target.getTime() - now.getTime()
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diffMs / (1000 * 60)) % 60)
      const seconds = Math.floor((diffMs / 1000) % 60)
      setCountdown({ days, hours, minutes, seconds })
    }
    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [open])

  const getUrgencyConfig = (days: number) => {
    if (days > 10) {
      return {
        badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/25',
        badgeText: 'text-emerald-800 dark:text-emerald-300 font-extrabold',
        badgeBorder: 'border-emerald-500/50 hover:border-emerald-500/80',
        boxBg: 'bg-emerald-500/10 border-emerald-500/30',
        timerNum: 'text-emerald-700 dark:text-emerald-400',
        shakeClass: '',
        statusText: '🟢 Pricelist Active & Good',
      }
    } else if (days > 3) {
      return {
        badgeBg: 'bg-amber-500/15 dark:bg-amber-500/25',
        badgeText: 'text-amber-800 dark:text-amber-300 font-extrabold',
        badgeBorder: 'border-amber-500/50 hover:border-amber-500/80',
        boxBg: 'bg-amber-500/10 border-amber-500/30',
        timerNum: 'text-amber-700 dark:text-amber-400',
        shakeClass: '',
        statusText: '🟡 Approaching 25th Update',
      }
    } else if (days > 0) {
      return {
        badgeBg: 'bg-rose-500/20 dark:bg-rose-500/30',
        badgeText: 'text-rose-800 dark:text-rose-200 font-extrabold',
        badgeBorder: 'border-rose-500/70 hover:border-rose-500',
        boxBg: 'bg-rose-500/15 border-rose-500/40',
        timerNum: 'text-rose-700 dark:text-rose-400',
        shakeClass: '',
        statusText: '🔴 UPDATE DUE IN A FEW DAYS!',
      }
    } else {
      return {
        badgeBg: 'bg-rose-600 text-white font-black',
        badgeText: 'text-white font-black',
        badgeBorder: 'border-rose-600',
        boxBg: 'bg-rose-500/25 border-rose-600',
        timerNum: 'text-rose-600 dark:text-rose-400 font-black',
        shakeClass: 'animate-bounce duration-300',
        statusText: '⚠️ UPDATE DUE TODAY!',
      }
    }
  }

  const urgency = getUrgencyConfig(countdown.days)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md w-[94vw] sm:w-full font-mono p-4 sm:p-6 rounded-[20px] border-2 shadow-2xl transition-all bg-card text-card-foreground overflow-hidden", `theme-${theme || 'light'}`, urgency.badgeBorder)}>
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="w-4 h-4 animate-pulse text-amber-500" />
              <span className={cn("text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border", urgency.badgeBg, urgency.badgeText, urgency.badgeBorder)}>
                {urgency.statusText}
              </span>
            </div>
          </div>
          <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2 pt-1">
            ⚡ Pricelist Update Reminder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 my-1.5">
          <div className={cn("border-2 rounded-xl p-3 sm:p-4 text-center transition-all", urgency.boxBg, urgency.shakeClass)}>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-extrabold block mb-2 text-foreground">
              Countdown to 25th of Month Update:
            </span>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 font-mono">
              <div className="bg-card border-2 border-border rounded-lg p-1.5 sm:p-2 flex flex-col items-center shadow-xs">
                <span className={cn("text-base sm:text-xl font-black", urgency.timerNum)}>{countdown.days}</span>
                <span className="text-[8px] sm:text-[9px] text-foreground font-extrabold uppercase">Days</span>
              </div>
              <div className="bg-card border-2 border-border rounded-lg p-1.5 sm:p-2 flex flex-col items-center shadow-xs">
                <span className={cn("text-base sm:text-xl font-black", urgency.timerNum)}>{String(countdown.hours).padStart(2, '0')}</span>
                <span className="text-[8px] sm:text-[9px] text-foreground font-extrabold uppercase">Hours</span>
              </div>
              <div className="bg-card border-2 border-border rounded-lg p-1.5 sm:p-2 flex flex-col items-center shadow-xs">
                <span className={cn("text-base sm:text-xl font-black", urgency.timerNum)}>{String(countdown.minutes).padStart(2, '0')}</span>
                <span className="text-[8px] sm:text-[9px] text-foreground font-extrabold uppercase">Mins</span>
              </div>
              <div className="bg-card border-2 border-border rounded-lg p-1.5 sm:p-2 flex flex-col items-center shadow-xs">
                <span className={cn("text-base sm:text-xl font-black", urgency.timerNum)}>{String(countdown.seconds).padStart(2, '0')}</span>
                <span className="text-[8px] sm:text-[9px] text-foreground font-extrabold uppercase">Secs</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs leading-relaxed text-foreground bg-card p-3 sm:p-4 rounded-xl border-2 border-border shadow-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="font-medium">
                <strong className="font-extrabold text-foreground">Internal Reminder:</strong> Price list review and update target is scheduled for the <strong className="font-black underline">25th of every month</strong>.
              </span>
            </div>

            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="font-medium">
                <strong className="font-extrabold text-foreground">Action Required:</strong> Please cross-reference inverter, panel, and accessory prices against the latest August 1 sheet before issuing quotes.
              </span>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t-2 border-border">
              <div className="flex items-center justify-between gap-2 bg-secondary/80 p-2.5 rounded-lg border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-foreground truncate">
                      GEPC Aug 1 Pricelist Sheet
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono truncate">
                      GEPC-PRICELIST-UPDATED-MG-SOLAR AUG 1.xlsx
                    </span>
                  </div>
                </div>
                <a
                  href="/GEPC-PRICELIST-UPDATED-MG-SOLAR AUG 1.xlsx"
                  download="GEPC-PRICELIST-UPDATED-MG-SOLAR AUG 1.xlsx"
                  className="p-2.5 rounded-2xl bg-secondary/80 hover:bg-secondary text-amber-500 border border-border transition-all shadow-2xs cursor-pointer select-none shrink-0 flex items-center justify-center"
                  title="Download GEPC Aug 1 Pricelist Sheet (.xlsx)"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>

              <div className="flex items-center justify-between gap-2 bg-secondary/80 p-2.5 rounded-lg border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-foreground truncate">
                      Angel Solar X Updated Price List (June 2026)
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono truncate">
                      Angel Solar X Updated Price List June 2026.xlsx
                    </span>
                  </div>
                </div>
                <a
                  href="/Angel Solar X Updated Price List June 2026.xlsx"
                  download="Angel Solar X Updated Price List June 2026.xlsx"
                  className="p-2.5 rounded-2xl bg-secondary/80 hover:bg-secondary text-emerald-500 border border-border transition-all shadow-2xs cursor-pointer select-none shrink-0 flex items-center justify-center"
                  title="Download Angel Solar June 2026 Sheet (.xlsx)"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>

              <div className="flex items-center justify-between gap-2 bg-secondary/80 p-2.5 rounded-lg border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-foreground truncate">
                      Main QC Pricelist (Updated May 11)
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono truncate">
                      Main QC pricelist.md
                    </span>
                  </div>
                </div>
                <a
                  href="/Main QC pricelist.md"
                  download="Main QC pricelist.md"
                  className="p-2.5 rounded-2xl bg-secondary/80 hover:bg-secondary text-blue-500 border border-border transition-all shadow-2xs cursor-pointer select-none shrink-0 flex items-center justify-center"
                  title="Download Main QC Pricelist (.md)"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-border gap-2">
          <Button 
            onClick={() => onOpenChange(false)}
            className="bg-foreground text-background hover:bg-foreground/90 font-extrabold text-xs rounded-lg px-4 py-2 cursor-pointer w-full sm:w-auto"
          >
            Close Reminder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Home() {
  const {
    invoice,
    loaded,
    update,
    updateItem,
    updateItemFields,
    addItem,
    removeItem,
    addExpenseItem,
    updateExpenseItem,
    removeExpenseItem,
    setInvoice,
  } = useMGInvoice()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedPanelBrands, setSelectedPanelBrands] = useState<Record<string, string>>({})

  // Philippine Location & Delivery Fee State (42,029 Barangays & 1,634 LGUs with Driving Distances)
  const [locationSearchQuery, setLocationSearchQuery] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<PhilippineLocationItem | null>(null)
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const locationDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasInitializedLocation = useRef(false)

  // Sync initial delivery location once when invoice loads
  useEffect(() => {
    if (!hasInitializedLocation.current && invoice.deliveryLocation) {
      hasInitializedLocation.current = true
      const results = searchPhilippineLocations(invoice.deliveryLocation, 1)
      if (results.length > 0) {
        setSelectedLocation(results[0])
        setLocationSearchQuery(results[0].displayName)
      }
    }
  }, [invoice.deliveryLocation])

  const handleClearLocation = () => {
    setSelectedLocation(null)
    setLocationSearchQuery('')
    setIsLocationDropdownOpen(false)

    setInvoice((prev) => {
      const defaultFee = 5000
      const updatedLineItems = prev.lineItems.map((it) => {
        if (
          it.id.startsWith('boq-delivery') ||
          it.description.toLowerCase().includes('delivery') ||
          it.description.toLowerCase().includes('freight')
        ) {
          return { ...it, rate: defaultFee }
        }
        return it
      })

      // Cleanly remove any existing service area advisory from note
      const cleanedNote = (prev.note || '')
        .replace(/\n\n\[Service Area Advisory\]:[\s\S]*?(?=\n\n|$)/g, '')
        .trim()

      return {
        ...prev,
        deliveryLocation: '',
        deliveryDistanceKm: undefined,
        deliveryFee: defaultFee,
        lalamoveCost: defaultFee,
        isExceedingServiceArea: false,
        note: cleanedNote,
        lineItems: updatedLineItems,
      }
    })
  }

  const handleApplyLocation = (loc: PhilippineLocationItem) => {
    setSelectedLocation(loc)
    setLocationSearchQuery(loc.displayName)
    setIsLocationDropdownOpen(false)

    const deliveryFee = calculateDeliveryFee(loc.drivingDistanceKm)
    const formattedAddress = loc.formattedAddress
    const isExceeding = loc.drivingDistanceKm > SERVICEABLE_DISTANCE_KM

    setInvoice((prev) => {
      const updatedLineItems = [...prev.lineItems]
      const deliveryIndex = updatedLineItems.findIndex(
        (it) =>
          it.id.startsWith('boq-delivery') ||
          it.description.toLowerCase().includes('delivery') ||
          it.description.toLowerCase().includes('freight')
      )

      if (deliveryIndex >= 0) {
        updatedLineItems[deliveryIndex] = {
          ...updatedLineItems[deliveryIndex],
          rate: deliveryFee,
        }
      } else {
        updatedLineItems.push({
          id: `boq-delivery-${Date.now()}`,
          description: 'Delivery Fees',
          quantity: 1,
          rate: deliveryFee,
          unit: 'LOT',
        })
      }

      // Base note without any previous service area advisory
      const baseNote = (prev.note || '')
        .replace(/\n\n\[Service Area Advisory\]:[\s\S]*?(?=\n\n|$)/g, '')
        .trim()

      const advisoryNote = isExceeding
        ? `\n\n[Service Area Advisory]: The installation project site (${loc.displayName}) is ${loc.drivingDistanceKm} km from our Muntinlupa headquarters, which exceeds the standard ${SERVICEABLE_DISTANCE_KM}km service coverage (+${(loc.drivingDistanceKm - SERVICEABLE_DISTANCE_KM).toFixed(1)} km). Extended regional mobilization, ocular inspection scheduling, and logistics lead times apply.`
        : ''

      const finalNote = baseNote + advisoryNote

      return {
        ...prev,
        deliveryLocation: loc.displayName,
        deliveryDistanceKm: loc.drivingDistanceKm,
        deliveryFee: deliveryFee,
        lalamoveCost: deliveryFee,
        isExceedingServiceArea: isExceeding,
        note: finalNote,
        toAddress: formattedAddress,
        lineItems: updatedLineItems,
      }
    })
  }

  const handleAddItem = () => {
    addItem()
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
      const inputs = scrollContainerRef.current?.querySelectorAll('input[placeholder="Item description"]')
      if (inputs && inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement
        lastInput.focus()
      }
    }, 80)
  }

  const autoPrint = useRef(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('print') === 'true')
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)
  const [goodweModalOpen, setGoodweModalOpen] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [pdfExportStatus, setPdfExportStatus] = useState('')


  const THEME_EMOJIS: Record<string, string> = {
    light: '☀️',
    dark: '🌙',
    barbie: '💖',
    spiderman: '🕷️',
    minion: '🍌',
    violet: '🔮',
  }



  const THEME_NAMES: Record<string, string> = {
    light: 'Light',
    dark: 'Dark',
    barbie: 'Barbie',
    spiderman: 'Spidey',
    minion: 'Minion',
    violet: 'Violet',
  }

  const cycleTheme = () => {
    const themeList = ['light', 'dark', 'barbie', 'spiderman', 'minion', 'violet'] as const
    const currentTheme = invoice.theme || 'light'
    const currentIndex = themeList.indexOf(currentTheme as any)
    const nextTheme = themeList[(currentIndex + 1) % themeList.length]
    update('theme', nextTheme)
  }

  const [hoveredField, setHoveredField] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<string>('items')
  const [previousTab, setPreviousTab] = useState<string>('sender')

  const [checkedChecklistItems, setCheckedChecklistItems] = useState<Record<string, boolean>>({})
  const [checklistCopied, setChecklistCopied] = useState(false)
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit')
  const [totalPages, setTotalPages] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [specData, setSpecData] = useState({
    brand: '',
    formFactor: '',
    coolingCapacity: '',
    breakerStatus: ''
  })
  const [monthlyKwh, setMonthlyKwh] = useState<string>('')
  const [dailyKwh, setDailyKwh] = useState<string>('')
  const [pricePerKwh, setPricePerKwh] = useState<string>('15.01')
  const [totalBill, setTotalBill] = useState<string>('')
  const [customKwInput, setCustomKwInput] = useState<string>('')
  const [activePreset, setActivePreset] = useState<'min' | 'balance' | 'max'>('max')
  const [activeKwSetup, setActiveKwSetup] = useState<number>(5)
  const [twentyKwMode, setTwentyKwMode] = useState<'parallel' | 'single'>('parallel')
  const [sizingRefVersion, setSizingRefVersion] = useState<'v1' | 'v2'>('v2')
  const [rowsCount, setRowsCount] = useState<number>(1)
  const [holdTooltipKw, setHoldTooltipKw] = useState<number | null>(null)
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)



  const handleUpdateRows = (newRowsVal: number) => {
    const val = Math.max(1, newRowsVal)
    setRowsCount(val)
    setInvoice((prev) => {
      let foundEndClamp = false
      const updatedLineItems = prev.lineItems.map((item) => {
        const descLower = item.description.toLowerCase()
        if (descLower.includes('end clamp')) {
          foundEndClamp = true
          return { ...item, quantity: val * 6 }
        }
        return item
      })
      if (!foundEndClamp) return prev
      return { ...prev, lineItems: updatedLineItems }
    })
  }

  const handleUpdateLaborPricePerWatt = (newPricePerWatt: number) => {
    const val = Math.max(0, newPricePerWatt)
    setInvoice((prev) => {
      const { totalWatts } = extractPanelInfoFromLineItems(prev.lineItems)
      const expectedLaborRate = totalWatts > 0 ? Math.round(totalWatts * val) : 0
      let foundLabor = false
      const updatedLineItems = prev.lineItems.map((item) => {
        if (isLaborItem(item.description)) {
          foundLabor = true
          return { ...item, rate: expectedLaborRate, quantity: 1, unit: 'LOT' }
        }
        return item
      })
      return {
        ...prev,
        laborPricePerWatt: val,
        lineItems: foundLabor ? updatedLineItems : prev.lineItems
      }
    })
  }
  const [systemType, setSystemType] = useState<'hybrid' | 'ongrid'>('hybrid')
  const [supplySearchQuery, setSupplySearchQuery] = useState('')
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<'all' | 'goods' | 'equipment' | 'mounting' | 'electrical' | 'grounding' | 'labor'>('all')
  const [isSupplyMode, setIsSupplyMode] = useState(false)
  const [showMasterReconMatrix, setShowMasterReconMatrix] = useState(false)
  const prevPanelQtyRef = useRef<number | null>(null)
  const prevBatteryQtyRef = useRef<number | null>(null)
  const prevTotalWattsRef = useRef<number | null>(null)
  const prevPricePerWattRef = useRef<number | null>(null)
  const savedLaborItemsRef = useRef<LineItem[]>([])
  const savedSubjectRef = useRef<string | null>(null)
  const savedRateMarkupRef = useRef<number | null>(null)

  // History Cache State
  const [historyList, setHistoryList] = useState<InvoiceHistoryItem[]>([])
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<InvoiceHistoryItem | null>(null)
  const [historyToast, setHistoryToast] = useState<string | null>(null)

  // Changelog State
  const [changelogList, setChangelogList] = useState<ChangelogItem[]>([])
  const [changelogFilter, setChangelogFilter] = useState<'all' | 'price' | 'quantity' | 'addition' | 'system'>('all')
  const [changelogSearch, setChangelogSearch] = useState('')
  const [addChangelogModalOpen, setAddChangelogModalOpen] = useState(false)
  const [newLogItem, setNewLogItem] = useState({
    itemDescription: '',
    changeType: 'price' as const,
    fieldChanged: 'Unit Price',
    oldValue: '',
    newValue: '',
    note: '',
    batch: 'Manual Price Update'
  })

  // Download PDF Modal & Export Options State
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadFileName, setDownloadFileName] = useState('')
  const [downloadDocTypes, setDownloadDocTypes] = useState<{
    quotation: boolean
    checklist: boolean
    capital: boolean
  }>({
    quotation: true,
    checklist: false,
    capital: false,
  })
  const [downloadIsCondensed, setDownloadIsCondensed] = useState<boolean>(false)
  const [downloadQuotationMarkup, setDownloadQuotationMarkup] = useState<{
    withMarkup: boolean
    withoutMarkup: boolean
  }>({
    withMarkup: true,
    withoutMarkup: false,
  })
  const [capitalVersion, setCapitalVersion] = useState<'v1' | 'v2'>('v1')
  const [downloadCapitalVersion, setDownloadCapitalVersion] = useState<'v1' | 'v2'>('v1')
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'png'>('pdf')
  const [downloadUseZip, setDownloadUseZip] = useState<boolean>(false)

  useEffect(() => {
    setHistoryList(getInvoiceHistory())
    setChangelogList(getChangelogHistory())
  }, [])

  const handleCreateChangelogEntry = () => {
    if (!newLogItem.itemDescription.trim()) return
    const updated = saveChangelogEntry({
      itemDescription: newLogItem.itemDescription.trim(),
      changeType: newLogItem.changeType,
      fieldChanged: newLogItem.fieldChanged.trim() || 'Unit Price',
      oldValue: newLogItem.oldValue.trim() || '—',
      newValue: newLogItem.newValue.trim() || '—',
      note: newLogItem.note.trim() || undefined,
      batch: newLogItem.batch.trim() || 'Manual Update'
    })
    setChangelogList(updated)
    setAddChangelogModalOpen(false)
    setNewLogItem({
      itemDescription: '',
      changeType: 'price',
      fieldChanged: 'Unit Price',
      oldValue: '',
      newValue: '',
      note: '',
      batch: 'Manual Price Update'
    })
  }

  const handleDeleteChangelogItem = (id: string) => {
    const updated = deleteChangelogItem(id)
    setChangelogList(updated)
  }

  const handleResetChangelog = () => {
    const reset = resetChangelogToInitial()
    setChangelogList(reset)
  }

  const handleClearChangelog = () => {
    const cleared = clearChangelogHistory()
    setChangelogList(cleared)
  }

  const TAB_LABEL_MAP: Record<string, string> = {
    ocr: 'kW Set Up',
    sender: 'Sender',
    client: 'Client',
    invoice: 'Details',
    items: 'Line Items',
    capital: 'Capital',
    checklist: 'Checklist',
    history: 'History',
    changelog: 'Changelog',
  }

  const handleToggleSupplyMode = () => {
    setIsSupplyMode((prev) => {
      const nextState = !prev
      if (nextState) {
        const currentLaborItems = invoice.lineItems.filter((item) => isLaborItem(item.description))
        savedLaborItemsRef.current = currentLaborItems
        savedSubjectRef.current = invoice.subject
        savedRateMarkupRef.current = invoice.rateMarkup ?? 30

        const remainingItems = invoice.lineItems.filter((item) => !isLaborItem(item.description))
        setInvoice((p) => ({
          ...p,
          rateMarkup: 10,
          subject: 'Supply of Solar System Materials',
          salutation: 'Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the Supply of Solar System Materials based on your requirement.',
          lineItems: remainingItems,
        }))
      } else {
        const laborToRestore = savedLaborItemsRef.current
        const subjectToRestore = savedSubjectRef.current
        const restoredSubject = subjectToRestore !== null ? subjectToRestore : invoice.subject
        const markupToRestore = savedRateMarkupRef.current !== null ? savedRateMarkupRef.current : 30

        setInvoice((p) => {
          const currentNonLabor = p.lineItems.filter((item) => !isLaborItem(item.description))
          const combined = [...currentNonLabor, ...laborToRestore]
          return {
            ...p,
            rateMarkup: markupToRestore,
            subject: restoredSubject,
            salutation: `Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the ${restoredSubject} based on your requirement.`,
            lineItems: combined,
          }
        })
      }
      return nextState
    })
  }

  const handleTabSwitch = (newTab: string) => {
    if (activeTab === newTab) return

    if (activeTab !== 'checklist') {
      setPreviousTab(activeTab)
    }
    if (newTab !== 'history') {
      setSelectedHistoryItem(null)
    }

    setActiveTab(newTab)
  }

  const getSupplyCategory = (description: string): { key: 'equipment' | 'mounting' | 'electrical' | 'grounding' | 'labor'; label: string; badgeColor: string } => {
    const d = (description || '').toLowerCase().trim()
    if (!d.includes('delivery') && !d.includes('freight') && (d.includes('labor') || d.includes('installation') || d.includes('commissioning') || d.includes('service') || d.includes('services') || d.includes('engineering') || d.includes('supervision') || d.includes('testing') || d === 'labor and installation' || d === 'labor & installation')) {
      return { key: 'labor', label: 'Labor & Services', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    }
    if (
      d.includes('ground') ||
      d.includes('bonding') ||
      d.includes('egc') ||
      d.includes('gec') ||
      d.includes('weeb') ||
      d.includes('ground rod') ||
      d.includes('ground clamp') ||
      d.includes('ground wire') ||
      d.includes('earth') ||
      d.includes('lightning') ||
      d.includes('splice jumper')
    ) {
      return { key: 'grounding', label: 'Grounding & Bonding', badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' }
    }
    if (
      d.includes('panel') ||
      d.includes('module') ||
      d.includes('inverter') ||
      d.includes('battery') ||
      d.includes('controller') ||
      d.includes('meter') ||
      d.includes('datalogger') ||
      d.includes('dongle') ||
      d.includes('collector') ||
      d.includes('sec1000') ||
      d.includes('dyness') ||
      d.includes('oliter') ||
      d.includes('alpsolar') ||
      d.includes('ja solar') ||
      d.includes('tongwei') ||
      d.includes('gokin') ||
      d.includes('jinko') ||
      d.includes('longi') ||
      d.includes('trina') ||
      d.includes('seraphim') ||
      d.includes('solis') ||
      d.includes('goodwe') ||
      d.includes('anern') ||
      d.includes('hypontech') ||
      d.includes('solax') ||
      d.includes('foxess') ||
      d.includes('sunways') ||
      d.includes('sungrow') ||
      d.includes('deye') ||
      d.includes('growatt') ||
      d.includes('victron') ||
      d.includes('genix') ||
      d.includes('cesc') ||
      d.includes('ubetter')
    ) {
      return { key: 'equipment', label: 'Major Equipment', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' }
    }
    if (
      d.includes('railing') ||
      d.includes('rail') ||
      d.includes('clamp') ||
      d.includes('l foot') ||
      d.includes('l-foot') ||
      d.includes('clip lock') ||
      d.includes('clip-lock') ||
      d.includes('mid clamp') ||
      d.includes('end clamp') ||
      d.includes('mounting') ||
      d.includes('structure') ||
      d.includes('hardware') ||
      d.includes('rack') ||
      d.includes('bracket') ||
      d.includes('roof') ||
      d.includes('hook') ||
      d.includes('bolt') ||
      d.includes('screw') ||
      d.includes('sealant')
    ) {
      return { key: 'mounting', label: 'Mounting & Hardware', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' }
    }
    return { key: 'electrical', label: 'Electrical & Cabling', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' }
  }

  const handleSystemTypeChange = (type: 'hybrid' | 'ongrid', explicitKw?: number) => {
    // 1. Determine effective kW from inverter item, panels, or explicitKw
    let currentKw = explicitKw
    if (!currentKw) {
      const inverterItem = invoice.lineItems.find(item => {
        if (isBatteryUnit(item.description)) return false
        const d = (item.description || '').toLowerCase()
        return d.includes('inverter') || d.includes('solis') || d.includes('goodwe') || d.includes('deye') || d.includes('growatt') || d.includes('anern') || d.includes('hypontech') || d.includes('solax') || d.includes('foxess') || d.includes('sunways') || d.includes('sungrow')
      })
      if (inverterItem) {
        const kwMatch = inverterItem.description.match(/(\d+(?:\.\d+)?)\s*kw/i)
        if (kwMatch) {
          const baseKw = parseFloat(kwMatch[1])
          const qty = inverterItem.quantity && inverterItem.quantity > 1 ? inverterItem.quantity : 1
          currentKw = baseKw * qty
        }
      }
    }
    if (!currentKw) {
      const { totalWatts } = extractPanelInfoFromLineItems(invoice.lineItems)
      if (totalWatts > 0) {
        currentKw = Math.round(totalWatts / 1000)
      }
    }
    if (!currentKw) {
      currentKw = activeKwSetup || 5
    }

    if (type === 'ongrid') {
      const hasOnGridOption = ON_GRID_BRANDS.some(b => b.getPrice(currentKw!) !== null)
      if (!hasOnGridOption) {
        return
      }
    }

    setSystemType(type)
    setActiveKwSetup(currentKw)
    const isExclude = type === 'ongrid'
    update('excludeBattery', isExclude)

    let updatedItems = invoice.lineItems.map(item => {
      if (isBatteryUnit(item.description)) return item
      const descLower = item.description.toLowerCase()
      if (
        descLower.includes('inverter') ||
        descLower.includes('goodwe') ||
        descLower.includes('solis') ||
        descLower.includes('anern') ||
        descLower.includes('hypontech') ||
        descLower.includes('solax') ||
        descLower.includes('foxess') ||
        descLower.includes('sunways') ||
        descLower.includes('deye') ||
        descLower.includes('growatt') ||
        descLower.includes('sungrow')
      ) {
        const kwMatch = item.description.match(/(\d+(?:\.\d+)?)\s*kw/i)
        const unitKw = kwMatch ? parseFloat(kwMatch[1]) : (item.quantity && item.quantity > 1 ? currentKw! / item.quantity : currentKw!)

        if (type === 'ongrid') {
          const defaultBrand = ON_GRID_BRANDS.find(b => b.getPrice(unitKw) !== null)
          if (defaultBrand) {
            const price = defaultBrand.getPrice(unitKw)!
            return {
              ...item,
              description: `${defaultBrand.name} Inverter ${unitKw}kW On-Grid`,
              rate: price
            }
          }
        } else {
          const brandPrices = getInverterBrandPrices(unitKw)
          const is20KwSingle = unitKw === 20
          return {
            ...item,
            description: is20KwSingle ? 'GoodWe Inverter 20kW Hybrid (3-Phase LV)' : `Solis Inverter ${unitKw}kW Hybrid`,
            rate: is20KwSingle ? brandPrices.goodwe : brandPrices.solis
          }
        }
      }
      return item
    })

    if (type === 'ongrid') {
      // Remove battery and ATS rows when switching to On-Grid
      updatedItems = updatedItems.filter(item => !isBatteryItem(item.description) && !isAtsItem(item.description))
    } else {
      // Ensure only one single battery line item exists with proper quantity when switching to Hybrid
      const batteryItems = updatedItems.filter(item => isBatteryUnit(item.description))
      if (batteryItems.length > 1) {
        // Keep only the first battery item and remove extra duplicate battery rows
        const firstId = batteryItems[0].id
        updatedItems = updatedItems.filter(item => !isBatteryUnit(item.description) || item.id === firstId)
      } else if (batteryItems.length === 0) {
        const batteryQty = 1
        const isSmallSetup = currentKw <= 6
        const batteryDesc = isSmallSetup ? `Genix Battery 51.2V 200Ah` : `CESC Battery 51.2V 314Ah`
        const batteryRate = isSmallSetup ? 65000.00 : 88000.00

        updatedItems.push({
          id: `boq-20-${Date.now()}`,
          description: batteryDesc,
          quantity: batteryQty,
          rate: batteryRate,
          unit: 'PC'
        })
      }
    }

    const systemTypeLabel = type === 'ongrid' ? 'On-Grid' : 'Hybrid'
    const systemTypeSubject = type === 'ongrid' 
      ? `${currentKw}kW On-Grid Solar System`
      : `${currentKw}kW Hybrid System with Battery`
    const newSalutation = `Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the ${currentKw}kW ${systemTypeLabel} Solar System based on your requirement.`

    setInvoice(prev => {
      let finalSubject = systemTypeSubject
      let finalSalutation = newSalutation

      if (prev.subject && prev.subject.trim()) {
        if (type === 'ongrid') {
          finalSubject = prev.subject
            .replace(/Hybrid\s+System\s+with\s+Battery/gi, 'On-Grid Solar System')
            .replace(/Hybrid\s+Solar\s+System/gi, 'On-Grid Solar System')
            .replace(/Hybrid\s+System/gi, 'On-Grid System')
            .replace(/Hybrid/gi, 'On-Grid')
        } else {
          finalSubject = prev.subject
            .replace(/On-Grid\s+Solar\s+System/gi, 'Hybrid System with Battery')
            .replace(/On-Grid\s+System/gi, 'Hybrid System with Battery')
            .replace(/On-Grid/gi, 'Hybrid')
        }
        if (!/on-grid/i.test(finalSubject) && type === 'ongrid') {
          finalSubject = systemTypeSubject
        }
      }

      if (prev.salutation && prev.salutation.trim()) {
        if (type === 'ongrid') {
          finalSalutation = prev.salutation
            .replace(/Hybrid\s+System\s+with\s+Battery/gi, 'On-Grid Solar System')
            .replace(/Hybrid\s+Solar\s+System/gi, 'On-Grid Solar System')
            .replace(/Hybrid\s+System/gi, 'On-Grid Solar System')
            .replace(/Hybrid/gi, 'On-Grid')
        } else {
          finalSalutation = prev.salutation
            .replace(/On-Grid\s+Solar\s+System/gi, 'Hybrid Solar System')
            .replace(/On-Grid\s+System/gi, 'Hybrid Solar System')
            .replace(/On-Grid/gi, 'Hybrid')
        }
        if (!/on-grid/i.test(finalSalutation) && type === 'ongrid') {
          finalSalutation = newSalutation
        }
      }

      return {
        ...prev,
        excludeBattery: isExclude,
        lineItems: updatedItems,
        subject: finalSubject,
        salutation: finalSalutation,
        invoiceNumber: generateDocumentId(prev.invoiceNumber?.startsWith('MG-INV') ? 'MG-INV' : 'MG-QT'),
      }
    })
  }

  const handleToggleBatteryExclusion = () => {
    const nextExclude = !invoice.excludeBattery
    setInvoice(prev => {
      let updatedItems = [...prev.lineItems]

      if (!nextExclude) {
        // User is INCLUDING battery: make sure at least one battery item exists
        const hasBattery = updatedItems.some(item => isBatteryUnit(item.description))

        if (!hasBattery) {
          const batteryQty = 1

          const panelIdx = updatedItems.findIndex(i => i.description.toLowerCase().includes('panel'))
          const insertIdx = panelIdx !== -1 ? panelIdx + 1 : 1
          const isSmallSetup = activeKwSetup <= 6
          const batteryDesc = isSmallSetup ? `Genix Battery 51.2V 200Ah` : `CESC Battery 51.2V 314Ah`
          const batteryRate = isSmallSetup ? 65000.00 : 88000.00

          updatedItems.splice(insertIdx, 0, {
            id: `boq-20-${Date.now()}`,
            description: batteryDesc,
            quantity: batteryQty,
            rate: batteryRate,
            unit: 'PC'
          })
        }
      }

      return {
        ...prev,
        excludeBattery: nextExclude,
        lineItems: updatedItems
      }
    })
  }

  const getSafeScopes = (): ScopeOfWorkItem[] => {
    if (Array.isArray(invoice.scopes) && invoice.scopes.length > 0) {
      return invoice.scopes
    }
    return generateDefaultScopesFromInvoice(invoice)
  }

  const updateScope = (id: string, field: keyof ScopeOfWorkItem, value: any) => {
    const list = getSafeScopes()
    const updated = list.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    update('scopes', updated)
  }

  const handleAddScope = () => {
    const list = getSafeScopes()
    const nextLetter = String.fromCharCode(65 + (list.length % 26))
    const newItem = newScopeItem(nextLetter, '', '', '')
    update('scopes', [...list, newItem])
  }

  const handleRemoveScope = (id: string) => {
    const list = getSafeScopes()
    update('scopes', list.filter((s) => s.id !== id))
  }

  const handleResetScopes = () => {
    update('scopes', generateDefaultScopesFromInvoice(invoice))
  }

  const getSafeWarranties = () => (Array.isArray(invoice.warranties) && invoice.warranties.length > 0 ? invoice.warranties : generateDefaultWarrantiesFromInvoice(invoice))

  const updateWarranty = (id: string, field: keyof WarrantyItem, value: string) => {
    const list = getSafeWarranties()
    const updated = list.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    update('warranties', updated)
  }

  const handleAddWarranty = () => {
    const newItem = newWarrantyItem('', 'Manufacturer Warranty', '')
    const list = getSafeWarranties()
    update('warranties', [...list, newItem])
  }

  const handleRemoveWarranty = (id: string) => {
    const list = getSafeWarranties()
    update('warranties', list.filter((w) => w.id !== id))
  }

  const handleResetWarranties = () => {
    update('warranties', generateDefaultWarrantiesFromInvoice(invoice))
  }

  // Auto-sync systemType, activeKwSetup, warranties, and fix any mismatched Subject/Salutation on all devices and users
  useEffect(() => {
    if (!loaded) return

    const hasOnGridInverter = (invoice.lineItems || []).some(it => {
      const d = (it.description || '').toLowerCase()
      return d.includes('on-grid') || d.includes('grid-tied') || d.includes('grid-tie') || d.includes('ongrid')
    })
    const hasBattery = (invoice.lineItems || []).some(it => isBatteryUnit(it.description))
    const isOngrid = hasOnGridInverter && !hasBattery
    const detectedType: 'hybrid' | 'ongrid' = isOngrid ? 'ongrid' : 'hybrid'

    let detectedKw = 5
    const invItem = (invoice.lineItems || []).find(it => {
      if (isBatteryUnit(it.description)) return false
      const d = (it.description || '').toLowerCase()
      return d.includes('inverter') || d.includes('solis') || d.includes('goodwe') || d.includes('deye') || d.includes('growatt') || d.includes('anern') || d.includes('hypontech') || d.includes('solax') || d.includes('foxess') || d.includes('sunways') || d.includes('sungrow')
    })
    if (invItem) {
      const kwMatch = invItem.description.match(/(\d+(?:\.\d+)?)\s*kw/i)
      if (kwMatch) {
        const baseKw = parseFloat(kwMatch[1])
        const qty = invItem.quantity && invItem.quantity > 1 ? invItem.quantity : 1
        detectedKw = baseKw * qty
      }
    } else {
      const { totalWatts } = extractPanelInfoFromLineItems(invoice.lineItems || [])
      if (totalWatts > 0) detectedKw = Math.round(totalWatts / 1000)
    }

    setSystemType((prev) => (prev !== detectedType ? detectedType : prev))
    setActiveKwSetup((prev) => (prev !== detectedKw ? detectedKw : prev))

    // Auto-sync standard inverter / battery warranty coverage (e.g. GoodWe Inverter + GoodWe Battery -> 10 Years, otherwise 5 Years)
    const defWarr = generateDefaultWarrantiesFromInvoice(invoice)
    const invCoverage = defWarr.find(w => w.component.toLowerCase().includes('inverter'))?.coverage || '5 Years'
    const battCoverage = defWarr.find(w => w.component.toLowerCase().includes('battery'))?.coverage || '5 Years'

    if (Array.isArray(invoice.warranties) && invoice.warranties.length > 0) {
      const isWorkmanship = (w: WarrantyItem) => {
        const comp = (w.component || '').toLowerCase()
        const wType = (w.warrantyType || '').toLowerCase()
        return comp.includes('full system') || wType.includes('workmanship') || wType.includes('installation') || w.id === 'w-4'
      }
      const isOneYear = (cov: string) => {
        const c = (cov || '').trim().toLowerCase()
        return c === '1 year' || c === '1 yr' || c === '1-year' || c === '1' || c === '1 years' || /^1\s*(year|yr)?s?$/i.test(c)
      }

      const needsInvUpdate = invoice.warranties.some(w => w.component.toLowerCase().includes('inverter') && (w.coverage === '5 Years' || w.coverage === '10 Years') && w.coverage !== invCoverage)
      const needsBattUpdate = invoice.warranties.some(w => w.component.toLowerCase().includes('battery') && (w.coverage === '5 Years' || w.coverage === '10 Years') && w.coverage !== battCoverage)
      const needsWorkmanshipUpdate = invoice.warranties.some(w => isWorkmanship(w) && (isOneYear(w.coverage) || !w.coverage))

      if (needsInvUpdate || needsBattUpdate || needsWorkmanshipUpdate) {
        setInvoice(prev => ({
          ...prev,
          warranties: (prev.warranties || []).map(w => {
            if (w.component.toLowerCase().includes('inverter') && (w.coverage === '5 Years' || w.coverage === '10 Years')) {
              return { ...w, coverage: invCoverage }
            }
            if (w.component.toLowerCase().includes('battery') && (w.coverage === '5 Years' || w.coverage === '10 Years')) {
              return { ...w, coverage: battCoverage }
            }
            if (isWorkmanship(w) && (isOneYear(w.coverage) || !w.coverage)) {
              return { ...w, coverage: '2 Years' }
            }
            return w
          })
        }))
      }
    }

    if (isOngrid) {
      const subjectHasHybrid = /hybrid/i.test(invoice.subject || '')
      const salutationHasHybrid = /hybrid/i.test(invoice.salutation || '')

      if (subjectHasHybrid || salutationHasHybrid) {
        setInvoice(prev => {
          let updatedSubj = prev.subject || `${detectedKw}kW On-Grid Solar System`
          if (/hybrid/i.test(updatedSubj)) {
            updatedSubj = updatedSubj
              .replace(/Hybrid\s+System\s+with\s+Battery/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+Solar\s+System/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+System/gi, 'On-Grid System')
              .replace(/Hybrid/gi, 'On-Grid')
            if (!/on-grid/i.test(updatedSubj)) {
              updatedSubj = `${detectedKw}kW On-Grid Solar System`
            }
          }

          let updatedSalutation = prev.salutation || `Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the ${detectedKw}kW On-Grid Solar System based on your requirement.`
          if (/hybrid/i.test(updatedSalutation)) {
            updatedSalutation = updatedSalutation
              .replace(/Hybrid\s+System\s+with\s+Battery/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+Solar\s+System/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+System/gi, 'On-Grid Solar System')
              .replace(/Hybrid/gi, 'On-Grid')
            if (!/on-grid/i.test(updatedSalutation)) {
              updatedSalutation = `Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the ${detectedKw}kW On-Grid Solar System based on your requirement.`
            }
          }

          return {
            ...prev,
            excludeBattery: true,
            subject: updatedSubj,
            salutation: updatedSalutation
          }
        })
      }
    }
  }, [loaded, invoice.lineItems, invoice.excludeBattery, invoice.warranties])

  useEffect(() => {
    if (!loaded) return
    const { panelQty, totalWatts } = extractPanelInfoFromLineItems(invoice.lineItems)
    const pricePerWatt = invoice.laborPricePerWatt ?? 6
    const expectedLaborRate = Math.round(totalWatts * pricePerWatt)

    const batteryItems = (invoice.lineItems || []).filter(item => isBatteryUnit(item.description))
    const totalBatteryQty = batteryItems.reduce((sum, it) => sum + (it.quantity || 0), 0)

    let currentItems = invoice.lineItems
    let itemsModified = false

    if (prevPanelQtyRef.current !== null || prevBatteryQtyRef.current !== null) {
      if (panelQty !== prevPanelQtyRef.current || totalBatteryQty !== prevBatteryQtyRef.current) {
        const { updated, items } = recalculateBoqAccessories(currentItems, undefined, twentyKwMode)
        if (updated) {
          currentItems = items
          itemsModified = true
          const newRows = panelQty <= 0 ? 0 : Math.ceil(panelQty / 2)
          setRowsCount(newRows)
        }
      }
    }

    const pricePerWattChanged = prevPricePerWattRef.current !== null && pricePerWatt !== prevPricePerWattRef.current
    const panelQtyChanged = prevPanelQtyRef.current !== null && panelQty !== prevPanelQtyRef.current
    const totalWattsChanged = prevTotalWattsRef.current !== null && totalWatts !== prevTotalWattsRef.current

    const laborItem = currentItems.find(item => isLaborItem(item.description))

    if (laborItem && totalWatts > 0) {
      if ((pricePerWattChanged || panelQtyChanged || totalWattsChanged) && laborItem.rate !== expectedLaborRate) {
        currentItems = currentItems.map(item =>
          isLaborItem(item.description) ? { ...item, rate: expectedLaborRate, quantity: 1, unit: 'LOT' } : item
        )
        itemsModified = true
      } else if (!pricePerWattChanged && !panelQtyChanged && !totalWattsChanged && laborItem.rate !== expectedLaborRate) {
        const calculatedPricePerWatt = Number((laborItem.rate / totalWatts).toFixed(2))
        if (calculatedPricePerWatt >= 0 && calculatedPricePerWatt !== pricePerWatt) {
          update('laborPricePerWatt', calculatedPricePerWatt)
        }
      }
    }

    if (itemsModified) {
      setInvoice((prev) => ({
        ...prev,
        lineItems: currentItems
      }))
    }

    prevPanelQtyRef.current = panelQty
    prevBatteryQtyRef.current = totalBatteryQty
    prevTotalWattsRef.current = totalWatts
    prevPricePerWattRef.current = pricePerWatt
  }, [invoice.lineItems, invoice.laborPricePerWatt, loaded, setInvoice, update])

  const handleApplyPreset = (preset: 'min' | 'balance' | 'max') => {
    setActivePreset(preset)
    handleGenerateBoq(activeKwSetup, preset, undefined, twentyKwMode)
  }

  const handleDailyKwhChange = (val: string) => {
    setDailyKwh(val)
    const d = parseFloat(val)
    const p = parseFloat(pricePerKwh)
    if (!isNaN(d)) {
      const m = d * 30
      setMonthlyKwh(m.toFixed(2))
      if (!isNaN(p)) {
        setTotalBill((m * p).toFixed(2))
      } else {
        setTotalBill('')
      }
    } else {
      setMonthlyKwh('')
      setTotalBill('')
    }
  }

  const handleMonthlyKwhChange = (val: string) => {
    setMonthlyKwh(val)
    const m = parseFloat(val)
    const p = parseFloat(pricePerKwh)
    if (!isNaN(m)) {
      setDailyKwh((m / 30).toFixed(2))
      if (!isNaN(p)) {
        setTotalBill((m * p).toFixed(2))
      } else {
        setTotalBill('')
      }
    } else {
      setDailyKwh('')
      setTotalBill('')
    }
  }

  const handlePricePerKwhChange = (val: string) => {
    setPricePerKwh(val)
    const m = parseFloat(monthlyKwh)
    const p = parseFloat(val)
    if (!isNaN(m) && !isNaN(p)) {
      setTotalBill((m * p).toFixed(2))
    } else {
      setTotalBill('')
    }
  }

  const handleTotalBillChange = (val: string) => {
    setTotalBill(val)
    const t = parseFloat(val)
    const p = parseFloat(pricePerKwh)
    if (!isNaN(t) && !isNaN(p) && p > 0) {
      const m = t / p
      setMonthlyKwh(m.toFixed(2))
      setDailyKwh((m / 30).toFixed(2))
    } else if (val === '') {
      setMonthlyKwh('')
      setDailyKwh('')
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleOcrFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleOcrFile(e.target.files[0])
    }
  }

  const handleOcrFile = async (file: File) => {
    if (!file) return
    setOcrLoading(true)
    setOcrProgress(0)

    try {
      let text = ''
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      
      if (isPdf) {
        text = await extractTextFromPdf(file, (pct) => setOcrProgress(pct))
      } else {
        const { createWorker } = await import('tesseract.js')
        
        const worker = await createWorker('eng', undefined, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100))
            }
          }
        })

        const imageUrl = URL.createObjectURL(file)
        const { data: { text: parsedText } } = await worker.recognize(imageUrl)
        await worker.terminate()
        URL.revokeObjectURL(imageUrl)
        text = parsedText
      }


      const parsed = parseTechnicalSpec(text)
      setSpecData(parsed)

      const ocrItems = extractLineItemsFromText(text)

      setInvoice(prev => {
        const defaultRate = 15000
        const items = [...prev.lineItems]
        
        if (ocrItems.length === 0) {
          const itemDescription = `${parsed.brand} ${parsed.formFactor} (Capacity: ${parsed.coolingCapacity}, Breaker: ${parsed.breakerStatus})`
          const exists = items.some(it => it.description.includes(parsed.brand) && it.description.includes(parsed.formFactor))
          if (!exists) {
            items.push({
              id: `ocr-${Date.now()}`,
              description: itemDescription,
              quantity: 1,
              rate: defaultRate,
              unit: 'SET'
            })
          }
        } else {
          for (const ocrItem of ocrItems) {
            if (!items.some(it => it.description.toLowerCase().includes(ocrItem.description.toLowerCase().slice(0, 15)))) {
              items.push(ocrItem)
            }
          }
        }

        return {
          ...prev,
          lineItems: items,
          subject: `Facility Billing Est: ${parsed.brand} ${parsed.formFactor}`
        }
      })
      setOcrProgress(100)
    } catch (err) {
      console.error(err)
      alert('Failed to parse document: ' + (err as Error).message)
    } finally {
      setTimeout(() => {
        setOcrLoading(false)
      }, 500)
    }
  }

  const handleGenerateBoq = (
    systemKw: number,
    preset: 'min' | 'balance' | 'max' = 'balance',
    explicitSystemType?: 'hybrid' | 'ongrid',
    explicitTwentyKwMode?: 'parallel' | 'single'
  ) => {
    const effSystemType = explicitSystemType || systemType
    const effTwentyKwMode = explicitTwentyKwMode || twentyKwMode
    const isOld20Kw = systemKw === 20 && effTwentyKwMode === 'single'

    const v2Item = getSizingReferenceItem(systemKw)
    const maxPanels = Math.round((systemKw * 1000) / PANEL_WATTAGE)
    let panelQty = maxPanels
    if (preset === 'min') {
      panelQty = Math.max(3, Math.round(maxPanels * 0.5))
    } else if (preset === 'balance') {
      if (sizingRefVersion === 'v2' && v2Item) {
        panelQty = v2Item.panelCount
      } else {
        panelQty = Math.max(4, Math.round(maxPanels * 0.75))
      }
    }
    const rows = panelQty <= 0 ? 0 : Math.ceil(panelQty / 2)
    const batteryQty = 1


    const prices = SOLAR_PRICES

    const items: LineItem[] = []
    const now = Date.now()
    const runLength = 30
    const extraQty = 0

    // 1. Inverter
    const inverterSizes = [1.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 30, 50, 60, 75, 125]
    let inverterKw = inverterSizes.find(s => s >= systemKw)
    if (inverterKw === undefined) {
      inverterKw = Math.ceil(systemKw)
    }
    
    let inverterDesc = ''
    let inverterPrice = 0
    let inverterQty = (inverterKw === 20 && !isOld20Kw) ? 2 : 1

    if (inverterKw === 20 && !isOld20Kw) {
      if (effSystemType === 'ongrid') {
        const defaultBrand = ON_GRID_BRANDS.find(b => b.getPrice(10) !== null)
        inverterDesc = `Solis Inverter 10kW On-Grid`
        inverterPrice = defaultBrand ? (defaultBrand.getPrice(10) || 37500) : 37500
      } else {
        const brandPrices = getInverterBrandPrices(10)
        inverterDesc = `Solis Inverter 10kW Hybrid`
        inverterPrice = brandPrices.solis
      }
    } else if (effSystemType === 'ongrid') {
      const defaultBrand = ON_GRID_BRANDS.find(b => b.getPrice(inverterKw) !== null)
      if (defaultBrand) {
        inverterDesc = `${defaultBrand.name} Inverter ${inverterKw}kW On-Grid`
        inverterPrice = defaultBrand.getPrice(inverterKw)!
      } else {
        const brandPrices = getInverterBrandPrices(inverterKw)
        inverterDesc = `Solis Inverter ${inverterKw}kW On-Grid`
        inverterPrice = brandPrices.solis
      }
    } else {
      if (inverterKw === 20) {
        const brandPrices = getInverterBrandPrices(20)
        inverterDesc = `GoodWe Inverter 20kW Hybrid (3-Phase LV)`
        inverterPrice = brandPrices.goodwe || 160000
      } else {
        const brandPrices = getInverterBrandPrices(inverterKw)
        inverterDesc = `Solis Inverter ${inverterKw}kW Hybrid`
        inverterPrice = brandPrices.solis
      }
    }

    // 1. Solar Panels
    items.push({
      id: `boq-2-${now}`,
      description: `Tongwei Panel 620W (7.82ft x 3.72ft)`,
      quantity: panelQty,
      rate: prices.Panel,
      unit: 'PCS'
    })

    // 2. Inverter
    items.push({
      id: `boq-1-${now}`,
      description: inverterDesc,
      quantity: inverterQty,
      rate: inverterPrice,
      unit: 'PC'
    })

    let bQty = (systemKw >= 20 && !isOld20Kw) ? 2 : batteryQty

    // 3. Battery (included for Hybrid setup)
    if (effSystemType === 'hybrid') {
      let batteryDesc = `CESC Battery 51.2V 314Ah`
      let batteryRate = prices.Cesc314Ah || 88000.00

      if (systemKw <= 5) {
        batteryDesc = `Genix Battery 51.2V 100Ah`
        batteryRate = prices.Genix100Ah || 38000.00
      } else if (systemKw <= 6) {
        batteryDesc = `Genix Battery 51.2V 200Ah`
        batteryRate = prices.Genix200Ah || 65000.00
      }

      items.push({
        id: `boq-20-${now}`,
        description: batteryDesc,
        quantity: bQty,
        rate: batteryRate,
        unit: 'PC'
      })
    }

    let initialBatteryAh = 314
    if (systemKw <= 5) initialBatteryAh = 100
    else if (systemKw <= 6) initialBatteryAh = 200

    const wireInfo = getDynamicWireSize(inverterKw, runLength, bQty, isOld20Kw)
    const breakers = getDynamicBreakerRatings(inverterKw, bQty, initialBatteryAh, isOld20Kw)

    // 3. Railings (QTY = Math.ceil((Panels / 2) * 3))
    const railingQty = panelQty <= 0 ? 0 : Math.ceil((panelQty / 2) * 3) + extraQty
    items.push({
      id: `boq-3-${now}`,
      description: `Railings 2.4m`,
      quantity: railingQty,
      rate: prices.Railing,
      unit: 'PCS'
    })

    // 4. Mid Clamps (QTY = Math.ceil(Panels * 2.5))
    const midClampQty = panelQty <= 0 ? 0 : Math.ceil(panelQty * 2.5)
    items.push({
      id: `boq-4-${now}`,
      description: `Mid Clamp`,
      quantity: midClampQty,
      rate: prices.MidClamp,
      unit: 'PCS'
    })

    // 5. End Clamps (QTY = Rows * 6)
    const endClampQty = rows * 6
    items.push({
      id: `boq-5-${now}`,
      description: `End Clamp`,
      quantity: endClampQty,
      rate: prices.EndClamp,
      unit: 'PCS'
    })

    // 6. L Foot (QTY = Railings * 3)
    const lFootQty = railingQty * 3
    items.push({
      id: `boq-6-${now}`,
      description: `L Foot`,
      quantity: lFootQty,
      rate: prices.LFoot,
      unit: 'PCS'
    })

    // 6.1. Clip lock 3/4 (Old 8197ea9: 1 SET; New 20kW: 2 SETS)
    const clipLockQty = (inverterKw >= 20 && !isOld20Kw) ? 2 : 1
    items.push({
      id: `boq-cliplock-${now}`,
      description: `Clip lock 3/4`,
      quantity: clipLockQty,
      rate: prices.ClipLock34 || 180.00,
      unit: 'SET'
    })

    // 6.5. Splice Connector (3k-5k: 6 PCS; 6k+: Math.ceil(Railings / 2))
    const spliceConnectorQty = inverterKw <= 5 ? 6 : Math.ceil(railingQty / 2)
    items.push({
      id: `boq-splice-${now}`,
      description: `Splice Connector`,
      quantity: spliceConnectorQty,
      rate: prices.SpliceConnector || 90,
      unit: 'PCS'
    })

    // 6.6. PU Sealant (Old 8197ea9: 1 PC; New 20kW: 2 PCS)
    const puSealantQty = (inverterKw >= 20 && !isOld20Kw) ? 2 : 1
    items.push({
      id: `boq-sealant-${now}`,
      description: `PU Sealant`,
      quantity: puSealantQty,
      rate: prices.PuSealant || 400,
      unit: 'PC'
    })

    // 6.7. PVC Moulding (Old 8197ea9: 5m; New 20kW: 10m; 3k-5k: 3m; 6k-16k: 5m)
    const pvcMouldingMeters = (inverterKw >= 20 && !isOld20Kw) ? 10 : (inverterKw <= 5 ? 3 : 5)
    items.push({
      id: `boq-moulding-${now}`,
      description: `PVC Moulding`,
      quantity: pvcMouldingMeters,
      rate: prices.PvcMoulding || 449,
      unit: 'M'
    })

    // 7. Flexible Hose (Old 8197ea9: 40mm 50m; New 20kW: 40mm 100m; <=6kW: 32mm 25m; 8kW: 32mm 50m; 10k-16k: 40mm 50m)
    const conduitDetails = getConduitDetails(inverterKw, runLength, isOld20Kw)
    items.push({
      id: `boq-7-${now}`,
      description: conduitDetails.description,
      quantity: conduitDetails.quantity,
      rate: conduitDetails.rate,
      unit: conduitDetails.unit
    })

    // 8. AC Wire (Old 8197ea9: 50m #6 + 50m #8; New 20kW: 120m #6 + 120m #8; 12k-16k: 100m #6 + 100m #8; 10k: 60m #6 + 60m #8)
    if (inverterKw >= 10) {
      const acWireMeters = (inverterKw >= 20 && !isOld20Kw) ? 120 : (isOld20Kw ? 50 : (inverterKw >= 12 ? 100 : 60))
      items.push({
        id: `boq-8-ac6-${now}`,
        description: 'AC Wire #6',
        quantity: acWireMeters,
        rate: 99.34,
        unit: 'M'
      })
      items.push({
        id: `boq-8-ac8-${now}`,
        description: 'AC Wire #8',
        quantity: acWireMeters,
        rate: 60.04,
        unit: 'M'
      })
    } else {
      const acWireDesc = inverterKw === 8 ? 'AC Wire 6mm²' : 'AC Wire #8'
      items.push({
        id: `boq-8-${now}`,
        description: acWireDesc,
        quantity: 60,
        rate: 60.04,
        unit: 'M'
      })
    }

    // 9. DC Wire (Old 8197ea9: 100m; New 20kW: 160m; 3k-8k: 60m; 10k-16k: 80m)
    const dcWireDesc = inverterKw === 8 ? 'DC Wire 6mm²' : 'DC Wire'
    items.push({
      id: `boq-dc-${now}`,
      description: dcWireDesc,
      quantity: wireInfo.dcWireMeters,
      rate: 125,
      unit: 'M'
    })

    // 10. MC4 1500V (Old 8197ea9: 15 PCS; New 20kW: 30 PCS; 3k-5k: 4 PCS; 6k: 10 PCS; 8k-16k: 15 PCS)
    const mc4Qty = isOld20Kw ? 15 : (inverterKw >= 20 ? 30 : (inverterKw <= 5 ? 4 : (inverterKw === 6 ? 10 : 15)))
    items.push({
      id: `boq-10-${now}`,
      description: `MC4 1500V`,
      quantity: mc4Qty,
      rate: 60.00,
      unit: 'PCS'
    })

    // 10.5. MC4 2 String (Old 8197ea9: 2 PCS; New 20kW: 4 PCS; 10k-16k: 2 PCS)
    if (inverterKw >= 10) {
      const mc4TwoStringQty = (inverterKw >= 20 && !isOld20Kw) ? 4 : 2
      items.push({
        id: `boq-mc4-2string-${now}`,
        description: `MC4 2 String`,
        quantity: mc4TwoStringQty,
        rate: 550.00,
        unit: 'PCS'
      })
    }

    // 11. Breaker Box / Metal Enclosure (Old 8197ea9: 1 PC 50x60 @ ₱3,000; New 20kW: 2x 50x60 @ ₱3,000)
    items.push({
      id: `boq-11-${now}`,
      description: isOld20Kw ? `Breaker box / Metal Enclosure 50x60` : breakers.enclosure,
      quantity: isOld20Kw ? 1 : breakers.enclosureQty,
      rate: isOld20Kw ? prices.BreakerBox : breakers.enclosureRate,
      unit: 'PC'
    })

    // 12. AC Breakers (Old 8197ea9: 4x AC MCCB @ ₱850; New 20kW: 8x AC MCCB @ ₱1,300)
    if (isOld20Kw) {
      items.push({
        id: `boq-12-${now}`,
        description: `AC MCCB`,
        quantity: 4,
        rate: 850.00,
        unit: 'PCS'
      })
    } else if (inverterKw === 16) {
      items.push({
        id: `boq-12-mccb100-${now}`,
        description: `AC MCCB 100A`,
        quantity: 2,
        rate: 1300.00,
        unit: 'PCS'
      })
      items.push({
        id: `boq-12-mccb125-${now}`,
        description: `AC MCCB 125A`,
        quantity: 2,
        rate: 1300.00,
        unit: 'PCS'
      })
    } else {
      items.push({
        id: `boq-12-${now}`,
        description: breakers.acMcb,
        quantity: breakers.acMcbQty,
        rate: breakers.acMcbRate,
        unit: 'PCS'
      })
    }

    // 13. AC SPD (Old 8197ea9: 2 PCS; New 20kW: 4 PCS; others: 2 PCS | Price = ₱570)
    items.push({
      id: `boq-13-${now}`,
      description: `AC SPD`,
      quantity: breakers.acSpdQty,
      rate: 570.00,
      unit: 'PCS'
    })

    // 14. DC SPD (Old 8197ea9: 2 PCS; New 20kW: 6 PCS; 3k-6k: 2 PCS; 8k-16k: 3 PCS | Price = ₱790)
    items.push({
      id: `boq-14-${now}`,
      description: `DC SPD`,
      quantity: breakers.dcSpdQty,
      rate: 790.00,
      unit: 'PCS'
    })

    // 15. DC MCB (Old 8197ea9: 2 PCS; New 20kW: 4 PCS; 3k-10k: 2 PCS; 12k-16k: 3 PCS | Price = ₱420)
    items.push({
      id: `boq-15-${now}`,
      description: `DC MCB`,
      quantity: breakers.dcMcbQty,
      rate: 420.00,
      unit: 'PCS'
    })

    // 16. DC MCCB for battery (included only for Hybrid setup) (Old 8197ea9: 1 PC @ ₱2,000; New 20kW: 2 PCS @ ₱2,500)
    if (effSystemType !== 'ongrid') {
      items.push({
        id: `boq-16-${now}`,
        description: isOld20Kw ? `DC MCCB for battery` : breakers.dcMccb,
        quantity: isOld20Kw ? 1 : breakers.dcMccbQty,
        rate: isOld20Kw ? 2000.00 : (breakers.dcMccbRate || 2500.00),
        unit: 'PC'
      })
    }

    // 17. Cable Tray 2m (Old 8197ea9: 1 PC; New 20kW: 4 PCS; 8k-16k: 2 PCS; other tiers: 1 PC | Price = ₱560)
    const cableTrayQty = isOld20Kw ? 1 : (inverterKw >= 20 ? 4 : (inverterKw >= 8 ? 2 : 1))
    items.push({
      id: `boq-17-${now}`,
      description: `Cable Tray 2m`,
      quantity: cableTrayQty,
      rate: prices.CableTray || 560,
      unit: 'PCS'
    })

    // 18. Automatic transfer switch (Old 8197ea9: 1 PC 125A @ ₱4,000; New 20kW: 2 PCS 125A @ ₱4,000)
    if (effSystemType !== 'ongrid') {
      items.push({
        id: `boq-18-${now}`,
        description: isOld20Kw ? `Automatic transfer switch 125A` : breakers.ats,
        quantity: isOld20Kw ? 1 : breakers.atsQty,
        rate: isOld20Kw ? 4000.00 : breakers.atsRate,
        unit: 'PC'
      })
    }

    // 19. Terminal lugs (Old 8197ea9: 30x 25mm, 5x 50mm; New 20kW: 72x 25mm, 32x 50mm)
    if (isOld20Kw) {
      items.push({
        id: `boq-19-25mm-${now}`,
        description: `Terminal lugs 25mm`,
        quantity: 30,
        rate: 40.00,
        unit: 'PCS'
      })
      items.push({
        id: `boq-19-50mm-${now}`,
        description: `Terminal lugs 50mm`,
        quantity: 5,
        rate: 50.00,
        unit: 'PCS'
      })
      // 21. Terminal Block (in Old 8197ea9 20kW: 2 PCS @ ₱160)
      items.push({
        id: `boq-21-${now}`,
        description: `Terminal Block`,
        quantity: 2,
        rate: prices.TerminalBlock,
        unit: 'PCS'
      })
    } else {
      if (inverterKw >= 8) {
        items.push({
          id: `boq-19-25mm-${now}`,
          description: `Terminal lugs 25mm`,
          quantity: inverterKw >= 20 ? 72 : 36,
          rate: 40.00,
          unit: 'PCS'
        })
      }
      const lugs50Qty = inverterKw >= 20 ? 32 : (inverterKw <= 6 ? 8 : (inverterKw <= 10 ? 16 : 20))
      items.push({
        id: `boq-19-50mm-${now}`,
        description: `Terminal lugs 50mm`,
        quantity: lugs50Qty,
        rate: 50.00,
        unit: 'PCS'
      })
    }

    // 22. Battery Cable (Old 8197ea9: 2m 50mm @ ₱700; New 20kW: 20m 50mm @ ₱700)
    if (effSystemType !== 'ongrid') {
      items.push({
        id: `boq-22-${now}`,
        description: isOld20Kw ? `Battery Cable (Black & Red) 50mm` : wireInfo.batteryCableDesc,
        quantity: isOld20Kw ? 2 : wireInfo.batteryCableMeters,
        rate: isOld20Kw ? 700.00 : wireInfo.batteryCableRate,
        unit: 'M'
      })
    }

    // Grounding Lugs (Old 8197ea9: 5 PCS; New 20kW: 10 PCS; 8k & 10k: 5 PCS; others: 2 PCS @ ₱50)
    const groundLugsQty = isOld20Kw ? 5 : (inverterKw >= 20 ? 10 : ((inverterKw === 8 || inverterKw === 10) ? 5 : 2))
    items.push({
      id: `boq-g1-${now}`,
      description: `Grounding Lugs`,
      quantity: groundLugsQty,
      rate: prices.GroundingLugs || 50,
      unit: 'PCS'
    })

    // Ground Wire (4k: 50m; 8k-16k: 25m; 20k: 50m; 3k/5k/6k: 20m)
    items.push({
      id: `boq-g2-${now}`,
      description: isOld20Kw ? `Ground Wire` : wireInfo.groundWireDesc,
      quantity: isOld20Kw ? 50 : wireInfo.groundWireMeters,
      rate: prices.GroundWire || (5888 / 150),
      unit: 'M'
    })

    // Ground Rod w/ Clamp 1.5 Meters (Old 8197ea9: 1 PC; New 20kW: 2 PCS; 16k: 2 PCS; others: 1 PC @ ₱750)
    const groundRodQty = isOld20Kw ? 1 : (inverterKw >= 16 ? 2 : 1)
    items.push({
      id: `boq-g3-${now}`,
      description: `Ground Rod w/ Clamp 1.5 Meters`,
      quantity: groundRodQty,
      rate: prices.GroundRod || 750,
      unit: 'PC'
    })

    // 23. Labor and Installation
    const totalPanelWatts = panelQty * PANEL_WATTAGE
    const pricePerWatt = invoice.laborPricePerWatt ?? 6
    const laborRate = Math.round(totalPanelWatts * pricePerWatt)
    items.push({
      id: `boq-23-${now}`,
      description: `Labor and Installation`,
      quantity: 1,
      rate: laborRate,
      unit: 'LOT'
    })

    // 24. Delivery Fees
    const calculatedDeliveryRate = selectedLocation ? calculateDeliveryFee(selectedLocation.drivingDistanceKm) : (invoice.deliveryFee || prices.DeliveryFees || 5000.00)
    items.push({
      id: `boq-delivery-${now}`,
      description: `Delivery Fees`,
      quantity: 1,
      rate: calculatedDeliveryRate,
      unit: 'LOT'
    })

    // Calculate current local date string (YYYY-MM-DD)
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const currentDateStr = `${yyyy}-${mm}-${dd}`
    const dueStr = addDays(currentDateStr, 15)

    const systemTypeLabel = effSystemType === 'ongrid' ? 'On-Grid' : 'Hybrid'
    const systemTypeSubject = effSystemType === 'ongrid' 
      ? `${systemKw}kW On-Grid Solar System`
      : `${systemKw}kW Hybrid System with Battery`
    const newSalutation = `Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the ${systemKw}kW ${systemTypeLabel} Solar System based on your requirement.`

    setActiveKwSetup(systemKw)
    if (explicitSystemType) {
      setSystemType(explicitSystemType)
    }
    if (systemKw === 20 && explicitTwentyKwMode) {
      setTwentyKwMode(explicitTwentyKwMode)
    }

    setRowsCount(rows)
    prevPanelQtyRef.current = panelQty
    prevBatteryQtyRef.current = bQty
    prevTotalWattsRef.current = totalPanelWatts
    prevPricePerWattRef.current = pricePerWatt

    setInvoice((prev) => ({
      ...prev,
      excludeBattery: effSystemType === 'ongrid',
      lineItems: items,
      subject: systemTypeSubject,
      salutation: newSalutation,
      issueDate: currentDateStr,
      dueDate: dueStr,
      invoiceNumber: generateDocumentId(prev.invoiceNumber?.startsWith('MG-INV') ? 'MG-INV' : 'MG-QT'),
    }))
  }

  // Auto-update timestamped Invoice / Quotation # every second in real-time
  useEffect(() => {
    if (!loaded) return
    const interval = setInterval(() => {
      setInvoice((prev) => {
        const current = prev.invoiceNumber?.trim() || ''
        const isDynamicPattern = !current || /^MG-(QT|INV)(-\d{6,14})?$/i.test(current)
        if (!isDynamicPattern) return prev
        const prefix = current.startsWith('MG-INV') ? 'MG-INV' : 'MG-QT'
        const nextId = generateDocumentId(prefix)
        if (nextId === current) return prev
        return {
          ...prev,
          invoiceNumber: nextId,
        }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [loaded])

  // Keep document title synced at all times with the client name and quotation number
  useEffect(() => {
    if (!loaded) return
    const client = invoice.toName ? invoice.toName.trim() : 'Client'
    const quotationNumber = invoice.invoiceNumber ? invoice.invoiceNumber.trim() : ''
    const parts = [client, quotationNumber].filter(Boolean)
    document.title = parts.length > 0 ? parts.join(' - ') : 'Quotation'
  }, [loaded, invoice.toName, invoice.invoiceNumber])

  useEffect(() => {
    if (!loaded || !autoPrint.current) return
    const timer = setTimeout(() => {
      const updatedHistory = saveInvoiceToHistory(invoice, calculateTotal)
      setHistoryList(updatedHistory)
      const client = invoice.toName ? invoice.toName.trim() : 'Client'
      const quotationNumber = invoice.invoiceNumber ? invoice.invoiceNumber.trim() : ''
      const parts = [client, quotationNumber].filter(Boolean)
      const title = parts.length > 0 ? parts.join(' - ') : 'Quotation'
      document.title = title
      const titleEl = document.querySelector('title')
      if (titleEl) {
        titleEl.innerText = title
      }
      window.print()
    }, 450)
    return () => clearTimeout(timer)
  }, [loaded, invoice.toName, invoice.invoiceNumber, invoice])

  const computeDefaultFileName = () => {
    const client = invoice.toName ? invoice.toName.trim() : 'Client'
    const quotationNumber = invoice.invoiceNumber ? invoice.invoiceNumber.trim() : ''
    const parts = [client, quotationNumber].filter(Boolean)
    const base = parts.length > 0 ? parts.join(' - ') : 'Quotation'
    return base.replace(/[\\/:*?"<>|]/g, '').trim() || 'Quotation'
  }

  const handleOpenDownloadModal = () => {
    setDownloadFileName(computeDefaultFileName())
    setDownloadIsCondensed(invoice.isCondensed ?? false)
    setDownloadCapitalVersion(capitalVersion || 'v1')
    setDownloadQuotationMarkup({
      withMarkup: true,
      withoutMarkup: false,
    })
    setDownloadDocTypes({
      quotation: activeTab === 'items' || (activeTab !== 'checklist' && activeTab !== 'capital'),
      checklist: activeTab === 'checklist',
      capital: activeTab === 'capital',
    })
    setDownloadUseZip(false)
    setDownloadModalOpen(true)
  }

  const getSelectedExportTasks = (baseName: string) => {
    const tasks: Array<{
      id: string
      title: string
      filename: string
      docType: 'quotation' | 'checklist' | 'capital'
      withoutMarkup?: boolean
      isCondensed?: boolean
      capitalVersion?: 'v1' | 'v2'
    }> = []

    const cleanBase = baseName.trim() || 'Quotation'
    const layoutTag = downloadIsCondensed ? 'Compressed' : 'Expanded'
    const ext = downloadFormat === 'png' ? 'png' : 'pdf'

    if (downloadDocTypes.quotation) {
      if (downloadQuotationMarkup.withMarkup) {
        tasks.push({
          id: 'quote-with-markup',
          title: `Quotation (${layoutTag}, With Rate Markup)`,
          filename: `${cleanBase} - ${layoutTag} - With Rate Markup.${ext}`,
          docType: 'quotation',
          withoutMarkup: false,
          isCondensed: downloadIsCondensed,
        })
      }
      if (downloadQuotationMarkup.withoutMarkup) {
        tasks.push({
          id: 'quote-without-markup',
          title: `Quotation (${layoutTag}, Without Rate Markup)`,
          filename: `${cleanBase} - ${layoutTag} - Without Rate Markup.${ext}`,
          docType: 'quotation',
          withoutMarkup: true,
          isCondensed: downloadIsCondensed,
        })
      }
    }

    if (downloadDocTypes.checklist) {
      tasks.push({
        id: 'checklist',
        title: 'Packing & Dispatch Checklist',
        filename: `${cleanBase} - Checklist.${ext}`,
        docType: 'checklist',
      })
    }

    if (downloadDocTypes.capital) {
      const capTag = downloadCapitalVersion === 'v1' 
        ? (downloadIsCondensed ? 'V1 (Compressed)' : 'V1 (Expanded)') 
        : 'V2 (Detailed)'
      tasks.push({
        id: 'capital',
        title: `Capital & Expenses (${capTag})`,
        filename: `${cleanBase} - Capital ${downloadCapitalVersion === 'v1' ? (downloadIsCondensed ? 'Compressed' : 'Expanded') : 'V2'}.${ext}`,
        docType: 'capital',
        capitalVersion: downloadCapitalVersion,
        isCondensed: downloadIsCondensed,
      })
    }

    // When only a single document is selected for download, use the exact Base File Name
    if (tasks.length === 1) {
      tasks[0].filename = `${cleanBase}.${ext}`
    }

    return tasks
  }

  const handleExecuteDownload = async (targetCustomName?: string) => {
    if (isExportingPdf) return

    const rawName = (targetCustomName || downloadFileName || computeDefaultFileName()).trim()
    let cleanName = rawName.replace(/[\\/:*?"<>|]/g, '').trim()
    if (cleanName.toLowerCase().endsWith('.pdf')) {
      cleanName = cleanName.slice(0, -4).trim()
    }
    if (cleanName.toLowerCase().endsWith('.png')) {
      cleanName = cleanName.slice(0, -4).trim()
    }
    if (!cleanName) cleanName = 'Quotation'

    const tasks = getSelectedExportTasks(cleanName)
    if (tasks.length === 0) return

    const exportTitle = tasks.length === 1 ? tasks[0].filename.replace(/\.(pdf|png)$/i, '') : cleanName

    setIsExportingPdf(true)
    setPdfExportStatus('Preparing documents for export...')

    const updatedHistory = saveInvoiceToHistory(invoice, calculateTotal)
    setHistoryList(updatedHistory)
    document.title = exportTitle
    const titleEl = document.querySelector('title')
    if (titleEl) {
      titleEl.innerText = exportTitle
    }

    // On mobile / small screens, switch to preview tab so that printable DOM is fully mounted
    if (activeView === 'edit' && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setActiveView('preview')
    }

    // Ensure URL has no trailing query parameters in browser address bar before exporting
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    const originalTab = activeTab
    const originalIsCondensed = invoice.isCondensed
    const originalRateMarkup = invoice.rateMarkup
    const originalCapitalVersion = capitalVersion

    try {
      const generatedFiles: Array<{ filename: string; blob: Blob }> = []

      // PHASE 1: GENERATE ALL DOCUMENTS FIRST IN MEMORY
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        setPdfExportStatus(`[${i + 1}/${tasks.length}] Generating ${task.title}...`)

        if (task.docType === 'quotation') {
          setInvoice(prev => ({
            ...prev,
            isCondensed: task.isCondensed ?? false,
            rateMarkup: task.withoutMarkup ? 0 : (originalRateMarkup ?? 0),
          }))
          setActiveTab('items')
        } else if (task.docType === 'checklist') {
          setActiveTab('checklist')
        } else if (task.docType === 'capital') {
          setCapitalVersion(task.capitalVersion || downloadCapitalVersion || 'v1')
          if (task.isCondensed !== undefined) {
            setInvoice(prev => ({
              ...prev,
              isCondensed: task.isCondensed ?? false,
            }))
          }
          setActiveTab('capital')
        }

        await new Promise(r => setTimeout(r, 260))

        if (downloadFormat === 'png') {
          const res = await exportToPngDirect({
            filename: task.filename,
            onProgress: (status) => setPdfExportStatus(`[${i + 1}/${tasks.length}] ${status}`),
            returnBlobOnly: true,
          })
          if (res.success && res.pages && res.pages.length > 0) {
            generatedFiles.push(...res.pages)
          } else if (res.success && res.blob) {
            generatedFiles.push({
              filename: task.filename,
              blob: res.blob,
            })
          }
        } else {
          const res = await exportToPdfDirect({
            filename: task.filename,
            onProgress: (status) => setPdfExportStatus(`[${i + 1}/${tasks.length}] ${status}`),
            returnBlobOnly: true,
          })
          if (res.success && res.blob) {
            generatedFiles.push({
              filename: task.filename,
              blob: res.blob,
            })
          }
        }
      }

      // PHASE 2: DOWNLOADING - ONLY AFTER ALL DOCUMENTS FINISHED GENERATING
      if (generatedFiles.length === 1 && !downloadUseZip) {
        // Single file: directly save with picker if supported
        const file = generatedFiles[0]
        setPdfExportStatus(`Saving ${file.filename}...`)
        await saveBlobWithPicker(file.blob, file.filename, undefined, true)
      } else if (generatedFiles.length > 1 && downloadUseZip) {
        // Multiple files with ZIP: package into single ZIP archive
        setPdfExportStatus('Packaging files into ZIP archive...')
        const zip = new JSZip()
        for (const item of generatedFiles) {
          zip.file(item.filename, item.blob)
        }
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        })
        const zipFilename = `${cleanName}.zip`
        setPdfExportStatus('Saving ZIP package to device...')
        await saveBlobWithPicker(zipBlob, zipFilename, undefined, true)
      } else if (generatedFiles.length > 0) {
        // Multiple files without ZIP: download one by one sequentially after all loading is finished
        for (let j = 0; j < generatedFiles.length; j++) {
          const file = generatedFiles[j]
          setPdfExportStatus(`[${j + 1}/${generatedFiles.length}] Saving ${file.filename}...`)
          await saveBlobWithPicker(file.blob, file.filename, undefined, false)
          await new Promise(r => setTimeout(r, 350))
        }
      }

      setPdfExportStatus('Download complete!')
      await new Promise(r => setTimeout(r, 400))
      setDownloadModalOpen(false)
    } catch (err) {
      console.error('Direct export error:', err)
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print()
      }
    } finally {
      // Restore original invoice settings, capitalVersion, and active tab
      setInvoice(prev => ({
        ...prev,
        isCondensed: originalIsCondensed,
        rateMarkup: originalRateMarkup,
      }))
      setCapitalVersion(originalCapitalVersion)
      setActiveTab(originalTab)
      setIsExportingPdf(false)
      setPdfExportStatus('')
    }
  }

  const handleSalesPersonChange = (val: string) => {
    const person = SALESPEOPLE.find((p) => p.id === val)
    if (person) {
      update('salesPerson', val)
      if (val !== 'custom') {
        update('salesName', person.name)
        update('salesPosition', person.position)
        update('salesCompany', person.company)
        update('salesContact', person.contact)
        update('salesEmail', person.email)
      }
      if (!invoice.dueDate || invoice.dueDate === '') {
        const todayStr = new Date().toISOString().slice(0, 10)
        update('dueDate', addDays(invoice.issueDate || todayStr, 15))
      }
    }
  }

  return (
    <div className={cn("flex flex-col h-dvh overflow-hidden bg-background text-foreground print:!bg-white print:!block print:!h-auto print:!overflow-visible", `theme-${invoice.theme || 'light'}`)}>
      {/* Mobile Header */}
      <div className="flex lg:hidden items-center justify-between px-3 py-2.5 bg-card border-b border-border shrink-0 print:hidden min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm text-foreground tracking-tight shrink-0">MG Invoice</span>
          <button
            onClick={cycleTheme}
            className="h-7 w-7 rounded-full bg-secondary hover:bg-secondary/80 border border-border flex items-center justify-center text-xs transition-transform active:scale-90 cursor-pointer select-none shrink-0"
            title={`Current Theme: ${THEME_NAMES[invoice.theme || 'light']} (Click to switch)`}
          >
            {THEME_EMOJIS[invoice.theme || 'light']}
          </button>

          <GoodweCountdownBadge compact onClick={() => setGoodweModalOpen(true)} />
        </div>
      </div>






      {/* Main Workspace Container */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row print:!block print:!h-auto print:!overflow-visible">
        {/* ── SIDEBAR ── */}
        <aside className={cn("w-full flex-1 lg:h-full min-h-0 bg-card text-card-foreground border-b lg:border-b-0 lg:border-r border-border flex flex-col lg:flex-row shrink-0 print:!hidden", activeTab === 'changelog' ? 'lg:w-full' : 'lg:w-[450px]', activeView === 'edit' ? 'flex' : 'hidden lg:flex')}>
          {/* Tab strip (Horizontal on mobile/tablet, Vertical on desktop) */}
          <div className="w-full lg:w-[76px] h-auto lg:h-full bg-background border-b lg:border-b-0 lg:border-r border-border flex flex-row lg:flex-col items-center justify-between lg:justify-start px-4 py-3 lg:px-0 lg:py-6 gap-2 lg:gap-5 overflow-x-auto lg:overflow-x-visible shrink-0 scrollbar-none">
            {[
              { id: 'sender', label: 'Sender', icon: Building, title: 'Sender & Sales Contact' },
              { id: 'invoice', label: 'Details', icon: FileText, title: 'Client, Invoice Details & Terms' },
              { id: 'items', label: 'Items', icon: List, title: 'Line Items & Supply Filter' },
              { id: 'checklist', label: 'Checklist', icon: ClipboardCheck, title: 'Itemized Packing & Dispatch Checklist' },
              { id: 'capital', label: 'Capital', icon: Coins, title: 'Capital & Expenses Breakdown' },
              { id: 'history', label: 'History', icon: History, title: 'Exported PDF History Cache' },
              { id: 'changelog', label: 'Changelog', icon: RefreshCw, title: 'Price & Quantity Change Log' },
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSwitch(tab.id)}
                  className={cn(
                    "relative w-12 h-12 lg:w-14 lg:h-14 rounded-[12px] flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer select-none shrink-0",
                    active
                      ? "bg-card text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-border font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                  title={tab.title}
                >
                  <Icon size={15} className="lg:w-4 lg:h-4" />
                  <span className="text-[8px] lg:text-[9px] leading-none tracking-tight">{tab.label}</span>
                  {active && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-0 lg:top-1/2 lg:-translate-y-1/2 w-6 lg:w-[3px] h-[3px] lg:h-6 bg-primary rounded-t-[3px] lg:rounded-t-none lg:rounded-r-[3px]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Right form layout */}
          <div className="flex-1 flex flex-col min-h-0 lg:h-full min-w-0">
            {/* Logo & Theme Picker (Desktop only) */}
            <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border shrink-0 gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[17px] text-foreground tracking-tight">MG Invoice</span>
              </div>


              {/* Countdown for Goodwe Pricelist update on the 25th */}
              <GoodweCountdownBadge onClick={() => setGoodweModalOpen(true)} />


              <button
                onClick={cycleTheme}
                className="h-8 w-8 rounded-full bg-secondary hover:bg-secondary/80 border border-border flex items-center justify-center text-base transition-all active:scale-90 hover:scale-105 cursor-pointer select-none shrink-0 shadow-2xs"
                title={`Theme: ${THEME_NAMES[invoice.theme || 'light']} (Click to switch)`}
              >
                {THEME_EMOJIS[invoice.theme || 'light']}
              </button>



            </div>


          {/* Scrollable active tab form content */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-7 min-h-0">
            {activeTab === 'sender' && (
              <>
                {/* FROM */}
                <section className="space-y-3">
                  <SectionHeader>From</SectionHeader>
                  <div className="space-y-2" onMouseEnter={() => setHoveredField('fromName')} onMouseLeave={() => setHoveredField(null)}>
                    <Field label="Company name">
                      <Input
                        value={invoice.fromName}
                        onChange={(e) => update('fromName', e.target.value)}
                        placeholder="Acme Studio"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={invoice.fromEmail}
                        onChange={(e) => update('fromEmail', e.target.value)}
                        placeholder="hello@acmestudio.com"
                      />
                    </Field>
                    <Field label="Address">
                      <Textarea
                        value={invoice.fromAddress}
                        onChange={(e) => update('fromAddress', e.target.value)}
                        placeholder="123 Design Ave, San Francisco"
                        rows={2}
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        type="tel"
                        value={invoice.fromPhone}
                        onChange={(e) => update('fromPhone', e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </Field>
                  </div>
                </section>

                {/* SALES CONTACT */}
                <section className="space-y-3">
                  <SectionHeader>Sales Contact</SectionHeader>
                  <div className="space-y-2" onMouseEnter={() => setHoveredField('salesName')} onMouseLeave={() => setHoveredField(null)}>
                    <Field 
                      label="Salesperson"
                      className="p-3 bg-primary/5 rounded-[12px] border border-primary/30 shadow-sm transition-all duration-300 hover:border-primary/50 relative"
                    >
                      <Select value={invoice.salesPerson || 'custom'} onValueChange={handleSalesPersonChange}>
                        <SelectTrigger className="border-primary/30 bg-background/50 hover:bg-background transition-all font-medium">
                          <SelectValue placeholder="Select Salesperson" />
                        </SelectTrigger>
                        <SelectContent>
                          {SALESPEOPLE.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="absolute -top-2 right-3 px-1.5 py-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded uppercase tracking-wider whitespace-nowrap shadow-sm">
                        Select Rep
                      </span>
                    </Field>
                    <Field label="Sales Name">
                      <Input
                        value={invoice.salesName || ''}
                        onChange={(e) => {
                          update('salesName', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="Salesperson Name"
                      />
                    </Field>
                    <Field label="Position">
                      <Input
                        value={invoice.salesPosition || ''}
                        onChange={(e) => {
                          update('salesPosition', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="Sales & Marketing Executive"
                      />
                    </Field>
                    <Field label="Company Name">
                      <Input
                        value={invoice.salesCompany || ''}
                        onChange={(e) => {
                          update('salesCompany', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="M&G Non-Specialized Wholesale Trading"
                      />
                    </Field>
                    <Field label="Contact Number">
                      <Input
                        type="tel"
                        value={invoice.salesContact || ''}
                        onChange={(e) => {
                          update('salesContact', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="+(63) 9XX XXXX XXX"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={invoice.salesEmail || ''}
                        onChange={(e) => {
                          update('salesEmail', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="email@mgtrading.com"
                      />
                    </Field>
                  </div>
                </section>
              </>
            )}

            {(activeTab === 'invoice' || activeTab === 'client') && (
              <>
                {/* CLIENT DETAILS (BILL TO) */}
                <section className="space-y-3">
                  <SectionHeader>Client Details (Bill To)</SectionHeader>
                  <div className="space-y-2" onMouseEnter={() => setHoveredField('toName')} onMouseLeave={() => setHoveredField(null)}>
                    <Field label="Client name">
                      <Input
                        value={invoice.toName}
                        onChange={(e) => update('toName', e.target.value)}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={invoice.toEmail}
                        onChange={(e) => update('toEmail', e.target.value)}
                      />
                    </Field>
                    <Field label="Address">
                      <Textarea
                        value={invoice.toAddress}
                        onChange={(e) => update('toAddress', e.target.value)}
                        rows={2}
                      />
                    </Field>
                  </div>
                </section>

                {/* INVOICE DETAILS */}
                <section className="space-y-3">
                  <SectionHeader>Invoice Details</SectionHeader>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Invoice #" onMouseEnter={() => setHoveredField('invoiceNumber')} onMouseLeave={() => setHoveredField(null)}>
                        <div className="relative flex items-center">
                          <Input
                            className="font-mono text-xs pr-7"
                            value={invoice.invoiceNumber || ''}
                            onChange={(e) => update('invoiceNumber', e.target.value)}
                            placeholder="MG-QT-..."
                          />
                          <button
                            type="button"
                            onClick={() => update('invoiceNumber', generateDocumentId(invoice.invoiceNumber?.startsWith('MG-INV') ? 'MG-INV' : 'MG-QT'))}
                            className="absolute right-1.5 p-1 text-muted-foreground hover:text-foreground cursor-pointer rounded hover:bg-secondary transition-colors"
                            title="Generate fresh ID"
                          >
                            <RefreshCw size={11} />
                          </button>
                        </div>
                        <div className="flex gap-1 mt-1 justify-end items-center">
                          <span className="text-[9px] text-[#888888] mr-auto self-center select-none font-mono">Generate:</span>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => update('invoiceNumber', generateDocumentId('MG-INV'))}
                            className="h-5 px-1.5 text-[9px] font-mono cursor-pointer"
                            title="Generate Invoice ID"
                          >
                            +INV
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => update('invoiceNumber', generateDocumentId('MG-QT'))}
                            className="h-5 px-1.5 text-[9px] font-mono cursor-pointer"
                            title="Generate Quotation ID"
                          >
                            +QT
                          </Button>
                        </div>
                      </Field>
                      <Field label="Issue Date" onMouseEnter={() => setHoveredField('issueDate')} onMouseLeave={() => setHoveredField(null)}>
                        <DatePicker
                          value={invoice.issueDate}
                          onChange={(v) => update('issueDate', v)}
                        />
                      </Field>
                    </div>
                    <Field label="Validity" onMouseEnter={() => setHoveredField('dueDate')} onMouseLeave={() => setHoveredField(null)}>
                      <DatePicker
                        value={invoice.dueDate}
                        onChange={(v) => update('dueDate', v)}
                        placeholder="No validity date"
                      />
                    </Field>
                    <Field label="12% VAT" onMouseEnter={() => setHoveredField('vatRate')} onMouseLeave={() => setHoveredField(null)}>
                      <div 
                        onClick={() => update('vatRate', (invoice.vatRate || 0) > 0 ? 0 : 12)}
                        className="flex items-center justify-between bg-secondary/60 hover:bg-secondary/90 transition-all p-2 rounded-[8px] border border-border cursor-pointer select-none"
                      >
                        <span className="text-[11px] font-bold text-foreground">
                          {(invoice.vatRate || 0) > 0 ? "12% VAT Enabled" : "No VAT (0%)"}
                        </span>
                        <button
                          type="button"
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            (invoice.vatRate || 0) > 0 ? "bg-primary" : "bg-muted-foreground/30"
                          )}
                          title="Toggle 12% VAT"
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out",
                              (invoice.vatRate || 0) > 0 ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </Field>
                    <Field label="Subject" onMouseEnter={() => setHoveredField('subject')} onMouseLeave={() => setHoveredField(null)}>
                      <Input
                        value={invoice.subject || ''}
                        onChange={(e) => {
                          const newSubj = e.target.value
                          update('subject', newSubj)
                          setInvoice((prev) => {
                            const isStandardSalutation = !prev.salutation || 
                              prev.salutation.startsWith('Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the') ||
                              prev.salutation.includes('based on your requirement')
                            if (isStandardSalutation && newSubj.trim()) {
                              const offerTitle = newSubj
                                .replace(/\s*\(\d+%\s*Margin\)/i, '')
                                .replace(/^Proposal\s*for\s*/i, '')
                                .trim()
                              return {
                                ...prev,
                                subject: newSubj,
                                salutation: `Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the ${offerTitle} based on your requirement.`
                              }
                            }
                            return { ...prev, subject: newSubj }
                          })
                        }}
                        placeholder="Supply & Deliver Safety Hats"
                      />
                    </Field>
                  </div>
                </section>

                {/* SALUTATION */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('salutation')} onMouseLeave={() => setHoveredField(null)}>
                  <SectionHeader>Salutation / Intro</SectionHeader>
                  <Textarea
                    value={invoice.salutation || ''}
                    onChange={(e) => update('salutation', e.target.value)}
                    placeholder="Dear Madam/Sir, We are pleased to submit..."
                    rows={3}
                  />
                </section>

                {/* NOTES / SPECIAL INSTRUCTIONS */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('note')} onMouseLeave={() => setHoveredField(null)}>
                  <div className="flex items-center justify-between">
                    <SectionHeader>Notes / Special Instructions</SectionHeader>
                    {(invoice.isExceedingServiceArea || (invoice.deliveryDistanceKm && invoice.deliveryDistanceKm > 50)) && (
                      <span className="text-[9.5px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        ⚠️ Extended Service Area Notice Active (&gt;50km)
                      </span>
                    )}
                  </div>
                  <Textarea
                    value={invoice.note}
                    onChange={(e) => update('note', e.target.value)}
                    placeholder="Notes, special instructions, or any additional details…"
                    rows={4}
                  />
                </section>

                {/* TERMS & CONDITIONS */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('terms')} onMouseLeave={() => setHoveredField(null)}>
                  <div className="flex items-center justify-between">
                    <SectionHeader>Terms & Conditions</SectionHeader>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => update('terms', defaultInvoice.terms)}
                      className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground cursor-pointer font-mono"
                      title="Reset terms to standard default policy"
                    >
                      Reset Default
                    </Button>
                  </div>
                  <Textarea
                    value={invoice.terms || ''}
                    onChange={(e) => update('terms', e.target.value)}
                    placeholder="Payment terms, contract conditions, warranty details…"
                    rows={4}
                  />
                </section>

                {/* CLOSING */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('closing')} onMouseLeave={() => setHoveredField(null)}>
                  <SectionHeader>Closing / Footer & Acknowledgment</SectionHeader>
                  <Textarea
                    value={invoice.closing || ''}
                    onChange={(e) => update('closing', e.target.value)}
                    placeholder="We are looking forward to building..."
                    rows={4}
                  />
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                    <Field label="CEO / Executive Signee">
                      <Input
                        value={invoice.ceoName ?? 'Mary Grace E. Santos'}
                        onChange={(e) => update('ceoName', e.target.value)}
                        placeholder="Mary Grace E. Santos"
                      />
                    </Field>
                    <Field label="Executive Title">
                      <Input
                        value={invoice.ceoPosition ?? 'Chief Executive Officer'}
                        onChange={(e) => update('ceoPosition', e.target.value)}
                        placeholder="Chief Executive Officer"
                      />
                    </Field>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'items' && (
              <section className="space-y-4">
                {/* Solar BOQ System Sizing & kW Setup */}
                <div className="p-3.5 bg-card border border-border rounded-[16px] text-left space-y-3 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Zap size={14} className="text-primary" />
                        <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                          Electric Bill & Sizing Reference
                        </h4>
                      </div>
                    </div>

                    {/* Hybrid / On-Grid Switch */}
                    <div className="flex gap-1 bg-secondary p-0.5 rounded-[8px] border border-border">
                      <button
                        type="button"
                        onClick={() => handleSystemTypeChange('hybrid')}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-bold rounded-[6px] transition-all cursor-pointer select-none",
                          systemType === 'hybrid'
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        ⚡ Hybrid
                      </button>
                      <button
                        type="button"
                        disabled={!ON_GRID_BRANDS.some(b => b.getPrice(activeKwSetup) !== null)}
                        onClick={() => handleSystemTypeChange('ongrid')}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-bold rounded-[6px] transition-all select-none",
                          !ON_GRID_BRANDS.some(b => b.getPrice(activeKwSetup) !== null)
                            ? "opacity-40 cursor-not-allowed pointer-events-none text-muted-foreground"
                            : systemType === 'ongrid'
                              ? "bg-primary text-primary-foreground shadow-xs cursor-pointer"
                              : "text-muted-foreground hover:text-foreground cursor-pointer"
                        )}
                        title={
                          !ON_GRID_BRANDS.some(b => b.getPrice(activeKwSetup) !== null)
                            ? `On-Grid is not available for ${activeKwSetup}kW setup`
                            : undefined
                        }
                      >
                        🌐 On-Grid
                      </button>
                    </div>
                  </div>


                  {/* kW Setup Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-5 gap-1.5">
                    {[1.5, 3, 4, 5, 6, 8, 10, 12, 16, 20].map((kw, idx) => {
                      const hasOnGridOption = ON_GRID_BRANDS.some(b => b.getPrice(kw) !== null)
                      const isDisabled = systemType === 'ongrid' && !hasOnGridOption
                      const v2Item = getSizingReferenceItem(kw)

                      const maxPanels = Math.round((kw * 1000) / PANEL_WATTAGE)
                      let calculatedPanelQty = maxPanels
                      if (activePreset === 'min') {
                        calculatedPanelQty = Math.max(3, Math.round(maxPanels * 0.5))
                      } else if (activePreset === 'balance') {
                        if (sizingRefVersion === 'v2' && v2Item) {
                          calculatedPanelQty = v2Item.panelCount
                        } else {
                          calculatedPanelQty = Math.max(4, Math.round(maxPanels * 0.75))
                        }
                      }
                      
                      const isSelected = activeKwSetup === kw
                      const billRef = getElectricBillRef(kw, sizingRefVersion, true)
                      const billDescColor = isSelected
                        ? "text-primary-foreground font-black"
                        : "text-foreground dark:text-zinc-100 font-extrabold"

                      // Calculate step-by-step mathematical flow values for tooltip
                      const minBillStr = v2Item ? v2Item.derivedElectricBill.split(' – ')[0] || v2Item.derivedElectricBill : '₱0'
                      const minBillVal = parseFloat(minBillStr.replace(/[^0-9.]/g, '')) || (kw * 1800)
                      const monthlyKwh = Math.round(minBillVal / 15)
                      const dailyKwh = (monthlyKwh / 30).toFixed(1)
                      const targetOffsetPct = kw <= 4 ? 75 : (kw <= 6 ? 80 : (kw <= 12 ? 78 : 75))
                      const targetSolarGen = Math.round(monthlyKwh * (targetOffsetPct / 100))
                      const targetSolarGenDaily = (targetSolarGen / 30).toFixed(1)
                      const yieldFactor = 98.28 // 4.20 PSH * 30 days * 0.78 PR
                      const requiredDcKwp = (targetSolarGen / yieldFactor).toFixed(2)
                      const panelsNeeded = v2Item?.panelCount ?? Math.ceil(parseFloat(requiredDcKwp) / 0.62)
                      const actualDcKwp = ((panelsNeeded * 620) / 1000).toFixed(2)
                      const actualEstGen = (parseFloat(actualDcKwp) * yieldFactor).toFixed(1)
                      const finalOffsetAchieved = Math.round((parseFloat(actualEstGen) / monthlyKwh) * 100)
                      const isTooltipOpenOnMobile = holdTooltipKw === kw

                      return (
                        <div key={kw} className="relative group">
                          <button
                            type="button"
                            disabled={isDisabled}
                            onTouchStart={() => {
                              if (isDisabled) return
                              if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
                              holdTimerRef.current = setTimeout(() => {
                                setHoldTooltipKw((prev) => (prev === kw ? null : kw))
                              }, 200)
                            }}
                            onTouchEnd={() => {
                              if (holdTimerRef.current) {
                                clearTimeout(holdTimerRef.current)
                                holdTimerRef.current = null
                              }
                            }}
                            onTouchCancel={() => {
                              if (holdTimerRef.current) {
                                clearTimeout(holdTimerRef.current)
                                holdTimerRef.current = null
                              }
                            }}
                            onClick={() => {
                              if (isDisabled) return
                              if (isSelected && kw === 20) {
                                const nextMode = twentyKwMode === 'parallel' ? 'single' : 'parallel'
                                setTwentyKwMode(nextMode)
                                handleGenerateBoq(20, activePreset, systemType, nextMode)
                              } else {
                                setActiveKwSetup(kw)
                                handleGenerateBoq(kw, activePreset, systemType, kw === 20 ? twentyKwMode : undefined)
                              }
                            }}
                            className={cn(
                              "w-full h-[60px] flex flex-col items-center justify-between p-2 rounded-[10px] border transition-all select-none font-semibold text-center relative",
                              isDisabled
                                ? "opacity-35 bg-secondary/20 border-border text-muted-foreground cursor-not-allowed pointer-events-none line-through"
                                : isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                  : "bg-secondary/50 hover:bg-secondary/80 border-border text-foreground cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                            )}
                          >
                            {/* Top row: kW */}
                            <div className="flex items-center justify-center leading-none">
                              <span className="font-bold text-xs">{kw}kW</span>
                            </div>

                            {/* Middle slot: 20kW Architecture Toggle or spacer for identical height */}
                            {kw === 20 ? (
                              <div className="flex items-center gap-1 my-auto leading-none" onClick={(e) => e.stopPropagation()}>
                                <span
                                  role="button"
                                  onClick={() => {
                                    setTwentyKwMode('parallel')
                                    setActiveKwSetup(20)
                                    handleGenerateBoq(20, activePreset, systemType, 'parallel')
                                  }}
                                  className={cn(
                                    "text-[7px] px-1 py-0.5 rounded font-bold transition-all cursor-pointer leading-none",
                                    twentyKwMode === 'parallel'
                                      ? (isSelected ? "bg-white text-primary font-black shadow-xs" : "bg-primary text-primary-foreground font-black")
                                      : (isSelected ? "bg-primary-foreground/20 text-primary-foreground/75 hover:bg-primary-foreground/30" : "bg-muted text-muted-foreground hover:text-foreground")
                                  )}
                                  title="Dual 10kW Inverters Parallel Setup"
                                >
                                  10k×2
                                </span>
                                <span
                                  role="button"
                                  onClick={() => {
                                    setTwentyKwMode('single')
                                    setActiveKwSetup(20)
                                    handleGenerateBoq(20, activePreset, systemType, 'single')
                                  }}
                                  className={cn(
                                    "text-[7px] px-1 py-0.5 rounded font-bold transition-all cursor-pointer leading-none",
                                    twentyKwMode === 'single'
                                      ? (isSelected ? "bg-white text-primary font-black shadow-xs" : "bg-primary text-primary-foreground font-black")
                                      : (isSelected ? "bg-primary-foreground/20 text-primary-foreground/75 hover:bg-primary-foreground/30" : "bg-muted text-muted-foreground hover:text-foreground")
                                  )}
                                  title="Original Single 20kW Inverter Setup (GoodWe 20kW Hybrid)"
                                >
                                  Old 20k
                                </span>
                              </div>
                            ) : (
                              <div className="h-3.5 my-auto" />
                            )}

                            {/* Bottom row: Price Reference */}
                            <span className={cn("text-[10px] font-mono tracking-tight leading-none", billDescColor)}>{billRef}</span>
                          </button>

                          {/* Step-by-Step Mathematical Flow Hover/Hold Tooltip */}
                          {v2Item && (
                            <div
                              className={cn(
                                "transition-all duration-150 ease-out z-[9999]",
                                "p-3.5 bg-popover/98 backdrop-blur-md text-popover-foreground rounded-2xl shadow-2xl border border-border text-left font-sans",
                                "fixed sm:absolute left-3 right-3 sm:left-auto sm:right-auto bottom-4 sm:bottom-auto sm:top-full sm:mt-1.5 w-auto sm:w-[350px] max-h-[85vh] sm:max-h-none overflow-y-auto",
                                isTooltipOpenOnMobile
                                  ? "opacity-100 visible pointer-events-auto ring-2 ring-primary/30"
                                  : "pointer-events-none opacity-0 invisible sm:group-hover:opacity-100 sm:group-hover:visible",
                                idx % 5 === 0
                                  ? "sm:left-0"
                                  : idx % 5 === 4
                                    ? "sm:right-0 sm:left-auto"
                                    : idx % 5 === 1
                                      ? "sm:left-0 sm:-left-4"
                                      : idx % 5 === 3
                                        ? "sm:right-0 sm:-right-4 sm:left-auto"
                                        : "sm:left-1/2 sm:-translate-x-1/2"
                              )}
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                <div className="flex items-center gap-1.5">
                                  <Zap size={14} className="text-amber-500 fill-amber-500/20" />
                                  <span className="font-bold text-xs text-foreground">{v2Item.commercialPackage}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className={cn(
                                    "text-[8.5px] px-2 py-0.5 rounded-full font-bold font-mono tracking-tight",
                                    v2Item.phase === '3-Phase'
                                      ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                                      : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                                  )}>
                                    {v2Item.electricalGrid}
                                  </span>
                                  {isTooltipOpenOnMobile && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setHoldTooltipKw(null)
                                      }}
                                      className="sm:hidden text-muted-foreground hover:text-foreground text-xs p-1 -mr-1 rounded-full hover:bg-secondary cursor-pointer"
                                      title="Close"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Section Title */}
                              <div className="mt-2 mb-1.5 flex items-center justify-between">
                                <span className="text-[10.5px] font-bold text-primary flex items-center gap-1">
                                  📐 Sizing & Derivation Flow
                                </span>
                                <span className="text-[8.5px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
                                  Tariff: ₱15.00/kWh
                                </span>
                              </div>

                              {/* 3-Stage Mathematical Flow */}
                              <div className="space-y-1.5 text-[10px]">
                                {/* Stage 1: Consumption */}
                                <div className="p-2 rounded-xl bg-secondary/50 border border-border/50 space-y-1">
                                  <div className="flex items-center justify-between text-[10.5px]">
                                    <span className="font-sans font-semibold text-foreground flex items-center gap-1.5">
                                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[8.5px]">1</span>
                                      Electric Bill Reference
                                    </span>
                                    <span className="font-mono font-bold text-primary">{minBillStr} ({v2Item.derivedElectricBill})</span>
                                  </div>
                                  <div className="text-[9px] font-mono text-muted-foreground flex justify-between pt-0.5 border-t border-border/30">
                                    <span>Monthly: <strong className="text-foreground">{monthlyKwh.toLocaleString()} kWh</strong> (÷ ₱15)</span>
                                    <span>Daily: <strong className="text-foreground">{dailyKwh} kWh/d</strong></span>
                                  </div>
                                </div>

                                {/* Stage 2: Sizing Derivation */}
                                <div className="p-2 rounded-xl bg-secondary/50 border border-border/50 space-y-1">
                                  <div className="flex items-center justify-between text-[10.5px]">
                                    <span className="font-sans font-semibold text-foreground flex items-center gap-1.5">
                                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[8.5px]">2</span>
                                      Target Solar Sizing
                                    </span>
                                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">~{targetOffsetPct}% Offset</span>
                                  </div>
                                  <div className="text-[9px] font-mono text-muted-foreground space-y-0.5 pt-0.5 border-t border-border/30">
                                    <div className="flex justify-between">
                                      <span>Target Solar Energy:</span>
                                      <span className="text-foreground font-semibold">{targetSolarGen} kWh/mo ({targetSolarGenDaily} kWh/d)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Required PV Capacity:</span>
                                      <span className="text-foreground font-semibold">{targetSolarGen} ÷ 98.28 = {requiredDcKwp} kWp</span>
                                    </div>
                                    <div className="flex justify-between pt-0.5 border-t border-border/20">
                                      <span>Panels Needed (620W):</span>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">ceil({requiredDcKwp} ÷ 0.62) = {panelsNeeded} Panels</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Stage 3: Actual Installed System & Result */}
                                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                                  <div className="flex items-center justify-between text-[10.5px]">
                                    <span className="font-sans font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[8.5px]">3</span>
                                      Installed Package Output
                                    </span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{actualDcKwp} kWp DC</span>
                                  </div>
                                  <div className="text-[9px] font-mono space-y-0.5 pt-0.5 border-t border-emerald-500/20">
                                    <div className="flex justify-between text-muted-foreground">
                                      <span>Actual Est. Generation:</span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{actualEstGen} kWh/month</span>
                                    </div>
                                    <div className="flex justify-between pt-0.5 border-t border-emerald-500/20 text-[10px]">
                                      <span className="text-muted-foreground font-medium font-sans">Final Solar Bill Offset:</span>
                                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">~{finalOffsetAchieved}% ({v2Item.targetSolarOffset})</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Backdrop for mobile hold dismiss */}
                  {holdTooltipKw !== null && (
                    <div
                      className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-xs transition-opacity duration-200"
                      onClick={() => setHoldTooltipKw(null)}
                      onTouchStart={() => setHoldTooltipKw(null)}
                    />
                  )}


                  {/* Presets */}
                  <div className="flex gap-2 w-full pt-0.5">
                    <Button
                      type="button"
                      variant={activePreset === 'min' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleApplyPreset('min')}
                      className={cn(
                        "text-[10px] font-bold py-1 px-2 rounded-[8px] transition-all h-7 flex-1 border border-border cursor-pointer",
                        activePreset === 'min'
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-transparent text-foreground hover:bg-secondary shadow-none"
                      )}
                    >
                      Min Panels
                    </Button>
                    <Button
                      type="button"
                      variant={activePreset === 'balance' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleApplyPreset('balance')}
                      className={cn(
                        "text-[10px] font-bold py-1 px-2 rounded-[8px] transition-all h-7 flex-1 border border-border cursor-pointer",
                        activePreset === 'balance'
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-transparent text-foreground hover:bg-secondary shadow-none"
                      )}
                    >
                      Standard Setup
                    </Button>
                    <Button
                      type="button"
                      variant={activePreset === 'max' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleApplyPreset('max')}
                      className={cn(
                        "text-[10px] font-bold py-1 px-2 rounded-[8px] transition-all h-7 flex-1 border border-border cursor-pointer",
                        activePreset === 'max'
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-transparent text-foreground hover:bg-secondary shadow-none"
                      )}
                    >
                      Max Panels
                    </Button>
                  </div>
                </div>


                {/* Client Location & Delivery Fee Calculator */}
                <div className="p-3.5 bg-card border border-border rounded-[16px] text-left space-y-3 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <Truck size={14} className="text-primary" />
                      <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                        Client Location & Delivery Fee Calculator
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground flex items-center gap-1">
                        <MapPin size={10} className="text-primary" /> Origin: Muntinlupa
                      </span>
                      <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        ₱5,000 (≤20km) + ₱100/km
                      </span>
                    </div>
                  </div>

                  {/* Search Field & Autocomplete Dropdown */}
                  <div className="relative" ref={locationDropdownRef}>
                    <div className="flex items-center rounded-[10px] border border-border bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary overflow-hidden shadow-2xs">
                      <div className="pl-3 text-muted-foreground">
                        <Search size={14} />
                      </div>
                      <input
                        type="text"
                        value={locationSearchQuery}
                        onChange={(e) => {
                          setLocationSearchQuery(e.target.value)
                          setIsLocationDropdownOpen(true)
                          if (!e.target.value.trim()) {
                            handleClearLocation()
                          }
                        }}
                        onFocus={() => setIsLocationDropdownOpen(true)}
                        placeholder="Search Barangay, City, Municipality, or Province (e.g. Alabang, Putatan, Calamba, Baguio)..."
                        className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-xs text-foreground outline-none font-medium placeholder:text-muted-foreground/60"
                      />
                      {(locationSearchQuery || selectedLocation) && (
                        <button
                          type="button"
                          onClick={handleClearLocation}
                          className="px-2.5 text-muted-foreground hover:text-foreground text-xs cursor-pointer select-none font-bold"
                          title="Clear selected location"
                        >
                          ✕
                        </button>
                      )}
                      {selectedLocation && (
                        <span className="bg-primary/10 text-primary border-l border-border px-2.5 py-2 text-[10px] font-mono font-bold shrink-0">
                          {selectedLocation.drivingDistanceKm} km · {formatCurrency(calculateDeliveryFee(selectedLocation.drivingDistanceKm), invoice.currency)}
                        </span>
                      )}
                    </div>

                    {/* Dropdown Menu */}
                    {isLocationDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-1 space-y-0.5">
                        {(() => {
                          const results = searchPhilippineLocations(locationSearchQuery, 25)
                          if (results.length === 0) {
                            return (
                              <div className="p-3 text-center text-xs text-muted-foreground font-medium">
                                No matching Philippine barangay, municipality, city, or province found.
                              </div>
                            )
                          }

                          return results.map((loc, idx) => {
                            const fee = calculateDeliveryFee(loc.drivingDistanceKm)
                            const isSelected = selectedLocation?.id === loc.id || (selectedLocation?.name === loc.name && selectedLocation?.province === loc.province && selectedLocation?.lguName === loc.lguName)
                            const isServiceable = loc.drivingDistanceKm <= SERVICEABLE_DISTANCE_KM
                            return (
                              <button
                                key={`${loc.id}-${loc.name}-${idx}`}
                                type="button"
                                onClick={() => handleApplyLocation(loc)}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-all cursor-pointer select-none",
                                  isSelected
                                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                    : "hover:bg-accent text-foreground"
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate">
                                      {loc.type === 'Barangay' ? `Brgy. ${loc.name}` : loc.name}
                                    </span>
                                    <span className={cn(
                                      "text-[9px] px-1.5 py-0.2 rounded font-normal shrink-0",
                                      isSelected
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : loc.type === 'Barangay'
                                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                          : loc.type === 'City'
                                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    )}>
                                      {loc.type}
                                    </span>
                                    <span className={cn(
                                      "text-[8.5px] px-1.5 py-0.2 rounded font-semibold shrink-0",
                                      isSelected
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : isServiceable
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                    )}>
                                      {isServiceable ? '✓ ≤50km Serviceable' : '⚠️ >50km Extended'}
                                    </span>
                                  </div>
                                  <p className={cn("text-[10px] truncate", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                    {loc.type === 'Barangay' ? `${loc.lguName}, ` : ''}{loc.province} · {loc.regionCode} ({loc.island})
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className={cn("font-mono font-bold text-xs", isSelected ? "text-primary-foreground" : "text-foreground")}>
                                    {formatCurrency(fee, invoice.currency)}
                                  </div>
                                  <p className={cn("text-[9.5px] font-mono", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                    {loc.drivingDistanceKm} km Driving Route
                                  </p>
                                </div>
                              </button>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Selected Location Summary & Formula Card */}
                  {selectedLocation && (
                    <div className="p-2.5 rounded-xl bg-secondary/40 border border-border space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <CheckCircle2 size={13} className="text-primary shrink-0" />
                          <span className="font-bold text-foreground truncate">
                            {selectedLocation.displayName}, {selectedLocation.province}
                          </span>
                          <span className={cn(
                            "text-[9.5px] px-1.5 py-0.5 rounded font-mono shrink-0",
                            selectedLocation.type === 'Barangay'
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-secondary text-muted-foreground"
                          )}>
                            {selectedLocation.type} · {selectedLocation.regionCode}
                          </span>
                          <span className={cn(
                            "text-[9.5px] px-2 py-0.5 rounded font-mono font-bold shrink-0 border",
                            selectedLocation.drivingDistanceKm <= SERVICEABLE_DISTANCE_KM
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25"
                          )}>
                            {selectedLocation.drivingDistanceKm <= SERVICEABLE_DISTANCE_KM
                              ? '✓ Serviceable Area (≤50km)'
                              : `⚠️ Exceeds 50km Service Area (+${(selectedLocation.drivingDistanceKm - SERVICEABLE_DISTANCE_KM).toFixed(1)}km)`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono font-bold text-primary text-xs">
                            {formatCurrency(calculateDeliveryFee(selectedLocation.drivingDistanceKm), invoice.currency)}
                          </div>
                          <button
                            type="button"
                            onClick={handleClearLocation}
                            className="text-[9.5px] text-muted-foreground hover:text-foreground hover:bg-secondary px-1.5 py-0.5 rounded border border-border/80 transition-all cursor-pointer select-none font-semibold"
                            title="Reset location and delivery fee to ₱5,000"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/50 text-[10px] font-mono">
                        <div>
                          <span className="text-muted-foreground block">Driving Distance:</span>
                          <span className="font-bold text-foreground">{selectedLocation.drivingDistanceKm} km (from Putatan)</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Rate Breakdown:</span>
                          <span className="text-foreground">
                            ₱5,000 (≤20km) {selectedLocation.drivingDistanceKm > 20 ? `+ ₱${((selectedLocation.drivingDistanceKm - 20) * 100).toLocaleString()} (${(selectedLocation.drivingDistanceKm - 20).toFixed(1)}km × ₱100)` : '(Base Rate)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Line Item Status:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ Applied to Delivery Fees
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <SectionHeader>Line Items</SectionHeader>
                </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Field label="Rate Markup %" onMouseEnter={() => setHoveredField('rateMarkup')} onMouseLeave={() => setHoveredField(null)}>
                        <Input
                          type="number"
                          min="-100"
                          max="1000"
                          value={invoice.rateMarkup === 0 ? '' : (invoice.rateMarkup ?? '')}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => update('rateMarkup', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          placeholder="25"
                        />
                      </Field>
                      <Field label="Price / Watt (₱)" onMouseEnter={() => setHoveredField('laborPricePerWatt')} onMouseLeave={() => setHoveredField(null)}>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={invoice.laborPricePerWatt === 0 ? '' : (invoice.laborPricePerWatt ?? 6)}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateLaborPricePerWatt(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          placeholder="6"
                        />
                      </Field>
                      <Field label="Discount (₱)" onMouseEnter={() => setHoveredField('discountAmount')} onMouseLeave={() => setHoveredField(null)}>
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          value={invoice.discountAmount === 0 || !invoice.discountAmount ? '' : invoice.discountAmount}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => update('discountAmount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field label="Rows (Array Rows)" onMouseEnter={() => setHoveredField('rowsCount')} onMouseLeave={() => setHoveredField(null)}>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={rowsCount}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateRows(Math.max(1, parseInt(e.target.value) || 1))}
                          placeholder="1"
                        />
                      </Field>
                    </div>



                <div className="flex justify-between items-center pt-2 border-t border-[#E5E5E5] mt-1 gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-[#888888] tracking-wider uppercase">
                    Quick Actions
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant={showMasterReconMatrix ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowMasterReconMatrix(!showMasterReconMatrix)}
                      className={cn(
                        "h-7 text-[9px] font-extrabold rounded-[6px] cursor-pointer transition-all select-none px-2 flex items-center gap-1",
                        showMasterReconMatrix
                          ? "bg-amber-600 text-white hover:bg-amber-700 border-amber-600 shadow-xs"
                          : "text-[#555555] hover:text-[#111111] hover:bg-[#EBEBEB] border-[#E5E5E5]"
                      )}
                      title="Toggle Master Specification Matrix and Pricing Reconciliation Notes"
                    >
                      📋 {showMasterReconMatrix ? "Hide Pricing Matrix" : "Pricing Reconciliation Matrix"}
                    </Button>

                    <Button
                      type="button"
                      variant={isSupplyMode ? "default" : "outline"}
                      size="sm"
                      onClick={handleToggleSupplyMode}
                      className={cn(
                        "h-7 text-[9px] font-extrabold rounded-[6px] cursor-pointer transition-all select-none px-2 flex items-center gap-1",
                        isSupplyMode
                          ? "bg-[#111111] text-white hover:bg-black/90 border-black"
                          : "text-[#555555] hover:text-[#111111] hover:bg-[#EBEBEB] border-[#E5E5E5]"
                      )}
                      title={isSupplyMode ? "Currently in Supply Only mode (labor items hidden). Click to return to Full Quotation view." : "Click to toggle Supply Only mode (filters physical supply items & hides labor)."}
                    >
                      {isSupplyMode ? "📦 [Supply Only: ON]" : "📦 [Supply Only]"}
                    </Button>

                    {systemType === 'hybrid' && (
                      <Button
                        type="button"
                        variant={invoice.excludeBattery ? "default" : "outline"}
                        size="sm"
                        onClick={handleToggleBatteryExclusion}
                        className={cn(
                          "h-7 text-[9px] font-extrabold rounded-[6px] cursor-pointer transition-all select-none px-2",
                          invoice.excludeBattery
                            ? "bg-black text-white hover:bg-black/90 border-black"
                            : "text-[#555555] hover:text-[#111111] hover:bg-[#EBEBEB] border-[#E5E5E5]"
                        )}
                        title={invoice.excludeBattery ? "Include battery items in the invoice again" : "Temporarily exclude battery items from the invoice"}
                      >
                        {invoice.excludeBattery ? "➕ INCLUDE BATTERY" : "➖ EXCLUDE BATTERY"}
                      </Button>
                    )}
                  </div>
                </div>

                {showMasterReconMatrix && (
                  <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-[12px] border border-amber-500/30 space-y-3 animate-in fade-in duration-200 text-[11px]">
                    <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                          ⚡ Master System Sizing & Pricing Reconciliation (3kW – 16kW)
                        </span>
                      </div>
                      <span className="text-[9px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                        Internal Standard Guidelines (Excluded from Customer Preview)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">1. Flexible Hose 32mm HDPE</span>
                        <p className="text-muted-foreground leading-relaxed">
                          32mm standard for 3kW–8kW (25m for ≤6kW, 50m for 8kW) priced at <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₱95.00/m</span>. 40mm standard for ≥10kW (50m) priced at <span className="font-mono font-bold text-foreground">₱124.00/m</span>.
                        </p>
                      </div>

                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">2. Breaker Box / Enclosure</span>
                        <p className="text-muted-foreground leading-relaxed">
                          Downsized from 50x60 (₱3,000) to <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">50x40 @ ₱1,500.00</span> for 3kW & 4kW packages. 5kW+ uses standard 50x60 enclosure @ ₱3,000.00.
                        </p>
                      </div>

                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">3. AC Breakers (MCB vs MCCB)</span>
                        <p className="text-muted-foreground leading-relaxed">
                          Updated from generic 4x MCCB to proper tier ratings: <span className="font-mono font-bold text-foreground">80A MCB @ ₱450</span> (3k–4k, 2 pcs), <span className="font-mono font-bold text-foreground">100A MCB @ ₱500</span> (5k–6k, 2 pcs), <span className="font-mono font-bold text-foreground">125A MCB @ ₱500</span> (8k, 2 pcs), <span className="font-mono font-bold text-foreground">AC MCCB @ ₱1,300</span> (10k–12k, 4 pcs), and for 16kW distinct split <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">AC MCCB 100A (2 pcs) + AC MCCB 125A (2 pcs) @ ₱1,300/pc</span> so they are never mixed up.
                        </p>
                      </div>

                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">4. Automatic Transfer Switch (ATS)</span>
                        <p className="text-muted-foreground leading-relaxed">
                          Scaled unit price: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">63A Taxnelle @ ₱1,500</span> (3k–4k), <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">125A @ ₱2,000</span> (5k–8k), and <span className="font-mono font-bold text-foreground">125A Heavy-Duty @ ₱4,000</span> (10k–16k).
                        </p>
                      </div>

                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">5. Battery Unit Capacity</span>
                        <p className="text-muted-foreground leading-relaxed">
                          Default hybrid storage downsized to <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">51.2V 100Ah @ ₱38,000.00</span> for 3k–5k systems, 200Ah @ ₱65,000 for 6k, and 314Ah @ ₱88,000 for 8k–16k.
                        </p>
                      </div>

                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">6. Battery Cable Heavy-Duty Gauge</span>
                        <p className="text-muted-foreground leading-relaxed">
                          Standard 50mm² @ ₱700/m (6m for 3k–6k, 10m for 8k–12k). 16kW upgraded to <span className="font-mono font-bold text-purple-600 dark:text-purple-400">70mm² @ ₱820/m (10m)</span>.
                        </p>
                      </div>

                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">7. Tier Deletions (3k–6k)</span>
                        <p className="text-muted-foreground leading-relaxed">
                          <span className="font-bold text-rose-600 dark:text-rose-400">Deleted</span> 25mm Terminal Lugs (0 pcs in 3k–6k, 36 pcs in 8k+) and Terminal Block (0 pcs across standard packages).
                        </p>
                      </div>

                      <div className="p-2 rounded-md bg-background/80 border border-border/60 space-y-1">
                        <span className="font-bold text-foreground block">8. Scaled Quantities & Grounding</span>
                        <p className="text-muted-foreground leading-relaxed">
                          50mm Lugs: 8 (3k–6k), 16 (8k–10k), 20 (12k–16k). MC4: 4 (3k–5k), 10 (6k), 15 (8k+). Ground Rod: 1 pc (3k–12k), 2 pcs (16kW).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isSupplyMode && (
                  <div className="p-3 bg-secondary/50 rounded-[12px] border border-border space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={13} /> Supply Only Mode Active
                      </span>
                      <span className="text-[9px] font-semibold text-muted-foreground">
                        Labor items filtered out
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                      <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={supplySearchQuery}
                          onChange={(e) => setSupplySearchQuery(e.target.value)}
                          placeholder="Filter supplied items by name…"
                          className="pl-7 h-7 text-[11px]"
                        />
                        {supplySearchQuery && (
                          <button
                            onClick={() => setSupplySearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px] font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'equipment', label: 'Equipment' },
                          { id: 'mounting', label: 'Mounting' },
                          { id: 'electrical', label: 'Electrical' },
                          { id: 'grounding', label: 'Grounding' },
                        ].map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSupplyCategoryFilter(cat.id as any)}
                            className={cn(
                              "px-2 py-0.5 rounded-[6px] text-[9px] font-bold transition-all cursor-pointer whitespace-nowrap border select-none",
                              supplyCategoryFilter === cat.id
                                ? "bg-foreground text-background border-foreground shadow-xs"
                                : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-2">
                  {/* Column headers */}
                  <div className="flex gap-2 px-1">
                    <span className="flex-1 text-[11px] font-medium text-[#888888]">Description</span>
                    <span className="w-12 text-[11px] font-medium text-[#888888] text-center">Unit</span>
                    <span className="w-10 text-[11px] font-medium text-[#888888] text-center">Qty</span>
                    <span className="w-[72px] text-[11px] font-medium text-[#888888] text-right" title={invoice.rateMarkup ? `Markup of ${invoice.rateMarkup}% is active` : undefined}>
                      Rate{invoice.rateMarkup ? ` (${invoice.rateMarkup > 0 ? '+' : ''}${invoice.rateMarkup}%)` : ''}
                    </span>
                    <span className="w-5" />
                  </div>

                  {/* Item rows */}
                  {(() => {
                    const currentSystemKw = getInverterKwFromLineItems(invoice.lineItems)
                    return invoice.lineItems
                    .filter((item) => {
                      if (invoice.excludeBattery && isBatteryItem(item.description)) return false
                      if (isSupplyMode) {
                        if (isLaborItem(item.description)) return false
                        const matchesSearch = !supplySearchQuery || item.description.toLowerCase().includes(supplySearchQuery.toLowerCase())
                        if (!matchesSearch) return false
                        const cat = getSupplyCategory(item.description)
                        if (supplyCategoryFilter === 'equipment' && cat.key !== 'equipment') return false
                        if (supplyCategoryFilter === 'mounting' && cat.key !== 'mounting') return false
                        if (supplyCategoryFilter === 'electrical' && cat.key !== 'electrical') return false
                        if (supplyCategoryFilter === 'grounding' && cat.key !== 'grounding') return false
                      }
                      return true
                    })
                    .map((item) => {
                      const descLower = item.description.toLowerCase()
                      const reconInfo = getPricingReconciliationNote(item, currentSystemKw)

                      const isBatteryItemRow = isBatteryUnit(item.description)
                      const isPanelItem = !isBatteryItemRow && (descLower.includes('panel') || descLower.includes('module') || descLower.includes('ja solar') || descLower.includes('tongwei') || descLower.includes('runergy') || descLower.includes('jinko') || descLower.includes('gokin') || descLower.includes('longi') || descLower.includes('ian solar'))
                      const isTongweiSelected = item.rate === 5456

                      const isInverterItem = !isBatteryItemRow && !isPanelItem && (descLower.includes('inverter') || descLower.includes('anern') || descLower.includes('solis') || descLower.includes('goodwe') || descLower.includes('hypontech') || descLower.includes('solax') || descLower.includes('foxess') || descLower.includes('sunways') || descLower.includes('deye') || descLower.includes('sungrow'))
                      const kwMatch = item.description.match(/(\d+(?:\.\d+)?)\s*kw/i)
                      const itemKw = kwMatch ? parseFloat(kwMatch[1]) : 12
                      const invBrandPrices = getInverterBrandPrices(itemKw)

                      const isItemOnGrid = descLower.includes('on-grid') || systemType === 'ongrid'

                      const isInverterAnern = item.rate === invBrandPrices.anern
                      const isInverterGoodWe = item.rate === invBrandPrices.goodwe
                      const isInverterSolis = item.rate === invBrandPrices.solis || (!isInverterAnern && !isInverterGoodWe)

                      let genixPrice = 85000
                      if (descLower.includes('200ah')) {
                        genixPrice = 65000
                      } else if (descLower.includes('102.4v') || descLower.includes('100ah')) {
                        genixPrice = 90000
                      }

                      let dynessPrice = 43000
                      if (descLower.includes('314ah')) {
                        dynessPrice = 88000
                      }

                      let cescPrice = 88000
                      if (descLower.includes('261') || descLower.includes('power')) {
                        cescPrice = 2400000
                      }

                      let oliterPrice = 70000

                      let alpsolarPrice = 93000
                      if (descLower.includes('200ah') || descLower.includes('10.24kwh')) {
                        alpsolarPrice = 70000
                      }

                      let deyePrice = 125000

                      let goodwePrice = 120000

                      let ubetterPrice = 138000

                      const isGoodweSelected = item.rate === goodwePrice || (descLower.includes('goodwe') && isBatteryItemRow)
                      const isDeyeSelected = item.rate === deyePrice || descLower.includes('deye')
                      const isGenixSelected = item.rate === genixPrice
                      const isDynessSelected = item.rate === dynessPrice
                      const isOliterSelected = item.rate === oliterPrice || descLower.includes('oliter')
                      const isAlpsolarSelected = item.rate === alpsolarPrice || descLower.includes('alpsolar')
                      const isUbetterSelected = item.rate === ubetterPrice || descLower.includes('ubetter')
                      const isCescSelected = item.rate === cescPrice || (!isGoodweSelected && !isDeyeSelected && !isGenixSelected && !isDynessSelected && !isOliterSelected && !isAlpsolarSelected && !isUbetterSelected)

                      const activeBrand: 'goodwe' | 'deye' | 'genix' | 'dyness' | 'oliter' | 'alpsolar' | 'cesc' | 'ubetter' = isGoodweSelected ? 'goodwe' : isDeyeSelected ? 'deye' : isGenixSelected ? 'genix' : isDynessSelected ? 'dyness' : isOliterSelected ? 'oliter' : isAlpsolarSelected ? 'alpsolar' : isUbetterSelected ? 'ubetter' : 'cesc'

                      const pricingInfo = getItemPricingInfo(item.description, item)

                      return (
                        <div key={item.id} className="flex flex-col gap-1 p-1.5 rounded-lg hover:bg-[#F9F9F9] dark:hover:bg-[#1A1A1A] transition-colors border border-transparent hover:border-[#E5E5E5] dark:hover:border-[#333333]" onMouseEnter={() => setHoveredField(item.id)} onMouseLeave={() => setHoveredField(null)}>
                          <div className="flex gap-2 items-start">
                            <div className="relative flex-1 flex items-center">
                              <Input
                                className="w-full"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Item description"
                              />
                            </div>
                            {isLaborItem(item.description) || descLower.includes('delivery') || descLower.includes('freight') ? (
                              <div className="w-[96px] shrink-0 text-center text-[11px] font-mono text-muted-foreground self-center py-1 bg-secondary/30 rounded border border-dashed border-border/50">
                                —
                              </div>
                            ) : (
                              <>
                                <Input
                                  className="w-12 px-1 text-center"
                                  value={item.unit || ''}
                                  onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                  placeholder="pcs"
                                />
                                <Input
                                  className="w-10 px-0 text-center"
                                  type="number"
                                  min="0"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                  placeholder="0"
                                />
                              </>
                            )}
                            <div className="flex flex-col items-end w-[72px] shrink-0">
                              <Input
                                className="w-full px-2 text-right"
                                type="number"
                                min="0"
                                value={item.rate === 0 ? '' : item.rate}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateItem(item.id, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                placeholder="0"
                              />
                              {invoice.rateMarkup !== 0 && (
                                <span className="text-[9px] font-mono text-[#888888] text-right mt-0.5 w-full truncate" title={
                                  isDeliveryItem(item.description)
                                    ? 'Delivery is a flat logistics fee (0% rate markup)'
                                    : (invoice.excludeLaborMarkup && isLaborItem(item.description))
                                      ? 'Labor is excluded from rate markup'
                                      : `Base: ${item.rate} + ${invoice.rateMarkup}%`
                                }>
                                  {formatCurrency(
                                    (isDeliveryItem(item.description) || (invoice.excludeLaborMarkup && isLaborItem(item.description)))
                                      ? item.rate
                                      : item.rate * (1 + invoice.rateMarkup / 100),
                                    invoice.currency
                                  )}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => removeItem(item.id)}
                              className="text-[#CCCCCC] hover:text-[#888888] hover:bg-transparent shrink-0 mt-[4px]"
                              aria-label="Remove item"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>

                          {isPanelItem && (() => {
                            const wattMatch = item.description.match(/(\d{3})\s*w/i)
                            const currentWattage = wattMatch ? `${wattMatch[1]}W` : null

                            const storedBrand = selectedPanelBrands[item.id]
                            let activeBrandId = storedBrand

                            if (!activeBrandId || !SOLAR_PANEL_BRANDS.some(b => b.id === activeBrandId)) {
                              if (descLower.includes('gokin')) {
                                activeBrandId = 'gokin'
                              } else if (descLower.includes('ian')) {
                                activeBrandId = 'ian'
                              } else if (descLower.includes('runergy')) {
                                activeBrandId = 'runergy'
                              } else if (descLower.includes('jinko')) {
                                activeBrandId = 'jinko'
                              } else if (descLower.includes('longi')) {
                                activeBrandId = 'longi'
                              } else if (descLower.includes('tongwei')) {
                                activeBrandId = 'tongwei'
                              } else if (descLower.includes('ja')) {
                                activeBrandId = 'ja'
                              } else if (item.rate === 7700) {
                                activeBrandId = 'jinko'
                              } else if (item.rate === 6500) {
                                activeBrandId = 'longi'
                              } else if ([5456, 5500, 5544, 6336, 6380, 6424].includes(item.rate)) {
                                activeBrandId = 'tongwei'
                              } else if ([6400, 6300, 6900].includes(item.rate)) {
                                activeBrandId = 'ja'
                              } else {
                                activeBrandId = 'tongwei'
                              }
                            }

                            const activeBrandObj = SOLAR_PANEL_BRANDS.find(b => b.id === activeBrandId) || SOLAR_PANEL_BRANDS[0]

                            let activeWattage = currentWattage
                            if (!activeWattage) {
                              const matchedOpt = activeBrandObj.options.find(o => o.rate === item.rate)
                              activeWattage = matchedOpt ? matchedOpt.wattage : activeBrandObj.options[0].wattage
                            }

                            const applyPanelSelection = (brandObj: PanelBrandOption, option: PanelOption) => {
                              setSelectedPanelBrands(prev => ({ ...prev, [item.id]: brandObj.id }))
                              const dims = getPanelDimensions(option.wattage)
                              updateItem(item.id, 'description', `${brandObj.name} Panel ${option.wattage} (${dims})`)
                              updateItem(item.id, 'rate', option.rate)
                            }

                            return (
                              <div className="flex flex-col gap-2 pt-1.5 pb-1 px-0.5 border-t border-dashed border-[#E5E5E5] dark:border-[#333333] mt-1.5">
                                {/* 1. Brand Selector Row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] uppercase font-semibold text-[#888888] mr-1">Brand:</span>
                                  {SOLAR_PANEL_BRANDS.map((b) => {
                                    const isSelected = activeBrandId === b.id
                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => {
                                          const targetOpt = b.options.find(o => o.wattage === activeWattage) || b.options[0]
                                          applyPanelSelection(b, targetOpt)
                                        }}
                                        className={cn(
                                          "flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer select-none min-h-[34px]",
                                          isSelected
                                            ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 shadow-sm"
                                            : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                        )}
                                        title={`${b.name} Solar Panels`}
                                      >
                                        {b.logo ? (
                                          <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[80px] object-contain shrink-0" />
                                        ) : (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 text-foreground">{b.name}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>

                                {/* 2. Wattage Chooser Buttons Row */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-dotted border-[#E5E5E5] dark:border-[#333333]">
                                  <span className="text-[10px] uppercase font-semibold text-[#888888] mr-1">Wattage:</span>
                                  {activeBrandObj.options.map((opt) => {
                                    const isWattageSelected = (currentWattage === opt.wattage || activeWattage === opt.wattage) && item.rate === opt.rate
                                    return (
                                      <button
                                        key={opt.wattage}
                                        type="button"
                                        onClick={() => applyPanelSelection(activeBrandObj, opt)}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          isWattageSelected
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                                        )}
                                        title={`${opt.wattage} - ₱${opt.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })} each`}
                                      >
                                        {opt.wattage}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {isInverterItem && (
                            <div className="flex flex-col gap-1.5 pt-1.5 pb-1 px-0.5 border-t border-dashed border-[#E5E5E5] dark:border-[#333333] mt-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Inverter Options ({isItemOnGrid ? 'On-Grid' : 'Hybrid'})
                                </span>
                                <div className="flex gap-1 bg-secondary/60 p-0.5 rounded-[6px] border border-border">
                                  <button
                                    type="button"
                                    disabled={!HYBRID_BRANDS.some(b => b.getPrice(itemKw) !== null)}
                                    onClick={() => {
                                      handleSystemTypeChange('hybrid', itemKw)
                                    }}
                                    className={cn(
                                      "text-[8px] font-bold px-1.5 py-0.5 rounded-[4px] transition-all select-none",
                                      !HYBRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? "opacity-40 cursor-not-allowed pointer-events-none text-muted-foreground"
                                        : !isItemOnGrid
                                          ? "bg-primary text-primary-foreground shadow-xs cursor-pointer"
                                          : "text-muted-foreground hover:text-foreground cursor-pointer"
                                    )}
                                    title={
                                      !HYBRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? `Hybrid is not available for ${itemKw}kW setup`
                                        : undefined
                                    }
                                  >
                                    ⚡ Hybrid
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!ON_GRID_BRANDS.some(b => b.getPrice(itemKw) !== null)}
                                    onClick={() => {
                                      handleSystemTypeChange('ongrid', itemKw)
                                    }}
                                    className={cn(
                                      "text-[8px] font-bold px-1.5 py-0.5 rounded-[4px] transition-all select-none",
                                      !ON_GRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? "opacity-40 cursor-not-allowed pointer-events-none text-muted-foreground"
                                        : isItemOnGrid
                                          ? "bg-primary text-primary-foreground shadow-xs cursor-pointer"
                                          : "text-muted-foreground hover:text-foreground cursor-pointer"
                                    )}
                                    title={
                                      !ON_GRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? `On-Grid is not available for ${itemKw}kW setup`
                                        : undefined
                                    }
                                  >
                                    🌐 On-Grid
                                  </button>
                                </div>
                              </div>

                              {isItemOnGrid ? (
                                <div className="inline-flex gap-1.5 items-center flex-wrap">
                                  {ON_GRID_BRANDS.map((b) => {
                                    const brandPrice = b.getPrice(itemKw)
                                    const isApplicable = brandPrice !== null
                                    const isSelected = isApplicable && item.rate === brandPrice

                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        disabled={!isApplicable}
                                        onClick={() => {
                                          if (!isApplicable) return
                                          const isCurrentlyOnGrid = systemType === 'ongrid' || isItemOnGrid
                                          if (!isCurrentlyOnGrid) {
                                            handleSystemTypeChange('ongrid', itemKw)
                                          }
                                          updateItem(item.id, 'rate', brandPrice)
                                          updateItem(item.id, 'description', `${b.name} Inverter ${itemKw}kW On-Grid`)
                                        }}
                                        className={cn(
                                          "flex items-center justify-center p-2 rounded-lg border transition-all select-none min-h-[36px]",
                                          !isApplicable
                                            ? "opacity-30 bg-secondary/30 border-border cursor-not-allowed pointer-events-none grayscale"
                                            : isSelected
                                              ? "bg-primary/10 dark:bg-primary/20 border-primary ring-2 ring-primary/40 shadow-sm cursor-pointer"
                                              : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100 cursor-pointer"
                                        )}
                                        title={
                                          isApplicable
                                            ? `${b.name} - ₱${brandPrice.toLocaleString()} each`
                                            : `${b.name} - Not available for ${itemKw}kW setup`
                                        }
                                      >
                                        {b.logo ? (
                                          <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[90px] object-contain shrink-0" />
                                        ) : (
                                          <span className="text-[10px] font-bold px-1">{b.name}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="inline-flex gap-1.5 items-center flex-wrap">
                                  {HYBRID_BRANDS.map((b) => {
                                    const brandPrice = b.getPrice(itemKw)
                                    const isApplicable = brandPrice !== null
                                    const isSelected = isApplicable && (item.rate === brandPrice || descLower.includes(b.id))

                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        disabled={!isApplicable}
                                        onClick={() => {
                                          if (!isApplicable) return
                                          const isCurrentlyHybrid = systemType === 'hybrid' && !isItemOnGrid
                                          if (!isCurrentlyHybrid) {
                                            handleSystemTypeChange('hybrid', itemKw)
                                          }
                                          updateItem(item.id, 'rate', brandPrice)
                                          updateItem(item.id, 'description', itemKw === 20 && b.id === 'goodwe' ? 'GoodWe Inverter 20kW Hybrid (3-Phase LV)' : `${b.name} Inverter ${itemKw}kW Hybrid`)
                                        }}
                                        className={cn(
                                          "flex items-center justify-center p-2 rounded-lg border transition-all select-none min-h-[36px]",
                                          !isApplicable
                                            ? "opacity-30 bg-secondary/30 border-border cursor-not-allowed pointer-events-none grayscale"
                                            : isSelected
                                              ? "bg-primary/10 dark:bg-primary/20 border-primary ring-2 ring-primary/40 shadow-sm cursor-pointer"
                                              : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100 cursor-pointer"
                                        )}
                                        title={
                                          isApplicable
                                            ? `${b.name} - ₱${brandPrice.toLocaleString()} each`
                                            : `${b.name} - Not available for ${itemKw}kW hybrid setup`
                                        }
                                      >
                                        {b.logo ? (
                                          <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[90px] object-contain shrink-0" />
                                        ) : (
                                          <span className="text-[10px] font-bold px-1">{b.name}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {isBatteryItemRow && (() => {
                            let capKey: '100Ah' | '200Ah' | '314Ah' | '410Ah' | '261kW' = '314Ah'
                            if (descLower.includes('261') || descLower.includes('power')) {
                              capKey = '261kW'
                            } else if (descLower.includes('410ah')) {
                              capKey = '410Ah'
                            } else if (descLower.includes('200ah')) {
                              capKey = '200Ah'
                            } else if (descLower.includes('100ah') || descLower.includes('102.4v')) {
                              capKey = '100Ah'
                            }

                            let activeBrand: 'goodwe' | 'deye' | 'genix' | 'dyness' | 'cesc' | 'oliter' | 'alpsolar' | 'ubetter' = 'cesc'
                            if (descLower.includes('goodwe') || item.rate === 120000) {
                              activeBrand = 'goodwe'
                            } else if (descLower.includes('deye') || item.rate === 125000) {
                              activeBrand = 'deye'
                            } else if (descLower.includes('oliter')) {
                              activeBrand = 'oliter'
                            } else if (descLower.includes('alpsolar') || descLower.includes('alp solar')) {
                              activeBrand = 'alpsolar'
                            } else if (descLower.includes('ubetter') || item.rate === 138000) {
                              activeBrand = 'ubetter'
                            } else if (descLower.includes('genix') || item.rate === 38000 || item.rate === 65000 || item.rate === 85000) {
                              activeBrand = 'genix'
                            } else if (descLower.includes('dyness') || item.rate === 43000 || item.rate === 111000) {
                              activeBrand = 'dyness'
                            } else if (descLower.includes('cesc') || item.rate === 2400000 || item.rate === 88000) {
                              activeBrand = 'cesc'
                            }

                            const getGenixData = (cap: typeof capKey) => {
                              if (cap === '200Ah') return { desc: 'Genix Battery 51.2V 200Ah', rate: 65000 }
                              if (cap === '100Ah') return { desc: 'Genix Battery 51.2V 100Ah', rate: 38000 }
                              return { desc: 'Genix Battery 51.2V 314Ah', rate: 85000 }
                            }

                            const getDynessData = (cap: typeof capKey) => {
                              if (cap === '314Ah') return { desc: 'Dyness Battery 51.2V 314Ah', rate: 111000 }
                              return { desc: 'Dyness Battery 51.2V 100Ah', rate: 43000 }
                            }

                            const getCescData = (cap: typeof capKey) => {
                              if (cap === '261kW') return { desc: 'CESC Battery 261 kW Power System', rate: 2400000 }
                              return { desc: 'CESC Battery 51.2V 314Ah', rate: 88000 }
                            }

                            const getDeyeData = (cap: typeof capKey) => {
                              return { desc: 'DEYE 51.2V 314AH Battery', rate: 125000 }
                            }

                            const getGoodweData = (cap: typeof capKey) => {
                              return { desc: 'Goodwe Lithium Battery 16.1kWh 314Ah (51.2V)', rate: 120000 }
                            }

                            const getOliterData = (cap: typeof capKey) => {
                              return { desc: 'Oliter 10.24kWh 200Ah Lithium Battery', rate: 70000 }
                            }

                            const getAlpsolarData = (cap: typeof capKey) => {
                              if (cap === '314Ah') return { desc: 'Alpsolar 16.07kWh 314Ah Lithium Battery', rate: 93000 }
                              return { desc: 'Alpsolar 10.24kWh 200Ah Lithium Battery', rate: 70000 }
                            }

                            const getUbetterData = (cap: typeof capKey) => {
                              return { desc: 'Ubetter Battery 48V 410Ah', rate: 138000 }
                            }

                            const applySelection = (newDesc: string, newRate: number) => {
                              updateItem(item.id, 'description', newDesc)
                              updateItem(item.id, 'rate', newRate)
                            }

                            return (
                              <div className="flex flex-col gap-2 pt-1.5 pb-1 px-0.5 border-t border-dashed border-[#E5E5E5] dark:border-[#333333] mt-1.5">
                                {/* 1. Brand Selector Row (Primary Control) */}
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cap = (capKey === '261kW' || capKey === '410Ah') ? '314Ah' : capKey
                                      const data = getGenixData(cap)
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'genix'
                                        ? "bg-green-500/15 border-green-500 ring-2 ring-green-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="Genix Green Battery"
                                  >
                                    <img src="/genixgreen.svg" alt="Genix Green" className="h-8 w-auto object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cap = (capKey === '200Ah' || capKey === '261kW' || capKey === '410Ah') ? '314Ah' : capKey
                                      const data = getDynessData(cap)
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'dyness'
                                        ? "bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="Dyness Battery"
                                  >
                                    <img src="/dyness.svg" alt="Dyness" className="h-8 w-auto object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cap = (capKey === '100Ah' || capKey === '200Ah' || capKey === '410Ah') ? '314Ah' : capKey
                                      const data = getCescData(cap)
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'cesc'
                                        ? "bg-purple-500/15 border-purple-500 ring-2 ring-purple-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="CESC Battery"
                                  >
                                    <img src="/cesc.svg" alt="CESC" className="h-8 w-auto object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const data = getOliterData('200Ah')
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'oliter'
                                        ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="Oliter Battery"
                                  >
                                    <img src="/Oliter.svg" alt="Oliter" className="h-8 w-auto max-w-[80px] object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const data = getDeyeData('314Ah')
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'deye'
                                        ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="DEYE Battery"
                                  >
                                    <img src="/deye.svg" alt="DEYE" className="h-8 w-auto max-w-[80px] object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const data = getGoodweData('314Ah')
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'goodwe'
                                        ? "bg-red-500/15 border-red-500 ring-2 ring-red-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="GoodWe Battery"
                                  >
                                    <img src="/goodwe.svg" alt="GoodWe" className="h-8 w-auto max-w-[80px] object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cap = capKey === '314Ah' ? '314Ah' : '200Ah'
                                      const data = getAlpsolarData(cap)
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'alpsolar'
                                        ? "bg-cyan-500/15 border-cyan-500 ring-2 ring-cyan-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="Alpsolar Battery"
                                  >
                                    <img src="/AlpSolarr.svg" alt="Alpsolar" className="h-8 w-auto max-w-[80px] object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const data = getUbetterData('410Ah')
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'ubetter'
                                        ? "bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/40 shadow-sm"
                                        : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 opacity-75 hover:opacity-100"
                                    )}
                                    title="Ubetter Battery"
                                  >
                                    <img src="/Ubetter.svg" alt="Ubetter" className="h-8 w-auto max-w-[80px] object-contain shrink-0" />
                                  </button>
                                </div>

                                {/* 2. Available Capacity Buttons for Selected Brand */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-dotted border-[#E5E5E5] dark:border-[#333333]">
                                  <span className="text-[10px] uppercase font-semibold text-[#888888] mr-1">Capacity:</span>

                                  {/* DEYE Capacities */}
                                  {activeBrand === 'deye' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const data = getDeyeData('314Ah')
                                        applySelection(data.desc, data.rate)
                                      }}
                                      className={cn(
                                        "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                      )}
                                      title="314Ah - ₱125,000.00"
                                    >
                                      314Ah
                                    </button>
                                  )}

                                  {/* GoodWe Capacities */}
                                  {activeBrand === 'goodwe' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const data = getGoodweData('314Ah')
                                        applySelection(data.desc, data.rate)
                                      }}
                                      className={cn(
                                        "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                      )}
                                      title="314Ah - ₱120,000.00"
                                    >
                                      314Ah
                                    </button>
                                  )}

                                  {/* Oliter Capacities */}
                                  {activeBrand === 'oliter' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const data = getOliterData('200Ah')
                                        applySelection(data.desc, data.rate)
                                      }}
                                      className={cn(
                                        "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                      )}
                                      title="200Ah - ₱70,000.00"
                                    >
                                      200Ah
                                    </button>
                                  )}

                                  {/* Alpsolar Capacities */}
                                  {activeBrand === 'alpsolar' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getAlpsolarData('200Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '200Ah' || capKey !== '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="200Ah - ₱70,000.00"
                                      >
                                        200Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getAlpsolarData('314Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="314Ah - ₱93,000.00"
                                      >
                                        314Ah
                                      </button>
                                    </>
                                  )}

                                  {/* Genix Green Capacities */}
                                  {activeBrand === 'genix' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getGenixData('100Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '100Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="100Ah - ₱38,000.00"
                                      >
                                        100Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getGenixData('200Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '200Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="200Ah - ₱65,000.00"
                                      >
                                        200Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getGenixData('314Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="314Ah - ₱85,000.00"
                                      >
                                        314Ah
                                      </button>
                                    </>
                                  )}

                                  {/* Dyness Capacities */}
                                  {activeBrand === 'dyness' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getDynessData('100Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '100Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="100Ah - ₱43,000.00"
                                      >
                                        100Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getDynessData('314Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="314Ah - ₱111,000.00"
                                      >
                                        314Ah
                                      </button>
                                    </>
                                  )}

                                  {/* CESC Capacities */}
                                  {activeBrand === 'cesc' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getCescData('314Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="314Ah - ₱88,000.00"
                                      >
                                        314Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getCescData('261kW')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '261kW'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="261kW - ₱2,400,000.00"
                                      >
                                        261kW
                                      </button>
                                    </>
                                  )}

                                  {/* Ubetter Capacities */}
                                  {activeBrand === 'ubetter' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const data = getUbetterData('410Ah')
                                        applySelection(data.desc, data.rate)
                                      }}
                                      className={cn(
                                        "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                      )}
                                      title="410Ah - ₱138,000.00"
                                    >
                                      410Ah
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })()}

                        </div>
                      )
                    })
                  })()}

                  {/* Add item */}
                  <Button
                    variant="outline"
                    onClick={handleAddItem}
                    className="w-full h-[34px] border-dashed border-[#CCCCCC] text-[12px] font-medium text-[#888888] hover:border-[#888888] hover:text-[#555555] hover:bg-transparent mt-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    Add item
                  </Button>

                  {/* Scope of Equipment & Works Editor */}
                  <div className="mt-8 pt-5 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-primary" />
                        <SectionHeader>Scope of Equipment & Works</SectionHeader>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetScopes}
                        className="h-7 text-[10px] font-bold text-muted-foreground hover:text-foreground px-2 cursor-pointer"
                        title="Sync & reset to auto-generated scope from line items"
                      >
                        Sync from Items
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Customize the structured equipment specifications, mounting materials, electrical protection, and engineering scope shown in the proposal.
                    </p>

                    <div className="space-y-3">
                      {getSafeScopes().map((s, idx) => (
                        <div
                          key={s.id || idx}
                          className="p-3 rounded-[10px] bg-secondary/30 border border-border hover:border-primary/40 transition-all space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              className="w-10 text-center font-bold text-xs h-8 bg-background uppercase shrink-0"
                              value={s.letter || String.fromCharCode(65 + idx)}
                              onChange={(e) => updateScope(s.id, 'letter', e.target.value)}
                              placeholder="A"
                            />
                            <Input
                              className="flex-1 text-xs h-8 font-bold bg-background"
                              value={s.title}
                              onChange={(e) => updateScope(s.id, 'title', e.target.value)}
                              placeholder="Category Title (e.g. Solar Panels, Solar Inverter...)"
                            />
                            <Input
                              className="flex-1 text-xs h-8 font-medium text-foreground bg-background"
                              value={s.subtitle || ''}
                              onChange={(e) => updateScope(s.id, 'subtitle', e.target.value)}
                              placeholder="Item / Spec (e.g. 5x Tongwei 620W N-Type PV Modules)"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleRemoveScope(s.id)}
                              className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer h-7 w-7"
                              title="Remove scope item"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>

                          <div>
                            <textarea
                              className="w-full text-[11px] p-2 rounded-[6px] border border-border bg-background text-foreground leading-relaxed resize-y min-h-[44px] focus:outline-hidden focus:ring-1 focus:ring-primary font-sans"
                              value={s.description || ''}
                              onChange={(e) => updateScope(s.id, 'description', e.target.value)}
                              placeholder="Detailed scope description / specifications..."
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddScope}
                      className="w-full h-8 border-dashed border-border text-[11px] font-bold text-muted-foreground hover:border-primary hover:text-foreground mt-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      Add Scope Item
                    </Button>
                  </div>

                  {/* Warranty Coverage Editor */}
                  <div className="mt-8 pt-5 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-primary" />
                        <SectionHeader>Warranty Coverage</SectionHeader>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetWarranties}
                        className="h-7 text-[10px] font-bold text-muted-foreground hover:text-foreground px-2 cursor-pointer"
                        title="Reset to default warranty coverage"
                      >
                        Reset Defaults
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Customize the component warranties, warranty types, and coverage periods shown in the proposal's Warranty Coverage table.
                    </p>

                    {/* Column Headers */}
                    <div className="flex gap-2 px-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span className="flex-1">Component / Service</span>
                      <span className="w-44">Warranty Type</span>
                      <span className="w-28 text-right pr-2">Coverage Period</span>
                      <span className="w-7" />
                    </div>

                    <div className="space-y-2">
                      {getSafeWarranties().map((w, idx) => (
                        <div
                          key={w.id || idx}
                          className="flex items-center gap-2 p-2 rounded-[10px] bg-secondary/30 border border-border hover:border-primary/40 transition-all"
                        >
                          <Input
                            className="flex-1 text-xs h-8 font-medium bg-background"
                            value={w.component}
                            onChange={(e) => updateWarranty(w.id, 'component', e.target.value)}
                            placeholder="e.g. Solar Panels, Inverter, Battery..."
                          />
                          <Input
                            className="w-44 shrink-0 text-xs h-8 text-muted-foreground bg-background"
                            value={w.warrantyType}
                            onChange={(e) => updateWarranty(w.id, 'warrantyType', e.target.value)}
                            placeholder="e.g. Manufacturer Warranty"
                          />
                          <Input
                            className="w-28 shrink-0 text-xs h-8 font-bold text-right bg-background"
                            value={w.coverage}
                            onChange={(e) => updateWarranty(w.id, 'coverage', e.target.value)}
                            placeholder="e.g. 15 Years, 5 Years..."
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveWarranty(w.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer h-7 w-7"
                            title="Remove warranty row"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddWarranty}
                      className="w-full h-8 border-dashed border-border text-[11px] font-bold text-muted-foreground hover:border-primary hover:text-foreground mt-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      Add Warranty Row
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'capital' && (
              <section className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <SectionHeader>Capital & Expenses Breakdown</SectionHeader>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Internal cost tracking comparing 0% Base Capital Rates vs +{invoice.rateMarkup}% Client Markup, Lalamove delivery, and job expenses.
                  </p>
                </div>

                {/* Capital Version Switcher (V1 vs V2) */}
                <div className="flex items-center gap-1.5 p-1 bg-secondary/80 rounded-xl border border-border shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCapitalVersion('v1')}
                    className={cn(
                      "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      capitalVersion === 'v1'
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    <span>⚡ V1 (Proposal with Capital)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapitalVersion('v2')}
                    className={cn(
                      "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      capitalVersion === 'v2'
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    <span>📑 V2 (Detailed BOQ Worksheet)</span>
                  </button>
                </div>

                {/* Profitability Executive Summary Card */}
                {(() => {
                  const itemsList = (invoice.lineItems || []).filter((item) => {
                    return !(invoice.excludeBattery && isBatteryItem(item.description))
                  })
                  const itemsBaseCapital = itemsList.reduce((acc, item) => acc + (item.quantity * item.rate), 0)
                  const itemsSellingSubtotal = calculateSubtotal(invoice)
                  const itemsMarkupGain = Math.max(0, itemsSellingSubtotal - itemsBaseCapital)

                  // Categorized base totals for tooltips
                  const panelsBaseTotal = itemsList.filter(it => {
                    const d = it.description.toLowerCase()
                    return d.includes('panel') || d.includes('tongwei') || d.includes('ja solar') || d.includes('pv module')
                  }).reduce((acc, it) => acc + (it.quantity * it.rate), 0)

                  const invertersBatteriesBaseTotal = itemsList.filter(it => {
                    const d = it.description.toLowerCase()
                    return d.includes('inverter') || isBatteryItem(it.description) || d.includes('solis') || d.includes('deye')
                  }).reduce((acc, it) => acc + (it.quantity * it.rate), 0)

                  const laborBaseTotal = itemsList.filter(it => isLaborItem(it.description)).reduce((acc, it) => acc + (it.quantity * it.rate), 0)
                  const materialsBaseTotal = Math.max(0, itemsBaseCapital - panelsBaseTotal - invertersBatteriesBaseTotal - laborBaseTotal)

                  // Labor selling total
                  const laborSellingTotal = itemsList.filter(it => isLaborItem(it.description)).reduce((acc, it) => {
                    const isDelivery = isDeliveryItem(it.description)
                    const isLabor = !isDelivery && isLaborItem(it.description)
                    const shouldApplyMarkup = !isDelivery && !(invoice.excludeLaborMarkup && isLabor)
                    const rate = shouldApplyMarkup ? it.rate * (1 + (invoice.rateMarkup || 0) / 100) : it.rate
                    return acc + (it.quantity * rate)
                  }, 0)

                  const discount = invoice.discountAmount || 0
                  const vatRate = invoice.vatRate || 0
                  const netSubtotalBeforeVat = Math.max(0, itemsSellingSubtotal - discount)
                  const vatAmount = netSubtotalBeforeVat * (vatRate / 100)
                  const clientSellingTotal = calculateTotal(invoice)

                  const lalamove = invoice.lalamoveCost || 0
                  const additionalExpenses = invoice.additionalExpenses || []
                  const additionalTotal = additionalExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0)
                  const totalExpenses = lalamove + additionalTotal
                  const subtotalCapital = itemsBaseCapital + totalExpenses

                  const salesMarkup25Pct = calculateSalesCommission(invoice)
                  const commissionableSellingBase = calculateCommissionableBase(invoice)
                  const totalCapitalWithSales = subtotalCapital + salesMarkup25Pct
                  const netProfit = clientSellingTotal - totalCapitalWithSales
                  const netMargin = clientSellingTotal > 0 ? (netProfit / clientSellingTotal) * 100 : 0

                  return (
                    <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-xl p-4 border border-zinc-700 shadow-md space-y-3 font-mono">
                      <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5 font-sans">
                          <Coins size={14} className="text-amber-400" />
                          Project Profitability Overview (0% Base vs +{invoice.rateMarkup}% Client Markup)
                        </span>
                        <span className="text-[10px] text-zinc-400 font-sans">
                          Client Markup: <strong className="text-white">+{invoice.rateMarkup}%</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="col-span-2 sm:col-span-3 bg-blue-950/70 p-3 rounded-lg border border-blue-500/40 flex justify-between items-center">
                          <div>
                            <div className="text-[9.5px] uppercase font-sans text-blue-300 font-bold tracking-wider flex items-center gap-1">
                              <span>Quotation Selling Value (+{invoice.rateMarkup}% Client Markup)</span>
                              <CapitalCalcPopover
                                title="Quotation Selling Price"
                                badge="Selling Total"
                                formula="Subtotal (with Markup) - Discount + VAT = Grand Total"
                                steps={[
                                  { label: "Items Selling Subtotal", value: formatCurrency(itemsSellingSubtotal, invoice.currency), color: "text-blue-300" },
                                  ...(discount > 0 ? [{ label: "Client Discount", value: `-${formatCurrency(discount, invoice.currency)}`, color: "text-rose-400" }] : []),
                                  ...(vatRate > 0 ? [{ label: `VAT (${vatRate}%)`, value: `+${formatCurrency(vatAmount, invoice.currency)}`, color: "text-amber-400" }] : []),
                                ]}
                                result={{ label: "Grand Total", value: formatCurrency(clientSellingTotal, invoice.currency), color: "text-blue-200" }}
                                description="The official selling price billed to the client on the Quotation sheet with all item markups applied."
                              />
                            </div>
                            <div className="text-[10px] text-zinc-300 font-sans">
                              Grand Total billed to client (+{invoice.rateMarkup}% markup applied to items + VAT)
                            </div>
                          </div>
                          <div className="font-extrabold text-base text-blue-200">
                            {formatCurrency(clientSellingTotal, invoice.currency)}
                          </div>
                        </div>

                        <div className="bg-zinc-800/80 p-2.5 rounded-lg border border-zinc-700">
                          <div className="text-[9px] uppercase font-sans text-zinc-400 font-bold flex items-center justify-between">
                            <span>Items Base Capital (0%)</span>
                            <CapitalCalcPopover
                              title="Items Base Capital (0% Markup)"
                              badge="Direct Cost"
                              formula="∑ (Line Item Qty × Supplier Base Rate)"
                              steps={[
                                { label: "Solar Panels", value: formatCurrency(panelsBaseTotal, invoice.currency) },
                                { label: "Inverters & Storage", value: formatCurrency(invertersBatteriesBaseTotal, invoice.currency) },
                                { label: "Balance of System / Mounting", value: formatCurrency(materialsBaseTotal, invoice.currency) },
                                { label: "Labor & Installation Base", value: formatCurrency(laborBaseTotal, invoice.currency) },
                              ]}
                              result={{ label: "Base Capital", value: formatCurrency(itemsBaseCapital, invoice.currency), color: "text-zinc-100" }}
                              description="Procurement cost of physical hardware, solar modules, inverters, balance of system, and base labor at 0% markup."
                            />
                          </div>
                          <div className="font-bold text-zinc-100 mt-0.5">
                            {formatCurrency(itemsBaseCapital, invoice.currency)}
                          </div>
                        </div>

                        <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/30">
                          <div className="text-[9px] uppercase font-sans text-emerald-400 font-bold flex items-center justify-between">
                            <span>Rate Markup Margin (+{invoice.rateMarkup}%)</span>
                            <CapitalCalcPopover
                              title="Rate Markup Margin"
                              badge={`+${invoice.rateMarkup}%`}
                              formula="Items Selling Subtotal - Items Base Capital Cost"
                              steps={[
                                { label: "Selling Subtotal (+Markup)", value: formatCurrency(itemsSellingSubtotal, invoice.currency), color: "text-emerald-300" },
                                { label: "Base Capital Cost (0%)", value: `-${formatCurrency(itemsBaseCapital, invoice.currency)}`, color: "text-zinc-400" },
                              ]}
                              result={{ label: "Markup Gross Gain", value: `+${formatCurrency(itemsMarkupGain, invoice.currency)}`, color: "text-emerald-300" }}
                              description={`Gross value added by applying the +${invoice.rateMarkup}% client rate markup on hardware and equipment.`}
                            />
                          </div>
                          <div className="font-bold text-emerald-300 mt-0.5">
                            +{formatCurrency(itemsMarkupGain, invoice.currency)}
                          </div>
                        </div>

                        <div className="bg-zinc-800/80 p-2.5 rounded-lg border border-zinc-700">
                          <div className="text-[9px] uppercase font-sans text-zinc-400 font-bold flex items-center justify-between">
                            <span>Logistics & Expenses</span>
                            <CapitalCalcPopover
                              title="Logistics & Job Expenses"
                              badge="Expenses"
                              formula="Lalamove Delivery Cost + ∑ Additional Project Expenses"
                              steps={[
                                { label: "Lalamove / Transport", value: formatCurrency(lalamove, invoice.currency), color: "text-amber-300" },
                                { label: `Project Expenses (${additionalExpenses.length} items)`, value: `+${formatCurrency(additionalTotal, invoice.currency)}`, color: "text-amber-300" },
                              ]}
                              result={{ label: "Total Expenses", value: formatCurrency(totalExpenses, invoice.currency), color: "text-amber-400" }}
                              description="Direct operational costs (freight, transportation, food, fuel, permits, and lodging) to complete the installation."
                            />
                          </div>
                          <div className="font-bold text-amber-400 mt-0.5">
                            {formatCurrency(totalExpenses, invoice.currency)}
                          </div>
                        </div>

                        <div className="bg-zinc-800/80 p-2.5 rounded-lg border border-amber-500/40">
                          <div className="text-[9px] uppercase font-sans text-amber-400 font-bold flex items-center justify-between">
                            <span>2.5% Sales Commission</span>
                            <CapitalCalcPopover
                              title="2.5% Sales Commission"
                              badge="2.5% Commission"
                              formula="(Quotation Total - Total Labor) × 2.5%"
                              steps={[
                                { label: "Quotation Selling Total", value: formatCurrency(clientSellingTotal, invoice.currency) },
                                { label: "Less Total Labor", value: `-${formatCurrency(laborSellingTotal, invoice.currency)}`, note: "Labor Deducted", color: "text-rose-400" },
                                { label: "Commissionable Base", value: formatCurrency(commissionableSellingBase, invoice.currency), color: "text-amber-300 font-bold" },
                                { label: "Commission Rate", value: "2.5%", color: "text-amber-400" },
                              ]}
                              result={{ label: "Sales Commission", value: `+${formatCurrency(salesMarkup25Pct, invoice.currency)}`, color: "text-amber-300" }}
                              description="Agent/sales commission calculated from Quotation Selling Total less total Labor & Installation (Labor is completely excluded from commission)."
                            />
                          </div>
                          <div className="font-bold text-amber-300 mt-0.5">
                            {formatCurrency(salesMarkup25Pct, invoice.currency)}
                          </div>
                        </div>

                        <div className="bg-zinc-950 p-2.5 rounded-lg border border-amber-500/40">
                          <div className="text-[9px] uppercase font-sans text-amber-400 font-bold flex items-center justify-between">
                            <span>Total Net Capital Cost</span>
                            <CapitalCalcPopover
                              title="Total Net Capital Cost"
                              badge="Net Outflow"
                              formula="Items Base Capital + Total Expenses + 2.5% Sales Commission"
                              steps={[
                                { label: "Items Base Capital (0%)", value: formatCurrency(itemsBaseCapital, invoice.currency) },
                                { label: "Logistics & Expenses", value: `+${formatCurrency(totalExpenses, invoice.currency)}`, color: "text-amber-400" },
                                { label: "2.5% Sales Commission", value: `+${formatCurrency(salesMarkup25Pct, invoice.currency)}`, color: "text-amber-400" },
                              ]}
                              result={{ label: "Total Net Capital", value: formatCurrency(totalCapitalWithSales, invoice.currency), color: "text-amber-300" }}
                              description="The total project outlay required to deliver and fulfill the solar contract before retained profit."
                            />
                          </div>
                          <div className="font-bold text-amber-300 mt-0.5">
                            {formatCurrency(totalCapitalWithSales, invoice.currency)}
                          </div>
                        </div>

                        <div className="bg-emerald-950/80 p-2.5 rounded-lg border border-emerald-500/40">
                          <div className="text-[9px] uppercase font-sans text-emerald-400 font-bold flex items-center justify-between">
                            <span>Est. Net Profit</span>
                            <CapitalCalcPopover
                              title="Estimated Net Profit"
                              badge="Retained Profit"
                              formula="Quotation Selling Value - Total Net Capital Cost"
                              steps={[
                                { label: "Quotation Selling Price", value: formatCurrency(clientSellingTotal, invoice.currency), color: "text-blue-300" },
                                { label: "Less Total Net Capital", value: `-${formatCurrency(totalCapitalWithSales, invoice.currency)}`, color: "text-amber-400" },
                              ]}
                              result={{ label: "Net Profit", value: formatCurrency(netProfit, invoice.currency), color: "text-emerald-300" }}
                              description="Net income retained after paying all suppliers, logistics, site expenses, and sales commissions."
                            />
                          </div>
                          <div className="font-bold text-emerald-300 mt-0.5">
                            {formatCurrency(netProfit, invoice.currency)}
                          </div>
                        </div>

                        <div className="col-span-2 sm:col-span-3 bg-emerald-950/90 p-2.5 rounded-lg border border-emerald-500/60 flex justify-between items-center">
                          <span className="text-[10px] uppercase font-sans text-emerald-300 font-bold tracking-wider flex items-center gap-1">
                            <span>NET GROSS PROFIT MARGIN (% OF SELLING PRICE):</span>
                            <CapitalCalcPopover
                              title="Net Gross Profit Margin"
                              badge="Margin %"
                              formula="(Net Profit ÷ Quotation Selling Price) × 100%"
                              steps={[
                                { label: "Net Profit Amount", value: formatCurrency(netProfit, invoice.currency), color: "text-emerald-300" },
                                { label: "Quotation Selling Price", value: formatCurrency(clientSellingTotal, invoice.currency), color: "text-blue-300" },
                              ]}
                              result={{ label: "Net Profit Margin", value: `${netMargin.toFixed(1)}%`, color: "text-emerald-200" }}
                              description="Percentage of the total client quotation value that represents pure retained profit."
                            />
                          </span>
                          <span className="font-extrabold text-sm text-emerald-200">
                            {formatCurrency(netProfit, invoice.currency)} ({netMargin.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Logistics & Expenses Input Section */}
                <div className="space-y-3 bg-secondary/30 p-3.5 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Truck size={14} className="text-amber-500" />
                      Logistics & Additional Expenses
                    </h3>
                  </div>

                  {/* Lalamove Cost */}
                  <div className="space-y-1.5" onMouseEnter={() => setHoveredField('lalamoveCost')} onMouseLeave={() => setHoveredField(null)}>
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase flex items-center gap-1">
                        <span>Lalamove / Transport Delivery Cost (₱)</span>
                        <CapitalCalcPopover
                          title="Lalamove Logistics Cost"
                          badge="Delivery"
                          formula="Actual out-of-pocket shipping & transport fee"
                          result={{ label: "Current Cost", value: formatCurrency(invoice.lalamoveCost || 0, invoice.currency) }}
                          description="Direct delivery fee for transporting equipment and panels to the installation site. Deducted directly from project margin."
                        />
                      </Label>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={invoice.lalamoveCost === 0 ? '' : (invoice.lalamoveCost || '')}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => update('lalamoveCost', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      placeholder="e.g. 1500"
                      className="font-mono"
                    />
                  </div>

                  {/* Additional Expenses List */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <span>Project Expenses</span>
                          <CapitalCalcPopover
                            title="Additional Project Expenses"
                            badge="Site Expenses"
                            formula="∑ (Individual Incidental Expenses)"
                            steps={(invoice.additionalExpenses || []).map(exp => ({
                              label: exp.description || 'Expense Item',
                              value: formatCurrency(exp.amount || 0, invoice.currency)
                            }))}
                            result={{
                              label: "Total Expenses",
                              value: formatCurrency((invoice.additionalExpenses || []).reduce((acc, exp) => acc + (exp.amount || 0), 0), invoice.currency)
                            }}
                            description="Job-specific expenses such as meals/allowance, diesel/transport, permits, safety gear, and rentals."
                          />
                        </Label>
                        <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          ({(invoice.additionalExpenses || []).length}/7 Max)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={(invoice.additionalExpenses || []).length >= 7}
                        onClick={() => addExpenseItem('', 0, 'additional')}
                        className="h-6 text-[10px] gap-1 cursor-pointer disabled:opacity-50"
                        title={(invoice.additionalExpenses || []).length >= 7 ? "Maximum limit of 7 expenses reached" : "Add new project expense"}
                      >
                        <Plus size={11} /> Add Expense
                      </Button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[9px] text-muted-foreground self-center mr-1 font-mono">Quick add:</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={(invoice.additionalExpenses || []).length >= 7}
                        onClick={() => addExpenseItem('Lalamove Express Delivery', 500, 'lalamove')}
                        className="h-5 px-1.5 text-[9px] bg-secondary hover:bg-secondary/80 cursor-pointer disabled:opacity-50"
                      >
                        + Lalamove ₱500
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={(invoice.additionalExpenses || []).length >= 7}
                        onClick={() => addExpenseItem('Permit & Processing Fees', 2500, 'permits')}
                        className="h-5 px-1.5 text-[9px] bg-secondary hover:bg-secondary/80 cursor-pointer disabled:opacity-50"
                      >
                        + Permit ₱2.5k
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={(invoice.additionalExpenses || []).length >= 7}
                        onClick={() => addExpenseItem('On-Site Meals & Incidentals', 1000, 'meals')}
                        className="h-5 px-1.5 text-[9px] bg-secondary hover:bg-secondary/80 cursor-pointer disabled:opacity-50"
                      >
                        + Meals ₱1k
                      </Button>
                    </div>

                    {(!invoice.additionalExpenses || invoice.additionalExpenses.length === 0) ? (
                      <p className="text-[11px] text-muted-foreground italic py-2 text-center bg-background/50 rounded-lg border border-dashed border-border">
                        No additional expenses added yet. Click "+ Add Expense" above.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {invoice.additionalExpenses.map((exp) => (
                          <div key={exp.id} className="flex gap-1.5 items-center bg-background p-2 rounded-lg border border-border">
                            <Input
                              value={exp.description}
                              onChange={(e) => updateExpenseItem(exp.id, 'description', e.target.value)}
                              placeholder="Expense item (e.g. Permit, Meals, Hardware)"
                              className="text-xs flex-1 h-7"
                            />
                            <Select
                              value={exp.category || 'additional'}
                              onValueChange={(val) => updateExpenseItem(exp.id, 'category', val as any)}
                            >
                              <SelectTrigger className="w-24 h-7 text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lalamove">Lalamove</SelectItem>
                                <SelectItem value="logistics">Logistics</SelectItem>
                                <SelectItem value="permits">Permits</SelectItem>
                                <SelectItem value="meals">Meals</SelectItem>
                                <SelectItem value="additional">Additional</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              value={exp.amount === 0 ? '' : (exp.amount || '')}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateExpenseItem(exp.id, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              placeholder="₱ Amount"
                              className="text-xs font-mono w-24 h-7 text-right"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeExpenseItem(exp.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Base Capital Table */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      Selected Items Base Capital Rates (0% Markup)
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {invoice.lineItems.length} items
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                    {invoice.lineItems.map((item, idx) => {
                      const baseCapitalAmount = item.quantity * item.rate
                      return (
                        <div key={item.id} className="p-2.5 rounded-lg border border-border bg-card space-y-1.5 text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-foreground text-[11px] line-clamp-1">
                              {idx + 1}. {item.description || 'Unspecified Item'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-primary shrink-0">
                              Cap: {formatCurrency(baseCapitalAmount, invoice.currency)}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <span className="text-muted-foreground">Qty: </span>
                              <span className="font-mono font-bold">{isLaborItem(item.description) || item.description.toLowerCase().includes('delivery') || item.description.toLowerCase().includes('freight') ? '—' : `${item.quantity} ${item.unit}`}</span>
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-1.5">
                              <span className="text-muted-foreground">Base Rate: </span>
                              <Input
                                type="number"
                                min="0"
                                value={item.rate === 0 ? '' : (item.rate || '')}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateItem(item.id, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                className="h-6 w-24 text-right font-mono text-[10px] px-1.5"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}





            {activeTab === 'checklist' && (
              <section className="space-y-5 animate-in fade-in duration-200">


                {/* 2. Progress & Bulk Action Toolbar */}
                {(() => {
                  const activeChecklistItems = invoice.lineItems.filter(item => {
                    if (invoice.excludeBattery && isBatteryItem(item.description)) return false
                    return true
                  })

                  const totalCount = activeChecklistItems.length
                  const checkedCount = activeChecklistItems.filter(it => checkedChecklistItems[it.id]).length
                  const percent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

                  const handleSelectAll = () => {
                    const next: Record<string, boolean> = {}
                    activeChecklistItems.forEach(it => { next[it.id] = true })
                    setCheckedChecklistItems(next)
                  }

                  const handleClearAll = () => {
                    setCheckedChecklistItems({})
                  }

                  const handleCopyChecklist = () => {
                    const sourceName = isSupplyMode ? 'Supply Materials' : 'Full Quotation'
                    const dateStr = new Date().toLocaleDateString()
                    let txt = `SOLAR SYSTEM DISPATCH CHECKLIST (${sourceName})
Date: ${dateStr}
Subject: ${invoice.subject || 'Solar Installation'}
-----------------------------------
`

                    activeChecklistItems.forEach((it, idx) => {
                      const isChecked = !!checkedChecklistItems[it.id]
                      txt += `[${isChecked ? 'x' : ' '}] ${idx + 1}. ${it.description || 'Item'} - ${it.quantity} ${it.unit}
`
                    })

                    txt += `-----------------------------------
Progress: ${checkedCount}/${totalCount} items checked (${percent}%)`

                    navigator.clipboard.writeText(txt)
                    setChecklistCopied(true)
                    setTimeout(() => setChecklistCopied(false), 2000)
                  }

                  return (
                    <div className="space-y-4">
                      {/* Overall Progress Meter */}
                      <div className="p-4 rounded-[16px] bg-card border border-border space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            Checklist Progress
                          </span>
                          <span className="font-mono font-bold text-primary">
                            {checkedCount} / {totalCount} Completed ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden border border-border">
                          <div
                            className="bg-primary h-full transition-all duration-300 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Quick Action Toolbar */}
                      <div className="flex items-center justify-between gap-2 flex-wrap bg-card p-3 rounded-[14px] border border-border">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={handleSelectAll}
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 cursor-pointer"
                          >
                            <CheckSquare size={12} />
                            Select All
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleClearAll}
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 cursor-pointer border-border"
                          >
                            <RefreshCw size={12} />
                            Clear
                          </Button>
                        </div>


                      </div>

                      {/* Grouped Checklist Content */}
                      {totalCount === 0 ? (
                        <div className="p-8 text-center text-muted-foreground bg-card rounded-[16px] border border-border space-y-2">
                          <Package size={28} className="mx-auto opacity-50" />
                          <p className="text-xs font-semibold">No line items available to generate checklist.</p>
                          <p className="text-[11px]">Add line items in the Items tab or select a BOQ preset to build your checklist.</p>
                        </div>
                      ) : (
                        (() => {
                          // Group items by supply category
                          const grouped: Record<string, { label: string; badgeColor: string; items: LineItem[] }> = {
                            equipment: { label: 'Major Equipment', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', items: [] },
                            mounting: { label: 'Mounting & Hardware', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', items: [] },
                            electrical: { label: 'Electrical & Cabling', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', items: [] },
                            grounding: { label: 'Grounding & Bonding', badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', items: [] },
                            labor: { label: 'Labor & Services', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', items: [] },
                          }

                          activeChecklistItems.forEach(item => {
                            const cat = getSupplyCategory(item.description)
                            if (grouped[cat.key]) {
                              grouped[cat.key].items.push(item)
                            } else {
                              grouped.electrical.items.push(item)
                            }
                          })

                          return (
                            <div className="space-y-4">
                              {Object.entries(grouped).map(([catKey, group]) => {
                                if (group.items.length === 0) return null

                                const groupChecked = group.items.filter(it => checkedChecklistItems[it.id]).length

                                return (
                                  <div key={catKey} className="bg-card rounded-[16px] border border-border p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <span className={cn("px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border", group.badgeColor)}>
                                          {group.label}
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-mono font-bold text-muted-foreground">
                                        {groupChecked} / {group.items.length} Checked
                                      </span>
                                    </div>

                                    <div className="space-y-2">
                                      {group.items.map(item => {
                                        const isChecked = !!checkedChecklistItems[item.id]

                                        return (
                                          <label
                                            key={item.id}
                                            onClick={() => {
                                              setCheckedChecklistItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                                            }}
                                            className={cn(
                                              "flex items-center justify-between p-3 rounded-[12px] border transition-all cursor-pointer select-none gap-3",
                                              isChecked
                                                ? "bg-primary/5 border-primary/40 dark:bg-primary/10 shadow-xs"
                                                : "bg-background border-border hover:bg-secondary/40"
                                            )}
                                          >
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className={cn(
                                                "w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all shrink-0",
                                                isChecked
                                                  ? "bg-primary border-primary text-primary-foreground"
                                                  : "border-border bg-card"
                                              )}>
                                                {isChecked && <Check size={12} strokeWidth={3} />}
                                              </div>

                                              <span className={cn(
                                                "text-xs font-semibold break-words font-mono transition-all",
                                                isChecked ? "line-through text-muted-foreground" : "text-foreground"
                                              )}>
                                                {item.description || 'Untitled Item'}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="px-2 py-0.5 rounded-[6px] bg-secondary border border-border text-[11px] font-bold font-mono text-foreground">
                                                {isLaborItem(item.description) || item.description.toLowerCase().includes('delivery') || item.description.toLowerCase().includes('freight') ? '—' : `${item.quantity} ${item.unit}`}
                                              </span>
                                              <span className={cn(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded-[4px]",
                                                isChecked ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                              )}>
                                                {isChecked ? 'Ready' : 'Pending'}
                                              </span>
                                            </div>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()
                      )}
                    </div>
                  )
                })()}
              </section>
            )}



            {activeTab === 'history' && (
              <section className="space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-start">
                  <div>
                    <SectionHeader>Exported PDF History Cache</SectionHeader>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Local browser history cache saved automatically whenever you click Download PDF.
                    </p>
                  </div>
                  {historyList.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        if (confirm('Are you sure you want to clear all PDF export history?')) {
                          const empty = clearInvoiceHistory()
                          setHistoryList(empty)
                          setSelectedHistoryItem(null)
                        }
                      }}
                      className="text-[10px] text-destructive hover:bg-destructive/10 h-7 border-destructive/30 cursor-pointer"
                    >
                      <Trash2 size={11} className="mr-1" /> Clear All
                    </Button>
                  )}
                </div>

                {historyToast && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span className="font-medium">{historyToast}</span>
                  </div>
                )}

                {historyList.length === 0 ? (
                  <div className="bg-card p-6 text-center rounded-xl border border-dashed border-border space-y-2">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                      <History size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">No Export History Recorded Yet</h4>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      Every time you click <strong className="text-foreground">"PDF"</strong> to download or print a quotation, a full setup snapshot is automatically saved here for quick restoration.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                    {historyList.map((hist) => {
                      const isSelected = selectedHistoryItem?.id === hist.id
                      return (
                        <div
                          key={hist.id}
                          className={cn(
                            "p-3 rounded-xl border transition-all duration-200 space-y-2 text-xs",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-xs"
                              : "border-border bg-card hover:border-zinc-400 dark:hover:border-zinc-700"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-mono font-bold text-foreground text-xs block">
                                {hist.invoiceNumber}
                              </span>
                              <span className="text-[10.5px] text-muted-foreground block line-clamp-1">
                                Client: <strong className="text-foreground">{hist.toName}</strong>
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-extrabold text-primary text-xs block">
                                {formatCurrency(hist.grandTotal, hist.currency)}
                              </span>
                              <span className="text-[9.5px] font-mono text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                                <Clock size={10} />
                                {hist.savedAt}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-border/60 gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                              <span>{hist.itemCount} items</span>
                              <span>•</span>
                              <span>+{hist.invoice.rateMarkup}% Markup</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="xs"
                                onClick={() => {
                                  setSelectedHistoryItem(hist)
                                  setActiveView('preview')
                                }}
                                className="h-6 text-[10px] gap-1 cursor-pointer"
                                title="Preview this history snapshot on canvas"
                              >
                                <Eye size={11} /> {isSelected ? "Previewing" : "Preview"}
                              </Button>

                              <Button
                                type="button"
                                variant="default"
                                size="xs"
                                onClick={() => {
                                  setInvoice(hist.invoice)
                                  setSelectedHistoryItem(null)
                                  setHistoryToast(`Applied setup from history (${hist.invoiceNumber})`)
                                  setTimeout(() => setHistoryToast(null), 4000)
                                }}
                                className="h-6 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                title="Apply this saved setup to active workspace editor"
                              >
                                <RotateCcw size={11} /> Apply Setup
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const updated = deleteHistoryItem(hist.id)
                                  setHistoryList(updated)
                                  if (selectedHistoryItem?.id === hist.id) {
                                    setSelectedHistoryItem(null)
                                  }
                                }}
                                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                                title="Delete history snapshot"
                              >
                                <Trash2 size={11} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'changelog' && (
              <section className="space-y-5 animate-in fade-in duration-200 max-w-5xl mx-auto w-full pb-8">
                <div className="flex justify-between items-start flex-wrap gap-2 border-b border-border pb-3">
                  <div>
                    <SectionHeader>Developer & Catalog Price Changelog</SectionHeader>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Structured change releases grouped by Set Date for item prices, quantity adjustments, and catalog updates.
                    </p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search items, set dates, or developer notes..."
                      value={changelogSearch}
                      onChange={(e) => setChangelogSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                    {(['all', 'price', 'quantity', 'addition', 'system'] as const).map((filterType) => (
                      <button
                        key={filterType}
                        type="button"
                        onClick={() => setChangelogFilter(filterType)}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-bold rounded-full border transition-all cursor-pointer capitalize whitespace-nowrap",
                          changelogFilter === filterType
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                        )}
                      >
                        {filterType}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grouped Changelog Sets by Date */}
                {(() => {
                  const filtered = changelogList.filter((item) => {
                    if (changelogFilter !== 'all' && item.changeType !== changelogFilter) return false
                    if (changelogSearch.trim()) {
                      const q = changelogSearch.toLowerCase().trim()
                      const desc = (item.itemDescription || '').toLowerCase()
                      const note = (item.note || '').toLowerCase()
                      const batch = (item.batch || '').toLowerCase()
                      const field = (item.fieldChanged || '').toLowerCase()
                      if (!desc.includes(q) && !note.includes(q) && !batch.includes(q) && !field.includes(q)) {
                        return false
                      }
                    }
                    return true
                  })

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-card p-6 text-center rounded-xl border border-dashed border-border space-y-2">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                          <RefreshCw size={18} />
                        </div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">No Changelog Sets Found</h4>
                        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                          No price or quantity set matches your search filter. Click <strong className="text-foreground">"Add Entry"</strong> or <strong className="text-foreground">"Reset"</strong> to restore default set releases.
                        </p>
                      </div>
                    )
                  }

                  // Group by Set Date / Batch
                  const groupMap = new Map<string, ChangelogItem[]>()
                  filtered.forEach((item) => {
                    const key = item.batch || `Set Date: ${item.timestamp.split(',')[0]}`
                    if (!groupMap.has(key)) {
                      groupMap.set(key, [])
                    }
                    groupMap.get(key)!.push(item)
                  })

                  const sets = Array.from(groupMap.entries())

                  return (
                    <div className="space-y-5">
                      {sets.map(([setBatchName, items]) => (
                        <div
                          key={setBatchName}
                          className="rounded-xl border border-border bg-card overflow-hidden shadow-xs space-y-0"
                        >
                          {/* Set Date Header Banner */}
                          <div className="bg-secondary/70 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Tag size={13} className="text-primary shrink-0" />
                              <span className="font-bold text-xs text-foreground tracking-tight">
                                {setBatchName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {items.length} {items.length === 1 ? 'change' : 'changes'} in set
                              </span>
                            </div>
                          </div>

                          {/* Items Table for this Set */}
                          <div className="divide-y divide-border/60">
                            {items.map((log) => {
                              const isPrice = log.changeType === 'price'
                              const isQty = log.changeType === 'quantity'
                              const isAdd = log.changeType === 'addition'

                              const badgeColor = isPrice
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : isQty
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                : isAdd
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'

                              return (
                                <div
                                  key={log.id}
                                  className="p-3.5 hover:bg-secondary/30 transition-colors space-y-2 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-foreground text-xs">
                                          {log.itemDescription}
                                        </span>
                                        <span className={cn("text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border", badgeColor)}>
                                          {log.fieldChanged || log.changeType}
                                        </span>
                                        {log.unit && (
                                          <span className="text-[9px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                                            {log.unit}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Value comparison pill */}
                                      <div className="flex items-center gap-2 bg-background px-2.5 py-1 rounded-lg border border-border text-[11px] font-mono">
                                        <span className="text-muted-foreground line-through">
                                          {log.oldValue}
                                        </span>
                                        <ArrowRight size={11} className="text-primary shrink-0" />
                                        <span className="font-bold text-foreground">
                                          {log.newValue}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {log.note && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground leading-relaxed pl-0.5 pt-0.5 flex-wrap">
                                      {log.note.includes('[Dev]') && (
                                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 font-black text-[9.5px] px-1.5 py-0.5 rounded shrink-0">
                                          Dev
                                        </span>
                                      )}
                                      {log.note.includes('[MsG]') && (
                                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-black text-[9.5px] px-1.5 py-0.5 rounded shrink-0">
                                          MsG
                                        </span>
                                      )}
                                      {log.note.includes('[SysPrc]') && (
                                        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 font-black text-[9.5px] px-1.5 py-0.5 rounded shrink-0">
                                          SysPrc
                                        </span>
                                      )}
                                      <span className="italic">
                                        {log.note.replace(/\[Dev\]\s*/g, '').replace(/\[MsG\]\s*/g, '').replace(/\[SysPrc\]\s*/g, '')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </section>
            )}
          </div>

          {/* Download button */}
          {activeTab !== 'changelog' && (
            <>
              {/* Desktop Download button */}
              <div className="hidden lg:block px-6 pb-6 pt-4 border-t border-border shrink-0">
                <Button
                  onClick={handleOpenDownloadModal}
                  disabled={isExportingPdf}
                  className="w-full h-11 rounded-[10px] text-[14px] font-semibold cursor-pointer gap-2"
                >
                  {isExportingPdf ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={15} strokeWidth={2} />
                  )}
                  {isExportingPdf ? (pdfExportStatus || 'Generating...') : 'Download'}
                </Button>
              </div>

              {/* Mobile Edit Mode Bottom Action Bar */}
              <div className="lg:hidden p-3 border-t border-border bg-card shrink-0 print:hidden">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveView('preview')}
                    className="flex-1 h-10 rounded-lg text-xs font-semibold border-border cursor-pointer"
                  >
                    Preview ({totalPages})
                  </Button>
                  <Button
                    type="button"
                    onClick={handleOpenDownloadModal}
                    disabled={isExportingPdf}
                    className="flex-[1.5] h-10 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-xs cursor-pointer gap-1.5"
                  >
                    {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {isExportingPdf ? (pdfExportStatus || 'Exporting...') : 'Download'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className={cn("flex-1 bg-[#EBEBEB] dark:bg-zinc-900 min-h-0 relative overflow-y-auto scrollbar-none flex flex-col justify-start items-center print:!block print:!h-auto print:!overflow-visible print:!bg-white", activeTab === 'changelog' ? 'hidden' : (activeView === 'preview' ? 'flex' : 'hidden lg:flex lg:flex-col'))}>
        {/* Floating background themed characters (screen only, hidden on print) */}


        {THEME_CHARACTERS[invoice.theme] && (
          <>
            <div className="absolute left-8 top-12 text-[140px] pointer-events-none select-none opacity-[0.06] animate-bounce duration-5000 print:hidden">
              {THEME_CHARACTERS[invoice.theme]}
            </div>
            <div className="absolute right-12 bottom-12 text-[160px] pointer-events-none select-none opacity-[0.06] animate-pulse duration-3000 print:hidden">
              {THEME_CHARACTERS[invoice.theme]}
            </div>
          </>
        )}

        {/* History Snapshot Preview Banner */}
        {selectedHistoryItem && (
          <div className="mt-4 mb-2 print:hidden flex flex-wrap items-center justify-between gap-3 bg-white/95 dark:bg-[#1A1A1A]/95 text-foreground backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg z-20 max-w-2xl w-full select-none animate-in fade-in duration-200 border border-border">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Clock size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Previewing History Snapshot: <strong className="font-mono font-bold text-foreground">{selectedHistoryItem.invoiceNumber}</strong> ({selectedHistoryItem.savedAt})
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="xs"
                onClick={() => {
                  setInvoice(selectedHistoryItem.invoice)
                  setSelectedHistoryItem(null)
                  setHistoryToast(`Applied setup from history (${selectedHistoryItem.invoiceNumber})`)
                  setTimeout(() => setHistoryToast(null), 4000)
                }}
                className="h-7 text-[11px] bg-[#111111] text-white hover:bg-black/90 dark:bg-primary dark:text-primary-foreground font-bold cursor-pointer gap-1 shadow-xs"
              >
                <RotateCcw size={12} /> Apply Setup
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setSelectedHistoryItem(null)}
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground border-border cursor-pointer"
              >
                Close Preview
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'checklist' ? (
          <MGChecklistPreview
            invoice={selectedHistoryItem ? selectedHistoryItem.invoice : invoice}
            hoveredField={hoveredField}
            checkedItems={checkedChecklistItems}
            previousTab={previousTab}
            onToggleCheck={(id) => setCheckedChecklistItems(prev => ({ ...prev, [id]: !prev[id] }))}
            onPagesChange={setTotalPages}
          />
        ) : activeTab === 'capital' ? (
          <MGCapitalPreview
            invoice={selectedHistoryItem ? selectedHistoryItem.invoice : invoice}
            hoveredField={hoveredField}
            version={capitalVersion}
            onVersionChange={setCapitalVersion}
            onPagesChange={setTotalPages}
            onToggleCondensed={(val) => update('isCondensed', val)}
            onToggleWithBrandName={(val) => update('withBrandName', val)}
          />
        ) : (
          <MGInvoicePreview
            invoice={selectedHistoryItem ? selectedHistoryItem.invoice : invoice}
            hoveredField={hoveredField}
            onOpenCheatsheet={() => setCheatsheetOpen(true)}
            onPagesChange={setTotalPages}
            onToggleCondensed={(val) => update('isCondensed', val)}
            onToggleWithBrandName={(val) => update('withBrandName', val)}
          />
        )}

        {/* Mobile Floating Action Bar in Preview Mode */}
        {activeTab !== 'changelog' && (
          <div className="lg:hidden sticky bottom-4 z-30 print:hidden flex items-center gap-2 w-full max-w-sm px-4 py-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveView('edit')}
              className="flex-1 h-10 rounded-xl text-xs font-bold bg-card/95 text-foreground backdrop-blur-md border border-border shadow-lg cursor-pointer"
            >
              ✏️ Edit Form
            </Button>
            <Button
              type="button"
              onClick={handleOpenDownloadModal}
              disabled={isExportingPdf}
              className="flex-[1.6] h-10 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-lg cursor-pointer gap-1.5"
            >
              {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isExportingPdf ? (pdfExportStatus || 'Exporting...') : 'Download'}
            </Button>
          </div>
        )}
      </div>
    </div>

      <Dialog open={cheatsheetOpen} onOpenChange={setCheatsheetOpen}>
        <DialogContent className="max-w-md font-mono">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold tracking-tight">URL Params API</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-[#888888] -mt-1">
            Pre-fill any field by adding params to the URL. Params stay in sync as you type.
          </p>
          <div className="text-[12px] bg-[#F5F5F5] rounded-md px-3 py-2 text-[#111111] break-all">
            mg-invoice.vercel.app?fromName=Acme&amp;currency=PHP
          </div>
          <div className="flex flex-col gap-1 mt-1">
            {[
              ['fromName', 'Company name'],
              ['fromEmail', 'Company email'],
              ['fromPhone', 'Company phone'],
              ['fromAddress', 'Company address'],
              ['toName', 'Client name'],
              ['toEmail', 'Client email'],
              ['toAddress', 'Client address'],
              ['invoiceNumber', 'Invoice number'],
              ['issueDate', 'Issue date (YYYY-MM-DD)'],
              ['dueDate', 'Validity (YYYY-MM-DD)'],
              ['currency', 'Currency code'],
              ['vatRate', 'VAT %'],
              ['rateMarkup', 'Rate markup/adjustment %'],
              ['bankBeneficiary', 'Beneficiary'],
              ['bankName', 'Bank name'],
              ['bankSortCode', 'Sort Code / Routing'],
              ['bankAccount', 'Account / IBAN'],
              ['bankSwift', 'SWIFT / BIC'],
              ['note', 'Terms & Condition / additional details'],
              ['print', 'Set to true to auto-print'],
            ].map(([param, label]) => (
              <div key={param} className="flex gap-3 items-baseline">
                <span className="text-[12px] text-[#111111] w-36 shrink-0">{param}</span>
                <span className="text-[12px] text-[#888888]">{label}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Goodwe Pricelist Update Reminder Modal */}
      <GoodweReminderModal open={goodweModalOpen} onOpenChange={setGoodweModalOpen} theme={invoice.theme} />

      {/* Add Custom Changelog Entry Dialog */}
      <Dialog open={addChangelogModalOpen} onOpenChange={setAddChangelogModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <RefreshCw size={16} className="text-primary" />
              Add Changelog Record
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Item Description</Label>
              <Input
                placeholder="e.g. Breaker Box / Cable Tray / AC Wire"
                value={newLogItem.itemDescription}
                onChange={(e) => setNewLogItem((p) => ({ ...p, itemDescription: e.target.value }))}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground">Change Type</Label>
                <Select
                  value={newLogItem.changeType}
                  onValueChange={(val: any) => setNewLogItem((p) => ({ ...p, changeType: val }))}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price Change</SelectItem>
                    <SelectItem value="quantity">Quantity Change</SelectItem>
                    <SelectItem value="addition">Item Addition</SelectItem>
                    <SelectItem value="system">System / Specs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-muted-foreground">Field Changed</Label>
                <Input
                  placeholder="e.g. Unit Price / Quantity"
                  value={newLogItem.fieldChanged}
                  onChange={(e) => setNewLogItem((p) => ({ ...p, fieldChanged: e.target.value }))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground">Old Value</Label>
                <Input
                  placeholder="e.g. ₱2,250.00"
                  value={newLogItem.oldValue}
                  onChange={(e) => setNewLogItem((p) => ({ ...p, oldValue: e.target.value }))}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-muted-foreground">New Value</Label>
                <Input
                  placeholder="e.g. ₱3,000.00"
                  value={newLogItem.newValue}
                  onChange={(e) => setNewLogItem((p) => ({ ...p, newValue: e.target.value }))}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Batch / Category Tag</Label>
              <Input
                placeholder="e.g. August 2026 Price Update"
                value={newLogItem.batch}
                onChange={(e) => setNewLogItem((p) => ({ ...p, batch: e.target.value }))}
                className="mt-1 h-8 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-[11px] font-bold text-muted-foreground">Notes / Rationale</Label>
              <Textarea
                placeholder="Details or reason for price/quantity adjustment..."
                value={newLogItem.note}
                onChange={(e) => setNewLogItem((p) => ({ ...p, note: e.target.value }))}
                className="mt-1 text-xs h-16 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setAddChangelogModalOpen(false)}
                className="h-8 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="xs"
                onClick={handleCreateChangelogEntry}
                disabled={!newLogItem.itemDescription.trim()}
                className="h-8 font-bold cursor-pointer"
              >
                Save Changelog Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Download PDF Dialog with Document Selection, Layout, Pricing, and Save As */}
      <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[540px] max-h-[88dvh] overflow-y-auto overflow-x-hidden bg-card text-foreground border border-border shadow-2xl rounded-2xl p-4 sm:p-6 gap-0">
          <DialogHeader className="space-y-1 pb-3 text-left">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
              <Download size={18} className="text-primary shrink-0" />
              <span>Download & Export</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Choose documents, layout format, and pricing version to export.
            </p>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleExecuteDownload()
            }}
            className="space-y-3.5 sm:space-y-4 pt-1 w-full min-w-0"
          >
            {(() => {
              const selectedTasks = getSelectedExportTasks(downloadFileName || computeDefaultFileName())
              const totalFiles = selectedTasks.length

              return (
                <>
                  {/* 1. Format Selection (PDF vs PNG) */}
                  <div className="space-y-1.5 w-full min-w-0">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                      1. Export Format
                    </label>
                    <div className="grid grid-cols-2 gap-2 w-full min-w-0">
                      <button
                        type="button"
                        onClick={() => setDownloadFormat('pdf')}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 select-none",
                          downloadFormat === 'pdf'
                            ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                            : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70 font-semibold"
                        )}
                      >
                        <span className="text-base">📄</span>
                        <div className="text-left">
                          <div className="text-xs leading-tight">PDF Document</div>
                          <div className={cn("text-[9.5px]", downloadFormat === 'pdf' ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            Printable (.pdf)
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDownloadFormat('png')}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 select-none",
                          downloadFormat === 'png'
                            ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                            : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70 font-semibold"
                        )}
                      >
                        <span className="text-base">🖼️</span>
                        <div className="text-left">
                          <div className="text-xs leading-tight">PNG Image</div>
                          <div className={cn("text-[9.5px]", downloadFormat === 'png' ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            High-res graphic (.png)
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* 2. Document Selection Section */}
                  <div className="space-y-2 w-full min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                        2. Select Document(s)
                      </label>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground shrink-0">
                        {totalFiles} {totalFiles === 1 ? 'File' : 'Files'} {totalFiles > 1 ? (downloadUseZip ? '(ZIP)' : '(Separate)') : `(${downloadFormat.toUpperCase()})`}
                      </span>
                    </div>

                    <div className="space-y-2 w-full min-w-0">
                      {/* Quotation Option Card */}
                      <div className={cn(
                        "rounded-xl border transition-all overflow-hidden w-full min-w-0",
                        downloadDocTypes.quotation ? "bg-primary/[0.03] border-primary/40 shadow-2xs" : "bg-secondary/20 border-border"
                      )}>
                        <div className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2.5">
                          <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                            <input
                              type="checkbox"
                              checked={downloadDocTypes.quotation}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setDownloadDocTypes(prev => ({ ...prev, quotation: checked }))
                                if (checked && !downloadQuotationMarkup.withMarkup && !downloadQuotationMarkup.withoutMarkup) {
                                  setDownloadQuotationMarkup({ withMarkup: true, withoutMarkup: false })
                                }
                              }}
                              className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
                            />
                            <span className="text-xs font-bold text-foreground truncate">
                              📄 Solar Quotation
                            </span>
                          </label>

                          {downloadDocTypes.quotation && (
                            <div className="flex items-center bg-secondary/90 p-0.5 rounded-lg border border-border shrink-0 ml-auto">
                              <button
                                type="button"
                                onClick={() => setDownloadIsCondensed(false)}
                                className={cn(
                                  "px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none",
                                  !downloadIsCondensed
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                Expanded
                              </button>
                              <button
                                type="button"
                                onClick={() => setDownloadIsCondensed(true)}
                                className={cn(
                                  "px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none",
                                  downloadIsCondensed
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                Compressed
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Quotation Pricing Options */}
                        {downloadDocTypes.quotation && (
                          <div className="px-3 sm:px-3.5 pb-3 sm:pb-3.5 pt-0 w-full min-w-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-border/40 w-full min-w-0">
                              <label className={cn(
                                "flex items-center gap-2 p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer select-none min-w-0",
                                downloadQuotationMarkup.withMarkup
                                  ? "bg-background border-primary/40 text-foreground shadow-2xs"
                                  : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/50"
                              )}>
                                <input
                                  type="checkbox"
                                  checked={downloadQuotationMarkup.withMarkup}
                                  onChange={(e) => {
                                    const checked = e.target.checked
                                    if (!checked && !downloadQuotationMarkup.withoutMarkup) return
                                    setDownloadQuotationMarkup(prev => ({ ...prev, withMarkup: checked }))
                                  }}
                                  className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] font-bold block truncate leading-tight">With Markup</span>
                                  <span className="text-[9.5px] text-muted-foreground block font-mono truncate">+{invoice.rateMarkup ?? 0}% client</span>
                                </div>
                              </label>

                              <label className={cn(
                                "flex items-center gap-2 p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer select-none min-w-0",
                                downloadQuotationMarkup.withoutMarkup
                                  ? "bg-background border-primary/40 text-foreground shadow-2xs"
                                  : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/50"
                              )}>
                                <input
                                  type="checkbox"
                                  checked={downloadQuotationMarkup.withoutMarkup}
                                  onChange={(e) => {
                                    const checked = e.target.checked
                                    if (!checked && !downloadQuotationMarkup.withMarkup) return
                                    setDownloadQuotationMarkup(prev => ({ ...prev, withoutMarkup: checked }))
                                  }}
                                  className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] font-bold block truncate leading-tight">Without Markup</span>
                                  <span className="text-[9.5px] text-muted-foreground block font-mono truncate">0% base price</span>
                                </div>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Capital Option Card */}
                      <div className={cn(
                        "rounded-xl border transition-all overflow-hidden w-full min-w-0",
                        downloadDocTypes.capital ? "bg-primary/[0.03] border-primary/40 shadow-2xs" : "bg-secondary/20 border-border"
                      )}>
                        <div className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2.5">
                          <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                            <input
                              type="checkbox"
                              checked={downloadDocTypes.capital}
                              onChange={(e) => setDownloadDocTypes(prev => ({ ...prev, capital: e.target.checked }))}
                              className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-foreground block truncate">
                                💰 Capital Sheet
                              </span>
                              <span className="text-[10px] text-muted-foreground block truncate">
                                Internal cost & profit breakdown
                              </span>
                            </div>
                          </label>

                          {downloadDocTypes.capital && (
                            <div className="flex items-center bg-secondary/90 p-0.5 rounded-lg border border-border shrink-0 ml-auto">
                              <button
                                type="button"
                                onClick={() => setDownloadCapitalVersion('v1')}
                                className={cn(
                                  "px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none",
                                  downloadCapitalVersion === 'v1'
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                ⚡ V1 (1-Page)
                              </button>
                              <button
                                type="button"
                                onClick={() => setDownloadCapitalVersion('v2')}
                                className={cn(
                                  "px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none",
                                  downloadCapitalVersion === 'v2'
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                📑 V2 (Detailed BOQ)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Checklist Option Card */}
                      <label className={cn(
                        "p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center gap-2.5 min-w-0",
                        downloadDocTypes.checklist ? "bg-primary/[0.03] border-primary/40 shadow-2xs text-foreground" : "bg-secondary/20 border-border text-muted-foreground hover:bg-secondary/40"
                      )}>
                        <input
                          type="checkbox"
                          checked={downloadDocTypes.checklist}
                          onChange={(e) => setDownloadDocTypes(prev => ({ ...prev, checklist: e.target.checked }))}
                          className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold block truncate text-foreground">
                            📋 Packing & Dispatch Checklist
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            Warehouse dispatch & packaging BOQ
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Multi-file Packaging Option (Separate Files vs ZIP) */}
                  {totalFiles > 1 && (
                    <div className="p-3 rounded-xl border bg-secondary/30 border-border flex items-center justify-between gap-2.5 select-none w-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-base shrink-0">{downloadUseZip ? '📦' : '📂'}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold block text-foreground truncate">
                            {downloadUseZip ? 'Bundle as ZIP Archive' : 'Separate Files (No ZIP)'}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {downloadUseZip ? 'Packages all files into a single .zip' : 'Downloads all files individually to your device'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center bg-secondary p-0.5 rounded-lg border border-border shrink-0 ml-auto">
                        <button
                          type="button"
                          onClick={() => setDownloadUseZip(false)}
                          className={cn(
                            "px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none",
                            !downloadUseZip
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Individual
                        </button>
                        <button
                          type="button"
                          onClick={() => setDownloadUseZip(true)}
                          className={cn(
                            "px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer select-none",
                            downloadUseZip
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          ZIP Archive
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. Base File Name & Quick Presets */}
                  <div className="space-y-2 w-full min-w-0">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                      3. Base File Name
                    </label>
                    <div className="flex items-center w-full rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary overflow-hidden shadow-2xs min-w-0">
                      <input
                        type="text"
                        value={downloadFileName}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setDownloadFileName(e.target.value)}
                        placeholder="Quotation File Name"
                        className="flex-1 min-w-0 bg-transparent px-3 py-2 text-xs text-foreground outline-none font-medium placeholder:text-muted-foreground/50"
                      />
                      <span className="bg-muted/80 px-2.5 sm:px-3 py-2 text-xs font-mono font-semibold text-muted-foreground border-l border-border select-none shrink-0 whitespace-nowrap">
                        {totalFiles > 1 && downloadUseZip ? '.zip' : (downloadFormat === 'png' ? '.png' : '.pdf')}
                      </span>
                    </div>

                    {/* Quick Naming Presets */}
                    <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-0.5 w-full">
                      {(() => {
                        const client = invoice.toName ? invoice.toName.trim() : 'Client'
                        const qNum = invoice.invoiceNumber ? invoice.invoiceNumber.trim() : 'Quotation'
                        const systemTypeLabel = systemType === 'ongrid' ? 'On-Grid' : 'Hybrid'
                        const p1 = `${client} - ${qNum}`
                        const p2 = `${qNum}`
                        const p3 = `${activeKwSetup}kW ${systemTypeLabel} - ${client}`
                        const p4 = `MG Solar - ${client}`

                        const presets = [
                          { label: 'Client - Quote#', val: p1 },
                          { label: 'Quote# Only', val: p2 },
                          { label: 'System + Client', val: p3 },
                          { label: 'MG Solar + Client', val: p4 },
                        ]

                        return presets.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDownloadFileName(p.val.replace(/[\\/:*?"<>|]/g, ''))}
                            className="px-2 sm:px-2.5 py-1 text-[9.5px] sm:text-[10px] font-semibold bg-secondary/80 hover:bg-secondary hover:text-foreground text-muted-foreground border border-border/80 rounded-md transition-all cursor-pointer select-none active:scale-[0.98]"
                          >
                            {p.label}
                          </button>
                        ))
                      })()}
                    </div>
                  </div>

                  {/* 4. Generated Export File(s) Preview */}
                  {selectedTasks.length > 0 && (
                    <div className="space-y-1.5 w-full min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                          Export Preview
                        </span>
                        {totalFiles > 1 && (
                          <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 truncate min-w-0">
                            {downloadUseZip
                              ? `📦 ${(downloadFileName.trim() || computeDefaultFileName())}.zip`
                              : `📂 ${totalFiles} Separate Files`}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/40 border border-border space-y-1.5 overflow-hidden w-full min-w-0">
                        {selectedTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 text-[11px] font-mono text-foreground min-w-0 w-full">
                            <span className="text-primary shrink-0">{downloadFormat === 'png' ? '🖼️' : '📄'}</span>
                            <span className="truncate font-semibold min-w-0 flex-1">{t.filename}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60 w-full min-w-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDownloadModalOpen(false)}
                      disabled={isExportingPdf}
                      className="h-9 px-3.5 sm:px-4 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isExportingPdf || !downloadFileName.trim() || totalFiles === 0}
                      className="h-9 px-4 sm:px-5 rounded-lg text-xs font-bold gap-1.5 cursor-pointer shadow-sm bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.98] shrink-0"
                    >
                      {isExportingPdf ? (
                        <Loader2 size={14} className="animate-spin shrink-0" />
                      ) : (
                        <Download size={14} className="shrink-0" />
                      )}
                      <span className="truncate">
                        {isExportingPdf
                          ? (pdfExportStatus || 'Exporting...')
                          : (totalFiles > 1
                              ? (downloadUseZip ? `Download ZIP (${totalFiles} Files)` : `Download All (${totalFiles} Files)`)
                              : `Download ${downloadFormat.toUpperCase()}`)}
                      </span>
                    </Button>
                  </div>
                </>
              )
            })()}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}





