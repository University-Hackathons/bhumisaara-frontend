"use client";

import { useActiveAccount } from "thirdweb/react";
import { formatDateTime, truncateAddress } from "@/utils/formatters";
import { formatCredits } from "@/lib/marketplace";
import { useMyCreditBalance, useOnChainCreditBalance } from "@/hooks/use-credits";
import TxHashBadge from "@/components/goverment/TxHashBadge";
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
import { AlertCircle, CoinsIcon, Leaf, Loader2, Wallet } from "lucide-react";

/**
 * The farmer's credit position: what the treasury minted them, what they have
 * spent, and what their wallet actually holds right now.
 *
 * Both figures are shown deliberately. The registry total is Postgres' view of
 * the ledger; the wallet total is the chain's. They agree unless credits moved
 * somewhere the marketplace never saw, and that gap is worth seeing.
 */
export default function CreditBalance() {
  const account = useActiveAccount();
  const balanceQuery = useMyCreditBalance();

  const balance = balanceQuery.data;
  const activeSeason = balance?.seasonTokenIds?.[0] ?? null;

  const { balance: onChainBalance, isLoading: isChainLoading } = useOnChainCreditBalance(
    activeSeason?.tokenId
  );

  const ledgerBalance = balance?.ledgerBalanceCredits ?? 0;
  const hasDivergence = onChainBalance !== null && onChainBalance !== ledgerBalance;

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Subsidy Credits</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Your entitlement from the government, season by season.
            </p>
          </div>
          {!account && (
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm font-medium rounded-full border border-destructive/20 w-fit">
              <Wallet className="w-4 h-4" />
              Connect a wallet to read your balance
            </div>
          )}
        </div>

        {/* What a credit is */}
        <div className="rounded-xl border border-border bg-muted/30 px-6 py-4 flex items-start gap-3">
          <Leaf className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            One credit buys <strong className="text-foreground">1kg of chemical</strong> fertilizer
            or <strong className="text-foreground">1.5kg of organic</strong>. Credits are a claim on
            the treasury - they are not stock, and they are not attached to any warehouse.
          </p>
        </div>

        {/* Headline figures */}
        {balanceQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="border-border">
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : balanceQuery.error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 flex flex-col items-center gap-3 text-center py-12">
              <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-base font-medium text-destructive max-w-md">{balanceQuery.error}</p>
              <Button variant="outline" size="sm" onClick={() => balanceQuery.refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-primary/30 bg-primary/5 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Wallet className="w-4 h-4" />
                    <p className="text-sm font-medium">In your wallet now</p>
                  </div>
                  <p className="text-4xl font-bold text-foreground tabular-nums">
                    {isChainLoading && onChainBalance === null ? (
                      <span className="inline-flex items-center gap-2 text-2xl">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Reading…
                      </span>
                    ) : onChainBalance !== null ? (
                      onChainBalance.toLocaleString()
                    ) : (
                      "-"
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {activeSeason
                      ? `Read on-chain for ${activeSeason.season}`
                      : "No credit token to read yet"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <CoinsIcon className="w-4 h-4" />
                    <p className="text-sm font-medium">Issued to date</p>
                  </div>
                  <p className="text-4xl font-bold text-foreground tabular-nums">
                    {(balance?.totalIssuedCredits ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Across {balance?.seasonTokenIds?.length ?? 0} season
                    {(balance?.seasonTokenIds?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <CoinsIcon className="w-4 h-4" />
                    <p className="text-sm font-medium">Spent on orders</p>
                  </div>
                  <p className="text-4xl font-bold text-foreground tabular-nums">
                    {(balance?.spentCredits ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Registry expects {formatCredits(ledgerBalance)} remaining
                  </p>
                </CardContent>
              </Card>
            </div>

            {hasDivergence && (
              // Not an error state: it's a real fact worth naming, because it
              // means credits moved outside the marketplace.
              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-6 py-4">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Your wallet holds {formatCredits(onChainBalance)}, but the registry expects{" "}
                  {formatCredits(ledgerBalance)}. Credits transferred outside the marketplace are not
                  tracked here.
                </p>
              </div>
            )}

            {/* Per season */}
            {(balance?.seasonTokenIds?.length ?? 0) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {balance?.seasonTokenIds.map((season) => (
                  <div
                    key={season.season}
                    className="rounded-xl border border-border bg-card px-5 py-4"
                  >
                    <p className="text-sm font-medium text-foreground">{season.season}</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
                      {season.issuedCredits.toLocaleString()}
                    </p>
                    <Badge variant="info" className="mt-2">
                      Credit · TK-{season.tokenId}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Issuance history */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Issuance History</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Every credit the government has minted to your wallet.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Season</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Credits</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Token</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Wallet</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Issued</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balanceQuery.error ? (
                  <TableErrorState
                    columns={6}
                    message={balanceQuery.error}
                    onRetry={() => balanceQuery.refetch()}
                  />
                ) : balanceQuery.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : (balance?.issuances.length ?? 0) === 0 ? (
                  <TableEmptyState
                    columns={6}
                    icon={CoinsIcon}
                    title="No credits issued to you yet"
                    description="The government issues subsidy credits once a season's budget is funded."
                  />
                ) : (
                  balance?.issuances.map((issuance) => (
                    <TableRow key={issuance.issuanceId} className="border-border group">
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        {issuance.season}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                        {issuance.creditsKg.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="info">Credit · TK-{issuance.tokenId}</Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-mono text-xs text-muted-foreground">
                        {truncateAddress(issuance.farmerWallet)}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                        {formatDateTime(issuance.createdAt)}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <TxHashBadge transactionHash={issuance.transactionHash} groupHover />
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
