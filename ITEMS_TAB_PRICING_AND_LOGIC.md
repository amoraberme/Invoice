# Items Tab: Pricing, Hardcoded Values & Business Logic

This document details all hardcoded prices, component rates, brand-specific tiers, electrical sizing rules, and calculation formulas used in the **Items Tab** and the **Bill of Quantities (BOQ) Generator** of the MG Solar Invoice application, aligned with the **Unified Solar Standard Guidelines**.

---

## 1. Master System-by-System Specification Matrix (3kW – 20kW)

| Component Parameter | 3kW Hybrid | 4kW Hybrid | 5kW Hybrid | 6kW Hybrid | 8kW Hybrid | 10kW Hybrid | 12kW Hybrid | 16kW Hybrid | 20kW Hybrid (2x 10kW Parallel) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Solar Panels (620W N-Type)** | 5 pcs | 6 pcs | 8 pcs | 10 pcs | 13 pcs (2 Str) | 16 pcs (2 Str) | 20 pcs (2 Str) | 26 pcs (2 Str) | 32 pcs (4 Str / 2x 16) |
| **Inverter (AC Capacity)** | 3.0 kW AC | 4.0 kW AC | 5.0 kW AC | 6.0 kW AC | 8.0 kW AC | 10.0 kW AC | 12.0 kW AC | 16.0 kW AC | 2x 10.0 kW AC (Parallel) |
| **Grid Configuration** | 1-Phase 230V | 1-Phase 230V | 1-Phase 230V | 1-Phase 230V | 1-Phase 230V | 3-Phase 230/400V | 3-Phase 230/400V | 3-Phase 230/400V | 3-Phase 230/400V |
| **Battery Storage Standard** | 100Ah (₱38,000) | 100Ah (₱38,000) | 100Ah (₱38,000) | 200Ah (₱65,000) | 314Ah (₱88,000) | 314Ah (₱88,000) | 314Ah (₱88,000) | 314Ah (₱88,000) | 2x 314Ah (₱88,000 ea) |
| **Flexible Hose / Conduit** | 32mm (25m @ ₱95) | 32mm (25m @ ₱95) | 32mm (25m @ ₱95) | 32mm (25m @ ₱95) | 32mm (50m @ ₱95) | 40mm (50m @ ₱124) | 40mm (50m @ ₱124) | 40mm (50m @ ₱124) | 40mm (100m @ ₱124) |
| **Breaker Box / Enclosure** | 50x40 (₱1,500) | 50x40 (₱1,500) | 50x60 (₱3,000) | 50x60 (₱3,000) | 50x60 (₱3,000) | 50x60 (₱3,000) | 50x60 (₱3,000) | 50x60 (₱3,000) | 2x 50x60 (₱3,000 ea) |
| **AC Main Breakers** | 2x MCB 80A (₱450) | 2x MCB 80A (₱450) | 2x MCB 100A (₱500) | 2x MCB 100A (₱500) | 2x MCB 125A (₱500) | 4x MCCB (₱1,300) | 4x MCCB (₱1,300) | AC MCCB 100A (2 pcs) + AC MCCB 125A (2 pcs) @ ₱1,300 | 8x AC MCCB (₱1,300 ea) |
| **Automatic Transfer Switch** | 63A (₱1,500) | 63A (₱1,500) | 125A (₱2,000) | 125A (₱2,000) | 125A (₱2,000) | 125A (₱4,000) | 125A (₱4,000) | 125A (₱4,000) | 2x 125A (₱4,000 ea) |
| **AC Wire Gauge & Length** | AC #8 (60m) | AC #8 (60m) | AC #8 (60m) | AC #8 (60m) | AC 6mm² (60m) | #6 (60m) + #8 (60m) | #6 (60m) + #8 (60m) | #6 (60m) + #8 (60m) | #6 (120m) + #8 (120m) |
| **DC Wire Gauge & Length** | DC Wire (60m) | DC Wire (60m) | DC Wire (60m) | DC Wire (60m) | DC 6mm² (60m) | DC Wire (80m) | DC Wire (80m) | DC Wire (80m) | DC Wire (160m) |
| **DC MCB String Protection** | 2 pcs (₱420) | 2 pcs (₱420) | 2 pcs (₱420) | 2 pcs (₱420) | 2 pcs (₱420) | 2 pcs (₱420) | 3 pcs (₱420) | 3 pcs (₱420) | 4 pcs (₱420) |
| **DC SPD Surge Protection** | 2 pcs (₱790) | 2 pcs (₱790) | 2 pcs (₱790) | 2 pcs (₱790) | 3 pcs (₱790) | 3 pcs (₱790) | 3 pcs (₱790) | 3 pcs (₱790) | 6 pcs (₱790) |
| **DC MCCB for Battery** | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (2 pcs @ ₱2,500 ea) |
| **Cable Tray 2m (50mm W)** | 1 pc (₱560) | 1 pc (₱560) | 1 pc (₱560) | 1 pc (₱560) | 2 pcs (₱560) | 2 pcs (₱560) | 2 pcs (₱560) | 2 pcs (₱560) | 4 pcs (₱560) |
| **Terminal Lugs 25mm** | 0 pcs (Deleted) | 0 pcs (Deleted) | 0 pcs (Deleted) | 0 pcs (Deleted) | 36 pcs (₱40) | 36 pcs (₱40) | 36 pcs (₱40) | 36 pcs (₱40) | 72 pcs (₱40) |
| **Terminal Lugs 50mm** | 8 pcs (₱50) | 8 pcs (₱50) | 8 pcs (₱50) | 8 pcs (₱50) | 16 pcs (₱50) | 16 pcs (₱50) | 20 pcs (₱50) | 20 pcs (₱50) | 32 pcs (₱50) |
| **Battery Cable Standard** | 50mm² (6m total) | 50mm² (6m total) | 50mm² (6m total) | 50mm² (6m total) | 50mm² (10m) | 50mm² (10m) | 50mm² (10m) | 70mm² (10m @ ₱820) | 50mm² (20m @ ₱700) |
| **Ground Wire Length** | 20m | 50m | 20m | 20m | 25m | 25m | 25m (Ground Wire #8) | 25m (Ground Wire #8) | 50m (Ground Wire #8) |
| **Grounding Lugs** | 2 pcs (₱50) | 2 pcs (₱50) | 2 pcs (₱50) | 2 pcs (₱50) | 5 pcs (₱50) | 5 pcs (₱50) | 2 pcs (₱50) | 2 pcs (₱50) | 10 pcs (₱50) |
| **Ground Rod w/ Clamp 1.5m** | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 2 pcs (₱750 ea) | 2 pcs (₱750 ea) |
| **MC4 Connectors 1500V** | 4 pcs (₱60) | 4 pcs (₱60) | 4 pcs (₱60) | 10 pcs (₱60) | 15 pcs (₱60) | 15 pcs (₱60) | 15 pcs (₱60) | 15 pcs (₱60) | 30 pcs (₱60) |
| **MC4 2-String Branch** | 0 pcs | 0 pcs | 0 pcs | 0 pcs | 0 pcs | 2 pcs (₱550) | 2 pcs (₱550) | 2 pcs (₱550) | 4 pcs (₱550) |
| **Splice Connector** | 6 pcs (₱90) | 6 pcs (₱90) | 6 pcs (₱90) | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ (24 pcs) |
| **PVC Moulding** | 3 Meters (₱449) | 3 Meters (₱449) | 3 Meters (₱449) | 5 Meters (₱449) | 5 Meters (₱449) | 5 Meters (₱449) | 5 Meters (₱449) | 5 Meters (₱449) | 10 Meters (₱449) |

---

### 1.1 20kW Dual Configuration Modes (Toggled Architecture)

The system supports toggling between two distinct 20kW architectures via the 20kW preset button or architecture toggle banner:

| Component Parameter | New 20kW Hybrid (10kW × 2 Parallel) | Old 20kW Hybrid (Commit `8197ea9` Single Inverter) |
| :--- | :--- | :--- |
| **Inverter** | 2x 10kW Hybrid Inverters (Parallel) | 1x GoodWe 20kW Hybrid Inverter (3-Phase LV @ ₱160,000) |
| **Battery Storage** | 2x CESC 51.2V 314Ah (₱88,000 each = ₱176,000) | 1x CESC 51.2V 314Ah (₱88,000) |
| **Breaker Box / Enclosure** | 2x 50x60 Enclosures (₱3,000 each = ₱6,000) | 1x 50x60 Enclosure (₱3,000) |
| **AC MCCB Breakers** | 8x AC MCCB @ ₱1,300 each | 4x AC MCCB @ ₱850 each |
| **AC SPD Surge Protection** | 4 pcs @ ₱570 | 2 pcs @ ₱570 |
| **DC SPD Surge Protection** | 6 pcs @ ₱790 | 2 pcs @ ₱790 |
| **DC MCB Protection** | 4 pcs @ ₱420 | 2 pcs @ ₱420 |
| **DC MCCB for Battery** | 2x DC MCCB @ ₱2,500 each | 1x DC MCCB @ ₱2,000 |
| **Automatic Transfer Switch (ATS)**| 2x 125A @ ₱4,000 each | 1x 125A @ ₱4,000 |
| **Battery Cable** | 20m 50mm² @ ₱700/m | 2m 50mm² @ ₱700/m |
| **Terminal Lugs 25mm** | 72 pcs @ ₱40 | 30 pcs @ ₱40 |
| **Terminal Lugs 50mm** | 32 pcs @ ₱50 | 5 pcs @ ₱50 |
| **Terminal Block** | 0 pcs (Omitted in parallel) | 2 pcs @ ₱160 |
| **Conduit (Flexible Hose)** | 100m 40mm @ ₱124/m | 50m 40mm @ ₱124/m |
| **AC Wire Gauge & Length** | #6 (120m) + #8 (120m) | #6 (50m) + #8 (50m) |
| **DC Wire Length** | 160m @ ₱125/m | 100m @ ₱125/m |
| **MC4 Connectors 1500V** | 30 pcs @ ₱60 | 15 pcs @ ₱60 |
| **MC4 2-String Branch** | 4 pcs @ ₱550 | 2 pcs @ ₱550 |
| **Cable Tray 2m** | 4 pcs @ ₱560 | 1 pc @ ₱560 |
| **Ground Lugs** | 10 pcs @ ₱50 | 5 pcs @ ₱50 |
| **Ground Rod w/ Clamp** | 2 pcs @ ₱750 | 1 pc @ ₱750 |
| **PVC Moulding** | 10 Meters @ ₱449 | 5 Meters @ ₱449 |
| **Clip Lock & PU Sealant** | 2 Clip lock @ ₱180, 2 PU Sealant @ ₱400 | 1 Clip lock @ ₱180, 1 PU Sealant @ ₱400 |

---

## 2. Pricing Reconciliation Notes & Audit Rules

Every item in the **Items Tab** displays an informative badge and audit reconciliation note (kept strictly internal to the editor and excluded from client proposal preview/PDF):

1. **Flexible Hose 32mm HDPE**:
   - Standard 32mm conduit rate set to ₱95.00/m (25m for ≤6kW, 50m for 8kW). 40mm standard for ≥10kW set to ₱124.00/m (50m).
2. **Breaker Box / Enclosure**:
   - `[Price Updated]`: 50x40 Enclosure downsized to ₱1,500.00 (was ₱3,000.00 50x60) for 3kW and 4kW packages.
3. **AC Breakers**:
   - `[Price Updated]`: 2x AC MCB 80A @ ₱450.00 (3k–4k), 2x AC MCB 100A @ ₱500.00 (5k–6k), 2x AC MCB 125A @ ₱500.00 (8k), AC MCCB @ ₱1,300.00 (10k–12k), AC MCCB 100A (2 pcs) + AC MCCB 125A (2 pcs) @ ₱1,300.00 ea (16k), and 8x AC MCCB @ ₱1,300.00 ea (20k).
4. **Automatic Transfer Switch (ATS)**:
   - `[Price Scaled]`: 63A Taxnelle ATS @ ₱1,500.00 (3k–4k), 125A ATS @ ₱2,000.00 (5k–8k), 125A Heavy-Duty ATS @ ₱4,000.00 (10k–16k).
5. **Battery Capacity**:
   - `[Battery Downsized]`: Default hybrid storage downsized to 51.2V 100Ah @ ₱38,000.00 for 3kW–5kW packages (was 200Ah @ ₱65,000.00).
6. **Battery Cable**:
   - `[70mm² Heavy-Duty Cable]`: 16kW hybrid upgraded to 70mm² @ ₱820.00/m (10m = 5m Black + 5m Red).
7. **Terminal Lugs 25mm**:
   - `[Deleted in 3k–6k]`: Completely omitted (0 pcs) for 3kW–6kW; fixed at 36 pcs for 8kW+.
8. **Terminal Block**:
   - `[Deleted in Standard BOQ]`: Completely omitted (0 pcs) across standard tiers.
9. **MC4 Connectors**:
   - `[Scaled]`: 4 pcs (3k–5k), 10 pcs (6k), 15 pcs (8k+).
10. **Ground Rod**:
    - `[Scaled]`: 2 pcs @ ₱750.00 each for 16kW heavy earth dissipation.

---

## 3. Financial & Calculation Formulas

### 3.1 Labor and Installation Formula
$$\text{Total DC Watts} = \text{panelQty} \times 620\text{W}$$
$$\text{Labor Rate} = \text{round}(\text{Total DC Watts} \times \text{laborPricePerWatt}) \quad (\text{Default } \text{laborPricePerWatt} = ₱6/\text{W})$$

### 3.2 Delivery Fee Formula
$$\text{Delivery Fee} = \begin{cases} ₱5,000.00 & \text{if } \text{distanceKm} \le 20\text{ km} \\ ₱5,000.00 + (\text{distanceKm} - 20) \times ₱100.00/\text{km} & \text{if } \text{distanceKm} > 20\text{ km} \end{cases}$$

### 3.3 Rate Markup Formula
$$\text{Effective Rate} = \begin{cases} \text{item.rate} & \text{if Delivery Item} \\ \text{item.rate} & \text{if Labor Item and excludeLaborMarkup is active} \\ \text{item.rate} \times \left(1 + \frac{\text{rateMarkup}}{100}\right) & \text{otherwise (Default markup: 25\%)} \end{cases}$$

### 3.4 Subtotal, VAT & Grand Total Formulas
$$\text{Subtotal} = \sum_{i} (\text{quantity}_i \times \text{Effective Rate}_i)$$
$$\text{Net Subtotal} = \max(0, \text{Subtotal} - \text{Discount Amount})$$
$$\text{VAT} = \text{Net Subtotal} \times \left(\frac{\text{vatRate}}{100}\right) \quad (\text{Default: 0\%})$$
$$\text{Grand Total} = \text{Net Subtotal} + \text{VAT}$$

### 3.5 Sales Commission Formula (Capital & Internal Profitability)
$$\text{Total Labor} = \sum_{i \in \text{Labor}} (\text{quantity}_i \times \text{Effective Rate}_i)$$
$$\text{Commissionable Base} = \max(0, \text{Quotation Grand Total} - \text{Total Labor})$$
$$\text{Sales Commission} = \text{Commissionable Base} \times 2.5\%$$
*(Note: The total labor and installation cost is completely excluded from the commissionable base).*
