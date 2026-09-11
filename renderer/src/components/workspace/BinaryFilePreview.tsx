'use client';

import React, { useState } from 'react';
import { getFileType } from '@/utils/fileTypes';

interface BinaryFilePreviewProps {
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: 'pdf' | 'image' | 'binary' | 'text';
  content?: string;
  base64?: string;
}

export function BinaryFilePreview({
  filePath = '',
  fileName = '',
  fileSize,
  fileType: propFileType,
  content = '',
  base64 = ''
}: BinaryFilePreviewProps) {
  const [copied, setCopied] = useState(false);
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  const resolvedName = fileName || filePath.split(/[/\\]/).pop() || 'Unknown File';
  const resolvedExt = (resolvedName.split('.').pop() || '').toLowerCase();
  const fileType = propFileType || getFileType(filePath || resolvedName);

  // Formatted file size
  const formattedSize = fileSize
    ? fileSize > 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${(fileSize / 1024).toFixed(1)} KB`
    : null;

  const handleOpenExternal = async () => {
    if (!filePath) return;
    setOpenStatus('Launching...');
    try {
      const electron = (window as any).electronAPI || (window as any).electron;
      if (electron?.invoke) {
        await electron.invoke('workspace:openPath', filePath);
      } else if (electron?.workspace?.openPath) {
        await electron.workspace.openPath(filePath);
      } else if (electron?.shell?.openPath) {
        await electron.shell.openPath(filePath);
      }
      setOpenStatus('Opened in System App');
      setTimeout(() => setOpenStatus(null), 3000);
    } catch (err: any) {
      setOpenStatus('Launch failed');
      setTimeout(() => setOpenStatus(null), 3000);
    }
  };

  const handleCopyPath = () => {
    if (!filePath) return;
    navigator.clipboard.writeText(filePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. IMAGE PREVIEW
  if (fileType === 'image') {
    const imgSrc = base64
      ? (base64.startsWith('data:') ? base64 : `data:image/${resolvedExt === 'svg' ? 'svg+xml' : resolvedExt};base64,${base64}`)
      : (content && content.startsWith('data:') ? content : '');

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#07070D] border border-cyan-500/20 rounded-xl overflow-hidden min-h-[260px] select-none">
        <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-white/10 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
              IMAGE: {resolvedExt.toUpperCase()}
            </span>
            <span className="text-zinc-300 truncate max-w-[200px]">{resolvedName}</span>
          </div>
          {formattedSize && <span className="text-zinc-500">{formattedSize}</span>}
        </div>

        {imgSrc ? (
          <div className="relative max-h-[340px] max-w-full overflow-hidden rounded-lg border border-white/10 bg-black/40 flex items-center justify-center p-2 shadow-inner">
            <img
              src={imgSrc}
              alt={resolvedName}
              className="max-h-[300px] max-w-full object-contain rounded drop-shadow-md"
            />
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs">
            [ Image preview pending: stream loaded ]
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {filePath && (
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              {openStatus || '↗ Open in System Viewer'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. PDF PREVIEW CARD
  if (fileType === 'pdf') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#110B10] to-[#080509] border border-rose-500/30 rounded-xl min-h-[260px] select-none text-center shadow-lg shadow-rose-950/20">
        {/* PDF Badge Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(244,63,94,0.25)]">
          <svg className="w-8 h-8 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M10 13a1 1 0 0 0-1 1v4" />
            <path d="M14 13a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2v-4h2z" />
          </svg>
        </div>

        {/* Header and Tag */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-semibold tracking-wider uppercase mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          PDF Document
        </div>

        {/* File Name & Path */}
        <h4 className="text-sm font-semibold text-white tracking-wide mb-1 max-w-sm truncate">
          {resolvedName}
        </h4>
        {formattedSize && (
          <p className="text-[11px] font-mono text-zinc-400 mb-3">
            Size: {formattedSize}
          </p>
        )}

        {/* Security / UTF-8 Bypass Notice */}
        <div className="max-w-md p-3 rounded-lg bg-black/40 border border-white/5 mb-5 text-left font-mono text-[10px] text-zinc-400 leading-relaxed">
          <div className="text-rose-400 font-semibold mb-1 flex items-center gap-1">
            <span>🛡️</span> [ Binary Stream Protected ]
          </div>
          Direct plain UTF-8 text decoding bypassed to prevent mojibake symbols and memory corruption. Use an external PDF viewer to view full vector graphics and document pages.
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {filePath && (
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-mono text-xs font-semibold shadow-md shadow-rose-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              {openStatus || '↗ Open in Default PDF Viewer'}
            </button>
          )}
          {filePath && (
            <button
              type="button"
              onClick={handleCopyPath}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono text-xs transition-colors cursor-pointer"
              title="Copy Full File Path"
            >
              {copied ? '✓ Path Copied' : '📋 Copy Path'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. COMPILED / NON-TEXT BINARY ASSET CARD
  const isArchive = ['zip', 'tar', 'gz', '7z', 'rar'].includes(resolvedExt);
  const isExec = ['exe', 'dll', 'bin', 'so', 'dylib'].includes(resolvedExt);
  const isMedia = ['mp3', 'mp4', 'wav', 'ogg', 'mkv', 'avi', 'mov'].includes(resolvedExt);
  const isFont = ['woff', 'woff2', 'ttf', 'otf'].includes(resolvedExt);

  const categoryLabel = isArchive
    ? 'Archive Package'
    : isExec
    ? 'Executable Binary'
    : isMedia
    ? 'Media Stream'
    : isFont
    ? 'Typeface Asset'
    : 'Binary Asset';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#0E0E18] to-[#07070C] border border-purple-500/30 rounded-xl min-h-[260px] select-none text-center shadow-lg shadow-purple-950/20">
      {/* Binary Chip Icon */}
      <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(168,85,247,0.25)]">
        <svg className="w-8 h-8 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="14" x2="4" y2="14" />
        </svg>
      </div>

      {/* Header and Tag */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-semibold tracking-wider uppercase mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
        {categoryLabel}: {resolvedExt.toUpperCase() || 'RAW'}
      </div>

      {/* File Name & Path */}
      <h4 className="text-sm font-semibold text-white tracking-wide mb-1 max-w-sm truncate">
        {resolvedName}
      </h4>
      {formattedSize && (
        <p className="text-[11px] font-mono text-zinc-400 mb-3">
          Size: {formattedSize}
        </p>
      )}

      {/* Security / UTF-8 Bypass Notice */}
      <div className="max-w-md p-3 rounded-lg bg-black/40 border border-white/5 mb-5 text-left font-mono text-[10px] text-zinc-400 leading-relaxed">
        <div className="text-purple-400 font-semibold mb-1 flex items-center gap-1">
          <span>⚡</span> [ Non-Text Binary Payload ]
        </div>
        Raw binary data detected. Plain text UTF-8 reading bypassed to eliminate broken mojibake symbols and buffer overflows.
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        {filePath && (
          <button
            type="button"
            onClick={handleOpenExternal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-semibold shadow-md shadow-purple-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            {openStatus || '↗ Open in System App'}
          </button>
        )}
        {filePath && (
          <button
            type="button"
            onClick={handleCopyPath}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono text-xs transition-colors cursor-pointer"
            title="Copy Full File Path"
          >
            {copied ? '✓ Path Copied' : '📋 Copy Path'}
          </button>
        )}
      </div>
    </div>
  );
}
