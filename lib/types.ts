export interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  unit: string
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
  lineItems: LineItem[]
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
}

export function newLineItem(): LineItem {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return { id, description: '', quantity: 1, rate: 0, unit: '' }
}

export const defaultInvoice: Invoice = {
  fromName: 'MG SOLAR',
  fromEmail: 'charlotte.mgtrading@gmail.com',
  fromPhone: '+(63) 928 1655 179',
  fromAddress: 'Mintcor Townhomes, 55 Main Dr, Muntinlupa, 1770 Metro Manila',
  toName: '',
  toEmail: '',
  toAddress: '',
  invoiceNumber: 'MG-QT-260709095802',
  issueDate: '2026-05-04',
  dueDate: '',
  currency: 'PHP',
  vatRate: 0,
  rateMarkup: 0,
  lineItems: [],
  bankBeneficiary: '',
  bankName: '',
  bankSortCode: '',
  bankAccount: '',
  bankSwift: '',
  note: 'All items are subject to availability.\nAny additional requests or changes may affect pricing and timeline.',
  salesPerson: 'charlotte',
  salesName: 'Charlotte C. Santos',
  salesPosition: 'Senior Sales & Marketing Executive',
  salesCompany: 'M&G Non-Specialized Wholesale Trading',
  salesContact: '+(63) 928 1655 179',
  salesEmail: 'charlotte.mgtrading@gmail.com',
  subject: '',
  salutation: 'Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the following item based on your requirement.',
  closing: 'We are looking forward to building a long-term relationship as your reliable supplier.',
  terms: 'Payment Terms:\n- A 50% down payment is required upon confirmation of order.\n- The remaining 50% shall be paid upon delivery / within 7 days after billing.\n- Payments can be made via Bank Transfer / GCash / Check / Cash.\n\nPrice Validity:\n- This quotation is valid for 15-30 days from the date issued.\n- Prices may change after the validity period without prior notice.\n\nLate Payment Interest:\n- A penalty of 1/10% of the total contract will be charged on overdue balances.\n- Interest will be applied starting from the due date until full payment is received.\n\nDelivery Terms:\n- Delivery timeline: 2-3 working days after down payment\n- Delivery method: Pick-up | Delivery',
}
