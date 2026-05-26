'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMGInvoice } from '@/lib/use-mg-invoice'
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

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1 min-w-0', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

const SALESPEOPLE = [
  { id: 'custom', name: 'Custom / None', position: '', company: '' },
  { id: 'john', name: 'John Doe', position: 'Senior Sales Executive', company: 'MG Office Solutions' },
  { id: 'jane', name: 'Jane Smith', position: 'Account Manager', company: 'MG Office Solutions' },
  { id: 'robert', name: 'Robert Johnson', position: 'Sales Director', company: 'MG Office Solutions' },
]

export default function Home() {
  const { invoice, loaded, update, updateItem, addItem, removeItem } = useMGInvoice()
  const autoPrint = useRef(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('print') === 'true')
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)

  useEffect(() => {
    if (!loaded || !autoPrint.current) return
    const timer = setTimeout(() => {
      const parts = [invoice.invoiceNumber, invoice.fromName].filter(Boolean)
      document.title = parts.length > 0 ? parts.join(' - ') : 'invoice'
      window.print()
      window.onafterprint = () => {
        document.title = 'MG Invoice'
        window.onafterprint = null
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [loaded])

  const handleDownload = () => {
    const original = document.title
    const parts = [invoice.invoiceNumber, invoice.fromName].filter(Boolean)
    document.title = parts.length > 0 ? parts.join(' - ') : 'invoice'
    window.print()
    window.onafterprint = () => {
      document.title = original
      window.onafterprint = null
    }
  }

  const handleSalesPersonChange = (val: string) => {
    const person = SALESPEOPLE.find((p) => p.id === val)
    if (person) {
      update('salesPerson', val)
      if (val !== 'custom') {
        update('salesName', person.name)
        update('salesPosition', person.position)
        update('salesCompany', person.company)
      }
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#F5F5F5] print:bg-white">
      {/* ── SIDEBAR ── */}
      <aside className="w-full md:w-[380px] md:h-screen bg-white border-b md:border-b-0 md:border-r border-[#E5E5E5] flex flex-col shrink-0 print:hidden">
        {/* Logo */}
        <div className="flex items-center px-6 py-[22px] border-b border-[#E5E5E5] shrink-0">
          <span className="font-bold text-[17px] text-[#111111] tracking-tight">MG Invoice</span>
        </div>

        {/* Scrollable form */}
        <div className="md:flex-1 md:overflow-y-auto px-6 py-6 space-y-7 md:min-h-0">
          {/* SALES QUOTATION BY */}
          <section className="space-y-3">
            <SectionHeader>Sales Quotation By</SectionHeader>
            <div className="space-y-2">
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
                  placeholder="Sales Executive"
                />
              </Field>
              <Field label="Company Name">
                <Input
                  value={invoice.salesCompany || ''}
                  onChange={(e) => {
                    update('salesCompany', e.target.value)
                    if (invoice.salesPerson !== 'custom') update('salesPerson', 'custom')
                  }}
                  placeholder="Company Name"
                />
              </Field>
            </div>
          </section>

          {/* FROM */}
          <section className="space-y-3">
            <SectionHeader>From</SectionHeader>
            <div className="space-y-2">
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

          {/* BILL TO */}
          <section className="space-y-3">
            <SectionHeader>Bill To</SectionHeader>
            <div className="space-y-2">
              <Field label="Client name">
                <Input
                  value={invoice.toName}
                  onChange={(e) => update('toName', e.target.value)}
                  placeholder="Meridian Group"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={invoice.toEmail}
                  onChange={(e) => update('toEmail', e.target.value)}
                  placeholder="client@email.com"
                />
              </Field>
              <Field label="Address">
                <Textarea
                  value={invoice.toAddress}
                  onChange={(e) => update('toAddress', e.target.value)}
                  placeholder="456 Client St, New York"
                  rows={2}
                />
              </Field>
            </div>
          </section>

          {/* BANK DETAILS */}
          <section className="space-y-3">
            <SectionHeader>Bank Details</SectionHeader>
            <div className="space-y-2">
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

          {/* INVOICE DETAILS */}
          <section className="space-y-3">
            <SectionHeader>Invoice Details</SectionHeader>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Invoice #">
                  <Input
                    value={invoice.invoiceNumber}
                    onChange={(e) => update('invoiceNumber', e.target.value)}
                    placeholder="INV-0001"
                  />
                </Field>
                <Field label="Issue Date">
                  <DatePicker
                    value={invoice.issueDate}
                    onChange={(v) => update('issueDate', v)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Due Date">
                  <DatePicker
                    value={invoice.dueDate}
                    onChange={(v) => update('dueDate', v)}
                    placeholder="No due date"
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
              <Field label="VAT %">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={invoice.vatRate || ''}
                  onChange={(e) => update('vatRate', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </Field>
            </div>
          </section>

          {/* LINE ITEMS */}
          <section className="space-y-3">
            <SectionHeader>Line Items</SectionHeader>
            <div className="space-y-1.5">
              {/* Column headers */}
              <div className="flex gap-2 px-1">
                <span className="flex-1 text-[11px] font-medium text-[#888888]">Description</span>
                <span className="w-12 text-[11px] font-medium text-[#888888] text-center">Unit</span>
                <span className="w-10 text-[11px] font-medium text-[#888888] text-center">Qty</span>
                <span className="w-[72px] text-[11px] font-medium text-[#888888] text-right">Rate</span>
                <span className="w-5" />
              </div>

              {/* Item rows */}
              {invoice.lineItems.map((item) => (
                <div key={item.id} className="flex gap-2 items-center">
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
                  <Input
                    className="w-[72px] px-2 text-right"
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeItem(item.id)}
                    className="text-[#CCCCCC] hover:text-[#888888] hover:bg-transparent shrink-0"
                    aria-label="Remove item"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}

              {/* Add item */}
              <Button
                variant="outline"
                onClick={addItem}
                className="w-full h-[34px] border-dashed border-[#CCCCCC] text-[12px] font-medium text-[#888888] hover:border-[#888888] hover:text-[#555555] hover:bg-transparent mt-1"
              >
                <Plus size={13} />
                Add item
              </Button>
            </div>
          </section>

          {/* NOTES */}
          <section className="space-y-3">
            <SectionHeader>Note</SectionHeader>
            <Textarea
              value={invoice.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder="Payment terms, thank you note, or any additional details…"
              rows={3}
            />
          </section>

          {/* TERMS */}
          <section className="space-y-3">
            <SectionHeader>Terms</SectionHeader>
            <Textarea
              value={invoice.terms}
              onChange={(e) => update('terms', e.target.value)}
              placeholder="Structured terms and conditions..."
              rows={4}
            />
          </section>
        </div>

        {/* Download button */}
        <div className="px-6 pb-6 pt-4 border-t border-[#E5E5E5] shrink-0">
          <Button
            onClick={handleDownload}
            className="w-full h-11 rounded-[10px] text-[14px] font-semibold"
          >
            <Download size={15} strokeWidth={2} />
            Download PDF
          </Button>
        </div>
      </aside>

      <MGInvoicePreview invoice={invoice} onOpenCheatsheet={() => setCheatsheetOpen(true)} />

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
              ['dueDate', 'Due date (YYYY-MM-DD)'],
              ['currency', 'Currency code'],
              ['vatRate', 'VAT %'],
              ['bankBeneficiary', 'Beneficiary'],
              ['bankName', 'Bank name'],
              ['bankSortCode', 'Sort Code / Routing'],
              ['bankAccount', 'Account / IBAN'],
              ['bankSwift', 'SWIFT / BIC'],
              ['note', 'Note / additional details'],
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
