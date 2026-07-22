import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Invoice, type LineItem } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const isUS = typeof navigator !== 'undefined' && navigator.language === 'en-US'
  const locale = isUS ? 'en-US' : 'en-GB'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount)
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export function generateDocumentId(prefix: 'MG-QT' | 'MG-INV' = 'MG-INV', date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${prefix}-${yy}${mm}${dd}${hh}${min}${ss}`
}

export function addDays(dateStr: string, days: number): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return ''
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  date.setDate(date.getDate() + days)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getCondensedLineItems(invoice: Invoice): LineItem[] {
  const rateMarkup = invoice.rateMarkup || 0

  const groups: Record<string, { title: string; unit: string; totalAmount: number; totalQty: number; count: number }> = {
    panels: { title: 'Solar Panels', unit: 'PCS', totalAmount: 0, totalQty: 0, count: 0 },
    inverter: { title: 'Inverter', unit: 'PC', totalAmount: 0, totalQty: 0, count: 0 },
    battery: { title: 'Battery', unit: 'PC', totalAmount: 0, totalQty: 0, count: 0 },
    materials: { title: 'Materials', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
    electrical: { title: 'Electrical', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
    services: { title: 'Services', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
    other: { title: 'Other Materials & Services', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
  }

  const validItems = (invoice.lineItems || []).filter((item) => {
    const descLower = (item.description || '').toLowerCase()
    const isBatteryItem =
      descLower.includes('battery') ||
      descLower.includes('dyness') ||
      descLower.includes('genix') ||
      descLower.includes('cesc') ||
      descLower.includes('314ah') ||
      descLower.includes('200ah') ||
      descLower.includes('100ah') ||
      descLower.includes('102.4v')
    return !(invoice.excludeBattery && isBatteryItem)
  })

  for (const item of validItems) {
    const descLower = (item.description || '').toLowerCase().trim()
    const isLabor = descLower === 'labor and installation' || descLower.includes('labor') || descLower.includes('installation')
    const shouldApplyMarkup = !(invoice.excludeLaborMarkup && isLabor)
    const effectiveRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
    const itemAmount = item.quantity * effectiveRate

    let categoryKey = 'other'

    if (
      descLower.includes('panel') ||
      descLower.includes('module') ||
      descLower.includes('ja solar') ||
      descLower.includes('tongwei') ||
      descLower.includes('solar panel')
    ) {
      categoryKey = 'panels'
    } else if (
      descLower.includes('inverter') ||
      descLower.includes('anern') ||
      descLower.includes('solis') ||
      descLower.includes('goodwe') ||
      descLower.includes('hypontech') ||
      descLower.includes('solax') ||
      descLower.includes('foxess') ||
      descLower.includes('sunways')
    ) {
      categoryKey = 'inverter'
    } else if (
      descLower.includes('battery') ||
      descLower.includes('dyness') ||
      descLower.includes('genix') ||
      descLower.includes('cesc') ||
      descLower.includes('314ah') ||
      descLower.includes('200ah') ||
      descLower.includes('100ah') ||
      descLower.includes('102.4v')
    ) {
      categoryKey = 'battery'
    } else if (
      descLower.includes('labor') ||
      descLower.includes('installation') ||
      descLower.includes('services') ||
      descLower.includes('freight') ||
      descLower.includes('delivery') ||
      descLower.includes('engineering') ||
      descLower.includes('commissioning')
    ) {
      categoryKey = 'services'
    } else if (
      descLower.includes('railing') ||
      descLower.includes('clamp') ||
      descLower.includes('l foot') ||
      descLower.includes('l-foot') ||
      descLower.includes('mid clamp') ||
      descLower.includes('end clamp') ||
      descLower.includes('mounting') ||
      descLower.includes('structure') ||
      descLower.includes('hardware')
    ) {
      categoryKey = 'materials'
    } else if (
      descLower.includes('wire') ||
      descLower.includes('cable') ||
      descLower.includes('breaker') ||
      descLower.includes('mcb') ||
      descLower.includes('spd') ||
      descLower.includes('mccb') ||
      descLower.includes('flexcon') ||
      descLower.includes('flexible hose') ||
      descLower.includes('mc4') ||
      descLower.includes('raceway') ||
      descLower.includes('conduit') ||
      descLower.includes('ats') ||
      descLower.includes('switch') ||
      descLower.includes('lug') ||
      descLower.includes('terminal') ||
      descLower.includes('box') ||
      descLower.includes('electrical')
    ) {
      categoryKey = 'electrical'
    }

    const grp = groups[categoryKey]
    grp.totalAmount += itemAmount
    if (categoryKey === 'panels' || categoryKey === 'inverter' || categoryKey === 'battery') {
      grp.totalQty += item.quantity
    }
    grp.count += 1
  }

  const categoryOrder = ['panels', 'inverter', 'battery', 'materials', 'electrical', 'services', 'other']
  const result: LineItem[] = []

  for (const key of categoryOrder) {
    const grp = groups[key]
    if (grp.count > 0 && grp.totalAmount > 0) {
      const qty = (key === 'panels' || key === 'inverter' || key === 'battery') && grp.totalQty > 0 ? grp.totalQty : 1
      const unit = key === 'panels' ? 'PCS' : (key === 'inverter' || key === 'battery') ? 'PC' : 'LOT'
      const rate = grp.totalAmount / qty

      result.push({
        id: `condensed-${key}`,
        description: grp.title,
        quantity: qty,
        rate: rate,
        unit: unit,
      })
    }
  }

  return result
}



