"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/context/LanguageContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, Loader2, Sprout } from "lucide-react";
import { buildSeasonOptions, FERTILIZER_TYPES } from "@/lib/fertilizerRequests";

const describeError = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    return error.response?.data?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export default function ApplicationForm() {
  const { t } = useLanguage();
  const seasonOptions = useMemo(() => buildSeasonOptions(), []);

  const [season, setSeason] = useState<string>("");
  const [fertilizerType, setFertilizerType] = useState<string>("");
  const [requestedKg, setRequestedKg] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const parsedKg = Number(requestedKg);
  const isFormValid = Boolean(
    season && fertilizerType && requestedKg && Number.isInteger(parsedKg) && parsedKg > 0
  );

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsSaving(true);
    const toastId = toast.loading("Submitting your application...");

    try {
      await axiosInstance.post(apiPaths.fertilizerRequests.create, {
        season,
        fertilizerType,
        requestedKg: parsedKg,
      });

      toast.dismiss(toastId);
      toast.success("Application submitted for approval!", {
        description: `${parsedKg}kg of ${fertilizerType} for ${season}`,
        icon: <CheckCircle className="w-5 h-5 text-primary" />,
      });

      setSeason("");
      setFertilizerType("");
      setRequestedKg("");
    } catch (error) {
      // Covers the backend's duplicate guard (one open application per season +
      // fertilizer type) and the "no area linked" rejection, both of which come
      // back with a message worth showing verbatim.
      toast.dismiss(toastId);
      toast.error("Could not submit the application.", {
        description: describeError(error, "Please check server connection."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow pt-4 px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">{t("Fertilizer Subsidy Application")}</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Apply for your seasonal subsidy. Your area&apos;s agrarian service officer reviews it.
            </p>
          </div>
          <Link
            href="/applications-history"
            className={cn(buttonVariants({ variant: "outline" }), "w-fit h-10 px-4 gap-2")}
          >
            {t("View application history")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">{t("New Application")}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  One open application per season and fertilizer type.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Season */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  1
                </span>
                {t("Season")}
              </label>
              <Select
                value={season}
                onValueChange={(value) => setSeason(value ? String(value) : "")}
                disabled={isSaving}
              >
                <SelectTrigger className="w-full h-12 bg-background">
                  <SelectValue placeholder={t("Select season")} />
                </SelectTrigger>
                <SelectContent>
                  {seasonOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fertilizer type */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  2
                </span>
                {t("Fertilizer Type")}
              </label>
              <Select
                value={fertilizerType}
                onValueChange={(value) => setFertilizerType(value ? String(value) : "")}
                disabled={isSaving}
              >
                <SelectTrigger className="w-full h-12 bg-background">
                  {/* Function child: Base UI renders the raw value otherwise, which
                      would show "Urea" instead of the full label. */}
                  <SelectValue>
                    {(value) =>
                      FERTILIZER_TYPES.find((type) => type.value === String(value ?? ""))?.label ??
                      t("Select type")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FERTILIZER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-3">
              <label
                htmlFor="requestedKg"
                className="text-sm font-medium text-muted-foreground flex items-center gap-2"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  3
                </span>
                {t("Amount Required (KG)")}
              </label>
              <div className="relative">
                <Input
                  id="requestedKg"
                  type="number"
                  min="1"
                  step="1"
                  value={requestedKg}
                  onChange={(e) => setRequestedKg(e.target.value)}
                  placeholder="e.g. 50"
                  disabled={isSaving}
                  className="h-8 pr-12 bg-background"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  KG
                </span>
              </div>
            </div>

            <div className="md:col-span-3 pt-2 border-t border-border flex justify-end">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || isSaving}
                className="w-full md:w-auto h-12 px-8 text-sm font-semibold shadow-md hover:shadow-lg rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  t("Submit Application")
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
