import { contextBridge, ipcRenderer } from 'electron';
import getIPC, { getProcessInfo } from '../preload.ts';

// NOTE: crashReporter is not an Electron 22 preload electron require option.
// But crashReporter is unnecessary since the main process reports for renderer
// processes as well as for itself.

contextBridge.exposeInMainWorld('IPC', getIPC(ipcRenderer));

contextBridge.exposeInMainWorld('ProcessInfo', getProcessInfo(process));
