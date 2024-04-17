import type { ipcRenderer as IPCRenderer } from 'electron';
import { Socket, io } from 'socket.io-client';
import Subscription from '../subscription.ts';
import { processR, ipc } from '../main/preload2.js';
import { GCallType } from '../type.ts';
import G from '../renderer/rg.ts';
import { Gcachekey } from '../common.ts';
import Cache from '../cache.ts';

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
  send: (channel, ...args: any[]) => {
    if (socket) socket.emit(channel, args, () => {});
    else throw new Error(`No socket connection.`);
  },
  invoke: async (channel, ...args: any[]) => {
    return new Promise((resolve, reject) => {
      if (socket) socket.emit(channel, args, (resp: any) => resolve(resp));
      else reject(`No socket connection.`);
    });
  },
  // Synchronous data does not work over the internet as the main thread
  // should never be blocked for the length of time required to resolve
  // the data. Therefore data must either be preloaded into the cache, or
  // else a special call must be used that is capable of waiting for the
  // data and handling it later.
  sendSync: (channel, ...args) => {
    return;
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
  platform: 'browser' as 'linux',
};

window.processR = processR(process);

window.ipc = ipc(ipcRenderer);

export default socketConnect;

export async function cachePreload(calls: GCallType[]) {
  const resp = await G.cachePreload(calls);
  if (resp.length !== calls.length) {
    throw new Error(`cachePreload did not return the correct data.`);
  }
  while (calls.length) {
    const acall = calls.pop();
    const aresult = resp.pop();
    if (acall) {
      const cacheKey = Gcachekey(acall);
      Cache.write(aresult, cacheKey);
    }
  }
}
