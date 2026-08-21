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
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [codeInfoOpen, setCodeInfoOpen] = useState(false);
  const [depsOpen, setDepsOpen] = useState(false);

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
      const vaultPath = 'C:\\Users\\asus\\Downloads'; 
      (window as any).electronAPI?.ipcRenderer?.invoke('fs:getTreeData', vaultPath).then((data: any) => setFileTree(data));
    }
  }, [activeView]);

  const isActive = bootState === 'active';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0B10] text-[#A0AEC0] font-mono overflow-hidden select-none">
      
      {/* 1. THE GLOBAL HEADER (Top Edge) */}
      <header className="h-16 border-b border-[#1E1E26] flex flex-row items-center justify-between px-6 shrink-0 bg-[#0B0B10] z-50">
          <div className="flex items-center gap-4">
              <button className="px-4 py-1.5 border border-[#2A2A35] rounded hover:bg-[#1E1E26] text-xs">OPTIONS</button>
              <button className="px-4 py-1.5 border border-[#2A2A35] rounded hover:bg-[#1E1E26] text-xs">SWITCH VAULT</button>
              <button className="px-4 py-1.5 border border-[#2A2A35] rounded hover:bg-[#1E1E26] text-xs">&lt; BACK</button>
          </div>
          <div className="flex flex-col items-center">
              <h1 className="text-white font-bold tracking-widest text-sm">ORION-X Neural Core</h1>
              <span className="text-[#00D2FF] text-[10px] uppercase tracking-widest">ACTIVE PIPELINE CONTEXT</span>
          </div>
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#00D2FF]"></div>
                  <span>NODE CONNECTED</span>
              </div>
              <div className="flex items-center gap-2">
                  <button className="w-8 h-8 flex items-center justify-center border border-[#2A2A35] rounded hover:bg-[#1E1E26]">-</button>
                  <button className="w-8 h-8 flex items-center justify-center border border-[#2A2A35] rounded hover:bg-[#1E1E26]">□</button>
                  <button className="w-8 h-8 flex items-center justify-center border border-[#2A2A35] rounded hover:bg-[#1E1E26]">×</button>
              </div>
          </div>
      </header>
  
      {/* MIDDLE SECTION: SIDEBAR + WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
          
          {/* 2 & 3. LEFT SIDEBAR (Nav Panel + Behavior Monitor) */}
          <aside className="w-[280px] border-r border-[#1E1E26] flex flex-col justify-between bg-[#15151C] shrink-0 p-4">
              {/* Tool Selector */}
              <div className="flex flex-col gap-1 border border-[#2A2A35] rounded-md bg-[#0B0B10] overflow-hidden">
                  <div className="px-4 py-3 bg-[#2A2A35] text-white font-bold cursor-pointer">[DIR] Files View</div>
                  <div className="px-4 py-3 hover:text-white hover:bg-[#1E1E26] cursor-pointer">Global Search</div>
                  <div className="px-4 py-3 hover:text-white hover:bg-[#1E1E26] cursor-pointer">Memory Context Tracker</div>
                  <div className="px-4 py-3 hover:text-white hover:bg-[#1E1E26] cursor-pointer">Multi-Agent Chat Console</div>
                  <div className="px-4 py-3 hover:text-white hover:bg-[#1E1E26] cursor-pointer border-t border-[#2A2A35]">System Settings</div>
              </div>
  
              {/* Behavior Monitor */}
              <div className="mt-auto flex flex-col items-center">
                  <div className="border border-[#2A2A35] rounded-full px-3 py-1 mb-2 bg-[#0B0B10] text-[10px]">
                      <span className="text-[#00D2FF]">BEHAVIOR:</span> <span className="text-[#D946EF]">HUGGING_TEDDY</span>
                  </div>
                  <div className="w-[240px] h-[240px] border border-[#2A2A35] rounded-xl bg-[#0B0B10] flex items-center justify-center overflow-hidden">
                      {/* Simulated Radar Circles */}
                      <div className="w-48 h-48 border border-[#311746] rounded-full flex items-center justify-center">
                          <div className="w-40 h-40 border-2 border-[#582A7C] rounded-full flex items-center justify-center">
                              <div className="w-32 h-32 bg-[#170A21] rounded-full"></div>
                          </div>
                      </div>
                  </div>
              </div>
          </aside>
  
          {/* 4. INTERACTIVE CORE WORKSPACE */}
          <main className="flex-1 flex flex-col p-8 overflow-y-auto bg-[#0B0B10] relative">
              {/* The File System View goes here */}
              {activeView === 'files' && (
                  <div className="w-full max-w-5xl">
                      <div className="mb-6">
                          <div className="flex flex-row items-center gap-6 mb-2">
                              <h2 className="text-white font-bold tracking-widest text-lg whitespace-nowrap">[ FILE SYSTEM ]</h2>
                              <div className="flex flex-row items-center border border-[#2A2A35] rounded-full px-4 py-1.5 text-xs text-[#A0AEC0] bg-[#0B0B10]">
                                  <span className="font-bold text-white mr-4 hover:text-[#00D2FF] cursor-pointer whitespace-nowrap">[F] GRAPH FILTERS</span>
                                  <span className="font-bold text-white mr-4 border-l border-[#2A2A35] pl-4 hover:text-[#00D2FF] cursor-pointer whitespace-nowrap">[O] OPTIONS</span>
                                  <span className="border-l border-[#2A2A35] pl-4 flex flex-row items-center min-w-[300px]">
                                      <span className="mr-3 text-[#A0AEC0] whitespace-nowrap">[SEARCH]</span>
                                      <input type="text" placeholder="Search nodes, paths, risk:high..." className="bg-transparent outline-none w-full text-[#A0AEC0] placeholder-[#2A2A35]" />
                                  </span>
                              </div>
                          </div>
                          <p className="text-[#64748B] text-xs font-mono mt-2 mb-4">Structural Workspace Context</p>
                          <hr className="border-[#1E1E26] w-full" />
                      </div>
                      
                      {/* Dynamic File Tree Injection */}
                      <div className="font-mono text-sm leading-tight mt-6">
                          {fileTree ? <FileTreeNode node={fileTree} onFileSelect={handleFileClick} /> : <div className="text-[#A0AEC0]">SCANNING NEURAL DIRECTORY...</div>}
                      </div>
                  </div>
              )}
          </main>
      </div>
  
      {/* 5. THE APPLICATION FOOTER */}
      <footer className="h-8 border-t border-[#1E1E26] bg-[#050508] flex flex-row items-center justify-center gap-8 text-[10px] shrink-0 font-bold z-50">
          <div className="flex items-center gap-4">
              <span>NODES: <span className="text-white">19</span> / 19</span>
              <span>EDGES: <span className="text-white">18</span> / 18</span>
          </div>
          <div className="w-px h-4 bg-[#2A2A35]"></div>
          <div className="flex items-center gap-4">
              <span className="text-[#22C55E]">[OK] 19</span>
              <span className="text-[#EAB308]">[WARN] 0</span>
              <span className="text-[#EF4444]">[CRIT] 0</span>
          </div>
      </footer>
  
      {/* FLOATING ACTION BUTTON */}
      <div className="absolute bottom-12 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-[0_0_20px_rgba(139,92,246,0.5)] z-[100]">
          <span className="text-white text-xl">✨</span>
      </div>
    </div>
  );
}
