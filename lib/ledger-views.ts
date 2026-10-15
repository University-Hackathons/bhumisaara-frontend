/** Keep physical stock and treasury credits separate even on a shared ERC-1155 contract. */
export function selectRegisteredStockNfts<T extends { id: bigint }>(
  nfts: readonly T[],
  batches: readonly { tokenId: string; tokenType: string }[]
): T[] {
  const stockIds = new Set(batches.filter((batch) => batch.tokenType === "STOCK")
    .map((batch) => String(batch.tokenId)));
  return nfts.filter((nft) => stockIds.has(nft.id.toString()));
}

export interface SeasonCreditPosition {
  season: string;
  tokenId: string;
  ledgerBalanceCredits: number;
  availableCredits: number;
}

/** Match the backend's newest season with sufficient uncommitted credits. */
export function selectSeasonForCredits<T extends SeasonCreditPosition>(
  seasons: readonly T[], credits: number
): T | null {
  return seasons.find((season) => season.availableCredits >= credits && season.availableCredits > 0)
    ?? seasons[0] ?? null;
}

/** A wallet token must be compared only with that token's season ledger. */
export function matchingSeasonLedgerBalance(
  season: SeasonCreditPosition | null | undefined
): number {
  return season?.ledgerBalanceCredits ?? 0;
}
