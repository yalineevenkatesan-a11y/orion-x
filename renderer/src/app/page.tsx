'use client';

import { WorkspaceUiProvider, useWorkspaceUi } from '@/context/WorkspaceUiContext';
import { ConsoleUiProvider } from '@/context/ConsoleUiContext';
import { BackgroundCanvas } from '@/components/BackgroundCanvas';
import { SplashScreen } from '@/components/SplashScreen';
import { WorkspaceHubModal } from '@/components/WorkspaceHubModal';
import { WorkspaceOnboardingWizard } from '@/components/WorkspaceOnboardingWizard';
import { ConsoleDashboardShell } from '@/components/ConsoleDashboardShell';
import { SettingsModal } from '@/components/settings/SettingsModal';

function MainViewport() {
  const { workspaceState } = useWorkspaceUi();

  return (
    <div className="relative h-screen w-screen bg-transparent overflow-hidden select-none flex items-center justify-center">
      {/* 1. Ambient space background engine */}
      <BackgroundCanvas />

      {/* 2. State-driven conditional switch maps */}
      {workspaceState === 'SPLASH' && (
        <SplashScreen />
      )}

      {workspaceState === 'HUB' && (
        <WorkspaceHubModal />
      )}

      {workspaceState === 'ONBOARDING' && (
        <WorkspaceOnboardingWizard />
      )}

      {workspaceState === 'CONSOLE' && (
        <div className="absolute inset-0 w-full h-full flex flex-col overflow-hidden">
          <ConsoleDashboardShell />
        </div>
      )}

      {/* 3. Global Settings Modal panel overlay */}
      <SettingsModal />
    </div>
  );
}

export default function Page() {
  return (
    <WorkspaceUiProvider>
      <ConsoleUiProvider>
        <MainViewport />
      </ConsoleUiProvider>
    </WorkspaceUiProvider>
  );
}
