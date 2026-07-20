const assert = require('assert');

// The logic we want to test:
function getInverterDetails(systemKw) {
  const inverterSizes = [4, 5, 6, 8, 10, 12, 16, 30, 50, 60, 75, 125];
  let inverterKw = inverterSizes.find(s => s >= systemKw);
  if (inverterKw === undefined) {
    inverterKw = Math.ceil(systemKw);
  }
  
  let inverterDesc = `Inverter ${inverterKw}kW Hybrid`;
  let inverterPrice = 0;
  if (inverterKw <= 4) {
    inverterDesc = 'Inverter 4kW Hybrid';
    inverterPrice = 14000.00;
  } else if (inverterKw <= 5) {
    inverterDesc = 'Inverter 5kW Hybrid';
    inverterPrice = 41000.00;
  } else if (inverterKw <= 6) {
    inverterDesc = 'Inverter 6kW Hybrid';
    inverterPrice = 44000.00;
  } else if (inverterKw <= 8) {
    inverterDesc = 'Inverter 8kW Hybrid';
    inverterPrice = 60000.00;
  } else if (inverterKw <= 10) {
    inverterDesc = 'Inverter 10kW Hybrid';
    inverterPrice = 68000.00;
  } else if (inverterKw <= 12) {
    inverterDesc = 'Inverter 12kW Hybrid';
    inverterPrice = 82000.00;
  } else if (inverterKw <= 16) {
    inverterDesc = 'Inverter 16kW Hybrid';
    inverterPrice = 113000.00;
  } else if (inverterKw <= 30) {
    inverterDesc = 'Inverter 30kW Hybrid';
    inverterPrice = 259000.00;
  } else if (inverterKw <= 50) {
    inverterDesc = 'Inverter 50kW Hybrid';
    inverterPrice = 310000.00;
  } else if (inverterKw <= 60) {
    inverterDesc = 'Inverter 60kW Hybrid';
    inverterPrice = 500000.00;
  } else if (inverterKw <= 75) {
    inverterDesc = 'Inverter 75kW Hybrid';
    inverterPrice = 580000.00;
  } else {
    inverterDesc = 'Inverter 125kW Hybrid';
    inverterPrice = 580000.00;
  }
  return { desc: inverterDesc, price: inverterPrice };
}

try {
  // 1. Test 4kW Setup (Expected: Inverter 4kW Hybrid at 14000)
  console.log('Running Test 1 (4kW Setup)...');
  const res4 = getInverterDetails(4);
  assert.strictEqual(res4.desc, 'Inverter 4kW Hybrid');
  assert.strictEqual(res4.price, 14000.00);
  console.log('Test 1 Passed.');
} catch (err) {
  console.log('Test 1 Failed as expected under old logic:', err.message);
}

try {
  // 2. Test 5kW Setup (Expected: Inverter 5kW Hybrid at 41000)
  console.log('Running Test 2 (5kW Setup)...');
  const res5 = getInverterDetails(5);
  assert.strictEqual(res5.desc, 'Inverter 5kW Hybrid');
  assert.strictEqual(res5.price, 41000.00);
  console.log('Test 2 Passed.');
} catch (err) {
  console.log('Test 2 Failed:', err.message);
}

try {
  // 3. Test 6kW Setup (Expected: Inverter 6kW Hybrid at 44000)
  console.log('Running Test 3 (6kW Setup)...');
  const res6 = getInverterDetails(6);
  assert.strictEqual(res6.desc, 'Inverter 6kW Hybrid');
  assert.strictEqual(res6.price, 44000.00);
  console.log('Test 3 Passed.');
} catch (err) {
  console.log('Test 3 Failed:', err.message);
}

try {
  // 4. Test 3.8kW Custom Setup (Expected: Inverter 4kW Hybrid at 14000)
  console.log('Running Test 4 (3.8kW Custom Setup)...');
  const res3_8 = getInverterDetails(3.8);
  assert.strictEqual(res3_8.desc, 'Inverter 4kW Hybrid');
  assert.strictEqual(res3_8.price, 14000.00);
  console.log('Test 4 Passed.');
} catch (err) {
  console.log('Test 4 Failed as expected under old logic:', err.message);
}
