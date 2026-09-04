'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { type Invoice, type LineItem } from '@/lib/types'
import { PAPER_W, PAPER_H } from '@/lib/constants'
import { 
  formatCurrency, 
  formatDate, 
  calculateSubtotal, 
  cn, 
  getCondensedLineItems, 
  sortLineItems, 
  formatItemDescription,
  extractPanelInfoFromLineItems,
  getPanelDimensions,
  isBatteryItem,
  isBatteryUnit,
  isLaborItem,
  isDeliveryItem,
  generateDefaultScopesFromInvoice,
  generateDefaultWarrantiesFromInvoice
} from '@/lib/utils'
import { Sparkles, Eye, FileText, Check, ShieldCheck, Tag } from 'lucide-react'

export interface MGInvoicePreviewProps {
  invoice: Invoice
  hoveredField?: string | null
  onOpenCheatsheet?: () => void
  onPagesChange?: (count: number) => void
  onToggleCondensed?: (val: boolean) => void
  onToggleWithBrandName?: (val: boolean) => void
  showCapital?: boolean
  capitalVersion?: 'v1' | 'v2'
  onToggleCapitalVersion?: (v: 'v1' | 'v2') => void
}

interface PageData {
  items: LineItem[]
  showTop: boolean
  showTotals: boolean
  showBottom: boolean
  showCondensedScope?: boolean
  showCondensedWarranty?: boolean
}

export function MGInvoicePreview({ 
  invoice, 
  hoveredField,
  onOpenCheatsheet,
  onPagesChange,
  onToggleCondensed,
  onToggleWithBrandName,
  showCapital,
  capitalVersion = 'v1',
  onToggleCapitalVersion,
}: MGInvoicePreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const prevPagesCountRef = useRef<number>(0)

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
    let rafId: number | null = null
    const recalcScale = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!el) return
        const available = el.clientWidth - 32 // 16px breathing room each side
        const newScale = Math.min(available / PAPER_W, 1)
        setScale(prev => (Math.abs(prev - newScale) > 0.005 ? newScale : prev))
      })
    }
    recalcScale()
    const ro = new ResizeObserver(recalcScale)
    ro.observe(el)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  const rateMarkup = invoice.rateMarkup || 0
  const displayItems = useMemo(() => {
    return invoice.isCondensed
      ? getCondensedLineItems(invoice)
      : sortLineItems(invoice.lineItems)
  }, [invoice.isCondensed, invoice.lineItems])

  const showPriceColumns = useMemo(() => {
    return displayItems.some(it => (it.rate || 0) > 0)
  }, [displayItems])

  const subtotal = useMemo(() => calculateSubtotal(invoice), [invoice])
  const discount = invoice.discountAmount || 0
  const netSubtotal = Math.max(0, subtotal - discount)
  const vat = netSubtotal * (invoice.vatRate / 100)
  const total = netSubtotal + vat

  // Extracted Scope details for condensed/compressed mode
  const scopeData = useMemo(() => {
    const items = invoice.lineItems || []
    const withBrand = invoice.withBrandName !== false

    // Helper to strip any leading quantity/counts from descriptions (e.g. "24 Rails" -> "Rails", "10x Panel" -> "Panel", "50 AC Cable" -> "AC Cable")
    const cleanDescWithoutQty = (text: string) => {
      if (!text) return ''
      const formatted = formatItemDescription(text, withBrand)
      return formatted.replace(/^(\d+[\s*xX\-\.]+|\(\d+\)\s*)/, '').trim()
    }

    // A. Solar Panels
    const panelItem = items.find(it => {
      const d = (it.description || '').toLowerCase()
      return d.includes('panel') || d.includes('module') || d.includes('ja solar') || d.includes('tongwei') || d.includes('pv module')
    })
    const panelQty = panelItem?.quantity || extractPanelInfoFromLineItems(items).panelQty || 0
    const panelWattMatch = (panelItem?.description || '').match(/(\d+)\s*w/i) || (panelItem?.description || '').match(/(\d+)/)
    const panelWatts = panelWattMatch ? `${panelWattMatch[1]}W` : '620W'
    const panelDimensions = getPanelDimensions(panelItem?.description || '')
    let panelBrand = withBrand ? (panelItem?.description?.split(' ')?.[0] || 'Tier-1') : 'Tier-1'
    if (panelItem?.description?.toLowerCase().includes('ja solar')) panelBrand = withBrand ? 'JA Solar' : 'Tier-1'
    else if (panelItem?.description?.toLowerCase().includes('tongwei')) panelBrand = withBrand ? 'Tongwei' : 'Tier-1'

    const rawPanelDesc = panelItem ? cleanDescWithoutQty(panelItem.description) : `${panelBrand} ${panelWatts} N-Type TOPCon Monocrystalline PV Modules`
    const panelTitle = panelDimensions && !rawPanelDesc.includes(panelDimensions)
      ? `${rawPanelDesc} (${panelDimensions})`
      : rawPanelDesc

    // B. Solar Inverter
    const inverterItem = items.find(it => {
      if (isBatteryUnit(it.description)) return false
      const d = (it.description || '').toLowerCase()
      return d.includes('inverter') || d.includes('anern') || d.includes('solis') || d.includes('goodwe') || d.includes('hypontech') || d.includes('solax') || d.includes('foxess') || d.includes('sunways') || d.includes('deye') || d.includes('growatt') || d.includes('sungrow') || d.includes('victron')
    })
    const inverterTitle = inverterItem
      ? cleanDescWithoutQty(inverterItem.description)
      : 'High-Efficiency Smart Solar Inverter'

    // C. Battery
    const batteryItem = items.find(it => isBatteryItem(it.description) || isBatteryUnit(it.description))
    const hasBattery = !invoice.excludeBattery && !!batteryItem
    const batteryTitle = batteryItem
      ? cleanDescWithoutQty(batteryItem.description)
      : 'N/A - Grid-Tied System'

    // D. Materials
    const materialItems = items.filter(it => {
      const d = (it.description || '').toLowerCase()
      return d.includes('rail') || d.includes('clamp') || d.includes('l foot') || d.includes('l-foot') || d.includes('mounting') || d.includes('hardware') || d.includes('sealant') || d.includes('bracket')
    })
    const materialsList = materialItems.length > 0
      ? materialItems.map(it => cleanDescWithoutQty(it.description)).filter(Boolean).join(', ')
      : 'Anodized Aluminum Mounting Rails, Mid & End Clamps, Stainless L-Feet / Tile Brackets, Heavy-Duty Grounding Lugs, PU Weatherproof Sealants, and SUS304 Stainless Hardware'

    // E. Electrical
    const electricalItems = items.filter(it => {
      const d = (it.description || '').toLowerCase()
      return d.includes('wire') || d.includes('cable') || d.includes('breaker') || d.includes('mcb') || d.includes('spd') || d.includes('mccb') || d.includes('flexcon') || d.includes('conduit') || d.includes('ats') || d.includes('switch') || d.includes('box') || d.includes('combiner')
    })
    const electricalList = electricalItems.length > 0
      ? electricalItems.map(it => cleanDescWithoutQty(it.description)).filter(Boolean).join(', ')
      : 'DC & AC Miniature Circuit Breakers (MCB), Molded Case Circuit Breaker (MCCB), Type II Surge Protective Devices (SPD), DC Solar PV Cables (4mm²/6mm²), THHN/THWN AC Wiring, Flexible Corrugated Conduits, Heavy-Duty ATS Switch, and Weatherproof IP65 Distribution Enclosures'

    return {
      panelQty,
      panelTitle,
      inverterTitle,
      hasBattery,
      batteryTitle,
      materialsList,
      electricalList,
    }
  }, [invoice.lineItems, invoice.withBrandName, invoice.excludeBattery])

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
  const paginateInvoice = (inv: Invoice, isCapitalMode = false): PageData[] => {
    // 1. Measure fixed heights (Header + Bill To + Meta)
    const headerHeight = 110
    const billToHeight = 90
    const continuationHeaderHeight = 35
    
    const subjectLines = getWrappedLines(inv.subject, 65)
    const subjectHeight = inv.subject ? (12 + subjectLines * 14) : 0
    
    const salutationLines = getWrappedLines(inv.salutation, 65)
    const salutationHeight = inv.salutation ? (12 + salutationLines * 14) : 0
    
    const topSectionHeight = headerHeight + billToHeight + subjectHeight + salutationHeight
    const tableHeaderHeight = 28
    
    // 2. Totals height (includes Capital row in Capital mode)
    const totalsLines = isCapitalMode ? 4 : 3 // Subtotal + VAT + Total (+ Capital)
    let totalsHeight = totalsLines * 20 + 30
    
    // 3. Footer block height (Note, Terms, Sales Contact, Closing, Acknowledgment)
    const noteLines = getWrappedLines(inv.note, 65)
    const noteHeight = inv.note ? (12 + noteLines * 14) : 0
    
    const termsLines = getWrappedLines(inv.terms, 65)
    const termsHeight = inv.terms ? (12 + termsLines * 14) : 0
    
    const salesContactHeight = 60
    const closingHeight = 45
    const ackHeight = 80
    
    const footerBlockHeight = noteHeight + termsHeight + salesContactHeight + closingHeight + ackHeight + 20

    // Available content height inside A4 borders (PAPER_H 1123 with safe bottom margins)
    const PAGE_MAX_H = 880

    // Helper: calculate height of a line item
    const getItemHeight = (item: LineItem) => {
      const desc = item.description || ''
      const lines = desc.split('\n')
      const charsPerLine = (isCapitalMode && !inv.isCondensed) ? 32 : 45
      let itemLines = 0
      for (const line of lines) {
        itemLines += Math.max(1, Math.ceil(Math.max(line.length, 1) / charsPerLine))
      }
      return 20 + itemLines * 16
    }
    
    const allItems = inv.isCondensed
      ? getCondensedLineItems(inv)
      : [...inv.lineItems].filter(item => !(inv.excludeBattery && isBatteryItem(item.description)))

    // Dedicated 2-page executive proposal for condensed mode:
    // Page 1: Header -> Bill To -> Scope of Works (A-F) -> Warranty Table -> Final Total Price
    // Page 2: Bank / Payment Details -> Note -> Terms & Conditions -> Signatures
    if (inv.isCondensed) {
      return [
        {
          items: allItems,
          showTop: true,
          showTotals: true,
          showBottom: false,
          showCondensedScope: true,
          showCondensedWarranty: true,
        },
        {
          items: [],
          showTop: false,
          showTotals: false,
          showBottom: true,
          showCondensedScope: false,
          showCondensedWarranty: false,
        }
      ]
    }

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

  const virtualPages = useMemo(() => paginateInvoice(invoice, showCapital), [invoice, showCapital])
  const totalPages = virtualPages.length

  const itemsBaseCapitalTotal = useMemo(() => {
    const items = (invoice.lineItems || []).filter(item => !(invoice.excludeBattery && isBatteryItem(item.description)))
    return items.reduce((acc, item) => acc + (item.quantity * item.rate), 0)
  }, [invoice.lineItems, invoice.excludeBattery])

  useEffect(() => {
    if (onPagesChange && prevPagesCountRef.current !== totalPages) {
      prevPagesCountRef.current = totalPages
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
          title={invoice.isCondensed ? "Currently in Compressed mode. Click to switch to Expanded view." : "Currently in Expanded mode. Click to switch to Compressed view."}
        >
          {invoice.isCondensed ? "[Compressed]" : "[Expanded]"}
        </button>

        {/* Brand Name Single Toggle Button (Hidden in Capital mode) */}
        {!showCapital && (
          <>
            <div className="h-4 w-[1px] bg-border hidden sm:block" />
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
          </>
        )}

        {showCapital && onToggleCapitalVersion && (
          <>
            <div className="h-4 w-[1px] bg-border hidden sm:block" />
            <button
              type="button"
              onClick={() => onToggleCapitalVersion(capitalVersion === 'v1' ? 'v2' : 'v1')}
              className={cn(
                "px-3.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer select-none flex items-center gap-1.5 border",
                capitalVersion === 'v2'
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-secondary/80 text-foreground hover:bg-secondary border-border"
              )}
              title={capitalVersion === 'v2' ? "Currently in Detailed BOQ Worksheet. Click to switch to Proposal View." : "Currently in Proposal View. Click to switch to Detailed BOQ Worksheet."}
            >
              {capitalVersion === 'v2' ? "[Detailed BOQ Worksheet]" : "[BOQ Worksheet]"}
            </button>
          </>
        )}

        {showCapital && (
          <>
            <div className="h-4 w-[1px] bg-border hidden sm:block" />
            <span className="text-[10px] font-mono text-muted-foreground">
              ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})
            </span>
          </>
        )}
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
                className="relative bg-white rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] print-page print:!transform-none flex flex-col justify-between px-13 py-10"
              >
                <div>
                {/* Header (First Page Only) or Continuation Header */}
                {page.showTop ? (
                  <div className="flex justify-between items-start mb-3.5">
                    <div className={cn("max-w-xs p-0.5", getHighlightClass('sender'))}>
                      <p className="font-bold text-[#111111] tracking-tight leading-none text-[19px]">
                        {invoice.fromName || 'Your Company'}
                      </p>
                      {invoice.fromEmail && (
                        <p className="text-[#888888] text-[10.5px] mt-1">{invoice.fromEmail}</p>
                      )}
                      {invoice.fromPhone && (
                        <p className="text-[#888888] text-[10.5px]">{invoice.fromPhone}</p>
                      )}
                      {invoice.fromAddress && (
                        <p className="text-[#888888] whitespace-pre-line text-[10.5px]">{invoice.fromAddress}</p>
                      )}
                    </div>
                    <div className={cn("text-right flex flex-col items-end p-0.5", getHighlightClass('invoiceNumber'))}>
                      <img
                        src="/mg.png"
                        alt="INVOICE"
                        className="w-auto object-contain h-[68px] mb-0.5"
                      />
                      <p className="font-medium tracking-tight text-[#888888] text-[11px] mt-0.5">
                        {invoice.invoiceNumber || '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center pb-2.5 mb-5 border-b border-[#E5E5E5]">
                    <span className="text-[11px] font-bold text-[#111111] uppercase tracking-[0.05em]">
                      {invoice.fromName || 'M&G Commercial Proposal'} — Proposal Continuation
                    </span>
                    <span className="text-[10px] text-[#888888] font-medium font-mono">
                      {invoice.invoiceNumber ? `Ref: ${invoice.invoiceNumber}` : ''}
                    </span>
                  </div>
                )}

                {/* Bill To + Dates (First Page Only) */}
                {page.showTop && (
                  <div className="flex justify-between items-start mb-3">
                    <div className={cn("max-w-xs p-0.5", getHighlightClass('client'))}>
                      <p className="font-semibold text-[#888888] tracking-[0.1em] uppercase text-[9.5px] mb-0.5">
                        Bill To
                      </p>
                      <p className="font-bold text-[#111111] tracking-tight text-[13px]">
                        {invoice.toName || '—'}
                      </p>
                      {invoice.toEmail && (
                        <p className="text-[#888888] text-[10.5px] mt-0.5">{invoice.toEmail}</p>
                      )}
                      {invoice.toAddress && (
                        <p className="text-[#888888] whitespace-pre-line text-[10.5px]">{invoice.toAddress}</p>
                      )}
                    </div>
                    <div className="flex gap-6">
                      {invoice.issueDate && (
                        <div className={cn("text-right p-0.5", getHighlightClass('issueDate'))}>
                          <p className="font-semibold text-[#888888] tracking-[0.1em] uppercase text-[9.5px] mb-0.5">
                            Issue Date
                          </p>
                          <p className="font-medium text-[#111111] text-[10.5px]" suppressHydrationWarning>
                            {formatDate(invoice.issueDate)}
                          </p>
                        </div>
                      )}
                      {invoice.dueDate && (
                        <div className={cn("text-right p-0.5", getHighlightClass('dueDate'))}>
                          <p className="font-semibold text-[#888888] tracking-[0.1em] uppercase text-[9.5px] mb-0.5">
                            Validity
                          </p>
                          <p className="font-medium text-[#111111] text-[10.5px]" suppressHydrationWarning>
                            {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Subject Line (First Page Only) */}
                {page.showTop && invoice.subject && (
                  <div className={cn(
                    "border-b border-[#E5E5E5]/50 flex gap-2 p-0.5 mb-2 pb-1 text-[11px]",
                    getHighlightClass('subject')
                  )}>
                    <span className="font-bold text-[#111111] shrink-0 uppercase tracking-[0.05em]">Subject:</span>
                    <span className="font-bold text-[#111111]">{invoice.subject}</span>
                  </div>
                )}

                {/* Salutation / Intro (First Page Only) */}
                {page.showTop && invoice.salutation && (
                  <div className={cn("mb-2.5 p-0.5", getHighlightClass('salutation'))}>
                    <p className="text-[#555555] whitespace-pre-wrap text-[10.5px] leading-relaxed">
                      {invoice.salutation}
                    </p>
                  </div>
                )}

                {/* Line items table OR Condensed Scope & Warranty */}
                {invoice.isCondensed ? (
                  <div className="mb-3">
                    {/* Section 1: Structured Scope of Equipment & Works */}
                    {page.showCondensedScope && (
                      <div className="mb-3">
                        <div className="flex py-1 border-b-[1.5px] border-[#111111] mb-2">
                          <span className="text-[9.5px] font-bold text-[#111111] tracking-[0.08em] uppercase">
                            Scope of Equipment & Works
                          </span>
                        </div>

                        {(() => {
                          const activeScopes = (invoice.scopes && invoice.scopes.length > 0)
                            ? invoice.scopes.filter(s => s.enabled !== false)
                            : generateDefaultScopesFromInvoice(invoice)

                          return (
                            <div className="space-y-1.5 text-[10.5px] text-[#222222]">
                              {activeScopes.map((scopeItem, idx) => (
                                <div key={scopeItem.id || idx} className="p-1.5 px-2.5 rounded-[4px] bg-[#FAFAFA] border border-[#EBEBEB]">
                                  <div className="flex items-start gap-2">
                                    <span 
                                      className="font-bold text-white shrink-0 text-[9.5px] bg-[#111111] rounded-[2px] select-none shadow-xs mt-0.5" 
                                      style={{ 
                                        color: '#ffffff', 
                                        backgroundColor: '#111111',
                                        display: 'inline-block',
                                        width: '18px',
                                        height: '18px',
                                        lineHeight: '18px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      {scopeItem.letter || String.fromCharCode(65 + idx)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold text-[#111111] text-[11px] leading-snug">
                                        {scopeItem.title}
                                        {scopeItem.subtitle ? (
                                          <>: <span className="font-semibold text-[#333333]">{scopeItem.subtitle}</span></>
                                        ) : null}
                                      </div>
                                      {scopeItem.description && (
                                        <div className="text-[9.5px] text-[#555555] leading-tight mt-0.5 whitespace-pre-line">
                                          {scopeItem.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Section 2: Warranty Coverage Table */}
                    {page.showCondensedWarranty && (
                      <div className="mb-3 border border-[#E5E5E5] rounded-[5px] overflow-hidden print:break-inside-avoid shadow-xs">
                        <div className="bg-[#111111] px-3 py-1 flex items-center justify-between" style={{ backgroundColor: '#111111' }}>
                          <span className="text-[9px] font-bold text-white uppercase tracking-[0.08em]" style={{ color: '#ffffff' }}>
                            Warranty Coverage
                          </span>
                        </div>
                        <table className="w-full text-left text-[10px] border-collapse">
                          <thead>
                            <tr className="border-b border-[#E5E5E5] bg-[#F8F8F8]">
                              <th className="py-1 px-3 font-semibold text-[#111111] text-[9px] tracking-[0.05em] uppercase w-5/12">Component / Service</th>
                              <th className="py-1 px-3 font-semibold text-[#111111] text-[9px] tracking-[0.05em] uppercase w-4/12">Warranty Type</th>
                              <th className="py-1 px-3 font-semibold text-[#111111] text-[9px] tracking-[0.05em] uppercase w-3/12 text-right">Coverage Period</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E5E5] bg-white">
                            {(Array.isArray(invoice.warranties) && invoice.warranties.length > 0 ? invoice.warranties : generateDefaultWarrantiesFromInvoice(invoice))
                              .filter((w) => {
                                if (w.component.toLowerCase().includes('battery') && !scopeData.hasBattery) {
                                  return false
                                }
                                return true
                              })
                              .map((w) => (
                                <tr key={w.id}>
                                  <td className="py-1 px-3 font-semibold text-[#111111]">{w.component}</td>
                                  <td className="py-1 px-3 text-[#555555]">{w.warrantyType}</td>
                                  <td className="py-1 px-3 font-bold text-[#111111] text-right">{w.coverage}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  page.items.length > 0 ? (
                    <div className="mb-4">
                      {showPriceColumns ? (
                        <>
                          {showCapital && !invoice.isCondensed ? (
                            /* Capital Expanded View: Original (Base/Capital) + Selling (Marked up) columns */
                            <>
                              <div className="flex py-2 border-b-[1.5px] border-[#111111] items-center text-[10px] font-semibold text-[#111111] tracking-[0.05em] uppercase px-1">
                                <span className="flex-1">
                                  Description
                                </span>
                                <span className="w-12 shrink-0 text-center">
                                  Unit
                                </span>
                                <span className="w-10 shrink-0 text-center">
                                  Qty
                                </span>
                                <span className="w-20 shrink-0 text-right px-1">
                                  Orig Rate
                                </span>
                                <span className="w-22 shrink-0 text-right px-1">
                                  Orig Amt
                                </span>
                                <span className={cn("w-22 shrink-0 text-right px-1", getHighlightClass('rateMarkup'))}>
                                  Rate {rateMarkup > 0 ? `(+${rateMarkup}%)` : (rateMarkup < 0 ? `(${rateMarkup}%)` : '')}
                                </span>
                                <span className="w-24 shrink-0 text-right pr-1">
                                  Amount
                                </span>
                              </div>
                              {page.items.map((item) => {
                                const isCondensedItem = item.id.startsWith('condensed-')
                                const isDelivery = !isCondensedItem && isDeliveryItem(item.description)
                                const isLabor = !isCondensedItem && !isDelivery && isLaborItem(item.description)
                                const shouldApplyMarkup = !isCondensedItem && !isDelivery && !(invoice.excludeLaborMarkup && isLabor)
                                const adjustedRate = isCondensedItem ? item.rate : (shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate)
                                const displayDesc = isCondensedItem ? item.description : formatItemDescription(item.description, invoice.withBrandName !== false)
                                const descLower = item.description.toLowerCase().trim()
                                const isDeliveryOrLabor = isLabor || descLower.includes('delivery') || descLower.includes('freight') || descLower.includes('service') || descLower.includes('labor') || descLower.includes('installation') || item.id === 'condensed-services' || item.id === 'condensed-delivery'
                                const hasPrice = (item.rate || 0) > 0
                                return (
                                  <div key={item.id} className={cn("flex py-1.5 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                                    <span className="flex-1 text-[12px] text-[#111111] break-words whitespace-pre-wrap pr-3">
                                      {displayDesc || '—'}
                                    </span>
                                    <span className="w-12 shrink-0 text-[11.5px] text-[#888888] text-center">
                                      {!hasPrice || isDeliveryOrLabor ? '—' : (item.unit || '—')}
                                    </span>
                                    <span className="w-10 shrink-0 text-[11.5px] text-[#888888] text-center">
                                      {!hasPrice || isDeliveryOrLabor ? '—' : (item.quantity || '—')}
                                    </span>
                                    <span className="w-20 shrink-0 text-[11.5px] text-[#888888] text-right px-1 font-mono">
                                      {!hasPrice || isDeliveryOrLabor ? '—' : formatCurrency(item.rate, invoice.currency)}
                                    </span>
                                    <span className="w-22 shrink-0 text-[11.5px] text-[#666666] text-right px-1 font-mono">
                                      {!hasPrice || isDeliveryOrLabor ? '—' : formatCurrency(item.quantity * item.rate, invoice.currency)}
                                    </span>
                                    <span className={cn("w-22 shrink-0 text-[11.5px] text-[#888888] text-right px-1 font-mono", getHighlightClass('rateMarkup'))}>
                                      {!hasPrice || isDeliveryOrLabor ? '—' : formatCurrency(adjustedRate, invoice.currency)}
                                    </span>
                                    <span className="w-24 shrink-0 text-[11.5px] font-medium text-[#111111] text-right pr-1 font-mono">
                                      {!hasPrice ? '—' : formatCurrency(item.quantity * adjustedRate, invoice.currency)}
                                    </span>
                                  </div>
                                )
                              })}
                            </>
                          ) : (
                            /* Standard / Default View */
                            <>
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
                                <span className={cn("w-24 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right px-1", getHighlightClass('rateMarkup'))}>
                                  Rate
                                </span>
                                <span className="w-28 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
                                  Amount
                                </span>
                              </div>
                              {page.items.map((item) => {
                                const isCondensedItem = item.id.startsWith('condensed-')
                                const isDelivery = !isCondensedItem && isDeliveryItem(item.description)
                                const isLabor = !isCondensedItem && !isDelivery && isLaborItem(item.description)
                                const shouldApplyMarkup = !isCondensedItem && !isDelivery && !(invoice.excludeLaborMarkup && isLabor)
                                const adjustedRate = isCondensedItem ? item.rate : (shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate)
                                const displayDesc = isCondensedItem ? item.description : formatItemDescription(item.description, invoice.withBrandName !== false)
                                const descLower = item.description.toLowerCase().trim()
                                const isDeliveryOrLabor = isLabor || descLower.includes('delivery') || descLower.includes('freight') || descLower.includes('service') || descLower.includes('labor') || descLower.includes('installation') || item.id === 'condensed-services' || item.id === 'condensed-delivery'
                                const hasPrice = (item.rate || 0) > 0
                                return (
                                  <div key={item.id} className={cn("flex py-1.5 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                                    <span className="flex-1 text-[12.5px] text-[#111111] break-words whitespace-pre-wrap pr-4">
                                      {displayDesc || '—'}
                                    </span>
                                    <span className="w-16 shrink-0 text-[12.5px] text-[#888888] text-center">
                                      {!hasPrice || isDeliveryOrLabor ? '—' : (item.unit || '—')}
                                    </span>
                                    <span className="w-14 shrink-0 text-[12.5px] text-[#888888] text-center">
                                      {!hasPrice || isDeliveryOrLabor ? '—' : (item.quantity || '—')}
                                    </span>
                                    <span className={cn("w-24 shrink-0 text-[12.5px] text-[#888888] text-right px-1", getHighlightClass('rateMarkup'))}>
                                      {!hasPrice || isDeliveryOrLabor ? '—' : formatCurrency(adjustedRate, invoice.currency)}
                                    </span>
                                    <span className="w-28 shrink-0 text-[12.5px] font-medium text-[#111111] text-right">
                                      {!hasPrice ? '—' : formatCurrency(item.quantity * adjustedRate, invoice.currency)}
                                    </span>
                                  </div>
                                )
                              })}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex py-2 border-b-[1.5px] border-[#111111]">
                            <span className="flex-1 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase">
                              Description
                            </span>
                          </div>
                          {page.items.map((item) => {
                            const isCondensedItem = item.id.startsWith('condensed-')
                            const displayDesc = isCondensedItem ? item.description : formatItemDescription(item.description, invoice.withBrandName !== false)
                            return (
                              <div key={item.id} className={cn("flex py-1.5 border-b border-[#E5E5E5] items-start print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                                <span className="flex-1 text-[12.5px] text-[#111111] break-words whitespace-pre-wrap">
                                  {displayDesc || '—'}
                                </span>
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                  ) : null
                )}

                {/* Totals + Bank Details (directly below items) */}
                {page.showTotals && (
                  <>
                    {showCapital && !invoice.isCondensed ? (
                      <div className="flex flex-col items-end print:break-inside-avoid w-full gap-2 mb-4 mt-3 px-1">
                        <div className="flex items-center w-full">
                          <span className="flex-1 text-right text-[#888888] pr-3 text-[12px]">Standard Price</span>
                          <span className="w-24 shrink-0 text-right pr-1 font-mono font-medium text-[#111111] text-[12px]">
                            {formatCurrency(subtotal, invoice.currency)}
                          </span>
                        </div>
                        {discount > 0 && (
                          <div className="flex items-center w-full">
                            <span className="flex-1 text-right text-[#888888] pr-3 text-[12px]">Discount Amount</span>
                            <span className="w-24 shrink-0 text-right pr-1 font-mono font-semibold text-emerald-600 text-[12px]">
                              - {formatCurrency(discount, invoice.currency)}
                            </span>
                          </div>
                        )}
                        <div className={cn("flex items-center w-full", getHighlightClass('vatRate'))}>
                          <span className="flex-1 text-right text-[#888888] pr-3 text-[12px]">VAT {invoice.vatRate || 0}%</span>
                          <span className="w-24 shrink-0 text-right pr-1 font-mono font-medium text-[#111111] text-[12px]">
                            {formatCurrency(vat, invoice.currency)}
                          </span>
                        </div>
                        <div className="flex justify-end w-full my-1">
                          <div className="w-[272px] bg-[#E5E5E5] h-px" />
                        </div>
                        <div className="flex items-center w-full">
                          <span className="flex-1 text-right font-bold text-[#111111] pr-3 text-[15px] tracking-tight">
                            Final Total Price {(invoice.rateMarkup ?? 0) > 0 ? `(+${invoice.rateMarkup}%)` : ((invoice.rateMarkup ?? 0) < 0 ? `(${invoice.rateMarkup}%)` : '')}
                          </span>
                          <span className="w-24 shrink-0 text-right pr-1 font-bold text-[#111111] font-mono text-[20px] tracking-tight">
                            {formatCurrency(total, invoice.currency)}
                          </span>
                        </div>
                        <div className="flex items-center w-full">
                          <span className="flex-1 text-right font-bold text-[#111111] pr-3 text-[15px] tracking-tight">
                            Capital
                          </span>
                          <span className="w-22 shrink-0 text-right px-1 font-bold text-[#111111] font-mono text-[18px] tracking-tight">
                            {formatCurrency(itemsBaseCapitalTotal, invoice.currency)}
                          </span>
                          <span className="w-22 shrink-0" />
                          <span className="w-24 shrink-0 pr-1" />
                        </div>
                      </div>
                    ) : (
                      <div className={cn(
                        "flex flex-col items-end print:break-inside-avoid pr-1",
                        invoice.isCondensed ? "gap-1.5 mb-2 mt-2" : "gap-2 mb-4 mt-3"
                      )}>
                        <div className="flex gap-8 items-center">
                          <span className={cn("text-[#888888]", invoice.isCondensed ? "text-[11.5px]" : "text-[12px]")}>Standard Price</span>
                          <span className={cn("font-medium text-[#111111] w-36 text-right font-mono", invoice.isCondensed ? "text-[12px]" : "text-[12px]")}>
                            {formatCurrency(subtotal, invoice.currency)}
                          </span>
                        </div>
                        {discount > 0 && (
                          <div className="flex gap-8 items-center">
                            <span className={cn("text-[#888888]", invoice.isCondensed ? "text-[11.5px]" : "text-[12px]")}>Discount Amount</span>
                            <span className={cn("font-semibold text-emerald-600 w-36 text-right font-mono", invoice.isCondensed ? "text-[12px]" : "text-[12px]")}>
                              - {formatCurrency(discount, invoice.currency)}
                            </span>
                          </div>
                        )}
                        <div className={cn("flex gap-8 items-center p-0.5", getHighlightClass('vatRate'))}>
                          <span className={cn("text-[#888888]", invoice.isCondensed ? "text-[11.5px]" : "text-[12px]")}>VAT {invoice.vatRate || 0}%</span>
                          <span className={cn("font-medium text-[#111111] w-36 text-right font-mono", invoice.isCondensed ? "text-[12px]" : "text-[12px]")}>
                            {formatCurrency(vat, invoice.currency)}
                          </span>
                        </div>
                        <div className={cn("bg-[#E5E5E5]", invoice.isCondensed ? "w-48 h-px" : "w-52 h-px")} />
                        <div className="flex gap-8 items-center">
                          <span className={cn("font-bold text-[#111111] tracking-tight", invoice.isCondensed ? "text-[14px]" : "text-[15px]")}>
                            {showCapital 
                              ? `Final Total Price ${(invoice.rateMarkup ?? 0) > 0 ? `(+${invoice.rateMarkup}%)` : ((invoice.rateMarkup ?? 0) < 0 ? `(${invoice.rateMarkup}%)` : '')}`
                              : (invoice.isCondensed ? 'Final Total Price' : 'Total')}
                          </span>
                          <span className={cn("font-bold text-[#111111] tracking-tight w-36 text-right font-mono", invoice.isCondensed ? "text-[18px]" : "text-[20px]")}>
                            {formatCurrency(total, invoice.currency)}
                          </span>
                        </div>
                        {showCapital && (
                          <div className="flex gap-8 items-center">
                            <span className={cn("font-bold text-[#111111] tracking-tight", invoice.isCondensed ? "text-[14px]" : "text-[15px]")}>
                              Capital
                            </span>
                            <span className={cn("font-bold text-[#111111] tracking-tight w-36 text-right font-mono", invoice.isCondensed ? "text-[18px]" : "text-[20px]")}>
                              {formatCurrency(itemsBaseCapitalTotal, invoice.currency)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Footer block: Note, Sales, Terms, Closing, Signatures */}
                {page.showBottom && (() => {
                  let hasRenderedPriorBlock = page.items.length > 0 || (page.showTotals && !invoice.isCondensed)
                  
                  const getSectionBorderClass = () => {
                    if (hasRenderedPriorBlock) {
                      return "border-t border-[#E5E5E5] pt-6 mb-6 print:break-inside-avoid p-1"
                    }
                    hasRenderedPriorBlock = true
                    return "mb-6 print:break-inside-avoid p-1"
                  }

                  return (
                    <>
                      {/* Note */}
                      {invoice.note && (
                        <div className={cn(
                          getSectionBorderClass(),
                          getHighlightClass('note')
                        )}>
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
                        <div className={cn(
                          getSectionBorderClass(),
                          getHighlightClass('sales')
                        )}>
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
                        <div className={cn(
                          getSectionBorderClass(),
                          getHighlightClass('terms')
                        )}>
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
                        <div className={cn(
                          "mt-6 pt-4 border-t border-[#E5E5E5]/50 print:break-inside-avoid p-1",
                          getHighlightClass('closing')
                        )}>
                          <p className="text-[12px] text-[#555555] italic text-center font-medium">
                            {invoice.closing}
                          </p>
                        </div>
                      )}

                      {/* Acknowledgment & Conforme */}
                      {invoice.closing && (
                        <div className="mt-8 pt-4 border-t border-[#E5E5E5] print:break-inside-avoid">
                          <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase mb-8">
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
                      )}
                    </>
                  )
                })()}
                </div>

                {/* Bottom Page Number Indicator */}
                <div className="w-full flex justify-end items-center pt-2 mt-auto">
                  <span className="text-[10px] text-[#888888] font-mono select-none">
                    Page {pageIndex + 1} of {totalPages}
                  </span>
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
