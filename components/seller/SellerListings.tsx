"use client";

import { useCallback, useMemo, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatKg, formatDateTime } from "@/utils/formatters";
import { formatLkr } from "@/lib/marketplace";
import type { ListingStatus, ProductListing } from "@/lib/marketplace";
import { useAuth } from "@/context/AuthContext";
import { useMyListings } from "@/hooks/use-listings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { TableEmptyState, TableErrorState, TableSkeletonRows } from "@/components/ui/table-states";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  Leaf,
  Loader2,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";

/**
 * The listings screen for both seller roles.
 *
 * Deliberately one component rather than a dealer copy and a producer copy: the
 * only difference between them is the organic flag, which the *server* derives
 * from the caller's role and never accepts from this form. Forking it would
 * mean two files to edit and two chances to let a dealer sell "organic".
 */

/**
 * Base UI renders the *raw* value in a select trigger unless `SelectValue` is
 * given a function child — which is why this form used to show "ACTIVE" and
 * "Yes" once a choice was made. `label` is what the trigger shows; `hint`
 * spells the consequence out in the open dropdown, where there is room for it.
 */
const LISTING_STATUSES: { value: "ACTIVE" | "PAUSED"; label: string; hint: string }[] = [
  { value: "ACTIVE", label: "Active", hint: "visible to farmers" },
  { value: "PAUSED", label: "Paused", hint: "hidden from the marketplace" },
];

const SUBSIDY_CHOICES: { value: "Yes" | "No"; label: string }[] = [
  { value: "Yes", label: "Accepted" },
  { value: "No", label: "Cash only" },
];

/** Resolves the label Base UI should show for the currently selected value. */
const labelFor = (
  options: { value: string; label: string }[],
  value: unknown,
  fallback: string
) => options.find((option) => option.value === String(value ?? ""))?.label ?? fallback;

interface ListingForm {
  productName: string;
  fertilizerType: string;
  description: string;
  priceLkrPerKg: string;
  availableKg: string;
  isSubsidyEligible: boolean;
  status: Exclude<ListingStatus, "SOLD_OUT">;
}

const EMPTY_FORM: ListingForm = {
  productName: "",
  fertilizerType: "",
  description: "",
  priceLkrPerKg: "",
  availableKg: "",
  isSubsidyEligible: true,
  status: "ACTIVE",
};

const STATUS_VARIANT: Record<ListingStatus, "success" | "warning" | "muted"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  SOLD_OUT: "muted",
};

const STATUS_LABEL: Record<ListingStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  SOLD_OUT: "Sold out",
};

export default function SellerListings() {
  const { user } = useAuth();
  const listingsQuery = useMyListings();

  const [form, setForm] = useState<ListingForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyListingId, setBusyListingId] = useState<number | null>(null);

  const listings = listingsQuery.data;

  // Mirrors the server's rule: producers sell organic, dealers sell chemical.
  // Shown, never chosen — the form has no control for it.
  const isOrganicSeller = user?.role === "ORGANIC_FERTILIZER_PRODUCER";

  const isFormValid = Boolean(
    form.productName.trim() &&
      form.fertilizerType.trim() &&
      Number(form.priceLkrPerKg) > 0 &&
      Number(form.availableKg) >= 0 &&
      form.availableKg !== ""
  );

  const totalAvailableKg = useMemo(
    () => listings.reduce((total, listing) => total + listing.availableKg, 0),
    [listings]
  );

  const activeCount = useMemo(
    () => listings.filter((listing) => listing.status === "ACTIVE").length,
    [listings]
  );

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }, []);

  const startEdit = (listing: ProductListing) => {
    setEditingId(listing.listingId);
    setForm({
      productName: listing.productName,
      fertilizerType: listing.fertilizerType,
      description: listing.description ?? "",
      priceLkrPerKg: String(listing.priceLkrPerKg),
      availableKg: String(listing.availableKg),
      isSubsidyEligible: listing.isSubsidyEligible,
      // SOLD_OUT is derived from the quantity, so it is never an editable choice.
      status: listing.status === "SOLD_OUT" ? "ACTIVE" : listing.status,
    });
  };

  const buildPayload = () => ({
    productName: form.productName.trim(),
    fertilizerType: form.fertilizerType.trim(),
    description: form.description.trim() || null,
    priceLkrPerKg: Number(form.priceLkrPerKg),
    availableKg: Number(form.availableKg),
    isSubsidyEligible: form.isSubsidyEligible,
    status: form.status,
  });

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsSaving(true);
    const toastId = toast.loading(editingId ? "Updating listing..." : "Publishing listing...");

    try {
      if (editingId) {
        await axiosInstance.put(apiPaths.listings.update(editingId), buildPayload());
      } else {
        await axiosInstance.post(apiPaths.listings.create, buildPayload());
      }

      toast.dismiss(toastId);
      toast.success(editingId ? "Listing updated." : "Listing published to the marketplace.", {
        description: form.productName.trim(),
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      resetForm();
      await listingsQuery.refetch();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(editingId ? "Could not update the listing." : "Could not publish the listing.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setIsSaving(false);
    }
  };

  /** Pause/resume without retyping the whole listing. */
  const handleToggleStatus = async (listing: ProductListing) => {
    const nextStatus: Exclude<ListingStatus, "SOLD_OUT"> =
      listing.status === "PAUSED" ? "ACTIVE" : "PAUSED";

    setBusyListingId(listing.listingId);

    try {
      await axiosInstance.put(apiPaths.listings.update(listing.listingId), {
        productName: listing.productName,
        fertilizerType: listing.fertilizerType,
        description: listing.description,
        priceLkrPerKg: listing.priceLkrPerKg,
        availableKg: listing.availableKg,
        isSubsidyEligible: listing.isSubsidyEligible,
        status: nextStatus,
      });

      toast.success(
        nextStatus === "PAUSED" ? "Listing paused." : "Listing is live again.",
        { icon: <CheckCircle className="w-5 h-5 text-primary" /> }
      );

      await listingsQuery.refetch();
    } catch (error) {
      toast.error("Could not change the listing status.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setBusyListingId(null);
    }
  };

  const handleDelete = async (listing: ProductListing) => {
    setBusyListingId(listing.listingId);

    try {
      await axiosInstance.delete(apiPaths.listings.remove(listing.listingId));

      toast.success("Listing removed.", {
        description: listing.productName,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      if (editingId === listing.listingId) resetForm();
      await listingsQuery.refetch();
    } catch (error) {
      // The backend refuses a delete while orders are still riding on the
      // listing, and its message names that reason — surface it verbatim.
      toast.error("Could not remove the listing.", {
        description: describeApiError(error, "Please check server connection."),
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
      });
    } finally {
      setBusyListingId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">My Listings</h1>
            <p className="text-lg text-muted-foreground mt-1">
              What farmers can buy from you, and what they can pay with.
            </p>
          </div>
          <Badge variant={isOrganicSeller ? "success" : "info"} className="text-sm px-3 py-1.5 w-fit">
            {isOrganicSeller ? <Leaf /> : <Package />}
            {isOrganicSeller ? "Organic producer" : "Agro-dealer"}
          </Badge>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Listings</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{listings.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Live on the marketplace</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Stock listed</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {formatKg(totalAvailableKg)}
            </p>
          </div>
        </div>

        {/* ─── The form ─────────────────────────────────────────────────── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <CardTitle className="text-xl font-semibold text-foreground">
                  {editingId ? "Edit Listing" : "New Listing"}
                </CardTitle>
              </div>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  disabled={isSaving}
                  className="text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Cancel edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={(event) => event.preventDefault()} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="productName" className="block text-sm font-medium text-foreground">
                    Product name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="productName"
                    value={form.productName}
                    onChange={(event) => setForm({ ...form, productName: event.target.value })}
                    placeholder={isOrganicSeller ? "e.g. Composted Cattle Manure" : "e.g. Urea Prilled 46% N"}
                    disabled={isSaving}
                    className="h-11 bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="fertilizerType" className="block text-sm font-medium text-foreground">
                    Fertilizer type <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="fertilizerType"
                    value={form.fertilizerType}
                    onChange={(event) => setForm({ ...form, fertilizerType: event.target.value })}
                    placeholder={isOrganicSeller ? "e.g. Compost" : "e.g. Urea"}
                    disabled={isSaving}
                    className="h-11 bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="priceLkrPerKg" className="block text-sm font-medium text-foreground">
                    Price per kg (LKR) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="priceLkrPerKg"
                    type="number"
                    min="1"
                    step="1"
                    value={form.priceLkrPerKg}
                    onChange={(event) => setForm({ ...form, priceLkrPerKg: event.target.value })}
                    placeholder="e.g. 320"
                    disabled={isSaving}
                    className="h-11 bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="availableKg" className="block text-sm font-medium text-foreground">
                    Available quantity (kg) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="availableKg"
                    type="number"
                    min="0"
                    step="1"
                    value={form.availableKg}
                    onChange={(event) => setForm({ ...form, availableKg: event.target.value })}
                    placeholder="e.g. 5000"
                    disabled={isSaving}
                    className="h-11 bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Zero marks the listing sold out until you restock.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="status" className="block text-sm font-medium text-foreground">
                    Visibility
                  </label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm({ ...form, status: (value as "ACTIVE" | "PAUSED") || "ACTIVE" })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger id="status" className="w-full h-11 bg-background">
                      <SelectValue>
                        {(value) => labelFor(LISTING_STATUSES, value, "Choose visibility")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LISTING_STATUSES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} - {option.hint}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="isSubsidyEligible" className="block text-sm font-medium text-foreground">
                    Subsidy credits
                  </label>
                  <Select
                    value={form.isSubsidyEligible ? "Yes" : "No"}
                    onValueChange={(value) =>
                      setForm({ ...form, isSubsidyEligible: String(value) === "Yes" })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger id="isSubsidyEligible" className="w-full h-11 bg-background">
                      <SelectValue>
                        {(value) => labelFor(SUBSIDY_CHOICES, value, "Accept subsidy credits?")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSIDY_CHOICES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {isOrganicSeller
                      ? "Organic: one credit covers 1.5kg for the farmer."
                      : "Chemical: one credit covers 1kg for the farmer."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Composition, packaging, collection details…"
                  disabled={isSaving}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || isSaving}
                  className="h-11 px-6 text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {editingId ? "Save changes" : "Publish listing"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ─── The listings ─────────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Your Products</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Product</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Type</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Price / kg</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Available</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Credits</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6">Status</TableHead>
                  <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listingsQuery.error ? (
                  <TableErrorState
                    columns={7}
                    message={listingsQuery.error}
                    onRetry={() => listingsQuery.refetch()}
                  />
                ) : listingsQuery.isLoading ? (
                  <TableSkeletonRows columns={7} />
                ) : listings.length === 0 ? (
                  <TableEmptyState
                    columns={7}
                    icon={Package}
                    title="No listings yet"
                    description="Publish your first product above and farmers will see it in the marketplace."
                  />
                ) : (
                  listings.map((listing) => {
                    const isBusy = busyListingId === listing.listingId;

                    return (
                      <TableRow
                        key={listing.listingId}
                        className={`border-border ${
                          editingId === listing.listingId ? "bg-primary/10" : ""
                        }`}
                      >
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{listing.productName}</span>
                            <span className="text-xs text-muted-foreground">
                              Updated {formatDateTime(listing.updatedAt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{listing.fertilizerType}</span>
                            {listing.isOrganic && (
                              <Badge variant="success">
                                <Leaf />
                                Organic
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right tabular-nums text-foreground">
                          {formatLkr(listing.priceLkrPerKg)}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right tabular-nums font-semibold text-foreground">
                          {formatKg(listing.availableKg)}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {listing.isSubsidyEligible ? (
                            <Badge variant="info">1 credit = {listing.kgPerCredit}kg</Badge>
                          ) : (
                            <Badge variant="muted">Cash only</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant={STATUS_VARIANT[listing.status]}>
                            {STATUS_LABEL[listing.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => startEdit(listing)}
                              className="text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isBusy || listing.status === "SOLD_OUT"}
                              onClick={() => handleToggleStatus(listing)}
                              className="text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {listing.status === "PAUSED" ? (
                                <PlayCircle className="w-4 h-4" />
                              ) : (
                                <PauseCircle className="w-4 h-4" />
                              )}
                              <span className="sr-only">
                                {listing.status === "PAUSED" ? "Resume" : "Pause"} {listing.productName}
                              </span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleDelete(listing)}
                              className="text-muted-foreground hover:text-destructive cursor-pointer"
                            >
                              {isBusy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              <span className="sr-only">Delete {listing.productName}</span>
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
