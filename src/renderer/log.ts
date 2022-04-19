/* eslint-disable @typescript-eslint/no-explicit-any */
import type ElectronLog from 'electron-log';
import C from '../constant';

const isDevelopment =
  window.main.process.NODE_ENV() === 'development' ||
  window.main.process.DEBUG_PROD() === 'true';

const levels: ElectronLog.LevelOption[] = [
  'error',
  'warn',
  'info',
  'verbose',
  'debug',
  'silly',
];

const dolog = (
  level1: ElectronLog.LevelOption,
  level2: ElectronLog.LevelOption
): boolean => {
  const l1 = levels.indexOf(level1);
  const l2 = levels.indexOf(level2);
  return l1 <= l2;
};

const alog = (type: ElectronLog.LevelOption, ...args: any[]) => {
  if (type && dolog(type, C.LogLevel)) {
    // eslint-disable-next-line no-console
    if (isDevelopment) console.log(...args);
    else window.main.log[type](...args);
  }
};

// Save IPC calls by only calling when needed.
const log: ElectronLog.LogFunctions = {
  error: (...args) => {
    alog('error', ...args);
  },
  warn: (...args) => {
    alog('warn', ...args);
  },
  info: (...args) => {
    alog('info', ...args);
  },
  verbose: (...args) => {
    alog('verbose', ...args);
  },
  debug: (...args) => {
    alog('debug', ...args);
  },
  silly: (...args) => {
    alog('silly', ...args);
  },
  log: (...args) => {
    alog('info', ...args);
  },
};

export default log;
