"use client";

import { useApiList, useApiResource } from "@/hooks/use-api-resource";
import apiPaths from "@/utils/apiPaths";
import type { ProductListing } from "@/lib/marketplace";

export interface ListingFilters {
  fertilizerType?: string;
  isOrganic?: boolean;
  isSubsidyEligible?: boolean;
  sellerId?: number;
  page?: number;
}

/** Builds the querystring the backend's filters expect, omitting empty ones. */
const withFilters = (filters: ListingFilters) => {
  const params = new URLSearchParams();

  if (filters.fertilizerType) params.set("fertilizerType", filters.fertilizerType);
  if (filters.isOrganic !== undefined) params.set("isOrganic", String(filters.isOrganic));
  if (filters.isSubsidyEligible !== undefined) {
    params.set("isSubsidyEligible", String(filters.isSubsidyEligible));
  }
  if (filters.sellerId !== undefined) params.set("sellerId", String(filters.sellerId));
  params.set("page", String(filters.page ?? 0));
  params.set("size", "24");

  const query = params.toString();
  return `${apiPaths.listings.browse}/page?${query}`;
};

/** The marketplace: every ACTIVE listing, optionally filtered. */
export function useMarketplaceListings(filters: ListingFilters = {}) {
  const resource = useApiResource<{ content: ProductListing[]; totalPages: number; totalElements: number }>(
    ["listings", "browse", filters], withFilters(filters),
    { errorMessage: "Could not load the marketplace." }
  );
  return { ...resource, data: resource.data?.content ?? [],
    totalPages: resource.data?.totalPages ?? 0,
    totalElements: resource.data?.totalElements ?? 0 };

}

/** The signed-in seller's own listings, whatever their status. */
export function useMyListings() {
  return useApiList<ProductListing>(["listings", "mine"], apiPaths.listings.mine, {
    errorMessage: "Could not load your listings.",
  });
}
