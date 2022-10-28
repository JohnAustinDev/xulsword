/* eslint-disable @typescript-eslint/no-explicit-any */

import 'core-js/stable';
import 'regenerator-runtime/runtime';
import {
  app,
  dialog,
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import i18n from 'i18next';
import Subscription from '../subscription';
import Cache from '../cache';
import C from '../constant';
import G from './mg';
import LibSword from './components/libsword';
import MenuBuilder, { pushPrefsToMenu } from './menu';
import {
  WindowRegistry,
  pushPrefsToWindows,
  getBrowserWindows,
  publishSubscription,
} from './window';
import contextMenu from './contextMenu';
import { updateGlobalModulePrefs } from './minit';
import setViewportTabs from './tabs';

import type { NewModulesType, WindowRegistryType } from '../type';

const i18nBackendMain = require('i18next-fs-backend');
const installer = require('electron-devtools-installer');
const sourceMapSupport = require('source-map-support');
const electronDebug = require('electron-debug');

const logLevel = C.isDevelopment ? C.DevLogLevel : 'info';
log.transports.console.level = logLevel;
log.transports.file.level = logLevel;
log.info(
  `isDevelopment='${C.isDevelopment}' DEBUG_PROD='${process.env.DEBUG_PROD}' XULSWORD_ENV='${process.env.XULSWORD_ENV}'`
);

LibSword.init();

const AvailableLanguages = [
  ...new Set(
    C.Locales.map((l) => {
      return l[0];
    })
      .map((l) => {
        return [l, l.replace(/-.*$/, '')];
      })
      .flat()
  ),
];
// Select the program's locale
let Language = G.Prefs.getCharPref('global.locale');
if (!Language) {
  const oplng = 'en'; // webpack couldn't compile os-locale module
  let matched = '';
  C.Locales.forEach((l) => {
    if (!matched && (l[0] === oplng || l[0].replace(/-.*$/, '') === oplng))
      [matched] = l;
  });
  Language = matched || 'ru';
  G.Prefs.setCharPref('global.locale', Language);
}
// Set program menu direction and Chromium locale. This must be done
// before the app 'ready' event is fired, which happens even before
// i18next or configs are initialized. Direction need not be forced
// for locales in Chromium's list, like fa, but must be for ky-Arab.
if ((C.Locales.find((l) => l[0] === Language) || [])[2] === 'rtl') {
  app.commandLine.appendSwitch('force-ui-direction', 'rtl');
}
app.commandLine.appendSwitch('lang', Language.replace(/-.*$/, ''));

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  sourceMapSupport.install();
}

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let ModulesInstalled: {
  callingWinID: number;
  newmods: NewModulesType;
} | null = null;

ipcMain.on('did-finish-render', (event: IpcMainEvent) => {
  let callingWin = BrowserWindow.fromWebContents(event.sender);
  if (!callingWin) return;
  const wd = WindowRegistry[callingWin.id];
  if (!wd) {
    callingWin = null;
    return;
  }

  if (ModulesInstalled?.callingWinID === callingWin.id) {
    publishSubscription(
      false,
      { id: callingWin.id },
      'modulesInstalled',
      ModulesInstalled.newmods
    );
    ModulesInstalled = null;
  }

  const { type } = wd;
  if (type === 'xulsword' && process.env.START_MINIMIZED) {
    callingWin.minimize();
  } else {
    callingWin.show();
    callingWin.focus();
  }
  if (type === 'xulsword' && !(C.isDevelopment && C.DevSplash === 2)) {
    setTimeout(() => {
      G.Window.close({ type: 'splash' });
    }, 1000);
  }
  callingWin = null;
});

const openMainWindow = () => {
  let options: Electron.BrowserWindowConstructorOptions = {
    title: i18n.t('programTitle'),
    fullscreenable: true,
    width: 1024,
    height: 728,
  };

  const windowsDidClose = G.Prefs.getBoolPref(`WindowsDidClose`);
  G.Prefs.setBoolPref(`WindowsDidClose`, false);
  const persistWinPref = G.Prefs.getPrefOrCreate(
    `OpenOnStartup`,
    'complex',
    {},
    'windows'
  ) as WindowRegistryType | Record<string, never>;
  const persistedWindows: WindowRegistryType = [];
  if (persistWinPref) {
    G.Prefs.deleteUserPref(`OpenOnStartup`, 'windows');
    if (windowsDidClose) {
      Object.entries(persistWinPref).forEach((entry) => {
        const reg = entry[1] as WindowRegistryType[number];
        if (reg && reg.type === 'xulsword') {
          if (reg.options) options = reg.options;
        } else {
          persistedWindows.push(reg);
        }
      });
    }
  }

  G.Prefs.setComplexValue(`OpenWindows`, {}, 'windows');
  const mainWin = BrowserWindow.fromId(
    G.Window.open({ type: 'xulsword', options })
  );

  if (!mainWin) {
    return null;
  }

  const menuBuilder = new MenuBuilder(mainWin, i18n);
  menuBuilder.buildMenu();

  // TODO! install command line modules (xulsword 2.0 newModule.js)
  updateGlobalModulePrefs();

  G.Data.write(
    `${app.getName()} ${app.getVersion()} (${app.getLocale()}) ${
      process.platform
    }-${process.arch}, el:${process.versions.electron}, ch:${
      process.versions.chrome
    }`,
    'buildInfo'
  );

  const subscriptions: (() => void)[] = [];
  subscriptions.push(Subscription.subscribe('setPref', pushPrefsToWindows));
  subscriptions.push(Subscription.subscribe('setPref', pushPrefsToMenu));
  subscriptions.push(
    Subscription.subscribe('resetMain', () => {
      LibSword.quit();
      Cache.clear();
      LibSword.init();
      updateGlobalModulePrefs();
      menuBuilder.buildMenu();
    })
  );
  subscriptions.push(
    Subscription.subscribe(
      'modulesInstalled',
      (newmods: NewModulesType, callingWinID?: number) => {
        if (
          newmods.errors.length &&
          newmods.errors.some((msg) => /(failed|warning)/i.test(msg))
        ) {
          log.error(
            `Module installation problems follow:\n${newmods.errors.join('\n')}`
          );
        } else if (!newmods.errors.length) {
          log.info('ALL FILES WERE SUCCESSFULLY INSTALLED!');
        }
        Subscription.publish('resetMain');
        newmods.modules.forEach((conf) => {
          setViewportTabs(-1, conf.module, 'show');
        });
        // When callingWin is finished reloading, did-finish-render
        // will publish modulesInstalled on that window.
        ModulesInstalled = !callingWinID
          ? null
          : {
              callingWinID,
              newmods,
            };
        BrowserWindow.getAllWindows().forEach((w) => {
          w.webContents.reload();
        });
      }
    )
  );

  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    mainWin.on('ready-to-show', () =>
      electronDebug({
        showDevTools: false,
        devToolsMode: 'undocked',
      })
    );
  }

  mainWin.on('close', () => {
    // Persist any open windows for the next restart
    G.Prefs.setComplexValue(
      `OpenOnStartup`,
      G.Prefs.getComplexValue('OpenWindows', 'windows'),
      'windows'
    );
    // Close all other open windows
    BrowserWindow.getAllWindows().forEach((w) => {
      if (w !== mainWin) w.close();
    });
    subscriptions.forEach((dispose) => dispose());
    LibSword.quit();
  });

  mainWin.on('closed', () => {
    log.verbose('mainWindow closed...');
  });

  persistedWindows.forEach((windowDescriptor) => {
    if (windowDescriptor) G.Window.open(windowDescriptor);
  });

  return mainWin;
};

const init = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await (async () => {
      const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
      const extensions = ['REACT_DEVELOPER_TOOLS'];
      return installer
        .default(
          extensions.map((name) => installer[name]),
          forceDownload
        )
        .catch((e: Error) => log.error(e));
    })();
  }
  // Remove this if your app does not use auto updates
  // new AppUpdater();
  await i18n
    .use(i18nBackendMain)
    .init({
      lng: Language,
      fallbackLng: C.FallbackLanguage[Language] || ['en'],
      supportedLngs: AvailableLanguages,
      preload: AvailableLanguages,

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
      saveMissing: C.isDevelopment,
      saveMissingTo: 'current',

      react: {
        useSuspense: false,
      },

      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },
    })
    .catch((e) => log.error(e));

  log.catchErrors({
    showDialog: false,
    onError(error, versions, submitIssue) {
      // eslint-disable-next-line promise/no-promise-in-callback
      dialog
        .showMessageBox({
          title: i18n.t('error-detected'),
          message: error.message,
          detail: error.stack,
          type: 'error',
          buttons: ['Ignore', 'Report', 'Exit'],
        })
        .then((result) => {
          if (result.response === 1 && submitIssue) {
            submitIssue(
              'https://github.com/JohnAustinDev/xulsword/issues/new',
              {
                title: `Error report for ${versions?.app || 'unknown'}`,
                body:
                  `Error:\n\`\`\`${error.stack}\n\`\`\`\n` +
                  `OS: ${versions?.os || 'unknown'}`,
              }
            );
            return result;
          }

          if (result.response === 2) {
            app.quit();
          }
          return result;
        })
        .catch((err) => {
          throw Error(err);
        });
    },
  });
  return i18n;
};

const subscriptions: (() => void)[] = [];
subscriptions.push(Subscription.subscribe('createWindow', contextMenu));

app.on('window-all-closed', () => {
  G.Prefs.setBoolPref(`WindowsDidClose`, true);

  // Write all prefs to disk when app closes
  G.Prefs.writeAllStores();

  Cache.clear();

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    subscriptions.forEach((dispose) => dispose());
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (!WindowRegistry.some((wd) => wd && wd.type === 'xulsword'))
    openMainWindow();
});

app
  .whenReady()
  .then(() => {
    return init();
  })
  .then(() => {
    if (!(C.isDevelopment && C.DevSplash === 1)) {
      G.Window.open({
        type: 'splash',
        category: 'dialog',
        options:
          C.isDevelopment && C.DevSplash === 2
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
    return openMainWindow();
  })
  .catch((e) => {
    throw e.stack;
  });
