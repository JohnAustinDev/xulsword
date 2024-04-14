import type { ipcRenderer as IPCRenderer } from 'electron';
import { io } from 'socket.io-client';
import { processR, ipc } from '../main/preload2.js';

// To run the Electron app in a browser, Electron's contextBridge
// and ipcRenderer modules have been replaced by custom modules
// that use socket.io.

const origin = window.location.origin;
const reacthost = origin.replace(/^https?/, 'ws').replace(/(:\d+)?$/, ':3000');
const socket = io(reacthost);

const ipcRenderer = {
  send: (channel, ...args) => {
    const arg = Array.isArray(args) ? args : [args];
    socket.emit(channel, arg, () => {});
  },
  invoke: async (channel, ...args) => {
    return new Promise((resolve, reject) => {
      const arg = Array.isArray(args) ? args : [args];
      socket.emit(channel, arg, (resp: any) => {
        resolve(resp);
      });
    });
  },
  sendSync: async (channel, ...args) => {
    const p = new Promise((resolve, reject) => {
      const arg = Array.isArray(args) ? args : [args];
      socket.emit(channel, arg, (resp: any) => {
        resolve(resp);
      });
    });
    if (!('then' in p)) throw Error(`Not a promise!`);
    const r = await p;
    console.log(r);
    if (r && typeof r === 'object' && 'then' in r) {
      throw Error(`Should not be a promise!`);
    }
    return r;
  },
  on: (channel, strippedfunc) => {
    socket.on(channel, strippedfunc);
    return undefined as unknown as typeof ipcRenderer;
  },
  once: (channel, strippedfunc) => {
    socket.on(channel, (response: any) => {
      strippedfunc(response);
      ipcRenderer.removeListener(channel, strippedfunc);
    });
    return undefined as unknown as typeof ipcRenderer;
  },
  removeListener: (channel, strippedfunc) => {
    socket.listeners(channel).forEach((lf) => {
      if (lf === strippedfunc) socket.off(channel, lf);
    });
    return undefined as unknown as typeof ipcRenderer;
  },
} as typeof IPCRenderer;

const process: Partial<NodeJS.Process> = {
  argv: [],
  // TODO!: Finish this
  env: {
    NODE_ENV: 'development',
    XULSWORD_ENV: 'development',
    DEBUG_PROD: 'false',
    LOGLEVEL: 'debug',
  },
  platform: 'linux',
};

window.processR = processR(process);

window.ipc = ipc(ipcRenderer);
