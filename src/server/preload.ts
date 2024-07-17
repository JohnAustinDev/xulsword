import { io } from 'socket.io-client';
import ipc, { processR } from '../preload.ts';
import processEnv from './process_env.ts';

import type Electron from 'electron';
import type { Socket } from 'socket.io-client';

// To run the xulsword app as a webapp using a browser and NodeJS server,
// Electron's ipcRenderer module must be replaced by s custom Inter Process
// Communication object, which uses socket.io instead.
export const ipcRenderer: Pick<
  Electron.IpcRenderer,
  'send' | 'invoke' | 'sendSync' | 'on' | 'once' | 'removeListener'
> = {
  send: (channel: string, ...args: unknown[]) => {
    if (socket) socket.emit(channel, args, () => {});
    else throw new Error('No socket connection.');
  },
  invoke: async (channel: string, ...args: unknown[]) => {
    return await new Promise((resolve, reject) => {
      if (socket)
        socket.emit(channel, args, (resp: any) => {
          resolve(resp);
        });
      else reject(new Error('No socket connection.'));
    });
  },
  // Synchronous data is not supported over the Internet since the main
  // thread should never be blocked for any length of time. Therefore data
  // must either be preloaded into the cache, or else asynchronous calls
  // must be used.
  sendSync: (_channel: string, ..._args: unknown[]): null => {
    return null;
  },
  on: (channel: string, strippedfunc: (...args: any[]) => unknown) => {
    if (socket) socket.on(channel, strippedfunc);
    else throw new Error('No socket connection.');
    return undefined as unknown as Electron.IpcRenderer;
  },
  once: (channel: string, strippedfunc: (...args: any[]) => unknown) => {
    if (socket) {
      socket.on(channel, (response: any) => {
        strippedfunc(response);
        if (socket) {
          socket.listeners(channel).forEach((lf) => {
            if (socket && lf === strippedfunc) socket.off(channel, lf);
          });
        } else throw new Error('No socket connection.');
      });
    } else throw new Error('No socket connection.');
    return undefined as unknown as Electron.IpcRenderer;
  },
  removeListener: (
    channel: string,
    strippedfunc: (...args: unknown[]) => unknown,
  ) => {
    if (socket) {
      socket.listeners(channel).forEach((lf) => {
        if (socket && lf === strippedfunc) socket.off(channel, lf);
      });
    } else throw new Error('No socket connection.');
    return undefined as unknown as Electron.IpcRenderer;
  },
};

window.ipc = ipc(ipcRenderer);

window.processR = processR(processEnv);

let socket: Socket | null = null;
const socketConnect = (port: number, origin?: string): Socket => {
  const ro = origin ?? window.location.origin;
  const hosturl = ro.replace(/^http/, 'ws').replace(/(:\d+)?$/, `:${port}`);
  socket = io(hosturl);
  return socket;
};
export default socketConnect;
