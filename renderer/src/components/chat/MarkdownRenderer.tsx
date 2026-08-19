'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeTerminalBlock } from './CodeTerminalBlock';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert max-w-none text-white/90 leading-relaxed text-sm">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isCodeBlock = match || String(children).includes('\n');
            
            return isCodeBlock ? (
              <CodeTerminalBlock
                language={match ? match[1] : 'text'}
                value={String(children).replace(/\n$/, '')}
              />
            ) : (
              <code
                className="bg-white/10 px-1.5 py-0.5 rounded text-[13px] font-mono text-quantum-400"
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="leading-relaxed mb-3 text-white/90 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 text-gray-200 mb-2 flex flex-col gap-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 text-gray-200 mb-2 flex flex-col gap-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="mb-0.5">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-cyan-400 font-semibold mb-2 mt-4 text-base first:mt-0">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-cyan-400 font-semibold mb-2 mt-3 text-sm first:mt-0">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-cyan-400 font-semibold mb-1.5 mt-2.5 first:mt-0 text-[13px]">{children}</h3>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
export default MarkdownRenderer;
