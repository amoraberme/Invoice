# Design Spec: Default Rate Adjustment (Markup) to 25%

Change the default rate markup/adjustment percentage from 0% to 25%.

## Context
The application supports a "Rate Adjustment %" (internally `rateMarkup`) to apply a markup to all line items. Currently, this defaults to `0` in both `defaultInvoice` and `BASE_INVOICE` (used for samples). The user wants the default rate adjustment to be 25%.

## Proposed Changes

### 1. `lib/types.ts`
Update `defaultInvoice`:
```diff
 export const defaultInvoice: Invoice = {
   ...
-  rateMarkup: 0,
+  rateMarkup: 25,
   ...
 }
```

### 2. `lib/samples.ts`
Update `BASE_INVOICE`:
```diff
 const BASE_INVOICE: Omit<Invoice, 'lineItems' | 'invoiceNumber' | 'subject'> = {
   ...
-  rateMarkup: 0,
+  rateMarkup: 25,
   ...
 }
```

## Verification Plan
1. Reset database/clear IndexedDB or load a fresh invoice.
2. Verify that the "Rate Adjustment %" input field defaults to `25`.
3. Verify that the preview displays the 25% markup rate adjustment correctly on line items.
