import { contextBridge, crashReporter, ipcRenderer } from 'electron';
import getIPC, { getProcessInfo } from '../../preload.ts';

// The main process sends crash reports for renderer processes too, but extra
// parameters only apply to the process that adds them. So each window adds
// its window type (the name of its html file, ie. xulswordWin) to its own
// crash reports.
crashReporter.addExtraParameter(
  'windowType',
  window.location.pathname.replace(/^.*\//, '').replace(/\.html$/, ''),
);

contextBridge.exposeInMainWorld('IPC', getIPC(ipcRenderer));

contextBridge.exposeInMainWorld('ProcessInfo', getProcessInfo(process));
