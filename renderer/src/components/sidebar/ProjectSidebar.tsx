'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';

export function ProjectSidebar() {
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    createNewWorkspaceThread,
    deleteWorkspaceThread,
    toggleSettings,
  } = useApp();

  return (
    <div className="flex flex-col h-full w-full select-none">
      
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5 bg-black/10">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-quantum-500 shadow-purple-glow" />
          <span className="text-xs font-mono font-bold tracking-[0.2em] text-white uppercase">
            ORION-X STUDIO
          </span>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-gray-500">
          V1.0
        </span>
      </div>

      {/* Action Button: "+ NEW WORKSPACE" */}
      <div className="p-4">
        <button
          onClick={() => createNewWorkspaceThread()}
          className="group relative flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl text-xs font-semibold font-mono tracking-wider text-white transition-all bg-gradient-to-r from-quantum-500/10 to-cyber-500/10 border border-white/10 hover:border-quantum-500/50 hover:bg-gradient-to-r hover:from-quantum-500/20 hover:to-cyber-500/20 cursor-pointer active:scale-[0.98] select-none"
        >
          {/* Subtle glow border effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-quantum-500 to-cyber-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-sm" />
          
          <svg className="w-4 h-4 text-quantum-400 group-hover:text-cyber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span className="relative z-10 group-hover:text-white transition-colors">
            NEW WORKSPACE
          </span>
        </button>
      </div>

      {/* Threads mapping list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-1.5 scrollbar-thin">
        <span className="text-[9px] font-mono tracking-[0.2em] text-gray-600 uppercase px-3 my-2 block">
          Active Thread Contexts
        </span>

        {threads.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-600 font-mono">
            No active threads.
          </div>
        ) : (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                className={`group relative flex items-center justify-between w-full rounded-xl transition-all duration-300 border ${
                  isActive
                    ? 'bg-white/10 border-cyber-500/30 text-white shadow-blue-glow'
                    : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5 text-white/40 hover:text-white/80'
                }`}
              >
                {/* Thread selection clickable row */}
                <button
                  onClick={() => setActiveThreadId(thread.id)}
                  className="flex items-center gap-3 flex-1 p-3 text-left text-xs font-medium truncate outline-none cursor-pointer"
                >
                  {/* Minimal Doc Icon */}
                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${
                      isActive ? 'text-cyber-400' : 'text-gray-600 group-hover:text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="truncate pr-4">{thread.title}</span>
                </button>

                {/* Inline Delete Button (revealed on parent row hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkspaceThread(thread.id);
                  }}
                  className="absolute right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 hover:text-red-400 text-gray-500 transition-all duration-200 cursor-pointer active:scale-90"
                  title="Delete Thread"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Profile & Settings Area */}
      <div className="p-4 border-t border-white/5 bg-black/15 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-quantum-500 to-cyber-500 flex items-center justify-center font-bold text-xs text-white shadow-purple-glow">
            O
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-white font-sans leading-tight">Orion Vector</span>
            <span className="text-[9px] text-gray-500 font-mono tracking-wider uppercase">Online</span>
          </div>
        </div>
        
        {/* Settings Configuration Gear Trigger */}
        <button
          onClick={toggleSettings}
          className="text-gray-500 hover:text-cyber-400 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer active:scale-90"
          title="Open System Settings"
          type="button"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

    </div>
  );
}
