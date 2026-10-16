"use client";

import { useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatDate, formatKg } from "@/utils/formatters";
import { usePendingFertilizerRequests } from "@/hooks/use-fertilizer-requests";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { CheckCircle, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import type { FertilizerRequest } from "@/lib/fertilizerRequests";

export default function RequestApprovals() {
  const { t } = useLanguage();
  const {
    data: requests,
    isLoading,
    error: loadError,
    refetch: loadRequests,
  } = usePendingFertilizerRequests();

  // Only the amounts the officer has actually typed. Anything untouched falls
  // back to requestedKg at render time, so a full approval stays a single click
  // without an effect seeding state behind the queue.
  const [editedKgById, setEditedKgById] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const approvedKgFor = (request: FertilizerRequest) =>
    editedKgById[request.requestId] ?? String(request.requestedKg);

  const review = async (
    request: FertilizerRequest,
    status: "APPROVED" | "REJECTED"
  ) => {
    const rawAmount = approvedKgFor(request);
    const approvedKg = Number(rawAmount);

    if (status === "APPROVED") {
      if (!rawAmount || !Number.isInteger(approvedKg) || approvedKg <= 0) {
        toast.error("Enter a whole approved amount greater than zero.");
        return;
      }
      if (approvedKg > request.requestedKg) {
        toast.error(`Approved amount cannot exceed the ${request.requestedKg}kg requested.`);
        return;
      }
    }

    setSavingId(request.requestId);
    const toastId = toast.loading(
      status === "APPROVED" ? "Approving request..." : "Rejecting request..."
    );

    try {
      await axiosInstance.patch(apiPaths.fertilizerRequests.review(request.requestId), {
        status,
        // The backend rejects approved_kg on a rejection, so only send it on approve.
        ...(status === "APPROVED" ? { approvedKg } : {}),
      });

      await loadRequests();

      toast.dismiss(toastId);
      if (status === "APPROVED") {
        toast.success("Request approved!", {
          description: `${formatKg(approvedKg)} of ${request.fertilizerType} for ${request.farmerUsername}`,
          icon: <CheckCircle className="w-5 h-5 text-primary" />,
        });
      } else {
        toast.success("Request rejected.", {
          description: `${request.farmerUsername} · ${request.season}`,
        });
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(
        status === "APPROVED" ? "Could not approve the request." : "Could not reject the request.",
        { description: describeApiError(error, "Please check server connection.") }
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">{t("Fertilizer Request Approvals")}</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Pending requests from farmers in your assigned area.
            </p>
          </div>
          <Badge variant="secondary" className="px-4 py-2 text-sm">
            <ClipboardCheck className="w-4 h-4" />
            {requests.length} awaiting review
          </Badge>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">{t("Review Queue")}</h2>
            <Button variant="outline" size="sm" onClick={loadRequests} disabled={isLoading}>
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Submitted</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Farmer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Season</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Type</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Requested</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Approve (KG)</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadError ? (
                  <TableErrorState columns={7} message={loadError} onRetry={loadRequests} />
                ) : isLoading ? (
                  <TableSkeletonRows columns={7} />
                ) : requests.length === 0 ? (
                  <TableEmptyState
                    columns={7}
                    icon={ClipboardCheck}
                    title="No pending requests in your area"
                    description="Applications from farmers assigned to your area land here for review."
                  />
                ) : (
                  requests.map((request) => {
                    const isSaving = savingId === request.requestId;

                    return (
                      <TableRow key={request.requestId} className="border-border hover:bg-muted/30 transition-colors">
                        <TableCell className="py-4 px-6 text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </TableCell>
                        <TableCell className="py-4 px-6 font-medium text-foreground">
                          {request.farmerUsername}
                        </TableCell>
                        <TableCell className="py-4 px-6">{request.season}</TableCell>
                        <TableCell className="py-4 px-6">{request.fertilizerType}</TableCell>
                        <TableCell className="py-4 px-6">{formatKg(request.requestedKg)}</TableCell>
                        <TableCell className="py-4 px-6">
                          <Input
                            type="number"
                            min="1"
                            max={request.requestedKg}
                            step="1"
                            value={approvedKgFor(request)}
                            onChange={(e) =>
                              setEditedKgById((current) => ({
                                ...current,
                                [request.requestId]: e.target.value,
                              }))
                            }
                            disabled={isSaving}
                            className="h-10 w-24 bg-background"
                          />
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => review(request, "REJECTED")}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <XCircle className="w-4 h-4" />
                              {t("Reject")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => review(request, "APPROVED")}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              {t("Approve")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
