"use client";

import { useCallback, useMemo } from "react";
import { useAreaDemand } from "@/hooks/use-area-demand";
import { useBatches } from "@/hooks/use-batches";
import { useTransfers, useStockFlowSummary } from "@/hooks/use-transfers";
import { coveragePct } from "@/lib/distribution";

export interface TypeBreakdown {
  fertilizerType: string;
  approvedKg: number;
  transferredKg: number;
  outstandingKg: number;
  /** Volume still on the batch records for this type. */
  stockKg: number;
  batchCount: number;
  coveragePct: number;
}

export interface DistrictBreakdown {
  district: string;
  areaCount: number;
  approvedKg: number;
  transferredKg: number;
  outstandingKg: number;
  coveragePct: number;
}

export interface DistributionTotals {
  /**
   * Sum of `fertilizer_batches.volume_kg`. Transfers deliberately don't consume
   * it, so this is minted volume less what farmers have already collected —
   * national stock on record, not lifetime imports.
   */
  registeredStockKg: number;
  batchCount: number;

  /** From the transfer ledger, so it counts every movement ever recorded. */
  transferredKg: number;
  transferCount: number;

  approvedKg: number;
  /** Only the part of `approvedKg` matched to a currently serving officer. */
  demandTransferredKg: number;
  outstandingKg: number;
  coveragePct: number;

  areasWithDemand: number;
  /** Rows nobody can be sent stock for — no officer, or no wallet linked. */
  blockedRows: number;
}

/**
 * The national distribution picture, assembled from the three admin resources
 * that already exist: minted batches, the area demand queue, and the transfer
 * ledger. Every figure below is derived from one of them — nothing on this
 * screen is estimated.
 */
export function useDistributionLevels() {
  const batchesQuery = useBatches();
  const demandQuery = useAreaDemand();
  const transfersQuery = useTransfers();
  const flowQuery = useStockFlowSummary();

  const batches = batchesQuery.data.filter((batch) => batch.tokenType === "STOCK");
  const demand = demandQuery.data;
  const transfers = transfersQuery.data;

  const isLoading = batchesQuery.isLoading || demandQuery.isLoading || transfersQuery.isLoading || flowQuery.isLoading;

  // All three are government-admin scoped, so a 403 on any one of them means
  // the caller can't run this screen at all — surface the first failure.
  const loadError = batchesQuery.error ?? demandQuery.error ?? transfersQuery.error ?? flowQuery.error;

  const refetch = useCallback(async () => {
    await Promise.all([batchesQuery.refetch(), demandQuery.refetch(), transfersQuery.refetch(), flowQuery.refetch()]);
  }, [batchesQuery, demandQuery, transfersQuery, flowQuery]);

  const totals = useMemo<DistributionTotals>(() => {
    const registeredStockKg = batches.reduce((sum, batch) => sum + Number(batch.volumeKg || 0), 0);
    const transferredKg = flowQuery.data?.transferredKg ?? 0;

    const approvedKg = demand.reduce((sum, row) => sum + Number(row.approvedKg || 0), 0);
    const demandTransferredKg = demand.reduce((sum, row) => sum + Number(row.transferredKg || 0), 0);
    const outstandingKg = demand.reduce((sum, row) => sum + Number(row.outstandingKg || 0), 0);

    return {
      registeredStockKg,
      batchCount: batches.length,
      transferredKg,
      transferCount: flowQuery.data?.transferCount ?? 0,
      approvedKg,
      demandTransferredKg,
      outstandingKg,
      coveragePct: coveragePct(demandTransferredKg, approvedKg),
      areasWithDemand: new Set(demand.map((row) => row.areaId)).size,
      blockedRows: demand.filter((row) => !row.officerWallet).length,
    };
  }, [batches, demand, flowQuery.data]);

  /** Demand and remaining stock per fertilizer type, worst-covered first. */
  const byType = useMemo<TypeBreakdown[]>(() => {
    const rows = new Map<string, TypeBreakdown>();

    const rowFor = (fertilizerType: string) => {
      const key = fertilizerType.toUpperCase();
      let row = rows.get(key);
      if (!row) {
        row = {
          fertilizerType,
          approvedKg: 0,
          transferredKg: 0,
          outstandingKg: 0,
          stockKg: 0,
          batchCount: 0,
          coveragePct: 0,
        };
        rows.set(key, row);
      }
      return row;
    };

    demand.forEach((entry) => {
      const row = rowFor(entry.fertilizerType);
      row.approvedKg += Number(entry.approvedKg || 0);
      row.transferredKg += Number(entry.transferredKg || 0);
      row.outstandingKg += Number(entry.outstandingKg || 0);
    });

    // A type can hold stock with no demand raised against it yet, so batches
    // are folded in separately rather than only alongside a demand row.
    batches.forEach((batch) => {
      const row = rowFor(batch.fertilizerType);
      row.stockKg += Number(batch.volumeKg || 0);
      row.batchCount += 1;
    });

    return [...rows.values()]
      .map((row) => ({ ...row, coveragePct: coveragePct(row.transferredKg, row.approvedKg) }))
      .sort((a, b) => b.outstandingKg - a.outstandingKg);
  }, [batches, demand]);

  /** Demand rolled up by district — the closest thing to a regional view. */
  const byDistrict = useMemo<DistrictBreakdown[]>(() => {
    const rows = new Map<string, DistrictBreakdown & { areaIds: Set<number> }>();

    demand.forEach((entry) => {
      const district = entry.district ?? "Unassigned district";
      let row = rows.get(district);

      if (!row) {
        row = {
          district,
          areaCount: 0,
          approvedKg: 0,
          transferredKg: 0,
          outstandingKg: 0,
          coveragePct: 0,
          areaIds: new Set<number>(),
        };
        rows.set(district, row);
      }

      row.areaIds.add(entry.areaId);
      row.approvedKg += Number(entry.approvedKg || 0);
      row.transferredKg += Number(entry.transferredKg || 0);
      row.outstandingKg += Number(entry.outstandingKg || 0);
    });

    return [...rows.values()]
      .map(({ areaIds, ...row }) => ({
        ...row,
        areaCount: areaIds.size,
        coveragePct: coveragePct(row.transferredKg, row.approvedKg),
      }))
      .sort((a, b) => b.outstandingKg - a.outstandingKg);
  }, [demand]);

  /** Area rows, largest shortfall first — the same order as the transfer queue. */
  const areaRows = useMemo(
    () => [...demand].sort((a, b) => b.outstandingKg - a.outstandingKg),
    [demand]
  );

  /** The transfer ledger arrives newest first from the backend. */
  const recentTransfers = useMemo(() => transfers.slice(0, 8), [transfers]);

  return {
    isLoading,
    loadError,
    refetch,
    batches,
    demand,
    transfers,
    totals,
    byType,
    byDistrict,
    areaRows,
    recentTransfers,
  };
}

export default useDistributionLevels;
