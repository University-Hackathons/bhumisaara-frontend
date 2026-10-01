"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { balanceOf, safeTransferFrom } from "thirdweb/extensions/erc1155";
import { waitForReceipt } from "thirdweb";
import { contract } from "@/lib/contract";
import { client } from "@/lib/thirdwebClient";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatKg } from "@/utils/formatters";
import { useAreaDemand } from "@/hooks/use-area-demand";
import { useBatches } from "@/hooks/use-batches";
import { useBatchSacks } from "@/hooks/use-batch-sacks";
import type { AreaDemand, Sack } from "@/lib/distribution";
import { ScanField } from "@/components/goverment/QrScanner";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  History,
  Loader2,
  MapPin,
  Package,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";

/** Snapshot taken before the wallet is asked to sign — see handleTransfer. */
interface PendingTransfer {
  batchId: number;
  tokenId: string;
  toOfficerId: number;
  amountKg: number;
  sackSerials: string[];
  officerName: string;
  areaLabel: string;
}

const SACK_WEIGHT_KG = 50;
const SERIAL_PATTERN = /[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/;
const ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/;

const demandKey = (row: AreaDemand) => `${row.areaId}|${row.fertilizerType}`;

/** A sack QR may carry a URL or prefix; the serial itself is what matters. */
const extractSerial = (scanned: string) => {
  const normalised = scanned.trim().toUpperCase();
  return SERIAL_PATTERN.exec(normalised)?.[0] ?? normalised;
};

/** Wallet QRs are often `ethereum:0x…@80002` rather than a bare address. */
const extractAddress = (scanned: string) => ADDRESS_PATTERN.exec(scanned.trim())?.[0] ?? scanned.trim();

/** Batch token ids are numeric strings; anything else can't be sent on-chain. */
const parseTokenId = (tokenId: string | undefined): bigint | null => {
  if (!tokenId) return null;
  try {
    return BigInt(tokenId);
  } catch {
    return null;
  }
};

export default function OfficerDistribution() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const demandQuery = useAreaDemand();
  const batchesQuery = useBatches();

  const demand = demandQuery.data;
  const batches = batchesQuery.data;
  const isLoading = demandQuery.isLoading || batchesQuery.isLoading;
  const loadError = demandQuery.error ?? batchesQuery.error;

  // Stage 1
  const [selectedKey, setSelectedKey] = useState<string>("");

  // Stage 2
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);

  // Stage 3
  const [walletConfirmed, setWalletConfirmed] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [scannedWallet, setScannedWallet] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  /**
   * Frozen at the moment the transaction is prepared. The chain call and the
   * backend write are seconds apart; without this snapshot an edit made while
   * the wallet dialog is open would be recorded against tokens that were never
   * moved. Same approach as HandoverForm.
   */
  const pendingTransferRef = useRef<PendingTransfer | null>(null);

  const loadData = useCallback(async () => {
    await Promise.all([demandQuery.refetch(), batchesQuery.refetch()]);
  }, [demandQuery, batchesQuery]);

  // Areas already fully supplied (outstandingKg === 0) live on their own
  // history page — mixing them in here made the admin scan past settled
  // areas to find the ones that still need a transfer.
  const sortedDemand = useMemo(
    () =>
      [...demand]
        .filter((row) => row.outstandingKg > 0)
        .sort((a, b) => b.outstandingKg - a.outstandingKg),
    [demand]
  );

  const selectedDemand = useMemo(
    () => demand.find((row) => demandKey(row) === selectedKey) ?? null,
    [demand, selectedKey]
  );

  // Stock can only be drawn from a batch of the type the area was approved for.
  const eligibleBatches = useMemo(() => {
    if (!selectedDemand) return [];
    return batches.filter(
      (batch) =>
        batch.fertilizerType?.toLowerCase() === selectedDemand.fertilizerType?.toLowerCase()
    );
  }, [batches, selectedDemand]);

  const selectedBatch = useMemo(
    () => eligibleBatches.find((batch) => String(batch.batchId) === selectedBatchId) ?? null,
    [eligibleBatches, selectedBatchId]
  );

  const resetScanState = useCallback(() => {
    setScannedSerials([]);
    setWalletConfirmed(false);
    setWalletError(null);
    setScannedWallet(null);
  }, []);

  /** Clearing the scans with the selection keeps a stale list from being submitted. */
  const selectBatch = useCallback((batchId: string) => {
    setSelectedBatchId(batchId);
    setScannedSerials([]);
  }, []);

  const handleSelectRow = (row: AreaDemand) => {
    if (!row.officerWallet) return;

    setSelectedKey(demandKey(row));
    selectBatch("");
    resetScanState();
  };

  // Sack weights and statuses come from the backend so a scan can be judged
  // (unknown / wrong batch / already gone) before anything is signed.
  const { data: batchSacks, isLoading: isSacksLoading } = useBatchSacks(
    selectedBatch?.batchId ?? null
  );

  const sackBySerial = useMemo(() => {
    const map = new Map<string, Sack>();
    batchSacks.forEach((sack) => map.set(sack.serial.toUpperCase(), sack));
    return map;
  }, [batchSacks]);

  const availableSacks = useMemo(
    () => batchSacks.filter((sack) => sack.status === "AT_CENTRAL"),
    [batchSacks]
  );

  const scannedKg = useMemo(
    () =>
      scannedSerials.reduce((total, serial) => total + (sackBySerial.get(serial)?.weightKg ?? 0), 0),
    [scannedSerials, sackBySerial]
  );

  const targetKg = selectedDemand?.outstandingKg ?? 0;
  const targetSackCount = Math.ceil(targetKg / SACK_WEIGHT_KG);

  const tokenId = useMemo(() => parseTokenId(selectedBatch?.tokenId), [selectedBatch]);

  // On-chain truth beats the database: the admin can only send what the wallet
  // actually holds for this token.
  const { data: onChainBalance, isLoading: isBalanceLoading } = useReadContract(balanceOf, {
    contract,
    owner: account?.address ?? "0x0000000000000000000000000000000000000000",
    // Placeholder while no batch is picked; the query is disabled anyway.
    tokenId: tokenId ?? BigInt(0),
    queryOptions: { enabled: Boolean(account?.address && tokenId !== null) },
  });

  const availableOnChainKg = onChainBalance === undefined ? null : Number(onChainBalance);
  const exceedsOnChainBalance =
    availableOnChainKg !== null && scannedKg > availableOnChainKg;

  const handleSackScan = (scanned: string) => {
    const serial = extractSerial(scanned);

    if (!selectedBatch) {
      toast.error("Select a batch before scanning sacks.");
      return;
    }

    const sack = sackBySerial.get(serial);

    if (!sack) {
      toast.error("Serial not recognised.", {
        description: `${serial} does not belong to batch #${selectedBatch.batchId}.`,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    if (sack.status !== "AT_CENTRAL") {
      toast.error("Sack has already left the central store.", {
        description: `${serial} is currently ${sack.status.replace("_", " ").toLowerCase()}.`,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    if (scannedSerials.includes(serial)) {
      toast.error("Sack already scanned.", {
        description: `${serial} is already in this transfer.`,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    // Nothing stops a sack scan from overshooting the area's outstanding
    // demand otherwise — e.g. two 50kg sacks against a 50kg shortfall.
    if (scannedKg + sack.weightKg > targetKg) {
      toast.error("This would exceed the area's outstanding demand.", {
        description: `Outstanding is ${formatKg(targetKg)}; adding ${serial} (${formatKg(
          sack.weightKg
        )}) would total ${formatKg(scannedKg + sack.weightKg)}.`,
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    setScannedSerials((current) => [...current, serial]);
  };

  const handleRemoveSerial = (serial: string) => {
    setScannedSerials((current) => current.filter((item) => item !== serial));
  };

  const handleWalletScan = (scanned: string) => {
    const address = extractAddress(scanned);
    setScannedWallet(address);

    const expected = selectedDemand?.officerWallet;

    if (!expected) {
      setWalletConfirmed(false);
      setWalletError("This area's officer has no linked wallet.");
      return;
    }

    if (address.toLowerCase() !== expected.toLowerCase()) {
      setWalletConfirmed(false);
      setWalletError(
        `Scanned wallet does not match ${selectedDemand?.officerName ?? "the officer"}'s registered address.`
      );
      toast.error("Wallet mismatch: this is not the assigned officer.", {
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
      return;
    }

    setWalletConfirmed(true);
    setWalletError(null);
    toast.success("Officer wallet confirmed.", {
      icon: <CheckCircle className="w-5 h-5 text-primary" />,
    });
  };

  const canTransfer = Boolean(
    account &&
      selectedDemand?.officerId &&
      selectedDemand?.officerWallet &&
      selectedBatch &&
      tokenId !== null &&
      scannedSerials.length > 0 &&
      walletConfirmed &&
      !exceedsOnChainBalance &&
      !isSaving &&
      !isTxPending
  );

  /** Writes the confirmed transfer to the backend and refreshes the queue. */
  const recordTransfer = async (transactionHash: string) => {
    const pending = pendingTransferRef.current;
    if (!pending) return;

    setIsSaving(true);
    const toastId = toast.loading("Recording transfer with the registry...");

    try {
      await axiosInstance.post(apiPaths.transfers.record, {
        batchId: pending.batchId,
        tokenId: pending.tokenId,
        toOfficerId: pending.toOfficerId,
        amountKg: pending.amountKg,
        transactionHash,
        sackSerials: pending.sackSerials,
      });

      toast.dismiss(toastId);
      toast.success("Stock transferred to the officer.", {
        description: `${pending.amountKg}kg · ${pending.sackSerials.length} sacks → ${pending.officerName} (${pending.areaLabel})`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      pendingTransferRef.current = null;
      resetScanState();
      selectBatch("");
      await loadData();
    } catch (error) {
      toast.dismiss(toastId);
      // The tokens have already moved on-chain. Losing this hash would leave a
      // transfer nobody can reconcile, so it goes on screen until dismissed.
      toast.error("Tokens transferred on-chain, but the registry save failed.", {
        description: `Record this transaction hash manually: ${transactionHash} - ${describeApiError(
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

  const handleTransfer = async () => {
    if (!canTransfer || !account || !selectedBatch || !selectedDemand || tokenId === null) return;

    const officerWallet = selectedDemand.officerWallet;
    const officerId = selectedDemand.officerId;
    if (!officerWallet || !officerId) return;

    // Snapshot BEFORE the wallet is asked to sign — the form stays editable
    // while the transaction confirms.
    pendingTransferRef.current = {
      batchId: selectedBatch.batchId,
      tokenId: selectedBatch.tokenId,
      toOfficerId: officerId,
      amountKg: scannedKg,
      sackSerials: [...scannedSerials],
      officerName: selectedDemand.officerName ?? "the officer",
      areaLabel: `${selectedDemand.areaName ?? "Area " + selectedDemand.areaId}, ${selectedDemand.district ?? ""}`.trim(),
    };

    try {
      const transaction = safeTransferFrom({
        contract,
        from: account.address,
        to: officerWallet,
        tokenId,
        value: BigInt(scannedKg),
        data: "0x",
      });

      const txResult = await sendTransaction(transaction);

      const receipt = await waitForReceipt({
        client,
        chain: contract.chain,
        transactionHash: txResult.transactionHash,
      });

      await recordTransfer(receipt.transactionHash);
    } catch (error) {
      pendingTransferRef.current = null;
      console.error("Transfer Transaction Error:", error);
      toast.error("Blockchain transfer transaction failed.", {
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
            <h1 className="text-3xl font-bold text-primary">Distribute to Officers</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Move sacks from the central store to the officer serving each area.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!account && (
              <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm font-medium rounded-full border border-destructive/20 w-fit">
                <Wallet className="w-4 h-4" />
                Connect a wallet to transfer
              </div>
            )}
            <Link
              href="/officer-distribution-history"
              className={cn(buttonVariants({ variant: "outline" }), "w-fit h-10 px-4 gap-2")}
            >
              <History className="w-4 h-4" />
              Distribution History
            </Link>
          </div>
        </div>

        {/* A failed load is surfaced inside the queue table rather than
            replacing the page, so the stage layout never jumps around. */}
        <>
          <>
            {/* ─── Stage 1: pick the area ─────────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  1
                </span>
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">Outstanding Area Demand</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Area</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">District</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Type</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Approved</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Transferred</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Outstanding</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Officer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadError ? (
                      <TableErrorState columns={7} message={loadError} onRetry={loadData} />
                    ) : isLoading ? (
                      <TableSkeletonRows columns={7} />
                    ) : sortedDemand.length === 0 ? (
                      <TableEmptyState
                        columns={7}
                        icon={MapPin}
                        title="Nothing to distribute yet"
                        description="Areas appear here once their officer approves a farmer's fertilizer request."
                      />
                    ) : (
                      sortedDemand.map((row) => {
                        const key = demandKey(row);
                        const isSelected = key === selectedKey;
                        const isDisabled = !row.officerWallet;

                        return (
                          <TableRow
                            key={key}
                            onClick={() => handleSelectRow(row)}
                            aria-disabled={isDisabled}
                            className={`border-border transition-colors ${
                              isDisabled
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:bg-muted/30"
                            } ${isSelected ? "bg-primary/10 hover:bg-primary/10" : ""}`}
                          >
                            <TableCell className="py-4 px-6 font-medium text-foreground">
                              {row.areaName ?? `Area #${row.areaId}`}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-muted-foreground">
                              {row.district ?? "-"}
                            </TableCell>
                            <TableCell className="py-4 px-6">{row.fertilizerType}</TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums">
                              {formatKg(row.approvedKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums text-muted-foreground">
                              {formatKg(row.transferredKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                              {formatKg(row.outstandingKg)}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              {row.officerName ? (
                                <div className="flex flex-col">
                                  <span className="text-foreground">{row.officerName}</span>
                                  {!row.officerWallet && (
                                    <span className="text-xs text-destructive">
                                      Officer wallet not linked
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-destructive">No officer assigned</span>
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
                    Choose Batch & Scan Sacks
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 space-y-6">
                {!selectedDemand ? (
                  <p className="text-sm text-muted-foreground">
                    Select an area above to begin.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 max-w-xl">
                      <label className="text-sm font-medium text-muted-foreground">
                        Batch to draw from ({selectedDemand.fertilizerType} only)
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
                                ? `${batch.importerName} · TK-${batch.tokenId} · ${batch.volumeKg}kg minted`
                                : "Choose a batch";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleBatches.map((batch) => (
                            <SelectItem key={batch.batchId} value={String(batch.batchId)}>
                              {batch.importerName} · TK-{batch.tokenId} · {batch.volumeKg}kg minted
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {eligibleBatches.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No minted batch of {selectedDemand.fertilizerType} exists yet.
                        </p>
                      )}
                      {selectedBatch && tokenId === null && (
                        <p className="text-xs text-destructive">
                          Batch token id &quot;{selectedBatch.tokenId}&quot; is not numeric and cannot be
                          transferred on-chain.
                        </p>
                      )}
                      {selectedBatch && (
                        <p className="text-xs text-muted-foreground">
                          {isSacksLoading
                            ? "Loading sacks..."
                            : `${availableSacks.length} of ${batchSacks.length} sacks still at the central store.`}
                        </p>
                      )}
                    </div>

                    {selectedBatch && (
                      <>
                        {/* Running total */}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl px-6 py-4">
                          <p className="text-2xl font-bold text-foreground tabular-nums">
                            {scannedSerials.length} of {targetSackCount} sacks
                            <span className="text-muted-foreground font-normal"> · </span>
                            {scannedKg}kg of {targetKg}kg
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Outstanding demand for {selectedDemand.areaName ?? `Area #${selectedDemand.areaId}`} ·{" "}
                            {selectedDemand.fertilizerType}
                          </p>
                          {exceedsOnChainBalance && (
                            <p className="text-sm text-destructive mt-2">
                              Scanned {scannedKg}kg exceeds the {availableOnChainKg}kg this wallet holds
                              on-chain for TK-{selectedBatch.tokenId}.
                            </p>
                          )}
                        </div>

                        <ScanField
                          scannerId="sack-scanner"
                          label="Sack serial"
                          placeholder="XXXX-XXXX-XXXX"
                          disabled={isSaving || isTxPending || scannedKg >= targetKg}
                          onValue={handleSackScan}
                          onCameraError={(message) =>
                            toast.error("Camera unavailable.", { description: message })
                          }
                        />
                        {scannedKg >= targetKg && (
                          <p className="text-xs text-muted-foreground -mt-3">
                            Outstanding demand fully covered - remove a sack above to scan a different one.
                          </p>
                        )}

                        {/* Scanned list */}
                        <div className="border border-border rounded-xl divide-y divide-border">
                          {scannedSerials.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                              No sacks scanned yet.
                            </p>
                          ) : (
                            scannedSerials.map((serial) => (
                              <div
                                key={serial}
                                className="flex items-center justify-between gap-4 px-4 py-3"
                              >
                                <span className="font-mono text-sm text-foreground">{serial}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm text-muted-foreground tabular-nums">
                                    {formatKg(sackBySerial.get(serial)?.weightKg ?? 0)}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isSaving || isTxPending}
                                    onClick={() => handleRemoveSerial(serial)}
                                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="sr-only">Remove {serial}</span>
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

            {/* ─── Stage 3: confirm the officer's wallet ──────────────────── */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold">
                    3
                  </span>
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Confirm Officer Wallet
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2 space-y-6">
                {!selectedDemand ? (
                  <p className="text-sm text-muted-foreground">Select an area above to begin.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">
                        Registered wallet for {selectedDemand.officerName ?? "the officer"}
                      </span>
                      <span className="font-mono text-sm text-foreground break-all">
                        {selectedDemand.officerWallet ?? "Officer wallet not linked"}
                      </span>
                    </div>

                    <ScanField
                      scannerId="wallet-scanner"
                      label="Officer wallet"
                      placeholder="0x…"
                      disabled={isSaving || isTxPending || !selectedDemand.officerWallet}
                      onValue={handleWalletScan}
                      onCameraError={(message) =>
                        toast.error("Camera unavailable.", { description: message })
                      }
                    />

                    {walletConfirmed && (
                      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                        <CheckCircle className="w-4 h-4" />
                        Wallet confirmed - this is the officer serving this area.
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
                  {selectedDemand && selectedBatch ? (
                    <span>
                      Sending <strong className="text-foreground">{scannedKg}kg</strong> (
                      {scannedSerials.length} sacks) of {selectedDemand.fertilizerType} to{" "}
                      <strong className="text-foreground">
                        {selectedDemand.officerName ?? "the officer"}
                      </strong>
                      {isBalanceLoading
                        ? " · checking on-chain balance…"
                        : availableOnChainKg !== null
                          ? ` · wallet holds ${availableOnChainKg}kg of TK-${selectedBatch.tokenId}`
                          : ""}
                    </span>
                  ) : (
                    <span>Pick an area, a batch, scan the sacks, then confirm the wallet.</span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleTransfer}
                  disabled={!canTransfer}
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
                      Recording Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Transfer to Officer
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
