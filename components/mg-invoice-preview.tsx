'use client'

import { useRef, useState, useEffect } from 'react'
import { type Invoice, type LineItem } from '@/lib/types'
import { PAPER_W, PAPER_H } from '@/lib/constants'
import { formatDate, formatCurrency, cn, getCondensedLineItems, isLaborItem, isBatteryItem, formatItemDescription, sortLineItems } from '@/lib/utils'

interface PageData {
  items: LineItem[]
  showTop: boolean
  showTotals: boolean
  showBottom: boolean
}

export function MGInvoicePreview({ 
  invoice, 
  hoveredField,
  onOpenCheatsheet,
  onPagesChange,
  onToggleCondensed,
  onToggleWithBrandName
}: { 
  invoice: Invoice; 
  hoveredField?: string | null;
  onOpenCheatsheet?: () => void;
  onPagesChange?: (count: number) => void;
  onToggleCondensed?: (isCondensed: boolean) => void;
  onToggleWithBrandName?: (withBrandName: boolean) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const getHighlightClass = (field: string) => {
    const isHovered = hoveredField === field || 
      (field === 'sender' && ['fromName', 'fromEmail', 'fromPhone', 'fromAddress'].includes(hoveredField || '')) ||
      (field === 'client' && ['toName', 'toEmail', 'toAddress'].includes(hoveredField || '')) ||
      (field === 'sales' && ['salesName', 'salesPosition', 'salesCompany', 'salesContact', 'salesEmail'].includes(hoveredField || '')) ||
      (field === 'bankDetails' && ['bankBeneficiary', 'bankName', 'bankSortCode', 'bankAccount', 'bankSwift'].includes(hoveredField || ''))

    return isHovered 
      ? 'outline outline-[1.5px] outline-[#008B4C] outline-offset-2 bg-[#008B4C]/5 rounded-sm transition-all duration-200' 
      : 'transition-all duration-200'
  }

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const recalcScale = () => {
      const available = el.clientWidth - 32 // 16px breathing room each side
      setScale(Math.min(available / PAPER_W, 1))
    }
    recalcScale()
    const ro = new ResizeObserver(recalcScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rateMarkup = invoice.rateMarkup || 0
  const displayItems = invoice.isCondensed ? getCondensedLineItems(invoice) : sortLineItems(invoice.lineItems)
  const subtotal = displayItems.reduce((sum, item) => {
    const isCondensedItem = item.id.startsWith('condensed-')
    if (isCondensedItem) {
      return sum + item.quantity * item.rate
    }
    if (invoice.excludeBattery && isBatteryItem(item.description)) {
      return sum
    }
    const isLabor = isLaborItem(item.description)
    const shouldApplyMarkup = !(invoice.excludeLaborMarkup && isLabor)
    const adjustedRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
    return sum + item.quantity * adjustedRate
  }, 0)
  const vat = subtotal * (invoice.vatRate / 100)
  const total = subtotal + vat

  // Helper to count wrapped lines in monospace font
  const getWrappedLines = (text: string, charsPerLine: number): number => {
    if (!text) return 0
    const lines = text.split('\n')
    let count = 0
    for (const line of lines) {
      count += Math.max(1, Math.ceil(line.length / charsPerLine))
    }
    return count
  }

  // Dynamic Pagination Algorithm
  const paginateInvoice = (inv: Invoice): PageData[] => {
    const pages: PageData[] = []
    
    // 1. Calculate heights of top elements (Header, Bill To, Subject, Salutation)
    const headerHeight = 188
    const billToHeight = 95
    
    const subjectLines = getWrappedLines(inv.subject, 80)
    const subjectHeight = inv.subject ? (24 + subjectLines * 18) : 0
    
    const salutationLines = getWrappedLines(inv.salutation, 80)
    const salutationHeight = inv.salutation ? (24 + salutationLines * 18) : 0
    
    const topSectionHeight = headerHeight + billToHeight + subjectHeight + salutationHeight
    const tableHeaderHeight = 35
    
    // 2. Totals height + Bank Details (now directly below items)
    let totalsLines = 3 // Subtotal + VAT + Total
    let totalsHeight = totalsLines * 24 + 40

    // Add bank details height to totalsHeight, since they are rendered inside showTotals now!
    let bankFields = 0
    if (inv.bankBeneficiary) bankFields++
    if (inv.bankName) bankFields++
    if (inv.bankSortCode) bankFields++
    if (inv.bankAccount) bankFields++
    if (inv.bankSwift) bankFields++
    const bankHeight = bankFields > 0 ? (bankFields * 24 + 90) : 0 // include padding, margins, gaps and header
    totalsHeight += bankHeight
    
    // 3. Footer block height (Note, Terms, Sales Contact, Closing)
    const noteLines = getWrappedLines(inv.note, 80)
    const noteHeight = inv.note ? (noteLines * 18 + 36) : 0
    
    const termsLines = getWrappedLines(inv.terms, 80)
    const termsHeight = inv.terms ? (termsLines * 18 + 36) : 0
    
    const salesHeight = (inv.salesName || inv.salesPosition || inv.salesCompany || inv.salesContact || inv.salesEmail) ? 140 : 0
    
    const closingLines = getWrappedLines(inv.closing, 80)
    const closingHeight = inv.closing ? (24 + closingLines * 18) : 0
    
    const footerBlockHeight = noteHeight + termsHeight + salesHeight + closingHeight + 20

    // Available content height inside A4 borders with a safety buffer to prevent browser clipping
    const PAGE_MAX_H = 980
    
    let currentItems: LineItem[] = []
    let currentPageHeight = topSectionHeight + tableHeaderHeight
    let isFirstPage = true
    
    const getItemHeight = (item: LineItem): number => {
      const desc = item.description || ''
      const lines = desc.split('\n')
      let itemLines = 0
      for (const line of lines) {
        itemLines += Math.max(1, Math.ceil(Math.max(line.length, 1) / 35))
      }
      return 30 + itemLines * 19
    }
    
    const itemsToPlace = inv.isCondensed
      ? getCondensedLineItems(inv)
      : [...inv.lineItems].filter(item => !(inv.excludeBattery && isBatteryItem(item.description)))
    
    while (itemsToPlace.length > 0) {
      const item = itemsToPlace[0]
      const itemHeight = getItemHeight(item)
      
      // If page is empty (just header/tableHeader), always accept the item
      const isPageEmpty = currentItems.length === 0
      const maxItems = isFirstPage ? 12 : 18
      
      if (isPageEmpty || (currentPageHeight + itemHeight <= PAGE_MAX_H && currentItems.length < maxItems)) {
        currentItems.push(item)
        currentPageHeight += itemHeight
        itemsToPlace.shift()
      } else {
        // Page is full — save it and start a new page
        pages.push({
          items: currentItems,
          showTop: isFirstPage,
          showTotals: false,
          showBottom: false,
        })
        currentItems = []
        currentPageHeight = tableHeaderHeight
        isFirstPage = false
      }
    }
    
    // All items placed. Now decide where totals + footer go.
    // Totals MUST appear directly after items on the same page.
    // If totals don't fit, push last item(s) to the next page.
    
    // If totals don't fit on the current page, and we have items, push items to next page
    if (currentPageHeight + totalsHeight > PAGE_MAX_H && currentItems.length > 0) {
      const nextPageItems: LineItem[] = []
      let nextPageHeight = tableHeaderHeight

      while (currentPageHeight + totalsHeight > PAGE_MAX_H && currentItems.length > 1) {
        const item = currentItems.pop()!
        nextPageItems.unshift(item)
        currentPageHeight -= getItemHeight(item)
        nextPageHeight += getItemHeight(item)
      }

      // Save the current page (without totals)
      pages.push({
        items: currentItems,
        showTop: isFirstPage,
        showTotals: false,
        showBottom: false,
      })

      // Setup the next page as the active page
      currentItems = nextPageItems
      currentPageHeight = nextPageHeight
      isFirstPage = false
    }

    // Now, totals should fit on this page (since we pushed items or it was already clean).
    // Let's decide where totals + footer go.
    if (currentPageHeight + totalsHeight <= PAGE_MAX_H) {
      if (currentPageHeight + totalsHeight + footerBlockHeight <= PAGE_MAX_H) {
        // Everything fits on this page
        pages.push({
          items: currentItems,
          showTop: isFirstPage,
          showTotals: true,
          showBottom: true,
        })
      } else {
        // Totals fit but footer doesn't — put totals with items, footer on next page
        pages.push({
          items: currentItems,
          showTop: isFirstPage,
          showTotals: true,
          showBottom: false,
        })
        pages.push({
          items: [],
          showTop: false,
          showTotals: false,
          showBottom: true,
        })
      }
    } else {
      // Fallback in case totals are too massive for a single blank page
      if (currentItems.length > 0) {
        pages.push({
          items: currentItems,
          showTop: isFirstPage,
          showTotals: false,
          showBottom: false,
        })
      }
      pages.push({
        items: [],
        showTop: false,
        showTotals: true,
        showBottom: footerBlockHeight <= PAGE_MAX_H - totalsHeight,
      })
      if (footerBlockHeight > PAGE_MAX_H - totalsHeight) {
        pages.push({
          items: [],
          showTop: false,
          showTotals: false,
          showBottom: true,
        })
      }
    }
    
    return pages
  }

  const virtualPages = paginateInvoice(invoice)
  const totalPages = virtualPages.length

  useEffect(() => {
    if (onPagesChange) {
      onPagesChange(totalPages)
    }
  }, [totalPages, onPagesChange])

  return (
    <main
      ref={canvasRef}
      className="flex-1 w-full bg-[#EBEBEB] overflow-auto flex flex-col items-center py-8 print:block print:bg-white print:overflow-visible print:py-0"
    >
      {/* Floating Controls Toolbar: Format & Brand Name Single Toggles */}
      <div className="mb-4 print:hidden flex items-center gap-2.5 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-md px-4 py-1.5 rounded-full border border-border shadow-xs z-10 select-none flex-wrap justify-center">
        {/* Format Single Toggle Button */}
        <button
          type="button"
          onClick={() => onToggleCondensed?.(!invoice.isCondensed)}
          className={cn(
            "px-3.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer select-none flex items-center gap-1.5 border",
            invoice.isCondensed
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-secondary/80 text-foreground hover:bg-secondary border-border"
          )}
          title={invoice.isCondensed ? "Currently in Condensed mode. Click to switch to Comprehensive view." : "Currently in Comprehensive mode. Click to switch to Condensed view."}
        >
          {invoice.isCondensed ? "📦 [Condensed]" : "📋 [Comprehensive]"}
        </button>

        <div className="h-4 w-[1px] bg-border hidden sm:block" />

        {/* Brand Name Single Toggle Button */}
        <button
          type="button"
          onClick={() => onToggleWithBrandName?.(invoice.withBrandName === false)}
          className={cn(
            "px-3.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer select-none flex items-center gap-1.5 border",
            invoice.withBrandName !== false
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-secondary/80 text-foreground hover:bg-secondary border-border"
          )}
          title={invoice.withBrandName !== false ? "Brand names included. Click to hide brand names." : "Brand names hidden. Click to show brand names."}
        >
          {invoice.withBrandName !== false ? "🏷️ [With Brand]" : "🚫 [Without Brand]"}
        </button>
      </div>
      {virtualPages.map((page, pageIndex) => {
        return (
          <div key={pageIndex} className={cn("mb-8 last:mb-0 print:mb-0", pageIndex < totalPages - 1 && "print-break")}>
            {/* Scale wrapper — occupies the visual space of the scaled paper */}
            <div 
              style={{ width: PAPER_W * scale, height: PAPER_H * scale }} 
              className="print-wrapper"
            >
              {/* Invoice paper — fixed A4 proportion on screen, matches printed sheet exactly */}
              <div
                style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="relative bg-white rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] px-14 py-14 print-page print:!transform-none"
              >
                {/* Header (First Page Only) */}
                {page.showTop && (
                  <div className="flex justify-between items-start mb-12">
                    <div className={cn("max-w-xs p-1", getHighlightClass('sender'))}>
                      <p className="font-bold text-[26px] text-[#111111] tracking-tight leading-none">
                        {invoice.fromName || 'Your Company'}
                      </p>
                      {invoice.fromEmail && (
                        <p className="text-[12px] text-[#888888] mt-2">{invoice.fromEmail}</p>
                      )}
                      {invoice.fromPhone && (
                        <p className="text-[12px] text-[#888888]">{invoice.fromPhone}</p>
                      )}
                      {invoice.fromAddress && (
                        <p className="text-[12px] text-[#888888] whitespace-pre-line">{invoice.fromAddress}</p>
                      )}
                    </div>
                    <div className={cn("text-right flex flex-col items-end p-1", getHighlightClass('invoiceNumber'))}>
                      <img
                        src="/mg.png"
                        alt="INVOICE"
                        className="h-[140px] w-auto object-contain mb-1"
                      />
                      {invoice.invoiceNumber && (
                        <p className="text-[12px] text-[#888888] mt-1">{invoice.invoiceNumber}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Bill To + Dates (First Page Only) */}
                {page.showTop && (
                  <div className="flex justify-between items-start mb-6">
                    <div className={cn("max-w-xs p-1", getHighlightClass('client'))}>
                      <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1.5">
                        Bill To
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
                        <div className={cn("text-right p-1", getHighlightClass('issueDate'))}>
                          <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                            Issue Date
                          </p>
                          <p className="text-[12px] font-medium text-[#111111]" suppressHydrationWarning>
                            {formatDate(invoice.issueDate)}
                          </p>
                        </div>
                      )}
                      {invoice.dueDate && (
                        <div className={cn("text-right p-1", getHighlightClass('dueDate'))}>
                          <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                            Validity
                          </p>
                          <p className="text-[12px] font-medium text-[#111111]" suppressHydrationWarning>
                            {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Subject Line (First Page Only) */}
                {page.showTop && invoice.subject && (
                  <div className={cn("mb-6 pb-2 border-b border-[#E5E5E5]/50 flex gap-2 p-1", getHighlightClass('subject'))}>
                    <span className="text-[12px] font-bold text-[#111111] shrink-0 uppercase tracking-[0.05em]">Subject:</span>
                    <span className="text-[12px] font-bold text-[#111111]">{invoice.subject}</span>
                  </div>
                )}

                {/* Salutation / Intro (First Page Only) */}
                {page.showTop && invoice.salutation && (
                  <div className={cn("mb-6 p-1.5", getHighlightClass('salutation'))}>
                    <p className="text-[12px] text-[#555555] whitespace-pre-wrap leading-relaxed">
                      {invoice.salutation}
                    </p>
                  </div>
                )}

                {/* Line items table */}
                {page.items.length > 0 && (
                  <div className="mb-8">
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
                      <span className={cn("w-24 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right px-1", getHighlightClass('rateMarkup'))}>
                        Rate
                      </span>
                      <span className="w-28 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
                        Amount
                      </span>
                    </div>
                    {page.items.map((item) => {
                      const isCondensedItem = item.id.startsWith('condensed-')
                      const isLabor = !isCondensedItem && isLaborItem(item.description)
                      const shouldApplyMarkup = !isCondensedItem && !(invoice.excludeLaborMarkup && isLabor)
                      const adjustedRate = isCondensedItem ? item.rate : (shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate)
                      const displayDesc = isCondensedItem ? item.description : formatItemDescription(item.description, invoice.withBrandName !== false)
                      return (
                        <div key={item.id} className={cn("flex py-3.5 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                          <span className="flex-1 text-[13px] text-[#111111] break-words whitespace-pre-wrap pr-4">
                            {displayDesc || '—'}
                          </span>
                          <span className="w-16 shrink-0 text-[13px] text-[#888888] text-center">
                            {item.unit || '—'}
                          </span>
                          <span className="w-14 shrink-0 text-[13px] text-[#888888] text-center">
                            {item.quantity || '—'}
                          </span>
                          <span className={cn("w-24 shrink-0 text-[13px] text-[#888888] text-right px-1", getHighlightClass('rateMarkup'))}>
                            {item.rate === 0 ? '—' : formatCurrency(adjustedRate, invoice.currency)}
                          </span>
                          <span className="w-28 shrink-0 text-[13px] font-medium text-[#111111] text-right">
                            {item.rate === 0 ? '—' : formatCurrency(item.quantity * adjustedRate, invoice.currency)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Totals + Bank Details (directly below items) */}
                {page.showTotals && (
                  <>
                    <div className="flex flex-col items-end gap-2 mb-8 mt-4 print:break-inside-avoid">
                      <div className="flex gap-8 items-center">
                        <span className="text-[12px] text-[#888888]">Subtotal</span>
                        <span className="text-[12px] font-medium text-[#111111] w-32 text-right">
                          {formatCurrency(subtotal, invoice.currency)}
                        </span>
                      </div>
                      <div className={cn("flex gap-8 items-center p-1", getHighlightClass('vatRate'))}>
                        <span className="text-[12px] text-[#888888]">VAT {invoice.vatRate || 0}%</span>
                        <span className="text-[12px] font-medium text-[#111111] w-32 text-right">
                          {formatCurrency(vat, invoice.currency)}
                        </span>
                      </div>
                      <div className="w-48 h-px bg-[#E5E5E5]" />
                      <div className="flex gap-8 items-center">
                        <span className="text-[15px] font-bold text-[#111111] tracking-tight">Total</span>
                        <span className="text-[20px] font-bold text-[#111111] tracking-tight w-32 text-right">
                          {formatCurrency(total, invoice.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Bank / Payment Details */}
                    {(invoice.bankBeneficiary || invoice.bankName || invoice.bankSortCode || invoice.bankAccount || invoice.bankSwift) && (
                      <div className={cn("border-t border-[#E5E5E5] pt-6 mt-2 mb-6 print:break-inside-avoid p-1", getHighlightClass('bankDetails'))}>
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                            Payment Details
                          </p>
                          {invoice.bankBeneficiary && (
                            <div className="flex gap-2">
                              <span className="text-[12px] text-[#888888] w-24 shrink-0">Beneficiary</span>
                              <span className="text-[12px] text-[#111111]">{invoice.bankBeneficiary}</span>
                            </div>
                          )}
                          {invoice.bankName && (
                            <div className="flex gap-2">
                              <span className="text-[12px] text-[#888888] w-24 shrink-0">Bank</span>
                              <span className="text-[12px] text-[#111111]">{invoice.bankName}</span>
                            </div>
                          )}
                          {invoice.bankSortCode && (
                            <div className="flex gap-2">
                              <span className="text-[12px] text-[#888888] w-24 shrink-0">Sort / Route</span>
                              <span className="text-[12px] text-[#111111]">{invoice.bankSortCode}</span>
                            </div>
                          )}
                          {invoice.bankAccount && (
                            <div className="flex gap-2">
                              <span className="text-[12px] text-[#888888] w-24 shrink-0">Account</span>
                              <span className="text-[12px] text-[#111111]">{invoice.bankAccount}</span>
                            </div>
                          )}
                          {invoice.bankSwift && (
                            <div className="flex gap-2">
                              <span className="text-[12px] text-[#888888] w-24 shrink-0">SWIFT / BIC</span>
                              <span className="text-[12px] text-[#111111]">{invoice.bankSwift}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Footer block: Note, Terms, Bank, Sales, Closing */}
                {page.showBottom && (
                  <>
                    {/* Note */}
                    {invoice.note && (
                      <div className={cn("border-t border-[#E5E5E5] pt-6 mt-6 print:break-inside-avoid p-1", getHighlightClass('note'))}>
                        <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-2">
                          Note
                        </p>
                        <p className="text-[12px] text-[#555555] whitespace-pre-wrap leading-relaxed">
                          {invoice.note}
                        </p>
                      </div>
                    )}

                    {/* Sales Contact (below Note, far left — no heading label) */}
                    {(invoice.salesName || invoice.salesPosition || invoice.salesCompany) && (
                      <div className={cn("border-t border-[#E5E5E5] pt-6 mt-6 print:break-inside-avoid p-1", getHighlightClass('sales'))}>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[13px] font-bold text-[#111111]">
                            {invoice.salesName}
                          </p>
                          {invoice.salesPosition && (
                            <p className="text-[12px] text-[#555555]">{invoice.salesPosition}</p>
                          )}
                          {invoice.salesCompany && (
                            <p className="text-[11px] text-[#888888]">{invoice.salesCompany}</p>
                          )}
                          {invoice.salesContact && (
                            <p className="text-[11px] text-[#888888] mt-1">{invoice.salesContact}</p>
                          )}
                          {invoice.salesEmail && (
                            <p className="text-[11px] text-[#888888]">{invoice.salesEmail}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Terms & Conditions */}
                    {invoice.terms && (
                      <div className={cn("border-t border-[#E5E5E5] pt-6 mt-6 print:break-inside-avoid p-1", getHighlightClass('terms'))}>
                        <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-2">
                          Terms & Conditions
                        </p>
                        <p className="text-[12px] text-[#555555] whitespace-pre-wrap leading-relaxed">
                          {invoice.terms}
                        </p>
                      </div>
                    )}


                    {/* Closing Section */}
                    {invoice.closing && (
                      <div className={cn("mt-8 pt-4 border-t border-[#E5E5E5]/50 print:break-inside-avoid p-1", getHighlightClass('closing'))}>
                        <p className="text-[12px] text-[#555555] italic text-center font-medium">
                          {invoice.closing}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Page Number Indicator */}
                <div className="absolute bottom-10 right-14 text-[10px] text-[#AAAAAA]">
                  Page {pageIndex + 1} of {totalPages}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div style={{ width: PAPER_W * scale }} className="flex items-center justify-between px-1 mt-4 print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#AAAAAA]">
            © {new Date().getFullYear()} MG Invoice
          </span>
          {onOpenCheatsheet && (
            <>
              <span className="text-[11px] text-[#AAAAAA]">|</span>
              <button
                onClick={onOpenCheatsheet}
                className="text-[11px] text-[#AAAAAA] hover:text-[#888888] hover:underline transition-colors cursor-pointer"
              >
                API
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
