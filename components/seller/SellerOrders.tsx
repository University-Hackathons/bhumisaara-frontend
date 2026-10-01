"use client";

import { useMemo, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatKg, formatDateTime, truncateAddress } from "@/utils/formatters";
import { ORDER_STATUS_LABELS, formatCredits, formatLkr } from "@/lib/marketplace";
import type { MarketOrder, OrderStatus } from "@/lib/marketplace";
import { useSellerOrders } from "@/hooks/use-orders";
import TxHashBadge from "@/components/goverment/TxHashBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  CoinsIcon,
  Leaf,
  Loader2,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";

const STATUS_VARIANT: Record<OrderStatus, "success" | "warning" | "info" | "muted" | "destructive"> = {
  PENDING_CONFIRMATION: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  DISPUTED: "destructive",
};

/**
 * The seller's incoming orders.
 *
 * There is exactly one action here — "mark goods ready" — and that is the
 * design, not an omission. A seller cannot complete an order or pull credits
 * from a farmer's wallet; the farmer signs that transfer themselves at
 * collection. The screen says so plainly so a seller isn't left hunting for a
 * button that deliberately does not exist.
 */
export default function SellerOrders() {
  const ordersQuery = useSellerOrders();
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const orders = ordersQuery.data;

  const summary = useMemo(() => {
    const awaitingPreparation = orders.filter(
      (order) => order.status === "PENDING_CONFIRMATION"
    ).length;
    const awaitingFarmer = orders.filter((order) => order.status === "CONFIRMED").length;
    const creditsEarned = orders
      .filter((order) => order.status === "COMPLETED" || order.status === "DISPUTED")
      .reduce((total, order) => total + order.creditsUsed, 0);
    const cashDue = orders
      .filter((order) => order.status === "COMPLETED" || order.status === "DISPUTED")
      .reduce((total, order) => total + order.cashAmountLkr, 0);

    return { awaitingPreparation, awaitingFarmer, creditsEarned, cashDue };
  }, [orders]);

  const handleMarkReady = async (order: MarketOrder) => {
    setBusyOrderId(order.orderId);

    try {
      await axiosInstance.patch(apiPaths.orders.ready(order.orderId));

      toast.success("Goods marked ready.", {
        description: `${order.farmerName ?? "The farmer"} can now collect and confirm.`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      await ordersQuery.refetch();
    } catch (error) {
      toast.error("Could not mark the goods ready.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleCancel = async (order: MarketOrder) => {
    setBusyOrderId(order.orderId);

    try {
      await axiosInstance.post(apiPaths.orders.cancel(order.orderId));

      toast.success("Order cancelled.", {
        description: "The reserved quantity is back on your listing.",
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      await ordersQuery.refetch();
    } catch (error) {
      toast.error("Could not cancel the order.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">Incoming Orders</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Prepare the goods, then the farmer confirms and releases their credits.
          </p>
        </div>

        {/* The rule, stated once */}
        <Card className="border-border bg-muted/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <CoinsIcon className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                Credits arrive only when the farmer confirms.
              </strong>{" "}
              You mark goods ready; the farmer signs the transfer from their own wallet at
              collection. There is no way for a seller to take a farmer&apos;s credits.
            </p>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">To prepare</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {summary.awaitingPreparation}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Awaiting farmer</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {summary.awaitingFarmer}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Credits earned</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {summary.creditsEarned.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Cash collected</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {formatLkr(summary.cashDue)}
            </p>
          </div>
        </div>

        {/* Orders */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Product</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Quantity</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Credits</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Cash</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Proof</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersQuery.error ? (
                  <TableErrorState
                    columns={8}
                    message={ordersQuery.error}
                    onRetry={() => ordersQuery.refetch()}
                  />
                ) : ordersQuery.isLoading ? (
                  <TableSkeletonRows columns={8} />
                ) : orders.length === 0 ? (
                  <TableEmptyState
                    columns={8}
                    icon={ShoppingCart}
                    title="No orders yet"
                    description="Orders appear here when a farmer buys from one of your listings."
                  />
                ) : (
                  orders.map((order) => {
                    const isBusy = busyOrderId === order.orderId;

                    return (
                      <TableRow key={order.orderId} className="border-border group">
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {order.farmerName ?? `Farmer #${order.farmerId}`}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {truncateAddress(order.farmerWallet)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">
                              {order.productName ?? `Listing #${order.listingId}`}
                            </span>
                            {order.isOrganic && (
                              <Badge variant="success">
                                <Leaf />
                                Organic
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right tabular-nums text-foreground">
                          {formatKg(order.quantityKg)}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                          {order.creditsUsed > 0 ? order.creditsUsed.toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right tabular-nums text-muted-foreground">
                          {order.cashAmountLkr > 0 ? formatLkr(order.cashAmountLkr) : "-"}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant={STATUS_VARIANT[order.status]}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {order.creditTransferHash ? (
                            <TxHashBadge transactionHash={order.creditTransferHash} groupHover />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {order.creditsUsed > 0 ? "Awaiting farmer" : "Cash only"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            {order.status === "PENDING_CONFIRMATION" && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() => handleMarkReady(order)}
                                  className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                  {isBusy ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Saving
                                    </>
                                  ) : (
                                    <>
                                      <PackageCheck className="w-3.5 h-3.5" />
                                      Mark ready
                                    </>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() => handleCancel(order)}
                                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                            {order.status === "CONFIRMED" && (
                              <span className="text-xs text-muted-foreground text-right">
                                Waiting for the farmer to collect
                              </span>
                            )}
                            {order.status === "COMPLETED" && (
                              <span className="text-xs text-muted-foreground">
                                {order.creditsUsed > 0
                                  ? `${formatCredits(order.creditsUsed)} received`
                                  : formatDateTime(order.completedAt)}
                              </span>
                            )}
                            {(order.status === "CANCELLED" || order.status === "DISPUTED") && (
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(order.disputedAt ?? order.createdAt)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
