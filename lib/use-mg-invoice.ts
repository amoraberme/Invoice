'use client'

import { useState, useEffect, useCallback } from 'react'
import { type Invoice, type LineItem, newLineItem, defaultInvoice } from './types'
import { loadInvoice, saveInvoice } from './store'
import { generateDocumentId, addDays } from './utils'

export function useMGInvoice() {
  const [invoice, setInvoice] = useState<Invoice>(defaultInvoice)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadInvoice().then((saved) => {
      const date = new Date()
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      const todayStr = `${yyyy}-${mm}-${dd}`

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
          
          const savedVal = savedObj[key]
          const defaultVal = defaultInvoice[key]
          
          if (typeof defaultVal === 'boolean') {
            ;(sanitized as unknown as Record<string, unknown>)[key] = savedVal === true || savedVal === 'true'
          } else if (typeof defaultVal === 'number') {
            const parsed = parseFloat(String(savedVal))
            ;(sanitized as unknown as Record<string, unknown>)[key] = !isNaN(parsed) ? parsed : defaultVal
          } else {
            ;(sanitized as unknown as Record<string, unknown>)[key] = savedVal !== undefined && savedVal !== null && savedVal !== 'undefined' ? String(savedVal) : defaultVal
          }
        }
        
        sanitized.issueDate = todayStr
        if (!sanitized.dueDate) {
          sanitized.dueDate = addDays(todayStr, 15)
        }
        setInvoice(sanitized)
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
          (overrides as unknown as Record<string, number>)[field] = parseFloat(value) || 0
        } else if (field !== 'lineItems') {
          if (value !== 'undefined') {
            (overrides as Record<string, string>)[field] = value
          }
        }
      }
    }
    if (Object.keys(overrides).length > 0) {
      setTimeout(() => {
        setInvoice((prev) => ({ ...prev, ...overrides }))
      }, 0)
    }
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(() => saveInvoice(invoice), 400)
    return () => clearTimeout(timer)
  }, [invoice, loaded])

  useEffect(() => {
    if (!loaded) return
    // Start from current params so non-invoice params (e.g. print=true) are preserved
    const params = new URLSearchParams(window.location.search)
    for (const key of Object.keys(defaultInvoice) as (keyof Invoice)[]) {
      if (key === 'lineItems') continue
      const value = invoice[key]
      const def = defaultInvoice[key]
      if (
        value !== def && 
        value !== '' && 
        value !== 0 && 
        value !== undefined && 
        value !== null && 
        String(value) !== 'undefined'
      ) {
        params.set(key, String(value))
      } else {
        params.delete(key)
      }
    }
    const qs = params.size ? `?${params.toString()}` : window.location.pathname
    history.replaceState(null, '', qs)
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

  const setInvoiceWrapped = useCallback((val: Invoice | ((prev: Invoice) => Invoice)) => {
    setInvoice((prev) => {
      const next = typeof val === 'function' ? val(prev) : val
      const nextSync = { ...next }
      nextSync.fromEmail = nextSync.salesEmail
      nextSync.fromPhone = nextSync.salesContact
      
      if (nextSync.issueDate !== prev.issueDate) {
        nextSync.dueDate = addDays(nextSync.issueDate, 15)
      }
      return nextSync
    })
  }, [])

  return { invoice, loaded, update, updateItem, addItem, removeItem, setInvoice: setInvoiceWrapped }
}
