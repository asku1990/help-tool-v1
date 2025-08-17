type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  url?: string;
}

// Module-level variable to store the singleton instance
let instance: unknown;

class Logger {
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  public static getInstance(): Logger {
    if (!instance) {
      instance = new Logger();
    }
    return instance as Logger;
  }

  private formatLog(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    const logEntry = this.formatLog(level, message, data);

    // Always log to console in development
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console[level](`[${logEntry.timestamp}] ${message}`, data || '');
    }

    // Log errors to console in production
    if (level === 'error') {
      console.error(`[${logEntry.timestamp}] ${message}`, data || '');
    }

    // You could also send logs to a service here
    // Example: sendToLoggingService(logEntry);
  }

  public info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  public warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  public error(message: string, data?: unknown) {
    this.log('error', message, data);
  }

  public debug(message: string, data?: unknown) {
    this.log('debug', message, data);
  }
}

// Export the singleton instance
export const logger = Logger.getInstance();
