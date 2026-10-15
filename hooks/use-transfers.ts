"use client";

import { useApiPagedList, useApiResource } from "@/hooks/use-api-resource";
import apiPaths from "@/utils/apiPaths";
import type { AdminTransfer } from "@/lib/distribution";

/** Admin → officer transfer ledger, newest first. */
export function useTransfers() {
  return useApiPagedList<AdminTransfer>(["transfers"],
    `${apiPaths.transfers.history}/page`, "Could not load the transfer ledger.");
}

export default useTransfers;

export interface StockFlowSummary {
  transferCount: number;
  transferredKg: number;
  burnCount: number;
  burnedKg: number;
  custody: { tokenId: string; officerId: number; officerName: string | null }[];
}

export function useStockFlowSummary() {
  return useApiResource<StockFlowSummary>(["transfers", "summary"],
    `${apiPaths.transfers.history}/summary`, { errorMessage: "Could not load stock movement totals." });
}
