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

const FileTreeNode = ({ node, depth = 0, onFileSelect }: { node: any; depth?: number, onFileSelect: (n: any) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const indent = depth > 0 ? '1.5rem' : '0';

    if (node.type === 'dir') {
        return (
            <div style={{ marginLeft: indent }}>
                <div 
                    className="text-white font-bold cursor-pointer hover:text-[#00D2FF] select-none py-0.5 flex items-center"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    [{isExpanded ? '-' : '+'}] [DIR] {node.name}
                </div>
                {isExpanded && (
                    <div className="border-l border-dashed border-[#2A2A35] ml-2 pl-4 mt-1 flex flex-col gap-1">
                        {node.children?.map((child: any, i: number) => (
                            <FileTreeNode key={`${child.name}-${i}`} node={child} depth={depth + 1} onFileSelect={onFileSelect} />
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return (
        <div onClick={() => onFileSelect(node)} className="text-[#A0AEC0] cursor-pointer hover:text-white py-0.5 select-none flex items-center" style={{ marginLeft: indent }}>
            <span className="text-[#00D2FF] mr-2">|--</span> {node.name}
        </div>
    );
};
export function WorkspaceLayout() {
  const [bootState, setBootState] = useState<'initializing' | 'active'>('initializing');
  const { activeWorkspace } = useWorkspaceUi();
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isCodeModalOpen, setCodeModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const [showOptions, setShowOptions] = useState(false);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<{name: string, content: string, path: string} | null>(null);

  const handleFileClick = async (node: any) => {
      const content = await (window as any).electronAPI?.ipcRenderer?.invoke('fs:readFile', node.path);
      setActiveFile({ name: node.name, content, path: node.path });
      setActiveView('file-viewer');
  };

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
      (window as any).electronAPI?.ipcRenderer?.invoke('fs:getTreeData', 'C:\\Users\\asus\\.gemini\\antigravity\\scratch').then((data: any) => setFileTree(data));
    }
  }, [activeView]);

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
            <div className="fixed top-24 left-[280px] right-0 bottom-0 bg-[#0B0B10] z-50 p-8 overflow-y-auto border-l border-t border-[#1E1E26] shadow-2xl flex flex-col">
                <div className="mb-6 w-full">
                    <div className="flex flex-row items-center justify-between w-full mb-2">
                        <div className="flex flex-row items-center gap-6">
                            <h2 className="text-white font-bold tracking-widest text-lg whitespace-nowrap">[ FILE SYSTEM ]</h2>
                            <div className="flex flex-row items-center border border-[#2A2A35] rounded-full px-4 py-1.5 text-xs text-[#A0AEC0] bg-[#0B0B10] whitespace-nowrap flex-shrink-0">
                                <span className="font-bold text-white mr-4 hover:text-[#00D2FF] cursor-pointer whitespace-nowrap">[F] GRAPH FILTERS</span>
                                <span className="font-bold text-white mr-4 border-l border-[#2A2A35] pl-4 hover:text-[#00D2FF] cursor-pointer whitespace-nowrap">[O] OPTIONS</span>
                                <span className="border-l border-[#2A2A35] pl-4 flex flex-row items-center min-w-[200px]">
                                    <span className="mr-2 text-white whitespace-nowrap">[SEARCH]</span>
                                    <input type="text" placeholder="Search nodes..." className="bg-transparent outline-none w-full text-[#A0AEC0] placeholder-[#64748B]" />
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setActiveView(null)} className="text-[#A0AEC0] hover:text-white whitespace-nowrap uppercase tracking-widest text-xs px-4">
                            CLOSE [x]
                        </button>
                    </div>
                    <p className="text-[#64748B] text-xs font-mono mb-4">Structural Workspace Context</p>
                    <hr className="border-[#1E1E26] w-full" />
                </div>
                
                {/* Live Data File Tree */}
                <div className="font-mono text-sm">
                    {fileTree ? <FileTreeNode node={fileTree} onFileSelect={handleFileClick} /> : <div className="text-[#A0AEC0]">SCANNING NEURAL DIRECTORY...</div>}
                </div>
            </div>
        )}

        {activeView === 'file-viewer' && activeFile && (
            <div className="fixed inset-0 z-50 flex bg-[#0B0B10]">
                {/* Left Panel (File Info) */}
                <div className="w-[350px] border-r border-[#1E1E26] flex flex-col">
                    <div className="p-4 border-b border-[#1E1E26] text-white font-bold text-sm tracking-widest">
                        [ FILE INFORMATION PANEL ]
                    </div>
                    <div className="p-4 flex flex-col gap-4 text-xs font-mono text-[#A0AEC0]">
                        <div>
                            <div className="text-[#E2E8F0] mb-2 cursor-pointer">[-] BASIC INFORMATION</div>
                            <div className="pl-4 flex flex-col gap-1">
                                <div><span className="text-[#00D2FF]">Name:</span> {activeFile.name}</div>
                                <div><span className="text-[#00D2FF]">Path:</span> {activeFile.path}</div>
                                <div><span className="text-[#00D2FF]">Size:</span> {activeFile.content.length} Bytes</div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[#E2E8F0] cursor-pointer">[+] CODE INFORMATION</div>
                        </div>
                        <div>
                            <div className="text-[#E2E8F0] cursor-pointer">[+] DEPENDENCIES</div>
                        </div>
                    </div>
                </div>

                {/* Center Panel (Code View) */}
                <div className="flex-1 flex flex-col bg-[#0B0B10]">
                    <div className="h-14 border-b border-[#1E1E26] flex items-center px-4 gap-6 text-xs font-bold text-[#E2E8F0]">
                        <div className="cursor-pointer hover:text-[#00D2FF]">[G] GRAPH VIEW</div>
                        <div className="cursor-pointer hover:text-[#00D2FF]">[F] GRAPH FILTERS</div>
                        <div className="cursor-pointer hover:text-[#00D2FF]">[O] OPTIONS</div>
                        <div className="flex-1"></div>
                        <div className="w-64 border border-[#1E1E26] rounded px-3 py-1 bg-[#15151C] text-[#A0AEC0]">
                            [SEARCH] Search nodes, paths, risk:high...
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <pre className="font-mono text-sm text-[#A0AEC0] whitespace-pre-wrap">
                            {activeFile.content}
                        </pre>
                    </div>
                </div>

                {/* Right Panel (AI Stream) */}
                <div className="w-[300px] border-l border-[#1E1E26] flex flex-col bg-[#0B0B10]">
                    <div className="h-14 border-b border-[#1E1E26] flex items-center justify-end px-4">
                        <button 
                            onClick={() => setActiveView('files')}
                            className="text-xs font-bold text-[#E2E8F0] border border-[#1E1E26] px-3 py-1 hover:border-[#00D2FF]"
                        >
                            [ &lt; BACK TO TREE ]
                        </button>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center text-[#A0AEC0] text-xs font-mono gap-4">
                        <div className="w-8 h-8 border-t-2 border-[#00D2FF] border-solid rounded-full animate-spin"></div>
                        <div>LOADING FILE STREAM...</div>
                    </div>
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
