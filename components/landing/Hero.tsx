"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import heroLight from "@/app/public/hero-light.svg";
import heroDark from "@/app/public/hero-dark.svg";

export const Hero = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg pt-20 md:pt-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg items-center">
        {/* Text content */}
        <div className="flex flex-col gap-stack-md">
          <h1 className="font-display-lg text-display-lg md:text-display-lg text-on-surface">
            The Transparent, Accountable National Fertilizer Grid
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
            Bridging the gap between agricultural supply chains and digital
            trust. Empowering stakeholders with real-time, immutable data for
            sustainable food security.
          </p>
          <div className="flex flex-wrap gap-stack-md mt-stack-md">
            <Button
              className="font-label-md text-label-md px-8 py-4 h-auto rounded-full soft-bloom"
            >
              Access Your Quota
            </Button>
            <Button
              variant="outline"
              className="border-2 border-secondary text-secondary font-label-md text-label-md px-8 py-4 h-auto rounded-full hover:bg-surface-container-low hover:text-secondary soft-bloom"
            >
              Explore the Green Market
            </Button>
          </div>
        </div>

        {/* Hero illustration */}
        <div className="hidden sm:flex relative w-full items-center justify-center
          sm:max-w-[380px] sm:mx-auto
          md:max-w-full md:mx-0">
          {mounted ? (
            <Image
              src={resolvedTheme === "dark" ? heroDark : heroLight}
              alt="BhumiSaara platform illustration"
              className="w-full h-auto object-contain max-h-[260px] sm:max-h-[340px] md:max-h-[420px] lg:max-h-[480px]"
              priority
            />
          ) : (
            /* Placeholder to prevent layout shift before mount */
            <div className="w-full aspect-[4/3] max-h-[480px]" />
          )}
        </div>
      </div>
    </section>
  );
};
