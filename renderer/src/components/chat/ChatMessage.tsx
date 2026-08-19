'use client';

import React from 'react';
import { Attachment } from '@/context/AppContext';
import { FilePreview } from './FilePreview';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

export function ChatMessage({ role, content, timestamp, attachments }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div
        className={`max-w-[80%] flex flex-col gap-1.5 transition-all duration-300 ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Role and time header */}
        <div className="flex items-center gap-2 px-1 text-[10px] font-mono text-gray-500 uppercase tracking-wider select-none">
          <span>{isUser ? 'You' : 'Orion-X'}</span>
          <span>•</span>
          <span>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Bubble contents */}
        {isUser ? (
          <div className="flex flex-col items-end gap-2">
            {content && (
              <div className="rounded-2xl bg-gradient-to-tr from-cyber-600/35 to-cyber-500/20 border border-cyber-500/30 px-5 py-3 text-sm text-white/95 shadow-blue-glow select-text selectable-text">
                <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
              </div>
            )}
            
            {/* User Attachments display */}
            {attachments && attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                {attachments.map((file, idx) => (
                  <FilePreview
                    key={`${file.name}-${idx}`}
                    name={file.name}
                    size={file.size}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel border-l-2 border-l-quantum-500 rounded-2xl px-5 py-4 text-sm shadow-glass-shadow w-full select-text selectable-text">
            {/* Modular Markdown and Code Highlight Renderer */}
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
export default ChatMessage;
