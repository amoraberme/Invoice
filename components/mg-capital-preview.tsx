'use client'

import { useRef, useState, useEffect } from 'react'
import { type Invoice, type LineItem } from '@/lib/types'
import { PAPER_W, PAPER_H } from '@/lib/constants'
import { formatDate, formatCurrency, cn, isBatteryItem, isLaborItem, calculateTotal } from '@/lib/utils'

interface MGCapitalPreviewProps {
  invoice: Invoice
  hoveredField?: string | null
  onPagesChange?: (count: number) => void
}

interface CapitalVirtualPage {
  items: LineItem[]
  showTop: boolean
  showTable1Subtotal: boolean
  showTable2: boolean
  showFinancialSummary: boolean
  showBottom: boolean
}

function paginateCapital(inv: Invoice): CapitalVirtualPage[] {
  const items = (inv.lineItems || []).filter((item) => {
    return !(inv.excludeBattery && isBatteryItem(item.description))
  })

  const additionalCount = (inv.additionalExpenses || []).length

  // Check if everything can fit cleanly on 1 page (up to 7 items with minimal expenses)
  if (items.length <= 7 && additionalCount <= 2) {
    return [{
      items,
      showTop: true,
      showTable1Subtotal: true,
      showTable2: true,
      showFinancialSummary: true,
      showBottom: true,
    }]
  }

  // Otherwise: Fill Page 1 cleanly (up to 18 items) to eliminate empty whitespace
  let page1Count = Math.min(items.length, 18)

  // Avoid leaving just 1 orphaned item on Page 2 if possible
  if (items.length - page1Count === 1 && page1Count > 1) {
    page1Count -= 1
  }

  const page1Items = items.slice(0, page1Count)
  const page2Items = items.slice(page1Count)

  return [
    {
      items: page1Items,
      showTop: true,
      showTable1Subtotal: false,
      showTable2: false,
      showFinancialSummary: false,
      showBottom: true,
    },
    {
      items: page2Items,
      showTop: false,
      showTable1Subtotal: true,
      showTable2: true,
      showFinancialSummary: true,
      showBottom: true,
    }
  ]
}

export function MGCapitalPreview({
  invoice,
  hoveredField,
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

  const virtualPages = paginateCapital(invoice)
  const totalPages = virtualPages.length

  useEffect(() => {
    onPagesChange?.(totalPages)
  }, [totalPages, onPagesChange])

  const getHighlightClass = (field: string) => {
    const isHovered = hoveredField === field || 
      (field === 'sender' && ['fromName', 'fromEmail', 'fromPhone', 'fromAddress'].includes(hoveredField || '')) ||
      (field === 'client' && ['toName', 'toEmail', 'toAddress'].includes(hoveredField || ''))

    return isHovered 
      ? 'outline outline-[1.5px] outline-[#008B4C] outline-offset-2 bg-[#008B4C]/5 rounded-sm transition-all duration-200' 
      : 'transition-all duration-200'
  }

  return (
    <main
      ref={canvasRef}
      className="w-full bg-[#EBEBEB] dark:bg-zinc-900 flex flex-col items-center py-6 select-none print:py-0 print:w-full"
    >
      {/* Format Header Pill (Screen only) */}
      <div className="mb-3 print:hidden flex items-center gap-2.5 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-md px-3.5 py-1 rounded-full border border-border shadow-xs z-10 select-none">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Capital Preview Mode:
        </span>
        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 font-mono">
          💰 Capital & Expenses Worksheet ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})
        </span>
      </div>

      {virtualPages.map((page, pageIdx) => (
        <div key={pageIdx} className="w-full flex justify-center mb-6 print:block print:m-0 print:p-0">
          <div 
            style={{ width: PAPER_W * scale, height: PAPER_H * scale }} 
            className="print-wrapper"
          >
            <div
              className="bg-white text-[#111111] shadow-2xl rounded-sm print:shadow-none print:rounded-none relative overflow-hidden font-sans border border-[#E5E5E5] print:border-none p-10 flex flex-col justify-between print-page print:!transform-none"
              style={{
                width: `${PAPER_W}px`,
                height: `${PAPER_H}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
            <div>
              {/* Header (First Page Only) */}
              {page.showTop && (
                <div className="flex justify-between items-start mb-6 border-b border-[#E5E5E5] pb-4">
                  <div className={cn("space-y-1 p-1", getHighlightClass('sender'))}>
                    <h1 className="text-[24px] font-extrabold text-[#111111] tracking-tight">
                      {invoice.fromName || '—'}
                    </h1>
                    {invoice.fromEmail && (
                      <p className="text-[11px] text-[#888888]">{invoice.fromEmail}</p>
                    )}
                    {invoice.fromPhone && (
                      <p className="text-[11px] text-[#888888]">{invoice.fromPhone}</p>
                    )}
                    {invoice.fromAddress && (
                      <p className="text-[11px] text-[#888888] max-w-xs">{invoice.fromAddress}</p>
                    )}
                    <div className="pt-1.5">
                      <span className="text-[9.5px] font-bold tracking-wider uppercase bg-[#111111] text-white px-2 py-0.5 rounded-xs">
                        INTERNAL CAPITAL & EXPENSES WORKSHEET
                      </span>
                    </div>
                  </div>

                  <div className={cn("text-right flex flex-col items-end p-1", getHighlightClass('invoiceNumber'))}>
                    <span className="text-[11px] font-black tracking-widest uppercase bg-[#111111] text-white px-3 py-1 rounded-xs inline-block shadow-xs">
                      CAPITAL & EXPENSES
                    </span>
                    <p className="text-[9.5px] text-[#888888] font-bold tracking-wider uppercase mt-1">CONFIDENTIAL INTERNAL SHEET</p>
                    {invoice.invoiceNumber && (
                      <p className="text-[11px] font-mono text-[#888888] mt-1">Ref: {invoice.invoiceNumber}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Header (Page 2 Only) */}
              {!page.showTop && (
                <div className="flex justify-between items-center mb-5 border-b border-[#111111] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-[#111111] uppercase tracking-wide">
                      {invoice.fromName || 'MG SOLAR'}
                    </span>
                    <span className="text-[10px] text-[#888888] font-mono">
                      • INTERNAL CAPITAL & EXPENSES WORKSHEET
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black tracking-widest uppercase bg-[#111111] text-white px-2.5 py-1 rounded-xs inline-block font-mono">
                      PAGE 2 OF {totalPages}
                    </span>
                  </div>
                </div>
              )}

              {/* Client Info & Dates (First Page Only) */}
              {page.showTop && (
                <div className="flex justify-between items-start mb-5">
                  <div className={cn("max-w-xs p-1", getHighlightClass('client'))}>
                    <p className="text-[9.5px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                      Client Target
                    </p>
                    <p className="font-bold text-[14px] text-[#111111] tracking-tight">
                      {invoice.toName || '—'}
                    </p>
                    {invoice.toEmail && (
                      <p className="text-[11px] text-[#888888] mt-0.5">{invoice.toEmail}</p>
                    )}
                    {invoice.toAddress && (
                      <p className="text-[11px] text-[#888888] whitespace-pre-line">{invoice.toAddress}</p>
                    )}
                  </div>

                  <div className="flex gap-8">
                    {invoice.issueDate && (
                      <div className="text-right p-1">
                        <p className="text-[9.5px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                          Issue Date
                        </p>
                        <p className="text-[11.5px] font-medium text-[#111111]" suppressHydrationWarning>
                          {formatDate(invoice.issueDate)}
                        </p>
                      </div>
                    )}
                    {invoice.salesName && (
                      <div className="text-right p-1">
                        <p className="text-[9.5px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                          Prepared By
                        </p>
                        <p className="text-[11.5px] font-medium text-[#111111]">
                          {invoice.salesName}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Subject Line (First Page Only) */}
              {page.showTop && invoice.subject && (
                <div className="mb-4 pb-2 border-b border-[#E5E5E5]/50 flex gap-2 p-1">
                  <span className="text-[11.5px] font-bold text-[#111111] shrink-0 uppercase tracking-[0.05em]">Subject:</span>
                  <span className="text-[11.5px] font-bold text-[#111111]">{invoice.subject}</span>
                </div>
              )}

              {/* Table 1: Base Line Items Capital */}
              {page.items.length > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-[11px] font-bold text-[#111111] tracking-[0.07em] uppercase">
                      1. Selected Items Base Capital (0% Markup) {totalPages > 1 && `(${page.showTop ? 'Part 1' : 'Part 2'})`}
                    </h2>
                    <span className="text-[10px] text-[#888888] font-mono">
                      Page {pageIdx + 1} of {totalPages}
                    </span>
                  </div>

                  <div className="flex py-2 border-b-[1.5px] border-[#111111]">
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
                      Capital Rate (0%)
                    </span>
                    <span className="w-32 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
                      Capital Amount (0%)
                    </span>
                  </div>

                  {page.items.map((item) => {
                    const capitalAmount = item.quantity * item.rate
                    const descLower = item.description.toLowerCase().trim()
                    const isDeliveryOrLabor = isLaborItem(item.description) || descLower.includes('delivery') || descLower.includes('freight') || descLower.includes('service') || descLower.includes('labor') || descLower.includes('installation') || item.id === 'condensed-services' || item.id === 'condensed-delivery'
                    return (
                      <div key={item.id} className={cn("flex py-2 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                        <span className="flex-1 text-[11.5px] text-[#111111] break-words whitespace-pre-wrap pr-4 font-medium leading-snug">
                          {item.description || '—'}
                        </span>
                        <span className="w-16 shrink-0 text-[11.5px] text-[#888888] text-center">
                          {isDeliveryOrLabor ? '—' : (item.unit || '—')}
                        </span>
                        <span className="w-14 shrink-0 text-[11.5px] text-[#888888] text-center">
                          {isDeliveryOrLabor ? '—' : (item.quantity || '—')}
                        </span>
                        <span className="w-28 shrink-0 text-[11.5px] text-[#555555] text-right font-mono">
                          {isDeliveryOrLabor || item.rate === 0 ? '—' : formatCurrency(item.rate, invoice.currency)}
                        </span>
                        <span className="w-32 shrink-0 text-[11.5px] font-bold text-[#111111] text-right font-mono">
                          {formatCurrency(capitalAmount, invoice.currency)}
                        </span>
                      </div>
                    )
                  })}

                  {page.showTable1Subtotal && (
                    <div className="flex justify-between items-center py-2 px-1 bg-[#F9F9F9] border-b border-[#111111] font-mono text-[11px] mt-1">
                      <span className="font-bold text-[#111111] uppercase tracking-wider">
                        Items Base Capital Subtotal (0% Markup):
                      </span>
                      <span className="font-bold text-[#111111]">
                        {formatCurrency(itemsBaseCapitalTotal, invoice.currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Table 2: Logistics & Project Expenses */}
              {page.showTable2 && (
                <div className="mb-5">
                  <h2 className="text-[11px] font-bold text-[#111111] tracking-[0.07em] uppercase mb-2">
                    2. Logistics & Project Expenses
                  </h2>

                  <div className="flex py-2 border-b-[1.5px] border-[#111111]">
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
                  <div className={cn("flex py-2 border-b border-[#E5E5E5] items-center px-1", getHighlightClass('lalamoveCost'))}>
                    <span className="flex-1 text-[11.5px] text-[#111111] font-medium">
                      Lalamove / Transport & Delivery Fee
                    </span>
                    <span className="w-28 shrink-0 text-[10px] text-[#555555] text-center uppercase font-bold">
                      Logistics
                    </span>
                    <span className="w-32 shrink-0 text-[11.5px] font-bold text-[#111111] text-right font-mono">
                      {formatCurrency(lalamove, invoice.currency)}
                    </span>
                  </div>

                  {/* Additional Expenses */}
                  {additionalExpList.map((exp) => (
                    <div key={exp.id} className={cn("flex py-2 border-b border-[#E5E5E5] items-center px-1", getHighlightClass(exp.id))}>
                      <span className="flex-1 text-[11.5px] text-[#111111]">
                        {exp.description || 'Additional Expense'}
                      </span>
                      <span className="w-28 shrink-0 text-[10px] text-[#555555] text-center uppercase font-semibold">
                        {exp.category || 'Additional'}
                      </span>
                      <span className="w-32 shrink-0 text-[11.5px] font-bold text-[#111111] text-right font-mono">
                        {formatCurrency(exp.amount || 0, invoice.currency)}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between items-center py-2 px-1 bg-[#F9F9F9] border-b border-[#111111] font-mono text-[11px] mt-1">
                    <span className="font-bold text-[#111111] uppercase tracking-wider">
                      Logistics & Expenses Subtotal:
                    </span>
                    <span className="font-bold text-[#111111]">
                      {formatCurrency(totalExpenses, invoice.currency)}
                    </span>
                  </div>
                </div>
              )}

              {/* Financial Totals & 3% Sales Markup Analysis (Flat Ultra-Compact 3-Column Layout) */}
              {page.showFinancialSummary && (
                <div className="w-full border border-[#111111] px-2.5 py-1.5 bg-[#FDFDFD] font-mono text-[10.5px] mb-3">
                  <div className="text-[9.5px] font-bold text-[#111111] uppercase tracking-wider mb-1 pb-0.5 border-b border-[#E5E5E5] flex justify-between items-center">
                    <span>Financial Summary & Capital Profitability Analysis (0% Base vs +{invoice.rateMarkup}% Client Markup)</span>
                    <span className="text-[8.5px] text-[#888888] font-normal font-sans">Client Markup: +{invoice.rateMarkup}%</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Row 1: Base Capital, Expenses, Subtotal Capital */}
                    <div className="bg-[#F5F5F5] px-1.5 py-1 rounded-xs border border-[#E5E5E5]">
                      <div className="text-[8px] uppercase text-[#777777] font-semibold tracking-wider font-sans">Base Items Capital (0% Markup)</div>
                      <div className="text-[11px] font-bold text-[#111111] font-mono mt-0.5">
                        {formatCurrency(itemsBaseCapitalTotal, invoice.currency)}
                      </div>
                    </div>

                    <div className="bg-[#F5F5F5] px-1.5 py-1 rounded-xs border border-[#E5E5E5]">
                      <div className="text-[8px] uppercase text-[#777777] font-semibold tracking-wider font-sans">Logistics & Expenses</div>
                      <div className="text-[11px] font-bold text-[#111111] font-mono mt-0.5">
                        {formatCurrency(totalExpenses, invoice.currency)}
                      </div>
                    </div>

                    <div className="bg-[#F5F5F5] px-1.5 py-1 rounded-xs border border-[#111111]">
                      <div className="text-[8px] uppercase text-[#111111] font-bold tracking-wider font-sans">Subtotal Base Capital Cost</div>
                      <div className="text-[11px] font-extrabold text-[#111111] font-mono mt-0.5">
                        {formatCurrency(subtotalCapitalCost, invoice.currency)}
                      </div>
                    </div>

                    {/* Row 2: Quotation Selling Price, 3% Sales Commission, Total Net Capital */}
                    <div className="bg-[#008B4C]/5 px-1.5 py-1 rounded-xs border border-[#008B4C]/30">
                      <div className="text-[8px] uppercase text-[#008B4C] font-bold tracking-wider font-sans">Quotation Price (+{invoice.rateMarkup}% Markup)</div>
                      <div className="text-[11px] font-extrabold text-[#008B4C] font-mono mt-0.5">
                        {formatCurrency(clientGrandTotal, invoice.currency)}
                      </div>
                    </div>

                    <div className="bg-[#D97706]/5 px-1.5 py-1 rounded-xs border border-[#D97706]/30">
                      <div className="text-[8px] uppercase text-[#D97706] font-bold tracking-wider font-sans">3% Sales Commission</div>
                      <div className="text-[11px] font-bold text-[#D97706] font-mono mt-0.5">
                        + {formatCurrency(salesMarkup3Pct, invoice.currency)}
                      </div>
                    </div>

                    <div className="bg-[#111111] text-white px-1.5 py-1 rounded-xs">
                      <div className="text-[8px] uppercase text-zinc-300 font-bold tracking-wider font-sans">Total Net Capital Cost</div>
                      <div className="text-[11px] font-black font-mono mt-0.5 text-white">
                        {formatCurrency(totalCapitalWithSalesMarkup, invoice.currency)}
                      </div>
                    </div>

                    {/* Row 3: NET GROSS PROFIT (Full Width 3 Columns) */}
                    <div className="col-span-3 bg-[#008B4C]/10 border border-[#008B4C] px-2 py-1 rounded-xs flex justify-between items-center mt-0.5">
                      <div className="text-[9.5px] font-black text-[#008B4C] uppercase tracking-wider font-sans">
                        NET GROSS PROFIT MARGIN:
                      </div>
                      <div className="text-[12.5px] font-black text-[#008B4C] font-mono">
                        {formatCurrency(netProfit, invoice.currency)} ({netProfitMarginPct.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Notes */}
            {page.showBottom && (
              <div className="pt-3 border-t border-[#E5E5E5] flex justify-between items-end text-[9.5px] text-[#888888]">
                <div>
                  <p className="font-semibold text-[#111111]">CONFIDENTIAL INTERNAL COST SHEET</p>
                  <p>Comparing 0% Base Capital Rates vs +{invoice.rateMarkup}% Client Selling Price (+ 3% Sales Commission deducted from selling total).</p>
                </div>
                <div className="text-right">
                  <p className="font-mono">Page {pageIdx + 1} of {totalPages} • {invoice.invoiceNumber}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      ))}
    </main>
  )
}
