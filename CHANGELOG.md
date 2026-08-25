# Changelog & Developer Architecture Reference

All notable changes and technical documentation for **MG Solar Invoice & Quotation System** are documented in this file.

---

## [August 25, 2026] — Philippine Location & Logistics Routing Engine (v2.4.0)

### 🚀 Summary of Today's Implementations

1. **Integrated Complete Philippine PSGC Administrative Directory (42,029+ Barangays & 1,634 LGUs)**:
   - Full offline dataset integration covering all 17 Regions and 82 Provinces.
   - High-performance, zero-latency tokenizer and autocomplete search engine (`lib/philippine-locations.ts` & `lib/philippine-locations.json`).

2. **Google Maps Calibrated Driving Distance Routing**:
   - Origin point established at **Muntinlupa Headquarters (Putatan)** (`0.0 km`).
   - Calibrated road driving distances replacing straight-line/haversine approximations for accurate logistics estimation across Luzon, Visayas, and Mindanao.

3. **Logistics Delivery Pricing Baseline (₱5,000 Base + ₱100/km)**:
   - First $\le 20\text{ km}$: **₱5,000.00** flat base rate.
   - Additional distance $> 20\text{ km}$: $+₱100.00$ per driving kilometer.
   - Exemption from Global Markup: Delivery fees are strictly treated as direct pass-through logistics charges (exempt from `rateMarkup` multiplier).

4. **Region-Aware Client Address Auto-Synchronization**:
   - Selecting a location or barangay automatically synchronizes `toAddress` in the **Details** tab:
     - **NCR**: `Brgy. [Barangay], [City], Metro Manila, NCR` *(or `[City], Metro Manila, NCR`)*
     - **Provinces**: `Brgy. [Barangay], [City/Town], [Province], [Region Code]`

5. **50km Standard Service Area Boundary & Status Tagging**:
   - Standard Service Area boundary: $\le 50.0\text{ km}$ driving distance from Muntinlupa origin.
   - Dropdown items tagged with `✓ ≤50km Serviceable` (emerald) or `⚠️ >50km Extended` (amber).
   - Selected location header card displays dynamic status tag: `✓ Serviceable Area (≤50km)` or `⚠️ Exceeds 50km Service Area (+X.X km)`.

6. **Automated Quotation Service Area Advisory Note**:
   - Automatically appends a formal `[Service Area Advisory]` to `invoice.note` whenever a site exceeding 50km is selected.
   - Automatically removes the advisory text when switching back to $\le 50\text{ km}$ or when clearing/resetting.
   - Details tab displays an active status pill under **Notes / Special Instructions**.

7. **Clean Location Autocomplete & Reset Controls**:
   - Fast `✕` input clear button, card `Reset` button (restores default ₱5,000 rate).
   - Removed redundant callout box in favor of clean inline badges and direct note synchronization.

---

## 🛠️ Notes for Developers (DEV Technical Reference)

### 1. Data Structure & Dataset Generation

* **Source File**: `reso/Philippine_Administrative_Divisions_Directory.csv` (42,031 rows)
* **Build Script**: `scripts/build-locations.js`
  * Compiles CSV into a compact 1.35 MB JSON bundle: `lib/philippine-locations.json`.
  * Structure:
    ```json
    {
      "lgus": [
        {
          "name": "Muntinlupa",
          "type": "City",
          "province": "Metro Manila (National Capital Region)",
          "regionCode": "NCR",
          "regionName": "National Capital Region (NCR / Metro Manila)",
          "island": "Luzon",
          "isCapital": false,
          "drivingDistanceKm": 0,
          "totalBarangays": 9
        }
      ],
      "barangays": [
        ["Putatan", 0, 0],
        ["Bayanan", 0, 1.2],
        ["Alabang", 0, 1.8],
        ["Ayala Alabang", 0, 2.4],
        ["Tunasan", 0, 3.1]
      ]
    }
    ```
  * Run `node scripts/build-locations.js` whenever the raw CSV is updated.

### 2. Pricing & Distance Formula

Located in `lib/philippine-locations.ts`:
```typescript
export const BASELINE_ORIGIN = {
  name: 'Muntinlupa (Putatan)',
  province: 'Metro Manila (National Capital Region)',
  region: 'NCR',
  baselineKm: 20,
  baselineFee: 5000,
  extraPerKm: 100
}

export const SERVICEABLE_DISTANCE_KM = 50

export function calculateDeliveryFee(distanceKm: number): number {
  if (isNaN(distanceKm) || distanceKm <= 0) return 5000
  if (distanceKm <= 20) return 5000
  const extraKm = distanceKm - 20
  return Math.round(5000 + extraKm * 100)
}
```

### 3. Rate Markup Exemption Pattern

Delivery items must remain flat pass-through charges. When calculating totals, formatting line items, or generating condensed summaries, use `isDeliveryItem(item)` from `lib/utils.ts`:

```typescript
export function isDeliveryItem(item: LineItem): boolean {
  if (!item) return false
  const desc = (item.description || '').toLowerCase()
  const id = (item.id || '').toLowerCase()
  return (
    id.startsWith('boq-delivery') ||
    desc.includes('delivery fee') ||
    desc.includes('delivery fees') ||
    desc.includes('freight') ||
    desc.includes('hauling') ||
    desc.includes('mobilization')
  )
}
```

**Calculation Rule**:
* Standard item rate with markup: `item.rate * (1 + rateMarkup / 100)`
* Delivery item rate: `item.rate` (0% markup applied)

### 4. Service Area Advisory Note Synchronization

In `app/page.tsx` (`handleApplyLocation` & `handleClearLocation`):
* When distance $> 50\text{ km}$:
  ```typescript
  const baseNote = (prev.note || '')
    .replace(/\n\n\[Service Area Advisory\]:[\s\S]*?(?=\n\n|$)/g, '')
    .trim()

  const advisoryNote = isExceeding
    ? `\n\n[Service Area Advisory]: The installation project site (${loc.displayName}) is ${loc.drivingDistanceKm} km from our Muntinlupa headquarters, which exceeds the standard ${SERVICEABLE_DISTANCE_KM}km service coverage (+${(loc.drivingDistanceKm - SERVICEABLE_DISTANCE_KM).toFixed(1)} km). Extended regional mobilization, ocular inspection scheduling, and logistics lead times apply.`
    : ''

  const finalNote = baseNote + advisoryNote
  ```
* When distance $\le 50\text{ km}$ or cleared:
  Regex cleanly purges any previous advisory from `invoice.note`.

---

## 📜 In-App Changelog Seed Registry (`lib/store.ts`)

| ID | Type | Feature | Description |
|---|---|---|---|
| `cl-dev-ph-location-engine-aug25_v1` | `system` | 42,029 Barangays & 1,634 LGUs Routing Engine | Offline tokenizer indexing all Philippine administrative divisions with Google Maps driving route distances. |
| `cl-dev-delivery-calc-formula-aug25_v1` | `pricing` | Logistics Pricing Baseline | ₱5,000 base for $\le 20\text{ km}$ + ₱100/km extra; 0% markup pass-through guarantee. |
| `cl-dev-50km-service-tag-aug25_v1` | `ui` | 50km Serviceable Boundary Tagging | Standard 50km radius status badges across dropdown and location card. |
| `cl-dev-service-advisory-note-aug25_v1` | `system` | Automated Service Area Advisory Note | Auto-attaches formal logistics notice to `invoice.note` for extended sites $> 50\text{ km}$. |
| `cl-dev-address-sync-aug25_v1` | `system` | Client Address Auto-Synchronization | Auto-populates `toAddress` in Details tab according to PSGC region standards. |

---

*Last Updated: August 25, 2026 by Antigravity AI Engine*
