import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRegisteredStockNfts, selectSeasonForCredits, matchingSeasonLedgerBalance } from '../lib/ledger-views.ts';

test('stock views exclude credit tokens and keep full 256-bit token IDs', () => {
  const stockId = 900719925474099312345n;
  const creditId = stockId + 1n;
  const nfts = [{ id: stockId, supply: 40n }, { id: creditId, supply: 100n }];
  const batches = [{ tokenId: stockId.toString(), tokenType: 'STOCK' },
    { tokenId: creditId.toString(), tokenType: 'SUBSIDY_CREDIT' }];
  assert.deepEqual(selectRegisteredStockNfts(nfts, batches), [nfts[0]]);
});

test('credit comparisons use the selected season, not the all-season total', () => {
  const seasons = [
    { season: 'Yala', tokenId: '2', availableCredits: 5, ledgerBalanceCredits: 10 },
    { season: 'Maha', tokenId: '1', availableCredits: 30, ledgerBalanceCredits: 40 },
  ];
  assert.equal(selectSeasonForCredits(seasons, 20)?.tokenId, '1');
  assert.equal(matchingSeasonLedgerBalance(seasons[0]), 10);
  assert.notEqual(matchingSeasonLedgerBalance(seasons[0]), 50);
});
