import type { ipcRenderer as IPCRenderer } from 'electron';
import { io } from 'socket.io-client';
import { processR, ipc } from '../main/preload2';

// To run the Electron app in a browser, Electron's contextBridge
// and ipcRenderer modules have been replaced by custom modules
// that use socket.io.
const socket = io('ws://127.0.0.1:3000');

const ipcRenderer = {
  send: (channel, ...args) => {
    socket.emit(channel, args);
  },
  invoke: (channel, ...args) => {
    return new Promise((resolve, reject) => {
      try {
        socket.emit(channel, args, resolve);
      } catch (er) {
        reject(er);
      }
    });
  },
  sendSync: async (channel, ...args) => {
    const response = await socket.emitWithAck(channel, args);
    return response;
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
