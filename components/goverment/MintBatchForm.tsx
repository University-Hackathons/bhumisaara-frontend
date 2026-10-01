"use client";

import { useState } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { mintTo } from "thirdweb/extensions/erc1155";
import { waitForReceipt } from "thirdweb";
import { contract } from "@/lib/contract";
import { client } from "@/lib/thirdwebClient";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { useAuth } from "@/context/AuthContext";
import { useMintedBatches } from "@/hooks/use-minted-batches";
import { FERTILIZER_TYPES } from "@/lib/fertilizerRequests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Coins, CheckCircle, AlertCircle } from "lucide-react";

/**
 * Wallet UIs (including thirdweb's own details modal) drop any NFT whose
 * metadata has no `image` — a batch minted with only a name and description is
 * indexed but never rendered. This bakes a self-contained SVG into the
 * metadata so a batch is actually visible in the holder's wallet.
 */
const buildBatchImage = (fertilizerType: string, volumeKg: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#14532d"/>
<text x="200" y="150" font-family="sans-serif" font-size="30" fill="#86efac" text-anchor="middle">BhumiSaara</text>
<text x="200" y="225" font-family="sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${fertilizerType}</text>
<text x="200" y="285" font-family="sans-serif" font-size="34" fill="#bbf7d0" text-anchor="middle">${volumeKg} kg</text>
</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export default function MintBatchForm() {
  const account = useActiveAccount();
  const authContext = useAuth();
  const user = authContext?.user;

  const { mutateAsync: sendTransaction, isPending: isTxPending } = useSendTransaction();
  const { refetch: refetchMintedBatches } = useMintedBatches();

  // Form states
  const [importerName, setImporterName] = useState("");
  const [fertilizerType, setFertilizerType] = useState<"TSP" | "MOP" | "Urea" | "">("");
  const [volumeKg, setVolumeKg] = useState<string>("");

  // Loading state for backend metadata saving phase
  const [isSaving, setIsSaving] = useState(false);

  // Form validation helper
  const isFormValid = Boolean(
    importerName.trim() && fertilizerType && volumeKg && Number(volumeKg) > 0
  );

  /**
   * Parses the newly minted token ID from thirdweb ERC-1155 receipt logs.
   * TransferSingle event structure:
   *   topics[0]: event signature (0xc3d58168...)
   *   topics[1]: operator
   *   topics[2]: from
   *   topics[3]: to (recipient wallet address)
   *   data: [id (uint256), value (uint256)]
   */
  const extractTokenId = (receipt: any): number => {
    try {
      if (receipt?.logs && Array.isArray(receipt.logs)) {
        const TRANSFER_SINGLE_TOPIC = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";

        for (const log of receipt.logs) {
          if (log.topics && log.topics[0]?.toLowerCase() === TRANSFER_SINGLE_TOPIC) {
            const dataHex = (log.data || "").replace(/^0x/, "");
            if (dataHex.length >= 64) {
              const idHex = dataHex.slice(0, 64);
              const parsedId = parseInt(idHex, 16);
              if (!isNaN(parsedId) && Number.isSafeInteger(parsedId)) {
                return parsedId;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not parse tokenId from log data:", err);
    }
    return 0;
  };

  /**
   * Saves transaction metadata to Spring Boot backend API upon confirmation.
   */
  const handleTransactionConfirmed = async (receipt: any) => {
    setIsSaving(true);
    const toastId = toast.loading("Saving minted data...");

    try {
      if (!user?.id) {
        throw new Error("Unable to identify the current user. Please log in again.");
      }

      const transactionHash = receipt.transactionHash;
      const tokenId = extractTokenId(receipt);

      // No mintedByUserId — the backend takes the minting admin from the JWT.
      const payload = {
        tokenId,
        transactionHash,
        importerName: importerName.trim(),
        fertilizerType,
        volumeKg: Number(volumeKg),
      };

      // Save metadata to Spring Boot backend API
      await axiosInstance.post(apiPaths.batches.create, payload);

      // Refresh the on-chain NFT list and backend batch metadata so this
      // new batch shows up immediately in the dashboard/history tables.
      await refetchMintedBatches();

      toast.dismiss(toastId);
      toast.success("Batch successfully minted & metadata saved!", {
        description: `Token ID #${tokenId} | Tx: ${transactionHash.substring(0, 10)}...`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      // Reset form state upon successful completion
      setImporterName("");
      setFertilizerType("");
      setVolumeKg("");
    } catch (error: any) {
      console.error("Backend Metadata Persistence Error:", error);
      toast.dismiss(toastId);
      toast.error("Minted on blockchain, but backend save failed.", {
        description:
          error?.response?.data?.message || error?.message || "Please check server connection.",
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles the primary button click to execute blockchain minting and database persistence.
   */
  const handleMintSubmit = async () => {
    if (!isFormValid || !account) {
      toast.error("Please complete all form fields before minting.");
      return;
    }

    try {
      const transaction = mintTo({
        contract,
        to: account.address,
        supply: BigInt(volumeKg),
        nft: {
          name: `${importerName.trim()} - ${fertilizerType}`,
          description: `Fertilizer Import Batch of ${volumeKg} KG (${fertilizerType})`,
          image: buildBatchImage(fertilizerType, volumeKg),
        },
      });

      // Send transaction to wallet
      const txResult = await sendTransaction(transaction);

      // Wait for receipt confirmation
      const receipt = await waitForReceipt({
        client,
        chain: contract.chain,
        transactionHash: txResult.transactionHash,
      });

      // Persist to Spring Boot backend
      await handleTransactionConfirmed(receipt);
    } catch (error: any) {
      console.error("Mint Transaction Error:", error);
      toast.error("Blockchain minting transaction failed.", {
        description: error?.message || "User denied or transaction reverted.",
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col space-y-6 relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Form Header */}
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
          <Coins className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Mint Fertilizer Batch</h2>
          <p className="text-sm text-muted-foreground">
            Issue digital tokens on Polygon & sync with central registry.
          </p>
        </div>
      </div>

      {/* Form Inputs */}
      <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
        {/* Importer / Manufacturer Name */}
        <div className="space-y-2">
          <label htmlFor="importerName" className="block text-sm font-medium text-foreground">
            Importer / Manufacturer Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="importerName"
            type="text"
            value={importerName}
            onChange={(e) => setImporterName(e.target.value)}
            placeholder="e.g. Lanka Agri Imports PLC"
            disabled={isSaving || isTxPending}
            className="h-11 bg-background"
          />
        </div>

        {/* Fertilizer Type Dropdown */}
        <div className="space-y-2">
          <label htmlFor="fertilizerType" className="block text-sm font-medium text-foreground">
            Fertilizer Type <span className="text-destructive">*</span>
          </label>
          <Select
            value={fertilizerType}
            onValueChange={(value) => setFertilizerType((value as "TSP" | "MOP" | "Urea") || "")}
            disabled={isSaving || isTxPending}
          >
            <SelectTrigger id="fertilizerType" className="w-full h-11 bg-background">
              {/* Function child: Base UI renders the raw value otherwise, which
                  would show "Urea" instead of "Urea (46% Nitrogen)". */}
              <SelectValue>
                {(value) =>
                  FERTILIZER_TYPES.find((type) => type.value === String(value ?? ""))?.label ??
                  "Select Fertilizer Type"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FERTILIZER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Volume in KG */}
        <div className="space-y-2">
          <label htmlFor="volumeKg" className="block text-sm font-medium text-foreground">
            Volume (in KG) <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Input
              id="volumeKg"
              type="number"
              min="1"
              step="any"
              value={volumeKg}
              onChange={(e) => setVolumeKg(e.target.value)}
              placeholder="e.g. 50000"
              disabled={isSaving || isTxPending}
              className="h-11 pr-14 bg-background"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">KG</span>
            </div>
          </div>
        </div>

        {/* Action Button: Primary styled Button component */}
        <div className="pt-2">
          {!account ? (
            <Button
              type="button"
              disabled
              className="w-full h-12 text-sm font-semibold opacity-75 cursor-not-allowed"
            >
              Please Connect Wallet to Mint
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleMintSubmit}
              disabled={!isFormValid || isSaving || isTxPending}
              className="w-full h-12 text-sm font-semibold shadow-md hover:shadow-lg rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isTxPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirming in Wallet...</span>
                </div>
              ) : isSaving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Metadata...</span>
                </div>
              ) : (
                "Mint Batch to Blockchain"
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
