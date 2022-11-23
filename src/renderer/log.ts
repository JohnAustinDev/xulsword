/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type ElectronLog from 'electron-log';
import { LogLevel } from 'electron-log';
import C from '../constant';
import Cache from '../cache';

const { log: elog } = window.main;

const levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

function rlog(level: LogLevel, ...args: any[]) {
  const windowID = Cache.has('windowID') ? Cache.read('windowID') : '?:?';
  elog[level](`[${windowID}]`, ...args);
  if (C.isDevelopment && levels.indexOf(level) <= levels.indexOf(C.LogLevel)) {
    console.log(`[${windowID}]`, ...args);
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
