'use client'

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Download,
  Search,
  FileSpreadsheet,
  X,
  Copy,
  Check,
  Zap,
  Sun,
  Battery,
  ShieldCheck,
  Wrench,
  Cable,
  Lightbulb,
  Radio
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme?: string
  fileUrl?: string
  fileName?: string
}

interface PriceItem {
  code: string
  name: string
  srp: string
  installer: string
  wholesale: string
  subdealer: string
  notes?: string
}

interface PriceCategory {
  id: string
  title: string
  icon: any
  warranty?: string
  items: PriceItem[]
}

const PRICELIST_DATA: PriceCategory[] = [
  {
    id: 'panels',
    title: 'Solar Panels',
    icon: Sun,
    warranty: 'Standard 15 Years Manufacturer Warranty (Tier 1)',
    items: [
      { code: 'HY-DH132N11', name: 'Runergy Bifacial Solar 620W Tier 1', srp: '₱5,704', installer: '₱5,580', wholesale: '₱5,270', subdealer: '₱4,960' },
      { code: 'TWMNH-66HD620', name: 'TW (Tongwei) Bifacial Solar Panel 620W Tier 1', srp: '—', installer: '₱5,890', wholesale: '₱5,580', subdealer: '₱5,456' },
      { code: 'TWMNH-66HD625', name: 'TW (Tongwei) Bifacial Solar Panel 625W Tier 1', srp: '—', installer: '₱5,937.50', wholesale: '₱5,625', subdealer: '₱5,500' },
      { code: 'TWMNH-66HD630', name: 'TW (Tongwei) Bifacial Solar Panel 630W Tier 1', srp: '₱6,100', installer: '₱5,985', wholesale: '₱5,670', subdealer: '₱5,544' },
      { code: 'TWMHF-66HD720', name: 'TW (Tongwei) Bifacial Solar Panel 720W Tier 1', srp: '₱7,000', installer: '₱6,840', wholesale: '₱6,480', subdealer: '₱6,336' },
      { code: 'TWMNF-66HD725W', name: 'TW (Tongwei) Bifacial Solar Panel 725W Tier 1', srp: '₱7,000', installer: '₱6,887.50', wholesale: '₱6,525', subdealer: '₱6,380' },
      { code: 'TRINA-MONO-615W', name: 'Trina Solar Monocrystalline Panel 615W N-Type', srp: '₱6,100', installer: '₱6,000', wholesale: '₱5,950', subdealer: '₱5,900' },
      { code: 'SOL-004', name: 'Trina Solar Monocrystalline Panel 620W Tier 1', srp: '₱6,300', installer: '₱6,200', wholesale: '₱6,150', subdealer: '₱6,150' },
      { code: 'SOL-005', name: 'Seraphim Monocrystalline Panel 630W Tier 1', srp: '₱5,600', installer: '₱5,500', wholesale: '₱5,500', subdealer: '₱5,500' },
      { code: 'SOL-006', name: 'Lesso Monocrystalline Panel 630W Tier 1', srp: '₱5,600', installer: '₱5,500', wholesale: '₱5,500', subdealer: '₱5,500' },
    ]
  },
  {
    id: 'hybrid',
    title: 'Hybrid Inverters',
    icon: Zap,
    warranty: '5 Yrs Replacement / 10 Yrs when paired with Goodwe Battery',
    items: [
      { code: 'DEYE-1P-6KW', name: 'DEYE 1P 6KW Hybrid Inverter 18/18A', srp: '₱47,000', installer: '₱45,000', wholesale: '₱44,000', subdealer: '₱43,500' },
      { code: 'DEYE-1P-8KW', name: 'DEYE 1P 8KW Hybrid Inverter 28/26A', srp: '₱63,000', installer: '₱60,000', wholesale: '₱59,000', subdealer: '₱58,000' },
      { code: 'DEYE-1P-12KW', name: 'DEYE 1P 12KW Hybrid Inverter', srp: '₱92,000', installer: '₱88,000', wholesale: '₱86,000', subdealer: '₱85,000' },
      { code: 'DEYE-1P-16KW', name: 'DEYE 1P 16KW Hybrid Inverter', srp: '₱140,000', installer: '₱135,000', wholesale: '₱132,000', subdealer: '₱130,000' },
      { code: 'DEYE-3P-12KW-LV', name: 'DEYE 3P 12KW Low Voltage Hybrid Inverter (LV Batt)', srp: '₱100,000', installer: '₱95,000', wholesale: '₱93,000', subdealer: '₱92,000' },
      { code: 'DEYE-3P-20KW-LV', name: 'DEYE 3P 20KW Low Voltage Hybrid Inverter (LV Batt)', srp: '₱155,000', installer: '₱150,000', wholesale: '₱147,000', subdealer: '₱145,000' },
      { code: 'DEYE-3P-30KW-LV', name: 'DEYE 3P 30KW Low Voltage Hybrid Inverter (HV Batt)', srp: '₱260,000', installer: '₱250,000', wholesale: '₱245,000', subdealer: '₱240,000' },
      { code: 'DEYE-3P-50KW-380V', name: 'DEYE 3P 50KW 380V Hybrid Inverter (HV Batt)', srp: '₱290,000', installer: '₱280,000', wholesale: '₱275,000', subdealer: '₱270,000' },
      { code: 'DEYE-3P-80KW-380V', name: 'DEYE 3P 80KW 380V Hybrid Inverter (HV Batt)', srp: '₱310,000', installer: '₱300,000', wholesale: '₱295,000', subdealer: '₱290,000' },
      { code: 'GW3000-ES-20', name: 'Goodwe Hybrid Inverter 3kW (1-Phase LV, No LCD)', srp: '—', installer: '₱38,000', wholesale: '₱35,000', subdealer: '₱35,000' },
      { code: 'GW6000-ES-C10', name: 'Goodwe Hybrid Inverter 6kW ES Uniq w/ LCD (1-Phase LV)', srp: '₱51,000', installer: '₱50,000', wholesale: '₱45,000', subdealer: '₱45,000' },
      { code: 'GW8000-ES-C10', name: 'Goodwe Hybrid Inverter 8kW ES Uniq w/ LCD (1-Phase LV)', srp: '₱73,500', installer: '₱67,000', wholesale: '₱65,000', subdealer: '₱62,000' },
      { code: 'GW10K-ES-C10', name: 'Goodwe Hybrid Inverter 10kW ES Uniq w/ LCD (1-Phase LV)', srp: '₱85,000', installer: '₱82,000', wholesale: '₱78,000', subdealer: '₱74,000' },
      { code: 'GW12K-ES-C10', name: 'Goodwe Hybrid Inverter 12kW ES Uniq w/ LCD (1-Phase LV)', srp: '₱86,000', installer: '₱84,000', wholesale: '₱80,000', subdealer: '₱78,000' },
      { code: 'GW20K-ET-L-G10', name: 'Goodwe Hybrid Inverter 20kW (3-Phase LV)', srp: '₱170,000', installer: '₱160,000', wholesale: '₱155,000', subdealer: '₱150,000' },
      { code: 'GW50K-ET-G10', name: 'Goodwe Hybrid Inverter 50kW (3-Phase LV/HV Upgradable to 100kW)', srp: '₱260,000', installer: '₱250,000', wholesale: '₱240,000', subdealer: '₱235,000' },
      { code: 'GW100K-ET-G10', name: 'Goodwe Hybrid Inverter 100kW (3-Phase HV)', srp: '₱260,000', installer: '₱250,000', wholesale: '₱240,000', subdealer: '₱235,000' },
    ]
  },
  {
    id: 'gridtied',
    title: 'Grid-Tied Inverters',
    icon: Radio,
    warranty: 'Standard 5 Years Replacement Warranty',
    items: [
      { code: 'DEYE-1P-3.6KW-GT', name: 'DEYE 1P 3.6KW Grid-Tied Inverter', srp: '₱18,000', installer: '₱16,000', wholesale: '₱15,500', subdealer: '₱15,000' },
      { code: 'DEYE-1P-6.0KW-GT', name: 'DEYE 1P 6.0KW Grid-Tied Inverter', srp: '₱27,000', installer: '₱25,000', wholesale: '₱24,000', subdealer: '₱23,500' },
      { code: 'DEYE-1P-8.0KW-GT', name: 'DEYE 1P 8.0KW Grid-Tied Inverter', srp: '₱30,000', installer: '₱28,000', wholesale: '₱27,000', subdealer: '₱26,500' },
      { code: 'DEYE-1P-10.0KW-GT', name: 'DEYE 1P 10.0KW Grid-Tied Inverter', srp: '₱37,000', installer: '₱35,000', wholesale: '₱34,000', subdealer: '₱33,500' },
      { code: 'GW1500-XS-30', name: 'Goodwe Grid Tied Inverter 1.5kW (1-Phase LV)', srp: '₱18,000', installer: '₱16,000', wholesale: '₱15,000', subdealer: '₱13,000' },
      { code: 'GW3000-XS-30', name: 'Goodwe Grid Tied Inverter 3kW (1-Phase LV)', srp: '₱20,000', installer: '₱19,000', wholesale: '₱18,000', subdealer: '₱16,000' },
      { code: 'GW6000-DNS-30', name: 'Goodwe Grid Tied Inverter 6kW (1-Phase LV)', srp: '₱28,000', installer: '₱25,000', wholesale: '₱24,000', subdealer: '₱22,000' },
      { code: 'GW10K-MS-G30', name: 'Goodwe Grid Tied Inverter 10kW (1-Phase LV)', srp: '₱42,000', installer: '₱40,000', wholesale: '₱37,000', subdealer: '₱35,000' },
      { code: 'GW10K-MS-G40', name: 'Goodwe Grid Tied Inverter 10kW (1-Phase LV, Parallel up to 10u)', srp: '₱42,000', installer: '₱42,000', wholesale: '₱40,000', subdealer: '₱37,000' },
      { code: 'GW30KLV-SDT', name: 'Goodwe Grid Tied 3-Phase LV 30kW', srp: '₱160,000', installer: '₱155,000', wholesale: '₱150,000', subdealer: '₱140,000' },
      { code: 'GW35KLS-MT', name: 'Goodwe Grid Tied 3-Phase LV 35kW', srp: '₱150,000', installer: '₱175,000', wholesale: '₱160,000', subdealer: '₱150,000' },
      { code: 'GW50KLV-MT', name: 'Goodwe Grid Tied 3-Phase LV 50kW', srp: '₱177,000', installer: '₱180,000', wholesale: '₱170,000', subdealer: '₱165,000' },
      { code: 'GW50KLS-MT', name: 'Goodwe Grid Tied 3-Phase LV 50kW', srp: '₱177,000', installer: '₱160,000', wholesale: '₱145,000', subdealer: '₱140,000' },
      { code: 'GW75K-GT-LV-G10', name: 'Goodwe Grid Tied 3-Phase LV 75kW', srp: '₱260,000', installer: '₱240,000', wholesale: '₱220,000', subdealer: '₱210,000' },
      { code: 'GW100KL-GT', name: 'Goodwe Grid Tied 3-Phase LV 100kW', srp: '₱290,000', installer: '₱280,000', wholesale: '₱250,000', subdealer: '₱240,000' },
      { code: 'GW36K-MT', name: 'Goodwe Grid Tied 3-Phase HV 36kW', srp: '₱130,000', installer: '₱120,000', wholesale: '₱110,000', subdealer: '₱105,000' },
      { code: 'GW50KS-MT', name: 'Goodwe Grid Tied 3-Phase HV 50kW', srp: '₱155,000', installer: '₱150,000', wholesale: '₱135,000', subdealer: '₱125,000' },
      { code: 'GW60KS-MT', name: 'Goodwe Grid Tied 3-Phase HV 60kW', srp: '₱170,000', installer: '₱160,000', wholesale: '₱145,000', subdealer: '₱140,000' },
      { code: 'GW100K-HT', name: 'Goodwe Grid Tied 3-Phase HV 100kW', srp: '₱250,000', installer: '₱240,000', wholesale: '₱220,000', subdealer: '₱210,000' },
    ]
  },
  {
    id: 'bess',
    title: 'Batteries & Storage (BESS)',
    icon: Battery,
    warranty: 'Standard 5 Years Replacement Warranty',
    items: [
      { code: 'DEYE-51.2V-314AH', name: 'DEYE 51.2V 314AH Lithium Battery (16.07kWh)', srp: '₱130,000', installer: '₱125,000', wholesale: '₱122,000', subdealer: '₱120,000' },
      { code: 'SOL-028', name: 'Alpsolar 10.24kWh 200Ah Lithium Battery', srp: '₱72,000', installer: '₱70,000', wholesale: '₱70,000', subdealer: '₱67,000' },
      { code: 'SOL-029', name: 'Alpsolar 16.07kWh 314Ah Lithium Battery', srp: '₱95,000', installer: '₱93,000', wholesale: '₱93,000', subdealer: '₱89,000' },
      { code: 'SOL-030', name: 'Oliter 10.24kWh 200Ah Lithium Battery', srp: '₱72,000', installer: '₱70,000', wholesale: '₱70,000', subdealer: '₱67,000' },
      { code: 'LXA5.0-10', name: 'Goodwe Lynx Lithium Battery 5.12kWh 100Ah (51.2V)', srp: '₱45,000', installer: '₱42,000', wholesale: '₱40,000', subdealer: '₱38,000' },
      { code: 'GE14.3-BAT-LV-G10', name: 'Goodwe Lithium Battery 14.3kWh 280Ah (Wall/Floor)', srp: '₱120,000', installer: '₱110,000', wholesale: '₱107,000', subdealer: '₱105,000' },
      { code: 'GW16.1 BAT-LV-G10', name: 'Goodwe Lithium Battery 16.1kWh 314Ah (51.2V)', srp: '₱140,000', installer: '₱135,000', wholesale: '₱132,000', subdealer: '₱130,000' },
      { code: 'CESC SATURN', name: 'CESC Saturn LV-16 Battery 16kWh 314Ah', srp: '₱95,000', installer: '₱92,000', wholesale: '₱90,000', subdealer: '₱88,000' },
      { code: 'ESBOX34 PLUS', name: 'Genix Green Lithium Battery 51.2V 200Ah (10.24kWh)', srp: '₱72,000', installer: '₱70,000', wholesale: '₱68,000', subdealer: '₱65,000' },
      { code: 'ESBOX34MAX+', name: 'Genix Green Lithium Battery 51.2V 314Ah (16.07kWh)', srp: '₱92,000', installer: '₱90,000', wholesale: '₱88,000', subdealer: '₱85,000' },
      { code: 'HV-TOWER-325100', name: 'Genix Green Lithium Battery 102.4V 100Ah High Voltage', srp: '₱98,000', installer: '₱95,000', wholesale: '₱92,000', subdealer: '₱90,000' },
      { code: 'CESC MERCURY', name: 'CESC Mercury All-in-One BESS 261kWh', srp: '₱2,500,000', installer: '—', wholesale: '₱2,400,000', subdealer: '₱2,400,000' },
      { code: 'GW125/261-ESA', name: 'Goodwe Energy Storage System 832V 314Ah (261.2kWh)', srp: '₱2,600,000', installer: '—', wholesale: '₱2,500,000', subdealer: '₱2,500,000' },
    ]
  },
  {
    id: 'meters',
    title: 'Smart Meters & Data Loggers',
    icon: ShieldCheck,
    items: [
      { code: 'SEC1000', name: 'Smart Energy Controller (On Grid)', srp: '₱30,000', installer: '₱28,000', wholesale: '₱25,000', subdealer: '₱24,000' },
      { code: 'GM110K', name: 'Goodwe Smart Meter (Three Phase Large Scale)', srp: '₱5,500', installer: '₱5,500', wholesale: '₱5,000', subdealer: '₱4,800' },
      { code: 'GM330', name: 'Goodwe Smart Meter (Class 0.5, Export Limit)', srp: '₱5,500', installer: '₱5,500', wholesale: '₱5,000', subdealer: '₱4,800' },
      { code: 'GM1000', name: 'Goodwe Smart Meter (Single Phase Basic)', srp: '₱5,500', installer: '₱5,500', wholesale: '₱5,000', subdealer: '₱4,800' },
      { code: 'GM3000', name: 'Goodwe Smart Meter (Three Phase Monitoring)', srp: '₱5,500', installer: '₱5,500', wholesale: '₱5,000', subdealer: '₱4,800' },
      { code: 'EZ Link 3000', name: 'Goodwe EZLink (Maximum 6 Inverters)', srp: '₱5,000', installer: '₱5,000', wholesale: '₱4,800', subdealer: '₱4,750' },
      { code: 'EzLogger Pro', name: 'Goodwe EZ Logger (Connectivity up to 60 Inverter)', srp: '₱12,000', installer: '₱12,000', wholesale: '₱10,000', subdealer: '₱9,000' },
    ]
  },
  {
    id: 'cables',
    title: 'Wires, Cables & HDPE Conduits',
    icon: Cable,
    items: [
      { code: 'SOL-170', name: 'Cable Tray 2m', srp: '₱560', installer: '₱560', wholesale: '₱560', subdealer: '₱560' },
      { code: 'SOL-124-AC', name: 'AC Wire #6 AWG 14mm²', srp: '₱14,900/150m', installer: '₱99.34/m', wholesale: '₱99.34/m', subdealer: '₱99.34/m' },
      { code: 'SOL-123-AC', name: 'AC Wire AWG #8', srp: '₱9,006/150m', installer: '₱60.04/m', wholesale: '₱60.04/m', subdealer: '₱60.04/m' },
      { code: 'SOL-152', name: 'Ground Wire', srp: '₱5,888/150m', installer: '₱39.25/m', wholesale: '₱39.25/m', subdealer: '₱39.25/m' },
      { code: 'ACC23', name: 'PV Cable 4mm² Single Core (100m Roll, Red/Black)', srp: '₱4,200', installer: '₱4,000', wholesale: '₱3,950', subdealer: '₱3,900' },
      { code: 'ACC21', name: 'PV Cable 6mm² Single Core (Red/Black, Per Meter)', srp: '₱65/m', installer: '₱60/m', wholesale: '₱58/m', subdealer: '₱57/m' },
      { code: 'ACC21-100', name: 'PV Cable 6mm² Single Core (100m Roll)', srp: '₱6,000', installer: '₱5,800', wholesale: '₱5,750', subdealer: '₱5,650' },
      { code: 'ACC24', name: 'PV Cable 6mm² Twin Core (Red/Black, Per Meter)', srp: '₱180/m', installer: '₱170/m', wholesale: '₱165/m', subdealer: '₱160/m' },
      { code: 'ACC24-100', name: 'PV Cable 6mm² Twin Core (100m Roll)', srp: '—', installer: '₱13,500', wholesale: '₱13,000', subdealer: '₱12,500' },
      { code: 'ACC02', name: 'Battery Cable 25mm² Red/Black (Per Meter)', srp: '₱320/m', installer: '₱300/m', wholesale: '₱280/m', subdealer: '₱270/m' },
      { code: 'ACC04', name: 'Battery Cable 35mm² Red/Black (Per Meter)', srp: '₱400/m', installer: '₱380/m', wholesale: '₱375/m', subdealer: '₱370/m' },
      { code: 'ACC06', name: 'Battery Cable (Black & Red) 50mm', srp: '₱700/m', installer: '₱700/m', wholesale: '₱700/m', subdealer: '₱700/m' },
      { code: 'ACC08', name: 'Battery Cable 70mm² Red/Black (Per Meter)', srp: '₱720/m', installer: '₱700/m', wholesale: '₱680/m', subdealer: '₱670/m' },
      { code: 'ACC15', name: 'UV Rated HDPE Hose 1/2" (21.2mm, Per Meter)', srp: '₱37/m', installer: '₱35/m', wholesale: '₱32/m', subdealer: '₱30/m' },
      { code: 'ACC16', name: 'UV Rated HDPE Hose 3/4" (25mm, Per Meter)', srp: '₱47/m', installer: '₱45/m', wholesale: '₱42/m', subdealer: '₱40/m' },
      { code: 'ACC17', name: 'UV Rated HDPE Hose 1" (34.5mm, Per Meter)', srp: '₱47/m', installer: '₱45/m', wholesale: '₱42/m', subdealer: '₱40/m' },
      { code: 'ACC18', name: 'UV Rated HDPE Hose 1-1/2" (42.5mm, Per Meter)', srp: '₱52/m', installer: '₱50/m', wholesale: '₱48/m', subdealer: '₱45/m' },
      { code: 'ACC19', name: 'UV Rated HDPE Connector 1/2"', srp: '₱25', installer: '₱20', wholesale: '₱18', subdealer: '₱16' },
      { code: 'ACC20', name: 'UV Rated HDPE Connector 3/4"', srp: '₱25', installer: '₱20', wholesale: '₱18', subdealer: '₱16' },
      { code: 'ACC21-C', name: 'UV Rated HDPE Connector 1"', srp: '₱35', installer: '₱30', wholesale: '₱28', subdealer: '₱27' },
      { code: 'ACC22', name: 'UV Rated HDPE Connector 1-1/2"', srp: '₱55', installer: '₱50', wholesale: '₱48', subdealer: '₱47' },
    ]
  },
  {
    id: 'breakers',
    title: 'Breakers, SPDs & ATS',
    icon: Wrench,
    items: [
      { code: 'SOL-092-B', name: 'Breaker box / Metal Enclosure 50x60', srp: '₱3,000', installer: '₱3,000', wholesale: '₱3,000', subdealer: '₱3,000' },
      { code: 'SOL-110-25', name: 'Terminal lugs 25mm', srp: '₱40', installer: '₱40', wholesale: '₱40', subdealer: '₱40' },
      { code: 'SOL-110-50', name: 'Terminal lugs 50mm', srp: '₱50', installer: '₱50', wholesale: '₱50', subdealer: '₱50' },
      { code: 'ACC25', name: 'YRO DC Breaker 2P 16A/800V', srp: '₱450', installer: '₱430', wholesale: '₱420', subdealer: '₱400' },
      { code: 'ACC26', name: 'YRO DC Breaker 2P 16A/550V', srp: '₱450', installer: '₱430', wholesale: '₱420', subdealer: '₱400' },
      { code: 'ACC27', name: 'YRO DC Breaker 2P 20A/550V', srp: '₱450', installer: '₱430', wholesale: '₱420', subdealer: '₱400' },
      { code: 'ACC28', name: 'YRO DC Breaker 2P 25A/800V', srp: '₱450', installer: '₱430', wholesale: '₱420', subdealer: '₱400' },
      { code: 'ACC29', name: 'YRO DC Breaker 2P 25A/550V', srp: '₱450', installer: '₱430', wholesale: '₱420', subdealer: '₱400' },
      { code: 'ACC30', name: 'YRO DC Breaker 2P 32A/600V', srp: '₱450', installer: '₱430', wholesale: '₱420', subdealer: '₱400' },
      { code: 'ACC31', name: 'YRO DC Breaker 4P 25A/1000V', srp: '₱450', installer: '₱800', wholesale: '₱780', subdealer: '₱750' },
      { code: 'ACC32', name: 'YRO DC SPD 2P 40KAIC 600V', srp: '₱820', installer: '₱810', wholesale: '₱790', subdealer: '₱780' },
      { code: 'ACC33', name: 'YRO DC SPD 3P 40KAIC 1000V', srp: '₱1,000', installer: '₱980', wholesale: '₱970', subdealer: '₱950' },
      { code: 'ACC34', name: 'YRO DC MCCB 2P 160A/550V', srp: '₱2,650', installer: '₱2,500', wholesale: '₱2,400', subdealer: '₱2,300' },
      { code: 'ACC35', name: 'YRO DC MCCB 2P 200A/550V', srp: '₱2,650', installer: '₱2,500', wholesale: '₱2,400', subdealer: '₱2,300' },
      { code: 'ACC36', name: 'YRO DC MCCB 2P 125A/550V', srp: '₱2,650', installer: '₱2,500', wholesale: '₱2,400', subdealer: '₱2,300' },
      { code: 'ACC37', name: 'YRO DC MCCB 2P 250A/550V', srp: '₱2,650', installer: '₱2,500', wholesale: '₱2,400', subdealer: '₱2,300' },
      { code: 'ACC38', name: 'YRO AC Breaker 2P 32A/400V', srp: '₱250', installer: '₱240', wholesale: '₱220', subdealer: '₱200' },
      { code: 'ACC39', name: 'YRO AC Breaker 2P 63A/400V', srp: '₱600', installer: '₱550', wholesale: '₱520', subdealer: '₱550' },
      { code: 'ACC40', name: 'YRO AC Breaker 2P 63A/230V', srp: '₱300', installer: '₱240', wholesale: '₱220', subdealer: '₱200' },
      { code: 'ACC41', name: 'YRO AC SPD 2P 40KAIC 420V', srp: '₱600', installer: '₱590', wholesale: '₱570', subdealer: '₱560' },
      { code: 'ACC42', name: 'YRO AC SPD 2P 40KAIC 275V', srp: '₱600', installer: '₱590', wholesale: '₱570', subdealer: '₱560' },
      { code: 'ACC43', name: 'YRO ATS 2P 63A/230V', srp: '₱2,000', installer: '₱1,900', wholesale: '₱1,700', subdealer: '₱1,600' },
      { code: 'ACC44', name: 'YRO ATS 2P 63A/220V', srp: '₱2,000', installer: '₱1,900', wholesale: '₱1,700', subdealer: '₱1,600' },
      { code: 'ACC45', name: 'YRO ATS 2P 125A/230V', srp: '₱2,500', installer: '₱2,400', wholesale: '₱2,200', subdealer: '₱2,000' },
      { code: 'ACC46', name: 'YRO ATS 4P 125A/400V', srp: '₱2,600', installer: '₱2,500', wholesale: '₱2,300', subdealer: '₱2,100' },
    ]
  },
  {
    id: 'lights',
    title: 'Solar Flood & Street Lights',
    icon: Lightbulb,
    warranty: '2 Years Manufacturer Warranty',
    items: [
      { code: 'LM-146 (100W)', name: 'Flood Light 100W (Alu 255*208*65mm, Panel 6V-12W, Bat 3.2V-10A)', srp: '₱1,750', installer: '₱1,600', wholesale: '₱1,550', subdealer: '₱1,500' },
      { code: 'LM-146 (200W)', name: 'Flood Light 200W (Alu 300*250*75mm, Panel 6V-18W, Bat 3.2V-15A)', srp: '₱2,200', installer: '₱2,000', wholesale: '₱1,900', subdealer: '₱1,800' },
      { code: 'LM-146 (300W)', name: 'Flood Light 300W (Alu 335*270*80mm, Panel 6V-25W, Bat 3.2V-20A)', srp: '₱2,300', installer: '₱2,200', wholesale: '₱2,100', subdealer: '₱2,000' },
      { code: 'LM-146 (600W)', name: 'Flood Light 600W (Alu 500*363*85mm, Panel 6V-48W, Bat 3.2V-20A)', srp: '₱4,700', installer: '₱4,500', wholesale: '₱4,450', subdealer: '₱4,400' },
      { code: 'LU-102OM (100W)', name: 'Street Light 100W (ABS 439*236*64mm, Panel 6V-8W, Bat 3.2V-6A)', srp: '₱1,300', installer: '₱1,200', wholesale: '₱1,150', subdealer: '₱1,100' },
      { code: 'LU-102OM (200W)', name: 'Street Light 200W (ABS 559*236*64mm, Panel 6V-12W, Bat 3.2V-10A)', srp: '₱1,800', installer: '₱1,700', wholesale: '₱1,650', subdealer: '₱1,600' },
      { code: 'LU-102OM (300W)', name: 'Street Light 300W (ABS 689*236*64mm, Panel 6V-8W, Bat 3.2V-6A)', srp: '₱2,200', installer: '₱2,100', wholesale: '₱2,000', subdealer: '₱1,950' },
      { code: 'LU-102 (250W)', name: 'Street Light 250W (ABS 620*238*50mm, Panel 6V-12W, Bat 3.2V-10A)', srp: '₱1,400', installer: '₱1,300', wholesale: '₱1,250', subdealer: '₱1,200' },
      { code: 'LU-102 (500W)', name: 'Street Light 500W (ABS 820*240*55mm, Panel 6V-18W, Bat 3.2V-15A)', srp: '₱1,700', installer: '₱1,600', wholesale: '₱1,550', subdealer: '₱1,500' },
      { code: 'LU-100S (250W)', name: 'Solar Light 250W (ABS 585*340*70mm, Panel 6V-25W, Bat 3.2V-15A)', srp: '₱2,100', installer: '₱2,000', wholesale: '₱1,900', subdealer: '₱1,800' },
      { code: 'LU-100S (500W)', name: 'Solar Light 500W (ABS 670*340*70mm, Panel 6V-30W, Bat 3.2V-20A)', srp: '₱2,500', installer: '₱2,400', wholesale: '₱2,300', subdealer: '₱2,200' },
    ]
  }
]

export function SheetPreviewModal({
  open,
  onOpenChange,
  theme = 'light',
  fileUrl = '/GEPC-PRICELIST-UPDATED-MG-SOLAR AUG 1.xlsx',
  fileName = 'GEPC-PRICELIST-UPDATED-MG-SOLAR AUG 1.xlsx',
}: SheetPreviewModalProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)

  // Filter categories and items based on search query and tab selection
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return PRICELIST_DATA.filter(cat => {
      if (activeCategory !== 'all' && cat.id !== activeCategory) return false
      if (!q) return true
      return cat.title.toLowerCase().includes(q) || cat.items.some(i => 
        i.code.toLowerCase().includes(q) || 
        i.name.toLowerCase().includes(q) ||
        i.subdealer.toLowerCase().includes(q) ||
        i.installer.toLowerCase().includes(q)
      )
    }).map(cat => ({
      ...cat,
      items: !q ? cat.items : cat.items.filter(i => 
        i.code.toLowerCase().includes(q) || 
        i.name.toLowerCase().includes(q) ||
        i.subdealer.toLowerCase().includes(q) ||
        i.installer.toLowerCase().includes(q)
      )
    })).filter(cat => cat.items.length > 0)
  }, [activeCategory, searchQuery])

  // Copy full structured text to clipboard
  const handleCopyText = () => {
    let fullText = `GEPC OFFICIAL PRICELIST (Updated August 1)\n\n`
    PRICELIST_DATA.forEach(cat => {
      fullText += `=== ${cat.title.toUpperCase()} ===\n`
      if (cat.warranty) fullText += `Note: ${cat.warranty}\n`
      cat.items.forEach(item => {
        fullText += `[${item.code}] ${item.name} | SRP: ${item.srp} | Installer: ${item.installer} | Wholesale: ${item.wholesale} | Subdealer: ${item.subdealer}\n`
      })
      fullText += `\n`
    })
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-5xl w-[95vw] sm:w-[90vw] max-h-[90vh] h-[90vh] flex flex-col p-0 overflow-hidden font-mono rounded-[20px] border-2 shadow-2xl transition-all bg-card text-card-foreground", `theme-${theme}`)}>
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border bg-secondary/40 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-black tracking-tight text-foreground truncate">
                  GEPC Official Pricelist Text Format
                </DialogTitle>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0 hidden sm:inline-block">
                  Aug 1 Updated
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {/* Copy Structured Text Button */}
            <Button
              type="button"
              size="sm"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-lg px-3 py-1.5 transition-all shadow-xs cursor-pointer border border-border"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </Button>

            {/* Download Original Sheet */}
            <a
              href={fileUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs rounded-lg px-2.5 py-1.5 transition-all shadow-xs shrink-0 cursor-pointer select-none"
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span>Download (.xlsx)</span>
            </a>

            <a
              href="/Main QC pricelist.md"
              download="Main QC pricelist.md"
              className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs rounded-lg px-2.5 py-1.5 transition-all shadow-xs shrink-0 cursor-pointer select-none"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Download (.md)</span>
            </a>
          </div>
        </div>

        {/* Search Bar & Category Navigation */}
        <div className="flex flex-col gap-2.5 px-4 sm:px-6 py-3 border-b border-border bg-card shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full py-0.5">
              <button
                onClick={() => setActiveCategory('all')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-extrabold transition-all shrink-0 cursor-pointer select-none border",
                  activeCategory === 'all'
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
                )}
              >
                All Categories ({PRICELIST_DATA.reduce((acc, cat) => acc + cat.items.length, 0)})
              </button>
              {PRICELIST_DATA.map((cat) => {
                const IconComponent = cat.icon
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer select-none border flex items-center gap-1.5",
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
                    )}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                    <span>{cat.title}</span>
                  </button>
                )
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search item, model, price..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border border-border text-foreground text-xs rounded-lg pl-8 pr-8 py-1.5 outline-none focus:border-primary transition-all font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Structured Formatted Text Catalog Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin bg-card">
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs">
              No price items found matching "{searchQuery}"
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const IconComponent = cat.icon
              return (
                <div key={cat.id} className="border-2 border-border rounded-xl p-4 bg-secondary/20 shadow-xs space-y-3">
                  {/* Category Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b-2 border-border/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-black text-foreground tracking-tight">
                        {cat.title}
                      </h3>
                      <span className="text-[10px] font-bold bg-secondary border border-border text-muted-foreground px-2 py-0.5 rounded-full">
                        {cat.items.length} Items
                      </span>
                    </div>
                    {cat.warranty && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        {cat.warranty}
                      </span>
                    )}
                  </div>

                  {/* Desktop & Mobile Responsive Text Table */}
                  <div className="overflow-x-auto rounded-lg border border-border/80 bg-card">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="bg-secondary text-foreground font-black border-b border-border text-[11px] uppercase tracking-wider">
                          <th className="px-3 py-2.5 w-28 shrink-0">Code</th>
                          <th className="px-3 py-2.5">Item Description</th>
                          <th className="px-3 py-2.5 text-right w-24">SRP</th>
                          <th className="px-3 py-2.5 text-right w-24">Installer</th>
                          <th className="px-3 py-2.5 text-right w-24">Wholesale</th>
                          <th className="px-3 py-2.5 text-right w-28 text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10">
                            Subdealer
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {cat.items.map((item, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              "hover:bg-secondary/40 transition-colors",
                              idx % 2 === 0 ? "bg-card" : "bg-secondary/10"
                            )}
                          >
                            <td className="px-3 py-2 font-black text-foreground text-[11px] whitespace-nowrap">
                              {item.code}
                            </td>
                            <td className="px-3 py-2 text-foreground font-medium text-xs">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground font-bold whitespace-nowrap">
                              {item.srp}
                            </td>
                            <td className="px-3 py-2 text-right text-foreground font-bold whitespace-nowrap">
                              {item.installer}
                            </td>
                            <td className="px-3 py-2 text-right text-foreground font-bold whitespace-nowrap">
                              {item.wholesale}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-black whitespace-nowrap bg-emerald-500/5">
                              {item.subdealer}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
