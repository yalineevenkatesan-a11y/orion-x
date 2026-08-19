'use client';

import React, { useState } from 'react';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';

export function WorkspaceOnboardingWizard() {
  const { setWorkspaceState, onboardingWorkflow, setOnboardingWorkflow, setActiveWorkspace } = useWorkspaceUi();

  // Form states
  const [workspaceName, setWorkspaceName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [parentLocation, setParentLocation] = useState('');

  const handleBack = () => {
    setOnboardingWorkflow('NONE');
    setWorkspaceState('HUB');
  };

  const handleBrowse = async (setter: (val: string) => void) => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const selectedPath = await window.electronAPI.workspace.openDialog();
        if (selectedPath) {
          setter(selectedPath);
        }
      }
    } catch (err) {
      console.error('Error during folder selection browse:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent, payload: { name: string; path: string; gitUrl?: string }) => {
    e.preventDefault();
    if (!payload.path) {
      console.error('Cannot register target without folder path selection');
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const record = await window.electronAPI.workspace.registerTarget(payload);
        console.log('[OnboardingWizard] Final Payload Target Compiled: ', record);
        // Save the active workspace record in UI state context
        setActiveWorkspace(record);
        // Switch state directly to CONSOLE view
        setWorkspaceState('CONSOLE');
      }
    } catch (err) {
      console.error('Failed to register workspace target:', err);
    }
  };

  return (
    <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl text-white max-w-lg w-full transition-all duration-300">
      
      {/* Back button header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <button
          onClick={handleBack}
          className="text-xs font-mono text-quantum-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 outline-none"
        >
          ← BACK TO HUB
        </button>
        <span className="text-[10px] text-gray-500 font-mono tracking-wider">
          STAGE: ONBOARDING
        </span>
      </div>

      {/* Git Clone Form */}
      {onboardingWorkflow === 'GIT_CLONE' && (
        <form 
          onSubmit={(e) => handleSubmit(e, { name: workspaceName, path: gitUrl, gitUrl })}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1 text-center mb-2">
            <h2 className="text-sm font-semibold font-mono text-white uppercase tracking-wider">
              CLONE REMOTE REPOSITORY
            </h2>
            <p className="text-[10px] text-gray-500">Inject Git repository context into the workspace</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-gray-400">WORKSPACE NAME</label>
            <input
              type="text"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Orion Core Core"
              className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-cyan-500/50 outline-none font-sans"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-gray-400">GIT REPOSITORY URL</label>
            <input
              type="url"
              required
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              placeholder="https://github.com/username/project.git"
              className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-cyan-500/50 outline-none font-sans"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-mono text-xs font-semibold tracking-wider transition-colors cursor-pointer"
          >
            RUN GIT ONBOARDING
          </button>
        </form>
      )}

      {/* Open Local Form */}
      {onboardingWorkflow === 'OPEN_LOCAL' && (
        <form 
          onSubmit={(e) => {
            const name = folderPath.split('\\').pop() || folderPath.split('/').pop() || 'Local Project';
            handleSubmit(e, { name, path: folderPath });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1 text-center mb-2">
            <h2 className="text-sm font-semibold font-mono text-white uppercase tracking-wider">
              OPEN LOCAL PROJECT
            </h2>
            <p className="text-[10px] text-gray-500">Scan and register files from your local disk</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-gray-400">ABSOLUTE FOLDER PATH</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                required
                value={folderPath}
                placeholder="Click Browse Folder to select project directory..."
                className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none flex-1 font-mono text-gray-400 select-none"
              />
              <button
                type="button"
                onClick={() => handleBrowse(setFolderPath)}
                className="px-4 py-2 text-xs font-mono border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 rounded-xl text-white transition-all cursor-pointer select-none"
              >
                Browse Folder
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-mono text-xs font-semibold tracking-wider transition-colors cursor-pointer"
          >
            OPEN & SCAN PROJECT
          </button>
        </form>
      )}

      {/* Create New Form */}
      {onboardingWorkflow === 'CREATE_NEW' && (
        <form 
          onSubmit={(e) => {
            const separator = parentLocation.includes('\\') ? '\\' : '/';
            const fullPath = `${parentLocation}${separator}${projectName}`;
            handleSubmit(e, { name: projectName, path: fullPath });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1 text-center mb-2">
            <h2 className="text-sm font-semibold font-mono text-white uppercase tracking-wider">
              CREATE NEW WORKSPACE
            </h2>
            <p className="text-[10px] text-gray-500">Generate a clean local project framework</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-gray-400">PROJECT NAME</label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. quantum-neural-node"
              className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-cyan-500/50 outline-none font-sans"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-gray-400">PARENT LOCATION</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                required
                value={parentLocation}
                placeholder="Click Browse Folder to select parent path..."
                className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none flex-1 font-mono text-gray-400 select-none"
              />
              <button
                type="button"
                onClick={() => handleBrowse(setParentLocation)}
                className="px-4 py-2 text-xs font-mono border border-white/10 hover:border-cyan-500/50 hover:bg-white/5 rounded-xl text-white transition-all cursor-pointer select-none"
              >
                Browse Folder
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-mono text-xs font-semibold tracking-wider transition-colors cursor-pointer"
          >
            GENERATE WORKSPACE SHELL
          </button>
        </form>
      )}

      {/* Recent List Form */}
      {onboardingWorkflow === 'RECENT_LIST' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-center mb-2">
            <h2 className="text-sm font-semibold font-mono text-white uppercase tracking-wider">
              CONTINUE RECENT WORKSPACE
            </h2>
            <p className="text-[10px] text-gray-500">Restore your active connection logs</p>
          </div>

          <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
            {[
              { name: 'Project Orion Core', path: 'C:\\Users\\asus\\Projects\\orion_core' },
              { name: 'Quantum Neural Node', path: 'C:\\Users\\asus\\Workspace\\quantum_nodes' },
              { name: 'Space Theme Sandbox', path: 'C:\\Users\\asus\\Projects\\theme_sandbox' }
            ].map((recent) => (
              <button
                key={recent.name}
                onClick={(e) => handleSubmit(e as any, { name: recent.name, path: recent.path })}
                className="flex flex-col items-start p-3 w-full rounded-xl border border-white/5 bg-white/2 hover:border-purple-500/50 hover:bg-white/5 transition-all text-left outline-none cursor-pointer group"
              >
                <span className="text-xs font-semibold text-white font-mono leading-tight mb-1 group-hover:text-quantum-400">
                  {recent.name}
                </span>
                <span className="text-[9px] text-gray-400 font-mono truncate w-full">
                  {recent.path}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
export default WorkspaceOnboardingWizard;
