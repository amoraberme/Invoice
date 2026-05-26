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
  terms: string
}

export function newLineItem(): LineItem {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return { id, description: '', quantity: 1, rate: 0, unit: '' }
}

export const defaultInvoice: Invoice = {
  fromName: '',
  fromEmail: '',
  fromPhone: '',
  fromAddress: '',
  toName: '',
  toEmail: '',
  toAddress: '',
  invoiceNumber: 'INV-0001',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  currency: 'USD',
  vatRate: 0,
  lineItems: [newLineItem()],
  bankBeneficiary: '',
  bankName: '',
  bankSortCode: '',
  bankAccount: '',
  bankSwift: '',
  note: '',
  salesPerson: '',
  salesName: '',
  salesPosition: '',
  salesCompany: '',
  terms: '1. All payments should be made to the designated bank account.\n2. Payment is due within 30 days of the invoice date.\n3. Goods remain company property until fully paid.',
}
