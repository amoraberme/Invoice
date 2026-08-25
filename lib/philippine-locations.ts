// Auto-generated Philippine Administrative Divisions and Delivery Fee Directory
// Authoritative dataset from Philippine Standard Geographic Code (PSGC) with distances from Muntinlupa Origin
import rawLgus from './philippine-locations.json'

export interface PhilippineLGU {
  name: string
  type: string
  province: string
  regionCode: string
  regionName: string
  island: string
  isCapital: boolean
  distanceKm: number
  distanceDisplay: string
}

export const PHILIPPINE_LGUS: PhilippineLGU[] = rawLgus as PhilippineLGU[]

export const BASELINE_ORIGIN = {
  name: 'Muntinlupa',
  province: 'Metro Manila (National Capital Region)',
  region: 'NCR',
  baselineKm: 20,
  baselineFee: 5000,
  extraPerKm: 100
}

/**
 * Calculates delivery fee based on distance from Muntinlupa:
 * - 0 to 20 km: ₱5,000 (Baseline)
 * - > 20 km: ₱5,000 + (distance - 20) * ₱100/km
 */
export function calculateDeliveryFee(distanceKm: number): number {
  if (isNaN(distanceKm) || distanceKm <= 0) return 5000
  if (distanceKm <= 20) return 5000
  const extraKm = distanceKm - 20
  return Math.round(5000 + extraKm * 100)
}

/**
 * Fast search helper for Philippine LGUs matching city/municipality, province, or region.
 */
export function searchPhilippineLocations(query: string, limit = 30): PhilippineLGU[] {
  if (!query || !query.trim()) {
    return PHILIPPINE_LGUS.slice(0, limit)
  }

  const q = query.toLowerCase().trim()
  const qTokens = q.split(/\s+/).filter(Boolean)

  const matches = PHILIPPINE_LGUS.filter(item => {
    const target = `${item.name} ${item.province} ${item.regionCode} ${item.regionName} ${item.island}`.toLowerCase()
    return qTokens.every(tok => target.includes(tok))
  })

  // Sort prioritizing exact name matches, then closer distance
  return matches.sort((a, b) => {
    const aNameMatch = a.name.toLowerCase().startsWith(q) ? -1 : 0
    const bNameMatch = b.name.toLowerCase().startsWith(q) ? -1 : 0
    if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch
    return a.distanceKm - b.distanceKm
  }).slice(0, limit)
}
