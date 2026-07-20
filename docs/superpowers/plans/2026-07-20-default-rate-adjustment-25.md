# Default Rate Adjustment to 25% Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set the default rate adjustment (markup) percentage to 25% for new invoices.

**Architecture:** Update `rateMarkup` to `25` in `defaultInvoice` (`lib/types.ts`) and `BASE_INVOICE` (`lib/samples.ts`).

**Tech Stack:** React, Next.js, TypeScript

## Global Constraints
- Do not introduce unused or empty dependencies.
- Follow existing naming conventions and styling.

---

### Task 1: Update rateMarkup defaults

**Files:**
- Modify: `lib/types.ts:63`
- Modify: `lib/samples.ts:15`
- Test: `scratch/test-default-markup.js`

- [ ] **Step 1: Write test script to verify default markup**

Create `C:\Users\Marco\Documents\Office\Invoice\scratch\test-default-markup.js`:
```javascript
const assert = require('assert');
const { defaultInvoice } = require('../.next/server/app/page.js'); // We can also just read the ts/js file directly.
// Let's write a simple script that reads the file content and verifies that defaultInvoice has rateMarkup: 25.
const fs = require('fs');
const path = require('path');

const typesContent = fs.readFileSync(path.join(__dirname, '../lib/types.ts'), 'utf8');
const samplesContent = fs.readFileSync(path.join(__dirname, '../lib/samples.ts'), 'utf8');

assert.ok(typesContent.includes('rateMarkup: 25'), 'lib/types.ts should define rateMarkup as 25');
assert.ok(samplesContent.includes('rateMarkup: 25'), 'lib/samples.ts should define rateMarkup as 25');

console.log('Test passed: rateMarkup defaults are updated to 25!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scratch/test-default-markup.js`
Expected: Assertion fails since the value is currently 0.

- [ ] **Step 3: Modify `lib/types.ts`**

Change `rateMarkup: 0` to `rateMarkup: 25` on line 63 of `C:\Users\Marco\Documents\Office\Invoice\lib\types.ts`.

- [ ] **Step 4: Modify `lib/samples.ts`**

Change `rateMarkup: 0` to `rateMarkup: 25` on line 15 of `C:\Users\Marco\Documents\Office\Invoice\lib\samples.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scratch/test-default-markup.js`
Expected: `Test passed: rateMarkup defaults are updated to 25!`

- [ ] **Step 6: Run build check**

Run: `pnpm build`
Expected: Successful Next.js build.

- [ ] **Step 7: Commit changes**

```bash
git add lib/types.ts lib/samples.ts scratch/test-default-markup.js
git commit -m "feat: default rate markup adjustment to 25%"
```

---

### Task 2: Deploy to Vercel

**Files:**
- None

- [ ] **Step 1: Deploy production build to Vercel**

Run: `npx vercel --prod --yes`
Expected: Deployment completed successfully.
