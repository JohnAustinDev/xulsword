import { contextBridge, ipcRenderer } from 'electron';
import ipc, { processR } from '../preload.ts';

// NOTE: crashReporter is not an Electron 22 preload electron require option.
// But crashReporter is unnecessary since the main process reports for renderer
// processes as well as for itself.

contextBridge.exposeInMainWorld('ipc', ipc(ipcRenderer));

contextBridge.exposeInMainWorld('processR', processR(process));
