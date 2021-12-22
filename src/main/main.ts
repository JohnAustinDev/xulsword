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

const xsWindow = {
  main: null as BrowserWindow | null,
  splash: null as BrowserWindow | null,
};

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

ipcMain.on('did-finish-render', (event: IpcMainEvent) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win === xsWindow.main && process.env.START_MINIMIZED) {
      win.minimize();
    } else {
      win.show();
      win.focus();
    }
    if (win === xsWindow.main && xsWindow.splash) {
      xsWindow.splash.close();
    }
  }
});

const createWindow = (
  name: string,
  params: Electron.BrowserWindowConstructorOptions | undefined
) => {
  const newWindow = new BrowserWindow({
    show: false,
    useContentSize: true,
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

  newWindow.on('resize', () => {
    const size = newWindow.getSize();
    newWindow.webContents.send('resize', size);
  });

  return newWindow;
};

const openSplashWindow = () => {
  const splashWindow = createWindow(
    'splash',
    isDevelopment && C.DEVELSPLASH === 2
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

  const mainWin = createWindow(name, {
    title: t('programTitle'),
    icon: getAssetPath('icon.png'),
    width,
    height,
    x,
    y,
  });

  if (mainWin === null) {
    return null;
  }

  function saveBounds() {
    const w = mainWin.getNormalBounds();
    const c = mainWin.getContentBounds();
    G.Prefs.setIntPref(`window.${name}.width`, c.width);
    G.Prefs.setIntPref(`window.${name}.height`, c.height);
    G.Prefs.setIntPref(`window.${name}.x`, c.x);
    // The 12 works for Ubuntu 20
    G.Prefs.setIntPref(`window.${name}.y`, w.y - (w.height - c.height) - 12);
  }

  const menuBuilder = new MenuBuilder(mainWin, i18n);
  menuBuilder.buildMenu();

  mainWin.on('close', () => {
    saveBounds();
    if (xsWindow.main !== null) xsWindow.main.webContents.send('close');
  });

  mainWin.on('closed', () => {
    xsWindow.main = null;
    jsdump('NOTE: mainWindow closed...');
  });

  return mainWin;
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

  if (!(C.DEVELSPLASH === 1 && isDevelopment))
    xsWindow.splash = openSplashWindow();

  // Initialize napi libxulsword as LibSword
  LibSword.initLibsword();

  xsWindow.main = openMainWindow();

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
  if (xsWindow.main === null) openMainWindow();
});
