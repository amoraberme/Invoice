const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'reso', 'Philippine_Administrative_Divisions_Directory.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

const data = [];
for (let i = 1; i < lines.length; i++) {
  const row = [];
  let inQuotes = false;
  let curr = '';
  for (let c = 0; c < lines[i].length; c++) {
    const char = lines[i][c];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(curr.trim());
      curr = '';
    } else {
      curr += char;
    }
  }
  row.push(curr.trim());

  if (row.length >= 12) {
    const regionCode = row[0];
    const regionName = row[1];
    const island = row[2];
    const province = row[4];
    const type = row[6];
    const name = row[7];
    const isCapital = row[9] === 'Yes';
    const distanceKm = parseFloat(row[11]) || 0;
    const distanceDisplay = row[12] || `${distanceKm} km`;
    data.push({
      name,
      type,
      province,
      regionCode,
      regionName,
      island,
      isCapital,
      distanceKm,
      distanceDisplay
    });
  }
}

console.log('Parsed items count:', data.length);

const jsonPath = path.join(__dirname, '..', 'lib', 'philippine-locations.json');
fs.writeFileSync(jsonPath, JSON.stringify(data), 'utf8');
console.log('Successfully wrote', jsonPath);

const tsContent = `// Auto-generated Philippine Administrative Divisions and Delivery Fee Directory
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
  const qTokens = q.split(/\\s+/).filter(Boolean)

  const matches = PHILIPPINE_LGUS.filter(item => {
    const target = \`\${item.name} \${item.province} \${item.regionCode} \${item.regionName} \${item.island}\`.toLowerCase()
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
`;

const outPath = path.join(__dirname, '..', 'lib', 'philippine-locations.ts');
fs.writeFileSync(outPath, tsContent, 'utf8');
console.log('Successfully wrote', outPath);
