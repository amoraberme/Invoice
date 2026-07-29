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

export function isLaborItem(description: string): boolean {
  const d = (description || '').toLowerCase().trim()
  return (
    d.includes('labor') ||
    d.includes('installation') ||
    d.includes('commissioning') ||
    d.includes('delivery') ||
    d.includes('freight') ||
    d.includes('service') ||
    d === 'labor and installation'
  )
}

export function isBatteryItem(description: string): boolean {
  const d = (description || '').toLowerCase()
  if (
    d.includes('cable') ||
    d.includes('wire') ||
    d.includes('breaker') ||
    d.includes('rack') ||
    d.includes('mccb') ||
    d.includes('switch')
  ) {
    return false
  }
  return (
    d.includes('battery') ||
    d.includes('dyness') ||
    d.includes('genix') ||
    d.includes('cesc') ||
    d.includes('314ah') ||
    d.includes('200ah') ||
    d.includes('100ah') ||
    d.includes('102.4v') ||
    d.includes('51.2v') ||
    d.includes('lifepo4')
  )
}

export function getItemCategoryRank(description: string): number {
  const d = (description || '').toLowerCase().trim()
  if (!d) return 999

  const isLabor = isLaborItem(description)

  // 1. Solar Panels
  if (
    d.includes('panel') ||
    d.includes('module') ||
    d.includes('ja solar') ||
    d.includes('tongwei') ||
    d.includes('solar panel') ||
    d.includes('pv module')
  ) {
    return 1
  }

  // 2. Inverters
  if (
    d.includes('inverter') ||
    d.includes('anern') ||
    d.includes('solis') ||
    d.includes('goodwe') ||
    d.includes('hypontech') ||
    d.includes('solax') ||
    d.includes('foxess') ||
    d.includes('sunways') ||
    d.includes('deye') ||
    d.includes('growatt') ||
    d.includes('sungrow') ||
    d.includes('victron')
  ) {
    return 2
  }

  // 3. Batteries
  if (isBatteryItem(description)) {
    return 3
  }

  // 4. Mounting Structure & Materials
  if (
    d.includes('railing') ||
    d.includes('rail') ||
    d.includes('clamp') ||
    d.includes('l foot') ||
    d.includes('l-foot') ||
    d.includes('mid clamp') ||
    d.includes('end clamp') ||
    d.includes('mounting') ||
    d.includes('structure') ||
    d.includes('hardware') ||
    d.includes('rack') ||
    d.includes('bracket')
  ) {
    return 4
  }

  // 5. Electrical Protection & Cabling
  if (
    d.includes('wire') ||
    d.includes('cable') ||
    d.includes('breaker') ||
    d.includes('mcb') ||
    d.includes('spd') ||
    d.includes('mccb') ||
    d.includes('flexcon') ||
    d.includes('flexible hose') ||
    d.includes('mc4') ||
    d.includes('raceway') ||
    d.includes('conduit') ||
    d.includes('ats') ||
    d.includes('switch') ||
    d.includes('lug') ||
    d.includes('terminal') ||
    d.includes('box') ||
    d.includes('electrical') ||
    d.includes('combiner')
  ) {
    return 5
  }

  // 6. Labor & Services
  if (isLabor) {
    return 6
  }

  // 7. Other
  return 7
}

export function sortLineItems(items: LineItem[]): LineItem[] {
  if (!items || items.length === 0) return []
  return [...items].sort((a, b) => {
    const rankA = getItemCategoryRank(a.description)
    const rankB = getItemCategoryRank(b.description)
    if (rankA !== rankB) {
      return rankA - rankB
    }
    return 0
  })
}

export function stripBrandName(description: string): string {
  if (!description) return ''
  const d = description.trim()

  const brandRegex = /^(Tongwei|JA\s+Solar|JA|Runergy|Jinko|Gokin|Longi|Ian\s+Solar|Ian|Solis|Anern|GoodWe|Hypontech|Solax|FoxESS|Sunways|Sungrow|Deye|Growatt|Victron|Genix\s+Green|Genix|Dyness|CESC)\s+/i

  return d.replace(brandRegex, '').trim()
}

export function formatItemDescription(description: string, withBrandName: boolean): string {
  const d = (description || '').trim()
  if (!d) return ''

  if (withBrandName) {
    return formatBrandItemDescription(d)
  } else {
    return stripBrandName(d)
  }
}

export function formatBrandItemDescription(description: string): string {
  const d = (description || '').trim()
  if (!d) return ''
  const lower = d.toLowerCase()

  // Panel check
  if (lower.includes('panel') || lower.includes('module')) {
    const hasBrand =
      lower.includes('tongwei') ||
      lower.includes('ja solar') ||
      lower.includes('ja') ||
      lower.includes('runergy') ||
      lower.includes('jinko') ||
      lower.includes('gokin') ||
      lower.includes('longi') ||
      lower.includes('ian')
    if (!hasBrand) {
      if (lower.startsWith('panel')) {
        return `Tongwei ${d}`
      }
      return `Tongwei Panel ${d.replace(/^panel\s*/i, '')}`
    }
  }

  // Inverter check
  if (lower.includes('inverter')) {
    const hasBrand =
      lower.includes('solis') ||
      lower.includes('anern') ||
      lower.includes('goodwe') ||
      lower.includes('hypontech') ||
      lower.includes('solax') ||
      lower.includes('foxess') ||
      lower.includes('sunways') ||
      lower.includes('sungrow') ||
      lower.includes('deye') ||
      lower.includes('growatt') ||
      lower.includes('victron')
    if (!hasBrand) {
      if (lower.startsWith('inverter')) {
        return `Solis ${d}`
      }
      return `Solis Inverter ${d.replace(/^inverter\s*/i, '')}`
    }
  }

  // Battery check
  if (
    lower.includes('battery') &&
    !lower.includes('cable') &&
    !lower.includes('breaker') &&
    !lower.includes('rack') &&
    !lower.includes('mccb') &&
    !lower.includes('switch')
  ) {
    const hasBrand = lower.includes('genix') || lower.includes('dyness') || lower.includes('cesc')
    if (!hasBrand) {
      if (lower.startsWith('battery')) {
        return `Genix ${d}`
      }
      return `Genix Battery ${d.replace(/^battery\s*/i, '')}`
    }
  }

  return d
}

export function getCondensedLineItems(invoice: Invoice): LineItem[] {
  const rateMarkup = invoice.rateMarkup || 0
  const withBrand = invoice.withBrandName !== false

  const groups: Record<
    string,
    { title: string; primaryDescription?: string; unit: string; totalAmount: number; totalQty: number; count: number }
  > = {
    panels: { title: 'Solar Panels', unit: 'PCS', totalAmount: 0, totalQty: 0, count: 0 },
    inverter: { title: 'Inverter', unit: 'PC', totalAmount: 0, totalQty: 0, count: 0 },
    battery: { title: 'Battery', unit: 'PC', totalAmount: 0, totalQty: 0, count: 0 },
    materials: { title: 'Materials', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
    electrical: { title: 'Electrical', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
    services: { title: 'Services', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
    other: { title: 'Other Materials & Services', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
  }

  const validItems = (invoice.lineItems || []).filter((item) => {
    return !(invoice.excludeBattery && isBatteryItem(item.description))
  })

  for (const item of validItems) {
    const formattedDesc = formatItemDescription(item.description, withBrand)
    const descLower = formattedDesc.toLowerCase().trim()
    const isLabor = isLaborItem(formattedDesc)
    const shouldApplyMarkup = !(invoice.excludeLaborMarkup && isLabor)
    const effectiveRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
    const itemAmount = item.quantity * effectiveRate

    let categoryKey = 'other'

    // Priority 1: Services (Labor, Installation, Commissioning, Freight, Delivery, Engineering)
    if (isLabor) {
      categoryKey = 'services'
    }
    // Priority 2: Mounting Rails / Structure / Hardware
    else if (
      descLower.includes('railing') ||
      descLower.includes('rail') ||
      descLower.includes('clamp') ||
      descLower.includes('l foot') ||
      descLower.includes('l-foot') ||
      descLower.includes('mid clamp') ||
      descLower.includes('end clamp') ||
      descLower.includes('mounting') ||
      descLower.includes('structure') ||
      descLower.includes('hardware') ||
      descLower.includes('rack') ||
      descLower.includes('bracket')
    ) {
      categoryKey = 'materials'
    }
    // Priority 3: Electrical Hardware (Wire, Cable, Breaker, Switch, MCB, SPD, MCCB, Flexcon, Conduit, Boxes, Lugs, Terminals, Combiner)
    else if (
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
      descLower.includes('electrical') ||
      descLower.includes('combiner')
    ) {
      categoryKey = 'electrical'
    }
    // Priority 4: Main Equipment - Solar Panels
    else if (
      descLower.includes('panel') ||
      descLower.includes('module') ||
      descLower.includes('ja solar') ||
      descLower.includes('tongwei') ||
      descLower.includes('solar panel') ||
      descLower.includes('pv module')
    ) {
      categoryKey = 'panels'
    }
    // Priority 5: Main Equipment - Inverter
    else if (
      descLower.includes('inverter') ||
      descLower.includes('anern') ||
      descLower.includes('solis') ||
      descLower.includes('goodwe') ||
      descLower.includes('hypontech') ||
      descLower.includes('solax') ||
      descLower.includes('foxess') ||
      descLower.includes('sunways') ||
      descLower.includes('deye') ||
      descLower.includes('growatt') ||
      descLower.includes('sungrow') ||
      descLower.includes('victron')
    ) {
      categoryKey = 'inverter'
    }
    // Priority 6: Main Equipment - Battery
    else if (
      descLower.includes('battery') ||
      descLower.includes('dyness') ||
      descLower.includes('genix') ||
      descLower.includes('cesc') ||
      descLower.includes('314ah') ||
      descLower.includes('200ah') ||
      descLower.includes('100ah') ||
      descLower.includes('102.4v') ||
      descLower.includes('51.2v') ||
      descLower.includes('lifepo4')
    ) {
      categoryKey = 'battery'
    }

    const grp = groups[categoryKey]
    grp.totalAmount += itemAmount
    if (categoryKey === 'panels' || categoryKey === 'inverter' || categoryKey === 'battery') {
      grp.totalQty += item.quantity
      if (!grp.primaryDescription) {
        grp.primaryDescription = formattedDesc
      }
    }
    grp.count += 1
  }

  const categoryOrder = ['panels', 'inverter', 'battery', 'materials', 'electrical', 'services', 'other']
  const result: LineItem[] = []

  for (const key of categoryOrder) {
    const grp = groups[key]
    if (grp.count > 0) {
      const qty = (key === 'panels' || key === 'inverter' || key === 'battery') && grp.totalQty > 0 ? grp.totalQty : 1
      const unit = key === 'panels' ? 'PCS' : (key === 'inverter' || key === 'battery') ? 'PC' : 'LOT'
      const rate = qty > 0 ? grp.totalAmount / qty : 0

      const desc =
        (key === 'panels' || key === 'inverter' || key === 'battery') && grp.primaryDescription
          ? grp.primaryDescription
          : grp.title

      result.push({
        id: `condensed-${key}`,
        description: desc,
        quantity: qty,
        rate: rate,
        unit: unit,
      })
    }
  }

  return result
}

export function calculateSubtotal(invoice: Invoice): number {
  const rateMarkup = invoice.rateMarkup || 0
  const displayItems = invoice.isCondensed ? getCondensedLineItems(invoice) : sortLineItems(invoice.lineItems || [])
  return displayItems.reduce((sum, item) => {
    const isCondensedItem = item.id.startsWith('condensed-')
    if (isCondensedItem) {
      return sum + item.quantity * item.rate
    }
    if (invoice.excludeBattery && isBatteryItem(item.description)) {
      return sum
    }
    const isLabor = isLaborItem(item.description)
    const shouldApplyMarkup = !(invoice.excludeLaborMarkup && isLabor)
    const adjustedRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
    return sum + item.quantity * adjustedRate
  }, 0)
}

export function calculateTotal(invoice: Invoice): number {
  const subtotal = calculateSubtotal(invoice)
  const vat = subtotal * ((invoice.vatRate || 0) / 100)
  return subtotal + vat
}



