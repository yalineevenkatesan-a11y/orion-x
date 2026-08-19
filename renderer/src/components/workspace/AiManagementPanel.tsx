'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';

const AGENTS = [
  { id: 'supervisor', label: 'SUPERVISOR', color: 'from-fuchsia-500 to-purple-600', text: 'text-fuchsia-400' },
  { id: 'architect', label: 'Architect', color: 'from-blue-500 to-indigo-600', text: 'text-blue-400' },
  { id: 'developer', label: 'Developer', color: 'from-green-500 to-emerald-600', text: 'text-green-400' },
  { id: 'debugger', label: 'Debugger', color: 'from-red-500 to-rose-600', text: 'text-red-400' },
  { id: 'security', label: 'Security', color: 'from-yellow-500 to-amber-600', text: 'text-yellow-400' },
  { id: 'performance', label: 'Performance', color: 'from-purple-500 to-fuchsia-600', text: 'text-purple-400' },
  { id: 'tester', label: 'Tester', color: 'from-cyan-500 to-teal-600', text: 'text-cyan-400' },
  { id: 'docs', label: 'Documentation', color: 'from-gray-400 to-slate-500', text: 'text-gray-300' },
  { id: 'deploy', label: 'Deployment', color: 'from-orange-500 to-red-500', text: 'text-orange-400' },
  { id: 'pm', label: 'Project Manager', color: 'from-pink-500 to-rose-500', text: 'text-pink-400' },
];

export function AiManagementPanel() {
  const [activeAgent, setActiveAgent] = useState(AGENTS[0]);
  const [agentHistories, setAgentHistories] = useState<{ [key: string]: any[] }>({
    supervisor: [], architect: [], developer: [], debugger: [], security: [], performance: [], tester: [], docs: [], deploy: [], pm: []
  });
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { activeFileContext, setActiveFileContext } = useWorkspaceUi();
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isAiFullScreen, setIsAiFullScreen] = useState(false);
  
  const activeRole = activeAgent.id;
  const currentHistory = agentHistories[activeRole] || [];
  
  const renderFormattedMessage = (content: string) => {
    return <span dangerouslySetInnerHTML={{ __html: content }} />;
  };
  
  // Dynamically aggregate all messages if activeRole is SUPERVISOR
  const messages = activeRole === 'supervisor' 
    ? Object.entries(agentHistories)
        .filter(([key]) => key !== 'supervisor')
        .flatMap(([_, msgs]) => msgs)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    : (agentHistories[activeRole] || []);

  // Sync with local IPC storage when changing agent
  useEffect(() => {
    async function loadThread() {
      // @ts-ignore
      const targetApi = (window as any).electronAPI || (window as any).electron || (window as any).api;
      if (targetApi && targetApi.chat) {
        try {
          const thread = await targetApi.chat.getActiveThread(`agent_${activeRole}`);
          if (thread) {
            const msgs = await targetApi.chat.getMessages(thread.id);
            setAgentHistories(prev => ({ ...prev, [activeRole]: msgs || [] }));
          }
        } catch (err) {
          console.warn('Failed to load thread, using mock state', err);
          setAgentHistories(prev => ({ ...prev, [activeRole]: [{ role: 'system', content: `${activeAgent.label} agent initialized. Ready for operations.` }] }));
        }
      } else {
        setAgentHistories(prev => ({ ...prev, [activeRole]: [{ role: 'system', content: `${activeAgent.label} agent initialized (Mock).` }] }));
      }
    }
    loadThread();
  }, [activeRole]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [agentHistories[activeRole], activeRole]);

  // Bind streaming listener hook once during mounting initialization
  useEffect(() => {
    // @ts-ignore
    const targetApi = (window as any).electronAPI || (window as any).electron || (window as any).api;
    if (targetApi && targetApi.ipcRenderer) {
      targetApi.ipcRenderer.on('ai:token-stream', (_event: any, data: any) => {
        setAgentHistories(prev => {
          const historicalList = prev[data.role] || [];
          const lastMsg = historicalList[historicalList.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            const alteredList = [...historicalList];
            alteredList[alteredList.length - 1] = { ...lastMsg, content: lastMsg.content + data.token };
            return { ...prev, [data.role]: alteredList };
          } else {
            return { ...prev, [data.role]: [...historicalList, { role: 'assistant', content: data.token, timestamp: Date.now() }] };
          }
        });
      });
      targetApi.ipcRenderer.on('ai:stream-complete', () => {
        setIsGenerating(false);
      });
      return () => { 
        targetApi.ipcRenderer.removeAllListeners('ai:token-stream'); 
        targetApi.ipcRenderer.removeAllListeners('ai:stream-complete'); 
      };
    }
  }, []);

  const handleSend = async (text?: string) => {
    const messageToSend = text || inputText;
    if (!messageToSend.trim()) return;
    let currentText = messageToSend;
    setInputText('');

    // Append contextual file code if a node is currently selected and active in the graph
    if (activeFileContext) {
       currentText += `\n\n### ACTIVE WORKSPACE CONTEXT:\n${activeFileContext}`;
    }

    const newMsg = { role: 'user', content: currentText, timestamp: Date.now() };
    const currentHistory = agentHistories[activeAgent.id] || [];
    const updatedHistory = [...currentHistory, newMsg];
    
    setAgentHistories(prev => ({ ...prev, [activeAgent.id]: updatedHistory }));
    setIsGenerating(true);

    // @ts-ignore
    const targetApi = (window as any).electronAPI || (window as any).electron || (window as any).api;
    if (targetApi && targetApi.chat) {
      try {
        await targetApi.chat.saveMessage({
          threadId: `agent_${activeAgent.id}`,
          role: 'user',
          content: currentText
        });
      } catch (err) {
        console.error(err);
      }
    }

    if (targetApi && targetApi.ipcRenderer) {
       targetApi.ipcRenderer.send('ai:sendMessageStream', {
         message: currentText,
         history: currentHistory,
         role: activeAgent.id,
         activeFileContent: activeFileContext
       });
    }
  };

  return (
    <>
      
      {/* Conditionally rendered Side-by-Side File Inspector */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border border-white/10 bg-black/40 backdrop-blur-3xl p-6 flex flex-col gap-5 z-25 relative select-text shrink-0"
            style={{ 
              position: 'absolute', 
              right: isAssistantOpen ? '420px' : '2rem', 
              bottom: '5rem', 
              height: '640px', 
              borderRadius: '2rem', 
              zIndex: 95, 
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              boxSizing: 'border-box'
            }}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4 select-none shrink-0">
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
                onClick={() => {
                  setSelectedNode(null);
                  setActiveFileContext(null);
                  window.dispatchEvent(new CustomEvent('orion:reset-zoom'));
                }}
                className="text-gray-500 hover:text-white transition-colors duration-200 text-xs font-mono"
              >
                CLOSE
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
              {(selectedNode.health === 'critical' || selectedNode.health === 'warning') ? (
                <>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col gap-3 shrink-0 relative overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl drop-shadow-md">⚠️</span>
                      <span className="font-sans text-xs font-bold text-red-400 uppercase tracking-widest drop-shadow">
                        DETECTED VULNERABILITY ADVISORY
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 font-mono text-[10px] text-gray-300">
                      <p><span className="text-gray-500">Risk Level:</span> <span className={selectedNode.health === 'critical' ? 'text-red-400 font-bold' : 'text-yellow-400 font-bold'}>{selectedNode.health === 'critical' ? 'High' : 'Medium'}</span></p>
                      <p><span className="text-gray-500">Vulnerability Type:</span> <span className="text-white">{selectedNode.health === 'critical' ? 'Potential Security Flaw' : 'Legacy Code Pattern Detected'}</span></p>
                      <p className="mt-2 text-cyan-400 bg-cyan-900/20 p-2 rounded border border-cyan-500/20">
                        <span className="font-bold">Recommendation:</span> Refactor the file context immediately using the Developer or Debugger agent pool.
                      </p>
                    </div>
                  </div>

                  {selectedNode.fileContent && (
                    <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden mt-1">
                      <div className="bg-black/40 px-3 py-1.5 border-b border-white/10 select-none">
                         <span className="font-mono text-[9px] font-bold text-gray-400 uppercase">RAW FILE CONTENT</span>
                      </div>
                      <pre className="p-3 font-mono text-[10px] text-gray-300 leading-relaxed overflow-auto whitespace-pre select-text h-full font-light">
                        <code>{selectedNode.fileContent}</code>
                      </pre>
                    </div>
                  )}
                </>
              ) : selectedNode.fileContent ? (
                <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-xl overflow-hidden">
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

            <div className="border-t border-white/5 pt-4 flex gap-3 select-none shrink-0">
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setActiveFileContext(null);
                  window.dispatchEvent(new CustomEvent('orion:reset-zoom'));
                }}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 font-mono text-[10px] font-bold uppercase text-gray-400 tracking-wider transition-colors duration-200"
              >
                {selectedNode.health === 'critical' ? 'Discard' : 'Close Viewer'}
              </button>
              {selectedNode.health === 'critical' && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('orion:fix-node', { detail: selectedNode.id }))}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 border border-green-400/20 shadow-green-glow rounded-xl py-3 font-mono text-[10px] font-bold uppercase text-white tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  ✔ Fix Vulnerability
                </button>
              )}
              {selectedNode.fileContent && (
                <button
                  onClick={() => {
                    const prompt = `Optimize this code block for safety:\n\n\`\`\`\n${selectedNode.fileContent}\n\`\`\``;
                    const activeFileContext = selectedNode.fileContent;
                    const targetApi = (window as any).electronAPI || (window as any).electron || (window as any).api;
                    if (targetApi && targetApi.ipcRenderer) {
                      targetApi.ipcRenderer.send('ai:sendMessageStream', {
                        message: prompt,
                        history: currentHistory,
                        role: 'developer',
                        activeFileContent: activeFileContext
                      });
                    }
                    setIsAssistantOpen(true);
                  }}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 border border-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] rounded-xl py-3 font-mono text-[10px] font-bold uppercase text-white tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  CONNECT FILE TO CHAT
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div 
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.3, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`flex flex-col box-border ${isAiFullScreen ? 'fixed inset-4 w-[calc(100vw-32px)] h-[calc(100vh-32px)] z-[100]' : ''}`}
            style={isAiFullScreen ? {
              background: '#0B0B10',
              border: '1px solid #1E1E26',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9)',
              borderRadius: '2rem',
              overflow: 'hidden',
              backdropFilter: 'blur(12px)'
            } : {
              position: 'absolute',
              right: '2rem',
              bottom: '5rem',
              width: '360px',
              height: '640px',
              zIndex: 100,
              background: '#0B0B10',
              border: '1px solid #1E1E26',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              borderRadius: '2rem',
              overflow: 'hidden',
              backdropFilter: 'blur(12px)'
            }}
          >
            {/* Header / Drag Handle */}
            <div className="p-5 border-b border-white/5 flex flex-col items-center gap-1 select-none cursor-grab active:cursor-grabbing relative bg-black/20">
              <button 
                onClick={() => setIsAiFullScreen(!isAiFullScreen)}
                className="absolute top-4 right-14 px-2 py-1 rounded text-[9px] font-mono font-bold text-gray-500 hover:text-white bg-white/5 border border-white/10 hover:bg-white/20 transition-colors"
                title="Toggle Fullscreen"
              >
                {isAiFullScreen ? '[ MINIMIZE ]' : '[ MAX FULLSCREEN CHAT ]'}
              </button>
              <button 
                onClick={() => setIsAssistantOpen(false)}
                className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                title="Minimize Spark"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
              </button>
              <span className="text-sm font-bold text-white tracking-wide">Spark AI</span>
              <span className="text-[10px] font-mono text-gray-400">Your intelligent coding companion</span>
            </div>

        {/* Chat Thread */}
        <div ref={chatContainerRef} className="scroll-smooth flex flex-col gap-4 relative" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {messages.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 mt-auto mb-4 px-2">
              {[
                { icon: "[EXPL]", label: "Explain Project" },
                { icon: "[BUG]", label: "Find Bugs" },
                { icon: "[DPLY]", label: "Deploy" },
                { icon: "[UI]", label: "Improve UI" },
                { icon: "[OPT]", label: "Optimize" },
                { icon: "[DOC]", label: "Documentation" }
              ].map((card, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(`[SYSTEM: Triggered ${card.label} Workflow]`)}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all rounded-xl p-3 flex flex-col items-center justify-center gap-2"
                >
                  <span className="text-[10px] font-mono text-purple-400">{card.icon}</span>
                  <span className="text-[10px] font-mono text-gray-300 whitespace-nowrap">{card.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <AnimatePresence>
              {(Array.isArray(messages) ? messages : []).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
              >
                <div className={`flex flex-col gap-y-3 font-sans text-sm text-zinc-200 tracking-normal leading-relaxed break-words whitespace-pre-wrap p-3 select-text shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                    : msg.role === 'system'
                    ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 w-full rounded-xl'
                    : `bg-[#1e1e24] text-[#e2e8f0]`
                }`}
                style={{
                  borderRadius: msg.role === 'user' 
                    ? '1.25rem 1.25rem 0.25rem 1.25rem' 
                    : msg.role === 'system' 
                    ? '0.75rem' 
                    : '1.25rem 1.25rem 1.25rem 0.25rem'
                }}>
                  {renderFormattedMessage(msg.content)}
                  
                  {msg.role !== 'user' && msg.role !== 'system' && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 opacity-60">
                      <button className="hover:text-white transition-colors" title="Copy"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
                      <button className="hover:text-white transition-colors" title="Thumbs Up"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.514"></path></svg></button>
                      <button className="hover:text-white transition-colors" title="Read Aloud"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10v4a2 2 0 002 2h2l4 4V4L9 8H7a2 2 0 00-2 2z"></path></svg></button>
                      <button className="hover:text-white transition-colors" title="Regenerate"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button>
                    </div>
                  )}
                </div>
                <span className={`text-[9px] font-sans text-gray-500 uppercase mt-1 px-1 ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
                  {msg.role} • {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          )}
        </div>

        {/* Input Form */}
        <div 
          className="border-t border-white/5 bg-[#212121] flex flex-col gap-2"
          style={{ padding: '1rem', width: '100%', boxSizing: 'border-box', flexShrink: 0 }}
        >
          <AnimatePresence>
            {activeFileContext && (
              <motion.div
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
                 className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-md px-2 py-1 select-none flex items-center justify-between"
              >
                <span>+ SYSTEM MEMORY CONNECTED TO ACTIVE NODE</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="relative flex items-end bg-[#2f2f2f] border border-white/10 rounded-full transition-colors focus-within:border-white/30 shadow-lg px-2">
            <button className="p-3 mb-0.5 ml-1 text-gray-400 hover:text-white transition-colors rounded-full shrink-0 flex items-center justify-center">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
            </button>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isGenerating) handleSend();
                }
              }}
              placeholder={`Message ${activeAgent.label}...`}
              rows={1}
              style={{ minHeight: '52px', maxHeight: '200px' }}
              className="w-full bg-transparent border-none py-4 px-3 font-sans text-[15px] text-white placeholder-gray-400 focus:outline-none resize-none overflow-y-auto leading-relaxed"
            />
            <div className="flex items-center justify-center gap-1 mb-1.5 mr-1 shrink-0">
              <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
              </button>
              {isGenerating ? (
                <button
                  onClick={() => {
                    const targetApi = (window as any).electronAPI || (window as any).electron || (window as any).api;
                    if (targetApi && targetApi.ipcRenderer) {
                      targetApi.ipcRenderer.send('ai:cancelGeneration', `agent_${activeRole}`);
                    }
                    setIsGenerating(false);
                  }}
                  className="bg-black text-white hover:bg-gray-800 p-2.5 rounded-full transition-colors flex items-center justify-center border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                >
                  <span className="w-3.5 h-3.5 bg-red-500 rounded-sm" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!inputText.trim()}
                  className={`p-2.5 rounded-full transition-colors flex items-center justify-center border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)] ${
                    inputText.trim() ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
