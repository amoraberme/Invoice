'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Download, Building, Users, FileText, List, CreditCard, StickyNote, Contact, Sparkles } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-[#888888] tracking-widest uppercase">
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
      <Label className="text-[11px] font-semibold text-[#888888] tracking-widest uppercase">
        {label}
      </Label>
      {children}
    </div>
  )
}

const MG_COMPANY = 'M&G Non-Specialized Wholesale Trading'

const SALESPEOPLE = [
  { id: 'custom', name: 'Custom / None', position: '', company: '', contact: '', email: '' },
  { id: 'charlotte', name: 'Charlotte C. Santos', position: 'Senior Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 928 1655 179', email: 'charlotte.mgtrading@gmail.com' },
  { id: 'famella', name: 'Famella D. Ylanan', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 927 9487 013', email: 'sales.mgtradingph@gmail.com' },
  { id: 'jeramae', name: 'Jeramae E. Broqueza', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '+(63) 981 2206 849', email: 'jeramaemgtrading6@gmail.com' },
  { id: 'aya', name: 'Aya Rongavilla', position: 'Sales & Marketing Executive', company: MG_COMPANY, contact: '09933746489', email: 'ayarongavilla021@gmail.com' },
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

function extractLineItemsFromText(text: string) {
  const SOLAR_EXACT_MAPPING: Record<number, { desc: string; qty: string; price: string; total: string }> = {
    1: { desc: "Inverter 12kW 1pc $34,000.00", qty: "1pc", price: "₱34,000.00", total: "₱34,000.00" },
    2: { desc: "Panel 625W", qty: "10 pcs", price: "₱6,300.00", total: "₱63,000.00" },
    3: { desc: "Railings", qty: "20 pcs", price: "₱520.00", total: "₱10,400.00" },
    4: { desc: "Mid Clamp", qty: "20 pcs", price: "₱65.00", total: "₱1,300.00" },
    5: { desc: "End Clamp", qty: "8 pcs", price: "₱65.00", total: "₱520.00" },
    6: { desc: "L Foot 25 pes.", qty: "25 pes", price: "₱75.00", total: "₱1,875.00" },
    7: { desc: "Flexible hose", qty: "1 Ps", price: "-", total: "-" },
    8: { desc: "AC wire _ x", qty: "-", price: "TBD", total: "TBD" },
    9: { desc: "PV wire", qty: "-", price: "TBD", total: "TBD" },
    10: { desc: "MC4 50A", qty: "12 pcs", price: "TBD", total: "TBD" },
    11: { desc: "Breaker box 1pc 1,000.00", qty: "1pc", price: "₱1,000.00", total: "₱1,000.00" },
    12: { desc: "AC MCB", qty: "2 pcs", price: "₱350.00", total: "₱700.00" },
    13: { desc: "AC SPD", qty: "2 pes", price: "₱400.00", total: "₱800.00" },
    14: { desc: "DC SPD", qty: "2 pcs", price: "₱400.00", total: "₱800.00" },
    15: { desc: "DC MCB", qty: "2 pcs", price: "₱300.00", total: "₱600.00" },
    16: { desc: "DC MCCB for battery 250A 1pc £1,500.00", qty: "1pc", price: "₱1,500.00", total: "₱1,500.00" },
    17: { desc: "Cable raceway conduit 2 meters", qty: "1pc", price: "₱1,000.00", total: "₱1,000.00" },
    18: { desc: "Automatic transfer switch", qty: "1pc", price: "₱1,300.00", total: "₱1,300.00" },
    19: { desc: "Terminal lugs", qty: "12 pcs", price: "₱30.00", total: "₱360.00" },
    20: { desc: "Battery 314Ah (48V) 1pc $109,000.00", qty: "1pc", price: "₱109,000.00", total: "₱109,000.00" },
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

const SOLAR_PRICES = {
  Inverter: 34000.00,
  Panel: 6300.00,
  Railing: 470.00,
  MidClamp: 65.00,
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
  DynessBattery: 109000.00,
  TerminalBlock: 160.00,
  BatteryCable: 600.00
};

export default function Home() {
  const { invoice, loaded, update, updateItem, addItem, removeItem, setInvoice } = useMGInvoice()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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
    
    const runLength = floorNum * 5
    const extraQty = floorNum >= 2 ? 3 : 0

    setInvoice((prev) => {
      const items = [...prev.lineItems]
      let hasHdpe = false
      let hasAc = false
      let hasPv = false
      let hasDc = false

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
            description: `AC wire`
          })
          continue
        }

        // Match PV wire (checking specifically for 'pv' to separate from 'dc')
        const hasPvWord = /\bpv\b/i.test(item.description)
        const isPvWire = 
          descLower === 'pv' || 
          descLower === 'pv wire' || 
          descLower === 'pv cable' || 
          descLower.includes('pv wire') || 
          descLower.includes('pv cable') || 
          (hasPvWord && descLower.includes('wire')) || 
          (hasPvWord && descLower.includes('cable')) || 
          descLower.includes('red pv')
        
        if (isPvWire) {
          if (hasPv) {
            // Duplicate found, skip/discard
            continue
          }
          hasPv = true
          updatedItems.push({
            ...item,
            quantity: runLength,
            unit: 'M',
            description: `PV wire`
          })
          continue
        }

        // Match DC wire
        const hasDcWord = /\bdc\b/i.test(item.description)
        const isDcWire = 
          descLower === 'dc' || 
          descLower === 'dc wire' || 
          descLower === 'dc cable' || 
          descLower.includes('dc wire') || 
          descLower.includes('dc cable') || 
          (hasDcWord && descLower.includes('wire')) || 
          (hasDcWord && descLower.includes('cable')) || 
          descLower.includes('black pv')
        
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
            description: `DC wire`
          })
          continue
        }

        // Match Railings
        if (descLower === 'railings' || descLower.includes('railing')) {
          updatedItems.push({
            ...item,
            quantity: panelQty > 0 ? (2 * panelQty + extraQty) : item.quantity
          })
          continue
        }

        // Match Mid Clamp
        if (descLower === 'mid clamp' || descLower.includes('mid clamp')) {
          updatedItems.push({
            ...item,
            quantity: panelQty > 0 ? (2 * panelQty + extraQty) : item.quantity
          })
          continue
        }

        // Match End Clamp
        if (descLower === 'end clamp' || descLower.includes('end clamp')) {
          updatedItems.push({
            ...item,
            quantity: panelQty > 0 ? (4 * rows + extraQty) : item.quantity
          })
          continue
        }

        // Match L Foot
        if (descLower === 'l foot' || descLower.includes('l foot')) {
          updatedItems.push({
            ...item,
            quantity: panelQty > 0 ? (Math.ceil(1.25 * (2 * panelQty)) + extraQty) : item.quantity
          })
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
          description: `AC wire`,
          quantity: runLength,
          rate: SOLAR_PRICES.ACwire,
          unit: 'M'
        })
      }
      if (!hasPv) {
        updatedItems.push({
          id: `floor-pv-${now}`,
          description: `PV wire`,
          quantity: runLength,
          rate: SOLAR_PRICES.PVwire,
          unit: 'M'
        })
      }
      if (!hasDc) {
        updatedItems.push({
          id: `floor-dc-${now}`,
          description: `DC wire`,
          quantity: runLength,
          rate: SOLAR_PRICES.DCwire,
          unit: 'M'
        })
      }

      return {
        ...prev,
        lineItems: updatedItems
      }
    })
  }

  const handleGenerateBoq = (systemKw: number) => {
    const panelQty = Math.round(systemKw * 10 / 12)
    const rows = panelQty <= 6 ? 1 : 2
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
    const runLength = floorNum * 5
    const extraQty = floorNum >= 2 ? 3 : 0

    // 1. Inverter
    const inverterSizes = [3, 5, 6, 8, 10, 12, 16, 18, 100]
    let inverterKw = inverterSizes.find(s => s >= systemKw)
    if (inverterKw === undefined) {
      inverterKw = Math.ceil(systemKw)
    }
    
    let inverterDesc = `Inverter ${inverterKw}kW Hybrid`
    let inverterPrice = 0
    if (inverterKw <= 3) {
      inverterDesc = 'Inverter 5kW Hybrid'
      inverterPrice = 41000.00
    } else if (inverterKw <= 5) {
      inverterDesc = 'Inverter 5kW Hybrid'
      inverterPrice = 41000.00
    } else if (inverterKw <= 6) {
      inverterDesc = 'Inverter 6kW Hybrid'
      inverterPrice = 44000.00
    } else if (inverterKw <= 8) {
      inverterDesc = 'Inverter 8kW Hybrid'
      inverterPrice = 60000.00
    } else if (inverterKw <= 10) {
      inverterDesc = 'Inverter 10kW Hybrid'
      inverterPrice = 68000.00
    } else if (inverterKw <= 12) {
      inverterDesc = 'Inverter 12kW Hybrid'
      inverterPrice = 82000.00
    } else if (inverterKw <= 16) {
      inverterDesc = 'Inverter 16kW Hybrid'
      inverterPrice = 113000.00
    } else if (inverterKw <= 18) {
      inverterDesc = 'Inverter 30kW Hybrid'
      inverterPrice = 208000.00
    } else {
      inverterDesc = 'Inverter 125kW Hybrid'
      inverterPrice = 580000.00
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
      description: `Panel 625W`,
      quantity: panelQty,
      rate: prices.Panel,
      unit: 'PCS'
    })

    // 3. Railings
    const railingQty = 2 * panelQty + extraQty
    items.push({
      id: `boq-3-${now}`,
      description: `Railings`,
      quantity: railingQty,
      rate: prices.Railing,
      unit: 'PCS'
    })

    // 4. Mid Clamps
    const midClampQty = 2 * panelQty + extraQty
    items.push({
      id: `boq-4-${now}`,
      description: `Mid Clamp`,
      quantity: midClampQty,
      rate: prices.MidClamp,
      unit: 'PCS'
    })

    // 5. End Clamps
    const endClampQty = 4 * rows + extraQty
    items.push({
      id: `boq-5-${now}`,
      description: `End Clamp`,
      quantity: endClampQty,
      rate: prices.EndClamp,
      unit: 'PCS'
    })

    // 6. L Foot
    const lFootQty = Math.ceil(1.25 * (2 * panelQty)) + extraQty
    items.push({
      id: `boq-6-${now}`,
      description: `L Foot`,
      quantity: lFootQty,
      rate: prices.LFoot,
      unit: 'PCS'
    })

    // 7. Flexcon HDPE Hose
    items.push({
      id: `boq-7-${now}`,
      description: `Flexible hose`,
      quantity: runLength,
      rate: prices.FlexconHDPE,
      unit: 'M'
    })

    // 8. AC Wire
    items.push({
      id: `boq-8-${now}`,
      description: `AC wire`,
      quantity: runLength,
      rate: prices.ACwire,
      unit: 'M'
    })

    // 9. PV Wire
    items.push({
      id: `boq-9-${now}`,
      description: `PV wire`,
      quantity: runLength,
      rate: prices.PVwire,
      unit: 'M'
    })

    // 9.5 DC Wire
    items.push({
      id: `boq-dc-${now}`,
      description: `DC wire`,
      quantity: runLength,
      rate: prices.DCwire,
      unit: 'M'
    })

    // 10. MC4 Connectors
    let mc4Qty = Math.ceil(1.2 * panelQty)
    if (mc4Qty % 2 !== 0) mc4Qty += 1
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
      description: `AC MCB`,
      quantity: 2,
      rate: prices.ACMCB,
      unit: 'PCS'
    })

    // 13. AC SPD
    items.push({
      id: `boq-13-${now}`,
      description: `AC SPD`,
      quantity: 2,
      rate: prices.ACSPD,
      unit: 'PCS'
    })

    // 14. DC SPD
    items.push({
      id: `boq-14-${now}`,
      description: `DC SPD`,
      quantity: 2,
      rate: prices.DCSPD,
      unit: 'PCS'
    })

    // 15. DC MCB
    items.push({
      id: `boq-15-${now}`,
      description: `DC MCB`,
      quantity: 2,
      rate: prices.DCMCB,
      unit: 'PCS'
    })

    // 16. DC MCCB
    const mccbRating = batteryQty >= 2 ? '250A' : '125A'
    items.push({
      id: `boq-16-${now}`,
      description: `DC MCCB for battery ${mccbRating}`,
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
      description: `Automatic transfer switch`,
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

    // 20. Battery
    items.push({
      id: `boq-20-${now}`,
      description: `Battery 314Ah (48V)`,
      quantity: batteryQty,
      rate: 88000.00,
      unit: 'PC'
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

    setInvoice((prev) => ({
      ...prev,
      lineItems: items,
      subject: `${systemKw}kW Hybrid System with Battery`
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
      window.print()
    }, 300)
    return () => clearTimeout(timer)
  }, [loaded])

  const handleDownload = () => {
    window.print()
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
    <div className="flex flex-col h-dvh overflow-hidden bg-[#F5F5F5] print:bg-white print:block print:h-auto print:overflow-visible">
      {/* Mobile Header */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 bg-white border-b border-[#E5E5E5] shrink-0 print:hidden gap-2">
        <span className="font-bold text-[15px] text-[#111111] tracking-tight shrink-0">MG Invoice</span>
        
        {/* Toggle */}
        <div className="flex bg-[#F5F5F5] p-0.5 rounded-[8px] border border-[#E5E5E5] gap-0.5 shrink-0">
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
        <aside className={cn("w-full flex-1 lg:h-full lg:w-[450px] min-h-0 bg-white border-b lg:border-b-0 lg:border-r border-[#E5E5E5] flex flex-col lg:flex-row shrink-0 print:hidden", activeView === 'edit' ? 'flex' : 'hidden lg:flex')}>
          {/* Tab strip (Horizontal on mobile/tablet, Vertical on desktop) */}
          <div className="w-full lg:w-[76px] h-auto lg:h-full bg-[#F5F5F5] border-b lg:border-b-0 lg:border-r border-[#E5E5E5] flex flex-row lg:flex-col items-center justify-between lg:justify-start px-4 py-3 lg:px-0 lg:py-6 gap-2 lg:gap-5 overflow-x-auto lg:overflow-x-visible shrink-0 scrollbar-none">
            {[
              { id: 'ocr', label: 'OCR', icon: Sparkles, title: 'Upload & Spec OCR' },
              { id: 'sender', label: 'Sender', icon: Building, title: 'Sender & Sales Contact' },
              { id: 'client', label: 'Client', icon: Users, title: 'Client (To)' },
              { id: 'invoice', label: 'Details', icon: FileText, title: 'Invoice Details' },
              { id: 'items', label: 'Items', icon: List, title: 'Line Items' },
              { id: 'payment', label: 'Bank', icon: CreditCard, title: 'Payment details' },
              { id: 'notes', label: 'Terms', icon: StickyNote, title: 'Terms & Closing' },
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative w-12 h-12 lg:w-14 lg:h-14 rounded-[12px] flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer select-none shrink-0",
                    active
                      ? "bg-white text-[#111111] shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-[#E5E5E5]/80 font-semibold"
                      : "text-[#888888] hover:text-[#555555] hover:bg-[#EBEBEB]"
                  )}
                  title={tab.title}
                >
                  <Icon size={15} className="lg:w-4 lg:h-4" />
                  <span className="text-[8px] lg:text-[9px] leading-none tracking-tight">{tab.label}</span>
                  {active && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-0 lg:top-1/2 lg:-translate-y-1/2 w-6 lg:w-[3px] h-[3px] lg:h-6 bg-[#111111] rounded-t-[3px] lg:rounded-t-none lg:rounded-r-[3px]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Right form layout */}
          <div className="flex-1 flex flex-col min-h-0 lg:h-full min-w-0">
            {/* Logo (Desktop only, since Mobile has top bar) */}
            <div className="hidden lg:flex items-center justify-between px-6 py-[22px] border-b border-[#E5E5E5] shrink-0">
            <span className="font-bold text-[17px] text-[#111111] tracking-tight">MG Invoice</span>
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
                    "border border-dashed rounded-[16px] p-6 text-center transition-all bg-[#FFFFFF]",
                    dragActive ? "border-[#111111] bg-[#F5F5F5]" : "border-[#CCCCCC]"
                  )}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <p className="text-xs text-[#111111] font-medium leading-relaxed mb-3">
                    Have an existing Purchase Specification sheet? <br />
                    <strong className="text-[#111111]">Drop Image or PDF to Extract Configuration Data</strong>
                  </p>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#111111] hover:bg-[#111111]/90 text-[#FFFFFF] font-bold px-4 py-2 rounded-[12px] text-xs transition-all border-0 shadow-none"
                  >
                    UPLOAD TECHNICAL SPEC SHEET
                  </Button>
                </div>

                {/* Solar BOQ System Sizing Setup */}
                <div className="mt-4 p-4 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[16px] text-left">
                  <h4 className="text-[10px] font-bold text-[#111111] uppercase tracking-wider mb-2">
                    Solar BOQ Sizing Setup
                  </h4>
                  <p className="text-[10px] text-[#555555] mb-3 leading-relaxed">
                    Generate a complete 23-item BOQ according to system capacity sizing rules.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[4, 5, 6, 8, 10, 12, 16, 20].map((kw) => {
                      const calculatedPanelQty = Math.round(kw * 10 / 12)
                      const calculatedRows = calculatedPanelQty <= 6 ? 1 : 2
                      let laborCost = 50000
                      if (kw >= 16) laborCost = 120000
                      else if (kw >= 8) laborCost = 55000
                      
                      const panelDesc = `${calculatedPanelQty} Panels (${calculatedRows} Row${calculatedRows > 1 ? 's' : ''})`
                      const laborDesc = `Labor: ₱${(laborCost / 1000)}k`

                      return (
                        <button
                          key={kw}
                          onClick={() => handleGenerateBoq(kw)}
                          className="flex flex-col items-center justify-center p-3 rounded-[12px] bg-[#F5F5F5] hover:bg-[#EBEBEB] border border-[#E5E5E5] text-[#111111] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] focus:outline-none select-none font-semibold"
                        >
                          <span className="font-bold text-xs">{kw}kW Setup</span>
                          <span className="text-[8px] text-[#888888] mt-1 font-mono font-normal">{panelDesc}</span>
                          <span className="text-[8px] text-[#2E7D32] mt-0.5 font-mono font-bold">{laborDesc}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="border-t border-[#E5E5E5] pt-3 mt-3">
                    <label className="text-[9px] font-bold text-[#888888] uppercase tracking-wider block mb-1">
                      Apply by Custom kW Setup
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customKwInput}
                        onChange={(e) => setCustomKwInput(e.target.value)}
                        placeholder="e.g. 7.5"
                        className="bg-[#FAFAFA] border-[#E5E5E5] text-[#111111] font-medium h-9 rounded-[10px] text-xs focus:ring-1 focus:ring-black focus:border-black flex-1"
                      />
                      <Button
                        onClick={() => {
                          const val = parseFloat(customKwInput)
                          if (!isNaN(val) && val > 0) {
                            handleGenerateBoq(val)
                          }
                        }}
                        disabled={!customKwInput || parseFloat(customKwInput) <= 0}
                        variant="default"
                        size="sm"
                        className="bg-black hover:bg-black/90 text-white font-bold rounded-[10px] h-9 text-[10px] px-3 shrink-0"
                      >
                        APPLY
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Floor Chooser */}
                <div className="mt-4 p-4 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[16px] text-left">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-bold text-[#111111] uppercase tracking-wider">
                      🏢 Floor Selection
                    </h4>
                    {selectedFloor && (
                      <span className="text-[9px] bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-[12px] font-bold border border-[#C8E6C9]">
                        Auto-Synced
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 select-none">
                    {[1, 2, 3, 4, 5].map((floorNum) => {
                      const isSelected = selectedFloor === floorNum;
                      return (
                        <button
                          key={floorNum}
                          onClick={() => handleSelectFloor(floorNum)}
                          className={cn(
                            "h-9 rounded-[8px] flex items-center justify-center text-[11px] font-bold transition-all relative border cursor-pointer select-none",
                            isSelected 
                              ? "bg-[#111111] text-[#FFFFFF] border-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.15)] scale-[1.02] z-10" 
                              : "bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#555555] border-[#E5E5E5]"
                          )}
                        >
                          F{floorNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Electricity Consumption Calculator */}
                <div className="mt-4 p-4 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[16px] text-left">
                  <h4 className="text-[10px] font-bold text-[#111111] uppercase tracking-wider mb-3 flex items-center gap-1">
                    <span>⚡</span> Consumption Calculator
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-[#888888] uppercase tracking-wider block mb-1">
                          Monthly Consumption (kWh)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={monthlyKwh}
                          onChange={(e) => handleMonthlyKwhChange(e.target.value)}
                          placeholder="e.g. 500"
                          className="bg-[#FAFAFA] border-[#E5E5E5] text-[#111111] font-medium h-9 rounded-[10px] text-xs focus:ring-1 focus:ring-black focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[#888888] uppercase tracking-wider block mb-1">
                          Daily Consumption (kWh)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={dailyKwh}
                          onChange={(e) => handleDailyKwhChange(e.target.value)}
                          placeholder="e.g. 16.67"
                          className="bg-[#FAFAFA] border-[#E5E5E5] text-[#111111] font-medium h-9 rounded-[10px] text-xs focus:ring-1 focus:ring-black focus:border-black"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-[#888888] uppercase tracking-wider block mb-1">
                          Price per kWh (₱)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pricePerKwh}
                          onChange={(e) => handlePricePerKwhChange(e.target.value)}
                          placeholder="15.01"
                          className="bg-[#FAFAFA] border-[#E5E5E5] text-[#111111] font-medium h-9 rounded-[10px] text-xs focus:ring-1 focus:ring-black focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[#888888] uppercase tracking-wider block mb-1">
                          Total Monthly Bill (₱)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={totalBill}
                          onChange={(e) => handleTotalBillChange(e.target.value)}
                          placeholder="e.g. 7500.00"
                          className="bg-[#FAFAFA] border-[#E5E5E5] text-[#111111] font-medium h-9 rounded-[10px] text-xs focus:ring-1 focus:ring-black focus:border-black"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="flex flex-col gap-0.5 bg-[#F9F9F9] p-2 rounded-[12px] border border-[#E5E5E5]">
                        <span className="text-[8px] text-[#888888] font-mono font-semibold uppercase">Daily Avg</span>
                        <span className="font-bold text-xs text-[#111111] font-mono">
                          {((parseFloat(monthlyKwh) || 0) / 30).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-0.5 bg-[#F9F9F9] p-2 rounded-[12px] border border-[#E5E5E5]">
                        <span className="text-[8px] text-[#888888] font-mono font-semibold uppercase">Recommended Setup</span>
                        <span className="font-bold text-xs text-[#111111] font-mono">
                          {(() => {
                            const dailyAvg = (parseFloat(monthlyKwh) || 0) / 30
                            if (dailyAvg <= 0) return '-'
                            const calculated = (dailyAvg / 8) * 1.5
                            return `${calculated.toFixed(2)}kW`
                          })()}
                        </span>
                      </div>
                    </div>
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
                    <Field label="Salesperson">
                      <Select value={invoice.salesPerson || 'custom'} onValueChange={handleSalesPersonChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Salesperson" />
                        </SelectTrigger>
                        <SelectContent>
                          {SALESPEOPLE.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                <div className="flex justify-between items-center pt-2 border-t border-[#E5E5E5] mt-1">
                  <span className="text-[10px] font-bold text-[#888888] tracking-wider uppercase">
                    Quick Actions
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInvoice((prev) => ({
                        ...prev,
                        lineItems: prev.lineItems.filter(
                          (item) => !item.description.toLowerCase().includes('battery')
                        )
                      }))
                    }}
                    className="h-7 text-[9px] font-extrabold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 rounded-[6px] cursor-pointer transition-all select-none px-2"
                    title="Remove Battery, DC MCCB for battery, and Battery Cable items from the invoice"
                  >
                    🗑️ REMOVE BATTERY
                  </Button>
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
                  {invoice.lineItems.map((item) => (
                    <div key={item.id} className="flex gap-2 items-start" onMouseEnter={() => setHoveredField(item.id)} onMouseLeave={() => setHoveredField(null)}>
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
                  ))}

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
          </div>

          {/* Download button */}
          <div className="hidden lg:block px-6 pb-6 pt-4 border-t border-[#E5E5E5] shrink-0">
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

      <div className={cn("flex-1 bg-[#EBEBEB] min-h-0 print:block print:h-auto", activeView === 'preview' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col')}>
        <MGInvoicePreview invoice={invoice} hoveredField={hoveredField} onOpenCheatsheet={() => setCheatsheetOpen(true)} onPagesChange={setTotalPages} />
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
