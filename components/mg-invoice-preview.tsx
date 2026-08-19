'use client'

import { useRef, useState, useEffect } from 'react'
import { type Invoice, type LineItem } from '@/lib/types'
import { PAPER_W, PAPER_H } from '@/lib/constants'
import { formatDate, formatCurrency, cn, getCondensedLineItems, isLaborItem, isBatteryItem, formatItemDescription, sortLineItems, calculateSubtotal } from '@/lib/utils'

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
  onToggleWithBrandName,
  onToggleCustom,
}: { 
  invoice: Invoice; 
  hoveredField?: string | null;
  onOpenCheatsheet?: () => void;
  onPagesChange?: (count: number) => void;
  onToggleCondensed?: (isCondensed: boolean) => void;
  onToggleWithBrandName?: (withBrandName: boolean) => void;
  onToggleCustom?: (isCustom: boolean) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const getHighlightClass = (field: string) => {
    const isHovered = hoveredField === field || 
      (field === 'sender' && ['fromName', 'fromEmail', 'fromPhone', 'fromAddress'].includes(hoveredField || '')) ||
      (field === 'client' && ['toName', 'toEmail', 'toAddress'].includes(hoveredField || '')) ||
      (field === 'sales' && ['salesName', 'salesPosition', 'salesCompany', 'salesContact', 'salesEmail'].includes(hoveredField || '')) ||
      (field === 'bankDetails' && ['bankBeneficiary', 'bankName', 'bankSortCode', 'bankAccount', 'bankSwift'].includes(hoveredField || '')) ||
      (field === 'closing' && ['closing', 'ceoName', 'ceoPosition'].includes(hoveredField || ''))

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
  const displayItems = invoice.isCondensed
    ? getCondensedLineItems(invoice)
    : (invoice.isCustom ? invoice.lineItems : sortLineItems(invoice.lineItems))
  const showPriceColumns = displayItems.some(it => (it.rate || 0) > 0)
  const subtotal = calculateSubtotal(invoice)
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
    // 1. Calculate heights of top elements (Header, Bill To, Subject, Salutation)
    const headerHeight = 135
    const billToHeight = 80
    const continuationHeaderHeight = 0
    
    const subjectLines = getWrappedLines(inv.subject, 65)
    const subjectHeight = inv.subject ? (18 + subjectLines * 16) : 0
    
    const salutationLines = getWrappedLines(inv.salutation, 65)
    const salutationHeight = inv.salutation ? (18 + salutationLines * 16) : 0
    
    const topSectionHeight = headerHeight + billToHeight + subjectHeight + salutationHeight
    const tableHeaderHeight = 35
    
    // 2. Totals height + Bank Details
    const totalsLines = 3 // Subtotal + VAT + Total
    let totalsHeight = totalsLines * 24 + 40

    let bankFields = 0
    if (inv.bankBeneficiary) bankFields++
    if (inv.bankName) bankFields++
    if (inv.bankSortCode) bankFields++
    if (inv.bankAccount) bankFields++
    if (inv.bankSwift) bankFields++
    const bankHeight = bankFields > 0 ? (bankFields * 24 + 80) : 0
    totalsHeight += bankHeight
    
    // 3. Footer block height (Note, Terms, Sales Contact, Closing, Acknowledgment)
    const noteLines = getWrappedLines(inv.note, 65)
    const noteHeight = inv.note ? (noteLines * 18 + 36) : 0
    
    const termsLines = getWrappedLines(inv.terms, 65)
    const termsHeight = inv.terms ? (termsLines * 18 + 36) : 0
    
    const salesHeight = (inv.salesName || inv.salesPosition || inv.salesCompany || inv.salesContact || inv.salesEmail) ? 130 : 0
    
    const closingLines = getWrappedLines(inv.closing, 65)
    const closingHeight = inv.closing ? (24 + closingLines * 18) : 0

    const ackHeight = inv.closing ? 150 : 0
    
    const footerBlockHeight = noteHeight + termsHeight + salesHeight + closingHeight + ackHeight + 20

    // Available content height inside A4 borders (PAPER_H 1123 - padding 112 - bottom indicator buffer 75 = 936px)
    const PAGE_MAX_H = 935

    const getItemHeight = (item: LineItem): number => {
      const desc = item.description || ''
      const lines = desc.split('\n')
      let itemLines = 0
      for (const line of lines) {
        itemLines += Math.max(1, Math.ceil(Math.max(line.length, 1) / 45))
      }
      return 18 + itemLines * 18
    }
    
    const allItems = inv.isCondensed
      ? getCondensedLineItems(inv)
      : [...inv.lineItems].filter(item => !(inv.excludeBattery && isBatteryItem(item.description)))

    const totalItemsHeight = allItems.reduce((sum, item) => sum + getItemHeight(item), 0)

    // Check if EVERYTHING fits on 1 page cleanly
    if (topSectionHeight + tableHeaderHeight + totalItemsHeight + totalsHeight + footerBlockHeight <= PAGE_MAX_H) {
      return [{
        items: allItems,
        showTop: true,
        showTotals: true,
        showBottom: true,
      }]
    }

    // Otherwise, build multi-page layout dynamically
    const pages: PageData[] = []
    let remainingItems = [...allItems]
    let isFirst = true

    while (remainingItems.length > 0) {
      const pageTopHeight = isFirst ? topSectionHeight : continuationHeaderHeight
      let currentHeight = pageTopHeight + tableHeaderHeight
      const currentItems: LineItem[] = []

      while (remainingItems.length > 0) {
        const item = remainingItems[0]
        const h = getItemHeight(item)
        
        // If placing this item + all remaining items + totals + footer would fit on this final page:
        const remainingAfterThis = remainingItems.slice(1)
        const remHeight = remainingAfterThis.reduce((s, it) => s + getItemHeight(it), 0)
        
        if (currentHeight + h + remHeight + totalsHeight + footerBlockHeight <= PAGE_MAX_H) {
          currentItems.push(...remainingItems)
          pages.push({
            items: currentItems,
            showTop: isFirst,
            showTotals: true,
            showBottom: true,
          })
          remainingItems = []
          break
        }

        // If placing this item fits on current page
        if (currentHeight + h <= PAGE_MAX_H || currentItems.length === 0) {
          currentItems.push(item)
          currentHeight += h
          remainingItems.shift()
        } else {
          // Page is full for items
          break
        }
      }

      if (remainingItems.length === 0 && pages.length > 0 && pages[pages.length - 1].items === currentItems) {
        break
      }

      if (remainingItems.length === 0) {
        // All items placed. Let's see if totals + footer fit on this page
        if (currentHeight + totalsHeight + footerBlockHeight <= PAGE_MAX_H) {
          pages.push({
            items: currentItems,
            showTop: isFirst,
            showTotals: true,
            showBottom: true,
          })
        } else if (currentHeight + totalsHeight <= PAGE_MAX_H) {
          pages.push({
            items: currentItems,
            showTop: isFirst,
            showTotals: true,
            showBottom: false,
          })
          pages.push({
            items: [],
            showTop: false,
            showTotals: false,
            showBottom: true,
          })
        } else {
          pages.push({
            items: currentItems,
            showTop: isFirst,
            showTotals: false,
            showBottom: false,
          })
          pages.push({
            items: [],
            showTop: false,
            showTotals: true,
            showBottom: true,
          })
        }
        break
      } else {
        pages.push({
          items: currentItems,
          showTop: isFirst,
          showTotals: false,
          showBottom: false,
        })
        isFirst = false
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
      className="w-full bg-[#EBEBEB] dark:bg-zinc-900 flex flex-col items-center py-8 print:block print:bg-white print:overflow-visible print:py-0"
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
          {invoice.isCondensed ? "[Condensed]" : "[Comprehensive]"}
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
          {invoice.withBrandName !== false ? "[With Brand]" : "[Without Brand]"}
        </button>

        <div className="h-4 w-[1px] bg-border hidden sm:block" />

        {/* Custom Mode Single Toggle Button */}
        <button
          type="button"
          onClick={() => onToggleCustom?.(!invoice.isCustom)}
          className={cn(
            "px-3.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer select-none flex items-center gap-1.5 border",
            invoice.isCustom
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-secondary/80 text-foreground hover:bg-secondary border-border"
          )}
          title={invoice.isCustom ? "Custom mode is ON. Custom user descriptions are strictly respected." : "Standard mode. Click to enable Custom mode."}
        >
          {invoice.isCustom ? "[Custom: ON]" : "[Custom: OFF]"}
        </button>
      </div>
      {virtualPages.map((page, pageIndex) => {
        return (
          <div key={pageIndex} className={cn("w-full flex justify-center mb-8 last:mb-0 print:block print:m-0 print:p-0", pageIndex < totalPages - 1 ? "print-break" : "print-break-last")}>
            {/* Scale wrapper — occupies the visual space of the scaled paper */}
            <div 
              style={{ width: PAPER_W * scale, height: PAPER_H * scale }} 
              className="print-wrapper"
            >
              {/* Invoice paper — fixed A4 proportion on screen, matches printed sheet exactly */}
              <div
                style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="relative bg-white rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] px-14 py-14 print-page print:!transform-none flex flex-col justify-between"
              >
                <div>
                {/* Header (First Page Only) */}
                {page.showTop && (
                  <div className="flex justify-between items-start mb-6">
                    <div className={cn("max-w-xs p-1", getHighlightClass('sender'))}>
                      <p className="font-bold text-[22px] text-[#111111] tracking-tight leading-none">
                        {invoice.fromName || 'Your Company'}
                      </p>
                      {invoice.fromEmail && (
                        <p className="text-[11.5px] text-[#888888] mt-1.5">{invoice.fromEmail}</p>
                      )}
                      {invoice.fromPhone && (
                        <p className="text-[11.5px] text-[#888888]">{invoice.fromPhone}</p>
                      )}
                      {invoice.fromAddress && (
                        <p className="text-[11.5px] text-[#888888] whitespace-pre-line">{invoice.fromAddress}</p>
                      )}
                    </div>
                    <div className={cn("text-right flex flex-col items-end p-1", getHighlightClass('invoiceNumber'))}>
                      <img
                        src="/mg.png"
                        alt="INVOICE"
                        className="h-[95px] w-auto object-contain mb-0.5"
                      />
                      {invoice.invoiceNumber && (
                        <p className="text-[11.5px] text-[#888888] mt-0.5">{invoice.invoiceNumber}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Bill To + Dates (First Page Only) */}
                {page.showTop && (
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("max-w-xs p-1", getHighlightClass('client'))}>
                      <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                        Bill To
                      </p>
                      <p className="font-bold text-[14px] text-[#111111] tracking-tight">
                        {invoice.toName || '—'}
                      </p>
                      {invoice.toEmail && (
                        <p className="text-[11.5px] text-[#888888] mt-0.5">{invoice.toEmail}</p>
                      )}
                      {invoice.toAddress && (
                        <p className="text-[11.5px] text-[#888888] whitespace-pre-line">{invoice.toAddress}</p>
                      )}
                    </div>
                    <div className="flex gap-8">
                      {invoice.issueDate && (
                        <div className={cn("text-right p-1", getHighlightClass('issueDate'))}>
                          <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                            Issue Date
                          </p>
                          <p className="text-[11.5px] font-medium text-[#111111]" suppressHydrationWarning>
                            {formatDate(invoice.issueDate)}
                          </p>
                        </div>
                      )}
                      {invoice.dueDate && (
                        <div className={cn("text-right p-1", getHighlightClass('dueDate'))}>
                          <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-1">
                            Validity
                          </p>
                          <p className="text-[11.5px] font-medium text-[#111111]" suppressHydrationWarning>
                            {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Subject Line (First Page Only) */}
                {page.showTop && invoice.subject && (
                  <div className={cn("mb-4 pb-1.5 border-b border-[#E5E5E5]/50 flex gap-2 p-1", getHighlightClass('subject'))}>
                    <span className="text-[11.5px] font-bold text-[#111111] shrink-0 uppercase tracking-[0.05em]">Subject:</span>
                    <span className="text-[11.5px] font-bold text-[#111111]">{invoice.subject}</span>
                  </div>
                )}

                {/* Salutation / Intro (First Page Only) */}
                {page.showTop && invoice.salutation && (
                  <div className={cn("mb-4 p-1", getHighlightClass('salutation'))}>
                    <p className="text-[11.5px] text-[#555555] whitespace-pre-wrap leading-relaxed">
                      {invoice.salutation}
                    </p>
                  </div>
                )}

                {/* Line items table */}
                {page.items.length > 0 && (
                  <div className="mb-8">
                    {showPriceColumns ? (
                      <>
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
                          const displayDesc = isCondensedItem ? item.description : formatItemDescription(item.description, invoice.withBrandName !== false, invoice.isCustom)
                          const descLower = item.description.toLowerCase().trim()
                          const isDeliveryOrLabor = isLabor || descLower.includes('delivery') || descLower.includes('freight') || descLower.includes('service') || descLower.includes('labor') || descLower.includes('installation') || item.id === 'condensed-services' || item.id === 'condensed-delivery'
                          const hasPrice = (item.rate || 0) > 0
                          return (
                            <div key={item.id} className={cn("flex py-2 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                              <span className="flex-1 text-[13px] text-[#111111] break-words whitespace-pre-wrap pr-4">
                                {displayDesc || '—'}
                              </span>
                              <span className="w-16 shrink-0 text-[13px] text-[#888888] text-center">
                                {!hasPrice || isDeliveryOrLabor ? '—' : (item.unit || '—')}
                              </span>
                              <span className="w-14 shrink-0 text-[13px] text-[#888888] text-center">
                                {!hasPrice || isDeliveryOrLabor ? '—' : (item.quantity || '—')}
                              </span>
                              <span className={cn("w-24 shrink-0 text-[13px] text-[#888888] text-right px-1", getHighlightClass('rateMarkup'))}>
                                {!hasPrice || isDeliveryOrLabor ? '—' : formatCurrency(adjustedRate, invoice.currency)}
                              </span>
                              <span className="w-28 shrink-0 text-[13px] font-medium text-[#111111] text-right">
                                {!hasPrice ? '—' : formatCurrency(item.quantity * adjustedRate, invoice.currency)}
                              </span>
                            </div>
                          )
                        })}
                      </>
                    ) : (
                      <>
                        <div className="flex py-2.5 border-b-[1.5px] border-[#111111]">
                          <span className="flex-1 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase">
                            Description
                          </span>
                        </div>
                        {page.items.map((item) => {
                          const isCondensedItem = item.id.startsWith('condensed-') || invoice.isCustom
                          const displayDesc = isCondensedItem ? item.description : formatItemDescription(item.description, invoice.withBrandName !== false, invoice.isCustom)
                          return (
                            <div key={item.id} className={cn("flex py-2 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                              <span className="flex-1 text-[13px] text-[#111111] break-words whitespace-pre-wrap">
                                {displayDesc || '—'}
                              </span>
                            </div>
                          )
                        })}
                      </>
                    )}
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


                    {/* Closing & Acknowledgment Section */}
                    {invoice.closing && (
                      <div className={cn("mt-8 pt-4 border-t border-[#E5E5E5]/50 print:break-inside-avoid p-1", getHighlightClass('closing'))}>
                        <p className="text-[12px] text-[#555555] italic text-center font-medium">
                          {invoice.closing}
                        </p>

                        {/* Acknowledgment Section with Signatures */}
                        <div className="mt-6 pt-6 border-t border-[#E5E5E5] print:break-inside-avoid">
                          <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-6 text-center">
                            Acknowledgment & Conforme
                          </p>

                          <div className="grid grid-cols-3 gap-6 items-start pt-2">
                            {/* Sales Signature */}
                            <div className="flex flex-col text-center">
                              <div className="h-16 border-b border-[#333333] mb-3 w-full" />
                              <p className="min-h-[18px] text-[11.5px] font-bold text-[#111111] uppercase tracking-wide">
                                {invoice.salesName || 'Sales Representative'}
                              </p>
                              <div className="min-h-[24px] flex items-center justify-center px-1">
                                <p className="text-[10.5px] text-[#555555] font-medium leading-tight">
                                  {invoice.salesPosition || 'Sales'}
                                </p>
                              </div>
                            </div>

                            {/* Client Signature */}
                            <div className="flex flex-col text-center">
                              <div className="h-16 border-b border-[#333333] mb-3 w-full" />
                              <p className="min-h-[18px] text-[11.5px] font-bold text-[#111111] uppercase tracking-wide">
                                {invoice.toName || 'Client Representative'}
                              </p>
                              <div className="min-h-[24px] flex items-center justify-center px-1">
                                <p className="text-[10.5px] text-[#555555] font-medium leading-tight">
                                  Client
                                </p>
                              </div>
                            </div>

                            {/* Chief Executive Officer Signature */}
                            <div className="flex flex-col text-center">
                              <div className="h-16 border-b border-[#333333] mb-3 w-full" />
                              <p className="min-h-[18px] text-[11.5px] font-bold text-[#111111] uppercase tracking-wide">
                                {invoice.ceoName || 'Mary Grace E. Santos'}
                              </p>
                              <div className="min-h-[24px] flex items-center justify-center px-1">
                                <p className="text-[10.5px] text-[#555555] font-medium leading-tight">
                                  {invoice.ceoPosition || 'Chief Executive Officer'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                </div>

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
