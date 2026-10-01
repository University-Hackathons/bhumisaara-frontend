"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { burn, getOwnedNFTs } from "thirdweb/extensions/erc1155";
import { waitForReceipt } from "thirdweb";
import { contract } from "@/lib/contract";
import { client } from "@/lib/thirdwebClient";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatKg, truncateAddress } from "@/utils/formatters";
import { useBatches } from "@/hooks/use-batches";
import { usePendingCollections } from "@/hooks/use-pending-collections";
import type { PendingCollection, SackValidation } from "@/lib/distribution";
import { ScanField } from "@/components/goverment/QrScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
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
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  Flame,
  Loader2,
  Package,
  Trash2,
  User,
  Wallet,
} from "lucide-react";

interface ScannedSack {
  serial: string;
  weightKg: number;
}

/** Snapshot taken before the wallet is asked to sign — see handleBurn. */
interface PendingHandover {
  requestId: number;
  batchId: number;
  tokenId: string;
  amountDispensedKg: number;
  sackSerials: string[];
  farmerWallet: string;
  farmerName: string;
}

const SACK_WEIGHT_KG = 50;
const SERIAL_PATTERN = /[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/;
const ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/;

/** A sack QR may carry a URL or prefix; the serial itself is what matters. */
const extractSerial = (scanned: string) => {
  const normalised = scanned.trim().toUpperCase();
  return SERIAL_PATTERN.exec(normalised)?.[0] ?? normalised;
};

/** Wallet QRs are often `ethereum:0x…@80002` rather than a bare address. */
const extractAddress = (scanned: string) => ADDRESS_PATTERN.exec(scanned.trim())?.[0] ?? scanned.trim();

const parseTokenId = (tokenId: string | undefined): bigint | null => {
  if (!tokenId) return null;
  try {
    return BigInt(tokenId);
  } catch {
    return null;
  }
};

export default function HandoverForm() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const collectionsQuery = usePendingCollections();
  const batchesQuery = useBatches();

  const collections = collectionsQuery.data;
  const batches = batchesQuery.data;
  const isLoading = collectionsQuery.isLoading || batchesQuery.isLoading;
  const loadError = collectionsQuery.error ?? batchesQuery.error;

  // Stage 1
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  // Stage 2
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [scannedSacks, setScannedSacks] = useState<ScannedSack[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Stage 3
  const [walletConfirmed, setWalletConfirmed] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [scannedWallet, setScannedWallet] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  /**
   * Frozen at the moment the burn is prepared. The chain call and the backend
   * write are seconds apart, and the form stays editable while the wallet
   * dialog is open — the backend must be told what was actually burned.
   */
  const pendingHandoverRef = useRef<PendingHandover | null>(null);

  const loadData = useCallback(async () => {
    await Promise.all([collectionsQuery.refetch(), batchesQuery.refetch()]);
  }, [collectionsQuery, batchesQuery]);

  /**
   * Only the stock actually sitting in this officer's wallet. getNFTs would
   * list every token on the contract, including batches held by the ministry
   * or by other officers.
   */
  const { data: ownedNfts, isLoading: isOwnedLoading } = useReadContract(getOwnedNFTs, {
    contract,
    address: account?.address ?? "0x0000000000000000000000000000000000000000",
    queryOptions: { enabled: Boolean(account?.address) },
  });

  const ownedByTokenId = useMemo(() => {
    const map = new Map<string, bigint>();
    (ownedNfts ?? []).forEach((nft) => {
      const owned = (nft as { quantityOwned?: bigint }).quantityOwned;
      map.set(nft.id.toString(), owned ?? BigInt(0));
    });
    return map;
  }, [ownedNfts]);

  const selectedCollection = useMemo(
    () => collections.find((row) => row.requestId === selectedRequestId) ?? null,
    [collections, selectedRequestId]
  );

  /** Batches held on-chain by this officer, of the type the farmer was approved for. */
  const eligibleBatches = useMemo(() => {
    if (!selectedCollection) return [];

    return batches.filter((batch) => {
      const typeMatches =
        batch.fertilizerType?.toLowerCase() === selectedCollection.fertilizerType?.toLowerCase();
      const owned = ownedByTokenId.get(String(batch.tokenId)) ?? BigInt(0);
      return typeMatches && owned > BigInt(0);
    });
  }, [batches, selectedCollection, ownedByTokenId]);

  const selectedBatch = useMemo(
    () => eligibleBatches.find((batch) => String(batch.batchId) === selectedBatchId) ?? null,
    [eligibleBatches, selectedBatchId]
  );

  const tokenId = useMemo(() => parseTokenId(selectedBatch?.tokenId), [selectedBatch]);

  const ownedKg = useMemo(() => {
    if (!selectedBatch) return null;
    return Number(ownedByTokenId.get(String(selectedBatch.tokenId)) ?? BigInt(0));
  }, [selectedBatch, ownedByTokenId]);

  const scannedKg = useMemo(
    () => scannedSacks.reduce((total, sack) => total + sack.weightKg, 0),
    [scannedSacks]
  );

  const targetKg = selectedCollection?.remainingKg ?? 0;
  const targetSackCount = Math.ceil(targetKg / SACK_WEIGHT_KG);
  const exceedsOwnedBalance = ownedKg !== null && scannedKg > ownedKg;

  const resetScanState = useCallback(() => {
    setScannedSacks([]);
    setWalletConfirmed(false);
    setWalletError(null);
    setScannedWallet(null);
  }, []);

  const selectBatch = useCallback((batchId: string) => {
    setSelectedBatchId(batchId);
    setScannedSacks([]);
  }, []);

  const handleSelectRow = (row: PendingCollection) => {
    if (!row.farmerWallet) return;

    setSelectedRequestId(row.requestId);
    selectBatch("");
    resetScanState();
  };

  /**
   * Every scan is validated server-side: the officer's client cannot know
   * whether a sack was already spent in an earlier handover, and its exact
   * rejection reason is what the officer needs to hear.
   */
  const handleSackScan = async (scanned: string) => {
    const serial = extractSerial(scanned);

    if (!selectedCollection) {
      toast.error("Select a farmer before scanning sacks.");
      return;
    }
    if (!selectedBatch) {
      toast.error("Select a batch before scanning sacks.");
      return;
    }
    if (scannedSacks.some((sack) => sack.serial === serial)) {
      toast.error("Sack already scanned.", {
        description: `${serial} is already in this handover.`,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    // The backend rejects an over-scan too (requireWithinApproval), but that
    // costs a round trip; once the farmer's remaining approval is already
    // covered, refuse locally instead of firing a validate-sack call that can
    // only come back rejected.
    if (scannedKg >= targetKg) {
      toast.error("Approved amount already fully covered.", {
        description: `${selectedCollection.farmerName} has ${formatKg(targetKg)} remaining - scanning ${serial} would exceed it.`,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    setIsValidating(true);

    try {
      const response = await axiosInstance.post<SackValidation>(apiPaths.distributions.validateSack, {
        sackSerial: serial,
        requestId: selectedCollection.requestId,
        alreadyScannedKg: scannedKg,
      });

      const validated = response.data;

      if (validated.batchId !== selectedBatch.batchId) {
        toast.error("Sack belongs to a different batch.", {
          description: `${serial} is from batch #${validated.batchId}; you are dispensing from batch #${selectedBatch.batchId}.`,
          icon: <AlertCircle className="w-5 h-5 text-destructive" />,
        });
        return;
      }

      setScannedSacks((current) => [
        ...current,
        { serial: validated.sackSerial, weightKg: validated.weightKg },
      ]);
    } catch (error) {
      toast.error("Sack rejected.", {
        description: describeApiError(error, "Could not validate this sack."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveSerial = (serial: string) => {
    setScannedSacks((current) => current.filter((sack) => sack.serial !== serial));
  };

  const handleWalletScan = (scanned: string) => {
    const address = extractAddress(scanned);
    setScannedWallet(address);

    const expected = selectedCollection?.farmerWallet;

    if (!expected) {
      setWalletConfirmed(false);
      setWalletError("This farmer has no linked wallet.");
      return;
    }

    if (address.toLowerCase() !== expected.toLowerCase()) {
      setWalletConfirmed(false);
      setWalletError(
        `Scanned wallet does not match ${selectedCollection?.farmerName ?? "the farmer"}'s registered address.`
      );
      toast.error("Wallet mismatch: this is not the approved farmer.", {
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    setWalletConfirmed(true);
    setWalletError(null);
    toast.success("Farmer wallet confirmed.", {
      icon: <CheckCircle className="w-5 h-5 text-primary" />,
    });
  };

  const canBurn = Boolean(
    account &&
      selectedCollection?.farmerWallet &&
      selectedBatch &&
      tokenId !== null &&
      scannedSacks.length > 0 &&
      walletConfirmed &&
      !exceedsOwnedBalance &&
      !isSaving &&
      !isTxPending &&
      !isValidating
  );

  /** Writes the confirmed handover to the backend and refreshes the queue. */
  const recordHandover = async (burnTransactionHash: string) => {
    const pending = pendingHandoverRef.current;
    if (!pending) return;

    setIsSaving(true);
    const toastId = toast.loading("Recording handover with the registry...");

    try {
      await axiosInstance.post(apiPaths.distributions.record, {
        requestId: pending.requestId,
        batchId: pending.batchId,
        tokenId: pending.tokenId,
        amountDispensedKg: pending.amountDispensedKg,
        burnTransactionHash,
        sackSerials: pending.sackSerials,
        farmerWallet: pending.farmerWallet,
      });

      toast.dismiss(toastId);
      toast.success("Handover recorded successfully!", {
        description: `${pending.amountDispensedKg}kg · ${pending.sackSerials.length} sacks → ${pending.farmerName}`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      pendingHandoverRef.current = null;
      resetScanState();
      selectBatch("");
      setSelectedRequestId(null);
      await loadData();
    } catch (error) {
      toast.dismiss(toastId);
      // The tokens are already burned. Losing this hash would leave a handover
      // nobody can reconcile, so it stays on screen until dismissed.
      toast.error("Tokens burned, but the registry save failed.", {
        description: `Record this transaction hash manually: ${burnTransactionHash} - ${describeApiError(
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

  const handleBurn = async () => {
    if (!canBurn || !account || !selectedBatch || !selectedCollection || tokenId === null) return;

    const farmerWallet = selectedCollection.farmerWallet;
    if (!farmerWallet) return;

    // Snapshot BEFORE the wallet is asked to sign.
    pendingHandoverRef.current = {
      requestId: selectedCollection.requestId,
      batchId: selectedBatch.batchId,
      tokenId: selectedBatch.tokenId,
      amountDispensedKg: scannedKg,
      sackSerials: scannedSacks.map((sack) => sack.serial),
      farmerWallet,
      farmerName: selectedCollection.farmerName,
    };

    try {
      // Burned straight from the officer's own balance — the farmer never
      // holds the token, they are the recipient of record in Postgres.
      const transaction = burn({
        contract,
        account: account.address,
        id: tokenId,
        value: BigInt(scannedKg),
      });

      const txResult = await sendTransaction(transaction);

      const receipt = await waitForReceipt({
        client,
        chain: contract.chain,
        transactionHash: txResult.transactionHash,
      });

      await recordHandover(receipt.transactionHash);
    } catch (error) {
      pendingHandoverRef.current = null;
      console.error("Burn Transaction Error:", error);
      toast.error("Blockchain burn transaction failed.", {
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
            <h1 className="text-3xl font-bold text-primary">Digital Handover</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Dispense approved fertilizer to farmers in your area and burn the matching tokens.
            </p>
          </div>
          {!account && (
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm font-medium rounded-full border border-destructive/20 w-fit">
              <Wallet className="w-4 h-4" />
              Connect a wallet to dispense
            </div>
          )}
        </div>

        {/* A failed load is surfaced inside the queue table rather than
            replacing the page, so the stage layout never jumps around. */}
        <>
          <>
            {/* ─── Stage 1: pick the farmer ───────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  1
                </span>
                <User className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">Pending Collections</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Type</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Approved</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Collected</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Remaining</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Wallet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadError ? (
                      <TableErrorState columns={6} message={loadError} onRetry={loadData} />
                    ) : isLoading ? (
                      <TableSkeletonRows columns={6} rows={3} />
                    ) : collections.length === 0 ? (
                      <TableEmptyState
                        columns={6}
                        icon={User}
                        title="No collections waiting"
                        description="Farmers appear here once you approve their request in the review queue."
                      />
                    ) : (
                      collections.map((row) => {
                        const isSelected = row.requestId === selectedRequestId;
                        const isDisabled = !row.farmerWallet;

                        return (
                          <TableRow
                            key={row.requestId}
                            onClick={() => handleSelectRow(row)}
                            aria-disabled={isDisabled}
                            className={`border-border transition-colors ${
                              isDisabled
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:bg-muted/30"
                            } ${isSelected ? "bg-primary/10 hover:bg-primary/10" : ""}`}
                          >
                            <TableCell className="py-4 px-6 font-medium text-foreground">
                              {row.farmerName}
                            </TableCell>
                            <TableCell className="py-4 px-6">{row.fertilizerType}</TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums">
                              {formatKg(row.approvedKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums text-muted-foreground">
                              {formatKg(row.collectedKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                              {formatKg(row.remainingKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {row.farmerWallet ? (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {truncateAddress(row.farmerWallet)}
                                </span>
                              ) : (
                                <span className="text-xs text-destructive">Farmer wallet not linked</span>
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

            {/* ─── Stage 2: batch + sacks ─────────────────────────────────── */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
                    2
                  </span>
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Choose Batch &amp; Scan Sacks
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {!selectedCollection ? (
                  <p className="text-sm text-muted-foreground">Select a farmer above to begin.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 max-w-xl">
                      <label className="text-sm font-medium text-muted-foreground">
                        Batch in your custody ({selectedCollection.fertilizerType} only)
                      </label>
                      <Select
                        value={selectedBatchId}
                        onValueChange={(value) => selectBatch(value ? String(value) : "")}
                        disabled={isSaving || isTxPending || eligibleBatches.length === 0}
                      >
                        <SelectTrigger className="w-full h-14 bg-background text-base">
                          <SelectValue>
                            {(value) => {
                              const batch = eligibleBatches.find(
                                (item) => String(item.batchId) === String(value ?? "")
                              );
                              return batch
                                ? `${batch.importerName} · TK-${batch.tokenId} · ${Number(
                                    ownedByTokenId.get(String(batch.tokenId)) ?? BigInt(0)
                                  )}kg held`
                                : isOwnedLoading
                                  ? "Reading your wallet..."
                                  : "Choose a batch";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleBatches.map((batch) => (
                            <SelectItem key={batch.batchId} value={String(batch.batchId)}>
                              {batch.importerName} · TK-{batch.tokenId} ·{" "}
                              {Number(ownedByTokenId.get(String(batch.tokenId)) ?? BigInt(0))}kg held
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!isOwnedLoading && eligibleBatches.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Your wallet holds no {selectedCollection.fertilizerType} stock - ask the
                          ministry to transfer a batch to you.
                        </p>
                      )}
                    </div>

                    {selectedBatch && (
                      <>
                        {/* Running total */}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl px-6 py-4">
                          <p className="text-2xl font-bold text-foreground tabular-nums">
                            {scannedSacks.length} of {targetSackCount} sacks
                            <span className="text-muted-foreground font-normal"> · </span>
                            {scannedKg}kg of {targetKg}kg
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Still approved for {selectedCollection.farmerName} ·{" "}
                            {selectedCollection.fertilizerType}
                          </p>
                          {exceedsOwnedBalance && (
                            <p className="text-sm text-destructive mt-2">
                              Scanned {scannedKg}kg exceeds the {ownedKg}kg your wallet holds for TK-
                              {selectedBatch.tokenId}.
                            </p>
                          )}
                        </div>

                        <ScanField
                          scannerId="handover-sack-scanner"
                          label="Sack serial"
                          placeholder="XXXX-XXXX-XXXX"
                          // Serialised on purpose: two scans in flight at once
                          // would both send the same alreadyScannedKg and could
                          // slip past the quota ceiling.
                          disabled={isSaving || isTxPending || isValidating || scannedKg >= targetKg}
                          onValue={handleSackScan}
                          onCameraError={(message) =>
                            toast.error("Camera unavailable.", { description: message })
                          }
                        />
                        {scannedKg >= targetKg && (
                          <p className="text-xs text-muted-foreground -mt-3">
                            Approved amount fully covered - remove a sack above to scan a different one.
                          </p>
                        )}

                        {/* Scanned list */}
                        <div className="border border-border rounded-xl divide-y divide-border">
                          {scannedSacks.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                              {isValidating ? "Validating sack..." : "No sacks scanned yet."}
                            </p>
                          ) : (
                            scannedSacks.map((sack) => (
                              <div
                                key={sack.serial}
                                className="flex items-center justify-between gap-4 px-4 py-3"
                              >
                                <span className="font-mono text-sm text-foreground">{sack.serial}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm text-muted-foreground tabular-nums">
                                    {sack.weightKg}kg
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isSaving || isTxPending}
                                    onClick={() => handleRemoveSerial(sack.serial)}
                                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="sr-only">Remove {sack.serial}</span>
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ─── Stage 3: confirm the farmer's wallet ───────────────────── */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
                    3
                  </span>
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Confirm Farmer Wallet
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 space-y-6">
                {!selectedCollection ? (
                  <p className="text-sm text-muted-foreground">Select a farmer above to begin.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">
                        Registered wallet for {selectedCollection.farmerName}
                      </span>
                      <span className="font-mono text-sm text-foreground break-all">
                        {selectedCollection.farmerWallet ?? "Farmer wallet not linked"}
                      </span>
                    </div>

                    <ScanField
                      scannerId="handover-wallet-scanner"
                      label="Farmer wallet"
                      placeholder="0x…"
                      disabled={isSaving || isTxPending || !selectedCollection.farmerWallet}
                      onValue={handleWalletScan}
                      onCameraError={(message) =>
                        toast.error("Camera unavailable.", { description: message })
                      }
                    />

                    {walletConfirmed && (
                      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                        <CheckCircle className="w-4 h-4" />
                        Wallet confirmed - this is the approved farmer.
                      </div>
                    )}
                    {walletError && (
                      <div className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <span className="flex items-center gap-2 font-semibold">
                          <AlertCircle className="w-4 h-4" />
                          {walletError}
                        </span>
                        {scannedWallet && (
                          <span className="font-mono text-xs break-all">Scanned: {scannedWallet}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ─── Action ─────────────────────────────────────────────────── */}
            <Card className="border-border shadow-sm">
              <CardContent className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  {selectedCollection && selectedBatch ? (
                    <span>
                      Burning <strong className="text-foreground">{scannedKg}kg</strong> (
                      {scannedSacks.length} sacks) of {selectedCollection.fertilizerType} for{" "}
                      <strong className="text-foreground">{selectedCollection.farmerName}</strong>
                    </span>
                  ) : (
                    <span>Pick a farmer, a batch, scan the sacks, then confirm the wallet.</span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleBurn}
                  disabled={!canBurn}
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
                      Recording Handover...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" />
                      Authorize Handover
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        </>
      </main>
    </div>
  );
}
