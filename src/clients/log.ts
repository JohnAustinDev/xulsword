/* eslint-disable no-console */
import type ElectronLog from 'electron-log';
import type { LogLevel } from 'electron-log';
import C from '../constant.ts';
import { JSON_stringify } from '../common.ts';
import Cache from '../cache.ts';

const levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

function rlog(level: LogLevel, ...args: unknown[]) {
  if (levels.indexOf(level) <= levels.indexOf(C.LogLevel)) {
    const windowID = Cache.has('windowID') ? Cache.read('windowID') : '?:?';
    const haveIPC =
      typeof window.IPC === 'object' && typeof window.IPC.send === 'function';
    // Production browser can only log error or warn to server.
    if (
      haveIPC &&
      (Build.isElectronApp ||
        Build.isDevelopment ||
        levels.indexOf(level) <= levels.indexOf('warn'))
    ) {
      window.IPC.send('log', level, `[${windowID}]`, JSON_stringify(args));
    }
    if (!haveIPC || Build.isDevelopment) {
      console.log(`[${windowID}]`, ...args);
    }
  }
}

function errorString(e: Error | ErrorEvent | Event | string) {
  let msg = 'unknown error type';
  if (typeof e === 'string') msg = e;
  else if ('message' in e) {
    const erobj: Error = 'error' in e ? e.error : e;
    if ('trace' in erobj) {
      msg = erobj.trace as string;
    } else if ('message' in erobj) {
      msg = erobj.message;
    } else msg = e.message;
  } else if ('type' in e) {
    msg = `event type=${e.type}, target=${e.target}`;
  }
  if (Build.isWebApp) {
    msg = `[${navigator.userAgent}]: ${msg}`;
  }
  return msg;
}

const log = {
  error: (...args: [Error | ErrorEvent | Event | string, ...any[]]) => {
    // convert Error object to string, so the object won't be lost during
    // transport to the server.
    if (args[0]) args[0] = errorString(args[0]);
    rlog('error', ...args);
  },
  warn: (...args: unknown[]) => {
    rlog('warn', ...args);
  },
  info: (...args: unknown[]) => {
    rlog('info', ...args);
  },
  verbose: (...args: unknown[]) => {
    rlog('verbose', ...args);
  },
  debug: (...args: unknown[]) => {
    rlog('debug', ...args);
  },
  silly: (...args: unknown[]) => {
    rlog('silly', ...args);
  },
  log: (...args: unknown[]) => {
    rlog('info', ...args);
  },
} as ElectronLog.LogFunctions;

export default log;
