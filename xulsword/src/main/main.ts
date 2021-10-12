/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build:main`, this file is compiled to
 * main.js using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import Prefs from './modules/prefs';
import { jsdump } from '../common0';
import { ASAR_PATH, ASSET_PATH } from './modules/localPath';

const backend = require('i18next-electron-fs-backend');

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

const getAssetPath = (...paths: string[]): string => {
  return path.join(ASSET_PATH, ...paths);
};

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch((e: Error) => jsdump(e));
};

// Handle prefs calls from renderer
const prefs = new Prefs(false);
ipcMain.on('prefs', (event, method: string, ...args) => {
  let ret = null;
  if (prefs !== null) {
    const f = prefs[method];
    if (typeof f === 'function') {
      ret = f(...args);
    } else {
      throw Error(`prefs has no method ${method}`);
    }
  }

  event.returnValue = ret;
});

// Handle jsdump calls from renderer
ipcMain.on('jsdump', (_event, msg: string) => {
  jsdump(msg);
});

// Handle paths calls from renderer
ipcMain.on('paths', (event) => {
  event.returnValue = {
    asar: ASAR_PATH,
  };
});

const createWindow = (
  name: string,
  params: Electron.BrowserWindowConstructorOptions | undefined,
  startup: boolean
) => {
  const newWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
    ...params,
  });

  newWindow.loadURL(resolveHtmlPath(`${name}.html`));

  // Configure i18n backend for the window
  backend.mainBindings(ipcMain, newWindow, fs);

  newWindow.webContents.on('did-finish-load', () => {
    if (!newWindow) {
      throw new Error(`${name} window is not defined`);
    }
    if (startup && process.env.START_MINIMIZED) {
      newWindow.minimize();
    } else {
      newWindow.show();
      newWindow.focus();
    }
  });

  return newWindow;
};

const openSplashWindow = (startup: boolean) => {
  const splashWindow = createWindow(
    'about',
    process.env.NODE_ENV === 'development'
      ? {
          width: 500,
          height: 400,
        }
      : {
          width: 500,
          height: 375,
          alwaysOnTop: true,
          frame: false,
          transparent: true,
        },
    startup
  );

  return splashWindow;
};

const openMainWindow = (startup: boolean) => {
  mainWindow = createWindow(
    'main',
    {
      icon: getAssetPath('icon.png'),
      width: 1024,
      height: 728,
    },
    startup
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
    jsdump('NOTE: mainWindow closed...');
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  return mainWindow;
};

const start = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  const splashWindow = openSplashWindow(true);

  mainWindow = openMainWindow(true);

  mainWindow.once('ready-to-show', () => {
    if (process.env.NODE_ENV !== 'development') {
      setTimeout(() => splashWindow.close(), 2000);
    }
  });

  // Remove this if your app does not use auto updates
  // new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  } else {
    backend.clearMainBindings(ipcMain);
  }
});

// Write all prefs to disk when app closes
app.on('window-all-closed', () => {
  if (prefs.store !== null) {
    Object.keys(prefs.store).forEach((key) => prefs.writeStore(key));
  }
});

app
  .whenReady()
  .then(start)
  .catch((e) => {
    throw Error(e);
  });

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) openMainWindow(false);
});
