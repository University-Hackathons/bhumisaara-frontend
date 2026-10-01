import type { Role } from "@/lib/navigation";

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminUserSummary {
  userId: number;
  username: string;
  email: string;
  role: Role;
  areaName: string | null;
  district: string | null;
  walletAddressTruncated: string | null;
  walletLinked: boolean;
  isBanned: boolean;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  fullName: string | null;
  address: string | null;
  contactNumber: string | null;
  areaId: number | null;
  isAssigned: boolean;
  fertilizerRequestCount: number;
  requestsReviewedCount: number;
  distributionCount: number;
  orderCount: number;
  listingCount: number;
}

export interface AdminArea {
  areaId: number;
  areaName: string;
  district: string;
  isActive: boolean;
}

export interface AreaCoverage extends AdminArea {
  officerId: number | null;
  officerUsername: string | null;
  officerEmail: string | null;
  officerWalletLinked: boolean | null;
  isVacant: boolean;
  farmerCount: number;
  pendingRequestCount: number;
}

export interface AdminWalletStatus {
  userId: number;
  username: string;
  email: string;
  role: Role;
  areaName: string | null;
  walletAddressTruncated: string | null;
  walletLinked: boolean;
  blocking: boolean;
}

export interface SystemHealth {
  userCountsByRole: Record<Role, number>;
  totalUsers: number;
  unlinkedWallets: number;
  unlinkedOfficerWallets: number;
  unlinkedGovernmentAdminWallets: number;
  vacantAreaCount: number;
  vacantAreas: AreaCoverage[];
  staleFertilizerRequests: number;
  staleMarketOrders: number;
  staleAfterDays: number;
  disputedDistributions: number;
  bannedUsers: number;
}

export interface AdminAuditLog {
  logId: number;
  actorUserId: number;
  actorUsername: string | null;
  action: string;
  targetUserId: number | null;
  targetUsername: string | null;
  targetEntity: string | null;
  details: string | null;
  createdAt: string;
}

export interface AdminUserFilters {
  role?: Role;
  areaId?: number;
  isBanned?: boolean;
  search?: string;
  page: number;
  size: number;
}

export interface AdminAuditFilters {
  actorUserId?: number;
  action?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
}

export const ADMIN_AUDIT_ACTIONS = [
  "USER_BANNED",
  "USER_UNBANNED",
  "USER_PASSWORD_RESET",
  "USER_ROLE_CHANGED",
  "USER_AREA_ASSIGNED",
  "USER_AREA_CLEARED",
  "USER_WALLET_CLEARED",
  "AREA_CREATED",
  "AREA_UPDATED",
  "AREA_DEACTIVATED",
  "AREA_REACTIVATED",
] as const;

