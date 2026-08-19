export interface ElectronAPI {
  settings: {
    get: (key: string, defaultValue: any) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  workspace: {
    createThread: (id: string, title: string) => Promise<void>;
    getThreads: () => Promise<any[]>;
    deleteThread: (id: string) => Promise<void>;
    getMessages: (threadId: string) => Promise<any[]>;
    addMessage: (id: string, threadId: string, role: string, content: string) => Promise<void>;
    openDialog: () => Promise<string | null>;
    registerTarget: (payload: { name: string; path: string; gitUrl?: string }) => Promise<any>;
  };
  ai: {
    submitPrompt: (threadId: string, currentMessage: string) => Promise<void>;
    onStreamToken: (cb: (data: { token: string }) => void) => () => void;
    onStreamComplete: (cb: () => void) => () => void;
  };
  chat: {
    submit: (threadId: string, messageId: string, content: string, model: string) => void;
    onChunk: (cb: (token: string) => void) => () => void;
    onEnd: (cb: (data: { assistantMessageId: string }) => void) => () => void;
    onError: (cb: (err: string) => void) => () => void;
    removeListeners: () => void;
    getActiveThread: (workspaceId: string) => Promise<any>;
    getMessages: (threadId: string) => Promise<any[]>;
    saveMessage: (payload: { threadId: string; role: string; content: string }) => Promise<any>;
  };
  file: {
    ingest: (msgId: string, path: string, name: string, size: number, type: string) => Promise<void>;
    getAttachments: (messageId: string) => Promise<any[]>;
  };
  knowledge: {
    index: (attachmentId: string, path: string) => Promise<void>;
    queryChunks: (attachmentId: string) => Promise<any[]>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
