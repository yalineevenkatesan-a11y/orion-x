'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';
import { DatasetExplorer, isDatasetFile } from './DatasetExplorer';

export function FileInspector({ 
  enableLiveEditor = false,
  enableInlineDiff = false
}: { 
  enableLiveEditor?: boolean;
  enableInlineDiff?: boolean;
}) {
  const { selectedNode, setSelectedNode, setActiveFileContext } = useWorkspaceUi();
  const [content, setContent] = useState<string>(selectedNode?.fileContent || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editBuffer, setEditBuffer] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [gitDiffText, setGitDiffText] = useState<string>('');
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);

  const isLiveEditorActive = enableLiveEditor || (typeof window !== 'undefined' && localStorage.getItem('orionx_enable_live_editor') === 'true');
  const isInlineDiffActive = enableInlineDiff || (typeof window !== 'undefined' && localStorage.getItem('orionx_enable_inline_diff') === 'true');

  const fileName = selectedNode?.label || selectedNode?.name || selectedNode?.path || 'Unknown';
  const isDataset = isDatasetFile(fileName);

  useEffect(() => {
    setIsEditing(false);
    setSaveMessage('');
    setShowDiff(false);
    setGitDiffText('');
  }, [selectedNode?.id]);

  useEffect(() => {
    let isMounted = true;
    const loadFileContent = async (node: any) => {
      if (!node) {
        setContent('');
        setIsLoading(false);
        return;
      }

      if (node.isDir || node.type === 'DIRECTORY' || node.type === 'folder' || node.type === 'dir') {
        setContent(`// DIRECTORY: ${node.label || fileName}\nDirectory node selected. Use tree explorer to browse contents.`);
        setIsLoading(false);
        return;
      }

      if (node.fileContent) {
        setContent(node.fileContent);
        setIsLoading(false);
        return;
      }

      if (!node.path) {
        setContent('// No file path provided.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const reader = (window as any).electronAPI?.readFile 
          || (window as any).electronAPI?.workspace?.readFile
          || ((p: string) => (window as any).electron?.invoke?.('workspace:readFile', p))
          || ((p: string) => (window as any).electron?.readFile?.(p))
          || ((p: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:readFile', p))
          || ((p: string) => (window as any).api?.workspace?.readFile?.(p));

        if (!reader) {
          setContent('// Electron IPC bridge unavailable.');
          setIsLoading(false);
          return;
        }

        const res = await reader(node.path);

        if (!isMounted) return;

        if (res?.isDirectory) {
          setContent(res.content || `// DIRECTORY: ${node.label || fileName}`);
          setSelectedNode((prev: any) => prev && prev.id === node.id ? { ...prev, fileContent: res.content } : prev);
          setActiveFileContext(`[Directory: ${node.label || fileName}]\n${res.content}`);
        } else if (res?.success && typeof res.content === 'string') {
          setContent(res.content);
          setSelectedNode((prev: any) => prev && prev.id === node.id ? { ...prev, fileContent: res.content } : prev);
          setActiveFileContext(`[File: ${node.label || fileName}]\n${res.content}`);
        } else if (typeof res === 'string') {
          setContent(res);
          setSelectedNode((prev: any) => prev && prev.id === node.id ? { ...prev, fileContent: res } : prev);
          setActiveFileContext(`[File: ${node.label || fileName}]\n${res}`);
        } else if (res?.content) {
          setContent(res.content);
          setSelectedNode((prev: any) => prev && prev.id === node.id ? { ...prev, fileContent: res.content } : prev);
          setActiveFileContext(`[File: ${node.label || fileName}]\n${res.content}`);
        } else {
          setContent(`// Error loading file:\n// Path: ${node.path}\n// Reason: ${res?.error || 'Unknown'}`);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setContent(`// IPC Failure: ${err?.message || 'Unknown IPC error'}\n// Path: ${node.path}`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (selectedNode) {
      loadFileContent(selectedNode);
    }
    return () => {
      isMounted = false;
    };
  }, [selectedNode?.id, selectedNode?.path, selectedNode?.fileContent]);

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

  const displayContent = content || selectedNode.fileContent || '';

  const handleSave = async () => {
    if (!selectedNode?.path) return;
    setIsSaving(true);
    setSaveMessage('Saving...');
    try {
      const writer = (window as any).electronAPI?.writeFile 
        || (window as any).electronAPI?.workspace?.writeFile
        || ((p: string, c: string) => (window as any).electron?.invoke?.('workspace:writeFile', p, c))
        || ((p: string, c: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:writeFile', p, c));

      if (typeof writer === 'function') {
        const res = await writer(selectedNode.path, editBuffer);
        if (res?.success) {
          setContent(editBuffer);
          setSelectedNode((prev: any) => prev && prev.id === selectedNode.id ? { ...prev, fileContent: editBuffer } : prev);
          setActiveFileContext(`[File: ${fileName}]\n${editBuffer}`);
          setSaveMessage('Saved!');
          setIsEditing(false);
          setTimeout(() => setSaveMessage(''), 2500);
        } else {
          setSaveMessage('Error: ' + (res?.error || 'Save failed'));
        }
      } else {
        setSaveMessage('IPC unavailable');
      }
    } catch (err: any) {
      setSaveMessage('Error: ' + (err?.message || 'Save failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const fetchGitDiff = async (filePath: string) => {
    if (!filePath) return;
    setIsLoadingDiff(true);
    try {
      const fetcher = (window as any).electronAPI?.getGitDiff
        || (window as any).electronAPI?.workspace?.getGitDiff
        || ((p: string) => (window as any).electron?.invoke?.('workspace:getGitDiff', p))
        || ((p: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:getGitDiff', p));

      if (typeof fetcher === 'function') {
        const res = await fetcher(filePath);
        if (res?.success) {
          setGitDiffText(res.diff || '// Working tree clean (no uncommitted changes against HEAD)');
        } else {
          setGitDiffText('// ' + (res?.error || 'No git diff available'));
        }
      } else {
        setGitDiffText('// IPC bridge unavailable for git diff');
      }
    } catch (err: any) {
      setGitDiffText('// Git diff error: ' + (err?.message || 'Failed to fetch diff'));
    } finally {
      setIsLoadingDiff(false);
    }
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
          ) : isDataset ? (
            <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest mt-0.5">
              STRUCTURED DATASET EXPLORER
            </span>
          ) : (
            <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest mt-0.5">
              {selectedNode.isDir ? 'DIRECTORY CONTEXT' : 'SOURCE CODE VIEW'}
            </span>
          )}
        </div>
        <button 
          onClick={handleClose}
          className="text-gray-500 hover:text-white transition-colors duration-200 text-xs font-mono cursor-pointer"
        >
          CLOSE
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 min-h-0">
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
        ) : isDataset ? (
          <DatasetExplorer
            content={displayContent}
            fileName={fileName}
          />
        ) : displayContent ? (
          <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden min-h-[150px]">
            <div className="bg-black/40 px-3 py-1.5 border-b border-white/10 select-none flex items-center justify-between">
              <span className="font-mono text-[9px] font-bold text-gray-400 uppercase">
                {showDiff ? 'GIT WORKING TREE DIFF' : 'RAW FILE CONTENT'}
              </span>
              <div className="flex items-center gap-2">
                {isInlineDiffActive && selectedNode?.path && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showDiff;
                      setShowDiff(next);
                      if (next && selectedNode?.path) {
                        fetchGitDiff(selectedNode.path);
                      }
                    }}
                    className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded border transition-all ${
                      showDiff 
                        ? 'bg-amber-950/50 text-amber-300 border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.25)]' 
                        : 'bg-white/5 text-zinc-300 border-white/20 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {showDiff ? '[ VIEW RAW ]' : '[ DIFF ]'}
                  </button>
                )}

                {isLiveEditorActive && !showDiff && (
                  <div className="flex items-center gap-2">
                    {saveMessage && (
                      <span className={`text-[9px] font-mono ${saveMessage.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                        {saveMessage}
                      </span>
                    )}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditBuffer(displayContent);
                            setIsEditing(false);
                          }}
                          className="px-2 py-0.5 text-[9px] font-mono rounded bg-white/10 text-gray-300 hover:text-white hover:bg-white/20"
                        >
                          [ CANCEL ]
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={handleSave}
                          className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30"
                        >
                          {isSaving ? '[ SAVING... ]' : '[ SAVE ]'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditBuffer(displayContent);
                          setIsEditing(true);
                        }}
                        className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/50"
                      >
                        [ EDIT ]
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {showDiff ? (
              <div className="flex-1 overflow-auto p-3 font-mono text-[10px] leading-relaxed bg-[#06060C] select-text custom-scrollbar">
                {isLoadingDiff ? (
                  <div className="flex items-center gap-2 text-zinc-500 py-6 justify-center">
                    <span className="w-4 h-4 rounded-full border-t-2 border-cyan-400 animate-spin" />
                    <span>Analyzing Git Diff...</span>
                  </div>
                ) : gitDiffText ? (
                  <div className="space-y-0.5">
                    {gitDiffText.split('\n').map((line, idx) => {
                      const isAdd = line.startsWith('+') && !line.startsWith('+++');
                      const isDel = line.startsWith('-') && !line.startsWith('---');
                      const isHunk = line.startsWith('@@');
                      return (
                        <div 
                          key={idx} 
                          className={`px-1.5 py-0.5 whitespace-pre rounded-sm font-mono ${
                            isAdd
                              ? 'bg-emerald-950/40 text-[#10B981] border-l-2 border-[#10B981]'
                              : isDel
                              ? 'bg-red-950/40 text-[#EF4444] border-l-2 border-[#EF4444]'
                              : isHunk
                              ? 'text-cyan-400 bg-cyan-950/30 font-bold'
                              : 'text-zinc-400'
                          }`}
                        >
                          {line || ' '}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-zinc-500 py-4 text-center">// Working tree clean (no uncommitted diff against HEAD)</div>
                )}
              </div>
            ) : isLiveEditorActive && isEditing ? (
              <textarea
                value={editBuffer}
                onChange={(e) => setEditBuffer(e.target.value)}
                className="w-full h-full p-3 font-mono text-[10px] text-gray-200 bg-[#06060C] focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none leading-relaxed select-text"
                spellCheck={false}
              />
            ) : (
              <pre className="p-3 font-mono text-[10px] text-gray-300 leading-relaxed overflow-auto whitespace-pre select-text h-full font-light">
                <code>{displayContent}</code>
              </pre>
            )}
          </div>
        ) : selectedNode.isDir ? (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <span className="text-[10px] font-mono text-gray-500">
              Directory Node selected. Expand child nodes to inspect source files.
            </span>
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center text-center p-6 flex-col gap-3">
            <span className="w-6 h-6 rounded-full border-t-2 border-cyber-500 animate-spin" />
            <span className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
              Loading File Stream...
            </span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden min-h-[150px]">
            <div className="bg-black/40 px-3 py-1.5 border-b border-white/10 select-none">
               <span className="font-mono text-[9px] font-bold text-gray-400 uppercase">RAW FILE CONTENT</span>
            </div>
            <pre className="p-3 font-mono text-[10px] text-gray-300 leading-relaxed overflow-auto whitespace-pre select-text h-full font-light">
              <code>{'// No source content available'}</code>
            </pre>
          </div>
        )}
      </div>

      <div className="border-t border-white/5 pt-3 flex gap-3 select-none shrink-0">
        <button
          onClick={handleClose}
          className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 font-mono text-[10px] font-bold uppercase text-gray-400 tracking-wider transition-colors duration-200 cursor-pointer"
        >
          {selectedNode.health === 'critical' ? 'Discard' : 'Close Viewer'}
        </button>
        {selectedNode.health === 'critical' && (
          <button
            onClick={handleFixNode}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 border border-green-400/20 shadow-green-glow rounded-xl py-2 font-mono text-[10px] font-bold uppercase text-white tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            ✔ Fix Vulnerability
          </button>
        )}
      </div>
    </motion.div>
  );
}
