'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Download, Building, Users, FileText, List, CreditCard, StickyNote, Contact, Sparkles, Package, Wrench, Search, ClipboardCheck, CheckSquare, ArrowLeft, Check, Copy, Printer, RefreshCw } from 'lucide-react'
import { cn, generateDocumentId, formatCurrency } from '@/lib/utils'
import { useMGInvoice } from '@/lib/use-mg-invoice'
import { type LineItem } from '@/lib/types'
import { CURRENCIES } from '@/lib/constants'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { MGInvoicePreview } from '@/components/mg-invoice-preview'
import { MGChecklistPreview } from '@/components/mg-checklist-preview'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PANEL_WATTAGE = 625
const PANEL_WIDTH_FT = 3.72

const FLOOR_BASE_METERS: Record<number, number> = {
  1: 30,
  2: 40,
  3: 55,
  4: 65,
}

function getFloorMeters(floorNum: number): number {
  return FLOOR_BASE_METERS[floorNum] ?? 30
}

function getWireSize(inverterKw: number): string {
  if (inverterKw <= 4) {
    return '#8 10mm²'
  } else if (inverterKw <= 10) {
    return 'AWG #8'
  } else if (inverterKw <= 12) {
    return '#6 AWG 14mm²'
  } else {
    return '#4 22mm²'
  }
}

function getDynamicBreakerRatings(systemKw: number) {
  // AC MCB Calculation: I_AC = ceil((P_target * 1000 / (230 * 0.9)) * 1.25)
  const iAcRaw = Math.ceil(((systemKw * 1000) / (230 * 0.9)) * 1.25)
  const acBreakerSizes = [20, 32, 50, 63, 80, 100, 125]
  const acMcbAmp = acBreakerSizes.find(s => s >= iAcRaw) || Math.ceil(iAcRaw)

  // DC MCCB Calculation: I_DC = ceil(P_target * 1000 / (48 * 0.85 * 0.80))
  const iDcRaw = Math.ceil((systemKw * 1000) / (48 * 0.85 * 0.80))
  const dcMccbSizes = [100, 160, 200, 250, 300, 350, 500]
  const dcMccbAmp = dcMccbSizes.find(s => s >= iDcRaw) || Math.ceil(iDcRaw)

  // DC SPD Voltage Safeguard (600V < 8kW | 1000V >= 8kW)
  const dcSpdVoltage = systemKw < 8 ? '600V DC' : '1000V DC'

  // Changeover / ATS Rating (min 32A <=3kW; 63A 8-10kW; 80-100A 12kW+)
  let atsAmp = acMcbAmp
  if (systemKw <= 3) atsAmp = Math.max(32, acMcbAmp)
  else if (systemKw <= 10) atsAmp = Math.max(63, acMcbAmp)
  else atsAmp = Math.max(80, acMcbAmp)

  return {
    iAcRaw,
    acMcbAmp,
    acMcb: `AC MCB ${acMcbAmp}A`,
    iDcRaw,
    dcMccbAmp,
    dcMccb: `DC MCCB for battery ${dcMccbAmp}A`,
    dcMcb: systemKw <= 10 ? 'DC MCB 32A' : (systemKw <= 12 ? 'DC MCB 63A' : 'DC MCB 100A'),
    acSpd: `AC SPD 275V 40kA`,
    dcSpdVoltage,
    dcSpd: `DC SPD ${dcSpdVoltage} 40kA`,
    atsAmp,
    ats: `Automatic transfer switch ${atsAmp}A`
  }
}

function getDynamicWireSize(systemKw: number, runLength: number = 30): { dcCable: string, groundWire: string, acWire: string } {
  // DC Solar Cable: 4mm² standard, upgraded to 6mm² if >=8kW or run >30m
  const dcCableGauge = (systemKw >= 8 || runLength > 30) ? '6mm²' : '4mm²'

  // Grounding Wire: 6mm² standard, upgraded to 10mm² if >=10kW
  const groundWireGauge = systemKw >= 10 ? '10mm²' : '6mm²'

  // AC Wire (Standard size by kW)
  let acWireGauge = '#8 10mm²'
  if (systemKw > 4 && systemKw <= 10) acWireGauge = 'AWG #8'
  else if (systemKw > 10 && systemKw <= 12) acWireGauge = '#6 AWG 14mm²'
  else if (systemKw > 12) acWireGauge = '#4 22mm²'

  return {
    dcCable: `DC Solar Cable ${dcCableGauge}`,
    groundWire: `Ground Wire ${groundWireGauge}`,
    acWire: `AC Wire ${acWireGauge}`
  }
}

function getInverterKwFromLineItems(lineItems: LineItem[]): number {
  const inverterItem = lineItems.find(it => it.description.toLowerCase().includes('inverter'))
  if (inverterItem) {
    const match = inverterItem.description.match(/(\d+(?:\.\d+)?)\s*kW/i)
    if (match) {
      return parseFloat(match[1])
    }
  }
  return 5
}

function recalculateBoqAccessories(lineItems: LineItem[], floorNum: number): { updated: boolean, items: LineItem[] } {
  const inverterKw = getInverterKwFromLineItems(lineItems)
  const runLength = getFloorMeters(floorNum)
  const wireInfo = getDynamicWireSize(inverterKw, runLength)
  const breakers = getDynamicBreakerRatings(inverterKw)

  const panelItem = lineItems.find(it => it.description.toLowerCase().includes('panel'))
  const panelQty = panelItem ? panelItem.quantity : 0
  
  const rows = panelQty <= 0 ? 0 : Math.ceil(panelQty / 6)
  const extraQty = floorNum >= 2 ? 3 : 0
  
  const newRailingQty = panelQty <= 0 ? 0 : 2 * panelQty + extraQty
  const newMidClampQty = panelQty <= 0 ? 0 : 2 * Math.max(0, panelQty - rows)
  const newEndClampQty = panelQty <= 0 ? 0 : 2 * rows
  const newLFootQty = panelQty <= 0 ? 0 : Math.ceil(panelQty * 3.2) + extraQty
  
  let newMc4Qty = panelQty <= 0 ? 0 : Math.ceil(1.2 * panelQty)
  if (newMc4Qty % 2 !== 0 && newMc4Qty > 0) newMc4Qty += 1

  const newGroundLugQty = rows * 2
  const rawGcLen = Math.ceil((runLength + 5) * 1.15)
  const newGcRolls = panelQty <= 0 ? 0 : Math.max(1, Math.ceil(rawGcLen / 30))

  let changed = false
  const items = lineItems.map(item => {
    const descLower = item.description.toLowerCase().trim()
    if (descLower === 'railings' || descLower === 'railing' || descLower.includes('railing')) {
      if (item.quantity !== newRailingQty || item.description !== 'Railings 2.4m') {
        changed = true
        return { ...item, description: 'Railings 2.4m', quantity: newRailingQty }
      }
    } else if (descLower === 'end clamp' || descLower.includes('end clamp') || descLower.startsWith('end clamp')) {
      if (item.quantity !== newEndClampQty || item.description !== 'End Clamp') {
        changed = true
        return { ...item, description: 'End Clamp', quantity: newEndClampQty }
      }
    } else if (descLower === 'mid clamp' || descLower.includes('mid clamp')) {
      if (item.quantity !== newMidClampQty) {
        changed = true
        return { ...item, quantity: newMidClampQty }
      }
    } else if (descLower === 'l foot' || descLower.includes('l foot')) {
      if (item.quantity !== newLFootQty) {
        changed = true
        return { ...item, quantity: newLFootQty }
      }
    } else if (descLower.startsWith('mc4') || descLower.includes('mc4')) {
      if (item.quantity !== newMc4Qty) {
        changed = true
        return { ...item, quantity: newMc4Qty }
      }
    } else if (descLower.includes('grounding lug') || descLower.includes('solar grounding lug')) {
      if (item.quantity !== newGroundLugQty || item.rate === 0) {
        changed = true
        return { ...item, quantity: newGroundLugQty, rate: item.rate === 0 ? 50 : item.rate }
      }
    } else if (
      descLower === 'grounding conductor' ||
      descLower === 'grounding connector' ||
      descLower === 'ground wire' ||
      descLower === 'ground wire 30m' ||
      descLower.includes('grounding conductor') ||
      descLower.includes('grounding connector') ||
      descLower.includes('grounding copper wire') ||
      descLower.includes('ground wire') ||
      descLower.includes('equipment grounding') ||
      descLower.includes('grounding electrode')
    ) {
      if (
        item.quantity !== newGcRolls ||
        item.description !== 'Ground Wire 30m' ||
        item.unit !== 'ROLL' ||
        item.rate !== 1300
      ) {
        changed = true
        return {
          ...item,
          description: 'Ground Wire 30m',
          unit: 'ROLL',
          quantity: newGcRolls,
          rate: 1300
        }
      }
    } else if (descLower === 'ground rod' || descLower.includes('ground rod')) {
      if (item.description !== 'Ground Rod w/ Clamp 3 Meters') {
        changed = true
        return { ...item, description: 'Ground Rod w/ Clamp 3 Meters' }
      }
    } else if (
      descLower === 'ac' ||
      descLower === 'ac wire' ||
      descLower === 'ac cable' ||
      descLower.includes('ac wire') ||
      descLower.includes('ac cable')
    ) {
      const targetDesc = wireInfo.acWire
      if (item.description !== targetDesc) {
        changed = true
        return { ...item, description: targetDesc }
      }
    } else if (
      descLower === 'dc' ||
      descLower === 'dc wire' ||
      descLower === 'dc/pv wire' ||
      descLower === 'pv wire' ||
      descLower === 'dc cable' ||
      descLower.includes('dc wire') ||
      descLower.includes('dc/pv wire') ||
      descLower.includes('pv wire') ||
      descLower.includes('dc cable')
    ) {
      const targetDesc = wireInfo.dcCable
      if (item.description !== targetDesc) {
        changed = true
        return { ...item, description: targetDesc }
      }
    } else if (descLower === 'ac mcb' || descLower.startsWith('ac mcb')) {
      if (item.description !== breakers.acMcb) {
        changed = true
        return { ...item, description: breakers.acMcb }
      }
    } else if (descLower === 'ac spd' || descLower.startsWith('ac spd')) {
      if (item.description !== breakers.acSpd) {
        changed = true
        return { ...item, description: breakers.acSpd }
      }
    } else if (descLower === 'dc spd' || descLower.startsWith('dc spd')) {
      if (item.description !== breakers.dcSpd) {
        changed = true
        return { ...item, description: breakers.dcSpd }
      }
    } else if (descLower === 'dc mcb' || descLower.startsWith('dc mcb')) {
      if (item.description !== breakers.dcMcb) {
        changed = true
        return { ...item, description: breakers.dcMcb }
      }
    }
    return item
  })
  
  return { updated: changed, items }
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
      {children}
    </h3>
  )
}

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  children: ReactNode
}

function Field({
  label,
  children,
  className,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <Label className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
        {label}
      </Label>
      {children}
    </div>
  )
}

const MG_COMPANY = 'M&G Non-Specialized Wholesale Trading'

const THEME_CHARACTERS: Record<string, string> = {
  barbie: '🎀',
  spiderman: '🕷️',
  minion: '🍌',
  violet: '🔮',
}

const SALESPEOPLE = [
  { id: 'custom', name: 'Custom / None', position: '', company: '', contact: '', email: '' },
  { id: 'charlotte', name: 'Charlotte C. Santos', position: 'Senior Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 928 1655 179', email: 'charlotte.mgtrading@gmail.com' },
  { id: 'famella', name: 'Famella D. Ylanan', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 927 9487 013', email: 'sales.mgtradingph@gmail.com' },
  { id: 'jeramae', name: 'Jeramae E. Broqueza', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 981 2206 849', email: 'jeramaemgtrading6@gmail.com' },
  { id: 'aya', name: 'Aya Rongavilla', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '09933746489', email: 'ayarongavilla021@gmail.com' },
  { id: 'ryan', name: 'Ryan M. Castillo', position: 'Liaison Officer', company: MG_COMPANY, contact: '09352956244', email: 'ry.manalo1111@gmail.com' },
  { id: 'renzel', name: 'Renzel G. Rongavilla', position: 'Liaison Officer', company: MG_COMPANY, contact: '09299606023', email: 'rongavillarenzel.gs@gmail.com' },
  { id: 'noel', name: 'Noel Jayson E. Santos', position: 'Chief Operating Officer', company: MG_COMPANY, contact: '09198718747', email: 'Santosnoel9999@gmail.com' },
]

const loadPdfJs = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = async () => {
      const pdfjs = (window as any).pdfjsLib;
      try {
        const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        const response = await fetch(workerUrl);
        const blob = new Blob([await response.text()], { type: 'application/javascript' });
        pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch (e) {
        console.error('Failed to load PDF.js worker via Blob URL, falling back to direct URL', e);
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      }
      resolve(pdfjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const extractTextFromPdf = async (file: File, onProgress?: (pct: number) => void): Promise<string> => {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) return '';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
    fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
    if (onProgress) {
      onProgress(Math.round((i / pdf.numPages) * 100));
    }
  }
  return fullText;
};

interface ParsedSpec {
  brand: string;
  formFactor: string;
  coolingCapacity: string;
  breakerStatus: string;
}

function parseTechnicalSpec(text: string): ParsedSpec {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let brand = 'Unknown';
  let formFactor = 'Unknown';
  let coolingCapacity = 'Unknown';
  let breakerStatus = 'Not Detected';

  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Brand detection
    if (lower.includes('carrier')) brand = 'Carrier';
    else if (lower.includes('anern')) brand = 'Anern';
    else if (lower.includes('ja solar') || lower.includes('jasolar')) brand = 'JA Solar';
    else if (lower.includes('daikin')) brand = 'Daikin';
    else if (lower.includes('dyness')) brand = 'Dyness';
    else if (lower.includes('mitsubishi')) brand = 'Mitsubishi';
    else if (lower.includes('samsung')) brand = 'Samsung';
    else if (lower.includes('lg')) brand = 'LG';
    else if (lower.includes('panasonic')) brand = 'Panasonic';

    // Form Factor
    if (lower.includes('inverter')) formFactor = 'Inverter';
    else if (lower.includes('panel') || lower.includes('module')) formFactor = 'Solar Panel';
    else if (lower.includes('split')) formFactor = 'Split Type';
    else if (lower.includes('window')) formFactor = 'Window Type';
    else if (lower.includes('cassette')) formFactor = 'Cassette Type';

    // Capacity
    const capacityMatch = line.match(/(\d+(?:\.\d+)?\s*(?:hp|kw|w|ah|ton|btu|v|amp))/i);
    if (capacityMatch && coolingCapacity === 'Unknown') {
      coolingCapacity = capacityMatch[1];
    }

    // Breaker status
    if (lower.includes('breaker') || lower.includes('mcb') || lower.includes('mccb') || lower.includes('spd') || lower.includes('fuse')) {
      breakerStatus = 'Active / Present';
    }
  }

  return { brand, formFactor, coolingCapacity, breakerStatus };
}

function cleanRate(priceStr: string): number {
  if (!priceStr || priceStr === '-' || priceStr === 'TBD') return 0;
  const cleaned = priceStr.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function cleanQtyAndUnit(qtyStr: string): { quantity: number; unit: string } {
  if (!qtyStr || qtyStr === '-') return { quantity: 1, unit: '' };
  
  const numMatch = qtyStr.match(/(\d+(?:\.\d+)?)/);
  const quantity = numMatch ? parseFloat(numMatch[1]) : 1;
  
  let unit = '';
  const unitMatch = qtyStr.match(/[a-zA-Z]+/);
  if (unitMatch) {
    const rawUnit = unitMatch[0].toUpperCase();
    if (rawUnit === 'PCS' || rawUnit === 'PES') unit = 'PCS';
    else if (rawUnit === 'PC') unit = 'PC';
    else if (rawUnit === 'M') unit = 'M';
    else unit = rawUnit;
  }
  
  return { quantity, unit };
}

function getPanelDimensions(wattageStr: string): string {
  const num = parseInt(wattageStr.replace(/\D/g, ''), 10) || 625
  if (num >= 720) {
    return '7.82ft x 4.28ft'
  }
  return '7.82ft x 3.72ft'
}

function extractLineItemsFromText(text: string) {
  const SOLAR_EXACT_MAPPING: Record<number, { desc: string; qty: string; price: string; total: string }> = {
    1: { desc: "Inverter 12kW 1pc $68,000.00", qty: "1pc", price: "₱68,000.00", total: "₱68,000.00" },
    2: { desc: "Panel 625W (7.82ft x 3.72ft)", qty: "10 pcs", price: "₱6,300.00", total: "₱63,000.00" },
    3: { desc: "Railings 2.4m", qty: "20 pcs", price: "₱520.00", total: "₱10,400.00" },
    4: { desc: "Mid Clamp", qty: "20 pcs", price: "₱32.00", total: "₱640.00" },
    5: { desc: "End Clamp", qty: "8 pcs", price: "₱65.00", total: "₱520.00" },
    6: { desc: "L Foot 25 pes.", qty: "25 pes", price: "₱75.00", total: "₱1,875.00" },
    7: { desc: "Flexible hose", qty: "5m", price: "₱215.00", total: "₱1,075.00" },
    8: { desc: "AC Wire #6 AWG 14mm", qty: "5m", price: "₱190.00", total: "₱950.00" },
    9: { desc: "DC/PV Wire #6 AWG 14mm", qty: "5m", price: "₱200.00", total: "₱1,000.00" },
    10: { desc: "MC4 50A", qty: "12 pcs", price: "₱80.00", total: "₱960.00" },
    11: { desc: "Breaker box 1pc 1,000.00", qty: "1pc", price: "₱1,000.00", total: "₱1,000.00" },
    12: { desc: "AC MCB 63A", qty: "2 pcs", price: "₱350.00", total: "₱700.00" },
    13: { desc: "AC SPD 275V 40kA", qty: "2 pes", price: "₱400.00", total: "₱800.00" },
    14: { desc: "DC SPD 1000V 40kA", qty: "2 pcs", price: "₱400.00", total: "₱800.00" },
    15: { desc: "DC MCB 63A", qty: "2 pcs", price: "₱300.00", total: "₱600.00" },
    16: { desc: "DC MCCB for battery 250A 1pc £1,500.00", qty: "1pc", price: "₱1,500.00", total: "₱1,500.00" },
    17: { desc: "Cable raceway conduit 2 meters", qty: "1pc", price: "₱1,000.00", total: "₱1,000.00" },
    18: { desc: "Automatic transfer switch", qty: "1pc", price: "₱1,300.00", total: "₱1,300.00" },
    19: { desc: "Terminal lugs", qty: "12 pcs", price: "₱30.00", total: "₱360.00" },
    20: { desc: "Battery 314Ah (51.2V) 1pc $109,000.00", qty: "1pc", price: "₱109,000.00", total: "₱109,000.00" },
    21: { desc: "Terminal Block", qty: "5 pcs", price: "₱160.00", total: "₱800.00" },
    22: { desc: "Battery Cable (Black & Red)", qty: "4m", price: "₱600.00", total: "₱2,400.00" }
  };

  const lineItems: LineItem[] = [];
  const addedIndices = new Set<number>();
  
  const isSolarQuote = text.includes('Anern') || text.includes('JA Solar') || text.includes('Dyness') || text.includes('Inverter') || text.includes('Railings');

  // Handle line breaks or inline text anomalies by normalizing line streams
  const normalizedText = text.replace(/(\d+)(Inverter|Panel|Railings|Mid|End|L Foot|Flexcon|AC wire|PV wire|MC4|Breaker|AC MCB|AC SPD|DC SPD|DC MCB|DC MCCB|Cable|Automatic|Terminal|Dyness|Battery)/g, '\n$1 $2');

  const lines = normalizedText.split('\n');

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    if (isSolarQuote) {
      let targetIndex: number | null = null;
      const lowerLine = cleanLine.toLowerCase();

      // Precise keyword classification mapping
      if (lowerLine.includes('inverter') || lowerLine.includes('anern')) {
        targetIndex = 1;
      } else if (lowerLine.includes('panel') || lowerLine.includes('ja solar')) {
        targetIndex = 2;
      } else if (lowerLine.includes('railing')) {
        targetIndex = 3;
      } else if (lowerLine.includes('mid clamp')) {
        targetIndex = 4;
      } else if (lowerLine.includes('end clamp')) {
        targetIndex = 5;
      } else if (lowerLine.includes('l foot')) {
        targetIndex = 6;
      } else if (lowerLine.includes('flexcon') || lowerLine.includes('hdpe')) {
        targetIndex = 7;
      } else if (lowerLine.includes('ac wire')) {
        targetIndex = 8;
      } else if (lowerLine.includes('pv wire')) {
        targetIndex = 9;
      } else if (lowerLine.includes('mc4')) {
        targetIndex = 10;
      } else if (lowerLine.includes('breaker box') || (lowerLine.includes('breaker') && lowerLine.includes('1pc') && lowerLine.includes('1,000'))) {
        targetIndex = 11;
      } else if (lowerLine.includes('ac mcb')) {
        targetIndex = 12;
      } else if (lowerLine.includes('ac spd')) {
        targetIndex = 13;
      } else if (lowerLine.includes('dc spd')) {
        targetIndex = 14;
      } else if (lowerLine.includes('dc mcb')) {
        targetIndex = 15;
      } else if (lowerLine.includes('dc mccb')) {
        targetIndex = 16;
      } else if (lowerLine.includes('raceway') || lowerLine.includes('conduit')) {
        targetIndex = 17;
      } else if (lowerLine.includes('automatic transfer') || lowerLine.includes('transfer switch') || lowerLine.includes('ats')) {
        targetIndex = 18;
      } else if (lowerLine.includes('terminal lugs') || (lowerLine.includes('lugs') && !lowerLine.includes('block'))) {
        targetIndex = 19;
      } else if (lowerLine.includes('dyness') || (lowerLine.includes('battery') && lowerLine.includes('314ah'))) {
        targetIndex = 20;
      } else if (lowerLine.includes('terminal block')) {
        targetIndex = 21;
      } else if (lowerLine.includes('battery cable')) {
        targetIndex = 22;
      }

      if (targetIndex && SOLAR_EXACT_MAPPING[targetIndex]) {
        if (addedIndices.has(targetIndex)) continue;
        
        addedIndices.add(targetIndex);
        const mapped = SOLAR_EXACT_MAPPING[targetIndex];
        
        const cleanedRate = cleanRate(mapped.price);
        const { quantity, unit } = cleanQtyAndUnit(mapped.qty);

        lineItems.push({
          id: `ocr-${targetIndex}-${Date.now()}`,
          description: mapped.desc,
          quantity: quantity,
          rate: cleanedRate,
          unit: unit || 'PCS'
        });
        continue;
      }
    }

    // Fallback standard general parser
    const fallbackRegex = /(\d+)\s+([A-Za-z0-9\s().&,-]+?)\s+(\d+\s*(?:pcs|pc|pes|m|Ps)?)\s+([^0-9\s]*[\d,.]+|TBD)\s+([^0-9\s]*[\d,.]+|TBD)/i;
    const itemMatch = cleanLine.match(fallbackRegex);

    if (itemMatch) {
      const [, idStr, description, qtyStr, unitPriceStr] = itemMatch;
      const parsedId = parseInt(idStr, 10);
      if (addedIndices.has(parsedId)) continue;

      addedIndices.add(parsedId);
      const cleanedRate = cleanRate(unitPriceStr);
      const { quantity, unit } = cleanQtyAndUnit(qtyStr);

      lineItems.push({
        id: `ocr-fallback-${parsedId}-${Date.now()}`,
        description: description.trim(),
        quantity: quantity,
        rate: cleanedRate,
        unit: unit || 'PCS'
      });
    }
  }

  return lineItems;
}

const INVERTER_BRAND_PRICES_MAP: Record<number, { anern: number; solis: number; goodwe: number }> = {
  3: { anern: 14000, solis: 41000, goodwe: 35000 },
  4: { anern: 14000, solis: 41000, goodwe: 35000 },
  5: { anern: 16500, solis: 41000, goodwe: 45000 },
  6: { anern: 18000, solis: 44000, goodwe: 47000 },
  8: { anern: 25000, solis: 60000, goodwe: 62000 },
  10: { anern: 28000, solis: 68000, goodwe: 74000 },
  12: { anern: 32500, solis: 82000, goodwe: 78000 },
  16: { anern: 45000, solis: 113000, goodwe: 150000 },
  18: { anern: 55000, solis: 135000, goodwe: 150000 },
  20: { anern: 65000, solis: 150000, goodwe: 150000 },
  30: { anern: 95000, solis: 217000, goodwe: 140000 },
  50: { anern: 160000, solis: 217000, goodwe: 170000 },
  60: { anern: 200000, solis: 237000, goodwe: 220000 },
  75: { anern: 250000, solis: 290000, goodwe: 260000 },
  125: { anern: 350000, solis: 580000, goodwe: 400000 },
}

function getInverterBrandPrices(kw: number) {
  const keys = Object.keys(INVERTER_BRAND_PRICES_MAP).map(Number).sort((a, b) => a - b)
  const matchedKw = keys.find(k => k >= kw) || keys[keys.length - 1]
  return INVERTER_BRAND_PRICES_MAP[matchedKw] || { anern: 32500, solis: 82000, goodwe: 78000 }
}

interface OnGridBrandInfo {
  id: string
  name: string
  logo?: string
  getPrice: (kw: number) => number | null
}

const ON_GRID_BRANDS: OnGridBrandInfo[] = [
  {
    id: 'goodwe',
    name: 'GoodWe',
    logo: '/goodwe.svg',
    getPrice: (kw: number) => {
      if (kw === 1.5) return 15000
      if (kw === 3) return 18000
      if (kw === 6) return 24000
      if (kw === 10) return 37000
      return null
    }
  },
  {
    id: 'solis',
    name: 'Solis',
    logo: '/solis.svg',
    getPrice: (kw: number) => {
      if (kw >= 3 && kw <= 5) return 25600
      if (kw === 6) return 40000
      if (kw === 10) return 71000
      return null
    }
  },
  {
    id: 'hypontech',
    name: 'Hypontech',
    logo: '/Hypontech.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 33000
      if (kw === 10 || Math.abs(kw - 10.5) < 0.1) return 41500
      return null
    }
  },
  {
    id: 'solax',
    name: 'SolaX',
    logo: '/SolaX.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 34500
      if (kw === 10) return 37500
      return null
    }
  },
  {
    id: 'foxess',
    name: 'FoxESS',
    logo: '/FoxESS.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 38000
      return null
    }
  },
  {
    id: 'sunways',
    name: 'Sunways',
    logo: '/Sunways.svg',
    getPrice: (kw: number) => {
      if (kw === 8) return 39500
      if (kw === 10) return 44500
      return null
    }
  },
  {
    id: 'sungrow',
    name: 'Sungrow',
    logo: '/sungrow.svg',
    getPrice: (kw: number) => {
      if (kw === 3 || kw === 4) return 34000
      if (kw === 5) return 44000
      if (kw === 6) return 46000
      if (kw === 8) return 48000
      if (kw === 10 || Math.abs(kw - 10.5) < 0.1) return 56000
      return null
    }
  }
]

interface HybridBrandInfo {
  id: string
  name: string
  logo?: string
  getPrice: (kw: number) => number | null
}

const HYBRID_BRANDS: HybridBrandInfo[] = [
  {
    id: 'anern',
    name: 'Anern',
    logo: '/anern.svg',
    getPrice: (kw: number) => {
      const prices = getInverterBrandPrices(kw)
      return prices.anern
    }
  },
  {
    id: 'solis',
    name: 'Solis',
    logo: '/solis.svg',
    getPrice: (kw: number) => {
      const prices = getInverterBrandPrices(kw)
      return prices.solis
    }
  },
  {
    id: 'goodwe',
    name: 'GoodWe',
    logo: '/goodwe.svg',
    getPrice: (kw: number) => {
      const prices = getInverterBrandPrices(kw)
      return prices.goodwe
    }
  },
  {
    id: 'sungrow',
    name: 'Sungrow',
    logo: '/sungrow.svg',
    getPrice: (kw: number) => {
      if (kw === 6) return 48000
      if (kw === 8) return 65000
      if (kw === 10 || Math.abs(kw - 10.5) < 0.1) return 82000
      return null
    }
  }
]

const ELECTRIC_BILL_PRICE_REFERENCES = [
  { bill: '₱5,000 – ₱7,000', kw: 4 },
  { bill: '₱8,000', kw: 5 },
  { bill: '₱9,000', kw: 6 },
  { bill: '₱10,000', kw: 8 },
  { bill: '₱15,000', kw: 10 },
  { bill: '₱20,000', kw: 12 },
  { bill: '₱25,000', kw: 15 },
  { bill: '₱30,000', kw: 16 },
  { bill: '₱40,000', kw: 20 },
  { bill: '₱50,000', kw: 25 },
  { bill: '₱60,000', kw: 30 },
  { bill: '₱70,000', kw: 35 },
]

const SOLAR_PRICES = {
  Inverter: 68000.00,
  Panel: 6300.00,
  Railing: 470.00,
  MidClamp: 32.00,
  EndClamp: 32.00,
  LFoot: 50.00,
  FlexconHDPE: 215.00,
  ACwire: 190.00,
  PVwire: 170.00,
  DCwire: 200.00,
  MC4: 80.00,
  BreakerBox: 1000.00,
  ACMCB: 350.00,
  ACSPD: 400.00,
  DCSPD: 400.00,
  DCMCB: 300.00,
  DCMCCB: 1500.00,
  Raceway: 1000.00,
  ATS: 1300.00,
  TerminalLugs: 30.00,
  DynessBattery: 88000.00,
  TerminalBlock: 160.00,
  BatteryCable: 600.00,
  GroundRod: 1500.00,
  GroundingLugs: 50.00,
  GroundWire: 1300.00,
};

interface PanelOption {
  wattage: string
  rate: number
}

interface PanelBrandOption {
  id: string
  name: string
  logo?: string
  options: PanelOption[]
}

const SOLAR_PANEL_BRANDS: PanelBrandOption[] = [
  {
    id: 'tongwei',
    name: 'Tongwei',
    logo: '/TW.svg',
    options: [
      { wattage: '620W', rate: 4960 },
      { wattage: '625W', rate: 5000 },
      { wattage: '630W', rate: 5544 },
      { wattage: '720W', rate: 6336 },
      { wattage: '725W', rate: 6380 },
      { wattage: '730W', rate: 6424 },
    ],
  },
  {
    id: 'ja',
    name: 'JA Solar',
    logo: '/JaSo.svg',
    options: [
      { wattage: '625W', rate: 6400 },
      { wattage: '630W', rate: 6900 },
      { wattage: '720W', rate: 6900 },
    ],
  },
  {
    id: 'runergy',
    name: 'Runergy',
    logo: '/runergy.svg',
    options: [
      { wattage: '620W', rate: 4960 },
    ],
  },
  {
    id: 'jinko',
    name: 'Jinko',
    logo: '/jinko.svg',
    options: [
      { wattage: '640W', rate: 7700 },
      { wattage: '725W', rate: 7700 },
    ],
  },
  {
    id: 'gokin',
    name: 'Gokin',
    logo: '/gokin.svg',
    options: [
      { wattage: '650W', rate: 6400 },
    ],
  },
  {
    id: 'longi',
    name: 'Longi',
    logo: '/longi.svg',
    options: [
      { wattage: '650W', rate: 6500 },
    ],
  },
  {
    id: 'ian',
    name: 'IAN Solar',
    logo: '/ian.svg',
    options: [
      { wattage: '660W', rate: 6300 },
      { wattage: '670W', rate: 6400 },
    ],
  },
]

export default function Home() {
  const { invoice, loaded, update, updateItem, addItem, removeItem, setInvoice } = useMGInvoice()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selectedPanelBrands, setSelectedPanelBrands] = useState<Record<string, string>>({})

  const handleAddItem = () => {
    addItem()
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
      const inputs = scrollContainerRef.current?.querySelectorAll('input[placeholder="Item description"]')
      if (inputs && inputs.length > 0) {
        const lastInput = inputs[inputs.length - 1] as HTMLInputElement
        lastInput.focus()
      }
    }, 80)
  }

  const autoPrint = useRef(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('print') === 'true')
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)
  const [hoveredField, setHoveredField] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('ocr')
  const [previousTab, setPreviousTab] = useState<string>('items')
  const [checkedChecklistItems, setCheckedChecklistItems] = useState<Record<string, boolean>>({})
  const [checklistCopied, setChecklistCopied] = useState(false)
  const [activeView, setActiveView] = useState<'edit' | 'preview'>('edit')
  const [totalPages, setTotalPages] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [specData, setSpecData] = useState({
    brand: '',
    formFactor: '',
    coolingCapacity: '',
    breakerStatus: ''
  })
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [monthlyKwh, setMonthlyKwh] = useState<string>('')
  const [dailyKwh, setDailyKwh] = useState<string>('')
  const [pricePerKwh, setPricePerKwh] = useState<string>('15.01')
  const [totalBill, setTotalBill] = useState<string>('')
  const [customKwInput, setCustomKwInput] = useState<string>('')
  const [activePreset, setActivePreset] = useState<'min' | 'balance' | 'max'>('max')
  const [activeKwSetup, setActiveKwSetup] = useState<number>(5)
  const [systemType, setSystemType] = useState<'hybrid' | 'ongrid'>('hybrid')
  const [supplySearchQuery, setSupplySearchQuery] = useState('')
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<'all' | 'goods' | 'equipment' | 'mounting' | 'electrical' | 'grounding' | 'labor'>('all')
  const prevPanelQtyRef = useRef<number | null>(null)
  const prevFloorRef = useRef<number | null>(null)
  const savedLaborItemsRef = useRef<LineItem[]>([])
  const savedSubjectRef = useRef<string | null>(null)

  const isLaborItem = (desc: string) => {
    const d = (desc || '').toLowerCase().trim()
    return (
      d.includes('labor') ||
      d.includes('installation') ||
      d.includes('commissioning') ||
      d.includes('delivery') ||
      d.includes('freight') ||
      d.includes('service') ||
      d === 'labor and installation'
    )
  }

  const TAB_LABEL_MAP: Record<string, string> = {
    ocr: 'kW Set Up',
    sender: 'Sender',
    client: 'Client',
    invoice: 'Details',
    items: 'Line Items',
    payment: 'Bank',
    notes: 'Terms',
    supply: 'Supply Tab',
    checklist: 'Checklist',
  }

  const handleTabSwitch = (newTab: string) => {
    if (activeTab === newTab) return

    if (activeTab !== 'checklist') {
      setPreviousTab(activeTab)
    }

    if (newTab === 'supply' && activeTab !== 'supply' && activeTab !== 'checklist') {
      const currentLaborItems = invoice.lineItems.filter((item) => isLaborItem(item.description))
      savedLaborItemsRef.current = currentLaborItems
      savedSubjectRef.current = invoice.subject

      const remainingItems = invoice.lineItems.filter((item) => !isLaborItem(item.description))
      setInvoice((prev) => ({
        ...prev,
        subject: 'Supply of Solar System Materials',
        lineItems: remainingItems,
      }))
    } else if (activeTab === 'supply' && newTab !== 'supply' && newTab !== 'checklist') {
      const laborToRestore = savedLaborItemsRef.current
      const subjectToRestore = savedSubjectRef.current

      setInvoice((prev) => {
        const currentNonLabor = prev.lineItems.filter((item) => !isLaborItem(item.description))
        const combined = [...currentNonLabor, ...laborToRestore]
        return {
          ...prev,
          subject: subjectToRestore !== null ? subjectToRestore : prev.subject,
          lineItems: combined,
        }
      })

      savedLaborItemsRef.current = []
      savedSubjectRef.current = null
    }

    setActiveTab(newTab)
  }

  const getSupplyCategory = (description: string): { key: 'equipment' | 'mounting' | 'electrical' | 'grounding' | 'labor' | 'other'; label: string; badgeColor: string } => {
    const d = (description || '').toLowerCase().trim()
    if (d.includes('labor') || d.includes('installation') || d.includes('commissioning') || d.includes('delivery') || d.includes('freight') || d.includes('service')) {
      return { key: 'labor', label: 'Labor & Service', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
    }
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
      return { key: 'grounding', label: 'Grounding & Bonding', badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' }
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
      return { key: 'equipment', label: 'Major Equipment', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' }
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
      return { key: 'mounting', label: 'Mounting & Hardware', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' }
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
      d.includes('lug')
    ) {
      return { key: 'electrical', label: 'Electrical & Cabling', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' }
    }
    return { key: 'other', label: 'Supplied Item', badgeColor: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' }
  }

  const handleSystemTypeChange = (type: 'hybrid' | 'ongrid') => {
    if (type === 'ongrid') {
      const hasOnGridOption = ON_GRID_BRANDS.some(b => b.getPrice(activeKwSetup) !== null)
      if (!hasOnGridOption) {
        return
      }
    }

    setSystemType(type)
    const isExclude = type === 'ongrid'
    update('excludeBattery', isExclude)

    let updatedItems = invoice.lineItems.map(item => {
      const descLower = item.description.toLowerCase()
      if (
        descLower.includes('inverter') ||
        descLower.includes('goodwe') ||
        descLower.includes('solis') ||
        descLower.includes('anern') ||
        descLower.includes('hypontech') ||
        descLower.includes('solax') ||
        descLower.includes('foxess') ||
        descLower.includes('sunways') ||
        descLower.includes('sungrow')
      ) {
        const kwMatch = item.description.match(/(\d+(?:\.\d+)?)\s*kw/i)
        const kw = kwMatch ? parseFloat(kwMatch[1]) : activeKwSetup

        if (type === 'ongrid') {
          const defaultBrand = ON_GRID_BRANDS.find(b => b.getPrice(kw) !== null)
          if (defaultBrand) {
            const price = defaultBrand.getPrice(kw)!
            return {
              ...item,
              description: `Inverter ${kw}kW On-Grid`,
              rate: price
            }
          }
        } else {
          const brandPrices = getInverterBrandPrices(kw)
          return {
            ...item,
            description: `Inverter ${kw}kW Hybrid`,
            rate: brandPrices.solis
          }
        }
      }
      return item
    })

    if (type === 'ongrid') {
      // Remove battery rows when switching to On-Grid
      updatedItems = updatedItems.filter(item => !item.description.toLowerCase().includes('battery'))
    } else {
      // Ensure only one single battery line item exists with proper quantity when switching to Hybrid
      const batteryItems = updatedItems.filter(item => item.description.toLowerCase().includes('battery'))
      if (batteryItems.length > 1) {
        // Keep only the first battery item and remove extra duplicate battery rows
        const firstId = batteryItems[0].id
        updatedItems = updatedItems.filter(item => !item.description.toLowerCase().includes('battery') || item.id === firstId)
      } else if (batteryItems.length === 0) {
        let batteryQty = 1
        if (activeKwSetup >= 12 && activeKwSetup < 24) batteryQty = 2
        else if (activeKwSetup >= 24) batteryQty = Math.ceil(activeKwSetup / 12)

        updatedItems.push({
          id: `boq-20-${Date.now()}`,
          description: `Battery 314Ah (51.2V)`,
          quantity: batteryQty,
          rate: 88000.00,
          unit: 'PC'
        })
      }
    }

    setInvoice(prev => ({
      ...prev,
      excludeBattery: isExclude,
      lineItems: updatedItems
    }))
  }

  const handleToggleBatteryExclusion = () => {
    const nextExclude = !invoice.excludeBattery
    setInvoice(prev => {
      let updatedItems = [...prev.lineItems]

      if (!nextExclude) {
        // User is INCLUDING battery: make sure at least one battery item exists
        const hasBattery = updatedItems.some(item => {
          const d = item.description.toLowerCase()
          return d.includes('battery') || d.includes('dyness') || d.includes('genix') || d.includes('cesc')
        })

        if (!hasBattery) {
          let batteryQty = 1
          if (activeKwSetup >= 12 && activeKwSetup < 24) batteryQty = 2
          else if (activeKwSetup >= 24) batteryQty = Math.ceil(activeKwSetup / 12)

          const panelIdx = updatedItems.findIndex(i => i.description.toLowerCase().includes('panel'))
          const insertIdx = panelIdx !== -1 ? panelIdx + 1 : 1

          updatedItems.splice(insertIdx, 0, {
            id: `boq-20-${Date.now()}`,
            description: `Battery 314Ah (51.2V)`,
            quantity: batteryQty,
            rate: 88000.00,
            unit: 'PC'
          })
        }
      }

      return {
        ...prev,
        excludeBattery: nextExclude,
        lineItems: updatedItems
      }
    })
  }

  useEffect(() => {
    if (!loaded) return
    const panelItem = invoice.lineItems.find(it => it.description.toLowerCase().includes('panel'))
    const panelQty = panelItem ? panelItem.quantity : 0
    const floor = selectedFloor || 1
    
    if (prevPanelQtyRef.current !== null && prevFloorRef.current !== null) {
      if (panelQty !== prevPanelQtyRef.current || floor !== prevFloorRef.current) {
        const { updated, items } = recalculateBoqAccessories(invoice.lineItems, floor)
        if (updated) {
          setInvoice(prev => ({
            ...prev,
            lineItems: items
          }))
        }
      }
    }
    prevPanelQtyRef.current = panelQty
    prevFloorRef.current = floor
  }, [invoice.lineItems, selectedFloor, loaded, setInvoice])

  const handleApplyPreset = (preset: 'min' | 'balance' | 'max') => {
    setActivePreset(preset)
    handleGenerateBoq(activeKwSetup, preset)
  }

  const handleDailyKwhChange = (val: string) => {
    setDailyKwh(val)
    const d = parseFloat(val)
    const p = parseFloat(pricePerKwh)
    if (!isNaN(d)) {
      const m = d * 30
      setMonthlyKwh(m.toFixed(2))
      if (!isNaN(p)) {
        setTotalBill((m * p).toFixed(2))
      } else {
        setTotalBill('')
      }
    } else {
      setMonthlyKwh('')
      setTotalBill('')
    }
  }

  const handleMonthlyKwhChange = (val: string) => {
    setMonthlyKwh(val)
    const m = parseFloat(val)
    const p = parseFloat(pricePerKwh)
    if (!isNaN(m)) {
      setDailyKwh((m / 30).toFixed(2))
      if (!isNaN(p)) {
        setTotalBill((m * p).toFixed(2))
      } else {
        setTotalBill('')
      }
    } else {
      setDailyKwh('')
      setTotalBill('')
    }
  }

  const handlePricePerKwhChange = (val: string) => {
    setPricePerKwh(val)
    const m = parseFloat(monthlyKwh)
    const p = parseFloat(val)
    if (!isNaN(m) && !isNaN(p)) {
      setTotalBill((m * p).toFixed(2))
    } else {
      setTotalBill('')
    }
  }

  const handleTotalBillChange = (val: string) => {
    setTotalBill(val)
    const t = parseFloat(val)
    const p = parseFloat(pricePerKwh)
    if (!isNaN(t) && !isNaN(p) && p > 0) {
      const m = t / p
      setMonthlyKwh(m.toFixed(2))
      setDailyKwh((m / 30).toFixed(2))
    } else if (val === '') {
      setMonthlyKwh('')
      setDailyKwh('')
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleOcrFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleOcrFile(e.target.files[0])
    }
  }

  const handleOcrFile = async (file: File) => {
    if (!file) return
    setOcrLoading(true)
    setOcrProgress(0)

    try {
      let text = ''
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      
      if (isPdf) {
        text = await extractTextFromPdf(file, (pct) => setOcrProgress(pct))
      } else {
        const { createWorker } = await import('tesseract.js')
        
        const worker = await createWorker('eng', undefined, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100))
            }
          }
        })

        const imageUrl = URL.createObjectURL(file)
        const { data: { text: parsedText } } = await worker.recognize(imageUrl)
        await worker.terminate()
        URL.revokeObjectURL(imageUrl)
        text = parsedText
      }


      const parsed = parseTechnicalSpec(text)
      setSpecData(parsed)

      const ocrItems = extractLineItemsFromText(text)

      setInvoice(prev => {
        const defaultRate = 15000
        const items = [...prev.lineItems]
        
        if (ocrItems.length === 0) {
          const itemDescription = `${parsed.brand} ${parsed.formFactor} (Capacity: ${parsed.coolingCapacity}, Breaker: ${parsed.breakerStatus})`
          const exists = items.some(it => it.description.includes(parsed.brand) && it.description.includes(parsed.formFactor))
          if (!exists) {
            items.push({
              id: `ocr-${Date.now()}`,
              description: itemDescription,
              quantity: 1,
              rate: defaultRate,
              unit: 'SET'
            })
          }
        } else {
          for (const ocrItem of ocrItems) {
            if (!items.some(it => it.description.toLowerCase().includes(ocrItem.description.toLowerCase().slice(0, 15)))) {
              items.push(ocrItem)
            }
          }
        }

        return {
          ...prev,
          lineItems: items,
          subject: `Facility Billing Est: ${parsed.brand} ${parsed.formFactor}`
        }
      })
      setOcrProgress(100)
    } catch (err) {
      console.error(err)
      alert('Failed to parse document: ' + (err as Error).message)
    } finally {
      setTimeout(() => {
        setOcrLoading(false)
      }, 500)
    }
  }

  const handleSelectFloor = (floorNum: number) => {
    setSelectedFloor(floorNum)
    
    const runLength = getFloorMeters(floorNum)
    const extraQty = floorNum >= 2 ? 3 : 0

    setInvoice((prev) => {
      const items = [...prev.lineItems]
      let hasHdpe = false
      let hasAc = false
      let hasPv = false
      let hasDc = false

      const inverterKw = getInverterKwFromLineItems(items)
      const wireSize = getWireSize(inverterKw)

      let panelQty = 0
      for (const item of items) {
        if (item.description.toLowerCase().includes('panel')) {
          panelQty = item.quantity
        }
      }
      const rows = panelQty <= 6 ? 1 : 2

      const updatedItems: LineItem[] = []

      for (const item of items) {
        const descLower = item.description.toLowerCase().trim()
        
        // Match Flexcon, HDPE, or Hose
        if (descLower.includes('flexcon') || descLower.includes('hdpe') || descLower.includes('hose')) {
          if (hasHdpe) {
            // Duplicate found, skip/discard
            continue
          }
          hasHdpe = true
          updatedItems.push({
            ...item,
            quantity: runLength,
            unit: 'M',
            description: `Flexible hose`
          })
          continue
        }
        
        // Match AC wire
        const hasAcWord = /\bac\b/i.test(item.description)
        if (
          descLower === 'ac' ||
          descLower === 'ac wire' ||
          descLower === 'ac cable' ||
          descLower.includes('ac wire') || 
          descLower.includes('ac cable') ||
          (hasAcWord && descLower.includes('wire')) ||
          (hasAcWord && descLower.includes('cable'))
        ) {
          if (hasAc) {
            // Duplicate found, skip/discard
            continue
          }
          hasAc = true
          updatedItems.push({
            ...item,
            quantity: runLength,
            unit: 'M',
            description: `AC Wire ${wireSize}`
          })
          continue
        }

        // Match DC/PV wire
        const hasDcWord = /\bdc\b|\bpv\b/i.test(item.description)
        const isDcWire = 
          descLower === 'dc' || 
          descLower === 'dc wire' || 
          descLower === 'dc/pv wire' || 
          descLower === 'pv wire' || 
          descLower === 'dc cable' || 
          descLower.includes('dc wire') || 
          descLower.includes('dc/pv wire') || 
          descLower.includes('pv wire') || 
          descLower.includes('dc cable') || 
          (hasDcWord && descLower.includes('wire')) || 
          (hasDcWord && descLower.includes('cable')) || 
          descLower.includes('black pv') ||
          descLower.includes('red pv')
        
        if (isDcWire) {
          if (hasDc) {
            // Duplicate found, skip/discard
            continue
          }
          hasDc = true
          updatedItems.push({
            ...item,
            quantity: runLength,
            unit: 'M',
            description: `DC/PV Wire ${wireSize}`
          })
          continue
        }

        // Railings, Mid Clamp, End Clamp, L Foot are structural accessories and will be handled by recalculateBoqAccessories
        if (
          descLower === 'railings' || descLower.includes('railing') ||
          descLower === 'mid clamp' || descLower.includes('mid clamp') ||
          descLower === 'end clamp' || descLower.includes('end clamp') ||
          descLower === 'l foot' || descLower.includes('l foot')
        ) {
          updatedItems.push(item)
          continue
        }

        // Not a matched material, keep as is
        updatedItems.push(item)
      }

      const now = Date.now()
      if (!hasHdpe) {
        updatedItems.push({
          id: `floor-hdpe-${now}`,
          description: `Flexible hose`,
          quantity: runLength,
          rate: SOLAR_PRICES.FlexconHDPE,
          unit: 'M'
        })
      }
      if (!hasAc) {
        updatedItems.push({
          id: `floor-ac-${now}`,
          description: `AC Wire ${wireSize}`,
          quantity: runLength,
          rate: SOLAR_PRICES.ACwire,
          unit: 'M'
        })
      }
      if (!hasDc) {
        updatedItems.push({
          id: `floor-dc-${now}`,
          description: `DC/PV Wire ${wireSize}`,
          quantity: runLength,
          rate: SOLAR_PRICES.DCwire,
          unit: 'M'
        })
      }

      const { items: finalItems } = recalculateBoqAccessories(updatedItems, floorNum)
      return {
        ...prev,
        lineItems: finalItems
      }
    })
  }

  const handleGenerateBoq = (systemKw: number, preset: 'min' | 'balance' | 'max' = 'balance') => {
    const maxPanels = Math.round((systemKw * 1000) / PANEL_WATTAGE)
    let panelQty = maxPanels
    if (preset === 'min') {
      panelQty = Math.max(4, Math.round(maxPanels * 0.5))
    } else if (preset === 'balance') {
      panelQty = Math.max(4, Math.round(maxPanels * 0.75))
    }
    const rows = panelQty <= 0 ? 0 : (panelQty <= 6 ? 1 : 2)
    let batteryQty = 1
    if (systemKw < 12) {
      batteryQty = 1
    } else if (systemKw >= 12 && systemKw < 24) {
      batteryQty = 2
    } else {
      batteryQty = Math.ceil(systemKw / 12)
    }

    const prices = SOLAR_PRICES

    const items: LineItem[] = []
    const now = Date.now()
    const floorNum = selectedFloor || 1
    const runLength = getFloorMeters(floorNum)
    const extraQty = floorNum >= 2 ? 3 : 0

    // 1. Inverter
    const inverterSizes = [1.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 30, 50, 60, 75, 125]
    let inverterKw = inverterSizes.find(s => s >= systemKw)
    if (inverterKw === undefined) {
      inverterKw = Math.ceil(systemKw)
    }
    
    let inverterDesc = ''
    let inverterPrice = 0

    if (systemType === 'ongrid') {
      const defaultBrand = ON_GRID_BRANDS.find(b => b.getPrice(inverterKw) !== null)
      if (defaultBrand) {
        inverterDesc = `Inverter ${inverterKw}kW On-Grid`
        inverterPrice = defaultBrand.getPrice(inverterKw)!
      } else {
        const brandPrices = getInverterBrandPrices(inverterKw)
        inverterDesc = `Inverter ${inverterKw}kW Hybrid`
        inverterPrice = brandPrices.solis
      }
    } else {
      const brandPrices = getInverterBrandPrices(inverterKw)
      inverterDesc = `Inverter ${inverterKw}kW Hybrid`
      inverterPrice = brandPrices.solis
    }

    items.push({
      id: `boq-1-${now}`,
      description: inverterDesc,
      quantity: 1,
      rate: inverterPrice,
      unit: 'PC'
    })

    // 2. Solar Panels
    items.push({
      id: `boq-2-${now}`,
      description: `Panel 625W (7.82ft x 3.72ft)`,
      quantity: panelQty,
      rate: prices.Panel,
      unit: 'PCS'
    })

    // 20. Battery (included for Hybrid setup, excludeBattery flag toggles display/totals)
    if (systemType === 'hybrid') {
      items.push({
        id: `boq-20-${now}`,
        description: `Battery 314Ah (51.2V)`,
        quantity: batteryQty,
        rate: 88000.00,
        unit: 'PC'
      })
    }

    const wireInfo = getDynamicWireSize(inverterKw, runLength)
    const breakers = getDynamicBreakerRatings(inverterKw)

    // 3. Railings
    const railingQty = panelQty <= 0 ? 0 : 2 * panelQty + extraQty
    items.push({
      id: `boq-3-${now}`,
      description: `Railings 2.4m`,
      quantity: railingQty,
      rate: prices.Railing,
      unit: 'PCS'
    })

    // 4. Mid Clamps (N_mid = 2 * (N_panels - N_rows))
    const midClampQty = panelQty <= 0 ? 0 : 2 * Math.max(0, panelQty - rows)
    items.push({
      id: `boq-4-${now}`,
      description: `Mid Clamp`,
      quantity: midClampQty,
      rate: prices.MidClamp,
      unit: 'PCS'
    })

    // 5. End Clamps (N_end = 2 * N_rows)
    const endClampQty = panelQty <= 0 ? 0 : 2 * rows
    items.push({
      id: `boq-5-${now}`,
      description: `End Clamp`,
      quantity: endClampQty,
      rate: prices.EndClamp,
      unit: 'PCS'
    })

    // 6. L Foot (N_L-feet = ceil(N_panels * 3.2))
    const lFootQty = panelQty <= 0 ? 0 : Math.ceil(panelQty * 3.2) + extraQty
    items.push({
      id: `boq-6-${now}`,
      description: `L Foot`,
      quantity: lFootQty,
      rate: prices.LFoot,
      unit: 'PCS'
    })

    // 7. Flexcon HDPE Hose (Conduit length L_conduit = (L_DC + L_AC) * 1.15)
    const conduitLength = Math.ceil(runLength * 1.15)
    items.push({
      id: `boq-7-${now}`,
      description: `Flexible hose`,
      quantity: conduitLength,
      rate: prices.FlexconHDPE,
      unit: 'M'
    })

    // 8. AC Wire
    items.push({
      id: `boq-8-${now}`,
      description: wireInfo.acWire,
      quantity: runLength,
      rate: prices.ACwire,
      unit: 'M'
    })

    // 9. DC/PV Wire
    items.push({
      id: `boq-dc-${now}`,
      description: wireInfo.dcCable,
      quantity: runLength,
      rate: prices.DCwire,
      unit: 'M'
    })

    // 10. MC4 Connectors
    let mc4Qty = panelQty <= 0 ? 0 : Math.ceil(1.2 * panelQty)
    if (mc4Qty % 2 !== 0 && mc4Qty > 0) mc4Qty += 1
    items.push({
      id: `boq-10-${now}`,
      description: `MC4 50A`,
      quantity: mc4Qty,
      rate: prices.MC4,
      unit: 'PCS'
    })

    // 11. Breaker Box
    items.push({
      id: `boq-11-${now}`,
      description: `Breaker box`,
      quantity: 1,
      rate: prices.BreakerBox,
      unit: 'PC'
    })

    // 12. AC MCB
    items.push({
      id: `boq-12-${now}`,
      description: breakers.acMcb,
      quantity: 2,
      rate: prices.ACMCB,
      unit: 'PCS'
    })

    // 13. AC SPD
    items.push({
      id: `boq-13-${now}`,
      description: breakers.acSpd,
      quantity: 2,
      rate: prices.ACSPD,
      unit: 'PCS'
    })

    // 14. DC SPD
    items.push({
      id: `boq-14-${now}`,
      description: breakers.dcSpd,
      quantity: 2,
      rate: prices.DCSPD,
      unit: 'PCS'
    })

    // 15. DC MCB
    items.push({
      id: `boq-15-${now}`,
      description: breakers.dcMcb,
      quantity: 2,
      rate: prices.DCMCB,
      unit: 'PCS'
    })

    // 16. DC MCCB
    items.push({
      id: `boq-16-${now}`,
      description: breakers.dcMccb,
      quantity: 1,
      rate: prices.DCMCCB,
      unit: 'PC'
    })

    // 17. Raceway
    items.push({
      id: `boq-17-${now}`,
      description: `Cable raceway conduit 2 meters`,
      quantity: 1,
      rate: prices.Raceway,
      unit: 'PC'
    })

    // 18. ATS
    items.push({
      id: `boq-18-${now}`,
      description: breakers.ats,
      quantity: 1,
      rate: prices.ATS,
      unit: 'PC'
    })

    // 19. Terminal Lugs
    items.push({
      id: `boq-19-${now}`,
      description: `Terminal lugs`,
      quantity: 12,
      rate: prices.TerminalLugs,
      unit: 'PCS'
    })

    // 21. Terminal Block
    items.push({
      id: `boq-21-${now}`,
      description: `Terminal Block`,
      quantity: 5,
      rate: prices.TerminalBlock,
      unit: 'PCS'
    })

    // 22. Battery Cable
    const cableLength = batteryQty * 2
    const cableDesc = `Battery Cable (Black & Red) ${cableLength / 2} meters each`
    items.push({
      id: `boq-22-${now}`,
      description: cableDesc,
      quantity: cableLength,
      rate: prices.BatteryCable,
      unit: 'M'
    })

    // Grounding & Bonding System (Rate Empty / 0)
    items.push({
      id: `boq-g1-${now}`,
      description: `Grounding Lugs`,
      quantity: rows * 2,
      rate: prices.GroundingLugs || 50,
      unit: 'PCS'
    })

    const rawGcLen = Math.ceil((runLength + 5) * 1.15)
    const gcRolls = panelQty <= 0 ? 0 : Math.max(1, Math.ceil(rawGcLen / 30))
    items.push({
      id: `boq-g2-${now}`,
      description: wireInfo.groundWire,
      quantity: gcRolls,
      rate: prices.GroundWire || 1300,
      unit: 'ROLL'
    })

    items.push({
      id: `boq-g3-${now}`,
      description: `Ground Rod w/ Clamp 3 Meters`,
      quantity: 1,
      rate: prices.GroundRod || 1500,
      unit: 'PC'
    })

    // 23. Labor and Installation
    let laborRate = 50000
    if (systemKw >= 16) {
      laborRate = 120000
    } else if (systemKw >= 8) {
      laborRate = 55000
    }
    items.push({
      id: `boq-23-${now}`,
      description: `Labor and Installation`,
      quantity: 1,
      rate: laborRate,
      unit: 'LOT'
    })

    // Calculate current local date string (YYYY-MM-DD)
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const currentDateStr = `${yyyy}-${mm}-${dd}`

    setInvoice((prev) => ({
      ...prev,
      lineItems: items,
      subject: `${systemKw}kW Hybrid System with Battery`,
      issueDate: currentDateStr
    }))
  }

  // Keep document title synced at all times with the client name and quotation number
  useEffect(() => {
    if (!loaded) return
    const client = invoice.toName ? invoice.toName.trim() : 'Client'
    const quotationNumber = invoice.invoiceNumber ? invoice.invoiceNumber.trim() : ''
    const parts = [client, quotationNumber].filter(Boolean)
    document.title = parts.length > 0 ? parts.join(' - ') : 'Quotation'
  }, [loaded, invoice.toName, invoice.invoiceNumber])

  useEffect(() => {
    if (!loaded || !autoPrint.current) return
    const timer = setTimeout(() => {
      const client = invoice.toName ? invoice.toName.trim() : 'Client'
      const quotationNumber = invoice.invoiceNumber ? invoice.invoiceNumber.trim() : ''
      const parts = [client, quotationNumber].filter(Boolean)
      const title = parts.length > 0 ? parts.join(' - ') : 'Quotation'
      document.title = title
      const titleEl = document.querySelector('title')
      if (titleEl) {
        titleEl.innerText = title
      }
      window.print()
    }, 450)
    return () => clearTimeout(timer)
  }, [loaded, invoice.toName, invoice.invoiceNumber])

  const handleDownload = () => {
    const client = invoice.toName ? invoice.toName.trim() : 'Client'
    const quotationNumber = invoice.invoiceNumber ? invoice.invoiceNumber.trim() : ''
    const parts = [client, quotationNumber].filter(Boolean)
    const title = parts.length > 0 ? parts.join(' - ') : 'Quotation'
    document.title = title
    const titleEl = document.querySelector('title')
    if (titleEl) {
      titleEl.innerText = title
    }
    setTimeout(() => {
      window.print()
    }, 150)
  }

  const handleSalesPersonChange = (val: string) => {
    const person = SALESPEOPLE.find((p) => p.id === val)
    if (person) {
      update('salesPerson', val)
      if (val !== 'custom') {
        update('salesName', person.name)
        update('salesPosition', person.position)
        update('salesCompany', person.company)
        update('salesContact', person.contact)
        update('salesEmail', person.email)
      }
    }
  }

  return (
    <div className={cn("flex flex-col h-dvh overflow-hidden bg-background text-foreground print:bg-white print:block print:h-auto print:overflow-visible", `theme-${invoice.theme || 'light'}`)}>
      {/* Mobile Header */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0 print:hidden gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[15px] text-foreground tracking-tight shrink-0">MG Invoice</span>
          {THEME_CHARACTERS[invoice.theme] && (
            <span className="text-sm animate-bounce" style={{ animationDuration: '2.5s' }}>
              {THEME_CHARACTERS[invoice.theme]}
            </span>
          )}
          <select
            value={invoice.theme || 'light'}
            onChange={(e) => update('theme', e.target.value as any)}
            className="text-[10px] font-bold bg-secondary border border-border text-foreground rounded-[6px] px-1.5 py-0.5 outline-none cursor-pointer transition-all select-none"
          >
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
            <option value="barbie">💖 Barbie</option>
            <option value="spiderman">🕷️ Spidey</option>
            <option value="minion">🍌 Minion</option>
            <option value="violet">🔮 Violet</option>
          </select>
        </div>
        
        {/* Toggle */}
        <div className="flex bg-secondary p-0.5 rounded-[8px] border border-border gap-0.5 shrink-0">
          <button
            onClick={() => setActiveView('edit')}
            className={cn(
              "px-2.5 py-1.5 rounded-[6px] text-[10px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer select-none",
              activeView === 'edit'
                ? "bg-[#111111] text-white shadow-sm"
                : "text-[#555555] hover:text-[#111111]"
            )}
          >
            Edit
          </button>
          <button
            onClick={() => setActiveView('preview')}
            className={cn(
              "px-2.5 py-1.5 rounded-[6px] text-[10px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer select-none",
              activeView === 'preview'
                ? "bg-[#111111] text-white shadow-sm"
                : "text-[#555555] hover:text-[#111111]"
            )}
          >
            Preview ({totalPages})
          </button>
        </div>

        {/* PDF Download */}
        <Button
          onClick={handleDownload}
          size="sm"
          className="h-8 px-2.5 rounded-[6px] text-[10px] sm:text-xs font-semibold gap-1 cursor-pointer flex items-center shrink-0"
        >
          <Download size={12} strokeWidth={2.5} />
          PDF
        </Button>
      </div>

      {/* Main Workspace Container */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ── SIDEBAR ── */}
        <aside className={cn("w-full flex-1 lg:h-full lg:w-[450px] min-h-0 bg-card text-card-foreground border-b lg:border-b-0 lg:border-r border-border flex flex-col lg:flex-row shrink-0 print:hidden", activeView === 'edit' ? 'flex' : 'hidden lg:flex')}>
          {/* Tab strip (Horizontal on mobile/tablet, Vertical on desktop) */}
          <div className="w-full lg:w-[76px] h-auto lg:h-full bg-background border-b lg:border-b-0 lg:border-r border-border flex flex-row lg:flex-col items-center justify-between lg:justify-start px-4 py-3 lg:px-0 lg:py-6 gap-2 lg:gap-5 overflow-x-auto lg:overflow-x-visible shrink-0 scrollbar-none">
            {[
              { id: 'ocr', label: 'kW Set Up', icon: Sparkles, title: 'Upload & Spec OCR' },
              { id: 'sender', label: 'Sender', icon: Building, title: 'Sender & Sales Contact' },
              { id: 'client', label: 'Client', icon: Users, title: 'Client (To)' },
              { id: 'invoice', label: 'Details', icon: FileText, title: 'Invoice Details' },
              { id: 'items', label: 'Items', icon: List, title: 'Line Items' },
              { id: 'payment', label: 'Bank', icon: CreditCard, title: 'Payment details' },
              { id: 'notes', label: 'Terms', icon: StickyNote, title: 'Terms & Closing' },
              { id: 'supply', label: 'Supply', icon: Package, title: 'Supplied Items Filter' },
              { id: 'checklist', label: 'Checklist', icon: ClipboardCheck, title: 'Itemized Packing & Dispatch Checklist' },
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSwitch(tab.id)}
                  className={cn(
                    "relative w-12 h-12 lg:w-14 lg:h-14 rounded-[12px] flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer select-none shrink-0",
                    active
                      ? "bg-card text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-border font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                  title={tab.title}
                >
                  <Icon size={15} className="lg:w-4 lg:h-4" />
                  <span className="text-[8px] lg:text-[9px] leading-none tracking-tight">{tab.label}</span>
                  {active && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-0 lg:top-1/2 lg:-translate-y-1/2 w-6 lg:w-[3px] h-[3px] lg:h-6 bg-primary rounded-t-[3px] lg:rounded-t-none lg:rounded-r-[3px]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Right form layout */}
          <div className="flex-1 flex flex-col min-h-0 lg:h-full min-w-0">
            {/* Logo & Theme Picker (Desktop only) */}
            <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[17px] text-foreground tracking-tight">MG Invoice</span>
                {THEME_CHARACTERS[invoice.theme] && (
                  <span className="text-lg animate-bounce" style={{ animationDuration: '2.5s' }}>
                    {THEME_CHARACTERS[invoice.theme]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Theme</span>
                <select
                  value={invoice.theme || 'light'}
                  onChange={(e) => update('theme', e.target.value as any)}
                  className="text-[11px] font-bold bg-secondary border border-border text-foreground rounded-[6px] px-2 py-1 outline-none cursor-pointer hover:bg-secondary/85 transition-all select-none"
                >
                  <option value="light">☀️ Light</option>
                  <option value="dark">🌙 Dark</option>
                  <option value="barbie">💖 Barbie</option>
                  <option value="spiderman">🕷️ Spidey</option>
                  <option value="minion">🍌 Minion</option>
                  <option value="violet">🔮 Violet</option>
                </select>
              </div>
            </div>

          {/* Scrollable active tab form content */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-7 min-h-0">
            {activeTab === 'ocr' && (
              <section className="bg-[#111111] p-4 rounded-[16px] relative overflow-hidden">
                {ocrLoading && (
                  <div className="absolute inset-0 bg-white/95 rounded-[16px] flex flex-col justify-center items-center p-6 text-center z-10 animate-in fade-in duration-200">
                    <div className="w-10 h-10 border-4 border-[#E5E5E5] border-t-[#111111] rounded-full animate-spin mb-4" />
                    <p className="text-[11px] font-mono text-[#111111] leading-relaxed">
                      <strong>Systemic Precision:</strong> &quot;Initializing local cryptographic text parsing engine... Processing layer variables cleanly inside your browser context. Sensitive document data never leaves your secure node.&quot;
                    </p>
                    <div className="w-full bg-[#E5E5E5] h-3 rounded-[16px] overflow-hidden mt-4 border border-[#E5E5E5] relative">
                      <div 
                        className="bg-[#111111] h-full transition-all duration-300"
                        style={{ 
                          width: `${ocrProgress}%`,
                          clipPath: 'polygon(0% 0%, 100% 0%, 98% 100%, 0% 100%)'
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#111111] mt-2 font-bold">{ocrProgress}%</span>
                  </div>
                )}

                <div 
                  className={cn(
                    "border border-dashed rounded-[14px] p-3 text-center transition-all bg-[#FFFFFF] dark:bg-[#1A1A1A] flex flex-col items-center justify-center gap-2",
                    dragActive ? "border-[#111111] dark:border-white bg-[#F5F5F5] dark:bg-[#222222]" : "border-[#CCCCCC] dark:border-[#444444]"
                  )}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 text-xs font-bold border border-gray-300 dark:border-gray-700 text-foreground bg-secondary/80 hover:bg-primary hover:text-primary-foreground rounded-[10px] shadow-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    UPLOAD TECHNICAL SPEC SHEET
                  </Button>
                </div>

                {/* Solar BOQ System Sizing Setup */}
                <div className="mt-4 p-4 bg-card border border-border rounded-[16px] text-left">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                      Solar BOQ Sizing Setup
                    </h4>
                    <div className="flex gap-1.5 bg-secondary p-1 rounded-[10px] border border-border">
                      <button
                        type="button"
                        onClick={() => handleSystemTypeChange('hybrid')}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-bold rounded-[8px] transition-all cursor-pointer select-none",
                          systemType === 'hybrid'
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        ⚡ Hybrid
                      </button>
                      <button
                        type="button"
                        disabled={!ON_GRID_BRANDS.some(b => b.getPrice(activeKwSetup) !== null)}
                        onClick={() => handleSystemTypeChange('ongrid')}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-bold rounded-[8px] transition-all select-none",
                          !ON_GRID_BRANDS.some(b => b.getPrice(activeKwSetup) !== null)
                            ? "opacity-40 cursor-not-allowed pointer-events-none text-muted-foreground"
                            : systemType === 'ongrid'
                              ? "bg-primary text-primary-foreground shadow-sm cursor-pointer"
                              : "text-muted-foreground hover:text-foreground cursor-pointer"
                        )}
                        title={
                          !ON_GRID_BRANDS.some(b => b.getPrice(activeKwSetup) !== null)
                            ? `On-Grid is not available for ${activeKwSetup}kW setup`
                            : undefined
                        }
                      >
                        🌐 On-Grid
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                    Generate a complete BOQ ({systemType === 'ongrid' ? 'On-Grid' : 'Hybrid'}) according to system capacity sizing rules.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[1.5, 3, 4, 5, 6, 8, 10, 12, 16, 20].map((kw) => {
                      const hasOnGridOption = ON_GRID_BRANDS.some(b => b.getPrice(kw) !== null)
                      const isDisabled = systemType === 'ongrid' && !hasOnGridOption

                      const maxPanels = Math.round((kw * 1000) / PANEL_WATTAGE)
                      let calculatedPanelQty = maxPanels
                      if (activePreset === 'min') {
                        calculatedPanelQty = Math.max(4, Math.round(maxPanels * 0.5))
                      } else if (activePreset === 'balance') {
                        calculatedPanelQty = Math.max(4, Math.round(maxPanels * 0.75))
                      }
                      
                      const calculatedRows = calculatedPanelQty <= 6 ? 1 : 2
                      let laborCost = 50000
                      if (kw >= 16) laborCost = 120000
                      else if (kw >= 8) laborCost = 55000
                      
                      const panelDesc = `${calculatedPanelQty} Panels (${calculatedRows} Row${calculatedRows > 1 ? 's' : ''})`
                      const laborDesc = `Labor: ₱${(laborCost / 1000)}k`

                      const isSelected = activeKwSetup === kw
                      const panelDescColor = isSelected ? "text-primary-foreground/75" : "text-muted-foreground"
                      const laborDescColor = isSelected ? "text-primary-foreground/95" : "text-[#2E7D32]"

                      return (
                        <button
                          key={kw}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return
                            setActiveKwSetup(kw)
                            handleGenerateBoq(kw, activePreset)
                          }}
                          title={isDisabled ? `Not available in On-Grid database` : undefined}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-[12px] border transition-all select-none font-semibold",
                            isDisabled
                              ? "opacity-35 bg-secondary/20 border-border text-muted-foreground cursor-not-allowed pointer-events-none line-through"
                              : isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                : "bg-secondary/50 hover:bg-secondary/80 border-border text-foreground cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                          )}
                        >
                          <span className="font-bold text-xs">{kw}kW Setup</span>
                          <span className={cn("text-[8px] mt-1 font-mono font-normal", panelDescColor)}>{panelDesc}</span>
                          <span className={cn("text-[8px] mt-0.5 font-mono font-bold", laborDescColor)}>{laborDesc}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="border-t border-border pt-3 mt-3">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Apply by Custom kW Setup {systemType === 'ongrid' && "(Disabled for On-Grid)"}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={systemType === 'ongrid'}
                        value={customKwInput}
                        onChange={(e) => setCustomKwInput(e.target.value)}
                        placeholder={systemType === 'ongrid' ? "Disabled for On-Grid" : "e.g. 7.5"}
                        className={cn(
                          "bg-secondary/50 border-border text-foreground font-medium h-9 rounded-[10px] text-xs focus:ring-1 focus:ring-primary focus:border-primary flex-1",
                          systemType === 'ongrid' && "opacity-50 cursor-not-allowed bg-secondary/30"
                        )}
                      />
                      <Button
                        onClick={() => {
                          const val = parseFloat(customKwInput)
                          if (!isNaN(val) && val > 0) {
                            setActiveKwSetup(val)
                            handleGenerateBoq(val, activePreset)
                          }
                        }}
                        disabled={systemType === 'ongrid' || !customKwInput || parseFloat(customKwInput) <= 0}
                        variant="default"
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[10px] h-9 text-[10px] px-3 shrink-0 disabled:opacity-40"
                      >
                        APPLY
                      </Button>
                    </div>

                    <div className="flex gap-2 mt-3 w-full">
                      <Button
                        variant={activePreset === 'min' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleApplyPreset('min')}
                        className={cn(
                          "text-[10px] font-bold py-1.5 px-2 rounded-[10px] transition-all h-8 flex-1 border border-border",
                          activePreset === 'min'
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-transparent text-foreground hover:bg-secondary shadow-none"
                        )}
                      >
                        Min Panels
                      </Button>
                      <Button
                        variant={activePreset === 'balance' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleApplyPreset('balance')}
                        className={cn(
                          "text-[10px] font-bold py-1.5 px-2 rounded-[10px] transition-all h-8 flex-1 border border-border",
                          activePreset === 'balance'
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-transparent text-foreground hover:bg-secondary shadow-none"
                        )}
                      >
                        Balance Setup
                      </Button>
                      <Button
                        variant={activePreset === 'max' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleApplyPreset('max')}
                        className={cn(
                          "text-[10px] font-bold py-1.5 px-2 rounded-[10px] transition-all h-8 flex-1 border border-border",
                          activePreset === 'max'
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-transparent text-foreground hover:bg-secondary shadow-none"
                        )}
                      >
                        Max Panels
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Floor Chooser */}
                <div className="mt-4 p-4 bg-card border border-border rounded-[16px] text-left">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                      🏢 Floor Selection
                    </h4>
                    {selectedFloor && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-[12px] font-bold border border-emerald-500/20">
                        Auto-Synced
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 select-none">
                    {[1, 2, 3, 4].map((floorNum) => {
                      const isSelected = selectedFloor === floorNum;
                      const meters = getFloorMeters(floorNum);
                      return (
                        <button
                          key={floorNum}
                          onClick={() => handleSelectFloor(floorNum)}
                          className={cn(
                            "h-10 rounded-[8px] flex flex-col items-center justify-center transition-all relative border cursor-pointer select-none py-1",
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02] z-10" 
                              : "bg-secondary/50 hover:bg-secondary text-muted-foreground border-border"
                          )}
                        >
                          <span className="text-[11px] font-bold leading-none mb-0.5">F{floorNum}</span>
                          <span className="text-[9px] opacity-80 leading-none">{meters}m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Electric Bill vs Recommended System Size Reference Table */}
                <div className="mt-4 p-4 bg-card border border-border rounded-[16px] text-left">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span>💡</span> Electric Bill & Sizing Reference
                    </h4>
                    <span className="text-[9px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-[8px] border border-border">
                      Quick Guide
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                    Reference recommended system capacity (kW) based on monthly electric bill.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ELECTRIC_BILL_PRICE_REFERENCES.map((ref, idx) => {
                      const hasOnGridOption = ON_GRID_BRANDS.some(b => b.getPrice(ref.kw) !== null)
                      const isDisabled = systemType === 'ongrid' && !hasOnGridOption
                      const isSelected = activeKwSetup === ref.kw

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return
                            setActiveKwSetup(ref.kw)
                            handleGenerateBoq(ref.kw, activePreset)
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 text-xs rounded-[10px] border transition-all select-none text-left cursor-pointer",
                            isDisabled
                              ? "opacity-35 bg-secondary/20 border-border cursor-not-allowed pointer-events-none line-through text-muted-foreground"
                              : isSelected
                                ? "bg-primary/10 border-primary font-bold text-primary shadow-xs scale-[1.01]"
                                : "bg-background hover:bg-secondary/60 border-border text-foreground"
                          )}
                          title={isDisabled ? "Not available in On-Grid database" : `Click to apply ${ref.kw}kW Setup`}
                        >
                          <span className="font-mono text-[11px] font-semibold">{ref.bill}</span>
                          <span className={cn(
                            "font-mono text-[11px] font-bold px-2 py-0.5 rounded-[6px] border transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary/80 text-foreground border-border/60"
                          )}>
                            {ref.kw} kW
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Cascading Selection Fields (only rendered once parsed) */}
                {specData.brand && (
                  <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[12px] p-4 text-[#111111] space-y-3 mt-3 animate-in fade-in duration-300">
                    <h4 className="text-[10px] font-bold text-[#111111] uppercase tracking-wider">Parsed Configuration</h4>
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="flex flex-col gap-0.5 bg-[#F9F9F9] p-2 rounded-[12px] border border-[#E5E5E5]">
                        <span className="text-[8px] text-[#888888] font-mono font-semibold">BRAND</span>
                        <span className="font-semibold text-[#111111] truncate">{specData.brand}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 bg-[#F9F9F9] p-2 rounded-[12px] border border-[#E5E5E5]">
                        <span className="text-[8px] text-[#888888] font-mono font-semibold">FORM FACTOR</span>
                        <span className="font-semibold text-[#111111] truncate">{specData.formFactor}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 bg-[#F9F9F9] p-2 rounded-[12px] border border-[#E5E5E5]">
                        <span className="text-[8px] text-[#888888] font-mono font-semibold">COOLING CAPACITY</span>
                        <span className="font-semibold text-[#111111] truncate">{specData.coolingCapacity}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 bg-[#F9F9F9] p-2 rounded-[12px] border border-[#E5E5E5]">
                        <span className="text-[8px] text-[#888888] font-mono font-semibold">BREAKER STATUS</span>
                        <span className="font-semibold text-[#111111] truncate">{specData.breakerStatus}</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'sender' && (
              <>
                {/* FROM */}
                <section className="space-y-3">
                  <SectionHeader>From</SectionHeader>
                  <div className="space-y-2" onMouseEnter={() => setHoveredField('fromName')} onMouseLeave={() => setHoveredField(null)}>
                    <Field label="Company name">
                      <Input
                        value={invoice.fromName}
                        onChange={(e) => update('fromName', e.target.value)}
                        placeholder="Acme Studio"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={invoice.fromEmail}
                        onChange={(e) => update('fromEmail', e.target.value)}
                        placeholder="hello@acmestudio.com"
                      />
                    </Field>
                    <Field label="Address">
                      <Textarea
                        value={invoice.fromAddress}
                        onChange={(e) => update('fromAddress', e.target.value)}
                        placeholder="123 Design Ave, San Francisco"
                        rows={2}
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        type="tel"
                        value={invoice.fromPhone}
                        onChange={(e) => update('fromPhone', e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </Field>
                  </div>
                </section>

                {/* SALES CONTACT */}
                <section className="space-y-3">
                  <SectionHeader>Sales Contact</SectionHeader>
                  <div className="space-y-2" onMouseEnter={() => setHoveredField('salesName')} onMouseLeave={() => setHoveredField(null)}>
                    <Field 
                      label="Salesperson"
                      className="p-3 bg-primary/5 rounded-[12px] border border-primary/30 shadow-sm transition-all duration-300 hover:border-primary/50 relative"
                    >
                      <Select value={invoice.salesPerson || 'custom'} onValueChange={handleSalesPersonChange}>
                        <SelectTrigger className="border-primary/30 bg-background/50 hover:bg-background transition-all font-medium">
                          <SelectValue placeholder="Select Salesperson" />
                        </SelectTrigger>
                        <SelectContent>
                          {SALESPEOPLE.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="absolute -top-2 right-3 px-1.5 py-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded uppercase tracking-wider whitespace-nowrap shadow-sm">
                        Select Rep
                      </span>
                    </Field>
                    <Field label="Sales Name">
                      <Input
                        value={invoice.salesName || ''}
                        onChange={(e) => {
                          update('salesName', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="Salesperson Name"
                      />
                    </Field>
                    <Field label="Position">
                      <Input
                        value={invoice.salesPosition || ''}
                        onChange={(e) => {
                          update('salesPosition', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="Sales & Marketing Executive"
                      />
                    </Field>
                    <Field label="Company Name">
                      <Input
                        value={invoice.salesCompany || ''}
                        onChange={(e) => {
                          update('salesCompany', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="M&G Non-Specialized Wholesale Trading"
                      />
                    </Field>
                    <Field label="Contact Number">
                      <Input
                        type="tel"
                        value={invoice.salesContact || ''}
                        onChange={(e) => {
                          update('salesContact', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="+(63) 9XX XXXX XXX"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={invoice.salesEmail || ''}
                        onChange={(e) => {
                          update('salesEmail', e.target.value)
                          if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                        }}
                        placeholder="email@mgtrading.com"
                      />
                    </Field>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'client' && (
              <section className="space-y-3">
                <SectionHeader>Bill To</SectionHeader>
                <div className="space-y-2" onMouseEnter={() => setHoveredField('toName')} onMouseLeave={() => setHoveredField(null)}>
                  <Field label="Client name">
                    <Input
                      value={invoice.toName}
                      onChange={(e) => update('toName', e.target.value)}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={invoice.toEmail}
                      onChange={(e) => update('toEmail', e.target.value)}
                    />
                  </Field>
                  <Field label="Address">
                    <Textarea
                      value={invoice.toAddress}
                      onChange={(e) => update('toAddress', e.target.value)}
                      rows={2}
                    />
                  </Field>
                </div>
              </section>
            )}

            {activeTab === 'payment' && (
              <section className="space-y-3">
                <SectionHeader>Bank Details</SectionHeader>
                <div className="space-y-2" onMouseEnter={() => setHoveredField('bankBeneficiary')} onMouseLeave={() => setHoveredField(null)}>
                  <Field label="Beneficiary">
                    <Input
                      value={invoice.bankBeneficiary}
                      onChange={(e) => update('bankBeneficiary', e.target.value)}
                      placeholder="Acme Studio Ltd."
                    />
                  </Field>
                  <Field label="Bank name">
                    <Input
                      value={invoice.bankName}
                      onChange={(e) => update('bankName', e.target.value)}
                      placeholder="First National Bank"
                    />
                  </Field>
                  <Field label="Sort Code / Routing">
                    <Input
                      value={invoice.bankSortCode}
                      onChange={(e) => update('bankSortCode', e.target.value)}
                      placeholder="20-00-00"
                    />
                  </Field>
                  <Field label="Account number / IBAN">
                    <Input
                      value={invoice.bankAccount}
                      onChange={(e) => update('bankAccount', e.target.value)}
                      placeholder="GB29 NWBK 6016 1331 9268 19"
                    />
                  </Field>
                  <Field label="SWIFT / BIC">
                    <Input
                      value={invoice.bankSwift}
                      onChange={(e) => update('bankSwift', e.target.value)}
                      placeholder="NWBKGB2L"
                    />
                  </Field>
                </div>
              </section>
            )}

            {activeTab === 'invoice' && (
              <>
                {/* INVOICE DETAILS */}
                <section className="space-y-3">
                  <SectionHeader>Invoice Details</SectionHeader>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Invoice #" onMouseEnter={() => setHoveredField('invoiceNumber')} onMouseLeave={() => setHoveredField(null)}>
                        <Input
                          className="font-mono text-xs"
                          value={invoice.invoiceNumber}
                          onChange={(e) => update('invoiceNumber', e.target.value)}
                          placeholder="INV-0001"
                        />
                        <div className="flex gap-1 mt-1 justify-end">
                          <span className="text-[9px] text-[#888888] mr-auto self-center select-none font-mono">Generate:</span>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => update('invoiceNumber', generateDocumentId('MG-INV'))}
                            className="h-5 px-1.5 text-[9px] font-mono"
                            title="Generate Invoice ID"
                          >
                            +INV
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => update('invoiceNumber', generateDocumentId('MG-QT'))}
                            className="h-5 px-1.5 text-[9px] font-mono"
                            title="Generate Quotation ID"
                          >
                            +QT
                          </Button>
                        </div>
                      </Field>
                      <Field label="Issue Date" onMouseEnter={() => setHoveredField('issueDate')} onMouseLeave={() => setHoveredField(null)}>
                        <DatePicker
                          value={invoice.issueDate}
                          onChange={(v) => update('issueDate', v)}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Validity" onMouseEnter={() => setHoveredField('dueDate')} onMouseLeave={() => setHoveredField(null)}>
                        <DatePicker
                          value={invoice.dueDate}
                          onChange={(v) => update('dueDate', v)}
                          placeholder="No validity date"
                        />
                      </Field>
                      <Field label="Currency">
                        <Select value={invoice.currency} onValueChange={(v) => update('currency', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label="VAT %" onMouseEnter={() => setHoveredField('vatRate')} onMouseLeave={() => setHoveredField(null)}>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={invoice.vatRate || ''}
                        onChange={(e) => update('vatRate', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Subject" onMouseEnter={() => setHoveredField('subject')} onMouseLeave={() => setHoveredField(null)}>
                      <Input
                        value={invoice.subject || ''}
                        onChange={(e) => update('subject', e.target.value)}
                        placeholder="Supply & Deliver Safety Hats"
                      />
                    </Field>
                  </div>
                </section>

                {/* SALUTATION */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('salutation')} onMouseLeave={() => setHoveredField(null)}>
                  <SectionHeader>Salutation / Intro</SectionHeader>
                  <Textarea
                    value={invoice.salutation || ''}
                    onChange={(e) => update('salutation', e.target.value)}
                    placeholder="Dear Madam/Sir, We are pleased to submit..."
                    rows={3}
                  />
                </section>
              </>
            )}

            {activeTab === 'items' && (
              <section className="space-y-3">
                <SectionHeader>Line Items</SectionHeader>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Rate Adjustment %" onMouseEnter={() => setHoveredField('rateMarkup')} onMouseLeave={() => setHoveredField(null)}>
                    <Input
                      type="number"
                      min="-100"
                      max="1000"
                      value={invoice.rateMarkup || ''}
                      onChange={(e) => update('rateMarkup', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Labor Adjustment" onMouseEnter={() => setHoveredField('rateMarkup')} onMouseLeave={() => setHoveredField(null)}>
                    <Button
                      type="button"
                      variant={invoice.excludeLaborMarkup ? "outline" : "default"}
                      onClick={() => update('excludeLaborMarkup', !invoice.excludeLaborMarkup)}
                      className={cn(
                        "w-full h-9 text-[9px] font-bold rounded-[8px] transition-all cursor-pointer select-none tracking-wider",
                        invoice.excludeLaborMarkup
                          ? "bg-[#FAFAFA] border-[#E5E5E5] text-[#888888] hover:bg-[#EBEBEB]"
                          : "bg-[#111111] text-white hover:bg-black/90"
                      )}
                      title={invoice.excludeLaborMarkup ? "Labor & Installation is excluded from rate markup" : "Labor & Installation is included in rate markup"}
                    >
                      {invoice.excludeLaborMarkup ? "EXCLUDE LABOR" : "INCLUDE LABOR"}
                    </Button>
                  </Field>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-[#E5E5E5] mt-1 gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-[#888888] tracking-wider uppercase">
                    Quick Actions
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant={invoice.isCondensed ? "default" : "outline"}
                      size="sm"
                      onClick={() => update('isCondensed', !invoice.isCondensed)}
                      className={cn(
                        "h-7 text-[9px] font-extrabold rounded-[6px] cursor-pointer transition-all select-none px-2 flex items-center gap-1",
                        invoice.isCondensed
                          ? "bg-black text-white hover:bg-black/90 border-black"
                          : "text-[#555555] hover:text-[#111111] hover:bg-[#EBEBEB] border-[#E5E5E5]"
                      )}
                      title={invoice.isCondensed ? "Currently in Condensed mode. Click to switch to Comprehensive itemized view." : "Currently in Comprehensive mode. Click to switch to Condensed breakdown (Solar Panels, Inverter, Battery, Materials, Electrical, Services)."}
                    >
                      {invoice.isCondensed ? "📦 [Condensed]" : "📋 [Comprehensive]"}
                    </Button>

                    {systemType === 'hybrid' && (
                      <Button
                        type="button"
                        variant={invoice.excludeBattery ? "default" : "outline"}
                        size="sm"
                        onClick={handleToggleBatteryExclusion}
                        className={cn(
                          "h-7 text-[9px] font-extrabold rounded-[6px] cursor-pointer transition-all select-none px-2",
                          invoice.excludeBattery
                            ? "bg-black text-white hover:bg-black/90 border-black"
                            : "text-[#555555] hover:text-[#111111] hover:bg-[#EBEBEB] border-[#E5E5E5]"
                        )}
                        title={invoice.excludeBattery ? "Include battery items in the invoice again" : "Temporarily exclude battery items from the invoice"}
                      >
                        {invoice.excludeBattery ? "➕ INCLUDE BATTERY" : "➖ EXCLUDE BATTERY"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  {/* Column headers */}
                  <div className="flex gap-2 px-1">
                    <span className="flex-1 text-[11px] font-medium text-[#888888]">Description</span>
                    <span className="w-12 text-[11px] font-medium text-[#888888] text-center">Unit</span>
                    <span className="w-10 text-[11px] font-medium text-[#888888] text-center">Qty</span>
                    <span className="w-[72px] text-[11px] font-medium text-[#888888] text-right" title={invoice.rateMarkup ? `Markup of ${invoice.rateMarkup}% is active` : undefined}>
                      Rate{invoice.rateMarkup ? ` (${invoice.rateMarkup > 0 ? '+' : ''}${invoice.rateMarkup}%)` : ''}
                    </span>
                    <span className="w-5" />
                  </div>

                  {/* Item rows */}
                  {invoice.lineItems
                    .filter((item) => {
                      const descLower = item.description.toLowerCase()
                      const isBatteryRelated = descLower.includes('battery') || descLower.includes('dyness') || descLower.includes('genix') || descLower.includes('cesc') || descLower.includes('314ah') || descLower.includes('200ah') || descLower.includes('100ah') || descLower.includes('102.4v')
                      return !(invoice.excludeBattery && isBatteryRelated)
                    })
                    .map((item) => {
                      const descLower = item.description.toLowerCase()
                      const isPanelItem = descLower.includes('panel') || descLower.includes('module') || descLower.includes('ja solar') || descLower.includes('tongwei') || descLower.includes('runergy') || descLower.includes('jinko') || descLower.includes('gokin') || descLower.includes('longi') || descLower.includes('ian solar')
                      const isTongweiSelected = item.rate === 4960

                      const isInverterItem = descLower.includes('inverter') || descLower.includes('anern') || descLower.includes('solis') || descLower.includes('goodwe') || descLower.includes('hypontech') || descLower.includes('solax') || descLower.includes('foxess') || descLower.includes('sunways')
                      const kwMatch = item.description.match(/(\d+(?:\.\d+)?)\s*kw/i)
                      const itemKw = kwMatch ? parseFloat(kwMatch[1]) : 12
                      const invBrandPrices = getInverterBrandPrices(itemKw)

                      const isItemOnGrid = descLower.includes('on-grid') || systemType === 'ongrid'

                      const isInverterAnern = item.rate === invBrandPrices.anern
                      const isInverterGoodWe = item.rate === invBrandPrices.goodwe
                      const isInverterSolis = item.rate === invBrandPrices.solis || (!isInverterAnern && !isInverterGoodWe)

                      const isBatteryAccessory = descLower.includes('mccb') || descLower.includes('cable') || descLower.includes('breaker')
                      const isBatteryItem = !isBatteryAccessory && (descLower.includes('battery') || descLower.includes('dyness') || descLower.includes('genix') || descLower.includes('cesc') || descLower.includes('314ah') || descLower.includes('200ah') || descLower.includes('100ah') || descLower.includes('102.4v'))

                      let genixPrice = 85000
                      if (descLower.includes('200ah')) {
                        genixPrice = 65000
                      } else if (descLower.includes('102.4v') || descLower.includes('100ah')) {
                        genixPrice = 90000
                      }

                      let dynessPrice = 43000
                      if (descLower.includes('314ah')) {
                        dynessPrice = 88000
                      }

                      let cescPrice = 88000
                      if (descLower.includes('261') || descLower.includes('power')) {
                        cescPrice = 2400000
                      }

                      const isGenixSelected = item.rate === genixPrice
                      const isDynessSelected = item.rate === dynessPrice
                      const isCescSelected = item.rate === cescPrice || (!isGenixSelected && !isDynessSelected)

                      return (
                        <div key={item.id} className="flex flex-col gap-1 p-1.5 rounded-lg hover:bg-[#F9F9F9] dark:hover:bg-[#1A1A1A] transition-colors border border-transparent hover:border-[#E5E5E5] dark:hover:border-[#333333]" onMouseEnter={() => setHoveredField(item.id)} onMouseLeave={() => setHoveredField(null)}>
                          <div className="flex gap-2 items-start">
                            <Input
                              className="flex-1"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Item description"
                            />
                            <Input
                              className="w-12 px-1 text-center"
                              value={item.unit || ''}
                              onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                              placeholder="pcs"
                            />
                            <Input
                              className="w-10 px-0 text-center"
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                            <div className="flex flex-col items-end w-[72px] shrink-0">
                              <Input
                                className="w-full px-2 text-right"
                                type="number"
                                min="0"
                                value={item.rate}
                                onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                              />
                              {invoice.rateMarkup !== 0 && (
                                <span className="text-[9px] font-mono text-[#888888] text-right mt-0.5 w-full truncate" title={
                                  (invoice.excludeLaborMarkup && item.description.toLowerCase().trim() === 'labor and installation')
                                    ? 'Labor is excluded from rate markup'
                                    : `Base: ${item.rate} + ${invoice.rateMarkup}%`
                                }>
                                  {formatCurrency(
                                    (invoice.excludeLaborMarkup && item.description.toLowerCase().trim() === 'labor and installation')
                                      ? item.rate
                                      : item.rate * (1 + invoice.rateMarkup / 100),
                                    invoice.currency
                                  )}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => removeItem(item.id)}
                              className="text-[#CCCCCC] hover:text-[#888888] hover:bg-transparent shrink-0 mt-[4px]"
                              aria-label="Remove item"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>

                          {isPanelItem && (() => {
                            const wattMatch = item.description.match(/(\d{3})\s*w/i)
                            const currentWattage = wattMatch ? `${wattMatch[1]}W` : null

                            const storedBrand = selectedPanelBrands[item.id]
                            let activeBrandId = storedBrand

                            if (!activeBrandId || !SOLAR_PANEL_BRANDS.some(b => b.id === activeBrandId)) {
                              if (descLower.includes('gokin')) {
                                activeBrandId = 'gokin'
                              } else if (descLower.includes('ian')) {
                                activeBrandId = 'ian'
                              } else if (descLower.includes('runergy')) {
                                activeBrandId = 'runergy'
                              } else if (descLower.includes('jinko')) {
                                activeBrandId = 'jinko'
                              } else if (descLower.includes('longi')) {
                                activeBrandId = 'longi'
                              } else if (descLower.includes('tongwei')) {
                                activeBrandId = 'tongwei'
                              } else if (descLower.includes('ja')) {
                                activeBrandId = 'ja'
                              } else if (item.rate === 7700) {
                                activeBrandId = 'jinko'
                              } else if (item.rate === 6500) {
                                activeBrandId = 'longi'
                              } else if ([4960, 5000, 5544, 6336, 6380, 6424].includes(item.rate)) {
                                activeBrandId = 'tongwei'
                              } else if ([6400, 6300, 6900].includes(item.rate)) {
                                activeBrandId = 'ja'
                              } else {
                                activeBrandId = 'ja'
                              }
                            }

                            const activeBrandObj = SOLAR_PANEL_BRANDS.find(b => b.id === activeBrandId) || SOLAR_PANEL_BRANDS[1]

                            let activeWattage = currentWattage
                            if (!activeWattage) {
                              const matchedOpt = activeBrandObj.options.find(o => o.rate === item.rate)
                              activeWattage = matchedOpt ? matchedOpt.wattage : activeBrandObj.options[0].wattage
                            }

                            const applyPanelSelection = (brandObj: PanelBrandOption, option: PanelOption) => {
                              setSelectedPanelBrands(prev => ({ ...prev, [item.id]: brandObj.id }))
                              const dims = getPanelDimensions(option.wattage)
                              updateItem(item.id, 'description', `Panel ${option.wattage} (${dims})`)
                              updateItem(item.id, 'rate', option.rate)
                            }

                            return (
                              <div className="flex flex-col gap-2 pt-1.5 pb-1 px-0.5 border-t border-dashed border-[#E5E5E5] dark:border-[#333333] mt-1.5">
                                {/* 1. Brand Selector Row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] uppercase font-semibold text-[#888888] mr-1">Brand:</span>
                                  {SOLAR_PANEL_BRANDS.map((b) => {
                                    const isSelected = activeBrandId === b.id
                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => {
                                          const targetOpt = b.options.find(o => o.wattage === activeWattage) || b.options[0]
                                          applyPanelSelection(b, targetOpt)
                                        }}
                                        className={cn(
                                          "flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer select-none min-h-[34px]",
                                          isSelected
                                            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/40 shadow-sm"
                                            : "bg-white dark:bg-[#222222] border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] opacity-75 hover:opacity-100"
                                        )}
                                        title={`${b.name} Solar Panels`}
                                      >
                                        {b.logo ? (
                                          <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[80px] object-contain shrink-0" />
                                        ) : (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 text-foreground">{b.name}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>

                                {/* 2. Wattage Chooser Buttons Row */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-dotted border-[#E5E5E5] dark:border-[#333333]">
                                  <span className="text-[10px] uppercase font-semibold text-[#888888] mr-1">Wattage:</span>
                                  {activeBrandObj.options.map((opt) => {
                                    const isWattageSelected = (currentWattage === opt.wattage || activeWattage === opt.wattage) && item.rate === opt.rate
                                    return (
                                      <button
                                        key={opt.wattage}
                                        type="button"
                                        onClick={() => applyPanelSelection(activeBrandObj, opt)}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          isWattageSelected
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A]"
                                        )}
                                        title={`${opt.wattage} - ₱${opt.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })} each`}
                                      >
                                        {opt.wattage}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {isInverterItem && (
                            <div className="flex flex-col gap-1.5 pt-1.5 pb-1 px-0.5 border-t border-dashed border-[#E5E5E5] dark:border-[#333333] mt-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Inverter Options ({isItemOnGrid ? 'On-Grid' : 'Hybrid'})
                                </span>
                                <div className="flex gap-1 bg-secondary/60 p-0.5 rounded-[6px] border border-border">
                                  <button
                                    type="button"
                                    disabled={!HYBRID_BRANDS.some(b => b.getPrice(itemKw) !== null)}
                                    onClick={() => {
                                      const defaultBrand = HYBRID_BRANDS.find(b => b.getPrice(itemKw) !== null)
                                      if (!defaultBrand) return
                                      const price = defaultBrand.getPrice(itemKw)!
                                      const newDesc = item.description.replace(/On-Grid/i, 'Hybrid')
                                      const finalDesc = newDesc.includes('Hybrid') ? newDesc : `${newDesc} Hybrid`
                                      updateItem(item.id, 'description', finalDesc)
                                      updateItem(item.id, 'rate', price)
                                      setSystemType('hybrid')
                                      update('excludeBattery', false)
                                    }}
                                    className={cn(
                                      "text-[8px] font-bold px-1.5 py-0.5 rounded-[4px] transition-all select-none",
                                      !HYBRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? "opacity-40 cursor-not-allowed pointer-events-none text-muted-foreground"
                                        : !isItemOnGrid
                                          ? "bg-primary text-primary-foreground shadow-xs cursor-pointer"
                                          : "text-muted-foreground hover:text-foreground cursor-pointer"
                                    )}
                                    title={
                                      !HYBRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? `Hybrid is not available for ${itemKw}kW setup`
                                        : undefined
                                    }
                                  >
                                    ⚡ Hybrid
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!ON_GRID_BRANDS.some(b => b.getPrice(itemKw) !== null)}
                                    onClick={() => {
                                      const defaultBrand = ON_GRID_BRANDS.find(b => b.getPrice(itemKw) !== null)
                                      if (!defaultBrand) return
                                      const price = defaultBrand.getPrice(itemKw)!
                                      const newDesc = item.description.replace(/Hybrid/i, 'On-Grid')
                                      const finalDesc = newDesc.includes('On-Grid') ? newDesc : `${newDesc} On-Grid`
                                      updateItem(item.id, 'description', finalDesc)
                                      updateItem(item.id, 'rate', price)
                                      setSystemType('ongrid')
                                      update('excludeBattery', true)
                                    }}
                                    className={cn(
                                      "text-[8px] font-bold px-1.5 py-0.5 rounded-[4px] transition-all select-none",
                                      !ON_GRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? "opacity-40 cursor-not-allowed pointer-events-none text-muted-foreground"
                                        : isItemOnGrid
                                          ? "bg-primary text-primary-foreground shadow-xs cursor-pointer"
                                          : "text-muted-foreground hover:text-foreground cursor-pointer"
                                    )}
                                    title={
                                      !ON_GRID_BRANDS.some(b => b.getPrice(itemKw) !== null)
                                        ? `On-Grid is not available for ${itemKw}kW setup`
                                        : undefined
                                    }
                                  >
                                    🌐 On-Grid
                                  </button>
                                </div>
                              </div>

                              {isItemOnGrid ? (
                                <div className="inline-flex gap-1.5 items-center flex-wrap">
                                  {ON_GRID_BRANDS.map((b) => {
                                    const brandPrice = b.getPrice(itemKw)
                                    const isApplicable = brandPrice !== null
                                    const isSelected = isApplicable && item.rate === brandPrice

                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        disabled={!isApplicable}
                                        onClick={() => {
                                          if (!isApplicable) return
                                          updateItem(item.id, 'rate', brandPrice)
                                          updateItem(item.id, 'description', `Inverter ${itemKw}kW On-Grid`)
                                        }}
                                        className={cn(
                                          "flex items-center justify-center p-2 rounded-lg border transition-all select-none min-h-[36px]",
                                          !isApplicable
                                            ? "opacity-30 bg-secondary/30 border-border cursor-not-allowed pointer-events-none grayscale"
                                            : isSelected
                                              ? "bg-primary/10 dark:bg-primary/20 border-primary ring-2 ring-primary/40 shadow-sm cursor-pointer"
                                              : "bg-white dark:bg-[#222222] border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] opacity-75 hover:opacity-100 cursor-pointer"
                                        )}
                                        title={
                                          isApplicable
                                            ? `${b.name} - ₱${brandPrice.toLocaleString()} each`
                                            : `${b.name} - Not available for ${itemKw}kW setup`
                                        }
                                      >
                                        {b.logo ? (
                                          <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[90px] object-contain shrink-0" />
                                        ) : (
                                          <span className="text-[10px] font-bold px-1">{b.name}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="inline-flex gap-1.5 items-center flex-wrap">
                                  {HYBRID_BRANDS.map((b) => {
                                    const brandPrice = b.getPrice(itemKw)
                                    const isApplicable = brandPrice !== null
                                    const isSelected = isApplicable && item.rate === brandPrice

                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        disabled={!isApplicable}
                                        onClick={() => {
                                          if (!isApplicable) return
                                          updateItem(item.id, 'rate', brandPrice)
                                          updateItem(item.id, 'description', `Inverter ${itemKw}kW Hybrid`)
                                        }}
                                        className={cn(
                                          "flex items-center justify-center p-2 rounded-lg border transition-all select-none min-h-[36px]",
                                          !isApplicable
                                            ? "opacity-30 bg-secondary/30 border-border cursor-not-allowed pointer-events-none grayscale"
                                            : isSelected
                                              ? "bg-primary/10 dark:bg-primary/20 border-primary ring-2 ring-primary/40 shadow-sm cursor-pointer"
                                              : "bg-white dark:bg-[#222222] border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] opacity-75 hover:opacity-100 cursor-pointer"
                                        )}
                                        title={
                                          isApplicable
                                            ? `${b.name} - ₱${brandPrice.toLocaleString()} each`
                                            : `${b.name} - Not available for ${itemKw}kW hybrid setup`
                                        }
                                      >
                                        {b.logo ? (
                                          <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[90px] object-contain shrink-0" />
                                        ) : (
                                          <span className="text-[10px] font-bold px-1">{b.name}</span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {isBatteryItem && (() => {
                            let capKey: '100Ah' | '200Ah' | '314Ah' | '261kW' = '314Ah'
                            if (descLower.includes('261') || descLower.includes('power')) {
                              capKey = '261kW'
                            } else if (descLower.includes('200ah')) {
                              capKey = '200Ah'
                            } else if (descLower.includes('100ah') || descLower.includes('102.4v')) {
                              capKey = '100Ah'
                            }

                            let activeBrand: 'genix' | 'dyness' | 'cesc' = 'cesc'
                            if (descLower.includes('genix') || item.rate === 38000 || item.rate === 65000 || item.rate === 85000) {
                              activeBrand = 'genix'
                            } else if (descLower.includes('dyness') || item.rate === 43000 || item.rate === 111000) {
                              activeBrand = 'dyness'
                            } else if (descLower.includes('cesc') || item.rate === 2400000 || item.rate === 88000) {
                              activeBrand = 'cesc'
                            }

                            const getGenixData = (cap: typeof capKey) => {
                              if (cap === '200Ah') return { desc: 'Battery 51.2V 200Ah', rate: 65000 }
                              if (cap === '100Ah') return { desc: 'Battery 51.2V 100Ah', rate: 38000 }
                              return { desc: 'Battery 51.2V 314Ah', rate: 85000 }
                            }

                            const getDynessData = (cap: typeof capKey) => {
                              if (cap === '314Ah') return { desc: 'Dyness Battery 51.2V 314Ah', rate: 111000 }
                              return { desc: 'Dyness Battery 51.2V 100Ah', rate: 43000 }
                            }

                            const getCescData = (cap: typeof capKey) => {
                              if (cap === '261kW') return { desc: 'Battery 261 kW Power System', rate: 2400000 }
                              return { desc: 'Battery 51.2V 314Ah', rate: 88000 }
                            }

                            const applySelection = (newDesc: string, newRate: number) => {
                              updateItem(item.id, 'description', newDesc)
                              updateItem(item.id, 'rate', newRate)
                            }

                            return (
                              <div className="flex flex-col gap-2 pt-1.5 pb-1 px-0.5 border-t border-dashed border-[#E5E5E5] dark:border-[#333333] mt-1.5">
                                {/* 1. Brand Selector Row (Primary Control) */}
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cap = capKey === '261kW' ? '314Ah' : capKey
                                      const data = getGenixData(cap)
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'genix'
                                        ? "bg-green-50 dark:bg-green-950/40 border-green-500/60 ring-2 ring-green-500/40 shadow-sm"
                                        : "bg-white dark:bg-[#222222] border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5] opacity-75 hover:opacity-100"
                                    )}
                                    title="Genix Green Battery"
                                  >
                                    <img src="/genixgreen.svg" alt="Genix Green" className="h-8 w-auto object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cap = (capKey === '200Ah' || capKey === '261kW') ? '314Ah' : capKey
                                      const data = getDynessData(cap)
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'dyness'
                                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500/60 ring-2 ring-blue-500/40 shadow-sm"
                                        : "bg-white dark:bg-[#222222] border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5] opacity-75 hover:opacity-100"
                                    )}
                                    title="Dyness Battery"
                                  >
                                    <img src="/dyness.svg" alt="Dyness" className="h-8 w-auto object-contain shrink-0" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cap = (capKey === '100Ah' || capKey === '200Ah') ? '314Ah' : capKey
                                      const data = getCescData(cap)
                                      applySelection(data.desc, data.rate)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer select-none",
                                      activeBrand === 'cesc'
                                        ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500/60 ring-2 ring-purple-500/40 shadow-sm"
                                        : "bg-white dark:bg-[#222222] border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5] opacity-75 hover:opacity-100"
                                    )}
                                    title="CESC Battery"
                                  >
                                    <img src="/cesc.svg" alt="CESC" className="h-8 w-auto object-contain shrink-0" />
                                  </button>
                                </div>

                                {/* 2. Available Capacity Buttons for Selected Brand */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-dotted border-[#E5E5E5] dark:border-[#333333]">
                                  <span className="text-[10px] uppercase font-semibold text-[#888888] mr-1">Capacity:</span>

                                  {/* Genix Green Capacities */}
                                  {activeBrand === 'genix' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getGenixData('100Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '100Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="100Ah - ₱38,000.00"
                                      >
                                        100Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getGenixData('200Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '200Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="200Ah - ₱65,000.00"
                                      >
                                        200Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getGenixData('314Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="314Ah - ₱85,000.00"
                                      >
                                        314Ah
                                      </button>
                                    </>
                                  )}

                                  {/* Dyness Capacities */}
                                  {activeBrand === 'dyness' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getDynessData('100Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '100Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="100Ah - ₱43,000.00"
                                      >
                                        100Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getDynessData('314Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="314Ah - ₱111,000.00"
                                      >
                                        314Ah
                                      </button>
                                    </>
                                  )}

                                  {/* CESC Capacities */}
                                  {activeBrand === 'cesc' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getCescData('314Ah')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '314Ah'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="314Ah - ₱88,000.00"
                                      >
                                        314Ah
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const data = getCescData('261kW')
                                          applySelection(data.desc, data.rate)
                                        }}
                                        className={cn(
                                          "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer select-none",
                                          capKey === '261kW'
                                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                                            : "bg-white dark:bg-[#222222] text-foreground border-[#E5E5E5] dark:border-[#333333] hover:bg-[#F5F5F5]"
                                        )}
                                        title="261kW - ₱2,400,000.00"
                                      >
                                        261kW
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}

                  {/* Add item */}
                  <Button
                    variant="outline"
                    onClick={handleAddItem}
                    className="w-full h-[34px] border-dashed border-[#CCCCCC] text-[12px] font-medium text-[#888888] hover:border-[#888888] hover:text-[#555555] hover:bg-transparent mt-1"
                  >
                    <Plus size={13} />
                    Add item
                  </Button>
                </div>
              </section>
            )}

            {activeTab === 'notes' && (
              <>
                {/* NOTES / SPECIAL INSTRUCTIONS */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('note')} onMouseLeave={() => setHoveredField(null)}>
                  <SectionHeader>Notes / Special Instructions</SectionHeader>
                  <Textarea
                    value={invoice.note}
                    onChange={(e) => update('note', e.target.value)}
                    placeholder="Notes, special instructions, or any additional details…"
                    rows={4}
                  />
                </section>

                {/* TERMS & CONDITIONS */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('terms')} onMouseLeave={() => setHoveredField(null)}>
                  <SectionHeader>Terms & Conditions</SectionHeader>
                  <Textarea
                    value={invoice.terms || ''}
                    onChange={(e) => update('terms', e.target.value)}
                    placeholder="Payment terms, contract conditions, warranty details…"
                    rows={4}
                  />
                </section>

                {/* CLOSING */}
                <section className="space-y-3" onMouseEnter={() => setHoveredField('closing')} onMouseLeave={() => setHoveredField(null)}>
                  <SectionHeader>Closing / Footer</SectionHeader>
                  <Textarea
                    value={invoice.closing || ''}
                    onChange={(e) => update('closing', e.target.value)}
                    placeholder="We are looking forward to building..."
                    rows={5}
                  />
                </section>
              </>
            )}

            {activeTab === 'supply' && (
              <section className="space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <SectionHeader>Supplied Items Filter</SectionHeader>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      View and filter physical items being supplied (equipment, mounting structure, and electrical hardware).
                    </p>
                  </div>
                </div>

                {/* 1. Financial & Category Summary Cards for Supply */}
                {(() => {
                  const rateMarkup = invoice.rateMarkup || 0
                  let goodsSubtotal = 0
                  let goodsCount = 0
                  let equipmentCount = 0
                  let hardwareCount = 0
                  let groundingCount = 0

                  invoice.lineItems.forEach(item => {
                    const descLower = (item.description || '').toLowerCase()
                    const isLabor = isLaborItem(item.description)
                    const isBatteryItem = descLower.includes('battery') || descLower.includes('dyness') || descLower.includes('genix') || descLower.includes('cesc') || descLower.includes('314ah') || descLower.includes('200ah') || descLower.includes('100ah') || descLower.includes('102.4v')
                    
                    if (isLabor) return
                    if (invoice.excludeBattery && isBatteryItem) return

                    const shouldApplyMarkup = !(invoice.excludeLaborMarkup && isLabor)
                    const adjustedRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
                    const lineTotal = item.quantity * adjustedRate

                    goodsSubtotal += lineTotal
                    goodsCount += 1

                    const cat = getSupplyCategory(item.description)
                    if (cat.key === 'equipment') equipmentCount += 1
                    else if (cat.key === 'grounding') groundingCount += 1
                    else hardwareCount += 1
                  })

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-[12px] bg-primary/10 border border-primary/20 space-y-1">
                        <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">Total Supplied Value</span>
                        <span className="text-sm font-bold text-primary block font-mono">{formatCurrency(goodsSubtotal, invoice.currency)}</span>
                        <span className="text-[10px] text-primary/80">{goodsCount} supplied item(s)</span>
                      </div>

                      <div className="p-3 rounded-[12px] bg-secondary/40 border border-border space-y-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Major Equipment</span>
                        <span className="text-sm font-bold text-foreground block font-mono">{equipmentCount}</span>
                        <span className="text-[10px] text-muted-foreground">Panels, Inverters, Batteries</span>
                      </div>

                      <div className="p-3 rounded-[12px] bg-secondary/40 border border-border space-y-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Hardware & Electrical</span>
                        <span className="text-sm font-bold text-foreground block font-mono">{hardwareCount}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Structure, Cables & Wiring</span>
                      </div>

                      <div className="p-3 rounded-[12px] bg-teal-500/10 border border-teal-500/20 space-y-1">
                        <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider block">Grounding Systems</span>
                        <span className="text-sm font-bold text-foreground block font-mono">{groundingCount}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Lugs, Wire, Rod & Clamp</span>
                      </div>
                    </div>
                  )
                })()}

                {/* 2. Category Filter Chips & Search Bar */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={supplySearchQuery}
                        onChange={(e) => setSupplySearchQuery(e.target.value)}
                        placeholder="Filter supplied items by name…"
                        className="pl-8 h-9 text-xs"
                      />
                      {supplySearchQuery && (
                        <button
                          onClick={() => setSupplySearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                      {[
                        { id: 'all', label: 'All Supplied Items' },
                        { id: 'equipment', label: 'Equipment' },
                        { id: 'mounting', label: 'Mounting' },
                        { id: 'electrical', label: 'Electrical' },
                        { id: 'grounding', label: 'Grounding' },
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setSupplyCategoryFilter(cat.id as any)}
                          className={cn(
                            "px-2.5 py-1 rounded-[8px] text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap border select-none",
                            supplyCategoryFilter === cat.id
                              ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                              : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Supplied Items Table */}
                  <div className="border border-border rounded-[14px] overflow-hidden bg-card shadow-xs">
                    <div className="bg-secondary/50 px-4 py-2.5 border-b border-border flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Supplied Item</span>
                      <span>Category & Pricing</span>
                    </div>

                    <div className="divide-y divide-border max-h-[460px] overflow-y-auto">
                      {(() => {
                        const filtered = invoice.lineItems.filter(item => {
                          const descLower = (item.description || '').toLowerCase().trim()
                          const isLabor = isLaborItem(item.description)
                          if (isLabor) return false // Pure supply view - filter out labor items

                          const matchesSearch = !supplySearchQuery || item.description.toLowerCase().includes(supplySearchQuery.toLowerCase())
                          const cat = getSupplyCategory(item.description)
                          
                          if (!matchesSearch) return false
                          if (supplyCategoryFilter === 'all') return true
                          if (supplyCategoryFilter === 'equipment') return cat.key === 'equipment'
                          if (supplyCategoryFilter === 'mounting') return cat.key === 'mounting'
                          if (supplyCategoryFilter === 'electrical') return cat.key === 'electrical'
                          if (supplyCategoryFilter === 'grounding') return cat.key === 'grounding'
                          return true
                        })

                        if (filtered.length === 0) {
                          return (
                            <div className="p-8 text-center text-muted-foreground space-y-2">
                              <Package size={24} className="mx-auto text-muted-foreground/50" />
                              <p className="text-xs font-semibold">No supplied items match the current filter.</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setSupplySearchQuery(''); setSupplyCategoryFilter('all'); }}
                                className="text-[11px] h-7 cursor-pointer"
                              >
                                Clear Filters
                              </Button>
                            </div>
                          )
                        }

                        const rateMarkup = invoice.rateMarkup || 0

                        return filtered.map(item => {
                          const catInfo = getSupplyCategory(item.description)
                          const shouldApplyMarkup = true
                          const adjustedRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
                          const lineTotal = item.quantity * adjustedRate

                          return (
                            <div key={item.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-secondary/20">
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn("px-2 py-0.5 rounded-[6px] text-[9px] font-bold uppercase tracking-wider border", catInfo.badgeColor)}>
                                    {catInfo.label}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-foreground break-words font-mono">
                                  {item.description || 'Untitled Line Item'}
                                </p>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                                  <span>Qty: {item.quantity} {item.unit}</span>
                                  <span>•</span>
                                  <span>Rate: {formatCurrency(adjustedRate, invoice.currency)}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                                <div className="text-right font-mono">
                                  <span className="text-xs font-bold text-foreground block">
                                    {formatCurrency(lineTotal, invoice.currency)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    {item.quantity} x {formatCurrency(adjustedRate, invoice.currency)}
                                  </span>
                                </div>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeItem(item.id)}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-[8px] cursor-pointer"
                                  title="Remove item from quotation"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'checklist' && (
              <section className="space-y-5 animate-in fade-in duration-200">


                {/* 2. Progress & Bulk Action Toolbar */}
                {(() => {
                  const activeChecklistItems = invoice.lineItems.filter(item => {
                    const descLower = (item.description || '').toLowerCase()
                    const isBatteryItem = descLower.includes('battery') || descLower.includes('dyness') || descLower.includes('genix') || descLower.includes('cesc') || descLower.includes('314ah') || descLower.includes('200ah') || descLower.includes('100ah')
                    if (invoice.excludeBattery && isBatteryItem) return false
                    return true
                  })

                  const totalCount = activeChecklistItems.length
                  const checkedCount = activeChecklistItems.filter(it => checkedChecklistItems[it.id]).length
                  const percent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

                  const handleSelectAll = () => {
                    const next: Record<string, boolean> = {}
                    activeChecklistItems.forEach(it => { next[it.id] = true })
                    setCheckedChecklistItems(next)
                  }

                  const handleClearAll = () => {
                    setCheckedChecklistItems({})
                  }

                  const handleCopyChecklist = () => {
                    const sourceName = previousTab === 'supply' ? 'Supply Materials' : 'Full Quotation'
                    const dateStr = new Date().toLocaleDateString()
                    let txt = `SOLAR SYSTEM DISPATCH CHECKLIST (${sourceName})
Date: ${dateStr}
Subject: ${invoice.subject || 'Solar Installation'}
-----------------------------------
`

                    activeChecklistItems.forEach((it, idx) => {
                      const isChecked = !!checkedChecklistItems[it.id]
                      txt += `[${isChecked ? 'x' : ' '}] ${idx + 1}. ${it.description || 'Item'} - ${it.quantity} ${it.unit}
`
                    })

                    txt += `-----------------------------------
Progress: ${checkedCount}/${totalCount} items checked (${percent}%)`

                    navigator.clipboard.writeText(txt)
                    setChecklistCopied(true)
                    setTimeout(() => setChecklistCopied(false), 2000)
                  }

                  return (
                    <div className="space-y-4">
                      {/* Overall Progress Meter */}
                      <div className="p-4 rounded-[16px] bg-card border border-border space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            Checklist Progress
                          </span>
                          <span className="font-mono font-bold text-primary">
                            {checkedCount} / {totalCount} Completed ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden border border-border">
                          <div
                            className="bg-primary h-full transition-all duration-300 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Quick Action Toolbar */}
                      <div className="flex items-center justify-between gap-2 flex-wrap bg-card p-3 rounded-[14px] border border-border">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={handleSelectAll}
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 cursor-pointer"
                          >
                            <CheckSquare size={12} />
                            Select All
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleClearAll}
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 cursor-pointer border-border"
                          >
                            <RefreshCw size={12} />
                            Clear
                          </Button>
                        </div>


                      </div>

                      {/* Grouped Checklist Content */}
                      {totalCount === 0 ? (
                        <div className="p-8 text-center text-muted-foreground bg-card rounded-[16px] border border-border space-y-2">
                          <Package size={28} className="mx-auto opacity-50" />
                          <p className="text-xs font-semibold">No line items available to generate checklist.</p>
                          <p className="text-[11px]">Add line items in the Items tab or select a BOQ preset to build your checklist.</p>
                        </div>
                      ) : (
                        (() => {
                          // Group items by supply category
                          const grouped: Record<string, { label: string; badgeColor: string; items: LineItem[] }> = {
                            equipment: { label: 'Major Equipment', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', items: [] },
                            mounting: { label: 'Mounting & Hardware', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', items: [] },
                            electrical: { label: 'Electrical & Cabling', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', items: [] },
                            grounding: { label: 'Grounding & Bonding', badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', items: [] },
                            labor: { label: 'Labor & Installation Services', badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', items: [] },
                            other: { label: 'Other Items', badgeColor: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20', items: [] },
                          }

                          activeChecklistItems.forEach(item => {
                            const cat = getSupplyCategory(item.description)
                            if (grouped[cat.key]) {
                              grouped[cat.key].items.push(item)
                            } else {
                              grouped.other.items.push(item)
                            }
                          })

                          return (
                            <div className="space-y-4">
                              {Object.entries(grouped).map(([catKey, group]) => {
                                if (group.items.length === 0) return null

                                const groupChecked = group.items.filter(it => checkedChecklistItems[it.id]).length

                                return (
                                  <div key={catKey} className="bg-card rounded-[16px] border border-border p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <span className={cn("px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border", group.badgeColor)}>
                                          {group.label}
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-mono font-bold text-muted-foreground">
                                        {groupChecked} / {group.items.length} Checked
                                      </span>
                                    </div>

                                    <div className="space-y-2">
                                      {group.items.map(item => {
                                        const isChecked = !!checkedChecklistItems[item.id]

                                        return (
                                          <label
                                            key={item.id}
                                            onClick={() => {
                                              setCheckedChecklistItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                                            }}
                                            className={cn(
                                              "flex items-center justify-between p-3 rounded-[12px] border transition-all cursor-pointer select-none gap-3",
                                              isChecked
                                                ? "bg-primary/5 border-primary/40 dark:bg-primary/10 shadow-xs"
                                                : "bg-background border-border hover:bg-secondary/40"
                                            )}
                                          >
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className={cn(
                                                "w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all shrink-0",
                                                isChecked
                                                  ? "bg-primary border-primary text-primary-foreground"
                                                  : "border-border bg-card"
                                              )}>
                                                {isChecked && <Check size={12} strokeWidth={3} />}
                                              </div>

                                              <span className={cn(
                                                "text-xs font-semibold break-words font-mono transition-all",
                                                isChecked ? "line-through text-muted-foreground" : "text-foreground"
                                              )}>
                                                {item.description || 'Untitled Item'}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="px-2 py-0.5 rounded-[6px] bg-secondary border border-border text-[11px] font-bold font-mono text-foreground">
                                                {item.quantity} {item.unit}
                                              </span>
                                              <span className={cn(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded-[4px]",
                                                isChecked ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                              )}>
                                                {isChecked ? 'Ready' : 'Pending'}
                                              </span>
                                            </div>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()
                      )}
                    </div>
                  )
                })()}
              </section>
            )}
          </div>

          {/* Download button */}
          <div className="hidden lg:block px-6 pb-6 pt-4 border-t border-border shrink-0">
            <Button
              onClick={handleDownload}
              className="w-full h-11 rounded-[10px] text-[14px] font-semibold cursor-pointer"
            >
              <Download size={15} strokeWidth={2} />
              Download PDF
            </Button>
          </div>
        </div>
      </aside>

      <div className={cn("flex-1 bg-secondary/30 min-h-0 print:block print:h-auto relative overflow-hidden flex flex-col justify-start items-center", activeView === 'preview' ? 'flex' : 'hidden lg:flex lg:flex-col')}>
        {/* Floating background themed characters (screen only, hidden on print) */}
        {THEME_CHARACTERS[invoice.theme] && (
          <>
            <div className="absolute left-8 top-12 text-[140px] pointer-events-none select-none opacity-[0.06] animate-bounce duration-5000 print:hidden">
              {THEME_CHARACTERS[invoice.theme]}
            </div>
            <div className="absolute right-12 bottom-12 text-[160px] pointer-events-none select-none opacity-[0.06] animate-pulse duration-3000 print:hidden">
              {THEME_CHARACTERS[invoice.theme]}
            </div>
          </>
        )}
        {activeTab === 'checklist' ? (
          <MGChecklistPreview
            invoice={invoice}
            hoveredField={hoveredField}
            checkedItems={checkedChecklistItems}
            previousTab={previousTab}
            onToggleCheck={(id) => setCheckedChecklistItems(prev => ({ ...prev, [id]: !prev[id] }))}
            onPagesChange={setTotalPages}
          />
        ) : (
          <MGInvoicePreview
            invoice={invoice}
            hoveredField={hoveredField}
            onOpenCheatsheet={() => setCheatsheetOpen(true)}
            onPagesChange={setTotalPages}
            onToggleCondensed={(val) => update('isCondensed', val)}
          />
        )}
      </div>
    </div>

      <Dialog open={cheatsheetOpen} onOpenChange={setCheatsheetOpen}>
        <DialogContent className="max-w-md font-mono">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-bold tracking-tight">URL Params API</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-[#888888] -mt-1">
            Pre-fill any field by adding params to the URL. Params stay in sync as you type.
          </p>
          <div className="text-[12px] bg-[#F5F5F5] rounded-md px-3 py-2 text-[#111111] break-all">
            mg-invoice.vercel.app?fromName=Acme&amp;currency=PHP
          </div>
          <div className="flex flex-col gap-1 mt-1">
            {[
              ['fromName', 'Company name'],
              ['fromEmail', 'Company email'],
              ['fromPhone', 'Company phone'],
              ['fromAddress', 'Company address'],
              ['toName', 'Client name'],
              ['toEmail', 'Client email'],
              ['toAddress', 'Client address'],
              ['invoiceNumber', 'Invoice number'],
              ['issueDate', 'Issue date (YYYY-MM-DD)'],
              ['dueDate', 'Validity (YYYY-MM-DD)'],
              ['currency', 'Currency code'],
              ['vatRate', 'VAT %'],
              ['rateMarkup', 'Rate markup/adjustment %'],
              ['bankBeneficiary', 'Beneficiary'],
              ['bankName', 'Bank name'],
              ['bankSortCode', 'Sort Code / Routing'],
              ['bankAccount', 'Account / IBAN'],
              ['bankSwift', 'SWIFT / BIC'],
              ['note', 'Terms & Condition / additional details'],
              ['print', 'Set to true to auto-print'],
            ].map(([param, label]) => (
              <div key={param} className="flex gap-3 items-baseline">
                <span className="text-[12px] text-[#111111] w-36 shrink-0">{param}</span>
                <span className="text-[12px] text-[#888888]">{label}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
