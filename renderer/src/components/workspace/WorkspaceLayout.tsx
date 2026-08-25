'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

interface DraggableState {
  x: number;
  y: number;
}

export function useDraggableModal(initialPos = { x: 0, y: 0 }) {
  const [position, setPosition] = useState<DraggableState>(initialPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [data-no-drag]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const nextX = dragStartRef.current.posX + dx;
      const nextY = dragStartRef.current.posY + dy;

      const limitX = typeof window !== 'undefined' ? window.innerWidth * 0.85 : 800;
      const limitY = typeof window !== 'undefined' ? window.innerHeight * 0.85 : 600;

      setPosition({
        x: Math.max(-limitX, Math.min(limitX, nextX)),
        y: Math.max(-limitY, Math.min(limitY, nextY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return {
    position,
    setPosition,
    isDragging,
    resetPosition,
    headerProps: {
      onMouseDown: handleHeaderMouseDown,
      style: { cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' as const },
    },
    style: {
      transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      willChange: isDragging ? 'transform' : 'auto',
    } as React.CSSProperties,
  };
}

export function ImagePanZoomViewer({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, [src]);

  const handleReset = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomDelta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((prev) => Math.min(5, Math.max(0.5, parseFloat((prev + zoomDelta).toFixed(2)))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsPanning(true);
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: translateX,
      startY: translateY,
    };
  };

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setTranslateX(panStartRef.current.startX + dx);
      setTranslateY(panStartRef.current.startY + dy);
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none bg-[#07070B]"
      onWheel={handleWheel}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Pan & Zoom Controls Toolbar */}
      <div 
        className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[#15151C]/90 backdrop-blur border border-[#2A2A35] px-3 py-1.5 rounded-lg shadow-lg font-mono text-xs text-[#E2E8F0]"
        data-no-drag
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setScale((prev) => Math.max(0.5, parseFloat((prev - 0.25).toFixed(2))))}
          className="px-2 py-0.5 bg-[#0B0B10] border border-[#2A2A35] rounded hover:border-[#00D2FF] hover:text-[#00D2FF] transition-colors"
          title="Zoom Out"
        >
          -
        </button>
        <span className="min-w-[50px] text-center font-bold text-[#00D2FF]">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((prev) => Math.min(5, parseFloat((prev + 0.25).toFixed(2))))}
          className="px-2 py-0.5 bg-[#0B0B10] border border-[#2A2A35] rounded hover:border-[#00D2FF] hover:text-[#00D2FF] transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="ml-2 px-2.5 py-0.5 bg-[#0B0B10] border border-[#2A2A35] rounded hover:border-cyan-400 hover:text-white transition-colors text-[10px] font-bold tracking-wider"
          title="Reset Transformations"
        >
          [ RESET ]
        </button>
      </div>

      {/* Panning & Zooming Image Stage */}
      <div 
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing p-4"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-md pointer-events-none"
          style={{
            transform: `translate3d(${translateX}px, ${translateY}px, 0px) scale(${scale})`,
            transition: isPanning ? 'none' : 'transform 0.08s ease-out',
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* Helper Badge */}
      <div className="absolute bottom-3 left-4 z-10 text-[10px] font-mono text-[#64748B] pointer-events-none">
        DRAG TO PAN • WHEEL TO ZOOM (0.5x - 5x)
      </div>
    </div>
  );
}

const EXTENSION_MATRIX = [
  { cat: 'Documents', exts: ['.doc', '.docx', '.docm', '.odt', '.rtf', '.txt', '.pages', '.wps', '.tex', '.md', '.rst'] },
  { cat: 'PDF / eBooks', exts: ['.pdf', '.epub', '.mobi', '.azw', '.azw3', '.djvu', '.fb2', '.cbr', '.cbz'] },
  { cat: 'Images', exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg', '.ico', '.heic', '.heif', '.avif', '.raw', '.cr2', '.cr3', '.nef', '.arw', '.dng'] },
  { cat: 'Video', exts: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp', '.ts', '.mts', '.m2ts'] },
  { cat: 'Audio', exts: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.opus', '.m4a', '.wma', '.aiff', '.alac', '.mid', '.midi'] },
  { cat: 'Archives', exts: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.zst', '.tgz', '.tbz2', '.cab', '.iso', '.img'] },
  { cat: 'JavaScript / Web', exts: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte'] },
  { cat: 'Python', exts: ['.py', '.pyw', '.pyi', '.pyc', '.pyo', '.ipynb', '.pyx', '.pxd', '.pxi'] },
  { cat: 'Java', exts: ['.java', '.class', '.jar', '.war', '.ear', '.jsp'] },
  { cat: 'C / C++', exts: ['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hh', '.hxx', '.inl'] },
  { cat: 'C# / .NET', exts: ['.cs', '.csx', '.cshtml', '.vb', '.fs', '.fsx', '.sln', '.csproj', '.vbproj'] },
  { cat: 'Go', exts: ['.go', '.mod', '.sum', '.work'] },
  { cat: 'Rust', exts: ['.rs', '.toml'] },
  { cat: 'PHP', exts: ['.php', '.php3', '.php4', '.php5', '.phtml', '.phar'] },
  { cat: 'Ruby', exts: ['.rb', '.rbw', '.rake', '.gemspec', '.erb'] },
  { cat: 'Kotlin', exts: ['.kt', '.kts'] },
  { cat: 'Swift', exts: ['.swift'] },
  { cat: 'Dart / Flutter', exts: ['.dart'] },
  { cat: 'SQL / Database', exts: ['.sql', '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dbf', '.dump'] },
  { cat: 'JSON / Data', exts: ['.json', '.jsonl', '.ndjson', '.yaml', '.yml', '.xml', '.csv', '.tsv', '.toml', '.ini', '.conf', '.env'] },
  { cat: 'Shell', exts: ['.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1', '.psm1', '.psd1'] },
  { cat: 'Linux/System', exts: ['.service', '.socket', '.mount', '.desktop', '.deb', '.rpm', '.appimage'] },
  { cat: 'Windows', exts: ['.exe', '.dll', '.sys', '.msi', '.msix', '.scr', '.com', '.cpl', '.drv', '.ocx'] },
  { cat: 'macOS', exts: ['.app', '.dmg', '.pkg', '.plist', '.framework', '.bundle'] },
  { cat: 'Android', exts: ['.apk', '.aab', '.dex', '.odex', '.vdex', '.so', '.aar'] },
  { cat: 'iOS', exts: ['.ipa', '.mobileconfig', '.xcarchive', '.framework', '.xcframework'] },
  { cat: 'Docker / DevOps', exts: ['.dockerfile', '.yaml', '.yml', '.tf', '.tfvars', '.hcl', '.vagrantfile'] },
  { cat: 'Git', exts: ['.gitignore', '.gitattributes', '.gitmodules', '.gitconfig'] },
  { cat: 'AI / ML', exts: ['.pt', '.pth', '.ckpt', '.safetensors', '.onnx', '.pb', '.h5', '.keras', '.tflite', '.bin', '.gguf', '.ggml', '.pkl', '.joblib', '.npz', '.npy'] },
  { cat: 'Jupyter / Data Science', exts: ['.ipynb', '.parquet', '.feather', '.arrow', '.pickle', '.pkl', '.rds', '.rda'] },
  { cat: 'MATLAB', exts: ['.m', '.mat', '.mlx', '.fig'] },
  { cat: 'R', exts: ['.r', '.rmd', '.rds', '.rda'] },
  { cat: 'Excel / Spreadsheet', exts: ['.xls', '.xlsx', '.xlsm', '.xlsb', '.xltx', '.ods', '.csv'] },
  { cat: 'PowerPoint', exts: ['.ppt', '.pptx', '.pptm', '.pps', '.ppsx', '.odp'] },
  { cat: 'CAD', exts: ['.dwg', '.dxf', '.dgn', '.step', '.stp', '.iges', '.igs', '.stl', '.obj', '.3mf'] },
  { cat: '3D', exts: ['.blend', '.fbx', '.obj', '.gltf', '.glb', '.dae', '.abc', '.3ds', '.max', '.ma', '.mb', '.c4d'] },
  { cat: 'Game Development', exts: ['.unity', '.unitypackage', '.uasset', '.umap', '.pak', '.wad', '.bsp', '.sav'] },
  { cat: 'Fonts', exts: ['.ttf', '.otf', '.woff', '.woff2', '.eot', '.fon'] },
  { cat: 'Design', exts: ['.psd', '.ai', '.eps', '.indd', '.xd', '.fig', '.sketch', '.afdesign', '.afphoto'] },
  { cat: 'GIS / Maps', exts: ['.shp', '.shx', '.dbf', '.prj', '.geojson', '.kml', '.kmz', '.gpx', '.tif'] },
  { cat: 'Scientific', exts: ['.fits', '.hdf', '.hdf5', '.nc', '.cdf', '.dat', '.xyz', '.pdb', '.mol', '.sdf'] }
];

const filterFileTree = (node: any, query: string, activeExts: string[], activeHealth: string[] = []): any => {
  if (!node) return null;
  const cleanQuery = query.trim().toLowerCase();

  if (node.type === 'dir') {
    const filteredChildren = (node.children || [])
      .map((child: any) => filterFileTree(child, query, activeExts, activeHealth))
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

  let matchesHealth = true;
  if (activeHealth.length > 0) {
    const nodeHealth = (node.health || 'healthy').toLowerCase();
    matchesHealth = activeHealth.includes(nodeHealth);
  }

  if (matchesSearch && matchesExt && matchesHealth) {
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

  const fileViewerDrag = useDraggableModal();
  const filesOverlayDrag = useDraggableModal();
  const chatOverlayDrag = useDraggableModal();
  const searchOverlayDrag = useDraggableModal();
  const memoryOverlayDrag = useDraggableModal();
  const codeModalDrag = useDraggableModal();

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
  const [selectedHealth, setSelectedHealth] = useState<string[]>([]);
  const [fsFilterMode, setFsFilterMode] = useState<'ALL' | 'ANY'>('ALL');
  const [fsFilterSearchQuery, setFsFilterSearchQuery] = useState('');

  const toggleHealth = (h: string) => {
    setSelectedHealth(prev => 
      prev.includes(h) ? prev.filter(item => item !== h) : [...prev, h]
    );
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
    if (!fileSearchQuery.trim() && selectedExtensions.length === 0 && selectedHealth.length === 0) return fileTree;
    return filterFileTree(fileTree, fileSearchQuery, selectedExtensions, selectedHealth);
  }, [fileTree, fileSearchQuery, selectedExtensions, selectedHealth]);

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
                <div 
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('orion:toggle-settings'));
                        setShowOptions(false);
                    }}
                    className="px-4 py-3 text-[#A0AEC0] hover:text-white hover:bg-[#1E1E26] cursor-pointer border-t border-[#2A2A35]"
                >
                    System Settings
                </div>
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
                        style={filesOverlayDrag.style}
                    >
                        <div 
                            {...filesOverlayDrag.headerProps}
                            className="flex justify-between items-center mb-4 pb-4 border-b border-[#1E1E26] shrink-0 cursor-move select-none"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ FILE SYSTEM ]</h2>
                                    <span className="text-[10px] text-[#64748B] font-mono tracking-wider">[DRAGGABLE]</span>
                                </div>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Structural Workspace Context & Vault Explorer</p>
                            </div>
                            <button 
                                data-no-drag
                                onClick={() => setActiveView(null)} 
                                className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase px-2 py-1 rounded bg-[#15151C] border border-[#2A2A35]"
                            >
                                CLOSE [x]
                            </button>
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
                                        className="w-full max-w-2xl bg-[#0B0B10] border border-[#1E1E26] shadow-[0_0_25px_rgba(0,0,0,0.9)] rounded-xl flex flex-col overflow-hidden mt-2 max-h-[60vh] shrink-0 pointer-events-auto z-[60]"
                                    >
                                        <div className="flex items-center justify-between border-b border-zinc-800 p-3 mb-1 drag-handle cursor-move bg-[#13131A] shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono font-bold tracking-wider text-purple-400">[ FILTER MATRIX SETTINGS ]</span>
                                                {(selectedExtensions.length > 0 || selectedHealth.length > 0) && (
                                                    <span className="text-[10px] font-mono text-[#64748B]">
                                                        ({selectedExtensions.length + selectedHealth.length} active)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {(selectedExtensions.length > 0 || selectedHealth.length > 0) && (
                                                    <button 
                                                        onClick={() => { setSelectedExtensions([]); setSelectedHealth([]); }}
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
                                        
                                        <div className="px-3 pb-2 border-b border-zinc-800 shrink-0">
                                            <input 
                                                type="text" 
                                                value={fsFilterSearchQuery} 
                                                onChange={(e) => setFsFilterSearchQuery(e.target.value)} 
                                                placeholder="[ SEARCH CATEGORIES OR EXTENSIONS... ]" 
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-600"
                                            />
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-thin">
                                            
                                            {/* LOGIC ENGINE */}
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-mono text-gray-400 uppercase">Logic Engine</span>
                                                    <button onClick={() => setFsFilterMode(prev => prev === 'ALL' ? 'ANY' : 'ALL')} className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded border border-white/20 text-white hover:bg-white/20 transition-colors">
                                                        {fsFilterMode === 'ALL' ? 'ALL (AND)' : 'ANY (OR)'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* HEALTH STATE */}
                                            <div className="flex flex-col gap-2">
                                                <span className="text-[10px] font-mono text-gray-500 uppercase">Health State</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {['healthy', 'warning', 'critical'].map(h => (
                                                        <button 
                                                            key={h} onClick={() => toggleHealth(h)}
                                                            className={`px-3 py-1 text-[10px] font-mono rounded border transition-colors ${selectedHealth.includes(h) ? 'bg-cyan-900/40 border-cyan-500 text-white shadow-[0_0_10px_rgba(0,210,255,0.4)]' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                                        >
                                                            {h === 'critical' ? '[CRIT]' : h === 'warning' ? '[WARN]' : '[OK]'} {h.toUpperCase()}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* FILE EXTENSION MATRIX */}
                                            <div className="flex flex-col gap-2">
                                                <span className="text-[10px] font-mono text-gray-500 uppercase">File Extension Matrix</span>
                                                <div className="flex flex-col gap-3">
                                                    {EXTENSION_MATRIX.filter(catData => {
                                                        if (!fsFilterSearchQuery) return true;
                                                        const query = fsFilterSearchQuery.toLowerCase();
                                                        return catData.cat.toLowerCase().includes(query) || catData.exts.some(e => e.toLowerCase().includes(query));
                                                    }).map(catData => {
                                                        const query = fsFilterSearchQuery.toLowerCase();
                                                        const isExpanded = query.length > 0 && (catData.cat.toLowerCase().includes(query) || catData.exts.some(e => e.toLowerCase().includes(query)));
                                                        
                                                        return (
                                                            <details key={catData.cat} className="border border-white/5 rounded overflow-hidden" open={isExpanded || false}>
                                                                <summary className="bg-[#13131A] px-3 py-2 text-[10px] font-mono text-gray-300 cursor-pointer select-none outline-none hover:text-white hover:bg-white/5">
                                                                    {catData.cat.toUpperCase()}
                                                                </summary>
                                                                <div className="p-2 flex flex-wrap gap-1.5 bg-[#0B0B10]">
                                                                    {catData.exts.map(ext => {
                                                                        const isMatch = query.length > 0 && ext.toLowerCase().includes(query);
                                                                        const isSelected = selectedExtensions.includes(ext);
                                                                        return (
                                                                            <button 
                                                                                key={ext} onClick={() => toggleExtension(ext)}
                                                                                className={`px-2 py-1 text-[9px] font-mono rounded border transition-colors ${isSelected ? 'bg-cyan-900/40 border-cyan-500 text-white shadow-[0_0_8px_rgba(0,210,255,0.3)]' : (isMatch ? 'bg-purple-900/30 border-purple-500/50 text-white' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300')}`}
                                                                            >
                                                                                {ext}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </details>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
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
                    <div 
                        className="absolute inset-0 z-50 bg-[#0B0B10] p-8 overflow-y-auto flex flex-col gap-6 font-mono text-xs"
                        style={chatOverlayDrag.style}
                    >
                        <div 
                            {...chatOverlayDrag.headerProps}
                            className="flex justify-between items-center mb-2 pb-4 border-b border-[#1E1E26] cursor-move select-none"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ CHAT CONSOLE ]</h2>
                                    <span className="text-[10px] text-[#64748B] font-mono tracking-wider">[DRAGGABLE]</span>
                                </div>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Diagnostic Multi-Persona Simulation</p>
                            </div>
                            <button 
                                data-no-drag
                                onClick={() => setActiveView(null)} 
                                className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase px-2 py-1 rounded bg-[#15151C] border border-[#2A2A35]"
                            >
                                CLOSE [x]
                            </button>
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
                    <div 
                        className="absolute inset-0 z-50 bg-[#0B0B10] p-8 overflow-y-auto flex flex-col font-mono text-xs text-[#A0AEC0]"
                        style={searchOverlayDrag.style}
                    >
                        <div 
                            {...searchOverlayDrag.headerProps}
                            className="flex justify-between items-center mb-6 pb-4 border-b border-[#1E1E26] cursor-move select-none"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ GLOBAL SEARCH ]</h2>
                                    <span className="text-[10px] text-[#64748B] font-mono tracking-wider">[DRAGGABLE]</span>
                                </div>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Cross-Vault Knowledge & Node Index</p>
                            </div>
                            <button 
                                data-no-drag
                                onClick={() => setActiveView(null)} 
                                className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase px-2 py-1 rounded bg-[#15151C] border border-[#2A2A35]"
                            >
                                CLOSE [x]
                            </button>
                        </div>
                        <div className="text-[#A0AEC0] font-mono text-xs">Search query index and knowledge nodes across workspace.</div>
                    </div>
                )}

                {/* MEMORY CONTEXT OVERLAY */}
                {activeView === 'memory' && (
                    <div 
                        className="absolute inset-0 z-50 bg-[#0B0B10] p-8 overflow-y-auto flex flex-col font-mono text-xs text-[#A0AEC0]"
                        style={memoryOverlayDrag.style}
                    >
                        <div 
                            {...memoryOverlayDrag.headerProps}
                            className="flex justify-between items-center mb-6 pb-4 border-b border-[#1E1E26] cursor-move select-none"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-white font-bold tracking-widest text-sm font-mono">[ MEMORY CONTEXT TRACKER ]</h2>
                                    <span className="text-[10px] text-[#64748B] font-mono tracking-wider">[DRAGGABLE]</span>
                                </div>
                                <p className="text-[#64748B] text-xs font-mono mt-1">Active Neural Memory Buffer & Cognitive Vector States</p>
                            </div>
                            <button 
                                data-no-drag
                                onClick={() => setActiveView(null)} 
                                className="text-xs font-bold text-[#A0AEC0] hover:text-white font-mono tracking-widest uppercase px-2 py-1 rounded bg-[#15151C] border border-[#2A2A35]"
                            >
                                CLOSE [x]
                            </button>
                        </div>
                        <div className="text-[#A0AEC0] font-mono text-xs">Tracking active neural memory buffer and cognitive vector states.</div>
                    </div>
                )}
            </main>
        </div>

        {activeView === 'file-viewer' && activeFile && (
            <div 
                className="fixed inset-0 z-50 flex bg-[#0B0B10] shadow-2xl"
                style={fileViewerDrag.style}
                onWheel={(e) => e.stopPropagation()}
            >
                {/* Left Panel (File Info) */}
                <div className="w-[350px] border-r border-[#1E1E26] flex flex-col h-full font-mono text-xs">
                    <div 
                        {...fileViewerDrag.headerProps}
                        className="p-4 border-b border-[#1E1E26] font-bold text-white flex items-center justify-between cursor-move select-none"
                    >
                        <span>[ FILE INFORMATION PANEL ]</span>
                        <span className="text-[10px] text-[#64748B] font-mono tracking-wider">[DRAG]</span>
                    </div>
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

                {/* Center Panel (Code View / Content Preview) */}
                <div className="flex-1 flex flex-col bg-[#0B0B10] min-w-0">
                    <div 
                        {...fileViewerDrag.headerProps}
                        className="h-14 border-b border-[#1E1E26] flex items-center px-4 gap-6 text-xs font-bold text-[#E2E8F0] justify-between cursor-move select-none"
                    >
                        <div className="flex items-center gap-6" data-no-drag>
                            <div className="cursor-pointer hover:text-[#00D2FF] whitespace-nowrap">[G] GRAPH VIEW</div>
                            <div className="cursor-pointer hover:text-[#00D2FF] whitespace-nowrap">[F] GRAPH FILTERS</div>
                            <div 
                                onClick={() => window.dispatchEvent(new CustomEvent('orion:toggle-settings'))}
                                className="cursor-pointer hover:text-[#00D2FF] whitespace-nowrap"
                            >
                                [O] OPTIONS
                            </div>
                            <div className="w-64 border border-[#1E1E26] rounded px-3 py-1 bg-[#15151C] text-[#A0AEC0] whitespace-nowrap hidden lg:block">
                                [SEARCH] Search nodes, paths, risk:high...
                            </div>
                        </div>
                        <div className="flex flex-row items-center gap-4 ml-auto pr-8" data-no-drag>
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
                        {activeFile.content?.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i.test(activeFile.name) ? (
                            <ImagePanZoomViewer 
                                src={activeFile.content?.startsWith('data:image/') ? activeFile.content : (activeFile.content ? `data:image/png;base64,${activeFile.content}` : `file://${activeFile.path}`)} 
                                alt={activeFile.name} 
                            />
                        ) : (
                            <pre className="font-mono text-sm text-[#A0AEC0] overflow-hidden break-all whitespace-pre-wrap">
                                {activeFile.content}
                            </pre>
                        )}
                    </div>
                </div>

                {/* Right Panel (AI Stream) */}
                <div className="w-[300px] border-l border-[#1E1E26] flex flex-col bg-[#0B0B10]">
                    <div 
                        {...fileViewerDrag.headerProps}
                        className="h-14 border-b border-[#1E1E26] flex items-center justify-end px-4 cursor-move select-none"
                    >
                        <button 
                            data-no-drag
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
            style={codeModalDrag.style}
          >
            <div 
              {...codeModalDrag.headerProps}
              className="flex justify-between items-center mb-4 cursor-move select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-sm tracking-widest uppercase">RAW FILE STREAM: {selectedNode.label}</span>
                <span className="text-[10px] text-[#64748B] font-mono tracking-wider">[DRAGGABLE]</span>
              </div>
              <button 
                data-no-drag
                onClick={() => setCodeModalOpen(false)} 
                className="text-gray-400 hover:text-white font-mono text-xs uppercase tracking-widest bg-white/5 border border-white/10 px-4 py-2 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
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
