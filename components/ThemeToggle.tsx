"use client";

import React from "react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";


export const ThemeToggle = ({ className }: { className?: string }) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <button
      onClick={(e) => {
        const newTheme = resolvedTheme === "dark" ? "light" : "dark";


        if (!document.startViewTransition) {
          setTheme(newTheme);
          return;
        }

        const { clientX, clientY } = e;
        const endRadius = Math.hypot(
          Math.max(clientX, innerWidth - clientX),
          Math.max(clientY, innerHeight - clientY),
        );

        const transition = document.startViewTransition(() => {
          setTheme(newTheme);
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${clientX}px ${clientY}px)`,
                `circle(${endRadius}px at ${clientX}px ${clientY}px)`,
              ],
            },
            {
              duration: 500,
              easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        });
      }}
      className={cn(
        "inline-flex text-foreground cursor-pointer items-center justify-center whitespace-nowrap text-sm font-semibold disabled:pointer-events-none disabled:opacity-50 hover:bg-muted h-11 w-11 relative rounded-full transition-all active:scale-90 sm:h-10 sm:w-10 sm:border-none sm:bg-transparent sm:shadow-none sm:backdrop-blur-none bg-transparent shadow-none backdrop-blur-none",
        className,
      )}
    >
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity: mounted && resolvedTheme === "dark" ? 1 : 0,
          transform:
            mounted && resolvedTheme === "dark"
              ? "scale(1) rotate(0deg)"
              : "scale(0.5) rotate(90deg)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-moon"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity: mounted && resolvedTheme === "light" ? 1 : 0,
          transform:
            mounted && resolvedTheme === "light"
              ? "scale(1) rotate(0deg)"
              : "scale(0.5) rotate(-90deg)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-sun"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path>
          <path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path>
          <path d="m19.07 4.93-1.41 1.41"></path>
        </svg>
      </div>
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};
