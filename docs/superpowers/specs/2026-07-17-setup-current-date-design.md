# Design Spec: Set Current Date on Setup Click and Clean Workspace

## Overview
When the user clicks any Solar BOQ Sizing Setup button (presets or custom kW setup), the invoice's issue date should automatically be updated to the current local date. Additionally, other modifications in the workspace (specifically, changes to `public/package-guide.html`) should be reverted.

## Proposed Changes

### 1. Update Date on Setup Click
In `app/page.tsx`, within the `handleGenerateBoq` function, calculate the current date in `YYYY-MM-DD` format and update the `issueDate` field when setting the invoice state.

```typescript
const today = new Date()
const yyyy = today.getFullYear()
const mm = String(today.getMonth() + 1).padStart(2, '0')
const dd = String(today.getDate()).padStart(2, '0')
const currentDateStr = `${yyyy}-${mm}-${dd}`

setInvoice((prev) => ({
  ...prev,
  lineItems: items,
  subject: `${systemKw}kW Hybrid System with Battery`,
  issueDate: currentDateStr
}))
```

### 2. Discard Workspace Changes
Revert local modifications to `public/package-guide.html` via:
```bash
git restore public/package-guide.html
```

## Verification
- Click a kW setup button (e.g. "4kW Setup") in the UI and verify that the "Issue Date" field updates to today's date (e.g. `2026-07-17`).
- Verify via `git status` that `public/package-guide.html` is no longer modified.
