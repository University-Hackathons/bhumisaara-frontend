"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import MintBatchForm from "./MintBatchForm";
import TxHashBadge from "./TxHashBadge";
import { useMintedBatches } from "@/hooks/use-minted-batches";
import { useApiList } from "@/hooks/use-api-resource";

import { useStockFlowSummary } from "@/hooks/use-transfers";
import apiPaths from "@/utils/apiPaths";
import { formatKg } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableEmptyState, TableSkeletonRows } from "@/components/ui/table-states";
import WalletAssets from "@/components/WalletAssets";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Download,
  Truck,
  TrendingUp,
  CheckCircle,
  Flame,
  Building2,
  ArrowRight,
  Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";

interface Officer {
  userId: number;
  areaId: number | null;
}

export default function GovermentDashboard() {
  const router = useRouter();

  const { isNFTsLoading, records } = useMintedBatches();

  // Grouped stock movement totals and custody, plus current area staffing.
  const flowQuery = useStockFlowSummary();
  const officersQuery = useApiList<Officer>(
    ["officers", "assigned"],
    `${apiPaths.officers.list}?assigned=true`
  );

  const flow = flowQuery.data;
  const officers = officersQuery.data;
  const isLedgerLoading = flowQuery.isLoading || officersQuery.isLoading;

  const totalImportedTons = useMemo(() => {
    const totalKg = records.reduce((sum, record) => sum + record.originalVolumeKg, 0);
    return (totalKg / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }, [records]);

  const activeTokensMinted = records.length;

  const burnedKg = flow?.burnedKg ?? 0;
  const totalBurns = flow?.burnCount ?? 0;

  /** An area is "active" once an officer is assigned to it. */
  const activeCentres = useMemo(
    () => new Set(officers.filter((officer) => officer.areaId != null).map((officer) => officer.areaId)).size,
    [officers]
  );

  /** Who holds a token now: the reserve until some of it is transferred out. */
  const custodianByTokenId = useMemo(() => {
    const holders = new Map<string, Set<string>>();

    (flow?.custody ?? []).forEach((entry) => {
      const name = entry.officerName ?? `Officer #${entry.officerId}`;
      const key = String(entry.tokenId);
      holders.set(key, (holders.get(key) ?? new Set<string>()).add(name));
    });

    return holders;
  }, [flow]);

  const custodianLabel = (tokenId: string) => {
    const holders = custodianByTokenId.get(tokenId);
    if (!holders || holders.size === 0) return "Government Reserve";
    return holders.size === 1 ? [...holders][0] : `${holders.size} officers`;
  };

  const isExportDisabled = isNFTsLoading || isLedgerLoading;

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Kept alongside the preview: .save() re-triggers the same document rather
  // than re-building it, so what downloads is exactly what was previewed.
  const pdfDocRef = useRef<jsPDF | null>(null);
  const pdfFileNameRef = useRef<string>("bhumisaara-dashboard.pdf");

  // The object URL backing the preview is only valid until revoked — do that
  // on close/unmount so a report generated twice doesn't leak the first blob.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /**
   * Everything here is already on screen — the KPI ribbon and the ledger
   * table — just laid out for print. Generated client-side like every other
   * chain-adjacent artifact in this app; no backend endpoint for it.
   */
  const buildReportPdf = () => {
    const doc = new jsPDF();
    const generatedAt = new Date();

    doc.setFontSize(18);
    doc.text("BhumiSaara - National Distribution Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Generated ${generatedAt.toLocaleString()}`, 14, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Metric", "Value"]],
      body: [
        ["Total Imported (Tons)", totalImportedTons],
        ["Active Batches Minted", String(activeTokensMinted)],
        ["Total Decentralized Burns", `${totalBurns} (${formatKg(burnedKg)} collected by farmers)`],
        ["Active Agrarian Centers", `${activeCentres} areas with an officer assigned`],
      ],
      theme: "grid",
      headStyles: { fillColor: [22, 101, 52] },
    });

    const tableWithMeta = doc as unknown as { lastAutoTable: { finalY: number } };
    const ledgerStartY = tableWithMeta.lastAutoTable.finalY + 12;

    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text("Global Live Ledger", 14, ledgerStartY);

    autoTable(doc, {
      startY: ledgerStartY + 4,
      head: [["Batch ID", "Token ID", "Remaining Stock (kg)", "Current Custodian"]],
      body: records.map((record) => [
        record.name,
        `TK-${record.tokenId.toString()}`,
        formatKg(record.remainingVolumeKg),
        custodianLabel(record.tokenId.toString()),
      ]),
      theme: "striped",
      headStyles: { fillColor: [22, 101, 52] },
      styles: { fontSize: 9 },
    });

    return {
      doc,
      fileName: `bhumisaara-dashboard-${generatedAt.toISOString().slice(0, 10)}.pdf`,
    };
  };

  const handleExportPdf = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const { doc, fileName } = buildReportPdf();
    pdfDocRef.current = doc;
    pdfFileNameRef.current = fileName;
    setPreviewUrl(URL.createObjectURL(doc.output("blob")));
    setIsPreviewOpen(true);
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

  return (
    <div className="flex flex-col min-h-full w-full bg-background">
      <main className="flex-grow px-4 md:px-8 max-w-8xl mx-auto w-full pb-8 space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-primary">Dashboard Overview</h1>
            <p className="text-lg text-muted-foreground">
              Real-time national grid agrarian metrics.
            </p>
          </div>
          <Button
            variant="outline"
            className="hidden sm:flex items-center gap-2 shadow-sm"
            onClick={handleExportPdf}
            disabled={isExportDisabled}
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
        </div>

        {/* Top KPI Metrics Ribbon */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-secondary rounded-lg text-secondary-foreground">
                <Truck className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-4 h-4" />
                Live
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Imported (Tons)</p>
            <h3 className="text-4xl font-bold text-foreground group-hover:text-primary transition-colors">
              {isNFTsLoading ? <Skeleton className="h-9 w-16" /> : totalImportedTons}
            </h3>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary/20 rounded-lg text-primary">
                <Coins className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-4 h-4" />
                Live
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Active Batches Minted</p>
            <h3 className="text-4xl font-bold text-foreground group-hover:text-primary transition-colors">
              {isNFTsLoading ? <Skeleton className="h-9 w-16" /> : activeTokensMinted}
            </h3>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-destructive/20 rounded-lg text-destructive">
                <Flame className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Decentralized Burns</p>
            <h3 className="text-4xl font-bold text-foreground group-hover:text-primary transition-colors">
              {isLedgerLoading ? <Skeleton className="h-9 w-16" /> : totalBurns}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isLedgerLoading ? "" : `${formatKg(burnedKg)} collected by farmers`}
            </p>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-accent rounded-lg text-accent-foreground">
                <Building2 className="w-6 h-6" />
              </div>
              {!isLedgerLoading && activeCentres > 0 && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  <TrendingUp className="w-4 h-4" />
                  Staffed
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Active Agrarian Centers</p>
            <h3 className="text-4xl font-bold text-foreground group-hover:text-primary transition-colors">
              {isLedgerLoading ? <Skeleton className="h-9 w-16" /> : activeCentres}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isLedgerLoading ? "" : "areas with an officer assigned"}
            </p>
          </div>
        </section>

        {/* Main Actions & Ledger Layout (Bento Grid Style)
            Minting is the one thing an admin comes here to *do*, so it sits
            directly under the KPI ribbon — the wallet's token grid used to push
            it below the fold whenever the ministry held more than a few batches.
            `items-start` keeps each column at its natural height instead of
            stretching the shorter one to match. */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 xl:items-start">

          {/* Main Actions Panel */}
          <div className="xl:col-span-1">
            <MintBatchForm />
          </div>

          {/* Global Live Ledger Table — capped and scrolled internally so a
              long ledger can't tower over the mint form beside it. This is a
              preview; "Full History" is the complete list. */}
          <div className="xl:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col max-h-[30rem]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">Global Live Ledger</h3>
                {!isNFTsLoading && records.length > 0 && (
                  <Badge variant="secondary">{records.length}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                className="text-primary hover:text-primary/80 hover:bg-primary/10 gap-2"
                onClick={() => router.push("/import-history")}
              >
                Full History <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* min-h-0 lets this shrink inside the flex column so the cap
                actually bites; the Table's own wrapper handles the x axis. */}
            <div className="overflow-y-auto flex-1 min-h-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead className="font-semibold text-muted-foreground py-4 px-6">Batch ID</TableHead>
                    <TableHead className="font-semibold text-muted-foreground py-4 px-6">Token ID</TableHead>
                    <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-right">Remaining Stock</TableHead>
                    <TableHead className="font-semibold text-muted-foreground py-4 px-6">Current Custodian</TableHead>
                    <TableHead className="font-semibold text-muted-foreground py-4 px-6 text-center">Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/50">
                  
                  {isNFTsLoading ? (
                    <TableSkeletonRows columns={5} rows={3} />
                  ) : records.length > 0 ? (
                    records.map((record) => (
                      <TableRow key={record.tokenId.toString()} className="hover:bg-muted/30 transition-colors duration-200 cursor-default group border-border">
                        <TableCell className="py-4 px-6">
                          <span className="font-mono text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20 text-sm">
                            {record.name}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-mono text-muted-foreground text-sm">
                          TK-{record.tokenId.toString()}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right font-medium text-foreground">
                          {formatKg(record.remainingVolumeKg)}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-foreground">
                          {custodianLabel(record.tokenId.toString())}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-center">
                          <TxHashBadge transactionHash={record.transactionHash} groupHover />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyState
                      columns={5}
                      icon={Coins}
                      title="No batches minted yet"
                      description="Mint an import batch with the form beside this ledger and it appears here."
                    />
                  )}
                  
                </TableBody>
              </Table>
            </div>
          </div>

        </section>

        {/* What the ministry's own wallet holds right now — reference rather
            than an action, so it reads last instead of blocking the mint form. */}
        <WalletAssets description="Batch tokens still held by the ministry, straight from the contract." />

      </main>

      <Sheet open={isPreviewOpen} onOpenChange={handlePreviewOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl data-[side=right]:sm:max-w-3xl"
        >
          <SheetHeader>
            <SheetTitle>Export Preview</SheetTitle>
            <SheetDescription>
              Review the report before downloading it.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 px-4">
            {previewUrl && (
              <iframe
                src={previewUrl}
                title="Dashboard report PDF preview"
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

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
