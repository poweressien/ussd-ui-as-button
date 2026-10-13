// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { redactText } from './redact';

// `__DEV__` is injected by React Native/Metro. Declared here (not assumed
// global) so this file behaves under Jest and any other non-Metro runner too.
declare const __DEV__: boolean | undefined;
function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  timestamp: number;
}

/**
 * secureLogger
 * ------------
 * Thin wrapper around console.* that redacts every message by default.
 * The developer/debug panel (section 8 of the spec) reads its own explicit,
 * user-visible feed of raw responses — separately gated by "developer mode"
 * in settingsStore — rather than pulling raw text out of this logger. This
 * logger is for operational logs (session state changes, transport errors),
 * which is exactly the kind of log that should never carry a PIN or account
 * number even by accident.
 */
class SecureLoggerImpl {
  private buffer: LogEntry[] = [];
  private readonly maxBuffer = 200;

  private write(level: LogLevel, tag: string, message: string): void {
    const redacted = redactText(message);
    const entry: LogEntry = { level, tag, message: redacted, timestamp: Date.now() };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();

    const line = `[${tag}] ${redacted}`;
    switch (level) {
      case 'debug':
        if (isDevBuild()) console.debug(line);
        break;
      case 'info':
        console.log(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'error':
        console.error(line);
        break;
    }
  }

  debug(tag: string, message: string): void {
    this.write('debug', tag, message);
  }
  info(tag: string, message: string): void {
    this.write('info', tag, message);
  }
  warn(tag: string, message: string): void {
    this.write('warn', tag, message);
  }
  error(tag: string, message: string): void {
    this.write('error', tag, message);
  }

  /** Recent redacted entries, newest last — used by the in-app log viewer. */
  recent(): LogEntry[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}

export const secureLogger = new SecureLoggerImpl();
