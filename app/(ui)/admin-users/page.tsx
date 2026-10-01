"use client";
import AdminUsers from "@/components/system-admin/AdminUsers";
import { SystemAdminGate } from "@/components/system-admin/AdminCommon";
export default function AdminUsersPage() { return <SystemAdminGate><AdminUsers /></SystemAdminGate>; }

