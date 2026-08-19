'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';
import { useGraphEngine } from '../../hooks/useGraphEngine';

// Dynamically import Canvas and Drei components to avoid SSR issues
const Canvas = dynamic(() => import('@react-three/fiber').then((mod) => mod.Canvas), { ssr: false });
const OrbitControls = dynamic(() => import('@react-three/drei').then((mod) => mod.OrbitControls), { ssr: false });
const Html = dynamic(() => import('@react-three/drei').then((mod) => mod.Html), { ssr: false });

import { AiManagementPanel } from './AiManagementPanel';

interface GraphNode {
  id: string;
  label: string;
  health: 'healthy' | 'warning' | 'critical';
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  isDir?: boolean;
  path?: string;
  oldCode?: string;
  newCode?: string;
  explanation?: string[];
  fileContent?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

// ---------------------------------------------------------
// Physics Engine for R3F Nodes
// ---------------------------------------------------------
function PhysicsGraph({ nodes, links, onSelectNode, onContextMenu, nodeSize = 1, edgeOpacity = 0.5, fileLabels = true, animSpeed = 1 }: { nodes: GraphNode[], links: GraphLink[], onSelectNode: (node: GraphNode) => void, onContextMenu: (e: any, node: GraphNode) => void, nodeSize?: number, edgeOpacity?: number, fileLabels?: boolean, animSpeed?: number }) {
  const nodeRefs = useRef<{ [key: string]: THREE.Mesh | null }>({});
  const { useFrame } = require('@react-three/fiber');

  // Initialize random coordinates
  useEffect(() => {
    nodes.forEach(n => {
      if (n.x === undefined) {
         n.x = (Math.random() - 0.5) * 40;
         n.y = (Math.random() - 0.5) * 40;
         n.z = (Math.random() - 0.5) * 40;
         n.vx = 0; n.vy = 0; n.vz = 0;
      }
    });
  }, [nodes]);

  useFrame(() => {
    const ALPHA = 0.05;
    const REPULSION = 150;
    const SPRING_K = 0.01;
    const SPRING_LEN = 12;
    const DAMPING = 0.85;

    // Repulsion (Coulomb)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        if (n1.x === undefined || n2.x === undefined || n1.y === undefined || n2.y === undefined || n1.z === undefined || n2.z === undefined) continue;

        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const dz = n1.z - n2.z;
        const distSq = dx*dx + dy*dy + dz*dz + 0.1;
        const dist = Math.sqrt(distSq);

        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        n1.vx! += fx; n1.vy! += fy; n1.vz! += fz;
        n2.vx! -= fx; n2.vy! -= fy; n2.vz! -= fz;
      }
    }

    // Attraction (Hooke Springs)
    links.forEach(l => {
      const source = nodes.find(n => n.id === l.source);
      const target = nodes.find(n => n.id === l.target);
      if (source && target && source.x !== undefined && target.x !== undefined && source.y !== undefined && target.y !== undefined && source.z !== undefined && target.z !== undefined) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dz = target.z - source.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz + 0.1);

        const force = (dist - SPRING_LEN) * SPRING_K;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        source.vx! += fx; source.vy! += fy; source.vz! += fz;
        target.vx! -= fx; target.vy! -= fy; target.vz! -= fz;
      }
    });

    // Gravity Center & Emergency Bounds Reset
    nodes.forEach(n => {
       if (n.x === undefined || n.y === undefined || n.z === undefined) return;
       
       if (isNaN(n.x) || isNaN(n.y) || isNaN(n.z) || !isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z)) {
         n.x = (Math.random() - 0.5) * 40;
         n.y = (Math.random() - 0.5) * 40;
         n.z = (Math.random() - 0.5) * 40;
         n.vx = 0; n.vy = 0; n.vz = 0;
       }

       n.vx! -= n.x * 0.003;
       n.vy! -= n.y * 0.003;
       n.vz! -= n.z * 0.003;
       
       n.x += n.vx! * ALPHA * animSpeed;
       n.y += n.vy! * ALPHA * animSpeed;
       n.z += n.vz! * ALPHA * animSpeed;

       n.vx! *= DAMPING;
       n.vy! *= DAMPING;
       n.vz! *= DAMPING;

       if (nodeRefs.current[n.id]) {
          nodeRefs.current[n.id]!.position.set(n.x, n.y, n.z);
       }
    });
  });

  const memoizedNodes = useMemo(() => {
     const safeNodes = Array.isArray(nodes) ? nodes : [];
     if (safeNodes.length === 0) return [];
     
     return safeNodes.map((n: any) => {
         const isSelected = n.engineState === 'SELECTED';
         const isMatch = n.engineState === 'SEARCH_MATCH';
         const isUnmatched = n.engineState === 'UNMATCHED';
         
         const color = isSelected ? '#00D2FF' : (n.health === 'critical' ? '#ef4444' : n.health === 'warning' ? '#eab308' : '#22c55e');
         const radius = (isSelected ? (n.isDir ? 3.6 : 2.4) : (n.isDir ? 1.8 : 1.2)) * (nodeSize * 0.6);
         const opacity = isSelected ? 1.0 : (isUnmatched ? 0.15 : 0.85);
         const labelColor = isSelected ? '#00D2FF' : '#E2E8F0';
         
         return (
           <mesh 
             key={n.id} 
             ref={(el) => { nodeRefs.current[n.id] = el; }} 
             onClick={(e) => { e.stopPropagation(); onSelectNode(n); }}
             onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, n); }}
           >
             <sphereGeometry args={[radius, 24, 24]} />
             <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 1.5 : 0.6} transparent opacity={opacity} wireframe={isMatch} />
             {fileLabels && opacity > 0.2 && (
               <Html position={[0, radius + 1, 0]} center zIndexRange={[100, 0]}>
                 <div style={{ color: labelColor, fontSize: '10px', fontFamily: 'monospace', textShadow: '1px 1px 3px black, -1px -1px 3px black', pointerEvents: 'none', whiteSpace: 'nowrap', fontWeight: isSelected ? 'bold' : 'normal' }}>
                   {n.label}
                 </div>
               </Html>
             )}
           </mesh>
         )
     });
  }, [nodes, onSelectNode, onContextMenu, nodeSize, fileLabels]);

  const memoizedLinks = useMemo(() => {
     const safeLinks = Array.isArray(links) ? links : [];
     if (safeLinks.length === 0) return [];
     
     return safeLinks.map((l, i) => {
         if (!l.source || !l.target) return null;
         return <PhysicsEdge key={i} sourceId={l.source} targetId={l.target} nodes={nodes} nodeRefs={nodeRefs} edgeOpacity={edgeOpacity} />;
     });
  }, [links, nodes, edgeOpacity]);

  if (!memoizedNodes || memoizedNodes.length === 0) {
    return <Html><div className="w-full h-full flex items-center justify-center text-zinc-500 font-mono text-xs">[INITIALIZING CORE NETWORKS...]</div></Html>;
  }

  return (
    <group>
      {memoizedNodes}
      {memoizedLinks}
    </group>
  );
}

// ---------------------------------------------------------
// Fast Line Rendering for 3D Graph
// ---------------------------------------------------------
function PhysicsEdge({ sourceId, targetId, nodes, nodeRefs, edgeOpacity = 0.3 }: { sourceId: string, targetId: string, nodes: GraphNode[], nodeRefs: React.MutableRefObject<{ [key: string]: THREE.Mesh | null }>, edgeOpacity?: number }) {
   const geomRef = useRef<THREE.BufferGeometry>(null);
   const { useFrame } = require('@react-three/fiber');

   useFrame(() => {
      const source = nodeRefs.current[sourceId];
      const target = nodeRefs.current[targetId];
      if (source && target && geomRef.current) {
          const positions = geomRef.current.attributes.position.array as Float32Array;
          positions[0] = source.position.x;
          positions[1] = source.position.y;
          positions[2] = source.position.z;
          positions[3] = target.position.x;
          positions[4] = target.position.y;
          positions[5] = target.position.z;
          geomRef.current.attributes.position.needsUpdate = true;
      }
   });

   const sourceNode = nodes.find(n => n.id === sourceId);
   const targetNode = nodes.find(n => n.id === targetId);
   const isCritical = sourceNode?.health === 'critical' && targetNode?.health === 'critical';
   const color = isCritical ? '#ef4444' : '#8b5cf6'; // directional emphasis color
   const opacity = isCritical ? Math.min(1, edgeOpacity * 2.5) : edgeOpacity;
   
   return (
      <line>
         <bufferGeometry ref={geomRef}>
            <bufferAttribute
               attach="attributes-position"
               count={2}
               array={new Float32Array(6)}
               itemSize={3}
            />
         </bufferGeometry>
         <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={2} />
      </line>
   )
}

// ---------------------------------------------------------
// Main Component
// ---------------------------------------------------------
export function NeuralGraphDashboard() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="w-full h-full min-h-screen bg-[#0B0B10]" />;
  }

  return <NeuralGraphDashboardInner />;
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
  { cat: 'JSON / Data', exts: ['.json', '.jsonl', '.ndjson', '.yaml', '.yml', '.xml', '.csv', '.tsv', '.toml', '.ini', '.conf'] },
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

const InfoRow = ({ label, value }: { label: string; value: any }) => (
  <div className="flex justify-between items-start py-1 border-b border-zinc-900 text-[11px] font-mono gap-x-4">
    <span className="text-zinc-500 whitespace-nowrap">{label}</span>
    <span className="text-zinc-300 text-right break-all select-all">{value || 'N/A'}</span>
  </div>
);

// ---------------------------------------------------------
// Classic File Tree Explorer
// ---------------------------------------------------------
function FileTreeView({ nodes, onSelectNode, fontScale = 100, currentTheme = 'dark' }: { nodes: GraphNode[], onSelectNode: (n: GraphNode) => void, fontScale?: number, currentTheme?: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fileTreeSearchTerm, setFileTreeSearchTerm] = useState('');

  const tree = useMemo(() => {
    const root: any = { isRoot: true, children: {} };
    nodes.forEach(node => {
      const p = node.path || node.label;
      if (!p) return;
      const parts = p.replace(/\\/g, '/').split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current.children[part]) {
          current.children[part] = { name: part, path: parts.slice(0, i+1).join('/'), children: {}, node: null };
        }
        current = current.children[part];
      }
      current.node = node;
    });
    return root;
  }, [nodes]);

  const toggleExpand = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (nodeMap: any, depth = 0) => {
    const entries = Object.values(nodeMap).sort((a: any, b: any) => {
      const aIsDir = Object.keys(a.children).length > 0 || (a.node && a.node.isDir);
      const bIsDir = Object.keys(b.children).length > 0 || (b.node && b.node.isDir);
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });

    return entries.map((item: any) => {
      const isDir = Object.keys(item.children).length > 0 || (item.node && item.node?.isDir);
      const isMatch = fileTreeSearchTerm.length > 0 && item.name.toLowerCase().includes(fileTreeSearchTerm.toLowerCase());
      const hasMatchingChild = (nodeMap: any): boolean => {
         if (!nodeMap) return false;
         for (const key of Object.keys(nodeMap)) {
           if (key.toLowerCase().includes(fileTreeSearchTerm.toLowerCase())) return true;
           if (hasMatchingChild(nodeMap[key].children)) return true;
         }
         return false;
      };
      
      const shouldShow = fileTreeSearchTerm.length === 0 || isMatch || (isDir && hasMatchingChild(item.children));
      if (!shouldShow) return null;

      const isOpen = expanded[item.path] ?? (depth === 0 || (fileTreeSearchTerm.length > 0 && hasMatchingChild(item.children)));

      return (
        <div key={item.path} className="flex flex-col font-mono text-xs">
          <div 
            className="flex items-center py-1.5 hover:bg-white/5 cursor-pointer border-l border-dashed border-zinc-800 transition-colors"
            style={{ paddingLeft: `${depth * 16 + 8}px`, marginLeft: `${depth > 0 ? 8 : 0}px` }}
            onClick={(e) => {
              e.stopPropagation();
              if (isDir) {
                toggleExpand(item.path);
              } else if (item.node) {
                onSelectNode(item.node);
              }
            }}
          >
            <span className={`mr-2 ${isDir ? 'text-zinc-500' : 'text-cyan-400'}`}>
              {isDir ? (isOpen ? '[-]' : '[+]') : '|--'}
            </span>
            <span className={`${isDir ? 'text-zinc-300 font-bold' : 'text-zinc-400 hover:text-white'} truncate`}>
              {isDir ? `[DIR] ${item.name.replace(/📁|📂|⚙️|🔍/g, '').trim()}` : item.name.replace(/📁|📂|⚙️|🔍/g, '').trim()}
            </span>
            {item.node?.health === 'critical' && (
               <span className="ml-3 text-[9px] text-red-500 font-bold px-1 border border-red-500/30 rounded">[CRIT]</span>
            )}
            {item.node?.health === 'warning' && (
               <span className="ml-3 text-[9px] text-yellow-500 font-bold px-1 border border-yellow-500/30 rounded">[WARN]</span>
            )}
          </div>
          {isDir && isOpen && (
            <div className="flex flex-col w-full">
              {renderTree(item.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-full h-full bg-[#0B0B10] p-6 overflow-y-auto overflow-x-hidden custom-scrollbar pointer-events-auto">
      <div className="max-w-4xl mx-auto flex flex-col w-full">
        <div className="mb-6 border-b border-zinc-800 pb-2">
          <h2 className="text-sm font-bold text-zinc-300 font-mono tracking-widest">[ FILE SYSTEM EXPLORER ]</h2>
          <span className="text-[10px] text-zinc-500 font-mono">Structural Workspace Overview</span>
        </div>
        <div className="w-full max-w-md mb-4">
          <input 
            type="text"
            value={fileTreeSearchTerm}
            onChange={(e) => setFileTreeSearchTerm(e.target.value)}
            placeholder="Filter active tree modules or names..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-600 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]"
          />
        </div>
        {renderTree(tree.children)}
      </div>
    </div>
  );
}

function NeuralGraphDashboardInner() {
  const { activeWorkspace, setActiveWorkspace, setWorkspaceState, setActiveFileContext } = useWorkspaceUi();
  
  const fallbackNodes: GraphNode[] = [
    { id: 'node_init1', label: 'index.ts', health: 'healthy', isDir: false },
    { id: 'node_init2', label: 'package.json', health: 'healthy', isDir: false },
    { id: 'node_init3', label: 'README.md', health: 'healthy', isDir: false }
  ];
  const fallbackLinks: GraphLink[] = [
    { source: 'node_init1', target: 'node_init2' },
    { source: 'node_init2', target: 'node_init3' }
  ];

  const [nodes, setNodes] = useState<GraphNode[]>(fallbackNodes);
  const [links, setLinks] = useState<GraphLink[]>(fallbackLinks);
  const controlsRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeFileNode, setActiveFileNode] = useState<any>(null);
  const [celebrateCount, setCelebrateCount] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: any } | null>(null);
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [uiDensity, setUiDensity] = useState('compact');
  const [fontScale, setFontScale] = useState(100);
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [isSearchBarOpen, setIsSearchBarOpen] = useState(false);
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(false);
  const [starGridActive, setStarGridActive] = useState(true);
  const [nodeLabels, setNodeLabels] = useState(true);
  const [edgeVisibility, setEdgeVisibility] = useState(true);
  const [animationVelocity, setAnimationVelocity] = useState(1);
  const [chatCaching, setChatCaching] = useState(true);
  const [privacyGate, setPrivacyGate] = useState(true);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const searchInputRef = useRef<any>(null);
  
  const [activeLayoutMode, setActiveLayoutMode] = useState("node-graph");
  const [activeSidebarTab, setActiveSidebarTab] = useState<'metadata' | 'ai'>('metadata');

  useEffect(() => {
    const handleSetLayout = (e: any) => {
      if (e.detail) {
         setActiveLayoutMode(e.detail);
      }
    };
    window.addEventListener('orion:set-layout', handleSetLayout);
    return () => window.removeEventListener('orion:set-layout', handleSetLayout);
  }, []);
  
  // -- NEW SETTINGS MATRIX STATES --
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("appearance");
  const [theme, setTheme] = useState('Dark');
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(12);
  
  const [autoLayout, setAutoLayout] = useState(true);
  const [nodeSize, setNodeSize] = useState(3);
  const [edgeOpacity, setEdgeOpacity] = useState(0.4);
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
  const [showSource, setShowSource] = useState(false);
  const [nodeSourceCode, setNodeSourceCode] = useState<string>('');
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const constraintsRef = useRef(null);

  const [openCode, setOpenCode] = useState(false);
  const [openDeps, setOpenDeps] = useState(false);
  const [openAi, setOpenAi] = useState(false);
  const [openIssues, setOpenIssues] = useState(false);
  const [openGit, setOpenGit] = useState(false);

  const InfoRow = ({ label, value }: { label: string; value: any }) => (
    <div className={`flex justify-between items-start ${uiDensity === 'compact' ? 'py-0.5' : 'py-2'} border-b border-zinc-900 font-mono gap-x-4`}>
      <span className="text-zinc-500 whitespace-nowrap">{label}</span>
      <span className="text-zinc-300 text-right break-all select-all">{value || 'N/A'}</span>
    </div>
  );

  // Initialize Graph Engine
  const engineState = useGraphEngine(nodes, links);
  const {
    search = '', setSearch = () => {},
    filterMode = 'ALL', setFilterMode = () => {},
    criteria = { view: [], health: [], risk: [], nodeType: [], fileType: [], aiIssues: [], gitStatus: [], complexityThreshold: 0 }, toggleCriteria = () => {}, clearAllFilters = () => {},
    selectedNodeId = null, setSelectedNodeId = () => {},
    setBlastRadiusActive = () => {},
    filteredData = { nodes: [], links: [] },
    globalAggregates = { totalNodes: 0, totalEdges: 0, visibleNodes: 0, visibleEdges: 0, healthCounts: { healthy: 0, warning: 0, critical: 0 } }
  } = engineState || {};

  if (!filteredData || !globalAggregates) {
    return (
      <div className="w-full h-full min-h-screen bg-[#0B0B10] flex flex-col items-center justify-center text-sm font-mono tracking-wider text-purple-400">
        <div className="animate-pulse">🌌 INITIALIZING ORION NEURAL GRAPH ENGINE...</div>
      </div>
    );
  }

  // Keyboard Event Management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        document.getElementById('graph-search-input')?.focus();
      }
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setSelectedNodeId(null);
        setActiveFileNode(null);
        setContextMenu(null);
      }
      if (e.key === 'r' || e.key === 'R') {
        if (controlsRef.current) controlsRef.current.reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedNodeId]);

  // Load backend live data OR fallback mock nodes if disconnected
  useEffect(() => {
    let isCancelled = false;
    let timeoutId: any = null;

    async function fetchGraph() {
      try {
        setIsScanning(true);
        
        // 3-second absolute timeout to bypass stuck onboarding states
        timeoutId = setTimeout(() => {
          if (!isCancelled) {
            isCancelled = true;
            setIsScanning(false);
            setWorkspaceState('HUB');
            setActiveWorkspace(null);
            console.warn('Scanner timed out, reverting to HUB.');
          }
        }, 3000);

        // @ts-ignore
        if (window.electronAPI?.ipcRenderer) {
          const targetPath = activeWorkspace?.path || 'C:\\Users\\asus\\.gemini\\antigravity\\scratch\\orion-x-studio';
          
          // @ts-ignore
          const data = await window.electronAPI.ipcRenderer.invoke('fs:getGraphData', targetPath);
          
          if (isCancelled) return;
          clearTimeout(timeoutId);

          if (data && data.nodes && data.nodes.length > 0) {
            setNodes(data.nodes);
            setLinks(data.edges);
          } else {
             // Fallback cluster
             const fallbackNodes: GraphNode[] = [
               { id: 'node_f1', label: 'main/src/index.ts', health: 'healthy', isDir: false },
               { id: 'node_f2', label: 'package.json', health: 'healthy', isDir: false },
               { id: 'node_f3', label: 'renderer/src/App.tsx', health: 'healthy', isDir: false }
             ];
             setNodes(fallbackNodes);
             setLinks([{ source: 'node_f1', target: 'node_f2' }, { source: 'node_f2', target: 'node_f3' }]);
          }
        } else {
          throw new Error('electronAPI.ipcRenderer disconnected');
        }
      } catch (err) {
        if (isCancelled) return;
        clearTimeout(timeoutId);
        console.warn('Falling back to dummy graph data:', err);
        // Fallback to dummies if IPC is not attached
        const dummyNodes: GraphNode[] = [
          { id: 'node_1', label: 'auth_service.py', health: 'critical', oldCode: `hasher.md5()`, newCode: `pbkdf2_sha256()`, explanation: ['MD5 vulnerable'] },
          { id: 'node_2', label: 'database_pool.cpp', health: 'critical' },
          { id: 'node_3', label: 'server.js', health: 'healthy' }
        ];
        setNodes(dummyNodes);
        setLinks([{ source: 'node_1', target: 'node_2' }, { source: 'node_2', target: 'node_3' }]);
      } finally {
        if (!isCancelled) {
          setIsScanning(false);
        }
      }
    }
    fetchGraph();
    
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeWorkspace?.path]);

  // Load file content natively when a file node is selected
  useEffect(() => {
    async function loadFileContent() {
      if (selectedNode && !selectedNode.isDir && selectedNode.path && !selectedNode.fileContent) {
        // @ts-ignore
        if (window.electronAPI && window.electronAPI.workspace && window.electronAPI.workspace.readFile) {
          try {
            // @ts-ignore
            const res = await window.electronAPI.workspace.readFile(selectedNode.path);
            if (res.success) {
              setSelectedNode(prev => prev && prev.id === selectedNode.id ? { ...prev, fileContent: res.content } : prev);
              setActiveFileContext(`[File: ${selectedNode.label}]\n${res.content}`);
            }
          } catch (err) {
            console.error('Failed to read file over IPC:', err);
          }
        }
      } else if (selectedNode?.fileContent) {
        setActiveFileContext(`[File: ${selectedNode.label}]\n${selectedNode.fileContent}`);
      }
    }
    loadFileContent();
  }, [selectedNode?.id, selectedNode?.fileContent]);

  // Listen to BACK navigation events
  useEffect(() => {
    const handleReset = () => {
      setSelectedNode(null);
      setActiveFileContext(null);
      if (controlsRef.current) {
         controlsRef.current.reset();
      }
    };
    window.addEventListener('orion:reset-zoom', handleReset);
    return () => window.removeEventListener('orion:reset-zoom', handleReset);
  }, []);

  useEffect(() => {
    // Clear out the stale source code string blocks instantly upon switching files
    setNodeSourceCode('');
    (window as any).sourceCodeBlock = '';
    
    // Automatically trigger a fresh background read pass if a file node is active
    const reloadSourceBuffer = async () => {
      if (!selectedNode?.path) return;
      setIsFileLoading(true);
      try {
        const workspaceRootBase = activeWorkspace?.path || (window as any).orionWorkspaceState?.activeProjectRoot || '';
        const fullSystemPath = selectedNode.path?.startsWith(workspaceRootBase)
          ? selectedNode.path
          : `${workspaceRootBase}/${selectedNode.path}`.replace(/\\/g, '/');

        const codeResp = await (window as any).api?.workspace?.readFile?.(fullSystemPath) || 
                         await (window as any).electronAPI?.workspace?.readFile?.(fullSystemPath) ||
                         await (window as any).electron?.workspace?.readFile?.(fullSystemPath) || 
                         "// Loading fresh workspace source code lines...";
        
        let code = '';
        if (codeResp?.isDirectory) {
          const filesList = codeResp.files || [];
          code = `Directory Structure for ${(selectedNode as any).name || selectedNode.label || 'Folder'}:\n` + filesList.join('\n');
          const directoryElement = (
            <div className="flex flex-col gap-1 w-full text-zinc-300 font-mono text-[11px]">
              <div className="text-cyan-400 mb-2 border-b border-zinc-800 pb-2 text-xs font-bold tracking-widest">[DIR] {selectedNode.path || selectedNode.label}</div>
              {filesList.map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-2 hover:bg-white/5 py-1 px-2 rounded cursor-pointer transition-colors text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700" onClick={() => {
                  const childNode = nodes.find(n => n.path?.endsWith(f) || n.label === f);
                  if (childNode) {
                    setSelectedNodeId(childNode.id);
                    handleNodeClick(childNode);
                  }
                }}>
                  <span className="text-zinc-600">|-</span> {f}
                </div>
              ))}
            </div>
          );
          setNodeSourceCode(directoryElement as any);
        } else {
          code = codeResp?.content || codeResp || "// Error mapping lines";
          setNodeSourceCode(code);
        }
        
        // Populate the active text states concurrently
        (window as any).sourceCodeBlock = code;
      } catch (err) {
        console.error("Orion Core Path Swapper Error:", err);
        setNodeSourceCode(`// Error reading file pathway target.`);
      } finally {
        setIsFileLoading(false);
      }
    };

    if (selectedNode) {
      reloadSourceBuffer();
    }
  }, [selectedNode?.id, selectedNode?.path, activeWorkspace?.path]);

  useEffect(() => {
    const handleNodeSelect = (e: any) => {
      const fileName = e.detail?.fileName;
      if (fileName && nodes) {
        const childNode = nodes.find((n: any) => n.path?.endsWith(fileName) || n.label === fileName);
        if (childNode) {
          setSelectedNodeId(childNode.id);
          handleNodeClick(childNode);
          setTimeout(() => {
             const prompt = `Analyze and refactor the security vulnerabilities in this code file:\n\n\`\`\`\n${(window as any).sourceCodeBlock || childNode.fileContent || ''}\n\`\`\``;
             window.dispatchEvent(new CustomEvent('ai:trigger-prompt', { detail: { prompt, node: childNode } }));
          }, 800);
        }
      }
    };
    window.addEventListener('ai:trigger-node-select', handleNodeSelect);
    return () => window.removeEventListener('ai:trigger-node-select', handleNodeSelect);
  }, [nodes]);

  const handleNodeClick = (node: any) => {
    if (!node) return;
    console.log("Selected Graph Node Content Target:", node.label);
    
    // Force global context layout synchronization hooks
    setSelectedNode(node);
    setSelectedNodeId(node.id);
    setActiveFileNode(node);
    (window as any).SelectedNodeFileBuffer = node.fileContent || "Code text lines currently loading...";
  };

  const handleContextMenu = (e: any, node: any) => {
    const canvas = e.gl.domElement;
    const rect = canvas.getBoundingClientRect();
    setContextMenu({ x: rect.left + rect.width / 2 + e.clientX, y: rect.top + rect.height / 2 - e.clientY, node });
  };

  const handleFixNode = () => {
    if (!selectedNode) return;

    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.id === selectedNode.id ? { ...n, health: 'healthy' } : n))
    );
    setSelectedNode((prev) => prev ? { ...prev, health: 'healthy' } : null);
    
    setCelebrateCount((prev) => prev + 1);
    setToastMessage(`SUCCESS: "${selectedNode.label}" secured!`);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleViewSource = () => {
    setShowSource(!showSource);
  };

  const finalNodes = filteredData?.nodes?.filter((n: any) => {
    if (!showFolders && n.isDir) return false;
    return true;
  }) || [];
  
  const finalLinks = filteredData?.links?.filter((l: any) => {
    if (!showDeps) return false;
    if (!finalNodes.find((n: any) => n.id === l.source) || !finalNodes.find((n: any) => n.id === l.target)) return false;
    return true;
  }) || [];

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden bg-[#0B0B10] text-white z-0`} style={{ fontSize: `${fontScale}%` }}>
      {currentTheme === 'light' && (
        <style>{`
          .bg-\\[\\#0B0B10\\] { background-color: #141210 !important; }
          .bg-\\[\\#0F0F16\\] { background-color: #1A1714 !important; }
          .border-\\[\\#1E1E26\\] { border-color: #2E241F !important; }
          .text-white { color: #FFB000 !important; }
          .text-gray-400, .text-gray-300, .text-gray-500, .text-zinc-400, .text-zinc-500 { color: #CC8D00 !important; }
          .border-zinc-800, .border-zinc-700 { border-color: #2E241F !important; }
          .border-white\\/5 { border-color: rgba(255, 176, 0, 0.1) !important; }
          .border-white\\/10 { border-color: rgba(255, 176, 0, 0.2) !important; }
          .bg-white\\/5 { background-color: rgba(255, 176, 0, 0.05) !important; }
          .bg-white\\/10 { background-color: rgba(255, 176, 0, 0.1) !important; }
          .bg-cyan-900\\/20, .bg-cyan-900\\/30 { background-color: rgba(255, 215, 0, 0.2) !important; }
          .text-cyan-400, .text-cyan-300, .text-[#E2E8F0] { color: #FFD700 !important; }
          .border-cyan-500\\/30, .border-cyan-500 { border-color: rgba(255, 215, 0, 0.3) !important; }
        `}</style>
      )}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 left-6 z-40 bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-2 font-mono text-[10px] text-green-400 uppercase tracking-widest shadow-lg shadow-green-500/5 "
          >
            {toastMessage}
          </motion.div>
        )}
        
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-[#0B0B10] "
          >
            <div className="flex flex-col items-center gap-3">
              <span className="w-8 h-8 rounded-full border-t-2 border-cyber-500 animate-spin" />
              <span className="font-mono text-[10px] text-cyber-400 tracking-widest uppercase animate-pulse">
                Traversing Workspace Topology...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP CONTROLS & SEARCH PILL */}
      <div className="h-14 w-full bg-[#0B0B10] border-b border-[#1E1E26] z-[70] flex items-center justify-center relative flex-shrink-0">
        <div className="flex items-center gap-3 bg-[#0B0B10]  border border-white/10 rounded-full px-2 py-1 shadow-[0_0_15px_rgba(0,0,0,0.5)] z-[71]">
          {activeLayoutMode === 'file-tree' && (
            <button 
              onClick={() => {
                setActiveLayoutMode("node-graph");
                window.dispatchEvent(new CustomEvent('orion:set-layout', { detail: 'node-graph' }));
              }} 
              className="text-[11px] font-mono font-bold tracking-wider text-cyan-400 hover:text-white transition-colors bg-white/5 border border-cyan-500/30 px-2 py-1 rounded ml-1"
            >
              [ G ] GRAPH VIEW
            </button>
          )}
          <button
            onClick={() => {
              setIsGraphFullScreen(!isGraphFullScreen);
              setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-xs font-mono font-bold ${isGraphFullScreen ? 'text-cyan-400 bg-cyan-900/20 border border-cyan-500/30' : 'text-gray-300'}`}
          >
            {isGraphFullScreen ? '[ SPLIT VIEW ]' : '[ FULL VIEW ]'}
          </button>
          <button
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-xs font-mono font-bold text-gray-300"
          >
            [F] GRAPH FILTERS
          </button>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-xs font-mono font-bold text-gray-300"
          >
            [O] OPTIONS
          </button>
          
          <button
            onClick={() => setIsSearchBarOpen(!isSearchBarOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-xs font-mono font-bold ${isSearchBarOpen ? 'text-cyan-400 bg-cyan-900/20' : 'text-gray-300'}`}
          >
            [ SEARCH ]
          </button>
          
          {isSearchBarOpen && <div className="w-px h-5 bg-white/20" />}
          
          <div className={`relative flex items-center transition-all duration-300 ease-in-out overflow-hidden ${isSearchBarOpen ? 'w-[400px] opacity-100' : 'w-0 opacity-0'}`}>
            <span className="absolute left-3 text-gray-400 font-mono text-xs">[FIND]</span>
            <input
              ref={searchInputRef}
              id="graph-search-input"
              type="text"
              placeholder="Search nodes, paths, risk:high..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-white text-[13px] font-mono px-4 py-2 pl-20 w-[400px] outline-none tracking-wide placeholder:text-gray-500 placeholder:tracking-normal"
            />
          </div>
        </div>

        {/* ACTIVE FILTER CHIPS */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 flex items-center gap-2 flex-wrap justify-center w-full z-[70]">
          {Object.entries(criteria).map(([category, values]) => 
            (values as string[]).map(val => (
              <span key={`${category}-${val}`} className="bg-purple-900/40 border border-purple-500/50 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                {val}
                <button onClick={() => toggleCriteria(category as any, val)} className="hover:text-white">×</button>
              </span>
            ))
          )}
          {(search || Object.values(criteria).some(arr => Array.isArray(arr) && arr.length > 0)) && (
            <button onClick={clearAllFilters} className="text-[10px] font-mono text-gray-400 hover:text-white px-2">
              [CLEAR] Clear All
            </button>
          )}
        </div>
      </div>

      {/* CORE LAYOUT CONTENTS */}
      <div className="relative w-full h-[calc(100vh-3.5rem)] flex-1 overflow-hidden flex">
        <div ref={constraintsRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* DRAGGABLE OPAQUE FILTER PANEL */}
      <AnimatePresence>
        {isFilterPanelOpen && (
          <motion.div
            drag
            dragConstraints={constraintsRef}
            dragMomentum={false}
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            className="absolute left-4 top-24 bottom-24 w-80 bg-[#0B0B10] border border-[#1E1E26] shadow-[0_0_25px_rgba(0,0,0,0.9)] z-[60] rounded-xl flex flex-col overflow-hidden pointer-events-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 p-3 mb-1 drag-handle cursor-move bg-[#13131A]">
              <span className="text-xs font-mono font-bold tracking-wider text-purple-400">[ FILTER MATRIX SETTINGS ]</span>
              <button onClick={() => setIsFilterPanelOpen(false)} className="text-zinc-500 hover:text-red-400 font-mono text-xs px-1.5 py-0.5 border border-zinc-800 rounded bg-zinc-900 transition-colors">[x]</button>
            </div>
            
            <div className="px-3 pb-2 border-b border-zinc-800">
              <input 
                type="text" 
                value={filterSearchQuery} 
                onChange={(e) => setFilterSearchQuery(e.target.value)} 
                placeholder="[ SEARCH CATEGORIES OR EXTENSIONS... ]" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-thin">
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-mono text-gray-400 uppercase">Logic Engine</span>
                   <button onClick={() => setFilterMode(filterMode === 'ALL' ? 'ANY' : 'ALL')} className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded border border-white/20 text-white hover:bg-white/20 transition-colors">
                      {filterMode === 'ALL' ? 'ALL (AND)' : 'ANY (OR)'}
                   </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Health State</span>
                <div className="flex flex-wrap gap-2">
                   {['healthy', 'warning', 'critical'].map(h => (
                     <button 
                       key={h} onClick={() => toggleCriteria('health', h)}
                       className={`px-3 py-1 text-[10px] font-mono rounded border transition-colors ${criteria.health.includes(h) ? 'bg-cyan-900/40 border-cyan-500 text-white shadow-[0_0_10px_rgba(0,210,255,0.4)]' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                     >
                       {h === 'critical' ? '[CRIT]' : h === 'warning' ? '[WARN]' : '[OK]'} {h.toUpperCase()}
                     </button>
                   ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase">File Extension Matrix</span>
                <div className="flex flex-col gap-3">
                   {EXTENSION_MATRIX.filter(catData => {
                     if (!filterSearchQuery) return true;
                     const query = filterSearchQuery.toLowerCase();
                     return catData.cat.toLowerCase().includes(query) || catData.exts.some(e => e.toLowerCase().includes(query));
                   }).map(catData => {
                     const query = filterSearchQuery.toLowerCase();
                     const isExpanded = query.length > 0 && (catData.cat.toLowerCase().includes(query) || catData.exts.some(e => e.toLowerCase().includes(query)));
                     
                     return (
                       <details key={catData.cat} className="border border-white/5 rounded overflow-hidden" open={isExpanded || false}>
                         <summary className="bg-[#13131A] px-3 py-2 text-[10px] font-mono text-gray-300 cursor-pointer select-none outline-none hover:text-white hover:bg-white/5">
                           {catData.cat.toUpperCase()}
                         </summary>
                         <div className="p-2 flex flex-wrap gap-1.5 bg-[#0B0B10]">
                           {catData.exts.map(ext => {
                             const isMatch = query.length > 0 && ext.toLowerCase().includes(query);
                             return (
                               <button 
                                 key={ext} onClick={() => toggleCriteria('fileType', ext)}
                                 className={`px-2 py-1 text-[9px] font-mono rounded border transition-colors ${criteria.fileType.includes(ext) ? 'bg-cyan-900/40 border-cyan-500 text-white shadow-[0_0_8px_rgba(0,210,255,0.3)]' : (isMatch ? 'bg-purple-900/30 border-purple-500/50 text-white' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300')}`}
                               >
                                 {ext}
                               </button>
                             )
                           })}
                         </div>
                       </details>
                     )
                   })}
                </div>
              </div>
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD FOOTER STATUS BAR */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none">
         <div className="bg-[#0B0B10]  border border-[#1E1E26] rounded-full px-6 py-2 flex items-center gap-6 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <span className="text-[10px] font-mono text-gray-400">
               NODES: <b className="text-white">{globalAggregates.visibleNodes}</b> / {globalAggregates.totalNodes}
            </span>
            <span className="text-[10px] font-mono text-gray-400">
               EDGES: <b className="text-white">{globalAggregates.visibleEdges}</b> / {globalAggregates.totalEdges}
            </span>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex gap-3 text-[10px] font-mono font-bold">
               <span className="text-green-400">[OK] {globalAggregates.healthCounts.healthy}</span>
               <span className="text-yellow-400">[WARN] {globalAggregates.healthCounts.warning}</span>
               <span className="text-red-400">[CRIT] {globalAggregates.healthCounts.critical}</span>
            </div>
         </div>
      </div>

      {/* NO MATCHES BANNER */}
      {globalAggregates.visibleNodes === 0 && !isScanning && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
           <div className="bg-red-950/40 border border-red-500/50  px-8 py-4 rounded-xl flex flex-col items-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <span className="text-red-500 text-2xl font-bold font-mono tracking-widest">[!] NO MATCHING NODES FOUND</span>
              <button onClick={clearAllFilters} className="pointer-events-auto bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-1.5 rounded text-white text-xs font-mono transition-colors">
                RESET FILTERS
              </button>
           </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-50 bg-[#0B0B10]  border border-[#1E1E26] rounded shadow-2xl flex flex-col py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <div className="px-3 py-1 border-b border-white/5 mb-1">
              <span className="text-[10px] font-mono text-gray-500 font-bold uppercase truncate">{contextMenu.node.label}</span>
            </div>
            <button className="text-left px-3 py-1.5 text-xs font-mono text-gray-300 hover:bg-white/10 hover:text-white" onClick={() => { setSelectedNode(contextMenu.node); setSelectedNodeId(contextMenu.node.id); setActiveFileNode(contextMenu.node); setContextMenu(null); }}>
              Focus Node
            </button>
            <button className="text-left px-3 py-1.5 text-xs font-mono text-gray-300 hover:bg-white/10 hover:text-white" onClick={() => { setBlastRadiusActive(true); setSelectedNodeId(contextMenu.node.id); setContextMenu(null); }}>
              Calculate Blast Radius
            </button>
            <button className="text-left px-3 py-1.5 text-xs font-mono text-purple-400 hover:bg-purple-900/30 hover:text-purple-300" onClick={() => { 
               setSelectedNode(contextMenu.node); setSelectedNodeId(contextMenu.node.id); setActiveFileNode(contextMenu.node);
               const prompt = `Analyze the complete architectural blast radius of changing this node. Detail which files inside the dependents array break first, evaluate the accumulated risk, and outline a robust staging or refactoring plan.`;
               window.dispatchEvent(new CustomEvent('ai:trigger-prompt', { detail: { prompt } }));
               setContextMenu(null);
            }}>
              Explain Blast Radius
            </button>
            <button className="text-left px-3 py-1.5 text-xs font-mono text-purple-400 hover:bg-purple-900/30 hover:text-purple-300" onClick={() => { 
               setSelectedNode(contextMenu.node); setSelectedNodeId(contextMenu.node.id); setActiveFileNode(contextMenu.node);
               const prompt = `Analyze the dependency chain of this node. Trace all imported files and explain how data flows into this component.`;
               window.dispatchEvent(new CustomEvent('ai:trigger-prompt', { detail: { prompt } }));
               setContextMenu(null);
            }}>
              Explain Dependency Chain
            </button>
            <button className="text-left px-3 py-1.5 text-xs font-mono text-purple-400 hover:bg-purple-900/30 hover:text-purple-300" onClick={() => { 
               setSelectedNode(contextMenu.node); setSelectedNodeId(contextMenu.node.id); setActiveFileNode(contextMenu.node);
               const prompt = `Identify immediately vulnerable dependencies if I refactor the code inside this node. What breaks if I change this?`;
               window.dispatchEvent(new CustomEvent('ai:trigger-prompt', { detail: { prompt } }));
               setContextMenu(null);
            }}>
              What breaks if I change this?
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT-SIDE FILE INFO PANEL */}
      <AnimatePresence>
      {activeFileNode && !isGraphFullScreen && (
        <motion.div 
          initial={{ x: -500, opacity: 0 }}
          animate={{ x: 0, opacity: 1, width: isLeftPanelMinimized ? 16 : 420 }}
          exit={{ x: -500, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          className={`absolute left-0 top-0 h-full bg-[#0B0B10] border-r border-[#1E1E26] flex flex-col z-50 pointer-events-auto shadow-2xl overflow-visible ${isLeftPanelMinimized ? 'w-4' : 'w-[420px]'}`}
        >
          {/* ULTRA-SLIM FLUSH TOGGLE BAR */}
          <button
            onClick={() => setIsLeftPanelMinimized(!isLeftPanelMinimized)}
            className="absolute right-0 top-0 w-4 h-full bg-transparent hover:bg-white/5 border-l border-transparent hover:border-white/10 z-[60] flex flex-col items-center justify-center text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-mono text-[10px] font-bold tracking-widest">{isLeftPanelMinimized ? '»' : '«'}</span>
          </button>

          <AnimatePresence>
            {!isLeftPanelMinimized && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full w-[420px] overflow-hidden"
              >
                {/* HEADER */}
                <div className="flex items-center justify-between p-4 border-b border-[#1E1E26] bg-[#0F0F16]">
                  <span className="text-xs font-mono font-bold tracking-wider text-purple-400 truncate">[ FILE INFORMATION PANEL ]</span>
                  <button onClick={() => { setSelectedNodeId(null); setSelectedNode(null); setActiveFileNode(null); setIsLeftPanelMinimized(false); }} className="text-zinc-500 hover:text-red-400 font-mono text-xs px-1.5 py-0.5 border border-zinc-800 rounded bg-zinc-900 transition-colors">[x]</button>
                </div>

                {/* ACCORDION SCROLL AREA */}
                <div className="flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-280px)] custom-scrollbar">
                  <div className="p-4 flex flex-col gap-y-4">
                  
                  {/* BASIC INFO */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden">
                    <div className="px-3 py-2 bg-zinc-900 text-xs font-mono font-bold text-zinc-300 border-b border-zinc-800">
                      [-] BASIC INFORMATION
                    </div>
                    <div className="p-3 flex flex-col">
                      <InfoRow label="File Name" value={activeFileNode?.name || activeFileNode?.label} />
                      <InfoRow label="Full Path" value={activeFileNode?.path || activeFileNode?.relativePath} />
                      <InfoRow label="Extension" value={activeFileNode?.extension} />
                      <InfoRow label="File Type" value={activeFileNode?.type?.toUpperCase()} />
                      <InfoRow label="File Size" value={activeFileNode?.size ? `${(activeFileNode.size / 1024).toFixed(2)} KB` : ''} />
                      <InfoRow label="Created" value="10 Aug 2026" />
                      <InfoRow label="Last Modified" value={activeFileNode?.git?.lastModified || "10 Aug 2026, 12:20 PM"} />
                      <InfoRow label="Last Author" value={activeFileNode?.git?.author || "Local User"} />
                      <InfoRow label="Git Status" value={activeFileNode?.git?.status?.toUpperCase()} />
                      <InfoRow label="Git Branch" value="main" />
                    </div>
                  </div>

                  {/* CODE INFORMATION */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden">
                    <button onClick={() => setOpenCode(!openCode)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors">
                      {openCode ? '[-] CODE INFORMATION' : '[+] CODE INFORMATION'}
                    </button>
                    {openCode && (
                      <div className="p-3 flex flex-col">
                        <InfoRow label="Language" value={activeFileNode?.extension?.replace('.', '')?.toUpperCase()} />
                        <InfoRow label="Lines of Code" value={activeFileNode?.LOC || (activeFileNode?.fileContent ? activeFileNode.fileContent.split('\n').length : null)} />
                        <InfoRow label="Functions" value={activeFileNode?.complexity?.functions || Math.floor((activeFileNode?.LOC || 0) / 20)} />
                        <InfoRow label="Classes" value={activeFileNode?.complexity?.classes || 0} />
                        <InfoRow label="Imports" value={activeFileNode?.complexity?.imports || activeFileNode?.imports?.length} />
                        <InfoRow label="Complexity Score" value={activeFileNode?.complexity?.score} />
                      </div>
                    )}
                  </div>

                  {/* DEPENDENCIES */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden">
                    <button onClick={() => setOpenDeps(!openDeps)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors">
                      {openDeps ? '[-] DEPENDENCIES & CONNECTIONS' : '[+] DEPENDENCIES & CONNECTIONS'}
                    </button>
                    {openDeps && (
                      <div className="p-3 flex flex-col">
                        <InfoRow label="Imports" value={activeFileNode?.imports?.length} />
                        <InfoRow label="Imported By" value={activeFileNode?.importedBy?.length} />
                        <InfoRow label="Dependencies" value={activeFileNode?.dependencies?.length} />
                        <InfoRow label="Used By" value={activeFileNode?.dependents?.length} />
                        <InfoRow label="Database Connections" value="None detected" />
                        <InfoRow label="Environment Variables" value={activeFileNode?.fileContent?.includes('process.env') ? 'Present' : 'None detected'} />
                      </div>
                    )}
                  </div>

                  {/* AI ANALYSIS */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden">
                    <button onClick={() => setOpenAi(!openAi)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors">
                      {openAi ? '[-] AI ANALYSIS' : '[+] AI ANALYSIS'}
                    </button>
                    {openAi && (
                      <div className="p-3 flex flex-col">
                        <InfoRow label="Status" value={activeFileNode?.health?.toUpperCase()} />
                        <InfoRow label="AI Confidence" value="98%" />
                        <InfoRow label="Risk Level" value={activeFileNode?.risk?.toUpperCase()} />
                        <InfoRow label="Architecture Role" value="Internal Logic Controller" />
                        <InfoRow label="Potential Bugs" value={activeFileNode?.health === 'critical' ? '2 Detected' : '0 Detected'} />
                        <InfoRow label="Security Issues" value={activeFileNode?.health === 'critical' ? 'High Risk Vector' : 'Clean'} />
                      </div>
                    )}
                  </div>

                  {/* ISSUES FOUND */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden">
                    <button onClick={() => setOpenIssues(!openIssues)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors">
                      {openIssues ? '[-] ISSUES FOUND' : '[+] ISSUES FOUND'}
                    </button>
                    {openIssues && (
                      <div className="p-3 flex flex-col">
                        <InfoRow label="Critical" value={activeFileNode?.issues?.filter((i:any)=>i.severity==='critical').length || (activeFileNode?.health === 'critical' ? 1 : 0)} />
                        <InfoRow label="High" value={activeFileNode?.issues?.filter((i:any)=>i.severity==='high').length || 0} />
                        <InfoRow label="Medium" value={activeFileNode?.issues?.filter((i:any)=>i.severity==='medium').length || 0} />
                        <InfoRow label="Low" value={activeFileNode?.issues?.filter((i:any)=>i.severity==='low').length || 0} />
                        <InfoRow label="Suggestions" value="Check Spark Context" />
                      </div>
                    )}
                  </div>

                  {/* GIT / VERSION CONTROL */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden">
                    <button onClick={() => setOpenGit(!openGit)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors">
                      {openGit ? '[-] GIT / VERSION CONTROL' : '[+] GIT / VERSION CONTROL'}
                    </button>
                    {openGit && (
                      <div className="p-3 flex flex-col">
                        <InfoRow label="Current Branch" value="main" />
                        <InfoRow label="Last Commit Author" value={activeFileNode?.git?.author} />
                        <InfoRow label="Uncommitted Changes" value={activeFileNode?.git?.status !== 'unchanged' ? 'Yes' : 'No'} />
                      </div>
                    )}
                  </div>

                  {/* MULTI-MEDIA VIEWER RELOCATED TO CENTER VIEWPORT */}
                  </div>
                </div>

                {/* MACRO ACTIONS DECK MATRIX */}
                <div className="mt-auto bg-[#0F0F16] border-t border-[#1E1E26] p-4 flex flex-col gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-zinc-500 mb-1 tracking-widest uppercase">[ Command Console ]</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setActiveFileNode(null); setSelectedNode(null); setSelectedNodeId(null); setIsLeftPanelMinimized(false); }} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[10px] font-mono text-zinc-400 hover:text-white transition-colors text-left">
                      [ CLOSE PANEL ]
                    </button>
                    <button onClick={() => { 
                      (window as any).SelectedNodeFileBuffer = nodeSourceCode || activeFileNode?.fileContent || ''; 
                      const prompt = `Analyze and refactor the security vulnerabilities in this code file:\n\n\`\`\`\n${nodeSourceCode || activeFileNode?.fileContent || ''}\n\`\`\``;
                      window.dispatchEvent(new CustomEvent('ai:trigger-prompt', { detail: { prompt, node: activeFileNode } }));
                    }} className="px-3 py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-900/50 rounded text-[10px] font-mono text-purple-400 hover:text-purple-300 transition-colors text-left">
                      [ CONNECT TO SPARK ]
                    </button>
                    <button onClick={handleViewSource} className="px-3 py-2 bg-cyan-900/10 hover:bg-cyan-900/30 border border-cyan-900/30 rounded text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors text-left col-span-2">
                      [ VIEW SOURCE ]
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing select-none">
        {activeLayoutMode === 'file-tree' ? (
          <div className="absolute inset-0 z-10 w-full h-full bg-[#0B0B10] overflow-hidden flex">
            <div className="w-1/3 h-full border-r border-zinc-800 overflow-hidden relative">
              <div className="w-full h-full bg-[#0B0B10] overflow-hidden">
              <FileTreeView nodes={finalNodes} onSelectNode={(node) => {
                setSelectedNode(node);
                setSelectedNodeId(node.id);
                setActiveFileNode(node);
                setActiveLayoutMode("node-graph");
                window.dispatchEvent(new CustomEvent('orion:set-layout', { detail: 'node-graph' }));
              }} fontScale={fontScale} currentTheme={currentTheme} />
            </div>
            </div>
            <div className="flex-1 h-full p-6 flex flex-col bg-[#0B0B10] overflow-y-auto relative">
              {showSource && activeFileNode ? (
                <div className="w-full h-full flex flex-col">
                  {['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].some(ext => activeFileNode?.relativePath?.toLowerCase().endsWith(ext)) ? (
                    <img src={`file://${activeFileNode?.path || activeFileNode?.relativePath}`} className="w-full h-full object-contain rounded border border-zinc-800 bg-[#0B0B10]" alt="Asset Preview" />
                  ) : ['.mp4', '.mkv', '.mov', '.webm'].some(ext => activeFileNode?.relativePath?.toLowerCase().endsWith(ext)) ? (
                    <video src={`file://${activeFileNode?.path || activeFileNode?.relativePath}`} controls className="w-full h-full rounded border border-zinc-800 bg-black" />
                  ) : (
                    <pre className="flex-1 w-full p-6 bg-[#0F0F16] border border-zinc-800 text-zinc-300 font-mono text-[11px] rounded overflow-y-auto whitespace-pre-wrap select-text shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                      {nodeSourceCode || activeFileNode?.fileContent || '// Extracting architecture lines...'}
                    </pre>
                  )}
                </div>
              ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 font-mono tracking-widest gap-4">
                   <div className="w-16 h-16 border border-zinc-800 rounded flex items-center justify-center bg-zinc-900/50">
                     <span className="text-xl opacity-50">[ ]</span>
                   </div>
                   <span className="text-[10px] uppercase">Select Asset File Node from Tree to Preview Content</span>
                 </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {nodes.length > 0 && Canvas && OrbitControls && (
              <Canvas 
                camera={{ position: [0, 0, 80], fov: 60 }} 
                className="absolute inset-0 z-0"
                gl={{ 
                  antialias: true, 
                  powerPreference: "high-performance",
                  failIfMajorPerformanceCaveat: false 
                }}
                onCreated={({ gl }) => {
                  const canvasElement = gl.domElement;
                  
                  const handleContextLost = (event: Event) => {
                    event.preventDefault();
                  };

                  const handleContextRestored = () => {
                    gl.resetState();
                  };

                  canvasElement.addEventListener('webglcontextlost', handleContextLost, false);
                  canvasElement.addEventListener('webglcontextrestored', handleContextRestored, false);

                  (canvasElement as any)._cleanupGL = () => {
                    canvasElement.removeEventListener('webglcontextlost', handleContextLost);
                    canvasElement.removeEventListener('webglcontextrestored', handleContextRestored);
                  };
                }}
              >
                <ambientLight intensity={0.5} />
            <pointLight position={[100, 100, 100]} intensity={1} />
            <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} target={[0, 0, 0]} />
            <PhysicsGraph 
              nodes={finalNodes} 
              links={finalLinks} 
              onSelectNode={handleNodeClick} 
              onContextMenu={handleContextMenu}
              nodeSize={nodeSize}
              edgeOpacity={edgeOpacity}
              fileLabels={fileLabels}
              animSpeed={animSpeed}
            />
          </Canvas>
        )}

        <div className="absolute top-4 right-4 bg-[#0B0B10] border border-white/5 rounded-lg px-3 py-1.5 font-mono text-[8px] text-gray-500 uppercase tracking-widest pointer-events-none select-none ">
          PAN: DRAG MOUSE | ZOOM: SCROLL | ORBIT: LEFT CLICK DRAG
        </div>
        </>
        )}
      </div>

      <AnimatePresence>
        {selectedNode && !isGraphFullScreen && (
          <motion.div
            initial={{ x: 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 500, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="w-[450px] h-full border-l border-[#1E1E26] bg-[#0B0B10] p-6 flex flex-col gap-5 z-25 relative select-text"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4 select-none">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  {selectedNode?.label}
                </span>
                {selectedNode?.health === 'critical' ? (
                  <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest mt-0.5 animate-pulse">
                    SECURITY INTRUSION WARNING
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest mt-0.5">
                    {selectedNode?.isDir ? 'DIRECTORY CONTEXT' : 'SOURCE CODE VIEW'}
                  </span>
                )}
              </div>
              <button 
                onClick={() => {
                  setSelectedNode(null);
                  setActiveFileContext(null);
                }}
                className="text-gray-500 hover:text-white transition-colors duration-200 text-xs font-mono"
              >
                CLOSE
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
              {(selectedNode?.health === 'critical' || selectedNode?.health === 'warning') ? (
                <>
                  {selectedNode?.oldCode && selectedNode?.newCode && (
                    <div className="grid grid-cols-2 gap-3 h-[220px]">
                      <div className="flex flex-col bg-red-950/20 border border-red-500/20 rounded-xl overflow-hidden">
                        <div className="bg-red-500/10 px-3 py-1.5 border-b border-red-500/10 select-none">
                          <span className="font-mono text-[9px] font-bold text-red-400 uppercase">OLD CODE</span>
                        </div>
                        <pre className="p-3 font-mono text-[9px] text-red-300 leading-normal overflow-auto whitespace-pre select-text h-full">
                          <code>{selectedNode?.oldCode}</code>
                        </pre>
                      </div>
                      <div className="flex flex-col bg-green-950/20 border border-green-500/20 rounded-xl overflow-hidden">
                        <div className="bg-green-500/10 px-3 py-1.5 border-b border-green-500/10 select-none">
                          <span className="font-mono text-[9px] font-bold text-green-400 uppercase">SUGGESTED FIX</span>
                        </div>
                        <pre className="p-3 font-mono text-[9px] text-green-300 leading-normal overflow-auto whitespace-pre select-text h-full">
                          <code>{selectedNode?.newCode}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                    <span className="font-mono text-[9px] font-bold text-purple-400 uppercase tracking-wider select-none">
                      Vulnerability Details
                    </span>
                    <ul className="list-disc pl-4 font-mono text-[9px] text-gray-300 flex flex-col gap-1.5">
                      {(Array.isArray(selectedNode?.explanation) ? selectedNode.explanation : []).map((exp: string, i: number) => (
                        <li key={i} className="leading-relaxed">{exp}</li>
                      ))}
                      {!selectedNode?.explanation && (
                        <li className="leading-relaxed text-yellow-500">Live scanning analysis pending for this file context...</li>
                      )}
                    </ul>
                  </div>
                </>
              ) : selectedNode?.fileContent ? (
                <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <div className="bg-[#0B0B10] px-3 py-1.5 border-b border-white/10 select-none">
                     <span className="font-mono text-[9px] font-bold text-gray-400 uppercase">RAW FILE CONTENT</span>
                  </div>
                  <pre className="p-3 font-mono text-[10px] text-gray-300 leading-relaxed overflow-auto whitespace-pre select-text h-full font-light">
                    <code>{selectedNode?.fileContent}</code>
                  </pre>
                </div>
              ) : selectedNode?.isDir ? (
                <div className="flex-1 flex items-center justify-center text-center p-6">
                  <span className="text-[10px] font-mono text-gray-500">
                    Directory Node selected. Expand child nodes to inspect source files.
                  </span>
                </div>
              ) : isFileLoading === true && selectedNodeId !== null ? (
                <div className="flex-1 flex items-center justify-center text-center p-6 flex-col gap-3">
                  <span className="w-6 h-6 rounded-full border-t-2 border-cyber-500 animate-spin" />
                  <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
                    Loading File Stream...
                  </span>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-3 select-none">
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setActiveFileContext(null);
                }}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 font-mono text-[10px] font-bold uppercase text-gray-400 tracking-wider transition-colors duration-200"
              >
                {selectedNode.health === 'critical' ? 'Discard' : 'Close Viewer'}
              </button>
              {selectedNode.health === 'critical' && (
                <button
                  onClick={handleFixNode}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 border border-green-400/20 shadow-green-glow rounded-xl py-3 font-mono text-[10px] font-bold uppercase text-white tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  ✔ Fix Vulnerability
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4TH COLUMN AI PANEL REMOVED (NOW INTEGRATED INTO LEFT SIDEBAR) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            drag
            dragConstraints={constraintsRef}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="absolute z-[60] bg-[#0B0B10] border border-[#1E1E26] rounded-xl shadow-[0_0_30px_rgba(0,0,0,1)] flex flex-col pointer-events-auto w-[650px] overflow-hidden"
            style={{ top: '10%', left: 'calc(50% - 325px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1E1E26] bg-[#0F0F16] drag-handle cursor-move">
              <span className="text-[13px] font-mono font-bold tracking-widest text-cyan-400">[ PREMIUM SETTINGS MATRIX ]</span>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-red-400 font-mono text-[13px] px-2 py-1 border border-zinc-800 rounded bg-zinc-900 transition-colors">[x]</button>
            </div>
            
            {/* Scrollable Matrix */}
            <div className="flex flex-col overflow-y-auto max-h-[600px] p-2 bg-[#0B0B10] custom-scrollbar">
              
              {/* TAB NAVIGATION HEADER */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#0B0B10] border-b border-[#1E1E26] overflow-x-auto custom-scrollbar">
                 {['appearance', 'graph', 'ai', 'security'].map((tab) => (
                    <button 
                       key={tab} 
                       onClick={() => setActiveSettingsTab(tab)}
                       className={`px-3 py-1.5 text-[11px] font-mono font-bold tracking-widest whitespace-nowrap transition-colors ${activeSettingsTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                       [ {tab === 'appearance' ? 'APPEARANCE' : tab === 'graph' ? 'NEURAL GRAPH' : tab === 'ai' ? 'SPARK AI' : 'SECURITY'} ]
                    </button>
                 ))}
              </div>

              {/* DYNAMIC TAB RENDER CONTENT */}
              <div className="p-4 grid grid-cols-2 gap-4 bg-[#0B0B10]">
                {activeSettingsTab === 'appearance' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Theme Engine</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCurrentTheme('dark');
                            console.log("[SETTINGS ENGINE] Switched view theme matrix to Charcoal Dark HUD.");
                          }}
                          className={`px-2 py-1 text-[10px] font-mono uppercase rounded border transition-colors ${currentTheme === 'dark' ? 'bg-cyan-900/30 border-cyan-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                        >
                          DARK HUD
                        </button>
                        <button
                          onClick={() => {
                            setCurrentTheme('light');
                            console.log("[SETTINGS ENGINE] Switched view theme matrix to High-Contrast Amber HUD.");
                          }}
                          className={`px-2 py-1 text-[10px] font-mono uppercase rounded border transition-colors ${currentTheme === 'light' ? 'bg-cyan-900/30 border-cyan-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                        >
                          AMBER HUD
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">UI Density</span>
                      <div className="flex gap-2">
                         {['compact', 'standard', 'spacious'].map(t => <button key={t} onClick={()=>setUiDensity(t as any)} className={`px-2 py-1 text-[10px] font-mono uppercase rounded border transition-colors ${uiDensity===t?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ {t} ]</button>)}
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
                       <span className="text-[10px] font-mono text-zinc-500">Background Particle Grid</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setStarGridActive(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${starGridActive?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setStarGridActive(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!starGridActive?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <span className="text-[10px] font-mono text-zinc-500">Font Scaling ({fontScale}%)</span>
                      <input type="range" min="80" max="140" value={fontScale} onChange={e=>setFontScale(Number(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                  </>
                )}

                {activeSettingsTab === 'graph' && (
                  <>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Auto Layout</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setAutoLayout(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${autoLayout?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setAutoLayout(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!autoLayout?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Node Labels</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setNodeLabels(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${nodeLabels?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setNodeLabels(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!nodeLabels?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
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
                      <span className="text-[10px] font-mono text-zinc-500">Edge Visibility</span>
                      <div className="flex gap-2">
                         <button onClick={()=>setEdgeVisibility(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${edgeVisibility?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setEdgeVisibility(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!edgeVisibility?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-zinc-500">Animation Velocity ({animationVelocity})</span>
                      <input type="range" min="0" max="100" step="5" value={animationVelocity} onChange={e=>setAnimationVelocity(Number(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <button onClick={() => { if (controlsRef.current) controlsRef.current.reset(); }} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-mono py-1 rounded transition-colors">[ RESET TRANSFORMATIONS ]</button>
                    </div>
                  </>
                )}

                {activeSettingsTab === 'ai' && (
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
                       <span className="text-[10px] font-mono text-zinc-500">Chat Caching</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setChatCaching(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${chatCaching?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setChatCaching(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!chatCaching?'bg-cyan-900/30 border-cyan-500 text-white':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
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
                      <input type="number" value={contextSize} onChange={e=>setContextSize(Number(e.target.value))} className="bg-zinc-900 border border-zinc-800 text-white text-[10px] font-mono px-2 py-1 rounded" />
                    </div>
                    <div className="col-span-2 mt-2">
                      <button onClick={() => { (window as any).chatHistory = []; setChatHistory(false); setContextSize(0); setToastMessage('AGENT CONTEXT WIPED'); setTimeout(() => setToastMessage(''), 3000); }} className="w-full bg-purple-900/20 hover:bg-purple-900/40 border border-purple-900/50 text-purple-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ WIPE AGENT CONTEXT ]
                      </button>
                    </div>
                  </>
                )}

                {activeSettingsTab === 'security' && (
                  <>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-mono text-zinc-500">Privacy Gate (Local-Only)</span>
                       <div className="flex gap-2">
                         <button onClick={()=>setPrivacyGate(true)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${privacyGate?'bg-green-900/40 border-green-500 text-green-300':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ ON ]</button>
                         <button onClick={()=>setPrivacyGate(false)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${!privacyGate?'bg-green-900/40 border-green-500 text-green-300':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>[ OFF ]</button>
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
                      <button onClick={() => { (window as any).electronAPI?.ipcRenderer?.invoke('system:clear-cache'); setToastMessage('ENGINE CACHE CLEARED'); setTimeout(() => setToastMessage(''), 3000); }} className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ CLEAR ENGINE CACHE ]
                      </button>
                      <button onClick={() => { (window as any).chatHistory = []; setToastMessage('CHAT RECORDS PURGED'); setTimeout(() => setToastMessage(''), 3000); }} className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ PURGE CHAT RECORDS ]
                      </button>
                      <button onClick={() => { (window as any).electronAPI?.ipcRenderer?.invoke('system:flush-logs'); setToastMessage('KERNEL LOGS FLUSHED'); setTimeout(() => setToastMessage(''), 3000); }} className="w-full bg-orange-900/20 hover:bg-orange-900/40 border border-orange-900/50 text-orange-400 text-[10px] font-mono py-2 rounded transition-colors">
                        [ FLUSH KERNEL LOGS ]
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
export default NeuralGraphDashboard;
