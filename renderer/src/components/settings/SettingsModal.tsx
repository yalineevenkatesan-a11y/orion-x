'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

export function SettingsModal() {
  const { isSettingsOpen, toggleSettings } = useApp();
  const [identityMode, setIdentityMode] = useState(true);
  const [hwAcceleration, setHwAcceleration] = useState(true);

  if (!isSettingsOpen) return null;

  return (
    <div
      onClick={toggleSettings}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in select-none"
    >
      {/* Modal Dialog Card */}
      <div
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        className="glass-panel relative w-full max-w-lg rounded-2xl p-7 border border-white/10 shadow-2xl bg-black/50 animate-scale-up"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <div className="flex flex-col">
            <h2 className="text-base font-bold tracking-widest text-white uppercase">
              System Configuration
            </h2>
            <span className="text-[10px] text-cyber-500 font-mono tracking-wider">
              ORION CORE SETTINGS PIPELINE
            </span>
          </div>
          
          {/* Close button */}
          <button
            onClick={toggleSettings}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer active:scale-90"
            title="Close Settings"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Configurations List */}
        <div className="flex flex-col gap-6">

          {/* Row 1: System Identity Mode */}
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-white tracking-wide">
                System Identity Mode
              </span>
              <span className="text-[10px] text-gray-500">
                Synchronize UI core accents with quantum color spectrums.
              </span>
            </div>
            {/* Toggle Switch */}
            <button
              onClick={() => setIdentityMode((prev) => !prev)}
              className={`relative w-12 h-6 rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                identityMode ? 'bg-quantum-500 shadow-purple-glow' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                  identityMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Row 2: Hardware Acceleration */}
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-white tracking-wide">
                Hardware Acceleration
              </span>
              <span className="text-[10px] text-gray-500">
                Enable desktop-GPU acceleration for smooth rendering transitions.
              </span>
            </div>
            {/* Toggle Switch */}
            <button
              onClick={() => setHwAcceleration((prev) => !prev)}
              className={`relative w-12 h-6 rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                hwAcceleration ? 'bg-cyber-500 shadow-blue-glow' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                  hwAcceleration ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Row 3: V2 Core Engine Sync (Locked) */}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white/50 tracking-wide">
                  V2 Core Engine Sync
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-quantum-500/10 text-quantum-400 border border-quantum-500/20">
                  V2 SPEC
                </span>
              </div>
              <span className="text-[10px] text-gray-600">
                Connect real-time 3D character avatars, lip sync engines and expression controls.
              </span>
            </div>
            {/* Locked Field */}
            <div className="relative">
              <input
                type="text"
                disabled
                value="INTEGRATION LOCKED (REQUIRES V2 RELEASE)"
                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-mono text-gray-600 placeholder-gray-600 select-none outline-none"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={toggleSettings}
            className="py-2.5 px-6 rounded-xl text-xs font-mono font-semibold tracking-wider bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 border border-white/5 hover:border-white/10 transition-colors cursor-pointer select-none active:scale-95"
          >
            CLOSE CONFIGURATION
          </button>
        </div>

      </div>

      {/* Inline styles for custom modal transitions */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
