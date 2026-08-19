'use client';

import React, { useState, useEffect } from 'react';
import { NeuralNodes } from './NeuralNodes';
import dynamic from 'next/dynamic';

const NeuralGraphDashboardNoSSR = dynamic(
  () => import('./NeuralGraphDashboard').then(mod => mod.NeuralGraphDashboard as any),
  { ssr: false }
);
import { ProjectSidebar } from '../sidebar/ProjectSidebar';
import { AiManagementPanel } from './AiManagementPanel';

import { useWorkspaceUi } from '../../context/WorkspaceUiContext';
import { motion, AnimatePresence } from 'framer-motion';
import NeuralGraphDashboard from './NeuralGraphDashboard';

export function WorkspaceLayout() {
  const [bootState, setBootState] = useState<'initializing' | 'active'>('initializing');
  const { activeWorkspace } = useWorkspaceUi();
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isCodeModalOpen, setCodeModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const [showOptions, setShowOptions] = useState(false);
  const [activeView, setActiveView] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBootState('active');
    }, 2000); // 2-second boot delay
    return () => clearTimeout(timer);
  }, []);

  const [fileTree, setFileTree] = useState<any>(null);

  useEffect(() => {
    if (activeView === 'files') {
      (window as any).electronAPI?.ipcRenderer?.invoke('fs:getTreeData').then((data: any) => setFileTree(data));
    }
  }, [activeView]);

  const renderTree = (node: any, depth = 0): any => {
    if (!node) return null;
    if (node.type === 'dir') {
      return (
        <div key={node.name} style={{ marginLeft: depth > 0 ? '1.5rem' : '0' }} className={depth > 0 ? "border-l border-[#1E1E26] pl-4" : ""}>
          <div className="text-white font-bold py-1 cursor-pointer hover:text-[#00D2FF] transition-colors">
            [-] [DIR] {node.name}
          </div>
          <div>{node.children?.map((child: any) => renderTree(child, depth + 1))}</div>
        </div>
      );
    }
    return (
      <div key={node.name} style={{ marginLeft: depth > 0 ? '1.5rem' : '0' }} className={`text-[#A0AEC0] py-1 cursor-pointer hover:text-white transition-colors ${depth > 0 ? 'border-l border-[#1E1E26] pl-4' : ''}`}>
        |-- {node.name}
      </div>
    );
  };

  const isActive = bootState === 'active';

  return (
    <>
    <div 
      className="relative flex overflow-hidden bg-[#0B0B10] font-sans"
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}
    >
      
      {/* Background Neural Nodes canvas */}
      <NeuralNodes isInitialized={isActive} />

      {/* 1. Initialization Loading Screen (Active during the 2000ms boot) */}
      {bootState === 'initializing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <span className="text-sm font-mono tracking-[0.4em] text-cyber-400 animate-pulse">
              INITIALIZING CORE...
            </span>
            <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-quantum-500 to-cyber-500 rounded-full animate-loading-bar" />
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Workspace Layout Grid */}
      <div className="relative z-10 flex flex-col w-full h-full">
        
        {/* Global Application Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#0B0B10] z-30 select-none shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
            {/* Title moved to absolute container */}
          </div>
          <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="flex items-center gap-2 mr-4">
              <span className="w-2 h-2 rounded-full bg-cyber-500 animate-pulse" />
              <span className="text-xs text-gray-400 font-mono">NODE CONNECTED</span>
            </div>
            
            {/* Frame Control Widgets */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <button 
                onClick={() => (window as any).electronAPI?.ipcRenderer?.send('window-control', 'minimize')}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white transition-colors"
                title="Minimize"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
              </button>
              <button 
                onClick={() => (window as any).electronAPI?.ipcRenderer?.send('window-control', 'maximize')}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white transition-colors"
                title="Maximize/Restore"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" strokeWidth="2" /></svg>
              </button>
              <button 
                onClick={() => (window as any).electronAPI?.ipcRenderer?.send('window-control', 'close')}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/5 text-gray-400 hover:text-red-400 transition-colors"
                title="Close"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </header>

        {/* Restored Layout Elements */}
        
        {/* Top-Left Control Cluster */}
        <div className="absolute top-6 left-6 z-50 flex flex-row items-center gap-8 pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowOptions((prev) => !prev)}
                className="px-4 py-2 bg-[#0B0B10] border border-[#1E1E26] outline-none focus:outline-none text-xs font-bold text-[#E2E8F0] uppercase tracking-widest hover:border-[#00D2FF]"
              >
                OPTIONS
              </button>
            </div>
            <button className="px-4 py-2 bg-[#0B0B10] border border-[#1E1E26] outline-none focus:outline-none text-xs font-bold text-[#E2E8F0] uppercase tracking-widest hover:border-[#00D2FF]">SWITCH VAULT</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('orion:reset-zoom'))} className="px-4 py-2 bg-[#0B0B10] border border-[#1E1E26] outline-none focus:outline-none text-xs font-bold text-[#E2E8F0] uppercase tracking-widest hover:border-[#00D2FF]">&lt; BACK</button>
          </div>

          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-white tracking-wide">
              ORION-X Neural Core
            </h2>
            <span className="text-[10px] text-cyber-500 font-mono tracking-wider">
              ACTIVE PIPELINE CONTEXT
            </span>
          </div>
        </div>

        {showOptions && (
            <div className="absolute top-20 left-6 w-64 bg-[#15151C] border border-[#2A2A35] rounded-md z-50 overflow-hidden flex flex-col font-mono text-sm shadow-2xl">
                <div 
                    onClick={() => { setActiveView('files'); setShowOptions(false); }}
                    className="px-4 py-3 bg-[#2A2A35] text-white cursor-pointer"
                >
                    [DIR] Files View
                </div>
                <div className="px-4 py-3 text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26] cursor-pointer">Global Search</div>
                <div className="px-4 py-3 text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26] cursor-pointer">Memory Context Tracker</div>
                <div className="px-4 py-3 text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26] cursor-pointer">Multi-Agent Chat Console</div>
                <div className="px-4 py-3 text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26] cursor-pointer border-t border-[#2A2A35]">System Settings</div>
            </div>
        )}

        {activeView === 'files' && (
            <div className="absolute top-32 left-80 right-8 bottom-24 bg-[#0B0B10] z-40 overflow-y-auto pl-4">
                <div className="mb-6 mr-16">
                    <div className="flex items-center gap-4">
                        <h2 className="text-white font-bold tracking-widest text-lg">[ FILE SYSTEM ]</h2>
                        <button onClick={() => setActiveView(null)} className="text-[#A0AEC0] hover:text-white ml-auto">CLOSE [x]</button>
                    </div>
                    <p className="text-[#64748B] text-xs font-mono mt-2 mb-4">Structural Workspace Context</p>
                    <hr className="border-[#1E1E26]" />
                </div>
                
                {/* Live Data File Tree */}
                <div className="font-mono text-sm leading-8">
                    {fileTree ? renderTree(fileTree) : <div className="text-[#A0AEC0]">SCANNING NEURAL DIRECTORY...</div>}
                </div>
            </div>
        )}
        {/* Absolute 3D Canvas */}
        <div className="absolute inset-0 z-0 w-screen h-screen">
          <NeuralGraphDashboard />
        </div>
      </div>

          <style jsx global>{`
            @keyframes loadingBar {
              0% { width: 0%; transform: translateX(0%); }
              50% { width: 70%; }
              100% { width: 100%; }
            }
            .animate-loading-bar { animation: loadingBar 2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          `}</style>
        </div>

        {/* Spark Orb Trigger */}
        <button 
          onClick={() => setIsAssistantOpen(!isAssistantOpen)}
          className="group absolute bottom-8 right-8 z-[100] flex items-center justify-center transition-all duration-300"
          style={{
            width: '3.5rem', height: '3.5rem',
            borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #a855f7, #6366f1 60%, #ec4899)',
            border: 'none', cursor: 'pointer', boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 0 25px rgba(236, 72, 153, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.4)';
          }}
          title="Spark AI Core"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white drop-shadow-md">
            <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z" fill="currentColor"/>
            <path d="M19 14L20 17L23 18L20 19L19 22L18 19L15 18L18 17L19 14Z" fill="currentColor"/>
            <path d="M6 18L6.5 20L8.5 20.5L6.5 21L6 23L5.5 21L3.5 20.5L5.5 20L6 18Z" fill="currentColor"/>
          </svg>
        </button>

        {/* SVG Wire Layer */}
        {selectedNode && isAssistantOpen && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 90 }}>
            <path 
              d={`M ${windowSize.width * 0.5} ${windowSize.height * 0.5} C ${windowSize.width * 0.7} ${windowSize.height * 0.5}, ${windowSize.width - 360} ${windowSize.height - 300}, ${windowSize.width - 360} ${windowSize.height - 100}`}
              stroke="#06b6d4" strokeWidth="2" strokeDasharray="4 4" fill="transparent" opacity="0.6"
            />
          </svg>
        )}

      {/* Code View Modal */}
      <AnimatePresence>
        {isCodeModalOpen && selectedNode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col bg-[#0B0B10] p-12"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-cyan-400 font-mono text-sm tracking-widest uppercase">RAW FILE STREAM: {selectedNode.label}</span>
              <button onClick={() => setCodeModalOpen(false)} className="text-gray-400 hover:text-white font-mono text-xs uppercase tracking-widest bg-white/5 border border-white/10 px-4 py-2 hover:bg-red-500/20 hover:text-red-400 transition-colors">
                [CLOSE STREAM]
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-[#0B0B10] border border-white/10 p-6 font-mono text-[12px] text-gray-300 shadow-2xl rounded-sm selection:bg-cyan-900 selection:text-white">
              <code>{selectedNode.fileContent || '// No source data available'}</code>
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
