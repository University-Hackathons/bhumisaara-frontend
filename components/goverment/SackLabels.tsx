"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { describeApiError } from "@/utils/apiError";
import { formatKg } from "@/utils/formatters";
import { useBatches } from "@/hooks/use-batches";
import { useBatchSacks } from "@/hooks/use-batch-sacks";
import { Skeleton } from "@/components/ui/skeleton";
import type { Sack } from "@/lib/distribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Download, Loader2, Printer, QrCode } from "lucide-react";

/**
 * Only the label sheet reaches the printer — the sidebar, headers and controls
 * around it would otherwise waste a page and confuse the person labelling.
 */
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden; }
  #sack-label-sheet, #sack-label-sheet * { visibility: visible; }
  #sack-label-sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0;
  }
  .sack-label { break-inside: avoid; page-break-inside: avoid; }
}
`;

export default function SackLabels() {
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [isBackfilling, setIsBackfilling] = useState(false);

  const { data: batches, isLoading: isBatchesLoading } = useBatches();

  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.batchId) === selectedBatchId) ?? null,
    [batches, selectedBatchId]
  );

  const {
    data: sacks,
    isLoading: isSacksLoading,
    refetch: refetchSacks,
  } = useBatchSacks(selectedBatch?.batchId ?? null);

  const selectBatch = (batchId: string) => setSelectedBatchId(batchId);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Kept alongside the preview: .save() re-triggers the same document rather
  // than re-building it, so what downloads is exactly what was previewed.
  const pdfDocRef = useRef<jsPDF | null>(null);
  const pdfFileNameRef = useRef<string>("bhumisaara-sack-labels.pdf");

  // The object URL backing the preview is only valid until revoked — do that
  // on close/regenerate/unmount so a sheet generated twice doesn't leak the
  // first blob.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /**
   * One QR label sheet, 3-up per row, matching the on-screen layout closely
   * enough that what prints from the browser and what downloads here agree.
   * The QR codes are re-rendered as PNGs via `qrcode` (not read off the
   * on-screen `qrcode.react` SVGs) because jsPDF needs a raster/data-URL
   * image, not a live DOM node.
   */
  const buildLabelsPdf = async (batch: NonNullable<typeof selectedBatch>, labelSacks: Sack[]) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const marginX = 10;
    const marginBottom = 10;
    const columns = 3;
    const gap = 6;
    const cellWidth = (pageWidth - marginX * 2 - gap * (columns - 1)) / columns;
    const cellHeight = 60;
    const qrSize = 36;

    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(
      `Sack Labels - ${batch.importerName} - TK-${batch.tokenId}`,
      marginX,
      12
    );
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      `${labelSacks.length} labels - ${batch.fertilizerType} - generated ${new Date().toLocaleString()}`,
      marginX,
      18
    );

    const qrDataUrls = await Promise.all(
      labelSacks.map((sack) => QRCode.toDataURL(sack.serial, { margin: 1, width: 300 }))
    );

    let x = marginX;
    let y = 24;
    let col = 0;

    labelSacks.forEach((sack, index) => {
      if (y + cellHeight > pageHeight - marginBottom) {
        doc.addPage();
        x = marginX;
        y = marginX;
        col = 0;
      }

      doc.setDrawColor(180);
      doc.rect(x, y, cellWidth, cellHeight);

      doc.addImage(qrDataUrls[index], "PNG", x + (cellWidth - qrSize) / 2, y + 4, qrSize, qrSize);

      const centerX = x + cellWidth / 2;
      doc.setFont("courier", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20);
      doc.text(sack.serial, centerX, y + qrSize + 10, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(`${batch.fertilizerType} - ${sack.weightKg}kg`, centerX, y + qrSize + 15, {
        align: "center",
      });
      doc.text(`BhumiSaara - Batch #${sack.batchId}`, centerX, y + qrSize + 19, {
        align: "center",
      });

      col += 1;
      if (col >= columns) {
        col = 0;
        x = marginX;
        y += cellHeight + gap;
      } else {
        x += cellWidth + gap;
      }
    });

    const fileName = `bhumisaara-sack-labels-TK-${batch.tokenId}-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;

    return { doc, fileName };
  };

  const handleExportPdf = async () => {
    if (!selectedBatch || sacks.length === 0) return;

    setIsGeneratingPdf(true);
    const toastId = toast.loading(`Generating ${sacks.length} QR labels...`);

    try {
      const { doc, fileName } = await buildLabelsPdf(selectedBatch, sacks);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      pdfDocRef.current = doc;
      pdfFileNameRef.current = fileName;
      setPreviewUrl(URL.createObjectURL(doc.output("blob")));
      setIsPreviewOpen(true);
      toast.dismiss(toastId);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Could not generate the label sheet.", {
        description: describeApiError(error, "Please try again."),
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleConfirmDownload = () => {
    pdfDocRef.current?.save(pdfFileNameRef.current);
  };

  const handlePreviewOpenChange = (open: boolean) => {
    setIsPreviewOpen(open);
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  /** Batches minted before sacks existed have none until they're backfilled. */
  const handleBackfill = async () => {
    if (!selectedBatch) return;

    setIsBackfilling(true);
    const toastId = toast.loading("Generating sacks for this batch...");

    try {
      const response = await axiosInstance.post<Sack[]>(
        apiPaths.sacks.backfill(selectedBatch.batchId)
      );
      await refetchSacks();

      toast.dismiss(toastId);
      toast.success(`Generated ${response.data?.length ?? 0} sacks.`);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Could not generate sacks.", {
        description: describeApiError(error, "Please check server connection."),
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <style>{PRINT_STYLES}</style>

      <main className="flex-grow px-4 md:px-8 max-w-7xl mx-auto w-full pb-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-primary">Sack Labels</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Print a QR label for every sack so it can be scanned on handover.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportPdf}
              disabled={sacks.length === 0 || isGeneratingPdf}
              className="h-12 px-8 text-sm font-semibold shadow-sm hover:shadow-md rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download PDF
            </Button>
            <Button
              type="button"
              onClick={() => window.print()}
              disabled={sacks.length === 0}
              className="h-12 px-8 text-sm font-semibold shadow-md hover:shadow-lg rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Printer className="w-4 h-4" />
              Print Labels
            </Button>
          </div>
        </div>

        <Card className="border-border shadow-sm print:hidden">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">Select Batch</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col gap-3 max-w-xl">
            <Select
              value={selectedBatchId}
              onValueChange={(value) => selectBatch(value ? String(value) : "")}
              disabled={isBatchesLoading || batches.length === 0}
            >
              <SelectTrigger className="w-full h-14 bg-background text-base">
                <SelectValue>
                  {(value) => {
                    const batch = batches.find((item) => String(item.batchId) === String(value ?? ""));
                    return batch
                      ? `${batch.importerName} · ${batch.fertilizerType} · TK-${batch.tokenId}`
                      : isBatchesLoading
                        ? "Loading batches..."
                        : "Choose a batch";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.batchId} value={String(batch.batchId)}>
                    {batch.importerName} · {batch.fertilizerType} · TK-{batch.tokenId} · {batch.volumeKg}kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedBatch && !isSacksLoading && sacks.length === 0 && (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  This batch has no sacks - it was minted before sacks were tracked.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackfill}
                  disabled={isBackfilling}
                  className="cursor-pointer"
                >
                  {isBackfilling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Sacks Now"
                  )}
                </Button>
              </div>
            )}

            {selectedBatch && sacks.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {sacks.length} labels ·{" "}
                {formatKg(sacks.reduce((total, sack) => total + sack.weightKg, 0))} total
              </p>
            )}
          </CardContent>
        </Card>

        {/* The printable sheet */}
        <div id="sack-label-sheet">
          {isSacksLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 print:hidden">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-56 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sacks.map((sack) => (
                // Literal black-on-white on purpose: these are printed labels,
                // and a scanner needs the same contrast whatever theme is on screen.
                <div
                  key={sack.sackId}
                  className="sack-label border border-black/60 rounded-lg p-3 flex flex-col items-center gap-2 bg-white text-black"
                >
                  {/* A quiet zone the scanner can lock onto, even on a smudged print. */}
                  <QRCodeSVG value={sack.serial} size={128} level="M" marginSize={2} />
                  <span className="font-mono text-sm font-semibold tracking-wide">{sack.serial}</span>
                  <span className="text-xs">
                    {selectedBatch?.fertilizerType} · {sack.weightKg}kg
                  </span>
                  <span className="text-[10px] uppercase tracking-wider">
                    BhumiSaara · Batch #{sack.batchId}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Sheet open={isPreviewOpen} onOpenChange={handlePreviewOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl data-[side=right]:sm:max-w-3xl"
        >
          <SheetHeader>
            <SheetTitle>Label Sheet Preview</SheetTitle>
            <SheetDescription>
              Review the QR label sheet before downloading it.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 px-4">
            {previewUrl && (
              <iframe
                src={previewUrl}
                title="Sack label sheet PDF preview"
                className="w-full h-full rounded-md border border-border"
              />
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => handlePreviewOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDownload} className="gap-2">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
