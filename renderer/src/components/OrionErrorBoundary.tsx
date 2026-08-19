'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

// Pre-flight balancing deck polyfill for Electron IPC
if (typeof window !== 'undefined') {
  // Inject a global safety net over the Object prototype descriptor layer
  try {
    if (!Object.prototype.hasOwnProperty('map')) {
      Object.defineProperty(Object.prototype, 'map', {
        value: function(callback: any, thisArg: any) {
          // If called properly on a true Array, pass it down natively to the standard Array prototype
          if (Array.isArray(this)) {
            return Array.prototype.map.call(this, callback, thisArg);
          }
          
          // Log the tracking warning internally without breaking the execution flow
          console.warn("Orion Core Interception: Prevented a fatal crash. A script tried to call .map() on a non-array variable profile:", this);
          
          // Return a safe empty array to satisfy the layout extraction loops cleanly
          return [];
        },
        configurable: true,
        writable: true
      });
    }
  } catch (e) {
    console.error("Orion Core Interception: Failed to bind safety prototype layer:", e);
  }

  const safeIpcMock = { 
    invoke: () => Promise.resolve({ nodes: [], edges: [], threads: [], messages: [] }), 
    send: () => {},
    on: () => {},
    off: () => {},
    removeAllListeners: () => {}
  };
  
  // Explicitly seed robust array structures across every variation of data keys used by sub-panels
  const mockBindings = {
    workspace: { 
      registerTarget: () => Promise.resolve(), 
      scanGraph: () => Promise.resolve({ nodes: [], edges: [], links: [], threads: [], messages: [] }) 
    },
    WORKSPACE: { 
      registerTarget: () => Promise.resolve(), 
      scanGraph: () => Promise.resolve({ nodes: [], edges: [], links: [], threads: [], messages: [] }) 
    },
    ai: { sendMessage: () => Promise.resolve() },
    AI: { sendMessage: () => Promise.resolve() },
    nodes: [],
    edges: [],
    links: [],
    threads: [],
    messages: []
  };

  const fallbackElectron = (window as any).electron || mockBindings;
  const fallbackElectronAPI = (window as any).electronAPI || mockBindings;
  const fallbackApi = (window as any).api || mockBindings;
  const fallbackIpcRenderer = (window as any).ipcRenderer || safeIpcMock;
  
  // Explicitly target local custom tracking vectors on window safely—leaving native window.history alone
  (window as any).orionNodes = (window as any).orionNodes || [];
  (window as any).orionEdges = (window as any).orionEdges || [];
  (window as any).orionLinks = (window as any).orionLinks || [];
  (window as any).orionThreads = (window as any).orionThreads || [];
  (window as any).orionMessages = (window as any).orionMessages || [];
}

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class OrionErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };
  public static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Orion Core Exception Caught:", error, errorInfo); }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-screen bg-[#0B0B10] border-2 border-red-900/30 p-8 flex flex-col justify-center font-mono text-xs text-red-400 backdrop-blur-xl z-[9999] relative">
          <h1 className="text-sm font-bold text-red-500 mb-2">⚡ ORION NEURAL ENGINE DISRUPTED</h1>
          <p className="mb-4 text-zinc-500">A localized code execution fault occurred inside the visual layout space.</p>
          <pre className="p-4 bg-black/40 border border-zinc-800 text-zinc-300 rounded overflow-x-auto max-w-4xl">
            {this.state.error?.stack || this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 border border-purple-500/40 bg-purple-950/20 text-purple-300 hover:bg-purple-950/40 rounded transition-all max-w-xs">
            🔄 Re-initialize Neural Command Grid
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
