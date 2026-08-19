import { ipcMain, BrowserWindow } from 'electron';
import { OllamaProvider } from '../services/OllamaProvider';
import { DatabaseEngine } from '../database/DatabaseEngine';
import { SettingsRegistry } from '../services/SettingsRegistry';
import { MessageRepository } from '../database/MessageRepository';
import crypto from 'crypto';

const activeAbortControllers = new Map<string, AbortController>();
import fs from 'fs';
import path from 'path';

function getDirectoryTree(dirPath: string, depth: number = 0, maxDepth: number = 3): string {
  if (depth > maxDepth) return '';
  if (!fs.existsSync(dirPath)) return '';
  
  let result = '';
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === 'build' || item === 'dist' || item === '.next') continue;
      
      const itemPath = path.join(dirPath, item);
      const indent = '  '.repeat(depth);
      
      if (fs.statSync(itemPath).isDirectory()) {
        result += `${indent}- [DIR] ${item}\n`;
        result += getDirectoryTree(itemPath, depth + 1, maxDepth);
      } else {
        result += `${indent}- ${item}\n`;
      }
    }
  } catch (err) {
    console.error('Error reading directory tree:', err);
  }
  return result;
}

export function initializeLocalAIController(): void {
  const messageRepo = new MessageRepository();

  // Handle model tag queries
  ipcMain.handle('ai:listModels', async () => {
    return OllamaProvider.getInstance().listModels();
  });

  // Implement ai:sendMessage with mocked fallback logic for AI Engine timeouts
  ipcMain.handle('ai:sendMessage', async (_event, payload: { agentContext: string, message: string }) => {
    return new Promise((resolve) => {
      // Mocked fallback simulated latency
      setTimeout(() => {
        let title = 'System Fallback';
        if (payload.agentContext === 'architect') title = 'Architect Fallback Mode';
        else if (payload.agentContext === 'developer') title = 'Developer Fallback Mode';
        else if (payload.agentContext === 'security') title = 'Security Fallback Mode';
        
        resolve({
          success: true,
          response: `[${title}]: Core system workspace mapped. Ready for your instructions.`
        });
      }, 500);
    });
  });

  // Handle low-latency streaming completions (legacy/backup channel)
  ipcMain.on('ai:sendMessageStream', async (event, payload) => {
    const { message, history, role, activeFileContent } = payload;
    
    // 1. Explicitly inject System Role Definition + Selected 3D Node Code Context
    const systemPrompt = `You are the ${role.toUpperCase()} agent in the ORION-X system. 
    Your primary objective is to review code, provide functional code replacements, and optimization recommendations.
    ACTIVE FILE CONTEXT IN FOCUS:\n${activeFileContent || "No file currently selected."}`;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    try {
      // 2. Pivot Ollama to stream: true mode
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-coder:7b',
          messages: fullMessages,
          stream: true
        })
      });

      const reader = response.body;
      if (!reader) return;

      // Stream word-by-word straight to the focused UI window context
      (reader as any).on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              event.reply('ai:token-stream', { token: parsed.message.content, role });
            }
          } catch (e) {
            // Ignore parse errors on incomplete chunks
          }
        }
      });
    } catch (err: any) {
      event.reply('ai:token-stream', { token: `\n[ERROR]: Stream execution failed: ${err.message}`, role });
    }
  });

  // Implement ai:sendMessage with mocked fallback logic for AI Engine timeouts
  ipcMain.removeHandler('ai:sendMessage');
  ipcMain.handle('ai:sendMessage', async (_event, payload: { agentContext: string, message: string }) => {
    return new Promise((resolve) => {
      // Mocked fallback simulated latency
      setTimeout(() => {
        let title = 'System Fallback';
        if (payload.agentContext === 'architect') title = 'Architect Fallback Mode';
        else if (payload.agentContext === 'developer') title = 'Developer Fallback Mode';
        else if (payload.agentContext === 'security') title = 'Security Fallback Mode';
        
        resolve({
          success: true,
          response: `[${title}]: Core system workspace mapped. Ready for your instructions.`
        });
      }, 500);
    });
  });

  // Handle low-latency streaming completions (legacy/backup channel)
  ipcMain.on(
    'ai:submitPrompt',
    async (event, model: string, messages: Array<{ role: string; content: string }>) => {
      try {
        await OllamaProvider.getInstance().streamInference(
          model,
          messages,
          (chunk: string) => {
            // Instantly transmit tokens back to renderer process
            event.sender.send('ai:stream-chunk', chunk);
          }
        );
        // Fire end completion event
        event.sender.send('ai:stream-end');
      } catch (error: any) {
        event.sender.send('ai:stream-error', error.message || String(error));
      }
    }
  );

  // New core token-by-token streaming engine
  ipcMain.handle('ai:submit-prompt', async (_event, payload: { threadId: string; currentMessage: string }) => {
    const { threadId, currentMessage } = payload;
    const win = BrowserWindow.getAllWindows()[0];
    let model = 'qwen2.5-coder:7b';

    try {
      // 1. Query full conversational history of the thread sorted chronologically from JSON repository
      const dbMsgs = await messageRepo.getMessagesByThread(threadId);
      const history = dbMsgs.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Construct messages payload (history + current user message)
      const messages = [
        ...history,
        { role: 'user', content: currentMessage }
      ];

      // 2. Fetch active model setting configuration
      model = await SettingsRegistry.get('active_model', 'qwen2.5-coder:7b');

      // 3. Build network request pointing to local Ollama API server chat route
      const endpoint = await SettingsRegistry.get('ai_endpoint', 'http://localhost:11434');
      const url = `${endpoint}/api/chat`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true })
      });

      if (!response.ok) {
        throw new Error(`Ollama server returned error status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Ollama response body stream is null.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let consolidatedResponse = '';

      // Read chunked JSON data fragments natively
      for await (const chunk of response.body as any) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        
        // Retain the last incomplete line inside the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line) as {
              message?: { content?: string };
              done?: boolean;
            };

            if (parsed.message?.content) {
              const token = parsed.message.content;
              consolidatedResponse += token;
              if (win) {
                win.webContents.send('ai:stream-token', { token });
              }
            }
          } catch (jsonErr) {
            // Ignore incomplete parsing boundaries
          }
        }
      }

      // Process final remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer) as { message?: { content?: string } };
          if (parsed.message?.content) {
            const token = parsed.message.content;
            consolidatedResponse += token;
            if (win) {
              win.webContents.send('ai:stream-token', { token });
            }
          }
        } catch (e) {}
      }

      // 4. Save consolidated assistant response message completely into JSON storage
      const messageId = `msg_${crypto.randomBytes(4).toString('hex')}`;
      await messageRepo.saveMessage({
        id: messageId,
        threadId,
        role: 'assistant',
        content: consolidatedResponse,
        timestamp: Date.now()
      });

      // 5. Fire stream complete event notification
      if (win) {
        win.webContents.send('ai:stream-complete');
      }
    } catch (err: any) {
      console.error('Error in ai:submit-prompt handler:', err);

      // Fallback mock stream for offline server faults
      const errorMessage = `[System Error: Local AI Server Unreachable]\n\nPlease verify that your local Ollama application is running at http://localhost:11434 and the model '${model}' is installed.\n\nDetails: ${err.message || String(err)}`;

      if (win) {
        win.webContents.send('ai:stream-token', { token: errorMessage });
      }

      // Save error message representation to database
      const errMsgId = `msg_${crypto.randomBytes(4).toString('hex')}`;
      await messageRepo.saveMessage({
        id: errMsgId,
        threadId,
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now()
      });

      if (win) {
        win.webContents.send('ai:stream-complete');
      }
    }
  });
}
export default initializeLocalAIController;
