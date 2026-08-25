const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'reso', 'Philippine_Administrative_Divisions_Directory.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

function parseCSVLine(line) {
  const row = [];
  let inQuotes = false;
  let curr = '';
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
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
  return row;
}

const lgus = [];
const lguMap = new Map(); // key: lguName + '|' + province -> index
const barangays = []; // [brgyName, lguIdx, drivingDistanceKm]

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  if (row.length < 13) continue;

  const regionCode = row[0] || 'NCR';
  const regionName = row[1] || '';
  const island = row[2] || 'Luzon';
  const regionalCenter = row[3] || '';
  const province = row[4] || '';
  const provCapital = row[5] || '';
  const lguType = row[6] || 'Municipality';
  const lguName = row[7] || '';
  const legalClass = row[8] || '';
  const isCapital = (row[9] || '').toLowerCase() === 'yes';
  const brgyName = row[10] || '';
  const psgc = row[11] || '';
  const drivingDistanceKm = parseFloat(row[12]) || 0;

  const lguKey = `${lguName}|||${province}`;
  let lguIdx = lguMap.get(lguKey);

  if (lguIdx === undefined) {
    lguIdx = lgus.length;
    lguMap.set(lguKey, lguIdx);
    lgus.push({
      name: lguName,
      type: lguType,
      province: province,
      regionCode: regionCode,
      regionName: regionName,
      island: island,
      isCapital: isCapital,
      minKm: drivingDistanceKm,
      maxKm: drivingDistanceKm,
      drivingDistanceKm: drivingDistanceKm,
      totalBarangays: 0,
    });
  }

  const lgu = lgus[lguIdx];
  lgu.totalBarangays += 1;
  if (drivingDistanceKm < lgu.minKm) lgu.minKm = drivingDistanceKm;
  if (drivingDistanceKm > lgu.maxKm) lgu.maxKm = drivingDistanceKm;

  // If brgy is a poblacion or capital barangay, set it as representative center
  if (brgyName.toLowerCase().includes('pob') || brgyName.toLowerCase().includes('central') || lgu.totalBarangays === 1) {
    lgu.drivingDistanceKm = drivingDistanceKm;
  }

  barangays.push([brgyName, lguIdx, drivingDistanceKm]);
}

console.log(`Parsed ${lgus.length} LGUs and ${barangays.length} Barangays.`);

const dataset = {
  lgus: lgus.map(l => ({
    name: l.name,
    type: l.type,
    province: l.province,
    regionCode: l.regionCode,
    regionName: l.regionName,
    island: l.island,
    isCapital: l.isCapital,
    drivingDistanceKm: l.drivingDistanceKm,
    totalBarangays: l.totalBarangays
  })),
  barangays
};

const jsonPath = path.join(__dirname, '..', 'lib', 'philippine-locations.json');
fs.writeFileSync(jsonPath, JSON.stringify(dataset), 'utf8');
console.log(`Successfully wrote ${jsonPath} (${(fs.statSync(jsonPath).size / 1024 / 1024).toFixed(2)} MB)`);

const tsContent = `// Auto-generated Philippine Administrative Divisions and Delivery Fee Directory
// Authoritative dataset covering 17 Regions, 82 Provinces, 1,634 Cities/Municipalities, and 42,029 Barangays
// Calibrated with Google Maps Driving Route road distances from Muntinlupa Origin (0.0 km Putatan)
import locationData from './philippine-locations.json'

export interface PhilippineLGU {
  name: string
  type: string
  province: string
  regionCode: string
  regionName: string
  island: string
  isCapital: boolean
  drivingDistanceKm: number
  totalBarangays: number
}

export interface PhilippineLocationItem {
  id: string
  name: string
  displayName: string
  barangayName?: string
  lguName: string
  type: 'Barangay' | 'City' | 'Municipality'
  province: string
  regionCode: string
  regionName: string
  island: string
  drivingDistanceKm: number
  distanceDisplay: string
  formattedAddress: string
}

interface RawData {
  lgus: PhilippineLGU[]
  barangays: [string, number, number][]
}

const data = locationData as RawData
export const PHILIPPINE_LGUS: PhilippineLGU[] = data.lgus
export const PHILIPPINE_BARANGAYS: [string, number, number][] = data.barangays

export const BASELINE_ORIGIN = {
  name: 'Muntinlupa (Putatan)',
  province: 'Metro Manila (National Capital Region)',
  region: 'NCR',
  baselineKm: 20,
  baselineFee: 5000,
  extraPerKm: 100
}

/**
 * Calculates delivery fee based on driving distance from Muntinlupa:
 * - 0 to 20 km: ₱5,000 (Baseline)
 * - > 20 km: ₱5,000 + (driving distance - 20) * ₱100/km
 */
export function calculateDeliveryFee(distanceKm: number): number {
  if (isNaN(distanceKm) || distanceKm <= 0) return 5000
  if (distanceKm <= 20) return 5000
  const extraKm = distanceKm - 20
  return Math.round(5000 + extraKm * 100)
}

/**
 * Formats full address based on region code:
 * - NCR: "Brgy. [Barangay], [City], Metro Manila, NCR" or "[City], Metro Manila, NCR"
 * - Provinces: "Brgy. [Barangay], [LGU], [Province], [Region Code]" or "[LGU], [Province], [Region Code]"
 */
export function formatPhilippineAddress(
  lgu: PhilippineLGU,
  barangayName?: string
): string {
  const isNCR = lgu.regionCode === 'NCR' || lgu.province.toLowerCase().includes('metro manila')

  if (barangayName) {
    const cleanBrgy = barangayName.startsWith('Barangay') || barangayName.startsWith('Brgy.')
      ? barangayName
      : \`Brgy. \${barangayName}\`
    
    if (isNCR) {
      return \`\${cleanBrgy}, \${lgu.name}, Metro Manila, NCR\`
    }
    return \`\${cleanBrgy}, \${lgu.name}, \${lgu.province}, \${lgu.regionCode}\`
  }

  if (isNCR) {
    return \`\${lgu.name}, Metro Manila, NCR\`
  }
  return \`\${lgu.name}, \${lgu.province}, \${lgu.regionCode}\`
}

/**
 * Fast search helper for Philippine Barangays, Cities, Municipalities, and Provinces
 * Matches across 42,029 Barangays and 1,634 LGUs with exact driving distances.
 */
export function searchPhilippineLocations(query: string, limit = 30): PhilippineLocationItem[] {
  if (!query || !query.trim()) {
    // Return key default LGUs / hubs in NCR & nearby provinces
    return PHILIPPINE_LGUS.slice(0, limit).map((lgu, idx) => ({
      id: \`lgu-\${idx}\`,
      name: lgu.name,
      displayName: \`\${lgu.name} (\${lgu.type})\`,
      lguName: lgu.name,
      type: lgu.type as 'City' | 'Municipality',
      province: lgu.province,
      regionCode: lgu.regionCode,
      regionName: lgu.regionName,
      island: lgu.island,
      drivingDistanceKm: lgu.drivingDistanceKm,
      distanceDisplay: \`\${lgu.drivingDistanceKm} km\`,
      formattedAddress: formatPhilippineAddress(lgu)
    }))
  }

  const q = query.toLowerCase().trim()
  const qTokens = q.split(/\\s+/).filter(Boolean)
  const results: PhilippineLocationItem[] = []

  // 1. Search LGUs first
  for (let i = 0; i < PHILIPPINE_LGUS.length; i++) {
    const lgu = PHILIPPINE_LGUS[i]
    const lguTarget = \`\${lgu.name} \${lgu.province} \${lgu.regionCode} \${lgu.regionName}\`.toLowerCase()
    
    if (qTokens.every(tok => lguTarget.includes(tok))) {
      results.push({
        id: \`lgu-\${i}\`,
        name: lgu.name,
        displayName: \`\${lgu.name} (\${lgu.type} Center)\`,
        lguName: lgu.name,
        type: lgu.type as 'City' | 'Municipality',
        province: lgu.province,
        regionCode: lgu.regionCode,
        regionName: lgu.regionName,
        island: lgu.island,
        drivingDistanceKm: lgu.drivingDistanceKm,
        distanceDisplay: \`\${lgu.drivingDistanceKm} km (Driving)\`,
        formattedAddress: formatPhilippineAddress(lgu)
      })
    }
  }

  // 2. Search Barangays (42,029 items)
  for (let j = 0; j < PHILIPPINE_BARANGAYS.length; j++) {
    const [brgyName, lguIdx, drivingKm] = PHILIPPINE_BARANGAYS[j]
    const lgu = PHILIPPINE_LGUS[lguIdx]
    if (!lgu) continue

    const brgyTarget = \`\${brgyName} \${lgu.name} \${lgu.province} \${lgu.regionCode}\`.toLowerCase()

    if (qTokens.every(tok => brgyTarget.includes(tok))) {
      results.push({
        id: \`brgy-\${j}\`,
        name: brgyName,
        displayName: \`Brgy. \${brgyName}, \${lgu.name}\`,
        barangayName: brgyName,
        lguName: lgu.name,
        type: 'Barangay',
        province: lgu.province,
        regionCode: lgu.regionCode,
        regionName: lgu.regionName,
        island: lgu.island,
        drivingDistanceKm: drivingKm,
        distanceDisplay: \`\${drivingKm} km (Driving)\`,
        formattedAddress: formatPhilippineAddress(lgu, brgyName)
      })

      if (results.length >= limit * 3) {
        break
      }
    }
  }

  // Sort prioritizing exact token matches at the start, then shorter driving distance
  return results.sort((a, b) => {
    const aStartsWith = a.name.toLowerCase().startsWith(q) || a.lguName.toLowerCase().startsWith(q) ? -1 : 0
    const bStartsWith = b.name.toLowerCase().startsWith(q) || b.lguName.toLowerCase().startsWith(q) ? -1 : 0
    if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith

    return a.drivingDistanceKm - b.drivingDistanceKm
  }).slice(0, limit)
}
`;

const outPath = path.join(__dirname, '..', 'lib', 'philippine-locations.ts');
fs.writeFileSync(outPath, tsContent, 'utf8');
console.log(`Successfully wrote ${outPath}`);

