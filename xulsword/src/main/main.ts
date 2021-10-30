/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint global-require: off, no-console: off */

import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, ipcMain, IpcMainEvent } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import i18n from 'i18next';
import MenuBuilder from './menu';
import { resolveHtmlPath, jsdump } from './mutil';
import G from './gm';
import C from '../constant';
import { GPublic } from '../type';

const i18nBackendMain = require('i18next-fs-backend');
const i18nBackendRenderer = require('i18next-electron-fs-backend');

let t: (key: string, options?: any) => string;

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
  return path.join(G.Dirs.path.xsAsset, ...paths);
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

// Handle global variable calls from renderer
ipcMain.on('global', (event: IpcMainEvent, name: string, ...args: any[]) => {
  let ret = null;

  if (name in GPublic) {
    const gPublic = GPublic as any;
    const g = G as any;
    if (gPublic[name] === 'readonly') {
      ret = g[name];
    } else if (typeof gPublic[name] === 'object') {
      const m = args.shift();
      if (gPublic[name][m] === 'readonly') {
        ret = g[name][m];
      } else if (typeof gPublic[name][m] === 'function') {
        ret = g[name][m](...args);
      } else {
        throw Error(`Unhandled method type for ${name}.${m}`);
      }
    } else {
      throw Error(`Unhandled global ${name} ipc type: ${gPublic[name]}`);
    }
  } else {
    throw Error(`Unhandled global ipc request: ${name}`);
  }

  event.returnValue = ret;
});

const createWindow = (
  name: string,
  params: Electron.BrowserWindowConstructorOptions | undefined
) => {
  const newWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      additionalArguments: [name], // will be appended to process.argv in the renderer
    },
    ...params,
  });

  newWindow.loadURL(resolveHtmlPath(`${name}.html`));

  // Bind i18next-electron-fs-backend providing IPC to renderer processes
  i18nBackendRenderer.mainBindings(ipcMain, newWindow, fs);

  newWindow.webContents.on('did-finish-load', () => {
    if (!newWindow) {
      throw new Error(`${name} window is not defined`);
    }
    if (process.env.START_MINIMIZED) {
      newWindow.minimize();
    } else {
      newWindow.show();
      newWindow.focus();
    }
  });

  return newWindow;
};

const openSplashWindow = () => {
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
        }
  );

  return splashWindow;
};

const openMainWindow = () => {
  mainWindow = createWindow('main', {
    title: t('Title'),
    icon: getAssetPath('icon.png'),
    width: G.Prefs.getPrefOrCreate('win.main.width', 'number', 1024) as number,
    height: G.Prefs.getPrefOrCreate('win.main.height', 'number', 728) as number,
  });
  if (mainWindow === null) {
    return null;
  }

  mainWindow.on('resize', () => {
    if (mainWindow !== null) mainWindow.webContents.send('resize');
  });

  mainWindow.on('close', () => {
    if (mainWindow !== null) mainWindow.webContents.send('close');
  });

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

  // Initialize i18n
  await i18n
    .use(i18nBackendMain)
    .init({
      lng: G.Prefs.getCharPref(C.LOCALEPREF),
      fallbackLng: 'en',
      supportedLngs: ['en', 'ru'],

      ns: 'xulsword',
      defaultNS: 'xulsword',

      debug: false,

      backend: {
        // path where resources get loaded from
        loadPath: `${G.Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.json`,
        // path to post missing resources
        addPath: `${G.Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.missing.json`,
        // jsonIndent to use when storing json files
        jsonIndent: 2,
      },
      saveMissing: isDevelopment,
      saveMissingTo: 'current',

      react: {
        useSuspense: false,
      },

      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },
    })
    .catch((e) => jsdump(e));

  t = (key: string, options?: any) => i18n.t(key, options);

  const splashWindow = openSplashWindow();

  mainWindow = openMainWindow();

  if (mainWindow && splashWindow) {
    mainWindow.once('ready-to-show', () => {
      if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => splashWindow.close(), 2000);
      }
    });
  }

  // Remove this if your app does not use auto updates
  // new AppUpdater();

  return mainWindow;
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
    i18nBackendRenderer.clearMainBindings(ipcMain);
  }
});

// Write all prefs to disk when app closes
app.on('window-all-closed', () => {
  if (G.Prefs.store !== null) {
    Object.keys(G.Prefs.store).forEach((key) => G.Prefs.writeStore(key));
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
  if (mainWindow === null) openMainWindow();
});
