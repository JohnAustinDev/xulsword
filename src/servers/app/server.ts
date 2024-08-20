import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, crashReporter, dialog, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import i18n from 'i18next';
import i18nBackendMain from 'i18next-fs-backend';
import devToolsInstaller, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';
import { install as SourceMapInstall } from 'source-map-support';
import Subscription from '../../subscription.ts';
import Cache from '../../cache.ts';
import { clone, JSON_parse, keep, localizeString } from '../../common.ts';
import C from '../../constant.ts';
import S, { completePanelPrefDefaultArrays } from '../../defaultPrefs.ts';
import handleGlobal from '../handleG.ts';
import Dirs from '../components/dirs.ts';
import Data from '../components/data.ts';
import LibSword from '../components/libsword.ts';
import DiskCache from '../components/diskcache.ts';
import LocalFile from '../components/localFile.ts';
import Prefs from './prefs.ts';
import Viewport from './viewport.ts';
import Window from './components/window.ts';
import { validateGlobalModulePrefs } from './components/module.ts';
import {
  getCipherFailConfs,
  CipherKeyModules,
  getTabs,
  getSystemFonts,
} from '../common.ts';
import MainMenuBuilder, { pushPrefsToMenu } from './mainMenu.ts';
import contextMenu from './contextMenu.ts';
import {
  WindowRegistry,
  pushPrefsToWindows,
  publishSubscription,
} from './components/window.ts';
import { addBookmarkTransaction } from '../components/bookmarks.ts';

import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import type { LogLevel } from 'electron-log';
import type {
  GCallType,
  NewModulesType,
  WindowDescriptorPrefType,
  WindowDescriptorType,
} from '../../type.ts';
import type { ManagerStatePref } from '../../clients/app/moduleManager/manager.tsx';

Dirs.init();

completePanelPrefDefaultArrays(
  (Prefs.getComplexValue('xulsword.panels') as typeof S.prefs.xulsword.panels)
    .length,
);

const logfile = new LocalFile(
  path.join(Dirs.path.LogDir, `xulsword.${Date.now()}.log`),
);
if (logfile.exists()) logfile.remove();
Data.write(logfile.path, 'logfile');
// The renderer log contains any renderer window entries that occur before
// renderer.tsx, where their file is changed to the main/renderer log file.
const logfile2 = new LocalFile(path.join(Dirs.path.LogDir, 'renderer.log'));
if (logfile2.exists()) logfile2.remove();
log.transports.console.level = C.LogLevel;
log.transports.file.level = C.LogLevel;
log.transports.file.resolvePath = () => logfile.path;
log.info(`Starting ${app.getName()} isDevelopment='${Build.isDevelopment}'`);

addBookmarkTransaction(
  -1,
  'bookmarks',
  'rootfolder',
  Prefs.getComplexValue(
    'rootfolder',
    'bookmarks',
  ) as typeof S.bookmarks.rootfolder,
);

Cache.write(Prefs, 'PrefsElectron'); // for buried fontURL()
if (Prefs.getBoolPref('global.InternetPermission')) {
  const url = Prefs.getCharPref('global.crashReporterURL');
  if (url) {
    crashReporter.start({ submitURL: url });
  }
}

LibSword.init(
  Prefs.getComplexValue(
    'moduleManager.repositories',
  ) as ManagerStatePref['repositories'],
);

const modlist = LibSword.getModuleList();
const mods = modlist === C.NOMODULES ? [] : modlist.split('<nx>');
log.info(`Loaded ${mods.length} SWORD modules.`);
log.info(
  `LogLevel: ${C.LogLevel}, Logfile: ${logfile.path}, Port: ${process.env.WEBAPP_PORT}`,
);

let ProgramTitle = '';

const AvailableLanguages = [
  ...new Set(
    C.Locales.map((l) => {
      return l[0];
    })
      .map((l) => {
        return [l, l.replace(/-.*$/, '')];
      })
      .flat(),
  ),
];

// Program menu direction and Chromium locale must be set now,
// before the app 'ready' event is fired, which happens even before
// i18next or configs are initialized. Direction need not be forced
// for locales in Chromium's list, like fa, but must be for ky-Arab.
{
  const lang = Prefs.getCharPref('global.locale');
  if (lang) {
    if ((C.Locales.find((l) => l[0] === lang) || [])[2] === 'rtl') {
      app.commandLine.appendSwitch('force-ui-direction', 'rtl');
    }
    app.commandLine.appendSwitch('lang', lang.replace(/-.*$/, ''));
  }
}

const appSubscriptions: Array<() => void> = [];
appSubscriptions.push(Subscription.subscribe.windowCreated(contextMenu));

if (Build.isDevelopment) SourceMapInstall();

// Make all windows appear at the same time, rather than each flashing
// up separately and reordering themselves visibly.
let SyncShow: Array<{ id: number; readyToShow: boolean }> = [];
function showApp() {
  SyncShow.forEach((x, i) => {
    const w = BrowserWindow.fromId(x.id);
    w?.show();
    if (i === SyncShow.length - 1) w?.focus();
  });
  SyncShow = [];
  if (!(Build.isDevelopment && C.DevSplash === 2)) {
    setTimeout(() => {
      Window.close({ type: 'splash' });
    }, 1000);
  }
}

ipcMain.on('global', (event: IpcMainEvent, acall: GCallType) => {
  const win = BrowserWindow.fromWebContents(event.sender)?.id ?? -1;
  event.returnValue = handleGlobal(Cache.read('G'), win, acall, true);
});

ipcMain.handle('global', (event: IpcMainInvokeEvent, acall: GCallType) => {
  const win = BrowserWindow.fromWebContents(event.sender)?.id ?? -1;
  return handleGlobal(Cache.read('G'), win, acall, true);
});

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
    if (!syncShow) {
      callingWin.show();
      callingWin.focus();
    } else {
      syncShow.readyToShow = true;
      if (SyncShow.every((x) => x.readyToShow)) showApp();
    }
    callingWin = null;
  }
});

ipcMain.on(
  'log',
  (_e: IpcMainEvent, type: LogLevel, windowID: string, json: string) => {
    const unk = JSON_parse(json);
    if (unk && Array.isArray(unk)) {
      log[type](windowID, ...(unk as unknown[]));
    } else log[type](windowID, unk);
  },
);

const openXulswordWindow = () => {
  const windowsDidClose = Prefs.getBoolPref(`global.WindowsDidClose`);
  const openOnStartup = Prefs.getComplexValue(
    'OpenOnStartup',
    'windows',
  ) as typeof S.windows.OpenOnStartup;
  Prefs.setBoolPref(`global.WindowsDidClose`, false);
  Prefs.deleteUserPref(`OpenOnStartup`, 'windows');
  Prefs.setComplexValue(`OpenWindows`, {}, 'windows');

  const xulswordWindow = BrowserWindow.fromId(
    Window.open({
      type: 'xulswordWin',
      className: 'skin',
      typePersistBounds: true,
      saveIfAppClosed: false, // main win doesn't use OpenOnStartup pref when starting
      options: {
        title: ProgramTitle,
        fullscreenable: true,
        ...C.UI.Window.large,
      },
    }),
  );

  if (!xulswordWindow) {
    return null;
  }

  SyncShow.push({ id: xulswordWindow.id, readyToShow: false });

  const menuBuilder = new MainMenuBuilder(xulswordWindow);
  menuBuilder.buildMenu();

  validateGlobalModulePrefs(Window);

  const BuildInfo = `${app.getName()} ${app.getVersion()} (${
    i18n.language
  }) ${process.platform}-${process.arch}, el:${process.versions.electron}, ch:${
    process.versions.chrome
  }`;
  log.info(BuildInfo);
  Data.write(BuildInfo, 'buildInfo');

  const xswinSubscriptions: Array<() => void> = [];
  // addBookmarkTransaction must be before pushPrefsToMenu for undo/redo enable to work.
  xswinSubscriptions.push(
    Subscription.subscribe.prefsChanged(addBookmarkTransaction),
  );
  xswinSubscriptions.push(
    Subscription.subscribe.prefsChanged(pushPrefsToWindows),
  );
  xswinSubscriptions.push(Subscription.subscribe.prefsChanged(pushPrefsToMenu));
  xswinSubscriptions.push(
    Subscription.subscribe.resetMain(() => {
      LibSword.quit();
      Cache.clear();
      LibSword.init(
        Prefs.getComplexValue(
          'moduleManager.repositories',
        ) as ManagerStatePref['repositories'],
      );
      validateGlobalModulePrefs(Window);
      menuBuilder.buildMenu(true);
    }),
  );
  xswinSubscriptions.push(
    Subscription.subscribe.modulesInstalled(
      (newmods: NewModulesType, callingWinID?: number) => {
        if (callingWinID) {
          publishSubscription(
            'setRendererRootState',
            { renderers: { id: callingWinID } },
            { progress: 'indefinite' },
          );
        }
        const newErrors = newmods.reports.map((r) => r.error).filter(Boolean);
        const newWarns = newmods.reports.map((r) => r.warning).filter(Boolean);
        if (newErrors.length) {
          log.error(
            `${
              newmods.modules.length
            } Module(s) installed with problems:\n${newErrors.join('\n')}`,
          );
        } else if (newWarns.length) {
          log.warn(
            `${
              newmods.modules.length
            } Module(s) installed with warnings:\n${newWarns.join('\n')}`,
          );
        } else {
          log.info(
            `${
              newmods.modules.length + newmods.bookmarks.length
            } MODULE(S) SUCCESSFULLY INSTALLED!`,
          );
        }
        newmods.modules.forEach((m) => {
          DiskCache.delete(null, m.module);
        });
        Subscription.publish.resetMain();
        newmods.nokeymods = getCipherFailConfs();
        newmods.modules = newmods.modules.filter(
          (nmconf) =>
            !newmods.nokeymods.some(
              (nkconf) => nkconf.module === nmconf.module,
            ),
        );
        if (callingWinID) {
          // At this point, all windows' modules have been checked and updated to
          // reference only installed modules. We just need to add new tabs and
          // new modules to panels.
          if (callingWinID === xulswordWindow.id) {
            Prefs.mergeValue(
              'xulsword',
              Viewport.getModuleChange(
                newmods.modules.map((c) => c.module),
                Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword,
              ),
              'prefs',
              false,
              true,
            );
          } else {
            setTimeout(() => {
              publishSubscription(
                'modulesInstalled',
                { renderers: { id: callingWinID } },
                newmods,
              );
            }, 1);
          }
          publishSubscription(
            'setRendererRootState',
            { renderers: { id: callingWinID } },
            { progress: -1 },
          );
        }
        Window.modal([{ modal: 'off', window: 'all' }]);
        // Wait until after reset before using Prefs, or renderers will throw.
        const nasi = Prefs.getComplexValue(
          'global.noAutoSearchIndex',
        ) as typeof S.prefs.global.noAutoSearchIndex;
        newmods.modules.forEach((m) => {
          if (nasi.includes(m.module)) {
            nasi.splice(nasi.indexOf(m.module), 1);
          }
        });
        Prefs.setComplexValue('global.noAutoSearchIndex', nasi);
        setTimeout(() => {
          LibSword.startBackgroundSearchIndexer(Prefs).catch((er) => {
            log.error(er);
          });
        }, C.UI.Search.backgroundIndexerStartupWait);
      },
    ),
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
      },
    );
  }

  xulswordWindow.on('ready-to-show', () =>
    setTimeout(() => {
      LibSword.startBackgroundSearchIndexer(Prefs).catch((er) => {
        log.error(er);
      });
    }, C.UI.Search.backgroundIndexerStartupWait),
  );

  xulswordWindow.on('close', () => {
    // Persist open windows for the next restart
    const openWindows = Prefs.getComplexValue(
      'OpenWindows',
      'windows',
    ) as Record<string, WindowDescriptorPrefType>;
    Prefs.setComplexValue(
      `OpenOnStartup`,
      keep(
        openWindows,
        Object.keys(openWindows).filter((k) => openWindows[k].saveIfAppClosed),
      ),
      'windows',
    );
    // Close all other open windows
    BrowserWindow.getAllWindows().forEach((w) => {
      if (w !== xulswordWindow) w.close();
    });
    xswinSubscriptions.forEach((dispose) => {
      dispose();
    });
    LibSword.quit();

    Prefs.setBoolPref(`global.WindowsDidClose`, true);

    Cache.clear();
  });

  xulswordWindow.on('closed', () => {
    log.verbose('xulsword window closed...');
  });

  if (windowsDidClose) {
    Object.values(openOnStartup).forEach((w) => {
      if ('type' in w) {
        const id = Window.open(w as WindowDescriptorType);
        SyncShow.push({ id, readyToShow: false });
      }
    });
    // After 20 seconds show all windows even if they're not ready yet.
    setTimeout(() => {
      showApp();
    }, 20000);
  }

  return xulswordWindow;
};

const init = async () => {
  if (Build.isDevelopment) {
    (devToolsInstaller as any)(REACT_DEVELOPER_TOOLS)
      .then((name: string) => log.debug(`Added Extension:  ${name}`))
      .catch((er: any) => log.error(er));
  }

  let lng = Prefs.getCharPref('global.locale');
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
    Prefs.setCharPref('global.locale', lng);
    // Set the starting moduleManager language selection
    const codes = Prefs.getComplexValue(
      'moduleManager.language.selection',
    ) as ManagerStatePref['language']['selection'];
    if (!codes.length) {
      Prefs.setComplexValue('moduleManager.language.selection', [
        lng.replace(/-.*$/, ''),
      ]);
    }
  }

  await i18n
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
        loadPath: `${Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.json`,
        // path to post missing resources
        addPath: `${Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.missing.json`,
        // jsonIndent to use when storing json files
        jsonIndent: 2,
      },
      saveMissing: Build.isDevelopment,
      saveMissingTo: 'current',

      react: {
        useSuspense: false,
      },

      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },

      keySeparator: false,
    })
    .catch((e) => {
      log.error(e);
    });

  // If there are no tabs, choose a Bible and a location from the installed modules,
  // (preferring the locale language), and show that tab.
  const xulsword = Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword;
  const { tabs } = xulsword;
  if (tabs.every((tb) => !tb?.length)) {
    const modules = Viewport.sortTabsByLocale(getTabs().map((t) => t.module));
    if (modules[0]) {
      Viewport.getPanelChange(
        {
          whichModuleOrLocGB: modules,
          maintainWidePanels: true,
          maintainPins: false,
        },
        xulsword,
      );
      Prefs.mergeValue('xulsword', xulsword);
    }
  }

  ProgramTitle = localizeString(i18n, 'i18n:program.title');

  if (Prefs.getBoolPref('global.InternetPermission')) {
    autoUpdater.logger = log;
    autoUpdater
      .checkForUpdatesAndNotify({
        title: ProgramTitle,
        body: i18n.t('updater.message.body', { v1: '' }),
      })
      .catch((er) => {
        log.error(er);
      });
  }

  // Do this in the background...
  getSystemFonts().catch((er) => {
    log.error(er);
  });

  log.catchErrors({
    showDialog: false,
    onError(error, versions, submitIssue) {
      if (!Build.isDevelopment && !error.message.includes('net::ERR')) {
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
                },
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
      Prefs.getComplexValue(
        'moduleManager.repositories.xulsword',
      ) as typeof S.prefs.moduleManager.repositories.xulsword
    ).length === 0
  ) {
    log.info(`Applying pref update to: moduleManager.repositories.xulsword`);
    Prefs.setComplexValue(
      'moduleManager.repositories.xulsword',
      S.prefs.moduleManager.repositories.xulsword,
    );
  }
  // - moduleManager.module.columns[13] heading changed in 4.0.10-alpha.5
  const columns = Prefs.getComplexValue(
    'moduleManager.module.columns',
  ) as typeof S.prefs.moduleManager.module.columns;
  if (columns[13].heading.startsWith('icon:')) {
    log.info(`Applying pref update to: moduleManager.module.columns[13]`);
    // eslint-disable-next-line prefer-destructuring
    columns[13] = S.prefs.moduleManager.module.columns[13];
    Prefs.setComplexValue('moduleManager.module.columns', columns);
  }
};

app.on('will-quit', () => {
  // Write all prefs to disk when app closes
  Prefs.writeAllStores();
  DiskCache.writeAllStores();
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    appSubscriptions.forEach((dispose) => {
      dispose();
    });
    log.info(`Exiting...`);
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (!WindowRegistry.some((wd) => wd && wd.type === 'xulswordWin'))
    openXulswordWindow();
});

app
  .whenReady()
  .then(async () => {
    await init();
  })
  .then(() => {
    if (!(Build.isDevelopment && C.DevSplash === 1)) {
      Window.open({
        type: 'splash',
        notResizable: true,
        options:
          Build.isDevelopment && C.DevSplash === 2
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
