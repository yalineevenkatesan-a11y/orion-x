'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

const EXTENSION_MATRIX = [
  { cat: 'Documents', exts: ['.doc', '.docx', '.docm', '.odt', '.rtf', '.txt', '.pages', '.wps', '.tex', '.md', '.rst'] },
  { cat: 'PDF / eBooks', exts: ['.pdf', '.epub', '.mobi', '.azw', '.azw3', '.djvu', '.fb2', '.cbr', '.cbz'] },
  { cat: 'Images', exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg', '.ico', '.heic', '.heif', '.avif', '.raw'] },
  { cat: 'Video', exts: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp', '.ts'] },
  { cat: 'Audio', exts: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.opus', '.m4a', '.wma', '.aiff'] },
  { cat: 'Archives', exts: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.zst', '.tgz', '.iso'] },
  { cat: 'JavaScript / Web', exts: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte'] },
  { cat: 'Python', exts: ['.py', '.pyw', '.pyi', '.ipynb'] },
  { cat: 'Java / Kotlin', exts: ['.java', '.class', '.jar', '.kt', '.kts'] },
  { cat: 'C / C++', exts: ['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hh'] },
  { cat: 'C# / .NET', exts: ['.cs', '.csx', '.csproj', '.sln'] },
  { cat: 'Rust / Go', exts: ['.rs', '.go', '.mod', '.sum', '.toml'] },
  { cat: 'SQL / Database', exts: ['.sql', '.db', '.sqlite', '.sqlite3', '.mdb'] },
  { cat: 'JSON / Data', exts: ['.json', '.jsonl', '.ndjson', '.yaml', '.yml', '.xml', '.csv', '.tsv', '.toml', '.ini', '.conf', '.env'] },
  { cat: 'Shell / Scripts', exts: ['.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1'] },
  { cat: 'Docker / DevOps', exts: ['.dockerfile', '.yaml', '.yml', '.tf', '.tfvars', '.hcl'] },
  { cat: 'Design / 3D', exts: ['.psd', '.ai', '.fig', '.blend', '.fbx', '.obj', '.gltf', '.glb'] }
];

const filterFileTree = (node: any, query: string, activeExts: string[]): any => {
  if (!node) return null;
  const cleanQuery = query.trim().toLowerCase();

  if (node.type === 'dir') {
    const filteredChildren = (node.children || [])
      .map((child: any) => filterFileTree(child, query, activeExts))
      .filter(Boolean);

    if (filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren
      };
    }
    return null;
  }

  const matchesSearch = cleanQuery ? node.name.toLowerCase().includes(cleanQuery) : true;
  
  let matchesExt = true;
  if (activeExts.length > 0) {
    const lastDotIndex = node.name.lastIndexOf('.');
    if (lastDotIndex === -1) {
      matchesExt = false;
    } else {
      const ext = node.name.slice(lastDotIndex).toLowerCase();
      matchesExt = activeExts.includes(ext);
    }
  }

  if (matchesSearch && matchesExt) {
    return node;
  }
  return null;
};

const FileTreeNode = ({ 
  node, 
  depth = 0, 
  onFileSelect,
  autoExpand = false 
}: { 
  node: any; 
  depth?: number; 
  onFileSelect: (n: any) => void;
  autoExpand?: boolean;
}) => {
    const [isExpanded, setIsExpanded] = useState(autoExpand || depth === 0);

    useEffect(() => {
        if (autoExpand) {
            setIsExpanded(true);
        }
    }, [autoExpand]);

    if (node.type === 'dir') {
        return (
            <div style={{ marginLeft: depth > 0 ? '1.5rem' : '0' }}>
                <div 
                    className="text-white font-mono text-xs font-bold cursor-pointer hover:text-[#00D2FF] select-none py-1 flex items-center gap-1.5 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <span className="text-[#00D2FF]">[{isExpanded ? '-' : '+'}]</span>
                    <span className="text-[#A0AEC0]">[DIR]</span>
                    <span>{node.name}</span>
                    {node.children && (
                        <span className="text-[10px] text-[#64748B] font-normal">({node.children.length})</span>
                    )}
                </div>
                {isExpanded && (
                    <div className="border-l border-dashed border-[#2A2A35] ml-2 pl-3 mt-0.5 flex flex-col gap-0.5">
                        {node.children?.map((child: any, i: number) => (
                            <FileTreeNode key={`${child.name}-${child.path || i}`} node={child} depth={depth + 1} onFileSelect={onFileSelect} autoExpand={autoExpand} />
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return (
        <div 
            onClick={() => onFileSelect(node)} 
            className="text-[#A0AEC0] font-mono text-xs cursor-pointer hover:text-[#00D2FF] hover:bg-[#15151C]/60 px-1 py-1 rounded select-none flex items-center transition-colors" 
            style={{ marginLeft: depth > 0 ? '1.5rem' : '0' }}
        >
            <span className="text-[#00D2FF] mr-2 opacity-60">|--</span> {node.name}
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
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [isFsFilterOpen, setIsFsFilterOpen] = useState(false);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [fsFilterSearchQuery, setFsFilterSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    'Documents': true,
    'JavaScript / Web': true,
    'Python': true,
    'Images': true
  });

  const toggleCat = (catName: string) => {
    setExpandedCats(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  const toggleAllInCategory = (exts: string[]) => {
    const allSelected = exts.length > 0 && exts.every(e => selectedExtensions.includes(e));
    if (allSelected) {
      setSelectedExtensions(prev => prev.filter(e => !exts.includes(e)));
    } else {
      setSelectedExtensions(prev => Array.from(new Set([...prev, ...exts])));
    }
  };

  const toggleExtension = (ext: string) => {
    setSelectedExtensions(prev => 
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  useEffect(() => {
    if (activeView === 'files') {
      const vaultPath = 'C:\\Users\\asus\\Downloads'; 
      (window as any).electronAPI?.ipcRenderer?.invoke('fs:getTreeData', vaultPath).then((data: any) => setFileTree(data));
    }
  }, [activeView]);

  const filteredFileTree = useMemo(() => {
    if (!fileTree) return null;
    if (!fileSearchQuery.trim() && selectedExtensions.length === 0) return fileTree;
    return filterFileTree(fileTree, fileSearchQuery, selectedExtensions);
  }, [fileTree, fileSearchQuery, selectedExtensions]);

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
                    className={`px-4 py-3 cursor-pointer ${activeView === 'files' ? 'bg-[#2A2A35] text-white' : 'text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26]'}`}
                >
                    [DIR] Files View
                </div>
                <div 
                    onClick={() => { setActiveView('search'); setShowOptions(false); }}
                    className={`px-4 py-3 cursor-pointer ${activeView === 'search' ? 'bg-[#2A2A35] text-white' : 'text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26]'}`}
                >
                    Global Search
                </div>
                <div 
                    onClick={() => { setActiveView('memory'); setShowOptions(false); }}
                    className={`px-4 py-3 cursor-pointer ${activeView === 'memory' ? 'bg-[#2A2A35] text-white' : 'text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26]'}`}
                >
                    Memory Context Tracker
                </div>
                <div 
                    onClick={() => { setActiveView('chat'); setShowOptions(false); }}
                    className={`px-4 py-3 cursor-pointer ${activeView === 'chat' ? 'bg-[#2A2A35] text-white' : 'text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26]'}`}
                >
                    Multi-Agent Chat Console
                </div>
                <div className="px-4 py-3 text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26] cursor-pointer border-t border-[#2A2A35]">System Settings</div>
            </div>
        )}

        <div className="flex flex-row flex-1 overflow-hidden w-full h-full relative">
            {/* INTERACTIVE CORE WORKSPACE (FULL SCREEN) */}
            <main className="w-full h-full flex-1 flex flex-col bg-[#050508] relative overflow-hidden">
                {/* 3D GRAPH AREA (Underneath) */}
                <div className="absolute inset-0 z-0 w-full h-full">
                    {/* The 3D nodes render here */}
                    <NeuralGraphDashboard />
                </div>

                {/* FILE SYSTEM OVERLAY */}
                {activeView === 'files' && (
                    <div 
                        onWheel={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="absolute inset-0 z-50 bg-[#0B0B10] pl-[25%] pr-8 py-8 h-full max-h-screen overflow-y-auto pointer-events-auto flex flex-col font-mono text-xs text-[#A0AEC0]"
                    >
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#1E1E26] shrink-0">
                            <div>
                                <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ FILE SYSTEM ]</h2>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Structural Workspace Context & Vault Explorer</p>
                            </div>
                            <button onClick={() => setActiveView(null)} className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase">CLOSE [x]</button>
                        </div>

                        {/* Search & Filter Bar Controls */}
                        <div className="flex flex-col gap-3 mb-6 relative z-30 shrink-0">
                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                                {/* Search Input Bar */}
                                <div className="flex items-center bg-[#15151C] border border-[#2A2A35] rounded-lg px-3 py-1.5 flex-1 max-w-md focus-within:border-[#00D2FF] transition-colors">
                                    <span className="text-[#00D2FF] mr-2 font-bold text-xs">[SEARCH]</span>
                                    <input
                                        type="text"
                                        value={fileSearchQuery}
                                        onChange={(e) => setFileSearchQuery(e.target.value)}
                                        placeholder="Filter files by name..."
                                        className="bg-transparent outline-none w-full text-[#E2E8F0] placeholder-[#64748B] text-xs font-mono"
                                    />
                                    {fileSearchQuery && (
                                        <button
                                            onClick={() => setFileSearchQuery('')}
                                            className="text-[#64748B] hover:text-white ml-2 text-xs font-bold font-mono px-1"
                                            title="Clear search"
                                        >
                                            [CLR]
                                        </button>
                                    )}
                                </div>

                                {/* [F] FILTERS Toggle Button */}
                                <button
                                    onClick={() => setIsFsFilterOpen(!isFsFilterOpen)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 border transition-all ${
                                        isFsFilterOpen || selectedExtensions.length > 0
                                            ? 'bg-purple-900/30 text-purple-300 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                                            : 'bg-[#15151C] text-[#A0AEC0] border-[#2A2A35] hover:text-white hover:border-[#3E3E4F]'
                                    }`}
                                >
                                    <span>[F] FILTERS</span>
                                    {selectedExtensions.length > 0 && (
                                        <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                            {selectedExtensions.length}
                                        </span>
                                    )}
                                </button>

                                {/* Active Extension Badges */}
                                {selectedExtensions.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {selectedExtensions.slice(0, 4).map((ext) => (
                                            <span key={ext} className="bg-purple-900/40 border border-purple-500/50 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                                                {ext}
                                                <button onClick={() => toggleExtension(ext)} className="hover:text-white font-bold ml-0.5">×</button>
                                            </span>
                                        ))}
                                        {selectedExtensions.length > 4 && (
                                            <span className="text-[10px] font-mono text-purple-400">+{selectedExtensions.length - 4} more</span>
                                        )}
                                        <button 
                                            onClick={() => setSelectedExtensions([])}
                                            className="text-[10px] font-mono text-[#64748B] hover:text-white underline ml-1"
                                        >
                                            [Clear All]
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Graph Filters Matrix Panel Dropdown */}
                            <AnimatePresence>
                                {isFsFilterOpen && (
                                    <motion.div
                                        onWheel={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                        transition={{ duration: 0.15 }}
                                        className="w-full max-w-2xl bg-[#0B0B10] border border-[#2A2A35] rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col mt-2 max-h-[60vh] shrink-0 pointer-events-auto"
                                    >
                                        <div className="flex items-center justify-between border-b border-[#1E1E26] p-3 bg-[#13131A] shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono font-bold tracking-wider text-purple-400">[ FILTER MATRIX SETTINGS ]</span>
                                                {selectedExtensions.length > 0 && (
                                                    <span className="text-[10px] font-mono text-[#64748B]">({selectedExtensions.length} active)</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {selectedExtensions.length > 0 && (
                                                    <button 
                                                        onClick={() => setSelectedExtensions([])}
                                                        className="text-[10px] font-mono text-purple-400 hover:text-white uppercase"
                                                    >
                                                        [Clear All]
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => setIsFsFilterOpen(false)} 
                                                    className="text-zinc-500 hover:text-red-400 font-mono text-xs px-1.5 py-0.5 border border-zinc-800 rounded bg-zinc-900 transition-colors"
                                                >
                                                    [x]
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-3 border-b border-[#1E1E26] bg-[#0E0E14] shrink-0">
                                            <input 
                                                type="text" 
                                                value={fsFilterSearchQuery} 
                                                onChange={(e) => setFsFilterSearchQuery(e.target.value)} 
                                                placeholder="[ SEARCH CATEGORIES OR EXTENSIONS... ]" 
                                                className="w-full bg-[#15151C] border border-[#2A2A35] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 placeholder-[#64748B]"
                                            />
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 scrollbar-thin">
                                            {EXTENSION_MATRIX.filter(catData => {
                                                if (!fsFilterSearchQuery) return true;
                                                const query = fsFilterSearchQuery.toLowerCase();
                                                return catData.cat.toLowerCase().includes(query) || catData.exts.some(e => e.toLowerCase().includes(query));
                                            }).map(catData => {
                                                const query = fsFilterSearchQuery.toLowerCase();
                                                const isExpanded = query.length > 0 ? true : (expandedCats[catData.cat] ?? false);
                                                const activeCountInCat = catData.exts.filter(e => selectedExtensions.includes(e)).length;
                                                const allSelected = catData.exts.length > 0 && catData.exts.every(e => selectedExtensions.includes(e));

                                                return (
                                                    <div key={catData.cat} className="border border-[#2A2A35] rounded-lg overflow-hidden bg-[#121218] transition-all">
                                                        <div 
                                                            onClick={() => toggleCat(catData.cat)}
                                                            className="bg-[#15151C] px-3.5 py-2.5 text-[11px] font-mono text-gray-200 cursor-pointer select-none hover:text-white hover:bg-[#1C1C24] flex justify-between items-center transition-colors border-b border-[#1E1E26]/60"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[#00D2FF] font-bold text-xs">{isExpanded ? '[-]' : '[+]'}</span>
                                                                <span className="font-bold tracking-wide">{catData.cat.toUpperCase()}</span>
                                                                <span className="text-[10px] text-[#64748B]">({catData.exts.length})</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {activeCountInCat > 0 && (
                                                                    <span className="text-[10px] text-purple-300 font-bold bg-purple-900/40 px-2 py-0.5 rounded border border-purple-500/50">
                                                                        {activeCountInCat} active
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleAllInCategory(catData.exts);
                                                                    }}
                                                                    className="text-[10px] text-cyan-400 hover:text-cyan-200 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded transition-colors"
                                                                >
                                                                    {allSelected ? '[Deselect All]' : '[Select All]'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="p-3 flex flex-wrap gap-2 bg-[#0B0B10]">
                                                                {catData.exts.map(ext => {
                                                                    const isSelected = selectedExtensions.includes(ext);
                                                                    const isMatch = query.length > 0 && ext.toLowerCase().includes(query);
                                                                    return (
                                                                        <button 
                                                                            key={ext} 
                                                                            type="button"
                                                                            onClick={() => toggleExtension(ext)}
                                                                            className={`px-3 py-1.5 min-h-[28px] text-[10px] font-mono rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
                                                                                isSelected 
                                                                                    ? 'bg-purple-900/50 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)] font-bold' 
                                                                                    : (isMatch 
                                                                                        ? 'bg-purple-900/20 border-purple-500/50 text-white' 
                                                                                        : 'bg-[#15151C] border-[#2A2A35] text-gray-400 hover:bg-[#1E1E26] hover:text-white hover:border-[#3E3E4F]')
                                                                            }`}
                                                                        >
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-purple-400 shadow-[0_0_6px_#c084fc]' : 'bg-[#2A2A35]'}`} />
                                                                            <span>{ext}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Filtered File Tree / Fallback View */}
                        <div className="flex-1 overflow-y-auto font-mono text-xs">
                            {fileTree ? (
                                filteredFileTree ? (
                                    <FileTreeNode 
                                        node={filteredFileTree} 
                                        onFileSelect={handleFileClick} 
                                        autoExpand={Boolean(fileSearchQuery.trim() || selectedExtensions.length > 0)} 
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#2A2A35] rounded-xl bg-[#15151C]/40 p-8">
                                        <div className="text-purple-400 font-bold text-sm mb-2 font-mono">[ NO MATCHING FILES FOUND ]</div>
                                        <p className="text-[#64748B] text-xs max-w-sm mb-4 font-mono">
                                            No files matching active search/extension criteria found in current workspace tree.
                                        </p>
                                        <button 
                                            onClick={() => { setFileSearchQuery(''); setSelectedExtensions([]); }}
                                            className="px-4 py-1.5 bg-[#0B0B10] border border-[#2A2A35] hover:border-[#00D2FF] text-xs text-[#00D2FF] font-bold rounded font-mono transition-colors"
                                        >
                                            RESET FILTERS
                                        </button>
                                    </div>
                                )
                            ) : (
                                <div className="text-[#A0AEC0] flex items-center gap-2">
                                    <div className="w-3 h-3 border-2 border-[#00D2FF] border-t-transparent rounded-full animate-spin"></div>
                                    SCANNING NEURAL DIRECTORY...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CHAT CONSOLE OVERLAY */}
                {activeView === 'chat' && (
                    <div className="absolute inset-0 z-50 bg-[#0B0B10] p-8 overflow-y-auto flex flex-col gap-6 font-mono text-xs">
                        <div className="flex justify-between items-center mb-2 pb-4 border-b border-[#1E1E26]">
                            <div>
                                <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ CHAT CONSOLE ]</h2>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Diagnostic Multi-Persona Simulation</p>
                            </div>
                            <button onClick={() => setActiveView(null)} className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase">CLOSE [x]</button>
                        </div>

                        {/* Persona Diagnostic Cards */}
                        <div className="flex flex-row gap-4 shrink-0">
                            <div className="flex-1 p-4 border border-[#2A2A35] rounded-xl bg-[#15151C] font-mono text-xs">
                                <div className="flex justify-between font-bold">
                                    <span className="text-[#00D2FF]">[AGENT: SPARK]</span>
                                    <span className="text-white">[IDLE]</span>
                                </div>
                                <div className="mt-3 text-[#64748B] h-20 overflow-y-auto">SPARK_AI kernel loaded. Awaiting instructions...</div>
                            </div>
                            <div className="flex-1 p-4 border border-[#2A2A35] rounded-xl bg-[#15151C] font-mono text-xs">
                                <div className="flex justify-between font-bold">
                                    <span className="text-[#00D2FF]">[AGENT: VECTOR]</span>
                                    <span className="text-white">[IDLE]</span>
                                </div>
                                <div className="mt-3 text-[#64748B] h-20 overflow-y-auto">VECTOR_AI spatial engine loaded. Standing by...</div>
                            </div>
                            <div className="flex-1 p-4 border border-[#2A2A35] rounded-xl bg-[#15151C] font-mono text-xs">
                                <div className="flex justify-between font-bold">
                                    <span className="text-[#00D2FF]">[AGENT: LOGIC]</span>
                                    <span className="text-white">[IDLE]</span>
                                </div>
                                <div className="mt-3 text-[#64748B] h-20 overflow-y-auto">LOGIC_AI analytical core loaded. System nominal...</div>
                            </div>
                        </div>

                        {/* Main Chat Interface */}
                        <div className="flex-1 flex flex-col border border-[#1E1E26] bg-[#050508] p-4 rounded-xl relative overflow-hidden min-h-[300px]">
                            <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed text-[#A0AEC0] p-2 space-y-4 pb-16">
                                {/* Simulated messages go here */}
                            </div>
                            <input type="text" placeholder="Send a message to all agents..." className="absolute bottom-4 left-4 right-4 bg-[#0B0B10] border border-[#2A2A35] rounded-full px-6 py-2 text-[#A0AEC0] placeholder-[#64748B] outline-none font-mono text-xs" />
                        </div>
                    </div>
                )}

                {/* GLOBAL SEARCH OVERLAY */}
                {activeView === 'search' && (
                    <div className="absolute inset-0 z-50 bg-[#0B0B10] p-8 overflow-y-auto flex flex-col font-mono text-xs text-[#A0AEC0]">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#1E1E26]">
                            <div>
                                <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ GLOBAL SEARCH ]</h2>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Cross-Vault Knowledge & Node Index</p>
                            </div>
                            <button onClick={() => setActiveView(null)} className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase">CLOSE [x]</button>
                        </div>
                        <div className="text-[#A0AEC0] font-mono text-xs">Search query index and knowledge nodes across workspace.</div>
                    </div>
                )}

                {/* MEMORY CONTEXT OVERLAY */}
                {activeView === 'memory' && (
                    <div className="absolute inset-0 z-50 bg-[#0B0B10] p-8 overflow-y-auto flex flex-col font-mono text-xs text-[#A0AEC0]">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#1E1E26]">
                            <div>
                                <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ MEMORY CONTEXT TRACKER ]</h2>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Active Neural Memory Buffer & Cognitive Vector States</p>
                            </div>
                            <button onClick={() => setActiveView(null)} className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase">CLOSE [x]</button>
                        </div>
                        <div className="text-[#A0AEC0] font-mono text-xs">Tracking active neural memory buffer and cognitive vector states.</div>
                    </div>
                )}
            </main>
        </div>

        {activeView === 'file-viewer' && activeFile && (
            <div className="fixed inset-0 z-50 flex bg-[#0B0B10]">
                {/* Left Panel (File Info) */}
                <div className="w-[350px] border-r border-[#1E1E26] flex flex-col h-full font-mono text-xs">
                    <div className="p-4 border-b border-[#1E1E26] font-bold text-white">[ FILE INFORMATION PANEL ]</div>
                    <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
                        
                        {/* BASIC INFO */}
                        <div>
                            <div className="text-white font-bold cursor-pointer hover:text-[#00D2FF] select-none" onClick={() => setBasicInfoOpen(!basicInfoOpen)}>
                                [{basicInfoOpen ? '-' : '+'}] BASIC INFORMATION
                            </div>
                            {basicInfoOpen && (
                                <div className="mt-2 pl-4 flex flex-col gap-2 text-[#A0AEC0]">
                                    <div><span className="text-[#00D2FF]">Name:</span> {activeFile.name}</div>
                                    <div className="break-all"><span className="text-[#00D2FF]">Path:</span> {activeFile.path}</div>
                                </div>
                            )}
                        </div>

                        {/* CODE INFO */}
                        <div>
                            <div className="text-white font-bold cursor-pointer hover:text-[#00D2FF] select-none" onClick={() => setCodeInfoOpen(!codeInfoOpen)}>
                                [{codeInfoOpen ? '-' : '+'}] CODE INFORMATION
                            </div>
                            {codeInfoOpen && <div className="mt-2 pl-4 text-[#A0AEC0]">No code analysis available.</div>}
                        </div>

                        {/* DEPENDENCIES */}
                        <div>
                            <div className="text-white font-bold cursor-pointer hover:text-[#00D2FF] select-none" onClick={() => setDepsOpen(!depsOpen)}>
                                [{depsOpen ? '-' : '+'}] DEPENDENCIES
                            </div>
                            {depsOpen && <div className="mt-2 pl-4 text-[#A0AEC0]">No dependencies found.</div>}
                        </div>
                    </div>
                </div>

                {/* Center Panel (Code View) */}
                <div className="flex-1 flex flex-col bg-[#0B0B10] min-w-0">
                    <div className="h-14 border-b border-[#1E1E26] flex items-center px-4 gap-6 text-xs font-bold text-[#E2E8F0] justify-between">
                        <div className="cursor-pointer hover:text-[#00D2FF] whitespace-nowrap">[G] GRAPH VIEW</div>
                        <div className="cursor-pointer hover:text-[#00D2FF] whitespace-nowrap">[F] GRAPH FILTERS</div>
                        <div className="cursor-pointer hover:text-[#00D2FF] whitespace-nowrap">[O] OPTIONS</div>
                        <div className="w-64 border border-[#1E1E26] rounded px-3 py-1 bg-[#15151C] text-[#A0AEC0] whitespace-nowrap hidden lg:block">
                            [SEARCH] Search nodes, paths, risk:high...
                        </div>
                        <div className="flex flex-row items-center gap-4 ml-auto pr-8">
                            <button 
                                onClick={() => setActiveView('files')} 
                                className="text-[#A0AEC0] hover:text-[#00D2FF] font-bold text-xs whitespace-nowrap border border-[#2A2A35] bg-[#0B0B10] px-4 py-1.5 rounded-full"
                            >
                                [ &lt; BACK TO TREE ]
                            </button>
                            <button 
                                onClick={() => { setActiveView(null); setActiveFile(null); }} 
                                className="text-[#A0AEC0] hover:text-white font-bold text-sm px-4 whitespace-nowrap"
                            >
                                CLOSE [x]
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 relative">
                        {activeFile.content.startsWith('data:image/') ? (
                            <div className="flex items-center justify-center h-full w-full">
                                <img src={activeFile.content} alt={activeFile.name} className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-md" />
                            </div>
                        ) : (
                            <pre className="font-mono text-sm text-[#A0AEC0] overflow-hidden break-all whitespace-pre-wrap">
                                {activeFile.content}
                            </pre>
                        )}
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
