import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRevenue, solveTjm, annualBudget, MICRO_RATES } from './calculator-core.mjs';

test('micro expenses reduce available income without reducing contributions', () => {
  const r = calculateRevenue({ tjm: 450, days: 18, expenses: 500 });
  assert.ok(Math.abs(r.charges - 2073.6) < 1e-8);
  assert.ok(Math.abs(r.netBeforeIncomeTax - 5526.4) < 1e-8);
  const loss = calculateRevenue({ tjm: 100, days: 1, expenses: 500 });
  assert.equal(loss.netBeforeIncomeTax, -425.6);
  assert.equal(calculateRevenue({ tjm: 0, days: 0, expenses: 500 }).netBeforeIncomeTax, -500);
});

test('inverse model finances target and expenses for every supported regime', () => {
  for (const status of ['micro', 'ei', 'eurl', 'sasu', 'portage']) {
    for (const microType of Object.keys(MICRO_RATES)) {
      const params = { target: 3500, days: 18, expenses: 500, status, microType };
      const tjm = solveTjm(params);
      const r = calculateRevenue({ ...params, tjm });
      assert.ok(Math.abs(r.netBeforeIncomeTax - params.target) < 1e-8, `${status} ${microType}`);
    }
  }
});

test('zero capacity is impossible rather than a zero price', () => {
  assert.equal(solveTjm({ target: 3500, days: 0, expenses: 500 }), null);
  assert.equal(annualBudget({ monthlyTarget: 3000, monthlyExpenses: 500, billableDays: 0 }).tjm, null);
});

test('annual budget funds twelve months, expenses and an additional reserve', () => {
  const r = annualBudget({ monthlyTarget: 3000, monthlyExpenses: 500, billableDays: 180, reserveMonths: 1 });
  assert.equal(r.tjm, 336.03);
  assert.equal(r.annualExpenses, 6000);
  assert.equal(r.reserve, 3000);
  assert.ok(r.available >= 36000);
  assert.ok(r.available - 36000 < 180 * 0.01);
  const prudent = annualBudget({ monthlyTarget: 3000, monthlyExpenses: 500, billableDays: 150, reserveMonths: 1 });
  assert.equal(prudent.tjm, 403.23);
  assert.ok(prudent.tjm > r.tjm);
});

test('ACRE only changes micro contributions, not professional expenses', () => {
  const r = calculateRevenue({ tjm: 500, days: 10, expenses: 500, acre: true });
  assert.equal(r.rate, 0.192);
  assert.equal(r.netBeforeIncomeTax, 3540);
  assert.equal(calculateRevenue({ tjm: 500, days: 10, status: 'eurl', acre: true }).rate, 0.42);
});
