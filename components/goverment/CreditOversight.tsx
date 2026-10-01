"use client";

import { useState } from "react";
import { formatCredits } from "@/lib/marketplace";
import { useCreditReconciliation, useCreditSeasons } from "@/hooks/use-credits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CoinsIcon,
  Flame,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

const ALL_SEASONS = "All";

/**
 * The ministry's view of the credit float.
 *
 * Every number here comes from `GET /api/v1/credits/reconciliation`. Nothing is
 * mocked: a metric with no endpoint behind it is absent rather than invented,
 * the same rule DistributionLevel follows.
 */
export default function CreditOversight() {
  const [season, setSeason] = useState<string>(ALL_SEASONS);

  const seasonsQuery = useCreditSeasons();
  const reconciliationQuery = useCreditReconciliation(
    season === ALL_SEASONS ? undefined : season
  );

  const data = reconciliationQuery.data;
  const sellerStats = data?.sellerStats ?? [];
  const flaggedCount = sellerStats.filter((seller) => seller.flagged).length;

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Credit Oversight</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Where every subsidy credit the treasury minted is sitting right now.
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-64">
            <label htmlFor="oversightSeason" className="text-sm font-medium text-muted-foreground">
              Season
            </label>
            <Select
              value={season}
              onValueChange={(value) => setSeason(String(value) || ALL_SEASONS)}
              disabled={seasonsQuery.isLoading}
            >
              <SelectTrigger id="oversightSeason" className="w-full h-11 bg-background">
                {/* Function child: Base UI renders the raw value otherwise, so
                    the ALL_SEASONS sentinel showed up as a bare "All". */}
                <SelectValue>
                  {(value) =>
                    !value || String(value) === ALL_SEASONS ? "All seasons" : String(value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SEASONS}>All seasons</SelectItem>
                {seasonsQuery.data.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ─── Headline figures ─────────────────────────────────────────── */}
        {reconciliationQuery.error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 flex flex-col items-center gap-3 text-center py-12">
              <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-base font-medium text-destructive max-w-md">
                {reconciliationQuery.error}
              </p>
              <Button variant="outline" size="sm" onClick={() => reconciliationQuery.refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : reconciliationQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-border">
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <Card className="border-border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <CoinsIcon className="w-4 h-4" />
                    <p className="text-sm font-medium">Credits issued</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {(data?.totalIssuedCredits ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {season === ALL_SEASONS ? "All seasons" : season}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Flame className="w-4 h-4" />
                    <p className="text-sm font-medium">Credits redeemed</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {(data?.totalRedeemedCredits ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {(data?.redemptionRatePct ?? 0).toFixed(1)}% of issued, burned and settled
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Wallet className="w-4 h-4" />
                    <p className="text-sm font-medium">Credits outstanding</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {(data?.creditsOutstanding ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Still a live claim on the treasury
                  </p>
                </CardContent>
              </Card>

              <Card
                className={`shadow-sm ${
                  data?.hasAnomaly ? "border-destructive/40 bg-destructive/5" : "border-border"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <ShieldCheck className="w-4 h-4" />
                    <p className="text-sm font-medium">Reconciliation</p>
                  </div>
                  <p
                    className={`text-3xl font-bold tabular-nums ${
                      data?.hasAnomaly ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {(data?.discrepancyCredits ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {data?.hasAnomaly
                      ? "Unaccounted credits - investigate"
                      : "Books balance"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Where the outstanding credits actually sit */}
            <Card className="border-border shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm font-semibold text-foreground mb-4">
                  Where the credits are
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border bg-card px-5 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="w-4 h-4" />
                      <p className="text-xs">Held by farmers</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {(data?.creditsHeldByFarmers ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Issued but not yet spent</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-5 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <CoinsIcon className="w-4 h-4" />
                      <p className="text-xs">Held by sellers</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {(data?.creditsHeldBySellers ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Earned but not yet redeemed</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-5 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Flame className="w-4 h-4" />
                      <p className="text-xs">Burned</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {(data?.totalRedeemedCredits ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Claims settled in cash</p>
                  </div>
                </div>

                <div
                  className={`mt-5 flex items-start gap-3 rounded-xl border px-5 py-4 ${
                    data?.hasAnomaly
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-border bg-muted/30"
                  }`}
                >
                  {data?.hasAnomaly ? (
                    <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  )}
                  <p
                    className={`text-sm ${
                      data?.hasAnomaly ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {data?.hasAnomaly ? (
                      <>
                        <strong>{formatCredits(Math.abs(data.discrepancyCredits))}</strong> cannot be
                        accounted for. Credits are only created by an issuance and destroyed by a
                        redemption burn, so a gap means they moved outside the marketplace.
                      </>
                    ) : (
                      <>
                        Issued credits equal redeemed plus held. Every credit the treasury minted is
                        accounted for.
                      </>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ─── Per-seller redemption behaviour ──────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Redemption by Seller</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Redemption volume out of proportion to order count is flagged for review.
              </p>
            </div>
            {flaggedCount > 0 && (
              <Badge variant="destructive">
                <AlertTriangle />
                {flaggedCount} flagged
              </Badge>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Seller</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Orders</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Earned</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Claimed</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Redeemed</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Rate</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliationQuery.error ? (
                  <TableErrorState
                    columns={7}
                    message={reconciliationQuery.error}
                    onRetry={() => reconciliationQuery.refetch()}
                  />
                ) : reconciliationQuery.isLoading ? (
                  <TableSkeletonRows columns={7} />
                ) : sellerStats.length === 0 ? (
                  <TableEmptyState
                    columns={7}
                    icon={Users}
                    title="No sellers registered yet"
                    description="Agro-dealers and organic producers appear here once they hold accounts."
                  />
                ) : (
                  sellerStats.map((seller) => (
                    <TableRow
                      key={seller.sellerId}
                      className={`border-border ${seller.flagged ? "bg-destructive/5" : ""}`}
                    >
                      <TableCell className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{seller.sellerName}</span>
                          <span className="text-xs text-muted-foreground">
                            {seller.sellerRole === "ORGANIC_FERTILIZER_PRODUCER"
                              ? "Organic producer"
                              : "Agro-dealer"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums text-muted-foreground">
                        {seller.completedOrderCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums text-foreground">
                        {seller.creditsEarnedFromOrders.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums text-muted-foreground">
                        {seller.creditsClaimed.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                        {seller.creditsRedeemed.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums">
                        <span
                          className={
                            seller.flagged ? "text-destructive font-semibold" : "text-muted-foreground"
                          }
                        >
                          {seller.redemptionRatePct.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {seller.flagged ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="destructive">
                              <AlertTriangle />
                              Disproportionate
                            </Badge>
                            {seller.flagReason && (
                              <span className="text-xs text-muted-foreground max-w-xs">
                                {seller.flagReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="muted">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ─── Per-season totals ────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Issued by Season</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Season</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Credit token</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Farmers funded</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Credits issued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliationQuery.error ? (
                  <TableErrorState
                    columns={4}
                    message={reconciliationQuery.error}
                    onRetry={() => reconciliationQuery.refetch()}
                  />
                ) : reconciliationQuery.isLoading ? (
                  <TableSkeletonRows columns={4} />
                ) : (data?.seasonTotals.length ?? 0) === 0 ? (
                  <TableEmptyState
                    columns={4}
                    icon={CoinsIcon}
                    title="No season funded yet"
                    description="Issue credits from the Credit Issuance screen to start a season."
                  />
                ) : (
                  data?.seasonTotals.map((row) => (
                    <TableRow key={row.season} className="border-border">
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        {row.season}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="info">Credit · TK-{row.tokenId}</Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums text-muted-foreground">
                        {row.farmerCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                        {row.issuedCredits.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
