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
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import Prefs from './modules/prefs';
import * as P from './modules/localPath';
import * as C from '../constants';
import { jsdump } from '../common0';

const rendererBackend = require('i18next-electron-fs-backend');

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
  return path.join(P.ASSET_PATH, ...paths);
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
    asar: P.ASAR_PATH,
    assets: P.ASSET_PATH,
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

  // Bind i18next-electron-fs-backend providing IPC to renderer processes
  rendererBackend.mainBindings(ipcMain, newWindow, fs);

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
    'splash',
    process.env.NODE_ENV === 'development'
      ? {
          title: 'xulsword',
          width: 500,
          height: 400,
        }
      : {
          title: 'xulsword',
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

const openMainWindow = async (startup: boolean) => {
  // await i18n.loadNamespaces(['xulsword']);

  mainWindow = createWindow(
    'main',
    {
      title: 'my title', // i18n.t('Title'),
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
  /*
  // Initialize i18n
  await i18n
    .use(backend)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
      lng: prefs.getCharPref(C.LOCALEPREF),
      fallbackLng: 'en',
      supportedLngs: ['en', 'ru'],

      debug: true,

      backend: {
        // path where resources get loaded from
        loadPath: `${P.ASSET_PATH}/locales/{{lng}}/{{ns}}.json`,
        // path to post missing resources
        addPath: `${P.ASSET_PATH}/locales/{{lng}}/{{ns}}.missing.json`,
        // jsonIndent to use when storing json files
        jsonIndent: 2,
        ipcRenderer: window.api.i18nextElectronBackend,
      },
      saveMissing: !P.ASSET_PATH.includes('resources'),
      saveMissingTo: 'current',

      react: {
        useSuspense: false,
      },

      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },
    });
*/
  const splashWindow = openSplashWindow(true);

  mainWindow = await openMainWindow(true);

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
    rendererBackend.clearMainBindings(ipcMain);
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
