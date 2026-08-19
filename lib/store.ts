import type { Invoice, InvoiceHistoryItem, ChangelogItem } from './types'
import { isBatteryItem } from './utils'

const DB_NAME = 'mg-invoice-db'
const STORE_NAME = 'data'
const INVOICE_KEY = 'current-invoice'
const HISTORY_KEY = 'mg-invoice-history'
const CHANGELOG_KEY = 'mg-invoice-changelog'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadInvoice(): Promise<Invoice | null> {
  // Try localStorage first (fast, synchronous, widely supported on iOS)
  try {
    const local = localStorage.getItem(INVOICE_KEY)
    if (local) {
      return JSON.parse(local)
    }
  } catch (e) {
    console.error('Failed to load from localStorage', e)
  }

  // Fallback to IndexedDB
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(INVOICE_KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  // Save to localStorage immediately
  try {
    localStorage.setItem(INVOICE_KEY, JSON.stringify(invoice))
  } catch (e) {
    console.error('Failed to save to localStorage', e)
  }

  // Save to IndexedDB as secondary backup
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(invoice, INVOICE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // silently fail — not critical
  }
}

export function getInvoiceHistory(): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to load history from localStorage', e)
  }
  return []
}

export function saveInvoiceToHistory(
  invoice: Invoice,
  calculateTotalFn: (inv: Invoice) => number
): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const currentHistory = getInvoiceHistory()
    const now = new Date()
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const grandTotal = calculateTotalFn(invoice)
    const activeItems = (invoice.lineItems || []).filter(
      (item) => !(invoice.excludeBattery && isBatteryItem(item.description))
    )

    const newEntry: InvoiceHistoryItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      savedAt: formattedDate,
      invoiceNumber: invoice.invoiceNumber || 'Untitled Quotation',
      toName: invoice.toName || 'Unspecified Client',
      grandTotal,
      currency: invoice.currency || 'PHP',
      itemCount: activeItems.length,
      invoice: JSON.parse(JSON.stringify(invoice)),
    }

    // Avoid duplicate rapid saves within 2 seconds
    const latest = currentHistory[0]
    if (latest && Date.now() - parseInt(latest.id.split('-')[1] || '0') < 2000) {
      currentHistory[0] = newEntry
    } else {
      currentHistory.unshift(newEntry)
    }

    // Keep top 50
    const trimmed = currentHistory.slice(0, 50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
    return trimmed
  } catch (e) {
    console.error('Failed to save invoice history', e)
    return getInvoiceHistory()
  }
}

export function deleteHistoryItem(id: string): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const current = getInvoiceHistory()
    const filtered = current.filter((item) => item.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered))
    return filtered
  } catch (e) {
    console.error('Failed to delete history item', e)
    return getInvoiceHistory()
  }
}

export function clearInvoiceHistory(): InvoiceHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch (e) {
    console.error('Failed to clear invoice history', e)
  }
  return []
}

export const INITIAL_CHANGELOG_SEED: ChangelogItem[] = [
  // ── SET DATE: AUGUST 19, 2026 (Dev) ──
  {
    id: 'cl-dev-scope-editor-aug19_v1',
    timestamp: 'Aug 19, 2026, 03:30 PM',
    itemDescription: 'Editable Scope of Equipment & Works Section',
    changeType: 'system',
    fieldChanged: 'Scope of Equipment & Works Editor & Proposal Preview',
    oldValue: 'Static auto-generated scope text',
    newValue: 'Fully editable scope items (letters, titles, equipment models, and descriptions) placed before Warranty Coverage with "Sync from Items" capability',
    unit: 'UI',
    note: '[Dev] Added a dedicated Scope of Equipment & Works interactive editor in the Items tab before Warranty Coverage, enabling users to customize equipment models, descriptions, letters, or sync from line items',
    batch: 'August 19, 2026 System, Export & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-zip-export-aug19_v1',
    timestamp: 'Aug 19, 2026, 02:50 PM',
    itemDescription: 'Multi-Document ZIP Export & Dual Rate Markup Options',
    changeType: 'system',
    fieldChanged: 'PDF Export Engine & Download Dialog',
    oldValue: 'Single-file direct PDF download; Single quotation rate markup',
    newValue: 'Multi-document .zip package bundling via JSZip; Dual quotation export (With Markup & Without Markup); Native Save As picker',
    unit: 'EXPORT',
    note: '[Dev] Added multi-document export that bundles into a .zip archive when multiple items are selected or downloads directly as .pdf when 1 item is chosen, with dual markup options (With & Without Markup) and native Save As directory picker',
    batch: 'August 19, 2026 System, Export & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-color-parser-fix-aug19_v1',
    timestamp: 'Aug 19, 2026, 02:40 PM',
    itemDescription: 'Modern CSS Color Function Support ("lab" / "oklch")',
    changeType: 'system',
    fieldChanged: 'html2canvas Color Parser & Build Lifecycle',
    oldValue: 'Crashed with "Attempting to parse an unsupported color function \'lab\'"',
    newValue: 'Safe fallback returns (0 / transparent) for lab, oklch, color-mix with prebuild and postinstall patch scripts',
    unit: 'SYSTEM',
    note: '[Dev] Fixed html2canvas unsupported color function runtime crash by creating patch-html2canvas.js with automated prebuild and postinstall hooks, eliminating PDF rendering failures from modern Tailwind CSS colors',
    batch: 'August 19, 2026 System, Export & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-checklist-1page-aug19_v1',
    timestamp: 'Aug 19, 2026, 02:30 PM',
    itemDescription: 'Material Checklist Proportional 1-Page Layout & Scroll Fix',
    changeType: 'system',
    fieldChanged: 'Material Checklist Preview & PDF Renderer',
    oldValue: 'Scrolled preview caused top header/footer clipping; Excessive white space gaps',
    newValue: 'scrollX/scrollY zeroing; Proportional dynamic row padding (py-1 to py-2.5); Filtered out delivery/freight charges; Guaranteed 1-page A4 fit',
    unit: 'UI',
    note: '[Dev] Calibrated checklist layout to maximize page usage, eliminated top/bottom cropping during PDF download with scroll zeroing, and filtered non-physical delivery fees for a clean single-page material packing verification sheet',
    batch: 'August 19, 2026 System, Export & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-kw-bill-ref-aug19_v1',
    timestamp: 'Aug 19, 2026, 02:15 PM',
    itemDescription: 'kW Setup Electric Bill Reference & Default Battery Update',
    changeType: 'system',
    fieldChanged: 'Solar BOQ Setup Buttons & Battery Defaults',
    oldValue: 'Panel and row counts (e.g., "8 Panels (4 Rows)"); Default 314Ah = Genix Green',
    newValue: 'Monthly Electric Bill references (e.g., ₱8,000 for 5kW); Default 314Ah = CESC',
    unit: 'CONFIG',
    note: '[Dev] Updated all kW setup buttons to show realistic estimated monthly electric bill references (₱8k, ₱16k, etc.) instead of panel counts, and set CESC as the default brand for 314Ah batteries',
    batch: 'August 19, 2026 System, Export & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-minimal-scrollbar-aug19_v1',
    timestamp: 'Aug 19, 2026, 01:50 PM',
    itemDescription: 'Minimalist Scrollbar Design & Sender Default Landing Tab',
    changeType: 'system',
    fieldChanged: 'Global Scrollbar Styling & Initial Navigation',
    oldValue: 'Standard scrollbars; Default kW Setup tab',
    newValue: 'Ultra-thin 5px floating pill scrollbars with smooth transitions; Default Sender tab',
    unit: 'UI',
    note: '[Dev] Implemented ultra-thin 5px minimalist floating pill scrollbars with theme-aware hover transitions and global smooth scrolling, and designated Sender tab as the default landing view',
    batch: 'August 19, 2026 System, Export & UI Updates (Dev)'
  },
  // ── SET DATE: AUGUST 19, 2026 (MsG) ──
  {
    id: 'cl-msg-exec-contacts-aug19_v1',
    timestamp: 'Aug 19, 2026, 02:00 PM',
    itemDescription: 'Executive Leadership Sales Contacts Added',
    changeType: 'system',
    fieldChanged: 'Sales Contact Directory & Signatory Profile',
    oldValue: 'Previous sales contacts only',
    newValue: 'James Vidal (Chief Operating Officer - 09998837203) & Edwin Vidal (Chief Finance Officer - 0912 383 9791)',
    unit: 'CONTACT',
    note: '[MsG] Added Chief Operating Officer James Vidal (jamesedwardvidal08@gmail.com / 09998837203) and Chief Finance Officer Edwin Vidal (edwinvidal08@gmail.com / 0912 383 9791) to sales and signatory contact directory',
    batch: 'August 19, 2026 Sales & Organizational Updates (MsG)'
  },
  // ── SET DATE: AUGUST 18, 2026 (Dev) ──
  {
    id: 'cl-dev-remove-ocr-aug18_v1',
    timestamp: 'Aug 18, 2026, 08:44 AM',
    itemDescription: 'Removed Technical Spec Sheet OCR Upload Button',
    changeType: 'system',
    fieldChanged: 'kW Set Up Tab Interface',
    oldValue: 'Upload Technical Spec Sheet OCR button & drag-drop box',
    newValue: 'Removed OCR button; Streamlined direct Solar BOQ Sizing Setup',
    unit: 'UI',
    note: '[Dev] Removed "Upload Technical Spec Sheet" OCR button and drag-drop area to streamline the Solar BOQ Sizing Setup interface',
    batch: 'August 18, 2026 System & BOQ Updates (Dev)'
  },
  {
    id: 'cl-dev-defaults-markup-labor-aug18_v1',
    timestamp: 'Aug 18, 2026, 08:35 AM',
    itemDescription: 'Standardized Default Rate Markup & Labor Price/Watt',
    changeType: 'system',
    fieldChanged: 'Default Rate Markup (30%) & Price / Watt (₱6.00)',
    oldValue: 'Price/Watt inferred as 1.5 on cleared cache; Rate Markup 28%',
    newValue: 'Strict defaults: Price/Watt = ₱6.00/W (₱600.6k seed), Rate Markup = 30%',
    unit: 'CONFIG',
    note: '[Dev] Fixed cache-clearing initialization bug by updating default seed labor rate to ₱600,600 (100.1 kWp × ₱6.00/W) and standardizing default rate markup to 30%',
    batch: 'August 18, 2026 System & BOQ Updates (Dev)'
  },
  {
    id: 'cl-dev-salutation-sync-aug18_v2',
    timestamp: 'Aug 18, 2026, 08:12 AM',
    itemDescription: 'Dynamic Salutation & Offer Sync',
    changeType: 'system',
    fieldChanged: 'Salutation / Intro Generator',
    oldValue: 'Static 100kW Salutation Text',
    newValue: 'Dynamic offer synchronization with Subject and kW Setup',
    unit: 'TEXT',
    note: '[Dev] Dynamic salutation generation: Automatically updates "We are pleased to submit to you our offer on the [System / Subject] based on your requirement" whenever kW setup, system type, or subject changes',
    batch: 'August 18, 2026 System & BOQ Updates (Dev)'
  },
  {
    id: 'cl-dev-genix-200ah-default-aug18_v1',
    timestamp: 'Aug 18, 2026, 08:05 AM',
    itemDescription: 'Default Battery Setup <= 6kW',
    changeType: 'system',
    fieldChanged: 'Default Battery for <= 6kW Systems',
    oldValue: 'Genix Battery 51.2V 314Ah (₱85,000 / ₱88,000)',
    newValue: 'Genix Green Battery 51.2V 200Ah (₱65,000) for <= 6kW setups',
    unit: 'PC',
    note: '[Dev] Configured Genix Green 200Ah (51.2V 200Ah @ ₱65,000) as the default battery for all setups <= 6kW (1.5kW, 3kW, 4kW, 5kW, 6kW)',
    batch: 'August 18, 2026 System & BOQ Updates (Dev)'
  },
  // ── SET DATE: AUGUST 17, 2026 (MsG) ──
  {
    id: 'cl-msg-payment-terms-aug17_v3',
    timestamp: 'Aug 17, 2026, 01:15 PM',
    itemDescription: 'Commercial Payment Terms & Channels Policy',
    changeType: 'system',
    fieldChanged: 'Payment & Validity Terms Policy',
    oldValue: '50% Down Payment / 50% Upon Delivery (Bank / GCash / Check / Cash); 15-30 days',
    newValue: 'Full payment after Installation (Cash / Bank Transfer / Credit Card / Crypto / Gold); 15 days validity',
    unit: 'TERMS',
    note: '[MsG] Standardized default terms to full payment after installation, added Credit Card, Crypto, and Gold payment channels, and established strict 15-day quotation validity as permanent default policy',
    batch: 'August 17, 2026 Policy & Commercial Terms Updates (MsG)'
  },
  // ── SET DATE: AUGUST 17, 2026 (Dev) ──
  {
    id: 'cl-dev-terms-updated-aug17_v2',
    timestamp: 'Aug 17, 2026, 01:10 PM',
    itemDescription: 'Payment Terms & Methods Refactor',
    changeType: 'system',
    fieldChanged: 'Default Payment Terms & Channels',
    oldValue: '50% down payment, 50% upon delivery; Bank / GCash / Check / Cash',
    newValue: 'Full payment after Installation; Cash / Bank Transfer / Credit Card / Crypto / Gold; 15-day validity',
    unit: 'TERMS',
    note: '[Dev] Standardized default terms to Full payment after Installation and updated payment channels to Cash / Bank Transfer / Credit Card / Crypto / Gold with strict 15-day quotation validity',
    batch: 'August 17, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-validity-15d-aug17_v1',
    timestamp: 'Aug 17, 2026, 09:30 AM',
    itemDescription: '15-Day Validity Synchronization',
    changeType: 'system',
    fieldChanged: 'Quotation Validity (Due Date)',
    oldValue: 'Manual / Empty Due Date',
    newValue: 'Auto-synchronized 15-day validity gap from Issue Date',
    unit: 'DAYS',
    note: '[Dev] Synchronized quotation validity across all salesperson profiles, BOQ presets, and edit views to automatically maintain a 15-day gap (+15 days) from the issue date',
    batch: 'August 17, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-categories-clean-aug17_v1',
    timestamp: 'Aug 17, 2026, 09:25 AM',
    itemDescription: 'Category Standardization & Cleanup',
    changeType: 'system',
    fieldChanged: 'Supply & Material Classification',
    oldValue: 'Ambiguous "Other Materials & Supplies" category',
    newValue: 'Strict 5-Category Standard (Equipment, Mounting, Electrical, Grounding, Labor)',
    unit: 'SET',
    note: '[Dev] Eliminated "Other Materials & Supplies" and mapped all components, accessories, meters (SEC1000), and hardware into proper standard categories across Checklist and Items views',
    batch: 'August 17, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-top-section-compact-aug17_v1',
    timestamp: 'Aug 17, 2026, 09:20 AM',
    itemDescription: 'Quotation Header & Top Section',
    changeType: 'system',
    fieldChanged: 'Header Proportions & Margins',
    oldValue: '50% Page 1 Height (140px Logo, Large Margins)',
    newValue: 'Compacted ~25-30% (95px Logo, 22px Header, Tight Margins)',
    unit: 'PX',
    note: '[Dev] Compacted header layout and margins on Page 1 to increase table capacity and optimize vertical canvas space',
    batch: 'August 17, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-pagination-aug17_v1',
    timestamp: 'Aug 17, 2026, 09:15 AM',
    itemDescription: 'Single-Item Overflow Pagination',
    changeType: 'system',
    fieldChanged: 'Document Pagination Thresholds',
    oldValue: 'Item Clipping / Multi-Item Page Overflow',
    newValue: '14 Items on Page 1 (Pushes strictly 1 overflowing item)',
    unit: 'ITEMS',
    note: '[Dev] Refined pagination calculations so Page 1 comfortably accommodates 14 items with complete client details and pushes only the single overflowing item to Page 2',
    batch: 'August 17, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-capital-validity-aug17_v1',
    timestamp: 'Aug 17, 2026, 09:10 AM',
    itemDescription: 'Capital Worksheet Validity Header',
    changeType: 'system',
    fieldChanged: 'Capital Preview Meta Header',
    oldValue: 'Issue Date & Prepared By only',
    newValue: 'Issue Date, Validity & Prepared By',
    unit: 'SET',
    note: '[Dev] Added Validity date display to the Internal Capital & Expenses Worksheet header matching the customer quotation layout',
    batch: 'August 17, 2026 System & UI Updates (Dev)'
  },
  // ── SET DATE: AUGUST 14, 2026 (Dev) ──
  {
    id: 'cl-dev-battery-1x-aug14_v8',
    timestamp: 'Aug 14, 2026, 04:30 PM',
    itemDescription: 'Fixed Battery System Rule',
    changeType: 'system',
    fieldChanged: 'Battery Quantity Rule',
    oldValue: 'Scaled Battery Qty (1 to 2+)',
    newValue: 'Always 1x Battery across all setups',
    unit: 'PC',
    note: '[Dev] Standardized battery quantity to strictly 1x (quantity: 1) across all system sizes and kW setups',
    batch: 'August 14, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-labor-rate-aug14_v8',
    timestamp: 'Aug 14, 2026, 04:25 PM',
    itemDescription: 'Labor & Installation Rate Model',
    changeType: 'system',
    fieldChanged: 'Editor Table Rate Field',
    oldValue: 'Price / Watt Input Value (5 / 6)',
    newValue: 'Final Calculated Price (Total Watts × Price/Watt)',
    unit: 'SET',
    note: '[Dev] Set Labor and Installation rate field in BOQ editor to final calculated price with default Price/Watt = 6 (₱6.00/W)',
    batch: 'August 14, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-logistics-fee-aug14_v8',
    timestamp: 'Aug 14, 2026, 04:20 PM',
    itemDescription: 'Delivery Fees & Logistics',
    changeType: 'system',
    fieldChanged: 'Logistics Classification',
    oldValue: 'Per-Watt Labor Calculation',
    newValue: 'Fixed Flat Logistics Fee',
    unit: 'LOT',
    note: '[Dev] Standardized Delivery Fees as a fixed flat logistics fee exempt from per-watt labor calculations',
    batch: 'August 14, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-header-controls-aug14_v8',
    timestamp: 'Aug 14, 2026, 04:30 PM',
    itemDescription: 'UI & Header Control Layout',
    changeType: 'system',
    fieldChanged: 'Line Items Section Controls',
    oldValue: '2-Column Grid (Rate Markup % & Price/Watt)',
    newValue: '3-Column Grid (Rate Markup %, Price/Watt & Rows)',
    unit: 'SET',
    note: '[Dev] Integrated Rows (Array Rows) input field directly into the 3-column control grid under Line Items section header',
    batch: 'August 14, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-boq-editor-ui-aug14_v8',
    timestamp: 'Aug 14, 2026, 04:20 PM',
    itemDescription: 'BOQ Editor Table UI',
    changeType: 'system',
    fieldChanged: 'Item Row Input Boxes',
    oldValue: 'Unit [LOT] and Qty [1] Input Fields',
    newValue: 'Clean Dash Placeholder for Labor & Delivery',
    unit: 'SET',
    note: '[Dev] Hidden LOT unit and 1 quantity input boxes in editor table for Labor & Installation and Delivery Fees rows',
    batch: 'August 14, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-preview-layout-aug14_v8',
    timestamp: 'Aug 14, 2026, 04:25 PM',
    itemDescription: 'Document Preview Layout',
    changeType: 'system',
    fieldChanged: 'Rate, Unit & Qty Columns Display',
    oldValue: 'Individual Rate & Quantity Badges',
    newValue: 'Clean Dash Placeholder with Final Amount Only',
    unit: 'SET',
    note: '[Dev] Hidden unit, quantity, and rate columns (—) for Labor and Delivery Fees in preview modals to display only the final total amount',
    batch: 'August 14, 2026 System & UI Updates (Dev)'
  },
  {
    id: 'cl-dev-cleanup-aug14_v8',
    timestamp: 'Aug 14, 2026, 04:15 PM',
    itemDescription: 'Sidebar & Table Row Cleanup',
    changeType: 'system',
    fieldChanged: 'Redundant Widgets',
    oldValue: 'Sidebar Price/Watt Card & Labor Breakdown Widget',
    newValue: 'Centralized Controls & Clean Rows',
    unit: 'SET',
    note: '[Dev] Removed redundant Labor Price / Watt card from sidebar kW Set Up tab and inline Labor Breakdown widget from BOQ table',
    batch: 'August 14, 2026 System & UI Updates (Dev)'
  },
  // ── SET DATE: AUGUST 14, 2026 (MsG - SysPrc) ──
  {
    id: 'cl-sysprc-formulas-aug14_v8',
    timestamp: 'Aug 14, 2026, 03:30 PM',
    itemDescription: 'Dynamic Quantity Formulas',
    changeType: 'system',
    fieldChanged: 'BOQ Quantities',
    oldValue: 'Legacy Accessory Ratios',
    newValue: 'Restructured Formulas',
    unit: 'SET',
    note: '[SysPrc] Railings (Panels/2)*3, L Foot Railings*3, Mid Clamp Panels*2.5, End Clamp Rows*6, Splice Railings/2, MC4 2-String >=10kW (2), Terminal Block (2), Ground Lugs (5), DC MCCB (1 per battery)',
    batch: 'August 14, 2026 Price & Specification Updates (MsG - SysPrc)'
  },
  {
    id: 'cl-sysprc-wire-logic-aug14_v8',
    timestamp: 'Aug 14, 2026, 03:30 PM',
    itemDescription: 'Dynamic Size & Wire Logic',
    changeType: 'system',
    fieldChanged: 'Flexible Hose & AC Wire',
    oldValue: 'Single AC Wire & Static Hose',
    newValue: 'Dynamic Hose Tiers & Split AC Wire',
    unit: 'SET',
    note: '[SysPrc] Flexible Hose sizes 25mm (<6kW), 32mm (6-9.9kW), 40mm (>=10kW). AC Wire for >=10kW split into AC Wire #6 (50m @ ₱99.34) + AC Wire #8 (50m @ ₱60.04)',
    batch: 'August 14, 2026 Price & Specification Updates (MsG - SysPrc)'
  },
  {
    id: 'cl-sysprc-naming-pricing-aug14_v8',
    timestamp: 'Aug 14, 2026, 03:30 PM',
    itemDescription: 'Naming Conventions & Pricing Overwrites',
    changeType: 'system',
    fieldChanged: 'Equipment Titles & Rates',
    oldValue: 'Legacy Catalog Titles',
    newValue: 'Restructured Titles & Rates',
    unit: 'SET',
    note: '[SysPrc] Tongwei 620W, DC Wire, MC4 1500V (₱60), Breaker box 50x60 (₱3000), AC MCCB (4 @ ₱1300), AC SPD (₱570), DC SPD (₱790), DC MCB (₱420), DC MCCB battery (₱2000), Cable Tray 2m (₱560), ATS 125A (₱4000), Battery Cable 50mm (₱700), Ground Rod 1.5m (₱750)',
    batch: 'August 14, 2026 Price & Specification Updates (MsG - SysPrc)'
  },
  {
    id: 'cl-sysprc-item-splitting-aug14_v8',
    timestamp: 'Aug 14, 2026, 03:30 PM',
    itemDescription: 'Item Splitting',
    changeType: 'system',
    fieldChanged: 'Terminal Lugs',
    oldValue: 'Single Terminal Lugs Item',
    newValue: 'Terminal Lugs 25mm & 50mm',
    unit: 'PCS',
    note: '[SysPrc] Split Terminal Lugs into Terminal Lugs 25mm (30 pcs @ ₱40 each) and Terminal Lugs 50mm (5 pcs @ ₱50 each)',
    batch: 'August 14, 2026 Price & Specification Updates (MsG - SysPrc)'
  },
  {
    id: 'cl-msg-delivery-fees-aug14_v6',
    timestamp: 'Aug 14, 2026, 09:20 AM',
    itemDescription: 'Delivery Fees',
    changeType: 'system',
    fieldChanged: 'Labor Calculation Excluded',
    oldValue: 'Capacity Labor Pricing',
    newValue: 'Fixed Flat Logistics Fee',
    unit: 'LOT',
    note: '[MsG] Standardized Delivery Fees as a standalone logistics charge exempt from per-watt labor calculations',
    batch: 'August 14, 2026 Price & Specification Updates (MsG - SysPrc)'
  },
  // ── SET DATE: AUGUST 13, 2026 (Dev) ──
  {
    id: 'cl-dev-delivery-fees',
    timestamp: 'Aug 13, 2026, 03:00 PM',
    itemDescription: 'Delivery Fees',
    changeType: 'addition',
    fieldChanged: 'Feature Added',
    oldValue: '—',
    newValue: '₱5,000.00',
    unit: 'LOT',
    note: '[Dev] Feature Added: Delivery Fees ₱5,000 always included in Comprehensive and Condensed modes',
    batch: 'August 13, 2026 Feature Update (Dev)'
  },
  // ── SET DATE: AUGUST 13, 2026 (MsG) ──
  {
    id: 'cl-seed-trina',
    timestamp: 'Aug 13, 2026, 09:55 AM',
    itemDescription: 'Trina Solar 620W Panel',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱5,700.00',
    newValue: '₱6,200.00',
    unit: 'PCS',
    note: '[MsG] Price updated from ₱5,700 to ₱6,200 per unit',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-trina615',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'Trina Mono 615W - N Type',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱6,000.00',
    unit: 'PCS',
    note: '[MsG] Added Main QC Pricelist item Trina Mono 615W N-Type @ ₱6,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-bess',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 51.2V 314AH Lithium Battery',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱125,000.00',
    unit: 'PCS',
    note: '[MsG] Added Main QC Pricelist item DEYE 51.2V 314AH Battery @ ₱125,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-6k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P 6KW HYBRID 18/18A',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱45,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 6KW Hybrid Inverter @ ₱45,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-8k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P 8KW HYBRID 28/26A',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱60,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 8KW Hybrid Inverter @ ₱60,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-12k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P 12KW HYBRID',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱88,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 12KW Hybrid Inverter @ ₱88,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-16k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P 16KW HYBRID',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱135,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 16KW Hybrid Inverter @ ₱135,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-3p12k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 3P 12KW LV HYBRID LV BATT',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱95,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 3P 12KW LV Hybrid Inverter @ ₱95,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-3p20k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 3P 20KW LV HYBRID LV BATT',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱150,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 3P 20KW LV Hybrid Inverter @ ₱150,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-3p30k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 3P 30KW LV HYBRID HV BATT',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱250,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 3P 30KW LV Hybrid Inverter @ ₱250,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-3p50k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 3P 50KW 380V HYBRID HV BATT',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱280,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 3P 50KW 380V Hybrid Inverter @ ₱280,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-hy-3p80k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 3P 80KW 380V HYBRID HV BATT',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱300,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 3P 80KW 380V Hybrid Inverter @ ₱300,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-gt-3k6',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P-3.6KW GRID-TIE',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱16,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 3.6KW Grid-Tied Inverter @ ₱16,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-gt-6k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P-6.0KW GRID-TIE',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱25,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 6.0KW Grid-Tied Inverter @ ₱25,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-gt-8k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P-8.0KW GRID-TIE',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱28,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 8.0KW Grid-Tied Inverter @ ₱28,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  {
    id: 'cl-msg-deye-gt-10k',
    timestamp: 'Aug 13, 2026, 10:25 AM',
    itemDescription: 'DEYE 1P-10.0KW GRID-TIE',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱35,000.00',
    unit: 'UNIT',
    note: '[MsG] Added Main QC Pricelist DEYE 1P 10.0KW Grid-Tied Inverter @ ₱35,000',
    batch: 'August 13, 2026 Price Adjustment (MsG)'
  },
  // ── SET DATE: AUGUST 13, 2026 (SysPrc) ──
  {
    id: 'cl-seed-1',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Breaker box / Metal Enclosure',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱2,250.00',
    newValue: '₱3,000.00',
    unit: 'PC',
    note: '[SysPrc] Price updated from ₱2,250 to ₱3,000 per unit',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc)'
  },
  {
    id: 'cl-seed-2',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Cable Tray',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱560.00',
    unit: 'PCS',
    note: '[SysPrc] Added new item Cable Tray at ₱560 each to BOQ and electrical catalog',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc)'
  },
  {
    id: 'cl-seed-3',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Terminal lugs',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱70.00',
    newValue: '₱40.00',
    unit: 'PCS',
    note: '[SysPrc] Price reduced from ₱70 to ₱40 each',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc)'
  },
  {
    id: 'cl-seed-4',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'AC Wire #6 AWG 14mm²',
    changeType: 'price',
    fieldChanged: 'Unit Price (Per Meter)',
    oldValue: '₱400.00 / m',
    newValue: '₱99.34 / m',
    unit: 'M',
    note: '[SysPrc] Updated rate per meter based on ₱14,900 per 150m roll',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc)'
  },
  {
    id: 'cl-seed-5',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'AC Wire AWG #8',
    changeType: 'price',
    fieldChanged: 'Unit Price (Per Meter)',
    oldValue: '₱300.00 / m',
    newValue: '₱60.04 / m',
    unit: 'M',
    note: '[SysPrc] Updated rate per meter from ₱300 to ₱60.04 based on ₱9,006 per 150m roll',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc)'
  },
  {
    id: 'cl-seed-6',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Ground Wire',
    changeType: 'system',
    fieldChanged: 'Description, Unit, Price & Qty',
    oldValue: 'Ground Wire 30m @ ₱1,300.00 / ROLL',
    newValue: 'Ground Wire @ ₱39.25 / M, Qty: 50',
    unit: 'M',
    note: '[SysPrc] Renamed from Ground Wire 30m to Ground Wire, unit from ROLL to M, rate to ₱39.25/m (₱5,888 per 150m roll), default qty set to 50',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc)'
  },
  {
    id: 'cl-seed-7',
    timestamp: 'Aug 13, 2026, 09:19 AM',
    itemDescription: 'Flexible hose',
    changeType: 'quantity',
    fieldChanged: 'Default Quantity',
    oldValue: 'Dynamic (e.g. 35m)',
    newValue: '50m',
    unit: 'M',
    note: '[SysPrc] Default quantity updated to 50 meters',
    batch: 'August 13, 2026 Price & Catalog Adjustment (SysPrc)'
  },
  // ── SET DATE: AUGUST 01, 2026 ──
  {
    id: 'cl-seed-8',
    timestamp: 'Aug 01, 2026, 08:00 AM',
    itemDescription: 'Tongwei Solar Panel 620W N-Type',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱5,800.00',
    newValue: '₱5,456.00',
    unit: 'PCS',
    note: 'Updated to GEPC August 1 Tier 1 Subdealer rate matrix',
    batch: 'August 01, 2026 GEPC Price Sheet Release'
  },
  {
    id: 'cl-seed-9',
    timestamp: 'Aug 01, 2026, 08:00 AM',
    itemDescription: 'GoodWe 12kW Three Phase Hybrid Inverter',
    changeType: 'price',
    fieldChanged: 'Unit Price',
    oldValue: '₱82,000.00',
    newValue: '₱78,000.00',
    unit: 'UNIT',
    note: 'Monthly promotional pricing adjustment',
    batch: 'August 01, 2026 GEPC Price Sheet Release'
  },
  // ── SET DATE: JUNE 15, 2026 ──
  {
    id: 'cl-seed-10',
    timestamp: 'Jun 15, 2026, 10:30 AM',
    itemDescription: 'Solar Railings 2.4m Aluminum Heavy Duty',
    changeType: 'addition',
    fieldChanged: 'Item Added',
    oldValue: '—',
    newValue: '₱490.00',
    unit: 'PCS',
    note: 'Added heavy duty aluminum mounting rail item into hardware catalog',
    batch: 'June 15, 2026 Angel Solar Hardware Release'
  }
]

export function getChangelogHistory(): ChangelogItem[] {
  if (typeof window === 'undefined') return INITIAL_CHANGELOG_SEED
  try {
    const raw = localStorage.getItem(CHANGELOG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasAug19Seed = parsed.some((i: ChangelogItem) => i.id === 'cl-dev-scope-editor-aug19_v1')
        const hasAug18LatestDevSeed = parsed.some((i: ChangelogItem) => i.id === 'cl-dev-remove-ocr-aug18_v1')
        const hasOldMsGAug18 = parsed.some((i: ChangelogItem) => 
          i.id === 'cl-msg-salutation-sync-aug18_v2' || 
          i.id === 'cl-msg-genix-200ah-default-aug18_v1' ||
          (i.batch && i.batch.includes('August 18') && i.batch.includes('(MsG)')) ||
          (i.note && i.note.startsWith('[MsG]') && i.timestamp && i.timestamp.includes('Aug 18'))
        )
        if (!hasAug19Seed || !hasAug18LatestDevSeed || hasOldMsGAug18) {
          localStorage.setItem(CHANGELOG_KEY, JSON.stringify(INITIAL_CHANGELOG_SEED))
          return INITIAL_CHANGELOG_SEED
        }
        return parsed
      }
    }
  } catch (e) {
    console.error('Failed to load changelog from localStorage', e)
  }
  try {
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(INITIAL_CHANGELOG_SEED))
  } catch {}
  return INITIAL_CHANGELOG_SEED
}

export function saveChangelogEntry(entry: Omit<ChangelogItem, 'id' | 'timestamp'>): ChangelogItem[] {
  if (typeof window === 'undefined') return []
  try {
    const current = getChangelogHistory()
    const now = new Date()
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const newEntry: ChangelogItem = {
      id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: formattedDate,
      ...entry,
    }

    const updated = [newEntry, ...current].slice(0, 100)
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.error('Failed to save changelog entry', e)
    return getChangelogHistory()
  }
}

export function deleteChangelogItem(id: string): ChangelogItem[] {
  if (typeof window === 'undefined') return []
  try {
    const current = getChangelogHistory()
    const filtered = current.filter((item) => item.id !== id)
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(filtered))
    return filtered
  } catch (e) {
    console.error('Failed to delete changelog item', e)
    return getChangelogHistory()
  }
}

export function clearChangelogHistory(): ChangelogItem[] {
  if (typeof window === 'undefined') return []
  try {
    localStorage.removeItem(CHANGELOG_KEY)
  } catch (e) {
    console.error('Failed to clear changelog history', e)
  }
  return []
}

export function resetChangelogToInitial(): ChangelogItem[] {
  if (typeof window === 'undefined') return INITIAL_CHANGELOG_SEED
  try {
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(INITIAL_CHANGELOG_SEED))
  } catch (e) {
    console.error('Failed to reset changelog', e)
  }
  return INITIAL_CHANGELOG_SEED
}

export interface PriceListItem {
  code: string
  name: string
  keywords: string[]
  meterPrice: number
  rollPrice: number
  meterUnit: string
  rollUnit: string
}

export const SOLAR_PRICELIST_2026: PriceListItem[] = [
  {
    code: 'SOL-028',
    name: 'Alpsolar 10.24kWh 200Ah Lithium Battery',
    keywords: ['alpsolar 10.24kwh', 'alpsolar 200ah', 'alpsolar battery', 'alpsolar 10.24kwh 200ah'],
    meterPrice: 70000,
    rollPrice: 70000,
    meterUnit: 'Unit',
    rollUnit: 'Unit',
  },
  {
    code: 'SOL-029',
    name: 'Alpsolar 16.07kWh 314Ah Lithium Battery',
    keywords: ['alpsolar 16.07kwh', 'alpsolar 314ah', 'alpsolar battery 314ah', 'alpsolar 16.07kwh 314ah'],
    meterPrice: 93000,
    rollPrice: 93000,
    meterUnit: 'Unit',
    rollUnit: 'Unit',
  },
  {
    code: 'SOL-030',
    name: 'Oliter 10.24kWh 200Ah Lithium Battery',
    keywords: ['oliter 10.24kwh', 'oliter 200ah', 'oliter battery', 'oliter 10.24kwh 200ah'],
    meterPrice: 70000,
    rollPrice: 70000,
    meterUnit: 'Unit',
    rollUnit: 'Unit',
  },
  {
    code: 'SOL-123',
    name: '10mm Battery Cable',
    keywords: ['battery cable 10mm', '10mm battery cable', '10mm cable'],
    meterPrice: 300,
    rollPrice: 23000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-124',
    name: '16mm Battery Cable',
    keywords: ['battery cable 16mm', '16mm battery cable', '16mm cable'],
    meterPrice: 400,
    rollPrice: 33000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-125',
    name: '25mm Battery Cable',
    keywords: ['battery cable 25mm', '25mm battery cable', '25mm cable'],
    meterPrice: 500,
    rollPrice: 43000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-126',
    name: '35mm Battery Cable',
    keywords: ['battery cable 35mm', '35mm battery cable', '35mm cable'],
    meterPrice: 600,
    rollPrice: 53000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-127',
    name: '50mm Battery Cable / 50mm2 AC Output Cable',
    keywords: ['battery cable 50mm', '50mm battery cable', '50mm cable', '50mm2 3-phase ac power output cable', '50mm2 ac power', '50mm2'],
    meterPrice: 700,
    rollPrice: 63000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-128',
    name: '70mm Battery Cable',
    keywords: ['battery cable 70mm', '70mm battery cable', '70mm cable'],
    meterPrice: 950,
    rollPrice: 83000,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-038',
    name: '1x4mm Solar Wire',
    keywords: ['1x4mm solar wire', '4mm solar wire', '4mm2 solar pv cable', '4mm solar cable', '1x4mm'],
    meterPrice: 42,
    rollPrice: 4200,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-039',
    name: '1x6mm Solar Wire / 6mm2 TUV Cable',
    keywords: ['1x6mm solar wire', '6mm solar wire', '6mm2 tuv dual-core solar pv cable', '6mm2 solar cable', '6mm2 tuv', '6mm solar cable', '1x6mm'],
    meterPrice: 125,
    rollPrice: 12500,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-040',
    name: '2x4mm Twin Core Solar Wire',
    keywords: ['2x4mm solar wire', '2x4mm twin core', '2x4mm'],
    meterPrice: 88,
    rollPrice: 8800,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-041',
    name: '2x6mm Twin Core Solar Wire',
    keywords: ['2x6mm solar wire', '2x6mm twin core', '2x6mm'],
    meterPrice: 128,
    rollPrice: 12800,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-047',
    name: 'HDPE Pipe 20mm',
    keywords: ['hdpe pipe 20mm', '20mm hdpe', '20mm diameter conduit'],
    meterPrice: 32.5,
    rollPrice: 6500,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-048',
    name: 'HDPE Pipe 25mm',
    keywords: ['hdpe pipe 25mm', '25mm hdpe', '25mm diameter conduit'],
    meterPrice: 34.5,
    rollPrice: 6900,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-049',
    name: 'HDPE Pipe 32mm',
    keywords: ['hdpe pipe 32mm', '32mm hdpe', '32mm diameter conduit'],
    meterPrice: 37.0,
    rollPrice: 7400,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-050',
    name: 'Flexible hose 40mm',
    keywords: ['flexible hose 40mm', 'flexible hose', '40mm flexible hose', 'hdpe pipe 40mm', '40mm hdpe', 'flexcon'],
    meterPrice: 124,
    rollPrice: 6200,
    meterUnit: 'M',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-092-AC',
    name: 'AC MCCB',
    keywords: ['ac mccb', 'ac mcb', 'ac circuit breaker', 'mccb'],
    meterPrice: 850,
    rollPrice: 850,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-092-B',
    name: 'Breaker box / Metal Enclosure 50x60',
    keywords: ['breaker box', 'metal enclosure', 'breaker box / metal enclosure 50x60', 'breaker box / metal enclosure'],
    meterPrice: 3000,
    rollPrice: 3000,
    meterUnit: 'PC',
    rollUnit: 'PC',
  },
  {
    code: 'SOL-170',
    name: 'Cable Tray 2m',
    keywords: ['cable tray', 'cable tray 2m', 'cable tray 560', 'tray'],
    meterPrice: 560,
    rollPrice: 560,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-110-25',
    name: 'Terminal lugs 25mm',
    keywords: ['terminal lugs 25mm', 'terminal lugs', 'lugs 25mm'],
    meterPrice: 40,
    rollPrice: 40,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-110-50',
    name: 'Terminal lugs 50mm',
    keywords: ['terminal lugs 50mm', 'terminal lugs', 'lugs 50mm'],
    meterPrice: 50,
    rollPrice: 50,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-124-AC',
    name: 'AC Wire #6 AWG 14mm²',
    keywords: ['ac wire #6 awg 14mm²', 'ac wire 14mm²', '#6 awg 14mm²', '14mm² ac wire', '#6 awg'],
    meterPrice: 14900 / 150,
    rollPrice: 14900,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-123-AC',
    name: 'AC Wire AWG #8',
    keywords: ['ac wire awg #8', 'ac wire #8', 'awg #8', '10mm² ac wire', '#8 awg'],
    meterPrice: 60.04,
    rollPrice: 9006,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-152',
    name: 'Ground Wire',
    keywords: ['ground wire', 'grounding wire', 'ground wire 6mm²', 'ground wire 10mm²'],
    meterPrice: 5888 / 150,
    rollPrice: 5888,
    meterUnit: 'Meters',
    rollUnit: 'Roll',
  },
  {
    code: 'SOL-031',
    name: 'Solar Railing 2.4m',
    keywords: ['railings 2.4m', 'solar railing 2.4m', 'solar railing', 'railing 2.4m', 'railings', 'railing'],
    meterPrice: 490,
    rollPrice: 490,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-090',
    name: 'DC SPD 600V 2-Pole',
    keywords: ['dc spd 600v', 'dc spd 600v 2-pole', '600v dc spd'],
    meterPrice: 500,
    rollPrice: 500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-091',
    name: 'DC SPD 1000V 2-Pole',
    keywords: ['dc spd 1000v', 'dc spd 1000v 2-pole', '1000v dc spd', 'dc spd 1000v dc'],
    meterPrice: 650,
    rollPrice: 650,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-095',
    name: 'DC MCCB 100A 2-Pole',
    keywords: ['dc mccb 100a', 'dc mccb 100a 2-pole', 'mccb for battery 100a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-096',
    name: 'DC MCCB 125A 2-Pole',
    keywords: ['dc mccb 125a', 'dc mccb 125a 2-pole', 'mccb for battery 125a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-097',
    name: 'DC MCCB 160A 2-Pole',
    keywords: ['dc mccb 160a', 'dc mccb 160a 2-pole', 'mccb for battery 160a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-098',
    name: 'DC MCCB 200A 2-Pole',
    keywords: ['dc mccb 200a', 'dc mccb 200a 2-pole', 'mccb for battery 200a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-099',
    name: 'DC MCCB 250A 2-Pole',
    keywords: ['dc mccb 250a', 'dc mccb 250a 2-pole', 'mccb for battery 250a'],
    meterPrice: 1400,
    rollPrice: 1400,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-100',
    name: 'DC MCCB 315A 3-Pole',
    keywords: ['dc mccb 315a', 'dc mccb 315a 3-pole', 'mccb for battery 315a', 'mccb for battery 300a', 'mccb for battery 350a'],
    meterPrice: 3800,
    rollPrice: 3800,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-101',
    name: 'DC MCCB 400A 3-Pole',
    keywords: ['dc mccb 400a', 'dc mccb 400a 3-pole', 'mccb for battery 400a'],
    meterPrice: 3800,
    rollPrice: 3800,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-101B',
    name: 'DC MCCB 613A / 630A Heavy Duty 3-Pole',
    keywords: ['dc mccb 600a', 'dc mccb 613a', 'dc mccb 630a', 'mccb for battery 500a', 'mccb for battery 600a', 'mccb for battery 613a', 'mccb for battery 630a'],
    meterPrice: 4500,
    rollPrice: 4500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-153',
    name: 'Ground Rod w/ Clamp 3 Meters',
    keywords: ['ground rod w/ clamp 3 meters', 'ground rod 3 meters', 'ground rod', 'grounding rod 1500mm', '1500mm grounding rod'],
    meterPrice: 750,
    rollPrice: 750,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-001',
    name: 'Jinko 620W Solar Panel',
    keywords: ['jinko 620w', 'jinko panel 620w', 'jinko 620'],
    meterPrice: 5750,
    rollPrice: 5750,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-002',
    name: 'Jinko 640W Solar Panel',
    keywords: ['jinko 640w', 'jinko panel 640w', 'jinko 640'],
    meterPrice: 5950,
    rollPrice: 5950,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-003',
    name: 'Jinko 650W Solar Panel',
    keywords: ['jinko 650w', 'jinko panel 650w', 'jinko 650'],
    meterPrice: 6050,
    rollPrice: 6050,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-004',
    name: 'Trina 620W Solar Panel',
    keywords: ['trina 620w', 'trina solar 620w', 'trina panel', 'trina 620'],
    meterPrice: 6200,
    rollPrice: 6200,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'TRINA-MONO-615W',
    name: 'Trina Mono 615W N-Type Solar Panel',
    keywords: ['trina 615w', 'trina mono 615w', 'trina 615'],
    meterPrice: 6000,
    rollPrice: 6000,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'DEYE-51.2V-314AH',
    name: 'DEYE 51.2V 314AH Lithium Battery',
    keywords: ['deye 314ah', 'deye 51.2v 314ah', 'deye battery 314ah'],
    meterPrice: 125000,
    rollPrice: 125000,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'DEYE-1P-6KW',
    name: 'DEYE 1P 6KW HYBRID 18/18A',
    keywords: ['deye 1p 6kw', 'deye 6kw hybrid'],
    meterPrice: 45000,
    rollPrice: 45000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-1P-8KW',
    name: 'DEYE 1P 8KW HYBRID 28/26A',
    keywords: ['deye 1p 8kw', 'deye 8kw hybrid'],
    meterPrice: 60000,
    rollPrice: 60000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-1P-12KW',
    name: 'DEYE 1P 12KW HYBRID',
    keywords: ['deye 1p 12kw', 'deye 12kw hybrid'],
    meterPrice: 88000,
    rollPrice: 88000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-1P-16KW',
    name: 'DEYE 1P 16KW HYBRID',
    keywords: ['deye 1p 16kw', 'deye 16kw hybrid'],
    meterPrice: 135000,
    rollPrice: 135000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-3P-12KW-LV',
    name: 'DEYE 3P 12KW LV HYBRID LV BATT',
    keywords: ['deye 3p 12kw', 'deye 3p 12kw lv'],
    meterPrice: 95000,
    rollPrice: 95000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-3P-20KW-LV',
    name: 'DEYE 3P 20KW LV HYBRID LV BATT',
    keywords: ['deye 3p 20kw', 'deye 3p 20kw lv'],
    meterPrice: 150000,
    rollPrice: 150000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-3P-30KW-LV',
    name: 'DEYE 3P 30KW LV HYBRID HV BATT',
    keywords: ['deye 3p 30kw', 'deye 3p 30kw lv'],
    meterPrice: 250000,
    rollPrice: 250000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-3P-50KW-380V',
    name: 'DEYE 3P 50KW 380V HYBRID HV BATT',
    keywords: ['deye 3p 50kw', 'deye 50kw 380v'],
    meterPrice: 280000,
    rollPrice: 280000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-3P-80KW-380V',
    name: 'DEYE 3P 80KW 380V HYBRID HV BATT',
    keywords: ['deye 3p 80kw', 'deye 80kw 380v'],
    meterPrice: 300000,
    rollPrice: 300000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-1P-3.6KW-GT',
    name: 'DEYE 1P-3.6KW GRID-TIE',
    keywords: ['deye 3.6kw grid-tie', 'deye 3.6kw grid tie'],
    meterPrice: 16000,
    rollPrice: 16000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-1P-6.0KW-GT',
    name: 'DEYE 1P-6.0KW GRID-TIE',
    keywords: ['deye 6.0kw grid-tie', 'deye 6kw grid tie'],
    meterPrice: 25000,
    rollPrice: 25000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-1P-8.0KW-GT',
    name: 'DEYE 1P-8.0KW GRID-TIE',
    keywords: ['deye 8.0kw grid-tie', 'deye 8kw grid tie'],
    meterPrice: 28000,
    rollPrice: 28000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'DEYE-1P-10.0KW-GT',
    name: 'DEYE 1P-10.0KW GRID-TIE',
    keywords: ['deye 10.0kw grid-tie', 'deye 10kw grid tie'],
    meterPrice: 35000,
    rollPrice: 35000,
    meterUnit: 'UNIT',
    rollUnit: 'UNIT',
  },
  {
    code: 'SOL-005',
    name: 'Seraphim 630W Solar Panel',
    keywords: ['seraphim 630w', 'seraphim panel', 'seraphim 630'],
    meterPrice: 5500,
    rollPrice: 5500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
  {
    code: 'SOL-006',
    name: 'Lesso 630W Solar Panel',
    keywords: ['lesso 630w', 'lesso panel', 'lesso 630'],
    meterPrice: 5500,
    rollPrice: 5500,
    meterUnit: 'PCS',
    rollUnit: 'PCS',
  },
]

export function getItemPricingInfo(
  description: string,
  itemState?: { meterPrice?: number; rollPrice?: number }
) {
  if (itemState?.meterPrice !== undefined && itemState?.rollPrice !== undefined) {
    return {
      supportsRollPricing: true,
      meterPrice: itemState.meterPrice,
      rollPrice: itemState.rollPrice,
      meterUnit: 'Meters',
      rollUnit: 'Roll',
    }
  }

  if (!description) return null
  const descLower = description.toLowerCase()

  const match = SOLAR_PRICELIST_2026.find((item) =>
    item.keywords.some((kw) => descLower.includes(kw))
  )

  if (match) {
    return {
      supportsRollPricing: true,
      code: match.code,
      name: match.name,
      meterPrice: match.meterPrice,
      rollPrice: match.rollPrice,
      meterUnit: match.meterUnit,
      rollUnit: match.rollUnit,
    }
  }

  return null
}
