'use client';

import React, { useState } from 'react';

interface CodeTerminalBlockProps {
  language: string;
  value: string;
}

export function highlightSyntax(code: string): React.ReactNode {
  const lines = code.split('\n');
  
  return (
    <code>
      {lines.map((line, lineIdx) => {
        // Splitting by quotes, variable declaration keywords, and control keywords
        const parts = line.split(
          /("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?|\bconst\b|\blet\b|\bvar\b|\bif\b|\breturn\b|\basync\b|\bawait\b|\bimport\b|\bexport\b|\bfrom\b|\bfor\b|\bwhile\b|\belse\b)/g
        );
        
        return (
          <div key={lineIdx} className="min-h-[1.2rem] whitespace-pre">
            {parts.map((part, partIdx) => {
              if (!part) return null;
              
              // String literals colorizer (soft amber)
              if (
                part.startsWith('"') ||
                part.startsWith("'") ||
                part.startsWith('`')
              ) {
                return (
                  <span key={partIdx} className="text-amber-300">
                    {part}
                  </span>
                );
              }
              
              // Variable declarations colorizer (vibrant neon magenta)
              if (['const', 'let', 'var'].includes(part)) {
                return (
                  <span key={partIdx} className="text-[#ff007f] font-semibold">
                    {part}
                  </span>
                );
              }
              
              // Control keywords colorizer (neon cyan)
              if (
                ['if', 'return', 'async', 'await', 'import', 'export', 'from', 'for', 'while', 'else'].includes(
                  part
                )
              ) {
                return (
                  <span key={partIdx} className="text-cyan-400 font-semibold">
                    {part}
                  </span>
                );
              }
              
              return <span key={partIdx}>{part}</span>;
            })}
          </div>
        );
      })}
    </code>
  );
}

export function CodeTerminalBlock({ language, value }: CodeTerminalBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code to clipboard:', err);
    }
  };

  return (
    <div className="bg-black/50 border border-white/10 rounded-xl my-4 overflow-hidden font-mono shadow-2xl select-text">
      {/* Sleek, glass header row bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5 select-none">
        <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] font-mono text-quantum-400 hover:text-white transition-colors cursor-pointer outline-none"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code syntax highlighted viewport */}
      <div className="p-4 overflow-x-auto text-[13px] leading-relaxed text-gray-200 select-text">
        {highlightSyntax(value)}
      </div>
    </div>
  );
}
export default CodeTerminalBlock;
