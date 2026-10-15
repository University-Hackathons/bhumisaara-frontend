"use client";

import { useApiList, useApiPagedList } from "@/hooks/use-api-resource";
import apiPaths from "@/utils/apiPaths";
import type { DistributionRecord } from "@/lib/distribution";

/** Handovers the signed-in officer performed, newest first. */
export function useOfficerDistributions() {
  return useApiPagedList<DistributionRecord>(["distributions", "officer"],
    `${apiPaths.distributions.officer}/page`, "Could not load your distribution history.");
}

/** Handovers the signed-in farmer received, newest first. */
export function useFarmerDistributions() {
  return useApiPagedList<DistributionRecord>(["distributions", "farmer"],
    `${apiPaths.distributions.farmer}/page`, "Could not load your collections.");
}

/** Every handover nationally — the ministry's burn ledger. */
export function useAllDistributions() {
  return useApiList<DistributionRecord>(["distributions", "all"], apiPaths.distributions.all, {
    errorMessage: "Could not load the national burn ledger.",
  });
}

/** Bounded national burn history for the officer handover ledger. */
export function useAllDistributionsPaged() {
  return useApiPagedList<DistributionRecord>(["distributions", "all", "paged"],
    `${apiPaths.distributions.all}/page`, "Could not load the national burn ledger.");
}
