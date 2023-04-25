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
import { clone, JSON_parse, keep, localizeString } from '../common';
import C from '../constant';
import S from '../defaultPrefs';
import G from './mg';
import { getCipherFailConfs, validateGlobalModulePrefs } from './minit';
import MainMenuBuilder, { pushPrefsToMenu } from './mainMenu';
import contextMenu from './contextMenu';
import MainPrintHandler from './print';
import LocalFile from './components/localFile';
import Viewport from './components/viewport';
import { CipherKeyModules } from './components/module';
import {
  WindowRegistry,
  pushPrefsToWindows,
  publishSubscription,
} from './components/window';

import type {
  NewModulesType,
  WindowDescriptorPrefType,
  WindowDescriptorType,
} from '../type';
import type { ManagerStatePref } from '../renderer/moduleManager/manager';
import { addBookmarkTransaction } from './bookmarks';

const i18nBackendMain = require('i18next-fs-backend');
const installer = require('electron-devtools-installer');
const sourceMapSupport = require('source-map-support');
const electronDebug = require('electron-debug');

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
}
log.info(`Starting ${app.getName()} isDevelopment='${C.isDevelopment}'`);

addBookmarkTransaction(
  -1,
  'bookmarks',
  'rootfolder',
  G.Prefs.getComplexValue(
    'rootfolder',
    'bookmarks'
  ) as typeof S.bookmarks.rootfolder
);

if (G.Prefs.getBoolPref('global.InternetPermission')) {
  const url = G.Prefs.getCharPref('global.crashReporterURL');
  if (url) {
    crashReporter.start({ submitURL: url });
  }
}

G.LibSword.init();

let ProgramTitle = '';

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

// Make all windows appear at the same time, rather than each flashing
// up separately and reordering themselves visibly.
let SyncShow: { id: number; readyToShow: boolean }[] = [];
function showApp() {
  SyncShow.forEach((x, i) => {
    const w = BrowserWindow.fromId(x.id);
    w?.show();
    if (i === SyncShow.length - 1) w?.focus();
  });
  SyncShow = [];
  if (!(C.isDevelopment && C.DevSplash === 2)) {
    setTimeout(() => {
      G.Window.close({ type: 'splash' });
    }, 1000);
  }
}
ipcMain.on('error-report', (_e: IpcMainEvent, message: string) => {
  throw Error(message);
});

ipcMain.on('did-finish-render', (event: IpcMainEvent) => {
  let callingWin = BrowserWindow.fromWebContents(event.sender);
  if (!callingWin) return;
  const windowRegistry = WindowRegistry[callingWin.id];
  if (!windowRegistry) {
    callingWin = null;
    return;
  }

  if (callingWin) {
    const syncShow = SyncShow.find((x) => x.id === callingWin?.id);
    if (process.env.START_MINIMIZED) {
      callingWin.minimize();
    } else if (!syncShow) {
      callingWin.show();
      callingWin.focus();
    } else {
      syncShow.readyToShow = true;
      if (SyncShow.every((x) => x.readyToShow)) {
        showApp();
        G.getSystemFonts(); // Just a good time to do this in the background...
      }
    }
    callingWin = null;
  }
});

ipcMain.handle('print-or-preview', MainPrintHandler);

ipcMain.on(
  'log',
  (_e: IpcMainEvent, type: LogLevel, windowID: string, json: string) => {
    log[type](windowID, ...JSON_parse(json));
  }
);

const openXulswordWindow = () => {
  const windowsDidClose = G.Prefs.getBoolPref(`global.WindowsDidClose`);
  const openOnStartup = G.Prefs.getComplexValue(
    'OpenOnStartup',
    'windows'
  ) as typeof S.windows.OpenOnStartup;
  G.Prefs.setBoolPref(`global.WindowsDidClose`, false);
  G.Prefs.deleteUserPref(`OpenOnStartup`, 'windows');
  G.Prefs.setComplexValue(`OpenWindows`, {}, 'windows');

  const xulswordWindow = BrowserWindow.fromId(
    G.Window.open({
      type: 'xulsword',
      className: 'skin',
      typePersistBounds: true,
      saveIfAppClosed: false, // main win doesn't use OpenOnStartup pref when starting
      options: {
        title: ProgramTitle,
        fullscreenable: true,
        ...C.UI.Window.large,
      },
    })
  );

  if (!xulswordWindow) {
    return null;
  }

  SyncShow.push({ id: xulswordWindow.id, readyToShow: false });

  const menuBuilder = new MainMenuBuilder(xulswordWindow);
  menuBuilder.buildMenu();

  validateGlobalModulePrefs();

  const BuildInfo = `${app.getName()} ${app.getVersion()} (${
    G.i18n.language
  }) ${process.platform}-${process.arch}, el:${process.versions.electron}, ch:${
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
      validateGlobalModulePrefs();
      menuBuilder.buildMenu(true);
    })
  );
  xswinSubscriptions.push(
    Subscription.subscribe.modulesInstalled(
      (newmods: NewModulesType, callingWinID?: number) => {
        if (callingWinID) {
          G.publishSubscription(
            'setRendererRootState',
            { renderers: { id: callingWinID } },
            { progress: 'indefinite' }
          );
        }
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
        newmods.modules.forEach((m) => {
          G.DiskCache.delete(null, m.module);
        });
        Subscription.publish.resetMain();
        newmods.nokeymods = getCipherFailConfs();
        newmods.modules = newmods.modules.filter(
          (nmconf) =>
            !newmods.nokeymods.some((nkconf) => nkconf.module === nmconf.module)
        );
        if (callingWinID) {
          // At this point, all windows' modules have been checked and updated to
          // reference only installed modules. We just need to add new tabs and
          // new modules to panels.
          if (callingWinID === xulswordWindow.id) {
            G.Prefs.mergeValue(
              'xulsword',
              Viewport.getModuleChange(
                newmods.modules.map((c) => c.module),
                G.Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword
              ),
              'prefs',
              false,
              true
            );
          } else {
            setTimeout(() => {
              publishSubscription(
                'modulesInstalled',
                { renderers: { id: callingWinID } },
                newmods
              );
            }, 1);
          }
          G.publishSubscription(
            'setRendererRootState',
            { renderers: { id: callingWinID } },
            { progress: -1 }
          );
        }
        G.Window.modal([{ modal: 'off', window: 'all' }]);
        // Wait until after reset before using Prefs, or renderers will throw.
        const nasi = G.Prefs.getComplexValue(
          'global.noAutoSearchIndex'
        ) as typeof S.prefs.global.noAutoSearchIndex;
        newmods.modules.forEach((m) => {
          if (nasi.includes(m.module)) {
            nasi.splice(nasi.indexOf(m.module), 1);
          }
        });
        G.Prefs.setComplexValue('global.noAutoSearchIndex', nasi);
        setTimeout(
          () => G.LibSword.startBackgroundSearchIndexer(),
          C.UI.Search.backgroundIndexerStartupWait
        );
      }
    )
  );

  // Prompt for CipherKeys when encrypted modules with no keys, or
  // incorrect keys, are installed.
  if (Object.keys(CipherKeyModules).length) {
    publishSubscription(
      'modulesInstalled',
      { renderers: { id: xulswordWindow.id } },
      {
        ...clone(C.NEWMODS),
        nokeymods: getCipherFailConfs(),
      }
    );
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

  xulswordWindow.on('ready-to-show', () =>
    setTimeout(
      () => G.LibSword.startBackgroundSearchIndexer(),
      C.UI.Search.backgroundIndexerStartupWait
    )
  );

  xulswordWindow.on('close', () => {
    // Persist open windows for the next restart
    const openWindows = G.Prefs.getComplexValue('OpenWindows', 'windows') as {
      [wn: string]: WindowDescriptorPrefType;
    };
    G.Prefs.setComplexValue(
      `OpenOnStartup`,
      keep(
        openWindows,
        Object.keys(openWindows).filter((k) => openWindows[k].saveIfAppClosed)
      ),
      'windows'
    );
    // Close all other open windows
    BrowserWindow.getAllWindows().forEach((w) => {
      if (w !== xulswordWindow) w.close();
    });
    xswinSubscriptions.forEach((dispose) => dispose());
    G.LibSword.quit();

    G.Prefs.setBoolPref(`global.WindowsDidClose`, true);

    Cache.clear();
  });

  xulswordWindow.on('closed', () => {
    log.verbose('xulsword window closed...');
  });

  if (windowsDidClose) {
    Object.values(openOnStartup).forEach((w) => {
      if ('type' in w) {
        const id = G.Window.open(w as WindowDescriptorType);
        SyncShow.push({ id, readyToShow: false });
      }
    });
    // After 20 seconds show all windows even if they're not ready yet.
    setTimeout(() => showApp(), 20000);
  }

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

  // If there are no tabs, choose a Bible and a location from the installed modules,
  // (preferring the locale language), and show that tab.
  const xulsword = G.Prefs.getComplexValue(
    'xulsword'
  ) as typeof S.prefs.xulsword;
  const { tabs } = xulsword;
  if (tabs.every((tb) => !tb || !tb.length)) {
    const modules = Viewport.sortTabsByLocale(G.Tabs.map((t) => t.module));
    if (modules[0]) {
      G.Viewport.getPanelChange(
        {
          whichModuleOrLocGB: modules,
          maintainWidePanels: true,
          maintainPins: false,
        },
        xulsword
      );
      G.Prefs.mergeValue('xulsword', xulsword);
    }
  }

  ProgramTitle = localizeString(G.i18n, 'i18n:program.title');

  if (G.Prefs.getBoolPref('global.InternetPermission')) {
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify({
      title: ProgramTitle,
      body: G.i18n.t('updater.message.body', { v1: '' }),
    });
  }

  log.catchErrors({
    showDialog: false,
    onError(error, versions, submitIssue) {
      if (
        !C.isDevelopment &&
        !error.message.includes('net::ERR_INTERNET_DISCONNECTED')
      ) {
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
            log.error(err);
          });
      }
    },
  });

  // These user Pref compatibility updates may eventually be removed once they are
  // no longer relevant.
  // - moduleManager.repositories.xulsword was moved from branding to defaultPrefs
  //   in 4.0.10-alpha.5
  if (
    (
      G.Prefs.getComplexValue(
        'moduleManager.repositories.xulsword'
      ) as typeof S.prefs.moduleManager.repositories.xulsword
    ).length === 0
  ) {
    log.info(`Applying pref update to: moduleManager.repositories.xulsword`);
    G.Prefs.setComplexValue(
      'moduleManager.repositories.xulsword',
      S.prefs.moduleManager.repositories.xulsword
    );
    const columns = G.Prefs.getComplexValue(
      'moduleManager.module.columns'
    ) as typeof S.prefs.moduleManager.module.columns;
    // eslint-disable-next-line prefer-destructuring
    columns[13] = S.prefs.moduleManager.module.columns[13];
    G.Prefs.setComplexValue('moduleManager.module.columns', columns);
  }
};

app.on('will-quit', () => {
  // Write all prefs to disk when app closes
  G.Prefs.writeAllStores();
  G.DiskCache.writeAllStores();
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
    return init();
  })
  .then(() => {
    if (
      !process.env.START_MINIMIZED &&
      !(C.isDevelopment && C.DevSplash === 1)
    ) {
      G.Window.open({
        type: 'splash',
        notResizable: true,
        options:
          C.isDevelopment && C.DevSplash === 2
            ? {
                title: ProgramTitle,
                width: 500,
                height: 400,
              }
            : {
                title: ProgramTitle,
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
