"use client";

import { useCallback } from "react";
import { useQuery, useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import axiosInstance from "@/utils/axiosInstance";
import { describeApiError } from "@/utils/apiError";

export interface ApiResource<T> {
  data: T;
  isLoading: boolean;
  /** A message ready to render, or null. The raw error is rarely useful in UI. */
  error: string | null;
  refetch: () => Promise<unknown>;
}

interface Options {
  /** Skip the request until its inputs exist (e.g. no batch selected yet). */
  enabled?: boolean;
  errorMessage?: string;
}

/**
 * One GET endpoint, wrapped in the fetch/loading/error/refetch shape every
 * screen needs.
 *
 * Built on the same `@tanstack/react-query` that `use-minted-batches.ts`
 * already uses — the QueryClient comes from the ThirdwebProvider mounted in the
 * root layout, so consumers share a cache instead of each screen re-fetching on
 * mount. It also replaces the useState/useEffect pattern that tripped
 * `react-hooks/set-state-in-effect` in every component.
 */
export function useApiResource<T>(
  queryKey: QueryKey,
  path: string,
  options: Options = {}
): ApiResource<T | undefined> {
  const { enabled = true, errorMessage = "Could not load this data." } = options;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await axiosInstance.get<T>(path);
      return response.data;
    },
    enabled,
  });

  const refetch = useCallback(() => query.refetch(), [query]);

  return {
    data: query.data,
    // A disabled query is idle, not loading — otherwise a screen waiting on a
    // selection would sit under a skeleton forever.
    isLoading: query.isPending && enabled,
    error: query.error ? describeApiError(query.error, errorMessage) : null,
    refetch,
  };
}

/** List endpoints are far easier to consume when they never hand back undefined. */
export function useApiList<T>(
  queryKey: QueryKey,
  path: string,
  options: Options = {}
): ApiResource<T[]> {
  const resource = useApiResource<T[]>(queryKey, path, options);
  return { ...resource, data: resource.data ?? [] };
}

/** Fetches bounded history pages and exposes an explicit next-page action. */
export function useApiPagedList<T>(queryKey: QueryKey, path: string, errorMessage = "Could not load this history.") {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const separator = path.includes("?") ? "&" : "?";
      const response = await axiosInstance.get<{
        content: T[]; page: number; totalPages: number; totalElements: number;
      }>(`${path}${separator}page=${pageParam}&size=50`);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.page + 1 < lastPage.totalPages
      ? lastPage.page + 1 : undefined,
  });
  return {
    data: query.data?.pages.flatMap((page) => page.content) ?? [],
    totalElements: query.data?.pages[0]?.totalElements ?? 0,
    isLoading: query.isPending,
    error: query.error ? describeApiError(query.error, errorMessage) : null,
    refetch: () => query.refetch(),
    hasMore: query.hasNextPage,
    loadMore: () => query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
  };
}
