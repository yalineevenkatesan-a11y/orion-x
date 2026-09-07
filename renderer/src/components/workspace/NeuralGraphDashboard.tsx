'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';
import { useApp } from '@/context/AppContext';
import { useGraphEngine } from '../../hooks/useGraphEngine';

// Dynamically import Canvas and Drei components to avoid SSR issues
const Canvas = dynamic(() => import('@react-three/fiber').then((mod) => mod.Canvas), { ssr: false });
const OrbitControls = dynamic(() => import('@react-three/drei').then((mod) => mod.OrbitControls), { ssr: false });
const Html = dynamic(() => import('@react-three/drei').then((mod) => mod.Html), { ssr: false });

import { AiManagementPanel } from './AiManagementPanel';
import { SparkAiVoiceModal } from './SparkAiVoiceModal';
import { DatasetExplorer, isDatasetFile } from './DatasetExplorer';

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
  type?: string;
  name?: string;
  isDir?: boolean;
  path?: string;
  oldCode?: string;
  newCode?: string;
  explanation?: string[];
  fileContent?: string;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
}

interface GraphLink {
  source: string;
  target: string;
  isCodeDependency?: boolean;
  type?: string;
}

// ---------------------------------------------------------
// Reusable Cyberpunk Pill Toggle Switch Component
// ---------------------------------------------------------
interface CyberToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const CyberToggle: React.FC<CyberToggleProps> = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none ${
        checked
          ? 'bg-cyan-500/30 border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.45)]'
          : 'bg-zinc-800/80 border border-white/10 hover:border-white/20'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform duration-300 shadow-md ${
          checked
            ? 'translate-x-6 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
            : 'translate-x-1 bg-zinc-400'
        }`}
      />
    </button>
  );
};

// ---------------------------------------------------------
// Ambient 3D Starfield & Particle Grid Layer
// ---------------------------------------------------------
function StarfieldParticleGrid({ animSpeed = 1, glowEnabled = true, showParticleGrid = true }: { animSpeed?: number, glowEnabled?: boolean, showParticleGrid?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { useFrame } = require('@react-three/fiber');

  const [positions, colors] = useMemo(() => {
    const count = 400;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorPalette = [
      new THREE.Color('#06B6D4'),
      new THREE.Color('#8B5CF6'),
      new THREE.Color('#38BDF8'),
      new THREE.Color('#A78BFA'),
    ];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 260;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 260;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 260;

      const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, []);

  useFrame((_: any, delta: number) => {
    if (pointsRef.current && showParticleGrid) {
      pointsRef.current.rotation.y += 0.015 * delta * animSpeed;
      pointsRef.current.rotation.x += 0.008 * delta * animSpeed;
    }
  });

  return (
    <group ref={groupRef} visible={showParticleGrid}>
      <points ref={pointsRef} visible={showParticleGrid}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={1.2}
          vertexColors
          transparent
          opacity={glowEnabled ? 0.6 : 0.25}
          sizeAttenuation
        />
      </points>
      <gridHelper args={[180, 36, '#1e1e2d', '#0e0e18']} position={[0, -35, 0]} visible={showParticleGrid} />
    </group>
  );
}

// ---------------------------------------------------------
// Camera Synchronizer Component for R3F
// ---------------------------------------------------------
function CameraSync({ cameraRef }: { cameraRef?: React.MutableRefObject<any> }) {
  const { useThree } = require('@react-three/fiber');
  const three = useThree ? useThree() : null;
  useEffect(() => {
    if (cameraRef && three?.camera) {
      cameraRef.current = three.camera;
    }
  }, [cameraRef, three?.camera]);
  return null;
}

// ---------------------------------------------------------
// Physics Engine for R3F Nodes
// ---------------------------------------------------------
function PhysicsGraph({ 
  nodes, 
  links, 
  onSelectNode, 
  onContextMenu, 
  nodeSize = 1, 
  edgeOpacity = 0.5, 
  fileLabels = true, 
  animSpeed = 1, 
  glowEnabled = true, 
  fontScale = 100, 
  isPhysicsFrozen = false,
  isTreeLayout = false,
  cameraRef,
  showCodeDependencies = true,
  highlightDependencyEdges = true
}: { 
  nodes: GraphNode[], 
  links: GraphLink[], 
  onSelectNode: (node: GraphNode, event?: any) => void, 
  onContextMenu: (e: any, node: GraphNode) => void, 
  nodeSize?: number, 
  edgeOpacity?: number, 
  fileLabels?: boolean, 
  animSpeed?: number, 
  glowEnabled?: boolean, 
  fontScale?: number, 
  isPhysicsFrozen?: boolean,
  isTreeLayout?: boolean,
  cameraRef?: React.MutableRefObject<any>,
  showCodeDependencies?: boolean,
  highlightDependencyEdges?: boolean
}) {
  const nodeRefs = useRef<{ [key: string]: THREE.Mesh | null }>({});
  const { useFrame, useThree } = require('@react-three/fiber');
  const threeContext = useThree ? useThree() : null;

  useEffect(() => {
    if (cameraRef && threeContext?.camera) {
      cameraRef.current = threeContext.camera;
    }
  }, [cameraRef, threeContext?.camera]);

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
    if (isTreeLayout) {
      // Smooth spring animation to tree slots
      nodes.forEach((n: any) => {
        if (n.targetX !== undefined && n.targetY !== undefined && n.targetZ !== undefined) {
          n.x = (n.x ?? 0) + (n.targetX - (n.x ?? 0)) * 0.08;
          n.y = (n.y ?? 0) + (n.targetY - (n.y ?? 0)) * 0.08;
          n.z = (n.z ?? 0) + (n.targetZ - (n.z ?? 0)) * 0.08;
          if (nodeRefs.current[n.id]) {
            nodeRefs.current[n.id]!.position.set(n.x, n.y, n.z);
          }
        }
      });
      return;
    }

    if (isPhysicsFrozen) return; // Freezes nodes immediately in their current 3D coordinates

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
        const distSq = dx * dx + dy * dy + dz * dz + 0.1;
        const dist = Math.sqrt(distSq);

        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        n1.vx = (n1.vx ?? 0) + fx;
        n1.vy = (n1.vy ?? 0) + fy;
        n1.vz = (n1.vz ?? 0) + fz;
        n2.vx = (n2.vx ?? 0) - fx;
        n2.vy = (n2.vy ?? 0) - fy;
        n2.vz = (n2.vz ?? 0) - fz;
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
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.1);

        const force = (dist - SPRING_LEN) * SPRING_K;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        source.vx = (source.vx ?? 0) + fx;
        source.vy = (source.vy ?? 0) + fy;
        source.vz = (source.vz ?? 0) + fz;
        target.vx = (target.vx ?? 0) - fx;
        target.vy = (target.vy ?? 0) - fy;
        target.vz = (target.vz ?? 0) - fz;
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

      n.vx = (n.vx ?? 0) - n.x * 0.003;
      n.vy = (n.vy ?? 0) - n.y * 0.003;
      n.vz = (n.vz ?? 0) - n.z * 0.003;

      n.x += (n.vx ?? 0) * ALPHA * animSpeed;
      n.y += (n.vy ?? 0) * ALPHA * animSpeed;
      n.z += (n.vz ?? 0) * ALPHA * animSpeed;

      n.vx = (n.vx ?? 0) * DAMPING;
      n.vy = (n.vy ?? 0) * DAMPING;
      n.vz = (n.vz ?? 0) * DAMPING;

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
      const emissiveInt = glowEnabled ? (isSelected ? 1.5 : 0.6) : (isSelected ? 0.4 : 0.1);
      const dynamicFontSize = `${Math.max(8, Math.round(10 * (fontScale / 100)))}px`;

      return (
        <mesh
          key={n.id}
          ref={(el) => { nodeRefs.current[n.id] = el; }}
          onClick={(e) => { e.stopPropagation(); onSelectNode(n, e); }}
          onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, n); }}
        >
          <sphereGeometry args={[radius, 24, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveInt} transparent opacity={opacity} wireframe={isMatch} />
          {fileLabels && opacity > 0.2 && (
            <Html position={[0, radius + 1, 0]} center zIndexRange={[100, 0]}>
              <div style={{ color: labelColor, fontSize: dynamicFontSize, fontFamily: 'monospace', textShadow: glowEnabled ? '1px 1px 3px black, -1px -1px 3px black' : 'none', pointerEvents: 'none', whiteSpace: 'nowrap', fontWeight: isSelected ? 'bold' : 'normal' }}>
                {n.label}
              </div>
            </Html>
          )}
        </mesh>
      )
    });
  }, [nodes, onSelectNode, onContextMenu, nodeSize, fileLabels, glowEnabled, fontScale]);

  const memoizedLinks = useMemo(() => {
    const safeLinks = Array.isArray(links) ? links : [];
    if (safeLinks.length === 0) return [];

    return safeLinks.map((l, i) => {
      if (!l.source || !l.target) return null;
      if (!showCodeDependencies && l.isCodeDependency) return null;
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return (
        <PhysicsEdge
          key={`${sId}-${tId}-${i}`}
          sourceId={sId}
          targetId={tId}
          nodes={nodes}
          nodeRefs={nodeRefs}
          edgeOpacity={edgeOpacity}
          glowEnabled={glowEnabled}
          isCodeDependency={!!l.isCodeDependency}
          highlightDependencyEdges={highlightDependencyEdges}
        />
      );
    });
  }, [links, nodes, edgeOpacity, glowEnabled, showCodeDependencies, highlightDependencyEdges]);

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
function PhysicsEdge({ 
  sourceId, 
  targetId, 
  nodes, 
  nodeRefs, 
  edgeOpacity = 0.3, 
  glowEnabled = true,
  isCodeDependency = false,
  highlightDependencyEdges = true
}: { 
  sourceId: string, 
  targetId: string, 
  nodes: GraphNode[], 
  nodeRefs: React.MutableRefObject<{ [key: string]: THREE.Mesh | null }>, 
  edgeOpacity?: number, 
  glowEnabled?: boolean,
  isCodeDependency?: boolean,
  highlightDependencyEdges?: boolean
}) {
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

  // Dedicated edge coloring:
  // If isCodeDependency:
  //   highlightDependencyEdges ON => high-visibility neon accent #F43F5E (Cyber Rose)
  //   highlightDependencyEdges OFF => standard muted cyan-indigo (#6366F1)
  let edgeColor = '#6366F1';
  if (isCritical) {
    edgeColor = '#ef4444';
  } else if (isCodeDependency) {
    edgeColor = highlightDependencyEdges ? '#F43F5E' : '#6366F1';
  } else {
    edgeColor = '#8b5cf6';
  }

  // Camera-independent edge visibility: ensure minimum alpha floor so it never disappears on zoom out
  const baseAlpha = Math.max(edgeOpacity, 0.45);
  const opacity = isCritical 
    ? Math.min(1, baseAlpha * 1.8) 
    : (isCodeDependency && highlightDependencyEdges ? Math.max(baseAlpha * 1.4, 0.65) : baseAlpha);
  const finalOpacity = glowEnabled ? opacity : Math.min(opacity, 0.3);

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
      <lineBasicMaterial
        color={edgeColor}
        transparent={true}
        opacity={finalOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
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
// Classic File Tree Explorer (Dynamically Rendered from Active Graph Nodes)
// ---------------------------------------------------------
function getFileTypeBadge(filename: string, isDir: boolean) {
  if (isDir) return { label: 'DIR', color: 'text-zinc-400 bg-zinc-800/60 border-zinc-700' };
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
      return { label: 'TS', color: 'text-cyan-300 bg-cyan-950/60 border-cyan-800/50' };
    case '.js':
    case '.jsx':
      return { label: 'JS', color: 'text-yellow-300 bg-yellow-950/60 border-yellow-800/50' };
    case '.json':
      return { label: 'JSON', color: 'text-amber-300 bg-amber-950/60 border-amber-800/50' };
    case '.css':
    case '.scss':
    case '.sass':
      return { label: 'CSS', color: 'text-sky-300 bg-sky-950/60 border-sky-800/50' };
    case '.md':
    case '.txt':
      return { label: 'DOC', color: 'text-purple-300 bg-purple-950/60 border-purple-800/50' };
    case '.py':
      return { label: 'PY', color: 'text-emerald-300 bg-emerald-950/60 border-emerald-800/50' };
    case '.cpp':
    case '.c':
    case '.h':
    case '.hpp':
      return { label: 'C++', color: 'text-blue-300 bg-blue-950/60 border-blue-800/50' };
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.svg':
    case '.webp':
    case '.gif':
      return { label: 'IMG', color: 'text-pink-300 bg-pink-950/60 border-pink-800/50' };
    case '.mp4':
    case '.mov':
    case '.webm':
      return { label: 'MEDIA', color: 'text-rose-300 bg-rose-950/60 border-rose-800/50' };
    default:
      return { label: 'FILE', color: 'text-zinc-400 bg-zinc-900 border-zinc-800' };
  }
}

function FileTreeView({
  nodes,
  selectedNodeId,
  onSelectNode,
  fontScale = 100,
  currentTheme = 'dark'
}: {
  nodes: GraphNode[];
  selectedNodeId?: string | null;
  onSelectNode: (n: GraphNode) => void;
  fontScale?: number;
  currentTheme?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fileTreeSearchTerm, setFileTreeSearchTerm] = useState('');

  const { tree, stats } = useMemo(() => {
    let fileCount = 0;
    let dirCount = 0;
    let critCount = 0;
    let warnCount = 0;

    if (!nodes || nodes.length === 0) {
      return { tree: { isRoot: true, children: {} }, stats: { fileCount: 0, dirCount: 0, critCount: 0, warnCount: 0 } };
    }

    // Find longest common directory prefix among absolute paths
    const rawPaths = nodes
      .map(n => (n.path || n.label || '').replace(/\\/g, '/'))
      .filter(p => p.includes('/'));

    let commonPrefix = '';
    if (rawPaths.length > 1) {
      const splitPaths = rawPaths.map(p => p.split('/'));
      const first = splitPaths[0];
      const prefixParts: string[] = [];
      for (let i = 0; i < first.length - 1; i++) {
        const part = first[i];
        if (splitPaths.every(sp => sp[i] === part)) {
          prefixParts.push(part);
        } else {
          break;
        }
      }
      if (prefixParts.length > 0) {
        commonPrefix = prefixParts.join('/') + '/';
      }
    }

    const root: any = { isRoot: true, children: {} };

    nodes.forEach(node => {
      const isDirectory = Boolean(node.isDir);
      if (isDirectory) dirCount++;
      else fileCount++;
      if (node.health === 'critical') critCount++;
      if (node.health === 'warning') warnCount++;

      let displayPath = (node.path || node.label || '').replace(/\\/g, '/');
      if (commonPrefix && displayPath.startsWith(commonPrefix)) {
        displayPath = displayPath.slice(commonPrefix.length);
      } else if (displayPath.startsWith('/') || /^[a-zA-Z]:\//.test(displayPath)) {
        displayPath = displayPath.replace(/^[a-zA-Z]:\//, '').replace(/^\/+/, '');
      }

      const parts = displayPath.split('/').filter(Boolean);
      if (parts.length === 0) {
        parts.push(node.label || 'unnamed');
      }

      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLeaf = i === parts.length - 1;
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: parts.slice(0, i + 1).join('/'),
            children: {},
            node: isLeaf ? node : null,
            isDir: !isLeaf || isDirectory
          };
        } else if (isLeaf) {
          current.children[part].node = node;
          if (isDirectory) current.children[part].isDir = true;
        }
        current = current.children[part];
      }
    });

    return {
      tree: root,
      stats: { fileCount, dirCount, critCount, warnCount }
    };
  }, [nodes]);

  const handleToggleExpand = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    const recurse = (nodeMap: any) => {
      Object.values(nodeMap).forEach((item: any) => {
        if (item.isDir || Object.keys(item.children).length > 0) {
          allExpanded[item.path] = true;
          recurse(item.children);
        }
      });
    };
    recurse(tree.children);
    setExpanded(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpanded({});
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
      const hasMatchingChild = (childMap: any): boolean => {
        if (!childMap) return false;
        for (const key of Object.keys(childMap)) {
          if (key.toLowerCase().includes(fileTreeSearchTerm.toLowerCase())) return true;
          if (hasMatchingChild(childMap[key].children)) return true;
        }
        return false;
      };

      const shouldShow = fileTreeSearchTerm.length === 0 || isMatch || (isDir && hasMatchingChild(item.children));
      if (!shouldShow) return null;

      const isOpen = expanded[item.path] ?? (depth === 0 || (fileTreeSearchTerm.length > 0 && hasMatchingChild(item.children)));
      const isSelected = item.node && selectedNodeId && (item.node.id === selectedNodeId);
      const badge = getFileTypeBadge(item.name, isDir);

      return (
        <div key={item.path} className="flex flex-col font-mono text-xs select-none">
          <div
            className={`flex items-center py-1.5 px-2 hover:bg-white/5 cursor-pointer border-l-2 transition-all group ${
              isSelected
                ? 'bg-cyan-950/40 border-cyan-400 text-white font-bold shadow-[inset_0_0_10px_rgba(6,182,212,0.15)]'
                : 'border-transparent hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            onClick={(e) => {
              e.stopPropagation();
              if (isDir) {
                handleToggleExpand(item.path);
              } else if (item.node) {
                onSelectNode(item.node);
              }
            }}
          >
            {/* Expand / Collapse or Tree Branch indicator */}
            <span className={`mr-1.5 text-[10px] w-4 text-center font-bold ${isDir ? 'text-cyan-400' : 'text-zinc-600'}`}>
              {isDir ? (isOpen ? '▼' : '▶') : '•'}
            </span>

            {/* Type badge */}
            <span className={`mr-2 px-1 py-0.2 text-[8px] font-mono border rounded ${badge.color}`}>
              {badge.label}
            </span>

            {/* Item Name */}
            <span className={`truncate flex-1 ${isSelected ? 'text-cyan-200' : isDir ? 'text-zinc-300 font-semibold' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
              {item.name.replace(/📁|📂|⚙️|🔍/g, '').trim()}
            </span>

            {/* Health / Risk Indicators */}
            {item.node?.health === 'critical' && (
              <span className="ml-2 text-[8px] text-red-400 font-bold px-1.5 py-0.5 bg-red-950/60 border border-red-500/40 rounded">CRIT</span>
            )}
            {item.node?.health === 'warning' && (
              <span className="ml-2 text-[8px] text-yellow-400 font-bold px-1.5 py-0.5 bg-yellow-950/60 border border-yellow-500/40 rounded">WARN</span>
            )}
          </div>

          {/* Recursive child directory listing */}
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
    <div className="w-full h-full bg-[#0B0B10] p-4 overflow-y-auto overflow-x-hidden custom-scrollbar pointer-events-auto flex flex-col">
      <div className="flex flex-col w-full">
        {/* Header with dynamic metrics */}
        <div className="mb-4 border-b border-zinc-800 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-zinc-200 font-mono tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              [ FILE SYSTEM EXPLORER ]
            </h2>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              {stats.fileCount} files • {stats.dirCount} folders {stats.critCount > 0 && <span className="text-red-400 font-bold">• {stats.critCount} critical</span>}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleExpandAll}
              className="text-[9px] font-mono text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2 py-1 rounded transition-colors"
            >
              [+] ALL
            </button>
            <button
              onClick={handleCollapseAll}
              className="text-[9px] font-mono text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2 py-1 rounded transition-colors"
            >
              [-] ALL
            </button>
          </div>
        </div>

        {/* Filter / Search Input */}
        <div className="w-full mb-3 relative">
          <input
            type="text"
            value={fileTreeSearchTerm}
            onChange={(e) => setFileTreeSearchTerm(e.target.value)}
            placeholder="Search active vault files..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 placeholder-zinc-600 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]"
          />
          {fileTreeSearchTerm && (
            <button
              onClick={() => setFileTreeSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs font-mono"
            >
              ×
            </button>
          )}
        </div>

        {/* Tree Render or Empty State */}
        {Object.keys(tree.children).length > 0 ? (
          <div className="flex flex-col border border-zinc-800/60 rounded bg-zinc-950/40 p-1">
            {renderTree(tree.children)}
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-600 font-mono text-xs">
            [ NO ACTIVE GRAPH MODULES LOADED ]
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardImageViewer({ src, alt = "Asset Preview" }: { src: string; alt?: string }) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0 });

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
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((prev) => Math.min(5.0, Math.max(0.5, parseFloat((prev + delta).toFixed(2)))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsPanning(true);
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: translateX,
      initY: translateY,
    };
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setTranslateX(panRef.current.initX + dx);
      setTranslateY(panRef.current.initY + dy);
    };
    const onMouseUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPanning]);

  return (
    <div
      className="relative w-full h-full min-h-[260px] flex flex-col items-center justify-center p-4 bg-[#07070B] rounded border border-zinc-800 overflow-hidden select-none"
      onWheel={handleWheel}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Floating Zoom Toolbar */}
      <div
        className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-[#15151C]/90 backdrop-blur border border-zinc-700 px-2.5 py-1 rounded shadow-lg font-mono text-[10px] text-zinc-300"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setScale((prev) => Math.max(0.5, parseFloat((prev - 0.25).toFixed(2))))}
          className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 rounded transition-colors"
          title="Zoom Out"
        >
          -
        </button>
        <span className="min-w-[42px] text-center font-bold text-cyan-400">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((prev) => Math.min(5.0, parseFloat((prev + 0.25).toFixed(2))))}
          className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 rounded transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="ml-1 px-2 py-0.5 bg-zinc-900 border border-zinc-700 hover:border-cyan-400 hover:text-white rounded transition-colors text-[9px] font-bold"
          title="Reset"
        >
          [RESET]
        </button>
      </div>

      {/* 2D Panning & Zooming Canvas */}
      <div
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ cursor: isPanning ? 'grabbing' : (scale > 1 ? 'grab' : 'grab') }}
        onMouseDown={handleMouseDown}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain rounded drop-shadow-2xl pointer-events-none"
          style={{
            transform: `translate3d(${translateX}px, ${translateY}px, 0px) scale(${scale})`,
            transition: isPanning ? 'none' : 'transform 0.08s ease-out',
            transformOrigin: 'center center',
          }}
        />
      </div>

      <div className="absolute bottom-2 left-3 z-10 text-[9px] font-mono text-zinc-500 pointer-events-none select-none">
        WHEEL: ZOOM (0.5x - 5x) • DRAG: PAN
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
    { source: 'node_init1', target: 'node_init2', isCodeDependency: true, type: 'IMPORT_DEPENDENCY' },
    { source: 'node_init2', target: 'node_init3', isCodeDependency: false, type: 'HIERARCHY' }
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
  const [focusedParentId, setFocusedParentId] = useState<string | null>(null);
  const [actionPopup, setActionPopup] = useState<{
    node: any;
    x: number;
    y: number;
  } | null>(null);

  // Connect Appearance settings to AppContext
  const {
    glowEnabled,
    setGlowEnabled,
    fontScale,
    setFontScale,
    starGridActive,
    setStarGridActive,
  } = useApp() as any;

  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [isSearchBarOpen, setIsSearchBarOpen] = useState(false);
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(false);
  const [isVoiceAiModalOpen, setIsVoiceAiModalOpen] = useState(false);
  const [voiceAiInitialPrompt, setVoiceAiInitialPrompt] = useState('');
  const [isSparkAiEnabled, setIsSparkAiEnabled] = useState<boolean>(true);

  // Force-close Spark AI modal when disabled
  useEffect(() => {
    if (!isSparkAiEnabled) {
      setIsVoiceAiModalOpen(false);
    }
  }, [isSparkAiEnabled]);

  // Handle Spark AI Prompt Trigger Events
  useEffect(() => {
    const handleTriggerPrompt = (e: any) => {
      if (!isSparkAiEnabled) return;
      const prompt = e.detail?.prompt || '';
      const node = e.detail?.node || null;
      if (node) setActiveFileNode(node);
      setVoiceAiInitialPrompt(prompt);
      setIsVoiceAiModalOpen(true);
    };
    window.addEventListener('ai:trigger-prompt', handleTriggerPrompt);
    return () => window.removeEventListener('ai:trigger-prompt', handleTriggerPrompt);
  }, [isSparkAiEnabled]);
  const [nodeLabels, setNodeLabels] = useState(true);
  const [edgeVisibility, setEdgeVisibility] = useState(true);
  const [animationVelocity, setAnimationVelocity] = useState(1);
  const [chatCaching, setChatCaching] = useState(true);
  const [privacyGate, setPrivacyGate] = useState(true);
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const searchInputRef = useRef<any>(null);
  const savedFullViewStateRef = useRef<{ node: any; wasVoiceOpen: boolean }>({ node: null, wasVoiceOpen: false });

  const handleToggleFullView = () => {
    const nextState = !isGraphFullScreen;
    setIsGraphFullScreen(nextState);
    if (nextState) {
      savedFullViewStateRef.current = {
        node: activeFileNode || selectedNode,
        wasVoiceOpen: isVoiceAiModalOpen
      };
      setIsVoiceAiModalOpen(false);
      setActiveFileNode(null);
      setSelectedNode(null);
      setSelectedNodeId(null);
    } else {
      if (savedFullViewStateRef.current?.node) {
        setActiveFileNode(savedFullViewStateRef.current.node);
        setSelectedNode(savedFullViewStateRef.current.node);
        setSelectedNodeId(savedFullViewStateRef.current.node.id);
      }
      if (savedFullViewStateRef.current?.wasVoiceOpen) {
        setIsVoiceAiModalOpen(true);
      }
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  };

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
  const [settingsTab, setSettingsTab] = useState<'APPEARANCE' | 'SYSTEM' | 'SPARK_AI'>('APPEARANCE');
  const [theme, setTheme] = useState('Dark');

  // Ensure Settings modal resets/defaults to 'APPEARANCE' on every open
  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsTab('APPEARANCE');
    }
  }, [isSettingsOpen]);

  const [autoLayout, setAutoLayout] = useState(true);
  const [isTreeLayout, setIsTreeLayout] = useState<boolean>(false);
  const cameraRef = useRef<any>(null);
  const [nodeSize, setNodeSize] = useState<number>(3.8);
  const [edgeOpacity, setEdgeOpacity] = useState(0.35);
  const [fileLabels, setFileLabels] = useState(true);
  const [showFolders, setShowFolders] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [showCodeDependencies, setShowCodeDependencies] = useState<boolean>(true);
  const [highlightDependencyEdges, setHighlightDependencyEdges] = useState<boolean>(true);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [isPhysicsFrozen, setIsPhysicsFrozen] = useState<boolean>(false);
  const [autoScale, setAutoScale] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [enableGlassBlur, setEnableGlassBlur] = useState<boolean>(false);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
    }
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 450);
      cameraRef.current.near = 0.1;
      cameraRef.current.far = 5000;
      cameraRef.current.lookAt(0, 0, 0);
      cameraRef.current.updateProjectionMatrix();
    }
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  };

  const handleResimulate = () => {
    setIsPhysicsFrozen(false);
    nodes.forEach((n: any) => {
      n.vx = (Math.random() - 0.5) * 25;
      n.vy = (Math.random() - 0.5) * 25;
      n.vz = (Math.random() - 0.5) * 25;
    });
  };

  const handleTriggerAutoLayout = handleResimulate;

  const handleResetSettings = () => {
    setAutoScale(false);
    setIsTreeLayout(false);
    setNodeSize(3.8);
    setFontScale(100);
    setEdgeOpacity(0.35);
    setFileLabels(true);
    setNodeLabels(true);
    setGlowEnabled(true);
    setIsPhysicsFrozen(false);
    setAnimSpeed(1);
    setAnimationVelocity(1);
    setEdgeVisibility(true);
    setShowFolders(true);
    setShowDeps(true);
    setShowCodeDependencies(true);
    setHighlightDependencyEdges(true);
    setEnableGlassBlur(false);
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = '100%';
      document.documentElement.style.setProperty('--app-font-scale', '100%');
    }
  };

  // Dynamically derive scale multiplier based on total vault node count
  const dynamicNodeScale = useMemo(() => {
    if (!autoScale) return nodeSize; // uses manual slider value if auto-scale is OFF
    if (nodes.length > 500) return 0.5;
    if (nodes.length > 250) return 0.75;
    if (nodes.length > 100) return 1.0;
    return 1.35;
  }, [autoScale, nodeSize, nodes.length]);

  const dynamicFontScale = useMemo(() => {
    if (!autoScale) return fontScale;
    if (nodes.length > 500) return 60;
    if (nodes.length > 250) return 75;
    return 100;
  }, [autoScale, fontScale, nodes.length]);

  const sparkEnabled = isSparkAiEnabled;
  const setSparkEnabled = setIsSparkAiEnabled;
  const [responseStyle, setResponseStyle] = useState('Detailed');
  const [analysisDepth, setAnalysisDepth] = useState('Deep');
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const [contextSize, setContextSize] = useState(4096);
  const [chatHistory, setChatHistory] = useState(true);

  const [localOnly, setLocalOnly] = useState(true);
  const [sendCodeToAi, setSendCodeToAi] = useState(true);
  const [showSourceViewer, setShowSourceViewer] = useState(false);
  const showSource = showSourceViewer;
  const setShowSource = setShowSourceViewer;
  const [nodeSourceCode, setNodeSourceCode] = useState<string>('');
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const constraintsRef = useRef(null);

  const [openCode, setOpenCode] = useState(false);
  const [openDeps, setOpenDeps] = useState(false);
  const [openAi, setOpenAi] = useState(false);
  const [openIssues, setOpenIssues] = useState(false);
  const [openGit, setOpenGit] = useState(false);

  // Draggable Left Panel State
  const [leftPanelPos, setLeftPanelPos] = useState({ x: 0, y: 0 });
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const leftDragRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0 });

  const handleLeftHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, [data-no-drag]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLeft(true);
    leftDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: leftPanelPos.x,
      initY: leftPanelPos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingLeft) return;
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - leftDragRef.current.startX;
      const dy = e.clientY - leftDragRef.current.startY;
      setLeftPanelPos({
        x: leftDragRef.current.initX + dx,
        y: leftDragRef.current.initY + dy,
      });
    };
    const onMouseUp = () => setIsDraggingLeft(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingLeft]);

  // Draggable Right Panel State
  const [rightPanelPos, setRightPanelPos] = useState({ x: 0, y: 0 });
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const rightDragRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0 });

  const handleRightHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, [data-no-drag]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRight(true);
    rightDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: rightPanelPos.x,
      initY: rightPanelPos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingRight) return;
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - rightDragRef.current.startX;
      const dy = e.clientY - rightDragRef.current.startY;
      setRightPanelPos({
        x: rightDragRef.current.initX + dx,
        y: rightDragRef.current.initY + dy,
      });
    };
    const onMouseUp = () => setIsDraggingRight(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingRight]);

  const InfoRow = ({ label, value }: { label: string; value: any }) => (
    <div className={`flex justify-between items-start ${uiDensity === 'compact' ? 'py-0.5' : 'py-2'} border-b border-zinc-900 font-mono gap-x-4`}>
      <span className="text-zinc-500 whitespace-nowrap">{label}</span>
      <span className="text-zinc-300 text-right break-all select-all">{value || 'N/A'}</span>
    </div>
  );

  // Initialize Graph Engine
  const engineState = useGraphEngine(nodes, links);
  const {
    search = '', setSearch = () => { },
    filterMode = 'ALL', setFilterMode = () => { },
    criteria = { view: [], health: [], risk: [], nodeType: [], fileType: [], aiIssues: [], gitStatus: [], complexityThreshold: 0 },
    setCriteria = () => { },
    toggleCriteria = () => { }, clearAllFilters = () => { },
    selectedNodeId = null, setSelectedNodeId = () => { },
    setBlastRadiusActive = () => { },
    filteredData = { nodes: [], links: [] },
    globalAggregates = { totalNodes: 0, totalEdges: 0, visibleNodes: 0, visibleEdges: 0, healthCounts: { healthy: 0, warning: 0, critical: 0 } }
  } = engineState || {};

  const selectedExtensions: string[] = criteria.fileType || [];
  const setSelectedExtensions = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setCriteria((prev: any) => {
      const current = prev.fileType || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, fileType: next };
    });
  }, [setCriteria]);

  const searchFilter = search;
  const setSearchFilter = setSearch;
  const healthFilter = criteria.health?.length > 0 ? criteria.health : null;
  const setHealthFilter = useCallback((val: string[] | null) => {
    setCriteria((prev: any) => ({ ...prev, health: val || [] }));
  }, [setCriteria]);

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
        setActionPopup(null);
      }
      if (e.key === 'r' || e.key === 'R') {
        if (controlsRef.current) controlsRef.current.reset();
      }
    };
    const handleToggleSettings = () => {
      setIsSettingsOpen(prev => {
        if (!prev) setSettingsTab('APPEARANCE');
        return !prev;
      });
    };
    const handleOpenSettings = () => {
      setSettingsTab('APPEARANCE');
      setIsSettingsOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('orion:toggle-settings', handleToggleSettings);
    window.addEventListener('orion:open-settings', handleOpenSettings);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('orion:toggle-settings', handleToggleSettings);
      window.removeEventListener('orion:open-settings', handleOpenSettings);
    };
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
            setLinks([
              { source: 'node_f1', target: 'node_f2', isCodeDependency: true, type: 'IMPORT_DEPENDENCY' },
              { source: 'node_f2', target: 'node_f3', isCodeDependency: false, type: 'HIERARCHY' }
            ]);
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
        setLinks([
          { source: 'node_1', target: 'node_2', isCodeDependency: true, type: 'IMPORT_DEPENDENCY' },
          { source: 'node_2', target: 'node_3', isCodeDependency: false, type: 'HIERARCHY' }
        ]);
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
      if (!selectedNode) return;
      if (selectedNode.isDir || selectedNode.type === 'DIRECTORY') {
        // Only update metadata panel, do not attempt to read as raw file buffer
        return;
      }
      if (selectedNode.path && !selectedNode.fileContent) {
        try {
          const reader = (window as any).electronAPI?.readFile 
            || (window as any).electronAPI?.workspace?.readFile
            || ((p: string) => (window as any).electron?.invoke?.('workspace:readFile', p))
            || ((p: string) => (window as any).electron?.readFile?.(p))
            || ((p: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:readFile', p))
            || ((p: string) => (window as any).api?.workspace?.readFile?.(p));

          if (!reader) {
            console.warn('Electron IPC bridge unavailable.');
            return;
          }

          const workspaceRootBase = activeWorkspace?.path || (window as any).orionWorkspaceState?.activeProjectRoot || '';
          const cleanPath = (selectedNode.path || '').replace(/\\/g, '/');
          const cleanRoot = (workspaceRootBase || '').replace(/\\/g, '/');

          let targetPath = selectedNode.path;
          if (cleanRoot && cleanPath.startsWith(cleanRoot)) {
            targetPath = selectedNode.path;
          } else if (cleanPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(selectedNode.path)) {
            targetPath = selectedNode.path;
          } else if (workspaceRootBase) {
            targetPath = `${workspaceRootBase}/${selectedNode.path}`;
          }

          const res = await reader(targetPath);

          if (res?.success && typeof res.content === 'string') {
            setSelectedNode(prev => prev && prev.id === selectedNode.id ? { ...prev, fileContent: res.content } : prev);
            setActiveFileContext(`[File: ${selectedNode.label}]\n${res.content}`);
          } else if (typeof res === 'string') {
            setSelectedNode(prev => prev && prev.id === selectedNode.id ? { ...prev, fileContent: res } : prev);
            setActiveFileContext(`[File: ${selectedNode.label}]\n${res}`);
          } else if (res?.content) {
            setSelectedNode(prev => prev && prev.id === selectedNode.id ? { ...prev, fileContent: res.content } : prev);
            setActiveFileContext(`[File: ${selectedNode.label}]\n${res.content}`);
          }
        } catch (err) {
          console.error('Failed to read file over IPC:', err);
        }
      } else if (selectedNode?.fileContent) {
        setActiveFileContext(`[File: ${selectedNode.label}]\n${selectedNode.fileContent}`);
      }
    }
    loadFileContent();
  }, [selectedNode?.id, selectedNode?.fileContent, activeWorkspace?.path]);

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
      if (!selectedNode?.path) {
        setNodeSourceCode('// No file path provided.');
        return;
      }
      if (selectedNode.isDir || selectedNode.type === 'DIRECTORY') {
        // Only update metadata panel, do not attempt to read as raw file buffer
        return;
      }
      setIsFileLoading(true);
      try {
        const reader = (window as any).electronAPI?.readFile 
          || (window as any).electronAPI?.workspace?.readFile
          || ((p: string) => (window as any).electron?.invoke?.('workspace:readFile', p))
          || ((p: string) => (window as any).electron?.readFile?.(p))
          || ((p: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:readFile', p))
          || ((p: string) => (window as any).api?.workspace?.readFile?.(p));

        if (!reader) {
          setNodeSourceCode('// Electron IPC bridge unavailable.');
          return;
        }

        const workspaceRootBase = activeWorkspace?.path || (window as any).orionWorkspaceState?.activeProjectRoot || '';
        const cleanPath = (selectedNode.path || '').replace(/\\/g, '/');
        const cleanRoot = (workspaceRootBase || '').replace(/\\/g, '/');

        let targetPath = selectedNode.path;
        if (cleanRoot && cleanPath.startsWith(cleanRoot)) {
          targetPath = selectedNode.path;
        } else if (cleanPath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(selectedNode.path)) {
          targetPath = selectedNode.path;
        } else if (workspaceRootBase) {
          targetPath = `${workspaceRootBase}/${selectedNode.path}`;
        }

        const codeResp = await reader(targetPath);

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
        } else if (codeResp?.success && typeof codeResp.content === 'string') {
          code = codeResp.content;
          setNodeSourceCode(code);
        } else if (typeof codeResp === 'string') {
          code = codeResp;
          setNodeSourceCode(code);
        } else if (codeResp?.content) {
          code = codeResp.content;
          setNodeSourceCode(code);
        } else {
          code = `// Error loading file:\n// Path: ${targetPath}\n// Reason: ${codeResp?.error || 'Unknown'}`;
          setNodeSourceCode(code);
        }

        // Populate the active text states concurrently
        (window as any).sourceCodeBlock = code;
      } catch (err: any) {
        console.error("Orion Core Path Swapper Error:", err);
        setNodeSourceCode(`// IPC Failure: ${err?.message || 'Unknown IPC error'}\n// Path: ${selectedNode.path}`);
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

  const handleNodeClick = (node: any, event?: any) => {
    if (!node) return;
    console.log("Selected Graph Node Content Target:", node.label);

    // Force global context layout synchronization hooks
    setSelectedNode(node);
    setSelectedNodeId(node.id);
    setActiveFileNode(node);

    const hasChildren = links.some((l: any) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      return s === node.id;
    });

    if (node.isDir || hasChildren) {
      setFocusedParentId(node.id);
      const clientX = event?.clientX || window.innerWidth / 2;
      const clientY = event?.clientY || window.innerHeight / 2;
      setActionPopup({
        node,
        x: Math.min(clientX + 10, window.innerWidth - 240),
        y: Math.min(clientY + 10, window.innerHeight - 220)
      });
    }

    if (node.isDir || node.type === 'DIRECTORY') {
      // Only update metadata panel, do not attempt to read as raw file buffer
      return;
    }

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

  const visibleGraphData = useMemo(() => {
    if (!focusedParentId) return { nodes: finalNodes, links: finalLinks };

    const connectedIds = new Set<string>([focusedParentId]);
    let added = true;
    // Traverse outwards to collect direct children and nested descendants
    while (added) {
      added = false;
      links.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (connectedIds.has(sourceId) && !connectedIds.has(targetId)) {
          connectedIds.add(targetId);
          added = true;
        }
      });
    }

    const filteredNodes = nodes.filter((n: any) => connectedIds.has(n.id));
    const filteredLinks = links.filter((l: any) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return connectedIds.has(s) && connectedIds.has(t);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, links, finalNodes, finalLinks, focusedParentId]);

  // Breadth/depth calculation for tree target coordinates:
  useEffect(() => {
    if (!isTreeLayout) return;

    const targetNodes = (visibleGraphData?.nodes && visibleGraphData.nodes.length > 0) ? visibleGraphData.nodes : nodes;

    // Group nodes by depth from root directory
    const levels: Record<number, any[]> = {};
    targetNodes.forEach((node: any) => {
      const depth = (node.path ? node.path.split(/[/\\]/).length : 1);
      if (!levels[depth]) levels[depth] = [];
      levels[depth].push(node);
    });

    const levelKeys = Object.keys(levels).map(Number).sort((a, b) => a - b);
    levelKeys.forEach((lvl, lvlIdx) => {
      const row = levels[lvl];
      const count = row.length;
      const yPos = 200 - lvlIdx * 110; // Vertical drop per layer
      const radius = Math.min(300, count * 28); // Radial ring per layer

      row.forEach((node, i) => {
        const theta = (i / count) * 2 * Math.PI;
        node.targetX = radius * Math.cos(theta);
        node.targetY = yPos;
        node.targetZ = radius * Math.sin(theta);
      });
    });
  }, [isTreeLayout, nodes, visibleGraphData]);

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
      <div className="h-14 w-full bg-transparent border-none z-[70] flex items-center justify-center relative flex-shrink-0 pointer-events-none">
        <div className="flex items-center justify-center gap-4 bg-transparent border-none shadow-none pointer-events-auto z-[71]">
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
            onClick={handleToggleFullView}
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
            onClick={() => {
              if (!isSettingsOpen) setSettingsTab('APPEARANCE');
              setIsSettingsOpen(!isSettingsOpen);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-xs font-mono font-bold text-gray-300"
          >
            [O] OPTIONS
          </button>
          <button
            onClick={() => setIsPhysicsFrozen(!isPhysicsFrozen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-mono font-bold ${
              !isPhysicsFrozen
                ? 'text-cyan-300 bg-cyan-950/40 border border-cyan-500/40 hover:bg-cyan-900/50'
                : 'text-red-400 bg-red-950/40 border border-red-500/50 hover:bg-red-900/50'
            }`}
            title="Toggle Node Physics Motion / Freeze"
          >
            {!isPhysicsFrozen ? '● MOTION' : '■ FROZEN'}
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
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 flex items-center gap-1.5 z-30 pointer-events-auto flex-wrap justify-center max-w-[90vw]">
          {/* Individual Tag Removal */}
          {selectedExtensions.map((ext: string) => {
            const cleanExt = ext.replace(/^\./, '');
            return (
              <button
                key={ext}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedExtensions((prev: string[]) => prev.filter((item) => item !== ext && item !== `.${cleanExt}`));
                }}
                className="px-2 py-0.5 text-[10px] font-mono bg-purple-950/60 border border-purple-500/40 text-purple-300 rounded-full hover:bg-purple-900/80 hover:text-white flex items-center gap-1 cursor-pointer transition-colors shadow-[0_0_10px_rgba(168,85,247,0.2)]"
              >
                .{cleanExt} <span className="hover:text-red-400">×</span>
              </button>
            );
          })}

          {/* Individual Health Filter Removal */}
          {criteria.health?.map((h: string) => (
            <button
              key={h}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleCriteria('health', h);
              }}
              className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 rounded-full hover:bg-cyan-900/80 hover:text-white flex items-center gap-1 cursor-pointer transition-colors shadow-[0_0_10px_rgba(0,210,255,0.2)]"
            >
              {h.toUpperCase()} <span className="hover:text-red-400">×</span>
            </button>
          ))}

          {/* Other Categories in criteria */}
          {Object.entries(criteria)
            .filter(([category]) => category !== 'fileType' && category !== 'health')
            .map(([category, values]) =>
              (values as string[]).map(val => (
                <button
                  key={`${category}-${val}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCriteria(category as any, val);
                  }}
                  className="px-2 py-0.5 text-[10px] font-mono bg-purple-950/60 border border-purple-500/40 text-purple-300 rounded-full hover:bg-purple-900/80 hover:text-white flex items-center gap-1 cursor-pointer transition-colors shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                >
                  {val} <span className="hover:text-red-400">×</span>
                </button>
              ))
          )}

          {/* Clear All Button */}
          {(selectedExtensions.length > 0 || searchFilter || healthFilter || Object.values(criteria).some(arr => Array.isArray(arr) && arr.length > 0)) && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedExtensions([]);
                setSearchFilter('');
                setHealthFilter(null);
                clearAllFilters();
              }}
              className="text-[10px] font-mono text-zinc-400 hover:text-cyan-400 cursor-pointer ml-1 transition-colors px-2 py-0.5 rounded hover:bg-white/5"
            >
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
                        key={h}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleCriteria('health', h);
                        }}
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
                                  key={ext}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleCriteria('fileType', ext);
                                  }}
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
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -500, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 140 }}
              className="fixed left-4 top-16 bottom-6 w-[360px] max-h-[calc(100vh-90px)] z-40 bg-[#0B0B14]/95 border border-white/10 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-2xl"
            >
              {/* HEADER */}
              <div
                onMouseDown={handleLeftHeaderMouseDown}
                className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#10101C] flex items-center justify-between cursor-move select-none"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold tracking-wider text-purple-400 truncate">[ FILE INFORMATION PANEL ]</span>
                </div>
                <button
                  data-no-drag
                  onClick={() => { setSelectedNodeId(null); setSelectedNode(null); setActiveFileNode(null); setIsLeftPanelMinimized(false); }}
                  className="text-zinc-400 hover:text-red-400 font-mono text-xs px-2 py-0.5 border border-white/10 rounded-lg bg-white/5 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Close Panel"
                >
                  [x]
                </button>
              </div>

              {/* SCROLLABLE MIDDLE SECTION (Cards & Accordions) */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar p-3">

                  {/* BASIC INFO */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
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
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <button onClick={() => setOpenCode(!openCode)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors cursor-pointer">
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
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <button onClick={() => setOpenDeps(!openDeps)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors cursor-pointer">
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
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <button onClick={() => setOpenAi(!openAi)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors cursor-pointer">
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
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <button onClick={() => setOpenIssues(!openIssues)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors cursor-pointer">
                      {openIssues ? '[-] ISSUES FOUND' : '[+] ISSUES FOUND'}
                    </button>
                    {openIssues && (
                      <div className="p-3 flex flex-col">
                        <InfoRow label="Critical" value={activeFileNode?.issues?.filter((i: any) => i.severity === 'critical').length || (activeFileNode?.health === 'critical' ? 1 : 0)} />
                        <InfoRow label="High" value={activeFileNode?.issues?.filter((i: any) => i.severity === 'high').length || 0} />
                        <InfoRow label="Medium" value={activeFileNode?.issues?.filter((i: any) => i.severity === 'medium').length || 0} />
                        <InfoRow label="Low" value={activeFileNode?.issues?.filter((i: any) => i.severity === 'low').length || 0} />
                        <InfoRow label="Suggestions" value="Check Spark Context" />
                      </div>
                    )}
                  </div>

                  {/* GIT / VERSION CONTROL */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <button onClick={() => setOpenGit(!openGit)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors cursor-pointer">
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
              </div>

              {/* PINNED BOTTOM ACTION BUTTONS */}
              <div className="shrink-0 p-3 bg-[#0B0B12]/90 border-t border-white/10 flex flex-col gap-2">
                {/* Row 1: 2 equal buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setActiveFileNode(null); setSelectedNode(null); setSelectedNodeId(null); setIsLeftPanelMinimized(false); }} 
                    className="h-8 px-2 text-[11px] font-mono rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-zinc-300 flex items-center justify-center whitespace-nowrap cursor-pointer active:scale-95 transition-all"
                  >
                    [ CLOSE PANEL ]
                  </button>
                  <button 
                    onClick={() => setShowSourceViewer((prev) => !prev)} 
                    className="h-8 px-2 text-[11px] font-mono rounded-lg border border-cyan-500/40 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center whitespace-nowrap cursor-pointer active:scale-95 transition-all"
                  >
                    {showSourceViewer ? '[ HIDE CODE ]' : '[ VIEW CODE ]'}
                  </button>
                </div>
                {/* Row 2: 1 full-width prominent button */}
                {isSparkAiEnabled && (
                  <button 
                    onClick={() => {
                      const nodeToAttach = activeFileNode || selectedNode;
                      if (nodeToAttach) {
                        setActiveFileNode(nodeToAttach);
                        setSelectedNode(nodeToAttach);
                        setSelectedNodeId(nodeToAttach.id);
                      }
                      (window as any).SelectedNodeFileBuffer = nodeSourceCode || nodeToAttach?.fileContent || '';
                      const prompt = `Analyze and refactor the security vulnerabilities in this code file:\n\n\`\`\`\n${nodeSourceCode || nodeToAttach?.fileContent || ''}\n\`\`\``;
                      setVoiceAiInitialPrompt(prompt);
                      setIsVoiceAiModalOpen(true);
                    }} 
                    className="w-full h-8 px-2 text-[11px] font-mono rounded-lg border border-purple-500/40 bg-purple-950/30 text-purple-300 hover:bg-purple-600/30 flex items-center justify-center whitespace-nowrap cursor-pointer active:scale-95 transition-all shadow-[0_0_10px_rgba(168,85,247,0.15)]"
                  >
                    [ CONNECT SPARK AI ]
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing select-none">
          {activeLayoutMode === 'file-tree' ? (
            <div className="absolute inset-0 z-10 w-full h-full bg-[#0B0B10] overflow-hidden flex">
              <div className="w-1/3 h-full border-r border-zinc-800 overflow-hidden relative">
                <div className="w-full h-full bg-[#0B0B10] overflow-hidden">
                  <FileTreeView
                    nodes={finalNodes}
                    selectedNodeId={selectedNode?.id || null}
                    onSelectNode={(node) => {
                      setSelectedNode(node);
                      setSelectedNodeId(node.id);
                      setActiveFileNode(node);
                      if (node.isDir || node.type === 'DIRECTORY') {
                        // Only update metadata panel, do not attempt to read as raw file buffer
                        return;
                      }
                      setShowSourceViewer(true);
                    }}
                    fontScale={fontScale}
                    currentTheme={currentTheme}
                  />
                </div>
              </div>
              <div className="flex-1 h-full p-6 flex flex-col bg-[#0B0B10] overflow-y-auto relative">
                {activeFileNode ? (
                  <div className="w-full h-full flex flex-col">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-mono font-bold text-xs">[PREVIEW]</span>
                        <span className="text-white font-mono text-xs font-semibold">{activeFileNode.label || activeFileNode.path}</span>
                        {activeFileNode.health === 'critical' && <span className="text-[9px] font-mono text-red-400 border border-red-500/40 bg-red-900/20 px-1.5 py-0.5 rounded">[CRITICAL RISK]</span>}
                        {activeFileNode.health === 'warning' && <span className="text-[9px] font-mono text-yellow-400 border border-yellow-500/40 bg-yellow-900/20 px-1.5 py-0.5 rounded">[WARNING]</span>}
                        {activeFileNode.health === 'healthy' && <span className="text-[9px] font-mono text-emerald-400 border border-emerald-500/40 bg-emerald-900/20 px-1.5 py-0.5 rounded">[SECURE]</span>}
                      </div>
                      <button
                        onClick={() => {
                          setActiveLayoutMode("node-graph");
                          window.dispatchEvent(new CustomEvent('orion:set-layout', { detail: 'node-graph' }));
                        }}
                        className="text-[10px] font-mono text-cyan-400 hover:text-white bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 px-2 py-1 rounded transition-colors"
                      >
                        [ VIEW IN 3D GRAPH ]
                      </button>
                    </div>
                    {['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].some(ext => (activeFileNode?.relativePath || activeFileNode?.path || activeFileNode?.label || activeFileNode?.name || '')?.toLowerCase().endsWith(ext)) ? (
                      <DashboardImageViewer src={`file://${activeFileNode?.path || activeFileNode?.relativePath || activeFileNode?.name}`} alt="Asset Preview" />
                    ) : ['.mp4', '.mkv', '.mov', '.webm'].some(ext => (activeFileNode?.relativePath || activeFileNode?.path || activeFileNode?.label || activeFileNode?.name || '')?.toLowerCase().endsWith(ext)) ? (
                      <video src={`file://${activeFileNode?.path || activeFileNode?.relativePath || activeFileNode?.name}`} controls className="w-full h-full rounded border border-zinc-800 bg-black" />
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
                  camera={{ position: [0, 0, 450], fov: 60, near: 0.1, far: 5000 }}
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
                  <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} target={[0, 0, 0]} maxDistance={2500} />
                  <CameraSync cameraRef={cameraRef} />
                  <StarfieldParticleGrid animSpeed={animSpeed} glowEnabled={glowEnabled} showParticleGrid={starGridActive} />
                  <PhysicsGraph
                    nodes={visibleGraphData.nodes}
                    links={visibleGraphData.links}
                    onSelectNode={handleNodeClick}
                    onContextMenu={handleContextMenu}
                    nodeSize={dynamicNodeScale}
                    edgeOpacity={edgeVisibility ? edgeOpacity : 0}
                    fileLabels={fileLabels}
                    animSpeed={animSpeed}
                    glowEnabled={glowEnabled}
                    fontScale={dynamicFontScale}
                    isPhysicsFrozen={isPhysicsFrozen}
                    isTreeLayout={isTreeLayout}
                    cameraRef={cameraRef}
                    showCodeDependencies={showCodeDependencies}
                    highlightDependencyEdges={highlightDependencyEdges}
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
          {showSourceViewer && (selectedNode || activeFileNode) && !isGraphFullScreen && (
            <motion.div
              initial={{ x: 500, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 500, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
              className="absolute top-16 right-0 bottom-8 w-[500px] z-50 bg-[#0B0B10]/95 border-l border-[#1E1E26] p-6 flex flex-col justify-between backdrop-blur-md shadow-2xl"
              style={{
                transform: `translate3d(${rightPanelPos.x}px, ${rightPanelPos.y}px, 0)`,
              }}
            >
              <div
                onMouseDown={handleRightHeaderMouseDown}
                className="flex items-center justify-between border-b border-white/5 pb-4 select-none shrink-0 cursor-move"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider truncate max-w-[280px]">
                      {selectedNode?.label || activeFileNode?.label || activeFileNode?.name}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono tracking-wider">[DRAG]</span>
                  </div>
                  {selectedNode?.health === 'critical' ? (
                    <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest mt-0.5 animate-pulse">
                      SECURITY INTRUSION WARNING
                    </span>
                  ) : isDatasetFile(selectedNode?.label || selectedNode?.path || activeFileNode?.label || activeFileNode?.path || '') ? (
                    <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest mt-0.5">
                      STRUCTURED DATASET EXPLORER
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-zinc-500 tracking-wider mt-0.5">
                      ORION STATIC VECTOR ANALYSIS
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowSourceViewer(false)}
                  className="text-zinc-500 hover:text-white p-1 rounded hover:bg-white/5 transition-colors font-mono text-xs"
                >
                  [x]
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 my-3 custom-scrollbar">
                {['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].some(ext => (activeFileNode?.relativePath || activeFileNode?.path || selectedNode?.path || selectedNode?.label || '')?.toLowerCase().endsWith(ext)) ? (
                  <DashboardImageViewer
                    src={`file://${activeFileNode?.path || activeFileNode?.relativePath || selectedNode?.path}`}
                    alt="Asset Preview"
                  />
                ) : ['.mp4', '.mkv', '.mov', '.webm'].some(ext => (activeFileNode?.relativePath || activeFileNode?.path || selectedNode?.path || '')?.toLowerCase().endsWith(ext)) ? (
                  <video src={`file://${activeFileNode?.path || activeFileNode?.relativePath || selectedNode?.path}`} controls className="w-full h-full rounded border border-zinc-800 bg-black" />
                ) : (selectedNode?.health === 'critical' || selectedNode?.health === 'warning') ? (
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
                ) : isDatasetFile(activeFileNode?.relativePath || activeFileNode?.path || selectedNode?.path || selectedNode?.label || '') ? (
                  <DatasetExplorer
                    content={selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent || ''}
                    fileName={selectedNode?.label || selectedNode?.path || activeFileNode?.label || activeFileNode?.path || 'dataset.csv'}
                  />
                ) : (selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent) ? (
                  <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden min-h-[200px]">
                    <div className="bg-[#0B0B10] px-3 py-1.5 border-b border-white/10 select-none">
                      <span className="font-mono text-[9px] font-bold text-gray-400 uppercase">RAW FILE CONTENT</span>
                    </div>
                    <pre className="p-3 font-mono text-[10px] text-gray-300 leading-relaxed overflow-auto whitespace-pre select-text h-full font-light">
                      <code>{selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent}</code>
                    </pre>
                  </div>
                ) : selectedNode?.isDir ? (
                  <div className="flex-1 flex items-center justify-center text-center p-6">
                    <span className="text-[10px] font-mono text-gray-500">
                      Directory Node selected. Expand child nodes to inspect source files.
                    </span>
                  </div>
                ) : isFileLoading === true && selectedNode !== null ? (
                  <div className="flex-1 flex items-center justify-center text-center p-6 flex-col gap-3">
                    <span className="w-6 h-6 rounded-full border-t-2 border-cyber-500 animate-spin" />
                    <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
                      Loading File Stream...
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-6">
                    <span className="text-[10px] font-mono text-gray-500">
                      No source content available for this node.
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 flex gap-3 select-none shrink-0">
                <button
                  onClick={() => setShowSourceViewer(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 font-mono text-[10px] font-bold uppercase text-gray-400 tracking-wider transition-colors duration-200"
                >
                  [ CLOSE VIEWER ]
                </button>
                {selectedNode?.health === 'critical' && (
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
        {/* 4TH COLUMN AI PANEL REMOVED (NOW INTEGRATED INTO LEFT SIDEBAR) */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div 
              className={`fixed inset-0 z-50 flex items-center justify-center p-4 select-none ${
                enableGlassBlur ? 'bg-black/40 backdrop-blur-md' : 'bg-black/70'
              }`}
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsSettingsOpen(false);
              }}
            >
              <div className="relative w-[560px] max-w-[95vw] h-[590px] bg-[#07070E] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_20px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden font-mono mt-8">
                {/* Top Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-[#0A0A14]">
                  <span className="text-xs font-bold tracking-wider text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">[ PREMIUM SETTINGS MATRIX ]</span>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-6 h-6 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Tabs Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-2 border-b border-white/10 bg-[#05050A] text-[10px]">
                  {(['APPEARANCE', 'SYSTEM', 'SPARK AI', 'ABOUT ORION-X'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        if (tab === 'ABOUT ORION-X') {
                          setIsSettingsOpen(false);
                          setIsAboutModalOpen(true);
                        } else {
                          setSettingsTab(tab === 'SPARK AI' ? 'SPARK_AI' : tab);
                        }
                      }}
                      className={`px-2 py-1 rounded transition-all ${
                        (tab === 'SPARK AI' ? settingsTab === 'SPARK_AI' : settingsTab === tab) && tab !== 'ABOUT ORION-X'
                          ? 'text-cyan-300 font-bold border-b-2 border-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      [ {tab} ]
                    </button>
                  ))}
                </div>

                {/* Scrollable Tab Content with Pitch-Black Background */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#07070E] custom-scrollbar">
                  {/* DYNAMIC TAB RENDER CONTENT */}
                  <div className="grid grid-cols-2 gap-4">
                  {settingsTab === 'APPEARANCE' && (
                    <>
                      <div className="flex flex-col gap-1.5 col-span-2">
                        <span className="text-xs font-mono text-zinc-100 font-semibold block">Theme Engine</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setCurrentTheme('dark');
                              console.log("[SETTINGS ENGINE] Switched view theme matrix to Charcoal Dark HUD.");
                            }}
                            className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-lg border transition-all ${currentTheme === 'dark' ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-[#0B0B16] border-white/15 text-zinc-300 hover:text-white hover:border-white/30'}`}
                          >
                            DARK HUD
                          </button>
                          <button
                            onClick={() => {
                              setCurrentTheme('light');
                              console.log("[SETTINGS ENGINE] Switched view theme matrix to High-Contrast Amber HUD.");
                            }}
                            className={`px-3 py-1.5 text-[10px] font-mono uppercase rounded-lg border transition-all ${currentTheme === 'light' ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-[#0B0B16] border-white/15 text-zinc-300 hover:text-white hover:border-white/30'}`}
                          >
                            AMBER HUD
                          </button>
                        </div>
                      </div>

                      {/* REDESIGNED UI DENSITY SELECTOR */}
                      <div className="flex flex-col gap-1.5 py-2 border-b border-white/10 col-span-2">
                        <span className="text-xs font-mono text-zinc-100 font-semibold block">UI Density</span>
                        <div className="inline-flex p-1 rounded-xl bg-[#0B0B16] border border-white/15 gap-1 w-full">
                          {(['COMPACT', 'STANDARD', 'SPACIOUS'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setUiDensity(mode.toLowerCase())}
                              className={`flex-1 py-1.5 text-[10px] font-mono rounded-lg font-semibold tracking-wider transition-all ${
                                uiDensity.toUpperCase() === mode
                                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)]'
                                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* GLOBAL GLASSMORPHISM / BACKDROP BLUR TOGGLE */}
                      <div className="flex items-center justify-between py-2 border-b border-white/10 col-span-2">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Glassmorphism / Backdrop Blur</span>
                          <span className="text-[10px] font-mono text-zinc-400">Toggle translucent background blurs across all modals</span>
                        </div>
                        <CyberToggle checked={enableGlassBlur} onChange={setEnableGlassBlur} />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10 col-span-2">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Glow & Animations</span>
                          <span className="text-[10px] font-mono text-zinc-400">Volumetric node bloom and pulse effects</span>
                        </div>
                        <CyberToggle checked={glowEnabled} onChange={setGlowEnabled} />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10 col-span-2">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Background Particle Grid</span>
                          <span className="text-[10px] font-mono text-zinc-400">Ambient 3D starfield & matrix grid</span>
                        </div>
                        <CyberToggle checked={starGridActive} onChange={setStarGridActive} />
                      </div>

                      <div className="flex flex-col gap-1.5 col-span-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-zinc-100 font-semibold">Font Scaling</span>
                          <span className="text-[10px] font-mono text-cyan-400 font-bold">{fontScale}%</span>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max="140"
                          step="5"
                          value={fontScale}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFontScale(val);
                            if (typeof document !== 'undefined') {
                              document.documentElement.style.fontSize = `${val}%`;
                              document.documentElement.style.setProperty('--app-font-scale', `${val}%`);
                            }
                          }}
                          className="w-full accent-cyan-500"
                        />
                      </div>

                      <div className="col-span-2 pt-3 mt-1 border-t border-white/10 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-mono font-bold text-zinc-100">Reset Appearance</span>
                          <span className="text-[9px] font-mono text-zinc-400">Restore theme, glow, particles & font scaling</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTheme('dark');
                            setUiDensity('compact' as any);
                            setGlowEnabled(true);
                            setStarGridActive(true);
                            setFontScale(100);
                            setEnableGlassBlur(false);
                            if (typeof document !== 'undefined') {
                              document.documentElement.style.fontSize = '100%';
                              document.documentElement.style.setProperty('--app-font-scale', '100%');
                            }
                            console.log("[SETTINGS ENGINE] Appearance settings reset to default values.");
                          }}
                          className="px-3 py-1.5 bg-[#0B0B16] hover:bg-cyan-950/50 border border-white/20 hover:border-cyan-400 text-zinc-200 hover:text-cyan-300 text-[10px] font-mono font-bold rounded-lg transition-all flex items-center gap-1.5 select-none shadow-sm active:scale-95"
                          title="Reset Appearance settings to default"
                        >
                          <span className="text-cyan-400 font-bold text-xs">↺</span>
                          <span>[ ↺ RESET DEFAULTS ]</span>
                        </button>
                      </div>
                    </>
                  )}

                  {settingsTab === 'SYSTEM' && (
                    <>
                      {/* NEURAL TREE MATRIX / TOPOLOGY TOGGLE */}
                      <div className="col-span-2 flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Neural Tree Topology</span>
                          <span className="text-[10px] font-mono text-zinc-400">Arrange nodes into an animated 3D hierarchical tree</span>
                        </div>
                        <CyberToggle checked={isTreeLayout} onChange={setIsTreeLayout} />
                      </div>

                      {/* FREEZE / UNFREEZE MOVING NODES (MOTION TOGGLE) */}
                      <div className="col-span-2 flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">
                            Node Motion {!isPhysicsFrozen ? <span className="text-[10px] text-cyan-400 font-normal">[ACTIVE]</span> : <span className="text-[10px] text-zinc-400 font-normal">[FROZEN]</span>}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">Enable 3D force simulation velocity or lock layout</span>
                        </div>
                        <CyberToggle checked={!isPhysicsFrozen} onChange={(active) => setIsPhysicsFrozen(!active)} />
                      </div>

                      {/* AUTO SCALE TOGGLE & DENSITY FEEDBACK */}
                      <div className="col-span-2 flex flex-col gap-1 py-2 border-b border-white/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-mono text-zinc-100 font-semibold block">Auto Scale</span>
                            <span className="text-[10px] font-mono text-zinc-400">Dynamically adapt node & text dimensions to vault density</span>
                          </div>
                          <CyberToggle checked={autoScale} onChange={setAutoScale} />
                        </div>
                        {autoScale && (
                          <div className="text-[9px] font-mono text-cyan-400 font-semibold mt-0.5">
                            Active Vault Multiplier: Node {dynamicNodeScale.toFixed(2)}x | Font {dynamicFontScale}% ({nodes.length} nodes)
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Auto Layout</span>
                          <span className="text-[10px] font-mono text-zinc-400">Radial repulsion layout calculation</span>
                        </div>
                        <CyberToggle 
                          checked={autoLayout} 
                          onChange={(val) => {
                            setAutoLayout(val);
                            if (val) handleTriggerAutoLayout();
                          }} 
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Node Labels</span>
                          <span className="text-[10px] font-mono text-zinc-400">Render floating monospace text tags</span>
                        </div>
                        <CyberToggle 
                          checked={fileLabels} 
                          onChange={(val) => {
                            setFileLabels(val);
                            setNodeLabels(val);
                          }} 
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Show Folders</span>
                          <span className="text-[10px] font-mono text-zinc-400">Display directory cluster nodes</span>
                        </div>
                        <CyberToggle checked={showFolders} onChange={setShowFolders} />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Show Dependencies</span>
                          <span className="text-[10px] font-mono text-zinc-400">Render package and manifest links</span>
                        </div>
                        <CyberToggle checked={showDeps} onChange={setShowDeps} />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Code Dependency Analysis</span>
                          <span className="text-[10px] font-mono text-zinc-400">Map deep import and invocation edges between files</span>
                        </div>
                        <CyberToggle checked={showCodeDependencies} onChange={setShowCodeDependencies} />
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Highlight Dependency Links</span>
                          <span className="text-[10px] font-mono text-zinc-400">Color-code AST import edges (Neon Fuchsia/Amber glow)</span>
                        </div>
                        <CyberToggle checked={highlightDependencyEdges} onChange={setHighlightDependencyEdges} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-zinc-100 font-semibold">Node Size ({nodeSize.toFixed(1)}x)</span>
                          {autoScale && <span className="text-[8px] font-mono text-cyan-400/80 font-bold">[Auto: {dynamicNodeScale.toFixed(2)}x]</span>}
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="0.1"
                          value={nodeSize}
                          onChange={e => setNodeSize(Number(e.target.value))}
                          className="w-full accent-cyan-500"
                        />
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Edge Visibility</span>
                          <span className="text-[10px] font-mono text-zinc-400">Render 3D link lines between nodes</span>
                        </div>
                        <CyberToggle checked={edgeVisibility} onChange={setEdgeVisibility} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-zinc-100 font-semibold">Edge Opacity ({Math.round(edgeOpacity * 100)}%)</span>
                        <input
                          type="range"
                          min="0.05"
                          max="1"
                          step="0.05"
                          value={edgeOpacity}
                          onChange={e => setEdgeOpacity(Number(e.target.value))}
                          className="w-full accent-cyan-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-zinc-100 font-semibold">Simulation Speed ({animSpeed.toFixed(1)}x)</span>
                        <input
                          type="range"
                          min="0.1"
                          max="3"
                          step="0.1"
                          value={animSpeed}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setAnimSpeed(val);
                            setAnimationVelocity(val);
                          }}
                          className="w-full accent-cyan-500"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-between pt-3 border-t border-white/10 gap-2">
                        <button
                          type="button"
                          onClick={handleResetSettings}
                          className="flex-1 bg-[#0B0B16] hover:bg-cyan-950/40 border border-white/20 hover:border-cyan-400 text-zinc-100 hover:text-cyan-300 text-[10px] font-mono font-semibold py-1.5 rounded-lg transition-all"
                        >
                          [ ↺ RESET SETTINGS ]
                        </button>
                        <button
                          type="button"
                          onClick={handleResimulate}
                          className="flex-1 bg-[#0B0B16] hover:bg-purple-950/40 border border-white/20 hover:border-purple-400 text-zinc-100 hover:text-purple-300 text-[10px] font-mono font-semibold py-1.5 rounded-lg transition-all"
                        >
                          [ RE-SIMULATE LAYOUT ]
                        </button>
                        <button
                          type="button"
                          onClick={handleResetCamera}
                          className="flex-1 bg-[#0B0B16] hover:bg-zinc-800 border border-white/20 hover:border-white/40 text-zinc-100 hover:text-white text-[10px] font-mono font-semibold py-1.5 rounded-lg transition-all"
                        >
                          [ RESET CAMERA ]
                        </button>
                      </div>
                    </>
                  )}

                  {settingsTab === 'SPARK_AI' && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Spark AI Engine</span>
                          <span className="text-[10px] font-mono text-zinc-400">Master visibility for orb, model, & prompts</span>
                        </div>
                        <CyberToggle checked={isSparkAiEnabled} onChange={setIsSparkAiEnabled} />
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Auto-Analyze Selected</span>
                          <span className="text-[10px] font-mono text-zinc-400">Trigger immediate AST scan on click</span>
                        </div>
                        <CyberToggle checked={autoAnalyze} onChange={setAutoAnalyze} />
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Chat Caching</span>
                          <span className="text-[10px] font-mono text-zinc-400">Persist session history across queries</span>
                        </div>
                        <CyberToggle checked={chatCaching} onChange={setChatCaching} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-zinc-100 font-semibold">Response Style</span>
                        <div className="flex gap-2">
                          {['Concise', 'Detailed'].map(t => <button key={t} onClick={() => setResponseStyle(t)} className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all ${responseStyle === t ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' : 'bg-[#0B0B16] border-white/15 text-zinc-400 hover:text-white'}`}>[ {t} ]</button>)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-zinc-100 font-semibold">Analysis Depth</span>
                        <div className="flex gap-2">
                          {['Basic', 'Deep'].map(t => <button key={t} onClick={() => setAnalysisDepth(t)} className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all ${analysisDepth === t ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' : 'bg-[#0B0B16] border-white/15 text-zinc-400 hover:text-white'}`}>[ {t} ]</button>)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-zinc-100 font-semibold">Context Window Size (Tokens)</span>
                        <input type="number" value={contextSize} onChange={e => setContextSize(Number(e.target.value))} className="bg-[#0B0B16] border border-white/20 text-white text-[10px] font-mono px-2.5 py-1.5 rounded-lg focus:border-cyan-400 focus:outline-none" />
                      </div>
                      <div className="col-span-2 mt-2">
                        <button onClick={() => { (window as any).chatHistory = []; setChatHistory(false); setContextSize(0); setToastMessage('AGENT CONTEXT WIPED'); setTimeout(() => setToastMessage(''), 3000); }} className="w-full bg-[#0B0B16] hover:bg-purple-900/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-[10px] font-mono py-2 rounded-lg transition-all font-semibold">
                          [ WIPE AGENT CONTEXT ]
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
        {/* Floating Spark AI Orb Trigger Button */}
        {isSparkAiEnabled && !isVoiceAiModalOpen && !isGraphFullScreen && (
          <button 
            onClick={() => {
              setVoiceAiInitialPrompt('');
              setIsVoiceAiModalOpen(true);
            }}
            className="group absolute bottom-8 right-8 z-[100] flex items-center justify-center transition-all duration-300"
            style={{
              width: '3.5rem', height: '3.5rem',
              borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #a855f7, #6366f1 60%, #ec4899)',
              border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(236, 72, 153, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.5)';
            }}
            title="Spark AI Core"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white drop-shadow-md">
              <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8L10 2Z" fill="currentColor"/>
              <path d="M19 14L20 17L23 18L20 19L19 22L18 19L15 18L18 17L19 14Z" fill="currentColor"/>
              <path d="M6 18L6.5 20L8.5 20.5L6.5 21L6 23L5.5 21L3.5 20.5L5.5 20L6 18Z" fill="currentColor"/>
            </svg>
          </button>
        )}

        {/* Spark AI Holographic Voice Modal */}
        {isSparkAiEnabled && isVoiceAiModalOpen && !isGraphFullScreen && (
          <SparkAiVoiceModal
            isOpen={isVoiceAiModalOpen}
            onClose={() => setIsVoiceAiModalOpen(false)}
            isFullScreen={isGraphFullScreen}
            initialPrompt={voiceAiInitialPrompt}
            activeNode={activeFileNode || selectedNode}
            nodes={nodes}
            edges={links}
            vaultName={activeWorkspace?.name || 'Downloads'}
          />
        )}

        {/* Cyber Action Popup Overlay */}
        {actionPopup && (
          <div
            style={{ left: `${actionPopup.x}px`, top: `${actionPopup.y}px` }}
            className="fixed z-50 w-52 p-2.5 rounded-xl bg-[#0C0C16]/95 border border-cyan-500/40 backdrop-blur-xl shadow-2xl flex flex-col gap-1.5 font-mono select-none"
          >
            {/* Header + Close Button */}
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <span className="text-[11px] font-bold text-cyan-400 truncate max-w-[140px]">
                {actionPopup.node.name || actionPopup.node.label || actionPopup.node.id}
              </span>
              <button
                onClick={() => setActionPopup(null)}
                className="w-4 h-4 rounded text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Action 1: Reset Filter */}
            <button
              onClick={() => {
                setFocusedParentId(null);
                setActionPopup(null);
              }}
              className="w-full text-left px-2 py-1 text-[10px] rounded text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              [ RESET GRAPH FILTER ]
            </button>

            {/* Action 2: Inspect Folder / Node Metadata */}
            <button
              onClick={() => {
                setSelectedNode(actionPopup.node);
                setActiveFileNode(actionPopup.node);
                setActionPopup(null);
              }}
              className="w-full text-left px-2 py-1 text-[10px] rounded text-zinc-300 hover:bg-white/10 hover:text-cyan-300 transition-colors"
            >
              [ VIEW DETAILS ]
            </button>

            {/* Action 3: Connect to Spark AI for subtree audit */}
            {isSparkAiEnabled && (
              <button
                onClick={() => {
                  setSelectedNode(actionPopup.node);
                  setIsVoiceAiModalOpen(true);
                  setActionPopup(null);
                }}
                className="w-full text-left px-2 py-1 text-[10px] rounded text-purple-300 hover:bg-purple-950/40 border border-purple-500/20 transition-colors"
              >
                [ AUDIT WITH SPARK AI ]
              </button>
            )}
          </div>
        )}

        {/* Centered 9:16 Cyberpunk Glassmorphic About & Instructions Modal */}
        {isAboutModalOpen && (
          <div className={`fixed inset-0 z-[100] flex items-center justify-center px-4 pt-14 pb-8 overflow-hidden select-none ${
            enableGlassBlur ? 'bg-black/40 backdrop-blur-md' : 'bg-black/75'
          }`}>
            <div className="relative w-[480px] h-[820px] max-h-[85vh] max-w-[95vw] bg-[#0B0B14]/95 border border-purple-500/30 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.25)] flex flex-col overflow-hidden font-mono select-none">
              {/* Pinned Header Bar */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0E0E1A] z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-widest">ORION-X STUDIO</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 font-semibold">v4.2.0</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">System Manual & User Guide</span>
                </div>
                
                {/* Visible Prominent Close Button */}
                <button
                  type="button"
                  onClick={() => setIsAboutModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/20 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-300 flex items-center justify-center text-sm text-zinc-300 transition-all cursor-pointer shadow-md"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-zinc-300 text-xs leading-relaxed custom-scrollbar">
                
                {/* SECTION 1: ABOUT ORION-X */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">[ ABOUT PLATFORM ]</span>
                    <span className="text-[9px] text-cyan-400/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">LOCAL-FIRST</span>
                  </div>
                  
                  <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
                    <div className="text-white font-bold text-[11px] tracking-wide mb-1">
                      Your Codebase. Visualized. Understood. Connected.
                    </div>
                    <p className="text-zinc-400 text-[10.5px] leading-relaxed">
                      ORION-X Studio is a local-first engineering workspace designed to help developers understand complex software projects through an interactive spatial graph. Instead of navigating only through traditional folders and file lists, ORION-X turns your codebase into a living visual system where files, dependencies, functions, classes, data, and resources are explored as connected layers.
                    </p>
                  </div>

                  {/* What makes ORION-X different */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider block">What Makes ORION-X Different?</span>
                    
                    <div className="grid grid-cols-1 gap-2 text-[10px]">
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <span className="text-cyan-300 font-bold block mb-0.5">🌐 Understand the Structure</span>
                        <span className="text-zinc-400">See how files, modules, functions, classes, and dependencies are connected across the entire system.</span>
                      </div>
                      
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <span className="text-purple-300 font-bold block mb-0.5">⚛ Explore Through the Neural Graph</span>
                        <span className="text-zinc-400">Move beyond flat file trees with 3D force-directed physics, cluster layouts, and dynamic density auto-scaling.</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <span className="text-emerald-300 font-bold block mb-0.5">⚡ Find Problems Faster</span>
                        <span className="text-zinc-400">Locate security vulnerabilities, circular dependencies, and high complexity with real-time health badges.</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <span className="text-amber-300 font-bold block mb-0.5">✨ Spark AI Assistant</span>
                        <span className="text-zinc-400">Ask the local engineering AI to explain code, inspect files, review structures, analyze images, and audit subtrees.</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <span className="text-blue-300 font-bold block mb-0.5">📊 Explore Your Data</span>
                        <span className="text-zinc-400">Dedicated profiling for CSV, JSON, SQL, and Parquet with Table, Distribution, Relationship, and Quality views.</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                        <span className="text-rose-300 font-bold block mb-0.5">🔒 Designed for Local Operation</span>
                        <span className="text-zinc-400">Zero external telemetry. Project code, file metadata, ASTs, and local AI inference remain on your machine.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: USER INSTRUCTIONS & WORKFLOW GUIDE */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">[ OPERATING INSTRUCTIONS ]</span>

                  {/* Mouse Controls */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="text-[9.5px] font-bold text-zinc-300 uppercase tracking-wider block">Mouse Controls & 3D Navigation</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[9.5px]">
                      <div className="p-1.5 bg-black/40 rounded border border-white/5">
                        <span className="text-zinc-500 block">LEFT DRAG:</span>
                        <span className="text-zinc-200">Rotate 3D Graph</span>
                      </div>
                      <div className="p-1.5 bg-black/40 rounded border border-white/5">
                        <span className="text-zinc-500 block">RIGHT DRAG:</span>
                        <span className="text-zinc-200">Move / Pan View</span>
                      </div>
                      <div className="p-1.5 bg-black/40 rounded border border-white/5">
                        <span className="text-zinc-500 block">SCROLL WHEEL:</span>
                        <span className="text-zinc-200">Zoom In / Out</span>
                      </div>
                      <div className="p-1.5 bg-black/40 rounded border border-white/5">
                        <span className="text-zinc-500 block">CLICK NODE:</span>
                        <span className="text-zinc-200">Focus & Inspect</span>
                      </div>
                    </div>
                  </div>

                  {/* 6 Graph Layers */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-zinc-300 uppercase tracking-wider block">Switch Graph Layers (6 Views)</span>
                    <div className="space-y-1 text-[9.5px] text-zinc-400">
                      <div><strong className="text-cyan-400">FILES:</strong> Shows directories and files and how they are organized.</div>
                      <div><strong className="text-purple-400">DEPENDENCIES:</strong> Packages, libraries, manifests, and import links.</div>
                      <div><strong className="text-emerald-400">FUNCTIONS:</strong> Function declarations and how they call one another.</div>
                      <div><strong className="text-blue-400">CLASSES:</strong> Classes, inheritance, implementations, and structures.</div>
                      <div><strong className="text-amber-400">DATA:</strong> Databases, schemas, tables, JSON structures, and links.</div>
                      <div><strong className="text-rose-400">RESOURCES:</strong> Assets, templates, media, environment resources.</div>
                    </div>
                    <div className="text-[9px] text-zinc-500 italic pt-1 border-t border-white/5">
                      Tip: Switch layers depending on what you are investigating. You don&apos;t always need to view the entire system at once.
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-zinc-300 uppercase tracking-wider block">Search & Graph Filters</span>
                    <p className="text-[9.5px] text-zinc-400 leading-relaxed">
                      Use <span className="text-cyan-300">SEARCH</span> (<span className="text-zinc-300">Ctrl/Cmd + K</span>) to quickly find symbols, files, or paths. Open <span className="text-purple-300">GRAPH FILTERS</span> to filter by extension, health status, or risk. Active filters appear as removable chips; click <span className="text-cyan-300">[CLEAR]</span> to reset.
                    </p>
                  </div>

                  {/* Spark AI Assistant */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-zinc-300 uppercase tracking-wider block">Ask Spark AI Assistant</span>
                    <p className="text-[9.5px] text-zinc-400 leading-relaxed">
                      Select a file or project component and use Spark AI to ask questions like:
                    </p>
                    <div className="space-y-0.5 text-[9px] text-purple-300 font-mono italic pl-2 border-l border-purple-500/30">
                      <div>&quot;What does this file do?&quot;</div>
                      <div>&quot;Explain this function.&quot;</div>
                      <div>&quot;Why might this code be failing?&quot;</div>
                      <div>&quot;Find potential problems in this file.&quot;</div>
                      <div>&quot;Explain the relationship between these components.&quot;</div>
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1">
                      For diagrams and images, Spark AI also inspects visual content. Click <span className="text-purple-300">[ AUDIT WITH SPARK AI ]</span> in any node popup to audit that specific subtree.
                    </p>
                  </div>

                  {/* Data Explorer */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-zinc-300 uppercase tracking-wider block">Structured Data Explorer</span>
                    <p className="text-[9.5px] text-zinc-400 leading-relaxed">
                      Opening CSV, JSON, SQL, or Parquet files presents dedicated profiling views:
                    </p>
                    <div className="grid grid-cols-2 gap-1 text-[9px] text-zinc-400">
                      <div><strong className="text-cyan-400">TABLE:</strong> Browse actual records.</div>
                      <div><strong className="text-purple-400">DISTRIBUTION:</strong> Value frequencies.</div>
                      <div><strong className="text-emerald-400">RELATIONSHIPS:</strong> Column links.</div>
                      <div><strong className="text-amber-400">QUALITY:</strong> Missing & anomaly check.</div>
                    </div>
                  </div>

                  {/* Workspace Customization */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-zinc-300 uppercase tracking-wider block">Workspace Customization (OPTIONS)</span>
                    <div className="space-y-1 text-[9.5px] text-zinc-400">
                      <div><strong className="text-cyan-400">Node Motion:</strong> ACTIVE (simulation moves nodes) vs FROZEN (locks coordinates).</div>
                      <div><strong className="text-purple-400">Auto Scale:</strong> Automatically adjusts node & label size based on density.</div>
                      <div><strong className="text-emerald-400">Spark AI Engine:</strong> Master switch to show/hide AI modals and triggers.</div>
                      <div><strong className="text-amber-400">Reset Settings:</strong> Restores default graph, camera, and physics settings.</div>
                    </div>
                  </div>

                  {/* Recommended Workflow */}
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-purple-300 uppercase tracking-wider block">Recommended 10-Step Workflow</span>
                    <ol className="list-decimal list-inside space-y-1 text-[9.5px] text-zinc-300">
                      <li>Open or mount project directory</li>
                      <li>Explore the <span className="text-cyan-300">FILES</span> layer</li>
                      <li>Search for key files or symbols (<span className="text-zinc-400">Ctrl+K</span>)</li>
                      <li>Switch to <span className="text-purple-300">DEPENDENCIES</span> layer</li>
                      <li>Inspect <span className="text-emerald-300">FUNCTIONS</span> or <span className="text-blue-300">CLASSES</span></li>
                      <li>Use <span className="text-amber-300">GRAPH FILTERS</span> to reduce noise</li>
                      <li>Click an important node to view metadata</li>
                      <li>Inspect details & vulnerabilities</li>
                      <li>Ask <span className="text-purple-300">Spark AI</span> for explanation or audit</li>
                      <li>Investigate affected area using appropriate layer</li>
                    </ol>
                  </div>

                  {/* Quick Reference Table */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-zinc-300 uppercase tracking-wider block">Quick Reference</span>
                    <div className="space-y-1 text-[9.5px]">
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Rotate Graph</span><span className="text-zinc-300 font-bold">Left Drag</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Pan Graph</span><span className="text-zinc-300 font-bold">Right Drag</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Zoom</span><span className="text-zinc-300 font-bold">Scroll Wheel</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Inspect Node</span><span className="text-zinc-300 font-bold">Click</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Search Project</span><span className="text-zinc-300 font-bold">SEARCH (Ctrl+K)</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Filter Graph</span><span className="text-zinc-300 font-bold">GRAPH FILTERS</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Change View</span><span className="text-zinc-300 font-bold">Neural Layer Explorer</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">AI Analysis</span><span className="text-zinc-300 font-bold">AUDIT WITH SPARK AI</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Settings</span><span className="text-zinc-300 font-bold">OPTIONS ([O])</span></div>
                      <div className="flex justify-between py-0.5 border-b border-white/5"><span className="text-zinc-500">Stable Graph</span><span className="text-zinc-300 font-bold">NODE MOTION → FROZEN</span></div>
                      <div className="flex justify-between py-0.5"><span className="text-zinc-500">Restore Defaults</span><span className="text-zinc-300 font-bold">RESET SETTINGS</span></div>
                    </div>
                  </div>

                  {/* One Thing to Remember */}
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[9.5px] text-zinc-300">
                    <strong className="text-cyan-300 block mb-0.5">One Thing to Remember:</strong>
                    Don&apos;t try to understand the entire graph at once. Start with the FILES layer, find the area you&apos;re interested in, then move into DEPENDENCIES, FUNCTIONS, CLASSES, DATA, or RESOURCES to understand that part of the system in detail.
                  </div>

                  {/* System Specifications */}
                  <div className="p-3 rounded-xl bg-[#0E0E1A] border border-white/5 space-y-1.5">
                    <span className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider block">[ RUNTIME SPECIFICATIONS ]</span>
                    <div className="grid grid-cols-2 gap-2 text-[9px] text-zinc-400">
                      <div><span className="text-zinc-500 block">CORE ENGINE:</span>Electron 29 + Node.js</div>
                      <div><span className="text-zinc-500 block">SPATIAL ENGINE:</span>Three.js + R3F Force Physics</div>
                      <div><span className="text-zinc-500 block">AI INFERENCE:</span>Ollama Local REST API</div>
                      <div><span className="text-zinc-500 block">IPC STATUS:</span>workspace:readFile Active</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default NeuralGraphDashboard;
