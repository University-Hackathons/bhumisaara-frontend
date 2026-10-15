"use client";

import { useOfficerDistributions } from "@/hooks/use-distributions";
import { useApiResource } from "@/hooks/use-api-resource";
import apiPaths from "@/utils/apiPaths";
import { formatKg } from "@/utils/formatters";
import HandoverHistoryTable from "@/components/HandoverHistoryTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, RefreshCw } from "lucide-react";

export default function OwnDistribution() {
  const {
    data: distributions,
    isLoading,
    error: loadError,
    refetch: loadDistributions,
    hasMore, loadMore, isLoadingMore,
  } = useOfficerDistributions();
  const statsQuery = useApiResource<{ count: number; dispensedKg: number; disputedCount: number }>(
    ["distributions", "officer", "stats"], `${apiPaths.distributions.officer}/stats`);

  const totals = statsQuery.data ?? { count: 0, dispensedKg: 0, disputedCount: 0 };
  const refresh = () => Promise.all([loadDistributions(), statsQuery.refetch()]);

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Handover History</h1>
            <p className="text-lg text-muted-foreground">
              Every fertilizer handover you have processed, newest first.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && distributions.length > 0 && (
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                <Package className="w-4 h-4" />
                {formatKg(totals.dispensedKg)} over {totals.count}{" "}
                {totals.count === 1 ? "handover" : "handovers"}
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Farmers who say a handover never reached them */}
        {!isLoading && totals.disputedCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {totals.disputedCount} {totals.disputedCount === 1 ? "handover is" : "handovers are"}{" "}
            disputed by the farmer - the rows in red below.
          </div>
        )}

        <HandoverHistoryTable
          records={distributions}
          isLoading={isLoading}
          error={loadError}
          onRetry={refresh}
          emptyTitle="No handovers recorded yet"
          emptyDescription="Once you dispense fertilizer to a farmer, every handover appears here with its burn transaction."
        />
        {hasMore && <div className="flex justify-center"><Button variant="outline" disabled={isLoadingMore} onClick={() => loadMore()}>{isLoadingMore ? "Loading..." : "Load more"}</Button></div>}
      </main>
    </div>
  );
}
