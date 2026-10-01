"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatKg } from "@/utils/formatters";
import { useOfficerProfile, useOfficerSacks } from "@/hooks/use-officer-profile";
import { usePendingCollections } from "@/hooks/use-pending-collections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import WalletAssets from "@/components/WalletAssets";
import { ArrowRight, Flame, MapPin, PackageOpen, Users } from "lucide-react";

interface StockLine {
  fertilizerType: string;
  totalKg: number;
  sackCount: number;
}

export default function AgrarianDashboard() {
  const router = useRouter();

  const profileQuery = useOfficerProfile();
  const sacksQuery = useOfficerSacks();
  const pendingQuery = usePendingCollections();

  const profile = profileQuery.data ?? null;
  const sacks = sacksQuery.data;
  const pending = pendingQuery.data;

  const isLoading = profileQuery.isLoading || sacksQuery.isLoading || pendingQuery.isLoading;
  const loadError = profileQuery.error ?? sacksQuery.error ?? pendingQuery.error;

  const loadData = useCallback(async () => {
    await Promise.all([profileQuery.refetch(), sacksQuery.refetch(), pendingQuery.refetch()]);
  }, [profileQuery, sacksQuery, pendingQuery]);

  /** Real stock: the sacks physically in this officer's custody, by type. */
  const stockLines = useMemo<StockLine[]>(() => {
    const lines = new Map<string, StockLine>();

    sacks.forEach((sack) => {
      const fertilizerType = sack.fertilizerType ?? "Unknown type";
      const line = lines.get(fertilizerType) ?? { fertilizerType, totalKg: 0, sackCount: 0 };
      line.totalKg += Number(sack.weightKg || 0);
      line.sackCount += 1;
      lines.set(fertilizerType, line);
    });

    return [...lines.values()].sort((a, b) => b.totalKg - a.totalKg);
  }, [sacks]);

  const totalStockKg = useMemo(
    () => stockLines.reduce((sum, line) => sum + line.totalKg, 0),
    [stockLines]
  );

  const owedKg = useMemo(
    () => pending.reduce((sum, row) => sum + Number(row.remainingKg || 0), 0),
    [pending]
  );

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">

        {/* Header Info */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          {/* Both lines are fixed wording now, so nothing here waits on a
              fetch and the heading never flickers. */}
          <div>
            <h1 className="text-3xl font-bold text-primary">Agrarian Service Center</h1>
            <p className="text-lg text-muted-foreground">
              Manage stock and hand over to verified farmers.
            </p>
          </div>

          {/* The centre this officer actually serves — the only fetched part of
              the header, so it is the only thing standing in as a skeleton, and
              it sits to the right like every other label/value pair in the app.
              The skeleton matches the badge's own box (h-9, rounded-full) so
              the row doesn't resize when the profile lands. */}
          {isLoading ? (
            <Skeleton className="h-9 w-56 max-w-full rounded-full" />
          ) : (
            <Badge variant="secondary" className="w-fit px-4 py-2 text-sm">
              <MapPin className="w-4 h-4" />
              {profile?.areaName
                ? `${profile.areaName}${profile.district ? `, ${profile.district}` : ""}`
                : "No area assigned"}
            </Badge>
          )}
        </div>

        {loadError && (
          <Card className="border-destructive/40 shadow-sm">
            <CardContent className="pt-6 flex flex-col items-start gap-4">
              <p className="text-base text-destructive">{loadError}</p>
              <Button variant="outline" onClick={loadData}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !loadError && profile && !profile.areaId && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            You are not assigned to an area yet, so no farmers appear in your queue. Ask a
            government administrator to assign you.
          </div>
        )}

        {/* Bento Grid Layout for Main Content
            `items-start` keeps each card at its natural height. Stretching them
            to match meant the shorter card had to absorb the difference, and
            that difference is largest while loading — the inventory skeleton is
            taller than the handover panel, so the panel grew ~200px of slack. */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 w-full xl:items-start">

          {/* Handover entry point (Primary Column) */}
          {/* The handover is a three-stage scanning flow with its own screen —
              it outgrew this dashboard cell, so this is the way in. */}
          <section className="xl:col-span-8 flex flex-col">
            <Card className="border-border shadow-sm flex flex-col">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Flame className="text-primary w-6 h-6" />
                    <CardTitle className="text-2xl font-bold text-foreground">Digital Handover</CardTitle>
                  </div>
                  {!isLoading && pending.length > 0 && (
                    <Badge className="px-3 py-1 text-sm">
                      <Users className="w-4 h-4" />
                      {pending.length} waiting
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Farmers awaiting collection</span>
                    {isLoading ? (
                      <Skeleton className="h-10 w-16" />
                    ) : (
                      <span className="text-4xl font-bold text-foreground tabular-nums">
                        {pending.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Still owed to them</span>
                    {isLoading ? (
                      <Skeleton className="h-10 w-28" />
                    ) : (
                      <span className="text-4xl font-bold text-foreground tabular-nums">
                        {formatKg(owedKg)}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-base text-muted-foreground">
                  Pick a farmer from your collection queue, scan the sacks you are handing over,
                  confirm their wallet QR, then burn the matching tokens on-chain.
                </p>
                <Button
                  type="button"
                  onClick={() => router.push("/handover")}
                  className="h-12 px-8 w-fit text-sm font-semibold shadow-md hover:shadow-lg rounded-xl flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Start a Handover
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Secondary Column (Inventory) */}
          <section className="xl:col-span-4 flex flex-col">
            <Card className="border-border shadow-sm flex flex-col">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <PackageOpen className="text-primary w-6 h-6" />
                  <CardTitle className="text-2xl font-bold text-foreground">Local Inventory</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex flex-col gap-6">
                {isLoading ? (
                  // Same wrapper, padding and gaps as a real stock card below,
                  // so only the fetched figures are stood in for and the column
                  // keeps its height. A flat h-36 block was 42px short of the
                  // card it replaced, jolting the layout twice over on load.
                  Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="bg-muted/20 p-6 rounded-lg border border-border flex flex-col gap-3"
                    >
                      <Skeleton className="h-5 w-28" />
                      <div className="flex items-baseline gap-2">
                        <Skeleton className="h-12 w-32" />
                        <span className="text-base text-muted-foreground">kg left</span>
                      </div>
                      {/* The empty track is static chrome — only its fill is data. */}
                      <div className="w-full bg-muted h-2.5 rounded-full mt-2 overflow-hidden" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))
                ) : stockLines.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-2 py-8">
                    <div className="p-3 rounded-full bg-muted text-muted-foreground">
                      <PackageOpen className="w-6 h-6" />
                    </div>
                    <p className="text-base font-medium text-foreground">No sacks in your custody</p>
                    <p className="text-sm text-muted-foreground">
                      Stock appears here once the ministry transfers a batch to your wallet.
                    </p>
                  </div>
                ) : (
                  stockLines.map((line) => (
                    <div
                      key={line.fertilizerType}
                      className="bg-muted/20 p-6 rounded-lg border border-border flex flex-col gap-3"
                    >
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {line.fertilizerType}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold text-primary tabular-nums">
                          {line.totalKg.toLocaleString()}
                        </span>
                        <span className="text-base text-muted-foreground">kg left</span>
                      </div>
                      {/* Share of this officer's own stock, not of a fictional capacity */}
                      <div className="w-full bg-muted h-2.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{
                            width: `${totalStockKg > 0 ? Math.round((line.totalKg / totalStockKg) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {line.sackCount} {line.sackCount === 1 ? "sack" : "sacks"} in your store
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* The on-chain side of the same stock listed under Local Inventory */}
        <WalletAssets description="Batch tokens in your wallet - burned as you hand sacks to farmers." />
      </main>
    </div>
  );
}
