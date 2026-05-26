'use client'

import { useState, useEffect, useCallback } from 'react'
import { type Invoice, type LineItem, newLineItem, defaultInvoice } from './types'
import { loadInvoice, saveInvoice } from './store'

export function useMGInvoice() {
  const [invoice, setInvoice] = useState<Invoice>(defaultInvoice)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadInvoice().then((saved) => {
      if (saved) {
        const sanitized: Invoice = { ...defaultInvoice }
        
        for (const key of Object.keys(defaultInvoice) as (keyof Invoice)[]) {
          if (key === 'lineItems') {
            const rawItems = Array.isArray(saved.lineItems) ? saved.lineItems : defaultInvoice.lineItems
            sanitized.lineItems = rawItems.map((item: any, idx) => ({
              id: item?.id || `item-${idx}-${Date.now()}`,
              description: item?.description && item.description !== 'undefined' ? String(item.description) : '',
              unit: item?.unit && item.unit !== 'undefined' ? String(item.unit) : '',
              quantity: typeof item?.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 1,
              rate: typeof item?.rate === 'number' && !isNaN(item.rate) ? item.rate : 0,
            }))
            continue
          }
          
          const savedVal = saved[key]
          const defaultVal = defaultInvoice[key]
          
          if (typeof defaultVal === 'number') {
            (sanitized as any)[key] = typeof savedVal === 'number' && !isNaN(savedVal) ? savedVal : defaultVal
          } else {
            (sanitized as any)[key] = savedVal !== undefined && savedVal !== null && savedVal !== 'undefined' ? String(savedVal) : defaultVal
          }
        }
        
        setInvoice(sanitized)
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
        if (field === 'vatRate') {
          overrides.vatRate = parseFloat(value) || 0
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
    setInvoice((prev) => ({ ...prev, [field]: value }))
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

  return { invoice, loaded, update, updateItem, addItem, removeItem }
}
