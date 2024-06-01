/* eslint-disable no-console */
import type ElectronLog from 'electron-log';
import type { LogLevel } from 'electron-log';
import C from '../constant.ts';
import { JSON_stringify } from '../common.ts';
import Cache from '../cache.ts';

const levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

function rlog(level: LogLevel, ...args: any[]) {
  if (levels.indexOf(level) <= levels.indexOf(C.LogLevel)) {
    const windowID = Cache.has('windowID') ? Cache.read('windowID') : '?:?';
    // Browser can only log error or warn to server.
    if (window.processR.platform !== 'browser' || levels.indexOf(level) <= levels.indexOf('warn')) {
      window.ipc.send('log', level, `[${windowID}]`, JSON_stringify(args));
    }
    if (C.isDevelopment) {
      console.log(`[${windowID}]`, ...args);
    }
  }
}

const log = {
  error: (...args: any[]) => {
    rlog('error', ...args);
  },
  warn: (...args: any[]) => {
    rlog('warn', ...args);
  },
  info: (...args: any[]) => {
    rlog('info', ...args);
  },
  verbose: (...args: any[]) => {
    rlog('verbose', ...args);
  },
  debug: (...args: any[]) => {
    rlog('debug', ...args);
  },
  silly: (...args: any[]) => {
    rlog('silly', ...args);
  },
  log: (...args: any[]) => {
    rlog('info', ...args);
  },
} as ElectronLog.LogFunctions;

export default log;
