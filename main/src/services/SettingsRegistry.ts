import { DatabaseEngine } from '../database/DatabaseEngine';

export class SettingsRegistry {
  /**
   * Serializes a value and saves it using JSON file storage.
   */
  public static async set(key: string, value: any): Promise<void> {
    const serializedValue = JSON.stringify(value);
    const dbEngine = DatabaseEngine.getInstance();
    
    // Read current state from the JSON file
    const data = dbEngine.readData();
    const settings = data.settings || {};
    settings[key] = serializedValue;
    data.settings = settings;
    
    // Write back updated data
    dbEngine.writeData(data);
  }

  /**
   * Retrieves a setting value, returning the defaultValue on miss or error.
   */
  public static async get(key: string, defaultValue: any): Promise<any> {
    try {
      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();
      const settings = data.settings || {};
      const value = settings[key];
      if (value === undefined) {
        return defaultValue;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error(`Failed to parse settings keys "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Retrieves the entire settings matrix object.
   */
  public static async loadMatrix(): Promise<any> {
    try {
      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();
      // Ensure complex objects are correctly parsed if they were stored as strings
      const settings = data.settings || {};
      const matrix: any = {};
      for (const [k, v] of Object.entries(settings)) {
        try {
          matrix[k] = typeof v === 'string' ? JSON.parse(v) : v;
        } catch {
          matrix[k] = v;
        }
      }
      return matrix;
    } catch (error) {
      console.error(`Failed to load settings matrix:`, error);
      return {};
    }
  }

  /**
   * Saves an entire settings matrix object payload to disk.
   */
  public static async saveMatrix(matrix: any): Promise<void> {
    try {
      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();
      const currentSettings = data.settings || {};
      
      for (const [k, v] of Object.entries(matrix)) {
        currentSettings[k] = JSON.stringify(v);
      }
      
      data.settings = currentSettings;
      dbEngine.writeData(data);
    } catch (error) {
      console.error(`Failed to save settings matrix:`, error);
    }
  }
}
export default SettingsRegistry;
