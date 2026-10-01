"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";

// Each role's dashboard pulls in its own heavy, mutually-exclusive
// dependencies (thirdweb SDK for Government, recharts for Dealer, etc.).
// Loading them via next/dynamic keeps them in separate chunks so a given
// user's first /dashboard compile only pays for the role they actually have.
const FarmerDashboard = dynamic(() => import("@/components/farmer/FarmerDashboard"));
const GovermentDashboard = dynamic(() => import("@/components/goverment/GovermentDashboard"));
const AgrarianDashboard = dynamic(() => import("@/components/agrarian-officer/AgrarianDashboard"));
const DealerDashboard = dynamic(() => import("@/components/private-dealer/DealerDashboard"));
const OrganicProducerDashboard = dynamic(() => import("@/components/organic-producer/OrganicProducerDashboard"));

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Handled by layout loader
  }

  // Switchboard pattern: Render completely different trees based on role
  if (user?.role === "FARMER") {
    return <FarmerDashboard />;
  }

  if (user?.role === "SYSTEM_ADMIN") {
    return <AdminDashboard />;
  }

  if (user?.role === "GOVERNMENT_ADMIN") {
    return <GovermentDashboard />;
  }

  if (user?.role === "AGRARIAN_SERVICE_OFFICER") {
    return <AgrarianDashboard />;
  }

  if (user?.role === "PRIVATE_AGRO_DEALER") {
    return <DealerDashboard />;
  }

  if (user?.role === "ORGANIC_FERTILIZER_PRODUCER") {
    return <OrganicProducerDashboard />;
  }

  // Fallback
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Welcome toBhumiSaara</h1>
      <p className="text-base text-muted-foreground">Your role is not recognized yet.</p>
    </div>
  );
}

// Inline role-specific components (to avoid creating many files right now)


function AdminDashboard() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
      <div className="p-6 bg-card text-card-foreground shadow-sm rounded-xl">
        <h2 className="text-xl font-semibold mb-2">National Inventory</h2>
        <p className="text-base text-muted-foreground">Audit real-time tracking across all agrarian centers.</p>
      </div>
    </div>
  );
}


