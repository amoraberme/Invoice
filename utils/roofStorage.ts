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

  // 1. In-memory session cache (fastest, preserves everything during tab switching)
  if (memoryRoofCache[key]) {
    return memoryRoofCache[key]
  }
  if (memoryRoofCache[GLOBAL_KEY]) {
    return memoryRoofCache[GLOBAL_KEY]
  }

  // 2. Synchronous localStorage lookup
  try {
    const raw = localStorage.getItem(key) || localStorage.getItem(GLOBAL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as RoofState
      if (parsed && typeof parsed === 'object') {
        memoryRoofCache[key] = parsed
        return parsed
      }
    }
  } catch (err) {
    console.warn('[RoofStorage] Error loading synchronous cache from localStorage:', err)
  }

  return null
}

/**
 * Asynchronous load checking IndexedDB (recovers large uploaded imagery if omitted from localStorage quota)
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
          // Fallback to global key in IDB
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
      // If syncState exists but lacked backgroundImageUrl (due to quota), augment it
      if (syncState && !syncState.backgroundImageUrl && idbState.backgroundImageUrl) {
        syncState.backgroundImageUrl = idbState.backgroundImageUrl
        memoryRoofCache[key] = syncState
        return syncState
      }
      memoryRoofCache[key] = idbState
      return idbState
    }
  } catch (err) {
    console.warn('[RoofStorage] IndexedDB read failed, falling back to sync cache:', err)
  }

  return syncState
}

/**
 * Saves the current working roof state to Memory, localStorage, and IndexedDB
 */
export async function saveRoofWorkspace(state: RoofState, invoiceNumber?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const key = getStorageKey(invoiceNumber)

  // 1. Update in-memory session cache immediately
  memoryRoofCache[key] = state
  memoryRoofCache[GLOBAL_KEY] = state

  // 2. Persist to localStorage
  try {
    localStorage.setItem(key, JSON.stringify(state))
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(state))
  } catch (quotaError) {
    // If quota exceeded (usually due to a multi-megabyte base64 background image),
    // save the layout geometry/panels without the heavy image in localStorage
    console.warn('[RoofStorage] localStorage quota reached. Preserving geometry and caching image in IndexedDB...')
    try {
      const lightweightState = { ...state, backgroundImageUrl: null }
      localStorage.setItem(key, JSON.stringify(lightweightState))
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(lightweightState))
    } catch (fallbackError) {
      console.error('[RoofStorage] Could not write lightweight state to localStorage:', fallbackError)
    }
  }

  // 3. Persist complete state (with high-res background image) to IndexedDB
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
    console.warn('[RoofStorage] IndexedDB save warning:', idbErr)
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
    console.warn('[RoofStorage] Error clearing localStorage:', err)
  }

  try {
    const db = await openRoofDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    if (key !== GLOBAL_KEY) {
      tx.objectStore(STORE_NAME).delete(GLOBAL_KEY)
    }
  } catch (err) {
    console.warn('[RoofStorage] Error clearing IndexedDB:', err)
  }
}
