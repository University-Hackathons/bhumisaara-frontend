"use client";

import { FormEvent, useState } from "react";
import { FileClock, Filter, LockKeyhole } from "lucide-react";
import { useAdminAuditLogs } from "@/hooks/use-admin";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/admin";
import { formatDateTime } from "@/utils/formatters";
import { AdminPageHeader, Pager } from "@/components/system-admin/AdminCommon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";

export default function AdminAuditLogs() {
  const [page, setPage] = useState(0);
  const [actorInput, setActorInput] = useState("");
  const [actorUserId, setActorUserId] = useState<number | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const logs = useAdminAuditLogs({ page, size: 25, actorUserId, action, from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59` : undefined });
  const submitActor = (event: FormEvent) => { event.preventDefault(); const value = Number(actorInput); setPage(0); setActorUserId(actorInput && Number.isFinite(value) && value > 0 ? value : undefined); };
  return <div className="mx-auto w-full max-w-7xl space-y-6">
    <AdminPageHeader title="Administrative audit log" description="An append-only record of privileged system administrator actions." />
    <Card><CardContent className="pt-4"><div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" /> This page is read-only. Audit records cannot be edited, resolved, cleared, or deleted.</div><div className="grid gap-3 lg:grid-cols-4">
      <form onSubmit={submitActor} className="flex gap-2"><Input type="number" min={1} value={actorInput} onChange={(e) => setActorInput(e.target.value)} placeholder="Actor user ID" aria-label="Actor user ID" /><Button type="submit" variant="outline"><Filter /><span className="sr-only">Apply actor filter</span></Button></form>
      <Select value={action ?? "all"} onValueChange={(value) => { setPage(0); setAction(value === "all" ? undefined : String(value)); }}><SelectTrigger aria-label="Action filter"><SelectValue>{(value) => value === "all" ? "All actions" : String(value).replaceAll("_", " ").toLowerCase()}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All actions</SelectItem>{ADMIN_AUDIT_ACTIONS.map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ").toLowerCase()}</SelectItem>)}</SelectContent></Select>
      <div><label htmlFor="audit-from" className="sr-only">From date</label><Input id="audit-from" type="date" value={from} onChange={(e) => { setPage(0); setFrom(e.target.value); }} aria-label="From date" /></div>
      <div><label htmlFor="audit-to" className="sr-only">To date</label><Input id="audit-to" type="date" value={to} min={from || undefined} onChange={(e) => { setPage(0); setTo(e.target.value); }} aria-label="To date" /></div>
    </div></CardContent></Card>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Acting administrator</TableHead><TableHead>Action</TableHead><TableHead>Target user</TableHead><TableHead>Target entity</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>
      {logs.error ? <TableErrorState columns={6} message={logs.error} onRetry={logs.refetch} /> : logs.isLoading ? <TableSkeletonRows columns={6} /> : !logs.data?.content.length ? <TableEmptyState columns={6} icon={FileClock} title="No audit records found" description="Try changing the filters." /> : logs.data.content.map((log) => <TableRow key={log.logId}><TableCell className="whitespace-nowrap text-sm">{formatDateTime(log.createdAt)}</TableCell><TableCell><div className="font-medium">{log.actorUsername ?? `User ${log.actorUserId}`}</div><div className="text-xs text-muted-foreground">ID {log.actorUserId}</div></TableCell><TableCell><Badge variant="secondary">{log.action.replaceAll("_", " ").toLowerCase()}</Badge></TableCell><TableCell>{log.targetUserId ? <><div>{log.targetUsername ?? `User ${log.targetUserId}`}</div><div className="text-xs text-muted-foreground">ID {log.targetUserId}</div></> : "—"}</TableCell><TableCell className="font-mono text-xs">{log.targetEntity ?? "—"}</TableCell><TableCell className="min-w-64 whitespace-normal">{log.details ?? "—"}</TableCell></TableRow>)}
    </TableBody></Table></div>{logs.data && <Pager page={logs.data.page} totalPages={logs.data.totalPages} totalElements={logs.data.totalElements} onPageChange={setPage} />}</Card>
  </div>;
}
