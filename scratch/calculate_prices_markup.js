const SOLAR_PRICES = {
  Inverter: 34000.00,
  Panel: 4960.00,
  Railing: 470.00,
  MidClamp: 32.00,
  EndClamp: 32.00,
  LFoot: 50.00,
  FlexconHDPE: 215.00,
  ACwire: 190.00,
  PVwire: 170.00,
  DCwire: 200.00,
  MC4: 80.00,
  BreakerBox: 1000.00,
  ACMCB: 350.00,
  ACSPD: 400.00,
  DCSPD: 400.00,
  DCMCB: 300.00,
  DCMCCB: 1500.00,
  Raceway: 1000.00,
  ATS: 1300.00,
  TerminalLugs: 30.00,
  DynessBattery: 109000.00,
  TerminalBlock: 160.00,
  BatteryCable: 600.00
};

function calculateSystemCost(systemKw, isHybrid) {
  const panelQty = Math.round(systemKw * 10 / 12);
  const rows = panelQty <= 6 ? 1 : 2;
  
  let batteryQty = 1;
  if (systemKw < 12) {
    batteryQty = 1;
  } else if (systemKw >= 12 && systemKw < 24) {
    batteryQty = 2;
  } else {
    batteryQty = Math.ceil(systemKw / 12);
  }

  const prices = SOLAR_PRICES;
  const floorNum = 1; // Default floor 1
  const runLength = floorNum * 5;
  const extraQty = floorNum >= 2 ? 3 : 0;

  let total = 0;

  // 1. Inverter
  const inverterSizes = [3, 5, 6, 8, 10, 12, 16, 18, 100];
  let inverterKw = inverterSizes.find(s => s >= systemKw);
  if (inverterKw === undefined) {
    inverterKw = Math.ceil(systemKw);
  }
  
  let inverterPrice = 0;
  if (inverterKw <= 3) {
    inverterPrice = 41000.00;
  } else if (inverterKw <= 5) {
    inverterPrice = 41000.00;
  } else if (inverterKw <= 6) {
    inverterPrice = 44000.00;
  } else if (inverterKw <= 8) {
    inverterPrice = 60000.00;
  } else if (inverterKw <= 10) {
    inverterPrice = 68000.00;
  } else if (inverterKw <= 12) {
    inverterPrice = 82000.00;
  } else if (inverterKw <= 16) {
    inverterPrice = 113000.00;
  } else if (inverterKw <= 18) {
    inverterPrice = 208000.00;
  } else {
    inverterPrice = 580000.00;
  }

  total += inverterPrice;

  // 2. Solar Panels
  total += panelQty * prices.Panel;

  // 20. Battery (only for hybrid)
  if (isHybrid) {
    total += batteryQty * 88000.00;
  }

  // 3. Railings
  const railingQty = 2 * panelQty + extraQty;
  total += railingQty * prices.Railing;

  // 4. Mid Clamps
  const midClampQty = 2 * panelQty + extraQty;
  total += midClampQty * prices.MidClamp;

  // 5. End Clamps
  const endClampQty = 4 * rows + extraQty;
  total += endClampQty * prices.EndClamp;

  // 6. L Foot
  const lFootQty = Math.ceil(1.25 * (2 * panelQty)) + extraQty;
  total += lFootQty * prices.LFoot;

  // 7. Flexcon HDPE Hose
  total += runLength * prices.FlexconHDPE;

  // 8. AC Wire
  total += runLength * prices.ACwire;

  // 9. PV Wire
  total += runLength * prices.PVwire;

  // 9.5 DC Wire
  total += runLength * prices.DCwire;

  // 10. MC4 Connectors
  let mc4Qty = Math.ceil(1.2 * panelQty);
  if (mc4Qty % 2 !== 0) mc4Qty += 1;
  total += mc4Qty * prices.MC4;

  // 11. Breaker Box
  total += 1 * prices.BreakerBox;

  // 12. AC MCB
  total += 2 * prices.ACMCB;

  // 13. AC SPD
  total += 2 * prices.ACSPD;

  // 14. DC SPD
  total += 2 * prices.DCSPD;

  // 15. DC MCB
  total += 2 * prices.DCMCB;

  // 16. DC MCCB (only for battery)
  if (isHybrid) {
    total += 1 * prices.DCMCCB;
  }

  // 17. Raceway
  total += 1 * prices.Raceway;

  // 18. ATS
  total += 1 * prices.ATS;

  // 19. Terminal Lugs
  total += 12 * prices.TerminalLugs;

  // 21. Terminal Block
  total += 5 * prices.TerminalBlock;

  // 22. Battery Cable (only for hybrid)
  if (isHybrid) {
    const cableLength = batteryQty * 2;
    total += cableLength * prices.BatteryCable;
  }

  // 23. Labor and Installation
  let laborRate = 50000;
  if (systemKw >= 16) {
    laborRate = 120000;
  } else if (systemKw >= 8) {
    laborRate = 55000;
  }
  total += laborRate;

  return total;
}

const sizes = [5, 6, 8, 10, 12];
console.log("Size\tBase Hybrid\tMarkup Hybrid\tBase On-Grid\tMarkup On-Grid");
sizes.forEach(s => {
  const hybridBase = calculateSystemCost(s, true);
  const hybridMarkup = hybridBase * 1.25;
  const ongridBase = calculateSystemCost(s, false);
  const ongridMarkup = ongridBase * 1.25;
  console.log(`${s}kW\t₱${hybridBase.toLocaleString(undefined, {minimumFractionDigits: 2})}\t₱${hybridMarkup.toLocaleString(undefined, {minimumFractionDigits: 2})}\t₱${ongridBase.toLocaleString(undefined, {minimumFractionDigits: 2})}\t₱${ongridMarkup.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
});
