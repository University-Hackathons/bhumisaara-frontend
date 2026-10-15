/**
 * Shared shapes for the government admin's distribution chain — minted batches,
 * their sacks, the area demand queue and the admin → officer transfers.
 *
 * The distribution overview (components/goverment/DistributionLevel.tsx via
 * hooks/use-distribution-levels.ts), the transfer screen
 * (components/goverment/OfficerDistribution.tsx) and the label sheet
 * (components/goverment/SackLabels.tsx) all read the same DTOs off the backend,
 * so the types live here rather than in three copies.
 */

/** `BatchResponseDTO`. `volumeKg` is mint volume less farmer collections — transfers don't touch it. */
export interface Batch {
  batchId: number;
  tokenId: string;
  transactionHash?: string;
  importerName: string;
  fertilizerType: string;
  volumeKg: number;
  originalVolumeKg: number;
  tokenType: "STOCK" | "SUBSIDY_CREDIT";
  mintedByUserId?: number;
  createdAt?: string;
}

export type SackStatus = "AT_CENTRAL" | "WITH_OFFICER" | "DELIVERED";

/** `SackResponseDTO`. */
export interface Sack {
  sackId: number;
  batchId: number;
  /** Resolved from the batch server-side, so a sack list can group itself. */
  fertilizerType?: string | null;
  tokenId?: string | null;
  serial: string;
  weightKg: number;
  status: SackStatus;
  heldByUserId: number | null;
  createdAt?: string;
}

/** `AreaDemandResponseDTO` — one row per (area, fertilizer type) with approved demand. */
export interface AreaDemand {
  areaId: number;
  areaName: string | null;
  district: string | null;
  fertilizerType: string;
  approvedKg: number;
  transferredKg: number;
  outstandingKg: number;
  // Null until an officer is assigned to the area, and the wallet stays null
  // until that officer connects one.
  officerId: number | null;
  officerName: string | null;
  officerWallet: string | null;
}

/** `TransferResponseDTO` — a recorded admin → officer stock movement. */
export interface AdminTransfer {
  transferId: number;
  batchId: number;
  tokenId: string;
  importerName: string | null;
  fertilizerType: string | null;
  fromUserId: number;
  fromUsername: string | null;
  toOfficerId: number;
  toOfficerName: string | null;
  toOfficerWallet: string | null;
  areaName: string | null;
  district: string | null;
  amountKg: number;
  transactionHash: string;
  sackSerials?: string[] | null;
  createdAt: string;
}

/** `PendingCollectionResponseDTO` — an approved request waiting at the officer's centre. */
export interface PendingCollection {
  requestId: number;
  farmerId: number;
  farmerName: string;
  /** Null until the farmer connects a wallet — that row can't be served yet. */
  farmerWallet: string | null;
  fertilizerType: string;
  approvedKg: number;
  collectedKg: number;
  remainingKg: number;
  approvedAt: string | null;
}

/** `SackValidationResponseDTO` — a sack the officer may add to the handover. */
export interface SackValidation {
  sackSerial: string;
  weightKg: number;
  totalScannedKg: number;
  remainingKg: number;
  batchId: number;
  tokenId: string | null;
}

/** `DistributionResponseDTO` — one recorded officer → farmer handover. */
export interface DistributionRecord {
  distributionId: number;
  requestId: number | null;
  tokenId: string;
  batchId: number;
  fertilizerType: string | null;
  farmerId: number;
  farmerName: string | null;
  officerId: number;
  officerName: string | null;
  amountDispensedKg: number;
  burnTransactionHash: string;
  sackSerials: string[];
  requestStatus: string | null;
  disputed: boolean;
  disputedAt: string | null;
  createdAt: string;
}

/** Everything on these screens is weighed in kg; tonnes are only ever a hint. */
export const formatKg = (kg: number) => `${Math.round(kg).toLocaleString()} kg`;

export const formatTonnes = (kg: number) =>
  `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} MT`;

/** Share of approved demand already sent to the officer, capped at 100%. */
export const coveragePct = (transferredKg: number, approvedKg: number) =>
  approvedKg > 0 ? Math.min(100, Math.round((transferredKg / approvedKg) * 100)) : 0;
