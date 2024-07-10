import { io } from 'socket.io-client';
import process from '../../process.js';

import type { Socket } from 'socket.io-client';

// To run the Electron app in a browser, Electron's contextBridge
// and ipcRenderer modules have been replaced by custom modules
// that use socket.io.
let socket: Socket | null = null;
const socketConnect = (port: number, origin?: string): Socket => {
  const ro = origin ?? window.location.origin;
  const hosturl = ro.replace(/^http/, 'ws').replace(/(:\d+)?$/, `:${port}`);
  socket = io(hosturl);
  return socket;
};
export default socketConnect;

// THIS FILE SHOULD BE KEPT THE SAME AS MAIN/PRELOAD.JS
const validChannels = [
  'global', // to+from main for use by the G object
  'did-finish-render', // to main when window has finished rendering
  'log', // to main for logging
  'error-report', // to main to report an error
  'resize', // from main when renderer window is being resized
  'progress', // from main for progress meter
  'modal', // from main to make windows temporarily modal
  'update-state-from-pref', // from main when state-prefs should be updated
  'component-reset', // from main when window top react component should be remounted
  'cache-reset', // from main when caches should be cleared
  'dynamic-stylesheet-reset', // from main when dynamic stylesheet should be re-created
  'publish-subscription', // from main when a renderer subscription should be published
];

// This is a polyfill for Electron ipcRenderer:
const ipcRenderer: Pick<
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
  // Synchronous data does not work over the internet as the main thread
  // should never be blocked for the length of time required to resolve
  // the data. Therefore data must either be preloaded into the cache, or
  // else a special call must be used that is capable of waiting for the
  // data and handling it later.
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

// THIS IS IDENTICAL TO MAIN/PRELOAD.JS:
window.ipc = {
  // Trigger a channel event which ipcMain is to listen for. If a single
  // response from ipcMain is desired, then 'invoke' should likely be used.
  // Otherwise event.reply() can respond from ipcMain if the renderer has
  // also added a listener for it.
  send: (channel: string, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else throw Error(`ipc send bad channel: ${channel}`);
  },

  // Trigger a channel event which ipcMain is to listen for and respond to
  // using ipcMain.handle(), returning a promise containing the result arg(s).
  invoke: async (channel: string, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args);
    }
    throw Error(`ipc invoke bad channel: ${channel}`);
  },

  // Make a synchronous call to ipcMain, blocking the renderer until ipcMain
  // responds using event.returnValue. Using invoke instead will not block the
  // renderer process.
  sendSync: (channel: string, ...args: unknown[]) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.sendSync(channel, ...args);
    }
    throw Error(`ipc sendSync bad channel: ${channel}`);
  },

  // Add listener func to be called after events from a channel of ipcMain
  on: (channel: string, func: (...args: unknown[]) => unknown) => {
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const strippedfunc = (_event: unknown, ...args: unknown[]): void => {
        func(...args);
      };
      ipcRenderer.on(channel, strippedfunc);
      return () => {
        ipcRenderer.removeListener(channel, strippedfunc);
      };
    }
    throw Error(`ipc on bad channel: ${channel}`);
  },

  // One time listener func to be called after next event from a channel of
  // ipcMain.
  once: (channel: string, func: (...args: any[]) => any) => {
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const strippedfunc = (_event: any, ...args: unknown[]): void => {
        func(...args);
      };
      ipcRenderer.once(channel, strippedfunc);
    } else throw Error(`ipc once bad channel: ${channel}`);
  },
};

// THIS IS IDENTICAL TO MAIN/PRELOAD.JS
window.processR = {
  argv: () => {
    return process.argv;
  },
  NODE_ENV: () => {
    return process.env.NODE_ENV;
  },
  XULSWORD_ENV: () => {
    return process.env.XULSWORD_ENV;
  },
  DEBUG_PROD: () => {
    return process.env.DEBUG_PROD;
  },
  LOGLEVEL: () => {
    return process.env.LOGLEVEL;
  },
  XSPORT: () => {
    return process.env.XSPORT;
  },
  platform: process.platform,
};
