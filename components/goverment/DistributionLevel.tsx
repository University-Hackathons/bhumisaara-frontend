"use client";

import { useRouter } from "next/navigation";
import { useDistributionLevels } from "@/hooks/use-distribution-levels";
import { coveragePct } from "@/lib/distribution";
import { formatKg, formatTonnes } from "@/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { TableEmptyState, TableSkeletonRows } from "@/components/ui/table-states";
import TxHashBadge from "./TxHashBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowRight,
  MapPin,
  PackageOpen,
  RefreshCw,
  Send,
  Truck,
} from "lucide-react";

/** Shared bar for the coverage figures — one visual language for "how much got there". */
function CoverageBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${pct >= 100 ? "bg-primary" : "bg-primary/60"}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

export default function DistributionLevel() {
  const router = useRouter();
  const {
    isLoading,
    loadError,
    refetch,
    totals,
    byType,
    byDistrict,
    areaRows,
    recentTransfers,
  } = useDistributionLevels();

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-8xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Distribution Levels</h1>
            <p className="text-lg text-muted-foreground">
              National overview of registered stock, area demand and officer transfers.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refetch}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loadError ? (
          <Card className="border-destructive/40 shadow-sm">
            <CardContent className="pt-6 flex flex-col items-start gap-4">
              <p className="text-base text-destructive">{loadError}</p>
              <Button variant="outline" onClick={refetch}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Global summary */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border shadow-sm bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-primary/20 rounded-lg text-primary">
                      <PackageOpen className="w-8 h-8" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mt-4 mb-1">
                    National Stock on Record
                  </p>
                  <h3 className="text-5xl font-bold text-foreground tabular-nums">
                    {isLoading ? (
                      <Skeleton className="h-12 w-48" />
                    ) : (
                      <>
                        {totals.registeredStockKg.toLocaleString()}
                        <span className="text-2xl font-normal text-muted-foreground"> kg</span>
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2">
                    {isLoading
                      ? "Loading batches..."
                      : `${formatTonnes(totals.registeredStockKg)} across ${totals.batchCount} minted ${
                          totals.batchCount === 1 ? "batch" : "batches"
                        } · minted volume less farmer collections`}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="p-2 bg-secondary rounded-lg text-secondary-foreground w-10 mb-4 flex justify-center">
                      <Truck className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Transferred to Officers
                    </p>
                    <h3 className="text-2xl font-bold text-foreground tabular-nums">
                      {isLoading ? <Skeleton className="h-7 w-28" /> : formatKg(totals.transferredKg)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      {isLoading
                        ? ""
                        : `${totals.transferCount} ${
                            totals.transferCount === 1 ? "transfer" : "transfers"
                          } recorded on-chain`}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="p-2 bg-accent rounded-lg text-accent-foreground w-10 mb-4 flex justify-center">
                      <Send className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Outstanding Demand
                    </p>
                    <h3 className="text-2xl font-bold text-foreground tabular-nums">
                      {isLoading ? <Skeleton className="h-7 w-28" /> : formatKg(totals.outstandingKg)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      {isLoading
                        ? ""
                        : `${totals.coveragePct}% of ${formatKg(totals.approvedKg)} approved already delivered`}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Rows nobody can be sent stock for */}
            {!isLoading && totals.blockedRows > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
                <span className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {totals.blockedRows} {totals.blockedRows === 1 ? "area needs" : "areas need"} an
                  officer with a linked wallet before stock can be sent.
                </span>
                <Button
                  variant="outline"
                  onClick={() => router.push("/officer-assign")}
                  className="cursor-pointer shrink-0"
                >
                  Assign Officers <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Per fertilizer type */}
            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Stock &amp; Demand by Type</h3>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Skeleton className="h-52 rounded-xl" />
                  <Skeleton className="h-52 rounded-xl" />
                  <Skeleton className="h-52 rounded-xl" />
                </div>
              ) : byType.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No batches minted and no demand approved yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {byType.map((type) => (
                    <Card key={type.fertilizerType} className="border-border shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center justify-between gap-2">
                          <span>{type.fertilizerType}</span>
                          <span className="text-sm font-normal text-muted-foreground">
                            {type.batchCount} {type.batchCount === 1 ? "batch" : "batches"}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-end">
                          <span className="text-2xl font-bold text-foreground tabular-nums">
                            {type.stockKg.toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground"> kg on record</span>
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>
                            {formatKg(type.transferredKg)} of {formatKg(type.approvedKg)} delivered
                          </span>
                          <span className="font-medium">{type.coveragePct}%</span>
                        </div>
                        <CoverageBar pct={type.coveragePct} />
                        {type.outstandingKg > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {formatKg(type.outstandingKg)} still owed to areas
                            {type.outstandingKg > type.stockKg && (
                              <span className="text-destructive">
                                {" "}
                                - exceeds the stock on record
                              </span>
                            )}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Per district */}
            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Delivery Coverage by District</h3>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Skeleton className="h-44 rounded-xl" />
                  <Skeleton className="h-44 rounded-xl" />
                  <Skeleton className="h-44 rounded-xl" />
                </div>
              ) : byDistrict.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No approved requests yet, so no district has demand.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {byDistrict.map((district) => (
                    <Card key={district.district} className="border-border shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          {district.district}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-2xl font-bold text-foreground tabular-nums">
                            {district.outstandingKg.toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground"> kg owed</span>
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {district.coveragePct}% delivered
                          </span>
                        </div>
                        <CoverageBar pct={district.coveragePct} />
                        <p className="text-xs text-muted-foreground mt-2">
                          {district.areaCount} {district.areaCount === 1 ? "area" : "areas"} ·{" "}
                          {formatKg(district.transferredKg)} of {formatKg(district.approvedKg)} sent
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Area breakdown */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-foreground">Area Breakdown</h3>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/officer-distribution")}
                  className="text-primary hover:text-primary/80 hover:bg-primary/10 gap-2 cursor-pointer"
                >
                  Distribute Stock <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border">
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">Area</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">District</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">Type</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Approved</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Delivered</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Outstanding</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">Officer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableSkeletonRows columns={7} />
                      ) : areaRows.length === 0 ? (
                        <TableEmptyState
                          columns={7}
                          icon={MapPin}
                          title="Nothing to distribute yet"
                          description="Areas appear here once an officer approves a farmer's request."
                        />
                      ) : (
                        areaRows.map((row) => (
                          <TableRow
                            key={`${row.areaId}|${row.fertilizerType}`}
                            className="border-border hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="py-4 px-6 font-medium text-foreground">
                              {row.areaName ?? `Area #${row.areaId}`}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-muted-foreground">
                              {row.district ?? "-"}
                            </TableCell>
                            <TableCell className="py-4 px-6">{row.fertilizerType}</TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums">
                              {formatKg(row.approvedKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums text-muted-foreground">
                              {formatKg(row.transferredKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                <span className="tabular-nums font-semibold text-foreground">
                                  {formatKg(row.outstandingKg)}
                                </span>
                                <div className="w-24">
                                  <CoverageBar pct={coveragePct(row.transferredKg, row.approvedKg)} />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {row.officerName ? (
                                <div className="flex flex-col">
                                  <span className="text-foreground">{row.officerName}</span>
                                  {!row.officerWallet && (
                                    <span className="text-xs text-destructive">
                                      Officer wallet not linked
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-destructive">No officer assigned</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>

            {/* Transfer ledger */}
            <section className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Recent Transfers</h3>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border">
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">Date</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">Officer</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">Area</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6">Type</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Amount</TableHead>
                        <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-center">Tx Hash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableSkeletonRows columns={6} rows={3} />
                      ) : recentTransfers.length === 0 ? (
                        <TableEmptyState
                          columns={6}
                          icon={Truck}
                          title="No transfers yet"
                          description="Stock sent from the central store to an area officer is logged here."
                        />
                      ) : (
                        recentTransfers.map((transfer) => (
                          <TableRow
                            key={transfer.transferId}
                            className="border-border hover:bg-muted/30 transition-colors group"
                          >
                            <TableCell className="py-4 px-6 text-muted-foreground">
                              {new Date(transfer.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="py-4 px-6 font-medium text-foreground">
                              {transfer.toOfficerName ?? `User #${transfer.toOfficerId}`}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-muted-foreground">
                              {transfer.areaName ?? "-"}
                            </TableCell>
                            <TableCell className="py-4 px-6">{transfer.fertilizerType ?? "-"}</TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums font-medium text-foreground">
                              {formatKg(transfer.amountKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-center">
                              <TxHashBadge transactionHash={transfer.transactionHash} groupHover />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
