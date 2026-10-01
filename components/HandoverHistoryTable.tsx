"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle, Package } from "lucide-react";
import { formatDateTime, formatKg } from "@/utils/formatters";
import type { DistributionRecord } from "@/lib/distribution";
import TxHashBadge from "@/components/goverment/TxHashBadge";
import { Badge } from "@/components/ui/badge";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The officer → farmer handover ledger.
 *
 * One table, two readers: an officer seeing their own handovers and a
 * government administrator auditing someone else's. The rows are identical —
 * only the "Officer" column differs — so this lives in one place rather than
 * being forked per role, the same reason `RequestStatusBadge` is shared.
 */
interface HandoverHistoryTableProps {
  records: DistributionRecord[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Government view names whose handover each row was; an officer only ever sees their own. */
  showOfficer?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}

export default function HandoverHistoryTable({
  records,
  isLoading,
  error,
  onRetry,
  showOfficer = false,
  emptyIcon = Package,
  emptyTitle,
  emptyDescription,
}: HandoverHistoryTableProps) {
  const columnCount = showOfficer ? 8 : 7;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="font-semibold text-muted-foreground py-4 px-6">Date &amp; Time</TableHead>
              {showOfficer && (
                <TableHead className="font-semibold text-muted-foreground py-4 px-6">Officer</TableHead>
              )}
              <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
              <TableHead className="font-semibold text-muted-foreground py-4 px-6">Type</TableHead>
              <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Amount</TableHead>
              <TableHead className="font-semibold text-muted-foreground py-4 px-6">Sack Serials</TableHead>
              <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-center">Burn Tx</TableHead>
              <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableErrorState columns={columnCount} message={error} onRetry={onRetry} />
            ) : isLoading ? (
              <TableSkeletonRows columns={columnCount} />
            ) : records.length === 0 ? (
              <TableEmptyState
                columns={columnCount}
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
              />
            ) : (
              records.map((record) => (
                <TableRow
                  key={record.distributionId}
                  className={`border-border transition-colors group ${
                    record.disputed ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/30"
                  }`}
                >
                  <TableCell className="py-4 px-6 text-muted-foreground">
                    {formatDateTime(record.createdAt)}
                  </TableCell>
                  {showOfficer && (
                    <TableCell className="py-4 px-6 text-foreground">
                      {record.officerName ?? `Officer #${record.officerId}`}
                    </TableCell>
                  )}
                  <TableCell className="py-4 px-6 font-medium text-foreground">
                    {record.farmerName ?? `Farmer #${record.farmerId}`}
                  </TableCell>
                  <TableCell className="py-4 px-6">{record.fertilizerType ?? "-"}</TableCell>
                  <TableCell className="py-4 px-6 text-right tabular-nums font-medium text-foreground">
                    {formatKg(record.amountDispensedKg)}
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {record.sackSerials.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        record.sackSerials.map((serial) => (
                          <span
                            key={serial}
                            className="font-mono text-xs bg-muted px-2 py-0.5 rounded"
                          >
                            {serial}
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-6 text-center">
                    <TxHashBadge transactionHash={record.burnTransactionHash} groupHover />
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    {record.disputed ? (
                      <Badge
                        variant="destructive"
                        title={
                          record.disputedAt
                            ? `Disputed on ${formatDateTime(record.disputedAt)}`
                            : undefined
                        }
                      >
                        <AlertTriangle />
                        Disputed by farmer
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        <CheckCircle />
                        Completed
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
