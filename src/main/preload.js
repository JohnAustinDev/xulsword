const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('processR', {
  argv() {
    return process.argv;
  },
  NODE_ENV() {
    return process.env.NODE_ENV;
  },
  XULSWORD_ENV() {
    return process.env.XULSWORD_ENV;
  },
  DEBUG_PROD() {
    return process.env.DEBUG_PROD;
  },
  LOGLEVEL() {
    return process.env.LOGLEVEL;
  },
});

const validChannels = [
  'global', // to+from main for use by the G object
  'did-finish-render', // to main when window has finished rendering
  'print-or-preview', // to main to do print, printToPDF or preview PDF
  'log', // to main for logging
  'close', // from main when renderer window is being closed
  'resize', // from main when renderer window is being resized
  'progress', // from main for progress meter
  'modal', // from main to make windows temporarily modal
  'update-state-from-pref', // from main when state-prefs should be updated
  'component-reset', // from main when window top react component should be remounted
  'cache-reset', // from main when caches should be cleared
  'dynamic-stylesheet-reset', // from main when dynamic stylesheet should be re-created
  'publish-subscription', // from main when a renderer subscription should be published
];

// TypeScriptable IPC functions
contextBridge.exposeInMainWorld('ipcTS', {
  printOrPreview(...args) {
    return ipcRenderer.invoke('print-or-preview', ...args);
  },
});

contextBridge.exposeInMainWorld('ipc', {
  // Trigger a channel event which ipcMain is to listen for. If a single
  // response from ipcMain is desired, then 'invoke' should likely be used.
  // Otherwise event.reply() can respond from ipcMain if the renderer has
  // also added a listener for it.
  send(channel, ...args) {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else throw Error(`ipc send bad channel: ${channel}`);
  },

  // Trigger a channel event which ipcMain is to listen for and respond to
  // using ipcMain.handle(), returning a promise containing the result arg(s).
  invoke(channel, ...args) {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw Error(`ipc invoke bad channel: ${channel}`);
  },

  // Make a synchronous call to ipcMain, blocking the renderer until ipcMain
  // responds using event.returnValue. Using invoke instead will not block the
  // renderer process.
  sendSync(channel, ...args) {
    if (validChannels.includes(channel)) {
      return ipcRenderer.sendSync(channel, ...args);
    }
    throw Error(`ipc sendSync bad channel: ${channel}`);
  },

  // Add listener func to be called after events from a channel of ipcMain
  on(channel, func) {
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const strippedfunc = (event, ...args) => {
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
  once(channel, func) {
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const strippedfunc = (event, ...args) => {
        func(...args);
      };
      ipcRenderer.once(channel, strippedfunc);
    } else throw Error(`ipc once bad channel: ${channel}`);
  },
});
