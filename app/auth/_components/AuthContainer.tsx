'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import Login from './Login';
import Register from './Register';
import { Button } from '@/components/ui/button';
import DotGrid from '@/components/DotGrid';
import { LanguageSelector } from '@/context/LanguageContext';

export default function AuthContainer() {
  const [isSignup, setIsSignup] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const dotGridBaseColor = mounted && resolvedTheme === 'dark' ? '#2F293A' : '#ebeef0ff';

  return (
    <div className="w-full min-h-screen bg-background flex flex-col lg:flex-row relative text-foreground">
      <div className="absolute top-4 right-4 z-50"><LanguageSelector /></div>
      <Link
        href="/"
        className="absolute top-4 left-4 z-50"
      >
        <Button variant="link"><ArrowLeft className="w-4 h-4" />Back to Home</Button>
      </Link>
      {/* Form Container - Scrolls with page */}
      <div
        className={`w-full lg:w-1/2 flex-1 flex items-center justify-center px-8 pt-20 pb-8 lg:p-16 bg-background transition-transform duration-700 ease-in-out z-10 ${isSignup ? 'lg:translate-x-full' : 'lg:translate-x-0'
          }`}
      >
        <div className="w-full max-w-md my-auto">
          {/* We use opacity/display to swap forms smoothly */}
          <div className={`${isSignup ? 'block animate-fadeIn' : 'hidden'}`}>
            <Register onSwitchToLogin={() => setIsSignup(false)} />
          </div>
          <div className={`${!isSignup ? 'block animate-fadeIn' : 'hidden'}`}>
            <Login onSwitchToSignup={() => setIsSignup(true)} />
          </div>
        </div>
      </div>

      {/* /Overlay Container - Sticky */}
      <div
        className={`hidden lg:flex w-1/2 sticky top-0 h-screen bg-muted/30 items-center justify-center overflow-hidden flex-col transition-transform duration-700 ease-in-out z-20 ${isSignup ? 'lg:-translate-x-full' : 'lg:translate-x-0'
          }`}
      >
        {/* Background Grid/Pattern */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          <DotGrid
            style={{ position: "absolute" }}
            dotSize={5}
            gap={15}
            baseColor={dotGridBaseColor}
            activeColor="#10B981"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>

        <div className="relative z-10 text-center mt-8 space-y-6">
          <h2 className="text-2xl font-bold text-foreground">
            {isSignup ? "Already registered?" : "New to the BhumiSaara?"}
          </h2>
          <p className="text-muted-foreground max-w-sm px-8">
            {isSignup
              ? "If you already have a BhumiSaara account, sign in to continue managing your allocations."
              : "Create your BhumiSaara account to access smart quotas, tracking, and the green market."}
          </p>
          <Button
            onClick={() => setIsSignup(!isSignup)}
            className="border-2 rounded-lg"
          >
            {isSignup ? "Sign In" : "Register"}
          </Button>
        </div>
      </div>

      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
