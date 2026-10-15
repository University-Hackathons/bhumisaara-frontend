"use client";

import { useApiPagedList } from "@/hooks/use-api-resource";
import apiPaths from "@/utils/apiPaths";
import type { RedemptionClaim } from "@/lib/marketplace";

/** The signed-in seller's own claims, newest first. */
export function useMyRedemptionClaims() {
  return useApiPagedList<RedemptionClaim>(["redemption-claims", "mine"], `${apiPaths.redemptionClaims.mine}/page`, "Could not load your redemption claims.");
}

/** The government's review queue: awaiting a decision or a settling burn. */
export function usePendingRedemptionClaims() {
  return useApiPagedList<RedemptionClaim>(
    ["redemption-claims", "pending"],
    `${apiPaths.redemptionClaims.pending}/page`,
    "Could not load the claims queue."
  );
}

/** Every claim ever filed, newest first. */
export function useAllRedemptionClaims() {
  return useApiPagedList<RedemptionClaim>(["redemption-claims", "all"], `${apiPaths.redemptionClaims.all}/page`, "Could not load the redemption ledger.");
}
