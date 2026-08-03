'use client'

import { useRef, useState, useEffect } from 'react'
import { type Invoice } from '@/lib/types'
import { PAPER_W, PAPER_H } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

interface MGWorkmanshipPreviewProps {
  invoice: Invoice
  hoveredField?: string | null
  onPagesChange?: (count: number) => void
}

export function MGWorkmanshipPreview({
  invoice,
  onPagesChange
}: MGWorkmanshipPreviewProps) {
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

  const installerName = invoice.installerName || 'Engr. Marco Santos'
  const installerAccreditation = invoice.installerAccreditation || 'PRC Reg. No. 0084920 / Certified Solar PV Technical Lead'
  const clientName = invoice.toName || '[Client Full Name]'
  const installationAddress = invoice.installationAddress || invoice.toAddress || '[Property Installation Address]'
  const contractorName = invoice.fromName || 'M&G Non-Specialized Wholesale Trading'
  const contractorAddress = invoice.fromAddress || '55 Main Drive, Mintcor Southrow Subd., Cupang, Muntinlupa City'
  const warrantyStartDate = invoice.warrantyStartDate ? formatDate(invoice.warrantyStartDate) : formatDate(invoice.issueDate)
  const defectNoticeDays = invoice.defectNoticeDays ?? 5
  const repairMinDays = invoice.repairResponseMinDays ?? 7
  const repairMaxDays = invoice.repairResponseMaxDays ?? 14
  const ceoName = invoice.ceoName || invoice.salesName || 'Mary Grace E. Santos'
  const ceoPosition = invoice.ceoPosition || 'Chief Executive Officer / Authorized Signatory'

  return (
    <main
      ref={canvasRef}
      className="w-full bg-[#EBEBEB] dark:bg-zinc-900 flex flex-col items-center py-6 print:block print:bg-white print:overflow-visible print:py-0"
    >
      {/* Format Header Pill (Screen only) */}
      <div className="mb-3 print:hidden flex items-center gap-2.5 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-md px-3.5 py-1 rounded-full border border-border shadow-xs z-10 select-none">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Contract Preview Mode:
        </span>
        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 font-mono">
          📜 Solar Workmanship Warranty Agreement (Single Page A4 Legal Contract)
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
            className="relative bg-white text-[#111111] rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10)] px-9 py-7 print-page print:!transform-none flex flex-col justify-between font-sans select-none overflow-hidden"
          >
            {/* TOP & CONTENT CONTAINER */}
            <div className="space-y-2.5">
              {/* HEADER */}
              <div className="flex justify-between items-start border-b border-[#111111]/20 pb-2.5">
                <div>
                  <p className="font-extrabold text-[20px] text-[#111111] tracking-tight leading-none uppercase font-mono">
                    {contractorName}
                  </p>
                  <div className="text-[9.5px] text-[#555555] mt-1 font-sans leading-tight">
                    <div className="max-w-[340px] whitespace-pre-line">{contractorAddress}</div>
                    {invoice.fromEmail && <div>Contact: {invoice.fromEmail} | {invoice.fromPhone || '+(63) 928 1655 179'}</div>}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <img 
                    src="/logo.svg" 
                    alt="MG Solar Logo" 
                    className="h-10 w-auto object-contain mb-1"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                  />
                  <p className="text-[9px] font-mono text-[#777777]">
                    REF #: MG-WAR-{invoice.invoiceNumber || '2026-001'}
                  </p>
                  <p className="text-[9px] font-mono text-[#777777]">
                    DATE: {warrantyStartDate}
                  </p>
                </div>
              </div>

              {/* CONTRACT TITLE BANNER */}
              <div className="bg-[#0F172A] text-white rounded-[6px] px-3 py-2 flex justify-between items-center shadow-xs">
                <div>
                  <div className="text-[8px] font-mono font-semibold uppercase tracking-widest text-blue-400">
                    REPUBLIC OF THE PHILIPPINES · COMMERCIAL & CIVIL LAW (RA 386)
                  </div>
                  <h1 className="text-[13px] font-black uppercase tracking-tight font-mono">
                    SOLAR SYSTEM INSTALLATION & WORKMANSHIP WARRANTY AGREEMENT
                  </h1>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                    1-YEAR WARRANTY
                  </span>
                </div>
              </div>

              {/* PARTIES & PREAMBLE BOX */}
              <div className="border border-[#CBD5E1] bg-[#F8FAFC] rounded-[6px] p-2.5 text-[9.5px] leading-tight space-y-1.5 font-sans">
                <p className="text-[#334155] leading-snug">
                  This Workmanship Warranty Agreement (&quot;Agreement&quot;) is executed by and between <strong>{contractorName}</strong> (&quot;Contractor&quot;), the designated <strong>Certified Solar PV Installer / Technical Lead</strong> (&quot;Subcontractor/Installer&quot;), and <strong>{clientName}</strong> (&quot;Client/Property Owner&quot;).
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#E2E8F0] font-mono text-[9px]">
                  <div>
                    <span className="text-[#64748B] block font-bold uppercase text-[7.5px]">CONTRACTOR (PRINCIPAL)</span>
                    <strong className="text-[#0F172A] block">{contractorName}</strong>
                    <span className="text-[#475569] text-[8px] leading-none block mt-0.5">{ceoName} ({ceoPosition})</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block font-bold uppercase text-[7.5px]">TECHNICAL LEAD / INSTALLER</span>
                    <strong className="text-[#0F172A] block">{installerName}</strong>
                    <span className="text-[#475569] text-[8px] leading-none block mt-0.5">{installerAccreditation}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block font-bold uppercase text-[7.5px]">CLIENT & INSTALLATION SITE</span>
                    <strong className="text-[#0F172A] block">{clientName}</strong>
                    <span className="text-[#475569] text-[8px] leading-none block mt-0.5 truncate">{installationAddress}</span>
                  </div>
                </div>
              </div>

              {/* CLAUSES SECTION */}
              <div className="space-y-2 text-[9px] leading-snug text-[#1E293B]">
                {/* CLAUSE 1 */}
                <div className="border-l-2 border-blue-600 pl-2">
                  <h2 className="font-bold font-mono text-[10px] text-[#0F172A] uppercase">
                    1. Scope of Workmanship & Compliance Standards
                  </h2>
                  <p className="text-[#334155] mt-0.5">
                    The Installer and Contractor warrant that all physical installation works—including mechanical mounting structure attachment, roof penetration weather-sealing, structural anchoring, DC solar PV cabling, AC grid interconnection wiring, circuit protection integration (breakers, SPDs, MCCBs), grounding &amp; bonding, and system commissioning—have been performed strictly in accordance with the <strong>Philippine Electrical Code (PEC)</strong>, National Structural Code of the Philippines (NSCP), and applicable safety standards.
                  </p>
                </div>

                {/* CLAUSE 2 */}
                <div className="border-l-2 border-blue-600 pl-2">
                  <h2 className="font-bold font-mono text-[10px] text-[#0F172A] uppercase">
                    2. Workmanship Warranty Coverage & Term
                  </h2>
                  <p className="text-[#334155] mt-0.5">
                    The Contractor and Installer provide a <strong>One (1) Year Limited Workmanship Warranty</strong> (365 calendar days) commencing on the Date of System Turnover (<strong>{warrantyStartDate}</strong>). Coverage includes: (a) repair of roof leaks directly resulting from installation penetrations, (b) re-securing loose mechanical mounting rails, clamps, or L-feet, (c) remediation of electrical short circuits or ground faults caused by improper wiring, (d) repair of damaged cable insulation due to improper clipping/securing, and (e) correction of loose terminal terminations.
                  </p>
                </div>

                {/* CLAUSE 3 */}
                <div className="border-l-2 border-blue-600 pl-2">
                  <h2 className="font-bold font-mono text-[10px] text-[#0F172A] uppercase">
                    3. Exclusions &amp; Voiding Factors
                  </h2>
                  <p className="text-[#334155] mt-0.5">
                    <strong>3.1 Force Majeure &amp; Grid Surges:</strong> Damages caused by acts of God (typhoons, earthquakes, lightning strikes, floods), fire, utility grid power surges/fluctuations, rodent damage, or civil unrest are strictly excluded.<br />
                    <strong>3.2 Unauthorized Repairs:</strong> This warranty is immediately voided if any repairs, alterations, expansions, or maintenance are attempted by non-M&amp;G authorized personnel.<br />
                    <strong>3.3 Hardware Failures:</strong> Major equipment (Solar Panels, Inverters, Lithium Batteries, Charge Controllers) are covered exclusively by their respective <strong>Manufacturer Warranties</strong> and are not covered under this Workmanship Warranty.
                  </p>
                </div>

                {/* CLAUSE 4 */}
                <div className="border-l-2 border-blue-600 pl-2">
                  <h2 className="font-bold font-mono text-[10px] text-[#0F172A] uppercase">
                    4. Defect Notification &amp; Repair Response Timeline
                  </h2>
                  <p className="text-[#334155] mt-0.5">
                    The Client must provide written notice of any suspected workmanship defect to M&amp;G within <strong>{defectNoticeDays} business days</strong> of discovery. Upon receipt of verified notice, the Contractor/Installer shall inspect the installation and initiate corrective repairs within <strong>{repairMinDays} to {repairMaxDays} business days</strong> at zero cost to the Client if the defect falls under warranty coverage.
                  </p>
                </div>

                {/* CLAUSE 5 */}
                <div className="border-l-2 border-blue-600 pl-2">
                  <h2 className="font-bold font-mono text-[10px] text-[#0F172A] uppercase">
                    5. Site Access &amp; Client Responsibilities
                  </h2>
                  <p className="text-[#334155] mt-0.5">
                    The Client shall grant safe, unobstructed access to the roof, inverter mounting areas, and electrical main distribution panels during installation and warranty service visits. The Client remains solely responsible for securing Homeowner Association (HOA), building management, or local government permits unless explicitly included in Contractor&apos;s written contract scope.
                  </p>
                </div>

                {/* CLAUSE 6 */}
                <div className="border-l-2 border-blue-600 pl-2">
                  <h2 className="font-bold font-mono text-[10px] text-[#0F172A] uppercase">
                    6. Governing Law &amp; Dispute Resolution
                  </h2>
                  <p className="text-[#334155] mt-0.5">
                    This Agreement shall be governed by and construed in accordance with the laws of the <strong>Republic of the Philippines</strong>, under Republic Act No. 386 (Civil Code of the Philippines). Any dispute arising from this warranty shall first undergo amicable negotiation before filing action in the competent courts of Muntinlupa City.
                  </p>
                </div>
              </div>

              {/* SIGNATURE BLOCK */}
              <div className="pt-2 border-t border-[#CBD5E1]">
                <p className="text-[8.5px] font-mono uppercase font-bold text-[#475569] mb-3 text-center">
                  IN WITNESS WHEREOF, the parties have executed this Workmanship Warranty Agreement as of {warrantyStartDate}.
                </p>

                <div className="grid grid-cols-3 gap-4 text-center font-sans">
                  {/* Contractor Signature */}
                  <div className="flex flex-col items-center">
                    <div className="h-9 border-b border-[#0F172A] w-full flex items-end justify-center pb-0.5">
                      <span className="text-[9px] font-serif italic text-[#334155]">{ceoName}</span>
                    </div>
                    <strong className="text-[9px] text-[#0F172A] mt-1 font-mono uppercase block">{contractorName}</strong>
                    <span className="text-[8px] text-[#64748B] block font-mono">{ceoPosition}</span>
                  </div>

                  {/* Installer Signature */}
                  <div className="flex flex-col items-center">
                    <div className="h-9 border-b border-[#0F172A] w-full flex items-end justify-center pb-0.5">
                      <span className="text-[9px] font-serif italic text-[#334155]">{installerName}</span>
                    </div>
                    <strong className="text-[9px] text-[#0F172A] mt-1 font-mono uppercase block">Technical Lead / Installer</strong>
                    <span className="text-[8px] text-[#64748B] block font-mono truncate max-w-[190px]">{installerAccreditation}</span>
                  </div>

                  {/* Client Signature */}
                  <div className="flex flex-col items-center">
                    <div className="h-9 border-b border-[#0F172A] w-full flex items-end justify-center pb-0.5">
                      <span className="text-[9px] font-serif italic text-[#334155]">{clientName}</span>
                    </div>
                    <strong className="text-[9px] text-[#0F172A] mt-1 font-mono uppercase block">Property Owner / Client</strong>
                    <span className="text-[8px] text-[#64748B] block font-mono">Accepted &amp; Agreed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="pt-2 border-t border-[#E2E8F0] flex justify-between items-center text-[8px] font-mono text-[#94A3B8]">
              <div>
                M&amp;G SOLAR · WORKMANSHIP WARRANTY AGREEMENT · PHILIPPINES LAW (RA 386 / PEC)
              </div>
              <div>
                PAGE 1 OF 1
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
