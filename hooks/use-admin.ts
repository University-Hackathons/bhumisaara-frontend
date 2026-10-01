"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiList, useApiResource } from "@/hooks/use-api-resource";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import type {
  AdminArea,
  AdminAuditFilters,
  AdminAuditLog,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserSummary,
  AdminWalletStatus,
  AreaCoverage,
  PageResponse,
  SystemHealth,
} from "@/lib/admin";
import type { Role } from "@/lib/navigation";

const withParams = (path: string, params: object) => {
  const search = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export const adminQueryKeys = {
  all: ["admin"] as const,
  users: ["admin", "users"] as const,
  user: (id: number | null) => ["admin", "users", id] as const,
  areas: ["admin", "areas"] as const,
  coverage: ["admin", "areas", "coverage"] as const,
  wallets: ["admin", "wallets"] as const,
  health: ["admin", "health"] as const,
  audit: ["admin", "audit"] as const,
};

export function useAdminUsers(filters: AdminUserFilters) {
  return useApiResource<PageResponse<AdminUserSummary>>(
    [...adminQueryKeys.users, filters],
    withParams(apiPaths.admin.users, filters),
    { errorMessage: "Could not load users." }
  );
}

export function useAdminUser(userId: number | null) {
  return useApiResource<AdminUserDetail>(
    adminQueryKeys.user(userId),
    userId ? apiPaths.admin.user(userId) : apiPaths.admin.users,
    { enabled: userId !== null, errorMessage: "Could not load this user." }
  );
}

export const useAdminAreas = () =>
  useApiList<AdminArea>(adminQueryKeys.areas, apiPaths.admin.areas, {
    errorMessage: "Could not load areas.",
  });

export const useAreaCoverage = () =>
  useApiList<AreaCoverage>(adminQueryKeys.coverage, apiPaths.admin.areaCoverage, {
    errorMessage: "Could not load officer coverage.",
  });

export const useSystemHealth = () =>
  useApiResource<SystemHealth>(adminQueryKeys.health, apiPaths.admin.health, {
    errorMessage: "Could not load platform health.",
  });

export const useAdminWallets = (unlinkedOnly: boolean) =>
  useApiList<AdminWalletStatus>(
    [...adminQueryKeys.wallets, unlinkedOnly],
    withParams(apiPaths.admin.wallets, { unlinkedOnly }),
    { errorMessage: "Could not load wallet status." }
  );

export function useAdminAuditLogs(filters: AdminAuditFilters) {
  return useApiResource<PageResponse<AdminAuditLog>>(
    [...adminQueryKeys.audit, filters],
    withParams(apiPaths.admin.auditLogs, filters),
    { errorMessage: "Could not load audit logs." }
  );
}

type AdminMutation =
  | { type: "ban" | "unban" | "clearWallet"; userId: number }
  | { type: "resetPassword"; userId: number; newPassword: string }
  | { type: "changeRole"; userId: number; role: Role }
  | { type: "assignArea"; userId: number; areaId: number | null }
  | { type: "createArea"; areaName: string; district: string }
  | { type: "updateArea"; areaId: number; areaName: string; district: string }
  | { type: "activateArea" | "deactivateArea"; areaId: number };

export function useAdminMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AdminMutation) => {
      switch (input.type) {
        case "ban": return (await axiosInstance.post(apiPaths.admin.banUser(input.userId))).data;
        case "unban": return (await axiosInstance.post(apiPaths.admin.unbanUser(input.userId))).data;
        case "clearWallet": return (await axiosInstance.delete(apiPaths.admin.clearWallet(input.userId))).data;
        case "resetPassword": return (await axiosInstance.post(apiPaths.admin.resetPassword(input.userId), { newPassword: input.newPassword })).data;
        case "changeRole": return (await axiosInstance.patch(apiPaths.admin.changeRole(input.userId), { role: input.role })).data;
        case "assignArea": return (await axiosInstance.patch(apiPaths.admin.assignArea(input.userId), { areaId: input.areaId })).data;
        case "createArea": return (await axiosInstance.post(apiPaths.admin.areas, { areaName: input.areaName, district: input.district })).data;
        case "updateArea": return (await axiosInstance.patch(apiPaths.admin.area(input.areaId), { areaName: input.areaName, district: input.district })).data;
        case "activateArea": return (await axiosInstance.post(apiPaths.admin.activateArea(input.areaId))).data;
        case "deactivateArea": return (await axiosInstance.post(apiPaths.admin.deactivateArea(input.areaId))).data;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.all });
    },
  });
}
