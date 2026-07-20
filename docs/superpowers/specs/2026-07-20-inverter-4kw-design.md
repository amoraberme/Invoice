# Design Spec: 4kW Setup Inverter Price Update

Change the inverter used in the 4kW setup to a 4kW Hybrid Inverter with a price of ₱14,000.00.

## Context
Currently, the invoice generator supports solar BOQ sizing setup presets. When a user applies the **4kW Setup**, the application determines the inverter size by looking at `inverterSizes = [5, 6, 8, 10, 12, ...]` and finding the next size up (which is 5kW). The 5kW inverter is currently priced at ₱41,000.00.

This change introduces a `4` size to the inverter choices, ensuring that a 4kW setup uses a 4kW inverter priced at ₱14,000.00.

## Proposed Changes

### 1. `app/page.tsx`
Modify `handleGenerateBoq` to:
- Include `4` in the `inverterSizes` array.
- Add a conditional check for `inverterKw <= 4` to assign:
  - `inverterDesc = 'Inverter 4kW Hybrid'`
  - `inverterPrice = 14000.00`

```diff
     // 1. Inverter
-    const inverterSizes = [5, 6, 8, 10, 12, 16, 30, 50, 60, 75, 125]
+    const inverterSizes = [4, 5, 6, 8, 10, 12, 16, 30, 50, 60, 75, 125]
     let inverterKw = inverterSizes.find(s => s >= systemKw)
     if (inverterKw === undefined) {
       inverterKw = Math.ceil(systemKw)
     }
     
     let inverterDesc = `Inverter ${inverterKw}kW Hybrid`
     let inverterPrice = 0
-    if (inverterKw <= 5) {
-      inverterDesc = 'Inverter 5kW Hybrid'
-      inverterPrice = 41000.00
+    if (inverterKw <= 4) {
+      inverterDesc = 'Inverter 4kW Hybrid'
+      inverterPrice = 14000.00
+    } else if (inverterKw <= 5) {
+      inverterDesc = 'Inverter 5kW Hybrid'
+      inverterPrice = 41000.00
     } else if (inverterKw <= 6) {
```

## Verification Plan
1. Start development server.
2. Select "4kW Setup" from the Solar BOQ Sizing Setup sidebar section.
3. Verify that the generated BOQ has a line item:
   - Description: `Inverter 4kW Hybrid`
   - Quantity: `1 PC`
   - Rate: `₱14,000.00`
   - Total: `₱14,000.00`
4. Select "5kW Setup" and check that the inverter is still `Inverter 5kW Hybrid` with rate `₱41,000.00` to verify regression safety.
