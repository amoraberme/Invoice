import type { Invoice, InvoiceHistoryItem, ChangelogItem } from './types'
import { isBatteryItem } from './utils'

const DB_NAME = 'mg-invoice-db'
const STORE_NAME = 'data'
const INVOICE_KEY = 'current-invoice'
const HISTORY_KEY = 'mg-invoice-history'
const CHANGELOG_KEY = 'mg-invoice-changelog'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadInvoice(): Promise<Invoice | null> {
  // Try localStorage first (fast, synchronous, widely supported on iOS)
  try {
    const local = localStorage.getItem(INVOICE_KEY)
    if (local) {
      return JSON.parse(local)
    }
  } catch (e) {
    console.error('Failed to load from localStorage', e)
  }

  // Fallback to IndexedDB
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(INVOICE_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  // Save to localStorage immediately
  try {
    localStorage.setItem(INVOICE_KEY, JSON.stringify(invoice))
  } catch (e) {
    console.error('Failed to save to localStorage', e)
  }

  // Save to IndexedDB as secondary backup
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(invoice, INVOICE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // silently fail — not critical
  }
}

export function getInvoiceHistory(): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to load history from localStorage', e)
  }
  return []
}

export function saveInvoiceToHistory(
  invoice: Invoice,
  calculateTotalFn: (inv: Invoice) => number
): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const currentHistory = getInvoiceHistory()
    const now = new Date()
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const grandTotal = calculateTotalFn(invoice)
    const activeItems = (invoice.lineItems || []).filter(
      (item) => !(invoice.excludeBattery && isBatteryItem(item.description))
    )

    const newEntry: InvoiceHistoryItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      savedAt: formattedDate,
      invoiceNumber: invoice.invoiceNumber || 'Untitled Quotation',
      toName: invoice.toName || 'Unspecified Client',
      grandTotal,
      currency: invoice.currency || 'PHP',
      itemCount: activeItems.length,
      invoice: JSON.parse(JSON.stringify(invoice)),
    }

    // Avoid duplicate rapid saves within 2 seconds
    const latest = currentHistory[0]
    if (latest && Date.now() - parseInt(latest.id.split('-')[1] || '0') < 2000) {
      currentHistory[0] = newEntry
    } else {
      currentHistory.unshift(newEntry)
    }

    // Keep top 50
    const trimmed = currentHistory.slice(0, 50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
    return trimmed
  } catch (e) {
    console.error('Failed to save invoice history', e)
    return getInvoiceHistory()
  }
}

export function deleteHistoryItem(id: string): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const current = getInvoiceHistory()
    const filtered = current.filter((item) => item.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered))
    return filtered
  } catch (e) {
    console.error('Failed to delete history item', e)
    return getInvoiceHistory()
  }
}

export function clearInvoiceHistory(): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch (e) {
    console.error('Failed to clear invoice history', e)
  }
  return []
}

export const INITIAL_CHANGELOG_SEED: ChangelogItem[] = [
  // ── SET DATE: AUGUST 13, 2026 ──
  {
    id: 'cl-seed-trina',
    timestamp: 'Aug 13, 2026, 09:55 AM',
    itemDescription: 'Trina Solar 620W Panel',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱5,700.00',
    newValue: '₱6,200.00',
    unit: 'PCS',
    note: '[MsG] Price updated from ₱5,700 to ₱6,200 per unit',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  {
    id: 'cl-seed-1',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Breaker box / Metal Enclosure',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱2,250.00',
    newValue: '₱3,000.00',
    unit: 'PC',
    note: '[SysPrc] Price updated from ₱2,250 to ₱3,000 per unit',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  {
    id: 'cl-seed-2',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Cable Tray',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱560.00',
    unit: 'PCS',
    note: '[SysPrc] Added new item Cable Tray at ₱560 each to BOQ and electrical catalog',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  {
    id: 'cl-seed-3',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Terminal lugs',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱70.00',
    newValue: '₱40.00',
    unit: 'PCS',
    note: '[SysPrc] Price reduced from ₱70 to ₱40 each',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  {
    id: 'cl-seed-4',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'AC Wire #6 AWG 14mm²',
    changeType: 'price',
    fieldChanged: 'Unit Price (Per Meter)',
    oldValue: '₱400.00 / m',
    newValue: '₱99.33 / m',
    unit: 'M',
    note: '[SysPrc] Updated rate per meter based on ₱14,900 per 150m roll',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  {
    id: 'cl-seed-5',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'AC Wire AWG #8',
    changeType: 'price',
    fieldChanged: 'Unit Price (Per Meter)',
    oldValue: '₱300.00 / m',
    newValue: '₱60.04 / m',
    unit: 'M',
    note: '[SysPrc] Updated rate per meter from ₱300 to ₱60.04 based on ₱9,006 per 150m roll',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  {
    id: 'cl-seed-6',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Ground Wire',
    changeType: 'system',
    fieldChanged: 'Description, Unit, Price & Qty',
    oldValue: 'Ground Wire 30m @ ₱1,300.00 / ROLL',
    newValue: 'Ground Wire @ ₱39.25 / M, Qty: 50',
    unit: 'M',
    note: '[SysPrc] Renamed from Ground Wire 30m to Ground Wire, unit from ROLL to M, rate to ₱39.25/m (₱5,888 per 150m roll), default qty set to 50',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  {
    id: 'cl-seed-7',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Flexible hose',
    changeType: 'quantity',
    fieldChanged: 'Default Quantity',
    oldValue: 'Dynamic (e.g. 35m)',
    newValue: '50m',
    unit: 'M',
    note: '[SysPrc] Default quantity updated to 50 meters',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc & MsG)'
  },
  // ── SET DATE: AUGUST 01, 2026 ──
  {
    id: 'cl-seed-8',
    timestamp: 'Aug 01, 2026, 08:00 AM',
    itemDescription: 'Tongwei Solar Panel 620W N-Type',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱5,800.00',
    newValue: '₱5,456.00',
    unit: 'PCS',
    note: 'Updated to GEPC August 1 Tier 1 Subdealer rate matrix',
    batch: 'August 01, 2026 GEPC Price Sheet Release'
  },
  {
    id: 'cl-seed-9',
    timestamp: 'Aug 01, 2026, 08:00 AM',
    itemDescription: 'GoodWe 12kW Three Phase Hybrid Inverter',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱82,000.00',
    newValue: '₱78,000.00',
    unit: 'UNIT',
    note: 'Monthly promotional pricing adjustment',
    batch: 'August 01, 2026 GEPC Price Sheet Release'
  },
  // ── SET DATE: JUNE 15, 2026 ──
  {
    id: 'cl-seed-10',
    timestamp: 'Jun 15, 2026, 10:30 AM',
    itemDescription: 'Solar Railings 2.4m Aluminum Heavy Duty',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱490.00',
    unit: 'PCS',
    note: 'Added heavy duty aluminum mounting rail item into hardware catalog',
    batch: 'June 15, 2026 Angel Solar Hardware Release'
  }
]

export function getChangelogHistory(): ChangelogItem[] {
  if (typeof window === 'undefined') return INITIAL_CHANGELOG_SEED
  try {
    const raw = localStorage.getItem(CHANGELOG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasTrina = parsed.some((i: ChangelogItem) => i.id === 'cl-seed-trina')
        if (!hasTrina) {
          localStorage.setItem(CHANGELOG_KEY, JSON.stringify(INITIAL_CHANGELOG_SEED))
          return INITIAL_CHANGELOG_SEED
        }
        return parsed
      }
    }
  } catch (e) {
    console.error('Failed to load changelog from localStorage', e)
  }
  try {
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(INITIAL_CHANGELOG_SEED))
  } catch {}
  return INITIAL_CHANGELOG_SEED
}

export function saveChangelogEntry(entry: Omit<ChangelogItem, 'id' | 'timestamp'>): ChangelogItem[] {
  if (typeof window === 'undefined') return []
  try {
    const current = getChangelogHistory()
    const now = new Date()
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const newEntry: ChangelogItem = {
      id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: formattedDate,
      ...entry,
    }

    const updated = [newEntry, ...current].slice(0, 100)
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.error('Failed to save changelog entry', e)
    return getChangelogHistory()
  }
}

export function deleteChangelogItem(id: string): ChangelogItem[] {
  if (typeof window === 'undefined') return []
  try {
    const current = getChangelogHistory()
    const filtered = current.filter((item) => item.id !== id)
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(filtered))
    return filtered
  } catch (e) {
    console.error('Failed to delete changelog item', e)
    return getChangelogHistory()
  }
}

export function clearChangelogHistory(): ChangelogItem[] {
  if (typeof window === 'undefined') return []
  try {
    localStorage.removeItem(CHANGELOG_KEY)
  } catch (e) {
    console.error('Failed to clear changelog history', e)
  }
  return []
}

export function resetChangelogToInitial(): ChangelogItem[] {
  if (typeof window === 'undefined') return INITIAL_CHANGELOG_SEED
  try {
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(INITIAL_CHANGELOG_SEED))
  } catch (e) {
    console.error('Failed to reset changelog', e)
  }
  return INITIAL_CHANGELOG_SEED
}

export interface PriceListItem {
  code: string
  name: string
  keywords: string[]
  meterPrice: number
  rollPrice: number
  meterUnit: string
  rollUnit: string
}

export const SOLAR_PRICELIST_2026: PriceListItem[] = [
  {
    code: 'SOL-028',
    name: 'Alpsolar 10.24kWh 200Ah Lithium Battery',
    keywords: ['alpsolar 10.24kwh', 'alpsolar 200ah', 'alpsolar battery', 'alpsolar 10.24kwh 200ah'],
    meterPrice: 70000,
    rollPrice: 70000,
    meterUnit: 'Unit',
    rollUnit: 'Unit',
  },
  {
    code: 'SOL-029',
    name: 'Alpsolar 16.07kWh 314Ah Lithium Battery',
    keywords: ['alpsolar 16.07kwh', 'alpsolar 314ah', 'alpsolar battery 314ah', 'alpsolar 16.07kwh 314ah'],
    meterPrice: 93000,
    rollPrice: 93000,
    meterUnit: 'Unit',
    rollUnit: 'Unit',
  },
  {
    code: 'SOL-030',
    name: 'Oliter 10.24kWh 200Ah Lithium Battery',
    keywords: ['oliter 10.24kwh', 'oliter 200ah', 'oliter battery', 'oliter 10.24kwh 200ah'],
    meterPrice: 70000,
    rollPrice: 70000,
    meterUnit: 'Unit',
    rollUnit: 'Unit',
  },
  {
    code: 'SOL-123',
    name: '10mm Battery Cable',
    keywords: ['battery cable 10mm', '10mm battery cable', '10mm cable'],
    meterPrice: 300,
    rollPrice: 23000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-124',
    name: '16mm Battery Cable',
    keywords: ['battery cable 16mm', '16mm battery cable', '16mm cable'],
    meterPrice: 400,
    rollPrice: 33000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-125',
    name: '25mm Battery Cable',
    keywords: ['battery cable 25mm', '25mm battery cable', '25mm cable'],
    meterPrice: 500,
    rollPrice: 43000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-126',
    name: '35mm Battery Cable',
    keywords: ['battery cable 35mm', '35mm battery cable', '35mm cable'],
    meterPrice: 600,
    rollPrice: 53000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-127',
    name: '50mm Battery Cable / 50mm2 AC Output Cable',
    keywords: ['battery cable 50mm', '50mm battery cable', '50mm cable', '50mm2 3-phase ac power output cable', '50mm2 ac power', '50mm2'],
    meterPrice: 700,
    rollPrice: 63000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-128',
    name: '70mm Battery Cable',
    keywords: ['battery cable 70mm', '70mm battery cable', '70mm cable'],
    meterPrice: 950,
    rollPrice: 83000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-038',
    name: '1x4mm Solar Wire',
    keywords: ['1x4mm solar wire', '4mm solar wire', '4mm2 solar pv cable', '4mm solar cable', '1x4mm'],
    meterPrice: 42,
    rollPrice: 4200,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-039',
    name: '1x6mm Solar Wire / 6mm2 TUV Cable',
    keywords: ['1x6mm solar wire', '6mm solar wire', '6mm2 tuv dual-core solar pv cable', '6mm2 solar cable', '6mm2 tuv', '6mm solar cable', '1x6mm'],
    meterPrice: 125,
    rollPrice: 12500,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-040',
    name: '2x4mm Twin Core Solar Wire',
    keywords: ['2x4mm solar wire', '2x4mm twin core', '2x4mm'],
    meterPrice: 88,
    rollPrice: 8800,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-041',
    name: '2x6mm Twin Core Solar Wire',
    keywords: ['2x6mm solar wire', '2x6mm twin core', '2x6mm'],
    meterPrice: 128,
    rollPrice: 12800,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-047',
    name: 'HDPE Pipe 20mm',
    keywords: ['hdpe pipe 20mm', '20mm hdpe', '20mm diameter conduit'],
    meterPrice: 32.5,
    rollPrice: 6500,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-048',
    name: 'HDPE Pipe 25mm',
    keywords: ['hdpe pipe 25mm', '25mm hdpe', '25mm diameter conduit'],
    meterPrice: 34.5,
    rollPrice: 6900,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-049',
    name: 'HDPE Pipe 32mm',
    keywords: ['hdpe pipe 32mm', '32mm hdpe', '32mm diameter conduit'],
    meterPrice: 37.0,
    rollPrice: 7400,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-050',
    name: 'HDPE Pipe 40mm',
    keywords: ['hdpe pipe 40mm', '40mm hdpe', '40mm diameter conduit'],
    meterPrice: 39.5,
    rollPrice: 7900,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-092-B',
    name: 'Breaker box / Metal Enclosure',
    keywords: ['breaker box', 'metal enclosure', 'breaker box / metal enclosure'],
    meterPrice: 3000,
    rollPrice: 3000,
    meterUnit: 'PC',
    rollUnit: 'PC',
  },
  {
    code: 'SOL-170',
    name: 'Cable Tray',
    keywords: ['cable tray', 'cable tray 560', 'tray'],
    meterPrice: 560,
    rollPrice: 560,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-110',
    name: 'Terminal Lugs',
    keywords: ['terminal lugs', 'terminal lug', 'lugs'],
    meterPrice: 40,
    rollPrice: 40,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-124-AC',
    name: 'AC Wire #6 AWG 14mm²',
    keywords: ['ac wire #6 awg 14mm²', 'ac wire 14mm²', '#6 awg 14mm²', '14mm² ac wire', '#6 awg'],
    meterPrice: 14900 / 150,
    rollPrice: 14900,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-123-AC',
    name: 'AC Wire AWG #8',
    keywords: ['ac wire awg #8', 'ac wire #8', 'awg #8', '10mm² ac wire', '#8 awg'],
    meterPrice: 60.04,
    rollPrice: 9006,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-152',
    name: 'Ground Wire',
    keywords: ['ground wire', 'grounding wire', 'ground wire 6mm²', 'ground wire 10mm²'],
    meterPrice: 5888 / 150,
    rollPrice: 5888,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-031',
    name: 'Solar Railing 2.4m',
    keywords: ['railings 2.4m', 'solar railing 2.4m', 'solar railing', 'railing 2.4m', 'railings', 'railing'],
    meterPrice: 490,
    rollPrice: 490,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-090',
    name: 'DC SPD 600V 2-Pole',
    keywords: ['dc spd 600v', 'dc spd 600v 2-pole', '600v dc spd'],
    meterPrice: 500,
    rollPrice: 500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-091',
    name: 'DC SPD 1000V 2-Pole',
    keywords: ['dc spd 1000v', 'dc spd 1000v 2-pole', '1000v dc spd', 'dc spd 1000v dc'],
    meterPrice: 650,
    rollPrice: 650,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-095',
    name: 'DC MCCB 100A 2-Pole',
    keywords: ['dc mccb 100a', 'dc mccb 100a 2-pole', 'mccb for battery 100a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-096',
    name: 'DC MCCB 125A 2-Pole',
    keywords: ['dc mccb 125a', 'dc mccb 125a 2-pole', 'mccb for battery 125a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-097',
    name: 'DC MCCB 160A 2-Pole',
    keywords: ['dc mccb 160a', 'dc mccb 160a 2-pole', 'mccb for battery 160a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-098',
    name: 'DC MCCB 200A 2-Pole',
    keywords: ['dc mccb 200a', 'dc mccb 200a 2-pole', 'mccb for battery 200a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-099',
    name: 'DC MCCB 250A 2-Pole',
    keywords: ['dc mccb 250a', 'dc mccb 250a 2-pole', 'mccb for battery 250a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-100',
    name: 'DC MCCB 315A 3-Pole',
    keywords: ['dc mccb 315a', 'dc mccb 315a 3-pole', 'mccb for battery 315a', 'mccb for battery 300a', 'mccb for battery 350a'],
    meterPrice: 3800,
    rollPrice: 3800,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-101',
    name: 'DC MCCB 400A 3-Pole',
    keywords: ['dc mccb 400a', 'dc mccb 400a 3-pole', 'mccb for battery 400a'],
    meterPrice: 3800,
    rollPrice: 3800,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-101B',
    name: 'DC MCCB 613A / 630A Heavy Duty 3-Pole',
    keywords: ['dc mccb 600a', 'dc mccb 613a', 'dc mccb 630a', 'mccb for battery 500a', 'mccb for battery 600a', 'mccb for battery 613a', 'mccb for battery 630a'],
    meterPrice: 4500,
    rollPrice: 4500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-153',
    name: 'Ground Rod w/ Clamp 3 Meters',
    keywords: ['ground rod w/ clamp 3 meters', 'ground rod 3 meters', 'ground rod', 'grounding rod 1500mm', '1500mm grounding rod'],
    meterPrice: 750,
    rollPrice: 750,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-001',
    name: 'Jinko 620W Solar Panel',
    keywords: ['jinko 620w', 'jinko panel 620w', 'jinko 620'],
    meterPrice: 5750,
    rollPrice: 5750,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-002',
    name: 'Jinko 640W Solar Panel',
    keywords: ['jinko 640w', 'jinko panel 640w', 'jinko 640'],
    meterPrice: 5950,
    rollPrice: 5950,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-003',
    name: 'Jinko 650W Solar Panel',
    keywords: ['jinko 650w', 'jinko panel 650w', 'jinko 650'],
    meterPrice: 6050,
    rollPrice: 6050,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-004',
    name: 'Trina 620W Solar Panel',
    keywords: ['trina 620w', 'trina solar 620w', 'trina panel', 'trina 620'],
    meterPrice: 5700,
    rollPrice: 5700,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-005',
    name: 'Seraphim 630W Solar Panel',
    keywords: ['seraphim 630w', 'seraphim panel', 'seraphim 630'],
    meterPrice: 5500,
    rollPrice: 5500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-006',
    name: 'Lesso 630W Solar Panel',
    keywords: ['lesso 630w', 'lesso panel', 'lesso 630'],
    meterPrice: 5500,
    rollPrice: 5500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
]

export function getItemPricingInfo(
  description: string,
  itemState?: { meterPrice?: number; rollPrice?: number }
) {
  if (itemState?.meterPrice !== undefined && itemState?.rollPrice !== undefined) {
    return {
      supportsRollPricing: true,
      meterPrice: itemState.meterPrice,
      rollPrice: itemState.rollPrice,
      meterUnit: 'Meters',
      rollUnit: 'Roll',
    }
  }

  if (!description) return null
  const descLower = description.toLowerCase()

  const match = SOLAR_PRICELIST_2026.find((item) =>
    item.keywords.some((kw) => descLower.includes(kw))
  )

  if (match) {
    return {
      supportsRollPricing: true,
      code: match.code,
      name: match.name,
      meterPrice: match.meterPrice,
      rollPrice: match.rollPrice,
      meterUnit: match.meterUnit,
      rollUnit: match.rollUnit,
    }
  }

  return null
}
