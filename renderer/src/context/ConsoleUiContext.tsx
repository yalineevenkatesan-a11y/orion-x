'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ConsoleTab = 'PROJECTS' | 'FILES' | 'SEARCH' | 'MEMORY' | 'HISTORY' | 'SETTINGS';

interface ConsoleUiContextType {
  activeConsoleTab: ConsoleTab;
  setActiveConsoleTab: (tab: ConsoleTab) => void;
}

const ConsoleUiContext = createContext<ConsoleUiContextType | undefined>(undefined);

export function ConsoleUiProvider({ children }: { children: ReactNode }) {
  // Default active tab must be 'HISTORY' (primary AI Chat component layout node)
  const [activeConsoleTab, setActiveConsoleTab] = useState<ConsoleTab>('HISTORY');

  return (
    <ConsoleUiContext.Provider value={{ activeConsoleTab, setActiveConsoleTab }}>
      {children}
    </ConsoleUiContext.Provider>
  );
}

export function useConsoleUi() {
  const context = useContext(ConsoleUiContext);
  if (!context) {
    throw new Error('useConsoleUi must be used within a ConsoleUiProvider');
  }
  return context;
}
