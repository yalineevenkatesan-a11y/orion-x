'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Attachment } from '@/context/AppContext';
import { FilePreview } from './FilePreview';

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
}

type ModelOption = 'auto' | 'llava' | 'qwen2.5-coder:7b';

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('auto');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  // Close model dropdown on click outside
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

  // Auto-grow textarea height dynamically without layout jitter
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const target = e.target;
    target.style.height = 'auto'; // Reset to calculate true scrollHeight
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  };

  const handleSend = () => {
    const hasText = text.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || disabled) return;

    // Package prompt and attachments
    onSendMessage(text.trim(), hasFiles ? pendingFiles : undefined);
    
    // Clear inputs
    setText('');
    setPendingFiles([]);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Enter key submits (while Shift + Enter inserts newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // HTML5 Drag-and-drop Handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      const newAttachments: Attachment[] = filesArray.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || file.name.split('.').pop() || 'unknown',
      }));

      setPendingFiles((prev) => [...prev, ...newAttachments]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 pb-6 pt-2 select-none">
      {/* Ambient background glow */}
      <div className="absolute inset-x-8 bottom-6 top-2 bg-cyan-500/5 blur-2xl pointer-events-none rounded-xl" />

      {/* Main Unified Input Card Container */}
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative flex flex-col bg-[#1e1f24] p-3 rounded-[18px] border border-white/[0.08] focus-within:border-cyan-500/40 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-200 shadow-xl"
      >
        {/* Hidden File Input for Attachment Button */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const filesArray = Array.from(e.target.files);
              const newAttachments: Attachment[] = filesArray.map((file) => ({
                name: file.name,
                size: file.size,
                type: file.type || file.name.split('.').pop() || 'unknown',
              }));
              setPendingFiles((prev) => [...prev, ...newAttachments]);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        {/* Absolute Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 rounded-[18px] bg-cyan-950/60 backdrop-blur-sm border-2 border-dashed border-cyan-500/60 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-3 text-cyan-300 font-mono text-xs tracking-widest font-bold">
              <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>DROP FILES TO UPLOAD</span>
            </div>
          </div>
        )}

        {/* Pending Files Previews */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-white/5 bg-black/20 rounded-t-lg mb-2">
            {pendingFiles.map((file, idx) => (
              <FilePreview
                key={`${file.name}-${idx}`}
                name={file.name}
                size={file.size}
                onRemove={() => handleRemoveFile(idx)}
              />
            ))}
          </div>
        )}

        {/* Top Area: Full-Width Auto-Expanding Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingFiles.length > 0 
              ? "Describe your uploaded files..." 
              : "Ask anything here..."
          }
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent text-white placeholder-zinc-500 text-xs leading-relaxed resize-none outline-none border-none p-0 overflow-y-auto min-h-[26px] max-h-[180px] select-text custom-scrollbar font-sans"
          style={{ height: 'auto' }}
        />

        {/* Bottom Action Row */}
        <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-white/[0.05]">
          {/* Left Side Controls */}
          <div className="flex items-center gap-2 relative">
            {/* Attachment Button (+) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40"
              title="Attach File or Image (+)"
            >
              +
            </button>

            {/* Compact Model Selector Dropdown Pill */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                disabled={disabled}
                className="px-2.5 py-1 rounded-lg bg-[#14151c] hover:bg-[#1a1b24] border border-white/10 text-[11px] font-mono font-medium text-cyan-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-40"
                title="Select AI Model (LLaVA / Qwen / Auto)"
              >
                <span>{getModelDisplayLabel(selectedModel)}</span>
              </button>

              {/* Dropdown Menu (Opens Upwards) */}
              {isModelDropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 z-50 bg-[#14151f] border border-cyan-500/40 rounded-xl p-1 shadow-2xl shadow-black/80 flex flex-col min-w-[145px] backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModel('auto');
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex flex-col cursor-pointer ${
                      selectedModel === 'auto'
                        ? 'bg-cyan-600/30 text-cyan-300 font-semibold'
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
                        ? 'bg-cyan-600/30 text-cyan-300 font-semibold'
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
                        ? 'bg-cyan-600/30 text-cyan-300 font-semibold'
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
          <div className="flex items-center gap-2">
            {/* Send Action Button */}
            <button
              onClick={handleSend}
              disabled={(!text.trim() && pendingFiles.length === 0) || disabled}
              className={`h-7 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                (text.trim() || pendingFiles.length > 0) && !disabled
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)] hover:scale-105 active:scale-95'
                  : 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed opacity-40'
              }`}
              type="button"
              title="Send (Enter)"
            >
              <span>Send</span>
              <span className="text-[10px]">➤</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
