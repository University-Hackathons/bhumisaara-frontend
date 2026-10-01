"use client";
import { Suspense } from "react";
import AdminAreas from "@/components/system-admin/AdminAreas";
import { SystemAdminGate } from "@/components/system-admin/AdminCommon";
export default function AdminAreasPage() { return <SystemAdminGate><Suspense fallback={null}><AdminAreas /></Suspense></SystemAdminGate>; }
