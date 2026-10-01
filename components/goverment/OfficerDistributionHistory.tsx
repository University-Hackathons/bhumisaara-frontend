"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAreaDemand } from "@/hooks/use-area-demand";
import { formatKg } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CheckCircle, History } from "lucide-react";
import type { AreaDemand } from "@/lib/distribution";

const demandKey = (row: AreaDemand) => `${row.areaId}|${row.fertilizerType}`;

/**
 * Areas whose approved demand has been fully transferred to the officer —
 * split out from `/officer-distribution` so a mixed table of "still owed"
 * and "already fulfilled" rows doesn't make the admin scan past settled
 * areas to find the ones that actually need a transfer.
 */
export default function OfficerDistributionHistory() {
  const { data: demand, isLoading, error, refetch } = useAreaDemand();

  const fulfilled = useMemo(
    () =>
      [...demand]
        .filter((row) => row.outstandingKg <= 0)
        .sort((a, b) => b.transferredKg - a.transferredKg),
    [demand]
  );

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Officer Distribution History</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Areas whose approved demand has already been fully transferred to their officer.
            </p>
          </div>
          <Link
            href="/officer-distribution"
            className={cn(buttonVariants({ variant: "outline" }), "w-fit h-10 px-4 gap-2")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Distribute
          </Link>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Fully Supplied Areas</h2>
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
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Officer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error ? (
                  <TableErrorState columns={7} message={error} onRetry={refetch} />
                ) : isLoading ? (
                  <TableSkeletonRows columns={7} />
                ) : fulfilled.length === 0 ? (
                  <TableEmptyState
                    columns={7}
                    icon={History}
                    title="No fully supplied areas yet"
                    description="Once a transfer clears an area's outstanding demand, it moves here."
                  />
                ) : (
                  fulfilled.map((row) => (
                    <TableRow key={demandKey(row)} className="border-border hover:bg-muted/30 transition-colors">
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
                      <TableCell className="py-4 px-6">
                        {row.officerName ?? <span className="text-xs text-destructive">No officer assigned</span>}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <Badge variant="success">
                          <CheckCircle />
                          Fully Supplied
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
