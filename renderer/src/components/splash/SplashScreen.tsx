'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Spinner } from '../ui/Spinner';

export function SplashScreen() {
  const { currentAppState } = useApp();
  const [isMounted, setIsMounted] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (currentAppState !== 'splash') {
      setIsFading(true);
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 700); // Wait for the 700ms fade-out transition to complete
      return () => clearTimeout(timer);
    }
  }, [currentAppState]);

  if (!isMounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-obsidian-950 transition-opacity duration-700 ease-in-out ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ willChange: 'opacity' }}
    >
      {/* Space inspired background stars effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,16,32,0.5)_0%,#020204_100%)]" />

      {/* Main Logo & Spinner Block */}
      <div className="relative flex flex-col items-center gap-8 z-10">
        <div className="flex flex-col items-center gap-2">
          {/* Glowing Typography Logo with Keyframe Breathing Animation */}
          <h1 className="text-6xl font-extrabold tracking-[0.25em] text-white filter drop-shadow-[0_0_15px_rgba(139,92,246,0.3)] animate-pulse select-none">
            ORION-X
          </h1>
          <span className="text-xs font-semibold tracking-[0.5em] text-gray-500 uppercase mt-2">
            Workspace OS
          </span>
        </div>

        {/* Premium SVG Spinner */}
        <Spinner size={40} />
      </div>

      {/* Inline styles for custom pulses if needed, standard Tailwind pulse is perfect */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.85;
            filter: drop-shadow(0 0 12px rgba(139, 92, 246, 0.25));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 25px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 10px rgba(6, 182, 212, 0.4));
          }
        }
        .animate-pulse {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
