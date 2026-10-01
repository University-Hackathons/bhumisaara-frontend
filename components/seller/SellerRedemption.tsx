"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { balanceOf, burn } from "thirdweb/extensions/erc1155";
import { waitForReceipt } from "thirdweb";
import { contract } from "@/lib/contract";
import { client } from "@/lib/thirdwebClient";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatters";
import { CLAIM_STATUS_LABELS, formatCredits } from "@/lib/marketplace";
import type { ClaimStatus, RedemptionClaim } from "@/lib/marketplace";
import { useMyRedemptionClaims } from "@/hooks/use-redemption-claims";
import { useSellerOrders } from "@/hooks/use-orders";
import TxHashBadge from "@/components/goverment/TxHashBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Banknote,
  CheckCircle,
  Flame,
  Loader2,
  ReceiptText,
  Wallet,
} from "lucide-react";

/** Snapshot taken before the wallet is asked to sign — see handleSettle. */
interface PendingSettlement {
  claimId: number;
  creditsClaimed: number;
  tokenId: string;
}

const STATUS_VARIANT: Record<ClaimStatus, "warning" | "info" | "success" | "destructive"> = {
  SUBMITTED: "warning",
  APPROVED: "info",
  PAID: "success",
  REJECTED: "destructive",
};

export default function SellerRedemption() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const claimsQuery = useMyRedemptionClaims();
  const ordersQuery = useSellerOrders();

  const [creditsInput, setCreditsInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyClaimId, setBusyClaimId] = useState<number | null>(null);

  /** Frozen before signing — the burn and the registry write are seconds apart. */
  const pendingSettlementRef = useRef<PendingSettlement | null>(null);

  const claims = claimsQuery.data;

  /**
   * What the seller may still claim.
   *
   * Taken from the most recent claim row because the backend computes both
   * figures there; falling back to the orders list keeps the screen honest
   * before any claim exists.
   */
  const { earned, alreadyClaimed } = useMemo(() => {
    const latest = claims[0];
    if (latest) {
      return {
        earned: latest.creditsEarnedFromOrders,
        alreadyClaimed: latest.creditsAlreadyClaimed,
      };
    }

    const earnedFromOrders = ordersQuery.data
      .filter((order) => order.status === "COMPLETED" || order.status === "DISPUTED")
      .reduce((total, order) => total + order.creditsUsed, 0);

    return { earned: earnedFromOrders, alreadyClaimed: 0 };
  }, [claims, ordersQuery.data]);

  const claimable = Math.max(0, earned - alreadyClaimed);
  const redeemed = useMemo(
    () =>
      claims
        .filter((claim) => claim.status === "PAID")
        .reduce((total, claim) => total + claim.creditsClaimed, 0),
    [claims]
  );

  const parsedCredits = Number(creditsInput);
  const isCreditsValid =
    Number.isInteger(parsedCredits) && parsedCredits > 0 && parsedCredits <= claimable;

  const refreshAll = useCallback(async () => {
    await Promise.all([claimsQuery.refetch(), ordersQuery.refetch()]);
  }, [claimsQuery, ordersQuery]);

  const handleSubmitClaim = async () => {
    if (!isCreditsValid || isSubmitting) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Submitting your claim...");

    try {
      await axiosInstance.post(apiPaths.redemptionClaims.submit, {
        creditsClaimed: parsedCredits,
      });

      toast.dismiss(toastId);
      toast.success("Claim submitted for review.", {
        description: `${formatCredits(parsedCredits)} - the ministry will approve before you burn.`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      setCreditsInput("");
      await refreshAll();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Could not submit the claim.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Records the settling burn against the approved claim. */
  const recordSettlement = async (burnTransactionHash: string) => {
    const pending = pendingSettlementRef.current;
    if (!pending) return;

    const toastId = toast.loading("Recording the burn with the registry...");

    try {
      await axiosInstance.post(apiPaths.redemptionClaims.settle(pending.claimId), {
        burnTransactionHash,
      });

      toast.dismiss(toastId);
      toast.success("Claim settled.", {
        description: `${formatCredits(pending.creditsClaimed)} burned - the treasury has honoured the claim.`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      pendingSettlementRef.current = null;
      await refreshAll();
    } catch (error) {
      toast.dismiss(toastId);
      // The credits are already destroyed. Losing this hash would leave a claim
      // nobody can settle, so it stays on screen until dismissed.
      toast.error("Credits burned on-chain, but the registry save failed.", {
        description: `Record this transaction hash manually: ${burnTransactionHash} - ${describeApiError(
          error,
          "Please check server connection."
        )}`,
        duration: Infinity,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    }
  };

  /**
   * Burns the approved credits from the seller's own wallet.
   *
   * The government approves the payment but cannot burn these tokens — an
   * ERC-1155 balance is only destroyable by its holder. A seller may hold
   * credits under several season tokens, so this finds one with enough balance
   * rather than guessing.
   */
  const handleSettle = async (claim: RedemptionClaim) => {
    if (!account) {
      toast.error("Connect the wallet holding your credits to settle this claim.");
      return;
    }

    setBusyClaimId(claim.claimId);

    try {
      let tokenIdToBurn: bigint | null = null;

      for (const rawTokenId of claim.creditTokenIds) {
        let candidate: bigint;
        try {
          candidate = BigInt(rawTokenId);
        } catch {
          continue;
        }

        const held = await balanceOf({
          contract,
          owner: account.address,
          tokenId: candidate,
        });

        if (Number(held) >= claim.creditsClaimed) {
          tokenIdToBurn = candidate;
          break;
        }
      }

      if (tokenIdToBurn === null) {
        toast.error("Not enough credits in this wallet.", {
          description: `No credit token in ${account.address.slice(0, 6)}… holds the ${
            claim.creditsClaimed
          } credits this claim settles.`,
          icon: <AlertCircle className="w-5 h-5 text-destructive" />,
        });
        return;
      }

      pendingSettlementRef.current = {
        claimId: claim.claimId,
        creditsClaimed: claim.creditsClaimed,
        tokenId: tokenIdToBurn.toString(),
      };

      const transaction = burn({
        contract,
        account: account.address,
        id: tokenIdToBurn,
        value: BigInt(claim.creditsClaimed),
      });

      const txResult = await sendTransaction(transaction);

      const receipt = await waitForReceipt({
        client,
        chain: contract.chain,
        transactionHash: txResult.transactionHash,
      });

      await recordSettlement(receipt.transactionHash);
    } catch (error) {
      pendingSettlementRef.current = null;
      console.error("Credit Burn Error:", error);
      toast.error("Blockchain burn transaction failed.", {
        description: describeApiError(error, "User denied or transaction reverted."),
      });
    } finally {
      setBusyClaimId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Redemption Claims</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Cash in the subsidy credits farmers paid you with.
            </p>
          </div>
          {!account && (
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm font-medium rounded-full border border-destructive/20 w-fit">
              <Wallet className="w-4 h-4" />
              Connect a wallet to settle
            </div>
          )}
        </div>

        {/* How it works — the two-step is worth explaining once */}
        <div className="rounded-xl border border-border bg-muted/30 px-6 py-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Claim, then burn.</strong> The ministry reviews your
            claim and approves the payment. You then burn the credits from your own wallet - nobody
            else can destroy tokens you hold - and the claim is settled.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Earned from orders</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {earned.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Already claimed</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {alreadyClaimed.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
            <p className="text-xs text-muted-foreground">Left to claim</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {claimable.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Settled &amp; burned</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {redeemed.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Submit a claim */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <ReceiptText className="w-5 h-5" />
              </div>
              <CardTitle className="text-xl font-semibold text-foreground">
                Submit a Claim
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {claimable <= 0 ? (
              <p className="text-sm text-muted-foreground">
                You have no unclaimed credits. Credits become claimable once a farmer confirms
                collection on an order they paid with credits.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2 max-w-xs">
                  <label htmlFor="creditsClaimed" className="text-sm font-medium text-foreground">
                    Credits to claim <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="creditsClaimed"
                    type="number"
                    min="1"
                    step="1"
                    max={claimable}
                    value={creditsInput}
                    onChange={(event) => setCreditsInput(event.target.value)}
                    placeholder={String(claimable)}
                    disabled={isSubmitting}
                    className="h-11 bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Up to {claimable.toLocaleString()} available to claim.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSubmitClaim}
                    disabled={!isCreditsValid || isSubmitting}
                    className="h-11 px-6 text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Banknote className="w-4 h-4" />
                        Submit claim
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Claims */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Your Claims</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Claim</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Credits</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Submitted</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Burn proof</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimsQuery.error ? (
                  <TableErrorState
                    columns={6}
                    message={claimsQuery.error}
                    onRetry={() => claimsQuery.refetch()}
                  />
                ) : claimsQuery.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : claims.length === 0 ? (
                  <TableEmptyState
                    columns={6}
                    icon={ReceiptText}
                    title="No claims yet"
                    description="Submit a claim above once farmers have paid you with subsidy credits."
                  />
                ) : (
                  claims.map((claim) => {
                    const isBusy = busyClaimId === claim.claimId;

                    return (
                      <TableRow key={claim.claimId} className="border-border group">
                        <TableCell className="py-4 px-6 font-medium text-foreground">
                          #{claim.claimId}
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
                          {formatDateTime(claim.submittedAt)}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {claim.burnTransactionHash ? (
                            <TxHashBadge transactionHash={claim.burnTransactionHash} groupHover />
                          ) : (
                            <span className="text-xs text-muted-foreground">Not burned yet</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center justify-end">
                            {claim.status === "APPROVED" ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isBusy || isTxPending || !account}
                                onClick={() => handleSettle(claim)}
                                className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                {isBusy ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Burning
                                  </>
                                ) : (
                                  <>
                                    <Flame className="w-3.5 h-3.5" />
                                    Burn &amp; settle
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {claim.status === "SUBMITTED"
                                  ? "Awaiting ministry review"
                                  : claim.processedAt
                                    ? formatDateTime(claim.processedAt)
                                    : "-"}
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
