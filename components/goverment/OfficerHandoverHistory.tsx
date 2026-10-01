"use client";

import { useMemo, useState } from "react";
import { useAllDistributions } from "@/hooks/use-distributions";
import { useApiList } from "@/hooks/use-api-resource";
import apiPaths from "@/utils/apiPaths";
import { formatKg } from "@/utils/formatters";
import HandoverHistoryTable from "@/components/HandoverHistoryTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Package, RefreshCw, UserCheck } from "lucide-react";

interface Officer {
  userId: number;
  username: string;
  areaName: string | null;
  district: string | null;
}

const ALL_OFFICERS = "ALL";

/**
 * The government's audit view of officer → farmer handovers.
 *
 * The officer's own screen answers "what have I dispensed"; this one answers
 * "what has *that* officer dispensed, and did any farmer dispute it" — the
 * disputes are the reason this exists, since only the farmer can raise one and
 * nothing reverses it automatically.
 *
 * `GET /distributions` already returns every handover nationally with its
 * officer attached, so the filtering is done here rather than asking the
 * backend for a per-officer endpoint that would return the same rows.
 */
export default function OfficerHandoverHistory() {
  const [officerFilter, setOfficerFilter] = useState<string>(ALL_OFFICERS);

  const {
    data: distributions,
    isLoading,
    error: loadError,
    refetch: loadDistributions,
  } = useAllDistributions();

  const officersQuery = useApiList<Officer>(["officers"], apiPaths.officers.list, {
    errorMessage: "Could not load the officer list.",
  });

  const visible = useMemo(
    () =>
      officerFilter === ALL_OFFICERS
        ? distributions
        : distributions.filter((record) => String(record.officerId) === officerFilter),
    [distributions, officerFilter]
  );

  const totals = useMemo(() => {
    const dispensedKg = visible.reduce(
      (sum, record) => sum + Number(record.amountDispensedKg || 0),
      0
    );
    return {
      dispensedKg,
      disputedCount: visible.filter((record) => record.disputed).length,
    };
  }, [visible]);

  const officerLabel = (officer: Officer) =>
    officer.areaName
      ? `${officer.username} · ${officer.areaName}`
      : `${officer.username} · no area`;

  const selectedOfficerName =
    officersQuery.data.find((officer) => String(officer.userId) === officerFilter)?.username ?? null;

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Officer Handover History</h1>
            <p className="text-lg text-muted-foreground">
              Every handover an officer has made to a farmer, with the disputes farmers raised.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && visible.length > 0 && (
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                <Package className="w-4 h-4" />
                {formatKg(totals.dispensedKg)} over {visible.length}{" "}
                {visible.length === 1 ? "handover" : "handovers"}
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={loadDistributions}
              disabled={isLoading}
              className="flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Officer picker */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <label className="text-sm font-medium text-foreground">Officer</label>
          </div>
          <Select
            value={officerFilter}
            onValueChange={(value) => setOfficerFilter(value ? String(value) : ALL_OFFICERS)}
            disabled={officersQuery.isLoading || officersQuery.data.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[22rem] h-10 bg-background">
              {/* Function child: Base UI renders the raw value otherwise, which
                  here would be the numeric user id. */}
              <SelectValue>
                {(value) => {
                  if (String(value ?? "") === ALL_OFFICERS) return "All officers";
                  const officer = officersQuery.data.find(
                    (item) => String(item.userId) === String(value ?? "")
                  );
                  return officer
                    ? officerLabel(officer)
                    : officersQuery.isLoading
                      ? "Loading officers..."
                      : "All officers";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OFFICERS}>All officers</SelectItem>
              {officersQuery.data.map((officer) => (
                <SelectItem key={officer.userId} value={String(officer.userId)}>
                  {officerLabel(officer)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!officersQuery.isLoading && officersQuery.data.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No officers exist yet - assign one from the Assign Officers screen.
            </p>
          )}
        </div>

        {/* Disputes are the point of this screen, so they are called out rather
            than left for the reader to spot among the rows. */}
        {!isLoading && totals.disputedCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {totals.disputedCount} {totals.disputedCount === 1 ? "handover is" : "handovers are"}{" "}
            disputed by the farmer
            {selectedOfficerName ? ` for ${selectedOfficerName}` : ""} - the rows in red below.
            Raising a dispute reverses nothing; the tokens are already burned.
          </div>
        )}

        <HandoverHistoryTable
          records={visible}
          isLoading={isLoading}
          error={loadError}
          onRetry={loadDistributions}
          showOfficer
          emptyTitle={
            officerFilter === ALL_OFFICERS
              ? "No handovers recorded yet"
              : "No handovers by this officer"
          }
          emptyDescription={
            officerFilter === ALL_OFFICERS
              ? "Handovers appear here as officers dispense fertilizer to farmers in their areas."
              : "Pick a different officer, or All officers, to see the rest of the national ledger."
          }
        />
      </main>
    </div>
  );
}
