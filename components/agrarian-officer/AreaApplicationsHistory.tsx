"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatKg } from "@/utils/formatters";
import { useAreaFertilizerRequests } from "@/hooks/use-fertilizer-requests";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, Clock, FileText } from "lucide-react";
import RequestStatusBadge from "@/components/RequestStatusBadge";
import type { RequestStatus } from "@/lib/fertilizerRequests";

const STATUS_FILTERS: { value: RequestStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PARTIALLY_COLLECTED", label: "Partly collected" },
  { value: "COLLECTED", label: "Collected" },
];

export default function AreaApplicationsHistory() {
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "ALL">("ALL");

  const {
    data: requests,
    isLoading,
    error: loadError,
    refetch: loadRequests,
  } = useAreaFertilizerRequests(statusFilter);

  const areaLabel = useMemo(() => {
    const withArea = requests.find((request) => request.areaName);
    return withArea ? `${withArea.areaName}, ${withArea.district}` : null;
  }, [requests]);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "PENDING").length,
    [requests]
  );

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow pt-4 px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Application History</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Every fertilizer application from farmers in
              {areaLabel ? ` ${areaLabel}` : " your area"}, newest first.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && statusFilter !== "PENDING" && (
              <Badge variant="warning" className="px-4 py-2 text-sm">
                <Clock className="w-4 h-4" />
                {pendingCount} still pending
              </Badge>
            )}
            <Link
              href="/request-approvals"
              className={cn(buttonVariants({ variant: "default" }), "w-fit h-10 px-4 gap-2")}
            >
              <ClipboardCheck className="w-4 h-4" />
              Review queue
            </Link>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden min-w-0">
          <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">Area Applications</h2>
            <div className="flex items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value ? (String(value) as RequestStatus | "ALL") : "ALL")
                }
                disabled={isLoading}
              >
                <SelectTrigger className="w-[170px] h-9 bg-background">
                  <SelectValue>
                    {(value) =>
                      STATUS_FILTERS.find((filter) => filter.value === String(value ?? ""))?.label ??
                      "All statuses"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadRequests} disabled={isLoading}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Submitted</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Season</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Fertilizer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Requested</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Approved</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Reviewed By</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Reviewed On</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadError ? (
                  <TableErrorState columns={9} message={loadError} onRetry={loadRequests} />
                ) : isLoading ? (
                  <TableSkeletonRows columns={9} />
                ) : requests.length === 0 ? (
                  <TableEmptyState
                    columns={9}
                    icon={FileText}
                    title={
                      statusFilter === "ALL"
                        ? "No applications in your area yet"
                        : `No ${statusFilter.replace("_", " ").toLowerCase()} applications`
                    }
                    description={
                      statusFilter === "ALL"
                        ? "Applications appear here as soon as a farmer assigned to your area submits one."
                        : "Try a different status filter to see the rest of your area's applications."
                    }
                  />
                ) : (
                  requests.map((request) => (
                    <TableRow
                      key={request.requestId}
                      className="border-border hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        {request.farmerUsername}
                      </TableCell>
                      <TableCell className="py-4 px-6">{request.season}</TableCell>
                      <TableCell className="py-4 px-6">{request.fertilizerType}</TableCell>
                      <TableCell className="py-4 px-6">{formatKg(request.requestedKg)}</TableCell>
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        {request.approvedKg != null ? formatKg(request.approvedKg) : "-"}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {request.reviewedByOfficerUsername ?? "-"}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {formatDate(request.reviewedAt)}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <RequestStatusBadge status={request.status} />
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
