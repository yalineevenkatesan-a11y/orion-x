import { ipcMain } from 'electron';
import { SettingsRegistry } from '../services/SettingsRegistry';

export function initializeSettingsController(): void {
  // Handle IPC calls for reading settings keys
  ipcMain.handle('settings:get', async (_event, key: string, defaultValue: any) => {
    return SettingsRegistry.get(key, defaultValue);
  });

  // Handle IPC calls for writing settings keys
  ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
    await SettingsRegistry.set(key, value);
  });

  // Load complete settings matrix payload
  ipcMain.handle('settings:load-matrix', async () => {
    return SettingsRegistry.loadMatrix();
  });

  // Save complete settings matrix payload
  ipcMain.handle('settings:save-matrix', async (_event, matrix: any) => {
    await SettingsRegistry.saveMatrix(matrix);
  });
}
