"use client";

import { useCallback, useState } from "react";
import { useReadContract } from "thirdweb/react";
import { balanceOf } from "thirdweb/extensions/erc1155";
import { contract } from "@/lib/contract";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatDateTime, truncateAddress } from "@/utils/formatters";
import { CLAIM_STATUS_LABELS, formatCredits } from "@/lib/marketplace";
import type { ClaimStatus, RedemptionClaim } from "@/lib/marketplace";
import {
  useAllRedemptionClaims,
  usePendingRedemptionClaims,
} from "@/hooks/use-redemption-claims";
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
import { AlertCircle, CheckCircle, Loader2, ReceiptText, ShieldCheck, X } from "lucide-react";

const STATUS_VARIANT: Record<ClaimStatus, "warning" | "info" | "success" | "destructive"> = {
  SUBMITTED: "warning",
  APPROVED: "info",
  PAID: "success",
  REJECTED: "destructive",
};

/**
 * The on-chain credit balance of one seller's wallet, so the reviewing admin
 * can see the credits really are where the claim says they are.
 *
 * Only the newest credit token is read — a single `useReadContract` per row,
 * because hooks cannot be called in a loop over an arbitrary token list.
 */
function SellerChainBalance({ claim }: { claim: RedemptionClaim }) {
  const tokenId = claim.creditTokenIds[0] ?? null;

  let parsedTokenId: bigint | null = null;
  if (tokenId) {
    try {
      parsedTokenId = BigInt(tokenId);
    } catch {
      parsedTokenId = null;
    }
  }

  const { data, isLoading } = useReadContract(balanceOf, {
    contract,
    owner: claim.sellerWallet ?? "0x0000000000000000000000000000000000000000",
    tokenId: parsedTokenId ?? BigInt(0),
    queryOptions: { enabled: Boolean(claim.sellerWallet && parsedTokenId !== null) },
  });

  if (!claim.sellerWallet) {
    return <span className="text-xs text-destructive">No wallet linked</span>;
  }

  if (parsedTokenId === null) {
    return <span className="text-xs text-muted-foreground">No credit token</span>;
  }

  if (isLoading || data === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Reading chain…
      </span>
    );
  }

  const held = Number(data);
  const covers = held >= claim.creditsClaimed;

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={covers ? "success" : "destructive"}>
        {held.toLocaleString()} on-chain
      </Badge>
      {!covers && (
        <span className="text-xs text-destructive">
          Below the {claim.creditsClaimed.toLocaleString()} claimed
        </span>
      )}
    </div>
  );
}

export default function RedemptionClaimsQueue() {
  const pendingQuery = usePendingRedemptionClaims();
  const allQuery = useAllRedemptionClaims();

  const [busyClaimId, setBusyClaimId] = useState<number | null>(null);

  const pending = pendingQuery.data;
  const all = allQuery.data;

  const refreshAll = useCallback(async () => {
    await Promise.all([pendingQuery.refetch(), allQuery.refetch()]);
  }, [pendingQuery, allQuery]);

  const handleReview = async (claim: RedemptionClaim, status: "APPROVED" | "REJECTED") => {
    setBusyClaimId(claim.claimId);

    try {
      await axiosInstance.patch(apiPaths.redemptionClaims.review(claim.claimId), { status });

      toast.success(
        status === "APPROVED" ? "Claim approved for payment." : "Claim rejected.",
        {
          description:
            status === "APPROVED"
              ? `${claim.sellerName ?? "The seller"} can now burn ${formatCredits(
                  claim.creditsClaimed
                )} to settle.`
              : "Nothing was burned - the credits stay with the seller.",
          icon: <CheckCircle className="w-5 h-5 text-primary" />,
        }
      );

      await refreshAll();
    } catch (error) {
      toast.error("Could not record the decision.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setBusyClaimId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">Redemption Claims</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Verify what sellers hold, then authorise the treasury to settle.
          </p>
        </div>

        <Card className="border-border bg-muted/30">
          <CardContent className="pt-6 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Approval authorises payment; it does not burn.</strong>{" "}
              The credits sit in the seller&apos;s wallet, so only they can destroy them. A claim
              reaches <em>Paid</em> when their burn hash is recorded. Check the on-chain balance
              against the claim before approving.
            </p>
          </CardContent>
        </Card>

        {/* ─── The queue ────────────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Awaiting Action</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Claims under review, and approved claims still waiting on the seller&apos;s burn.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Seller</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Claimed</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Earned</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Wallet balance</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Submitted</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingQuery.error ? (
                  <TableErrorState
                    columns={7}
                    message={pendingQuery.error}
                    onRetry={() => pendingQuery.refetch()}
                  />
                ) : pendingQuery.isLoading ? (
                  <TableSkeletonRows columns={7} />
                ) : pending.length === 0 ? (
                  <TableEmptyState
                    columns={7}
                    icon={ReceiptText}
                    title="Nothing awaiting review"
                    description="Claims appear here when a dealer or producer asks to redeem credits."
                  />
                ) : (
                  pending.map((claim) => {
                    const isBusy = busyClaimId === claim.claimId;
                    const overEarned = claim.creditsClaimed > claim.creditsEarnedFromOrders;

                    return (
                      <TableRow key={claim.claimId} className="border-border">
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {claim.sellerName ?? `Seller #${claim.sellerId}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {claim.sellerRole === "ORGANIC_FERTILIZER_PRODUCER"
                                ? "Organic producer"
                                : "Agro-dealer"}{" "}
                              · {truncateAddress(claim.sellerWallet)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                          {claim.creditsClaimed.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right tabular-nums">
                          <span className={overEarned ? "text-destructive" : "text-muted-foreground"}>
                            {claim.creditsEarnedFromOrders.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <SellerChainBalance claim={claim} />
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant={STATUS_VARIANT[claim.status]}>
                            {CLAIM_STATUS_LABELS[claim.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                          {formatDateTime(claim.submittedAt)}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            {claim.status === "SUBMITTED" ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() => handleReview(claim, "APPROVED")}
                                  className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                  {isBusy ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() => handleReview(claim, "REJECTED")}
                                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground text-right">
                                Approved - awaiting the seller&apos;s burn
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

        {/* ─── Full ledger ──────────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Redemption Ledger</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Every claim ever filed, newest first.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Claim</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Seller</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Credits</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Reviewed by</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Burn proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allQuery.error ? (
                  <TableErrorState
                    columns={6}
                    message={allQuery.error}
                    onRetry={() => allQuery.refetch()}
                  />
                ) : allQuery.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : all.length === 0 ? (
                  <TableEmptyState
                    columns={6}
                    icon={ReceiptText}
                    title="No claims filed yet"
                    description="The redemption ledger fills as sellers cash in their credits."
                  />
                ) : (
                  all.map((claim) => (
                    <TableRow key={claim.claimId} className="border-border group">
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        #{claim.claimId}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {claim.sellerName ?? `Seller #${claim.sellerId}`}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                        {claim.creditsClaimed.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant={STATUS_VARIANT[claim.status]}>
                          {CLAIM_STATUS_LABELS[claim.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                        {claim.processedByName ?? "-"}
                        {claim.processedAt && (
                          <span className="block text-xs">{formatDateTime(claim.processedAt)}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {claim.burnTransactionHash ? (
                          <TxHashBadge transactionHash={claim.burnTransactionHash} groupHover />
                        ) : (
                          <span className="text-xs text-muted-foreground">Not burned</span>
                        )}
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
