"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { currentRecoveryOwner, pendingChainRecords, pendingChainRecordsEvent, retryPendingChainRecord, type PendingChainRecord } from "@/lib/chainRecovery";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PendingChainRecords() {
  const [records, setRecords] = useState<PendingChainRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
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
    <p className="text-sm">The blockchain step succeeded. Retry recording it without signing another transaction.</p>
    {records.map((record) => <div key={record.id} className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <span>{record.url} · {record.hash.slice(0, 12)}…</span>
      <Button type="button" size="sm" disabled={busy === record.id} onClick={async () => {
        setBusy(record.id);
        try { await retryPendingChainRecord(record, (url, payload) => axiosInstance.post(url, payload)); toast.success("Transaction recorded."); }
        catch { toast.error("Recording still failed. You can retry again later."); }
        finally { setBusy(null); }
      }}>Retry recording</Button>
    </div>)}
  </section>;
}
