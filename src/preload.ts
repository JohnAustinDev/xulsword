/* eslint-disable @typescript-eslint/naming-convention */
import type { LogLevel } from 'electron-log';

// This has nothing to do with G cache preload. It is Electron's way of
// injecting Inter Process Communication and process objects into clients.

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

export function getProcessInfo(
  process: Pick<NodeJS.Process, 'argv' | 'env' | 'platform'>,
) {
  return {
    argv: () => {
      return process.argv;
    },
    get LOGLEVEL() {
      return process.env.LOGLEVEL as LogLevel;
    },
    get WEBAPP_PORT() {
      return process.env.WEBAPP_PORT;
    },
    platform: process.platform,
  };
}

export default function getIPC(
  ipcRend: Pick<
    Electron.IpcRenderer,
    'send' | 'invoke' | 'sendSync' | 'on' | 'once' | 'removeListener'
  >,
) {
  return {
    // Trigger a channel event which ipcMain is to listen for. If a single
    // response from ipcMain is desired, then 'invoke' should likely be used.
    // Otherwise event.reply() can respond from ipcMain if the renderer has
    // also added a listener for it.
    send: (channel: string, ...args: any[]) => {
      if (validChannels.includes(channel)) {
        ipcRend.send(channel, ...args);
      } else throw Error(`ipc send bad channel: ${channel}`);
    },

    // Trigger a channel event which ipcMain is to listen for and respond to
    // using ipcMain.handle(), returning a promise containing the result arg(s).
    invoke: async (channel: string, ...args: any[]) => {
      if (validChannels.includes(channel)) {
        return await ipcRend.invoke(channel, ...args);
      }
      throw Error(`ipc invoke bad channel: ${channel}`);
    },

    // Make a synchronous call to ipcMain, blocking the renderer until ipcMain
    // responds using event.returnValue. Using invoke instead will not block the
    // renderer process.
    sendSync: (channel: string, ...args: any[]) => {
      if (validChannels.includes(channel)) {
        return ipcRend.sendSync(channel, ...args);
      }
      throw Error(`ipc sendSync bad channel: ${channel}`);
    },

    // Add listener func to be called after events from a channel of ipcMain
    on: (channel: string, func: (...args: any[]) => void) => {
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        const strippedfunc = (_event: any, ...args: unknown[]) => {
          func(...args);
        };
        ipcRend.on(channel, strippedfunc);
        return () => {
          ipcRend.removeListener(channel, strippedfunc);
        };
      }
      throw Error(`ipc on bad channel: ${channel}`);
    },

    // One time listener func to be called after next event from a channel of
    // ipcMain.
    once: (channel: string, func: (...args: any[]) => void) => {
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        const strippedfunc = (_event: any, ...args: unknown[]) => {
          func(...args);
        };
        ipcRend.once(channel, strippedfunc);
      } else throw Error(`ipc once bad channel: ${channel}`);
    },
  };
}
