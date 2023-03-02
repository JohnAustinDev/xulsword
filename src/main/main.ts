/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */

import 'core-js/stable';
import 'regenerator-runtime/runtime';
import {
  app,
  crashReporter,
  dialog,
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log, { LogLevel } from 'electron-log';
import path from 'path';
import Subscription from '../subscription';
import Cache from '../cache';
import { clone, getStatePref, JSON_parse } from '../common';
import C, { SP, SPBM } from '../constant';
import G from './mg';
import { getCipherFailConfs, getTabs, updateGlobalModulePrefs } from './minit';
import MainMenuBuilder, { pushPrefsToMenu } from './menu';
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

import type {
  BookType,
  NewModulesType,
  PrefObject,
  WindowRegistryType,
} from '../type';
import type { ManagerStatePref } from '../renderer/moduleManager/manager';
import { addBookmarkTransaction } from './bookmarks';

const i18nBackendMain = require('i18next-fs-backend');
const installer = require('electron-devtools-installer');
const sourceMapSupport = require('source-map-support');
const electronDebug = require('electron-debug');

Object.entries(SP).forEach((entry) => {
  const [key, val] = entry;
  getStatePref(G.Prefs, key, val);
});
getStatePref(G.Prefs, 'manager', SPBM.manager as PrefObject, 'bookmarks');
addBookmarkTransaction(
  -1,
  'manager.bookmarks',
  G.Prefs.getComplexValue(
    'manager.bookmarks',
    'bookmarks'
  ) as typeof SPBM.manager.bookmarks,
  'bookmarks'
);

if (G.Prefs.getBoolPref('global.InternetPermission')) {
  const url = G.Prefs.getCharPref('global.crashReporterURL');
  if (url) {
    crashReporter.start({ submitURL: url });
  }
}

// Init xulsword logfile.
{
  const logfile = new LocalFile(
    path.join(G.Dirs.path.ProfD, 'logs', `xulsword.${Date.now()}.log`)
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

const appSubscriptions: (() => void)[] = [];
appSubscriptions.push(Subscription.subscribe.windowCreated(contextMenu));

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  sourceMapSupport.install();
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

const openXulswordWindow = () => {
  const opts = { ns: 'branding' };
  const programTitle = G.i18n.exists('programTitle', opts)
    ? G.i18n.t('programTitle', opts)
    : 'xulsword';
  let options: Electron.BrowserWindowConstructorOptions = {
    title: programTitle,
    fullscreenable: true,
    ...C.UI.Window.large,
  };

  const windowsDidClose = G.Prefs.getBoolPref(`global.WindowsDidClose`);
  G.Prefs.setBoolPref(`global.WindowsDidClose`, false);
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
  const xulswordWindow = BrowserWindow.fromId(
    G.Window.open({ type: 'xulsword', options })
  );

  if (!xulswordWindow) {
    return null;
  }

  const menuBuilder = new MainMenuBuilder(xulswordWindow);
  menuBuilder.buildMenu();

  updateGlobalModulePrefs();

  const BuildInfo = `${app.getName()} ${app.getVersion()} (${app.getLocale()}) ${
    process.platform
  }-${process.arch}, el:${process.versions.electron}, ch:${
    process.versions.chrome
  }`;
  log.info(BuildInfo);
  G.Data.write(BuildInfo, 'buildInfo');

  const xswinSubscriptions: (() => void)[] = [];
  xswinSubscriptions.push(Subscription.doSubscribe('getG', () => G));
  // addBookmarkTransaction must be before pushPrefsToMenu for undo/redo enable to work.
  xswinSubscriptions.push(
    Subscription.subscribe.prefsChanged(addBookmarkTransaction)
  );
  xswinSubscriptions.push(
    Subscription.subscribe.prefsChanged(pushPrefsToWindows)
  );
  xswinSubscriptions.push(Subscription.subscribe.prefsChanged(pushPrefsToMenu));
  xswinSubscriptions.push(
    Subscription.subscribe.resetMain(() => {
      G.LibSword.quit();
      Cache.clear();
      G.LibSword.init();
      updateGlobalModulePrefs();
      menuBuilder.buildMenu();
    })
  );
  xswinSubscriptions.push(
    Subscription.subscribe.modulesInstalled(
      (newmods: NewModulesType, callingWinID?: number) => {
        const newErrors = newmods.reports.map((r) => r.error).filter(Boolean);
        const newWarns = newmods.reports.map((r) => r.warning).filter(Boolean);
        if (newErrors.length) {
          log.error(
            `${
              newmods.modules.length
            } Module(s) installed with problems:\n${newErrors.join('\n')}`
          );
        } else if (newWarns.length) {
          log.warn(
            `${
              newmods.modules.length
            } Module(s) installed with warnings:\n${newWarns.join('\n')}`
          );
        } else {
          log.info(
            `${
              newmods.modules.length + newmods.bookmarks.length
            } MODULE(S) SUCCESSFULLY INSTALLED!`
          );
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
          newmods.modules
            .filter((c) => c.xsmType !== 'XSM_audio')
            .forEach((conf) => {
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

  // Prompt for CipherKeys when encrypted modules with no keys, or
  // incorrect keys, are installed.
  if (Object.keys(CipherKeyModules).length) {
    publishSubscription('modulesInstalled', { id: xulswordWindow.id }, false, {
      ...clone(C.NEWMODS),
      nokeymods: getCipherFailConfs(),
    });
  }

  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    xulswordWindow.on('ready-to-show', () =>
      electronDebug({
        showDevTools: C.DevToolsopen,
        devToolsMode: 'undocked',
      })
    );
  }

  xulswordWindow.on('close', () => {
    // Persist any open windows for the next restart
    G.Prefs.setComplexValue(
      `OpenOnStartup`,
      G.Prefs.getComplexValue('OpenWindows', 'windows'),
      'windows'
    );
    // Close all other open windows
    BrowserWindow.getAllWindows().forEach((w) => {
      if (w !== xulswordWindow) w.close();
    });
    xswinSubscriptions.forEach((dispose) => dispose());
    G.LibSword.quit();

    G.Prefs.setBoolPref(`global.WindowsDidClose`, true);

    // Write all prefs to disk when app closes
    G.Prefs.writeAllStores();

    Cache.clear();
  });

  xulswordWindow.on('closed', () => {
    log.verbose('xulsword window closed...');
  });

  persistedWindows.forEach((windowDescriptor) => {
    if (windowDescriptor) G.Window.open(windowDescriptor);
  });

  return xulswordWindow;
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
    // Choose a starting locale based on the host machine's system language.
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
    // Set the starting moduleManager language selection
    const codes = G.Prefs.getComplexValue(
      'moduleManager.language.selection'
    ) as ManagerStatePref['language']['selection'];
    if (!codes.length) {
      G.Prefs.setComplexValue('moduleManager.language.selection', [
        lng.replace(/-.*$/, ''),
      ]);
    }
  }

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

  // Set i18n reliant pref values
  const repositories = G.Prefs.getComplexValue(
    'moduleManager.repositories'
  ) as ManagerStatePref['repositories'];
  if (repositories) {
    repositories.xulsword.forEach((repo) => {
      const key = `${repo.name}.repository.label`;
      const opts = { ns: 'branding' };
      if (G.i18n.exists(key, opts)) repo.name = G.i18n.t(key, opts);
    });
    G.Prefs.setComplexValue('moduleManager.repositories', repositories);
  }

  // If there are no tabs, choose tabs and location based on current locale
  // and installed modules.
  const xulsword = G.Prefs.getComplexValue('xulsword') as typeof SP.xulsword;
  if (xulsword.tabs.every((tb) => tb === null || !tb.length)) {
    const slng = lng.replace(/-.*$/, '');
    const lngmodules = Array.from(
      new Set(
        G.Tabs.filter(
          (t) => t.type === C.BIBLE && t.lang?.replace(/-.*$/, '') === slng
        )
          .map((t) => t.module)
          .sort()
          .concat(
            G.Tabs.filter(
              (t) =>
                t.type === C.BIBLE &&
                t.lang?.replace(/-.*$/, '') === C.FallbackLanguage[lng]
            )
              .map((t) => t.module)
              .sort()
          )
      )
    );
    xulsword.tabs = xulsword.panels.map((p) =>
      p === null ? null : lngmodules
    );
    let x = -1;
    xulsword.panels = xulsword.panels.map((p) => {
      if (p === '') {
        if (x < lngmodules.length - 1) x += 1;
        return lngmodules[x];
      }
      return p;
    });
    const vkmod = xulsword.panels.filter(
      (p) => p && p in G.Tab && G.Tab[p].isVerseKey
    )[0];
    const books = ((vkmod && G.getBooksInModule(vkmod)) || []).sort((a, b) => {
      const ab = G.Book[a] as BookType;
      const bb = G.Book[b] as BookType;
      if (ab.bookGroup === 'nt' && bb.bookGroup !== 'nt') return -1;
      if (ab.bookGroup !== 'nt' && bb.bookGroup === 'nt') return 1;
      return ab.index < bb.index ? -1 : ab.index > bb.index ? 1 : 0;
    });
    const { location } = xulsword;
    if (
      books.length &&
      (location === null || !books.includes(location.book as any))
    ) {
      xulsword.location = {
        book: books[0],
        chapter: 1,
        verse: 1,
        v11n: (vkmod && G.Tab[vkmod].v11n) || 'KJV',
      };
    }
    G.Prefs.setComplexValue('xulsword', xulsword);
  }

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

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    appSubscriptions.forEach((dispose) => dispose());
    log.info(`Exiting...`);
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (!WindowRegistry.some((wd) => wd && wd.type === 'xulsword'))
    openXulswordWindow();
});

app
  .whenReady()
  .then(() => {
    if (G.Prefs.getBoolPref('global.InternetPermission')) {
      autoUpdater.logger = log;
      autoUpdater.checkForUpdatesAndNotify();
    }
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
    return openXulswordWindow();
  })
  .catch((e) => {
    throw e.stack;
  });
