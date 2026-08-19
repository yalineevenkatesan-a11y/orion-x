'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type WorkspaceState = 'SPLASH' | 'HUB' | 'ONBOARDING' | 'CONSOLE';
export type OnboardingWorkflow = 'NONE' | 'GIT_CLONE' | 'OPEN_LOCAL' | 'CREATE_NEW' | 'RECENT_LIST';

export interface ActiveWorkspace {
  id: string;
  name: string;
  path: string;
  gitUrl?: string;
  createdAt?: number;
}

interface WorkspaceUiContextType {
  workspaceState: WorkspaceState;
  setWorkspaceState: (state: WorkspaceState) => void;
  onboardingWorkflow: OnboardingWorkflow;
  setOnboardingWorkflow: (workflow: OnboardingWorkflow) => void;
  activeWorkspace: ActiveWorkspace | null;
  setActiveWorkspace: (workspace: ActiveWorkspace | null) => void;
  activeFileContext: string | null;
  setActiveFileContext: (val: string | null) => void;
  selectedNode: any | null;
  setSelectedNode: (node: any | null) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
}

const WorkspaceUiContext = createContext<WorkspaceUiContextType | undefined>(undefined);

export function WorkspaceUiProvider({ children }: { children: ReactNode }) {
  // Default workspaceState initialized to 'SPLASH' for boot sequence
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('SPLASH');
  const [onboardingWorkflow, setOnboardingWorkflow] = useState<OnboardingWorkflow>('NONE');
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace | null>(null);
  const [activeFileContext, setActiveFileContext] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  return (
    <WorkspaceUiContext.Provider 
      value={{ 
        workspaceState, 
        setWorkspaceState, 
        onboardingWorkflow, 
        setOnboardingWorkflow,
        activeWorkspace,
        setActiveWorkspace,
        activeFileContext,
        setActiveFileContext,
        selectedNode,
        setSelectedNode,
        isLoading,
        setIsLoading,
        isScanning,
        setIsScanning
      }}
    >
      {children}
    </WorkspaceUiContext.Provider>
  );
}

export function useWorkspaceUi() {
  const context = useContext(WorkspaceUiContext);
  if (!context) {
    throw new Error('useWorkspaceUi must be used within a WorkspaceUiProvider');
  }
  return context;
}
