"use client";

import { useCallback, useMemo, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatKg } from "@/utils/formatters";
import {
  creditsRequired,
  formatCredits,
  formatLkr,
  kgCoveredByCredits,
} from "@/lib/marketplace";
import type { ProductListing } from "@/lib/marketplace";
import { useMarketplaceListings } from "@/hooks/use-listings";
import { useMyCreditBalance, useOnChainCreditBalance } from "@/hooks/use-credits";
import { useMyOrders } from "@/hooks/use-orders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  CoinsIcon,
  Leaf,
  Loader2,
  Package,
  ShoppingCart,
  Sprout,
  Store,
  Wallet,
  X,
} from "lucide-react";

type PaymentMode = "credits" | "mixed" | "cash";
type OrganicFilter = "all" | "organic" | "chemical";
type SubsidyFilter = "any" | "credits";

/**
 * Every select below is driven by one of these tables.
 *
 * Base UI renders the *raw* value in the trigger unless `SelectValue` is given
 * a function child, which is why these screens were showing "all", "any" and
 * "mixed" once something was picked. Keeping the label beside the value means
 * the trigger and the dropdown can never drift apart.
 */
const ORGANIC_FILTERS: { value: OrganicFilter; label: string }[] = [
  { value: "all", label: "All products" },
  { value: "organic", label: "Organic only" },
  { value: "chemical", label: "Chemical only" },
];

const SUBSIDY_FILTERS: { value: SubsidyFilter; label: string }[] = [
  { value: "any", label: "Any payment" },
  { value: "credits", label: "Accepts subsidy credits" },
];

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "credits", label: "Subsidy credits" },
  { value: "mixed", label: "Credits + cash" },
  { value: "cash", label: "Cash only" },
];

/** Resolves the label Base UI should show for the currently selected value. */
const labelFor = (
  options: { value: string; label: string }[],
  value: unknown,
  fallback: string
) => options.find((option) => option.value === String(value ?? ""))?.label ?? fallback;

export default function Marketplace() {
  const [organicFilter, setOrganicFilter] = useState<OrganicFilter>("all");
  const [subsidyOnly, setSubsidyOnly] = useState(false);

  const listingsQuery = useMarketplaceListings({
    isOrganic: organicFilter === "all" ? undefined : organicFilter === "organic",
    isSubsidyEligible: subsidyOnly ? true : undefined,
  });
  const balanceQuery = useMyCreditBalance();
  const ordersQuery = useMyOrders();

  const [selectedListing, setSelectedListing] = useState<ProductListing | null>(null);
  const [quantityKg, setQuantityKg] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("credits");
  const [creditsInput, setCreditsInput] = useState<string>("");
  const [isPlacing, setIsPlacing] = useState(false);

  const listings = listingsQuery.data;
  const balance = balanceQuery.data;

  // The most recent season is the one a farmer spends from first, so it is the
  // token the marketplace quotes and reads on-chain.
  const activeSeason = balance?.seasonTokenIds?.[0] ?? null;
  const { balance: onChainBalance, isLoading: isChainBalanceLoading } = useOnChainCreditBalance(
    activeSeason?.tokenId
  );

  const ledgerBalance = balance?.ledgerBalanceCredits ?? 0;
  /**
   * The chain is authoritative when it can be read: a farmer cannot transfer
   * credits they no longer hold, whatever the ledger thinks. Falling back to
   * the ledger keeps the screen usable before a wallet is connected.
   */
  const spendableCredits = onChainBalance ?? ledgerBalance;

  const quantity = Number(quantityKg);
  const isQuantityValid = Number.isInteger(quantity) && quantity > 0;

  const isOrganic = Boolean(selectedListing?.isOrganic);
  const acceptsCredits = Boolean(selectedListing?.isSubsidyEligible);

  /** Credits the full quantity is worth — the ceiling on what may be spent. */
  const fullCreditCost = useMemo(
    () => (isQuantityValid && selectedListing ? creditsRequired(quantity, isOrganic) : 0),
    [isQuantityValid, quantity, isOrganic, selectedListing]
  );

  /**
   * The live breakdown, mirroring the server's `CreditMath` exactly. The server
   * re-derives all of it on POST — this is a preview, never the binding total.
   */
  const breakdown = useMemo(() => {
    if (!selectedListing || !isQuantityValid) {
      return { creditsUsed: 0, kgFromCredits: 0, kgInCash: 0, cashLkr: 0 };
    }

    let creditsUsed = 0;
    if (acceptsCredits) {
      if (paymentMode === "credits") {
        // Never propose more credits than the farmer actually holds.
        creditsUsed = Math.min(fullCreditCost, spendableCredits);
      } else if (paymentMode === "mixed") {
        const requested = Number(creditsInput);
        creditsUsed = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 0;
        creditsUsed = Math.min(creditsUsed, fullCreditCost, spendableCredits);
      }
    }

    const kgFromCredits = Math.min(quantity, kgCoveredByCredits(creditsUsed, isOrganic));
    const kgInCash = quantity - kgFromCredits;

    return {
      creditsUsed,
      kgFromCredits,
      kgInCash,
      cashLkr: kgInCash * selectedListing.priceLkrPerKg,
    };
  }, [
    selectedListing,
    isQuantityValid,
    acceptsCredits,
    paymentMode,
    creditsInput,
    fullCreditCost,
    spendableCredits,
    quantity,
    isOrganic,
  ]);

  const exceedsStock = Boolean(selectedListing && isQuantityValid && quantity > selectedListing.availableKg);

  const canOrder = Boolean(
    selectedListing &&
      isQuantityValid &&
      !exceedsStock &&
      !isPlacing &&
      // A credit order needs somewhere for the credits to land at handover.
      (breakdown.creditsUsed === 0 || selectedListing.sellerWallet)
  );

  const openListing = (listing: ProductListing) => {
    setSelectedListing(listing);
    setQuantityKg("");
    setCreditsInput("");
    setPaymentMode(listing.isSubsidyEligible ? "credits" : "cash");
  };

  const closeListing = useCallback(() => {
    setSelectedListing(null);
    setQuantityKg("");
    setCreditsInput("");
  }, []);

  const handlePlaceOrder = async () => {
    if (!canOrder || !selectedListing) return;

    setIsPlacing(true);
    const toastId = toast.loading("Placing your order...");

    try {
      await axiosInstance.post(apiPaths.orders.place, {
        listingId: selectedListing.listingId,
        quantityKg: quantity,
        creditsUsed: breakdown.creditsUsed,
      });

      toast.dismiss(toastId);
      toast.success("Order placed - no credits have moved yet.", {
        description:
          "The seller will prepare your goods. Your credits only transfer when you confirm at collection.",
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      closeListing();
      await Promise.all([listingsQuery.refetch(), ordersQuery.refetch(), balanceQuery.refetch()]);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Could not place the order.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">Marketplace</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Buy fertilizer from registered dealers and organic producers with your subsidy credits.
          </p>
        </div>

        {/* ─── Credit balance, front and centre ─────────────────────────── */}
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="pt-6">
            {balanceQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-56" />
                <Skeleton className="h-4 w-72" />
              </div>
            ) : balanceQuery.error ? (
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium">{balanceQuery.error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => balanceQuery.refetch()}
                    className="mt-2"
                  >
                    Try again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/15 text-primary rounded-2xl">
                    <CoinsIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Your subsidy credits
                    </p>
                    <p className="text-4xl font-bold text-foreground tabular-nums">
                      {isChainBalanceLoading && onChainBalance === null ? (
                        <span className="inline-flex items-center gap-2 text-2xl">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Reading wallet…
                        </span>
                      ) : (
                        spendableCredits.toLocaleString()
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeSeason
                        ? `${activeSeason.season} · credit token TK-${activeSeason.tokenId}`
                        : "No credits issued to you yet"}
                    </p>
                    {onChainBalance !== null && onChainBalance !== ledgerBalance && (
                      // Divergence is worth saying out loud: it means credits
                      // moved somewhere the marketplace never recorded.
                      <p className="text-xs text-muted-foreground mt-2">
                        Registry expects {formatCredits(ledgerBalance)} - your wallet holds{" "}
                        {formatCredits(onChainBalance)}.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-[9rem]">
                    <p className="text-xs text-muted-foreground">Issued to date</p>
                    <p className="text-xl font-semibold text-foreground tabular-nums">
                      {(balance?.totalIssuedCredits ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-4 py-3 min-w-[9rem]">
                    <p className="text-xs text-muted-foreground">Spent on orders</p>
                    <p className="text-xl font-semibold text-foreground tabular-nums">
                      {(balance?.spentCredits ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-primary/20 flex items-start gap-2">
              <Leaf className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Organic: 1 credit covers 1.5kg</strong> - the same
                credit buys only 1kg of chemical fertilizer. 30kg of organic costs 20 credits.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ─── Filters ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex flex-col gap-2 w-full sm:w-64">
            <label htmlFor="organicFilter" className="text-sm font-medium text-muted-foreground">
              Fertilizer kind
            </label>
            <Select
              value={organicFilter}
              onValueChange={(value) => setOrganicFilter((String(value) as OrganicFilter) || "all")}
            >
              <SelectTrigger id="organicFilter" className="w-full h-11 bg-background">
                <SelectValue>
                  {(value) => labelFor(ORGANIC_FILTERS, value, "All products")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ORGANIC_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-64">
            <label htmlFor="subsidyFilter" className="text-sm font-medium text-muted-foreground">
              Payment
            </label>
            <Select
              value={subsidyOnly ? "credits" : "any"}
              onValueChange={(value) => setSubsidyOnly(String(value) === "credits")}
            >
              <SelectTrigger id="subsidyFilter" className="w-full h-11 bg-background">
                <SelectValue>
                  {(value) => labelFor(SUBSIDY_FILTERS, value, "Any payment")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SUBSIDY_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ─── The grid ─────────────────────────────────────────────────── */}
        {listingsQuery.error ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 flex flex-col items-center gap-3 text-center py-12">
              <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-base font-medium text-destructive max-w-md">
                {listingsQuery.error}
              </p>
              <Button variant="outline" size="sm" onClick={() => listingsQuery.refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : listingsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="border-border">
                <CardContent className="pt-6 space-y-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <Card className="border-border">
            <CardContent className="pt-6 flex flex-col items-center gap-2 text-center py-16">
              <div className="p-3 rounded-full bg-muted text-muted-foreground">
                <Store className="w-6 h-6" />
              </div>
              <p className="text-base font-medium text-foreground">Nothing on sale yet</p>
              <p className="text-sm text-muted-foreground max-w-md">
                {organicFilter !== "all" || subsidyOnly
                  ? "No product matches these filters. Try widening them."
                  : "Products appear here once dealers and organic producers publish their listings."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const isSelected = selectedListing?.listingId === listing.listingId;

              return (
                <Card
                  key={listing.listingId}
                  className={`border-border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col ${
                    isSelected ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <CardContent className="pt-6 flex flex-col flex-grow gap-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground">{listing.productName}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {listing.sellerName ?? "Registered seller"}
                        </p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-muted/50 border border-border flex items-center justify-center shrink-0">
                        {listing.isOrganic ? (
                          <Sprout className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {listing.isOrganic ? (
                        <Badge variant="success">
                          <Leaf />
                          Organic
                        </Badge>
                      ) : (
                        <Badge variant="muted">Chemical</Badge>
                      )}
                      <Badge variant="outline">{listing.fertilizerType}</Badge>
                      {listing.isSubsidyEligible ? (
                        <Badge variant="info">
                          <CoinsIcon />1 credit = {listing.kgPerCredit}kg
                        </Badge>
                      ) : (
                        <Badge variant="warning">Cash only</Badge>
                      )}
                    </div>

                    {listing.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {listing.description}
                      </p>
                    )}

                    <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-2 gap-3 mt-auto">
                      <div>
                        <span className="text-muted-foreground block text-xs">Price</span>
                        <span className="text-sm font-semibold text-foreground">
                          {formatLkr(listing.priceLkrPerKg)} / kg
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Available</span>
                        <span className="text-sm font-semibold text-foreground">
                          {formatKg(listing.availableKg)}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => openListing(listing)}
                      className="w-full h-11 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {isSelected ? "Editing order" : "Order this"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ─── Order builder ────────────────────────────────────────────── */}
        {selectedListing && (
          <Card className="border-primary/40 shadow-md">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Order {selectedListing.productName}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    from {selectedListing.sellerName ?? "the seller"} ·{" "}
                    {formatLkr(selectedListing.priceLkrPerKg)} per kg ·{" "}
                    {formatKg(selectedListing.availableKg)} available
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeListing}
                  className="text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="quantityKg" className="block text-sm font-medium text-foreground">
                      Quantity (kg) <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="quantityKg"
                      type="number"
                      min="1"
                      step="1"
                      value={quantityKg}
                      onChange={(event) => setQuantityKg(event.target.value)}
                      placeholder="e.g. 30"
                      disabled={isPlacing}
                      className="h-11 bg-background"
                    />
                    {exceedsStock && (
                      <p className="text-xs text-destructive">
                        Only {formatKg(selectedListing.availableKg)} is available.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="paymentMode" className="block text-sm font-medium text-foreground">
                      How you&apos;ll pay
                    </label>
                    <Select
                      value={paymentMode}
                      onValueChange={(value) => setPaymentMode((String(value) as PaymentMode) || "cash")}
                      disabled={isPlacing || !acceptsCredits}
                    >
                      <SelectTrigger id="paymentMode" className="w-full h-11 bg-background">
                        <SelectValue>
                          {(value) => labelFor(PAYMENT_MODES, value, "Choose payment")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!acceptsCredits && (
                      <p className="text-xs text-muted-foreground">
                        This seller does not accept subsidy credits.
                      </p>
                    )}
                  </div>

                  {paymentMode === "mixed" && acceptsCredits && (
                    <div className="space-y-2">
                      <label htmlFor="creditsInput" className="block text-sm font-medium text-foreground">
                        Credits to spend
                      </label>
                      <Input
                        id="creditsInput"
                        type="number"
                        min="0"
                        step="1"
                        max={Math.min(fullCreditCost, spendableCredits)}
                        value={creditsInput}
                        onChange={(event) => setCreditsInput(event.target.value)}
                        placeholder="0"
                        disabled={isPlacing}
                        className="h-11 bg-background"
                      />
                      <p className="text-xs text-muted-foreground">
                        Up to {Math.min(fullCreditCost, spendableCredits).toLocaleString()} for this
                        order. The rest is paid in cash.
                      </p>
                    </div>
                  )}
                </div>

                {/* Live breakdown */}
                <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Cost breakdown</p>

                  {!isQuantityValid ? (
                    <p className="text-sm text-muted-foreground">
                      Enter a quantity to see what this costs.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="text-foreground tabular-nums">{formatKg(quantity)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Full credit cost{isOrganic ? " (1 credit = 1.5kg)" : " (1 credit = 1kg)"}
                        </span>
                        <span className="text-foreground tabular-nums">
                          {fullCreditCost.toLocaleString()}
                        </span>
                      </div>

                      <div className="h-px bg-border my-1" />

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid with credits</span>
                        <span className="text-foreground tabular-nums font-semibold">
                          {breakdown.creditsUsed.toLocaleString()} → {formatKg(breakdown.kgFromCredits)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid in cash</span>
                        <span className="text-foreground tabular-nums font-semibold">
                          {formatLkr(breakdown.cashLkr)} → {formatKg(breakdown.kgInCash)}
                        </span>
                      </div>

                      <div className="h-px bg-border my-1" />

                      <div className="flex justify-between text-base pt-1">
                        <span className="font-semibold text-foreground">Credits remaining after</span>
                        <span className="font-bold text-foreground tabular-nums">
                          {(spendableCredits - breakdown.creditsUsed).toLocaleString()}
                        </span>
                      </div>

                      {isOrganic && (
                        <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 mt-2">
                          <Leaf className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <p className="text-xs text-primary">
                            Organic advantage: the same {fullCreditCost.toLocaleString()} credits would
                            buy only {formatKg(fullCreditCost)} of chemical fertilizer.
                          </p>
                        </div>
                      )}

                      {breakdown.cashLkr > 0 && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Cash is settled directly with the seller - BhumiSaara records the amount
                          but never processes a payment.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Confirmation contract, stated before they commit */}
              <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 flex items-start gap-3">
                <Wallet className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">No credits move now.</strong> Your credits stay
                  in your wallet until you confirm collection from your orders screen - the seller
                  cannot take them.
                </p>
              </div>

              {breakdown.creditsUsed > 0 && !selectedListing.sellerWallet && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  This seller has not linked a wallet, so credits cannot be sent to them yet.
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={!canOrder}
                  className="h-12 px-8 text-sm font-semibold shadow-md hover:shadow-lg rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isPlacing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Placing order...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Place order
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
