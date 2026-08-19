import fs from 'fs';
import path from 'path';

export class Logger {
  private static instance: Logger | null = null;
  private appStream!: fs.WriteStream;
  private backendStream!: fs.WriteStream;
  private dbStream!: fs.WriteStream;
  private chatStream!: fs.WriteStream;

  private constructor() {
    const logDir = path.join(process.cwd(), 'logs');
    
    // Programmatically guarantee logs directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Establish dedicated writable append streams
    this.appStream = fs.createWriteStream(path.join(logDir, 'application.log'), { flags: 'a' });
    this.backendStream = fs.createWriteStream(path.join(logDir, 'backend.log'), { flags: 'a' });
    this.dbStream = fs.createWriteStream(path.join(logDir, 'database.log'), { flags: 'a' });
    this.chatStream = fs.createWriteStream(path.join(logDir, 'chat.log'), { flags: 'a' });
  }

  /**
   * Returns the static Logger singleton reference.
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Formats a log entry line with clear ISO timestamps.
   */
  private formatLog(level: string, module: string, message: string): string {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 23);
    return `[${timestamp}] [${level}] [${module}] ${message}\n`;
  }

  /**
   * Writes a log string directly to the target stream.
   */
  private writeToStream(stream: fs.WriteStream, data: string): void {
    stream.write(data);
  }

  /**
   * Logs an informational message.
   */
  public info(module: string, message: string): void {
    const formatted = this.formatLog('INFO', module, message);
    
    // Distribute logs to core outputs
    this.writeToStream(this.appStream, formatted);
    this.writeToStream(this.backendStream, formatted);

    const modLower = module.toLowerCase();
    if (modLower === 'database' || modLower === 'db') {
      this.writeToStream(this.dbStream, formatted);
    } else if (modLower === 'chat' || modLower === 'ai' || modLower === 'localai') {
      this.writeToStream(this.chatStream, formatted);
    }

    console.log(formatted.trim());
  }

  /**
   * Logs an error message.
   */
  public error(module: string, errorObj: any): void {
    const errMsg = errorObj instanceof Error ? errorObj.stack || errorObj.message : String(errorObj);
    const formatted = this.formatLog('ERROR', module, errMsg);

    this.writeToStream(this.appStream, formatted);
    this.writeToStream(this.backendStream, formatted);

    const modLower = module.toLowerCase();
    if (modLower === 'database' || modLower === 'db') {
      this.writeToStream(this.dbStream, formatted);
    } else if (modLower === 'chat' || modLower === 'ai' || modLower === 'localai') {
      this.writeToStream(this.chatStream, formatted);
    }

    console.error(formatted.trim());
  }

  /**
   * Logs a trace message.
   */
  public trace(module: string, data: string): void {
    const formatted = this.formatLog('TRACE', module, data);

    this.writeToStream(this.appStream, formatted);
    this.writeToStream(this.backendStream, formatted);

    const modLower = module.toLowerCase();
    if (modLower === 'database' || modLower === 'db') {
      this.writeToStream(this.dbStream, formatted);
    } else if (modLower === 'chat' || modLower === 'ai' || modLower === 'localai') {
      this.writeToStream(this.chatStream, formatted);
    }
  }
}
