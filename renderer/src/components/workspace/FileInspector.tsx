'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';

export function FileInspector() {
  const { selectedNode, setSelectedNode, setActiveFileContext } = useWorkspaceUi();

  if (!selectedNode) return null;

  const handleFixNode = () => {
    // Dispatch event to NeuralGraphDashboard to fix the node in the canvas
    window.dispatchEvent(new CustomEvent('orion:fix-node', { detail: selectedNode.id }));
    setSelectedNode({ ...selectedNode, health: 'healthy' });
  };

  const handleClose = () => {
    setSelectedNode(null);
    setActiveFileContext(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full bg-black/40 backdrop-blur-3xl p-4 flex flex-col gap-4 relative select-text overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-3 select-none shrink-0">
        <div className="flex flex-col">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider truncate max-w-[200px]">
            {selectedNode.label}
          </span>
          {selectedNode.health === 'critical' ? (
            <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest mt-0.5 animate-pulse">
              SECURITY INTRUSION WARNING
            </span>
          ) : (
            <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest mt-0.5">
              {selectedNode.isDir ? 'DIRECTORY CONTEXT' : 'SOURCE CODE VIEW'}
            </span>
          )}
        </div>
        <button 
          onClick={handleClose}
          className="text-gray-500 hover:text-white transition-colors duration-200 text-xs font-mono"
        >
          CLOSE
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
        {(selectedNode.health === 'critical' || selectedNode.health === 'warning') ? (
          <>
            {selectedNode.oldCode && selectedNode.newCode && (
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="flex flex-col bg-red-950/20 border border-red-500/20 rounded-xl overflow-hidden h-[150px]">
                  <div className="bg-red-500/10 px-3 py-1.5 border-b border-red-500/10 select-none">
                    <span className="font-mono text-[9px] font-bold text-red-400 uppercase">OLD CODE</span>
                  </div>
                  <pre className="p-3 font-mono text-[9px] text-red-300 leading-normal overflow-auto whitespace-pre select-text h-full">
                    <code>{selectedNode.oldCode}</code>
                  </pre>
                </div>
                <div className="flex flex-col bg-green-950/20 border border-green-500/20 rounded-xl overflow-hidden h-[150px]">
                  <div className="bg-green-500/10 px-3 py-1.5 border-b border-green-500/10 select-none">
                    <span className="font-mono text-[9px] font-bold text-green-400 uppercase">SUGGESTED FIX</span>
                  </div>
                  <pre className="p-3 font-mono text-[9px] text-green-300 leading-normal overflow-auto whitespace-pre select-text h-full">
                    <code>{selectedNode.newCode}</code>
                  </pre>
                </div>
              </div>
            )}

            <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2 shrink-0">
              <span className="font-mono text-[9px] font-bold text-purple-400 uppercase tracking-wider select-none">
                Vulnerability Details
              </span>
              <ul className="list-disc pl-4 font-mono text-[9px] text-gray-300 flex flex-col gap-1.5">
                {selectedNode.explanation?.map((exp: string, i: number) => (
                  <li key={i} className="leading-relaxed">{exp}</li>
                ))}
                {!selectedNode.explanation && (
                  <li className="leading-relaxed text-yellow-500">Live scanning analysis pending for this file context...</li>
                )}
              </ul>
            </div>
          </>
        ) : selectedNode.fileContent ? (
          <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden min-h-[150px]">
            <div className="bg-black/40 px-3 py-1.5 border-b border-white/10 select-none">
               <span className="font-mono text-[9px] font-bold text-gray-400 uppercase">RAW FILE CONTENT</span>
            </div>
            <pre className="p-3 font-mono text-[10px] text-gray-300 leading-relaxed overflow-auto whitespace-pre select-text h-full font-light">
              <code>{selectedNode.fileContent}</code>
            </pre>
          </div>
        ) : selectedNode.isDir ? (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <span className="text-[10px] font-mono text-gray-500">
              Directory Node selected. Expand child nodes to inspect source files.
            </span>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-6 flex-col gap-3">
            <span className="w-6 h-6 rounded-full border-t-2 border-cyber-500 animate-spin" />
            <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
              Loading File Stream...
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-white/5 pt-3 flex gap-3 select-none shrink-0">
        <button
          onClick={handleClose}
          className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 font-mono text-[10px] font-bold uppercase text-gray-400 tracking-wider transition-colors duration-200"
        >
          {selectedNode.health === 'critical' ? 'Discard' : 'Close Viewer'}
        </button>
        {selectedNode.health === 'critical' && (
          <button
            onClick={handleFixNode}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 border border-green-400/20 shadow-green-glow rounded-xl py-2 font-mono text-[10px] font-bold uppercase text-white tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            ✔ Fix Vulnerability
          </button>
        )}
      </div>
    </motion.div>
  );
}
