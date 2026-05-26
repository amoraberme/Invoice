# Invoice Pagination and Layout Fix Design

## 1. Overview
The goal is to implement pagination for the MG Invoice application, ensuring that invoices with more than 9 line items are split across multiple pages. Additionally, the design of the line item table will be improved to handle long descriptions without distorting column widths.

## 2. Requirements
- **Pagination**: Split line items into pages with a limit of 9 items per page.
- **Header/Footer Consistency**: Repeat the header on every page. Add a "Page X of Y" indicator.
- **Totals Placement**: Totals, bank details, and notes should appear on the final page. If the final page of items is full (9 items), these sections should move to a new dedicated page.
- **Layout Fix**: Ensure "Qty", "Rate", and "Amount" columns have fixed widths and do not shift when descriptions are long. Descriptions must wrap to the next line.

## 3. Architecture & Implementation

### 3.1 Data Transformation
We will implement a function `chunkItems` to split `invoice.lineItems` into arrays of up to 9 items.

```typescript
function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
```

### 3.2 Component Structure (`MGInvoicePreview`)
The component will be refactored to iterate over the generated pages:

- **Page Container**: Each page will be rendered as a separate `div` with `PAPER_W` and `PAPER_H` styles, ensuring standard A4 sizing.
- **Line Item Table**: Each page's table will only display its respective chunk of items.
- **Layout Fixes**:
  - `Qty` column: Fixed width (`w-14`), `shrink-0`.
  - `Rate` column: Fixed width (`w-32`), `shrink-0`.
  - `Amount` column: Fixed width (`w-32`), `shrink-0`.
  - `Description`: `flex-1`, `break-words`, `whitespace-pre-wrap`.
  - Row: `items-start` alignment.

### 3.3 Conditional Rendering for Totals
The "Totals", "Payment Details", and "Note" sections will only render on the last page. A check will be added: if the last page of items is already full (9 items), an additional page will be created just for the totals/notes.

### 3.4 Page Numbering
A simple `Page ${index + 1} of ${totalPages}` indicator will be placed in the bottom right corner of each page's content area.

## 4. Testing Strategy
- **Manual Verification**: Add 10+ items to the invoice and verify the split.
- **Visual Check**: Test with extremely long descriptions to ensure columns don't shift.
- **Edge Case**: Exactly 9 items (should trigger a 2nd page for totals).
- **Edge Case**: 18 items (should trigger a 3rd page for totals).
