import type { QueryKey } from "@tanstack/react-query";

export function accountQueryKey(userId: string | null | undefined, key: QueryKey): QueryKey {
  return ["account", userId ?? null, ...key];
}
