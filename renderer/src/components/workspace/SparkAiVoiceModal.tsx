'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

const cleanResponse = (raw: string): string => {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/\\`/g, '`')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
};

interface SparkAiVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFullScreen?: boolean;
  initialPrompt?: string;
  activeNode?: any;
  nodes?: any[];
  edges?: any[];
  vaultName?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function SparkAiVoiceModal({
  isOpen,
  onClose,
  initialPrompt,
  activeNode,
  nodes = [],
  edges = [],
  vaultName = 'Downloads',
  isFullScreen = false
}: SparkAiVoiceModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: "Hello! I'm Spark AI, your neural vault and codebase assistant. Ask me anything about your files, architecture, or node dependencies.",
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Model selection state
  type ModelOption = 'auto' | 'llava' | 'qwen2.5-coder:7b';
  const [selectedModel, setSelectedModel] = useState<ModelOption>('auto');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getModelDisplayLabel = (model: ModelOption) => {
    switch (model) {
      case 'llava':
        return 'LLaVA ▾';
      case 'qwen2.5-coder:7b':
        return 'Qwen ▾';
      case 'auto':
      default:
        return 'AUTO ▾';
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isModelDropdownOpen]);

  // Handle file/image attachment from + button
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filePath = (file as any).path || file.name;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext);

    if (isImg) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setAttachedNode({
          name: file.name,
          id: file.name,
          path: filePath,
          size: file.size,
          isImage: true,
          base64Data: result.includes(',') ? result.split(',')[1] : result
        });
      };
      reader.readAsDataURL(file);
    } else {
      setAttachedNode({
        name: file.name,
        id: file.name,
        path: filePath,
        size: file.size,
        isImage: false
      });
    }
    e.target.value = '';
  };

  // Auto-expanding textarea input handler
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const target = e.target;
    target.style.height = 'auto'; // Reset to calculate true scrollHeight
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  };

  // Submit on Enter, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e as any);
    }
  };

  // Attached selected node context
  const [attachedNode, setAttachedNode] = useState<any>(activeNode || null);

  // Sync attachedNode when activeNode prop changes
  useEffect(() => {
    if (activeNode) {
      setAttachedNode(activeNode);
    }
  }, [activeNode]);

  // If an initialPrompt is provided when opening, update input or send message
  useEffect(() => {
    if (isOpen && initialPrompt && initialPrompt.trim()) {
      setInputText(initialPrompt.trim());
    }
  }, [isOpen, initialPrompt]);

  // Full screen synchronization
  useEffect(() => {
    if (isFullScreen && isOpen) {
      onClose();
    }
  }, [isFullScreen, isOpen, onClose]);

  // 1. DRAGGABLE MODAL POSITIONING STATE
  const [pos, setPos] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 380 : 1000, 
    y: 200 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptBufferRef = useRef<string>('');

  const nodeCount = (nodes || []).length;
  const edgeCount = (edges || []).length;
  const vaultDisplayName = vaultName || 'Downloads';

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, [data-no-drag]')) {
      return;
    }
    setIsDragging(true);
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 370, e.clientX - dragOffset.x)),
        y: Math.max(60, Math.min(window.innerHeight - 300, e.clientY - dragOffset.y))
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Auto-scroll to bottom of message stream
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isMinimized) {
      scrollToBottom();
    }
  }, [messages, isGenerating, isMinimized]);

  // Reset minimized state when opened
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Speech Synthesis helper
  const speakMessage = useCallback((textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || isMuted) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[Spark AI TTS Error]:', err);
    }
  }, [isMuted]);

  // Cancel speech synthesis when modal closes
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  // Speech-To-Text initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recog = new SpeechRecognition();
          recog.continuous = false;
          recog.interimResults = true;
          recog.lang = 'en-US';

          recog.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              currentTranscript += event.results[i][0].transcript;
            }
            if (currentTranscript) {
              transcriptBufferRef.current = currentTranscript;
              setInputText(currentTranscript);
            }
          };

          recog.onerror = (event: any) => {
            console.warn('SpeechRecognition error:', event.error);
            setIsListening(false);
          };

          recog.onend = () => {
            setIsListening(false);
            if (transcriptBufferRef.current.trim()) {
              const query = transcriptBufferRef.current.trim();
              transcriptBufferRef.current = '';
              sendMessage(query);
            }
          };

          recognitionRef.current = recog;
        } catch (e) {
          console.warn('SpeechRecognition instantiation error:', e);
        }
      }
    }
  }, [nodes, edges, vaultDisplayName, isMuted]);

  // Query Ollama with dynamic live graph telemetry and attached node context
  const sendMessage = async (promptTextContent: string) => {
    if (!promptTextContent.trim() || isGenerating) return;

    const userMessageText = promptTextContent.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessageText,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    // Build context prompt with live nodes & edges
    const activeFileList = (nodes || []).map((n: any) => n.name || n.label || n.path || n.id).filter(Boolean);
    const targetNode = attachedNode || activeNode;
    
    // 1. Read actual file buffer from Electron IPC
    let fileBufferText = '';
    const targetPath = targetNode?.path || targetNode?.relativePath || '';
    if (targetPath) {
      try {
        const reader = (window as any).electronAPI?.readFile 
          || (window as any).electronAPI?.workspace?.readFile
          || ((p: string) => (window as any).electron?.invoke?.('workspace:readFile', p))
          || ((p: string) => (window as any).electron?.readFile?.(p))
          || ((p: string) => (window as any).electron?.ipcRenderer?.invoke?.('workspace:readFile', p));
        if (reader) {
          const res = await reader(targetPath);
          if (res?.success && typeof res.content === 'string') {
            fileBufferText = res.content.slice(0, 8000); // Pass up to 8KB of source content
          } else if (typeof res === 'string') {
            fileBufferText = res.slice(0, 8000);
          } else if (res?.content) {
            fileBufferText = String(res.content).slice(0, 8000);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch file content for Spark AI context:', err);
      }
    }

    if (!fileBufferText && targetNode?.fileContent) {
      fileBufferText = targetNode.fileContent.slice(0, 8000);
    }
    if (!fileBufferText && typeof (window as any).sourceCodeBlock === 'string' && (window as any).sourceCodeBlock) {
      fileBufferText = (window as any).sourceCodeBlock.slice(0, 8000);
    }
    if (!fileBufferText && typeof (window as any).SelectedNodeFileBuffer === 'string' && (window as any).SelectedNodeFileBuffer) {
      fileBufferText = (window as any).SelectedNodeFileBuffer.slice(0, 8000);
    }

    // 2. Restructure system prompt & context injection with actual buffer
    const systemContext = `
You are Spark AI, an expert codebase and file auditor for ORION-X Studio.
Respond in clear, structured, readable markdown. Do not hallucinate that a file is empty if content is provided.

${targetNode ? `
[ATTACHED FILE DATA]
- File: ${targetNode.name || targetNode.label || targetNode.id}
- Path: ${targetNode.path || targetNode.relativePath || 'N/A'}
- Content Preview:
\`\`\`
${fileBufferText || '// No text content available'}
\`\`\`
` : `
Vault Context:
- Vault: ${vaultDisplayName}
- Total Nodes: ${nodeCount}
- Total Edges: ${edgeCount}
- Complete list of files/nodes in this vault:
${activeFileList.join(', ')}
`}
`;

    // Check if attachedNode or activeNode is an image file
    const filePath = targetPath;
    const isImage = Boolean(filePath && /\.(png|jpe?g|webp|bmp|gif)$/i.test(filePath));

    // Determine active target model
    let targetModel = selectedModel;
    if (selectedModel === 'auto') {
      targetModel = isImage ? 'llava' : 'qwen2.5-coder:7b';
    }

    let imageBase64Data: string | null = null;
    if (isImage && (targetModel === 'llava' || selectedModel === 'auto') && filePath) {
      try {
        const electronApi = (window as any).electronAPI || (window as any).electron || (window as any).api;
        let fileRes: any = null;
        if (typeof electronApi?.readFile === 'function') {
          fileRes = await electronApi.readFile(filePath);
        } else if (typeof electronApi?.workspace?.readFile === 'function') {
          fileRes = await electronApi.workspace.readFile(filePath);
        } else if (typeof electronApi?.ipcRenderer?.invoke === 'function') {
          fileRes = await electronApi.ipcRenderer.invoke('workspace:readFile', filePath);
        }
        if (fileRes?.base64) {
          imageBase64Data = fileRes.base64;
        } else if (typeof fileRes === 'string' && fileRes.startsWith('data:image')) {
          imageBase64Data = fileRes.split(',')[1];
        }
      } catch (err) {
        console.warn('Failed to read image as base64:', err);
      }
    }

    // Build payload for Ollama
    const payload: any = {
      model: targetModel,
      stream: false,
    };

    if (targetModel === 'llava' && imageBase64Data) {
      payload.prompt = `Analyze this image in detail and answer the user question: ${userMessageText}`;
      payload.images = [imageBase64Data];
    } else {
      payload.prompt = `${systemContext}\nUser Query: ${userMessageText}`;
    }

    try {
      const response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Ollama responded with status ${response.status}`);
      }

      const data = await response.json();
      const rawReply = data.response?.trim() || 'No response returned from model.';
      const replyContent = cleanResponse(rawReply);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Call speech synthesis to speak the reply
      if ('speechSynthesis' in window && !isMuted) {
        const spokenText = replyContent.replace(/```[\s\S]*?```/g, 'Code block omitted.').replace(/[*#`_]/g, '');
        speakMessage(spokenText);
      }
    } catch (ollamaErr) {
      console.error('[Spark AI Ollama Error]:', ollamaErr);
      const fallbackAiMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `Error connecting to Ollama at http://127.0.0.1:11434 with model '${targetModel}'. Please ensure Ollama is running locally.`,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, fallbackAiMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (inputText.trim()) {
      sendMessage(inputText);
    }
  };

  // Toggle Voice Input
  const toggleMic = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      if (inputText.trim()) {
        sendMessage(inputText);
      }
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      transcriptBufferRef.current = '';

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          return;
        } catch (e) {
          console.warn('SpeechRecognition start failed:', e);
        }
      }

      // Fallback voice simulation
      setIsListening(true);
      const sampleQueries = attachedNode ? [
        `Audit security vulnerabilities in ${attachedNode.name || attachedNode.id}.`,
        `Explain the functionality of ${attachedNode.name || attachedNode.id}.`,
        `How does ${attachedNode.name || attachedNode.id} interact with other nodes?`,
        `Refactor code in ${attachedNode.name || attachedNode.id}.`
      ] : [
        `How many nodes in ${vaultDisplayName}?`,
        "Audit security vulnerabilities across current graph nodes.",
        "What are the main files in this vault?",
        "Explain the project structure."
      ];
      const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
      setTimeout(() => {
        setInputText(randomQuery);
        setIsListening(false);
        sendMessage(randomQuery);
      }, 1500);
    }
  };

  if (!isOpen || isFullScreen) return null;

  // Minimized floating bubble (Draggable)
  if (isMinimized) {
    return (
      <div
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onMouseDown={handleMouseDown}
        className="fixed z-50 flex items-center gap-2 px-4 py-2.5 bg-[#0B0B14]/95 border border-purple-500/40 rounded-full shadow-2xl backdrop-blur-xl cursor-move select-none"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] pointer-events-none">
          ✦
        </div>
        <span className="text-purple-300 font-semibold text-xs tracking-wide pointer-events-none">Spark AI</span>
        <button
          data-no-drag
          onClick={() => setIsMinimized(false)}
          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 flex items-center justify-center text-xs ml-1 cursor-pointer transition-colors"
          title="Restore"
        >
          🗖
        </button>
        <button
          data-no-drag
          onClick={onClose}
          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 flex items-center justify-center text-xs cursor-pointer transition-colors"
          title="Close"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed w-[370px] h-[560px] max-h-[calc(100vh-100px)] z-50 rounded-[28px] border border-purple-500/30 bg-[#0B0B14]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden select-none"
    >
      {/* 1. TOP HEADER DRAG BAR */}
      <div
        onMouseDown={handleMouseDown}
        className="shrink-0 h-13 px-4 py-3 bg-[#121220] border-b border-white/10 flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2.5 pointer-events-none">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-purple-500/30">
            ✦
          </div>
          <div>
            <div className="text-xs font-semibold text-white tracking-wide">Spark AI</div>
            <div className="text-[10px] text-purple-300/70 font-mono">Vault: {nodeCount} Nodes</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5" data-no-drag>
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 flex items-center justify-center text-xs cursor-pointer transition-colors"
            title={isMuted ? "Unmute Voice Audio" : "Mute Voice Audio"}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
            title="Minimize"
          >
            −
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 flex items-center justify-center text-sm cursor-pointer transition-colors"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* 2. TOP VOICE VISUALIZER ORB */}
      <div className="shrink-0 pt-2.5 pb-1 flex flex-col items-center justify-center pointer-events-none">
        <div className="w-16 h-16 relative flex items-center justify-center">
          {/* Orbital dashed ring */}
          <div
            className={`absolute inset-0 rounded-full border border-dashed border-purple-400/40 animate-spin ${
              isListening ? 'border-pink-400 scale-110' : ''
            }`}
            style={{ animationDuration: isListening ? '3s' : '10s' }}
          />
          {/* Glowing Aura */}
          <div
            className={`absolute w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500/30 via-purple-600/40 to-indigo-600/30 blur-lg transition-all ${
              isListening ? 'scale-125 opacity-100 animate-pulse' : 'opacity-60'
            }`}
          />
          {/* Core Sphere */}
          <div
            className={`w-10 h-10 rounded-full relative flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5),inset_0_0_10px_rgba(255,255,255,0.4)] transition-all ${
              isListening ? 'scale-110' : isGenerating ? 'scale-105' : 'scale-100'
            }`}
            style={{
              background: 'radial-gradient(circle at 35% 35%, #f472b6, #a855f7 50%, #6366f1 85%, #1e1b4b)'
            }}
          >
            {isListening ? (
              <div className="flex items-center gap-0.5">
                <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span className="w-0.5 h-4 bg-white rounded-full animate-pulse [animation-delay:-0.2s]" />
                <span className="w-0.5 h-2 bg-white rounded-full animate-pulse [animation-delay:-0.4s]" />
              </div>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* ATTACHED NODE CHIP (Removable) */}
      {attachedNode && (
        <div className="mx-3 my-1 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between gap-2 shadow-sm text-xs font-mono select-none shrink-0" data-no-drag>
          <div className="flex items-center gap-1.5 truncate text-purple-300">
            <span className="text-xs">📎</span>
            <span className="truncate font-semibold text-[11px]">
              File: {attachedNode.name || attachedNode.label || attachedNode.id}
            </span>
            <span className="text-zinc-400 text-[10px]">
              ({attachedNode.size ? `${(attachedNode.size / 1024).toFixed(1)} KB` : (attachedNode.LOC ? `${attachedNode.LOC} LOC` : 'Attached')})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAttachedNode(null)}
            className="w-5 h-5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-red-400 flex items-center justify-center text-xs cursor-pointer transition-colors shrink-0"
            title="Detach File"
          >
            ×
          </button>
        </div>
      )}

      {/* 3. CONTINUOUS MULTI-TURN CHAT FEED */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-3 custom-scrollbar select-text">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`text-xs p-3 rounded-2xl leading-relaxed select-text ${
                  isUser
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-sm max-w-[85%] self-end shadow-md shadow-pink-500/20'
                    : 'bg-[#161624] border border-white/10 text-zinc-200 rounded-bl-sm max-w-[85%] self-start shadow-md'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="space-y-2 text-xs leading-relaxed break-words">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 text-zinc-200 leading-relaxed">{children}</p>,
                        h1: ({ children }) => <h1 className="text-sm font-bold text-cyan-400 mt-2 mb-1 border-b border-white/10 pb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xs font-bold text-cyan-300 mt-2 mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xs font-semibold text-purple-300 mt-1.5 mb-1">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2 text-zinc-300">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2 text-zinc-300">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                        em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
                        code: ({ className, children, ...props }) => {
                          const isInline = !className && !String(children).includes('\n');
                          if (isInline) {
                            return (
                              <code className="bg-black/50 text-cyan-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-white/10" {...props}>
                                {children}
                              </code>
                            );
                          }
                          return (
                            <div className="my-2 rounded-lg bg-[#0E0E18] border border-cyan-500/20 overflow-x-auto p-2.5 font-mono text-[11px] text-cyan-200">
                              <pre className="m-0 whitespace-pre overflow-x-auto">{children}</pre>
                            </div>
                          );
                        },
                      }}
                    >
                      {cleanResponse(msg.content)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div className="flex w-full justify-start">
            <div className="bg-[#161624] border border-white/10 text-zinc-200 text-xs p-3 rounded-2xl rounded-bl-sm max-w-[85%] shadow-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. MODERN UNIFIED AI INPUT CARD (ChatGPT / Gemini Stacked Multi-Row Style) */}
      <div className="shrink-0 p-3 bg-[#0B0B14] border-t border-white/10" data-no-drag>
        <div className="relative bg-[#1e1f24] border border-white/[0.08] rounded-[18px] p-3 flex flex-col gap-2 transition-all duration-200 focus-within:border-cyan-500/40 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)] shadow-xl">
          {/* Hidden File Input for Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Top Area: Full-Width Auto-Expanding Textarea */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={attachedNode ? `Ask about ${attachedNode.name || 'attached file'}...` : "Ask anything here..."}
            disabled={isGenerating}
            rows={1}
            className="w-full bg-transparent text-white placeholder-zinc-500 text-xs leading-relaxed resize-none outline-none border-none p-0 overflow-y-auto min-h-[26px] max-h-[180px] select-text custom-scrollbar font-sans"
            style={{ height: 'auto' }}
          />

          {/* Bottom Action Row */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.05]">
            {/* Left Side Controls */}
            <div className="flex items-center gap-1.5 relative">
              {/* Attachment Button (+) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer"
                title="Attach file or image"
              >
                +
              </button>

              {/* Compact Model Selector Dropdown Pill */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="px-2.5 py-1 rounded-lg bg-[#14151c] hover:bg-[#1a1b24] border border-white/10 text-[11px] font-mono font-medium text-purple-200 hover:text-white flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                  title="Select AI Model (LLaVA / Qwen / Auto)"
                >
                  <span>{getModelDisplayLabel(selectedModel)}</span>
                </button>

                {/* Dropdown Menu (Opens Upwards) */}
                {isModelDropdownOpen && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-[#14151f] border border-purple-500/40 rounded-xl p-1 shadow-2xl shadow-black/80 flex flex-col min-w-[145px] backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel('auto');
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex flex-col cursor-pointer ${
                        selectedModel === 'auto'
                          ? 'bg-purple-600/30 text-purple-300 font-semibold'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold">Auto</span>
                      <span className="text-[9px] text-zinc-500 font-normal">Smart Multi-Route</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel('llava');
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex flex-col cursor-pointer ${
                        selectedModel === 'llava'
                          ? 'bg-purple-600/30 text-purple-300 font-semibold'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold">LLaVA</span>
                      <span className="text-[9px] text-zinc-500 font-normal">Multimodal Vision</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel('qwen2.5-coder:7b');
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex flex-col cursor-pointer ${
                        selectedModel === 'qwen2.5-coder:7b'
                          ? 'bg-purple-600/30 text-purple-300 font-semibold'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold">Qwen</span>
                      <span className="text-[9px] text-zinc-500 font-normal">Code & Reasoning</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-1.5">
              {/* Voice Input Waveform / Microphone Icon Button */}
              <button
                type="button"
                onClick={toggleMic}
                className={`h-7 px-2 rounded-lg border transition-all flex items-center gap-1 text-xs cursor-pointer ${
                  isListening
                    ? 'bg-pink-600/30 border-pink-500 text-pink-300 animate-pulse'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-purple-400 hover:bg-white/10'
                }`}
                title={isListening ? "Listening... (Click to stop)" : "Voice Input"}
              >
                {isListening ? (
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-2.5 bg-pink-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-3.5 bg-pink-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-2 bg-pink-400 rounded-full animate-bounce" />
                  </div>
                ) : (
                  <span className="text-xs">🎤</span>
                )}
              </button>

              {/* Clean Send Button (Active/Highlighted when input has text) */}
              <button
                type="button"
                onClick={() => handleFormSubmit()}
                disabled={!inputText.trim() || isGenerating}
                className={`h-7 px-2.5 rounded-lg flex items-center justify-center gap-1 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  inputText.trim() && !isGenerating
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.35)] hover:scale-105 active:scale-95'
                    : 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed opacity-40'
                }`}
                title="Send (Enter)"
              >
                <span>Send</span>
                <span className="text-[10px]">➤</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
