"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { mintTo, mintAdditionalSupplyTo } from "thirdweb/extensions/erc1155";
import { waitForReceipt } from "thirdweb";
import { contract } from "@/lib/contract";
import { client } from "@/lib/thirdwebClient";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatDateTime, truncateAddress } from "@/utils/formatters";
import { formatCredits } from "@/lib/marketplace";
import type { EligibleFarmer } from "@/lib/marketplace";
import { useCreditSeasons, useEligibleFarmers, useCreditIssuances } from "@/hooks/use-credits";
import TxHashBadge from "@/components/goverment/TxHashBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarRange,
  CheckCircle,
  CoinsIcon,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";

/** Snapshot taken before the wallet is asked to sign — see handleIssue. */
interface PendingIssuance {
  farmerId: number;
  farmerName: string;
  season: string;
  creditsKg: number;
  /** Null when this mint creates the season's token; read from the receipt after. */
  tokenId: string | null;
}

const DEFAULT_CREDITS = 250;

/**
 * Wallet UIs drop any token whose metadata carries no image, so a credit minted
 * with only a name would be invisible in the farmer's wallet. This also puts
 * the season on the token itself, which is what makes one season's credits
 * distinguishable from another's on-chain.
 */
const buildCreditImage = (season: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#1e3a8a"/>
<text x="200" y="140" font-family="sans-serif" font-size="26" fill="#bfdbfe" text-anchor="middle">BhumiSaara</text>
<text x="200" y="215" font-family="sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">SUBSIDY</text>
<text x="200" y="262" font-family="sans-serif" font-size="34" fill="#ffffff" text-anchor="middle">CREDIT</text>
<text x="200" y="320" font-family="sans-serif" font-size="26" fill="#bfdbfe" text-anchor="middle">${season}</text>
</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Parses the token id out of an ERC-1155 TransferSingle log — the same shape
 * MintBatchForm reads, because it is the same event.
 */
const extractTokenId = (receipt: { logs?: { topics?: string[]; data?: string }[] }): number | null => {
  const TRANSFER_SINGLE_TOPIC =
    "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";

  try {
    for (const log of receipt?.logs ?? []) {
      if (log.topics?.[0]?.toLowerCase() === TRANSFER_SINGLE_TOPIC) {
        const dataHex = (log.data || "").replace(/^0x/, "");
        if (dataHex.length >= 64) {
          const parsed = parseInt(dataHex.slice(0, 64), 16);
          if (!Number.isNaN(parsed) && Number.isSafeInteger(parsed)) {
            return parsed;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Could not parse tokenId from log data:", error);
  }

  return null;
};

export default function CreditIssuance() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const seasonsQuery = useCreditSeasons();
  const issuancesQuery = useCreditIssuances();

  const [season, setSeason] = useState<string>("");
  const [selectedFarmerId, setSelectedFarmerId] = useState<number | null>(null);
  const [creditsKg, setCreditsKg] = useState<string>(String(DEFAULT_CREDITS));
  const [isSaving, setIsSaving] = useState(false);

  const farmersQuery = useEligibleFarmers(season || null);

  /**
   * Frozen at the moment the transaction is prepared. The mint and the backend
   * write are seconds apart and the form stays editable while the wallet dialog
   * is open — same approach as OfficerDistribution and HandoverForm.
   */
  const pendingIssuanceRef = useRef<PendingIssuance | null>(null);

  const farmers = farmersQuery.data;
  const issuances = issuancesQuery.data;

  /**
   * The token id this season already mints under, if any.
   *
   * Every farmer in a season shares one token, which is what makes the season's
   * credits fungible between them. The first issuance creates it; every later
   * one adds supply to it. The backend rejects a mismatch either way.
   */
  const seasonTokenId = useMemo(() => {
    if (!season) return null;
    return issuances.find((issuance) => issuance.season === season)?.tokenId ?? null;
  }, [issuances, season]);

  const seasonIssuances = useMemo(
    () => issuances.filter((issuance) => issuance.season === season),
    [issuances, season]
  );

  const seasonIssuedCredits = useMemo(
    () => seasonIssuances.reduce((total, issuance) => total + issuance.creditsKg, 0),
    [seasonIssuances]
  );

  const selectedFarmer = useMemo(
    () => farmers.find((farmer) => farmer.farmerId === selectedFarmerId) ?? null,
    [farmers, selectedFarmerId]
  );

  const loadData = useCallback(async () => {
    await Promise.all([farmersQuery.refetch(), issuancesQuery.refetch()]);
  }, [farmersQuery, issuancesQuery]);

  const parsedCredits = Number(creditsKg);
  const isCreditsValid = Number.isInteger(parsedCredits) && parsedCredits > 0;

  const canIssue = Boolean(
    account &&
      season &&
      selectedFarmer?.canIssue &&
      selectedFarmer?.walletAddress &&
      isCreditsValid &&
      !isSaving &&
      !isTxPending
  );

  const handleSelectFarmer = (farmer: EligibleFarmer) => {
    if (!farmer.canIssue) return;
    setSelectedFarmerId(farmer.farmerId);
  };

  const selectSeason = (value: string) => {
    setSeason(value);
    setSelectedFarmerId(null);
  };

  /** Writes the confirmed mint to the backend and refreshes the queue. */
  const recordIssuance = async (transactionHash: string, tokenId: string) => {
    const pending = pendingIssuanceRef.current;
    if (!pending) return;

    setIsSaving(true);
    const toastId = toast.loading("Recording the issuance with the registry...");

    try {
      await axiosInstance.post(apiPaths.credits.issue, {
        farmerId: pending.farmerId,
        season: pending.season,
        creditsKg: pending.creditsKg,
        tokenId,
        transactionHash,
      });

      toast.dismiss(toastId);
      toast.success("Subsidy credits issued.", {
        description: `${formatCredits(pending.creditsKg)} → ${pending.farmerName} for ${pending.season}`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      pendingIssuanceRef.current = null;
      setSelectedFarmerId(null);
      await loadData();
    } catch (error) {
      toast.dismiss(toastId);
      // The credits already exist on-chain. Losing this hash would leave an
      // issuance nobody can reconcile, so it stays on screen until dismissed.
      toast.error("Credits minted on-chain, but the registry save failed.", {
        description: `Record this transaction hash manually: ${transactionHash} (token ${tokenId}) - ${describeApiError(
          error,
          "Please check server connection."
        )}`,
        duration: Infinity,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleIssue = async () => {
    if (!canIssue || !account || !selectedFarmer?.walletAddress) return;

    // Snapshot BEFORE the wallet is asked to sign.
    pendingIssuanceRef.current = {
      farmerId: selectedFarmer.farmerId,
      farmerName: selectedFarmer.farmerName,
      season,
      creditsKg: parsedCredits,
      tokenId: seasonTokenId,
    };

    try {
      // A season's first issuance creates its token; every later one adds
      // supply to that same token so the credits stay fungible.
      const transaction = seasonTokenId
        ? mintAdditionalSupplyTo({
            contract,
            to: selectedFarmer.walletAddress,
            tokenId: BigInt(seasonTokenId),
            supply: BigInt(parsedCredits),
          })
        : mintTo({
            contract,
            to: selectedFarmer.walletAddress,
            supply: BigInt(parsedCredits),
            nft: {
              name: `BhumiSaara Subsidy Credit - ${season}`,
              description:
                `Subsidy credit for ${season}. One credit entitles the holder to 1kg of ` +
                `chemical fertilizer or 1.5kg of organic fertilizer. Backed by the treasury, not by stock.`,
              image: buildCreditImage(season),
            },
          });

      const txResult = await sendTransaction(transaction);

      const receipt = await waitForReceipt({
        client,
        chain: contract.chain,
        transactionHash: txResult.transactionHash,
      });

      // On a first issuance the id only exists once the receipt is in.
      const mintedTokenId = seasonTokenId ?? extractTokenId(receipt)?.toString() ?? null;

      if (!mintedTokenId) {
        toast.error("Credits minted, but the token id could not be read.", {
          description: `Record this transaction hash manually: ${receipt.transactionHash}`,
          duration: Infinity,
          icon: <AlertCircle className="w-5 h-5 text-destructive" />,
        });
        pendingIssuanceRef.current = null;
        return;
      }

      await recordIssuance(receipt.transactionHash, mintedTokenId);
    } catch (error) {
      pendingIssuanceRef.current = null;
      console.error("Credit Mint Transaction Error:", error);
      toast.error("Blockchain credit mint failed.", {
        description: describeApiError(error, "User denied or transaction reverted."),
      });
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Issue Subsidy Credits</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Fund a season&apos;s budget by minting credits straight to farmers&apos; wallets.
            </p>
          </div>
          {!account && (
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm font-medium rounded-full border border-destructive/20 w-fit">
              <Wallet className="w-4 h-4" />
              Connect a wallet to issue
            </div>
          )}
        </div>

        {/* What a credit is — the distinction this whole screen turns on. */}
        <div className="rounded-xl border border-border bg-muted/30 px-6 py-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Subsidy credits are not stock tokens.</strong> A
            credit is a claim on the treasury, backed by no fertilizer in any warehouse. One credit
            entitles a farmer to <strong className="text-foreground">1kg of chemical</strong> or{" "}
            <strong className="text-foreground">1.5kg of organic</strong> fertilizer from a
            marketplace seller.
          </p>
        </div>

        {/* ─── Stage 1: pick the season ─────────────────────────────────── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
                1
              </span>
              <CalendarRange className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-xl font-semibold text-foreground">Select a Season</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 max-w-xl">
              <label htmlFor="season" className="text-sm font-medium text-muted-foreground">
                Season to fund
              </label>
              <Select
                value={season}
                onValueChange={(value) => selectSeason(value ? String(value) : "")}
                disabled={isSaving || isTxPending || seasonsQuery.isLoading}
              >
                <SelectTrigger id="season" className="w-full h-12 bg-background">
                  <SelectValue placeholder="Choose a season" />
                </SelectTrigger>
                <SelectContent>
                  {seasonsQuery.data.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!seasonsQuery.isLoading && seasonsQuery.data.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No seasons exist yet - a season appears once a farmer files a fertilizer request
                  against it.
                </p>
              )}
            </div>

            {season && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Credit token</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {seasonTokenId ? `TK-${seasonTokenId}` : "Not created yet"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Farmers funded</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {seasonIssuances.length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Credits issued this season</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {formatCredits(seasonIssuedCredits)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Stage 2: pick the farmer ─────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
              2
            </span>
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Eligible Farmers</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Area</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Wallet</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!season ? (
                  <TableEmptyState
                    columns={4}
                    icon={CalendarRange}
                    title="Select a season first"
                    description="Farmers are listed against the season you are funding."
                  />
                ) : farmersQuery.error ? (
                  <TableErrorState
                    columns={4}
                    message={farmersQuery.error}
                    onRetry={() => farmersQuery.refetch()}
                  />
                ) : farmersQuery.isLoading ? (
                  <TableSkeletonRows columns={4} />
                ) : farmers.length === 0 ? (
                  <TableEmptyState
                    columns={4}
                    icon={Users}
                    title="No farmers registered yet"
                    description="Credits can only be issued to accounts holding the Farmer role."
                  />
                ) : (
                  farmers.map((farmer) => {
                    const isSelected = farmer.farmerId === selectedFarmerId;

                    return (
                      <TableRow
                        key={farmer.farmerId}
                        onClick={() => handleSelectFarmer(farmer)}
                        aria-disabled={!farmer.canIssue}
                        className={`border-border transition-colors ${
                          farmer.canIssue
                            ? "cursor-pointer hover:bg-muted/30"
                            : "opacity-60 cursor-not-allowed"
                        } ${isSelected ? "bg-primary/10 hover:bg-primary/10" : ""}`}
                      >
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{farmer.farmerName}</span>
                            {farmer.fullName && (
                              <span className="text-xs text-muted-foreground">{farmer.fullName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-muted-foreground">
                          {farmer.areaName ? `${farmer.areaName}, ${farmer.district ?? ""}` : "-"}
                        </TableCell>
                        <TableCell className="py-4 px-6 font-mono text-xs text-muted-foreground">
                          {farmer.walletAddress ? (
                            truncateAddress(farmer.walletAddress)
                          ) : (
                            <span className="text-destructive">Not linked</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {farmer.alreadyIssued ? (
                            <Badge variant="success">
                              <CheckCircle />
                              {formatCredits(farmer.issuedCreditsKg ?? 0)} issued
                            </Badge>
                          ) : farmer.walletAddress ? (
                            <Badge variant="info">Ready to fund</Badge>
                          ) : (
                            <Badge variant="warning">Wallet required</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ─── Stage 3: amount + mint ───────────────────────────────────── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
                3
              </span>
              <CoinsIcon className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-xl font-semibold text-foreground">
                Credits to Issue
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {!selectedFarmer ? (
              <p className="text-sm text-muted-foreground">
                Select a farmer above to issue this season&apos;s credits.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2 max-w-xs">
                  <label htmlFor="creditsKg" className="text-sm font-medium text-foreground">
                    Credits <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="creditsKg"
                    type="number"
                    min="1"
                    step="1"
                    value={creditsKg}
                    onChange={(event) => setCreditsKg(event.target.value)}
                    disabled={isSaving || isTxPending}
                    className="h-11 bg-background"
                  />
                  {!isCreditsValid && creditsKg !== "" && (
                    <p className="text-xs text-destructive">
                      Credits must be a whole number greater than zero.
                    </p>
                  )}
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl px-6 py-4 space-y-1">
                  <p className="text-base text-foreground">
                    Minting <strong>{formatCredits(isCreditsValid ? parsedCredits : 0)}</strong> to{" "}
                    <strong>{selectedFarmer.farmerName}</strong> for{" "}
                    <strong>{season}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {selectedFarmer.walletAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {seasonTokenId
                      ? `Adding supply to this season's existing credit token TK-${seasonTokenId}.`
                      : "This is the season's first issuance - it creates the credit token."}
                  </p>
                </div>
              </>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
              <p className="text-sm text-muted-foreground">
                A farmer receives one issuance per season. Re-issuing is refused by the registry.
              </p>
              <Button
                type="button"
                onClick={handleIssue}
                disabled={!canIssue}
                className="h-12 px-8 text-sm font-semibold shadow-md hover:shadow-lg rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isTxPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming in Wallet...
                  </>
                ) : isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recording Issuance...
                  </>
                ) : (
                  <>
                    <CoinsIcon className="w-4 h-4" />
                    Issue Credits
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Issuance ledger ──────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Issuance Ledger</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Every subsidy credit the treasury has ever minted, newest first.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Season</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Credits</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Token</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Issued</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issuancesQuery.error ? (
                  <TableErrorState
                    columns={6}
                    message={issuancesQuery.error}
                    onRetry={() => issuancesQuery.refetch()}
                  />
                ) : issuancesQuery.isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : issuances.length === 0 ? (
                  <TableEmptyState
                    columns={6}
                    icon={CoinsIcon}
                    title="No credits issued yet"
                    description="Fund a season above and the issuance appears here."
                  />
                ) : (
                  issuances.map((issuance) => (
                    <TableRow key={issuance.issuanceId} className="border-border group">
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        {issuance.farmerName ?? `Farmer #${issuance.farmerId}`}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {issuance.season}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                        {issuance.creditsKg.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="info">Credit · TK-{issuance.tokenId}</Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground text-sm">
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
