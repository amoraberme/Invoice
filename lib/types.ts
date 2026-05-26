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
  subject: string
  salutation: string
  closing: string
}

export function newLineItem(): LineItem {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return { id, description: '', quantity: 1, rate: 0, unit: '' }
}

export const defaultInvoice: Invoice = {
  fromName: 'M&G Solutions',
  fromEmail: 'sales@mgsolutions.com',
  fromPhone: '+63 2 123 4567',
  fromAddress: 'M&G Building, Pasig City, Metro Manila',
  toName: 'Johan Corporation',
  toEmail: 'procurement@johan.com',
  toAddress: 'Marikina City',
  invoiceNumber: 'JM-2026-00805',
  issueDate: '2026-05-04',
  dueDate: '',
  currency: 'PHP',
  vatRate: 0,
  lineItems: [
    { id: 'item-1', description: 'Safety Helmet Blue', quantity: 40, rate: 286.5, unit: 'PCS' },
    { id: 'item-2', description: 'Safety Helmet Yellow', quantity: 40, rate: 286.5, unit: 'PCS' },
    { id: 'item-3', description: 'Safety Helmet White', quantity: 40, rate: 286.5, unit: 'PCS' },
    { id: 'item-4', description: 'Safety Helmet Brown', quantity: 40, rate: 286.5, unit: 'PCS' }
  ],
  bankBeneficiary: 'M&G Solutions Inc.',
  bankName: 'BDO Unibank',
  bankSortCode: '',
  bankAccount: '1234-5678-9012',
  bankSwift: 'BDOUPHMM',
  note: 'Payment Terms:\n- A 50% down payment is required upon confirmation of order.\n- The remaining 50% shall be paid upon delivery / within 7 days after billing.\n- Payments can be made via Bank Transfer / GCash / Check / Cash.\n\nPrice Validity:\n- This quotation is valid for 15-30 days from the date issued.\n- Prices may change after the validity period without prior notice.',
  salesPerson: 'john',
  salesName: 'John Doe',
  salesPosition: 'Senior Sales Executive',
  salesCompany: 'M&G Solutions',
  subject: 'Supply & Deliver Safety Hats',
  salutation: 'Dear Madam/Sir,\n\nWe are pleased to submit to you our offer on the following item based on your requirement.',
  closing: 'We are looking forward to building a long-term relationship as your reliable supplier.',
}
