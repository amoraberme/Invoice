'use client'

import { useRef, useState, useEffect, useMemo, Fragment } from 'react'
import { type Invoice, type LineItem } from '@/lib/types'
import { PAPER_W, PAPER_H } from '@/lib/constants'
import { formatDate, cn, isLaborItem, isBatteryItem } from '@/lib/utils'
import { Check } from 'lucide-react'

interface MGChecklistPreviewProps {
  invoice: Invoice
  hoveredField?: string | null
  checkedItems?: Record<string, boolean>
  previousTab?: string
  onToggleCheck?: (id: string) => void
  onPagesChange?: (count: number) => void
}

const getChecklistCategory = (description: string): { key: 'equipment' | 'mounting' | 'electrical' | 'grounding'; label: string } => {
  const d = (description || '').toLowerCase().trim()
  if (
    d.includes('ground') ||
    d.includes('bonding') ||
    d.includes('egc') ||
    d.includes('gec') ||
    d.includes('weeb') ||
    d.includes('ground rod') ||
    d.includes('ground clamp') ||
    d.includes('ground wire') ||
    d.includes('earth') ||
    d.includes('lightning') ||
    d.includes('splice jumper')
  ) {
    return { key: 'grounding', label: 'Grounding & Bonding' }
  }
  if (
    d.includes('panel') ||
    d.includes('module') ||
    d.includes('inverter') ||
    d.includes('battery') ||
    d.includes('controller') ||
    d.includes('meter') ||
    d.includes('datalogger') ||
    d.includes('dongle') ||
    d.includes('collector') ||
    d.includes('sec1000') ||
    d.includes('dyness') ||
    d.includes('oliter') ||
    d.includes('alpsolar') ||
    d.includes('ja solar') ||
    d.includes('tongwei') ||
    d.includes('gokin') ||
    d.includes('jinko') ||
    d.includes('longi') ||
    d.includes('trina') ||
    d.includes('seraphim') ||
    d.includes('solis') ||
    d.includes('goodwe') ||
    d.includes('anern') ||
    d.includes('hypontech') ||
    d.includes('solax') ||
    d.includes('foxess') ||
    d.includes('sunways') ||
    d.includes('sungrow') ||
    d.includes('deye') ||
    d.includes('growatt') ||
    d.includes('victron') ||
    d.includes('genix') ||
    d.includes('cesc')
  ) {
    return { key: 'equipment', label: 'Major Equipment' }
  }
  if (
    d.includes('railing') ||
    d.includes('rail') ||
    d.includes('clamp') ||
    d.includes('l foot') ||
    d.includes('l-foot') ||
    d.includes('clip lock') ||
    d.includes('clip-lock') ||
    d.includes('mid clamp') ||
    d.includes('end clamp') ||
    d.includes('mounting') ||
    d.includes('structure') ||
    d.includes('hardware') ||
    d.includes('rack') ||
    d.includes('bracket') ||
    d.includes('roof') ||
    d.includes('hook') ||
    d.includes('bolt') ||
    d.includes('screw') ||
    d.includes('sealant')
  ) {
    return { key: 'mounting', label: 'Mounting & Hardware' }
  }
  return { key: 'electrical', label: 'Electrical & Cabling' }
}

const isChecklistExcludedItem = (description: string): boolean => {
  const d = (description || '').toLowerCase().trim()
  return (
    isLaborItem(description) ||
    d.includes('delivery fee') ||
    d.includes('delivery charge') ||
    d.includes('freight') ||
    d.includes('shipping') ||
    d.includes('transport fee') ||
    d.includes('mobilization')
  )
}

interface CategorySlice {
  key: string
  label: string
  isContinued?: boolean
  items: LineItem[]
}

interface VirtualChecklistPage {
  categories: CategorySlice[]
  showTop: boolean
  showSignatureBlock: boolean
}

function paginateChecklist(invoice: Invoice): VirtualChecklistPage[] {
  const checklistItems = invoice.lineItems.filter(item => {
    if (isChecklistExcludedItem(item.description)) return false
    if (invoice.excludeBattery && isBatteryItem(item.description)) return false
    return true
  })

  const categoryOrder: ('equipment' | 'mounting' | 'electrical' | 'grounding')[] = [
    'equipment',
    'mounting',
    'electrical',
    'grounding'
  ]

  const fullCategories: { key: string; label: string; items: LineItem[] }[] = []
  categoryOrder.forEach(catKey => {
    const matching = checklistItems.filter(it => getChecklistCategory(it.description).key === catKey)
    if (matching.length > 0) {
      const catInfo = getChecklistCategory(matching[0].description)
      fullCategories.push({
        key: catKey,
        label: catInfo.label,
        items: matching
      })
    }
  })

  if (checklistItems.length <= 34) {
    return [{
      categories: fullCategories.map(cat => ({ ...cat, isContinued: false })),
      showTop: true,
      showSignatureBlock: true,
    }]
  }

  // Multi-page checklist partitioning for abnormally huge lists
  const pages: VirtualChecklistPage[] = []
  let currentCategories: CategorySlice[] = []
  let currentItemCount = 0
  const maxItemsFirstPage = 26
  const maxItemsSubsequentPage = 30
  let isFirst = true

  fullCategories.forEach(cat => {
    let catItems = [...cat.items]
    let isContinued = false

    while (catItems.length > 0) {
      const limit = isFirst ? maxItemsFirstPage : maxItemsSubsequentPage
      const spaceLeft = limit - currentItemCount

      if (catItems.length <= spaceLeft || spaceLeft >= 5) {
        const take = Math.min(catItems.length, spaceLeft)
        currentCategories.push({
          key: isContinued ? `${cat.key}-cont` : cat.key,
          label: isContinued ? `${cat.label} (Cont.)` : cat.label,
          isContinued,
          items: catItems.slice(0, take),
        })
        currentItemCount += take
        catItems = catItems.slice(take)
        isContinued = true

        if (currentItemCount >= limit) {
          pages.push({
            categories: currentCategories,
            showTop: isFirst,
            showSignatureBlock: false,
          })
          currentCategories = []
          currentItemCount = 0
          isFirst = false
        }
      } else {
        pages.push({
          categories: currentCategories,
          showTop: isFirst,
          showSignatureBlock: false,
        })
        currentCategories = []
        currentItemCount = 0
        isFirst = false
      }
    }
  })

  if (currentCategories.length > 0) {
    pages.push({
      categories: currentCategories,
      showTop: isFirst,
      showSignatureBlock: true,
    })
  } else if (pages.length > 0) {
    pages[pages.length - 1].showSignatureBlock = true
  }

  return pages.length > 0 ? pages : [{
    categories: fullCategories.map(cat => ({ ...cat, isContinued: false })),
    showTop: true,
    showSignatureBlock: true,
  }]
}

export function MGChecklistPreview({
  invoice,
  checkedItems = {},
  previousTab,
  onToggleCheck,
  onPagesChange
}: MGChecklistPreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const prevPagesCountRef = useRef<number>(0)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    let rafId: number | null = null
    const recalcScale = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!el) return
        const available = el.clientWidth - 32
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

  // Filter checklist items (exclude labor and excluded battery)
  const checklistItems = useMemo(() => {
    return (invoice.lineItems || []).filter(item => {
      if (isChecklistExcludedItem(item.description)) return false
      if (invoice.excludeBattery && isBatteryItem(item.description)) return false
      return true
    })
  }, [invoice.lineItems, invoice.excludeBattery])

  const virtualPages = useMemo(() => {
    return paginateChecklist(invoice)
  }, [invoice])
  const totalPages = virtualPages.length

  useEffect(() => {
    if (onPagesChange && prevPagesCountRef.current !== totalPages) {
      prevPagesCountRef.current = totalPages
      onPagesChange(totalPages)
    }
  }, [totalPages, onPagesChange])

  const totalCount = checklistItems.length
  const checkedCount = checklistItems.filter(it => checkedItems[it.id]).length
  const sourceLabel = previousTab === 'supply' ? 'Supply Materials List' : 'Full Line Items Proposal'

  // Dynamic row padding & font sizing calibrated to maximize full-page A4 coverage
  const rowPaddingClass = 
    totalCount <= 14 ? "py-2.5" : 
    totalCount <= 20 ? "py-2" : 
    totalCount <= 26 ? "py-1.5" : 
    totalCount <= 30 ? "py-1" : "py-[2px]"

  const fontSizeClass = 
    totalCount <= 14 ? "text-[11px]" : 
    totalCount <= 20 ? "text-[10px]" : 
    totalCount <= 26 ? "text-[9.5px]" : 
    totalCount <= 30 ? "text-[9px]" : "text-[8.5px]"

  const headerFontSizeClass = 
    totalCount <= 20 ? "text-[9.5px]" : 
    totalCount <= 28 ? "text-[9px]" : "text-[8px]"

  const checkboxBoxSize = totalCount <= 20 ? "w-4 h-4" : "w-3.5 h-3.5"
  const checkIconSize = totalCount <= 20 ? 10 : 8

  return (
    <main
      ref={canvasRef}
      className="w-full bg-[#EBEBEB] dark:bg-zinc-900 flex flex-col items-center py-6 print:block print:bg-white print:overflow-visible print:py-0"
    >
      {/* Format Header Pill (Screen only) */}
      <div className="mb-3 print:hidden flex items-center gap-2.5 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-md px-3.5 py-1 rounded-full border border-border shadow-xs z-10 select-none">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Checklist Preview Mode:
        </span>
        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
          📋 Material Dispatch & Packing List ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})
        </span>
      </div>

      {virtualPages.map((page, pageIdx) => (
        <div key={pageIdx} className={cn("w-full flex justify-center mb-6 last:mb-0 print:block print:m-0 print:p-0", pageIdx < totalPages - 1 ? "print-break" : "print-break-last")}>
          <div 
            style={{ width: PAPER_W * scale, height: PAPER_H * scale }} 
            className="print-wrapper"
          >
            {/* Fixed A4 Paper Canvas */}
            <div
              style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              className="relative bg-white text-[#111111] rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10)] px-8 py-6 print-page print:!transform-none flex flex-col justify-between font-mono select-none overflow-hidden"
            >
              {/* TOP & CONTENT CONTAINER */}
              <div className="space-y-2">
                {page.showTop ? (
                  /* HEADER */
                  <div className="flex justify-between items-start border-b-2 border-[#111111] pb-2">
                    <div>
                      <p className="font-extrabold text-[20px] text-[#111111] tracking-tight leading-none uppercase">
                        {invoice.fromName || 'MG SOLAR'}
                      </p>
                      <div className="text-[9.5px] text-[#555555] mt-1 font-sans leading-tight space-y-0.5">
                        {invoice.fromEmail && <div>{invoice.fromEmail}</div>}
                        {invoice.fromPhone && <div>{invoice.fromPhone}</div>}
                        {invoice.fromAddress && <div className="max-w-[340px] whitespace-pre-line">{invoice.fromAddress}</div>}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <img 
                        src="/logo.svg" 
                        alt="MG Solar Logo" 
                        className="h-10 w-auto object-contain mb-1"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                      />
                      <p className="text-[9px] font-mono font-bold text-[#555555]">
                        DOC #: {invoice.invoiceNumber ? (invoice.invoiceNumber.startsWith('MG-') ? invoice.invoiceNumber.replace(/^MG-[A-Z]+-/, 'MG-CL-') : `MG-CL-${invoice.invoiceNumber}`) : 'MG-CL-260715133721'}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* CONTINUATION HEADER */
                  <div className="flex justify-between items-center border-b-2 border-[#111111] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px] text-[#111111] uppercase tracking-wide">
                        {invoice.fromName || 'MG SOLAR'}
                      </span>
                      <span className="text-[9.5px] text-[#555555]">
                        • MATERIAL DISPATCH & PACKING LIST (CONTINUED)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold uppercase bg-[#111111] text-white px-2.5 py-0.5 rounded-xs font-mono">
                        PAGE {pageIdx + 1} OF {totalPages}
                      </span>
                    </div>
                  </div>
                )}

                {/* SUBJECT / PROJECT & CLIENT META BAR */}
                {page.showTop && (
                  <div className="text-[9.5px] font-mono border-b border-[#D4D4D8] pb-1.5 flex justify-between items-center flex-wrap gap-1">
                    <div>
                      <span className="text-[#666666]">SUBJECT / PROJECT:</span>{' '}
                      <strong className="text-[#111111] uppercase">{invoice.subject ? `Checklist — ${invoice.subject}` : 'Checklist — Solar System Materials Dispatch'}</strong>
                    </div>
                    <div className="text-right text-[9px] font-mono flex items-center gap-3">
                      <span><span className="text-[#666666]">CLIENT:</span> <strong className="text-[#111111]">{invoice.toName || '—'}</strong></span>
                      <span><span className="text-[#666666]">DATE:</span> <strong className="text-[#111111]">{formatDate(invoice.issueDate)}</strong></span>
                      <span><span className="text-[#666666]">STATUS:</span> <strong className="text-[#008B4C]">{checkedCount}/{totalCount} Verified</strong></span>
                    </div>
                  </div>
                )}

                {/* CHECKLIST TABLE */}
                <table className={cn("w-full text-left border-collapse font-mono", fontSizeClass)}>
                  <thead>
                    <tr className={cn("border-b-2 border-[#111111] text-[#444444] font-bold uppercase tracking-wider", headerFontSizeClass)}>
                      <th className="py-1 px-1.5 w-8 text-center">CHECK</th>
                      <th className="py-1 px-2">MATERIAL DESCRIPTION</th>
                      <th className="py-1 px-1.5 w-14 text-center">UNIT</th>
                      <th className="py-1 px-1.5 w-12 text-center">QTY</th>
                      <th className="py-1 px-2 w-44">VERIFICATION / REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.categories.map(cat => (
                      <Fragment key={cat.key}>
                        <tr className="bg-[#111111] text-white">
                          <td colSpan={5} className={cn("px-2 font-bold uppercase tracking-wider", rowPaddingClass, headerFontSizeClass)}>
                            ▸ {cat.label} ({cat.items.length})
                          </td>
                        </tr>
                        {cat.items.map(item => {
                          const isChecked = !!checkedItems[item.id]

                          return (
                            <tr 
                              key={item.id}
                              onClick={() => onToggleCheck?.(item.id)}
                              className={cn(
                                "border-b border-[#E5E5E5] transition-colors cursor-pointer",
                                isChecked ? "bg-[#008B4C]/5" : "hover:bg-[#F9F9F9]"
                              )}
                            >
                              <td className={cn("px-1.5 text-center align-middle", rowPaddingClass)}>
                                <div className={cn(
                                  checkboxBoxSize,
                                  "rounded-[2px] border mx-auto flex items-center justify-center transition-all",
                                  isChecked ? "bg-[#008B4C] border-[#008B4C] text-white" : "border-[#666666] bg-white"
                                )}>
                                  {isChecked && <Check size={checkIconSize} strokeWidth={4} />}
                                </div>
                              </td>

                              <td className={cn("px-2 align-middle font-semibold text-[#111111]", rowPaddingClass, isChecked && "line-through text-[#777777]")}>
                                {item.description || 'Untitled Item'}
                              </td>

                              <td className={cn("px-1.5 text-center align-middle text-[#555555]", rowPaddingClass)}>
                                {item.description.toLowerCase().includes('delivery') || item.description.toLowerCase().includes('freight') || item.description.toLowerCase().includes('labor') || item.description.toLowerCase().includes('installation') || item.description.toLowerCase().includes('service') ? '—' : (item.unit || 'PCS')}
                              </td>

                              <td className={cn("px-1.5 text-center align-middle font-bold text-[#111111]", rowPaddingClass)}>
                                {item.description.toLowerCase().includes('delivery') || item.description.toLowerCase().includes('freight') || item.description.toLowerCase().includes('labor') || item.description.toLowerCase().includes('installation') || item.description.toLowerCase().includes('service') ? '—' : item.quantity}
                              </td>

                              <td className={cn("px-2 align-middle", rowPaddingClass)}>
                                <div className="w-full border-b border-dashed border-[#CCCCCC] h-2.5" />
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* BOTTOM SIGNATURE BLOCK / FOOTER */}
              {page.showSignatureBlock && (
                <div className="pt-2 border-t-2 border-[#111111] space-y-2">
                  <div className="grid grid-cols-3 gap-6 text-[8.5px] font-mono text-[#333333]">
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#111111]">PREPARED / DISPATCHED BY:</div>
                      <div className="border-b border-[#111111] pb-1 font-bold text-[#111111] min-h-[18px]">
                        {invoice.salesName || 'Warehouse Logistics'}
                      </div>
                      <div className="text-[7.5px] text-[#777777]">Signature & Date</div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-[#111111]">INSPECTED / PACKED BY:</div>
                      <div className="border-b border-[#111111] pb-1 font-bold text-[#111111] min-h-[18px]">
                        &nbsp;
                      </div>
                      <div className="text-[7.5px] text-[#777777]">Quality Inspector</div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-[#111111]">VERIFIED ON SITE BY:</div>
                      <div className="border-b border-[#111111] pb-1 font-bold text-[#111111] min-h-[18px]">
                        &nbsp;
                      </div>
                      <div className="text-[7.5px] text-[#777777]">Installer / Receiver</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[8px] text-[#888888] font-sans pt-0.5">
                    <span>MG SOLAR Material Dispatch Verification Form — Official Document</span>
                    <span>Page {pageIdx + 1} of {totalPages}</span>
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


