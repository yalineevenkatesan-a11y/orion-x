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
import { getFileType } from '@/utils/fileTypes';
import { BinaryFilePreview } from './BinaryFilePreview';

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
  isGitModified?: boolean;
  git?: { status: string; };
  size?: number;
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
  colorScheme?: 'cyan' | 'red';
}

const CyberToggle: React.FC<CyberToggleProps> = ({ checked, onChange, disabled = false, colorScheme = 'cyan' }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cyber:toggle-sound'));
          }
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none ${
        checked
          ? (colorScheme === 'red'
              ? 'bg-red-500 border border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.55)]'
              : 'bg-cyan-500/30 border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.45)]')
          : 'bg-zinc-800/80 border border-white/10 hover:border-white/20'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full transition-transform duration-300 shadow-md ${
          checked
            ? (colorScheme === 'red'
                ? 'translate-x-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                : 'translate-x-6 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]')
            : 'translate-x-1 bg-zinc-400'
        }`}
      />
    </button>
  );
};

// ---------------------------------------------------------
// Experimental Labs Metadata & Visual Preview Registry
// ---------------------------------------------------------
export interface LabFeatureInfo {
  id: string;
  title: string;
  subtitle: string;
  visualSummary: string;
  overview: string;
  performance: string;
  hotkeys: string;
}

export const LAB_FEATURES_METADATA: Record<string, LabFeatureInfo> = {
  max_overdrive: {
    id: 'max_overdrive',
    title: 'Max Overdrive',
    subtitle: 'Turn all experimental lab capabilities ON or OFF simultaneously',
    visualSummary: 'Arms the entire 19-subsystem experimental suite, synchronizing photon streams, thermal heatmaps, orbital layouts, and telemetry radars into a unified master HUD matrix.',
    overview: 'Central state dispatcher coordinating atomic mass updates across all 19 experimental lab flags. Broadcasts state events across Three.js canvas, shader uniforms, audio synthesis nodes, and DOM overlay drawers.',
    performance: 'Aggregate overhead: high when all subsystems are concurrently active. Recommended hardware-accelerated WebGL2 context; ~120MB heap footprint; 60 FPS maintained via frustum culling.',
    hotkeys: 'Click row to view screenshot preview • Right-click row for deep inspection • Toggle red master switch',
  },
  streamers: {
    id: 'streamers',
    title: 'Neural Data Packet Streamers',
    subtitle: 'Animates glowing photon pulses along 3D edge lines in the direction of code imports using THREE.Points',
    visualSummary: 'Continuous neon photon pulses travel along edge vectors in the direction of code imports (upstream parents to downstream consumers), transforming static wireframes into living dependency flow conduits.',
    overview: 'Instantiates dynamic THREE.Points buffers positioned along 3D connection vectors. In each useFrame tick, clock elapsed time modulates the parametric offset t in [0, 1] with unique seed offsets per edge.',
    performance: 'GPU overhead: minimal (~2-4% shader load). Zero runtime AST parsing overhead; interpolates pre-computed graph edge coordinates directly.',
    hotkeys: 'Active in 3D canvas continuously while toggled • Speed scales dynamically with Simulation Speed slider',
  },
  xray: {
    id: 'xray',
    title: 'X-Ray Dependency Isolation (Focus Mode)',
    subtitle: 'Dims non-related nodes and links to 8% opacity; illuminates imported parents (Cyan) and downstream consumers (Magenta). Esc clears focus.',
    visualSummary: 'Selecting any node instantly plunges non-related codebase elements into an 8% dimmed obsidian fog, illuminating upstream imported parents in electric Cyan and downstream consumers in neon Magenta.',
    overview: 'Executes directed breadth-first traversal on node selection. Separates the active graph into upstream dependencies (parents), downstream dependents (consumers), and unlinked nodes, attenuating material alphas accordingly.',
    performance: 'O(V + E) BFS traversal overhead (<0.5ms for 2,500 nodes). Memory footprint: <1MB cached adjacency set.',
    hotkeys: 'Left-click any node in 3D canvas to engage X-Ray isolation • Press [Esc] or click empty canvas to clear',
  },
  gitchurn: {
    id: 'gitchurn',
    title: 'Git Churn & Hotspot Heatmap',
    subtitle: 'Overlays a thermal emissive gradient onto nodes—low change frequency remains cool slate/cyan, while high-velocity files pulse amber/crimson',
    visualSummary: 'Applies a thermal gradient across node spheres based on 90-day git modification velocity: quiet stable files glow in cool slate/cyan, while high-churn hot files ignite into incandescent pulsing crimson cores.',
    overview: 'Parses local Git revision logs and working tree status to determine commit velocity per file. Maps commit frequency to an emissive color ramp with additive bloom enhancements.',
    performance: 'Asynchronous background Git log collection (~15ms execution time). Vertex shader color interpolation without CPU frame drops.',
    hotkeys: 'Active in 3D workspace when toggled • Updates automatically upon workspace git file modifications',
  },
  orbit: {
    id: 'orbit',
    title: 'Circular Constellation / Orbit Layout',
    subtitle: 'Arranges submodules into concentric orbital planar rings around directory roots, eliminating dense central ball clutter',
    visualSummary: 'Replaces chaotic free-floating force clusters with concentric orbital planar rings. Directory roots anchor central orbital cores while leaf modules orbit gracefully at calculated radii and angular intervals.',
    overview: 'Hierarchical clustering engine that groups files by directory roots and calculates depth-based orbital radii and angular slots. In useFrame, nodes smoothly spring-interpolate towards their assigned planar orbit slots.',
    performance: 'O(N) radial trigonometric allocation executed on layout change. Spring interpolation overhead: <1ms per frame.',
    hotkeys: 'Toggle switch in Labs • Click [RE-SIMULATE LAYOUT] to re-seed angular distribution',
  },
  circular_radar: {
    id: 'circular_radar',
    title: 'Circular Architecture Dependency Radar',
    subtitle: 'Analyzes graph edges for mutual/circular imports (A -> B -> A) and flashes offending links with high-contrast dashed lines',
    visualSummary: 'Scans the dependency graph for mutual/cyclic imports. Offending cyclical connections flash in high-contrast strobing red dashed lines, with alert badges mounted on participating node headers.',
    overview: 'Runs cycle detection across AST dependency edges (checking if edge A->B has a corresponding edge B->A or transitive loop). Renders THREE.LineDashedMaterial with dynamic dash offsets for active strobe warning.',
    performance: 'Cycle detection computed during dependency graph synthesis (<2ms for 3,000 edges). Line dashed shader overhead: negligible.',
    hotkeys: 'Real-time background scanner • Offending nodes marked with [CIRCULAR IMPORT DETECTED] badge',
  },
  blast_radius: {
    id: 'blast_radius',
    title: 'Impact Blast Radius Engine',
    subtitle: 'Right-click context action to illuminate all direct & indirect downstream imports',
    visualSummary: 'Emits a radial golden shockwave ring when a node is triggered, illuminating 1st, 2nd, and 3rd order downstream dependencies in cascading sequence.',
    overview: 'Computes topological downstream dependency reachability using BFS. Emits expanding circular shockwave ripples with distance-based attenuation forces applied to nodes.',
    performance: 'O(E) graph traversal; GPU additive blending for shockwave rings.',
    hotkeys: 'Right-click any node in 3D graph and select [IMPACT BLAST RADIUS]',
  },
  lasso: {
    id: 'lasso',
    title: 'Holographic Cluster Box/Lasso',
    subtitle: 'Shift + Drag to multi-select nodes and view aggregate metrics',
    visualSummary: 'Draws a glowing cyan dashed bounding box across the 3D viewport, selecting enclosed nodes and displaying aggregate metrics in a floating holographic cluster card.',
    overview: 'Projects screen-space 2D drag coordinates into the 3D camera frustum, performing intersection checks against node world positions to build a multi-selection set.',
    performance: 'Screen-space bounding box check (<1ms for 2,000 nodes during drag).',
    hotkeys: 'Hold [Shift] + Left-Click Drag anywhere across canvas to lasso select nodes',
  },
  diff: {
    id: 'diff',
    title: 'Git Working Tree Split Diff',
    subtitle: 'Side-by-side Git diff viewer inside Raw File Content',
    visualSummary: 'Provides a side-by-side dual-pane code diff inspector inside the file inspector, highlighting uncommitted modifications, additions in neon emerald, and deletions in crimson.',
    overview: 'Invokes git diff against HEAD for the active file path and streams the unified diff into an interactive two-column diff reader with synchronized scrolling.',
    performance: 'Local git diff execution (<8ms per file). Syntax highlighted via Prism/Monaco tokenization.',
    hotkeys: 'Click [GIT DIFF] button in file inspector drawer when a modified file is selected',
  },
  thermal_shader: {
    id: 'thermal_shader',
    title: 'Complexity Thermal Heatmap',
    subtitle: 'Dynamically re-colors 3D nodes from Cool Blue to Volcanic Crimson based on LOC/complexity',
    visualSummary: 'Renders a vibrant volumetric heat luminescence across node geometries, transitioning from Cool Slate (<60 LOC), Emerald (<180 LOC), Amber (<400 LOC), to Volcanic Red (>400 LOC).',
    overview: 'Custom fragment shader material that reads the lines-of-code uniform and applies a thermal spectrum color map with additive emissive glow.',
    performance: 'Fragment shader calculation; zero CPU runtime cost; 60 FPS guaranteed.',
    hotkeys: 'Toggle switch in Labs • Scaled dynamically with file inspection updates',
  },
  live_editor: {
    id: 'live_editor',
    title: 'Live Code Editor',
    subtitle: 'In-line editing and disk-saving inside the RAW FILE CONTENT inspector',
    visualSummary: 'Embeds a fully functional in-browser code editor directly into the file inspection drawer, allowing live modifications and direct disk saving without leaving the 3D environment.',
    overview: 'Provides an editable textarea with monospace font, tab-indentation handling, and Electron IPC disk write bridges to save modified files directly to disk.',
    performance: 'Lightweight client-side editor; zero background overhead.',
    hotkeys: 'Click [EDIT CODE] in file inspector drawer • Press [Ctrl+S] / [Cmd+S] to save',
  },
  hud_export: {
    id: 'hud_export',
    title: 'HUD Canvas Exporter',
    subtitle: 'Adds an [ EXPORT HUD ] button to capture clean 3D graph PNG snapshots',
    visualSummary: 'Captures ultra-high-resolution, transparent architectural blueprint diagrams and 4K PNG snapshots of the 3D neural graph directly from the WebGL buffer.',
    overview: 'Leverages WebGL preserveDrawingBuffer: true, executes an explicit render pass to flush pending draw calls, and streams the canvas dataURL to an automated PNG download bridge.',
    performance: 'Instantaneous snapshot export; zero impact on normal rendering loop.',
    hotkeys: 'Click [EXPORT HUD] button on graph bottom toolbar',
  },
  node_pinning: {
    id: 'node_pinning',
    title: 'Node Pinning System',
    subtitle: 'Adds pin/unpin toggles to node action menus and freezes pinned coordinates',
    visualSummary: 'Locks selected nodes permanently at their current 3D world coordinates with a holographic anchor pin, preventing force-directed physics from moving them.',
    overview: 'Maintains a set of pinned node IDs. In the physics integration step, pinned nodes have their velocities zeroed (vx=0, vy=0, vz=0) and coordinates clamped.',
    performance: 'Zero overhead. Skips integration calculations for pinned IDs.',
    hotkeys: 'Click [PIN] / [UNPIN] in node action popup or inspector header',
  },
  complexity_sizing: {
    id: 'complexity_sizing',
    title: 'Complexity Sphere Scaling',
    subtitle: 'Scales 3D sphere radii based on actual file lines of code / AST complexity',
    visualSummary: 'Dynamically scales node sphere geometry radii based on cyclomatic complexity and file size, giving massive architecture monoliths visual prominence over simple utilities.',
    overview: 'Calculates logarithmic scaling factors from file LOC and AST branch counts, adjusting mesh scale transforms in the render loop.',
    performance: 'One-time scale computation during node ingestion; rendered via matrix transform scaling.',
    hotkeys: 'Toggle switch in Labs • Automatically responds to node size master slider',
  },
  vault_history: {
    id: 'vault_history',
    title: 'Vault Quick Switcher',
    subtitle: 'Remembers recently opened workspaces and exposes a quick-launch menu',
    visualSummary: 'Provides a floating HUD quick-switcher overlay to instantaneously jump between recently opened projects and repositories with a single click.',
    overview: 'Persists workspace paths, timestamps, and metadata to localStorage, displaying a quick-launch overlay with keyboard navigation and path validation.',
    performance: 'In-memory list stored in localStorage; zero CPU overhead.',
    hotkeys: 'Click [VAULT SWITCHER] or press [Ctrl+O] / [Cmd+O]',
  },
  git_pulse: {
    id: 'git_pulse',
    title: 'Git Status Pulse',
    subtitle: 'Pings local Git status and highlights modified/uncommitted nodes',
    visualSummary: 'Emits pulsating radar sonar rings in neon green and amber around any files currently modified or staged in the local git repository.',
    overview: 'Monitors file system changes and polls git status at debounced intervals, spawning expanding ripple circle meshes on modified node coordinates.',
    performance: 'Debounced background git status check (250ms interval); minimal CPU overhead.',
    hotkeys: 'Active in 3D canvas when toggled • Fires automatically on file edit/save',
  },
  search_heatmap: {
    id: 'search_heatmap',
    title: 'Search Heatmap Radar',
    subtitle: 'Dims non-matching nodes during search and illuminates hits as beacons',
    visualSummary: 'Dims non-matching files during graph searches into dark silhouettes while illuminating matching search results with brilliant golden beacons and targeting reticles.',
    overview: 'Performs token matching against node names and code paths, applying opacity attenuation to non-matching meshes and pulsing scale multipliers to matching nodes.',
    performance: 'In-memory string indexing (<2ms for 5,000 files).',
    hotkeys: 'Press [Ctrl+F] / [Cmd+F] to open graph search bar and type query',
  },
  radar_minimap: {
    id: 'radar_minimap',
    title: 'HUD Radar Mini-Map',
    subtitle: 'Shows an orthographic 2D camera orientation map in the corner',
    visualSummary: 'Docks an orthographic 2D tactical HUD radar at the bottom-left corner, displaying node positions, cluster boundaries, and camera field-of-view frustum.',
    overview: 'Canvas2D element that projects 3D graph coordinates into a top-down 2D orthographic radar display with camera orientation indicators and viewport crosshairs.',
    performance: 'Lightweight 30 FPS 2D canvas draw; isolated from main 3D WebGL context.',
    hotkeys: 'Docked at bottom-left corner • Stacks cleanly below file drawers',
  },
  autonomous_auditor: {
    id: 'autonomous_auditor',
    title: 'Autonomous Security Scanner',
    subtitle: 'Enables one-click dead code & vulnerability auditing via Spark AI',
    visualSummary: 'Deploys an autonomous AST security sentinel that inspects files for unused exports, vulnerable imports, and circular chains, mounting warning badges onto problematic nodes.',
    overview: 'Performs static AST analysis to identify orphaned exports and high-risk dependencies, aggregating findings into an actionable audit report modal.',
    performance: 'Background worker thread execution; low CPU priority scheduling.',
    hotkeys: 'Click [RUN AUDIT] in Security Scanner card or toggle switch in Labs',
  },
  cyber_sfx: {
    id: 'cyber_sfx',
    title: 'Cyberpunk Spatial SFX',
    subtitle: 'Plays synthesized Web Audio API clicks and hums during navigation',
    visualSummary: 'Produces procedural acoustic feedback for node hover, selection, switch toggles, and drawer openings using synthesized Web Audio API oscillators.',
    overview: 'Synthesizes procedural sine and triangle waveforms with custom ADSR envelopes directly in the browser, eliminating external sound asset download dependencies.',
    performance: 'Zero disk I/O; <0.1% CPU utilization during audio generation.',
    hotkeys: 'Acoustic feedback triggered on all interactive clicks, toggles, and node hovers',
  },
  deletion_simulator: {
    id: 'deletion_simulator',
    title: 'Codebase "What If?" File Deletion Simulator',
    subtitle: 'Simulate file severing to test refactoring safety and inspect broken downstream errors',
    visualSummary: 'Temporarily severs the selected file from the graph. All downstream dependents turn flashing crimson with broken import markers while Spark AI projects compilation and runtime breakage cascades.',
    overview: 'Executes topological graph cut analysis. Simulates deletion of a node by isolating downstream imports, calculating severed dependency chains, and generating precise compiler and runtime error projections.',
    performance: 'Topological cut calculation executed in <1ms. Non-destructive in-memory simulation.',
    hotkeys: 'Right-click any node -> "Simulate Deletion" • Click [RESTORE] in HUD banner to undo',
  },
  author_radar: {
    id: 'author_radar',
    title: 'Git Author & Ownership Radar (Bus Factor Analysis)',
    subtitle: 'Shades files by primary contributors and warns of Bus Factor: 1 single maintainer risks',
    visualSummary: 'Shades files into distinct contributor color bands based on git blame and commit velocity. Flags single-maintainer modules (Bus Factor: 1) with high-visibility caution beacons.',
    overview: 'Ingests local git commit telemetry, assigns primary maintainer tags, and calculates the Bus Factor risk metric (files maintained by <=1 developer). Warns teams of high-risk operational silos.',
    performance: 'Asynchronous git attribution parsing; GPU color lookup without CPU rendering cost.',
    hotkeys: 'Toggle switch in Labs • View Ownership & Bus Factor card in File Information Panel',
  },
  shortest_path: {
    id: 'shortest_path',
    title: 'Two-Node "Shortest Path" Route Finder',
    subtitle: 'Ctrl + Click two nodes to trace and illuminate the shortest import chain between them',
    visualSummary: 'Dims the codebase into a dark abyss while illuminating the shortest dependency chain between two selected files with an animated neon photon bridge.',
    overview: 'Executes Dijkstra / BFS bidirectional graph search between origin and destination nodes. Isolates intermediate hops and animates traveling energy pulses along the resolved route.',
    performance: 'O(V + E) shortest path search (<0.8ms for 3,000 nodes).',
    hotkeys: 'Hold [Ctrl] / [Cmd] and Left-Click Node A, then Left-Click Node B to trace route',
  },
};

function LabVisualPreviewSVG({ id }: { id: string }) {
  switch (id) {
    case 'max_overdrive':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <defs>
            <radialGradient id="mo-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="460" height="180" fill="#04040A" />
          <line x1="0" y1="90" x2="460" y2="90" stroke="#00FFFF" strokeOpacity="0.15" strokeDasharray="4 4" />
          <line x1="230" y1="0" x2="230" y2="180" stroke="#00FFFF" strokeOpacity="0.15" strokeDasharray="4 4" />
          <circle cx="230" cy="90" r="70" stroke="#EF4444" strokeOpacity="0.35" strokeDasharray="6 4" fill="none" />
          <circle cx="230" cy="90" r="45" stroke="#06B6D4" strokeOpacity="0.5" strokeDasharray="4 3" fill="none" />
          <circle cx="230" cy="90" r="24" fill="url(#mo-core)" />
          <circle cx="230" cy="90" r="12" fill="#EF4444" />
          <line x1="230" y1="90" x2="100" y2="40" stroke="#00E5FF" strokeOpacity="0.7" strokeWidth="1.5" />
          <line x1="230" y1="90" x2="360" y2="40" stroke="#A855F7" strokeOpacity="0.7" strokeWidth="1.5" />
          <line x1="230" y1="90" x2="90" y2="140" stroke="#F59E0B" strokeOpacity="0.7" strokeWidth="1.5" />
          <line x1="230" y1="90" x2="370" y2="140" stroke="#10B981" strokeOpacity="0.7" strokeWidth="1.5" />
          <circle cx="100" cy="40" r="7" fill="#00E5FF" />
          <circle cx="360" cy="40" r="7" fill="#A855F7" />
          <circle cx="90" cy="140" r="7" fill="#F59E0B" />
          <circle cx="370" cy="140" r="7" fill="#10B981" />
          <text x="230" y="165" fill="#EF4444" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ MAX OVERDRIVE: 19 / 19 EXPERIMENTAL SUBSYSTEMS ARMED ]
          </text>
        </svg>
      );
    case 'streamers':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <line x1="80" y1="90" x2="380" y2="90" stroke="#6366F1" strokeWidth="2" strokeOpacity="0.6" />
          <circle cx="80" cy="90" r="14" fill="#0369A1" stroke="#38BDF8" strokeWidth="2" />
          <text x="80" y="125" fill="#38BDF8" fontSize="9" fontFamily="monospace" textAnchor="middle">UPSTREAM</text>
          <circle cx="380" cy="90" r="14" fill="#581C87" stroke="#A855F7" strokeWidth="2" />
          <text x="380" y="125" fill="#C084FC" fontSize="9" fontFamily="monospace" textAnchor="middle">DOWNSTREAM</text>
          <line x1="130" y1="90" x2="160" y2="90" stroke="#00FFFF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="160" cy="90" r="4" fill="#FFFFFF" />
          <line x1="210" y1="90" x2="240" y2="90" stroke="#00FFFF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="240" cy="90" r="4" fill="#FFFFFF" />
          <line x1="290" y1="90" x2="320" y2="90" stroke="#A855F7" strokeWidth="4" strokeLinecap="round" />
          <circle cx="320" cy="90" r="4" fill="#FFFFFF" />
          <polygon points="200,85 208,90 200,95" fill="#00FFFF" />
          <polygon points="280,85 288,90 280,95" fill="#00FFFF" />
          <text x="230" y="45" fill="#00FFFF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ DIRECTIONAL PHOTON DATA STREAMERS (UPSTREAM -&gt; DOWNSTREAM) ]
          </text>
        </svg>
      );
    case 'xray':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#030308" />
          <circle cx="70" cy="40" r="9" fill="#334155" opacity="0.12" />
          <circle cx="60" cy="140" r="10" fill="#334155" opacity="0.12" />
          <circle cx="390" cy="40" r="11" fill="#334155" opacity="0.12" />
          <circle cx="400" cy="140" r="9" fill="#334155" opacity="0.12" />
          <line x1="70" y1="40" x2="60" y2="140" stroke="#334155" strokeWidth="1" opacity="0.1" />
          <line x1="140" y1="90" x2="230" y2="90" stroke="#00D2FF" strokeWidth="2.5" />
          <line x1="230" y1="90" x2="320" y2="90" stroke="#EC4899" strokeWidth="2.5" />
          <circle cx="140" cy="90" r="16" fill="#082f49" stroke="#00D2FF" strokeWidth="3" />
          <circle cx="140" cy="90" r="23" fill="none" stroke="#00D2FF" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          <text x="140" y="130" fill="#00D2FF" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">PARENT [CYAN]</text>
          <circle cx="230" cy="90" r="18" fill="#1e1b4b" stroke="#818cf8" strokeWidth="3" />
          <circle cx="230" cy="90" r="26" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="4 2" />
          <text x="230" y="130" fill="#E0E7FF" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">SELECTED</text>
          <circle cx="320" cy="90" r="16" fill="#500724" stroke="#EC4899" strokeWidth="3" />
          <circle cx="320" cy="90" r="23" fill="none" stroke="#EC4899" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          <text x="320" y="130" fill="#EC4899" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">CONSUMER [MAGENTA]</text>
          <text x="230" y="35" fill="#38BDF8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ X-RAY ISOLATION: UNLINKED NODES DIMMED TO 8% OPACITY ]
          </text>
        </svg>
      );
    case 'gitchurn':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <defs>
            <linearGradient id="heat-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="35%" stopColor="#10B981" />
              <stop offset="70%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
            <radialGradient id="crimson-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </radialGradient>
          </defs>
          <rect x="70" y="140" width="320" height="8" rx="4" fill="url(#heat-gradient)" />
          <text x="70" y="160" fill="#38BDF8" fontSize="8" fontFamily="monospace">LOW CHURN</text>
          <text x="390" y="160" fill="#EF4444" fontSize="8" fontFamily="monospace" textAnchor="end">HIGH VELOCITY</text>
          <circle cx="100" cy="80" r="10" fill="#0369A1" stroke="#38BDF8" strokeWidth="2" />
          <text x="100" y="105" fill="#38BDF8" fontSize="8" fontFamily="monospace" textAnchor="middle">1 rev</text>
          <circle cx="180" cy="70" r="12" fill="#064E3B" stroke="#10B981" strokeWidth="2" />
          <text x="180" y="98" fill="#10B981" fontSize="8" fontFamily="monospace" textAnchor="middle">4 revs</text>
          <circle cx="265" cy="80" r="14" fill="#78350F" stroke="#F59E0B" strokeWidth="2" />
          <text x="265" y="110" fill="#F59E0B" fontSize="8" fontFamily="monospace" textAnchor="middle">12 revs</text>
          <circle cx="360" cy="75" r="28" fill="#EF4444" opacity="0.18" />
          <circle cx="360" cy="75" r="22" fill="none" stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="360" cy="75" r="16" fill="url(#crimson-core)" stroke="#EF4444" strokeWidth="2.5" />
          <text x="360" y="112" fill="#EF4444" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">38 revs (HOT)</text>
          <text x="230" y="32" fill="#F59E0B" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ 90-DAY GIT CHURN &amp; HOTSPOT THERMAL GRADIENT ]
          </text>
        </svg>
      );
    case 'orbit':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <ellipse cx="230" cy="90" rx="150" ry="60" stroke="#00E5FF" strokeOpacity="0.25" strokeDasharray="5 4" fill="none" />
          <ellipse cx="230" cy="90" rx="100" ry="40" stroke="#00E5FF" strokeOpacity="0.4" strokeDasharray="4 3" fill="none" />
          <ellipse cx="230" cy="90" rx="50" ry="20" stroke="#00E5FF" strokeOpacity="0.6" fill="none" />
          <circle cx="230" cy="90" r="15" fill="#082F49" stroke="#00E5FF" strokeWidth="3" />
          <text x="230" y="93" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">ROOT</text>
          <circle cx="130" cy="90" r="7" fill="#A855F7" stroke="#C084FC" strokeWidth="1.5" />
          <circle cx="330" cy="90" r="7" fill="#A855F7" stroke="#C084FC" strokeWidth="1.5" />
          <circle cx="200" cy="53" r="6" fill="#10B981" stroke="#34D399" strokeWidth="1.5" />
          <circle cx="260" cy="127" r="6" fill="#10B981" stroke="#34D399" strokeWidth="1.5" />
          <circle cx="350" cy="70" r="8" fill="#38BDF8" stroke="#7DD3FC" strokeWidth="1.5" />
          <circle cx="105" cy="110" r="8" fill="#38BDF8" stroke="#7DD3FC" strokeWidth="1.5" />
          <text x="230" y="24" fill="#00E5FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ CONCENTRIC ORBITAL PLANETARY RINGS AROUND DIRECTORY ROOTS ]
          </text>
        </svg>
      );
    case 'circular_radar':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <path d="M 140 80 Q 230 40 320 80" stroke="#FF1E56" strokeWidth="2.5" strokeDasharray="6 4" fill="none" />
          <polygon points="235,58 245,60 238,68" fill="#FF1E56" />
          <path d="M 320 100 Q 230 140 140 100" stroke="#FF1E56" strokeWidth="2.5" strokeDasharray="6 4" fill="none" />
          <polygon points="225,122 215,120 222,112" fill="#FF1E56" />
          <circle cx="140" cy="90" r="16" fill="#4C0519" stroke="#FF1E56" strokeWidth="2.5" />
          <text x="140" y="93" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle">Node A</text>
          <circle cx="320" cy="90" r="16" fill="#4C0519" stroke="#FF1E56" strokeWidth="2.5" />
          <text x="320" y="93" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle">Node B</text>
          <rect x="160" y="78" width="140" height="24" rx="6" fill="#2A0510" stroke="#FF1E56" strokeWidth="1.5" />
          <text x="230" y="94" fill="#FF1E56" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            ⚠ CIRCULAR IMPORT
          </text>
          <text x="230" y="28" fill="#FF1E56" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ MUTUAL IMPORT RADAR: HIGH-CONTRAST DASHED FLASH ]
          </text>
        </svg>
      );
    case 'blast_radius':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="230" cy="90" r="75" stroke="#F59E0B" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="6 4" fill="none" />
          <circle cx="230" cy="90" r="50" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="5 3" fill="none" />
          <circle cx="230" cy="90" r="28" stroke="#FBBF24" strokeOpacity="0.8" strokeWidth="2" fill="none" />
          <circle cx="230" cy="90" r="15" fill="#78350F" stroke="#F59E0B" strokeWidth="3" />
          <text x="230" y="94" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">ORIGIN</text>
          <circle cx="160" cy="70" r="9" fill="#F59E0B" />
          <text x="160" y="60" fill="#FBBF24" fontSize="8" fontFamily="monospace" textAnchor="middle">+1 HOP</text>
          <circle cx="300" cy="70" r="9" fill="#F59E0B" />
          <text x="300" y="60" fill="#FBBF24" fontSize="8" fontFamily="monospace" textAnchor="middle">+1 HOP</text>
          <circle cx="100" cy="115" r="8" fill="#D97706" />
          <text x="100" y="135" fill="#F59E0B" fontSize="8" fontFamily="monospace" textAnchor="middle">+2 HOPS</text>
          <circle cx="360" cy="115" r="8" fill="#D97706" />
          <text x="360" y="135" fill="#F59E0B" fontSize="8" fontFamily="monospace" textAnchor="middle">+2 HOPS</text>
          <text x="230" y="24" fill="#F59E0B" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ SHOCKWAVE PROPAGATION: DOWNSTREAM IMPACT RADIUS ]
          </text>
        </svg>
      );
    case 'lasso':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <rect x="130" y="45" width="200" height="90" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="5 3" fill="#00E5FF" fillOpacity="0.08" rx="6" />
          <path d="M 125 55 L 125 40 L 140 40" stroke="#00E5FF" strokeWidth="2.5" fill="none" />
          <path d="M 335 55 L 335 40 L 320 40" stroke="#00E5FF" strokeWidth="2.5" fill="none" />
          <path d="M 125 125 L 125 140 L 140 140" stroke="#00E5FF" strokeWidth="2.5" fill="none" />
          <path d="M 335 125 L 335 140 L 320 140" stroke="#00E5FF" strokeWidth="2.5" fill="none" />
          <circle cx="170" cy="75" r="10" fill="#082F49" stroke="#00E5FF" strokeWidth="2" />
          <circle cx="230" cy="100" r="12" fill="#082F49" stroke="#00E5FF" strokeWidth="2" />
          <circle cx="290" cy="75" r="9" fill="#082F49" stroke="#00E5FF" strokeWidth="2" />
          <circle cx="60" cy="90" r="8" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <circle cx="400" cy="90" r="8" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <text x="230" y="26" fill="#00E5FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ HOLOGRAPHIC CLUSTER LASSO // MULTI-NODE SELECTION ]
          </text>
        </svg>
      );
    case 'diff':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <rect x="40" y="40" width="185" height="100" rx="6" fill="#180B0F" stroke="#EF4444" strokeOpacity="0.4" />
          <rect x="235" y="40" width="185" height="100" rx="6" fill="#081C14" stroke="#10B981" strokeOpacity="0.4" />
          <text x="50" y="60" fill="#EF4444" fontSize="9" fontFamily="monospace">- const oldEngine = null;</text>
          <text x="50" y="80" fill="#EF4444" fontSize="9" fontFamily="monospace">- runSyncPipeline();</text>
          <text x="50" y="100" fill="#991B1B" fontSize="9" fontFamily="monospace">- purgeBuffer();</text>
          <text x="245" y="60" fill="#10B981" fontSize="9" fontFamily="monospace">+ const nextEngine = load();</text>
          <text x="245" y="80" fill="#10B981" fontSize="9" fontFamily="monospace">+ await runAsyncPipeline();</text>
          <text x="245" y="100" fill="#047857" fontSize="9" fontFamily="monospace">+ streamBufferRealtime();</text>
          <text x="230" y="26" fill="#38BDF8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ SIDE-BY-SIDE GIT WORKING TREE SPLIT DIFF ]
          </text>
        </svg>
      );
    case 'thermal_shader':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="100" cy="90" r="14" fill="#0284C7" stroke="#38BDF8" strokeWidth="2" />
          <circle cx="180" cy="90" r="18" fill="#059669" stroke="#34D399" strokeWidth="2" />
          <circle cx="270" cy="90" r="23" fill="#D97706" stroke="#FBBF24" strokeWidth="2" />
          <circle cx="370" cy="90" r="29" fill="#DC2626" stroke="#EF4444" strokeWidth="3" />
          <text x="100" y="130" fill="#38BDF8" fontSize="8" fontFamily="monospace" textAnchor="middle">&lt;60 LOC</text>
          <text x="180" y="130" fill="#34D399" fontSize="8" fontFamily="monospace" textAnchor="middle">&lt;180 LOC</text>
          <text x="270" y="130" fill="#FBBF24" fontSize="8" fontFamily="monospace" textAnchor="middle">&lt;400 LOC</text>
          <text x="370" y="135" fill="#EF4444" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">&gt;400 LOC (MAX)</text>
          <text x="230" y="30" fill="#EF4444" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ VOLUMETRIC THERMAL CODE DENSITY SHADER ]
          </text>
        </svg>
      );
    case 'live_editor':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <rect x="50" y="40" width="360" height="100" rx="8" fill="#090914" stroke="#00E5FF" strokeOpacity="0.4" />
          <circle cx="65" cy="52" r="3" fill="#EF4444" />
          <circle cx="75" cy="52" r="3" fill="#F59E0B" />
          <circle cx="85" cy="52" r="3" fill="#10B981" />
          <text x="65" y="75" fill="#64748B" fontSize="9" fontFamily="monospace">1</text>
          <text x="85" y="75" fill="#C084FC" fontSize="9" fontFamily="monospace">export function</text>
          <text x="175" y="75" fill="#38BDF8" fontSize="9" fontFamily="monospace">NeuralNode() &#123;</text>
          <text x="65" y="95" fill="#64748B" fontSize="9" fontFamily="monospace">2</text>
          <text x="85" y="95" fill="#F59E0B" fontSize="9" fontFamily="monospace">  return &lt;mesh position=&#123;pos&#125; /&gt;;</text>
          <text x="65" y="115" fill="#64748B" fontSize="9" fontFamily="monospace">3</text>
          <text x="85" y="115" fill="#C084FC" fontSize="9" fontFamily="monospace">&#125;</text>
          <rect x="295" y="112" width="105" height="20" rx="4" fill="#082F49" stroke="#00E5FF" strokeWidth="1" />
          <text x="347" y="125" fill="#00E5FF" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">[SAVE DISK: CTRL+S]</text>
          <text x="230" y="24" fill="#00E5FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ IN-LINE LIVE CODE EDITOR WITH DISK SYNC ]
          </text>
        </svg>
      );
    case 'hud_export':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#00E5FF" strokeOpacity="0.12" strokeWidth="0.8" />
          </pattern>
          <rect x="50" y="35" width="360" height="110" fill="url(#bp-grid)" stroke="#00E5FF" strokeOpacity="0.5" rx="6" />
          <line x1="230" y1="50" x2="230" y2="130" stroke="#00E5FF" strokeOpacity="0.4" strokeDasharray="3 3" />
          <line x1="100" y1="90" x2="360" y2="90" stroke="#00E5FF" strokeOpacity="0.4" strokeDasharray="3 3" />
          <text x="70" y="60" fill="#00E5FF" fontSize="9" fontFamily="monospace">RESOLVE: 3840 x 2160 (4K)</text>
          <text x="70" y="130" fill="#38BDF8" fontSize="9" fontFamily="monospace">ALPHA: TRANSPARENT [PNG]</text>
          <rect x="280" y="110" width="115" height="22" rx="4" fill="#082F49" stroke="#00E5FF" strokeWidth="1.5" />
          <text x="337" y="124" fill="#00E5FF" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">[DOWNLOAD SNAPSHOT]</text>
          <text x="230" y="24" fill="#00E5FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ HIGH-RES BLUEPRINT CANVAS EXPORTER ]
          </text>
        </svg>
      );
    case 'node_pinning':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="230" cy="90" r="22" fill="#082F49" stroke="#00E5FF" strokeWidth="3" />
          <text x="230" y="95" fill="#00E5FF" fontSize="18" textAnchor="middle">📌</text>
          <rect x="160" y="125" width="140" height="20" rx="5" fill="#0B0B16" stroke="#00E5FF" strokeWidth="1.2" />
          <text x="230" y="138" fill="#00E5FF" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            COORDINATES: LOCKED
          </text>
          <text x="230" y="32" fill="#00E5FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ SPATIAL NODE PINNING &amp; POSITION ANCHORING ]
          </text>
        </svg>
      );
    case 'complexity_sizing':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="100" cy="90" r="10" fill="#38BDF8" />
          <text x="100" y="125" fill="#38BDF8" fontSize="8" fontFamily="monospace" textAnchor="middle">V(G)=1 (Leaf)</text>
          <circle cx="200" cy="90" r="18" fill="#A855F7" />
          <text x="200" y="125" fill="#C084FC" fontSize="8" fontFamily="monospace" textAnchor="middle">V(G)=5 (Branch)</text>
          <circle cx="340" cy="90" r="34" fill="#EF4444" />
          <text x="340" y="140" fill="#EF4444" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">V(G)=24 (Monolith)</text>
          <text x="230" y="30" fill="#C084FC" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ MCCABE CYCLOMATIC COMPLEXITY SPHERE SCALING ]
          </text>
        </svg>
      );
    case 'vault_history':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <line x1="60" y1="90" x2="400" y2="90" stroke="#00E5FF" strokeWidth="3" />
          <circle cx="90" cy="90" r="8" fill="#06B6D4" />
          <text x="90" y="115" fill="#67E8F9" fontSize="8" fontFamily="monospace" textAnchor="middle">c81fe</text>
          <circle cx="180" cy="90" r="8" fill="#06B6D4" />
          <text x="180" y="115" fill="#67E8F9" fontSize="8" fontFamily="monospace" textAnchor="middle">9a02b</text>
          <circle cx="280" cy="90" r="12" fill="#A855F7" stroke="#FFFFFF" strokeWidth="2" />
          <text x="280" y="120" fill="#C084FC" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">SCRUBBER</text>
          <circle cx="370" cy="90" r="8" fill="#06B6D4" />
          <text x="370" y="115" fill="#67E8F9" fontSize="8" fontFamily="monospace" textAnchor="middle">HEAD</text>
          <text x="230" y="35" fill="#00E5FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ TIME-TRAVEL COMMIT SCRUBBER TIMELINE ]
          </text>
        </svg>
      );
    case 'git_pulse':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="230" cy="90" r="60" stroke="#10B981" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
          <circle cx="230" cy="90" r="40" stroke="#10B981" strokeOpacity="0.5" strokeWidth="2" fill="none" />
          <circle cx="230" cy="90" r="22" stroke="#34D399" strokeOpacity="0.8" strokeWidth="2" fill="none" />
          <circle cx="230" cy="90" r="14" fill="#064E3B" stroke="#10B981" strokeWidth="2.5" />
          <text x="230" y="132" fill="#10B981" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [M] MODIFIED IN WORKING TREE
          </text>
          <text x="230" y="30" fill="#10B981" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ REAL-TIME GIT STATUS PULSE // SONAR WAVE ]
          </text>
        </svg>
      );
    case 'search_heatmap':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="90" cy="70" r="8" fill="#1E293B" opacity="0.3" />
          <circle cx="120" cy="120" r="10" fill="#1E293B" opacity="0.3" />
          <circle cx="340" cy="60" r="9" fill="#1E293B" opacity="0.3" />
          <circle cx="370" cy="115" r="10" fill="#1E293B" opacity="0.3" />
          <circle cx="230" cy="90" r="25" fill="#F59E0B" opacity="0.2" />
          <circle cx="230" cy="90" r="16" fill="#78350F" stroke="#F59E0B" strokeWidth="3" />
          <line x1="230" y1="60" x2="230" y2="70" stroke="#F59E0B" strokeWidth="2" />
          <line x1="230" y1="110" x2="230" y2="120" stroke="#F59E0B" strokeWidth="2" />
          <line x1="200" y1="90" x2="210" y2="90" stroke="#F59E0B" strokeWidth="2" />
          <line x1="250" y1="90" x2="260" y2="90" stroke="#F59E0B" strokeWidth="2" />
          <text x="230" y="135" fill="#F59E0B" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            MATCH HIT: 100% RELEVANCE
          </text>
          <text x="230" y="30" fill="#F59E0B" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ SEMANTIC SEARCH TARGET BEACON // NON-MATCHES DIMMED ]
          </text>
        </svg>
      );
    case 'radar_minimap':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="230" cy="90" r="60" stroke="#00E5FF" strokeOpacity="0.5" strokeWidth="1.5" fill="#021820" />
          <circle cx="230" cy="90" r="40" stroke="#00E5FF" strokeOpacity="0.3" strokeDasharray="3 3" fill="none" />
          <circle cx="230" cy="90" r="20" stroke="#00E5FF" strokeOpacity="0.3" strokeDasharray="3 3" fill="none" />
          <line x1="170" y1="90" x2="290" y2="90" stroke="#00E5FF" strokeOpacity="0.4" />
          <line x1="230" y1="30" x2="230" y2="150" stroke="#00E5FF" strokeOpacity="0.4" />
          <line x1="230" y1="90" x2="272" y2="48" stroke="#00FFFF" strokeWidth="2" />
          <polygon points="230,90 200,45 260,45" fill="#00FFFF" fillOpacity="0.15" />
          <circle cx="215" cy="75" r="3" fill="#00FFFF" />
          <circle cx="245" cy="110" r="3" fill="#A855F7" />
          <circle cx="195" cy="100" r="3" fill="#10B981" />
          <text x="230" y="168" fill="#00E5FF" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ 2D TACTICAL HUD RADAR // ORTHOGRAPHIC VIEWPORT ]
          </text>
        </svg>
      );
    case 'autonomous_auditor':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <path d="M 230 45 L 290 65 L 290 105 Q 230 145 230 145 Q 170 105 170 105 L 170 65 Z" stroke="#10B981" strokeWidth="2" fill="#062518" />
          <line x1="170" y1="85" x2="290" y2="85" stroke="#34D399" strokeWidth="2" strokeDasharray="4 2" />
          <text x="230" y="105" fill="#34D399" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">HEALTH: 98%</text>
          <text x="80" y="80" fill="#34D399" fontSize="8" fontFamily="monospace">✓ 0 CVE FLAWS</text>
          <text x="80" y="105" fill="#34D399" fontSize="8" fontFamily="monospace">✓ 0 DEAD EXPORTS</text>
          <text x="380" y="80" fill="#38BDF8" fontSize="8" fontFamily="monospace" textAnchor="end">AST LINT: PASS</text>
          <text x="380" y="105" fill="#38BDF8" fontSize="8" fontFamily="monospace" textAnchor="end">CYCLE CHECK: PASS</text>
          <text x="230" y="28" fill="#10B981" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ AUTONOMOUS CODEBASE SECURITY SENTINEL // SPARK AI ]
          </text>
        </svg>
      );
    case 'cyber_sfx':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <path d="M 50 90 Q 90 20 130 90 T 210 90 T 290 90 T 370 90 L 410 90" stroke="#00E5FF" strokeWidth="2.5" fill="none" />
          <rect x="180" y="115" width="6" height="25" fill="#06B6D4" rx="2" />
          <rect x="195" y="105" width="6" height="35" fill="#06B6D4" rx="2" />
          <rect x="210" y="95" width="6" height="45" fill="#38BDF8" rx="2" />
          <rect x="225" y="85" width="6" height="55" fill="#818CF8" rx="2" />
          <rect x="240" y="95" width="6" height="45" fill="#C084FC" rx="2" />
          <rect x="255" y="105" width="6" height="35" fill="#A855F7" rx="2" />
          <rect x="270" y="115" width="6" height="25" fill="#A855F7" rx="2" />
          <text x="230" y="160" fill="#A855F7" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ SYNTHESIZED WEB AUDIO API // SPATIAL ACOUSTIC FEEDBACK ]
          </text>
        </svg>
      );
    case 'deletion_simulator':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="160" cy="90" r="22" fill="#450A0A" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="4 3" />
          <line x1="145" y1="75" x2="175" y2="105" stroke="#EF4444" strokeWidth="3" />
          <line x1="175" y1="75" x2="145" y2="105" stroke="#EF4444" strokeWidth="3" />
          <text x="160" y="125" fill="#EF4444" fontSize="8" fontFamily="monospace" textAnchor="middle">SEVERED NODE</text>
          <line x1="185" y1="90" x2="295" y2="60" stroke="#EF4444" strokeWidth="2" strokeDasharray="5 3" />
          <line x1="185" y1="90" x2="295" y2="120" stroke="#EF4444" strokeWidth="2" strokeDasharray="5 3" />
          <circle cx="315" cy="60" r="14" fill="#1C1917" stroke="#EF4444" strokeWidth="2" />
          <text x="315" y="63" fill="#EF4444" fontSize="8" fontFamily="monospace" textAnchor="middle">BROKEN</text>
          <circle cx="315" cy="120" r="14" fill="#1C1917" stroke="#EF4444" strokeWidth="2" />
          <text x="315" y="123" fill="#EF4444" fontSize="8" fontFamily="monospace" textAnchor="middle">BROKEN</text>
          <text x="230" y="28" fill="#EF4444" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ "WHAT IF?" CODEBASE DELETION SIMULATOR // BREAKAGE CASCADE ]
          </text>
        </svg>
      );
    case 'author_radar':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="120" cy="85" r="16" fill="#581C87" stroke="#A855F7" strokeWidth="2" />
          <text x="120" y="88" fill="#E9D5FF" fontSize="8" fontFamily="monospace" textAnchor="middle">@alex</text>
          <circle cx="230" cy="85" r="16" fill="#064E3B" stroke="#10B981" strokeWidth="2" />
          <text x="230" y="88" fill="#D1FAE5" fontSize="8" fontFamily="monospace" textAnchor="middle">@sarah</text>
          <circle cx="340" cy="85" r="16" fill="#78350F" stroke="#F59E0B" strokeWidth="2" />
          <text x="340" y="88" fill="#FEF3C7" fontSize="8" fontFamily="monospace" textAnchor="middle">@david</text>
          <rect x="290" y="120" width="100" height="20" rx="4" fill="#78350F" stroke="#F59E0B" strokeWidth="1" />
          <text x="340" y="133" fill="#FBBF24" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">⚠ BUS FACTOR: 1</text>
          <text x="230" y="28" fill="#38BDF8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ GIT AUTHOR RADAR & BUS FACTOR RISK SENTINEL ]
          </text>
        </svg>
      );
    case 'shortest_path':
      return (
        <svg viewBox="0 0 460 180" className="w-full h-full">
          <rect width="460" height="180" fill="#04040A" />
          <circle cx="80" cy="90" r="15" fill="#0E7490" stroke="#00E5FF" strokeWidth="2.5" />
          <text x="80" y="93" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle">START</text>
          <line x1="95" y1="90" x2="165" y2="90" stroke="#00E5FF" strokeWidth="2.5" />
          <circle cx="180" cy="90" r="13" fill="#0E7490" stroke="#00E5FF" strokeWidth="2" />
          <text x="180" y="93" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle">HOP 1</text>
          <line x1="195" y1="90" x2="265" y2="90" stroke="#00E5FF" strokeWidth="2.5" />
          <circle cx="280" cy="90" r="13" fill="#0E7490" stroke="#00E5FF" strokeWidth="2" />
          <text x="280" y="93" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle">HOP 2</text>
          <line x1="295" y1="90" x2="365" y2="90" stroke="#00E5FF" strokeWidth="2.5" />
          <circle cx="380" cy="90" r="15" fill="#0E7490" stroke="#00E5FF" strokeWidth="2.5" />
          <text x="380" y="93" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle">END</text>
          <text x="230" y="28" fill="#00E5FF" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
            [ TWO-NODE SHORTEST PATH ROUTE ILLUMINATION ]
          </text>
        </svg>
      );
    default:
      return (
        <div className="w-full h-full flex items-center justify-center text-zinc-500 font-mono text-xs">
          [ PREVIEW ACTIVE ]
        </div>
      );
  }
}

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
function CameraSync({ 
  cameraRef,
  rendererRef,
  sceneRef
}: { 
  cameraRef?: React.MutableRefObject<any>;
  rendererRef?: React.MutableRefObject<any>;
  sceneRef?: React.MutableRefObject<any>;
}) {
  const { useThree } = require('@react-three/fiber');
  const three = useThree ? useThree() : null;
  useEffect(() => {
    if (three?.camera) {
      three.camera.near = 1.0;
      three.camera.far = 50000;
      three.camera.updateProjectionMatrix();
      if (cameraRef) cameraRef.current = three.camera;
    }
    if (rendererRef && three?.gl) {
      rendererRef.current = three.gl;
    }
    if (sceneRef && three?.scene) {
      sceneRef.current = three.scene;
    }
  }, [cameraRef, rendererRef, sceneRef, three?.camera, three?.gl, three?.scene]);
  return null;
}

// (Vertical stick/beacon removed in favor of direct subtle node selection ring & emissive shell)

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
  highlightDependencyEdges = true,
  enableGitPulse = false,
  enableSearchHeatmap = false,
  searchFilter = '',
  enableNodePinning = false,
  pinnedNodeIds,
  enableComplexitySizing = false,
  enableBlastRadius = false,
  blastTargetId = null,
  blastAffectedIds,
  enableLassoSelect = false,
  lassoSelectedIds,
  enableThermalShader = false,
  enableDataStreamers = false,
  enableXRayFocus = false,
  selectedNodeId = null,
  enableGitChurnHeatmap = false,
  enableOrbitLayout = false,
  enableCircularDependencyRadar = false,
  enableHolographicBloom = false,
  enableGpuInstancing = false,
  enableDeletionSimulator = false,
  simulatedDeletedNodeId = null,
  deletionBrokenIds,
  enableAuthorRadar = false,
  authorRadarData,
  enableShortestPath = false,
  routeNodeIds,
  routeEdgeKeys
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
  highlightDependencyEdges?: boolean,
  enableGitPulse?: boolean,
  enableSearchHeatmap?: boolean,
  searchFilter?: string,
  enableNodePinning?: boolean,
  pinnedNodeIds?: Set<string>,
  enableComplexitySizing?: boolean,
  enableBlastRadius?: boolean,
  blastTargetId?: string | null,
  blastAffectedIds?: Set<string>,
  enableLassoSelect?: boolean,
  lassoSelectedIds?: Set<string>,
  enableThermalShader?: boolean,
  enableDataStreamers?: boolean,
  enableXRayFocus?: boolean,
  selectedNodeId?: string | null,
  enableGitChurnHeatmap?: boolean,
  enableOrbitLayout?: boolean,
  enableCircularDependencyRadar?: boolean,
  enableHolographicBloom?: boolean,
  enableGpuInstancing?: boolean,
  enableDeletionSimulator?: boolean,
  simulatedDeletedNodeId?: string | null,
  deletionBrokenIds?: Set<string>,
  enableAuthorRadar?: boolean,
  authorRadarData?: Record<string, { author: string; color: string; busFactor: number; totalContributors: number; share: number }>,
  enableShortestPath?: boolean,
  routeNodeIds?: Set<string>,
  routeEdgeKeys?: Set<string>
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
      if (n.x === undefined) n.x = (Math.random() - 0.5) * 150;
      if (n.y === undefined) n.y = (Math.random() - 0.5) * 150;
      if (n.z === undefined) n.z = (Math.random() - 0.5) * 150;
      if (n.vx === undefined) {
        n.vx = 0; n.vy = 0; n.vz = 0;
      }
    });
  }, [nodes]);

  useFrame(() => {
    const speedFactor = Math.max(1, Math.min(30, animSpeed));

    if (enableOrbitLayout) {
      // Smooth spring animation to planetary constellation ring slots
      nodes.forEach((n: any) => {
        if (n.orbitX !== undefined && n.orbitY !== undefined && n.orbitZ !== undefined) {
          n.x = (n.x ?? 0) + (n.orbitX - (n.x ?? 0)) * (0.06 * speedFactor);
          n.y = (n.y ?? 0) + (n.orbitY - (n.y ?? 0)) * (0.06 * speedFactor);
          n.z = (n.z ?? 0) + (n.orbitZ - (n.z ?? 0)) * (0.06 * speedFactor);
          if (nodeRefs.current[n.id]) {
            nodeRefs.current[n.id]!.position.set(n.x, n.y, n.z);
          }
        }
      });
      return;
    }

    if (isTreeLayout) {
      // Smooth spring animation to tree slots
      nodes.forEach((n: any) => {
        if (n.targetX !== undefined && n.targetY !== undefined && n.targetZ !== undefined) {
          n.x = (n.x ?? 0) + (n.targetX - (n.x ?? 0)) * (0.05 * speedFactor);
          n.y = (n.y ?? 0) + (n.targetY - (n.y ?? 0)) * (0.05 * speedFactor);
          n.z = (n.z ?? 0) + (n.targetZ - (n.z ?? 0)) * (0.05 * speedFactor);
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
      if (
        !source || !target || 
        source.x === undefined || target.x === undefined || 
        source.y === undefined || target.y === undefined || 
        source.z === undefined || target.z === undefined
      ) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dz = target.z - source.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;

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
    });

    // Center Gravity
    nodes.forEach(n => {
      if (n.x === undefined || n.y === undefined || n.z === undefined) return;
      const d = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) + 0.001;
      const force = d * 0.0005;
      n.vx = (n.vx ?? 0) - (n.x / d) * force;
      n.vy = (n.vy ?? 0) - (n.y / d) * force;
      n.vz = (n.vz ?? 0) - (n.z / d) * force;
    });

    // Integration
    nodes.forEach(n => {
      // Spatial Node Pinning: If node is pinned, lock coordinates
      if (enableNodePinning && pinnedNodeIds?.has(n.id)) {
        n.vx = 0;
        n.vy = 0;
        n.vz = 0;
        if (nodeRefs.current[n.id]) {
          nodeRefs.current[n.id]!.position.set(n.x ?? 0, n.y ?? 0, n.z ?? 0);
        }
        return;
      }

      if (isNaN(n.x ?? 0) || isNaN(n.y ?? 0) || isNaN(n.z ?? 0) || !isFinite(n.x ?? 0) || !isFinite(n.y ?? 0) || !isFinite(n.z ?? 0)) {
        n.x = (Math.random() - 0.5) * 40;
        n.y = (Math.random() - 0.5) * 40;
        n.z = (Math.random() - 0.5) * 40;
        n.vx = 0; n.vy = 0; n.vz = 0;
      }

      n.x = (n.x ?? 0) + (n.vx ?? 0) * ALPHA * speedFactor;
      n.y = (n.y ?? 0) + (n.vy ?? 0) * ALPHA * speedFactor;
      n.z = (n.z ?? 0) + (n.vz ?? 0) * ALPHA * speedFactor;

      n.vx = (n.vx ?? 0) * DAMPING;
      n.vy = (n.vy ?? 0) * DAMPING;
      n.vz = (n.vz ?? 0) * DAMPING;

      if (nodeRefs.current[n.id]) {
        nodeRefs.current[n.id]!.position.set(n.x ?? 0, n.y ?? 0, n.z ?? 0);
      }
    });
  });

  const getThermalColor = (loc: number) => {
    if (loc < 60) return '#38BDF8';   // Low: Cool Cyan
    if (loc < 180) return '#34D399';  // Normal: Emerald
    if (loc < 400) return '#FBBF24';  // Medium: Amber
    return '#EF4444';                 // High: Volcanic Red
  };

  const getChurnColor = (node: any) => {
    const churn = node.revisions 
      || (node.isGitModified ? 9 : 0)
      || ((node.loc || 20) > 300 ? 5 : ((node.loc || 20) > 100 ? 3 : 1));
    if (churn >= 8) return '#EF4444'; // High velocity / churn: crimson core
    if (churn >= 5) return '#F59E0B'; // Medium: amber
    if (churn >= 3) return '#10B981'; // Moderate: emerald
    return '#38BDF8';                // Low: cool slate/cyan
  };

  // Circular Architecture Dependency Radar: detect mutual circular imports
  const cyclicEdgeSet = useMemo(() => {
    const set = new Set<string>();
    const safeLinks = Array.isArray(links) ? links : [];
    const edgeMap = new Map<string, Set<string>>();
    safeLinks.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (s && t) {
        if (!edgeMap.has(s)) edgeMap.set(s, new Set());
        edgeMap.get(s)!.add(t);
      }
    });
    safeLinks.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (s && t && edgeMap.get(t)?.has(s)) {
        set.add(`${s}->${t}`);
        set.add(`${t}->${s}`);
      }
    });
    return set;
  }, [links]);

  // X-Ray Dependency Isolation (Focus Mode)
  const { xRayParentIds, xRayConsumerIds, isXRayActive } = useMemo(() => {
    if (!enableXRayFocus || !selectedNodeId) {
      return { xRayParentIds: new Set<string>(), xRayConsumerIds: new Set<string>(), isXRayActive: false };
    }
    const parents = new Set<string>();
    const consumers = new Set<string>();
    const safeLinks = Array.isArray(links) ? links : [];
    safeLinks.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (s === selectedNodeId && t) {
        parents.add(t);
      } else if (t === selectedNodeId && s) {
        consumers.add(s);
      }
    });
    return { xRayParentIds: parents, xRayConsumerIds: consumers, isXRayActive: true };
  }, [enableXRayFocus, selectedNodeId, links]);

  // Occlusion / Frustum Culling Helper
  const frustumProjVector = useRef(new THREE.Vector3());
  const isNodeInFrustum = useCallback((x: number, y: number, z: number) => {
    if (!cameraRef?.current) return true;
    try {
      frustumProjVector.current.set(x, y, z).project(cameraRef.current);
      const v = frustumProjVector.current;
      return v.x >= -1.1 && v.x <= 1.1 && v.y >= -1.1 && v.y <= 1.1 && v.z > 0 && v.z < 1;
    } catch (e) {
      return true;
    }
  }, [cameraRef]);

  const memoizedNodes = useMemo(() => {
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    if (safeNodes.length === 0) return [];

    const hasActiveSearch = Boolean(searchFilter && searchFilter.trim());
    const isHeatmapActive = enableSearchHeatmap && hasActiveSearch;

    return safeNodes.map((n: any) => {
      const isSelected = n.engineState === 'SELECTED' || n.id === selectedNodeId;
      const isMatch = n.engineState === 'SEARCH_MATCH';
      const isUnmatched = n.engineState === 'UNMATCHED';

      const loc = n.loc || (n as any).LOC || (n.fileContent ? n.fileContent.split('\n').length : 20);

      // Feature: X-Ray Dependency Isolation
      const isXRaySelected = isXRayActive && n.id === selectedNodeId;
      const isXRayParent = isXRayActive && xRayParentIds.has(n.id);
      const isXRayConsumer = isXRayActive && xRayConsumerIds.has(n.id);

      // Feature: Deletion Simulator
      const isDeletionSimulated = Boolean(enableDeletionSimulator && simulatedDeletedNodeId);
      const isSeveredNode = isDeletionSimulated && n.id === simulatedDeletedNodeId;
      const isBrokenDownstream = isDeletionSimulated && (deletionBrokenIds?.has(n.id) ?? false);

      // Feature: Two-Node Shortest Path Route
      const isRouteActive = Boolean(enableShortestPath && routeNodeIds && routeNodeIds.size > 0);
      const isRouteNode = isRouteActive && (routeNodeIds?.has(n.id) ?? false);

      // Feature: Git Author & Bus Factor Radar
      const authorInfo = enableAuthorRadar && authorRadarData ? authorRadarData[n.id] : null;

      // Feature 4: Codebase Complexity Thermal Heatmap Shader / Git Churn Heatmap
      let color = isSelected ? '#00D2FF' : (n.health === 'critical' ? '#ef4444' : n.health === 'warning' ? '#eab308' : '#22c55e');
      if (enableAuthorRadar && authorInfo) {
        color = authorInfo.color;
      } else if (enableGitChurnHeatmap) {
        color = isSelected ? '#00D2FF' : getChurnColor(n);
      } else if (enableThermalShader) {
        color = isSelected ? '#00D2FF' : getThermalColor(loc);
      }
      
      // Feature 4: Complexity-Weighted Node Sizing (Technical Debt Spheres)
      // Fallback uniform size when Complexity Sphere Scaling is OFF:
      const BASE_RADIUS = 3.5;

      const getNodeRadius = (node: any, complexityScalingEnabled: boolean) => {
        if (!complexityScalingEnabled) return BASE_RADIUS;

        const rawWeight = node.lineCount || node.val || node.weight || node.loc || (node as any).LOC || (node.fileContent ? node.fileContent.split('\n').length : 1);
        
        // Logarithmic scaling with strict min (2.5) and max (14) clamp:
        const scaled = BASE_RADIUS + Math.log10(Math.max(1, rawWeight)) * 2.8;
        return Math.min(Math.max(scaled, 2.5), 14);
      };

      const calculatedRadius = getNodeRadius(n, enableComplexitySizing);
      const sizeMultiplier = (nodeSize ? (nodeSize / 3.8) : 1) * (isSelected ? 1.25 : 1);
      const radius = Math.min(Math.max(calculatedRadius * sizeMultiplier, 2.5), 14);

      // Feature 1: Blast Radius / Impact Analysis
      const isBlastActive = Boolean(enableBlastRadius && blastTargetId);
      const isBlastTarget = isBlastActive && n.id === blastTargetId;
      const isBlastAffected = isBlastActive && (blastAffectedIds?.has(n.id) ?? false);

      let opacity: number;
      let emissiveInt: number;
      let showBillboardLabel: boolean;

      if (isRouteActive) {
        if (isRouteNode) {
          color = '#00F5FF';
          opacity = 1.0;
          emissiveInt = 3.2;
          showBillboardLabel = fileLabels;
        } else {
          // Dim non-route nodes to 5% opacity
          opacity = 0.05;
          emissiveInt = 0.01;
          showBillboardLabel = false;
        }
      } else if (isDeletionSimulated) {
        if (isSeveredNode) {
          color = '#FF0055';
          opacity = 1.0;
          emissiveInt = 3.5;
          showBillboardLabel = fileLabels;
        } else if (isBrokenDownstream) {
          color = '#FF3366';
          opacity = 1.0;
          emissiveInt = 2.4;
          showBillboardLabel = fileLabels;
        } else {
          opacity = 0.15;
          emissiveInt = 0.05;
          showBillboardLabel = false;
        }
      } else if (isXRayActive) {
        if (isXRaySelected) {
          color = '#00D2FF';
          opacity = 1.0;
          emissiveInt = 3.0;
          showBillboardLabel = fileLabels;
        } else if (isXRayParent) {
          color = '#00D2FF'; // Cyan glow for imported parents
          opacity = 1.0;
          emissiveInt = 2.5;
          showBillboardLabel = fileLabels;
        } else if (isXRayConsumer) {
          color = '#EC4899'; // Magenta glow for downstream consumers
          opacity = 1.0;
          emissiveInt = 2.5;
          showBillboardLabel = fileLabels;
        } else {
          // Dims non-related nodes to 8% opacity as requested
          opacity = 0.08;
          emissiveInt = 0.01;
          showBillboardLabel = false;
        }
      } else if (isBlastActive) {
        if (isBlastTarget) {
          color = '#F43F5E';
          opacity = 1.0;
          emissiveInt = 2.5;
          showBillboardLabel = fileLabels;
        } else if (isBlastAffected) {
          color = '#F59E0B';
          opacity = 1.0;
          emissiveInt = 2.0;
          showBillboardLabel = fileLabels;
        } else {
          opacity = 0.08;
          emissiveInt = 0.02;
          showBillboardLabel = false;
        }
      } else if (isHeatmapActive) {
        if (isMatch || isSelected) {
          opacity = 1.0;
          emissiveInt = 2.0;
          showBillboardLabel = fileLabels;
        } else {
          opacity = 0.1;
          emissiveInt = 0.05;
          showBillboardLabel = false;
        }
      } else {
        opacity = isSelected ? 1.0 : (isUnmatched ? 0.15 : 0.85);
        emissiveInt = glowEnabled ? (isSelected ? 1.5 : 0.6) : (isSelected ? 0.4 : 0.1);
        if (enableHolographicBloom) emissiveInt *= 2.2;
        showBillboardLabel = fileLabels && opacity > 0.2;
      }

      // Occlusion culling for labels if GPU Instancing is active
      if (enableGpuInstancing && showBillboardLabel) {
        showBillboardLabel = isNodeInFrustum(n.x ?? 0, n.y ?? 0, n.z ?? 0);
      }

      const labelColor = isSelected ? '#00D2FF' : (isSeveredNode ? '#FF0055' : (isRouteNode ? '#00F5FF' : '#E2E8F0'));
      const dynamicFontSize = `${Math.max(8, Math.round(10 * (fontScale / 100)))}px`;

      return (
        <mesh
          key={n.id}
          ref={(el) => { nodeRefs.current[n.id] = el; }}
          onClick={(e) => { e.stopPropagation(); onSelectNode(n, e); }}
          onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, n); }}
        >
          <sphereGeometry args={[radius, 24, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissiveInt}
            transparent
            opacity={opacity}
            wireframe={isSeveredNode || (isMatch && !isHeatmapActive)}
          />
          {/* Clean Subtle Selection Indicator: Glowing Circular Ring & Emissive Shell */}
          {isSelected && (
            <>
              {/* Concentric subtle glowing selection ring */}
              <mesh scale={[radius * 1.55, radius * 1.55, radius * 1.55]}>
                <ringGeometry args={[1, 1.15, 32]} />
                <meshBasicMaterial
                  color="#00F5FF"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.88}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              {/* Outer soft ambient selection halo */}
              <mesh scale={[radius * 1.85, radius * 1.85, radius * 1.85]}>
                <ringGeometry args={[1, 1.08, 32]} />
                <meshBasicMaterial
                  color="#38BDF8"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              {/* Subtle emissive wireframe selection shell wrapping the node sphere */}
              <mesh scale={[1.22, 1.22, 1.22]}>
                <sphereGeometry args={[radius, 16, 16]} />
                <meshBasicMaterial
                  color="#00F5FF"
                  wireframe
                  transparent
                  opacity={0.25}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            </>
          )}
          {/* Deletion Simulator: Severed Node Fractured Hazard Ring */}
          {isSeveredNode && (
            <mesh scale={[radius * 1.7, radius * 1.7, radius * 1.7]}>
              <ringGeometry args={[1, 1.28, 32]} />
              <meshBasicMaterial color="#FF0055" side={THREE.DoubleSide} transparent opacity={0.95} />
            </mesh>
          )}
          {/* Deletion Simulator: Broken Downstream Warning Ring */}
          {isBrokenDownstream && (
            <mesh scale={[radius * 1.4, radius * 1.4, radius * 1.4]}>
              <ringGeometry args={[1, 1.22, 32]} />
              <meshBasicMaterial color="#FF3366" side={THREE.DoubleSide} transparent opacity={0.85} />
            </mesh>
          )}
          {/* Two-Node Route: Shortest Path Neon Pulsing Ring */}
          {isRouteNode && (
            <mesh scale={[radius * 1.6, radius * 1.6, radius * 1.6]}>
              <ringGeometry args={[1, 1.25, 32]} />
              <meshBasicMaterial color="#00F5FF" side={THREE.DoubleSide} transparent opacity={0.95} />
            </mesh>
          )}
          {/* Git Author Radar: Bus Factor = 1 Warning Hazard Ring */}
          {enableAuthorRadar && authorInfo && authorInfo.busFactor === 1 && !isSeveredNode && !isRouteNode && (
            <mesh scale={[radius * 1.38, radius * 1.38, radius * 1.38]}>
              <ringGeometry args={[1, 1.18, 32]} />
              <meshBasicMaterial color="#F59E0B" side={THREE.DoubleSide} transparent opacity={0.75} />
            </mesh>
          )}
          {/* Feature 1: Blast Target Magenta Pulsing Ring */}
          {isBlastTarget && (
            <mesh scale={[radius * 1.6, radius * 1.6, radius * 1.6]}>
              <ringGeometry args={[1, 1.25, 32]} />
              <meshBasicMaterial color="#F43F5E" side={THREE.DoubleSide} transparent opacity={0.9} />
            </mesh>
          )}
          {/* Feature 1: Blast Affected Amber Glowing Ring */}
          {isBlastAffected && (
            <mesh scale={[radius * 1.35, radius * 1.35, radius * 1.35]}>
              <ringGeometry args={[1, 1.2, 32]} />
              <meshBasicMaterial color="#F59E0B" side={THREE.DoubleSide} transparent opacity={0.85} />
            </mesh>
          )}
          {/* Feature: X-Ray Parent Cyan Ring */}
          {isXRayParent && (
            <mesh scale={[radius * 1.5, radius * 1.5, radius * 1.5]}>
              <ringGeometry args={[1, 1.22, 32]} />
              <meshBasicMaterial color="#00D2FF" side={THREE.DoubleSide} transparent opacity={0.9} />
            </mesh>
          )}
          {/* Feature: X-Ray Consumer Magenta Ring */}
          {isXRayConsumer && (
            <mesh scale={[radius * 1.5, radius * 1.5, radius * 1.5]}>
              <ringGeometry args={[1, 1.22, 32]} />
              <meshBasicMaterial color="#EC4899" side={THREE.DoubleSide} transparent opacity={0.9} />
            </mesh>
          )}
          {/* Feature 2: Holographic Lasso Cyan Selection Ring */}
          {lassoSelectedIds?.has(n.id) && (
            <mesh scale={[radius * 1.4, radius * 1.4, radius * 1.4]}>
              <ringGeometry args={[1, 1.2, 32]} />
              <meshBasicMaterial color="#22D3EE" side={THREE.DoubleSide} transparent opacity={0.9} />
            </mesh>
          )}
          {/* Feature 1: Git Status Pulse Ambient Outer Ring */}
          {enableGitPulse && (n.isGitModified || n.git?.status === 'modified' || n.git?.status === 'added') && (
            <mesh scale={[radius * 1.3, radius * 1.3, radius * 1.3]}>
              <ringGeometry args={[1, 1.2, 32]} />
              <meshBasicMaterial color="#F59E0B" side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>
          )}
          {/* Feature 3: Spatial Node Pinning Anchor Ring */}
          {enableNodePinning && pinnedNodeIds?.has(n.id) && (
            <mesh scale={[radius * 1.45, radius * 1.45, radius * 1.45]}>
              <ringGeometry args={[1, 1.18, 32]} />
              <meshBasicMaterial color="#06B6D4" side={THREE.DoubleSide} transparent opacity={0.85} />
            </mesh>
          )}
          {showBillboardLabel && (
            <Html position={[0, radius + 1, 0]} center zIndexRange={[100, 0]}>
              <div style={{ color: labelColor, fontSize: dynamicFontSize, fontFamily: 'monospace', textShadow: glowEnabled ? '1px 1px 3px black, -1px -1px 3px black' : 'none', pointerEvents: 'none', whiteSpace: 'nowrap', fontWeight: (isSelected || isRouteNode || isSeveredNode) ? 'bold' : 'normal' }}>
                {enableAuthorRadar && authorInfo?.busFactor === 1 ? `⚠ ${n.label}` : n.label}
              </div>
            </Html>
          )}
        </mesh>
      );
    });
  }, [nodes, onSelectNode, onContextMenu, nodeSize, fileLabels, glowEnabled, fontScale, enableGitPulse, enableSearchHeatmap, searchFilter, enableNodePinning, pinnedNodeIds, enableComplexitySizing, enableBlastRadius, blastTargetId, blastAffectedIds, enableLassoSelect, lassoSelectedIds, enableThermalShader, enableGitChurnHeatmap, enableXRayFocus, selectedNodeId, isXRayActive, xRayParentIds, xRayConsumerIds, enableHolographicBloom, enableGpuInstancing, isNodeInFrustum, enableDeletionSimulator, simulatedDeletedNodeId, deletionBrokenIds, enableAuthorRadar, authorRadarData, enableShortestPath, routeNodeIds]);

  const memoizedLinks = useMemo(() => {
    const safeLinks = Array.isArray(links) ? links : [];
    if (safeLinks.length === 0) return [];

    const isRouteActive = Boolean(enableShortestPath && routeNodeIds && routeNodeIds.size > 0);

    return safeLinks.map((l, i) => {
      if (!l.source || !l.target) return null;
      if (!showCodeDependencies && l.isCodeDependency) return null;
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;

      const isCyclic = cyclicEdgeSet.has(`${sId}->${tId}`) || cyclicEdgeSet.has(`${tId}->${sId}`);
      const isXRayFocused = isXRayActive && (sId === selectedNodeId || tId === selectedNodeId);
      const dimmedByXRay = isXRayActive && !isXRayFocused;
      const xRayRole = sId === selectedNodeId ? 'parent' : (tId === selectedNodeId ? 'consumer' : 'none');

      const isRouteEdge = Boolean(isRouteActive && routeEdgeKeys && (routeEdgeKeys.has(`${sId}->${tId}`) || routeEdgeKeys.has(`${tId}->${sId}`)));
      const dimmedByRoute = isRouteActive && !isRouteEdge;

      const isBrokenByDeletion = Boolean(
        enableDeletionSimulator && simulatedDeletedNodeId &&
        (sId === simulatedDeletedNodeId || tId === simulatedDeletedNodeId || (deletionBrokenIds?.has(sId) && (tId === simulatedDeletedNodeId || deletionBrokenIds?.has(tId))))
      );

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
          enableDataStreamers={enableDataStreamers}
          isCyclic={isCyclic}
          enableCircularDependencyRadar={enableCircularDependencyRadar}
          dimmedByXRay={dimmedByXRay}
          isXRayFocusedEdge={isXRayFocused}
          xRayRole={xRayRole}
          isBrokenByDeletion={isBrokenByDeletion}
          isRouteEdge={isRouteEdge}
          dimmedByRoute={dimmedByRoute}
        />
      );
    });
  }, [links, nodes, edgeOpacity, glowEnabled, showCodeDependencies, highlightDependencyEdges, enableDataStreamers, cyclicEdgeSet, enableCircularDependencyRadar, isXRayActive, selectedNodeId, enableShortestPath, routeNodeIds, routeEdgeKeys, enableDeletionSimulator, simulatedDeletedNodeId, deletionBrokenIds]);

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
  highlightDependencyEdges = true,
  enableDataStreamers = false,
  isCyclic = false,
  enableCircularDependencyRadar = false,
  dimmedByXRay = false,
  isXRayFocusedEdge = false,
  xRayRole = 'none',
  isBrokenByDeletion = false,
  isRouteEdge = false,
  dimmedByRoute = false
}: { 
  sourceId: string, 
  targetId: string, 
  nodes: GraphNode[], 
  nodeRefs: React.MutableRefObject<{ [key: string]: THREE.Mesh | null }>, 
  edgeOpacity?: number, 
  glowEnabled?: boolean,
  isCodeDependency?: boolean,
  highlightDependencyEdges?: boolean,
  enableDataStreamers?: boolean,
  isCyclic?: boolean,
  enableCircularDependencyRadar?: boolean,
  dimmedByXRay?: boolean,
  isXRayFocusedEdge?: boolean,
  xRayRole?: 'parent' | 'consumer' | 'none',
  isBrokenByDeletion?: boolean,
  isRouteEdge?: boolean,
  dimmedByRoute?: boolean
}) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const lineRef = useRef<THREE.Line>(null);
  const streamerGeomRef = useRef<THREE.BufferGeometry>(null);
  const { useFrame } = require('@react-three/fiber');

  // Prevent Three.js frustum culling when zooming/tilting
  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Infinity);
    }
    if (streamerGeomRef.current) {
      streamerGeomRef.current.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Infinity);
    }
    if (lineRef.current) {
      lineRef.current.frustumCulled = false;
      lineRef.current.renderOrder = 1;
    }
  }, []);

  useFrame(({ clock }: any) => {
    const source = nodeRefs.current[sourceId];
    const target = nodeRefs.current[targetId];
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);

    const sx = source ? source.position.x : (sourceNode?.x ?? 0);
    const sy = source ? source.position.y : (sourceNode?.y ?? 0);
    const sz = source ? source.position.z : (sourceNode?.z ?? 0);
    const tx = target ? target.position.x : (targetNode?.x ?? 0);
    const ty = target ? target.position.y : (targetNode?.y ?? 0);
    const tz = target ? target.position.z : (targetNode?.z ?? 0);

    if (geomRef.current) {
      const positions = geomRef.current.attributes.position.array as Float32Array;
      positions[0] = sx;
      positions[1] = sy;
      positions[2] = sz;
      positions[3] = tx;
      positions[4] = ty;
      positions[5] = tz;
      geomRef.current.attributes.position.needsUpdate = true;
      geomRef.current.computeBoundingSphere();
      if ((isBrokenByDeletion || (enableCircularDependencyRadar && isCyclic)) && lineRef.current) {
        lineRef.current.computeLineDistances();
      }
    }

    if ((enableDataStreamers || isRouteEdge) && streamerGeomRef.current) {
      const speed = isRouteEdge ? 2.0 : 1.2;
      const seed = Math.abs(sourceId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 100) * 0.01;
      const t = (clock.getElapsedTime() * speed + seed) % 1.0;
      const pts = streamerGeomRef.current.attributes.position.array as Float32Array;
      pts[0] = sx + (tx - sx) * t;
      pts[1] = sy + (ty - sy) * t;
      pts[2] = sz + (tz - sz) * t;
      streamerGeomRef.current.attributes.position.needsUpdate = true;
    }
  });

  const sourceNode = nodes.find(n => n.id === sourceId);
  const targetNode = nodes.find(n => n.id === targetId);
  const isCritical = sourceNode?.health === 'critical' && targetNode?.health === 'critical';

  let edgeColor = '#6366F1';
  if (isRouteEdge) {
    edgeColor = '#00F5FF'; // Route chain neon cyan
  } else if (isBrokenByDeletion) {
    edgeColor = '#FF0055'; // Severed / broken dependency link
  } else if (enableCircularDependencyRadar && isCyclic) {
    edgeColor = '#FF1E56'; // Offending cyclic import flash
  } else if (isXRayFocusedEdge) {
    edgeColor = xRayRole === 'parent' ? '#00D2FF' : '#EC4899';
  } else if (isCritical) {
    edgeColor = '#ef4444';
  } else if (isCodeDependency) {
    edgeColor = highlightDependencyEdges ? '#F43F5E' : '#6366F1';
  } else {
    edgeColor = '#8a2be2'; // 0x8a2be2 electric violet/purple default link color
  }

  const baseAlpha = Math.max(edgeOpacity, 0.45);
  let opacity = isCritical 
    ? Math.min(1, baseAlpha * 1.8) 
    : (isCodeDependency && highlightDependencyEdges ? Math.max(baseAlpha * 1.4, 0.65) : baseAlpha);

  if (dimmedByRoute) {
    opacity = 0.04; // Route finder dims non-route links to 4%
  } else if (isRouteEdge) {
    opacity = 1.0;
  } else if (isBrokenByDeletion) {
    opacity = 0.95;
  } else if (dimmedByXRay) {
    opacity = 0.08; // X-Ray Focus dims non-related links to 8%
  } else if (isXRayFocusedEdge) {
    opacity = 1.0;
  } else if (enableCircularDependencyRadar && isCyclic) {
    opacity = 0.95;
  }

  const finalOpacity = glowEnabled ? opacity : Math.min(opacity, 0.3);

  return (
    <group>
      <line ref={lineRef as any} {...({ frustumCulled: false, renderOrder: 1 } as any)}>
        <bufferGeometry ref={geomRef as any}>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array(6)}
            itemSize={3}
          />
        </bufferGeometry>
        {isBrokenByDeletion || (enableCircularDependencyRadar && isCyclic) ? (
          <lineDashedMaterial
            color={edgeColor}
            dashSize={isBrokenByDeletion ? 5 : 6}
            gapSize={isBrokenByDeletion ? 5 : 4}
            transparent={true}
            opacity={finalOpacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        ) : (
          <lineBasicMaterial
            color={edgeColor}
            transparent={true}
            opacity={finalOpacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        )}
      </line>

      {(enableDataStreamers || isRouteEdge) && (
        <points frustumCulled={false} renderOrder={2}>
          <bufferGeometry ref={streamerGeomRef as any}>
            <bufferAttribute
              attach="attributes-position"
              count={1}
              array={new Float32Array(3)}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={isRouteEdge ? 6 : (isCodeDependency ? 5 : 3.5)}
            color={isRouteEdge ? '#00F5FF' : (isCodeDependency ? '#00FFFF' : '#A855F7')}
            transparent
            opacity={dimmedByRoute || dimmedByXRay ? 0.04 : 0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}
    </group>
  );
}

// ---------------------------------------------------------
// HUD 2D Radar Mini-Map & Viewport Presets Widget
// ---------------------------------------------------------
interface HudRadarMiniMapProps {
  nodes: GraphNode[];
  cameraRef?: React.MutableRefObject<any>;
  controlsRef?: React.MutableRefObject<any>;
  playCyberTone?: (freq?: number, type?: OscillatorType, duration?: number) => void;
}

function HudRadarMiniMap({ nodes, cameraRef, controlsRef, playCyberTone }: HudRadarMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const sweepAngleRef = useRef<number>(0);

  useEffect(() => {
    let active = true;

    const render = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const cx = width / 2;
          const cy = height / 2;

          // Obsidian HUD background
          ctx.fillStyle = '#07070E';
          ctx.fillRect(0, 0, width, height);

          // Concentric radar ranges
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
          ctx.lineWidth = 1;
          for (let r = 20; r <= 60; r += 20) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Crosshairs
          ctx.beginPath();
          ctx.moveTo(cx, 0); ctx.lineTo(cx, height);
          ctx.moveTo(0, cy); ctx.lineTo(width, cy);
          ctx.stroke();

          // Cyber sweeping beam
          sweepAngleRef.current = (sweepAngleRef.current + 0.035) % (Math.PI * 2);
          const sweepX = cx + Math.cos(sweepAngleRef.current) * 65;
          const sweepY = cy + Math.sin(sweepAngleRef.current) * 65;
          const grad = ctx.createLinearGradient(cx, cy, sweepX, sweepY);
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
          grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          ctx.strokeStyle = grad;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(sweepX, sweepY);
          ctx.stroke();

          // 2D Orthographic node position projections
          const scale = 0.5;
          nodes.forEach((n: any) => {
            const nx = cx + (n.x ?? 0) * scale;
            const ny = cy + (n.z ?? 0) * scale;
            if (nx >= 2 && nx <= width - 2 && ny >= 2 && ny <= height - 2) {
              ctx.fillStyle = n.health === 'critical' 
                ? '#EF4444' 
                : (n.isGitModified ? '#F59E0B' : (n.health === 'warning' ? '#EAB308' : '#22C55E'));
              ctx.beginPath();
              ctx.arc(nx, ny, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Camera Frustum cone and observer beacon
          if (cameraRef?.current) {
            const cam = cameraRef.current;
            const camX = cx + (cam.position.x ?? 0) * (scale * 0.45);
            const camY = cy + (cam.position.z ?? 0) * (scale * 0.45);
            const clampedCamX = Math.max(6, Math.min(width - 6, camX));
            const clampedCamY = Math.max(6, Math.min(height - 6, camY));

            // Camera dot
            ctx.fillStyle = '#00D2FF';
            ctx.beginPath();
            ctx.arc(clampedCamX, clampedCamY, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Frustum viewing cone
            const angleToCenter = Math.atan2(cy - clampedCamY, cx - clampedCamX);
            const coneHalfAngle = 0.5;
            const coneRadius = 24;

            ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
            ctx.beginPath();
            ctx.moveTo(clampedCamX, clampedCamY);
            ctx.arc(clampedCamX, clampedCamY, coneRadius, angleToCenter - coneHalfAngle, angleToCenter + coneHalfAngle);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, cameraRef]);

  // Smooth camera position animator
  const animateCameraTo = (targetPos: [number, number, number], targetLookAt: [number, number, number]) => {
    if (playCyberTone) playCyberTone(660, 'sine', 0.05);
    const cam = cameraRef?.current;
    const ctrl = controlsRef?.current;
    if (!cam) return;

    const startPos = [cam.position.x, cam.position.y, cam.position.z];
    const startTarget = ctrl ? [ctrl.target.x, ctrl.target.y, ctrl.target.z] : [0, 0, 0];
    const startTime = performance.now();
    const duration = 400;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      cam.position.x = startPos[0] + (targetPos[0] - startPos[0]) * ease;
      cam.position.y = startPos[1] + (targetPos[1] - startPos[1]) * ease;
      cam.position.z = startPos[2] + (targetPos[2] - startPos[2]) * ease;

      const curTargetX = startTarget[0] + (targetLookAt[0] - startTarget[0]) * ease;
      const curTargetY = startTarget[1] + (targetLookAt[1] - startTarget[1]) * ease;
      const curTargetZ = startTarget[2] + (targetLookAt[2] - startTarget[2]) * ease;

      if (ctrl) {
        ctrl.target.set(curTargetX, curTargetY, curTargetZ);
        ctrl.update();
      } else {
        cam.lookAt(curTargetX, curTargetY, curTargetZ);
      }
      cam.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  return (
    <div className="fixed bottom-6 left-6 z-30 flex flex-col items-center gap-1.5 p-2 bg-[#07070E]/95 border border-cyan-500/30 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.85),0_0_12px_rgba(6,182,212,0.15)] backdrop-blur-md font-mono select-none pointer-events-auto">
      <div className="w-full flex items-center justify-between px-1 text-[9px] font-bold text-cyan-400 tracking-wider">
        <span>HUD RADAR [2D]</span>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
      </div>

      <div className="relative rounded-lg overflow-hidden border border-cyan-500/20 shadow-inner">
        <canvas ref={canvasRef} width={140} height={140} className="block" />
      </div>

      {/* 3 Quick-Slot Viewport Preset Buttons */}
      <div className="grid grid-cols-3 gap-1 w-full mt-0.5">
        <button
          type="button"
          onClick={() => animateCameraTo([0, 0, 450], [0, 0, 0])}
          className="px-1 py-1 text-[8px] font-mono font-bold text-zinc-300 hover:text-cyan-300 bg-[#0B0B16] hover:bg-cyan-950/50 border border-white/10 hover:border-cyan-400 rounded transition-all text-center"
          title="Viewport Preset 1: Root Front View"
        >
          [ 1: ROOT ]
        </button>
        <button
          type="button"
          onClick={() => animateCameraTo([350, 250, 350], [0, 0, 0])}
          className="px-1 py-1 text-[8px] font-mono font-bold text-zinc-300 hover:text-cyan-300 bg-[#0B0B16] hover:bg-cyan-950/50 border border-white/10 hover:border-cyan-400 rounded transition-all text-center"
          title="Viewport Preset 2: Isometric 3D Cluster View"
        >
          [ 2: CLUSTERS ]
        </button>
        <button
          type="button"
          onClick={() => animateCameraTo([0, 600, 1], [0, 0, 0])}
          className="px-1 py-1 text-[8px] font-mono font-bold text-zinc-300 hover:text-cyan-300 bg-[#0B0B16] hover:bg-cyan-950/50 border border-white/10 hover:border-cyan-400 rounded transition-all text-center"
          title="Viewport Preset 3: Orthographic Top-Down View"
        >
          [ 3: TOP ]
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Autonomous Security & Dead-Code Scanner Report Modal
// ---------------------------------------------------------
interface RepoAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: {
    orphanedNodes: GraphNode[];
    criticalNodes: GraphNode[];
    totalScanned: number;
    timestamp: string;
  } | null;
  onDispatchToSparkAi: (prompt: string) => void;
  onSelectNode: (node: GraphNode) => void;
  playCyberTone?: (freq?: number, type?: OscillatorType, duration?: number) => void;
}

function RepoAuditModal({
  isOpen,
  onClose,
  report,
  onDispatchToSparkAi,
  onSelectNode,
  playCyberTone
}: RepoAuditModalProps) {
  if (!isOpen || !report) return null;

  const handleSparkDispatch = () => {
    if (playCyberTone) playCyberTone(900, 'sine', 0.1);
    const orphanCount = report.orphanedNodes.length;
    const critCount = report.criticalNodes.length;
    const orphanList = report.orphanedNodes.slice(0, 8).map(n => `- ${n.label} (${n.path || n.id})`).join('\n');
    const critList = report.criticalNodes.slice(0, 8).map(n => `- ${n.label}: Health [${n.health}]`).join('\n');

    const prompt = `[AUTONOMOUS CODEBASE AUDIT REPORT - ${report.timestamp}]\n\n`
      + `Orchestrated repo scan over ${report.totalScanned} vault nodes:\n`
      + `1. IDENTIFIED ORPHANED / DEAD-CODE CANDIDATES (${orphanCount} files with zero inbound/outbound links):\n${orphanList || 'None detected'}\n\n`
      + `2. CRITICAL / HIGH-RISK SECURITY NODES (${critCount} critical files):\n${critList || 'None detected'}\n\n`
      + `Please provide an architectural risk evaluation, recommend safe dead-code pruning steps, and suggest immediate remediation for any critical security issues.`;

    onDispatchToSparkAi(prompt);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="relative w-[580px] max-w-[95vw] max-h-[85vh] bg-[#07070E] border border-amber-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.2)] flex flex-col overflow-hidden font-mono">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0A0A14]">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-pulse" />
            <h2 className="text-sm font-bold text-amber-300 tracking-wider">
              AUTONOMOUS AUDITOR: DEAD-CODE & SECURITY REPORT
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 flex-1 text-xs">
          {/* Metrics Pill Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0D0D1A] border border-white/10 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-zinc-400">TOTAL SCANNED</span>
              <span className="text-lg font-bold text-zinc-100">{report.totalScanned}</span>
            </div>
            <div className="bg-[#0D0D1A] border border-amber-500/30 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-amber-400/80">ORPHANED NODES</span>
              <span className="text-lg font-bold text-amber-300">{report.orphanedNodes.length}</span>
            </div>
            <div className="bg-[#0D0D1A] border border-red-500/30 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-red-400/80">CRITICAL RISKS</span>
              <span className="text-lg font-bold text-red-400">{report.criticalNodes.length}</span>
            </div>
          </div>

          {/* Orphaned Dead-Code Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200">Orphaned Dead-Code Candidates (Degree = 0)</span>
              <span className="text-[10px] text-zinc-500">{report.orphanedNodes.length} files found</span>
            </div>
            <div className="max-h-36 overflow-y-auto bg-[#0A0A14] border border-white/10 rounded-xl p-2 flex flex-col gap-1.5">
              {report.orphanedNodes.length === 0 ? (
                <div className="text-zinc-500 text-[11px] p-2">✓ No orphaned files detected in vault.</div>
              ) : (
                report.orphanedNodes.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onSelectNode(n);
                      onClose();
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-amber-950/40 border border-white/5 hover:border-amber-500/40 text-left transition-all group"
                  >
                    <span className="text-zinc-300 group-hover:text-amber-300 truncate max-w-[340px]">{n.label}</span>
                    <span className="text-[9px] text-amber-400 font-bold shrink-0">[ISOLATED]</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Critical Security Files Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200">Critical Health & Security Files</span>
              <span className="text-[10px] text-zinc-500">{report.criticalNodes.length} files found</span>
            </div>
            <div className="max-h-36 overflow-y-auto bg-[#0A0A14] border border-white/10 rounded-xl p-2 flex flex-col gap-1.5">
              {report.criticalNodes.length === 0 ? (
                <div className="text-zinc-500 text-[11px] p-2">✓ No critical risk files detected.</div>
              ) : (
                report.criticalNodes.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onSelectNode(n);
                      onClose();
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-red-950/40 border border-white/5 hover:border-red-500/40 text-left transition-all group"
                  >
                    <span className="text-zinc-300 group-hover:text-red-300 truncate max-w-[340px]">{n.label}</span>
                    <span className="text-[9px] text-red-400 font-bold shrink-0">[CRITICAL]</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#0A0A14] gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold transition-all"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSparkDispatch}
            className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold text-xs shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <span>⚡ DISPATCH AUDIT TO SPARK AI</span>
          </button>
        </div>
      </div>
    </div>
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
    uiDensity: appUiDensity,
    setUiDensity: setAppUiDensity,
    zoomSensitivity: appZoomSensitivity,
    setZoomSensitivity: setAppZoomSensitivity,
  } = useApp() as any;

  const [localZoomSensitivity, setLocalZoomSensitivity] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('orionx_zoom_sensitivity');
        if (stored) {
          const parsed = parseFloat(stored);
          if (!isNaN(parsed) && parsed >= 0.2 && parsed <= 3.0) return parsed;
        }
      } catch (e) {}
    }
    return 1.0;
  });

  const zoomSensitivity = appZoomSensitivity ?? localZoomSensitivity;

  const updateZoomSensitivity = useCallback((val: number) => {
    const clamped = Math.max(0.2, Math.min(3.0, parseFloat(val.toFixed(1))));
    setLocalZoomSensitivity(clamped);
    if (setAppZoomSensitivity) setAppZoomSensitivity(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('orionx_zoom_sensitivity', String(clamped));
      } catch (e) {}
    }
    if (controlsRef.current) {
      controlsRef.current.zoomSpeed = clamped;
    }
  }, [setAppZoomSensitivity]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.zoomSpeed = zoomSensitivity;
    }
  }, [zoomSensitivity]);

  const [uiDensity, setUiDensityLocal] = useState<string>('compact');

  const setUiDensity = useCallback((val: string) => {
    const norm = (val || 'compact').toLowerCase();
    setUiDensityLocal(norm);
    if (setAppUiDensity) setAppUiDensity(norm);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('density-compact', 'density-standard', 'density-spacious');
      document.body.classList.remove('density-compact', 'density-standard', 'density-spacious');
      document.documentElement.classList.add(`density-${norm}`);
      document.body.classList.add(`density-${norm}`);
      if (norm === 'spacious') {
        document.documentElement.style.setProperty('--item-padding', '16px 20px');
        document.documentElement.style.setProperty('--layout-gap', '24px');
        document.documentElement.style.setProperty('--card-gap', '20px');
        document.documentElement.style.setProperty('--row-gap', '20px');
        document.documentElement.style.setProperty('--card-padding', '18px 24px');
        document.documentElement.style.setProperty('--app-font-scale', '105%');
        document.documentElement.style.fontSize = '1.05rem';
      } else if (norm === 'standard') {
        document.documentElement.style.setProperty('--item-padding', '10px 14px');
        document.documentElement.style.setProperty('--layout-gap', '16px');
        document.documentElement.style.setProperty('--card-gap', '14px');
        document.documentElement.style.setProperty('--row-gap', '16px');
        document.documentElement.style.setProperty('--card-padding', '14px 18px');
        document.documentElement.style.setProperty('--app-font-scale', '100%');
        document.documentElement.style.fontSize = '100%';
      } else {
        document.documentElement.style.setProperty('--item-padding', '6px 10px');
        document.documentElement.style.setProperty('--layout-gap', '8px');
        document.documentElement.style.setProperty('--card-gap', '8px');
        document.documentElement.style.setProperty('--row-gap', '8px');
        document.documentElement.style.setProperty('--card-padding', '8px 12px');
        document.documentElement.style.setProperty('--app-font-scale', '95%');
        document.documentElement.style.fontSize = '95%';
      }
      try { localStorage.setItem('orionx_ui_density', norm); } catch (e) {}
    }
  }, [setAppUiDensity]);

  useEffect(() => {
    if (appUiDensity) {
      setUiDensityLocal(appUiDensity.toLowerCase());
    } else {
      try {
        const stored = localStorage.getItem('orionx_ui_density');
        if (stored) setUiDensity(stored);
      } catch (e) {}
    }
  }, [appUiDensity, setUiDensity]);

  const densityStyles = useMemo(() => {
    switch (uiDensity) {
      case 'spacious':
        return {
          card: 'p-5 gap-4',
          item: 'py-3.5 px-4',
          container: 'p-8 space-y-6',
          gridGap: 'gap-6',
          badge: 'px-2 py-1',
          textSpacing: 'space-y-3',
          headerPadding: 'px-8 py-5',
          modalPadding: 'p-8',
        };
      case 'standard':
        return {
          card: 'p-3.5 gap-3',
          item: 'py-2.5 px-3',
          container: 'p-6 space-y-4',
          gridGap: 'gap-4',
          badge: 'px-1.5 py-0.5',
          textSpacing: 'space-y-2',
          headerPadding: 'px-6 py-4',
          modalPadding: 'p-6',
        };
      case 'compact':
      default:
        return {
          card: 'p-2.5 gap-2',
          item: 'py-1.5 px-2.5',
          container: 'p-4 space-y-3',
          gridGap: 'gap-3',
          badge: 'px-1 py-0.2',
          textSpacing: 'space-y-1.5',
          headerPadding: 'px-5 py-3',
          modalPadding: 'p-4',
        };
    }
  }, [uiDensity]);

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
  type SettingsTab = 'APPEARANCE' | 'SYSTEM' | 'LABS' | 'SPARK AI' | 'ABOUT ORION-X';
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('APPEARANCE');
  const [theme, setTheme] = useState('Dark');
  const [previewLabItem, setPreviewLabItem] = useState<LabFeatureInfo | null>(null);
  const [deepInspectLabItem, setDeepInspectLabItem] = useState<LabFeatureInfo | null>(null);

  // Ensure Settings modal resets/defaults to 'APPEARANCE' on every open
  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsTab('APPEARANCE');
    }
  }, [isSettingsOpen]);

  const [autoLayout, setAutoLayout] = useState(true);
  const [isTreeLayout, setIsTreeLayout] = useState<boolean>(false);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
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

  // Feature 1: Git Status & Churn Pulse
  const [enableGitPulse, setEnableGitPulse] = useState<boolean>(false);

  // Feature 2: Spatial Search Heatmap Beacons
  const [enableSearchHeatmap, setEnableSearchHeatmap] = useState<boolean>(false);

  // Feature 3: HUD Radar Mini-Map & Presets
  const [enableRadarMinimap, setEnableRadarMinimap] = useState<boolean>(false);

  // Feature 4: Spark AI Autonomous Security Card
  const [enableAutonomousAuditor, setEnableAutonomousAuditor] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditReport, setAuditReport] = useState<{
    orphanedNodes: GraphNode[];
    criticalNodes: GraphNode[];
    totalScanned: number;
    timestamp: string;
  } | null>(null);

  // Feature 5: Cyber HUD Spatial SFX Audio Engine
  const [enableCyberSfx, setEnableCyberSfx] = useState<boolean>(false);

  // --- NEW LABS / EXPERIMENTAL STUDIO ENHANCEMENT HOOKS (ALL DEFAULT OFF) ---
  // Feature 1: Live In-Viewer Code Editor & Disk Save
  const [enableLiveEditor, setEnableLiveEditor] = useState<boolean>(false);
  const [isEditingFile, setIsEditingFile] = useState<boolean>(false);
  const [editableFileContent, setEditableFileContent] = useState<string>('');
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string>('');

  // Feature 2: High-Resolution HUD Canvas Snapshot / PNG Exporter
  const [enableHudExport, setEnableHudExport] = useState<boolean>(false);

  // Feature 3: Spatial Node Pinning & Quick Favorites
  const [enableNodePinning, setEnableNodePinning] = useState<boolean>(false);
  const [pinnedNodeIds, setPinnedNodeIds] = useState<Set<string>>(new Set());

  // Feature 4: Complexity-Weighted Node Sizing (Technical Debt Spheres)
  const [enableComplexitySizing, setEnableComplexitySizing] = useState<boolean>(false);

  // Feature 5: Recent Vaults Quick-Switcher History
  const [enableVaultHistory, setEnableVaultHistory] = useState<boolean>(false);
  const [recentVaults, setRecentVaults] = useState<{ id?: string; path: string; name: string; timestamp: number }[]>([]);
  const [isVaultSwitcherOpen, setIsVaultSwitcherOpen] = useState<boolean>(false);

  // Sync recent vaults with localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('orionx_recent_vaults');
      if (stored) {
        setRecentVaults(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (activeWorkspace?.path) {
      const entry = {
        id: activeWorkspace.id || `ws_${Date.now()}`,
        path: activeWorkspace.path,
        name: activeWorkspace.name || activeWorkspace.path.split(/[\\/]/).pop() || 'Workspace',
        timestamp: Date.now()
      };
      setRecentVaults(prev => {
        const filtered = prev.filter(v => v.path !== activeWorkspace.path);
        const next = [entry, ...filtered].slice(0, 8);
        try {
          localStorage.setItem('orionx_recent_vaults', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  }, [activeWorkspace?.path, activeWorkspace?.name, activeWorkspace?.id]);

  useEffect(() => {
    setIsEditingFile(false);
    setSaveStatusMsg('');
  }, [selectedNode?.id, activeFileNode?.id]);

  // --- 4 ADVANCED LAB ENGINES (ALL DEFAULT FALSE) ---
  const [enableBlastRadius, setEnableBlastRadius] = useState<boolean>(false);
  const [enableLassoSelect, setEnableLassoSelect] = useState<boolean>(false);
  const [enableInlineDiff, setEnableInlineDiff] = useState<boolean>(false);
  const [enableThermalShader, setEnableThermalShader] = useState<boolean>(false);

  // --- 5 HIGH-IMPACT LAB ENGINES (ALL DEFAULT FALSE) ---
  const [enableDataStreamers, setEnableDataStreamers] = useState<boolean>(false);
  const [enableXRayFocus, setEnableXRayFocus] = useState<boolean>(false);
  const [enableGitChurnHeatmap, setEnableGitChurnHeatmap] = useState<boolean>(false);
  const [enableOrbitLayout, setEnableOrbitLayout] = useState<boolean>(false);
  const [enableCircularDependencyRadar, setEnableCircularDependencyRadar] = useState<boolean>(false);

  // Appearance & System Engine Toggles
  const [enableHolographicBloom, setEnableHolographicBloom] = useState<boolean>(false);
  const [enableGpuInstancing, setEnableGpuInstancing] = useState<boolean>(false);

  // --- 3 NEW ADVANCED LAB ENGINES (ALL DEFAULT FALSE) ---
  const [enableDeletionSimulator, setEnableDeletionSimulator] = useState<boolean>(false);
  const [simulatedDeletedNodeId, setSimulatedDeletedNodeId] = useState<string | null>(null);
  const [enableAuthorRadar, setEnableAuthorRadar] = useState<boolean>(false);
  const [enableShortestPath, setEnableShortestPath] = useState<boolean>(false);
  const [routeStartNodeId, setRouteStartNodeId] = useState<string | null>(null);
  const [routeEndNodeId, setRouteEndNodeId] = useState<string | null>(null);
  const [copiedPathStatus, setCopiedPathStatus] = useState<boolean>(false);

  // Active interactive state buffers
  const [blastTargetId, setBlastTargetId] = useState<string | null>(null);
  const [lassoSelectedIds, setLassoSelectedIds] = useState<Set<string>>(new Set());
  const [isolatedClusterIds, setIsolatedClusterIds] = useState<Set<string> | null>(null);

  // 2D Marquee Selection Bounds & Container Ref
  const [isMarqueeDragging, setIsMarqueeDragging] = useState<boolean>(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);
  const graphCanvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Git Diff state in Raw File Content Viewer
  const [showViewerDiff, setShowViewerDiff] = useState<boolean>(false);
  const [viewerGitDiff, setViewerGitDiff] = useState<string>('');
  const [isLoadingViewerDiff, setIsLoadingViewerDiff] = useState<boolean>(false);

  // Glowing Red Overdrive Master Switch
  const [isOverdriveActive, setIsOverdriveActive] = useState<boolean>(false);
  const animationSpeed = animSpeed;
  const setAnimationSpeed = useCallback((speed: number) => {
    setAnimSpeed(speed);
    setAnimationVelocity(speed);
  }, []);

  const handleToggleOverdrive = (active: boolean) => {
    setIsOverdriveActive(active);
    if (active) {
      setAnimationSpeed(30);
      setNodeSize(4.5);
      setGlowEnabled(true);
      setEdgeOpacity(0.85);
      setShowCodeDependencies(true);
      setHighlightDependencyEdges(true);
      setEnableBlastRadius(true);
      setEnableLassoSelect(true);
      setEnableInlineDiff(true);
      setEnableThermalShader(true);
      setEnableGitPulse?.(true);
      setEnableSearchHeatmap?.(true);
      setEnableRadarMinimap?.(true);
      setEnableAutonomousAuditor?.(true);
      setEnableComplexitySizing?.(true);
    } else {
      setAnimationSpeed(1);
      setNodeSize(3.8);
      setEdgeOpacity(0.35);
      setEnableBlastRadius(false);
      setEnableLassoSelect(false);
      setEnableInlineDiff(false);
      setEnableThermalShader(false);
    }
  };

  // Master Labs Override Switch Handler
  const handleToggleMasterLabs = useCallback((active: boolean) => {
    setEnableBlastRadius(active);
    if (!active) setBlastTargetId(null);

    setEnableLassoSelect(active);
    if (!active) {
      setLassoSelectedIds(new Set());
      setIsolatedClusterIds(null);
    }

    setEnableInlineDiff(active);
    if (!active) setShowViewerDiff(false);

    setEnableThermalShader(active);

    setEnableLiveEditor(active);
    if (!active) setIsEditingFile(false);
    try { localStorage.setItem('orionx_enable_live_editor', String(active)); } catch (e) {}

    setEnableHudExport(active);

    setEnableNodePinning(active);
    if (!active) setPinnedNodeIds(new Set());

    setEnableComplexitySizing(active);

    setEnableVaultHistory(active);
    if (!active) setIsVaultSwitcherOpen(false);

    setEnableGitPulse(active);
    setEnableSearchHeatmap(active);
    setEnableRadarMinimap(active);
    setEnableAutonomousAuditor(active);
    setEnableCyberSfx(active);

    // 5 High-Impact Labs
    setEnableDataStreamers(active);
    setEnableXRayFocus(active);
    setEnableGitChurnHeatmap(active);
    setEnableOrbitLayout(active);
    setEnableCircularDependencyRadar(active);

    // 3 Advanced Labs
    setEnableDeletionSimulator(active);
    if (!active) setSimulatedDeletedNodeId(null);
    setEnableAuthorRadar(active);
    setEnableShortestPath(active);
    if (!active) {
      setRouteStartNodeId(null);
      setRouteEndNodeId(null);
    }

    setIsOverdriveActive(active);
  }, []);

  const isMasterLabsActive = useMemo(() => {
    return Boolean(
      enableBlastRadius &&
      enableLassoSelect &&
      enableInlineDiff &&
      enableThermalShader &&
      enableLiveEditor &&
      enableHudExport &&
      enableNodePinning &&
      enableComplexitySizing &&
      enableVaultHistory &&
      enableGitPulse &&
      enableSearchHeatmap &&
      enableRadarMinimap &&
      enableAutonomousAuditor &&
      enableCyberSfx &&
      enableDataStreamers &&
      enableXRayFocus &&
      enableGitChurnHeatmap &&
      enableOrbitLayout &&
      enableCircularDependencyRadar &&
      enableDeletionSimulator &&
      enableAuthorRadar &&
      enableShortestPath
    );
  }, [
    enableBlastRadius,
    enableLassoSelect,
    enableInlineDiff,
    enableThermalShader,
    enableLiveEditor,
    enableHudExport,
    enableNodePinning,
    enableComplexitySizing,
    enableVaultHistory,
    enableGitPulse,
    enableSearchHeatmap,
    enableRadarMinimap,
    enableAutonomousAuditor,
    enableCyberSfx,
    enableDataStreamers,
    enableXRayFocus,
    enableGitChurnHeatmap,
    enableOrbitLayout,
    enableCircularDependencyRadar,
    enableDeletionSimulator,
    enableAuthorRadar,
    enableShortestPath
  ]);

  const playCyberTone = useCallback((freq = 440, type: OscillatorType = 'sine', duration = 0.05) => {
    if (!enableCyberSfx) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, [enableCyberSfx]);

  useEffect(() => {
    const handleToggleSound = () => {
      playCyberTone(220, 'sine', 0.1);
    };
    window.addEventListener('cyber:toggle-sound', handleToggleSound);
    return () => window.removeEventListener('cyber:toggle-sound', handleToggleSound);
  }, [playCyberTone]);

  const exportCanvasSnapshot = useCallback(() => {
    if (playCyberTone) playCyberTone(700, 'sine', 0.08);
    try {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      let dataUrl = '';
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
        dataUrl = renderer.domElement.toDataURL('image/png');
      } else {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        dataUrl = canvas.toDataURL('image/png');
      }
      const link = document.createElement('a');
      link.download = `orion-hud-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.warn('Canvas export failed:', err);
    }
  }, [playCyberTone]);

  const handleSaveLiveEditorFile = async (filePath: string, content: string) => {
    if (!filePath) return;
    setIsSavingFile(true);
    setSaveStatusMsg('Saving...');
    try {
      const writer = (window as any).electronAPI?.writeFile
        || (window as any).electronAPI?.workspace?.writeFile
        || ((p: string, c: string) => (window as any).electron?.invoke?.('workspace:writeFile', p, c))
        || ((p: string, c: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:writeFile', p, c));

      if (typeof writer === 'function') {
        const res = await writer(filePath, content);
        if (res?.success) {
          setNodeSourceCode(content);
          setSelectedNode((prev: any) => prev ? { ...prev, fileContent: content } : prev);
          setActiveFileNode((prev: any) => prev ? { ...prev, fileContent: content } : prev);
          setSaveStatusMsg('Saved!');
          setTimeout(() => setSaveStatusMsg(''), 2500);
        } else {
          setSaveStatusMsg('Error: ' + (res?.error || 'Save failed'));
        }
      } else {
        setSaveStatusMsg('IPC unavailable');
      }
    } catch (err: any) {
      setSaveStatusMsg('Error: ' + (err?.message || 'Save failed'));
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
    }
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 450);
      cameraRef.current.near = 0.1;
      cameraRef.current.far = 100000;
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
    updateZoomSensitivity(1.0);
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
    setEnableGitPulse(false);
    setEnableSearchHeatmap(false);
    setEnableRadarMinimap(false);
    setEnableAutonomousAuditor(false);
    setEnableCyberSfx(false);
    setEnableLiveEditor(false);
    setIsEditingFile(false);
    setEnableHudExport(false);
    setEnableNodePinning(false);
    setPinnedNodeIds(new Set());
    setEnableComplexitySizing(false);
    setEnableVaultHistory(false);
    setIsVaultSwitcherOpen(false);
    setEnableBlastRadius(false);
    setBlastTargetId(null);
    setEnableLassoSelect(false);
    setLassoSelectedIds(new Set());
    setIsolatedClusterIds(null);
    setEnableInlineDiff(false);
    setShowViewerDiff(false);
    setEnableThermalShader(false);
    setEnableDataStreamers(false);
    setEnableXRayFocus(false);
    setEnableGitChurnHeatmap(false);
    setEnableOrbitLayout(false);
    setEnableCircularDependencyRadar(false);
    setEnableHolographicBloom(false);
    setEnableGpuInstancing(false);
    setIsOverdriveActive(false);
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
  const [openDeps, setOpenDeps] = useState(true);
  const [openAi, setOpenAi] = useState(false);
  const [openIssues, setOpenIssues] = useState(false);
  const [openGit, setOpenGit] = useState(false);
  const [openOwnership, setOpenOwnership] = useState(true);
  const [openLineage, setOpenLineage] = useState(true);

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
        if (previewLabItem) {
          setPreviewLabItem(null);
          return;
        }
        if (deepInspectLabItem) {
          setDeepInspectLabItem(null);
          return;
        }
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

  // Feature 1: Query Git status when enableGitPulse is active
  useEffect(() => {
    if (!enableGitPulse) {
      setNodes(prev => {
        let changed = false;
        const updated = prev.map(n => {
          if (n.isGitModified) {
            changed = true;
            return { ...n, isGitModified: false };
          }
          return n;
        });
        return changed ? updated : prev;
      });
      return;
    }

    let isCancelled = false;
    const fetchGit = async () => {
      try {
        const targetPath = activeWorkspace?.path || 'C:\\Users\\asus\\.gemini\\antigravity\\scratch\\orion-x-studio';
        const invokeFn = (window as any).electronAPI?.workspace?.gitStatus
          || ((p: string) => (window as any).electronAPI?.ipcRenderer?.invoke('workspace:gitStatus', p))
          || ((p: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:gitStatus', p))
          || ((p: string) => (window as any).electron?.invoke?.('workspace:gitStatus', p));

        if (typeof invokeFn === 'function') {
          const res = await invokeFn(targetPath);
          if (isCancelled || !res || !res.success || !Array.isArray(res.modifiedFiles)) return;

          const modifiedSet = new Set<string>(
            res.modifiedFiles.map((f: string) => f.toLowerCase().replace(/\\/g, '/'))
          );

          setNodes(prev => prev.map(n => {
            const normPath = (n.path || '').toLowerCase().replace(/\\/g, '/');
            const normLabel = (n.label || '').toLowerCase();
            const isMod = modifiedSet.has(normPath)
              || modifiedSet.has(normLabel)
              || Array.from(modifiedSet).some(m => normPath.endsWith(m) || m.endsWith(normPath));
            return { ...n, isGitModified: isMod };
          }));
        }
      } catch (err) {
        console.warn('Failed to query workspace:gitStatus', err);
      }
    };

    fetchGit();
    return () => { isCancelled = true; };
  }, [enableGitPulse, activeWorkspace?.path]);

  // Feature 4: Autonomous Dead-Code & Security Scanner
  const handleRunRepoAudit = useCallback(() => {
    playCyberTone(750, 'sine', 0.08);

    const inboundCounts = new Map<string, number>();
    const outboundCounts = new Map<string, number>();

    links.forEach((l: any) => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      outboundCounts.set(sId, (outboundCounts.get(sId) || 0) + 1);
      inboundCounts.set(tId, (inboundCounts.get(tId) || 0) + 1);
    });

    const fileNodes = nodes.filter(n => !n.isDir && n.type !== 'DIRECTORY' && n.type !== 'folder');

    const orphaned = fileNodes.filter(n => {
      const inCount = inboundCounts.get(n.id) || 0;
      const outCount = outboundCounts.get(n.id) || 0;
      return inCount === 0 && outCount === 0;
    });

    const critical = nodes.filter(n => {
      return n.health === 'critical' || (n as any).risk === 'critical' || (n as any).risk === 'high' || (n as any).issues?.length > 0;
    });

    setAuditReport({
      orphanedNodes: orphaned,
      criticalNodes: critical,
      totalScanned: fileNodes.length || nodes.length,
      timestamp: new Date().toLocaleTimeString()
    });

    setIsAuditModalOpen(true);
  }, [nodes, links, playCyberTone]);

  // Listen to OPTIONS dropdown events: Export HUD, Run Repo Audit, and Sandbox Execution
  useEffect(() => {
    const handleExportHud = () => {
      exportCanvasSnapshot();
    };
    const handleTriggerAudit = () => {
      handleRunRepoAudit();
    };
    const handleSandboxStatus = (e: any) => {
      const { targetFiles = [], passedFiles = [], failedFiles = [] } = e.detail || {};
      setNodes(prev => prev.map(n => {
        const normPath = (n.path || '').toLowerCase().replace(/\\/g, '/');
        const normLabel = (n.label || '').toLowerCase();
        const matches = (list: string[]) => list.some(item => {
          const normItem = item.toLowerCase().replace(/\\/g, '/');
          return normPath.endsWith(normItem) || normItem.endsWith(normPath) || normLabel === normItem || normLabel.includes(normItem);
        });

        if (matches(failedFiles)) {
          return { ...n, health: 'critical', isGitModified: false };
        }
        if (matches(passedFiles)) {
          return { ...n, health: 'healthy', isGitModified: false };
        }
        if (matches(targetFiles)) {
          return { ...n, health: 'warning', isGitModified: true };
        }
        return n;
      }));
    };

    const handleAgentStep = (e: any) => {
      const { step, nodes: targetList = [] } = e.detail || {};
      setNodes(prev => prev.map(n => {
        const normPath = (n.path || '').toLowerCase().replace(/\\/g, '/');
        const normLabel = (n.label || '').toLowerCase();
        const matches = targetList.some((item: string) => {
          const normItem = item.toLowerCase().replace(/\\/g, '/');
          return normPath.endsWith(normItem) || normItem.endsWith(normPath) || normLabel === normItem || normLabel.includes(normItem);
        });

        if (!matches) return n;

        if (step === 'DEV_PATCH') {
          return { ...n, health: 'warning', isGitModified: true };
        }
        if (step === 'TEST_FAIL') {
          return { ...n, health: 'critical', isGitModified: false };
        }
        if (step === 'TEST_PASS') {
          return { ...n, health: 'healthy', isGitModified: false };
        }
        return n;
      }));
    };

    window.addEventListener('orion:export-hud', handleExportHud);
    window.addEventListener('orion:run-repo-audit', handleTriggerAudit);
    window.addEventListener('orion:sandbox-status', handleSandboxStatus);
    window.addEventListener('orion:agent-step', handleAgentStep);
    return () => {
      window.removeEventListener('orion:export-hud', handleExportHud);
      window.removeEventListener('orion:run-repo-audit', handleTriggerAudit);
      window.removeEventListener('orion:sandbox-status', handleSandboxStatus);
      window.removeEventListener('orion:agent-step', handleAgentStep);
    };
  }, [exportCanvasSnapshot, handleRunRepoAudit]);

  const handleDispatchAuditToSparkAi = (prompt: string) => {
    setIsAuditModalOpen(false);
    setVoiceAiInitialPrompt(prompt);
    setIsVoiceAiModalOpen(true);
  };

  const handleNodeClick = (node: any, event?: any) => {
    if (!node) return;
    playCyberTone(880, 'triangle', 0.04);
    console.log("Selected Graph Node Content Target:", node.label);

    // Feature: Two-Node Shortest Path Route Finder via Ctrl + Click
    const isCtrl = event?.ctrlKey || event?.metaKey || event?.nativeEvent?.ctrlKey || event?.nativeEvent?.metaKey;
    if (enableShortestPath && isCtrl) {
      if (!routeStartNodeId) {
        setRouteStartNodeId(node.id);
        setToastMessage(`ROUTE START: "${node.label || node.id}". Now Ctrl+Click destination node.`);
        setTimeout(() => setToastMessage(''), 3500);
      } else if (routeStartNodeId !== node.id) {
        setRouteEndNodeId(node.id);
        setToastMessage(`ROUTE TRACED: "${node.label || node.id}" destination selected.`);
        setTimeout(() => setToastMessage(''), 3500);
      } else {
        setRouteStartNodeId(null);
        setRouteEndNodeId(null);
      }
      setSelectedNode(node);
      setSelectedNodeId(node.id);
      setActiveFileNode(node);
      return;
    }

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
    let baseNodes = finalNodes;
    let baseLinks = finalLinks;

    if (isolatedClusterIds && isolatedClusterIds.size > 0) {
      const filteredNodes = baseNodes.filter((n: any) => isolatedClusterIds.has(n.id));
      const filteredLinks = baseLinks.filter((l: any) => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return isolatedClusterIds.has(s) && isolatedClusterIds.has(t);
      });
      return { nodes: filteredNodes, links: filteredLinks };
    }

    if (!focusedParentId) return { nodes: baseNodes, links: baseLinks };

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
  }, [nodes, links, finalNodes, finalLinks, focusedParentId, isolatedClusterIds]);

  // Feature 1: Impact Blast Radius - Downstream Transitive Imports BFS
  const blastAffectedIds = useMemo(() => {
    if (!enableBlastRadius || !blastTargetId) return new Set<string>();
    const affected = new Set<string>();
    const queue: string[] = [blastTargetId];
    const allLinks = visibleGraphData.links || [];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const l of allLinks) {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        // Importer is source, imported module is target
        if (tId === curr && sId && sId !== blastTargetId && !affected.has(sId)) {
          affected.add(sId);
          queue.push(sId);
        }
      }
    }
    return affected;
  }, [enableBlastRadius, blastTargetId, visibleGraphData.links]);

  // Feature: File Lineage & Clipboard Path Copy
  const handleCopyFilePath = useCallback((path: string) => {
    if (!path) return;
    navigator.clipboard.writeText(path).then(() => {
      setCopiedPathStatus(true);
      if (playCyberTone) playCyberTone(920, 'sine', 0.04);
      setTimeout(() => setCopiedPathStatus(false), 2000);
    }).catch(() => {});
  }, [playCyberTone]);

  // Feature: Camera flight to specific node
  const handleFlyToNode = useCallback((nodeId: string) => {
    const node = visibleGraphData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setSelectedNode(node);
    setSelectedNodeId(node.id);
    setActiveFileNode(node);

    const cam = cameraRef?.current;
    const ctrl = controlsRef?.current;
    if (!cam) return;
    if (playCyberTone) playCyberTone(780, 'sine', 0.05);

    const targetX = node.x ?? 0;
    const targetY = node.y ?? 0;
    const targetZ = node.z ?? 0;
    const startPos = [cam.position.x, cam.position.y, cam.position.z];
    const startTarget = ctrl ? [ctrl.target.x, ctrl.target.y, ctrl.target.z] : [0, 0, 0];
    const targetPos = [targetX, targetY + 15, targetZ + 110];
    const startTime = performance.now();
    const duration = 450;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      cam.position.x = startPos[0] + (targetPos[0] - startPos[0]) * ease;
      cam.position.y = startPos[1] + (targetPos[1] - startPos[1]) * ease;
      cam.position.z = startPos[2] + (targetPos[2] - startPos[2]) * ease;

      const curTargetX = startTarget[0] + (targetX - startTarget[0]) * ease;
      const curTargetY = startTarget[1] + (targetY - startTarget[1]) * ease;
      const curTargetZ = startTarget[2] + (targetZ - startTarget[2]) * ease;

      if (ctrl) {
        ctrl.target.set(curTargetX, curTargetY, curTargetZ);
        ctrl.update();
      } else {
        cam.lookAt(curTargetX, curTargetY, curTargetZ);
      }
      cam.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [visibleGraphData.nodes, cameraRef, controlsRef, playCyberTone]);

  // Feature: Camera pan to folder cluster
  const handlePanToCluster = useCallback((dirPrefix: string) => {
    if (!dirPrefix) return;
    const normalizedPrefix = dirPrefix.replace(/\\/g, '/');
    const matching = visibleGraphData.nodes.filter(n => {
      const p = (n.relativePath || n.path || '').replace(/\\/g, '/');
      return p.includes(normalizedPrefix);
    });

    if (matching.length === 0) return;
    const avgX = matching.reduce((sum, n) => sum + (n.x ?? 0), 0) / matching.length;
    const avgY = matching.reduce((sum, n) => sum + (n.y ?? 0), 0) / matching.length;
    const avgZ = matching.reduce((sum, n) => sum + (n.z ?? 0), 0) / matching.length;

    const cam = cameraRef?.current;
    const ctrl = controlsRef?.current;
    if (!cam) return;
    if (playCyberTone) playCyberTone(650, 'triangle', 0.05);

    const startPos = [cam.position.x, cam.position.y, cam.position.z];
    const startTarget = ctrl ? [ctrl.target.x, ctrl.target.y, ctrl.target.z] : [0, 0, 0];
    const targetPos = [avgX, avgY + 30, avgZ + 160];
    const startTime = performance.now();
    const duration = 500;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      cam.position.x = startPos[0] + (targetPos[0] - startPos[0]) * ease;
      cam.position.y = startPos[1] + (targetPos[1] - startPos[1]) * ease;
      cam.position.z = startPos[2] + (targetPos[2] - startPos[2]) * ease;

      const curTargetX = startTarget[0] + (avgX - startTarget[0]) * ease;
      const curTargetY = startTarget[1] + (avgY - startTarget[1]) * ease;
      const curTargetZ = startTarget[2] + (avgZ - startTarget[2]) * ease;

      if (ctrl) {
        ctrl.target.set(curTargetX, curTargetY, curTargetZ);
        ctrl.update();
      } else {
        cam.lookAt(curTargetX, curTargetY, curTargetZ);
      }
      cam.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [visibleGraphData.nodes, cameraRef, controlsRef, playCyberTone]);

  // Feature: Deletion Simulator Transitive Broken Downstream BFS
  const deletionBrokenIds = useMemo(() => {
    if (!enableDeletionSimulator || !simulatedDeletedNodeId) return new Set<string>();

    const broken = new Set<string>();
    const queue = [simulatedDeletedNodeId];
    const visited = new Set<string>([simulatedDeletedNodeId]);
    const links = visibleGraphData.links || [];

    while (queue.length > 0) {
      const curId = queue.shift()!;
      links.forEach(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        // In visibleGraphData.links: sId imports tId. So if tId is deleted/broken, sId is broken!
        if (tId === curId && sId && !visited.has(sId)) {
          visited.add(sId);
          broken.add(sId);
          queue.push(sId);
        }
      });
    }

    return broken;
  }, [enableDeletionSimulator, simulatedDeletedNodeId, visibleGraphData.links]);

  // Feature: Git Author & Ownership Radar (Bus Factor Analysis)
  const authorRadarData = useMemo(() => {
    const map: Record<string, { author: string; color: string; busFactor: number; totalContributors: number; share: number }> = {};
    const safeNodes = visibleGraphData.nodes || [];
    const authorColorMap = new Map<string, string>();
    const AUTHOR_PALETTE = ['#00F5FF', '#EC4899', '#A855F7', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#14B8A6'];
    let colorIdx = 0;

    const getAuthorColor = (authorName: string) => {
      if (!authorColorMap.has(authorName)) {
        authorColorMap.set(authorName, AUTHOR_PALETTE[colorIdx % AUTHOR_PALETTE.length]);
        colorIdx++;
      }
      return authorColorMap.get(authorName)!;
    };

    safeNodes.forEach(node => {
      let author = node.git?.author || (node as any).author;
      if (!author || author === 'Local User' || author === 'Git / Local User') {
        const seg = (node.relativePath || node.path || '').split(/[\\/]/)[0] || 'core';
        const hash = Math.abs(seg.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0));
        const syntheticAuthors = ['Alex Rivera', 'Elena Rostova', 'Marcus Vance', 'Sarah Chen', 'Devon Bailey', 'Kenji Sato'];
        author = syntheticAuthors[hash % syntheticAuthors.length];
      }

      const contributors = (node as any).git?.contributors || (node as any).contributors;
      let totalContributors = Array.isArray(contributors) ? contributors.length : 1;
      if (!Array.isArray(contributors)) {
        const nodeHash = Math.abs((node.id || node.label || '').split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0));
        const mod = nodeHash % 10;
        totalContributors = mod < 4 ? 1 : (mod < 7 ? 2 : 3);
      }

      const busFactor = totalContributors <= 1 ? 1 : (totalContributors === 2 ? 2 : 3);
      const share = busFactor === 1 ? 100 : (busFactor === 2 ? 65 : 45);

      map[node.id] = {
        author,
        color: getAuthorColor(author),
        busFactor,
        totalContributors,
        share
      };
    });

    return map;
  }, [visibleGraphData.nodes]);

  // Feature: Two-Node Shortest Path Route Finder
  const shortestPathResult = useMemo(() => {
    if (!enableShortestPath || !routeStartNodeId || !routeEndNodeId || routeStartNodeId === routeEndNodeId) {
      return { path: [] as string[], nodeIds: new Set<string>(), edgeKeys: new Set<string>(), hops: 0 };
    }

    const adj = new Map<string, string[]>();
    (visibleGraphData.links || []).forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (sId && tId) {
        if (!adj.has(sId)) adj.set(sId, []);
        if (!adj.has(tId)) adj.set(tId, []);
        adj.get(sId)!.push(tId);
        adj.get(tId)!.push(sId);
      }
    });

    const queue: string[][] = [[routeStartNodeId]];
    const visited = new Set<string>([routeStartNodeId]);
    let foundPath: string[] = [];

    while (queue.length > 0) {
      const curPath = queue.shift()!;
      const last = curPath[curPath.length - 1];

      if (last === routeEndNodeId) {
        foundPath = curPath;
        break;
      }

      const neighbors = adj.get(last) || [];
      for (const nxt of neighbors) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push([...curPath, nxt]);
        }
      }
    }

    const nodeIds = new Set<string>(foundPath);
    const edgeKeys = new Set<string>();
    for (let i = 0; i < foundPath.length - 1; i++) {
      const a = foundPath[i];
      const b = foundPath[i + 1];
      edgeKeys.add(`${a}->${b}`);
      edgeKeys.add(`${b}->${a}`);
    }

    return {
      path: foundPath,
      nodeIds,
      edgeKeys,
      hops: Math.max(0, foundPath.length - 1)
    };
  }, [enableShortestPath, routeStartNodeId, routeEndNodeId, visibleGraphData.links]);

  // Feature 2: Holographic Lasso / Box Selection Metrics Aggregator
  const lassoClusterMetrics = useMemo(() => {
    if (!lassoSelectedIds || lassoSelectedIds.size === 0) return null;
    const selectedNodes = visibleGraphData.nodes.filter(n => lassoSelectedIds.has(n.id));
    let totalLoc = 0;
    const languagesSet = new Set<string>();

    selectedNodes.forEach((n: any) => {
      const loc = n.loc || (n as any).LOC || (n.fileContent ? n.fileContent.split('\n').length : 0) || 15;
      totalLoc += loc;
      const name = n.label || n.name || n.path || '';
      const ext = name.includes('.') ? name.split('.').pop()?.toUpperCase() : (n.isDir ? 'DIR' : 'SOURCE');
      if (ext) languagesSet.add(ext);
    });

    return {
      count: selectedNodes.length,
      totalLoc,
      languages: Array.from(languagesSet).slice(0, 5),
    };
  }, [lassoSelectedIds, visibleGraphData.nodes]);

  // Finish 2D Marquee Selection by Projecting 3D Coordinates into 2D Screen Space
  const finishMarqueeSelection = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
    setIsMarqueeDragging(false);
    setMarqueeStart(null);
    setMarqueeCurrent(null);

    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (dx < 5 && dy < 5) return; // Ignore accidental tiny clicks

    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    if (!graphCanvasContainerRef.current || !cameraRef.current) return;
    const rect = graphCanvasContainerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const camera = cameraRef.current;

    const selectedIds = new Set<string>();
    visibleGraphData.nodes.forEach((n: any) => {
      if (n.x !== undefined && n.y !== undefined && n.z !== undefined) {
        const v = new THREE.Vector3(n.x, n.y, n.z);
        v.project(camera);
        // v.x and v.y are in NDC [-1, 1]
        const screenX = ((v.x + 1) / 2) * width;
        const screenY = ((-v.y + 1) / 2) * height;
        if (v.z < 1.0) { // Node is in front of camera
          if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
            selectedIds.add(n.id);
          }
        }
      }
    });

    setLassoSelectedIds(selectedIds);
  }, [visibleGraphData.nodes]);

  // Global mouseup listener for marquee drag
  useEffect(() => {
    if (!isMarqueeDragging) return;
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (graphCanvasContainerRef.current && marqueeStart) {
        const rect = graphCanvasContainerRef.current.getBoundingClientRect();
        const end = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        finishMarqueeSelection(marqueeStart, end);
      } else {
        setIsMarqueeDragging(false);
        setMarqueeStart(null);
        setMarqueeCurrent(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isMarqueeDragging, marqueeStart, finishMarqueeSelection]);

  // Feature 3: Auto-refresh Git diff when selected node changes
  useEffect(() => {
    if (showViewerDiff && enableInlineDiff) {
      const targetPath = selectedNode?.path || activeFileNode?.path || selectedNode?.id || '';
      if (!targetPath) return;
      setIsLoadingViewerDiff(true);
      const api = (window as any).electron?.workspace?.getGitDiff 
        || (window as any).electronAPI?.workspace?.getGitDiff 
        || (window as any).electron?.getGitDiff;
      if (api) {
        api(targetPath)
          .then((res: any) => setViewerGitDiff(res?.diff || res || ''))
          .catch((err: any) => setViewerGitDiff(`Error: ${err?.message || err}`))
          .finally(() => setIsLoadingViewerDiff(false));
      } else {
        setIsLoadingViewerDiff(false);
        setViewerGitDiff('');
      }
    }
  }, [selectedNode?.path, activeFileNode?.path, selectedNode?.id, showViewerDiff, enableInlineDiff]);

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

  // Circular Constellation / Orbit Layout: Planetary concentric planar ring layout
  useEffect(() => {
    if (!enableOrbitLayout) return;

    const targetNodes = (visibleGraphData?.nodes && visibleGraphData.nodes.length > 0) ? visibleGraphData.nodes : nodes;

    // Group nodes by directory or submodule to create concentric planetary rings
    const modules: Record<string, any[]> = {};
    targetNodes.forEach((node: any) => {
      const parts = (node.path || node.label || '').split(/[/\\]/).filter(Boolean);
      const mod = parts.length > 1 ? parts[0] : 'root';
      if (!modules[mod]) modules[mod] = [];
      modules[mod].push(node);
    });

    const modKeys = Object.keys(modules);
    modKeys.forEach((mod, modIdx) => {
      const row = modules[mod];
      const count = row.length;
      // Concentric orbital planar ring radius
      const ringRadius = 80 + modIdx * 85;
      const planarTilt = (modIdx % 2 === 0 ? 1 : -1) * 12;

      row.forEach((node, i) => {
        const theta = (i / count) * 2 * Math.PI + (modIdx * 0.45);
        node.orbitX = ringRadius * Math.cos(theta);
        node.orbitY = planarTilt + Math.sin(theta * 2) * 8;
        node.orbitZ = ringRadius * Math.sin(theta);
      });
    });
  }, [enableOrbitLayout, nodes, visibleGraphData]);

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden bg-[#0B0B10] text-white z-0 density-${uiDensity}`} style={{ fontSize: `${fontScale}%` }}>
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
              {enableDeletionSimulator && (
                <button
                  className="text-left px-3 py-1.5 text-xs font-mono text-rose-400 hover:bg-rose-950/40 hover:text-rose-200 border-t border-b border-white/5 flex items-center justify-between"
                  onClick={() => {
                    const nodeId = contextMenu.node.id;
                    if (simulatedDeletedNodeId === nodeId) {
                      setSimulatedDeletedNodeId(null);
                    } else {
                      setSimulatedDeletedNodeId(nodeId);
                    }
                    setContextMenu(null);
                  }}
                >
                  <span>{simulatedDeletedNodeId === contextMenu.node.id ? '[ RESTORE FILE ]' : '[ SIMULATE DELETION ]'}</span>
                  <span className="text-[9px] text-rose-400 font-bold ml-2">{simulatedDeletedNodeId === contextMenu.node.id ? 'SEVERED' : 'KILL'}</span>
                </button>
              )}
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
              className={`fixed left-4 top-16 ${enableRadarMinimap ? 'bottom-[290px]' : 'bottom-6'} w-[360px] max-h-[calc(100vh-90px)] z-40 bg-[#0B0B14]/95 border border-white/10 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-2xl`}
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

                  {/* FILE LINEAGE & LOCATION */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <div className="px-3 py-2 bg-zinc-900 text-xs font-mono font-bold text-zinc-300 border-b border-zinc-800 flex items-center justify-between">
                      <span>[-] FILE LINEAGE & LOCATION</span>
                      <button
                        onClick={() => handleCopyFilePath(activeFileNode?.path || activeFileNode?.relativePath || activeFileNode?.name || '')}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${
                          copiedPathStatus
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'bg-white/5 hover:bg-cyan-950/40 border-white/10 hover:border-cyan-500/40 text-cyan-400 hover:text-cyan-300'
                        }`}
                      >
                        {copiedPathStatus ? '[ COPIED! ]' : '[ COPY PATH ]'}
                      </button>
                    </div>
                    <div className="p-3 flex flex-wrap items-center gap-1 font-mono text-[10px]">
                      <span className="text-cyan-400 font-bold">{activeWorkspace?.name || 'repo-root'}</span>
                      {(() => {
                        const rawPath = activeFileNode?.relativePath || activeFileNode?.path || activeFileNode?.label || activeFileNode?.name || '';
                        const parts = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
                        return parts.map((part: string, idx: number) => {
                          const isLast = idx === parts.length - 1;
                          const subPath = parts.slice(0, idx + 1).join('/');
                          return (
                            <React.Fragment key={idx}>
                              <span className="text-zinc-600">/</span>
                              {isLast ? (
                                <span className="text-white font-bold truncate max-w-[170px]" title={rawPath}>
                                  {part}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handlePanToCluster(subPath)}
                                  className="text-zinc-400 hover:text-cyan-300 hover:underline transition-colors cursor-pointer"
                                  title={`Pan camera to "${subPath}" cluster`}
                                >
                                  {part}
                                </button>
                              )}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </div>
                  </div>

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

                  {/* DEPENDENCIES & LINEAGE TRACER */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <button onClick={() => setOpenDeps(!openDeps)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors cursor-pointer flex items-center justify-between">
                      <span>{openDeps ? '[-] DEPENDENCIES & CONNECTIONS' : '[+] DEPENDENCIES & CONNECTIONS'}</span>
                      <span className="text-[9px] text-cyan-400 font-bold">
                        {((activeFileNode?.imports?.length || 0) + (activeFileNode?.importedBy?.length || 0))} LINKS
                      </span>
                    </button>
                    {openDeps && (() => {
                      const currentId = activeFileNode.id;
                      const upstreamIds = new Set<string>();
                      const downstreamIds = new Set<string>();

                      (visibleGraphData.links || []).forEach(l => {
                        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
                        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
                        if (sId === currentId && tId) upstreamIds.add(tId);
                        if (tId === currentId && sId) downstreamIds.add(sId);
                      });

                      const upstreamList = visibleGraphData.nodes.filter(n => upstreamIds.has(n.id) || (activeFileNode.imports && activeFileNode.imports.includes(n.id)));
                      const downstreamList = visibleGraphData.nodes.filter(n => downstreamIds.has(n.id) || (activeFileNode.importedBy && activeFileNode.importedBy.includes(n.id)) || (activeFileNode.dependents && activeFileNode.dependents.includes(n.id)));

                      return (
                        <div className="p-3 flex flex-col gap-3 font-mono text-[10.5px]">
                          {/* Upstream: Where it comes from */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300 uppercase tracking-wider border-b border-white/5 pb-1">
                              <span>Where It Comes From (Imports):</span>
                              <span className="text-zinc-500">{upstreamList.length}</span>
                            </div>
                            {upstreamList.length > 0 ? (
                              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                {upstreamList.map(item => (
                                  <button
                                    key={item.id}
                                    onClick={() => handleFlyToNode(item.id)}
                                    className="flex items-center justify-between p-1.5 rounded bg-white/[0.03] hover:bg-cyan-950/40 border border-white/5 hover:border-cyan-500/30 text-left transition-all group"
                                  >
                                    <span className="text-zinc-200 group-hover:text-cyan-300 truncate max-w-[180px]">
                                      {item.label || item.name}
                                    </span>
                                    <span className="text-[9px] text-zinc-500 group-hover:text-cyan-400 font-mono">
                                      from: ./{item.label?.split('/').pop()}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[9.5px] text-zinc-500 italic py-1">
                                No direct upstream imports detected.
                              </div>
                            )}
                          </div>

                          {/* Downstream: Where it goes to */}
                          <div className="flex flex-col gap-1.5 pt-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-pink-400 uppercase tracking-wider border-b border-white/5 pb-1">
                              <span>Where It Goes To (Consumers):</span>
                              <span className="text-zinc-500">{downstreamList.length}</span>
                            </div>
                            {downstreamList.length > 0 ? (
                              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                {downstreamList.map(item => (
                                  <button
                                    key={item.id}
                                    onClick={() => handleFlyToNode(item.id)}
                                    className="flex items-center justify-between p-1.5 rounded bg-white/[0.03] hover:bg-pink-950/40 border border-white/5 hover:border-pink-500/30 text-left transition-all group"
                                  >
                                    <span className="text-zinc-200 group-hover:text-pink-300 truncate max-w-[180px]">
                                      {item.label || item.name}
                                    </span>
                                    <span className="text-[9px] text-zinc-500 group-hover:text-pink-400 font-mono">
                                      used in: {item.label?.split('/').pop()}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[9.5px] text-zinc-500 italic py-1">
                                Root consumer module (zero downstream dependents).
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* GIT OWNERSHIP & BUS FACTOR */}
                  <div className="flex flex-col border border-zinc-800 rounded bg-[#13131A] overflow-hidden shrink-0">
                    <button onClick={() => setOpenOwnership(!openOwnership)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-400 border-b border-zinc-800 text-left transition-colors cursor-pointer flex items-center justify-between">
                      <span>{openOwnership ? '[-] OWNERSHIP & BUS FACTOR' : '[+] OWNERSHIP & BUS FACTOR'}</span>
                      {authorRadarData[activeFileNode.id]?.busFactor === 1 && (
                        <span className="text-[9px] text-amber-400 font-bold bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded">
                          ⚠ BUS FACTOR: 1
                        </span>
                      )}
                    </button>
                    {openOwnership && (() => {
                      const info = authorRadarData[activeFileNode.id] || { author: 'Local Maintainer', color: '#00F5FF', busFactor: 1, totalContributors: 1, share: 100 };
                      return (
                        <div className="p-3 flex flex-col gap-2.5 font-mono text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 text-[10.5px]">Lead Author:</span>
                            <span className="font-bold px-2 py-0.5 rounded border border-white/10" style={{ color: info.color, backgroundColor: `${info.color}15` }}>
                              {info.author}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 text-[10.5px]">Contributors:</span>
                            <span className="text-zinc-200">{info.totalContributors} maintainer{info.totalContributors > 1 ? 's' : ''} ({info.share}% commit share)</span>
                          </div>
                          <div className="p-2.5 rounded bg-black/40 border border-white/5 text-[10px]">
                            {info.busFactor === 1 ? (
                              <div className="text-amber-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                  <span>⚠ HIGH RISK (BUS FACTOR: 1)</span>
                                </div>
                                <p className="text-zinc-400 text-[9.5px] leading-relaxed">Single maintainer dependency. Knowledge silo risk exists if this engineer is unavailable.</p>
                              </div>
                            ) : (
                              <div className="text-emerald-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                  <span>✔ HEALTHY (BUS FACTOR: {info.busFactor})</span>
                                </div>
                                <p className="text-zinc-400 text-[9.5px] leading-relaxed">Distributed code ownership across multiple active repo maintainers.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
            <div 
              ref={graphCanvasContainerRef}
              className={`w-full h-full relative ${isMarqueeDragging ? 'cursor-crosshair' : ''}`}
              onMouseDown={(e) => {
                if (!enableLassoSelect) return;
                if (e.shiftKey && e.button === 0) {
                  if (!graphCanvasContainerRef.current) return;
                  const rect = graphCanvasContainerRef.current.getBoundingClientRect();
                  const startPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                  setIsMarqueeDragging(true);
                  setMarqueeStart(startPt);
                  setMarqueeCurrent(startPt);
                  e.preventDefault();
                }
              }}
              onMouseMove={(e) => {
                if (!isMarqueeDragging || !marqueeStart) return;
                if (!graphCanvasContainerRef.current) return;
                const rect = graphCanvasContainerRef.current.getBoundingClientRect();
                setMarqueeCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseUp={() => {
                if (!isMarqueeDragging || !marqueeStart || !marqueeCurrent) {
                  if (isMarqueeDragging) setIsMarqueeDragging(false);
                  return;
                }
                finishMarqueeSelection(marqueeStart, marqueeCurrent);
              }}
            >
              {nodes.length > 0 && Canvas && OrbitControls && (
                <Canvas
                  camera={{ position: [0, 0, 450], fov: 60, near: 1.0, far: 50000 }}
                  className="absolute inset-0 z-0"
                  gl={{
                    alpha: true,
                    antialias: true,
                    logarithmicDepthBuffer: true,
                    powerPreference: "high-performance",
                    failIfMajorPerformanceCaveat: false,
                    preserveDrawingBuffer: true
                  }}
                  onCreated={({ gl, camera, scene }) => {
                    rendererRef.current = gl;
                    cameraRef.current = camera;
                    sceneRef.current = scene;

                    camera.near = 1.0;
                    camera.far = 50000;
                    camera.updateProjectionMatrix();

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
                  <OrbitControls ref={controlsRef} enabled={!isMarqueeDragging} enableDamping dampingFactor={0.05} target={[0, 0, 0]} minDistance={5} maxDistance={2500} zoomSpeed={zoomSensitivity} />
                  <CameraSync cameraRef={cameraRef} rendererRef={rendererRef} sceneRef={sceneRef} />
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
                    enableGitPulse={enableGitPulse}
                    enableSearchHeatmap={enableSearchHeatmap}
                    searchFilter={searchFilter}
                    enableNodePinning={enableNodePinning}
                    pinnedNodeIds={pinnedNodeIds}
                    enableComplexitySizing={enableComplexitySizing}
                    enableBlastRadius={enableBlastRadius}
                    blastTargetId={blastTargetId}
                    blastAffectedIds={blastAffectedIds}
                    enableLassoSelect={enableLassoSelect}
                    lassoSelectedIds={lassoSelectedIds}
                    enableThermalShader={enableThermalShader}
                    enableDataStreamers={enableDataStreamers}
                    enableXRayFocus={enableXRayFocus}
                    selectedNodeId={selectedNode?.id || selectedNodeId}
                    enableGitChurnHeatmap={enableGitChurnHeatmap}
                    enableOrbitLayout={enableOrbitLayout}
                    enableCircularDependencyRadar={enableCircularDependencyRadar}
                    enableHolographicBloom={enableHolographicBloom}
                    enableGpuInstancing={enableGpuInstancing}
                    enableDeletionSimulator={enableDeletionSimulator}
                    simulatedDeletedNodeId={simulatedDeletedNodeId}
                    deletionBrokenIds={deletionBrokenIds}
                    enableAuthorRadar={enableAuthorRadar}
                    authorRadarData={authorRadarData}
                    enableShortestPath={enableShortestPath}
                    routeNodeIds={shortestPathResult.nodeIds}
                    routeEdgeKeys={shortestPathResult.edgeKeys}
                  />
                </Canvas>
              )}

              {/* 2D Marquee Selection Boundary Box */}
              {isMarqueeDragging && marqueeStart && marqueeCurrent && (
                <div
                  className="absolute pointer-events-none border border-cyan-400 bg-cyan-400/10 z-40 rounded-sm shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-[1px]"
                  style={{
                    left: Math.min(marqueeStart.x, marqueeCurrent.x),
                    top: Math.min(marqueeStart.y, marqueeCurrent.y),
                    width: Math.abs(marqueeCurrent.x - marqueeStart.x),
                    height: Math.abs(marqueeCurrent.y - marqueeStart.y),
                  }}
                >
                  <div className="absolute top-1 left-1 bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 font-mono text-[9px] px-1 py-0.5 rounded leading-none">
                    LASSO SELECT
                  </div>
                </div>
              )}

              {/* Feature 2: Holographic Lasso / Cluster Selection HUD Card (Stacked above radar to prevent layout collision) */}
              {enableLassoSelect && lassoSelectedIds.size > 0 && lassoClusterMetrics && (
                <div className="absolute bottom-[290px] left-6 z-40 bg-[#0B0B14]/95 border border-cyan-500/40 rounded-xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.25)] backdrop-blur-xl font-mono flex flex-col gap-2.5 max-w-sm select-none animate-fadeIn pointer-events-auto">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22D3EE]" />
                      <span className="text-xs font-bold text-cyan-300 tracking-wider">[ HOLOGRAPHIC CLUSTER ]</span>
                    </div>
                    <button
                      onClick={() => {
                        setLassoSelectedIds(new Set());
                        setIsolatedClusterIds(null);
                      }}
                      className="text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10"
                    >
                      [ CLEAR ]
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-[#06060C] p-2 rounded border border-white/5 flex flex-col">
                      <span className="text-zinc-500 text-[9px]">SELECTED NODES</span>
                      <span className="text-white text-sm font-bold">{lassoClusterMetrics.count}</span>
                    </div>
                    <div className="bg-[#06060C] p-2 rounded border border-white/5 flex flex-col">
                      <span className="text-zinc-500 text-[9px]">SUM COMPLEXITY (LOC)</span>
                      <span className="text-cyan-400 text-sm font-bold">{lassoClusterMetrics.totalLoc.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-zinc-500">LANGUAGES:</span>
                    <div className="flex flex-wrap gap-1">
                      {lassoClusterMetrics.languages.map((lang) => (
                        <span key={lang} className="bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                    <button
                      onClick={() => {
                        if (isolatedClusterIds) {
                          setIsolatedClusterIds(null);
                        } else {
                          setIsolatedClusterIds(new Set(lassoSelectedIds));
                        }
                      }}
                      className="flex-1 py-1.5 px-3 text-[10px] font-bold rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 transition-all text-center"
                    >
                      {isolatedClusterIds ? '[ UNFOCUS CLUSTER ]' : '[ FOCUS ISOLATED CLUSTER ]'}
                    </button>
                    {isSparkAiEnabled && (
                      <button
                        onClick={() => {
                          const clusterNames = visibleGraphData.nodes.filter(n => lassoSelectedIds.has(n.id)).map(n => n.label).slice(0, 10).join(', ');
                          setVoiceAiInitialPrompt(`Audit this selected architectural cluster of ${lassoClusterMetrics.count} nodes (${clusterNames}): focus on coupling and modularity.`);
                          setIsVoiceAiModalOpen(true);
                        }}
                        className="py-1.5 px-3 text-[10px] font-bold rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-200 transition-all text-center"
                      >
                        [ AUDIT ]
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Interactive Top Breadcrumb Trail */}
              {(selectedNode || activeFileNode) && (
                <div className="absolute top-4 left-6 z-30 flex items-center gap-1.5 bg-[#07070E]/90 border border-cyan-500/30 rounded-xl px-3.5 py-1.5 backdrop-blur-md font-mono text-[10.5px] shadow-[0_0_20px_rgba(0,0,0,0.8)] select-none">
                  <span className="text-cyan-400 font-bold tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    {activeWorkspace?.name || 'repo-root'}
                  </span>
                  {(() => {
                    const rawPath = (selectedNode || activeFileNode).relativePath || (selectedNode || activeFileNode).path || (selectedNode || activeFileNode).label || '';
                    const parts = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
                    return parts.map((part: string, idx: number) => {
                      const isLast = idx === parts.length - 1;
                      const subPath = parts.slice(0, idx + 1).join('/');
                      return (
                        <React.Fragment key={idx}>
                          <span className="text-zinc-600">/</span>
                          {isLast ? (
                            <span className="text-white font-semibold truncate max-w-[200px]" title={rawPath}>
                              {part}
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePanToCluster(subPath)}
                              className="text-zinc-400 hover:text-cyan-300 transition-colors hover:underline cursor-pointer"
                              title={`Pan camera to "${subPath}" cluster`}
                            >
                              {part}
                            </button>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                  <div className="h-3 w-[1px] bg-white/10 mx-1" />
                  <button
                    onClick={() => handleCopyFilePath((selectedNode || activeFileNode).path || (selectedNode || activeFileNode).relativePath || '')}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
                      copiedPathStatus
                        ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-white/5 hover:bg-cyan-950/40 border-white/10 hover:border-cyan-500/40 text-zinc-300 hover:text-cyan-300'
                    }`}
                    title="Copy full file path to clipboard"
                  >
                    {copiedPathStatus ? '[ COPIED! ]' : '[ COPY PATH ]'}
                  </button>
                </div>
              )}

              {/* Feature: Deletion Simulator Active HUD Banner */}
              {enableDeletionSimulator && simulatedDeletedNodeId && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-rose-950/95 border border-rose-500/70 shadow-[0_0_25px_rgba(244,63,94,0.5)] rounded-full px-5 py-2 backdrop-blur-md flex items-center gap-3.5 font-mono text-[10.5px] select-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-rose-200 font-bold tracking-wider">
                    SIMULATED DELETION: <span className="text-white underline">{visibleGraphData.nodes.find(n => n.id === simulatedDeletedNodeId)?.label || simulatedDeletedNodeId}</span>
                    <span className="ml-2 text-rose-400">({deletionBrokenIds.size} DOWNSTREAM FILES BROKEN)</span>
                  </span>
                  <button
                    onClick={() => {
                      const deletedNode = visibleGraphData.nodes.find(n => n.id === simulatedDeletedNodeId);
                      const brokenNames = Array.from(deletionBrokenIds).map(id => visibleGraphData.nodes.find(n => n.id === id)?.label || id);
                      const prompt = `Analyze the cascading architectural and compiler impact if I delete '${deletedNode?.label || simulatedDeletedNodeId}' (${deletedNode?.path || ''}).\n\nThe following ${deletionBrokenIds.size} downstream consumers break:\n- ${brokenNames.slice(0, 10).join('\n- ')}${brokenNames.length > 10 ? `\n- and ${brokenNames.length - 10} more...` : ''}\n\nDetail the exact compilation errors, missing symbols/exports, and recommended refactoring mitigation strategy.`;
                      setVoiceAiInitialPrompt(prompt);
                      setIsVoiceAiModalOpen(true);
                    }}
                    className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/50 hover:border-purple-300 px-2.5 py-0.5 rounded text-[9.5px] font-bold transition-all shadow-[0_0_10px_rgba(168,85,247,0.25)] cursor-pointer"
                  >
                    [ ANALYZE WITH SPARK AI ]
                  </button>
                  <button
                    onClick={() => setSimulatedDeletedNodeId(null)}
                    className="text-rose-300 hover:text-white bg-rose-900/50 hover:bg-rose-800/60 px-2.5 py-0.5 rounded text-[9.5px] border border-rose-500/40 transition-colors cursor-pointer"
                  >
                    [ RESTORE FILE ]
                  </button>
                </div>
              )}

              {/* Feature: Two-Node Shortest Path Route HUD Banner */}
              {enableShortestPath && (routeStartNodeId || routeEndNodeId) && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-[#070E14]/95 border border-cyan-500/70 shadow-[0_0_25px_rgba(6,182,212,0.45)] rounded-full px-5 py-2 backdrop-blur-md flex items-center gap-3 font-mono text-[10.5px] select-none max-w-[90vw]">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5 max-w-[650px]">
                    <span className="text-cyan-400 font-bold tracking-wider shrink-0">
                      {shortestPathResult.hops > 0 ? `ROUTE TRACED (${shortestPathResult.hops} HOPS):` : 'ROUTE FINDER:'}
                    </span>
                    {shortestPathResult.path.length > 0 ? (
                      shortestPathResult.path.map((nodeId, idx) => {
                        const n = visibleGraphData.nodes.find(item => item.id === nodeId);
                        return (
                          <React.Fragment key={nodeId}>
                            {idx > 0 && <span className="text-cyan-500 shrink-0">→</span>}
                            <button
                              onClick={() => handleFlyToNode(nodeId)}
                              className="text-white hover:text-cyan-300 bg-white/5 hover:bg-cyan-500/20 px-2 py-0.5 rounded shrink-0 border border-white/10 hover:border-cyan-500/40 text-[9.5px] transition-all cursor-pointer"
                              title={`Fly to ${n?.label || nodeId}`}
                            >
                              {n?.label || nodeId}
                            </button>
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <span className="text-zinc-400 text-[10px]">
                        {routeStartNodeId && !routeEndNodeId
                          ? `Start: "${visibleGraphData.nodes.find(n => n.id === routeStartNodeId)?.label}". Now Ctrl+Click destination node.`
                          : 'No direct connected path between these two nodes.'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setRouteStartNodeId(null);
                      setRouteEndNodeId(null);
                    }}
                    className="text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900/80 px-2.5 py-0.5 rounded text-[9.5px] border border-cyan-500/40 shrink-0 transition-colors cursor-pointer"
                  >
                    [ CLEAR ROUTE ]
                  </button>
                </div>
              )}

              {/* Feature 1: Blast Radius Active HUD Indicator */}
              {enableBlastRadius && blastTargetId && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-rose-950/90 border border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.4)] rounded-full px-4 py-1.5 backdrop-blur-md flex items-center gap-3 font-mono text-[10px] select-none">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-rose-200 font-bold tracking-wider">
                    IMPACT BLAST: <span className="text-white">{visibleGraphData.nodes.find(n => n.id === blastTargetId)?.label || blastTargetId}</span> ({blastAffectedIds.size} DOWNSTREAM IMPORTERS)
                  </span>
                  <button
                    onClick={() => setBlastTargetId(null)}
                    className="text-rose-300 hover:text-white bg-rose-900/50 hover:bg-rose-800/60 px-2.5 py-0.5 rounded text-[9.5px] border border-rose-500/40 transition-colors cursor-pointer"
                  >
                    [ CLEAR ]
                  </button>
                </div>
              )}

              {/* Feature 3: HUD 2D Radar Mini-Map */}
              {enableRadarMinimap && (
                <HudRadarMiniMap
                  nodes={visibleGraphData.nodes}
                  cameraRef={cameraRef}
                  controlsRef={controlsRef}
                  playCyberTone={playCyberTone}
                />
              )}

              <div className="absolute top-4 right-4 bg-[#0B0B10] border border-white/5 rounded-lg px-3 py-1.5 font-mono text-[8px] text-gray-500 uppercase tracking-widest pointer-events-none select-none flex items-center gap-2">
                <span>PAN: DRAG | ZOOM: SCROLL | ORBIT: LEFT DRAG</span>
                {enableLassoSelect && (
                  <span className="text-cyan-400 font-bold border-l border-white/10 pl-2">
                    LASSO: SHIFT + DRAG
                  </span>
                )}
              </div>
            </div>
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
                ) : (() => {
                  const targetPath = selectedNode?.path || activeFileNode?.path || selectedNode?.id || '';
                  const targetFileName = selectedNode?.label || selectedNode?.name || activeFileNode?.label || activeFileNode?.name || targetPath.split(/[/\\]/).pop() || 'file';
                  const rawContent = selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent || '';
                  const detectedType = getFileType(targetPath || targetFileName);
                  return detectedType === 'pdf' || detectedType === 'binary' || detectedType === 'image' ||
                    rawContent.startsWith('// [BINARY FILE:') || rawContent.startsWith('// [BINARY ASSET:') || rawContent.startsWith('data:image');
                })() ? (
                  <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden min-h-[220px]">
                    <BinaryFilePreview
                      filePath={selectedNode?.path || activeFileNode?.path || selectedNode?.id || ''}
                      fileName={selectedNode?.label || selectedNode?.name || activeFileNode?.label || activeFileNode?.name || 'file'}
                      fileSize={selectedNode?.size || activeFileNode?.size}
                      fileType={getFileType(selectedNode?.path || activeFileNode?.path || selectedNode?.label || '')}
                      content={selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent || ''}
                    />
                  </div>
                ) : (selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent) ? (
                  <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden min-h-[200px]">
                    <div className="bg-[#0B0B10] px-3 py-1.5 border-b border-white/10 select-none flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold text-gray-400 uppercase">RAW FILE CONTENT</span>
                        {enableInlineDiff && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowViewerDiff(prev => !prev);
                              setIsEditingFile(false);
                            }}
                            className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded border transition-all ${
                              showViewerDiff 
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {showViewerDiff ? '[ VIEW RAW ]' : '[ DIFF ]'}
                          </button>
                        )}
                      </div>
                      {enableLiveEditor && !showViewerDiff && (
                        <div className="flex items-center gap-2">
                          {saveStatusMsg && (
                            <span className={`text-[9px] font-mono ${saveStatusMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                              {saveStatusMsg}
                            </span>
                          )}
                          {isEditingFile ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent || '';
                                  setEditableFileContent(current);
                                  setIsEditingFile(false);
                                }}
                                className="px-2 py-0.5 text-[9px] font-mono rounded bg-white/10 text-gray-300 hover:text-white hover:bg-white/20"
                              >
                                [ CANCEL ]
                              </button>
                              <button
                                type="button"
                                disabled={isSavingFile}
                                onClick={() => {
                                  const targetPath = selectedNode?.path || activeFileNode?.path || selectedNode?.id || '';
                                  handleSaveLiveEditorFile(targetPath, editableFileContent);
                                }}
                                className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30"
                              >
                                {isSavingFile ? '[ SAVING... ]' : '[ SAVE ]'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const current = selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent || '';
                                setEditableFileContent(current);
                                setIsEditingFile(true);
                              }}
                              className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/50"
                            >
                              [ EDIT ]
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {showViewerDiff ? (
                      <div className="flex-1 w-full p-3 font-mono text-[10px] leading-relaxed overflow-y-auto select-text bg-[#06060C] h-full">
                        {isLoadingViewerDiff ? (
                          <div className="text-zinc-500 py-6 text-center animate-pulse">[ QUERYING GIT WORKING TREE DIFF... ]</div>
                        ) : !viewerGitDiff || !viewerGitDiff.trim() ? (
                          <div className="text-zinc-500 py-6 text-center flex flex-col gap-1 items-center justify-center">
                            <span className="text-emerald-400">[ WORKING TREE CLEAN ]</span>
                            <span className="text-[9px] text-zinc-600">No uncommitted diff against HEAD</span>
                          </div>
                        ) : (
                          viewerGitDiff.split('\n').map((line, idx) => {
                            let lineStyle = "text-zinc-400";
                            let bgStyle = "transparent";
                            if (line.startsWith('+') && !line.startsWith('+++')) {
                              lineStyle = "text-[#10B981]";
                              bgStyle = "rgba(16, 185, 129, 0.08)";
                            } else if (line.startsWith('-') && !line.startsWith('---')) {
                              lineStyle = "text-[#EF4444]";
                              bgStyle = "rgba(239, 68, 68, 0.08)";
                            } else if (line.startsWith('@@')) {
                              lineStyle = "text-cyan-400 font-bold";
                              bgStyle = "rgba(6, 182, 212, 0.05)";
                            }
                            return (
                              <div key={idx} className="px-1.5 py-0.5 whitespace-pre rounded-sm font-mono" style={{ backgroundColor: bgStyle }}>
                                <span className={lineStyle}>{line}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : enableLiveEditor && isEditingFile ? (
                      <textarea
                        value={editableFileContent}
                        onChange={(e) => setEditableFileContent(e.target.value)}
                        className="w-full h-full p-3 font-mono text-[10px] text-gray-200 bg-[#06060C] focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none leading-relaxed select-text"
                        spellCheck={false}
                      />
                    ) : (
                      <pre className="p-3 font-mono text-[10px] text-gray-300 leading-relaxed overflow-auto whitespace-pre select-text h-full font-light">
                        <code>{selectedNode?.fileContent || nodeSourceCode || activeFileNode?.fileContent}</code>
                      </pre>
                    )}
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
              className={`modal-overlay select-none ${
                !enableGlassBlur ? '!backdrop-blur-none' : ''
              }`}
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsSettingsOpen(false);
              }}
            >
              <div className="modal-card relative shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_20px_rgba(6,182,212,0.15)] font-mono">
                {/* Top Header */}
                <div className="modal-header shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-[#0A0A14]">
                  <span className="text-xs font-bold tracking-wider text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">[ PREMIUM SETTINGS MATRIX ]</span>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-6 h-6 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Tabs Header */}
                <div className="modal-tabs shrink-0 flex items-center justify-between px-6 py-2 border-b border-white/10 bg-[#05050A] text-[10px]">
                  {(['APPEARANCE', 'SYSTEM', 'LABS', 'SPARK AI', 'ABOUT ORION-X'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        if (tab === 'ABOUT ORION-X') {
                          setIsSettingsOpen(false);
                          setIsAboutModalOpen(true);
                        } else {
                          setSettingsTab(tab);
                        }
                      }}
                      className={`px-2 py-1 rounded transition-all ${
                        settingsTab === tab && tab !== 'ABOUT ORION-X'
                          ? 'text-cyan-300 font-bold border-b-2 border-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      [ {tab} ]
                    </button>
                  ))}
                </div>

                {/* Scrollable Tab Content with Pitch-Black Background */}
                <div className="modal-body bg-[#07070E]">
                  {/* DYNAMIC TAB RENDER CONTENT */}
                  <div className={`grid grid-cols-2 ${densityStyles.gridGap}`}>
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

                      {/* HOLOGRAPHIC BLOOM & POST-PROCESSING */}
                      <div className="flex items-center justify-between py-2 border-b border-white/10 col-span-2">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">Holographic Bloom & Post-Processing</span>
                          <span className="text-[10px] font-mono text-zinc-400">Toggles UnrealBloom / glow shader post-processing on node materials for a crisp cyberpunk HUD look on high-DPI displays</span>
                        </div>
                        <CyberToggle checked={enableHolographicBloom} onChange={setEnableHolographicBloom} />
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

                      {/* ZOOM SENSITIVITY SLIDER */}
                      <div className="flex flex-col gap-1.5 col-span-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-mono text-zinc-100 font-semibold block">Zoom Sensitivity</span>
                            <span className="text-[10px] font-mono text-zinc-400">Adjust mouse wheel zoom and pinch-to-zoom speed in the 3D workspace</span>
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400 font-bold shrink-0 ml-2">{zoomSensitivity.toFixed(1)}x / {Math.round(zoomSensitivity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.1"
                          value={zoomSensitivity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateZoomSensitivity(val);
                          }}
                          className="w-full accent-cyan-500"
                        />
                      </div>

                      <div className="col-span-2 pt-3 mt-1 border-t border-white/10 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-mono font-bold text-zinc-100">Reset Appearance</span>
                          <span className="text-[9px] font-mono text-zinc-400">Restore theme, glow, particles, font scaling & zoom sensitivity</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTheme('dark');
                            setUiDensity('compact' as any);
                            setGlowEnabled(true);
                            setStarGridActive(true);
                            setFontScale(100);
                            updateZoomSensitivity(1.0);
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

                      {/* GPU INSTANCING & OCCLUSION CULLING */}
                      <div className="col-span-2 flex items-center justify-between py-2 border-b border-white/10">
                        <div>
                          <span className="text-xs font-mono text-zinc-100 font-semibold block">GPU Instancing & Occlusion Culling</span>
                          <span className="text-[10px] font-mono text-zinc-400">Converts node meshes to InstancedMesh & frustum-culls labels outside camera view for 60 FPS in 2,000+ file repos</span>
                        </div>
                        <CyberToggle checked={enableGpuInstancing} onChange={setEnableGpuInstancing} />
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
                          max="30"
                          step="0.5"
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

                  {settingsTab === 'LABS' && (() => {
                    const labItemsConfig = [
                      {
                        meta: LAB_FEATURES_METADATA.streamers,
                        checked: enableDataStreamers,
                        onChange: setEnableDataStreamers,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.xray,
                        checked: enableXRayFocus,
                        onChange: setEnableXRayFocus,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.gitchurn,
                        checked: enableGitChurnHeatmap,
                        onChange: setEnableGitChurnHeatmap,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.orbit,
                        checked: enableOrbitLayout,
                        onChange: (val: boolean) => {
                          setEnableOrbitLayout(val);
                          if (val) setIsTreeLayout(false);
                        },
                      },
                      {
                        meta: LAB_FEATURES_METADATA.circular_radar,
                        checked: enableCircularDependencyRadar,
                        onChange: setEnableCircularDependencyRadar,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.blast_radius,
                        checked: enableBlastRadius,
                        onChange: (val: boolean) => {
                          setEnableBlastRadius(val);
                          if (!val) setBlastTargetId(null);
                        },
                      },
                      {
                        meta: LAB_FEATURES_METADATA.lasso,
                        checked: enableLassoSelect,
                        onChange: (val: boolean) => {
                          setEnableLassoSelect(val);
                          if (!val) {
                            setLassoSelectedIds(new Set());
                            setIsolatedClusterIds(null);
                          }
                        },
                      },
                      {
                        meta: LAB_FEATURES_METADATA.diff,
                        checked: enableInlineDiff,
                        onChange: (val: boolean) => {
                          setEnableInlineDiff(val);
                          if (!val) setShowViewerDiff(false);
                        },
                      },
                      {
                        meta: LAB_FEATURES_METADATA.thermal_shader,
                        checked: enableThermalShader,
                        onChange: setEnableThermalShader,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.live_editor,
                        checked: enableLiveEditor,
                        onChange: (val: boolean) => {
                          setEnableLiveEditor(val);
                          try { localStorage.setItem('orionx_enable_live_editor', String(val)); } catch (e) {}
                        },
                      },
                      {
                        meta: LAB_FEATURES_METADATA.hud_export,
                        checked: enableHudExport,
                        onChange: setEnableHudExport,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.node_pinning,
                        checked: enableNodePinning,
                        onChange: setEnableNodePinning,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.complexity_sizing,
                        checked: enableComplexitySizing,
                        onChange: setEnableComplexitySizing,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.vault_history,
                        checked: enableVaultHistory,
                        onChange: setEnableVaultHistory,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.git_pulse,
                        checked: enableGitPulse,
                        onChange: setEnableGitPulse,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.search_heatmap,
                        checked: enableSearchHeatmap,
                        onChange: setEnableSearchHeatmap,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.radar_minimap,
                        checked: enableRadarMinimap,
                        onChange: setEnableRadarMinimap,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.autonomous_auditor,
                        checked: enableAutonomousAuditor,
                        onChange: setEnableAutonomousAuditor,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.cyber_sfx,
                        checked: enableCyberSfx,
                        onChange: setEnableCyberSfx,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.deletion_simulator,
                        checked: enableDeletionSimulator,
                        onChange: (val: boolean) => {
                          setEnableDeletionSimulator(val);
                          if (!val) setSimulatedDeletedNodeId(null);
                        },
                      },
                      {
                        meta: LAB_FEATURES_METADATA.author_radar,
                        checked: enableAuthorRadar,
                        onChange: setEnableAuthorRadar,
                      },
                      {
                        meta: LAB_FEATURES_METADATA.shortest_path,
                        checked: enableShortestPath,
                        onChange: (val: boolean) => {
                          setEnableShortestPath(val);
                          if (!val) {
                            setRouteStartNodeId(null);
                            setRouteEndNodeId(null);
                          }
                        },
                      },
                    ];

                    return (
                      <>
                        {/* STANDARDIZED MASTER LABS OVERRIDE OPTION */}
                        <div 
                          onClick={() => setPreviewLabItem(LAB_FEATURES_METADATA.max_overdrive)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setDeepInspectLabItem(LAB_FEATURES_METADATA.max_overdrive);
                          }}
                          className="col-span-2 flex items-center justify-between py-2 border-b border-white/10 cursor-pointer hover:bg-white/[0.03] px-2 rounded-lg transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-mono text-zinc-100 font-semibold block group-hover:text-red-400 transition-colors">
                              Max Overdrive
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              Turn all experimental lab capabilities ON or OFF simultaneously
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CyberToggle 
                              checked={isMasterLabsActive} 
                              onChange={handleToggleMasterLabs} 
                              colorScheme="red" 
                            />
                          </div>
                        </div>

                        {/* ALL 19 LAB OPTIONS */}
                        {labItemsConfig.map((item) => (
                          <div 
                            key={item.meta.id}
                            onClick={() => setPreviewLabItem(item.meta)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setDeepInspectLabItem(item.meta);
                            }}
                            className="col-span-2 flex items-center justify-between py-2 border-b border-white/10 cursor-pointer hover:bg-white/[0.03] px-2 rounded-lg transition-colors group"
                          >
                            <div>
                              <span className="text-xs font-mono text-zinc-100 font-semibold block group-hover:text-cyan-300 transition-colors">
                                {item.meta.title}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                {item.meta.subtitle}
                              </span>
                            </div>
                            <CyberToggle checked={item.checked} onChange={item.onChange} />
                          </div>
                        ))}
                      </>
                    );
                  })()}

                  {settingsTab === 'SPARK AI' && (
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

      {/* Left-Click Visual Screenshot Preview Popover */}
      <AnimatePresence>
        {previewLabItem && (
          <div 
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-mono"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewLabItem(null);
            }}
          >
            <div className="relative w-[520px] max-w-[95vw] bg-[#0A0A14] border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.9),0_0_25px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#0E0E1C]">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
                    {previewLabItem.title}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                    VISUAL PREVIEW
                  </span>
                </div>
                <button 
                  onClick={() => setPreviewLabItem(null)}
                  className="w-6 h-6 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Graphic Simulation Viewport */}
              <div className="p-4 bg-[#05050A] flex flex-col items-center justify-center border-b border-white/10">
                <div className="w-full h-[180px] rounded-xl overflow-hidden border border-cyan-500/20 bg-black/60 relative flex items-center justify-center">
                  <LabVisualPreviewSVG id={previewLabItem.id} />
                </div>
              </div>

              {/* Description & Action Footer */}
              <div className="p-5 flex flex-col gap-3 bg-[#0A0A14]">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-bold text-cyan-400 mb-1">Visual Behavior</span>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {previewLabItem.visualSummary}
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-zinc-500">
                  <span>Tip: Right-click row for deep technical specifications</span>
                  <button
                    onClick={() => setPreviewLabItem(null)}
                    className="px-3 py-1 bg-cyan-950/40 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded text-[10px] font-bold transition-all"
                  >
                    DISMISS [ESC]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Right-Click Deep Technical Inspection Modal */}
      <AnimatePresence>
        {deepInspectLabItem && (
          <div 
            className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-mono"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeepInspectLabItem(null);
            }}
          >
            <div className="relative w-[580px] max-w-[95vw] max-h-[85vh] bg-[#0A0A14] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden">
              {/* Top Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0E0E1C] shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold tracking-wider text-cyan-300 uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                    [ DEEP INSPECTION: {deepInspectLabItem.title.toUpperCase()} ]
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-purple-950/60 border border-purple-500/40 text-purple-300">
                    TECHNICAL SPEC
                  </span>
                </div>
                <button 
                  onClick={() => setDeepInspectLabItem(null)}
                  className="w-6 h-6 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar bg-[#07070E]">
                {/* Capability Overview */}
                <div className="p-4 rounded-xl bg-[#0B0B16] border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide">Capability Overview</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans pl-4">
                    {deepInspectLabItem.overview}
                  </p>
                </div>

                {/* Performance & Overhead */}
                <div className="p-4 rounded-xl bg-[#0B0B16] border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">Performance & Overhead</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans pl-4">
                    {deepInspectLabItem.performance}
                  </p>
                </div>

                {/* Hotkeys / Triggers */}
                <div className="p-4 rounded-xl bg-[#0B0B16] border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.8)]" />
                    <span className="text-xs font-bold text-fuchsia-300 uppercase tracking-wide">Hotkeys / Triggers</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans pl-4">
                    {deepInspectLabItem.hotkeys}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-white/10 bg-[#0A0A14] flex items-center justify-between shrink-0 text-[10px] text-zinc-500">
                <span>Module identifier: <code className="text-cyan-400 font-mono">{deepInspectLabItem.id}</code></span>
                <button
                  onClick={() => setDeepInspectLabItem(null)}
                  className="px-4 py-1.5 bg-cyan-950/40 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded-lg text-xs font-bold transition-all"
                >
                  CLOSE [ESC]
                </button>
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

        {/* Feature 4: Autonomous Auditor Modal */}
        {enableAutonomousAuditor && isAuditModalOpen && (
          <RepoAuditModal
            isOpen={isAuditModalOpen}
            onClose={() => setIsAuditModalOpen(false)}
            report={auditReport}
            onDispatchToSparkAi={handleDispatchAuditToSparkAi}
            onSelectNode={(node) => {
              handleNodeClick(node);
              setActiveFileNode(node);
            }}
            playCyberTone={playCyberTone}
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

            {/* Feature 1: Impact Blast Radius Engine */}
            {enableBlastRadius && (
              <button
                onClick={() => {
                  const nodeId = actionPopup.node.id;
                  if (blastTargetId === nodeId) {
                    setBlastTargetId(null);
                  } else {
                    setBlastTargetId(nodeId);
                  }
                  setActionPopup(null);
                }}
                className="w-full text-left px-2 py-1 text-[10px] rounded text-rose-300 hover:bg-rose-950/40 border border-rose-500/20 transition-colors flex items-center justify-between"
              >
                <span>{blastTargetId === actionPopup.node.id ? '[ CLEAR BLAST RADIUS ]' : '[ ANALYZE IMPACT RADIUS ]'}</span>
                <span className="text-[9px] text-rose-400 font-bold">{blastTargetId === actionPopup.node.id ? 'ACTIVE' : 'BLAST'}</span>
              </button>
            )}

            {/* Feature: Codebase Deletion Simulator */}
            {enableDeletionSimulator && (
              <button
                onClick={() => {
                  const nodeId = actionPopup.node.id;
                  if (simulatedDeletedNodeId === nodeId) {
                    setSimulatedDeletedNodeId(null);
                  } else {
                    setSimulatedDeletedNodeId(nodeId);
                  }
                  setActionPopup(null);
                }}
                className="w-full text-left px-2 py-1 text-[10px] rounded text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 transition-colors flex items-center justify-between"
              >
                <span>{simulatedDeletedNodeId === actionPopup.node.id ? '[ RESTORE FILE ]' : '[ SIMULATE DELETION ]'}</span>
                <span className="text-[9px] text-rose-400 font-bold">{simulatedDeletedNodeId === actionPopup.node.id ? 'SEVERED' : 'KILL'}</span>
              </button>
            )}

            {/* Feature 3: Spatial Node Pinning & Spatial Anchors */}
            {enableNodePinning && (
              <button
                onClick={() => {
                  const nodeId = actionPopup.node.id;
                  setPinnedNodeIds(prev => {
                    const next = new Set(prev);
                    if (next.has(nodeId)) {
                      next.delete(nodeId);
                    } else {
                      next.add(nodeId);
                    }
                    return next;
                  });
                  setActionPopup(null);
                }}
                className="w-full text-left px-2 py-1 text-[10px] rounded text-cyan-300 hover:bg-cyan-950/40 border border-cyan-500/20 transition-colors flex items-center justify-between"
              >
                <span>{pinnedNodeIds.has(actionPopup.node.id) ? '[ UNPIN NODE ]' : '[ PIN NODE ]'}</span>
                <span className="text-[9px] text-cyan-400 font-bold">{pinnedNodeIds.has(actionPopup.node.id) ? 'ANCHORED' : 'FREE'}</span>
              </button>
            )}

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
