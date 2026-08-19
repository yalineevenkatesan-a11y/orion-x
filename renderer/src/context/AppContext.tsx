'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

export type AppState = 'splash' | 'home' | 'workspace';

export interface Attachment {
  name: string;
  size: number;
  type: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO String
  attachments?: Attachment[];
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string; // ISO String
}

interface AppContextType {
  currentAppState: AppState;
  setCurrentAppState: (state: AppState) => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  createNewWorkspaceThread: (title?: string) => Promise<void>;
  deleteWorkspaceThread: (id: string) => Promise<void>;
  sendSystemPrompt: (content: string, pendingFiles?: any[]) => Promise<void>;
  currentModel: string;
  setCurrentModel: (model: string) => void;
  isSettingsOpen: boolean;
  toggleSettings: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentAppState, setCurrentAppState] = useState<AppState>('splash');
  const [mounted, setMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Core Mappings state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('llama3');

  // References to keep track of active stream modifications
  const activeAssistantMsgIdRef = useRef<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);

  // Sync refs to state updates
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  // Safe wrapper for changing active thread selection
  const setActiveThreadId = async (id: string | null) => {
    setActiveThreadIdState(id);
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.settings.set('active_thread_id', id);
    }
  };

  // Hydrate states on client mount
  useEffect(() => {
    setMounted(true);

    const hydrateFromDesktop = async () => {
      if (typeof window === 'undefined' || !window.electronAPI) return;

      try {
        // 1. Fetch active global configurations
        const savedModel = await window.electronAPI.settings.get('active_model', 'llama3');
        setCurrentModel(savedModel);

        const savedActiveId = await window.electronAPI.settings.get('active_thread_id', null);

        // 2. Fetch and hydrate all threads alongside their messages from SQLite
        const dbThreads = await window.electronAPI.workspace.getThreads();
        const threadsWithMessages = await Promise.all(
          dbThreads.map(async (t: any) => {
            const dbMsgs = await window.electronAPI.workspace.getMessages(t.id);
            
            // Map messages and query attachments for each message block
            const messages = await Promise.all(
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
                  timestamp: new Date(m.timestamp).toISOString(),
                  attachments: attachments.length > 0 ? attachments : undefined,
                };
              })
            );

            return {
              id: t.id,
              title: t.title,
              messages,
              createdAt: new Date(t.created_at).toISOString(),
            };
          })
        );

        setThreads(threadsWithMessages);

        // 3. Resolve active selection
        if (savedActiveId && threadsWithMessages.some((t) => t.id === savedActiveId)) {
          setActiveThreadIdState(savedActiveId);
        } else if (threadsWithMessages.length > 0) {
          setActiveThreadIdState(threadsWithMessages[0].id);
        }
      } catch (err) {
        console.error('Failed to hydrate context from SQLite databases:', err);
      }
    };

    hydrateFromDesktop();

    // 4. Wire up live stream tracking listeners
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Chunk tokens append listener
      window.electronAPI.chat.onChunk((token: string) => {
        const targetThreadId = activeThreadIdRef.current;
        const targetAssistantId = activeAssistantMsgIdRef.current;
        if (!targetThreadId || !targetAssistantId) return;

        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id === targetThreadId) {
              return {
                ...thread,
                messages: thread.messages.map((msg) => {
                  if (msg.id === targetAssistantId) {
                    return {
                      ...msg,
                      content: msg.content + token,
                    };
                  }
                  return msg;
                }),
              };
            }
            return thread;
          })
        );
      });

      // Stream end completion listener
      window.electronAPI.chat.onEnd((data: { assistantMessageId: string }) => {
        const targetThreadId = activeThreadIdRef.current;
        const tempAssistantId = activeAssistantMsgIdRef.current;
        if (!targetThreadId || !tempAssistantId) return;

        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id === targetThreadId) {
              return {
                ...thread,
                messages: thread.messages.map((msg) => {
                  if (msg.id === tempAssistantId) {
                    return {
                      ...msg,
                      id: data.assistantMessageId, // Sync temp ID to SQLite permanent ID
                    };
                  }
                  return msg;
                }),
              };
            }
            return thread;
          })
        );

        activeAssistantMsgIdRef.current = null;
      });

      // Stream error listener
      window.electronAPI.chat.onError((errMessage: string) => {
        const targetThreadId = activeThreadIdRef.current;
        const tempAssistantId = activeAssistantMsgIdRef.current;
        if (!targetThreadId || !tempAssistantId) return;

        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id === targetThreadId) {
              return {
                ...thread,
                messages: thread.messages.map((msg) => {
                  if (msg.id === tempAssistantId) {
                    return {
                      ...msg,
                      content: msg.content + `\n\n*[Inference Error: ${errMessage}]*`,
                    };
                  }
                  return msg;
                }),
              };
            }
            return thread;
          })
        );

        activeAssistantMsgIdRef.current = null;
      });
    }

    // Cleanup listeners on unmount
    return () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.chat.removeListeners();
      }
    };
  }, []);

  // Update active model changes in DB settings
  const handleModelChange = async (model: string) => {
    setCurrentModel(model);
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.settings.set('active_model', model);
    }
  };

  // Automatic transition from splash to home
  useEffect(() => {
    if (currentAppState === 'splash') {
      const timer = setTimeout(() => {
        setCurrentAppState('home');
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [currentAppState]);

  const createNewWorkspaceThread = async (title?: string) => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    try {
      const id = crypto.randomUUID();
      const threadTitle = title || `Workspace Thread ${threads.length + 1}`;
      
      // Save directly to system SQLite
      await window.electronAPI.workspace.createThread(id, threadTitle);

      const newThread: ChatThread = {
        id,
        title: threadTitle,
        createdAt: new Date().toISOString(),
        messages: [],
      };

      setThreads((prev) => [newThread, ...prev]);
      await setActiveThreadId(id);
    } catch (error) {
      console.error('Failed to create workspace thread in database:', error);
    }
  };

  const deleteWorkspaceThread = async (id: string) => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    try {
      // Delete from SQLite
      await window.electronAPI.workspace.deleteThread(id);

      setThreads((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        
        // Relocate active selection if needed
        if (activeThreadId === id) {
          if (filtered.length > 0) {
            setActiveThreadId(filtered[0].id);
          } else {
            setActiveThreadId(null);
          }
        }
        return filtered;
      });
    } catch (error) {
      console.error('Failed to delete workspace thread from database:', error);
    }
  };

  const sendSystemPrompt = async (content: string, pendingFiles?: any[]) => {
    if (typeof window === 'undefined' || !window.electronAPI || !activeThreadId) return;

    const userMsgId = crypto.randomUUID();
    const tempAssistantId = `temp-${crypto.randomUUID()}`;

    // Package local user message model
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachments: pendingFiles
        ? pendingFiles.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          }))
        : undefined,
    };

    // Package local placeholder assistant message model
    const assistantPlaceholder: Message = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    // Update state instantly for snappy UI updates
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id === activeThreadId) {
          return {
            ...thread,
            messages: [...thread.messages, userMsg, assistantPlaceholder],
          };
        }
        return thread;
      })
    );

    activeAssistantMsgIdRef.current = tempAssistantId;

    try {
      // 1. Ingest files into sandbox and save to SQLite
      if (pendingFiles && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await window.electronAPI.file.ingest(
            userMsgId,
            file.path,
            file.name,
            file.size,
            file.type
          );
        }
      }

      // 2. Submit prompt to the Chat Orchestrator IPC channel
      window.electronAPI.chat.submit(activeThreadId, userMsgId, content, currentModel);
    } catch (error) {
      console.error('Failed to submit prompt through chat pipelines:', error);
      
      // Update assistant message with local submit error representation
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id === activeThreadId) {
            return {
              ...thread,
              messages: thread.messages.map((m) => {
                if (m.id === tempAssistantId) {
                  return {
                    ...m,
                    content: `*[Pipeline Error: Prompt delivery failed.]*`,
                  };
                }
                return m;
              }),
            };
          }
          return thread;
        })
      );
      activeAssistantMsgIdRef.current = null;
    }
  };

  const toggleSettings = () => {
    setIsSettingsOpen((prev) => !prev);
  };

  // Prevent flash rendering issues before hydration checks
  if (!mounted) {
    return (
      <div className="bg-obsidian-950 min-h-screen w-full flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-quantum-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        currentAppState,
        setCurrentAppState,
        threads,
        activeThreadId,
        setActiveThreadId,
        createNewWorkspaceThread,
        deleteWorkspaceThread,
        sendSystemPrompt,
        currentModel,
        setCurrentModel: handleModelChange,
        isSettingsOpen,
        toggleSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
