import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInventoryStatement,
  classifyInventoryAccount,
  calculatePhysicalInventoryTotals,
  hasAtypicalInventoryBalance,
  isPatrimonialAccount,
} from '../src/lib/accounting/inventoryStatement.js';

const account = (numero, nature, balanceNette, extra = {}) => ({ numero, nature, balanceNette, ...extra });

test('classes 6 and 7 are excluded from the patrimonial book', () => {
  assert.equal(isPatrimonialAccount(account('601', 'CHARGE', 50)), false);
  assert.equal(isPatrimonialAccount(account('701', 'PRODUIT', -50)), false);
  assert.equal(isPatrimonialAccount(account('571', 'TRESORERIE', 50)), true);
});

test('account classification is determined by account code, not by the current balance sign', () => {
  assert.equal(classifyInventoryAccount(account('4454', 'ACTIF', 200000)).category, 'DETTES_COURT_TERME');
  assert.equal(classifyInventoryAccount(account('242', 'ACTIF', -30000)).category, 'ACTIF_IMMO');
  assert.equal(classifyInventoryAccount(account('3611', 'ACTIF', -200000)).category, 'STOCKS');
  assert.equal(hasAtypicalInventoryBalance(account('242', 'ACTIF', -30000), -30000), true);
  assert.equal(hasAtypicalInventoryBalance(account('101', 'PASSIF', -880000), -880000), false);
});

test('preserves account balances signs and keeps assets, liabilities and equity separate', () => {
  const rows = [
    account('101', 'PASSIF', -880000),
    account('10221', 'PASSIF', 30000),
    account('242', 'ACTIF', -30000),
    account('3611', 'ACTIF', -200000),
    account('4454', 'ACTIF', 200000),
    account('571', 'TRESORERIE', 910000),
  ];
  rows.forEach((row) => Object.assign(row, classifyInventoryAccount(row)));
  const totals = calculateInventoryStatement(rows, 0);
  assert.equal(totals.actifBrut, 910000);
  assert.equal(totals.actifNet, 680000);
  assert.equal(totals.capitauxPropres, 850000);
  assert.equal(totals.dettesTotal, -200000);
  assert.equal(totals.passifTotal, 650000);
  assert.equal(totals.ecartComptable, 30000);
  // Reproduction du calcul antérieur observé dans le relevé joint : les quatre
  // comptes 242/3611/4454/571 étaient additionnés en valeur absolue.
  const legacyAssets = [30000, 200000, 200000, 910000].reduce((sum, value) => sum + Math.abs(value), 0);
  const legacyEquityAndDebts = Math.abs(-880000) + Math.abs(30000);
  assert.equal(legacyAssets - legacyEquityAndDebts, 430000);
});

test('uses current result once and uses the opening balance of account 12 as brought-forward equity', () => {
  const rows = [
    { ...account('101', 'PASSIF', -1000), ...classifyInventoryAccount(account('101', 'PASSIF', -1000)) },
    { ...account('12', 'PASSIF', -400), openingSigned: -300, ...classifyInventoryAccount(account('12', 'PASSIF', -400)) },
    { ...account('571', 'TRESORERIE', 1800), ...classifyInventoryAccount(account('571', 'TRESORERIE', 1800)) },
  ];
  const totals = calculateInventoryStatement(rows, 500);
  assert.equal(totals.capitauxPropres, 1800);
  assert.equal(totals.passifTotal, 1800);
  assert.equal(totals.actifNet, 1800);
  assert.equal(totals.ecartComptable, 0);
});

test('does not roll account parent balances into child balances a second time', () => {
  const rows = [
    { ...account('221', 'ACTIF', 100), ...classifyInventoryAccount(account('221', 'ACTIF', 100)) },
    { ...account('2211', 'ACTIF', 200), ...classifyInventoryAccount(account('2211', 'ACTIF', 200)) },
  ];
  assert.equal(calculateInventoryStatement(rows).actifNet, 300);
});

test('physical inventory stays undetermined until an explicit count is recorded', () => {
  const empty = calculatePhysicalInventoryTotals([]);
  assert.equal(empty.recensementEffectue, false);
  assert.equal(empty.lignesRecensees, 0);
  assert.equal(empty.ecartValeur, 0);
  const pending = calculatePhysicalInventoryTotals([{ recensement_effectue: false, ecart_valeur: 500 }]);
  assert.equal(pending.recensementEffectue, false);
  assert.equal(pending.ecartValeur, 0);
  const counted = calculatePhysicalInventoryTotals([{ recensement_effectue: true, ecart_valeur: 500 }]);
  assert.equal(counted.recensementEffectue, true);
  assert.equal(counted.ecartValeur, 500);
});
