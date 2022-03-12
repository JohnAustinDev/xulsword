/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint global-require: off, no-console: off */

import 'core-js/stable';
import 'regenerator-runtime/runtime';
import {
  app,
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
  IpcMainInvokeEvent,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import i18n from 'i18next';
import { GPublic, WindowRegistryType } from '../type';
import C from '../constant';
import Data from './modules/data';
import MenuBuilder from './menu';
import { jsdump } from './mutil';
import { WindowRegistry } from './window';
import G from './mg';
import LibSword from './modules/libsword';
import contextMenu from './contextMenu';

const i18nBackendMain = require('i18next-fs-backend');

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

const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

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
function handleGlobal(
  event: IpcMainEvent | IpcMainInvokeEvent,
  name: string,
  ...args: any[]
) {
  let ret = null;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (name in GPublic) {
    const gPublic = GPublic as any;
    const g = G as any;
    if (gPublic[name] === 'getter') {
      ret = g[name];
    } else if (typeof gPublic[name] === 'function') {
      if (name === 'setGlobalStateFromPref') {
        args[0] = win;
      }
      ret = g[name](...args);
    } else if (typeof gPublic[name] === 'object') {
      const m = args.shift();
      if (gPublic[name][m] === 'getter') {
        ret = g[name][m];
      } else if (typeof gPublic[name][m] === 'function') {
        if ('browserWindow' in g[name]) g[name].browserWindow = win;
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

  return ret;
}
ipcMain.on('global', (event: IpcMainEvent, name: string, ...args: any[]) => {
  event.returnValue = handleGlobal(event, name, ...args);
});
ipcMain.handle(
  'global',
  (event: IpcMainInvokeEvent, name: string, ...args: any[]) => {
    return handleGlobal(event, name, ...args);
  }
);

ipcMain.on('did-finish-render', (event: IpcMainEvent) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const wd = WindowRegistry[win.id];
  if (!wd) return;
  const { name } = wd;

  if (name === 'xulsword' && process.env.START_MINIMIZED) {
    win.minimize();
  } else {
    win.show();
    win.focus();
  }
  if (name === 'xulsword') {
    setTimeout(() => {
      G.Window.close({ name: 'splash' });
    }, 1000);
  }
  if (process.env.NODE_ENV === 'development') win.webContents.openDevTools();
});

const openMainWindow = () => {
  let options: Electron.BrowserWindowConstructorOptions = {
    title: t('programTitle'),
    fullscreenable: true,
    width: 1024,
    height: 728,
  };

  const windowsDidClose = G.Prefs.getBoolPref(`WindowsDidClose`);
  G.Prefs.setBoolPref(`WindowsDidClose`, false);
  const persistWinPref = G.Prefs.getPrefOrCreate(
    `PersistedWindows`,
    'complex',
    {},
    'windows'
  ) as WindowRegistryType | Record<string, never>;
  const persistedWindows: WindowRegistryType = [];
  if (persistWinPref) {
    G.Prefs.setComplexValue(`PersistedWindows`, {}, 'windows');
    if (windowsDidClose) {
      Object.entries(persistWinPref).forEach((entry) => {
        const reg = entry[1] as WindowRegistryType[number];
        if (reg && reg.name === 'xulsword') {
          if (reg.options) options = reg.options;
        } else {
          persistedWindows.push(reg);
        }
      });
    }
  }

  G.Prefs.setComplexValue(`Windows`, {}, 'windows');
  const mainWin = BrowserWindow.fromId(
    G.Window.open({ name: 'xulsword', options })
  );

  if (!mainWin) {
    return null;
  }

  const menuBuilder = new MenuBuilder(mainWin, i18n);
  menuBuilder.buildMenu();

  if (isDevelopment)
    mainWin.on('ready-to-show', () => require('electron-debug')());

  mainWin.on('close', () => {
    // Persist any open windows for the next restart
    G.Prefs.setComplexValue(
      `PersistedWindows`,
      G.Prefs.getComplexValue('Windows', 'windows'),
      'windows'
    );
    // Close all other open windows
    BrowserWindow.getAllWindows().forEach((w) => {
      if (w !== mainWin) w.close();
    });
  });

  mainWin.on('closed', () => {
    jsdump('NOTE: mainWindow closed...');
  });

  persistedWindows.forEach((reg) => {
    if (reg) G.Window.open(reg);
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
  const lng: string = G.Prefs.getCharPref(C.LOCALEPREF);
  await i18n
    .use(i18nBackendMain)
    .init({
      lng,
      fallbackLng: isDevelopment ? 'cimode' : C.FallbackLanguage[lng] || ['en'],
      supportedLngs: supportedLangs,
      preload: supportedLangs,

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

  if (!(C.DEVELSPLASH === 1 && isDevelopment)) {
    G.Window.open({
      name: 'splash',
      type: 'dialog',
      options:
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
              backgroundColor: '#FFFFFF00',
            },
    });
  }

  // Initialize napi libxulsword as LibSword
  LibSword.initLibsword();

  openMainWindow();

  // Remove this if your app does not use auto updates
  // new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  G.Prefs.setBoolPref(`WindowsDidClose`, true);

  // Write all prefs to disk when app closes
  G.Prefs.writeAllStores();

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (!WindowRegistry.some((wd) => wd && wd.name === 'xulsword'))
    openMainWindow();
});

// Didn't see a better way to inject a troublesome contextMenu
// dependency into Window.open().
Data.write((win: BrowserWindow) => {
  return contextMenu(win);
}, 'contextMenuFunc');

app
  .whenReady()
  .then(start)
  .catch((e) => {
    throw e.stack;
  });
