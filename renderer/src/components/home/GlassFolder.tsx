'use client';

import React, { useState } from 'react';

interface GlassFolderProps {
  onOpenComplete: () => void;
}

export function GlassFolder({ onOpenComplete }: GlassFolderProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleFolderClick = () => {
    if (isOpening) return;
    setIsOpening(true);
    setTimeout(() => {
      onOpenComplete();
    }, 500); // 500ms zoom and fade transition duration
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Background radial glow that intensifies on folder hover */}
      <div
        className={`absolute w-72 h-72 rounded-full bg-gradient-to-tr from-quantum-500/20 to-cyber-500/20 blur-3xl pointer-events-none transition-all duration-500 ${
          isOpening
            ? 'scale-125 opacity-0'
            : 'group-hover:scale-110 group-hover:from-quantum-500/35 group-hover:to-cyber-500/35 opacity-70'
        }`}
      />

      {/* Main folder container */}
      <button
        onClick={handleFolderClick}
        className={`group relative flex flex-col items-center justify-center w-56 h-40 glass-panel cursor-pointer select-none outline-none overflow-hidden transition-all duration-500 ease-in-out ${
          isOpening ? 'scale-125 opacity-0 pointer-events-none' : 'hover:scale-105 active:scale-95'
        }`}
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Subtle interior light shine */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Minimal Sci-Fi Folder Glyph using SVG */}
        <svg
          className="w-16 h-16 text-gray-400 group-hover:text-quantum-400 filter group-hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.2"
            d="M5 19V6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2z"
          />
        </svg>

        {/* Glowing border accent inside the folder */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-quantum-500 to-cyber-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
      </button>

      {/* Label beneath the folder */}
      <div
        className={`mt-6 text-center transition-all duration-500 ${
          isOpening ? 'opacity-0 translate-y-4' : 'opacity-100'
        }`}
      >
        <span className="text-xs font-mono tracking-[0.3em] text-gray-400 group-hover:text-white uppercase transition-colors duration-300">
          Open Workspace
        </span>
      </div>
    </div>
  );
}
