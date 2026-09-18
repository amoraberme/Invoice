'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { type Invoice, type LineItem, TERMS_PRESETS, isGovernmentTerms } from '@/lib/types'
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
import { Sparkles, Eye, FileText, Check, ShieldCheck, Tag, Upload } from 'lucide-react'

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
  onLogoClick?: () => void
  onToggleAcknowledgment?: (val: boolean) => void
  onToggleAcknowledgmentTitle?: (val: boolean) => void
  onToggleTermsTitle?: (val: boolean) => void
  onToggleTermsPreset?: (terms: string) => void
  onAdjustFooterOffset?: (val: number) => void
  onSignatureClick?: (signee: 'sales' | 'client' | 'ceo') => void
}

interface PageData {
  items: LineItem[]
  showTop: boolean
  showTotals: boolean
  showBottom: boolean
  showCondensedScope?: boolean
  showCondensedWarranty?: boolean
}

function renderFormattedTerms(terms?: string) {
  if (!terms) return null
  const parts = terms.split(/(Terms of Payment\s*:|Delivery\s*:|Payment Terms\s*:|Price Validity\s*:|Late Payment Interest\s*:|Delivery Terms\s*:)/gi)
  return parts.map((part, index) => {
    if (/^(Terms of Payment|Delivery|Payment Terms|Price Validity|Late Payment Interest|Delivery Terms)\s*:$/i.test(part)) {
      return (
        <strong key={index} className="font-bold text-[#111111]">
          {part}
        </strong>
      )
    }
    return part
  })
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
  onLogoClick,
  onToggleAcknowledgment,
  onToggleAcknowledgmentTitle,
  onToggleTermsTitle,
  onToggleTermsPreset,
  onAdjustFooterOffset,
  onSignatureClick,
}: MGInvoicePreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const prevPagesCountRef = useRef<number>(0)

  const getHighlightClass = (field: string) => {
    const isHovered = hoveredField === field || 
      (field === 'logo' && hoveredField === 'logo') ||
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

  const isGovMode = isGovernmentTerms(invoice.terms)
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
    const panelWatts = panelWattMatch ? `${panelWattMatch[1]}W` : '625W'
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
    const isGovMode = isGovernmentTerms(inv.terms)

    // 1. Measure fixed heights (Header + Bill To + Meta)
    const hasHeaderDetails = Boolean(inv.fromEmail || inv.fromPhone || inv.fromAddress)
    const headerHeight = hasHeaderDetails ? 95 : 65
    const billToHeight = Boolean(inv.toEmail || inv.toAddress) ? 75 : 55
    const continuationHeaderHeight = 35
    
    const subjectLines = getWrappedLines(inv.subject, 65)
    const subjectHeight = inv.subject ? (10 + subjectLines * 13) : 0
    
    const salutationLines = getWrappedLines(inv.salutation, 65)
    const salutationHeight = inv.salutation ? (10 + salutationLines * 13) : 0
    
    const topSectionHeight = headerHeight + billToHeight + subjectHeight + salutationHeight
    const tableHeaderHeight = 26
    
    // 2. Totals height (includes Capital row in Capital mode)
    const totalsLines = isCapitalMode ? 4 : 3 // Subtotal + VAT + Total (+ Capital)
    let totalsHeight = totalsLines * 18 + 22
    
    // 3. Footer block height (Note, Terms, Sales Contact, Closing, Acknowledgment)
    const noteLines = getWrappedLines(inv.note, 65)
    const noteHeight = inv.note ? (10 + noteLines * 13) : 0
    
    const termsLines = getWrappedLines(inv.terms, 65)
    const termsHeight = inv.terms ? (isGovMode ? (8 + termsLines * 12) : (12 + termsLines * 14)) : 0
    
    const hasSalesContact = Boolean(inv.note?.trim()) && Boolean(inv.salesName || inv.salesPosition || inv.salesCompany)
    const salesContactHeight = hasSalesContact ? 55 : 0
    const closingHeight = inv.closing ? (isGovMode ? 26 : 40) : 0
    const showSales = inv.showSalesSignee === true
    const showClient = inv.showClientSignee === true
    const showCeo = inv.showCeoSignee !== false
    const hasVisibleSignees = showSales || showClient || showCeo
    const showAck = inv.showAcknowledgment !== false && hasVisibleSignees
    const ackHeight = (inv.closing && showAck) ? (isGovMode ? 60 : 75) : 0
    
    const footerBlockHeight = noteHeight + termsHeight + salesContactHeight + closingHeight + ackHeight + (isGovMode ? 4 : 20)

    // Available content height inside A4 borders (PAPER_H 1123 with safe bottom margins)
    const PAGE_MAX_H = isGovMode ? 980 : 940

    // Helper: calculate height of a line item
    const getItemHeight = (item: LineItem) => {
      const desc = item.description || ''
      const lines = desc.split('\n')
      const charsPerLine = (isCapitalMode && !inv.isCondensed) ? 32 : 45
      let itemLines = 0
      for (const line of lines) {
        itemLines += Math.max(1, Math.ceil(Math.max(line.length, 1) / charsPerLine))
      }
      return isGovMode ? (10 + itemLines * 13) : (14 + itemLines * 15)
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
                className={cn(
                  "relative bg-white rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] print-page print:!transform-none flex flex-col justify-between px-13",
                  isGovMode ? "pt-7 pb-6" : "py-10"
                )}
              >
                <div>
                {/* Header (First Page Only) or Continuation Header */}
                {page.showTop ? (
                  <div className={cn("flex justify-between items-start", isGovMode ? "mb-2" : "mb-3.5")}>
                    <div className={cn("max-w-sm p-0.5", getHighlightClass('sender'))}>
                      <p className="font-bold text-[#111111] tracking-tight leading-snug text-[18px] mb-1">
                        {invoice.fromName || 'Your Company'}
                      </p>
                      <div className="space-y-0.5 text-[#888888] text-[10.5px] leading-normal">
                        {invoice.fromEmail && (
                          <p>{invoice.fromEmail}</p>
                        )}
                        {invoice.fromPhone && (
                          <p>{invoice.fromPhone}</p>
                        )}
                        {invoice.fromAddress && (
                          <p className="whitespace-pre-line">{invoice.fromAddress}</p>
                        )}
                      </div>
                    </div>
                    <div className={cn("text-right flex flex-col items-end p-0.5", getHighlightClass('invoiceNumber'))}>
                      {invoice.logo !== '' && (
                        <div
                          className={cn(
                            "relative group rounded transition-all",
                            getHighlightClass('logo'),
                            onLogoClick && "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:ring-offset-1"
                          )}
                          onClick={onLogoClick}
                          title={onLogoClick ? "Click to change logo" : undefined}
                        >
                          <img
                            src={invoice.logo || "/mg.png"}
                            alt={invoice.fromName || "Company Logo"}
                            data-role="invoice-logo"
                            height={68}
                            style={{ height: '68px', width: 'auto', maxHeight: '68px', maxWidth: '240px' }}
                            className="w-auto object-contain h-[68px] mb-0.5"
                          />
                          {onLogoClick && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center text-white text-[9.5px] font-bold tracking-wide print:hidden gap-1 px-1.5 shadow-sm select-none">
                              <Upload size={11} />
                              <span>Change</span>
                            </div>
                          )}
                        </div>
                      )}
                      {invoice.logo === '' && onLogoClick && (
                        <button
                          type="button"
                          onClick={onLogoClick}
                          className="print:hidden text-[10px] text-muted-foreground border border-dashed border-[#CCCCCC] rounded px-2 py-1 mb-1 hover:border-primary hover:text-primary transition-colors flex items-center gap-1 cursor-pointer select-none"
                          title="Click to upload logo"
                        >
                          <Upload size={10} />
                          <span>+ Add Logo</span>
                        </button>
                      )}
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
                  <div className={cn("flex justify-between items-start", isGovMode ? "mb-2" : "mb-3")}>
                    <div className={cn("max-w-xs p-0.5", getHighlightClass('client'))}>
                      <p className="font-semibold text-[#888888] tracking-[0.1em] uppercase text-[9.5px] mb-0.5">
                        Bill To
                      </p>
                      <p className="font-bold text-[#111111] tracking-tight text-[13px] leading-snug mb-0.5">
                        {invoice.toName || '—'}
                      </p>
                      <div className="space-y-0.5 text-[#888888] text-[10.5px] leading-normal">
                        {invoice.toEmail && (
                          <p>{invoice.toEmail}</p>
                        )}
                        {invoice.toAddress && (
                          <p className="whitespace-pre-line">{invoice.toAddress}</p>
                        )}
                      </div>
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
                    "border-b border-[#D4D4D8] flex gap-2 p-0.5 mb-2 pb-1 text-[11px]",
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
                            {(Array.isArray(invoice.warranties) ? invoice.warranties : generateDefaultWarrantiesFromInvoice(invoice))
                              .filter((w) => {
                                if (w.id === 'w-3' && !scopeData.hasBattery) {
                                  return false
                                }
                                return true
                              })
                              .map((w) => {
                                return (
                                  <tr key={w.id}>
                                    <td className="py-1 px-3 font-semibold text-[#111111]">{w.component}</td>
                                    <td className="py-1 px-3 text-[#555555]">{w.warrantyType}</td>
                                    <td className="py-1 px-3 font-bold text-[#111111] text-right">{w.coverage}</td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  page.items.length > 0 ? (
                    <div className={cn(isGovMode ? "mb-2" : "mb-4")}>
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
                                <span className="w-26 shrink-0 text-right px-1">
                                  Orig Amt
                                </span>
                                <span className={cn("w-22 shrink-0 text-right px-1", getHighlightClass('rateMarkup'))}>
                                  Rate {rateMarkup > 0 ? `(+${rateMarkup}%)` : (rateMarkup < 0 ? `(${rateMarkup}%)` : '')}
                                </span>
                                <span className="w-28 shrink-0 text-right pr-1">
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
                                  <div key={item.id} className={cn("flex pt-0.5 pb-2 border-b border-[#E5E5E5] items-center print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                                    <span className="flex-1 text-[12px] leading-snug text-[#111111] break-words whitespace-pre-wrap pr-3">
                                      {displayDesc || '—'}
                                    </span>
                                    <span className="w-12 shrink-0 text-[11.5px] leading-snug text-[#888888] text-center">
                                      {isDeliveryOrLabor ? '—' : (item.unit || '—')}
                                    </span>
                                    <span className="w-10 shrink-0 text-[11.5px] leading-snug text-[#888888] text-center">
                                      {isDeliveryOrLabor ? '—' : (item.quantity || '—')}
                                    </span>
                                    <span className="w-20 shrink-0 text-[11.5px] leading-snug text-[#888888] text-right px-1 font-mono tabular-nums">
                                      {!hasPrice || isDeliveryOrLabor ? '—' : formatCurrency(item.rate, invoice.currency)}
                                    </span>
                                    <span className="w-26 shrink-0 text-[11.5px] leading-snug text-[#666666] text-right px-1 font-mono tabular-nums">
                                      {!hasPrice ? '—' : formatCurrency(item.quantity * item.rate, invoice.currency)}
                                    </span>
                                    <span className={cn("w-22 shrink-0 text-[11.5px] leading-snug text-[#888888] text-right px-1 font-mono tabular-nums", getHighlightClass('rateMarkup'))}>
                                      {!hasPrice ? '—' : formatCurrency(adjustedRate, invoice.currency)}
                                    </span>
                                    <span className="w-28 shrink-0 text-[11.5px] leading-snug font-medium text-[#111111] text-right pr-1 font-mono tabular-nums">
                                      {!hasPrice ? '—' : formatCurrency(item.quantity * adjustedRate, invoice.currency)}
                                    </span>
                                  </div>
                                )
                              })}
                            </>
                          ) : (
                            /* Standard / Default View */
                            <>
                              <div className="flex py-2 border-b-[1.5px] border-[#111111] items-center">
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
                                  <div key={item.id} className={cn(
                                    "flex border-b border-[#E5E5E5] items-center print:break-inside-avoid px-1",
                                    isGovMode ? "pt-0.5 pb-2" : "pt-1 pb-2.5",
                                    getHighlightClass(item.id)
                                  )}>
                                    <span className={cn("flex-1 text-[#111111] break-words whitespace-pre-wrap pr-4 leading-snug", isGovMode ? "text-[12px]" : "text-[12.5px]")}>
                                      {displayDesc || '—'}
                                    </span>
                                    <span className={cn("w-16 shrink-0 text-[#888888] text-center leading-snug", isGovMode ? "text-[12px]" : "text-[12.5px]")}>
                                      {isDeliveryOrLabor ? '—' : (item.unit || '—')}
                                    </span>
                                    <span className={cn("w-14 shrink-0 text-[#888888] text-center leading-snug", isGovMode ? "text-[12px]" : "text-[12.5px]")}>
                                      {isDeliveryOrLabor ? '—' : (item.quantity || '—')}
                                    </span>
                                    <span className={cn("w-24 shrink-0 text-[#888888] text-right px-1 leading-snug", isGovMode ? "text-[12px]" : "text-[12.5px]", getHighlightClass('rateMarkup'))}>
                                      {!hasPrice || isDeliveryOrLabor ? '—' : formatCurrency(adjustedRate, invoice.currency)}
                                    </span>
                                    <span className={cn("w-28 shrink-0 font-medium text-[#111111] text-right leading-snug", isGovMode ? "text-[12px]" : "text-[12.5px]")}>
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
                          <div className="flex py-2 border-b-[1.5px] border-[#111111] items-center">
                            <span className="flex-1 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase">
                              Description
                            </span>
                          </div>
                          {page.items.map((item) => {
                            const isCondensedItem = item.id.startsWith('condensed-')
                            const displayDesc = isCondensedItem ? item.description : formatItemDescription(item.description, invoice.withBrandName !== false)
                            return (
                              <div key={item.id} className={cn("flex pt-0.5 pb-2 border-b border-[#E5E5E5] items-center print:break-inside-avoid px-1", getHighlightClass(item.id))}>
                                <span className="flex-1 text-[12.5px] leading-snug text-[#111111] break-words whitespace-pre-wrap">
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
                      <div className="w-full mb-4 mt-2 print:break-inside-avoid">
                        {/* Standard Price */}
                        <div className="flex items-center px-1 py-0.5">
                          <span className="flex-1 text-right text-[#888888] pr-3 text-[11.5px]">Standard Price</span>
                          <span className="w-28 shrink-0 text-right pr-1 font-mono tabular-nums font-medium text-[#111111] text-[11.5px]">
                            {formatCurrency(subtotal, invoice.currency)}
                          </span>
                        </div>

                        {/* Discount Amount */}
                        {discount > 0 && (
                          <div className="flex items-center px-1 py-0.5">
                            <span className="flex-1 text-right text-[#888888] pr-3 text-[11.5px]">Discount Amount</span>
                            <span
                              style={{ color: '#059669' }}
                              className="w-28 shrink-0 text-right pr-1 font-mono tabular-nums font-semibold text-[#059669] text-[11.5px]"
                            >
                              - {formatCurrency(discount, invoice.currency)}
                            </span>
                          </div>
                        )}

                        {/* VAT */}
                        <div className={cn("flex items-center px-1 py-0.5", getHighlightClass('vatRate'))}>
                          <span className="flex-1 text-right text-[#888888] pr-3 text-[11.5px]">VAT {invoice.vatRate || 0}%</span>
                          <span className="w-28 shrink-0 text-right pr-1 font-mono tabular-nums font-medium text-[#111111] text-[11.5px]">
                            {formatCurrency(vat, invoice.currency)}
                          </span>
                        </div>

                        {/* Divider rule across price columns (Orig Amt through Amount: 104px + 88px + 112px = 304px) */}
                        <div className="flex justify-end w-full my-1.5 px-1">
                          <div className="w-[304px] border-t-[1.5px] border-[#111111]" />
                        </div>

                        {/* Unified Summary Row: Capital in Orig Amt, Final Total in Amount */}
                        <div className="flex items-end px-1 pt-0.5 pb-1">
                          <span className="flex-1 text-right font-bold text-[#111111] pr-3 text-[12px] uppercase tracking-wider">
                            Total
                          </span>
                          <span className="w-12 shrink-0" />
                          <span className="w-10 shrink-0" />
                          <span className="w-20 shrink-0" />
                          {/* Capital under Orig Amt */}
                          <div className="w-26 shrink-0 text-right px-1 flex flex-col items-end">
                            <span className="text-[9.5px] font-bold text-[#777777] uppercase tracking-wider mb-0.5">
                              Capital
                            </span>
                            <span className="font-bold text-[#111111] font-mono tabular-nums text-[14.5px] tracking-tight">
                              {formatCurrency(itemsBaseCapitalTotal, invoice.currency)}
                            </span>
                          </div>
                          {/* Spacer under Rate */}
                          <span className="w-22 shrink-0" />
                          {/* Final Total under Amount */}
                          <div className="w-28 shrink-0 text-right pr-1 flex flex-col items-end">
                            <span className="text-[9.5px] font-bold text-[#777777] uppercase tracking-wider mb-0.5 whitespace-nowrap">
                              Final Total {(invoice.rateMarkup ?? 0) > 0 ? `(+${invoice.rateMarkup}%)` : ''}
                            </span>
                            <span className="font-bold text-[#111111] font-mono tabular-nums text-[15px] tracking-tight">
                              {formatCurrency(total, invoice.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={cn(
                        "flex flex-col items-end print:break-inside-avoid pr-1",
                        invoice.isCondensed ? "gap-1.5 mb-2 mt-2" : isGovMode ? "gap-1 mb-2 mt-1" : "gap-2 mb-4 mt-3"
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
                            <span
                              style={{ color: '#059669' }}
                              className={cn("font-semibold text-[#059669] w-36 text-right font-mono", invoice.isCondensed ? "text-[12px]" : "text-[12px]")}
                            >
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
                  const isGovMode = isGovernmentTerms(invoice.terms)
                  let hasRenderedPriorBlock = page.items.length > 0 || (page.showTotals && !invoice.isCondensed)
                  
                  const getSectionBorderClass = () => {
                    if (hasRenderedPriorBlock) {
                      return isGovMode
                        ? "pt-1 mb-2 print:break-inside-avoid p-0.5"
                        : "border-t border-[#E5E5E5] pt-6 mb-6 print:break-inside-avoid p-1"
                    }
                    hasRenderedPriorBlock = true
                    return isGovMode
                      ? "mb-2 print:break-inside-avoid p-0.5"
                      : "mb-6 print:break-inside-avoid p-1"
                  }

                  return (
                    <div
                      className="relative group/footer-block"
                      style={{
                        marginTop: invoice.footerOffsetY ? `${invoice.footerOffsetY}px` : undefined,
                      }}
                    >
                      {/* Floating Position Adjuster for Terms, Closing, & Signatures */}
                      {onAdjustFooterOffset && (
                        <div className="no-print print:hidden opacity-0 group-hover/footer-block:opacity-100 transition-opacity absolute -top-6 left-0 flex items-center gap-1.5 bg-background/95 backdrop-blur-xs border border-border shadow-xs rounded-md px-2 py-0.5 z-30 select-none text-[9.5px]">
                          <span className="text-[9px] font-semibold text-muted-foreground">Adjust Position:</span>
                          <button
                            type="button"
                            onClick={() => onAdjustFooterOffset((invoice.footerOffsetY || 0) - 4)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-secondary font-bold text-foreground cursor-pointer border border-border/80 text-[11px] leading-none"
                            title="Move section Up (-4px)"
                          >
                            −
                          </button>
                          <span className="font-mono font-bold text-[9.5px] min-w-[32px] text-center text-foreground">
                            {(invoice.footerOffsetY || 0) > 0 ? `+${invoice.footerOffsetY}` : (invoice.footerOffsetY || 0)}px
                          </span>
                          <button
                            type="button"
                            onClick={() => onAdjustFooterOffset((invoice.footerOffsetY || 0) + 4)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-secondary font-bold text-foreground cursor-pointer border border-border/80 text-[11px] leading-none"
                            title="Move section Down (+4px)"
                          >
                            +
                          </button>
                          {(invoice.footerOffsetY || 0) !== 0 && (
                            <button
                              type="button"
                              onClick={() => onAdjustFooterOffset(0)}
                              className="text-[8.5px] text-primary hover:underline px-1 py-0.5 cursor-pointer ml-0.5 font-medium"
                              title="Reset position to 0px"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}

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

                      {/* Sales Contact (below Note, far left — only rendered if Note is present) */}
                      {Boolean(invoice.note?.trim()) && (invoice.salesName || invoice.salesPosition || invoice.salesCompany) && (
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
                          getHighlightClass('terms'),
                          "relative group/terms"
                        )}>
                          {invoice.showTermsTitle !== false ? (
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 group/termstitle">
                                <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase">
                                  Terms & Conditions
                                </p>
                                {onToggleTermsTitle && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleTermsTitle(false)}
                                    className="no-print print:hidden opacity-0 group-hover/termstitle:opacity-100 transition-opacity text-[8.5px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded border border-border/80 hover:border-destructive/30 bg-background cursor-pointer select-none"
                                    title="Hide 'Terms & Conditions' text heading"
                                  >
                                    ✕ Hide Title
                                  </button>
                                )}
                              </div>

                              {onToggleTermsPreset && (
                                <div className="no-print print:hidden opacity-0 group-hover/terms:opacity-100 transition-opacity flex items-center gap-1 bg-background/95 p-0.5 rounded border border-border/80 text-[8.5px]">
                                  <button
                                    type="button"
                                    onClick={() => onToggleTermsPreset(TERMS_PRESETS.standard)}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium",
                                      !isGovernmentTerms(invoice.terms)
                                        ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                    title="Switch to Standard Policy"
                                  >
                                    Standard
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onToggleTermsPreset(TERMS_PRESETS.government)}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium",
                                      isGovernmentTerms(invoice.terms)
                                        ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                    title="Switch to Government / 10–15 Days Lead Time Terms"
                                  >
                                    Gov / P.O.
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* When title is hidden, floating hover tools only appear outside on mouse hover, never taking space in the document */
                            (onToggleTermsTitle || onToggleTermsPreset) && (
                              <div className="no-print print:hidden opacity-0 group-hover/terms:opacity-100 transition-opacity absolute -top-3 right-0 flex items-center gap-1 bg-background/95 p-0.5 rounded border border-border/80 text-[8.5px] shadow-xs z-10 select-none">
                                {onToggleTermsTitle && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleTermsTitle(true)}
                                    className="px-1.5 py-0.5 rounded cursor-pointer transition-colors text-muted-foreground hover:text-foreground font-medium hover:bg-secondary/50"
                                    title="Show 'Terms & Conditions' heading"
                                  >
                                    + Show Title
                                  </button>
                                )}
                                {onToggleTermsPreset && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onToggleTermsPreset(TERMS_PRESETS.standard)}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium",
                                        !isGovernmentTerms(invoice.terms)
                                          ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                      title="Switch to Standard Policy"
                                    >
                                      Standard
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onToggleTermsPreset(TERMS_PRESETS.government)}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium",
                                        isGovernmentTerms(invoice.terms)
                                          ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                      title="Switch to Government / 10–15 Days Lead Time Terms"
                                    >
                                      Gov / P.O.
                                    </button>
                                  </>
                                )}
                              </div>
                            )
                          )}
                          <p className={cn(
                            "text-[12px] text-[#555555] whitespace-pre-wrap",
                            isGovMode ? "leading-snug" : "leading-relaxed"
                          )}>
                            {renderFormattedTerms(invoice.terms)}
                          </p>
                        </div>
                      )}

                      {/* Closing & Acknowledgment Section */}
                      {invoice.closing && (
                        <div className={cn(
                          isGovMode
                            ? "mt-1.5 pt-0 print:break-inside-avoid p-0.5"
                            : "mt-6 pt-4 border-t border-[#E5E5E5]/50 print:break-inside-avoid p-1",
                          getHighlightClass('closing')
                        )}>
                          <p className="text-[12px] text-[#555555] italic text-center font-medium">
                            {invoice.closing}
                          </p>
                        </div>
                      )}

                      {/* Acknowledgment & Conforme */}
                      {invoice.closing && invoice.showAcknowledgment !== false && (
                        <div className={cn(
                          isGovMode
                            ? "mt-1.5 pt-0 print:break-inside-avoid relative group"
                            : "mt-8 pt-4 border-t border-[#E5E5E5] print:break-inside-avoid relative group"
                        )}>
                          <div className={cn(
                            "flex items-center justify-between",
                            invoice.showAcknowledgmentTitle !== false 
                              ? (isGovMode ? "mb-1.5" : "mb-6") 
                              : "mb-1"
                          )}>
                            {invoice.showAcknowledgmentTitle !== false ? (
                              <div className="flex items-center gap-2 group/title">
                                <p className="text-[10px] font-semibold text-[#888888] tracking-[0.1em] uppercase">
                                  Acknowledgment & Conforme
                                </p>
                                {onToggleAcknowledgmentTitle && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleAcknowledgmentTitle(false)}
                                    className="no-print print:hidden opacity-0 group-hover/title:opacity-100 transition-opacity text-[8.5px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded border border-border/80 hover:border-destructive/30 bg-background cursor-pointer select-none"
                                    title="Hide 'Acknowledgment & Conforme' text heading"
                                  >
                                    ✕ Hide Title
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div />
                            )}

                            <div className="no-print print:hidden opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                              {invoice.showAcknowledgmentTitle === false && onToggleAcknowledgmentTitle && (
                                <button
                                  type="button"
                                  onClick={() => onToggleAcknowledgmentTitle(true)}
                                  className="text-[9px] font-medium text-muted-foreground hover:text-foreground border border-dashed border-border px-2 py-0.5 rounded hover:border-primary cursor-pointer select-none bg-secondary/40"
                                  title="Show 'Acknowledgment & Conforme' text heading"
                                >
                                  + Show Title
                                </button>
                              )}
                              {onToggleAcknowledgment && (
                                <button
                                  type="button"
                                  onClick={() => onToggleAcknowledgment(false)}
                                  className="text-[9.5px] font-medium text-destructive hover:bg-destructive/10 px-2 py-0.5 rounded cursor-pointer select-none flex items-center gap-1 border border-destructive/20"
                                  title="Remove Acknowledgment & Conforme section from quotation"
                                >
                                  ✕ Remove Section
                                </button>
                              )}
                            </div>
                          </div>

                          {(() => {
                            const showSales = invoice.showSalesSignee === true
                            const showClient = invoice.showClientSignee === true
                            const showCeo = invoice.showCeoSignee !== false

                            const visibleSignees: ('sales' | 'client' | 'ceo')[] = []
                            if (showSales) visibleSignees.push('sales')
                            if (showClient) visibleSignees.push('client')
                            if (showCeo) visibleSignees.push('ceo')

                            if (visibleSignees.length === 0) {
                              return (
                                <div className="py-4 text-center print:hidden">
                                  <p className="text-[11px] text-muted-foreground italic">
                                    No signees selected. Click to configure signees in the sidebar.
                                  </p>
                                </div>
                              )
                            }

                            const renderSlot = (signeeKey: 'sales' | 'client' | 'ceo') => {
                              const isSales = signeeKey === 'sales'
                              const isClient = signeeKey === 'client'
                              const sig = isSales
                                ? invoice.salesSignature
                                : isClient
                                ? invoice.clientSignature
                                : invoice.ceoSignature

                              const sigType = isSales
                                ? invoice.salesSignatureType
                                : isClient
                                ? invoice.clientSignatureType
                                : invoice.ceoSignatureType

                              const name = isSales
                                ? (invoice.salesName || 'Sales Representative')
                                : isClient
                                ? (invoice.clientSigneeName || invoice.toName || 'Client Representative')
                                : (invoice.ceoName || 'Mary Grace E. Santos')

                              const position = isSales
                                ? (invoice.salesPosition || 'Sales')
                                : isClient
                                ? (invoice.clientSigneePosition || 'Client')
                                : (invoice.ceoPosition || 'Chief Executive Officer')

                              return (
                                <div key={signeeKey} className="flex flex-col text-center items-center">
                                  <div
                                    onClick={() => onSignatureClick?.(signeeKey)}
                                    className={cn(
                                      "w-full flex flex-col items-center justify-end relative",
                                      onSignatureClick && "cursor-pointer group/sig hover:bg-black/[0.02] transition-colors rounded p-0.5"
                                    )}
                                    title={onSignatureClick ? "Click to edit signature or signee text" : undefined}
                                  >
                                    {sig ? (
                                      <div className="relative w-full flex flex-col items-center justify-end">
                                        {/* Signature Overlay - directly overlaps the name text */}
                                        <div
                                          className={cn(
                                            "absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none flex items-center justify-center",
                                            isGovMode ? "bottom-[-4px] h-14 max-w-[150px]" : "bottom-[-6px] h-18 max-w-[170px]"
                                          )}
                                        >
                                          {sigType === 'text' ? (
                                            <span
                                              className={cn(
                                                "text-[#111111] select-none italic font-normal tracking-wide leading-none text-center whitespace-nowrap px-1",
                                                isGovMode ? "text-[20px]" : "text-[24px]"
                                              )}
                                              style={{
                                                fontFamily: '"Caveat", "Dancing Script", "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive, serif',
                                              }}
                                            >
                                              {sig}
                                            </span>
                                          ) : (
                                            <img
                                              src={sig}
                                              alt={`${signeeKey} Signature`}
                                              data-role="signature"
                                              className="object-contain w-auto h-auto max-h-full max-w-full select-none pointer-events-none mix-blend-multiply"
                                            />
                                          )}
                                        </div>

                                        {/* Hover badge to edit signature */}
                                        {onSignatureClick && (
                                          <span className="print:hidden opacity-0 group-hover/sig:opacity-100 text-[9px] font-semibold text-primary bg-background/95 px-1.5 py-0.5 rounded shadow-xs border border-border/80 transition-opacity absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none z-20 whitespace-nowrap">
                                            ✎ Change Sign
                                          </span>
                                        )}

                                        {/* Spacing above the name for the top part of the signature */}
                                        <div className={cn("w-full", isGovMode ? "h-8" : "h-11")} />

                                        {/* Name text underneath the signature overlay */}
                                        <p className={cn("text-[#111111] uppercase tracking-wide relative z-0", isGovMode ? "min-h-[16px] text-[11px] font-bold" : "min-h-[18px] text-[11.5px] font-bold")}>
                                          {name}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="w-full flex flex-col items-center">
                                        <div
                                          className={cn(
                                            "border-b border-[#333333] w-full flex items-end justify-center relative",
                                            isGovMode ? "h-8 mb-1.5 pb-0.5" : "h-12 mb-2 pb-1"
                                          )}
                                        >
                                          {onSignatureClick && (
                                            <span className="print:hidden opacity-0 group-hover/sig:opacity-100 text-[9.5px] text-primary/80 font-semibold transition-opacity absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                                              ✎ Add E-Sign
                                            </span>
                                          )}
                                        </div>
                                        <p className={cn("text-[#111111] uppercase tracking-wide", isGovMode ? "min-h-[16px] text-[11px] font-bold" : "min-h-[18px] text-[11.5px] font-bold")}>
                                          {name}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  <div className={cn("flex items-center justify-center px-1", isGovMode ? "min-h-[16px] mt-0.5" : "min-h-[20px] mt-0.5")}>
                                    <p className={cn("text-[#555555] font-medium leading-tight", isGovMode ? "text-[10px]" : "text-[10.5px]")}>
                                      {position}
                                    </p>
                                  </div>
                                </div>
                              )
                            }

                            if (visibleSignees.length === 1) {
                              return (
                                <div className={cn("flex justify-end", isGovMode ? "pt-0" : "pt-2")}>
                                  <div className="w-64 max-w-full">
                                    {renderSlot(visibleSignees[0])}
                                  </div>
                                </div>
                              )
                            }

                            if (visibleSignees.length === 2) {
                              return (
                                <div className={cn(
                                  "grid grid-cols-2 gap-10 items-start max-w-xl ml-auto",
                                  isGovMode ? "pt-0" : "pt-2"
                                )}>
                                  {visibleSignees.map(renderSlot)}
                                </div>
                              )
                            }

                            return (
                              <div className={cn(
                                "grid grid-cols-3 gap-6 items-start",
                                isGovMode ? "pt-0" : "pt-2"
                              )}>
                                {visibleSignees.map(renderSlot)}
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {invoice.closing && invoice.showAcknowledgment === false && onToggleAcknowledgment && (
                        <div className="mt-5 pt-3 border-t border-dashed border-[#CCCCCC] no-print print:hidden flex justify-center">
                          <button
                            type="button"
                            onClick={() => onToggleAcknowledgment(true)}
                            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground border border-dashed border-[#CCCCCC] rounded px-3 py-1 hover:border-primary transition-all flex items-center gap-1.5 cursor-pointer select-none bg-secondary/30"
                            title="Click to restore Acknowledgment & Conforme signature lines"
                          >
                            <span>+ Include Acknowledgment & Conforme (Signatures)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
                </div>

                {/* Bottom Page Number Indicator */}
                <div className={cn("w-full flex justify-end items-center mt-auto", isGovMode ? "pt-1" : "pt-2")}>
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
