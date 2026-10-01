"use client";

import ProfileDetailsForm from "@/components/ProfileDetailsForm";

export default function AdminProfile() {
  return <div className="mx-auto w-full max-w-7xl space-y-8"><div><h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">System administrator profile</h1><p className="mt-2 text-muted-foreground">Manage your operator contact details. Your role and wallet remain read-only context.</p></div><ProfileDetailsForm title="Administrator details" description="Update your contact and organizational information." addressLabel="Organization / Address" addressPlaceholder="e.g. Platform Operations, Ministry of Agriculture" /></div>;
}

