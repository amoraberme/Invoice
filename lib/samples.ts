import { type Invoice } from './types'

const sampleToday = new Date()
const sampleDue = new Date()
sampleDue.setDate(sampleDue.getDate() + 15)

const BASE_INVOICE: Omit<Invoice, 'lineItems' | 'invoiceNumber' | 'subject'> = {
  fromName: 'MG SOLAR',
  fromEmail: 'charlotte.mgtrading@gmail.com',
  fromPhone: '+(63) 928 1655 179',
  fromAddress: 'Mintcor Townhomes, 55 Main Dr, Muntinlupa, 1770 Metro Manila',
  toName: '',
  toEmail: '',
  toAddress: '',
  issueDate: sampleToday.toISOString().split('T')[0],
  dueDate: sampleDue.toISOString().split('T')[0],
  currency: 'PHP',
  vatRate: 0,
  rateMarkup: 28,
  laborPricePerWatt: 6,
  excludeLaborMarkup: false,
  excludeBattery: false,
  isCondensed: false,
  withBrandName: true,
  theme: 'light',
  lalamoveCost: 0,
  additionalExpenses: [],
  bankBeneficiary: '',
  bankName: '',
  bankSortCode: '',
  bankAccount: '',
  bankSwift: '',
  note: 'All items are subject to availability.\nAny additional requests or changes may affect pricing and timeline.\nPlease be advised that all quoted prices, material specifications, quantities, and units of measure (UOM) provided in this document are preliminary estimates. Final pricing and project details are subject to change pending an on-site ocular inspection, roof assessment, structural verification, and evaluation of site-specific conditions.',
  salesPerson: 'charlotte',
  salesName: 'Charlotte C. Santos',
  salesPosition: 'Senior Sales & Marketing Executive',
  salesCompany: 'M&G Non-Specialized Wholesale Trading',
  salesContact: '+(63) 928 1655 179',
  salesEmail: 'charlotte.mgtrading@gmail.com',
  salutation: 'Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the following item based on your requirement.',
  closing: 'We are looking forward to building a long-term relationship as your reliable supplier.',
  ceoName: 'Mary Grace E. Santos',
  ceoPosition: 'Chief Executive Officer',
  terms: 'Payment Terms:\n- A 50% down payment is required upon confirmation of order.\n- The remaining 50% shall be paid upon delivery / within 7 days after billing.\n- Payments can be made via Bank Transfer / GCash / Check / Cash.\n\nPrice Validity:\n- This quotation is valid for 15 days from the date issued.\n- Prices may change after the validity period without prior notice.\n\nLate Payment Interest:\n- A penalty of 1/10% of the total contract will be charged on overdue balances.\n- Interest will be applied starting from the due date until full payment is received.\n- Delivery timeline: 2-3 working days after down payment\n- Delivery method: Pick-up | Delivery',
}

export const sample5Items: Invoice = {
  ...BASE_INVOICE,
  invoiceNumber: 'SAMPLE-5-ITEMS',
  subject: 'Sample Project - 5 Items',
  lineItems: [
    { id: 's5-1', description: 'Heavy Duty Safety Helmet - Blue', quantity: 50, rate: 320, unit: 'PCS' },
    { id: 's5-2', description: 'Reflective Safety Vest - Orange', quantity: 100, rate: 150, unit: 'PCS' },
    { id: 's5-3', description: 'Industrial Work Gloves (Pair)', quantity: 200, rate: 85, unit: 'PRS' },
    { id: 's5-4', description: 'Anti-Fog Safety Goggles', quantity: 50, rate: 120, unit: 'PCS' },
    { id: 's5-5', description: 'Steel-Toed Safety Boots', quantity: 20, rate: 1850, unit: 'PRS' },
  ]
}

export const sample20Items: Invoice = {
  ...BASE_INVOICE,
  invoiceNumber: 'SAMPLE-20-ITEMS',
  subject: 'Sample Project - 20 Items',
  lineItems: Array.from({ length: 20 }).map((_, i) => ({
    id: `s20-${i + 1}`,
    description: `Industrial Equipment Component #${i + 1} - Model ${String.fromCharCode(65 + (i % 26))}${i + 100}`,
    quantity: Math.floor(Math.random() * 50) + 1,
    rate: Math.floor(Math.random() * 1000) + 100,
    unit: i % 2 === 0 ? 'PCS' : 'UNT'
  }))
}
