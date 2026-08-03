'use client'

import { useRef, useState, useEffect, Fragment } from 'react'
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

const getChecklistCategory = (description: string): { key: 'equipment' | 'mounting' | 'electrical' | 'grounding' | 'other'; label: string } => {
  const d = (description || '').toLowerCase().trim()
  if (
    d.includes('ground') ||
    d.includes('bonding') ||
    d.includes('egc') ||
    d.includes('gec') ||
    d.includes('weeb') ||
    d.includes('ground rod') ||
    d.includes('ground clamp') ||
    d.includes('splice jumper')
  ) {
    return { key: 'grounding', label: 'Grounding & Bonding' }
  }
  if (
    d.includes('panel') ||
    d.includes('module') ||
    d.includes('inverter') ||
    d.includes('battery') ||
    d.includes('dyness') ||
    d.includes('ja solar') ||
    d.includes('tongwei') ||
    d.includes('solis') ||
    d.includes('goodwe') ||
    d.includes('anern') ||
    d.includes('hypontech') ||
    d.includes('solax') ||
    d.includes('foxess') ||
    d.includes('sunways') ||
    d.includes('sungrow')
  ) {
    return { key: 'equipment', label: 'Major Equipment' }
  }
  if (
    d.includes('railing') ||
    d.includes('clamp') ||
    d.includes('l foot') ||
    d.includes('l-foot') ||
    d.includes('mid clamp') ||
    d.includes('end clamp') ||
    d.includes('mounting') ||
    d.includes('structure') ||
    d.includes('hardware')
  ) {
    return { key: 'mounting', label: 'Mounting & Hardware' }
  }
  if (
    d.includes('wire') ||
    d.includes('cable') ||
    d.includes('breaker') ||
    d.includes('mcb') ||
    d.includes('spd') ||
    d.includes('mccb') ||
    d.includes('flexcon') ||
    d.includes('hose') ||
    d.includes('mc4') ||
    d.includes('raceway') ||
    d.includes('conduit') ||
    d.includes('ats') ||
    d.includes('terminal') ||
    d.includes('lug') ||
    d.includes('splice')
  ) {
    return { key: 'electrical', label: 'Electrical & Cabling' }
  }
  return { key: 'other', label: 'Supplied Material' }
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

  // Filter checklist items (exclude labor and excluded battery)
  const checklistItems = invoice.lineItems.filter(item => {
    if (isLaborItem(item.description)) return false
    if (invoice.excludeBattery && isBatteryItem(item.description)) return false
    return true
  })

  // Group items by category order
  const categoryOrder: ('equipment' | 'mounting' | 'electrical' | 'grounding' | 'other')[] = ['equipment', 'mounting', 'electrical', 'grounding', 'other']
  
  const categories: { key: string; label: string; items: LineItem[] }[] = []
  
  categoryOrder.forEach(catKey => {
    const matching = checklistItems.filter(it => getChecklistCategory(it.description).key === catKey)
    if (matching.length > 0) {
      const catInfo = getChecklistCategory(matching[0].description)
      categories.push({
        key: catKey,
        label: catInfo.label,
        items: matching
      })
    }
  })

  const totalCount = checklistItems.length
  const checkedCount = checklistItems.filter(it => checkedItems[it.id]).length
  const sourceLabel = previousTab === 'supply' ? 'Supply Materials List' : 'Full Line Items Proposal'

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
          📋 Material Dispatch & Packing List (Single Page A4)
        </span>
      </div>

      {/* Single Page Wrapper */}
      <div className="w-full flex justify-center mb-6 print:block print:m-0 print:p-0">
        <div 
          style={{ width: PAPER_W * scale, height: PAPER_H * scale }} 
          className="print-wrapper"
        >
          {/* Fixed Single Page A4 Paper Canvas */}
          <div
            style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            className="relative bg-white text-[#111111] rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10)] px-10 py-8 print-page print:!transform-none flex flex-col justify-between font-mono select-none overflow-hidden"
          >
            {/* TOP & CONTENT CONTAINER */}
            <div className="space-y-3.5">
              {/* HEADER */}
              <div className="flex justify-between items-start border-b border-[#111111]/20 pb-3">
                <div>
                  <p className="font-extrabold text-[22px] text-[#111111] tracking-tight leading-none uppercase">
                    {invoice.fromName || 'MG SOLAR'}
                  </p>
                  <div className="text-[10px] text-[#666666] mt-1.5 font-sans leading-tight">
                    {invoice.fromEmail && <div>{invoice.fromEmail}</div>}
                    {invoice.fromPhone && <div>{invoice.fromPhone}</div>}
                    {invoice.fromAddress && <div className="max-w-[320px] whitespace-pre-line">{invoice.fromAddress}</div>}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <img 
                    src="/logo.svg" 
                    alt="MG Solar Logo" 
                    className="h-12 w-auto object-contain mb-1"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                  />
                  <p className="text-[9.5px] font-mono text-[#777777]">
                    DOC #: MG-CL-{invoice.invoiceNumber || '260715133721'}
                  </p>
                </div>
              </div>

              {/* BANNER & CLIENT INFO */}
              <div className="bg-[#F8F9FA] border border-[#E5E5E5] rounded-[6px] p-2.5 flex justify-between items-center">
                <div className="space-y-0.5">
                  <div className="text-[8.5px] font-bold uppercase tracking-wider text-[#777777]">Document Title</div>
                  <div className="text-xs font-extrabold text-[#111111] uppercase tracking-tight">
                    📋 MATERIAL DISPATCH & PACKING CHECKLIST
                  </div>
                  <div className="text-[9.5px] text-[#666666] font-sans">
                    Context: <strong className="text-[#111111] font-mono">{sourceLabel}</strong> (Physical Materials Only)
                  </div>
                </div>

                <div className="text-right text-[10px] font-mono space-y-0.5">
                  <div><span className="text-[#777777]">CLIENT:</span> <strong>{invoice.toName || '—'}</strong></div>
                  <div><span className="text-[#777777]">DATE:</span> {formatDate(invoice.issueDate)}</div>
                  <div><span className="text-[#777777]">STATUS:</span> <strong className="text-[#008B4C]">{checkedCount}/{totalCount} Items Verified</strong></div>
                </div>
              </div>

              {/* SUBJECT */}
              <div className="text-[10px] font-mono border-b border-[#E5E5E5] pb-2">
                <span className="text-[#777777]">SUBJECT / PROJECT:</span>{' '}
                <strong className="text-[#111111] uppercase">{invoice.subject ? `Checklist — ${invoice.subject}` : 'Checklist — Solar System Materials Dispatch'}</strong>
              </div>

              {/* CHECKLIST TABLE */}
              <table className="w-full text-[10px] text-left border-collapse font-mono">
                <thead>
                  <tr className="border-b-2 border-[#111111] text-[8.5px] text-[#555555] uppercase tracking-wider">
                    <th className="py-1 px-1.5 w-8 text-center">CHECK</th>
                    <th className="py-1 px-1.5">MATERIAL DESCRIPTION</th>
                    <th className="py-1 px-1.5 w-14 text-center">UNIT</th>
                    <th className="py-1 px-1.5 w-12 text-center">QTY</th>
                    <th className="py-1 px-1.5 w-44">VERIFICATION / REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <Fragment key={cat.key}>
                      <tr className="bg-[#111111] text-white">
                        <td colSpan={5} className="py-1 px-2 text-[8.5px] font-bold uppercase tracking-wider">
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
                            <td className="py-1 px-1.5 text-center align-middle">
                              <div className={cn(
                                "w-3.5 h-3.5 rounded-[2px] border mx-auto flex items-center justify-center transition-all",
                                isChecked ? "bg-[#008B4C] border-[#008B4C] text-white" : "border-[#666666] bg-white"
                              )}>
                                {isChecked && <Check size={9} strokeWidth={4} />}
                              </div>
                            </td>

                            <td className={cn("py-1 px-1.5 align-middle font-semibold text-[#111111]", isChecked && "line-through text-[#777777]")}>
                              {item.description || 'Untitled Item'}
                            </td>

                            <td className="py-1 px-1.5 text-center align-middle text-[#555555]">
                              {item.unit || 'PCS'}
                            </td>

                            <td className="py-1 px-1.5 text-center align-middle font-bold text-[#111111]">
                              {item.quantity}
                            </td>

                            <td className="py-1 px-1.5 align-middle">
                              <div className="w-full border-b border-dashed border-[#CCCCCC] h-3" />
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BOTTOM SIGNATURE BLOCK (GUARANTEED ON SINGLE PAGE) */}
            <div className="pt-3 border-t border-[#111111]/20 space-y-3">
              <div className="grid grid-cols-3 gap-5 text-[9px] font-mono text-[#333333]">
                <div className="space-y-2">
                  <div>PREPARED / DISPATCHED BY:</div>
                  <div className="border-b border-[#111111] pb-0.5 font-bold text-[#111111] min-h-[18px]">
                    {invoice.salesName || 'Warehouse Logistics'}
                  </div>
                  <div className="text-[8px] text-[#777777]">Signature & Date</div>
                </div>

                <div className="space-y-2">
                  <div>INSPECTED / PACKED BY:</div>
                  <div className="border-b border-[#111111] pb-0.5 font-bold text-[#111111] min-h-[18px]">
                    &nbsp;
                  </div>
                  <div className="text-[8px] text-[#777777]">Quality Inspector</div>
                </div>

                <div className="space-y-2">
                  <div>VERIFIED ON SITE BY:</div>
                  <div className="border-b border-[#111111] pb-0.5 font-bold text-[#111111] min-h-[18px]">
                    &nbsp;
                  </div>
                  <div className="text-[8px] text-[#777777]">Installer</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[8px] text-[#888888] font-sans">
                <span>MG SOLAR Material Dispatch Verification Form — Official Document</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
