"use client";

import { useFormik } from "formik";
import * as Yup from "yup";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { truncateAddress } from "@/utils/formatters";
import { useMyProfile, type MyProfile } from "@/hooks/use-my-profile";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle, Loader2, User } from "lucide-react";

/**
 * The profile details form, shared by every role's profile screen.
 *
 * The three fields are identical across roles — only the wording around the
 * address changes — so the roles pass labels rather than forking the form.
 * Photo and document uploads are deliberately absent: nothing on the backend
 * stores a file yet, and an upload control that silently discards the file is
 * worse than no control at all.
 */

const validationSchema = Yup.object({
  fullName: Yup.string().trim().required("Full name is required").max(120, "Too long"),
  address: Yup.string().trim().required("Address is required").max(255, "Too long"),
  contactNumber: Yup.string()
    .trim()
    .required("Contact number is required")
    // Mirrors the backend's deliberately permissive pattern.
    .matches(/^\+?[0-9][0-9 -]{6,19}$/, "Enter a valid phone number"),
});

interface ProfileDetailsFormProps {
  /** Card heading, e.g. "Official Details". */
  title?: string;
  description?: string;
  /** Officers call this their agrarian centre; everyone else, an address. */
  addressLabel?: string;
  addressPlaceholder?: string;
}

const initialsOf = (profile: MyProfile | undefined) => {
  const source = profile?.fullName?.trim() || profile?.username?.trim() || "";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || null;
};

export default function ProfileDetailsForm({
  title = "Basic Details",
  description = "Update your contact and personal information.",
  addressLabel = "Address",
  addressPlaceholder = "e.g. 123, Kandy Road, Peradeniya",
}: ProfileDetailsFormProps) {
  const { data: profile, isLoading, error, refetch } = useMyProfile();

  const formik = useFormik({
    // Blank until the profile arrives; `enableReinitialize` fills it in and
    // resets `dirty`, so Save stays disabled until something really changes.
    enableReinitialize: true,
    initialValues: {
      fullName: profile?.fullName ?? "",
      address: profile?.address ?? "",
      contactNumber: profile?.contactNumber ?? "",
    },
    validationSchema,
    onSubmit: async (values) => {
      const toastId = toast.loading("Saving your profile...");

      try {
        await axiosInstance.put(apiPaths.users.myProfile, {
          fullName: values.fullName.trim(),
          address: values.address.trim(),
          contactNumber: values.contactNumber.trim(),
        });

        await refetch();

        toast.dismiss(toastId);
        toast.success("Profile updated!", {
          description: values.fullName.trim(),
          icon: <CheckCircle className="w-5 h-5 text-primary" />,
        });
      } catch (submitError) {
        toast.dismiss(toastId);
        toast.error("Could not save your profile.", {
          description: describeApiError(submitError, "Please check server connection."),
        });
      }
    },
  });

  const isIncomplete =
    !isLoading && !error && !(profile?.fullName && profile?.address && profile?.contactNumber);

  return (
    <form onSubmit={formik.handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Identity — everything here is set elsewhere and shown for context */}
        <div className="md:col-span-4">
          <Card className="border-border shadow-sm h-full">
            <CardContent className="pt-6 flex flex-col items-center space-y-4">
              <div className="w-40 h-40 rounded-full border-4 border-muted flex items-center justify-center overflow-hidden bg-secondary">
                {isLoading ? (
                  <Skeleton className="w-full h-full rounded-full" />
                ) : initialsOf(profile) ? (
                  <span className="text-4xl font-semibold text-secondary-foreground">
                    {initialsOf(profile)}
                  </span>
                ) : (
                  <User className="w-20 h-20 text-secondary-foreground" />
                )}
              </div>

              <div className="text-center space-y-1">
                {isLoading ? (
                  <Skeleton className="h-6 w-40 mx-auto" />
                ) : (
                  <h3 className="font-semibold text-lg text-foreground">
                    {profile?.fullName || profile?.username || "Your account"}
                  </h3>
                )}
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.role && (
                  <Badge variant="secondary">{profile.role.replace(/_/g, " ").toLowerCase()}</Badge>
                )}
              </div>

              <div className="w-full pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-muted-foreground">Username</span>
                  {isLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    <span className="text-foreground font-medium truncate">
                      {profile?.username ?? "-"}
                    </span>
                  )}
                </div>
                {profile?.areaName && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Area</span>
                    <span className="text-foreground font-medium truncate">
                      {profile.areaName}, {profile.district}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-3">
                  <span className="text-muted-foreground">Wallet</span>
                  {isLoading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    <span className="text-foreground font-mono text-xs">
                      {profile?.walletAddress ? truncateAddress(profile.walletAddress) : "Not linked"}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                Photo and document uploads aren&apos;t available yet.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Editable details */}
        <div className="md:col-span-8">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border bg-primary/5 pb-4">
              <CardTitle className="text-xl text-primary">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {error ? (
                <div className="flex flex-col items-start gap-4">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button type="button" variant="outline" onClick={refetch}>
                    Try again
                  </Button>
                </div>
              ) : (
                <>
                  {!isLoading && isIncomplete && (
                    <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 px-4 py-3">
                      Your profile isn&apos;t complete yet - fill these in so officers and
                      administrators can identify you.
                    </p>
                  )}

                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium mb-1.5">
                      Full Name
                    </label>
                    {isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <>
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="e.g. Arjuna Perera"
                          disabled={formik.isSubmitting}
                          {...formik.getFieldProps("fullName")}
                          className="h-10"
                          aria-invalid={Boolean(formik.touched.fullName && formik.errors.fullName)}
                        />
                        {formik.touched.fullName && formik.errors.fullName && (
                          <p className="text-destructive text-xs mt-1">{formik.errors.fullName}</p>
                        )}
                      </>
                    )}
                  </div>

                  <div>
                    <label htmlFor="address" className="block text-sm font-medium mb-1.5">
                      {addressLabel}
                    </label>
                    {isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <>
                        <Input
                          id="address"
                          type="text"
                          placeholder={addressPlaceholder}
                          disabled={formik.isSubmitting}
                          {...formik.getFieldProps("address")}
                          className="h-10"
                          aria-invalid={Boolean(formik.touched.address && formik.errors.address)}
                        />
                        {formik.touched.address && formik.errors.address && (
                          <p className="text-destructive text-xs mt-1">{formik.errors.address}</p>
                        )}
                      </>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contactNumber" className="block text-sm font-medium mb-1.5">
                      Contact Number
                    </label>
                    {isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <>
                        <Input
                          id="contactNumber"
                          type="tel"
                          placeholder="e.g. 0771234567"
                          disabled={formik.isSubmitting}
                          {...formik.getFieldProps("contactNumber")}
                          className="h-10"
                          aria-invalid={Boolean(
                            formik.touched.contactNumber && formik.errors.contactNumber
                          )}
                        />
                        {formik.touched.contactNumber && formik.errors.contactNumber && (
                          <p className="text-destructive text-xs mt-1">{formik.errors.contactNumber}</p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t border-border pt-4 flex justify-end">
              <Button
                type="submit"
                disabled={isLoading || Boolean(error) || !formik.dirty || formik.isSubmitting}
                className="h-10 px-6 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formik.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}
