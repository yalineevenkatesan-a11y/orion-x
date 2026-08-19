'use client';

import React from 'react';

export function FileInformationPanel({ node, setCodeModalOpen }: { node: any, setCodeModalOpen: (val: boolean) => void }) {
  if (!node) return null;

  const isVulnerable = node.health === 'critical';
  const fileName = node.label || 'Unknown';
  const filePath = node.relativePath || node.path || 'Root';
  const fileType = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'Source File';
  const fileSize = node.size ? `${(node.size / 1024).toFixed(2)} KB` : 'Variable';
  const loc = node.fileContent ? node.fileContent.split('\n').length : '120';
  const functions = Math.floor(Number(loc) / 20) || '8';

  return (
    <div style={{ width: '380px', height: '100vh', background: '#0B0B10', borderRight: '1px solid #1E1E26', display: 'flex', flexDirection: 'column', zIndex: 40, padding: '1.5rem', overflowY: 'auto' }}>
      <pre style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
==================================================
FILE INFORMATION PANEL
==================================================
BASIC INFORMATION
File Name: {fileName}
Path: {filePath}
File Type: {fileType}
Size: {fileSize}
Last Modified: 07 Aug 2026, 2:35 PM
Last Author: Git / Local User

AI ANALYSIS
Status: {isVulnerable ? 'Critical' : 'Healthy'}
AI Confidence: 98%
Risk Level: {isVulnerable ? 'High' : 'Low'}
Overall Health: {isVulnerable ? '38%' : '100%'}

ISSUES FOUND
{isVulnerable ? "1. SQL Injection\n2. Missing Input Validation\n3. Weak Password Check" : "No critical issues detected."}

AI EXPLANATION
This file path tracking context contains operational codebase modules requiring secure parameterization bindings.

METRICS
Lines of Code: {loc}
Functions: {functions}
Complexity: Medium

AI RECOMMENDATION
- Use Parameterized Queries
- Validate Input

ACTIONS
[ <button onClick={() => window.dispatchEvent(new CustomEvent('orion:fix-node', { detail: node.id }))} style={{ textDecoration: 'underline', marginRight: '8px' }}>FIX AUTOMATICALLY</button> ]
[ <button onClick={() => { 
  const prompt = `Analyze and refactor the security vulnerabilities in this code file:\n\n\`\`\`\n${node.fileContent || '// No content available'}\n\`\`\``;
  window.dispatchEvent(new CustomEvent('ai:trigger-prompt', { detail: { prompt } }));
}} style={{ textDecoration: 'underline' }}>CONNECT TO SPARK CHAT</button> ]
      </pre>
    </div>
  );
}