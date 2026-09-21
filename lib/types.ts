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

export interface ScopeOfWorkItem {
  id: string
  letter: string
  title: string
  subtitle?: string
  description: string
  enabled?: boolean
}

export interface SystemLifespanItem {
  id: string
  component: string
  lifespan: string
  bulletPoints: string[]
  enabled?: boolean
}

export interface SystemLifespanConfig {
  enabled: boolean
  overviewTitle: string
  overviewDescription: string
  items: SystemLifespanItem[]
  determinantsTitle: string
  determinants: string[]
}

export function getDefaultSystemLifespan(): SystemLifespanConfig {
  return {
    enabled: true,
    overviewTitle: 'System Lifespan (25–30 Years)',
    overviewDescription: 'Overall lifespan matches panels; power electronics and storage require scheduled mid-life replacements.',
    items: [
      {
        id: 'life-panels',
        component: 'Solar Panels',
        lifespan: '25–30+ Yrs',
        bulletPoints: [
          '~0.5%/yr degradation; ≥80% output guaranteed at 25 yrs. Operates 30+ yrs.'
        ],
        enabled: true
      },
      {
        id: 'life-inverters',
        component: 'String & Hybrid Inverters',
        lifespan: '10–15 Yrs',
        bulletPoints: [
          'Heavy thermal load; scheduled mid-life capacitor replacement at 10–15 yrs.'
        ],
        enabled: true
      },
      {
        id: 'life-batteries',
        component: 'LiFePO4 Batteries',
        lifespan: '10–15 Yrs',
        bulletPoints: [
          '6,000+ cycles at 80%–90% DoD; ~10–15 yrs daily cycling to 70% capacity.'
        ],
        enabled: true
      }
    ],
    determinantsTitle: 'Key Determinants',
    determinants: [
      'Adequate ventilation',
      'DC/AC surge & grounding protection',
      'Periodic panel cleaning'
    ]
  }
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
  discountAmount?: number
  theme: 'light' | 'dark' | 'barbie' | 'spiderman' | 'minion' | 'violet'
  lineItems: LineItem[]
  scopes?: ScopeOfWorkItem[]
  warranties?: WarrantyItem[]
  lalamoveCost: number
  deliveryLocation?: string
  deliveryDistanceKm?: number
  deliveryFee?: number
  isExceedingServiceArea?: boolean
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
  showSystemLifespan?: boolean
  systemLifespan?: SystemLifespanConfig
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

export function newScopeItem(letter = 'A', title = '', subtitle = '', description = ''): ScopeOfWorkItem {
  const id = `scope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  return { id, letter, title, subtitle, description, enabled: true }
}

export const defaultWarranties: WarrantyItem[] = [
  { id: 'w-1', component: 'Solar Panels', warrantyType: 'Manufacturer Warranty', coverage: '15 Years' },
  { id: 'w-2', component: 'Inverter', warrantyType: 'Manufacturer Warranty', coverage: '5 Years' },
  { id: 'w-3', component: 'Battery Storage', warrantyType: 'Manufacturer Warranty', coverage: '5 Years' },
  { id: 'w-4', component: 'Full System', warrantyType: 'Workmanship & Installation Services', coverage: '2 Years' },
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
  rateMarkup: 25,
  laborPricePerWatt: 6,
  excludeLaborMarkup: false,
  excludeBattery: false,
  isCondensed: false,
  withBrandName: true,
  discountAmount: 0,
  theme: 'light',
  warranties: defaultWarranties,
  lineItems: [
    {
      id: 'boq-30k-1',
      description: '',
      quantity: 1,
      rate: 0,
      unit: 'PC'
    },
    {
      id: 'boq-30k-2',
      description: '51.2V 314Ah Battery',
      quantity: 4,
      rate: 88000.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-3',
      description: 'Tongwei Panel 630W (7.82ft x 3.72ft)',
      quantity: 96,
      rate: 5800.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-4',
      description: 'DC Breaker 50amp',
      quantity: 12,
      rate: 420.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-5',
      description: 'AC Breaker 125amp',
      quantity: 8,
      rate: 1300.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-6',
      description: 'DC SPD 40kva',
      quantity: 8,
      rate: 790.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-7',
      description: 'AC SPD 40kva',
      quantity: 12,
      rate: 570.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-8',
      description: 'DC MCCB 125amp',
      quantity: 4,
      rate: 2500.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-9',
      description: 'Railings 2.4m',
      quantity: 100,
      rate: 420.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-10',
      description: 'End Clamp',
      quantity: 50,
      rate: 29.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-11',
      description: 'Mid Clamp',
      quantity: 180,
      rate: 29.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-12',
      description: 'Ground Lug',
      quantity: 8,
      rate: 35.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-13',
      description: 'L-Foot',
      quantity: 288,
      rate: 50.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-14',
      description: 'Grounding Rod',
      quantity: 1,
      rate: 750.00,
      unit: 'PC'
    },
    {
      id: 'boq-30k-15',
      description: 'ATS 250amp',
      quantity: 1,
      rate: 4000.00,
      unit: 'PC'
    },
    {
      id: 'boq-30k-16',
      description: 'Combiner Box 20×40×50cm',
      quantity: 2,
      rate: 3000.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-17',
      description: 'Battery Wire 50mm',
      quantity: 16,
      rate: 700.00,
      unit: 'M'
    },
    {
      id: 'boq-30k-18',
      description: 'Terminal Lugs 50mm',
      quantity: 20,
      rate: 50.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-19',
      description: 'PV Wire 6mm',
      quantity: 4,
      rate: 4800.00,
      unit: 'ROLL'
    },
    {
      id: 'boq-30k-20',
      description: 'MC4 Connectors',
      quantity: 48,
      rate: 60.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-21',
      description: 'MC4 2strings',
      quantity: 10,
      rate: 550.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-22',
      description: 'THHN Wire #6',
      quantity: 100,
      rate: 99.34,
      unit: 'M'
    },
    {
      id: 'boq-30k-23',
      description: 'HDPE Pipe 1"',
      quantity: 100,
      rate: 95.00,
      unit: 'M'
    },
    {
      id: 'boq-30k-24',
      description: 'Clip Lock 1"',
      quantity: 60,
      rate: 180.00,
      unit: 'SET'
    },
    {
      id: 'boq-30k-25',
      description: 'Sealant',
      quantity: 6,
      rate: 400.00,
      unit: 'PCS'
    },
    {
      id: 'boq-30k-26',
      description: 'Labor and Installation',
      quantity: 1,
      rate: 362880.00,
      unit: 'LOT'
    },
    {
      id: 'boq-30k-27',
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
  showSystemLifespan: true,
  systemLifespan: getDefaultSystemLifespan(),
  terms: 'Payment Terms:\n- Full payment after Installation.\n- Payments can be made via Cash / Bank Transfer / Credit Card / Crypto / Gold.\n\nPrice Validity:\n- This quotation is valid for 15 days from the date issued.\n- Prices may change after the validity period without prior notice.\n\nLate Payment Interest:\n- A penalty of 1/10% of the total contract will be charged on overdue balances.\n- Interest will be applied starting from the due date until full payment is received.\n\nDelivery Terms:\n- Delivery timeline: 2-3 working days\n- Delivery method: Pick-up | Delivery',
}
