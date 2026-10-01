"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatKg, formatDateTime } from "@/utils/formatters";
import { ORDER_STATUS_LABELS, formatLkr } from "@/lib/marketplace";
import type { OrderStatus } from "@/lib/marketplace";
import { useAuth } from "@/context/AuthContext";
import { useMyListings } from "@/hooks/use-listings";
import { useSellerOrders } from "@/hooks/use-orders";
import { useMyRedemptionClaims } from "@/hooks/use-redemption-claims";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowRight,
  Banknote,
  CoinsIcon,
  Leaf,
  Package,
  PackageCheck,
  ShoppingCart,
  Store,
} from "lucide-react";

/**
 * The storefront dashboard for both seller roles.
 *
 * Every figure here comes from a real endpoint — listings, orders and claims.
 * The previous dealer and producer dashboards were hardcoded mock-ups ("450 MT
 * of NPK", a Record Sale form that posted nowhere); a number with no endpoint
 * behind it is now absent rather than invented, matching how DistributionLevel
 * treats the same problem.
 */

const STATUS_VARIANT: Record<OrderStatus, "success" | "warning" | "info" | "muted" | "destructive"> = {
  PENDING_CONFIRMATION: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  DISPUTED: "destructive",
};

export default function SellerDashboard() {
  const { user } = useAuth();
  const listingsQuery = useMyListings();
  const ordersQuery = useSellerOrders();
  const claimsQuery = useMyRedemptionClaims();

  const isOrganicSeller = user?.role === "ORGANIC_FERTILIZER_PRODUCER";

  const listings = listingsQuery.data;
  const orders = ordersQuery.data;
  const claims = claimsQuery.data;

  const stats = useMemo(() => {
    const activeListings = listings.filter((listing) => listing.status === "ACTIVE").length;
    const stockListed = listings.reduce((total, listing) => total + listing.availableKg, 0);
    const toPrepare = orders.filter((order) => order.status === "PENDING_CONFIRMATION").length;
    const awaitingFarmer = orders.filter((order) => order.status === "CONFIRMED").length;

    const settled = orders.filter(
      (order) => order.status === "COMPLETED" || order.status === "DISPUTED"
    );
    const creditsEarned = settled.reduce((total, order) => total + order.creditsUsed, 0);
    const cashCollected = settled.reduce((total, order) => total + order.cashAmountLkr, 0);

    const latestClaim = claims[0];
    const claimable = latestClaim
      ? Math.max(0, latestClaim.creditsEarnedFromOrders - latestClaim.creditsAlreadyClaimed)
      : creditsEarned;

    return {
      activeListings,
      stockListed,
      toPrepare,
      awaitingFarmer,
      creditsEarned,
      cashCollected,
      claimable,
    };
  }, [listings, orders, claims]);

  const recentOrders = useMemo(() => orders.slice(0, 6), [orders]);

  const isLoading = listingsQuery.isLoading || ordersQuery.isLoading;

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Storefront Dashboard</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Your listings, incoming orders and subsidy credit position.
            </p>
          </div>
          <Badge variant={isOrganicSeller ? "success" : "info"} className="text-sm px-3 py-1.5 w-fit">
            {isOrganicSeller ? <Leaf /> : <Package />}
            {isOrganicSeller ? "Organic producer" : "Agro-dealer"}
          </Badge>
        </div>

        {/* Summary */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-border">
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card className="border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Store className="w-4 h-4" />
                  <p className="text-sm font-medium">Live listings</p>
                </div>
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {stats.activeListings}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatKg(stats.stockListed)} listed in total
                </p>
              </CardContent>
            </Card>

            <Card
              className={`shadow-sm ${
                stats.toPrepare > 0 ? "border-primary/40 bg-primary/5" : "border-border"
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <PackageCheck className="w-4 h-4" />
                  <p className="text-sm font-medium">Orders to prepare</p>
                </div>
                <p className="text-3xl font-bold text-foreground tabular-nums">{stats.toPrepare}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.awaitingFarmer} awaiting farmer collection
                </p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <CoinsIcon className="w-4 h-4" />
                  <p className="text-sm font-medium">Credits earned</p>
                </div>
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {stats.creditsEarned.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.claimable.toLocaleString()} left to claim
                </p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Banknote className="w-4 h-4" />
                  <p className="text-sm font-medium">Cash collected</p>
                </div>
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {formatLkr(stats.cashCollected)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Recorded only - settled directly with farmers
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/inventory" className="block">
            <Card className="border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 h-full">
              <CardContent className="pt-6 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">Manage listings</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Publish products and set your prices.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/incoming-orders" className="block">
            <Card className="border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 h-full">
              <CardContent className="pt-6 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">Incoming orders</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mark goods ready for collection.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/redemption" className="block">
            <Card className="border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 h-full">
              <CardContent className="pt-6 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">Redeem credits</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cash in credits farmers paid you with.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent orders */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">Recent Orders</h2>
            <Link href="/incoming-orders">
              <Button variant="ghost" size="sm" className="text-primary cursor-pointer">
                View all
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Product</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Quantity</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Credits</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Placed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersQuery.error ? (
                  <TableErrorState
                    columns={6}
                    message={ordersQuery.error}
                    onRetry={() => ordersQuery.refetch()}
                  />
                ) : ordersQuery.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : recentOrders.length === 0 ? (
                  <TableEmptyState
                    columns={6}
                    icon={ShoppingCart}
                    title="No orders yet"
                    description="Publish a listing and farmers will be able to order from you."
                  />
                ) : (
                  recentOrders.map((order) => (
                    <TableRow key={order.orderId} className="border-border">
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        {order.farmerName ?? `Farmer #${order.farmerId}`}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {order.productName ?? `Listing #${order.listingId}`}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums text-foreground">
                        {formatKg(order.quantityKg)}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                        {order.creditsUsed > 0 ? order.creditsUsed.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant={STATUS_VARIANT[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                        {formatDateTime(order.createdAt)}
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
