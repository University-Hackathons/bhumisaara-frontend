"use client";

import { useCallback, useMemo, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { useApiList } from "@/hooks/use-api-resource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
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
import { toast } from "sonner";
import { CheckCircle, Loader2, MapPin, UserCheck, Users } from "lucide-react";

interface Area {
  areaId: number;
  areaName: string;
  district: string;
}

interface Officer {
  userId: number;
  username: string;
  email: string;
  role: string | null;
  isAssigned: boolean;
  // Null until the officer has been assigned to an area.
  areaId: number | null;
  areaName: string | null;
  district: string | null;
}

export default function OfficerAssign() {
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Both lists are government-admin scoped, so a 403 on either means the
  // signed-in user can't run this screen at all — surface the first failure.
  const officersQuery = useApiList<Officer>(["officers"], apiPaths.officers.list, {
    errorMessage: "Could not load officers.",
  });
  const areasQuery = useApiList<Area>(["areas"], apiPaths.areas.list, {
    errorMessage: "Could not load areas.",
  });

  const officers = officersQuery.data;
  const areas = areasQuery.data;
  const isLoading = officersQuery.isLoading || areasQuery.isLoading;
  const loadError = officersQuery.error ?? areasQuery.error;

  const loadData = useCallback(async () => {
    await Promise.all([officersQuery.refetch(), areasQuery.refetch()]);
  }, [officersQuery, areasQuery]);

  const selectedOfficer = useMemo(
    () => officers.find((officer) => String(officer.userId) === selectedOfficerId),
    [officers, selectedOfficerId]
  );

  const selectedArea = useMemo(
    () => areas.find((area) => String(area.areaId) === selectedAreaId),
    [areas, selectedAreaId]
  );

  const assignedCount = useMemo(
    () => officers.filter((officer) => officer.isAssigned).length,
    [officers]
  );

  // Re-assigning to the area the officer already holds is a no-op, so block it.
  const isNoOpAssignment = Boolean(
    selectedOfficer && selectedArea && selectedOfficer.areaId === selectedArea.areaId
  );

  const isFormValid = Boolean(selectedOfficer && selectedArea) && !isNoOpAssignment;

  const handleAssign = async () => {
    if (!isFormValid || !selectedOfficer || !selectedArea) {
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Assigning officer to area...");

    try {
      await axiosInstance.post(apiPaths.officers.assign, {
        officerId: selectedOfficer.userId,
        areaId: selectedArea.areaId,
      });

      await loadData();

      toast.dismiss(toastId);
      toast.success("Officer assigned successfully!", {
        description: `${selectedOfficer.username} → ${selectedArea.areaName}, ${selectedArea.district}`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      setSelectedOfficerId("");
      setSelectedAreaId("");
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Could not assign the officer.", {
        description: describeApiError(error, "Please check server connection."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Assign Officers to Areas</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Attach agrarian service officers to the area they serve.
            </p>
          </div>
          <Badge variant="secondary" className="px-4 py-2 text-sm">
            <Users className="w-4 h-4" />
            {assignedCount} of {officers.length} officers assigned
          </Badge>
        </div>

        {/* A failed load is surfaced in the assignments table below rather than
            replacing the page, so the form keeps its place. */}
        <>
          <>
            {/* Assignment form */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-foreground">New Assignment</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Step 1: Officer */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                      1
                    </span>
                    Select Officer
                  </label>
                  <Select
                    value={selectedOfficerId}
                    onValueChange={(value) => setSelectedOfficerId(value ? String(value) : "")}
                    disabled={isSaving || isLoading || officers.length === 0}
                  >
                    <SelectTrigger className="w-full h-14 bg-background text-base">
                      {/* Base UI renders the raw value unless given a function
                          child, which would show the userId instead of a label. */}
                      <SelectValue>
                        {(value) =>
                          officers.find((officer) => String(officer.userId) === String(value ?? ""))
                            ?.email ?? (isLoading ? "Loading officers..." : "Choose an officer")
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {officers.map((officer) => (
                        <SelectItem key={officer.userId} value={String(officer.userId)}>
                          {officer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isLoading && officers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No users hold the AGRARIAN_SERVICE_OFFICER role yet.
                    </p>
                  )}
                </div>

                {/* Step 2: Area */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                      2
                    </span>
                    Select Area
                  </label>
                  <Select
                    value={selectedAreaId}
                    onValueChange={(value) => setSelectedAreaId(value ? String(value) : "")}
                    disabled={isSaving || isLoading || areas.length === 0}
                  >
                    <SelectTrigger className="w-full h-14 bg-background text-base">
                      <SelectValue>
                        {(value) => {
                          const area = areas.find((item) => String(item.areaId) === String(value ?? ""));
                          return area
                            ? `${area.areaName} · ${area.district}`
                            : isLoading
                              ? "Loading areas..."
                              : "Choose an area";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem key={area.areaId} value={String(area.areaId)}>
                          {area.areaName} · {area.district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isLoading && areas.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No areas exist yet - the areas table is empty.
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="md:col-span-2 pt-2 border-t border-border flex flex-col gap-3">
                  {selectedOfficer && selectedOfficer.isAssigned && selectedOfficer.areaName && !isNoOpAssignment && (
                    <p className="text-xs text-muted-foreground">
                      {selectedOfficer.username} is currently assigned to {selectedOfficer.areaName}. Assigning
                      again will move them.
                    </p>
                  )}
                  {isNoOpAssignment && selectedOfficer && (
                    <p className="text-xs text-muted-foreground">
                      {selectedOfficer.username} is already assigned to this area.
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={handleAssign}
                    disabled={!isFormValid || isSaving}
                    className="w-full md:w-auto md:self-end h-12 px-8 text-sm font-semibold shadow-md hover:shadow-lg rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      "Assign Officer"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Current assignments */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">Current Assignments</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Officer</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Email</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Area</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">District</TableHead>
                      <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadError ? (
                      <TableErrorState columns={5} message={loadError} onRetry={loadData} />
                    ) : isLoading ? (
                      <TableSkeletonRows columns={5} />
                    ) : officers.length === 0 ? (
                      <TableEmptyState
                        columns={5}
                        icon={Users}
                        title="No officers found"
                        description="Users who register with the agrarian service officer role appear here."
                      />
                    ) : (
                      officers.map((officer) => (
                        <TableRow key={officer.userId} className="border-border hover:bg-muted/30 transition-colors">
                          <TableCell className="py-4 px-6 font-medium text-foreground">{officer.username}</TableCell>
                          <TableCell className="py-4 px-6 text-muted-foreground">{officer.email}</TableCell>
                          <TableCell className="py-4 px-6">{officer.areaName ?? "-"}</TableCell>
                          <TableCell className="py-4 px-6">{officer.district ?? "-"}</TableCell>
                          <TableCell className="py-4 px-6">
                            {officer.isAssigned ? (
                              <Badge variant="success">
                                <CheckCircle />
                                Assigned
                              </Badge>
                            ) : (
                              <Badge variant="muted">Unassigned</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        </>
      </main>
    </div>
  );
}
