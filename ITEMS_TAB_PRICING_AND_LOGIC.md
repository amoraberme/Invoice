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
| **AC Main Breakers** | 4x MCB 80A (₱450) | 4x MCB 80A (₱450) | 4x MCB 100A (₱500) | 4x MCB 100A (₱500) | 4x MCB 125A (₱500) | 4x MCCB (₱1,300) | 4x MCCB (₱1,300) | AC MCCB 100A (2 pcs) + AC MCCB 125A (2 pcs) @ ₱1,300 | 8x AC MCCB (₱1,300 ea) |
| **Automatic Transfer Switch** | 63A (₱1,500) | 63A (₱1,500) | 125A (₱2,000) | 125A (₱2,000) | 125A (₱2,000) | 125A (₱4,000) | 125A (₱4,000) | 125A (₱4,000) | 2x 125A (₱4,000 ea) |
| **AC Wire Gauge & Length** | AC #8 (60m) | AC #8 (60m) | AC #8 (60m) | AC #8 (60m) | AC 6mm² (60m) | #6 (60m) + #8 (60m) | #6 (100m) + #8 (100m) | #6 (100m) + #8 (100m) | #6 (120m) + #8 (120m) |
| **DC Wire Gauge & Length** | DC Wire (60m) | DC Wire (60m) | DC Wire (60m) | DC Wire (60m) | DC 6mm² (60m) | DC Wire (80m) | DC Wire (80m) | DC Wire (80m) | DC Wire (160m) |
| **DC MCB String Protection** | 4 pcs (₱420) | 4 pcs (₱420) | 4 pcs (₱420) | 4 pcs (₱420) | 4 pcs (₱420) | 4 pcs (₱420) | 4 pcs (₱420) | 4 pcs (₱420) | 4 pcs (₱420) |
| **DC SPD Surge Protection** | 2 pcs (₱790) | 2 pcs (₱790) | 2 pcs (₱790) | 2 pcs (₱790) | 3 pcs (₱790) | 3 pcs (₱790) | 3 pcs (₱790) | 3 pcs (₱790) | 6 pcs (₱790) |
| **DC MCCB for Battery** | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (1 pc @ ₱2,500) | 125A (2 pcs @ ₱2,500 ea) |
| **Cable Tray 2m (50mm W)** | 1 pc (₱560) | 1 pc (₱560) | 1 pc (₱560) | 1 pc (₱560) | 2 pcs (₱560) | 2 pcs (₱560) | 2 pcs (₱560) | 2 pcs (₱560) | 4 pcs (₱560) |
| **Terminal Lugs 25mm** | 0 pcs (Deleted) | 0 pcs (Deleted) | 0 pcs (Deleted) | 0 pcs (Deleted) | 36 pcs (₱40) | 36 pcs (₱40) | 36 pcs (₱40) | 36 pcs (₱40) | 72 pcs (₱40) |
| **Terminal Lugs 50mm** | 8 pcs (₱50) | 8 pcs (₱50) | 8 pcs (₱50) | 8 pcs (₱50) | 16 pcs (₱50) | 16 pcs (₱50) | 20 pcs (₱50) | 20 pcs (₱50) | 32 pcs (₱50) |
| **Battery Cable Standard** | 50mm² (6m total) | 50mm² (6m total) | 50mm² (6m total) | 50mm² (6m total) | 50mm² (10m) | 50mm² (10m) | 50mm² (10m) | 70mm² (10m @ ₱820) | 50mm² (20m @ ₱700) |
| **Ground Wire Length** | 20m | 50m | 20m | 20m | 25m | 25m | 25m (Ground Wire #8) | 25m (Ground Wire #8) | 50m (Ground Wire #8) |
| **Grounding Lugs** | 2 pcs (₱35) | 2 pcs (₱35) | 2 pcs (₱35) | 2 pcs (₱35) | 5 pcs (₱35) | 5 pcs (₱35) | 2 pcs (₱35) | 2 pcs (₱35) | 10 pcs (₱35) |
| **Ground Rod w/ Clamp 1.5m** | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 1 pc (₱750) | 2 pcs (₱750 ea) | 2 pcs (₱750 ea) |
| **MC4 Connectors 1500V** | 4 pcs (₱60) | 4 pcs (₱60) | 4 pcs (₱60) | 10 pcs (₱60) | 15 pcs (₱60) | 15 pcs (₱60) | 15 pcs (₱60) | 15 pcs (₱60) | 30 pcs (₱60) |
| **MC4 2-String Branch** | 0 pcs | 0 pcs | 0 pcs | 0 pcs | 0 pcs | 2 pcs (₱550) | 2 pcs (₱550) | 2 pcs (₱550) | 4 pcs (₱550) |
| **Splice Connector** | 6 pcs (₱55) | 6 pcs (₱55) | 6 pcs (₱55) | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ | $\lceil \text{Railings}/2 \rceil$ (24 pcs) |
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
| **DC MCB Protection** | 4 pcs @ ₱420 | 4 pcs @ ₱420 |
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
| **Ground Lugs** | 10 pcs @ ₱35 | 5 pcs @ ₱35 |
| **Ground Rod w/ Clamp** | 2 pcs @ ₱750 | 1 pc @ ₱750 |
| **PVC Moulding** | 10 Meters @ ₱449 | 5 Meters @ ₱449 |
| **Clip Lock & PU Sealant** | 2 Clip lock @ ₱180, 2 PU Sealant @ ₱400 | 1 Clip lock @ ₱180, 1 PU Sealant @ ₱400 |

---

### 1.2 30kW Hybrid (96 Panels / 60.48 kWp DC) Master Specification

The 30kW package strictly adheres to the client's verified 25-item bill of quantities with **96 panels (630W)**, an **open/empty inverter field** (rate ₱0.00 / pending model selection), and exact designated counts:

| # | Item Description | Quantity | Rate | Unit |
| :- | :--- | :--- | :--- | :--- |
| 1 | [Inverter Field - Empty] | 1 pc | — (No price / unpriced) | PC |
| 2 | 51.2V 314Ah Battery | 4 pcs | ₱88,000.00 | PCS |
| 3 | Tongwei Panel 630W (7.82ft x 3.72ft) | 96 pcs | ₱5,800.00 | PCS |
| 4 | DC Breaker 50amp | 12 pcs | ₱420.00 | PCS |
| 5 | AC Breaker 125amp | 8 pcs | ₱1,300.00 | PCS |
| 6 | DC SPD 40kva | 8 pcs | ₱790.00 | PCS |
| 7 | AC SPD 40kva | 12 pcs | ₱570.00 | PCS |
| 8 | DC MCCB 125amp | 4 pcs | ₱2,500.00 | PCS |
| 9 | Railings 2.4m | 100 pcs | ₱420.00 | PCS |
| 10 | End Clamp | 50 pcs | ₱29.00 | PCS |
| 11 | Mid Clamp | 180 pcs | ₱29.00 | PCS |
| 12 | Ground Lug | 8 pcs | ₱35.00 | PCS |
| 13 | L-Foot | 288 pcs | ₱50.00 | PCS |
| 14 | Grounding Rod | 1 pc | ₱750.00 | PC |
| 15 | ATS 250amp | 1 pc | ₱4,000.00 | PC |
| 16 | Combiner Box 20×40×50cm | 2 pcs | ₱3,000.00 | PCS |
| 17 | Battery Wire 50mm | 16 mts | ₱700.00 | M |
| 18 | Terminal Lugs 50mm | 20 pcs | ₱50.00 | PCS |
| 19 | PV Wire 6mm | 4 roll | ₱4,800.00 | ROLL |
| 20 | MC4 Connectors | 48 pcs | ₱60.00 | PCS |
| 21 | MC4 2strings | 10 pcs | ₱550.00 | PCS |
| 22 | THHN Wire #6 | 100 mts | ₱99.34 | M |
| 23 | HDPE Pipe 1" | 100 mts | ₱95.00 | M |
| 24 | Clip Lock 1" | 60 pcs | ₱180.00 | SET |
| 25 | Sealant | 6 pcs | ₱400.00 | PCS |
| 26 | Labor and Installation | 1 lot | ₱362,880.00 ($96 \times 630\text{W} \times ₱6/\text{W}$) | LOT |
| 27 | Delivery Fees | 1 lot | ₱5,000.00 (Base rate) | LOT |

*(Note: Items with no price such as the unpriced Inverter field do not show any rate or amount on client quotations).*

---

### 1.3 Hardware & Accessories Master Pricelist (ACC01 Series Standard)

Comprehensive rate schedule for mounting accessories, grounding hardware, connectors, and cable termination components:

| Product Code | Item Description | Standard / Floor Rate | Unit | Category | Implementation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ACC01B02` | Ferrules 4mm Red/Black | ₱3.20 | PCS | Electrical & Cabling | Update floor rate to 3.2 |
| `ACC01B01` | Ferrules 6mm Red/Black | ₱3.80 | PCS | Electrical & Cabling | Set base price at 3.8 |
| `ACC01A10` | Grounding Clips | ₱12.00 | PCS | Grounding & Bonding | Apply lowest rate of 12 |
| `ACC01A1` | End Clamp | ₱29.00 | PCS | Mounting & Hardware | Adjust target rate to 29 |
| `ACC01A2` | Mid Clamp | ₱29.00 | PCS | Mounting & Hardware | Match end clamp rate at 29 |
| `ACC01A5` | Grounding Lugs | ₱35.00 | PCS | Grounding & Bonding | Establish floor price at 35 |
| `ACC01A4` | L-Foot | ₱50.00 | PCS | Mounting & Hardware | Standardize price to 50 |
| `ACC01A6` | Splice Connector | ₱55.00 | PCS | Mounting & Hardware | Align rate to 55 |
| `ACC01A11` | MC4 Connector 1000V | ₱56.00 | PCS | Electrical & Cabling | Set tier price to 56 |
| `ACC01A12` | MC4 Connector 1500V | ₱60.00 | PCS | Electrical & Cabling | Re-rate to 60 |
| `ACC01A70` | Aluminum Mounting Rail 2.4m | ₱420.00 | PCS | Mounting & Hardware | Transition unit cost to 420 |
| `ACC01A72` | Aluminum Mounting Rail 4.8m | ₱800.00 | PCS | Mounting & Hardware | Cap bulk baseline at 800 |

---

## 2. Pricing Reconciliation Notes & Audit Rules

Every item in the **Items Tab** displays an informative badge and audit reconciliation note (kept strictly internal to the editor and excluded from client proposal preview/PDF):

1. **Flexible Hose 32mm HDPE**:
   - Standard 32mm conduit rate set to ₱95.00/m (25m for ≤6kW, 50m for 8kW). 40mm standard for ≥10kW set to ₱124.00/m (50m).
2. **Breaker Box / Enclosure**:
   - `[Price Updated]`: 50x40 Enclosure downsized to ₱1,500.00 (was ₱3,000.00 50x60) for 3kW and 4kW packages.
3. **AC Breakers**:
   - `[Price Updated]`: 4x AC MCB 80A @ ₱450.00 (3k–4k), 4x AC MCB 100A @ ₱500.00 (5k–6k), 4x AC MCB 125A @ ₱500.00 (8k), AC MCCB @ ₱1,300.00 (10k–12k), AC MCCB 100A (2 pcs) + AC MCCB 125A (2 pcs) @ ₱1,300.00 ea (16k), and 8x AC MCCB @ ₱1,300.00 ea (20k).
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

## 3. Grid-Tied Reference Matrix (Zero-Export / Daytime Only)

*Use this table when clients want to reduce daytime air conditioning and daytime utility expenses without investing in costly battery banks.*

| Inverter Rating | Recommended DC Array | Panel Count (620W) | Est. Daily Yield | Target Monthly Bill | Target Daily Usage | Expected Monthly Savings | Coverage Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **3 kW** | 3.10 – 3.72 kWp | 5 – 6 panels | 10.1 – 12.1 kWh | **₱6,000 – ₱8,000** | 13.3 – 17.8 kWh | **₱4,500 – ₱5,500** | ~50% – 65% |
| **4 kW** | 4.34 – 4.96 kWp | 7 – 8 panels | 14.2 – 16.2 kWh | **₱8,000 – ₱10,500** | 17.8 – 23.3 kWh | **₱6,400 – ₱7,300** | ~50% – 65% |
| **5 kW** | 5.58 – 6.20 kWp | 9 – 10 panels | 18.2 – 20.2 kWh | **₱10,500 – ₱14,000** | 23.3 – 31.1 kWh | **₱8,200 – ₱9,100** | ~50% – 65% |
| **6 kW** | 6.82 – 7.44 kWp | 11 – 12 panels | 22.3 – 24.3 kWh | **₱14,000 – ₱17,500** | 31.1 – 38.9 kWh | **₱10,000 – ₱11,000** | ~50% – 65% |
| **8 kW** | 8.68 – 9.92 kWp | 14 – 16 panels | 28.4 – 32.4 kWh | **₱18,000 – ₱22,000** | 40.0 – 48.9 kWh | **₱12,700 – ₱14,500** | ~50% – 65% |
| **10 kW** | 11.16 – 12.40 kWp | 18 – 20 panels | 36.5 – 40.5 kWh | **₱23,000 – ₱28,000** | 51.1 – 62.2 kWh | **₱16,400 – ₱18,200** | ~50% – 65% |
| **12 kW** | 13.64 – 14.88 kWp | 22 – 24 panels | 44.6 – 48.6 kWh | **₱28,000 – ₱35,000** | 62.2 – 77.8 kWh | **₱20,000 – ₱21,800** | ~50% – 65% |
| **16 kW** | 18.60 – 19.84 kWp | 30 – 32 panels | 60.8 – 64.8 kWh | **₱36,000 – ₱46,000** | 80.0 – 102.2 kWh | **₱27,300 – ₱29,100** | ~50% – 65% |
| **20 kW** | 22.32 – 24.80 kWp | 36 – 40 panels | 73.0 – 81.1 kWh | **₱46,000 – ₱58,000** | 102.2 – 128.9 kWh | **₱32,800 – ₱36,500** | ~50% – 65% |
| **30 kW** | 34.72 – 37.20 kWp | 56 – 60 panels | 113.5 – 121.6 kWh | **₱75,000 – ₱95,000** | 166.7 – 211.1 kWh | **₱51,000 – ₱54,700** | ~50% – 65% |

---

## 4. Hybrid Reference Matrix (Battery Storage / 24-Hour Offset)

*Use this table when clients experience frequent brownouts, high night-time loads, or wish to zero out their bill completely.*

| Inverter Rating | Recommended DC Array | Panel Count (620W) | Recommended Battery Bank | Target Monthly Bill | Total Daily Energy | Net Monthly Savings | Coverage Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **3 kW** | 3.72 kWp | 6 panels | 5.12 kWh (100Ah) | **₱4,500 – ₱6,000** | 10.0 – 13.3 kWh | **₱4,000 – ₱5,500** | Up to 95% |
| **4 kW** | 4.96 kWp | 8 panels | 10.24 kWh (200Ah) | **₱6,000 – ₱8,000** | 13.3 – 17.8 kWh | **₱5,500 – ₱7,500** | Up to 95% |
| **5 kW** | 6.20 kWp | 10 panels | 10.24 – 14.3 kWh | **₱7,500 – ₱10,000** | 16.7 – 22.2 kWh | **₱7,000 – ₱9,500** | Up to 95% |
| **6 kW** | 7.44 kWp | 12 panels | 14.3 – 16.08 kWh (314Ah) | **₱10,000 – ₱12,500** | 22.2 – 27.8 kWh | **₱9,500 – ₱12,000** | Up to 95% |
| **8 kW** | 9.92 kWp | 16 panels | 16.08 – 20.48 kWh | **₱12,500 – ₱15,500** | 27.8 – 34.4 kWh | **₱12,000 – ₱15,000** | Up to 95% |
| **10 kW** | 12.40 – 13.64 kWp | 20 – 22 panels | 16.08 – 30.0 kWh | **₱16,000 – ₱20,000** | 35.6 – 44.4 kWh | **₱15,500 – ₱19,500** | Up to 95% |
| **12 kW** | 14.88 – 16.12 kWp | 24 – 26 panels | 25.6 – 32.0 kWh | **₱20,000 – ₱26,000** | 44.4 – 57.8 kWh | **₱19,500 – ₱25,000** | Up to 95% |
| **16 kW** | 19.84 – 21.08 kWp | 32 – 34 panels | 30.0 – 45.0 kWh | **₱26,000 – ₱34,000** | 57.8 – 75.6 kWh | **₱25,000 – ₱33,000** | Up to 95% |
| **20 kW** | 24.80 – 27.28 kWp | 40 – 44 panels | 40.0 – 60.0 kWh | **₱35,000 – ₱46,000** | 77.8 – 102.2 kWh | **₱34,000 – ₱44,000** | Up to 95% |
| **30 kW** | 37.20 – 40.92 kWp | 60 – 66 panels | 60.0 – 80.0 kWh | **₱55,000 – ₱75,000** | 122.2 – 166.7 kWh | **₱53,000 – ₱72,000** | Up to 95% |

---

## 5. Financial & Calculation Formulas

### 5.1 Labor and Installation Formula
$$\text{Total DC Watts} = \text{panelQty} \times 620\text{W}$$
$$\text{Labor Rate} = \text{round}(\text{Total DC Watts} \times \text{laborPricePerWatt}) \quad (\text{Default } \text{laborPricePerWatt} = ₱6/\text{W})$$

### 5.2 Delivery Fee Formula
$$\text{Delivery Fee} = \begin{cases} ₱5,000.00 & \text{if } \text{distanceKm} \le 20\text{ km} \\ ₱5,000.00 + (\text{distanceKm} - 20) \times ₱15.00/\text{km} & \text{if } \text{distanceKm} > 20\text{ km} \end{cases}$$

### 5.3 Rate Markup Formula
$$\text{Effective Rate} = \begin{cases} \text{item.rate} & \text{if Delivery Item} \\ \text{item.rate} & \text{if Labor Item and excludeLaborMarkup is active} \\ \text{item.rate} \times \left(1 + \frac{\text{rateMarkup}}{100}\right) & \text{otherwise (Default markup: 25\%)} \end{cases}$$

### 5.4 Subtotal, VAT & Grand Total Formulas
$$\text{Subtotal} = \sum_{i} (\text{quantity}_i \times \text{Effective Rate}_i)$$
$$\text{Net Subtotal} = \max(0, \text{Subtotal} - \text{Discount Amount})$$
$$\text{VAT} = \text{Net Subtotal} \times \left(\frac{\text{vatRate}}{100}\right) \quad (\text{Default: 0\%})$$
$$\text{Grand Total} = \text{Net Subtotal} + \text{VAT}$$

### 5.5 Sales Commission Formula (Capital & Internal Profitability)
$$\text{Total Labor} = \sum_{i \in \text{Labor}} (\text{quantity}_i \times \text{Effective Rate}_i)$$
$$\text{Commissionable Base} = \max(0, \text{Quotation Grand Total} - \text{Total Labor})$$
$$\text{Sales Commission} = \text{Commissionable Base} \times 2.5\%$$
*(Note: The total labor and installation cost is completely excluded from the commissionable base).*
