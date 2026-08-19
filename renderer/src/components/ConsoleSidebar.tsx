'use client';

import React from 'react';
import { useConsoleUi, ConsoleTab } from '@/context/ConsoleUiContext';

export function ConsoleSidebar() {
  const { activeConsoleTab, setActiveConsoleTab } = useConsoleUi();

  const navItems: { tab: ConsoleTab; icon: string; label: string }[] = [
    { tab: 'FILES', icon: '📁', label: 'Files' },
    { tab: 'SEARCH', icon: '🔍', label: 'Search' },
    { tab: 'MEMORY', icon: '🧠', label: 'Memory' },
    { tab: 'HISTORY', icon: '💬', label: 'Chat' },
    { tab: 'SETTINGS', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <aside className="h-full w-16 backdrop-blur-2xl bg-black/40 border-r border-white/5 flex flex-col items-center py-6 justify-between text-white select-none">
      
      {/* Top track branding */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-mono font-bold tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
          O-X
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />
      </div>

      {/* Center block vertical options */}
      <div className="flex flex-col gap-3 w-full">
        {navItems.map((item) => {
          const isActive = activeConsoleTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => setActiveConsoleTab(item.tab)}
              className={`relative group w-full py-4 flex flex-col items-center justify-center transition-all duration-300 outline-none cursor-pointer ${
                isActive 
                  ? 'bg-gradient-to-b from-cyan-500/10 to-purple-500/10 border-l-2 border-cyan-400 text-cyan-400' 
                  : 'border-l-2 border-transparent text-gray-500 hover:text-white hover:bg-white/2 hover:border-cyan-400/50'
              }`}
              title={item.label}
            >
              {/* Backglow element on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none -z-10" />

              <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                {item.icon}
              </span>
              <span className="text-[7px] font-mono tracking-wider uppercase mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom track utility indicator */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-[7px] font-mono leading-none text-gray-500 select-none">
          SYS
        </div>
      </div>

    </aside>
  );
}
export default ConsoleSidebar;
