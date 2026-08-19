'use client';

import React, { useState } from 'react';
import { useConsoleUi } from '@/context/ConsoleUiContext';
import { ConsoleSidebar } from './ConsoleSidebar';
import { WorkspaceLayout } from './workspace/WorkspaceLayout';
import { motion } from 'framer-motion';

export function ConsoleDashboardShell() {
  const { activeConsoleTab, setActiveConsoleTab } = useConsoleUi();

  const [settingsActiveTab, setSettingsActiveTab] = useState("appearance");
  const [theme, setTheme] = useState('Dark');
  const [uiDensity, setUiDensity] = useState('Compact');
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(12);
  
  const [autoLayout, setAutoLayout] = useState(true);
  const [nodeSize, setNodeSize] = useState(1);
  const [edgeOpacity, setEdgeOpacity] = useState(0.5);
  const [fileLabels, setFileLabels] = useState(true);
  const [showFolders, setShowFolders] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [animSpeed, setAnimSpeed] = useState(1);
  
  const [sparkEnabled, setSparkEnabled] = useState(true);
  const [responseStyle, setResponseStyle] = useState('Detailed');
  const [analysisDepth, setAnalysisDepth] = useState('Deep');
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const [contextSize, setContextSize] = useState(4096);
  const [chatHistory, setChatHistory] = useState(true);
  
  const [localOnly, setLocalOnly] = useState(true);
  const [sendCodeToAi, setSendCodeToAi] = useState(true);


  const tabIcons: Record<string, string> = {
    FILES: "FolderIcon",
    SEARCH: "SearchIcon",
    MEMORY: "ActivityIcon",
    HISTORY: "MessageSquareIcon",
    SETTINGS: "SettingsIcon"
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-transparent">
      {/* 1. Sleek vertical sidebar track removed as requested */}

      {/* 2. Primary workspace quadrant layout container */}
      <main className="flex-1 h-full overflow-hidden relative">
        {activeConsoleTab === 'HISTORY' || activeConsoleTab === 'SETTINGS' ? (
          <div className="absolute inset-0 w-full h-full flex flex-col overflow-hidden">
            <WorkspaceLayout />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-8 bg-transparent relative">
            <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 50 }}>
              <button 
                onClick={() => setActiveConsoleTab('HISTORY')}
                className="flex items-center gap-2 text-xs font-mono font-bold text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-md shadow-lg"
              >
                <span>&lt; BACK TO GRAPH</span>
              </button>
            </div>
            <div className="backdrop-blur-xl bg-black/40 border border-white/10 p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full flex flex-col gap-4">
              <div className="text-4xl animate-pulse">
                {tabIcons[activeConsoleTab] || '???'}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-quantum-400 uppercase">
                  Feature Panel Pending
                </h3>
                <span className="text-[10px] text-gray-500 font-mono">
                  STAGE: [{activeConsoleTab}]
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                The neural routing mapping for {activeConsoleTab.toLowerCase()} is isolated and scheduled for full integration in the upcoming V2 core cycle.
              </p>
            </div>
          </div>
        )}

        {/* SETTINGS DRAGGABLE OVERLAY */}
        {activeConsoleTab === 'SETTINGS' && (
          <div className="absolute inset-0 z-[100] pointer-events-none flex items-center justify-center">
            <motion.div
              drag
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-[#0B0B10] border border-[#1E1E26] rounded-xl shadow-[0_0_30px_rgba(0,0,0,1)] flex flex-col pointer-events-auto w-[650px] overflow-hidden absolute"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#1E1E26] bg-[#0F0F16] drag-handle cursor-move">
                <span className="text-[13px] font-mono font-bold tracking-widest text-cyan-400">[ PREMIUM SETTINGS MATRIX ]</span>
                <button onClick={() => setActiveConsoleTab('HISTORY')} className="text-zinc-500 hover:text-red-400 font-mono text-[13px] px-2 py-1 border border-zinc-800 rounded bg-zinc-900 transition-colors">[x]</button>
              </div>
              
              {/* TAB NAVIGATION HEADER */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#0B0B10] border-b border-[#1E1E26] overflow-x-auto custom-scrollbar">
                 {['appearance', 'graph', 'ai', 'security'].map((tab) => (
                    <button 
                       key={tab} 
                       onClick={() => setSettingsActiveTab(tab)}
                       className={`px-3 py-1.5 text-[11px] font-mono font-bold tracking-widest whitespace-nowrap transition-colors ${settingsActiveTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                       [ {tab === 'appearance' ? 'APPEARANCE' : tab === 'graph' ? 'NEURAL GRAPH' : tab === 'ai' ? 'SPARK AI' : 'PRIVACY & SECURITY'} ]
                    </button>
                 ))}
              </div>

              {/* DYNAMIC TAB RENDER CONTENT */}
              <div className="p-4 grid grid-cols-2 gap-4 bg-[#0B0B10] max-h-[500px] overflow-y-auto">
                {settingsActiveTab === 'appearance' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Theme</span>
                      <div className="flex gap-2">
                         {['Dark', 'AMOLED', 'System'].map(t => <button key={t} onClick={()=>setTheme(t)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${theme===t?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ {t} ]</button>)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">UI Density</span>
                      <div className="flex gap-2">
                         {['Compact', 'Comfortable'].map(t => <button key={t} onClick={()=>setUiDensity(t)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${uiDensity===t?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ {t} ]</button>)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Glow & Animations</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setGlowEnabled(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${glowEnabled?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setGlowEnabled(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!glowEnabled?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Background Particles</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setParticlesEnabled(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${particlesEnabled?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setParticlesEnabled(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!particlesEnabled?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <span className="text-[10px] font-mono text-zinc-500">Font Size ({fontSize}px)</span>
                      <input type="range" min="10" max="18" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                  </>
                )}

                {settingsActiveTab === 'graph' && (
                  <>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Auto Layout</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setAutoLayout(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${autoLayout?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setAutoLayout(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!autoLayout?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">File Labels</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setFileLabels(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${fileLabels?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setFileLabels(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!fileLabels?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Show Folders</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setShowFolders(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${showFolders?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setShowFolders(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!showFolders?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Show Dependencies</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setShowDeps(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${showDeps?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setShowDeps(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!showDeps?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Node Size ({nodeSize.toFixed(1)}x)</span>
                      <input type="range" min="1" max="5" step="0.1" value={nodeSize} onChange={e=>setNodeSize(Number(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Edge Visibility ({edgeOpacity.toFixed(1)})</span>
                      <input type="range" min="0" max="1" step="0.1" value={edgeOpacity} onChange={e=>setEdgeOpacity(Number(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Animation Speed ({animSpeed.toFixed(1)}x)</span>
                      <input type="range" min="0.1" max="5" step="0.1" value={animSpeed} onChange={e=>setAnimSpeed(Number(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <button className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-mono py-1.5 rounded transition-colors">[ RESET TRANSFORMATIONS ]</button>
                    </div>
                  </>
                )}

                {settingsActiveTab === 'ai' && (
                  <>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Spark AI Engine</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setSparkEnabled(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${sparkEnabled?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setSparkEnabled(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!sparkEnabled?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Auto-Analyze Selected</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setAutoAnalyze(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${autoAnalyze?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setAutoAnalyze(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!autoAnalyze?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Chat History Cache</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setChatHistory(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${chatHistory?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setChatHistory(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!chatHistory?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Response Style</span>
                      <div className="flex gap-2">
                         {['Concise', 'Detailed'].map(t => <button key={t} onClick={()=>setResponseStyle(t)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${responseStyle===t?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ {t} ]</button>)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Analysis Depth</span>
                      <div className="flex gap-2">
                         {['Basic', 'Deep'].map(t => <button key={t} onClick={()=>setAnalysisDepth(t)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${analysisDepth===t?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ {t} ]</button>)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Context Window Size (Tokens)</span>
                      <input type="number" value={contextSize} onChange={e=>setContextSize(Number(e.target.value))} className="bg-zinc-900 border border-zinc-800 text-white text-[10px] font-mono px-2 py-1.5 rounded" />
                    </div>
                    <div className="col-span-2 mt-2">
                      <button className="w-full bg-purple-900/20 hover:bg-purple-900/40 border border-purple-900/50 text-purple-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ WIPE AGENT CONTEXT ]
                      </button>
                    </div>
                  </>
                )}

                {settingsActiveTab === 'security' && (
                  <>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Local-Only Analysis</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setLocalOnly(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${localOnly?'bg-green-900/40 border-green-500 text-green-300':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setLocalOnly(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!localOnly?'bg-green-900/40 border-green-500 text-green-300':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Send Code to AI</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setSendCodeToAi(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${sendCodeToAi?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setSendCodeToAi(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!sendCodeToAi?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="col-span-2 mt-2 flex flex-col gap-2">
                      <button className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ CLEAR ENGINE CACHE ]
                      </button>
                      <button className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ PURGE CHAT RECORDS ]
                      </button>
                      <button className="w-full bg-orange-900/20 hover:bg-orange-900/40 border border-orange-900/50 text-orange-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ FLUSH KERNEL LOGS ]
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
export default ConsoleDashboardShell;
