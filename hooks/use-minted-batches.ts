import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "thirdweb/react";
import { getNFTs } from "thirdweb/extensions/erc1155";
import type { NFT } from "thirdweb";
import { contract } from "@/lib/contract";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { selectRegisteredStockNfts } from "@/lib/ledger-views";

export type MintedNFT = Extract<NFT, { type: "ERC1155" }>;

export interface BackendBatch {
  tokenId: string;
  transactionHash?: string;
  tokenType: "STOCK" | "SUBSIDY_CREDIT";
  originalVolumeKg?: number;
  volumeKg?: number;
  [key: string]: unknown;
}

export interface MintedBatchRecord {
  tokenId: bigint;
  name: string;
  description: string;
  supply: bigint;
  transactionHash?: string;
  originalVolumeKg: number;
  remainingVolumeKg: number;
}

/**
 * Combines on-chain ERC-1155 NFT batches with their off-chain metadata
 * (e.g. transactionHash) persisted in the Spring Boot backend, keyed by tokenId.
 * Backend batches are cached/shared via the QueryClient thirdweb's
 * ThirdwebProvider already puts in context, so every consumer of this hook
 * reads from (and refetches into) the same cache.
 */
export function useMintedBatches() {
  const {
    data: nfts,
    isLoading: isNFTsLoading,
    refetch: refetchNfts,
  } = useReadContract(getNFTs, { contract });

  const {
    data: backendBatches = [],
    isLoading: isBatchesLoading,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: ["minted-batches"],
    queryFn: async () => {
      const response = await axiosInstance.get<BackendBatch[]>(apiPaths.batches.list);
      return response.data || [];
    },
  });

  const batchMap = useMemo(() => {
    const map = new Map<string, BackendBatch>();
    backendBatches.forEach((batch) => {
      if (batch.tokenType === "STOCK" && batch.tokenId != null) {
        map.set(String(batch.tokenId), batch);
      }
    });
    return map;
  }, [backendBatches]);

  const mintedNfts = useMemo<MintedNFT[]>(
    () => selectRegisteredStockNfts(
      (nfts ?? []).filter((nft): nft is MintedNFT => nft.type === "ERC1155"), backendBatches),
    [nfts, backendBatches]
  );

  const records = useMemo<MintedBatchRecord[]>(
    () =>
      mintedNfts.filter((nft) => batchMap.has(nft.id.toString())).map((nft) => ({
        tokenId: nft.id,
        name: nft.metadata?.name || "Unknown Batch",
        description: nft.metadata?.description || "No description",
        supply: nft.supply,
        transactionHash: batchMap.get(nft.id.toString())?.transactionHash,
        originalVolumeKg: Number(batchMap.get(nft.id.toString())?.originalVolumeKg ?? 0),
        remainingVolumeKg: Number(batchMap.get(nft.id.toString())?.volumeKg ?? 0),
      })),
    [mintedNfts, batchMap]
  );

  const refetch = useCallback(async () => {
    await Promise.all([refetchNfts(), refetchBatches()]);
  }, [refetchNfts, refetchBatches]);

  return {
    nfts: mintedNfts,
    isNFTsLoading: isNFTsLoading || isBatchesLoading,
    backendBatches,
    batchMap,
    records,
    refetch,
  };
}
