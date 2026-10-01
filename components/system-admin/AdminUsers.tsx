"use client";

import { FormEvent, useState } from "react";
import { Ban, Eye, KeyRound, Loader2, Search, ShieldCheck, UserRound, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAdminAreas, useAdminMutation, useAdminUser, useAdminUsers } from "@/hooks/use-admin";
import type { AdminUserDetail } from "@/lib/admin";
import type { Role } from "@/lib/navigation";
import { describeApiError } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatters";
import { AdminPageHeader, Pager, roleLabel, ROLES } from "@/components/system-admin/AdminCommon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";

type ConfirmAction =
  | { kind: "ban"; user: AdminUserDetail }
  | { kind: "role"; user: AdminUserDetail; role: Role }
  | { kind: "clearArea"; user: AdminUserDetail }
  | { kind: "clearWallet"; user: AdminUserDetail };

export default function AdminUsers() {
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | undefined>();
  const [areaId, setAreaId] = useState<number | undefined>();
  const [isBanned, setIsBanned] = useState<boolean | undefined>();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const users = useAdminUsers({ page, size: 25, search, role, areaId, isBanned });
  const areas = useAdminAreas();
  const detail = useAdminUser(selectedId);
  const mutation = useAdminMutation();

  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(0); setSearch(searchInput.trim()); };

  const run = async (action: Parameters<typeof mutation.mutateAsync>[0], success: string) => {
    try {
      await mutation.mutateAsync(action);
      toast.success(success);
      setConfirmAction(null);
      setResetOpen(false);
      setNewPassword("");
    } catch (error) {
      toast.error("Action failed", { description: describeApiError(error, "The server rejected this action.") });
    }
  };

  const confirmCopy = !confirmAction ? null : confirmAction.kind === "role"
    ? { title: `Change ${confirmAction.user.username}'s role?`, body: `This changes their permissions from ${roleLabel(confirmAction.user.role)} to ${roleLabel(confirmAction.role)}. The backend will refuse the change if domain records still depend on the current role.` }
    : confirmAction.kind === "ban"
      ? { title: `Ban ${confirmAction.user.username}?`, body: "Their active session will stop working immediately. Historical records remain intact." }
      : confirmAction.kind === "clearArea"
        ? { title: `Clear ${confirmAction.user.username}'s area?`, body: "The area will become vacant and its operational queue will have no serving officer until another is assigned." }
        : { title: `Clear ${confirmAction.user.username}'s wallet link?`, body: "The user must reconnect their own wallet afterward. The administrator cannot set or replace it." };

  const executeConfirmation = () => {
    if (!confirmAction) return;
    if (confirmAction.kind === "ban") void run({ type: "ban", userId: confirmAction.user.userId }, "User banned");
    if (confirmAction.kind === "role") void run({ type: "changeRole", userId: confirmAction.user.userId, role: confirmAction.role }, "Role changed");
    if (confirmAction.kind === "clearArea") void run({ type: "assignArea", userId: confirmAction.user.userId, areaId: null }, "Area assignment cleared");
    if (confirmAction.kind === "clearWallet") void run({ type: "clearWallet", userId: confirmAction.user.userId }, "Wallet link cleared");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <AdminPageHeader title="User management" description="Inspect accounts and manage access, roles, coverage, passwords, and wallet links." />
      <Card><CardContent className="pt-4"><div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_220px_180px]">
        <form onSubmit={submitSearch} className="flex gap-2"><Input aria-label="Search users" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Username or email" /><Button type="submit" variant="outline"><Search /><span className="sr-only">Search</span></Button></form>
        <Select value={role ?? "all"} onValueChange={(value) => { setPage(0); setRole(value === "all" ? undefined : value as Role); }}><SelectTrigger aria-label="Filter by role"><SelectValue>{(value) => value === "all" ? "All roles" : roleLabel(String(value))}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{ROLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        <Select value={areaId?.toString() ?? "all"} onValueChange={(value) => { setPage(0); setAreaId(value === "all" ? undefined : Number(value)); }}><SelectTrigger aria-label="Filter by area"><SelectValue>{(value) => value === "all" ? "All areas" : areas.data.find((a) => String(a.areaId) === String(value))?.areaName ?? "Area"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All areas</SelectItem>{areas.data.map((area) => <SelectItem key={area.areaId} value={String(area.areaId)}>{area.areaName} · {area.district}</SelectItem>)}</SelectContent></Select>
        <Select value={isBanned === undefined ? "all" : String(isBanned)} onValueChange={(value) => { setPage(0); setIsBanned(value === "all" ? undefined : value === "true"); }}><SelectTrigger aria-label="Filter by status"><SelectValue>{(value) => value === "true" ? "Banned" : value === "false" ? "Active" : "All statuses"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="false">Active</SelectItem><SelectItem value="true">Banned</SelectItem></SelectContent></Select>
      </div></CardContent></Card>

      <Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Area</TableHead><TableHead>Wallet</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader><TableBody>
        {users.error ? <TableErrorState columns={6} message={users.error} onRetry={users.refetch} /> : users.isLoading ? <TableSkeletonRows columns={6} /> : !users.data?.content.length ? <TableEmptyState columns={6} icon={Users} title="No users found" description="Try changing the search or filters." /> : users.data.content.map((user) => <TableRow key={user.userId}><TableCell><div className="font-medium">{user.username}</div><div className="text-xs text-muted-foreground">{user.email}</div></TableCell><TableCell><Badge variant="secondary">{roleLabel(user.role)}</Badge></TableCell><TableCell>{user.areaName ? <><div>{user.areaName}</div><div className="text-xs text-muted-foreground">{user.district}</div></> : <span className="text-muted-foreground">—</span>}</TableCell><TableCell>{user.walletLinked ? <span className="font-mono text-xs">{user.walletAddressTruncated}</span> : <Badge variant="muted">Unlinked</Badge>}</TableCell><TableCell><Badge variant={user.isBanned ? "destructive" : "success"}>{user.isBanned ? "Banned" : "Active"}</Badge></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setSelectedId(user.userId)}><Eye /> View</Button></TableCell></TableRow>)}
      </TableBody></Table></div>{users.data && <Pager page={users.data.page} totalPages={users.data.totalPages} totalElements={users.data.totalElements} onPageChange={setPage} />}</Card>

      <Sheet open={selectedId !== null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader className="border-b border-border"><SheetTitle>User details</SheetTitle><SheetDescription>Review the complete account response before taking action.</SheetDescription></SheetHeader>
        <div className="p-4">{detail.isLoading ? <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin" /></div> : detail.error ? <div className="space-y-3"><p className="text-destructive">{detail.error}</p><Button variant="outline" onClick={() => detail.refetch()}>Try again</Button></div> : detail.data && <UserDetail user={detail.data} areas={areas.data} busy={mutation.isPending} onBan={() => setConfirmAction({ kind: "ban", user: detail.data! })} onUnban={() => void run({ type: "unban", userId: detail.data!.userId }, "User unbanned")} onReset={() => setResetOpen(true)} onRole={(nextRole) => setConfirmAction({ kind: "role", user: detail.data!, role: nextRole })} onArea={(nextArea) => nextArea === null ? setConfirmAction({ kind: "clearArea", user: detail.data! }) : void run({ type: "assignArea", userId: detail.data!.userId, areaId: nextArea }, "Area assignment updated")} onWallet={() => setConfirmAction({ kind: "clearWallet", user: detail.data! })} />}</div>
      </SheetContent></Sheet>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmCopy?.title}</DialogTitle><DialogDescription>{confirmCopy?.body}</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button variant={confirmAction?.kind === "ban" || confirmAction?.kind === "clearWallet" ? "destructive" : "default"} disabled={mutation.isPending} onClick={executeConfirmation}>{mutation.isPending && <Loader2 className="animate-spin" />} Confirm</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={resetOpen} onOpenChange={(open) => { setResetOpen(open); if (!open) setNewPassword(""); }}><DialogContent><DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription>Enter a temporary password of at least eight characters. It is sent only to the reset endpoint and is never displayed again.</DialogDescription></DialogHeader><div className="mt-5 space-y-2"><label htmlFor="admin-new-password" className="text-sm font-medium">New password</label><Input id="admin-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} aria-invalid={newPassword.length > 0 && newPassword.length < 8} /><p className="text-xs text-muted-foreground">Minimum 8 characters.</p></div><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button disabled={newPassword.length < 8 || mutation.isPending || !detail.data} onClick={() => detail.data && void run({ type: "resetPassword", userId: detail.data.userId, newPassword }, "Password reset completed")}>{mutation.isPending && <Loader2 className="animate-spin" />} Reset password</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function UserDetail({ user, areas, busy, onBan, onUnban, onReset, onRole, onArea, onWallet }: { user: AdminUserDetail; areas: ReturnType<typeof useAdminAreas>["data"]; busy: boolean; onBan: () => void; onUnban: () => void; onReset: () => void; onRole: (role: Role) => void; onArea: (areaId: number | null) => void; onWallet: () => void }) {
  const facts = [["Full name", user.fullName], ["Email", user.email], ["Address", user.address], ["Contact", user.contactNumber], ["Created", formatDateTime(user.createdAt)], ["Area", user.areaName ? `${user.areaName}, ${user.district}` : null]];
  const counts = [["Fertilizer requests", user.fertilizerRequestCount], ["Requests reviewed", user.requestsReviewedCount], ["Distributions", user.distributionCount], ["Orders", user.orderCount], ["Listings", user.listingCount]];
  return <div className="space-y-5"><div className="flex items-start gap-3"><div className="rounded-full bg-primary/10 p-3 text-primary"><UserRound /></div><div><h2 className="text-xl font-semibold">{user.username}</h2><div className="mt-1 flex flex-wrap gap-2"><Badge variant="secondary">{roleLabel(user.role)}</Badge><Badge variant={user.isBanned ? "destructive" : "success"}>{user.isBanned ? "Banned" : "Active"}</Badge><Badge variant={user.walletLinked ? "success" : "muted"}>{user.walletLinked ? `Wallet ${user.walletAddressTruncated}` : "Wallet unlinked"}</Badge></div></div></div>
    <Card><CardHeader><CardTitle>Profile and account</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{facts.map(([label, value]) => <div key={String(label)}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-0.5 break-words font-medium">{value || "—"}</div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Activity</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">{counts.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/50 p-3"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Administrative actions</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button disabled={busy} variant={user.isBanned ? "outline" : "destructive"} onClick={user.isBanned ? onUnban : onBan}>{user.isBanned ? <ShieldCheck /> : <Ban />}{user.isBanned ? "Unban user" : "Ban user"}</Button><Button disabled={busy} variant="outline" onClick={onReset}><KeyRound /> Reset password</Button>{user.walletLinked && <Button disabled={busy} variant="destructive" onClick={onWallet}><WalletCards /> Clear wallet</Button>}</div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-sm font-medium">Role</label><Select value={user.role} onValueChange={(value) => { if (value && value !== user.role) onRole(value as Role); }}><SelectTrigger><SelectValue>{(value) => roleLabel(String(value))}</SelectValue></SelectTrigger><SelectContent>{ROLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><label className="text-sm font-medium">Officer area</label><Select value={user.areaId?.toString() ?? "none"} disabled={user.role !== "AGRARIAN_SERVICE_OFFICER"} onValueChange={(value) => onArea(value === "none" ? null : Number(value))}><SelectTrigger><SelectValue>{(value) => value === "none" ? "No area" : areas.find((a) => String(a.areaId) === String(value))?.areaName ?? "Area"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">No area</SelectItem>{areas.filter((a) => a.isActive).map((area) => <SelectItem key={area.areaId} value={String(area.areaId)}>{area.areaName} · {area.district}</SelectItem>)}</SelectContent></Select>{user.role !== "AGRARIAN_SERVICE_OFFICER" && <p className="text-xs text-muted-foreground">Area assignment is only available to officers.</p>}</div></div>
    </CardContent></Card></div>;
}
