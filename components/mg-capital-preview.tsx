'use client'

import { useRef, useState, useEffect } from 'react'
import { type Invoice } from '@/lib/types'
import { PAPER_W, PAPER_H } from '@/lib/constants'
import { formatDate, formatCurrency, cn, isBatteryItem, calculateTotal } from '@/lib/utils'

import { Lock, ShieldCheck } from 'lucide-react'

interface MGCapitalPreviewProps {
  invoice: Invoice
  hoveredField?: string | null
  isUnlocked?: boolean
  onPagesChange?: (count: number) => void
}

export function MGCapitalPreview({
  invoice,
  hoveredField,
  isUnlocked = true,
  onPagesChange,
}: MGCapitalPreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const recalcScale = () => {
      const available = el.clientWidth - 32
      setScale(Math.min(available / PAPER_W, 1))
    }
    recalcScale()
    const ro = new ResizeObserver(recalcScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    onPagesChange?.(1)
  }, [onPagesChange])

  // Filter line items based on excludeBattery preference
  const items = (invoice.lineItems || []).filter((item) => {
    return !(invoice.excludeBattery && isBatteryItem(item.description))
  })

  // 1. Base Items Capital (0% Markup)
  const itemsBaseCapitalTotal = items.reduce((acc, item) => acc + (item.quantity * item.rate), 0)

  // 2. Logistics & Expenses
  const lalamove = invoice.lalamoveCost || 0
  const additionalExpList = invoice.additionalExpenses || []
  const additionalExpTotal = additionalExpList.reduce((acc, exp) => acc + (exp.amount || 0), 0)
  const totalExpenses = lalamove + additionalExpTotal

  // Subtotal Capital Cost (Items + Expenses)
  const subtotalCapitalCost = itemsBaseCapitalTotal + totalExpenses

  // 3. Client Quotation Selling Price Total (WITH Markup + VAT)
  const clientGrandTotal = calculateTotal(invoice)

  // 4. 3% Sales Markup (Calculated from Selling Total)
  const salesMarkup3Pct = clientGrandTotal * 0.03

  // 5. Total Capital Cost (Subtotal Capital + 3% Sales Markup)
  const totalCapitalWithSalesMarkup = subtotalCapitalCost + salesMarkup3Pct

  // 6. Net Profit & Margin
  const netProfit = clientGrandTotal - totalCapitalWithSalesMarkup
  const netProfitMarginPct = clientGrandTotal > 0 ? (netProfit / clientGrandTotal) * 100 : 0

  const getHighlightClass = (field: string) => {
    const isHovered = hoveredField === field || 
      (field === 'sender' && ['fromName', 'fromEmail', 'fromPhone', 'fromAddress'].includes(hoveredField || '')) ||
      (field === 'client' && ['toName', 'toEmail', 'toAddress'].includes(hoveredField || ''))

    return isHovered 
      ? 'outline outline-[1.5px] outline-[#008B4C] outline-offset-2 bg-[#008B4C]/5 rounded-sm transition-all duration-200' 
      : 'transition-all duration-200'
  }

  if (!isUnlocked) {
    return (
      <div ref={canvasRef} className="w-full flex flex-col items-center py-6 select-none print:py-0 print:w-full">
        <div
          className="bg-white text-[#111111] shadow-2xl rounded-sm print:shadow-none print:rounded-none relative overflow-hidden font-sans border border-[#E5E5E5] p-12 flex flex-col items-center justify-center text-center space-y-6"
          style={{
            width: `${PAPER_W}px`,
            minHeight: `${PAPER_H}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `-${PAPER_H * (1 - scale)}px`,
          }}
        >
          <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center border-2 border-zinc-300 shadow-inner">
            <Lock className="w-10 h-10 text-zinc-800" />
          </div>

          <div className="space-y-2 max-w-md">
            <span className="bg-zinc-900 text-white text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded">
              RESTRICTED ACCESS
            </span>
            <h2 className="text-2xl font-bold text-[#111111] tracking-tight">
              Capital & Expense Worksheet Locked
            </h2>
            <p className="text-xs text-[#666666] leading-relaxed">
              This document contains confidential supplier cost rates, logistics breakdown, and net profit calculations. Enter the passcode in the Capital tab to unlock access.
            </p>
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg max-w-sm w-full space-y-1 font-mono text-xs text-zinc-600">
            <div className="flex items-center justify-center gap-1.5 font-bold text-zinc-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Password Protected Area
            </div>
            <p className="text-[11px] text-zinc-500">
              Authorized personnel only
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={canvasRef} className="w-full flex flex-col items-center py-6 select-none print:py-0 print:w-full">
      <div
        className="bg-white text-[#111111] shadow-2xl rounded-sm print:shadow-none print:rounded-none relative overflow-hidden font-sans border border-[#E5E5E5] print:border-none p-12 flex flex-col justify-between"
        style={{
          width: `${PAPER_W}px`,
          minHeight: `${PAPER_H}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: `-${PAPER_H * (1 - scale)}px`,
        }}
      >
        <div>
          {/* Header matching Quotation Proposal design */}
          <div className="flex justify-between items-start mb-8 border-b border-[#E5E5E5] pb-6">
            <div className={cn("space-y-1 p-1", getHighlightClass('sender'))}>
              <h1 className="text-[26px] font-extrabold text-[#111111] tracking-tight">
                {invoice.fromName || '—'}
              </h1>
              {invoice.fromEmail && (
                <p className="text-[12px] text-[#888888]">{invoice.fromEmail}</p>
              )}
              {invoice.fromPhone && (
                <p className="text-[12px] text-[#888888]">{invoice.fromPhone}</p>
              )}
              {invoice.fromAddress && (
                <p className="text-[12px] text-[#888888] max-w-xs">{invoice.fromAddress}</p>
              )}
              <div className="pt-2">
                <span className="text-[10px] font-bold tracking-wider uppercase bg-[#111111] text-white px-2 py-0.5 rounded-xs">
                  INTERNAL CAPITAL & EXPENSES WORKSHEET
                </span>
              </div>
            </div>

            <div className={cn("text-right flex flex-col items-end p-1", getHighlightClass('invoiceNumber'))}>
              <img
                src="/mg.png"
                alt="INVOICE"
                className="h-[140px] w-auto object-contain mb-1"
              />
              {invoice.invoiceNumber && (
                <p className="text-[12px] font-mono text-[#888888] mt-1">{invoice.invoiceNumber}</p>
              )}
            </div>
          </div>

          {/* Client Info & Dates */}
          <div className="flex justify-between items-start mb-6">
            <div className={cn("max-w-xs p-1", getHighlightClass('client'))}>
              <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1.5">
                Client Target
              </p>
              <p className="font-bold text-[15px] text-[#111111] tracking-tight">
                {invoice.toName || '—'}
              </p>
              {invoice.toEmail && (
                <p className="text-[12px] text-[#888888] mt-0.5">{invoice.toEmail}</p>
              )}
              {invoice.toAddress && (
                <p className="text-[12px] text-[#888888] whitespace-pre-line">{invoice.toAddress}</p>
              )}
            </div>

            <div className="flex gap-8">
              {invoice.issueDate && (
                <div className="text-right p-1">
                  <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                    Issue Date
                  </p>
                  <p className="text-[12px] font-medium text-[#111111]" suppressHydrationWarning>
                    {formatDate(invoice.issueDate)}
                  </p>
                </div>
              )}
              {invoice.salesName && (
                <div className="text-right p-1">
                  <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                    Prepared By
                  </p>
                  <p className="text-[12px] font-medium text-[#111111]">
                    {invoice.salesName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Subject Line */}
          {invoice.subject && (
            <div className="mb-6 pb-2 border-b border-[#E5E5E5]/50 flex gap-2 p-1">
              <span className="text-[12px] font-bold text-[#111111] shrink-0 uppercase tracking-[0.05em]">Subject:</span>
              <span className="text-[12px] font-bold text-[#111111]">{invoice.subject}</span>
            </div>
          )}

          {/* Table 1: Base Line Items Capital (0% Markup) */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-[11px] font-bold text-[#111111] tracking-[0.07em] uppercase">
                1. Selected Items Base Capital (0% Markup)
              </h2>
              <span className="text-[10px] text-[#888888]">
                {items.length} Line Items
              </span>
            </div>

            <div className="flex py-2.5 border-b-[1.5px] border-[#111111]">
              <span className="flex-1 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase">
                Description
              </span>
              <span className="w-16 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-center">
                Unit
              </span>
              <span className="w-14 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-center">
                Qty
              </span>
              <span className="w-28 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
                Capital Rate
              </span>
              <span className="w-32 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
                Capital Amount
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-4 text-center text-[#888888] text-[12px]">No items selected.</div>
            ) : (
              items.map((item) => {
                const capitalAmount = item.quantity * item.rate
                return (
                  <div key={item.id} className="flex py-3 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1">
                    <span className="flex-1 text-[13px] text-[#111111] break-words whitespace-pre-wrap pr-4 font-medium">
                      {item.description || '—'}
                    </span>
                    <span className="w-16 shrink-0 text-[13px] text-[#888888] text-center">
                      {item.unit || '—'}
                    </span>
                    <span className="w-14 shrink-0 text-[13px] text-[#888888] text-center">
                      {item.quantity || '—'}
                    </span>
                    <span className="w-28 shrink-0 text-[13px] text-[#555555] text-right font-mono">
                      {formatCurrency(item.rate, invoice.currency)}
                    </span>
                    <span className="w-32 shrink-0 text-[13px] font-bold text-[#111111] text-right font-mono">
                      {formatCurrency(capitalAmount, invoice.currency)}
                    </span>
                  </div>
                )
              })
            )}

            <div className="flex justify-between items-center py-2.5 px-1 bg-[#F9F9F9] border-b border-[#111111] font-mono text-[12px]">
              <span className="font-bold text-[#111111] uppercase tracking-wider">
                Items Base Capital Subtotal:
              </span>
              <span className="font-bold text-[#111111]">
                {formatCurrency(itemsBaseCapitalTotal, invoice.currency)}
              </span>
            </div>
          </div>

          {/* Table 2: Logistics & Project Expenses */}
          <div className="mb-8">
            <h2 className="text-[11px] font-bold text-[#111111] tracking-[0.07em] uppercase mb-2">
              2. Logistics & Project Expenses
            </h2>

            <div className="flex py-2.5 border-b-[1.5px] border-[#111111]">
              <span className="flex-1 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase">
                Expense Description
              </span>
              <span className="w-28 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-center">
                Category
              </span>
              <span className="w-32 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
                Amount
              </span>
            </div>

            {/* Lalamove */}
            <div className={cn("flex py-3 border-b border-[#E5E5E5] items-center px-1", getHighlightClass('lalamoveCost'))}>
              <span className="flex-1 text-[13px] text-[#111111] font-medium">
                Lalamove / Transport & Delivery Fee
              </span>
              <span className="w-28 shrink-0 text-[11px] text-[#555555] text-center uppercase font-bold">
                Logistics
              </span>
              <span className="w-32 shrink-0 text-[13px] font-bold text-[#111111] text-right font-mono">
                {formatCurrency(lalamove, invoice.currency)}
              </span>
            </div>

            {/* Additional Expenses */}
            {additionalExpList.map((exp) => (
              <div key={exp.id} className="flex py-3 border-b border-[#E5E5E5] items-center px-1">
                <span className="flex-1 text-[13px] text-[#111111]">
                  {exp.description || 'Additional Expense'}
                </span>
                <span className="w-28 shrink-0 text-[11px] text-[#555555] text-center uppercase font-semibold">
                  {exp.category || 'Additional'}
                </span>
                <span className="w-32 shrink-0 text-[13px] font-bold text-[#111111] text-right font-mono">
                  {formatCurrency(exp.amount || 0, invoice.currency)}
                </span>
              </div>
            ))}

            <div className="flex justify-between items-center py-2.5 px-1 bg-[#F9F9F9] border-b border-[#111111] font-mono text-[12px]">
              <span className="font-bold text-[#111111] uppercase tracking-wider">
                Logistics & Expenses Subtotal:
              </span>
              <span className="font-bold text-[#111111]">
                {formatCurrency(totalExpenses, invoice.currency)}
              </span>
            </div>
          </div>

          {/* Financial Totals & 3% Sales Markup Analysis */}
          <div className="flex justify-end mb-8">
            <div className="w-96 space-y-2 border border-[#111111] p-4 bg-[#FDFDFD] font-mono text-[12px]">
              <div className="flex justify-between items-center text-[#555555]">
                <span>Base Items Capital:</span>
                <span>{formatCurrency(itemsBaseCapitalTotal, invoice.currency)}</span>
              </div>

              <div className="flex justify-between items-center text-[#555555]">
                <span>Logistics & Expenses:</span>
                <span>{formatCurrency(totalExpenses, invoice.currency)}</span>
              </div>

              <div className="flex justify-between items-center text-[#111111] font-bold pt-1 border-t border-[#E5E5E5]">
                <span>Subtotal Capital Cost:</span>
                <span>{formatCurrency(subtotalCapitalCost, invoice.currency)}</span>
              </div>

              <div className="flex justify-between items-center text-[#008B4C] font-semibold pt-1 border-t border-[#E5E5E5]">
                <span>Quotation Selling Price:</span>
                <span>{formatCurrency(clientGrandTotal, invoice.currency)}</span>
              </div>

              {/* 3% Sales Markup Deduction */}
              <div className="flex justify-between items-center text-[#D97706] font-semibold">
                <span>3% Sales Commission:</span>
                <span>+ {formatCurrency(salesMarkup3Pct, invoice.currency)}</span>
              </div>

              <div className="flex justify-between items-center text-[#111111] font-extrabold text-[13px] pt-2 border-t-2 border-[#111111]">
                <span>Total Net Capital Cost:</span>
                <span>{formatCurrency(totalCapitalWithSalesMarkup, invoice.currency)}</span>
              </div>

              <div className="flex justify-between items-center text-[#008B4C] font-extrabold text-[14px] bg-[#008B4C]/10 p-2 rounded-xs mt-2">
                <span>NET GROSS PROFIT:</span>
                <span>{formatCurrency(netProfit, invoice.currency)} ({netProfitMarginPct.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="pt-6 border-t border-[#E5E5E5] flex justify-between items-end text-[10px] text-[#888888]">
          <div>
            <p className="font-semibold text-[#111111]">CONFIDENTIAL INTERNAL COST SHEET</p>
            <p>Calculated with 0% Base Capital Rates + 3% Sales Commission deducted from selling total.</p>
          </div>
          <div className="text-right">
            <p className="font-mono">{invoice.invoiceNumber}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
