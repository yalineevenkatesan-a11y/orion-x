import path from 'path';
import os from 'os';

export interface SystemEnvironment {
  appVersion: string;
  isDev: boolean;
  storagePath: string;
  logLogLevel: 'debug' | 'info' | 'error';
}

const resolveStoragePath = (): string => {
  const homeDir = os.homedir();
  const platform = os.platform();

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, 'ORION-X Studio');
  } else if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'ORION-X Studio');
  } else {
    return path.join(homeDir, '.config', 'orion-x-studio');
  }
};

export const SystemConfig: Readonly<SystemEnvironment> = Object.freeze({
  appVersion: '1.0.0',
  isDev: process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true',
  storagePath: resolveStoragePath(),
  logLogLevel: (process.env.NODE_ENV === 'development' ? 'debug' : 'info') as 'debug' | 'info' | 'error',
});
