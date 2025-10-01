/* eslint-disable no-console */
import C from '../constant.ts';
import { JSON_stringify } from '../common.ts';
import Cache from '../cache.ts';

import type ElectronLog from 'electron-log';
import type { LogLevel } from 'electron-log';

const levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

function rlog(level: LogLevel, ...args: unknown[]) {
  let er: Error | null = null;
  if (level === 'error') {
    if (args[0] instanceof Error) {
      [er] = args;
      // convert Error object to string, so the object won't be lost during
      // transport to the server.
      args[0] = errorString(args[0]);
    }
  }
  if (levels.indexOf(level) <= levels.indexOf(C.LogLevel)) {
    const haveIPC =
      window &&
      typeof window.IPC === 'object' &&
      typeof window.IPC.send === 'function';
    const windowID = Cache.has('windowID') ? Cache.read('windowID') : '?:?';
    const largs: any[] = [
      level,
      `[${Build.isWebApp ? window.WebAppClient : windowID}]`,
      JSON_stringify(args),
    ];
    if (
      haveIPC &&
      (Build.isElectronApp ||
        Build.isDevelopment ||
        // Production browser can only log error or warn to server.
        levels.indexOf(level) <= levels.indexOf('warn'))
    ) {
      try {
        window.IPC.send('log', ...largs);
      } catch (er) {
        // This happens if webapp log is called before socket.io connects.
      }
    }
    if (Build.isDevelopment) {
      if (er) throw er;
      largs.splice(-1, 1, ...args);
      console.log(...largs);
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
