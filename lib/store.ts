import type { Invoice, InvoiceHistoryItem } from './types'
import { isBatteryItem } from './utils'

const DB_NAME = 'mg-invoice-db'
const STORE_NAME = 'data'
const INVOICE_KEY = 'current-invoice'
const HISTORY_KEY = 'mg-invoice-history'

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
    meterPrice: 44,
    rollPrice: 4400,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-039',
    name: '1x6mm Solar Wire / 6mm2 TUV Cable',
    keywords: ['1x6mm solar wire', '6mm solar wire', '6mm2 tuv dual-core solar pv cable', '6mm2 solar cable', '6mm2 tuv', '6mm solar cable', '1x6mm'],
    meterPrice: 12,
    rollPrice: 4800,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-040',
    name: '2x4mm Twin Core Solar Wire',
    keywords: ['2x4mm solar wire', '2x4mm twin core', '2x4mm'],
    meterPrice: 94,
    rollPrice: 9400,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-041',
    name: '2x6mm Twin Core Solar Wire',
    keywords: ['2x6mm solar wire', '2x6mm twin core', '2x6mm'],
    meterPrice: 134,
    rollPrice: 12800,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-047',
    name: 'HDPE Pipe 20mm',
    keywords: ['hdpe pipe 20mm', '20mm hdpe', '20mm diameter conduit'],
    meterPrice: 34.5,
    rollPrice: 6900,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-048',
    name: 'HDPE Pipe 25mm',
    keywords: ['hdpe pipe 25mm', '25mm hdpe', '25mm diameter conduit'],
    meterPrice: 36.0,
    rollPrice: 7200,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-049',
    name: 'HDPE Pipe 32mm',
    keywords: ['hdpe pipe 32mm', '32mm hdpe', '32mm diameter conduit'],
    meterPrice: 40.0,
    rollPrice: 8000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-050',
    name: 'HDPE Pipe 40mm',
    keywords: ['hdpe pipe 40mm', '40mm hdpe', '40mm diameter conduit'],
    meterPrice: 42.5,
    rollPrice: 8500,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
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
