'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Attachment } from '@/context/AppContext';
import { FilePreview } from './FilePreview';

interface ChatInputProps {
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const targetHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${targetHeight}px`;
  }, [text]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
    <div className="relative w-full max-w-4xl mx-auto px-4 pb-6 pt-2">
      {/* Ambient background glow */}
      <div className="absolute inset-x-8 bottom-6 top-2 bg-cyber-500/5 blur-2xl pointer-events-none rounded-xl" />

      {/* Main Drag-and-drop container wrap */}
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative flex flex-col glass-panel p-2 rounded-xl border border-white/8 bg-black/45 focus-within:ring-1 focus-within:ring-cyber-500/50 focus-within:border-cyber-500/30 transition-all shadow-glass-shadow"
      >
        
        {/* Absolute Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 rounded-xl bg-quantum-900/30 backdrop-blur-sm border-2 border-dashed border-cyber-500/60 flex items-center justify-center pointer-events-none animate-fade-in">
            <div className="flex items-center gap-3 text-cyber-400 font-mono text-xs tracking-widest font-bold">
              <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>DROP FILES TO UPLOAD</span>
            </div>
          </div>
        )}

        {/* Pending Files Previews (renders if items exist) */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-white/5 bg-black/10 rounded-t-lg mb-1 animate-slide-down">
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

        {/* Input Bar Row */}
        <div className="flex items-end gap-3">
          {/* File Upload Trigger Icon */}
          <label
            className="p-2 rounded-lg text-gray-500 hover:text-white transition-colors duration-200 select-none cursor-pointer flex items-center justify-center active:scale-95"
            title="Upload File"
          >
            <input
              type="file"
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
                }
              }}
              className="hidden"
            />
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </label>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              pendingFiles.length > 0 
                ? "Describe your uploaded files... (Ctrl+Enter to send)" 
                : "Message Orion-X Core... (Press Ctrl+Enter to send)"
            }
            disabled={disabled}
            className="flex-1 max-h-[200px] min-h-[40px] py-2.5 px-2 bg-transparent border-0 outline-none text-sm text-white/90 placeholder-gray-500 resize-none font-sans overflow-y-auto leading-relaxed select-text cursor-text"
            style={{ height: 'auto' }}
            rows={1}
          />

          {/* Send Action Button */}
          <button
            onClick={handleSend}
            disabled={(!text.trim() && pendingFiles.length === 0) || disabled}
            className={`p-2.5 rounded-lg flex items-center justify-center transition-all duration-300 select-none ${
              (text.trim() || pendingFiles.length > 0) && !disabled
                ? 'bg-gradient-to-r from-quantum-500 to-cyber-500 text-white cursor-pointer hover:shadow-purple-glow hover:scale-105 active:scale-95'
                : 'bg-white/5 text-gray-600 cursor-default'
            }`}
            type="button"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

      </div>

      <style jsx global>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down {
          animation: slideDown 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
