'use client'

import { useState, useEffect, useCallback } from 'react'
import { type Invoice, type LineItem, type ExpenseItem, newLineItem, newExpenseItem, defaultInvoice, defaultWarranties } from './types'
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
            sanitized.warranties = (rawWarr as Record<string, unknown>[]).map((w, idx) => ({
              id: typeof w?.id === 'string' ? w.id : `warr-${idx}-${Date.now()}`,
              component: w?.component && w.component !== 'undefined' ? String(w.component) : '',
              warrantyType: w?.warrantyType && w.warrantyType !== 'undefined' ? String(w.warrantyType) : 'Manufacturer Warranty',
              coverage: w?.coverage && w.coverage !== 'undefined' ? String(w.coverage) : '',
            }))
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
          
          const savedVal = savedObj[key]
          const defaultVal = defaultInvoice[key]
          
          if (typeof defaultVal === 'boolean') {
            ;(sanitized as unknown as Record<string, unknown>)[key] = savedVal === true || savedVal === 'true'
          } else if (typeof defaultVal === 'number') {
            const parsed = parseFloat(String(savedVal))
            let numVal = !isNaN(parsed) ? parsed : defaultVal
            if (key === 'rateMarkup' && (numVal === 25 || numVal === 28 || savedVal === undefined || savedVal === null || savedVal === '25' || savedVal === '28')) {
              numVal = 30
            }
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
          if (field === 'rateMarkup' && numVal === 25) {
            numVal = 28
          }
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

  const update = useCallback(<K extends keyof Invoice>(field: K, value: Invoice[K]) => {
    setInvoice((prev) => {
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
      return next
    })
  }, [])

  const updateItem = useCallback(
    (id: string, field: keyof LineItem, value: string | number) => {
      setInvoice((prev) => ({
        ...prev,
        lineItems: prev.lineItems.map((item) =>
          item.id === id ? { ...item, [field]: value } : item,
        ),
      }))
    },
    [],
  )

  const addItem = useCallback(() => {
    setInvoice((prev) => ({ ...prev, lineItems: [...prev.lineItems, newLineItem()] }))
  }, [])

  const removeItem = useCallback((id: string) => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((item) => item.id !== id),
    }))
  }, [])

  const addExpenseItem = useCallback((desc = '', amount = 0, category: ExpenseItem['category'] = 'additional') => {
    setInvoice((prev) => {
      const current = prev.additionalExpenses || []
      if (current.length >= 7) return prev
      return {
        ...prev,
        additionalExpenses: [...current, newExpenseItem(desc, amount, category)],
      }
    })
  }, [])

  const updateExpenseItem = useCallback((id: string, field: keyof ExpenseItem, value: any) => {
    setInvoice((prev) => ({
      ...prev,
      additionalExpenses: (prev.additionalExpenses || []).map((exp) =>
        exp.id === id ? { ...exp, [field]: value } : exp,
      ),
    }))
  }, [])

  const removeExpenseItem = useCallback((id: string) => {
    setInvoice((prev) => ({
      ...prev,
      additionalExpenses: (prev.additionalExpenses || []).filter((exp) => exp.id !== id),
    }))
  }, [])

  const setInvoiceWrapped = useCallback((val: Invoice | ((prev: Invoice) => Invoice)) => {
    setInvoice((prev) => {
      const next = typeof val === 'function' ? val(prev) : val
      const nextSync = { ...next }
      nextSync.fromEmail = nextSync.salesEmail
      nextSync.fromPhone = nextSync.salesContact
      
      if (!nextSync.dueDate || nextSync.issueDate !== prev.issueDate) {
        nextSync.dueDate = addDays(nextSync.issueDate || getTodayStr(), 15)
      }
      return nextSync
    })
  }, [])

  const updateItemFields = useCallback((id: string, fields: Partial<LineItem>) => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) =>
        item.id === id ? { ...item, ...fields } : item,
      ),
    }))
  }, [])

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
  }
}
