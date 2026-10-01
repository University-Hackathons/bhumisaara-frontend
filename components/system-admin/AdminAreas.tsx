"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Edit3, Loader2, MapPin, Plus, Power, PowerOff, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAdminAreas, useAdminMutation, useAdminUsers, useAreaCoverage } from "@/hooks/use-admin";
import type { AdminArea, AreaCoverage } from "@/lib/admin";
import { describeApiError } from "@/utils/apiError";
import { AdminPageHeader } from "@/components/system-admin/AdminCommon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";

type AreaForm = { mode: "create"; area?: undefined } | { mode: "edit"; area: AdminArea };

export default function AdminAreas() {
  const searchParams = useSearchParams();
  const areas = useAdminAreas();
  const coverage = useAreaCoverage();
  const officers = useAdminUsers({ role: "AGRARIAN_SERVICE_OFFICER", page: 0, size: 100 });
  const mutation = useAdminMutation();
  const [form, setForm] = useState<AreaForm | null>(null);
  const [areaName, setAreaName] = useState("");
  const [district, setDistrict] = useState("");
  const [statusArea, setStatusArea] = useState<AdminArea | null>(null);
  const [manualAssignArea, setManualAssignArea] = useState<AreaCoverage | null>(null);
  const [deepLinkClosed, setDeepLinkClosed] = useState(false);
  const [officerId, setOfficerId] = useState<number | null>(null);
  const requestedAreaId = Number(searchParams.get("assign"));
  const assignArea = manualAssignArea ?? (!deepLinkClosed && requestedAreaId ? coverage.data.find((area) => area.areaId === requestedAreaId) ?? null : null);
  const closeAssign = () => { setManualAssignArea(null); setDeepLinkClosed(true); setOfficerId(null); };

  const eligibleOfficers = useMemo(() => officers.data?.content.filter((officer) => !officer.areaName) ?? [], [officers.data]);

  const openForm = (next: AreaForm) => { setForm(next); setAreaName(next.mode === "edit" ? next.area.areaName : ""); setDistrict(next.mode === "edit" ? next.area.district : ""); };
  const run = async (input: Parameters<typeof mutation.mutateAsync>[0], message: string, close: () => void) => {
    try { await mutation.mutateAsync(input); toast.success(message); close(); }
    catch (error) { toast.error("Action failed", { description: describeApiError(error, "The server rejected this action.") }); }
  };
  const saveArea = (event: FormEvent) => {
    event.preventDefault();
    if (!form || !areaName.trim() || !district.trim()) return;
    if (form.mode === "create") void run({ type: "createArea", areaName: areaName.trim(), district: district.trim() }, "Area created", () => setForm(null));
    else void run({ type: "updateArea", areaId: form.area.areaId, areaName: areaName.trim(), district: district.trim() }, "Area updated", () => setForm(null));
  };

  return <div className="mx-auto w-full max-w-7xl space-y-6">
    <AdminPageHeader title="Areas & coverage" description="Maintain the area directory and keep every operational area served by an officer." action={<Button onClick={() => openForm({ mode: "create" })}><Plus /> Create area</Button>} />

    <Card><CardHeader><CardTitle>Officer coverage</CardTitle><CardDescription>Vacancies are ordered with the rest of the directory; farmer and pending counts show their impact.</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Area</TableHead><TableHead>Officer</TableHead><TableHead>Wallet</TableHead><TableHead>Farmers</TableHead><TableHead>Pending requests</TableHead><TableHead className="text-right">Coverage</TableHead></TableRow></TableHeader><TableBody>
      {coverage.error ? <TableErrorState columns={6} message={coverage.error} onRetry={coverage.refetch} /> : coverage.isLoading ? <TableSkeletonRows columns={6} /> : coverage.data.length === 0 ? <TableEmptyState columns={6} icon={MapPin} title="No coverage records" /> : coverage.data.map((area) => <TableRow key={area.areaId} className={area.isVacant && area.isActive ? "bg-amber-500/5" : ""}><TableCell><div className="font-medium">{area.areaName}</div><div className="text-xs text-muted-foreground">{area.district} · {area.isActive ? "Active" : "Inactive"}</div></TableCell><TableCell>{area.officerUsername ? <><div>{area.officerUsername}</div><div className="text-xs text-muted-foreground">{area.officerEmail}</div></> : <Badge variant="warning">Vacant</Badge>}</TableCell><TableCell>{area.isVacant ? "—" : <Badge variant={area.officerWalletLinked ? "success" : "destructive"}>{area.officerWalletLinked ? "Linked" : "Missing"}</Badge>}</TableCell><TableCell>{area.farmerCount}</TableCell><TableCell>{area.pendingRequestCount}</TableCell><TableCell className="text-right">{area.isVacant && area.isActive ? <Button size="sm" onClick={() => { setManualAssignArea(area); setDeepLinkClosed(true); }}><UserPlus /> Assign officer</Button> : <Badge variant={area.isActive ? "success" : "muted"}>{area.isActive ? "Covered" : "Retired"}</Badge>}</TableCell></TableRow>)}
    </TableBody></Table></div></CardContent></Card>

    <Card><CardHeader><CardTitle>Area directory</CardTitle><CardDescription>Areas are deactivated rather than deleted so historical records remain valid.</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Area</TableHead><TableHead>District</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
      {areas.error ? <TableErrorState columns={4} message={areas.error} onRetry={areas.refetch} /> : areas.isLoading ? <TableSkeletonRows columns={4} /> : areas.data.length === 0 ? <TableEmptyState columns={4} icon={MapPin} title="No areas configured" /> : areas.data.map((area) => <TableRow key={area.areaId}><TableCell className="font-medium">{area.areaName}</TableCell><TableCell>{area.district}</TableCell><TableCell><Badge variant={area.isActive ? "success" : "muted"}>{area.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openForm({ mode: "edit", area })}><Edit3 /> Edit</Button><Button size="sm" variant={area.isActive ? "destructive" : "outline"} onClick={() => setStatusArea(area)}>{area.isActive ? <PowerOff /> : <Power />}{area.isActive ? "Deactivate" : "Activate"}</Button></div></TableCell></TableRow>)}
    </TableBody></Table></div></CardContent></Card>

    <Dialog open={form !== null} onOpenChange={(open) => { if (!open) setForm(null); }}><DialogContent><form onSubmit={saveArea}><DialogHeader><DialogTitle>{form?.mode === "edit" ? "Edit area" : "Create area"}</DialogTitle><DialogDescription>Area name and district must form a unique pair.</DialogDescription></DialogHeader><div className="mt-5 space-y-4"><div><label htmlFor="area-name" className="mb-1.5 block text-sm font-medium">Area name</label><Input id="area-name" value={areaName} onChange={(e) => setAreaName(e.target.value)} maxLength={100} required /></div><div><label htmlFor="district" className="mb-1.5 block text-sm font-medium">District</label><Input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={100} required /></div></div><DialogFooter><DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button type="submit" disabled={mutation.isPending || !areaName.trim() || !district.trim()}>{mutation.isPending && <Loader2 className="animate-spin" />} Save</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={statusArea !== null} onOpenChange={(open) => { if (!open) setStatusArea(null); }}><DialogContent><DialogHeader><DialogTitle>{statusArea?.isActive ? "Deactivate" : "Activate"} {statusArea?.areaName}?</DialogTitle><DialogDescription>{statusArea?.isActive ? "This removes the area from operational pickers. The backend will refuse the change while an officer or farmers still reference it and will explain what must be moved first." : "This returns the area to operational pickers. It will remain vacant until an officer is assigned."}</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button variant={statusArea?.isActive ? "destructive" : "default"} disabled={mutation.isPending || !statusArea} onClick={() => statusArea && void run({ type: statusArea.isActive ? "deactivateArea" : "activateArea", areaId: statusArea.areaId }, statusArea.isActive ? "Area deactivated" : "Area activated", () => setStatusArea(null))}>{mutation.isPending && <Loader2 className="animate-spin" />} Confirm</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={assignArea !== null} onOpenChange={(open) => { if (!open) closeAssign(); }}><DialogContent><DialogHeader><DialogTitle>Assign an officer to {assignArea?.areaName}</DialogTitle><DialogDescription>Only currently unassigned officers are offered. After assignment, stock can be routed here once the officer has linked a wallet.</DialogDescription></DialogHeader><div className="mt-5"><label className="mb-1.5 block text-sm font-medium">Eligible officer</label><Select value={officerId?.toString() ?? ""} onValueChange={(value) => setOfficerId(value ? Number(value) : null)}><SelectTrigger><SelectValue>{(value) => eligibleOfficers.find((officer) => String(officer.userId) === String(value))?.username ?? "Select an officer"}</SelectValue></SelectTrigger><SelectContent>{eligibleOfficers.map((officer) => <SelectItem key={officer.userId} value={String(officer.userId)}>{officer.username} · {officer.email}</SelectItem>)}</SelectContent></Select>{!officers.isLoading && eligibleOfficers.length === 0 && <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><Users className="mr-2 inline h-4 w-4" />No unassigned officers are available. Create or convert an eligible user on the Users page first.</p>}</div><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button disabled={!officerId || mutation.isPending || !assignArea} onClick={() => officerId && assignArea && void run({ type: "assignArea", userId: officerId, areaId: assignArea.areaId }, "Officer assigned", closeAssign)}>{mutation.isPending && <Loader2 className="animate-spin" />} Assign officer</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
