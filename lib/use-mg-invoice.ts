'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type Invoice, type LineItem, type ExpenseItem, type SystemLifespanConfig, newLineItem, newExpenseItem, defaultInvoice, defaultWarranties, getDefaultSystemLifespan } from './types'
import { loadInvoice, saveInvoice } from './store'
import { generateDocumentId, addDays } from './utils'

function getTodayStr(): string {
  const date = new Date()
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function useMGInvoice() {
  const [invoice, setInvoice] = useState<Invoice>(defaultInvoice)
  const [loaded, setLoaded] = useState(false)
  const invoiceRef = useRef<Invoice>(defaultInvoice)
  const undoStackRef = useRef<Invoice[]>([])
  const redoStackRef = useRef<Invoice[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const lastBurstKeyRef = useRef<string | null>(null)
  const lastBurstTimeRef = useRef<number>(0)

  useEffect(() => {
    invoiceRef.current = invoice
  }, [invoice])

  useEffect(() => {
    loadInvoice().then((saved) => {
      const todayStr = getTodayStr()

      if (saved) {
        const sanitized: Invoice = { ...defaultInvoice }
        const savedObj = saved as unknown as Record<string, unknown>
        
        for (const key of Object.keys(defaultInvoice) as (keyof Invoice)[]) {
          if (key === 'lineItems') {
            const rawItems = Array.isArray(savedObj.lineItems) ? savedObj.lineItems : defaultInvoice.lineItems
            sanitized.lineItems = (rawItems as Record<string, unknown>[]).map((item, idx) => {
              const qty = item?.quantity !== undefined && item?.quantity !== null ? parseFloat(String(item.quantity)) : 1
              const rt = item?.rate !== undefined && item?.rate !== null ? parseFloat(String(item.rate)) : 0
              return {
                id: typeof item?.id === 'string' ? item.id : `item-${idx}-${Date.now()}`,
                description: item?.description && item.description !== 'undefined' ? String(item.description) : '',
                unit: item?.unit && item.unit !== 'undefined' ? String(item.unit) : '',
                quantity: !isNaN(qty) ? qty : 1,
                rate: !isNaN(rt) ? rt : 0,
              }
            })
            continue
          }

          if (key === 'warranties') {
            const rawWarr = Array.isArray(savedObj.warranties) ? savedObj.warranties : defaultWarranties
            sanitized.warranties = (rawWarr as Record<string, unknown>[]).map((w, idx) => {
              const cov = w?.coverage !== undefined && w.coverage !== null && w.coverage !== 'undefined' ? String(w.coverage) : ''
              const comp = w?.component && w.component !== 'undefined' ? String(w.component) : ''
              const wType = w?.warrantyType && w.warrantyType !== 'undefined' ? String(w.warrantyType) : 'Manufacturer Warranty'
              return {
                id: typeof w?.id === 'string' ? w.id : `warr-${idx}-${Date.now()}`,
                component: comp,
                warrantyType: wType,
                coverage: cov,
              }
            })
            continue
          }

          if (key === 'additionalExpenses') {
            const rawExp = Array.isArray(savedObj.additionalExpenses) ? savedObj.additionalExpenses : []
            sanitized.additionalExpenses = (rawExp as Record<string, unknown>[]).map((exp, idx) => {
              const amt = exp?.amount !== undefined && exp?.amount !== null ? parseFloat(String(exp.amount)) : 0
              return {
                id: typeof exp?.id === 'string' ? exp.id : `exp-${idx}-${Date.now()}`,
                description: exp?.description && exp.description !== 'undefined' ? String(exp.description) : '',
                amount: !isNaN(amt) ? amt : 0,
                category: (exp?.category as ExpenseItem['category']) || 'additional',
              }
            })
            continue
          }
          
          if (key === 'systemLifespan') {
            const raw = savedObj.systemLifespan as Partial<SystemLifespanConfig> | undefined
            const def = getDefaultSystemLifespan()
            if (!raw || typeof raw !== 'object') {
              sanitized.systemLifespan = def
            } else {
              const sanitizedItems = Array.isArray(raw.items)
                ? raw.items.map((item) => {
                    const text = (item.bulletPoints || []).join(' ')
                    if (item.id === 'life-panels' && (text.includes('Degrade slowly') || text.includes('no moving parts'))) {
                      return { ...item, lifespan: '25–30+ Yrs', bulletPoints: def.items.find(i => i.id === 'life-panels')?.bulletPoints || item.bulletPoints }
                    }
                    if (item.id === 'life-inverters' && (text.includes('Experience heavy thermal') || text.includes('Electrolytic capacitors'))) {
                      return { ...item, lifespan: '10–15 Yrs', bulletPoints: def.items.find(i => i.id === 'life-inverters')?.bulletPoints || item.bulletPoints }
                    }
                    if (item.id === 'life-batteries' && (text.includes('Rated for 6,000+') || text.includes('usable capacity drops'))) {
                      return { ...item, lifespan: '10–15 Yrs', bulletPoints: def.items.find(i => i.id === 'life-batteries')?.bulletPoints || item.bulletPoints }
                    }
                    return item
                  })
                : def.items

              const sanitizedDets = Array.isArray(raw.determinants)
                ? raw.determinants.some(d => d.includes('Proper shading and ventilation') || d.includes('hotspot formation'))
                  ? def.determinants
                  : raw.determinants
                : def.determinants

              sanitized.systemLifespan = {
                enabled: typeof raw.enabled === 'boolean' ? raw.enabled : def.enabled,
                overviewTitle: raw.overviewTitle || def.overviewTitle,
                overviewDescription: raw.overviewDescription || def.overviewDescription,
                items: sanitizedItems,
                determinantsTitle: raw.determinantsTitle || def.determinantsTitle,
                determinants: sanitizedDets,
              }
            }
            continue
          }
          
          const savedVal = savedObj[key]
          const defaultVal = defaultInvoice[key]
          
          if (key === 'showSystemLifespan') {
            if (savedVal === undefined || savedVal === null) {
              sanitized.showSystemLifespan = true
            } else {
              sanitized.showSystemLifespan = savedVal === true || savedVal === 'true'
            }
            continue
          }

          if (typeof defaultVal === 'boolean') {
            if (savedVal === undefined || savedVal === null) {
              ;(sanitized as unknown as Record<string, unknown>)[key] = defaultVal
            } else {
              ;(sanitized as unknown as Record<string, unknown>)[key] = savedVal === true || savedVal === 'true'
            }
          } else if (typeof defaultVal === 'number') {
            const parsed = parseFloat(String(savedVal))
            let numVal = !isNaN(parsed) ? parsed : defaultVal
            if (key === 'laborPricePerWatt' && (savedVal === undefined || savedVal === null)) {
              numVal = 6
            }
            ;(sanitized as unknown as Record<string, unknown>)[key] = numVal
          } else if (key === 'note') {
            const currentNote = (savedVal !== undefined && savedVal !== null && savedVal !== 'undefined' ? String(savedVal) : defaultInvoice.note) || ''
            if (currentNote.includes('\n\nPlease be advised') || !currentNote.includes('preliminary estimates')) {
              if (!currentNote || currentNote.includes('All items are subject to availability')) {
                sanitized.note = defaultInvoice.note
              } else {
                sanitized.note = `${currentNote.replace(/\n\nPlease be advised[\s\S]*/, '')}\nPlease be advised that all quoted prices, material specifications, quantities, and units of measure (UOM) provided in this document are preliminary estimates. Final pricing and project details are subject to change pending an on-site ocular inspection, roof assessment, structural verification, and evaluation of site-specific conditions.`
              }
            } else {
              sanitized.note = currentNote
            }
          } else if (key === 'terms') {
            const currentTerms = (savedVal !== undefined && savedVal !== null && savedVal !== 'undefined' ? String(savedVal) : defaultInvoice.terms) || ''
            if (
              !currentTerms ||
              currentTerms.includes('50%') ||
              currentTerms.includes('down payment') ||
              currentTerms.includes('GCash') ||
              currentTerms.includes('Check') ||
              currentTerms.includes('15-30 days') ||
              !currentTerms.includes('Full payment after Installation') ||
              !currentTerms.includes('Crypto / Gold')
            ) {
              sanitized.terms = defaultInvoice.terms
            } else {
              sanitized.terms = currentTerms
            }
          } else {
            ;(sanitized as unknown as Record<string, unknown>)[key] = savedVal !== undefined && savedVal !== null && savedVal !== 'undefined' ? String(savedVal) : defaultVal
          }
        }
        
        // Preserve attached roofLayout if present in saved invoice
        if (savedObj.roofLayout && typeof savedObj.roofLayout === 'object') {
          sanitized.roofLayout = savedObj.roofLayout as Invoice['roofLayout']
        }
        
        // Ensure showSystemLifespan and systemLifespan are active for returning users whose localStorage was corrupted to false
        const hasMigratedLifespan = typeof window !== 'undefined' && localStorage.getItem('mg_lifespan_migrated_v2')
        if (!hasMigratedLifespan) {
          sanitized.showSystemLifespan = true
          if (sanitized.systemLifespan) {
            sanitized.systemLifespan.enabled = true
          }
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('mg_lifespan_migrated_v2', 'true')
            } catch {
              // ignore
            }
          }
        }
        
        // Auto-fix any mismatched Subject & Salutation on all devices
        const hasOnGridInverter = (sanitized.lineItems || []).some(it => {
          const d = (it.description || '').toLowerCase()
          return d.includes('on-grid') || d.includes('grid-tied') || d.includes('grid-tie') || d.includes('ongrid')
        })
        const hasBattery = (sanitized.lineItems || []).some(it => {
          const d = (it.description || '').toLowerCase()
          return d.includes('battery') || d.includes('lifepo4') || d.includes('200ah') || d.includes('314ah') || d.includes('100ah')
        })
        const isOnGridInvoice = sanitized.excludeBattery || (hasOnGridInverter && !hasBattery)

        if (isOnGridInvoice) {
          if (sanitized.subject && /hybrid/i.test(sanitized.subject)) {
            sanitized.subject = sanitized.subject
              .replace(/Hybrid\s+System\s+with\s+Battery/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+Solar\s+System/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+System/gi, 'On-Grid Solar System')
              .replace(/Hybrid/gi, 'On-Grid')
          }
          if (sanitized.salutation && /hybrid/i.test(sanitized.salutation)) {
            sanitized.salutation = sanitized.salutation
              .replace(/Hybrid\s+System\s+with\s+Battery/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+Solar\s+System/gi, 'On-Grid Solar System')
              .replace(/Hybrid\s+System/gi, 'On-Grid Solar System')
              .replace(/Hybrid/gi, 'On-Grid')
          }
        }

        if (!sanitized.invoiceNumber || sanitized.invoiceNumber === 'MG-QT-100KW-2026' || sanitized.invoiceNumber === 'INV-0001' || sanitized.invoiceNumber === 'Untitled Quotation') {
          sanitized.invoiceNumber = generateDocumentId('MG-QT')
        }

        sanitized.issueDate = todayStr
        sanitized.dueDate = addDays(todayStr, 15)
        setInvoice(sanitized)
        saveInvoice(sanitized)
      } else {
        const freshId = generateDocumentId('MG-QT')
        const dueStr = addDays(todayStr, 15)
        setInvoice(prev => ({ ...prev, invoiceNumber: freshId, issueDate: todayStr, dueDate: dueStr }))
      }
      setLoaded(true)
    })
  }, [])
 
  useEffect(() => {
    if (!loaded) return
    const params = new URLSearchParams(window.location.search)
    if (!params.size) return
    const overrides: Partial<Invoice> = {}
    for (const [key, value] of params.entries()) {
      if (key in defaultInvoice) {
        const field = key as keyof Invoice
        if (typeof defaultInvoice[field] === 'boolean') {
          (overrides as unknown as Record<string, boolean>)[field] = value === 'true'
        } else if (typeof defaultInvoice[field] === 'number') {
          let numVal = parseFloat(value)
          if (isNaN(numVal)) numVal = defaultInvoice[field] as number
          (overrides as unknown as Record<string, number>)[field] = numVal
        } else if (field !== 'lineItems' && field !== 'additionalExpenses') {
          if (value !== 'undefined') {
            if (field === 'note' && (value.includes('\n\nPlease be advised') || !value.includes('preliminary estimates'))) {
              if (!value || value.includes('All items are subject to availability')) {
                (overrides as Record<string, string>)[field] = defaultInvoice.note
              } else {
                (overrides as Record<string, string>)[field] = `${value.replace(/\n\nPlease be advised[\s\S]*/, '')}\nPlease be advised that all quoted prices, material specifications, quantities, and units of measure (UOM) provided in this document are preliminary estimates. Final pricing and project details are subject to change pending an on-site ocular inspection, roof assessment, structural verification, and evaluation of site-specific conditions.`
              }
            } else {
              (overrides as Record<string, string>)[field] = value
            }
          }
        }
      }
    }
    if (Object.keys(overrides).length > 0) {
      setTimeout(() => {
        setInvoice((prev) => ({ ...prev, ...overrides }))
        if (typeof window !== 'undefined' && window.location.search) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      }, 0)
    }
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => saveInvoice(invoice), 400)
    return () => clearTimeout(timer)
  }, [invoice, loaded])

function hasMeaningfulChange(a: Invoice, b: Invoice): boolean {
  if (a === b) return false
  // Exclude roofLayout from triggering invoice-level undo (Roof CAD manages its own undo history)
  const { roofLayout: _r1, ...rest1 } = a
  const { roofLayout: _r2, ...rest2 } = b
  return JSON.stringify(rest1) !== JSON.stringify(rest2)
}

  const pushSnapshot = useCallback((burstKey: string | null = null) => {
    if (!loaded) return
    const now = Date.now()
    if (burstKey && lastBurstKeyRef.current === burstKey && (now - lastBurstTimeRef.current < 600)) {
      lastBurstTimeRef.current = now
      return
    }

    lastBurstKeyRef.current = burstKey
    lastBurstTimeRef.current = now

    const current = invoiceRef.current
    const last = undoStackRef.current[undoStackRef.current.length - 1]
    if (last && !hasMeaningfulChange(last, current)) {
      return
    }

    const snapshot: Invoice = JSON.parse(JSON.stringify(current))
    undoStackRef.current.push(snapshot)
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift()
    }
    redoStackRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [loaded])

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const current = invoiceRef.current
    const prev = undoStackRef.current.pop()!
    redoStackRef.current.push(JSON.parse(JSON.stringify(current)))
    if (redoStackRef.current.length > 50) {
      redoStackRef.current.shift()
    }

    lastBurstKeyRef.current = null
    invoiceRef.current = prev
    setInvoice(prev)
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
  }, [])

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const current = invoiceRef.current
    const next = redoStackRef.current.pop()!
    undoStackRef.current.push(JSON.parse(JSON.stringify(current)))
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift()
    }

    lastBurstKeyRef.current = null
    invoiceRef.current = next
    setInvoice(next)
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
  }, [])

  const update = useCallback(<K extends keyof Invoice>(field: K, value: Invoice[K]) => {
    // Only capture undo snapshot for non-roofLayout fields (Roof CAD has its own dedicated undo system)
    if (field !== 'roofLayout') {
      pushSnapshot(`field-${String(field)}`)
    }
    setInvoice((prev) => {
      if (prev[field] === value) return prev
      const next = { ...prev, [field]: value }
      if (field === 'salesEmail') {
        next.fromEmail = value as string
      } else if (field === 'fromEmail') {
        next.salesEmail = value as string
      } else if (field === 'salesContact') {
        next.fromPhone = value as string
      } else if (field === 'fromPhone') {
        next.salesContact = value as string
      }
      
      if (field === 'issueDate') {
        next.dueDate = addDays(value as string, 15)
      } else if (!next.dueDate) {
        next.dueDate = addDays(next.issueDate || getTodayStr(), 15)
      }
      invoiceRef.current = next
      return next
    })
  }, [pushSnapshot])

  const updateItem = useCallback(
    (id: string, field: keyof LineItem, value: string | number) => {
      pushSnapshot(`item-${id}-${String(field)}`)
      setInvoice((prev) => {
        const next = {
          ...prev,
          lineItems: prev.lineItems.map((item) =>
            item.id === id ? { ...item, [field]: value } : item,
          ),
        }
        invoiceRef.current = next
        return next
      })
    },
    [pushSnapshot],
  )

  const addItem = useCallback(() => {
    pushSnapshot(null)
    setInvoice((prev) => {
      const next = { ...prev, lineItems: [...prev.lineItems, newLineItem()] }
      invoiceRef.current = next
      return next
    })
  }, [pushSnapshot])

  const removeItem = useCallback((id: string) => {
    pushSnapshot(null)
    setInvoice((prev) => {
      const next = {
        ...prev,
        lineItems: prev.lineItems.filter((item) => item.id !== id),
      }
      invoiceRef.current = next
      return next
    })
  }, [pushSnapshot])

  const addExpenseItem = useCallback((desc = '', amount = 0, category: ExpenseItem['category'] = 'additional') => {
    pushSnapshot(null)
    setInvoice((prev) => {
      const current = prev.additionalExpenses || []
      if (current.length >= 7) return prev
      const next = {
        ...prev,
        additionalExpenses: [...current, newExpenseItem(desc, amount, category)],
      }
      invoiceRef.current = next
      return next
    })
  }, [pushSnapshot])

  const updateExpenseItem = useCallback((id: string, field: keyof ExpenseItem, value: any) => {
    pushSnapshot(`expense-${id}-${String(field)}`)
    setInvoice((prev) => {
      const next = {
        ...prev,
        additionalExpenses: (prev.additionalExpenses || []).map((exp) =>
          exp.id === id ? { ...exp, [field]: value } : exp,
        ),
      }
      invoiceRef.current = next
      return next
    })
  }, [pushSnapshot])

  const removeExpenseItem = useCallback((id: string) => {
    pushSnapshot(null)
    setInvoice((prev) => {
      const next = {
        ...prev,
        additionalExpenses: (prev.additionalExpenses || []).filter((exp) => exp.id !== id),
      }
      invoiceRef.current = next
      return next
    })
  }, [pushSnapshot])

  const setInvoiceWrapped = useCallback((val: Invoice | ((prev: Invoice) => Invoice)) => {
    setInvoice((prev) => {
      const next = typeof val === 'function' ? val(prev) : val
      if (next === prev) return prev

      const nextSync = { ...next }
      nextSync.fromEmail = nextSync.salesEmail
      nextSync.fromPhone = nextSync.salesContact
      
      if (!nextSync.dueDate || nextSync.issueDate !== prev.issueDate) {
        nextSync.dueDate = addDays(nextSync.issueDate || getTodayStr(), 15)
      }

      if (loaded && hasMeaningfulChange(prev, nextSync)) {
        const last = undoStackRef.current[undoStackRef.current.length - 1]
        if (!last || hasMeaningfulChange(last, prev)) {
          const snapshot: Invoice = JSON.parse(JSON.stringify(prev))
          undoStackRef.current.push(snapshot)
          if (undoStackRef.current.length > 50) {
            undoStackRef.current.shift()
          }
          redoStackRef.current = []
          setCanUndo(true)
          setCanRedo(false)
        }
      }

      invoiceRef.current = nextSync
      return nextSync
    })
  }, [loaded])

  const updateItemFields = useCallback((id: string, fields: Partial<LineItem>) => {
    pushSnapshot(`item-fields-${id}`)
    setInvoice((prev) => {
      const next = {
        ...prev,
        lineItems: prev.lineItems.map((item) =>
          item.id === id ? { ...item, ...fields } : item,
        ),
      }
      invoiceRef.current = next
      return next
    })
  }, [pushSnapshot])

  return {
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
    setInvoice: setInvoiceWrapped,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
