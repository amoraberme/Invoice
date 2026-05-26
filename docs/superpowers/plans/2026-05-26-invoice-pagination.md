# Invoice Pagination and Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pagination for the invoice (9 items per page) and fix the line item table layout to handle long descriptions without column shifting.

**Architecture:** Use a helper to chunk line items into groups of 9. Map over these chunks to render multiple "paper" containers. Ensure totals/notes move to a new page if the last item chunk is full. Apply fixed widths and wrapping styles to the table columns.

**Tech Stack:** React, TypeScript, Tailwind CSS.

---

### Task 1: Add `chunkItems` Utility

**Files:**
- Modify: `lib/utils.ts`

- [ ] **Step 1: Add the `chunkItems` helper function**

```typescript
export function chunkItems<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
```

- [ ] **Step 2: Commit changes**

```bash
git add lib/utils.ts
git commit -m "feat: add chunkItems utility for pagination"
```

---

### Task 2: Refactor `MGInvoicePreview` for Table Layout Fixes

**Files:**
- Modify: `components/mg-invoice-preview.tsx`

- [ ] **Step 1: Apply fixed widths and wrapping to table columns**

Modify the table header and row items to use `shrink-0` and fixed widths.

```tsx
// Header
<div className="flex py-2.5 border-b-[1.5px] border-[#111111]">
  <span className="flex-1 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase">
    Description
  </span>
  <span className="w-14 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-center">
    Qty
  </span>
  <span className="w-32 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
    Rate
  </span>
  <span className="w-32 shrink-0 text-[10px] font-semibold text-[#111111] tracking-[0.07em] uppercase text-right">
    Amount
  </span>
</div>

// Row
<div key={item.id} className="flex py-3.5 border-b border-[#E5E5E5] items-start">
  <span className="flex-1 text-[13px] text-[#111111] break-words whitespace-pre-wrap pr-4">
    {item.description || '—'}
  </span>
  <span className="w-14 shrink-0 text-[13px] text-[#888888] text-center">
    {item.quantity}
  </span>
  <span className="w-32 shrink-0 text-[13px] text-[#888888] text-right">
    {formatCurrency(item.rate, invoice.currency)}
  </span>
  <span className="w-32 shrink-0 text-[13px] font-medium text-[#111111] text-right">
    {formatCurrency(item.quantity * item.rate, invoice.currency)}
  </span>
</div>
```

- [ ] **Step 2: Commit changes**

```bash
git add components/mg-invoice-preview.tsx
git commit -m "fix: enforce fixed column widths and description wrapping in invoice table"
```

---

### Task 3: Implement Pagination Logic in `MGInvoicePreview`

**Files:**
- Modify: `components/mg-invoice-preview.tsx`

- [ ] **Step 1: Chunk items and determine page count**

```tsx
import { chunkItems } from '@/lib/utils'

// Inside MGInvoicePreview component
const itemChunks = chunkItems(invoice.lineItems, 9)
// If last chunk is full, we need an extra page for totals
const needsExtraPage = itemChunks[itemChunks.length - 1].length === 9
const totalPages = itemChunks.length + (needsExtraPage ? 1 : 0)
```

- [ ] **Step 2: Wrap the paper content in a loop over pages**

Refactor the JSX to map over pages. Each page repeats the header.

```tsx
{Array.from({ length: totalPages }).map((_, pageIndex) => {
  const isLastPage = pageIndex === totalPages - 1
  const currentPageItems = itemChunks[pageIndex] || []

  return (
    <div key={pageIndex} className="mb-8 last:mb-0 print:mb-0 print:break-after-page">
       <div style={{ width: PAPER_W * scale, height: PAPER_H * scale }} className="print:!w-full print:!h-auto">
          <div
            style={{ width: PAPER_W, height: PAPER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            className="relative bg-white rounded-sm shadow-[0_4px_32px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] px-14 py-14 print:!transform-none print:shadow-none print:rounded-none print:!w-full print:!h-auto print:m-0"
          >
            {/* Header Content (Copied from original) */}
            {/* Bill To Content (Copied from original) */}

            {/* Table with currentPageItems */}
            {/* ... table header ... */}
            {currentPageItems.map(item => (
               /* ... row content from Task 2 ... */
            ))}

            {/* Totals, Bank Details, Note (Only on isLastPage) */}
            {isLastPage && (
              <>
                {/* ... Totals ... */}
                {/* ... Bank Details ... */}
                {/* ... Note ... */}
              </>
            )}

            {/* Page Number Indicator */}
            <div className="absolute bottom-10 right-14 text-[10px] text-[#AAAAAA]">
              Page {pageIndex + 1} of {totalPages}
            </div>
          </div>
       </div>
    </div>
  )
})}
```

- [ ] **Step 3: Commit changes**

```bash
git add components/mg-invoice-preview.tsx
git commit -m "feat: implement multi-page invoice pagination"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Manually test with 5 items (1 page)**
- [ ] **Step 2: Manually test with 9 items (2 pages, totals on 2nd)**
- [ ] **Step 3: Manually test with 10 items (2 pages, totals on 2nd)**
- [ ] **Step 4: Manually test with 18 items (3 pages, totals on 3rd)**
- [ ] **Step 5: Verify long descriptions don't break layout**
