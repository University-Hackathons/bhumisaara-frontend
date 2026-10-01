"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Unplug, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAdminMutation, useAdminWallets } from "@/hooks/use-admin";
import type { AdminWalletStatus } from "@/lib/admin";
import { describeApiError } from "@/utils/apiError";
import { AdminPageHeader, roleLabel } from "@/components/system-admin/AdminCommon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";

export default function AdminWallets() {
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  const [clearing, setClearing] = useState<AdminWalletStatus | null>(null);
  const wallets = useAdminWallets(unlinkedOnly);
  const mutation = useAdminMutation();
  const clearWallet = async () => {
    if (!clearing) return;
    try { await mutation.mutateAsync({ type: "clearWallet", userId: clearing.userId }); toast.success("Wallet link cleared", { description: `${clearing.username} must reconnect their own wallet.` }); setClearing(null); }
    catch (error) { toast.error("Could not clear wallet", { description: describeApiError(error, "The server rejected this action.") }); }
  };
  return <div className="mx-auto w-full max-w-7xl space-y-6">
    <AdminPageHeader title="Wallet oversight" description="Monitor wallet links without exposing full addresses or allowing administrators to replace them." action={<Button variant={unlinkedOnly ? "default" : "outline"} onClick={() => setUnlinkedOnly((value) => !value)}><Unplug /> {unlinkedOnly ? "Showing unlinked" : "Show unlinked only"}</Button>} />
    <Card><CardContent className="pt-4"><div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" /><div><p className="font-medium">Wallet links are clear-only</p><p className="mt-1 text-muted-foreground">Clearing a link never transfers funds. The user must reconnect and prove control of their own wallet afterward.</p></div></div></CardContent></Card>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Area</TableHead><TableHead>Wallet</TableHead><TableHead>Operational impact</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
      {wallets.error ? <TableErrorState columns={6} message={wallets.error} onRetry={wallets.refetch} /> : wallets.isLoading ? <TableSkeletonRows columns={6} /> : wallets.data.length === 0 ? <TableEmptyState columns={6} icon={WalletCards} title={unlinkedOnly ? "Every account has a linked wallet" : "No wallet records"} /> : wallets.data.map((item) => <TableRow key={item.userId} className={item.blocking ? "bg-amber-500/5" : ""}><TableCell><div className="font-medium">{item.username}</div><div className="text-xs text-muted-foreground">{item.email}</div></TableCell><TableCell>{roleLabel(item.role)}</TableCell><TableCell>{item.areaName ?? "—"}</TableCell><TableCell>{item.walletLinked ? <span className="font-mono text-xs">{item.walletAddressTruncated}</span> : <Badge variant="muted">Unlinked</Badge>}</TableCell><TableCell>{item.blocking ? <Badge variant="warning"><AlertTriangle /> Blocks workflow</Badge> : <span className="text-sm text-muted-foreground">{item.walletLinked ? "Ready" : "Not currently blocking"}</span>}</TableCell><TableCell className="text-right">{item.walletLinked ? <Button size="sm" variant="destructive" onClick={() => setClearing(item)}><Unplug /> Clear link</Button> : "—"}</TableCell></TableRow>)}
    </TableBody></Table></div></Card>
    <Dialog open={clearing !== null} onOpenChange={(open) => { if (!open) setClearing(null); }}><DialogContent><DialogHeader><DialogTitle>Clear {clearing?.username}&apos;s wallet link?</DialogTitle><DialogDescription>The truncated address {clearing?.walletAddressTruncated} will be removed from their account. You cannot set a replacement; the user must reconnect their own wallet.</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button variant="destructive" disabled={mutation.isPending} onClick={() => void clearWallet()}>{mutation.isPending && <Loader2 className="animate-spin" />} Clear wallet</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

