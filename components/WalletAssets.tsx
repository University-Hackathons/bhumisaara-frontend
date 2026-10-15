"use client";

import { useMemo } from "react";
import { useActiveAccount, useReadContract, MediaRenderer } from "thirdweb/react";
import { getOwnedNFTs } from "thirdweb/extensions/erc1155";
import { contract } from "@/lib/contract";
import { client } from "@/lib/thirdwebClient";
import { useMintedBatches } from "@/hooks/use-minted-batches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Wallet } from "lucide-react";

interface WalletAssetsProps {
  /** Shown under the title — who is holding this stock and why. */
  description?: string;
}

/**
 * The fertilizer batches held by the connected wallet, read straight from the
 * ERC-1155 contract.
 *
 * thirdweb's own wallet modal has an NFT tab, but it is powered by thirdweb
 * Insight, and Insight does not index Polygon Amoy — the tab can only ever say
 * "Error loading NFTs" on this chain. An `getOwnedNFTs` call against the
 * contract needs no indexer, so this works where that tab cannot.
 */
export default function WalletAssets({ description }: WalletAssetsProps) {
  const account = useActiveAccount();
  const { batchMap, isNFTsLoading: isStockLoading } = useMintedBatches();

  const { data: nfts, isLoading } = useReadContract(getOwnedNFTs, {
    contract,
    address: account?.address ?? "0x0000000000000000000000000000000000000000",
    queryOptions: { enabled: Boolean(account?.address) },
  });

  const owned = useMemo(
    () =>
      (nfts ?? [])
        .filter((nft) => batchMap.has(nft.id.toString()))
        .map((nft) => ({
          tokenId: nft.id.toString(),
          name: nft.metadata?.name || `Batch TK-${nft.id.toString()}`,
          image: nft.metadata?.image,
          // One token is one kilogram throughout BhumiSaara.
          quantityKg: Number((nft as { quantityOwned?: bigint }).quantityOwned ?? BigInt(0)),
        }))
        .filter((nft) => nft.quantityKg > 0),
    [nfts, batchMap]
  );

  const totalKg = useMemo(
    () => owned.reduce((sum, nft) => sum + nft.quantityKg, 0),
    [owned]
  );

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Coins className="text-primary w-6 h-6" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Wallet Assets</CardTitle>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {owned.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary tabular-nums">
              {totalKg.toLocaleString()}kg on-chain
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!account ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="w-4 h-4" />
            Connect a wallet to see the batches it holds.
          </div>
        ) : isLoading || isStockLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-40 rounded-xl bg-muted animate-pulse" />
            <div className="h-40 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : owned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This wallet holds no fertilizer batch tokens.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {owned.map((nft) => (
              <div
                key={nft.tokenId}
                className="border border-border rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {nft.image ? (
                    // Resolves ipfs:// and data: sources alike.
                    <MediaRenderer client={client} src={nft.image} className="w-full h-full" />
                  ) : (
                    <Coins className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground line-clamp-2">
                    {nft.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">TK-{nft.tokenId}</span>
                  <span className="text-sm font-semibold text-primary tabular-nums">
                    {nft.quantityKg.toLocaleString()}kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
