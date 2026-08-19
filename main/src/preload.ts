import { contextBridge, ipcRenderer } from 'electron';

const workspaceBindings = {
  registerTarget: (payload: any) => ipcRenderer.invoke('workspace:register-target', payload),
  scanGraph: (payload: any) => ipcRenderer.invoke('workspace:scanGraph', payload),
  createThread: (id: string, title: string) =>
    ipcRenderer.invoke('workspace:createThread', id, title),
  getThreads: () =>
    ipcRenderer.invoke('workspace:getThreads'),
  deleteThread: (id: string) =>
    ipcRenderer.invoke('workspace:deleteThread', id),
  getMessages: (threadId: string) =>
    ipcRenderer.invoke('workspace:getMessages', threadId),
  addMessage: (id: string, threadId: string, role: string, content: string) =>
    ipcRenderer.invoke('workspace:addMessage', id, threadId, role, content),
  openDialog: () =>
    ipcRenderer.invoke('workspace:open-dialog'),
  readFile: (filePath: string) =>
    ipcRenderer.invoke('workspace:readFile', filePath),
};

const aiBindings = {
  sendMessage: (payload: any) => ipcRenderer.invoke('ai:sendMessage', payload),
  sendAiMessage: (agentContext: string, message: string) =>
    ipcRenderer.invoke('ai:sendMessage', { agentContext, message }),
  submitPrompt: (threadId: string, currentMessage: string) =>
    ipcRenderer.invoke('ai:submit-prompt', { threadId, currentMessage }),
  onStreamToken: (cb: (data: { token: string }) => void) => {
    const listener = (_: any, data: { token: string }) => cb(data);
    ipcRenderer.on('ai:stream-token', listener);
    return () => ipcRenderer.off('ai:stream-token', listener);
  },
  onStreamComplete: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('ai:stream-complete', listener);
    return () => ipcRenderer.off('ai:stream-complete', listener);
  },
};

const electronBindings = {
  workspace: workspaceBindings,
  WORKSPACE: workspaceBindings,
  ai: aiBindings,
  AI: aiBindings,
  ipcRenderer: {
    send: (channel: string, data: any) => ipcRenderer.send(channel, data),
    invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data),
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (event: any, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    off: (channel: string, func: any) => ipcRenderer.removeListener(channel, func),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
  },
  settings: {
    get: (key: string, defaultValue: any) =>
      ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key: string, value: any) =>
      ipcRenderer.invoke('settings:set', key, value),
    save: (configPayload: any) =>
      ipcRenderer.invoke('settings:save-matrix', configPayload),
    load: () =>
      ipcRenderer.invoke('settings:load-matrix'),
  },
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },
  chat: {
    submit: (threadId: string, messageId: string, content: string, model: string) =>
      ipcRenderer.send('chat:submit', threadId, messageId, content, model),
    onChunk: (cb: (token: string) => void) => {
      const listener = (_: any, token: string) => cb(token);
      ipcRenderer.on('chat:stream-chunk', listener);
      return () => ipcRenderer.off('chat:stream-chunk', listener);
    },
    onEnd: (cb: (data: { assistantMessageId: string }) => void) => {
      const listener = (_: any, data: any) => cb(data);
      ipcRenderer.on('chat:stream-end', listener);
      return () => ipcRenderer.off('chat:stream-end', listener);
    },
    onError: (cb: (err: string) => void) => {
      const listener = (_: any, err: string) => cb(err);
      ipcRenderer.on('chat:stream-error', listener);
      return () => ipcRenderer.off('chat:stream-error', listener);
    },
    removeListeners: () => {
      ipcRenderer.removeAllListeners('chat:stream-chunk');
      ipcRenderer.removeAllListeners('chat:stream-end');
      ipcRenderer.removeAllListeners('chat:stream-error');
    },
    getActiveThread: (workspaceId: string) =>
      ipcRenderer.invoke('chat:get-active-thread', { workspaceId }),
    getMessages: (threadId: string) =>
      ipcRenderer.invoke('chat:get-messages', { threadId }),
    saveMessage: (payload: { threadId: string; role: string; content: string }) =>
      ipcRenderer.invoke('chat:save-message', payload),
  },
  file: {
    ingest: (msgId: string, path: string, name: string, size: number, type: string) =>
      ipcRenderer.invoke('file:ingest', msgId, path, name, size, type),
    getAttachments: (messageId: string) =>
      ipcRenderer.invoke('file:getAttachments', messageId),
  },
  knowledge: {
    index: (attachmentId: string, path: string) =>
      ipcRenderer.invoke('knowledge:index', attachmentId, path),
    queryChunks: (attachmentId: string) =>
      ipcRenderer.invoke('knowledge:queryChunks', attachmentId),
  },
};

// Catch-all unified proxy: expose across every possible naming scheme
try {
  contextBridge.exposeInMainWorld('electron', electronBindings);
  contextBridge.exposeInMainWorld('electronAPI', electronBindings);
  contextBridge.exposeInMainWorld('api', electronBindings);
} catch (e) {
  // Catch context isolation disabled cases
}

// Fallback safety injection loop directly into the global execution matrix
try {
  (window as any).electron = electronBindings;
  (window as any).electronAPI = electronBindings;
  (window as any).api = electronBindings;
  (window as any).apiFallback = electronBindings;
} catch (e) {
  // Catch fallback errors if any
}
