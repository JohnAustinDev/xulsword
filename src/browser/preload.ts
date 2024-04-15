import type { ipcRenderer as IPCRenderer } from 'electron';
import { Socket, io } from 'socket.io-client';
import Subscription from '../subscription.ts';
import { processR, ipc } from '../main/preload2.js';

// To run the Electron app in a browser, Electron's contextBridge
// and ipcRenderer modules have been replaced by custom modules
// that use socket.io.
let socket: Socket | null = null;
const socketConnect = () => {
  const origin = window.location.origin;
  const hosturl = origin.replace(/^https?/, 'ws').replace(/(:\d+)?$/, ':3000');
  socket = io(hosturl);
  let published = false;
  socket.on('connect', () => {
    // connect is called even on reconnect, so only publish this once.
    if (socket && !published) Subscription.publish.socketConnected(socket);
    published = true;
  });
}

const ipcRenderer = {
  send: (channel, ...args) => {
    const arg = Array.isArray(args) ? args : [args];
    if (socket) socket.emit(channel, arg, () => {});
    else throw new Error(`No socket connection.`);
  },
  invoke: async (channel, ...args) => {
    return new Promise((resolve, reject) => {
      const arg = Array.isArray(args) ? args : [args];
      if (socket) socket.emit(channel, arg, (resp: any) => {
        resolve(resp);
      });
      else reject(`No socket connection.`);
    });
  },
  sendSync: async (channel, ...args) => {
    const p = new Promise((resolve, reject) => {
      const arg = Array.isArray(args) ? args : [args];
      if (socket) socket.emit(channel, arg, (resp: any) => {
        resolve(resp);
      });
      else reject(`No socket connection.`);
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
    if(socket) socket.on(channel, strippedfunc);
    else throw new Error(`No socket connection.`);
    return undefined as unknown as typeof ipcRenderer;
  },
  once: (channel, strippedfunc) => {
    if (socket) socket.on(channel, (response: any) => {
      strippedfunc(response);
      ipcRenderer.removeListener(channel, strippedfunc);
    });
    else throw new Error(`No socket connection.`);
    return undefined as unknown as typeof ipcRenderer;
  },
  removeListener: (channel, strippedfunc) => {
    if (socket) socket.listeners(channel).forEach((lf) => {
      if (socket && lf === strippedfunc) socket.off(channel, lf);
    });
    else throw new Error(`No socket connection.`);
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

export default socketConnect;
