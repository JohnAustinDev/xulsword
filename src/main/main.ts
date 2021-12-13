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
import { GPublic } from '../type';
import C from '../constant';
import MenuBuilder from './menu';
import { resolveHtmlPath, jsdump } from './mutil';
import G from './mg';
import LibSword from './modules/libsword';

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
    } else if (typeof gPublic[name] === 'function') {
      ret = g[name](...args);
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

  // Unbind i18next-electron-fs-backend from window upon close to prevent
  // access of closed window. Since the binding is anonymous, all are
  // removed, and other windows get new ones added back.
  newWindow.on('close', () => {
    i18nBackendRenderer.clearMainBindings(ipcMain);
    BrowserWindow.getAllWindows().forEach((w) => {
      if (w !== newWindow) {
        i18nBackendRenderer.mainBindings(ipcMain, w, fs);
      }
    });
  });

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

  newWindow.on('resize', () => {
    const size = newWindow.getSize();
    newWindow.webContents.send('resize', size);
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
  const name = 'xulsword';
  // Open to Prefs size/location
  let x;
  let y;
  try {
    x = G.Prefs.getIntPref(`window.${name}.x`);
    y = G.Prefs.getIntPref(`window.${name}.y`);
  } catch {
    x = undefined;
    y = undefined;
  }
  const width = G.Prefs.getPrefOrCreate(
    `window.${name}.width`,
    'number',
    1024
  ) as number;
  const height = G.Prefs.getPrefOrCreate(
    `window.${name}.height`,
    'number',
    728
  ) as number;

  mainWindow = createWindow(name, {
    title: t('programTitle'),
    icon: getAssetPath('icon.png'),
    width,
    height,
    x,
    y,
  });

  if (mainWindow === null) {
    return null;
  }

  function saveBounds() {
    if (mainWindow !== null) {
      const b = mainWindow.getNormalBounds();
      G.Prefs.setIntPref(`window.${name}.width`, b.width);
      G.Prefs.setIntPref(`window.${name}.height`, b.height);
      G.Prefs.setIntPref(`window.${name}.x`, b.x);
      G.Prefs.setIntPref(`window.${name}.y`, b.y);
    }
  }

  mainWindow.on('resize', () => {
    saveBounds();
  });

  mainWindow.on('move', () => {
    saveBounds();
  });

  mainWindow.on('close', () => {
    if (mainWindow !== null) mainWindow.webContents.send('close');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    jsdump('NOTE: mainWindow closed...');
  });

  const menuBuilder = new MenuBuilder(mainWindow, i18n);
  menuBuilder.buildMenu();

  return mainWindow;
};

const start = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  let supportedLangs = G.Prefs.getComplexValue('global.locales').map(
    (l: any) => {
      return l[0];
    }
  );
  supportedLangs = [
    ...new Set(
      supportedLangs.concat(
        supportedLangs.map((l: any) => {
          return l.replace(/-.*$/, '');
        })
      )
    ),
  ];

  // Initialize i18n
  await i18n
    .use(i18nBackendMain)
    .init({
      lng: G.Prefs.getCharPref(C.LOCALEPREF),
      fallbackLng: 'en',
      supportedLngs: supportedLangs,

      ns: ['xulsword', 'common/config', 'common/books', 'common/numbers'],
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

  let splashWindow: BrowserWindow | undefined;
  if (!isDevelopment) splashWindow = openSplashWindow();

  // Initialize napi libxulsword as LibSword
  LibSword.initLibsword();

  mainWindow = openMainWindow();

  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => {
          if (splashWindow) splashWindow.close();
        }, 2000);
      }
    });
  }

  // Remove this if your app does not use auto updates
  // new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Write all prefs to disk when app closes
  G.Prefs.writeAllStores();

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(start)
  .catch((e) => {
    throw e.stack;
  });

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) openMainWindow();
});
