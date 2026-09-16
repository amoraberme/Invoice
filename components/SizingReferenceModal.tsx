'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Zap,
  Search,
  Check,
  Copy,
  Layers,
  ArrowRight,
  SunMedium,
  Gauge,
  Sparkles,
  SlidersHorizontal,
  Table as TableIcon,
  BatteryCharging,
  Sun,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ==========================================
// V3 TYPES & MASTER MATRICES
// ==========================================

export interface SizingReferenceV3GridTiedItem {
  kw: number
  inverterRating: string
  recommendedDcArray: string
  panelCountText: string
  panelCountMin: number
  panelCountMax: number
  estDailyYield: string
  targetMonthlyBill: string
  targetMonthlyBillShort: string
  targetDailyUsage: string
  expectedMonthlySavings: string
  coverageRatio: string
  phase: '1-Phase' | '3-Phase'
}

export interface SizingReferenceV3HybridItem {
  kw: number
  inverterRating: string
  recommendedDcArray: string
  panelCountText: string
  panelCountMin: number
  panelCountMax: number
  recommendedBatteryBank: string
  targetMonthlyBill: string
  targetMonthlyBillShort: string
  totalDailyEnergy: string
  netMonthlySavings: string
  coverageRatio: string
  phase: '1-Phase' | '3-Phase'
}

/**
 * 3. Grid-Tied Reference Matrix (Zero-Export / Daytime Only)
 * Daytime utility & aircon offset without batteries.
 */
export const SIZING_REFERENCE_V3_GRIDTIED: SizingReferenceV3GridTiedItem[] = [
  {
    kw: 3,
    inverterRating: '3 kW',
    recommendedDcArray: '3.10 – 3.72 kWp',
    panelCountText: '5 – 6 panels',
    panelCountMin: 5,
    panelCountMax: 6,
    estDailyYield: '10.1 – 12.1 kWh',
    targetMonthlyBill: '₱6,000 – ₱8,000',
    targetMonthlyBillShort: '₱6.0k–₱8.0k',
    targetDailyUsage: '13.3 – 17.8 kWh',
    expectedMonthlySavings: '₱4,500 – ₱5,500',
    coverageRatio: '~50% – 65%',
    phase: '1-Phase',
  },
  {
    kw: 4,
    inverterRating: '4 kW',
    recommendedDcArray: '4.34 – 4.96 kWp',
    panelCountText: '7 – 8 panels',
    panelCountMin: 7,
    panelCountMax: 8,
    estDailyYield: '14.2 – 16.2 kWh',
    targetMonthlyBill: '₱8,000 – ₱10,500',
    targetMonthlyBillShort: '₱8.0k–₱10.5k',
    targetDailyUsage: '17.8 – 23.3 kWh',
    expectedMonthlySavings: '₱6,400 – ₱7,300',
    coverageRatio: '~50% – 65%',
    phase: '1-Phase',
  },
  {
    kw: 5,
    inverterRating: '5 kW',
    recommendedDcArray: '5.58 – 6.20 kWp',
    panelCountText: '9 – 10 panels',
    panelCountMin: 9,
    panelCountMax: 10,
    estDailyYield: '18.2 – 20.2 kWh',
    targetMonthlyBill: '₱10,500 – ₱14,000',
    targetMonthlyBillShort: '₱10.5k–₱14.0k',
    targetDailyUsage: '23.3 – 31.1 kWh',
    expectedMonthlySavings: '₱8,200 – ₱9,100',
    coverageRatio: '~50% – 65%',
    phase: '1-Phase',
  },
  {
    kw: 6,
    inverterRating: '6 kW',
    recommendedDcArray: '6.82 – 7.44 kWp',
    panelCountText: '11 – 12 panels',
    panelCountMin: 11,
    panelCountMax: 12,
    estDailyYield: '22.3 – 24.3 kWh',
    targetMonthlyBill: '₱14,000 – ₱17,500',
    targetMonthlyBillShort: '₱14.0k–₱17.5k',
    targetDailyUsage: '31.1 – 38.9 kWh',
    expectedMonthlySavings: '₱10,000 – ₱11,000',
    coverageRatio: '~50% – 65%',
    phase: '1-Phase',
  },
  {
    kw: 8,
    inverterRating: '8 kW',
    recommendedDcArray: '8.68 – 9.92 kWp',
    panelCountText: '14 – 16 panels',
    panelCountMin: 14,
    panelCountMax: 16,
    estDailyYield: '28.4 – 32.4 kWh',
    targetMonthlyBill: '₱18,000 – ₱22,000',
    targetMonthlyBillShort: '₱18.0k–₱22.0k',
    targetDailyUsage: '40.0 – 48.9 kWh',
    expectedMonthlySavings: '₱12,700 – ₱14,500',
    coverageRatio: '~50% – 65%',
    phase: '1-Phase',
  },
  {
    kw: 10,
    inverterRating: '10 kW',
    recommendedDcArray: '11.16 – 12.40 kWp',
    panelCountText: '18 – 20 panels',
    panelCountMin: 18,
    panelCountMax: 20,
    estDailyYield: '36.5 – 40.5 kWh',
    targetMonthlyBill: '₱23,000 – ₱28,000',
    targetMonthlyBillShort: '₱23.0k–₱28.0k',
    targetDailyUsage: '51.1 – 62.2 kWh',
    expectedMonthlySavings: '₱16,400 – ₱18,200',
    coverageRatio: '~50% – 65%',
    phase: '3-Phase',
  },
  {
    kw: 12,
    inverterRating: '12 kW',
    recommendedDcArray: '13.64 – 14.88 kWp',
    panelCountText: '22 – 24 panels',
    panelCountMin: 22,
    panelCountMax: 24,
    estDailyYield: '44.6 – 48.6 kWh',
    targetMonthlyBill: '₱28,000 – ₱35,000',
    targetMonthlyBillShort: '₱28.0k–₱35.0k',
    targetDailyUsage: '62.2 – 77.8 kWh',
    expectedMonthlySavings: '₱20,000 – ₱21,800',
    coverageRatio: '~50% – 65%',
    phase: '3-Phase',
  },
  {
    kw: 16,
    inverterRating: '16 kW',
    recommendedDcArray: '18.60 – 19.84 kWp',
    panelCountText: '30 – 32 panels',
    panelCountMin: 30,
    panelCountMax: 32,
    estDailyYield: '60.8 – 64.8 kWh',
    targetMonthlyBill: '₱36,000 – ₱46,000',
    targetMonthlyBillShort: '₱36.0k–₱46.0k',
    targetDailyUsage: '80.0 – 102.2 kWh',
    expectedMonthlySavings: '₱27,300 – ₱29,100',
    coverageRatio: '~50% – 65%',
    phase: '3-Phase',
  },
  {
    kw: 20,
    inverterRating: '20 kW',
    recommendedDcArray: '22.32 – 24.80 kWp',
    panelCountText: '36 – 40 panels',
    panelCountMin: 36,
    panelCountMax: 40,
    estDailyYield: '73.0 – 81.1 kWh',
    targetMonthlyBill: '₱46,000 – ₱58,000',
    targetMonthlyBillShort: '₱46.0k–₱58.0k',
    targetDailyUsage: '102.2 – 128.9 kWh',
    expectedMonthlySavings: '₱32,800 – ₱36,500',
    coverageRatio: '~50% – 65%',
    phase: '3-Phase',
  },
  {
    kw: 30,
    inverterRating: '30 kW',
    recommendedDcArray: '34.72 – 37.20 kWp',
    panelCountText: '56 – 60 panels',
    panelCountMin: 56,
    panelCountMax: 60,
    estDailyYield: '113.5 – 121.6 kWh',
    targetMonthlyBill: '₱75,000 – ₱95,000',
    targetMonthlyBillShort: '₱75.0k–₱95.0k',
    targetDailyUsage: '166.7 – 211.1 kWh',
    expectedMonthlySavings: '₱51,000 – ₱54,700',
    coverageRatio: '~50% – 65%',
    phase: '3-Phase',
  },
]

/**
 * 4. Hybrid Reference Matrix (Battery Storage / 24-Hour Offset)
 * Battery storage, brownout resilience, and whole-day offset.
 */
export const SIZING_REFERENCE_V3_HYBRID: SizingReferenceV3HybridItem[] = [
  {
    kw: 3,
    inverterRating: '3 kW',
    recommendedDcArray: '3.72 kWp',
    panelCountText: '6 panels',
    panelCountMin: 6,
    panelCountMax: 6,
    recommendedBatteryBank: '5.12 kWh (100Ah)',
    targetMonthlyBill: '₱4,500 – ₱6,000',
    targetMonthlyBillShort: '₱4.5k–₱6.0k',
    totalDailyEnergy: '10.0 – 13.3 kWh',
    netMonthlySavings: '₱4,000 – ₱5,500',
    coverageRatio: 'Up to 95%',
    phase: '1-Phase',
  },
  {
    kw: 4,
    inverterRating: '4 kW',
    recommendedDcArray: '4.96 kWp',
    panelCountText: '8 panels',
    panelCountMin: 8,
    panelCountMax: 8,
    recommendedBatteryBank: '10.24 kWh (200Ah)',
    targetMonthlyBill: '₱6,000 – ₱8,000',
    targetMonthlyBillShort: '₱6.0k–₱8.0k',
    totalDailyEnergy: '13.3 – 17.8 kWh',
    netMonthlySavings: '₱5,500 – ₱7,500',
    coverageRatio: 'Up to 95%',
    phase: '1-Phase',
  },
  {
    kw: 5,
    inverterRating: '5 kW',
    recommendedDcArray: '6.20 kWp',
    panelCountText: '10 panels',
    panelCountMin: 10,
    panelCountMax: 10,
    recommendedBatteryBank: '10.24 – 14.3 kWh',
    targetMonthlyBill: '₱7,500 – ₱10,000',
    targetMonthlyBillShort: '₱7.5k–₱10.0k',
    totalDailyEnergy: '16.7 – 22.2 kWh',
    netMonthlySavings: '₱7,000 – ₱9,500',
    coverageRatio: 'Up to 95%',
    phase: '1-Phase',
  },
  {
    kw: 6,
    inverterRating: '6 kW',
    recommendedDcArray: '7.44 kWp',
    panelCountText: '12 panels',
    panelCountMin: 12,
    panelCountMax: 12,
    recommendedBatteryBank: '14.3 – 16.08 kWh (314Ah)',
    targetMonthlyBill: '₱10,000 – ₱12,500',
    targetMonthlyBillShort: '₱10.0k–₱12.5k',
    totalDailyEnergy: '22.2 – 27.8 kWh',
    netMonthlySavings: '₱9,500 – ₱12,000',
    coverageRatio: 'Up to 95%',
    phase: '1-Phase',
  },
  {
    kw: 8,
    inverterRating: '8 kW',
    recommendedDcArray: '9.92 kWp',
    panelCountText: '16 panels',
    panelCountMin: 16,
    panelCountMax: 16,
    recommendedBatteryBank: '16.08 – 20.48 kWh',
    targetMonthlyBill: '₱12,500 – ₱15,500',
    targetMonthlyBillShort: '₱12.5k–₱15.5k',
    totalDailyEnergy: '27.8 – 34.4 kWh',
    netMonthlySavings: '₱12,000 – ₱15,000',
    coverageRatio: 'Up to 95%',
    phase: '1-Phase',
  },
  {
    kw: 10,
    inverterRating: '10 kW',
    recommendedDcArray: '12.40 – 13.64 kWp',
    panelCountText: '20 – 22 panels',
    panelCountMin: 20,
    panelCountMax: 22,
    recommendedBatteryBank: '16.08 – 30.0 kWh',
    targetMonthlyBill: '₱16,000 – ₱20,000',
    targetMonthlyBillShort: '₱16.0k–₱20.0k',
    totalDailyEnergy: '35.6 – 44.4 kWh',
    netMonthlySavings: '₱15,500 – ₱19,500',
    coverageRatio: 'Up to 95%',
    phase: '3-Phase',
  },
  {
    kw: 12,
    inverterRating: '12 kW',
    recommendedDcArray: '14.88 – 16.12 kWp',
    panelCountText: '24 – 26 panels',
    panelCountMin: 24,
    panelCountMax: 26,
    recommendedBatteryBank: '25.6 – 32.0 kWh',
    targetMonthlyBill: '₱20,000 – ₱26,000',
    targetMonthlyBillShort: '₱20.0k–₱26.0k',
    totalDailyEnergy: '44.4 – 57.8 kWh',
    netMonthlySavings: '₱19,500 – ₱25,000',
    coverageRatio: 'Up to 95%',
    phase: '3-Phase',
  },
  {
    kw: 16,
    inverterRating: '16 kW',
    recommendedDcArray: '19.84 – 21.08 kWp',
    panelCountText: '32 – 34 panels',
    panelCountMin: 32,
    panelCountMax: 34,
    recommendedBatteryBank: '30.0 – 45.0 kWh',
    targetMonthlyBill: '₱26,000 – ₱34,000',
    targetMonthlyBillShort: '₱26.0k–₱34.0k',
    totalDailyEnergy: '57.8 – 75.6 kWh',
    netMonthlySavings: '₱25,000 – ₱33,000',
    coverageRatio: 'Up to 95%',
    phase: '3-Phase',
  },
  {
    kw: 20,
    inverterRating: '20 kW',
    recommendedDcArray: '24.80 – 27.28 kWp',
    panelCountText: '40 – 44 panels',
    panelCountMin: 40,
    panelCountMax: 44,
    recommendedBatteryBank: '40.0 – 60.0 kWh',
    targetMonthlyBill: '₱35,000 – ₱46,000',
    targetMonthlyBillShort: '₱35.0k–₱46.0k',
    totalDailyEnergy: '77.8 – 102.2 kWh',
    netMonthlySavings: '₱34,000 – ₱44,000',
    coverageRatio: 'Up to 95%',
    phase: '3-Phase',
  },
  {
    kw: 30,
    inverterRating: '30 kW',
    recommendedDcArray: '37.20 – 40.92 kWp',
    panelCountText: '60 – 66 panels',
    panelCountMin: 60,
    panelCountMax: 66,
    recommendedBatteryBank: '60.0 – 80.0 kWh',
    targetMonthlyBill: '₱55,000 – ₱75,000',
    targetMonthlyBillShort: '₱55.0k–₱75.0k',
    totalDailyEnergy: '122.2 – 166.7 kWh',
    netMonthlySavings: '₱53,000 – ₱72,000',
    coverageRatio: 'Up to 95%',
    phase: '3-Phase',
  },
]

// ==========================================
// V2 LEGACY SPECIFICATION
// ==========================================

export interface SizingReferenceV2Item {
  kw: number
  commercialPackage: string
  packageModules: string
  panelCount: number
  actualDcCapacity: string
  inverterAcOutput: string
  electricalGrid: string
  targetMonthlyKwh: string
  derivedElectricBill: string
  derivedElectricBillShort: string
  estMonthlyGen: string
  targetSolarOffset: string
  phase: '1-Phase' | '3-Phase'
}

export const SIZING_REFERENCE_V2: SizingReferenceV2Item[] = [
  {
    kw: 3.0,
    commercialPackage: '3.0 kW Package',
    packageModules: '5 pcs',
    panelCount: 5,
    actualDcCapacity: '3.10 kWp',
    inverterAcOutput: '3.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '330 - 450 kWh',
    derivedElectricBill: '₱5,000 – ₱6,700',
    derivedElectricBillShort: '₱5.0k–₱6.7k',
    estMonthlyGen: '304.7 kWh/mo',
    targetSolarOffset: '68% - 85%',
    phase: '1-Phase',
  },
  {
    kw: 4.0,
    commercialPackage: '4.0 kW Package',
    packageModules: '6 pcs',
    panelCount: 6,
    actualDcCapacity: '3.72 kWp',
    inverterAcOutput: '4.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '450 - 600 kWh',
    derivedElectricBill: '₱6,700 – ₱9,000',
    derivedElectricBillShort: '₱6.7k–₱9.0k',
    estMonthlyGen: '365.6 kWh/mo',
    targetSolarOffset: '61% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 5.0,
    commercialPackage: '5.0 kW Package',
    packageModules: '8 pcs',
    panelCount: 8,
    actualDcCapacity: '4.96 kWp',
    inverterAcOutput: '5.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '600 - 750 kWh',
    derivedElectricBill: '₱9,000 – ₱11,200',
    derivedElectricBillShort: '₱9.0k–₱11.2k',
    estMonthlyGen: '487.5 kWh/mo',
    targetSolarOffset: '65% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 6.0,
    commercialPackage: '6.0 kW Package',
    packageModules: '10 pcs',
    panelCount: 10,
    actualDcCapacity: '6.20 kWp',
    inverterAcOutput: '6.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '750 - 1,000 kWh',
    derivedElectricBill: '₱11,200 – ₱15,000',
    derivedElectricBillShort: '₱11.2k–₱15.0k',
    estMonthlyGen: '609.3 kWh/mo',
    targetSolarOffset: '61% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 8.0,
    commercialPackage: '8.0 kW Package',
    packageModules: '13 pcs (2 Str)',
    panelCount: 13,
    actualDcCapacity: '8.06 kWp',
    inverterAcOutput: '8.0 kW AC',
    electricalGrid: '1-Phase 230V',
    targetMonthlyKwh: '1,000 - 1,250 kWh',
    derivedElectricBill: '₱15,000 – ₱18,700',
    derivedElectricBillShort: '₱15.0k–₱18.7k',
    estMonthlyGen: '792.1 kWh/mo',
    targetSolarOffset: '63% - 80%',
    phase: '1-Phase',
  },
  {
    kw: 10.0,
    commercialPackage: '10.0 kW Package',
    packageModules: '16 pcs (2 Str)',
    panelCount: 16,
    actualDcCapacity: '9.92 kWp',
    inverterAcOutput: '10.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '1,250 - 1,600 kWh',
    derivedElectricBill: '₱18,700 – ₱24,000',
    derivedElectricBillShort: '₱18.7k–₱24.0k',
    estMonthlyGen: '974.9 kWh/mo',
    targetSolarOffset: '61% - 80%',
    phase: '3-Phase',
  },
  {
    kw: 12.0,
    commercialPackage: '12.0 kW Package',
    packageModules: '20 pcs (2 Str)',
    panelCount: 20,
    actualDcCapacity: '12.40 kWp',
    inverterAcOutput: '12.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '1,600 - 2,100 kWh',
    derivedElectricBill: '₱24,000 – ₱31,500',
    derivedElectricBillShort: '₱24.0k–₱31.5k',
    estMonthlyGen: '1,218.7 kWh/mo',
    targetSolarOffset: '58% - 80%',
    phase: '3-Phase',
  },
  {
    kw: 16.0,
    commercialPackage: '16.0 kW Package',
    packageModules: '26 pcs (2 Str)',
    panelCount: 26,
    actualDcCapacity: '16.12 kWp',
    inverterAcOutput: '16.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '2,100 - 2,600 kWh',
    derivedElectricBill: '₱31,500 – ₱39,000',
    derivedElectricBillShort: '₱31.5k–₱39.0k',
    estMonthlyGen: '1,584.3 kWh/mo',
    targetSolarOffset: '61% - 75%',
    phase: '3-Phase',
  },
  {
    kw: 20.0,
    commercialPackage: '20.0 kW Package',
    packageModules: '32 pcs (2 Str)',
    panelCount: 32,
    actualDcCapacity: '19.84 kWp',
    inverterAcOutput: '20.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '2,600 - 3,600 kWh',
    derivedElectricBill: '₱39,000 – ₱54,000',
    derivedElectricBillShort: '₱39.0k–₱54.0k',
    estMonthlyGen: '1,949.9 kWh/mo',
    targetSolarOffset: '54% - 75%',
    phase: '3-Phase',
  },
  {
    kw: 30.0,
    commercialPackage: '30.0 kW Package',
    packageModules: '96 pcs (60.48 kWp)',
    panelCount: 96,
    actualDcCapacity: '60.48 kWp',
    inverterAcOutput: '30.0 kW AC',
    electricalGrid: '1-Phase 230V / 3-Phase',
    targetMonthlyKwh: '5,000 - 8,000 kWh',
    derivedElectricBill: '₱75,000 – ₱120,000',
    derivedElectricBillShort: '₱75.0k–₱120k',
    estMonthlyGen: '5,849.6 kWh/mo',
    targetSolarOffset: '65% - 85%',
    phase: '1-Phase',
  },
  {
    kw: 50.0,
    commercialPackage: '50.0 kW Package',
    packageModules: '81 pcs (5 Str)',
    panelCount: 81,
    actualDcCapacity: '50.22 kWp',
    inverterAcOutput: '50.0 kW AC',
    electricalGrid: '3-Phase 230V/400V',
    targetMonthlyKwh: '5,000 - 8,000 kWh',
    derivedElectricBill: '₱75,000 – ₱120,000',
    derivedElectricBillShort: '₱75.0k–₱120k',
    estMonthlyGen: '4,935.6 kWh/mo',
    targetSolarOffset: '62% - 75%',
    phase: '3-Phase',
  },
]

// ==========================================
// V1 LEGACY MATRIX
// ==========================================

export const KW_TO_ELECTRIC_BILL_V1: Record<number, string> = {
  3: '₱5,000',
  4: '₱6,500',
  5: '₱8,000',
  6: '₱9,000',
  8: '₱10,000',
  10: '₱15,000',
  12: '₱20,000',
  16: '₱30,000',
  20: '₱40,000',
  30: '₱60,000',
  50: '₱100,000',
}

// ==========================================
// HELPER LOOKUP FUNCTIONS
// ==========================================

export function getElectricBillRefV3(
  kw: number,
  systemType: 'hybrid' | 'ongrid' = 'hybrid',
  short = true
): string {
  if (systemType === 'ongrid') {
    const item = SIZING_REFERENCE_V3_GRIDTIED.find(s => Math.abs(s.kw - kw) < 0.1)
    if (item) {
      return short ? item.targetMonthlyBillShort : item.targetMonthlyBill
    }
  } else {
    const item = SIZING_REFERENCE_V3_HYBRID.find(s => Math.abs(s.kw - kw) < 0.1)
    if (item) {
      return short ? item.targetMonthlyBillShort : item.targetMonthlyBill
    }
  }
  return `₱${Math.round(kw * 1600).toLocaleString()}`
}

export function getSizingReferenceItemV3(
  kw: number,
  systemType: 'hybrid' | 'ongrid' = 'hybrid'
) {
  if (systemType === 'ongrid') {
    return SIZING_REFERENCE_V3_GRIDTIED.find(s => Math.abs(s.kw - kw) < 0.1)
  }
  return SIZING_REFERENCE_V3_HYBRID.find(s => Math.abs(s.kw - kw) < 0.1)
}

export function getElectricBillRefV2(kw: number, short = true): string {
  const item = SIZING_REFERENCE_V2.find(s => Math.abs(s.kw - kw) < 0.1)
  if (item) {
    return short ? item.derivedElectricBillShort : item.derivedElectricBill
  }
  return `₱${Math.round(kw * 1600).toLocaleString()}`
}

export function getSizingReferenceItem(kw: number): SizingReferenceV2Item | undefined {
  return SIZING_REFERENCE_V2.find(s => Math.abs(s.kw - kw) < 0.1)
}

// ==========================================
// MODAL COMPONENT
// ==========================================

export interface SizingReferenceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeKw?: number
  onSelectKw?: (kw: number) => void
  currentRefVersion?: 'v1' | 'v2' | 'v3'
  onToggleVersion?: (ver: 'v1' | 'v2' | 'v3') => void
  systemType?: 'hybrid' | 'ongrid'
}

export function SizingReferenceModal({
  open,
  onOpenChange,
  activeKw,
  onSelectKw,
  currentRefVersion = 'v3',
  onToggleVersion,
  systemType = 'hybrid',
}: SizingReferenceModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<'v1' | 'v2' | 'v3'>(currentRefVersion)
  const [v3Type, setV3Type] = useState<'hybrid' | 'ongrid'>(systemType)
  const [searchQuery, setSearchQuery] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<'all' | '1-Phase' | '3-Phase'>('all')
  const [copiedKw, setCopiedKw] = useState<number | null>(null)
  const [showSampleCalc, setShowSampleCalc] = useState(false)
  const [copiedSample, setCopiedSample] = useState(false)

  // Keep internal version in sync with parent prop
  useEffect(() => {
    setSelectedVersion(currentRefVersion)
  }, [currentRefVersion])

  // Keep internal V3 matrix type in sync with parent systemType
  useEffect(() => {
    setV3Type(systemType)
  }, [systemType])

  const handleSelectVersion = (ver: 'v1' | 'v2' | 'v3') => {
    setSelectedVersion(ver)
    onToggleVersion?.(ver)
  }

  const sampleCalcText = `Sample Sizing Calculation: ₱5,000 Monthly Bill (at ₱15.00/kWh Tariff)

1. Baseline Client Consumption
  • Monthly Energy Usage: ₱5,000 ÷ ₱15.00/kWh = 333.33 kWh/month

2. Solar PV System Sizing
  • Solar Yield Constants:
      • Monthly Yield Factor: 4.20(PSH) × 30(month) × 0.78(PR) = 98.28 kWh/kWp/month
  • Required DC Capacity: 333.33 kWh ÷ 98.28 = 3.39 kWp
  • Panels Needed (620W N-Type panels):
      • Raw Count: 3.39 kWp ÷ 0.62 kWp/panel = 5.47 panels
      • Standard Installation: 6 panels (rounded up to avoid undersizing)
  • Actual Installed DC Capacity: 6 panels × 0.62 kWp = 3.72 kWp

3. Actual Performance & Final Achieved Offset
  • Actual Estimated Monthly Generation: 3.72 kWp × 98.28 = 365.60 kWh/month
  • Final Realized Solar Offset: (365.60 kWh ÷ 333.33 kWh) × 100 = 109% (exceeds the 80% minimum requirement)
  • Recommended Package: 4.0 kW Hybrid Package (1-Phase 230V)

4. Monthly Financial Results
  • Estimated Monthly Solar Savings: 365.60 kWh × ₱15.00/kWh = ₱5,480.00/month
  • Remaining Estimated Grid Bill: ₱5,000.00 - ₱5,480.00 = ₱-480.00/month`

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleCalcText)
    setCopiedSample(true)
    setTimeout(() => setCopiedSample(false), 1500)
  }

  // Filtered V3 Grid-Tied Items
  const filteredV3GridTied = useMemo(() => {
    return SIZING_REFERENCE_V3_GRIDTIED.filter((item) => {
      const matchesPhase = phaseFilter === 'all' || item.phase === phaseFilter
      if (!matchesPhase) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        item.inverterRating.toLowerCase().includes(q) ||
        item.recommendedDcArray.toLowerCase().includes(q) ||
        item.panelCountText.toLowerCase().includes(q) ||
        item.estDailyYield.toLowerCase().includes(q) ||
        item.targetMonthlyBill.toLowerCase().includes(q) ||
        item.targetDailyUsage.toLowerCase().includes(q) ||
        item.expectedMonthlySavings.toLowerCase().includes(q) ||
        item.coverageRatio.toLowerCase().includes(q)
      )
    })
  }, [searchQuery, phaseFilter])

  // Filtered V3 Hybrid Items
  const filteredV3Hybrid = useMemo(() => {
    return SIZING_REFERENCE_V3_HYBRID.filter((item) => {
      const matchesPhase = phaseFilter === 'all' || item.phase === phaseFilter
      if (!matchesPhase) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        item.inverterRating.toLowerCase().includes(q) ||
        item.recommendedDcArray.toLowerCase().includes(q) ||
        item.panelCountText.toLowerCase().includes(q) ||
        item.recommendedBatteryBank.toLowerCase().includes(q) ||
        item.targetMonthlyBill.toLowerCase().includes(q) ||
        item.totalDailyEnergy.toLowerCase().includes(q) ||
        item.netMonthlySavings.toLowerCase().includes(q) ||
        item.coverageRatio.toLowerCase().includes(q)
      )
    })
  }, [searchQuery, phaseFilter])

  // Filtered V2 Items
  const filteredV2Items = useMemo(() => {
    return SIZING_REFERENCE_V2.filter((item) => {
      const matchesPhase = phaseFilter === 'all' || item.phase === phaseFilter
      if (!matchesPhase) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        item.commercialPackage.toLowerCase().includes(q) ||
        item.packageModules.toLowerCase().includes(q) ||
        item.actualDcCapacity.toLowerCase().includes(q) ||
        item.inverterAcOutput.toLowerCase().includes(q) ||
        item.electricalGrid.toLowerCase().includes(q) ||
        item.targetMonthlyKwh.toLowerCase().includes(q) ||
        item.derivedElectricBill.toLowerCase().includes(q) ||
        item.estMonthlyGen.toLowerCase().includes(q) ||
        item.targetSolarOffset.toLowerCase().includes(q)
      )
    })
  }, [searchQuery, phaseFilter])

  // Copy row handlers
  const handleCopyV3GridTied = (item: SizingReferenceV3GridTiedItem) => {
    const text = `Grid-Tied ${item.inverterRating} | Array: ${item.recommendedDcArray} (${item.panelCountText}) | Est Yield: ${item.estDailyYield} | Target Bill: ${item.targetMonthlyBill} | Daily Usage: ${item.targetDailyUsage} | Savings: ${item.expectedMonthlySavings} | Coverage: ${item.coverageRatio}`
    navigator.clipboard.writeText(text)
    setCopiedKw(item.kw)
    setTimeout(() => setCopiedKw(null), 1500)
  }

  const handleCopyV3Hybrid = (item: SizingReferenceV3HybridItem) => {
    const text = `Hybrid ${item.inverterRating} | Array: ${item.recommendedDcArray} (${item.panelCountText}) | Battery: ${item.recommendedBatteryBank} | Target Bill: ${item.targetMonthlyBill} | Daily Energy: ${item.totalDailyEnergy} | Savings: ${item.netMonthlySavings} | Coverage: ${item.coverageRatio}`
    navigator.clipboard.writeText(text)
    setCopiedKw(item.kw)
    setTimeout(() => setCopiedKw(null), 1500)
  }

  const handleCopyV2Row = (item: SizingReferenceV2Item) => {
    const text = `${item.commercialPackage} | Modules: ${item.packageModules} | DC: ${item.actualDcCapacity} | Inverter: ${item.inverterAcOutput} | Grid: ${item.electricalGrid} | Target: ${item.targetMonthlyKwh} | Bill: ${item.derivedElectricBill} | Gen: ${item.estMonthlyGen} | Offset: ${item.targetSolarOffset}`
    navigator.clipboard.writeText(text)
    setCopiedKw(item.kw)
    setTimeout(() => setCopiedKw(null), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl! w-[96vw] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-[18px]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-[10px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Zap size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    Electric Bill & Sizing Reference
                  </DialogTitle>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-primary/15 text-primary border border-primary/25">
                    {selectedVersion.toUpperCase()} Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Standard commercial packages, DC/AC capacities, target bills, solar yields, and financial savings.
                </p>
              </div>
            </div>

            {/* Version Switcher (V3 / V2 / V1) */}
            <div className="flex items-center gap-1.5 bg-secondary/80 p-1 rounded-[10px] border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 hidden sm:inline">
                Version:
              </span>
              <button
                type="button"
                onClick={() => handleSelectVersion('v3')}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded-[7px] transition-all cursor-pointer select-none flex items-center gap-1",
                  selectedVersion === 'v3'
                    ? "bg-primary text-primary-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <span>V3</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/30">
                  New
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectVersion('v2')}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded-[7px] transition-all cursor-pointer select-none",
                  selectedVersion === 'v2'
                    ? "bg-primary text-primary-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                V2
              </button>
              <button
                type="button"
                onClick={() => handleSelectVersion('v1')}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded-[7px] transition-all cursor-pointer select-none",
                  selectedVersion === 'v1'
                    ? "bg-primary text-primary-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                V1
              </button>
            </div>
          </div>

          {/* Subheader Toolbar: V3 Dual System Toggle or V2 Sample Calc */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/50">
            {selectedVersion === 'v3' ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-secondary p-0.5 rounded-[8px] border border-border">
                  <button
                    type="button"
                    onClick={() => setV3Type('hybrid')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-[6px] transition-all cursor-pointer select-none flex items-center gap-1.5",
                      v3Type === 'hybrid'
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BatteryCharging size={14} />
                    <span>⚡ 4. Hybrid Matrix (24-Hour Battery Storage)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setV3Type('ongrid')}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-[6px] transition-all cursor-pointer select-none flex items-center gap-1.5",
                      v3Type === 'ongrid'
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sun size={14} />
                    <span>🌐 3. Grid-Tied Matrix (Zero-Export Daytime)</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSampleCalc(!showSampleCalc)}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-[8px] transition-all cursor-pointer border flex items-center gap-1.5 select-none",
                  showSampleCalc
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/70 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles size={13} className={showSampleCalc ? "text-amber-300 fill-amber-300" : "text-amber-500"} />
                <span>{showSampleCalc ? 'Hide Calculation Sample' : 'Sample Sizing Calculation (₱5,000)'}</span>
              </button>
            )}

            {/* Phase Filters */}
            <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-[8px] border border-border shrink-0 ml-auto">
              {(['all', '1-Phase', '3-Phase'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPhaseFilter(p)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded-[6px] transition-all cursor-pointer capitalize",
                    phaseFilter === p
                      ? "bg-background text-foreground shadow-2xs font-extrabold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === 'all' ? 'All Phases' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inverter rating, kW, recommended DC array, panels, bill range, daily yield, savings..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-background rounded-[8px] border border-border focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table Content & Details */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 space-y-4">
          {/* ========================================================= */}
          {/* VERSION 3: DUAL MATRICES (GRID-TIED & HYBRID)             */}
          {/* ========================================================= */}
          {selectedVersion === 'v3' && (
            <div className="space-y-3">
              {/* Matrix Context Banner */}
              <div className="p-3 bg-secondary/35 border border-border rounded-[12px] flex items-start gap-2.5 text-xs">
                <div className="mt-0.5 p-1 rounded bg-primary/10 text-primary shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <div className="font-bold text-foreground">
                    {v3Type === 'ongrid'
                      ? 'Section 3: Grid-Tied Reference Matrix (Zero-Export / Daytime Only)'
                      : 'Section 4: Hybrid Reference Matrix (Battery Storage / 24-Hour Offset)'}
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    {v3Type === 'ongrid'
                      ? 'Use this table when clients want to reduce daytime air conditioning and daytime utility expenses without investing in costly battery banks.'
                      : 'Use this table when clients experience frequent brownouts, high night-time loads, or wish to zero out their bill completely.'}
                  </p>
                </div>
              </div>

              {/* Grid-Tied Table View */}
              {v3Type === 'ongrid' && (
                <div className="border border-border rounded-[14px] overflow-x-auto bg-card shadow-2xs">
                  <table className="w-full border-collapse text-left text-xs min-w-[920px]">
                    <thead>
                      <tr className="bg-secondary/70 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        <th className="py-2.5 px-3.5 font-bold">Inverter Rating</th>
                        <th className="py-2.5 px-3 font-bold text-center">Recommended DC Array</th>
                        <th className="py-2.5 px-3 font-bold text-center">Panel Count (620W)</th>
                        <th className="py-2.5 px-3 font-bold text-center">Est. Daily Yield</th>
                        <th className="py-2.5 px-3.5 font-bold text-center text-primary">Target Monthly Bill</th>
                        <th className="py-2.5 px-3 font-bold text-center">Target Daily Usage</th>
                        <th className="py-2.5 px-3.5 font-bold text-center text-emerald-600 dark:text-emerald-400">Expected Monthly Savings</th>
                        <th className="py-2.5 px-3 font-bold text-center">Coverage Ratio</th>
                        <th className="py-2.5 px-3 font-bold text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-medium">
                      {filteredV3GridTied.map((item) => {
                        const isSelected = activeKw === item.kw
                        const isThreePhase = item.phase === '3-Phase'

                        return (
                          <tr
                            key={item.kw}
                            className={cn(
                              "transition-colors group",
                              isSelected
                                ? "bg-primary/10 dark:bg-primary/15 font-semibold"
                                : "hover:bg-secondary/40"
                            )}
                          >
                            {/* Inverter Rating */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    isSelected ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
                                  )}
                                />
                                <div>
                                  <span className="font-bold text-foreground text-xs">{item.inverterRating}</span>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    <span className={cn(
                                      "px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border",
                                      isThreePhase
                                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                                        : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                    )}>
                                      {item.phase}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Recommended DC Array */}
                            <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                              {item.recommendedDcArray}
                            </td>

                            {/* Panel Count (620W) */}
                            <td className="py-3 px-3 text-center">
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-foreground bg-secondary/80 px-2 py-0.5 rounded-[6px] border border-border">
                                {item.panelCountText}
                              </span>
                            </td>

                            {/* Est. Daily Yield */}
                            <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                              {item.estDailyYield}
                            </td>

                            {/* Target Monthly Bill */}
                            <td className="py-3 px-3.5 text-center">
                              <span className="font-mono font-extrabold text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-[8px] border border-primary/20 whitespace-nowrap">
                                {item.targetMonthlyBill}
                              </span>
                            </td>

                            {/* Target Daily Usage */}
                            <td className="py-3 px-3 text-center font-mono text-foreground text-[11px]">
                              {item.targetDailyUsage}
                            </td>

                            {/* Expected Monthly Savings */}
                            <td className="py-3 px-3.5 text-center">
                              <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-[8px] border border-emerald-500/20 whitespace-nowrap">
                                {item.expectedMonthlySavings}
                              </span>
                            </td>

                            {/* Coverage Ratio */}
                            <td className="py-3 px-3 text-center">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                {item.coverageRatio}
                              </span>
                            </td>

                            {/* Action */}
                            <td className="py-3 px-3 text-right pr-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleCopyV3GridTied(item)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Copy package details to clipboard"
                                >
                                  {copiedKw === item.kw ? (
                                    <Check size={12} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </Button>
                                {onSelectKw && (
                                  <Button
                                    type="button"
                                    variant={isSelected ? "default" : "outline"}
                                    size="xs"
                                    onClick={() => {
                                      onSelectKw(item.kw)
                                      onOpenChange(false)
                                    }}
                                    className={cn(
                                      "h-7 px-2 text-[10px] font-bold cursor-pointer transition-all",
                                      isSelected
                                        ? "bg-primary text-primary-foreground shadow-xs"
                                        : "hover:bg-primary hover:text-primary-foreground"
                                    )}
                                  >
                                    {isSelected ? "Selected" : "Select"}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Hybrid Table View */}
              {v3Type === 'hybrid' && (
                <div className="border border-border rounded-[14px] overflow-x-auto bg-card shadow-2xs">
                  <table className="w-full border-collapse text-left text-xs min-w-[940px]">
                    <thead>
                      <tr className="bg-secondary/70 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        <th className="py-2.5 px-3.5 font-bold">Inverter Rating</th>
                        <th className="py-2.5 px-3 font-bold text-center">Recommended DC Array</th>
                        <th className="py-2.5 px-3 font-bold text-center">Panel Count (620W)</th>
                        <th className="py-2.5 px-3 font-bold text-center">Recommended Battery Bank</th>
                        <th className="py-2.5 px-3.5 font-bold text-center text-primary">Target Monthly Bill</th>
                        <th className="py-2.5 px-3 font-bold text-center">Total Daily Energy</th>
                        <th className="py-2.5 px-3.5 font-bold text-center text-emerald-600 dark:text-emerald-400">Net Monthly Savings</th>
                        <th className="py-2.5 px-3 font-bold text-center">Coverage Ratio</th>
                        <th className="py-2.5 px-3 font-bold text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-medium">
                      {filteredV3Hybrid.map((item) => {
                        const isSelected = activeKw === item.kw
                        const isThreePhase = item.phase === '3-Phase'

                        return (
                          <tr
                            key={item.kw}
                            className={cn(
                              "transition-colors group",
                              isSelected
                                ? "bg-primary/10 dark:bg-primary/15 font-semibold"
                                : "hover:bg-secondary/40"
                            )}
                          >
                            {/* Inverter Rating */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    isSelected ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
                                  )}
                                />
                                <div>
                                  <span className="font-bold text-foreground text-xs">{item.inverterRating}</span>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    <span className={cn(
                                      "px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border",
                                      isThreePhase
                                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                                        : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                    )}>
                                      {item.phase}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Recommended DC Array */}
                            <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                              {item.recommendedDcArray}
                            </td>

                            {/* Panel Count (620W) */}
                            <td className="py-3 px-3 text-center">
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-foreground bg-secondary/80 px-2 py-0.5 rounded-[6px] border border-border">
                                {item.panelCountText}
                              </span>
                            </td>

                            {/* Recommended Battery Bank */}
                            <td className="py-3 px-3 text-center">
                              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold whitespace-nowrap">
                                🔋 {item.recommendedBatteryBank}
                              </span>
                            </td>

                            {/* Target Monthly Bill */}
                            <td className="py-3 px-3.5 text-center">
                              <span className="font-mono font-extrabold text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-[8px] border border-primary/20 whitespace-nowrap">
                                {item.targetMonthlyBill}
                              </span>
                            </td>

                            {/* Total Daily Energy */}
                            <td className="py-3 px-3 text-center font-mono text-foreground text-[11px]">
                              {item.totalDailyEnergy}
                            </td>

                            {/* Net Monthly Savings */}
                            <td className="py-3 px-3.5 text-center">
                              <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-[8px] border border-emerald-500/20 whitespace-nowrap">
                                {item.netMonthlySavings}
                              </span>
                            </td>

                            {/* Coverage Ratio */}
                            <td className="py-3 px-3 text-center">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                {item.coverageRatio}
                              </span>
                            </td>

                            {/* Action */}
                            <td className="py-3 px-3 text-right pr-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleCopyV3Hybrid(item)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Copy package details to clipboard"
                                >
                                  {copiedKw === item.kw ? (
                                    <Check size={12} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </Button>
                                {onSelectKw && (
                                  <Button
                                    type="button"
                                    variant={isSelected ? "default" : "outline"}
                                    size="xs"
                                    onClick={() => {
                                      onSelectKw(item.kw)
                                      onOpenChange(false)
                                    }}
                                    className={cn(
                                      "h-7 px-2 text-[10px] font-bold cursor-pointer transition-all",
                                      isSelected
                                        ? "bg-primary text-primary-foreground shadow-xs"
                                        : "hover:bg-primary hover:text-primary-foreground"
                                    )}
                                  >
                                    {isSelected ? "Selected" : "Select"}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* VERSION 2: STANDARD COMMERCIAL MATRIX                     */}
          {/* ========================================================= */}
          {selectedVersion === 'v2' && (
            <div className="space-y-4">
              {showSampleCalc && (
                <div className="p-4 bg-secondary/40 dark:bg-secondary/20 border border-border rounded-[14px] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/70">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">
                          Sample Sizing Calculation: ₱5,000 Monthly Bill (at ₱15.00/kWh Tariff)
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Company engineering standard methodology for solar offset & DC sizing
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleCopySample}
                      className="h-7 px-2.5 text-[11px] gap-1.5 cursor-pointer font-semibold shadow-2xs"
                    >
                      {copiedSample ? (
                        <>
                          <Check size={12} className="text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Calculation</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    <div className="p-2.5 rounded-[10px] bg-background border border-border/60 space-y-1">
                      <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold">1</span>
                        Baseline Client Consumption
                      </div>
                      <div className="pl-5 text-muted-foreground font-mono text-[10.5px]">
                        • Monthly Energy Usage: ₱5,000 ÷ ₱15.00/kWh = <strong className="text-foreground">333.33 kWh/month</strong>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-[10px] bg-background border border-border/60 space-y-1">
                      <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold">2</span>
                        Solar PV System Sizing
                      </div>
                      <div className="pl-5 space-y-0.5 text-muted-foreground font-mono text-[10.5px]">
                        <div>• Solar Yield Constants:</div>
                        <div className="pl-3">• Monthly Yield Factor: 4.20(PSH) × 30(month) × 0.78(PR) = <strong className="text-foreground">98.28 kWh/kWp/month</strong></div>
                        <div>• Required DC Capacity: 333.33 kWh ÷ 98.28 = <strong className="text-foreground">3.39 kWp</strong></div>
                        <div>• Panels Needed (620W N-Type panels):</div>
                        <div className="pl-3">• Raw Count: 3.39 kWp ÷ 0.62 kWp/panel = 5.47 panels</div>
                        <div className="pl-3">• Standard Installation: <strong className="text-primary font-bold">6 panels</strong> (rounded up to avoid undersizing)</div>
                        <div>• Actual Installed DC Capacity: 6 panels × 0.62 kWp = <strong className="text-foreground">3.72 kWp</strong></div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-[10px] bg-background border border-border/60 space-y-1">
                      <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] flex items-center justify-center font-bold">3</span>
                        Actual Performance & Final Achieved Offset
                      </div>
                      <div className="pl-5 space-y-0.5 text-muted-foreground font-mono text-[10.5px]">
                        <div>• Actual Estimated Monthly Generation: 3.72 kWp × 98.28 = <strong className="text-emerald-600 dark:text-emerald-400">365.60 kWh/month</strong></div>
                        <div>• Final Realized Solar Offset: (365.60 kWh ÷ 333.33 kWh) × 100 = <strong className="text-emerald-600 dark:text-emerald-400 font-bold">109%</strong> (exceeds the 80% minimum requirement)</div>
                        <div>• Recommended Package: <strong className="text-foreground font-bold">4.0 kW Hybrid Package (1-Phase 230V)</strong></div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-[10px] bg-background border border-border/60 space-y-1">
                      <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] flex items-center justify-center font-bold">4</span>
                        Monthly Financial Results
                      </div>
                      <div className="pl-5 space-y-0.5 text-muted-foreground font-mono text-[10.5px]">
                        <div>• Estimated Monthly Solar Savings: 365.60 kWh × ₱15.00/kWh = <strong className="text-emerald-600 dark:text-emerald-400">₱5,480.00/month</strong></div>
                        <div>• Remaining Estimated Grid Bill: ₱5,000.00 - ₱5,480.00 = <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₱-480.00/month</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-border rounded-[14px] overflow-x-auto bg-card shadow-2xs">
                <table className="w-full border-collapse text-left text-xs min-w-[900px]">
                  <thead>
                    <tr className="bg-secondary/70 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                      <th className="py-2.5 px-3.5 font-bold">Commercial Package</th>
                      <th className="py-2.5 px-3 font-bold text-center">Package Modules</th>
                      <th className="py-2.5 px-3 font-bold text-center">Actual DC Cap</th>
                      <th className="py-2.5 px-3 font-bold text-center">Inverter AC</th>
                      <th className="py-2.5 px-3 font-bold text-center">Electrical Grid</th>
                      <th className="py-2.5 px-3 font-bold text-center">Target Monthly</th>
                      <th className="py-2.5 px-3.5 font-bold text-center text-primary">Derived Electric Bill</th>
                      <th className="py-2.5 px-3 font-bold text-center">Est. Monthly Gen</th>
                      <th className="py-2.5 px-3 font-bold text-center">Target Solar</th>
                      <th className="py-2.5 px-3 font-bold text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {filteredV2Items.map((item) => {
                      const isSelected = activeKw === item.kw
                      const isThreePhase = item.phase === '3-Phase'

                      return (
                        <tr
                          key={item.kw}
                          className={cn(
                            "transition-colors group",
                            isSelected
                              ? "bg-primary/10 dark:bg-primary/15 font-semibold"
                              : "hover:bg-secondary/40"
                          )}
                        >
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  isSelected ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
                                )}
                              />
                              <div>
                                <span className="font-bold text-foreground text-xs">{item.commercialPackage}</span>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {item.kw} kW Inverter System
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-foreground bg-secondary/80 px-2 py-0.5 rounded-[6px] border border-border">
                              {item.packageModules}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                            {item.actualDcCapacity}
                          </td>

                          <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                            {item.inverterAcOutput}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border inline-block whitespace-nowrap",
                                isThreePhase
                                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                                  : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                              )}
                            >
                              {item.electricalGrid}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono text-foreground text-[11px]">
                            {item.targetMonthlyKwh}
                          </td>

                          <td className="py-3 px-3.5 text-center">
                            <span className="font-mono font-extrabold text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-[8px] border border-primary/20 whitespace-nowrap">
                              {item.derivedElectricBill}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {item.estMonthlyGen}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              {item.targetSolarOffset}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => handleCopyV2Row(item)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Copy package details to clipboard"
                              >
                                {copiedKw === item.kw ? (
                                  <Check size={12} className="text-emerald-600" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </Button>
                              {onSelectKw && (
                                <Button
                                  type="button"
                                  variant={isSelected ? "default" : "outline"}
                                  size="xs"
                                  onClick={() => {
                                    onSelectKw(item.kw)
                                    onOpenChange(false)
                                  }}
                                  className={cn(
                                    "h-7 px-2 text-[10px] font-bold cursor-pointer transition-all",
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "hover:bg-primary hover:text-primary-foreground"
                                  )}
                                >
                                  {isSelected ? "Selected" : "Select"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VERSION 1: LEGACY SIMPLE TABLE                            */}
          {/* ========================================================= */}
          {selectedVersion === 'v1' && (
            <div className="space-y-3">
              <div className="p-3 bg-secondary/35 border border-border rounded-[12px] text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Version 1 (Legacy Fixed Baseline):</span> Simple fixed electric bill mapping per system kW capacity.
              </div>

              <div className="border border-border rounded-[14px] overflow-x-auto bg-card shadow-2xs max-w-2xl mx-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-secondary/70 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                      <th className="py-2.5 px-4 font-bold">System Capacity</th>
                      <th className="py-2.5 px-4 font-bold text-center text-primary">Estimated Electric Bill</th>
                      <th className="py-2.5 px-4 font-bold text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {Object.entries(KW_TO_ELECTRIC_BILL_V1).map(([kwStr, bill]) => {
                      const kw = Number(kwStr)
                      const isSelected = activeKw === kw

                      return (
                        <tr
                          key={kw}
                          className={cn(
                            "transition-colors",
                            isSelected ? "bg-primary/10 dark:bg-primary/15 font-semibold" : "hover:bg-secondary/40"
                          )}
                        >
                          <td className="py-3 px-4 font-bold text-foreground">
                            {kw} kW System
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-extrabold text-xs text-primary bg-primary/10 px-3 py-1 rounded-[8px] border border-primary/20">
                              {bill}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right pr-4">
                            {onSelectKw && (
                              <Button
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="xs"
                                onClick={() => {
                                  onSelectKw(kw)
                                  onOpenChange(false)
                                }}
                                className={cn(
                                  "h-7 px-2.5 text-[10px] font-bold cursor-pointer transition-all",
                                  isSelected ? "bg-primary text-primary-foreground shadow-xs" : ""
                                )}
                              >
                                {isSelected ? "Selected" : "Select"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border bg-card/60 flex items-center justify-between text-xs text-muted-foreground shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> 1-Phase (3.0kW – 8.0kW)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> 3-Phase (10.0kW – 30.0kW)
            </span>
            <span className="text-[11px] font-mono">
              {selectedVersion === 'v3'
                ? `10 Calibrated Tiers (${v3Type === 'ongrid' ? 'Grid-Tied' : 'Hybrid'})`
                : `${SIZING_REFERENCE_V2.length} Standard Commercial Packages`}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 cursor-pointer font-semibold"
          >
            Close Reference
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
