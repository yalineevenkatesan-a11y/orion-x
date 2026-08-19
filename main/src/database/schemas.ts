export const CREATE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS settings (
    keys TEXT PRIMARY KEY,
    value TEXT
  );
`;

export const CREATE_THREADS_TABLE = `
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at INTEGER
  );
`;

export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT,
    role TEXT,
    content TEXT,
    timestamp INTEGER,
    FOREIGN KEY (thread_id) REFERENCES threads (id) ON DELETE CASCADE
  );
`;

export const CREATE_ATTACHMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    name TEXT,
    size INTEGER,
    system_path TEXT,
    mime_type TEXT,
    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
  );
`;

export const CREATE_DOCUMENT_CHUNKS_TABLE = `
  CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    attachment_id TEXT,
    content TEXT,
    chunk_index INTEGER,
    metadata TEXT,
    FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
  );
`;

export const CREATE_WORKSPACES_TABLE = `
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT,
    path TEXT,
    git_url TEXT,
    created_at INTEGER
  );
`;

export const CREATE_CHAT_THREADS_TABLE = `
  CREATE TABLE IF NOT EXISTS chat_threads (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );
`;

export const CREATE_CHAT_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
  );
`;

export const SCHEMAS = [
  CREATE_SETTINGS_TABLE,
  CREATE_THREADS_TABLE,
  CREATE_MESSAGES_TABLE,
  CREATE_ATTACHMENTS_TABLE,
  CREATE_DOCUMENT_CHUNKS_TABLE,
  CREATE_WORKSPACES_TABLE,
  CREATE_CHAT_THREADS_TABLE,
  CREATE_CHAT_MESSAGES_TABLE
];
