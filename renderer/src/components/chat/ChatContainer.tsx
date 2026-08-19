'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useApp, Attachment } from '@/context/AppContext';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Spinner } from '../ui/Spinner';

export function ChatContainer() {
  const { activeWorkspace } = useWorkspaceUi();

  const [activeThread, setActiveThread] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Sync scroll to bottom when messages update
  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, messages[messages.length - 1]?.content]);

  // Load active thread and message history when activeWorkspace changes
  useEffect(() => {
    if (!activeWorkspace) {
      setActiveThread(null);
      setMessages([]);
      return;
    }

    const loadChatHistory = async () => {
      try {
        if (typeof window !== 'undefined' && window.electronAPI) {
          // 1. Get or create active chat thread for this workspace
          const thread = await window.electronAPI.chat.getActiveThread(activeWorkspace.id);
          setActiveThread(thread);

          // 2. Fetch history messages for the resolved thread
          const dbMsgs = await window.electronAPI.chat.getMessages(thread.id);
          const mappedMsgs = await Promise.all(
            dbMsgs.map(async (m: any) => {
              // Fetch message attachments if any
              const dbAttachments = await window.electronAPI.file.getAttachments(m.id);
              const attachments = dbAttachments.map((a: any) => ({
                name: a.name,
                size: a.size,
                type: a.mime_type,
              }));

              return {
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: m.created_at,
                attachments: attachments.length > 0 ? attachments : undefined,
              };
            })
          );
          setMessages(mappedMsgs);
        }
      } catch (err) {
        console.error('Failed to load chat history for active workspace:', err);
      }
    };

    loadChatHistory();
  }, [activeWorkspace]);

  // Wire up live stream tracking listeners using the new token-by-token engine
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI || !activeThread) return;

    const removeToken = window.electronAPI.ai.onStreamToken((data: { token: string }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id.startsWith('temp-')) {
            return {
              ...msg,
              content: msg.content + data.token,
            };
          }
          return msg;
        })
      );
    });

    const removeComplete = window.electronAPI.ai.onStreamComplete(() => {
      // Reload message history from database to align all IDs and content cleanly
      const reloadHistory = async () => {
        try {
          const dbMsgs = await window.electronAPI.chat.getMessages(activeThread.id);
          const mappedMsgs = await Promise.all(
            dbMsgs.map(async (m: any) => {
              const dbAttachments = await window.electronAPI.file.getAttachments(m.id);
              const attachments = dbAttachments.map((a: any) => ({
                name: a.name,
                size: a.size,
                type: a.mime_type,
              }));

              return {
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: m.created_at,
                attachments: attachments.length > 0 ? attachments : undefined,
              };
            })
          );
          setMessages(mappedMsgs);
        } catch (err) {
          console.error('Failed to reload history after stream completion:', err);
        }
      };

      reloadHistory();
      setIsThinking(false);
    });

    return () => {
      removeToken();
      removeComplete();
    };
  }, [activeThread]);

  const handleSendMessage = async (content: string, pendingFiles?: Attachment[]) => {
    if (!activeThread || !window.electronAPI) return;

    const userMsgId = `msg-${Date.now()}`;
    const tempAssistantId = `temp-${Date.now()}`;

    try {
      // 1. Immediately invoke saveMessage to anchor the 'user' prompt in SQLite
      await window.electronAPI.chat.saveMessage({
        threadId: activeThread.id,
        role: 'user',
        content,
      });

      // Ingest attachments if any
      if (pendingFiles && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          if ('path' in file) {
            await window.electronAPI.file.ingest(
              userMsgId,
              (file as any).path,
              file.name,
              file.size,
              file.type
            );
          }
        }
      }

      // 2. Add local user message and placeholder assistant message to React state
      const userMsg = {
        id: userMsgId,
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString(),
        attachments: pendingFiles,
      };

      const assistantPlaceholder = {
        id: tempAssistantId,
        role: 'assistant' as const,
        content: '',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setIsThinking(true);

      // 3. Initiate local AI streaming hooks using active submitPrompt channel
      window.electronAPI.ai.submitPrompt(activeThread.id, content);
    } catch (err) {
      console.error('Failed to save or process message prompt:', err);
    }
  };

  // Filter unique messages to eliminate duplicate render loops
  const uniqueMessages = messages.filter(
    (msg, index, self) => self.findIndex((m) => m.id === msg.id) === index
  );

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center text-center p-6 bg-transparent">
        <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-white/5 flex flex-col gap-5 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-quantum-500/10 border border-quantum-500/30 flex items-center justify-center mx-auto text-quantum-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold font-mono tracking-wider text-white">
              NO ACTIVE WORKSPACE
            </span>
            <span className="text-[10px] text-gray-500 leading-normal">
              Please enter an onboarding path or select a workspace thread to begin.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full justify-between bg-transparent select-text">
      
      {/* Scrollable Message Feed Frame */}
      <div className="flex-1 overflow-y-auto px-8 py-6 select-text playable-scroll scrollbar-thin">
        <div className="max-w-4xl mx-auto w-full flex flex-col">
          {uniqueMessages.map((message) => {
            const isPlaceholder = message.role === 'assistant' && !message.content;

            if (isPlaceholder) {
              return (
                <div key={message.id} className="flex w-full justify-start mb-6 animate-fade-in">
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="flex items-center gap-2 px-1 text-[10px] font-mono text-gray-500 uppercase tracking-wider select-none">
                      <span>Orion-X</span>
                      <span>•</span>
                      <span>thinking...</span>
                    </div>
                    <div className="glass-panel border-l-2 border-l-cyber-500 rounded-2xl px-5 py-4 shadow-glass-shadow flex items-center gap-3">
                      <Spinner size={16} />
                      <span className="text-xs font-mono text-gray-400 tracking-wider animate-pulse">
                        COMPUTING RESPONSE...
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={new Date(message.timestamp)}
                attachments={message.attachments}
              />
            );
          })}

          {/* Scroll Anchor */}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Floating Chat Input Baseline */}
      <div className="flex-shrink-0 z-20">
        <ChatInput onSendMessage={handleSendMessage} disabled={isThinking} />
      </div>
    </div>
  );
}
export default ChatContainer;
