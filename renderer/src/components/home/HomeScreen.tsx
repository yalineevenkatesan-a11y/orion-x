'use client';

import React from 'react';
import { GlassFolder } from './GlassFolder';

interface HomeScreenProps {
  onOpenComplete: () => void;
}

export function HomeScreen({ onOpenComplete }: HomeScreenProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-radial-obsidian">
      {/* Background space elements */}
      <div className="absolute top-0 left-0 right-0 bottom-0 bg-space-glow opacity-80 pointer-events-none" />

      {/* Decorative ambient stars or nodes floating in the distance */}
      <div className="absolute top-1/3 left-1/5 w-1.5 h-1.5 rounded-full bg-quantum-400/30 blur-[1px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-2 h-2 rounded-full bg-cyber-400/20 blur-[2px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/4 right-1/3 w-1 h-1 rounded-full bg-white/40 blur-[1px] animate-pulse" style={{ animationDelay: '3s' }} />

      {/* Central Interactive folder */}
      <div className="relative z-10">
        <GlassFolder onOpenComplete={onOpenComplete} />
      </div>
    </div>
  );
}
