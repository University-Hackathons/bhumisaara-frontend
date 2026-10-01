"use client";

import type { ReactNode } from "react";
import { ShieldX, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/navigation";

export const ROLES: { value: Role; label: string }[] = [
  { value: "SYSTEM_ADMIN", label: "System administrator" },
  { value: "GOVERNMENT_ADMIN", label: "Government administrator" },
  { value: "AGRARIAN_SERVICE_OFFICER", label: "Agrarian service officer" },
  { value: "FARMER", label: "Farmer" },
  { value: "PRIVATE_AGRO_DEALER", label: "Private agro dealer" },
  { value: "ORGANIC_FERTILIZER_PRODUCER", label: "Organic fertilizer producer" },
];

export const roleLabel = (role: Role | string) =>
  ROLES.find((item) => item.value === role)?.label ?? role.replaceAll("_", " ").toLowerCase();

export function SystemAdminGate({ children, description }: { children: ReactNode; description?: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user?.role !== "SYSTEM_ADMIN") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-full bg-destructive/10 p-4 text-destructive"><ShieldX className="h-8 w-8" /></div>
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted-foreground">{description ?? "Only system administrators can view this page."}</p>
      </div>
    );
  }
  return children;
}

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1><p className="mt-1 text-muted-foreground">{description}</p></div>
      {action}
    </div>
  );
}

export function Pager({ page, totalPages, totalElements, onPageChange }: { page: number; totalPages: number; totalElements: number; onPageChange: (page: number) => void }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{totalElements.toLocaleString()} total</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onPageChange(page - 1)}><ChevronLeft /> Previous</Button>
        <span className="min-w-24 text-center">Page {totalPages === 0 ? 0 : page + 1} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>Next <ChevronRight /></Button>
      </div>
    </div>
  );
}

