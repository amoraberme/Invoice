import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Invoice, type LineItem, type ScopeOfWorkItem, type WarrantyItem } from './types'

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

export function extractPanelInfoFromLineItems(lineItems: { description: string; quantity: number }[]): { panelQty: number; panelWattage: number; totalWatts: number } {
  let panelQty = 0
  let panelWattage = 620

  if (!Array.isArray(lineItems)) {
    return { panelQty: 0, panelWattage: 620, totalWatts: 0 }
  }

  for (const item of lineItems) {
    const desc = (item?.description || '').toLowerCase()
    if (desc.includes('panel') || desc.includes('module')) {
      panelQty += item.quantity || 0
      const match = item.description.match(/(\d{3,4})\s*w/i)
      if (match) {
        panelWattage = parseInt(match[1], 10)
      }
    }
  }

  return {
    panelQty,
    panelWattage,
    totalWatts: panelQty * panelWattage
  }
}

export function isLaborItem(description: string): boolean {
  const d = (description || '').toLowerCase().trim()
  if (d.includes('delivery') || d.includes('freight')) {
    return false
  }
  return (
    d.includes('labor') ||
    d.includes('installation') ||
    d.includes('commissioning') ||
    d.includes('service') ||
    d.includes('services') ||
    d.includes('engineering') ||
    d.includes('supervision') ||
    d.includes('testing') ||
    d === 'labor and installation' ||
    d === 'labor & installation'
  )
}

export function isDeliveryItem(description: string): boolean {
  const d = (description || '').toLowerCase().trim()
  return (
    d === 'delivery fees' ||
    d === 'delivery fee' ||
    d.startsWith('delivery fee') ||
    d.includes('delivery fee') ||
    d.includes('delivery charge') ||
    d.includes('lalamove') ||
    d === 'delivery' ||
    d.includes('freight')
  )
}

export function isBatteryUnit(description: string): boolean {
  const d = (description || '').toLowerCase()
  if (
    d.includes('cable') ||
    d.includes('wire') ||
    d.includes('breaker') ||
    d.includes('rack') ||
    d.includes('mccb') ||
    d.includes('switch') ||
    d.includes('enclosure') ||
    d.includes('cabinet')
  ) {
    return false
  }
  return (
    d.includes('battery') ||
    d.includes('dyness') ||
    d.includes('genix') ||
    d.includes('cesc') ||
    d.includes('oliter') ||
    d.includes('alpsolar') ||
    d.includes('314ah') ||
    d.includes('200ah') ||
    d.includes('100ah') ||
    d.includes('102.4v') ||
    d.includes('51.2v') ||
    d.includes('lifepo4')
  )
}

export function isBatteryItem(description: string): boolean {
  const d = (description || '').toLowerCase()
  if (isBatteryUnit(d)) return true
  return (
    d.includes('battery') ||
    d.includes('mccb')
  )
}

export function isAtsItem(description: string): boolean {
  if (!description) return false
  const d = description.toLowerCase()
  return d.includes('automatic transfer') || d.includes('transfer switch') || d.includes('ats')
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
    !isBatteryUnit(description) && (
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
    )
  ) {
    return 2
  }

  // 3. Batteries
  if (isBatteryUnit(description)) {
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
    d.includes('bracket') ||
    d.includes('sealant') ||
    d.includes('pu sealant')
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
    d.includes('combiner') ||
    d.includes('splice') ||
    d.includes('moulding') ||
    d.includes('molding') ||
    d.includes('pvc moulding')
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

export function getPanelDimensions(wattageOrDesc: string): string {
  const numMatch = (wattageOrDesc || '').match(/(\d+)\s*w/i) || (wattageOrDesc || '').match(/(\d+)/)
  const num = numMatch ? parseInt(numMatch[1], 10) : 620
  if (num >= 720) {
    return '7.82ft x 4.28ft'
  }
  return '7.82ft x 3.72ft'
}

export function stripBrandName(description: string): string {
  if (!description) return ''
  let d = description.trim()

  const brandRegex = /\b(Tongwei|JA\s+Solar|Runergy|Jinko|Gokin|Longi|Ian\s+Solar|Seraphim|Trina\s+Solar|Trina|Lesso|Solis|Anern|GoodWe|Hypontech|Solax|FoxESS|Sunways|Sungrow|Deye|Growatt|Victron|Genix\s+Green|Genix|Dyness|CESC|Oliter|Alpsolar|Alp\s+Solar|AlpSolarr)\b\s*/gi

  d = d.replace(brandRegex, '').replace(/\s{2,}/g, ' ').trim()
  return d
}

export function formatPanelDescription(description: string, withBrandName: boolean): string {
  const d = (description || '').trim()
  if (!d) return ''
  const lower = d.toLowerCase()

  // Match wattage
  const wattMatch = d.match(/(\d+)\s*w/i)
  const wattage = wattMatch ? wattMatch[0].toUpperCase() : '620W'
  const dims = getPanelDimensions(wattage)

  // Identify brand if present
  let brand = ''
  if (lower.includes('tongwei')) brand = 'Tongwei'
  else if (lower.includes('ja solar') || lower.includes('ja ')) brand = 'JA Solar'
  else if (lower.includes('runergy')) brand = 'Runergy'
  else if (lower.includes('jinko')) brand = 'Jinko'
  else if (lower.includes('gokin')) brand = 'Gokin'
  else if (lower.includes('longi')) brand = 'Longi'
  else if (lower.includes('seraphim')) brand = 'Seraphim'
  else if (lower.includes('trina')) brand = 'Trina Solar'
  else if (lower.includes('lesso')) brand = 'Lesso'
  else if (withBrandName) brand = 'Tongwei'

  const hasDimensions = lower.includes('ft') || lower.includes('7.82')

  if (withBrandName) {
    if (hasDimensions) {
      if (brand && !lower.includes(brand.toLowerCase())) {
        return `${brand} ${d}`
      }
      return d
    }
    if (brand && !lower.includes(brand.toLowerCase())) {
      return `${brand} Panel ${wattage} (${dims})`
    }
    return `${d} (${dims})`
  } else {
    // Without Brand
    let stripped = stripBrandName(d)
    if (!stripped.toLowerCase().includes('panel') && !stripped.toLowerCase().includes('module')) {
      stripped = `Panel ${stripped}`
    }
    if (hasDimensions) {
      return stripped
    }
    return `${stripped} (${dims})`
  }
}

export function formatItemDescription(description: string, withBrandName: boolean = true): string {
  const d = (description || '').trim()
  if (!d) return ''
  const lower = d.toLowerCase()

  // Panel check
  const isPanel =
    lower.includes('panel') ||
    lower.includes('module') ||
    lower.includes('tongwei') ||
    lower.includes('ja solar') ||
    lower.includes('runergy') ||
    lower.includes('jinko') ||
    lower.includes('gokin') ||
    lower.includes('longi') ||
    lower.includes('seraphim') ||
    lower.includes('trina') ||
    lower.includes('lesso')

  if (isPanel) {
    return formatPanelDescription(d, withBrandName)
  }

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
    const hasBrand = lower.includes('genix') || lower.includes('dyness') || lower.includes('cesc') || lower.includes('oliter') || lower.includes('alpsolar') || lower.includes('deye') || lower.includes('goodwe')
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
    delivery: { title: 'Delivery Fees', unit: 'LOT', totalAmount: 0, totalQty: 1, count: 0 },
  }

  const validItems = (invoice.lineItems || []).filter((item) => {
    return !(invoice.excludeBattery && isBatteryItem(item.description))
  })

  for (const item of validItems) {
    const formattedDesc = formatItemDescription(item.description, withBrand)
    const descLower = (item.description || '').toLowerCase().trim()
    const isDelivery = isDeliveryItem(item.description)
    const isLabor = !isDelivery && isLaborItem(item.description)
    const shouldApplyMarkup = !isDelivery && !(invoice.excludeLaborMarkup && isLabor)
    const effectiveRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
    const itemAmount = item.quantity * effectiveRate

    let categoryKey = 'materials'

    // Priority 0: Standalone Delivery Fees
    if (
      descLower === 'delivery fees' ||
      descLower === 'delivery fee' ||
      descLower.startsWith('delivery fee') ||
      descLower.includes('delivery fee')
    ) {
      categoryKey = 'delivery'
    }
    // Priority 1: Services (Labor, Installation, Commissioning, Freight, Engineering)
    else if (isLabor) {
      categoryKey = 'services'
    }
    // Priority 2: Electrical Hardware (Wire, Cable, Breaker, Switch, MCB, SPD, MCCB, Flexcon, Conduit, Boxes, Lugs, Terminals, Combiner, Splice, Clip lock)
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
      descLower.includes('combiner') ||
      descLower.includes('splice connector') ||
      descLower.includes('splice') ||
      descLower.includes('moulding') ||
      descLower.includes('molding') ||
      descLower.includes('pvc moulding') ||
      descLower.includes('clip lock') ||
      descLower.includes('clip-lock')
    ) {
      categoryKey = 'electrical'
    }
    // Priority 3: Mounting Rails / Structure / Hardware
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
      descLower.includes('bracket') ||
      descLower.includes('sealant') ||
      descLower.includes('pu sealant')
    ) {
      categoryKey = 'materials'
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
    // Priority 5: Main Equipment - Battery
    else if (isBatteryUnit(formattedDesc)) {
      categoryKey = 'battery'
    }
    // Priority 6: Main Equipment - Inverter
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

  const categoryOrder = ['panels', 'inverter', 'battery', 'materials', 'electrical', 'services', 'delivery']
  const result: LineItem[] = []

  for (const key of categoryOrder) {
    const grp = groups[key]
    if (grp.count > 0) {
      const qty = (key === 'panels' || key === 'inverter' || key === 'battery') && grp.totalQty > 0 ? grp.totalQty : 1
      const unit = key === 'panels' ? 'PCS' : (key === 'inverter' || key === 'battery') ? 'PC' : (key === 'services' || key === 'delivery') ? '' : 'LOT'
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
    const isDelivery = isDeliveryItem(item.description)
    const isLabor = !isDelivery && isLaborItem(item.description)
    const shouldApplyMarkup = !isDelivery && !(invoice.excludeLaborMarkup && isLabor)
    const adjustedRate = shouldApplyMarkup ? item.rate * (1 + rateMarkup / 100) : item.rate
    return sum + item.quantity * adjustedRate
  }, 0)
}

export function calculateTotal(invoice: Invoice): number {
  const subtotal = calculateSubtotal(invoice)
  const discount = invoice.discountAmount || 0
  const netSubtotal = Math.max(0, subtotal - discount)
  const vat = netSubtotal * ((invoice.vatRate || 0) / 100)
  return netSubtotal + vat
}

export function calculateBaseLaborTotal(invoice: Invoice): number {
  const validItems = (invoice.lineItems || []).filter((item) => {
    return !(invoice.excludeBattery && isBatteryItem(item.description))
  })
  return validItems
    .filter((item) => isLaborItem(item.description))
    .reduce((sum, item) => sum + item.quantity * item.rate, 0)
}

export function calculateCommissionableBase(invoice: Invoice): number {
  const clientGrandTotal = calculateTotal(invoice)
  const baseLaborTotal = calculateBaseLaborTotal(invoice)
  return Math.max(0, clientGrandTotal - baseLaborTotal)
}

export function calculateSalesCommission(invoice: Invoice): number {
  const commissionableBase = calculateCommissionableBase(invoice)
  return commissionableBase * 0.025
}

export function generateDefaultScopesFromInvoice(invoice: Partial<Invoice>): ScopeOfWorkItem[] {
  const items = invoice.lineItems || []
  const withBrand = invoice.withBrandName !== false

  const cleanDescWithoutQty = (text: string) => {
    if (!text) return ''
    const formatted = formatItemDescription(text, withBrand)
    return formatted.replace(/^(\d+[\s*xX\-\.]+|\(\d+\)\s*)/, '').trim()
  }

  // A. Solar Panels
  const panelItem = items.find(it => {
    const d = (it.description || '').toLowerCase()
    return d.includes('panel') || d.includes('module') || d.includes('ja solar') || d.includes('tongwei') || d.includes('pv module')
  })
  const panelQty = panelItem?.quantity || extractPanelInfoFromLineItems(items).panelQty || 0
  const panelWattMatch = (panelItem?.description || '').match(/(\d+)\s*w/i) || (panelItem?.description || '').match(/(\d+)/)
  const panelWatts = panelWattMatch ? `${panelWattMatch[1]}W` : '620W'
  const panelDimensions = getPanelDimensions(panelItem?.description || '')
  let panelBrand = withBrand ? (panelItem?.description?.split(' ')?.[0] || 'Tier-1') : 'Tier-1'
  if (panelItem?.description?.toLowerCase().includes('ja solar')) panelBrand = withBrand ? 'JA Solar' : 'Tier-1'
  else if (panelItem?.description?.toLowerCase().includes('tongwei')) panelBrand = withBrand ? 'Tongwei' : 'Tier-1'

  const rawPanelDesc = panelItem ? cleanDescWithoutQty(panelItem.description) : `${panelBrand} ${panelWatts} N-Type TOPCon Monocrystalline PV Modules`
  const panelSubtitle = panelQty > 0
    ? (panelDimensions && !rawPanelDesc.includes(panelDimensions) ? `${panelQty}x ${rawPanelDesc} (${panelDimensions})` : `${panelQty}x ${rawPanelDesc}`)
    : (panelDimensions && !rawPanelDesc.includes(panelDimensions) ? `${rawPanelDesc} (${panelDimensions})` : rawPanelDesc)

  // B. Solar Inverter
  const inverterItem = items.find(it => {
    if (isBatteryUnit(it.description)) return false
    const d = (it.description || '').toLowerCase()
    return d.includes('inverter') || d.includes('anern') || d.includes('solis') || d.includes('goodwe') || d.includes('hypontech') || d.includes('solax') || d.includes('foxess') || d.includes('sunways') || d.includes('deye') || d.includes('growatt') || d.includes('sungrow') || d.includes('victron')
  })
  const inverterSubtitle = inverterItem
    ? cleanDescWithoutQty(inverterItem.description)
    : 'High-Efficiency Smart Solar Inverter'

  // C. Battery
  const batteryItem = items.find(it => isBatteryItem(it.description) || isBatteryUnit(it.description))
  const hasBattery = !invoice.excludeBattery && !!batteryItem
  const batterySubtitle = hasBattery && batteryItem
    ? cleanDescWithoutQty(batteryItem.description)
    : 'N/A - Grid-Tied System'

  // D. Materials
  const materialItems = items.filter(it => {
    const d = (it.description || '').toLowerCase()
    return d.includes('rail') || d.includes('clamp') || d.includes('l foot') || d.includes('l-foot') || d.includes('mounting') || d.includes('hardware') || d.includes('sealant') || d.includes('bracket')
  })
  const materialsList = materialItems.length > 0
    ? materialItems.map(it => cleanDescWithoutQty(it.description)).filter(Boolean).join(', ')
    : 'Anodized Aluminum Mounting Rails, Mid & End Clamps, Stainless L-Feet / Tile Brackets, Heavy-Duty Grounding Lugs, PU Weatherproof Sealants, and SUS304 Stainless Hardware'

  // E. Electrical
  const electricalItems = items.filter(it => {
    const d = (it.description || '').toLowerCase()
    return d.includes('wire') || d.includes('cable') || d.includes('breaker') || d.includes('mcb') || d.includes('spd') || d.includes('mccb') || d.includes('flexcon') || d.includes('conduit') || d.includes('ats') || d.includes('switch') || d.includes('box') || d.includes('combiner')
  })
  const electricalList = electricalItems.length > 0
    ? electricalItems.map(it => cleanDescWithoutQty(it.description)).filter(Boolean).join(', ')
    : 'DC & AC Miniature Circuit Breakers (MCB), Molded Case Circuit Breaker (MCCB), Type II Surge Protective Devices (SPD), DC Solar PV Cables (4mm²/6mm²), THHN/THWN AC Wiring, Flexible Corrugated Conduits, Heavy-Duty ATS Switch, and Weatherproof IP65 Distribution Enclosures'

  return [
    {
      id: 'scope-a',
      letter: 'A',
      title: 'Solar Panels',
      subtitle: panelSubtitle,
      description: 'Tier-1 N-Type TOPCon High-Efficiency Monocrystalline PV Modules • High PID resistance & superior low-light performance',
      enabled: true
    },
    {
      id: 'scope-b',
      letter: 'B',
      title: 'Solar Inverter',
      subtitle: inverterSubtitle,
      description: 'Dual MPPT tracking, IP65 casing, smart cloud Wi-Fi monitoring, integrated DC disconnect & surge protection',
      enabled: true
    },
    {
      id: 'scope-c',
      letter: 'C',
      title: 'Energy Storage / Battery',
      subtitle: batterySubtitle,
      description: hasBattery ? 'High-safety LiFePO4 deep-cycle storage system with Smart BMS & multi-tier cell protection' : 'N/A - Grid-Tied System',
      enabled: true
    },
    {
      id: 'scope-d',
      letter: 'D',
      title: 'Mounting & Structural Materials',
      subtitle: '',
      description: materialsList,
      enabled: true
    },
    {
      id: 'scope-e',
      letter: 'E',
      title: 'Balance of System & Electrical Protection',
      subtitle: '',
      description: electricalList,
      enabled: true
    },
    {
      id: 'scope-f',
      letter: 'F',
      title: 'Professional Engineering & Installation Services',
      subtitle: '',
      description: 'Complete engineering design, mobilization, structural mounting, electrical cabling, commissioning, logistics & handover orientation.',
      enabled: true
    }
  ]
}

export function generateDefaultWarrantiesFromInvoice(invoice: Partial<Invoice>): WarrantyItem[] {
  const items = invoice.lineItems || []

  // Check inverter item
  const inverterItem = items.find(it => {
    if (isBatteryUnit(it.description)) return false
    const d = (it.description || '').toLowerCase()
    return d.includes('inverter') || d.includes('solis') || d.includes('goodwe') || d.includes('deye') || d.includes('growatt') || d.includes('anern') || d.includes('hypontech') || d.includes('solax') || d.includes('foxess') || d.includes('sunways') || d.includes('sungrow') || d.includes('victron')
  })
  const inverterDesc = (inverterItem?.description || '').toLowerCase()
  const isGoodweInverter = inverterDesc.includes('goodwe')
  const isDeyeInverter = inverterDesc.includes('deye')
  const isSolisInverter = inverterDesc.includes('solis')
  const isAnernInverter = inverterDesc.includes('anern')

  // Check battery item
  const batteryItem = items.find(it => isBatteryItem(it.description) || isBatteryUnit(it.description))
  const hasBattery = !invoice.excludeBattery && !!batteryItem
  const batteryDesc = (batteryItem?.description || '').toLowerCase()
  const isGoodweBattery = hasBattery && batteryDesc.includes('goodwe')
  const isDeyeBattery = hasBattery && batteryDesc.includes('deye')
  const isCescBattery = hasBattery && batteryDesc.includes('cesc')
  const isGenixBattery = hasBattery && batteryDesc.includes('genix')
  const isDynessBattery = hasBattery && (batteryDesc.includes('dyness') || batteryDesc.includes('dynes'))

  // Calculate Inverter Warranty:
  // - GoodWe: 5 Years alone, 10 Years when paired with GoodWe Battery
  // - Deye: 10 Years
  // - Solis: 5 Years
  // - Anern: 5 Years
  let inverterCoverage = '5 Years'
  if (isDeyeInverter) {
    inverterCoverage = '10 Years'
  } else if (isGoodweInverter) {
    inverterCoverage = isGoodweBattery ? '10 Years' : '5 Years'
  } else if (isSolisInverter || isAnernInverter) {
    inverterCoverage = '5 Years'
  } else {
    inverterCoverage = '5 Years'
  }

  // Calculate Battery Warranty:
  // - Deye: 10 Years
  // - Cesc: 10 Years
  // - Goodwe: 5 Years
  // - Genix: 5 Years
  // - Dyness: 5 Years
  let batteryCoverage = '5 Years'
  if (isDeyeBattery || isCescBattery) {
    batteryCoverage = '10 Years'
  } else if (isGoodweBattery || isGenixBattery || isDynessBattery) {
    batteryCoverage = '5 Years'
  } else {
    batteryCoverage = '5 Years'
  }

  return [
    { id: 'w-1', component: 'Solar Panels', warrantyType: 'Manufacturer Warranty', coverage: '15 Years' },
    { id: 'w-2', component: 'Inverter', warrantyType: 'Manufacturer Warranty', coverage: inverterCoverage },
    { id: 'w-3', component: 'Battery Storage', warrantyType: 'Manufacturer Warranty', coverage: batteryCoverage },
    { id: 'w-4', component: 'Full System', warrantyType: 'Workmanship & Installation Services', coverage: '1 Year' },
  ]
}




