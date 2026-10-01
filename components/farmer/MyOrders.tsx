"use client";

import { useCallback, useRef, useState } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { safeTransferFrom } from "thirdweb/extensions/erc1155";
import { waitForReceipt } from "thirdweb";
import { contract } from "@/lib/contract";
import { client } from "@/lib/thirdwebClient";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatKg, formatDateTime } from "@/utils/formatters";
import { ORDER_STATUS_LABELS, formatCredits, formatLkr } from "@/lib/marketplace";
import type { MarketOrder, OrderStatus } from "@/lib/marketplace";
import { useMyOrders } from "@/hooks/use-orders";
import { useMyCreditBalance } from "@/hooks/use-credits";
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
  Flag,
  Leaf,
  Loader2,
  ShoppingCart,
  Wallet,
} from "lucide-react";

/** Snapshot taken before the wallet is asked to sign — see handleConfirm. */
interface PendingConfirmation {
  orderId: number;
  creditsUsed: number;
  productName: string;
  sellerName: string;
}

const STATUS_VARIANT: Record<OrderStatus, "success" | "warning" | "info" | "muted" | "destructive"> = {
  PENDING_CONFIRMATION: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  DISPUTED: "destructive",
};

/** Numeric-string token ids only; anything else can't be sent on-chain. */
const parseTokenId = (tokenId: string | null): bigint | null => {
  if (!tokenId) return null;
  try {
    return BigInt(tokenId);
  } catch {
    return null;
  }
};

export default function MyOrders() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const ordersQuery = useMyOrders();
  const balanceQuery = useMyCreditBalance();

  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  /**
   * Frozen before the wallet is asked to sign. The transfer and the backend
   * write are seconds apart and the table refreshes underneath — the registry
   * must be told which order was actually paid.
   */
  const pendingConfirmationRef = useRef<PendingConfirmation | null>(null);

  const orders = ordersQuery.data;

  const refreshAll = useCallback(async () => {
    await Promise.all([ordersQuery.refetch(), balanceQuery.refetch()]);
  }, [ordersQuery, balanceQuery]);

  /** Writes the confirmed transfer to the registry and completes the order. */
  const recordConfirmation = async (creditTransferHash: string | null) => {
    const pending = pendingConfirmationRef.current;
    if (!pending) return;

    const toastId = toast.loading("Confirming your collection...");

    try {
      await axiosInstance.post(apiPaths.orders.confirm(pending.orderId), {
        creditTransferHash,
      });

      toast.dismiss(toastId);
      toast.success("Collection confirmed.", {
        description: pending.creditsUsed
          ? `${formatCredits(pending.creditsUsed)} sent to ${pending.sellerName} for ${pending.productName}.`
          : `${pending.productName} marked as collected.`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      pendingConfirmationRef.current = null;
      await refreshAll();
    } catch (error) {
      toast.dismiss(toastId);

      if (creditTransferHash) {
        // The credits have already left the wallet. Losing this hash would
        // leave an order nobody can reconcile, so it stays until dismissed.
        toast.error("Credits transferred on-chain, but the registry save failed.", {
          description: `Record this transaction hash manually: ${creditTransferHash} - ${describeApiError(
            error,
            "Please check server connection."
          )}`,
          duration: Infinity,
          icon: <AlertCircle className="w-5 h-5 text-destructive" />,
        });
      } else {
        toast.error("Could not confirm the order.", {
          description: describeApiError(error, "Please check server connection."),
          icon: <AlertCircle className="w-5 h-5 text-destructive" />,
        });
      }
    }
  };

  /**
   * The farmer's confirmation at physical handover.
   *
   * This is the only moment credits move, and it is signed by the farmer's own
   * wallet — the seller has no way to trigger it. A cash-only order has nothing
   * to transfer and completes without touching the chain.
   */
  const handleConfirm = async (order: MarketOrder) => {
    setBusyOrderId(order.orderId);

    pendingConfirmationRef.current = {
      orderId: order.orderId,
      creditsUsed: order.creditsUsed,
      productName: order.productName ?? "your order",
      sellerName: order.sellerName ?? "the seller",
    };

    try {
      if (order.creditsUsed <= 0) {
        await recordConfirmation(null);
        return;
      }

      if (!account) {
        toast.error("Connect your wallet to send the credits.");
        pendingConfirmationRef.current = null;
        return;
      }

      if (!order.sellerWallet) {
        toast.error("The seller has not linked a wallet, so credits cannot be sent.");
        pendingConfirmationRef.current = null;
        return;
      }

      const tokenId = parseTokenId(order.creditTokenId);
      if (tokenId === null) {
        toast.error("Your credit token could not be resolved.", {
          description: "Ask the ministry to re-check this season's credit issuance.",
        });
        pendingConfirmationRef.current = null;
        return;
      }

      const transaction = safeTransferFrom({
        contract,
        from: account.address,
        to: order.sellerWallet,
        tokenId,
        value: BigInt(order.creditsUsed),
        data: "0x",
      });

      const txResult = await sendTransaction(transaction);

      const receipt = await waitForReceipt({
        client,
        chain: contract.chain,
        transactionHash: txResult.transactionHash,
      });

      await recordConfirmation(receipt.transactionHash);
    } catch (error) {
      pendingConfirmationRef.current = null;
      console.error("Credit Transfer Error:", error);
      toast.error("Blockchain credit transfer failed.", {
        description: describeApiError(error, "User denied or transaction reverted."),
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
        description: "The reserved stock has been returned to the seller's listing.",
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });
      await refreshAll();
    } catch (error) {
      toast.error("Could not cancel the order.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleDispute = async (order: MarketOrder) => {
    setBusyOrderId(order.orderId);

    try {
      await axiosInstance.post(apiPaths.orders.dispute(order.orderId));
      toast.success("Dispute raised.", {
        description: "The ministry will review this order. Nothing is reversed automatically.",
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });
      await refreshAll();
    } catch (error) {
      toast.error("Could not raise the dispute.", {
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">My Orders</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Confirm collection to release your credits - nobody else can.
            </p>
          </div>
          {!account && (
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm font-medium rounded-full border border-destructive/20 w-fit">
              <Wallet className="w-4 h-4" />
              Connect a wallet to confirm
            </div>
          )}
        </div>

        <Card className="border-border bg-muted/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <CoinsIcon className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Only confirm once you have the goods.</strong>{" "}
              Confirming sends your subsidy credits from your wallet to the seller&apos;s. Until you
              do, they stay with you and the order can still be cancelled.
            </p>
          </CardContent>
        </Card>

        {/* Orders */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Product</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Seller</TableHead>
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
                    description="Browse the marketplace to buy fertilizer with your subsidy credits."
                  />
                ) : (
                  orders.map((order) => {
                    const isBusy = busyOrderId === order.orderId;
                    const canConfirm =
                      order.status === "PENDING_CONFIRMATION" || order.status === "CONFIRMED";
                    const canDispute = order.status === "COMPLETED";

                    return (
                      <TableRow key={order.orderId} className="border-border group">
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">
                              {order.productName ?? `Listing #${order.listingId}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {order.fertilizerType ?? "-"}
                              </span>
                              {order.isOrganic && (
                                <Badge variant="success">
                                  <Leaf />
                                  Organic
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-muted-foreground">
                          {order.sellerName ?? "-"}
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
                              {order.creditsUsed > 0 ? "Not yet sent" : "Cash only"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            {canConfirm && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isBusy || isTxPending}
                                  onClick={() => handleConfirm(order)}
                                  className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                  {isBusy ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Confirming
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Confirm receipt
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
                            {canDispute && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleDispute(order)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                <Flag className="w-3.5 h-3.5" />
                                Dispute
                              </Button>
                            )}
                            {!canConfirm && !canDispute && (
                              <span className="text-xs text-muted-foreground">
                                {order.disputedAt
                                  ? `Disputed ${formatDateTime(order.disputedAt)}`
                                  : formatDateTime(order.completedAt ?? order.createdAt)}
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
