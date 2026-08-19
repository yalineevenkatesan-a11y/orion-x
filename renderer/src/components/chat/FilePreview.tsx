'use client';

import React from 'react';

interface FilePreviewProps {
  name: string;
  size: number;
  onRemove?: () => void;
}

export function FilePreview({ name, size, onRemove }: FilePreviewProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 select-none">
      
      {/* File Document Icon */}
      <svg className="w-4 h-4 text-cyber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>

      {/* Name and Size */}
      <div className="flex flex-col min-w-0 pr-1">
        <span className="text-[11px] font-medium text-white truncate max-w-[120px] leading-tight" title={name}>
          {name}
        </span>
        <span className="text-[9px] text-gray-500 font-mono leading-none">
          {formatSize(size)}
        </span>
      </div>

      {/* Remove Button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-white transition-colors text-sm font-bold flex items-center justify-center p-0.5 rounded hover:bg-white/10 cursor-pointer ml-1 active:scale-90 select-none"
          type="button"
          title="Remove attachment"
        >
          &times;
        </button>
      )}

    </div>
  );
}
