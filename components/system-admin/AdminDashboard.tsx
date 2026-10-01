"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, MapPin, RefreshCw, ShieldCheck, Users, WalletCards } from "lucide-react";
import { useSystemHealth } from "@/hooks/use-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabel, ROLES } from "@/components/system-admin/AdminCommon";

function HealthCard({ label, count, href, description }: { label: string; count: number; href?: string; description?: string }) {
  const healthy = count === 0;
  const content = (
    <Card className={healthy ? "border-border" : "border-amber-500/40 bg-amber-500/5"}>
      <CardHeader className="pb-2"><div className="flex items-center justify-between gap-3"><CardTitle className="text-sm font-medium">{label}</CardTitle>{healthy ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}</div></CardHeader>
      <CardContent><div className="text-3xl font-bold tabular-nums">{count.toLocaleString()}</div>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}<Badge className="mt-3" variant={healthy ? "success" : "warning"}>{healthy ? "Healthy" : "Needs attention"}</Badge></CardContent>
    </Card>
  );
  return href ? <Link href={href} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : content;
}

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useSystemHealth();
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight md:text-3xl">Platform health</h1><p className="mt-1 text-muted-foreground">Operational warnings that may need a system administrator.</p></div>
      {error ? (
        <Card className="border-destructive/30"><CardContent className="flex flex-col items-start gap-3 pt-6"><p className="font-medium text-destructive">{error}</p><p className="text-sm text-muted-foreground">Other pages remain available while health data is unavailable.</p><Button variant="outline" onClick={() => refetch()}><RefreshCw /> Try again</Button></CardContent></Card>
      ) : isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <HealthCard label="Unlinked wallets" count={data.unlinkedWallets} href="/admin-wallets" />
            <HealthCard label="Officer wallets blocking work" count={data.unlinkedOfficerWallets} href="/admin-wallets" />
            <HealthCard label="Government admin wallets blocking work" count={data.unlinkedGovernmentAdminWallets} href="/admin-wallets" />
            <HealthCard label="Vacant active areas" count={data.vacantAreaCount} href="/admin-areas" />
            <HealthCard label="Stale fertilizer requests" count={data.staleFertilizerRequests} description={`Pending more than ${data.staleAfterDays} days`} />
            <HealthCard label="Stale marketplace orders" count={data.staleMarketOrders} description={`Waiting more than ${data.staleAfterDays} days`} />
            <HealthCard label="Disputed distributions" count={data.disputedDistributions} />
            <HealthCard label="Banned users" count={data.bannedUsers} href="/admin-users" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
            <Card><CardHeader><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle>Accounts by role</CardTitle></div><CardDescription>{data.totalUsers.toLocaleString()} accounts in total</CardDescription></CardHeader><CardContent className="space-y-3">{ROLES.map(({ value }) => <div key={value} className="flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground">{roleLabel(value)}</span><span className="font-semibold tabular-nums">{(data.userCountsByRole[value] ?? 0).toLocaleString()}</span></div>)}</CardContent></Card>
            <Card><CardHeader><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /><CardTitle>Vacant areas</CardTitle></div><CardDescription>Areas without an officer cannot review requests or receive stock.</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Area</TableHead><TableHead>Farmers</TableHead><TableHead>Pending</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{data.vacantAreas.length === 0 ? <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground"><ShieldCheck className="mx-auto mb-2 h-5 w-5 text-emerald-600" />All active areas are covered.</TableCell></TableRow> : data.vacantAreas.map((area) => <TableRow key={area.areaId}><TableCell><div className="font-medium">{area.areaName}</div><div className="text-xs text-muted-foreground">{area.district}</div></TableCell><TableCell>{area.farmerCount}</TableCell><TableCell>{area.pendingRequestCount}</TableCell><TableCell className="text-right"><Button render={<Link href={`/admin-areas?assign=${area.areaId}`} />} size="sm" variant="outline"><WalletCards /> Assign officer</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}
