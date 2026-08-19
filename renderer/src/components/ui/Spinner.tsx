import React from 'react';

interface SpinnerProps {
  className?: string;
  size?: number;
}

export function Spinner({ className = '', size = 48 }: SpinnerProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* Decorative ambient background glow */}
      <div className="absolute inset-0 rounded-full bg-quantum-500/10 blur-md animate-pulse" />

      {/* SVG Spinner */}
      <svg
        className="animate-spin text-cyber-500 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
        viewBox="0 0 50 50"
        width={size}
        height={size}
      >
        <circle
          className="opacity-20"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="url(#spinner-gradient)"
          strokeWidth="3.5"
          strokeDasharray="80 150"
          strokeDashoffset="0"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" /> {/* Quantum Purple */}
            <stop offset="100%" stopColor="#06B6D4" /> {/* Neon Cyber Blue */}
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
