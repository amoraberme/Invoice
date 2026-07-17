# Setup Current Date and Clean Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically update the invoice's issue date to today's local date when clicking any Solar BOQ Sizing Setup presets or custom kW setup, and clean/revert other changes in the workspace.

**Architecture:** We will compute the local date formatted as YYYY-MM-DD inside the `handleGenerateBoq` function in `app/page.tsx` and update the `issueDate` state parameter during invoice generation. We will also run Git commands to restore `public/package-guide.html`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Git

## Global Constraints
- Do not introduce external dependencies.
- Maintain existing coding styles and strict type rules.

---

### Task 1: Discard Workspace Changes

**Files:**
- Modify: `public/package-guide.html` (revert)

**Interfaces:**
- Consumes: None
- Produces: Clean git status for `public/package-guide.html`

- [ ] **Step 1: Revert public/package-guide.html**
  Run: `git restore public/package-guide.html`
  Expected: Command completes successfully.

- [ ] **Step 2: Check git status**
  Run: `git status`
  Expected: `public/package-guide.html` is no longer shown as modified.

---

### Task 2: Set Current Date on Solar BOQ Sizing Setup Click

**Files:**
- Modify: `app/page.tsx:772-1065`

**Interfaces:**
- Consumes: `invoice` state from `useMGInvoice`
- Produces: Updated `issueDate` set to current local date formatted as `YYYY-MM-DD` when generating a BOQ.

- [ ] **Step 1: Implement current local date calculation and update state**
  Modify [app/page.tsx](file:///C:/Users/Marco/Documents/Office/Invoice/app/page.tsx) inside `handleGenerateBoq`:
  
  ```typescript
  const handleGenerateBoq = (systemKw: number) => {
    // ...
    // Calculate current local date string (YYYY-MM-DD)
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
  }
  ```

- [ ] **Step 2: Verify typescript compilations and linting**
  Run: `pnpm lint`
  Expected: No linting errors.

- [ ] **Step 3: Run build to ensure Next.js build passes**
  Run: `pnpm build`
  Expected: Build succeeds.

- [ ] **Step 4: Commit changes**
  Run: `git add app/page.tsx`
  Run: `git commit -m "feat(solar): update issue date to current date when applying a setup"`
