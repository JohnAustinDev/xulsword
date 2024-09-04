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
    // Browser can only log error or warn to server.
    if (!Build.isWebApp || levels.indexOf(level) <= levels.indexOf('warn')) {
      window.IPC.send('log', level, `[${windowID}]`, JSON_stringify(args));
    }
    if (Build.isDevelopment) {
      console.log(`[${windowID}]`, ...args);
    }
  }
}

const log = {
  error: (...args: unknown[]) => {
    // convert Error object to string, so the object won't be lost during
    // transport to the server.
    const [er] = args;
    if (er && typeof er === 'object' && args.length === 1 && 'message' in er) {
      rlog('error', 'stack' in er ? er.stack : er.message);
    } else rlog('error', ...args);
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
