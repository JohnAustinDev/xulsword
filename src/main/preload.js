const { contextBridge, ipcRenderer } = require('electron');
const { processR, ipc } = require('./preload2');

// NOTE: crashReporter is not an Electron 22 preload electron require option.
// But crashReporter unnecessary since the main process reports for renderer
// processes as well as for itself.

contextBridge.exposeInMainWorld('processR', processR(process));

contextBridge.exposeInMainWorld('ipc', ipc(ipcRenderer));
