export interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  unit: string
  pricingMode?: 'Meters' | 'Roll'
  meterPrice?: number
  rollPrice?: number
}

export interface ExpenseItem {
  id: string
  description: string
  amount: number
  category?: 'lalamove' | 'logistics' | 'permits' | 'meals' | 'additional' | 'other'
}

export interface WarrantyItem {
  id: string
  component: string
  warrantyType: string
  coverage: string
}

export interface Invoice {
  fromName: string
  fromEmail: string
  fromPhone: string
  fromAddress: string
  toName: string
  toEmail: string
  toAddress: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  currency: string
  vatRate: number
  rateMarkup: number
  laborPricePerWatt: number
  excludeLaborMarkup: boolean
  excludeBattery: boolean
  isCondensed: boolean
  withBrandName: boolean
  customTotal?: number
  discountAmount?: number
  theme: 'light' | 'dark' | 'barbie' | 'spiderman' | 'minion' | 'violet'
  lineItems: LineItem[]
  warranties?: WarrantyItem[]
  lalamoveCost: number
  additionalExpenses: ExpenseItem[]
  bankBeneficiary: string
  bankName: string
  bankSortCode: string
  bankAccount: string
  bankSwift: string
  note: string
  salesPerson: string
  salesName: string
  salesPosition: string
  salesCompany: string
  salesContact: string
  salesEmail: string
  terms: string
  subject: string
  salutation: string
  closing: string
  ceoName?: string
  ceoPosition?: string
}

export interface InvoiceHistoryItem {
  id: string
  savedAt: string
  invoiceNumber: string
  toName: string
  grandTotal: number
  currency: string
  itemCount: number
  invoice: Invoice
}

export interface ChangelogItem {
  id: string
  timestamp: string
  itemDescription: string
  changeType: 'price' | 'quantity' | 'unit' | 'addition' | 'deletion' | 'system'
  fieldChanged: string
  oldValue: string | number
  newValue: string | number
  unit?: string
  note?: string
  batch?: string
}

export function newLineItem(): LineItem {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return { id, description: '', quantity: 1, rate: 0, unit: '' }
}

export function newExpenseItem(description = '', amount = 0, category: ExpenseItem['category'] = 'additional'): ExpenseItem {
  const id = `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return { id, description, amount, category }
}

export function newWarrantyItem(component = '', warrantyType = 'Manufacturer Warranty', coverage = ''): WarrantyItem {
  const id = `warr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return { id, component, warrantyType, coverage }
}

export const defaultWarranties: WarrantyItem[] = [
  { id: 'w-1', component: 'Solar Panels', warrantyType: 'Manufacturer Warranty', coverage: '15 Years' },
  { id: 'w-2', component: 'Inverter', warrantyType: 'Manufacturer Warranty', coverage: '5 Years' },
  { id: 'w-3', component: 'Battery Storage', warrantyType: 'Manufacturer Warranty', coverage: '10 Years' },
  { id: 'w-4', component: 'Full System', warrantyType: 'Workmanship & Installation Services', coverage: '1 Year' },
]

const defaultToday = new Date()
const defaultDue = new Date()
defaultDue.setDate(defaultDue.getDate() + 15)

export const defaultInvoice: Invoice = {
  fromName: 'MG SOLAR',
  fromEmail: 'charlotte.mgtrading@gmail.com',
  fromPhone: '+(63) 928 1655 179',
  fromAddress: 'Mintcor Townhomes, 55 Main Dr, Muntinlupa, 1770 Metro Manila',
  toName: 'Commercial Client',
  toEmail: 'client@company.com',
  toAddress: 'Industrial Zone, Metro Manila',
  invoiceNumber: '',
  issueDate: defaultToday.toISOString().slice(0, 10),
  dueDate: defaultDue.toISOString().slice(0, 10),
  currency: 'PHP',
  vatRate: 0,
  rateMarkup: 30,
  laborPricePerWatt: 6,
  excludeLaborMarkup: false,
  excludeBattery: false,
  isCondensed: false,
  withBrandName: true,
  customTotal: undefined,
  discountAmount: 0,
  theme: 'light',
  warranties: defaultWarranties,
  lineItems: [
    {
      id: 'item-100k-1',
      description: 'GoodWe GW100K-HT 100kW 3-Phase HV Solar Inverter',
      quantity: 1,
      rate: 220000.00,
      unit: 'PC'
    },
    {
      id: 'item-100k-2',
      description: 'Gokin 650W Tier-1 Bifacial N-Type Solar Panels (154 pcs / 100.1 kWp)',
      quantity: 154,
      rate: 6500.00,
      unit: 'PCS'
    },
    {
      id: 'item-100k-3',
      description: 'Heavy Duty Aluminum Mounting Rails 3.5m & Splice Connectors',
      quantity: 88,
      rate: 950.00,
      unit: 'PCS'
    },
    {
      id: 'item-100k-4',
      description: 'Mid & End Clamp Assemblies + L-Foot Roof Mount Hooks',
      quantity: 340,
      rate: 55.00,
      unit: 'PCS'
    },
    {
      id: 'item-100k-5',
      description: 'Suntree 18-String PV Combiner Box with 1000V DC Fuses & Isolator',
      quantity: 2,
      rate: 12500.00,
      unit: 'PCS'
    },
    {
      id: 'item-100k-6',
      description: '1000V 3P DC SPD & 250A DC MCCB Protection Enclosure',
      quantity: 4,
      rate: 3885.00,
      unit: 'PCS'
    },
    {
      id: 'item-100k-7',
      description: '400V 3-Phase AC Breaker (200A) & AC Surge Protective Device',
      quantity: 1,
      rate: 10700.00,
      unit: 'SET'
    },
    {
      id: 'item-100k-8',
      description: '6mm2 TUV Dual-Core Solar PV Cable (400 meters)',
      quantity: 4,
      rate: 4800.00,
      unit: 'ROLL',
      pricingMode: 'Roll',
      meterPrice: 12.00,
      rollPrice: 4800.00
    },
    {
      id: 'item-100k-9',
      description: '50mm2 3-Phase AC Power Output Cable & Heavy Duty Conduits',
      quantity: 120,
      rate: 700.00,
      unit: 'M',
      pricingMode: 'Meters',
      meterPrice: 700.00,
      rollPrice: 63000.00
    },
    {
      id: 'item-100k-10',
      description: 'GoodWe SEC1000 Smart Energy Controller & 3-Phase Meter with CTs',
      quantity: 1,
      rate: 28000.00,
      unit: 'SET'
    },
    {
      id: 'item-100k-11',
      description: 'System Engineering, Structural Mounting & Grid-Tie Commissioning',
      quantity: 1,
      rate: 600600.00,
      unit: 'LOT'
    },
    {
      id: 'item-100k-12',
      description: 'Delivery Fees',
      quantity: 1,
      rate: 5000.00,
      unit: 'LOT'
    }
  ],
  lalamoveCost: 0,
  additionalExpenses: [],
  bankBeneficiary: 'M&G Non-Specialized Wholesale Trading',
  bankName: 'BDO / BPI',
  bankSortCode: '',
  bankAccount: '1234-5678-9012',
  bankSwift: '',
  note: 'All items are subject to availability.\nAny additional requests or changes may affect pricing and timeline.\nPlease be advised that all quoted prices, material specifications, quantities, and units of measure (UOM) provided in this document are preliminary estimates. Final pricing and project details are subject to change pending an on-site ocular inspection, roof assessment, structural verification, and evaluation of site-specific conditions.',
  salesPerson: 'charlotte',
  salesName: 'Charlotte C. Santos',
  salesPosition: 'Senior Sales & Marketing Executive',
  salesCompany: 'M&G Non-Specialized Wholesale Trading',
  salesContact: '+(63) 928 1655 179',
  salesEmail: 'charlotte.mgtrading@gmail.com',
  subject: '100kW Commercial Solar PV System Proposal (30% Margin)',
  salutation: 'Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the 100kW Commercial Solar System based on your requirement.',
  closing: 'We are looking forward to building a long-term relationship as your reliable supplier.',
  ceoName: 'Mary Grace E. Santos',
  ceoPosition: 'Chief Executive Officer',
  terms: 'Payment Terms:\n- Full payment after Installation.\n- Payments can be made via Cash / Bank Transfer / Credit Card / Crypto / Gold.\n\nPrice Validity:\n- This quotation is valid for 15 days from the date issued.\n- Prices may change after the validity period without prior notice.\n\nLate Payment Interest:\n- A penalty of 1/10% of the total contract will be charged on overdue balances.\n- Interest will be applied starting from the due date until full payment is received.\n\nDelivery Terms:\n- Delivery timeline: 2-3 working days\n- Delivery method: Pick-up | Delivery',
}
