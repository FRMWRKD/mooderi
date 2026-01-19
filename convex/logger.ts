/**
 * Logging Utility
 * 
 * Structured logging for Convex with consistent format and severity levels.
 * Use this instead of raw console.log/error for better debugging.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}`;
  }

  debug(message: string, context?: LogContext) {
    const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === "development";
    if (isDev) {
      console.log(this.formatLog("debug", message, context));
    }
  }

  info(message: string, context?: LogContext) {
    console.log(this.formatLog("info", message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatLog("warn", message, context));
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    const errorDetails = error instanceof Error 
      ? { error: error.message, stack: error.stack }
      : error ? { error: String(error) } : {};
    
    const fullContext = { ...context, ...errorDetails };
    console.error(this.formatLog("error", message, fullContext));
  }
}

export const logger = new Logger();

// Example usage:
// import { logger } from "./logger";
// logger.error("Failed to analyze image", error, { module: "ai", imageId });
// logger.info("Video processing started", { module: "videos", videoId, userId });
