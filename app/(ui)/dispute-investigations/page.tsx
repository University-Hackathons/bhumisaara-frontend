"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useApiList, useApiPagedList } from "@/hooks/use-api-resource";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Investigation { id: number; disputeType: string; recordId: number; status: string; updatedAt: string }
interface InvestigationEvent { id: number; actorUserId: number; status: string; note: string; createdAt: string }

export default function DisputeInvestigationsPage() {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const authorized = user?.role === "GOVERNMENT_ADMIN" || user?.role === "SYSTEM_ADMIN";
  const cases = useApiPagedList<Investigation>(["dispute-investigations"], "/dispute-investigations", "Could not load investigations.", authorized);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const events = useApiList<InvestigationEvent>(["dispute-investigation-events", selected],
    selected ? `/dispute-investigations/${selected}/events` : "/dispute-investigations", { enabled: authorized && selected !== null });

  if (isLoading) return null;
  if (!authorized) return <p className="p-6">Only authorized staff can investigate disputes.</p>;
  const update = async (status: string) => {
    if (!selected || !note.trim()) return;
    setBusy(true);
    try {
      await axiosInstance.patch(`/dispute-investigations/${selected}`, { status, note: note.trim() });
      setNote("");
      await Promise.all([cases.refetch(), events.refetch()]);
      toast.success("Investigation updated.");
    } catch { toast.error("Could not update this investigation."); }
    finally { setBusy(false); }
  };

  return <section className="mx-auto w-full max-w-5xl space-y-5 p-4">
    <h1 className="text-3xl font-bold">{t("Dispute Investigations")}</h1>
    <p className="text-sm text-muted-foreground">Review farmer disputes, record findings and close investigations. The original disputed order or handover remains in the ledger.</p>
    {cases.error && <p role="alert">{cases.error}</p>}
    {cases.isLoading && <p>Loading investigations…</p>}
    {!cases.isLoading && !cases.data.length && <p>No disputes are awaiting investigation.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">{cases.data.map((item) => <button type="button" key={item.id}
        onClick={() => setSelected(item.id)} className={`w-full rounded-lg border p-3 text-left ${selected === item.id ? "border-primary" : "border-border"}`}>
        <strong>{item.disputeType === "ORDER" ? "Order" : "Handover"} #{item.recordId}</strong>
        <span className="ml-2 text-sm">{item.status.replaceAll("_", " ")}</span>
      </button>)}{cases.hasMore && <Button variant="outline" disabled={cases.isLoadingMore} onClick={() => cases.loadMore()}>
        {cases.isLoadingMore ? "Loading…" : "Load more"}</Button>}</div>
      {selected && <div className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Investigation #{selected}</h2>
        <div className="max-h-64 space-y-2 overflow-y-auto" aria-label="Investigation audit trail">
          {events.data.map((event) => <div key={event.id} className="rounded bg-muted p-2 text-sm">
            <strong>{event.status.replaceAll("_", " ")}</strong> · Staff/user #{event.actorUserId}<br />
            {event.note}<br /><time className="text-xs">{new Date(event.createdAt).toLocaleString()}</time>
          </div>)}
        </div>
        {!(["RESOLVED", "REJECTED"].includes(cases.data.find((item) => item.id === selected)?.status ?? "")) && <>
          <label className="block text-sm" htmlFor="investigation-note">Investigation note</label>
          <textarea id="investigation-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000}
            className="w-full rounded-md border bg-background p-2" rows={3} />
          <div className="flex flex-wrap gap-2">
            {(["IN_REVIEW", "RESOLVED", "REJECTED"] as const).map((status) => <Button key={status} type="button"
              disabled={busy || !note.trim()} onClick={() => update(status)}>{status.replaceAll("_", " ")}</Button>)}
          </div>
        </>}
      </div>}
    </div>
  </section>;
}
