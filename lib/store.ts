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
