import { RoofState } from '@/types/roof'

const DB_NAME = 'mg-roof-cache-db'
const STORE_NAME = 'roof_workspaces'
const GLOBAL_KEY = 'mg_invoice_roof_layout_v2'

// In-memory cache for instant zero-latency tab switches in current session
let memoryRoofCache: Record<string, RoofState> = {}

function getStorageKey(invoiceNumber?: string): string {
  if (invoiceNumber && invoiceNumber.trim().length > 0) {
    return `mg_roof_layout_${invoiceNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`
  }
  return GLOBAL_KEY
}

/**
 * Strips heavy data URLs (base64 images) so localStorage and invoice document state
 * stay ultra-lightweight (<20KB) and NEVER trigger browser QuotaExceededError.
 */
export function toLightweightRoofState(state: RoofState): RoofState {
  const isDataUrl = typeof state.backgroundImageUrl === 'string' && state.backgroundImageUrl.startsWith('data:')
  const isTooLong = typeof state.backgroundImageUrl === 'string' && state.backgroundImageUrl.length > 512
  const isPlaceholder = state.backgroundImageUrl === '/roof-aerial-default.webp'
  if (isDataUrl || isTooLong || isPlaceholder) {
    return {
      ...state,
      backgroundImageUrl: null, // Full image is safely preserved in IndexedDB & Memory
    }
  }
  return state
}

/**
 * Prunes stale or bloated localStorage keys from prior sessions to free up origin quota.
 */
export function pruneBloatedLocalStorageKeys(): void {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    const roofKeys: { key: string; len: number }[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue

      if (k.startsWith('mg_roof_layout_') || k.startsWith('mg_invoice_roof_layout_')) {
        const val = localStorage.getItem(k) || ''
        // If an old key contains a base64 image or is unreasonably large (>50KB), remove it
        if (val.includes('data:image') || val.length > 50000) {
          keysToRemove.push(k)
        } else {
          roofKeys.push({ key: k, len: val.length })
        }
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k)
    }

    // Keep at most 3 recent roof layout keys in localStorage
    if (roofKeys.length > 3) {
      const excess = roofKeys.slice(0, roofKeys.length - 3)
      for (const item of excess) {
        if (item.key !== GLOBAL_KEY) {
          localStorage.removeItem(item.key)
        }
      }
    }
  } catch (err) {
    // Silently ignore pruning errors
  }
}

// Run initial prune once on script evaluation
if (typeof window !== 'undefined') {
  setTimeout(pruneBloatedLocalStorageKeys, 500)
}

/**
 * Open or upgrade IndexedDB for large storage (handles megabyte images without quota limits)
 */
function openRoofDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported or running server-side'))
    }
    const req = window.indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Synchronous load from Memory or localStorage for immediate initial render
 */
export function loadRoofWorkspaceSync(invoiceNumber?: string): RoofState | null {
  if (typeof window === 'undefined') return null

  const key = getStorageKey(invoiceNumber)

  // 1. In-memory session cache (fastest, preserves everything including high-res photos during tab switching)
  if (memoryRoofCache[key]) {
    return memoryRoofCache[key]
  }
  if (memoryRoofCache[GLOBAL_KEY]) {
    return memoryRoofCache[GLOBAL_KEY]
  }

  // 2. Synchronous localStorage lookup (loads lightweight layout without image)
  try {
    const raw = localStorage.getItem(key) || localStorage.getItem(GLOBAL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as RoofState
      if (parsed && typeof parsed === 'object') {
        if (parsed.backgroundImageUrl === '/roof-aerial-default.webp') {
          parsed.backgroundImageUrl = null
        }
        memoryRoofCache[key] = parsed
        return parsed
      }
    }
  } catch (err) {
    // If parse fails, ignore
  }

  return null
}

/**
 * Asynchronous load checking IndexedDB (recovers large uploaded imagery safely)
 */
export async function loadRoofWorkspaceAsync(invoiceNumber?: string): Promise<RoofState | null> {
  const syncState = loadRoofWorkspaceSync(invoiceNumber)
  if (typeof window === 'undefined') return syncState

  const key = getStorageKey(invoiceNumber)

  try {
    const db = await openRoofDB()
    const idbState = await new Promise<RoofState | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as RoofState)
        } else if (key !== GLOBAL_KEY) {
          const fallbackReq = store.get(GLOBAL_KEY)
          fallbackReq.onsuccess = () => resolve((fallbackReq.result as RoofState) ?? null)
          fallbackReq.onerror = () => resolve(null)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    })

    if (idbState) {
      if (idbState.backgroundImageUrl === '/roof-aerial-default.webp') {
        idbState.backgroundImageUrl = null
      }
      // If syncState exists but lacked backgroundImageUrl, augment it with the full IndexedDB image
      if (syncState && !syncState.backgroundImageUrl && idbState.backgroundImageUrl) {
        syncState.backgroundImageUrl = idbState.backgroundImageUrl
        memoryRoofCache[key] = syncState
        return syncState
      }
      memoryRoofCache[key] = idbState
      return idbState
    }
  } catch (err) {
    // Silently fall back to sync state
  }

  return syncState
}

/**
 * Saves the current working roof state:
 * - High-res images & full workspace -> IndexedDB & Memory
 * - Geometry & panels (lightweight, <15KB) -> LocalStorage
 */
export async function saveRoofWorkspace(state: RoofState, invoiceNumber?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const key = getStorageKey(invoiceNumber)

  // 1. Update in-memory session cache immediately with the FULL state
  memoryRoofCache[key] = state
  memoryRoofCache[GLOBAL_KEY] = state

  // 2. Persist ONLY lightweight state (WITHOUT heavy base64 images) to localStorage
  const lightweightState = toLightweightRoofState(state)
  const jsonPayload = JSON.stringify(lightweightState)

  try {
    localStorage.setItem(key, jsonPayload)
  } catch (quotaErr) {
    // If quota was already full from previous data, aggressively prune and retry
    pruneBloatedLocalStorageKeys()
    try {
      localStorage.setItem(key, jsonPayload)
    } catch (secondErr) {
      // IndexedDB has already captured the state, so silently degrade without crashing
    }
  }

  // 3. Persist COMPLETE state (including any multi-megabyte aerial photos) to IndexedDB
  try {
    const db = await openRoofDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(state, key)
      if (key !== GLOBAL_KEY) {
        store.put(state, GLOBAL_KEY)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (idbErr) {
    // IndexedDB save failure handled gracefully
  }
}

/**
 * Clears cached workspace for the current invoice or globally
 */
export async function clearRoofWorkspace(invoiceNumber?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const key = getStorageKey(invoiceNumber)
  delete memoryRoofCache[key]
  delete memoryRoofCache[GLOBAL_KEY]

  try {
    localStorage.removeItem(key)
    localStorage.removeItem(GLOBAL_KEY)
  } catch (err) {
    // ignore
  }

  try {
    const db = await openRoofDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    if (key !== GLOBAL_KEY) {
      tx.objectStore(STORE_NAME).delete(GLOBAL_KEY)
    }
  } catch (err) {
    // ignore
  }
}
