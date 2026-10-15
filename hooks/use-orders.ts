"use client";

import { useApiPagedList } from "@/hooks/use-api-resource";
import apiPaths from "@/utils/apiPaths";
import type { MarketOrder } from "@/lib/marketplace";

/** The signed-in farmer's own orders, newest first. */
export function useMyOrders() {
  return useApiPagedList<MarketOrder>(["orders", "mine"], `${apiPaths.orders.mine}/page`, "Could not load your orders.");
}

/** Orders placed with the signed-in seller, newest first. */
export function useSellerOrders() {
  return useApiPagedList<MarketOrder>(["orders", "seller"], `${apiPaths.orders.seller}/page`, "Could not load your incoming orders.");
}

/** Every order nationally — the ministry's marketplace ledger. */
export function useAllOrders() {
  return useApiPagedList<MarketOrder>(["orders", "all"], `${apiPaths.orders.all}/page`, "Could not load the marketplace ledger.");
}
