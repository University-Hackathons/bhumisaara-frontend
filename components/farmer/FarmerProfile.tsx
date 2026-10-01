"use client";

import { useCallback, useMemo, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { useApiList, useApiResource } from "@/hooks/use-api-resource";
import ProfileDetailsForm from "@/components/ProfileDetailsForm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { MapPin, Loader2, CheckCircle } from "lucide-react";

interface Area {
  areaId: number;
  areaName: string;
  district: string;
}

interface FarmerArea {
  userId: number;
  username: string;
  areaId: number | null;
  areaName: string | null;
  district: string | null;
}

export default function FarmerProfile() {
  // ─── Service area ─────────────────────────────────────────────────────────
  // Kept separate from the details form above: it writes to its own endpoint
  // and decides which officer reviews this farmer's requests.
  const areasQuery = useApiList<Area>(["areas"], apiPaths.areas.list, {
    errorMessage: "Could not load areas.",
  });
  const myAreaQuery = useApiResource<FarmerArea>(["farmer", "area"], apiPaths.farmers.myArea, {
    errorMessage: "Could not load your service area.",
  });

  const areas = areasQuery.data;
  const savedArea = myAreaQuery.data ?? null;
  const isAreaLoading = areasQuery.isLoading || myAreaQuery.isLoading;
  const areaLoadError = areasQuery.error ?? myAreaQuery.error;

  const loadAreaData = useCallback(async () => {
    await Promise.all([areasQuery.refetch(), myAreaQuery.refetch()]);
  }, [areasQuery, myAreaQuery]);

  // Only what the user has picked this session; the saved values show through
  // underneath, so the form opens on current state without seeding state in an
  // effect.
  const [districtChoice, setDistrictChoice] = useState<string | null>(null);
  const [areaChoice, setAreaChoice] = useState<string | null>(null);
  const [isSavingArea, setIsSavingArea] = useState(false);

  const selectedDistrict = districtChoice ?? savedArea?.district ?? "";
  const selectedAreaId =
    areaChoice ?? (savedArea?.areaId != null ? String(savedArea.areaId) : "");

  const districts = useMemo(
    () => Array.from(new Set(areas.map((area) => area.district))).sort(),
    [areas]
  );

  const areasInDistrict = useMemo(
    () => areas.filter((area) => area.district === selectedDistrict),
    [areas, selectedDistrict]
  );

  const isAreaDirty = selectedAreaId !== "" && Number(selectedAreaId) !== savedArea?.areaId;

  const handleDistrictChange = (district: string) => {
    setDistrictChoice(district);
    // The previously chosen area belongs to the old district — clear it.
    setAreaChoice("");
  };

  const handleSaveArea = async () => {
    if (!isAreaDirty) return;

    setIsSavingArea(true);
    const toastId = toast.loading("Saving your service area...");

    try {
      const { data } = await axiosInstance.patch<FarmerArea>(apiPaths.farmers.myArea, {
        areaId: Number(selectedAreaId),
      });

      await myAreaQuery.refetch();

      toast.dismiss(toastId);
      toast.success("Service area updated!", {
        description: `${data.areaName}, ${data.district}`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Could not update your service area.", {
        description: describeApiError(error, "Please check server connection."),
      });
    } finally {
      setIsSavingArea(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-8xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">My Profile</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Manage your personal information and the area that serves you.
          </p>
        </div>

        <ProfileDetailsForm
          description="Your officer uses these details to identify you at collection."
          addressPlaceholder="e.g. 123, Kandy Road, Peradeniya"
        />

        {/* Service Area — its own endpoint, its own save button. */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-primary/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-primary">Service Area</CardTitle>
                <CardDescription>
                  Determines which agrarian service officer reviews your fertilizer requests.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {areaLoadError ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-destructive">{areaLoadError}</p>
                <Button type="button" variant="outline" onClick={loadAreaData}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                  {isAreaLoading ? (
                    <Skeleton className="h-5 w-64" />
                  ) : savedArea?.areaId != null ? (
                    <span className="text-foreground">
                      Currently assigned to{" "}
                      <span className="font-semibold">
                        {savedArea.areaName}, {savedArea.district}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      No area set yet - you can&apos;t submit fertilizer requests until you pick one.
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">District</label>
                    <Select
                      value={selectedDistrict}
                      onValueChange={(value) => handleDistrictChange(value ? String(value) : "")}
                      disabled={isAreaLoading || isSavingArea || districts.length === 0}
                    >
                      <SelectTrigger className="w-full h-10 bg-background">
                        <SelectValue placeholder={isAreaLoading ? "Loading..." : "Select district"} />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Area</label>
                    <Select
                      value={selectedAreaId}
                      onValueChange={(value) => setAreaChoice(value ? String(value) : "")}
                      disabled={isAreaLoading || isSavingArea || !selectedDistrict}
                    >
                      <SelectTrigger className="w-full h-10 bg-background">
                        {/* Function child required: Base UI otherwise renders the
                            raw value, which here is the numeric areaId. */}
                        <SelectValue>
                          {(value) =>
                            areas.find((area) => String(area.areaId) === String(value ?? ""))
                              ?.areaName ??
                            (selectedDistrict ? "Select area" : "Select a district first")
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {areasInDistrict.map((area) => (
                          <SelectItem key={area.areaId} value={String(area.areaId)}>
                            {area.areaName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!isAreaLoading && districts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No areas exist yet - ask an administrator to add them.
                  </p>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4 flex justify-end">
            <Button
              type="button"
              onClick={handleSaveArea}
              disabled={!isAreaDirty || isSavingArea || isAreaLoading}
              className="h-10 px-6 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingArea ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Area"
              )}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
