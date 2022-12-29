/* eslint-disable @typescript-eslint/no-explicit-any */

import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { app, dialog, BrowserWindow, ipcMain, IpcMainEvent } from 'electron';
import { autoUpdater } from 'electron-updater';
import log, { LogLevel } from 'electron-log';
import path from 'path';
import Subscription from '../subscription';
import Cache from '../cache';
import { clone, JSON_parse, randomID } from '../common';
import C from '../constant';
import G from './mg';
import { getCipherFailConfs, getTabs, updateGlobalModulePrefs } from './minit';
import MenuBuilder, { pushPrefsToMenu } from './menu';
import contextMenu from './contextMenu';
import MainPrintHandler from './print';
import setViewportTabs from './tabs';
import LocalFile from './components/localFile';
import { CipherKeyModules } from './components/module';
import {
  WindowRegistry,
  pushPrefsToWindows,
  publishSubscription,
} from './components/window';

import type { NewModulesType, WindowRegistryType } from '../type';

const i18nBackendMain = require('i18next-fs-backend');
const installer = require('electron-devtools-installer');
const sourceMapSupport = require('source-map-support');
const electronDebug = require('electron-debug');

// Init xulsword logfile.
{
  const logfile = new LocalFile(
    path.join(G.Dirs.path.ProfD, 'logs', `xulsword.${randomID()}.log`)
  );
  if (logfile.exists()) logfile.remove();
  // The renderer log contains any renderer window entries that occur before
  // renderer.tsx, where their file is changed to the main/renderer log file.
  const logfile2 = new LocalFile(
    path.join(G.Dirs.path.ProfD, 'logs', 'renderer.log')
  );
  if (logfile2.exists()) logfile2.remove();
  log.transports.console.level = C.LogLevel;
  log.transports.file.level = C.LogLevel;
  log.transports.file.resolvePath = () => logfile.path;
  log.catchErrors({ onError: (er: Error) => log.error(er) });
}
log.info(`Starting ${app.getName()} isDevelopment='${C.isDevelopment}'`);

G.LibSword.init();

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

// Program menu direction and Chromium locale must be set now,
// before the app 'ready' event is fired, which happens even before
// i18next or configs are initialized. Direction need not be forced
// for locales in Chromium's list, like fa, but must be for ky-Arab.
{
  const lang = G.Prefs.getCharPref('global.locale');
  if (lang) {
    if ((C.Locales.find((l) => l[0] === lang) || [])[2] === 'rtl') {
      app.commandLine.appendSwitch('force-ui-direction', 'rtl');
    }
    app.commandLine.appendSwitch('lang', lang.replace(/-.*$/, ''));
  }
}

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
    if (G.Prefs.getBoolPref('global.InternetPermission')) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  }
}

ipcMain.on('did-finish-render', (event: IpcMainEvent) => {
  let callingWin = BrowserWindow.fromWebContents(event.sender);
  if (!callingWin) return;
  const wd = WindowRegistry[callingWin.id];
  if (!wd) {
    callingWin = null;
    return;
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

ipcMain.handle('print-or-preview', MainPrintHandler);

ipcMain.on(
  'log',
  (_e: IpcMainEvent, type: LogLevel, windowID: string, json: string) => {
    log[type](windowID, ...JSON_parse(json));
  }
);

const openMainWindow = () => {
  let options: Electron.BrowserWindowConstructorOptions = {
    title: G.i18n.t('programTitle', { ns: 'branding' }),
    fullscreenable: true,
    ...C.UI.Window.large,
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

  const menuBuilder = new MenuBuilder(mainWin, G.i18n);
  menuBuilder.buildMenu();

  updateGlobalModulePrefs();

  const BuildInfo = `${app.getName()} ${app.getVersion()} (${app.getLocale()}) ${
    process.platform
  }-${process.arch}, el:${process.versions.electron}, ch:${
    process.versions.chrome
  }`;
  log.info(BuildInfo);
  G.Data.write(BuildInfo, 'buildInfo');

  const subscriptions: (() => void)[] = [];
  subscriptions.push(Subscription.subscribe.setPref(pushPrefsToWindows));
  subscriptions.push(Subscription.subscribe.setPref(pushPrefsToMenu));
  subscriptions.push(
    Subscription.subscribe.resetMain(() => {
      G.LibSword.quit();
      Cache.clear();
      G.LibSword.init();
      updateGlobalModulePrefs();
      menuBuilder.buildMenu();
    })
  );
  subscriptions.push(
    Subscription.subscribe.modulesInstalled(
      (newmods: NewModulesType, callingWinID?: number) => {
        const newErrors = newmods.reports.map((r) => r.error).filter(Boolean);
        const newWarns = newmods.reports.map((r) => r.warning).filter(Boolean);
        if (newErrors.length) {
          log.error(
            `Module installation problems follow:\n${newErrors.join('\n')}`
          );
        } else if (newWarns.length) {
          log.warn(
            `All modules installed with warnings:\n${newWarns.join('\n')}`
          );
        } else {
          log.info('ALL FILES WERE SUCCESSFULLY INSTALLED!');
        }
        Subscription.publish.resetMain();
        newmods.nokeymods = getCipherFailConfs();
        newmods.modules = newmods.modules.filter(
          (nmconf) =>
            !newmods.nokeymods.some((nkconf) => nkconf.module === nmconf.module)
        );
        if (!newmods.modules.length && !getTabs().length) {
          setViewportTabs(-1, 'all', 'hide', true);
        } else {
          newmods.modules.forEach((conf) => {
            setViewportTabs(-1, conf.module, 'show', true);
          });
        }
        if (callingWinID) {
          setTimeout(() => {
            publishSubscription(
              'modulesInstalled',
              { id: callingWinID },
              false,
              newmods
            );
          }, 1);
        }
        G.Window.modal([{ modal: 'off', window: 'all' }]);
      }
    )
  );

  // TODO! install command line modules (xulsword 3.0 newModule.js)

  // Prompt for CipherKeys when encrypted modules with no keys, or
  // incorrect keys, are installed.
  if (Object.keys(CipherKeyModules).length) {
    publishSubscription('modulesInstalled', { id: mainWin.id }, false, {
      ...clone(C.NEWMODS),
      nokeymods: getCipherFailConfs(),
    });
  }

  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    mainWin.on('ready-to-show', () =>
      electronDebug({
        showDevTools: C.DevToolsopen,
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
    G.LibSword.quit();
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

  let lng = G.Prefs.getCharPref('global.locale');
  if (!lng) {
    const langs = C.Locales.map((x) => x[0].replace(/-.*$/, ''));
    const plangs = app.getPreferredSystemLanguages();
    log.info(`App locale is not set. Preferred system languages are: `, plangs);
    plangs.forEach((l) => {
      const ls = l.replace(/-.*$/, '');
      if (!lng && langs.includes(ls)) lng = ls;
    });
    lng = lng || 'ru';
    log.info(`Choosing language: ${lng}`);
    G.Prefs.setCharPref('global.locale', lng);
  }

  // Remove this if your app does not use auto updates
  // new AppUpdater();
  await G.i18n
    .use(i18nBackendMain)
    .init({
      lng,
      fallbackLng: C.FallbackLanguage[lng] || ['en'],
      supportedLngs: AvailableLanguages,
      preload: AvailableLanguages,

      ns: ['xulsword', 'branding', 'config', 'books', 'numbers'],
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

      keySeparator: false,
    })
    .catch((e) => log.error(e));

  log.catchErrors({
    showDialog: false,
    onError(error, versions, submitIssue) {
      // eslint-disable-next-line promise/no-promise-in-callback
      dialog
        .showMessageBox({
          title: G.i18n.t('error-detected'),
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
};

const subscriptions: (() => void)[] = [];
subscriptions.push(Subscription.subscribe.createWindow(contextMenu));

app.on('window-all-closed', () => {
  G.Prefs.setBoolPref(`WindowsDidClose`, true);

  // Write all prefs to disk when app closes
  G.Prefs.writeAllStores();

  Cache.clear();

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    subscriptions.forEach((dispose) => dispose());
    log.info(`Exiting...`);
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
