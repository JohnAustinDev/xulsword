const { contextBridge, ipcRenderer } = require('electron');
const backend = require('i18next-electron-fs-backend');

contextBridge.exposeInMainWorld('api', {
  i18nextElectronBackend: backend.preloadBindings(ipcRenderer, process),
});

contextBridge.exposeInMainWorld('shell', {
  process: {
    NODE_ENV() {
      return process.env.NODE_ENV;
    },
    DEBUG_PROD() {
      return process.env.DEBUG_PROD;
    },
    argv() {
      // argv[?] = window name ('main', 'splash' etc.)
      return process.argv;
    },
  },
});

const validChannels = [
  'global', // to/from main for use by the G object
  'window', // to main to perform window operations (move-to-back, close, etc.)
  'close', // from main upon parent window close
  'resize', // from main upon parent window resize
  'update-state-from-pref', // from main when state-prefs should be updated
  'component-reset', // from main when top react components should be remounted
  'module-reset', // from main when module contents may have changed
];

contextBridge.exposeInMainWorld('ipc', {
  renderer: {
    // Trigger a channel event which ipcMain is to listen for. If a single
    // response from ipcMain is desired, then 'invoke' should likely be used.
    // Otherwise event.reply() can respond from ipcMain if the renderer has
    // also added a listener for it.
    send(channel, ...args) {
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },

    // Trigger a channel event which ipcMain is to listen for and respond to
    // using ipcMain.handle(), returning a promise containing the result arg(s).
    invoke(channel, ...args) {
      if (validChannels.includes(channel)) {
        ipcRenderer.invoke(channel, ...args);
      }
    },

    // Make a synchronous call to ipcMain, blocking the renderer until ipcMain
    // responds using event.returnValue. Using invoke instead will not block the
    // renderer process.
    sendSync(channel, ...args) {
      if (validChannels.includes(channel)) {
        return ipcRenderer.sendSync(channel, ...args);
      }
      return null;
    },
    // Add listener func to be called after events from a channel of ipcMain
    on(channel, func) {
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },

    // One time listener func to be called after next event from a channel of
    // ipcMain.
    once(channel, func) {
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      }
    },
  },
});
