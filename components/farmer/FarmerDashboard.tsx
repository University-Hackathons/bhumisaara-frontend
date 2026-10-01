"use client";

import { useMemo } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { User, Leaf, ArrowRight, BadgeCheck, AlertTriangle, Wallet } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import apiPaths from "@/utils/apiPaths";
import { formatDate, formatKg } from "@/utils/formatters";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/use-api-resource";
import { useFarmerDistributions } from "@/hooks/use-distributions";
import { useMyFertilizerRequests } from "@/hooks/use-fertilizer-requests";
import { useMyProfile } from "@/hooks/use-my-profile";
import { cn } from "@/lib/utils";
import TxHashBadge from "@/components/goverment/TxHashBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableEmptyState, TableSkeletonRows } from "@/components/ui/table-states";

interface FarmerArea {
  areaId: number | null;
  areaName: string | null;
  district: string | null;
}

interface WalletResponse {
  walletAddress: string | null;
}

export default function FarmerDashboard() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const { data: collections, isLoading: isCollectionsLoading } = useFarmerDistributions();
  const { data: requests, isLoading: isRequestsLoading } = useMyFertilizerRequests();
  const { data: area, isLoading: isAreaLoading } = useApiResource<FarmerArea>(
    ["farmer", "area"],
    apiPaths.farmers.myArea
  );

  // The officer scans this at handover, so it has to be the address the backend
  // holds — not whatever wallet happens to be connected in this browser.
  const { data: wallet, isLoading: isWalletLoading } = useApiResource<WalletResponse>(
    ["users", "me", "wallet"],
    apiPaths.users.myWallet
  );

  const walletAddress = wallet?.walletAddress ?? null;

  /**
   * What this farmer has actually been granted and taken: every request that
   * reached an approval, and how much of it has been handed over.
   */
  const quota = useMemo(() => {
    const approved = requests.filter(
      (request) =>
        request.approvedKg != null &&
        ["APPROVED", "PARTIALLY_COLLECTED", "COLLECTED"].includes(request.status)
    );

    const approvedKg = approved.reduce((sum, request) => sum + Number(request.approvedKg || 0), 0);
    const collectedKg = approved.reduce((sum, request) => sum + Number(request.collectedKg || 0), 0);

    return {
      approvedKg,
      collectedKg,
      remainingKg: Math.max(0, approvedKg - collectedKg),
      collectedPct: approvedKg > 0 ? Math.min(100, Math.round((collectedKg / approvedKg) * 100)) : 0,
    };
  }, [requests]);

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-8xl mx-auto w-full pb-8 space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">Farmer Portal</h1>
          <p className="text-lg text-muted-foreground">
            Welcome back, manage your quotas and access the green market.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Identity Card */}
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-4 mb-6 border-b border-border pb-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  {/* Falls back to the login name until a profile is saved. */}
                  <h2 className="text-xl font-semibold text-foreground">
                    {profile?.fullName || user?.username || "Farmer"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {profile?.contactNumber || "Verified Farmer"}
                  </p>
                </div>
              </div>
              <div className="mb-6 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Area</span>
                  {isAreaLoading ? (
                    <Skeleton className="h-4 w-28" />
                  ) : (
                    <span className="text-sm text-foreground font-bold">
                      {area?.areaName ?? "Not assigned"}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">District</span>
                  {isAreaLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    <span className="text-sm text-foreground font-bold">
                      {area?.district ?? "-"}
                    </span>
                  )}
                </div>
              </div>
              {/* Scanned by the officer to prove the stock is going to the right farmer */}
              <div className="bg-background p-4 rounded-lg flex flex-col items-center justify-center border border-border gap-2">
                <p className="text-sm font-medium text-muted-foreground">Wallet QR Code</p>
                {isWalletLoading ? (
                  <Skeleton className="w-48 h-48 rounded-md" />
                ) : walletAddress ? (
                  <>
                    {/* White quiet zone on purpose — a QR on a dark card
                        will not scan reliably. */}
                    <div className="bg-white p-3 rounded-md">
                      <QRCodeSVG value={walletAddress} size={168} level="M" marginSize={0} />
                    </div>
                    <p className="font-mono text-xs text-muted-foreground break-all text-center px-2">
                      {walletAddress}
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      Show this to your agrarian officer when collecting.
                    </p>
                  </>
                ) : (
                  <div className="w-48 min-h-48 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                    <Wallet className="w-8 h-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      No wallet linked yet. Connect your wallet to generate the QR your officer
                      scans at collection.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
          </div>
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Quota */}
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col items-center justify-center text-center">
              <h3 className="text-xl font-semibold text-foreground mb-6">Remaining Fertilizer Quota</h3>
              <div className="relative w-full max-w-[300px]">
                {/* The arc fills as the farmer collects against their approvals.
                    While the approvals load, the same ring pulses as its own
                    skeleton — keeping the geometry avoids a layout jump. */}
                <svg className="text-primary w-full h-auto" viewBox="0 0 36 36">
                  <path
                    className={isRequestsLoading ? "text-muted animate-pulse" : "text-muted/20"}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  {!isRequestsLoading && (
                    <path
                      className="text-primary"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${quota.collectedPct}, 100`}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isRequestsLoading ? (
                    <>
                      <Skeleton className="h-10 w-28" />
                      <Skeleton className="h-4 w-36 mt-2" />
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-primary tabular-nums">
                        {quota.remainingKg}
                        <span className="text-xl font-semibold">kg</span>
                      </span>
                      <span className="text-sm text-muted-foreground mt-1">
                        {quota.approvedKg > 0
                          ? `left of ${quota.approvedKg}kg approved`
                          : "No approved requests yet"}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {!isRequestsLoading && quota.approvedKg > 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  {quota.collectedKg}kg already collected from your agrarian officer.
                </p>
              )}
            </div>
            
            {/* Green Market Card */}
            <div className="bg-secondary/50 rounded-xl p-6 shadow-sm text-secondary-foreground flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md border border-border">
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-primary" />
                  Want Eco-Friendly Alternatives?
                </h3>
                <p className="text-sm opacity-90">
                  Swap your traditional subsidy tokens for high-quality organic fertilizer options available in our new green market.
                </p>
              </div>
              <Link
                href="/marketplace"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-10 px-4 gap-2 whitespace-nowrap"
                )}
              >
                Open Green Market Exchange
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
          </div>
        </div>
        
        {/* Collections History */}
        <section className="bg-card rounded-xl p-6 shadow-sm border border-border">
          <h3 className="text-xl font-semibold text-foreground mb-6">Past Collections History</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4">Date</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4">Item Collected</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4">Quantity</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4">Burn Tx</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isCollectionsLoading ? (
                  <TableSkeletonRows columns={5} rows={3} />
                ) : collections.length === 0 ? (
                  <TableEmptyState
                    columns={5}
                    icon={BadgeCheck}
                    title="Nothing collected yet"
                    description="Collections appear here once your agrarian officer hands fertilizer over to you."
                  />
                ) : (
                  collections.map((collection) => (
                    <TableRow
                      key={collection.distributionId}
                      className={`border-border transition-colors group ${
                        collection.disputed ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/30"
                      }`}
                    >
                      <TableCell className="py-4">{formatDate(collection.createdAt)}</TableCell>
                      <TableCell className="py-4">{collection.fertilizerType ?? "-"}</TableCell>
                      <TableCell className="py-4">{formatKg(collection.amountDispensedKg)}</TableCell>
                      <TableCell className="py-4">
                        <TxHashBadge transactionHash={collection.burnTransactionHash} groupHover />
                      </TableCell>
                      <TableCell className="py-4">
                        {collection.disputed ? (
                          <Badge variant="destructive">
                            <AlertTriangle />
                            Disputed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <BadgeCheck />
                            Verified on Blockchain
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
        
      </main>
    </div>
  );
}
