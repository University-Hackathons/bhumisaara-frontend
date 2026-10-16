"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { currentRecoveryOwner, pendingChainRecords, pendingChainRecordsEvent, retryPendingChainRecord, type PendingChainRecord } from "@/lib/chainRecovery";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const labels: Record<string, string> = {
  "/batches": "Fertilizer batch mint", "/transfers": "Officer stock transfer",
  "/distributions": "Farmer handover", "/credits/issue": "Subsidy credit issuance",
};

export function pendingRecordLabel(url: string): string {
  if (labels[url]) return labels[url];
  if (url.includes("/confirm")) return "Order credit transfer";
  if (url.includes("/settle")) return "Redemption burn";
  return "Confirmed transaction";
}

export function PendingChainRecords() {
  const [records, setRecords] = useState<PendingChainRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => setRecords(pendingChainRecords().filter((record) => record.owner === currentRecoveryOwner()));
    refresh();
    window.addEventListener(pendingChainRecordsEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(pendingChainRecordsEvent, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  if (!records.length) return null;
  return <section className="m-4 rounded-lg border border-amber-500 p-4" aria-label="Confirmed transactions awaiting registry recording">
    <h2 className="font-semibold">Confirmed transactions awaiting registry recording</h2>
    <p className="text-sm">These transactions succeeded on the blockchain. Retry the registry write with the original hash. No wallet signature or new transaction is needed.</p>
    {records.map((record) => <div key={record.id} className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium">{pendingRecordLabel(record.url)}</span>
      <code className="break-all" aria-label="Original transaction hash">{record.hash}</code>
      <Button type="button" size="sm" disabled={busy === record.id} onClick={async () => {
        setBusy(record.id);
        try { await retryPendingChainRecord(record, (url, payload) => axiosInstance.post(url, payload)); await queryClient.invalidateQueries(); toast.success("Transaction recorded."); }
        catch { toast.error("Recording still failed. You can retry again later."); }
        finally { setBusy(null); }
      }}>Retry recording</Button>
    </div>)}
  </section>;
}
