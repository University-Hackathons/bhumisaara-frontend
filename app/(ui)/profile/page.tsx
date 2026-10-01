"use client";

import { useAuth } from "@/context/AuthContext";
import FarmerProfile from "@/components/farmer/FarmerProfile";
import GovermentProfile from "@/components/goverment/GovermentProfile";
import AgrarianProfile from "@/components/agrarian-officer/AgrarianProfile";
import DealerProfile from "@/components/private-dealer/DealerProfile";
import OrganicProducerProfile from "@/components/organic-producer/OrganicProducerProfile";
import AdminProfile from "@/components/system-admin/AdminProfile";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  // Switchboard pattern: Render completely different trees based on role
  if (user?.role === "FARMER") {
    return <FarmerProfile />;
  }

  if (user?.role === "SYSTEM_ADMIN") {
    return <AdminProfile />;
  }

  if (user?.role === "GOVERNMENT_ADMIN") {
    return <GovermentProfile />;
  }

  if (user?.role === "AGRARIAN_SERVICE_OFFICER") {
    return <AgrarianProfile />;
  }

  if (user?.role === "PRIVATE_AGRO_DEALER") {
    return <DealerProfile />;
  }

  // AuthUser carries a single `role`, never a `roles` array — reading
  // `.roles.includes` threw a TypeError for every organic producer.
  if (user?.role === "ORGANIC_FERTILIZER_PRODUCER") {
    return <OrganicProducerProfile />;
  }

  // Fallback
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
      <p className="text-base text-muted-foreground">Your role profile is not available yet.</p>
    </div>
  );
}

