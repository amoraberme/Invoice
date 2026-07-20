# 4kW Inverter Capacity and Price Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the inverter used in the 4kW setup to a 4kW inverter with a price of ₱14,000.00.

**Architecture:** Update the inverter capacity sizing list `inverterSizes` to include `4` and add a conditional branch for `inverterKw <= 4` setting description to "Inverter 4kW Hybrid" and price to ₱14,000.00.

**Tech Stack:** React, Next.js, TypeScript, Node.js

## Global Constraints
- Do not introduce unused or empty dependencies.
- Follow existing patterns in `app/page.tsx` for pricing logic.

---

### Task 1: Update Inverter Sizing and Pricing Rules

**Files:**
- Modify: `app/page.tsx:868-910`
- Test: `scratch/test-inverter-sizing.js`

- [ ] **Step 1: Write a test script in `scratch/test-inverter-sizing.js`**

Write a test script that validates the inverter kW determination and pricing logic. Since the logic is inside a React component, we will write a pure JS representation of the sizing and pricing logic to test our math and logic.

Create `C:\Users\Marco\Documents\Office\Invoice\scratch\test-inverter-sizing.js`:
```javascript
const assert = require('assert');

// The logic we want to test:
function getInverterDetails(systemKw) {
  const inverterSizes = [4, 5, 6, 8, 10, 12, 16, 30, 50, 60, 75, 125];
  let inverterKw = inverterSizes.find(s => s >= systemKw);
  if (inverterKw === undefined) {
    inverterKw = Math.ceil(systemKw);
  }
  
  let inverterDesc = `Inverter ${inverterKw}kW Hybrid`;
  let inverterPrice = 0;
  if (inverterKw <= 4) {
    inverterDesc = 'Inverter 4kW Hybrid';
    inverterPrice = 14000.00;
  } else if (inverterKw <= 5) {
    inverterDesc = 'Inverter 5kW Hybrid';
    inverterPrice = 41000.00;
  } else if (inverterKw <= 6) {
    inverterDesc = 'Inverter 6kW Hybrid';
    inverterPrice = 44000.00;
  } else if (inverterKw <= 8) {
    inverterDesc = 'Inverter 8kW Hybrid';
    inverterPrice = 60000.00;
  } else if (inverterKw <= 10) {
    inverterDesc = 'Inverter 10kW Hybrid';
    inverterPrice = 68000.00;
  } else if (inverterKw <= 12) {
    inverterDesc = 'Inverter 12kW Hybrid';
    inverterPrice = 82000.00;
  } else if (inverterKw <= 16) {
    inverterDesc = 'Inverter 16kW Hybrid';
    inverterPrice = 113000.00;
  } else if (inverterKw <= 30) {
    inverterDesc = 'Inverter 30kW Hybrid';
    inverterPrice = 259000.00;
  } else if (inverterKw <= 50) {
    inverterDesc = 'Inverter 50kW Hybrid';
    inverterPrice = 310000.00;
  } else if (inverterKw <= 60) {
    inverterDesc = 'Inverter 60kW Hybrid';
    inverterPrice = 500000.00;
  } else if (inverterKw <= 75) {
    inverterDesc = 'Inverter 75kW Hybrid';
    inverterPrice = 580000.00;
  } else {
    inverterDesc = 'Inverter 125kW Hybrid';
    inverterPrice = 580000.00;
  }
  return { desc: inverterDesc, price: inverterPrice };
}

// 1. Test 4kW Setup
const res4 = getInverterDetails(4);
assert.strictEqual(res4.desc, 'Inverter 4kW Hybrid');
assert.strictEqual(res4.price, 14000.00);

// 2. Test 5kW Setup
const res5 = getInverterDetails(5);
assert.strictEqual(res5.desc, 'Inverter 5kW Hybrid');
assert.strictEqual(res5.price, 41000.00);

// 3. Test 6kW Setup
const res6 = getInverterDetails(6);
assert.strictEqual(res6.desc, 'Inverter 6kW Hybrid');
assert.strictEqual(res6.price, 44000.00);

// 4. Test 3.8kW Custom Setup (should map to 4kW inverter)
const res3_8 = getInverterDetails(3.8);
assert.strictEqual(res3_8.desc, 'Inverter 4kW Hybrid');
assert.strictEqual(res3_8.price, 14000.00);

console.log('All inverter sizing logic tests passed successfully!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scratch/test-inverter-sizing.js`
*(Note: At this stage, since we haven't updated `test-inverter-sizing.js` logic to fail or if we run it with the old logic, it would fail. Actually, the test code itself contains the updated logic, so running it directly passes. Let's make the test fail first by matching the existing production code logic in `test-inverter-sizing.js` and then changing it.)*

Let's modify the test function inside `test-inverter-sizing.js` initially to match the old logic (without `4` in size and price), run it, see it fail, and then implement the new logic in both the test and `app/page.tsx`.

Old logic function in test file for Step 2:
```javascript
function getInverterDetails(systemKw) {
  const inverterSizes = [5, 6, 8, 10, 12, ...]; // old sizes
  ...
}
```
Run: `node scratch/test-inverter-sizing.js`
Expected: Assertion error for 4kW setup (should get `Inverter 5kW Hybrid` and price `41000.00`, but test asserts `Inverter 4kW Hybrid` and `14000.00`).

- [ ] **Step 3: Modify `app/page.tsx` with the new logic**

Modify lines 869-910 of `C:\Users\Marco\Documents\Office\Invoice\app\page.tsx`:
```typescript
    // 1. Inverter
    const inverterSizes = [4, 5, 6, 8, 10, 12, 16, 30, 50, 60, 75, 125]
    let inverterKw = inverterSizes.find(s => s >= systemKw)
    if (inverterKw === undefined) {
      inverterKw = Math.ceil(systemKw)
    }
    
    let inverterDesc = `Inverter ${inverterKw}kW Hybrid`
    let inverterPrice = 0
    if (inverterKw <= 4) {
      inverterDesc = 'Inverter 4kW Hybrid'
      inverterPrice = 14000.00
    } else if (inverterKw <= 5) {
      inverterDesc = 'Inverter 5kW Hybrid'
      inverterPrice = 41000.00
    } else if (inverterKw <= 6) {
      inverterDesc = 'Inverter 6kW Hybrid'
      inverterPrice = 44000.00
    ...
```

- [ ] **Step 4: Run the test to verify it passes**

Update the test file `scratch/test-inverter-sizing.js` to match the new logic (if not already done) and run it.
Run: `node scratch/test-inverter-sizing.js`
Expected: `All inverter sizing logic tests passed successfully!`

- [ ] **Step 5: Run pnpm build to ensure no TypeScript or build errors**

Run: `pnpm build`
Expected: Successful Next.js build.

- [ ] **Step 6: Commit changes**

```bash
git add app/page.tsx scratch/test-inverter-sizing.js
git commit -m "feat: change 4kW setup inverter to 4kW hybrid priced at 14,000"
```

---

### Task 2: Deploy to Vercel

**Files:**
- None (Deployment only)

- [ ] **Step 1: Run Vercel deploy command**

Run: `npx vercel --prod --yes` or `git push` if it is connected to GitHub Vercel integration.
We can run `npx vercel --prod` directly using `run_command`.
*(Wait, let's verify if vercel CLI is set up or if they use standard deploy. We will run it and confirm.)*
