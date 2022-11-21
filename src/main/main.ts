/* eslint-disable @typescript-eslint/no-explicit-any */

import 'core-js/stable';
import 'regenerator-runtime/runtime';
import {
  app,
  dialog,
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
  SaveDialogOptions,
  IpcMainInvokeEvent,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import log from 'electron-log';
import i18n from 'i18next';
import Subscription from '../subscription';
import Cache from '../cache';
import { clone, randomID } from '../common';
import C from '../constant';
import G from './mg';
import LibSword from './components/libsword';
import LocalFile from './components/localFile';
import { CipherKeyModules } from './components/module';
import MenuBuilder, { pushPrefsToMenu } from './menu';
import Window, {
  WindowRegistry,
  pushPrefsToWindows,
  publishSubscription,
} from './components/window';
import contextMenu from './contextMenu';
import { getCipherFailConfs, getTabs, updateGlobalModulePrefs } from './minit';
import setViewportTabs from './tabs';

import type { NewModulesType, WindowRegistryType } from '../type';

const i18nBackendMain = require('i18next-fs-backend');
const installer = require('electron-devtools-installer');
const sourceMapSupport = require('source-map-support');
const electronDebug = require('electron-debug');

// Init the logfile. This must also be done in rinit.tsx for renderer processes.
{
  const logfile = new LocalFile(
    path.join(G.Dirs.path.ProfD, 'logs', 'xulsword.log')
  );
  if (logfile.exists()) logfile.remove();
  // The renderer log contains any renderer window entries that occur before
  // rinit.tsx, where their file is changed to the main/renderer log file.
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

const printPreviewTmps: LocalFile[] = [];
const printPreviewHandler = async (
  event: IpcMainInvokeEvent,
  options: Electron.PrintToPDFOptions | Electron.WebContentsPrintOptions,
  pdf?: string
): Promise<boolean> => {
  if (event.sender) {
    if (pdf && pdf === 'printToPDF') {
      // Print to a user selected PDF file and return window to normal
      const opts = options as Electron.PrintToPDFOptions;
      const saveops: SaveDialogOptions = {
        title: i18n.t('printCmd.label'),
        filters: [
          {
            name: 'PDF',
            extensions: ['pdf'],
          },
        ],
        properties: ['createDirectory'],
      };
      let wtp = BrowserWindow.fromWebContents(event.sender);
      const result = await ((wtp && dialog.showSaveDialog(wtp, saveops)) ||
        null);
      wtp = null;
      if (result && !result.canceled && result.filePath) {
        const data = await event.sender.printToPDF(opts);
        if (data) {
          const outfile = new LocalFile(result.filePath);
          outfile.writeFile(data);
          event.sender.send('print-preview');
          return true;
        }
      }
    } else if (pdf) {
      // Print to temporary PDF file and display it in the preview iframe
      const opts = options as Electron.PrintToPDFOptions;
      printPreviewTmps.forEach((f) => {
        if (f.exists()) f.remove();
      });
      const tmp = new LocalFile(pdf);
      if (tmp.exists() && tmp.isDirectory()) {
        tmp.append(`${randomID()}.pdf`);
        const data = await event.sender.printToPDF(opts);
        if (data) {
          tmp.writeFile(data);
          printPreviewTmps.push(tmp);
          event.sender.send('print-preview', 'off', tmp.path);
          return true;
        }
      }
    } else if (options) {
      // Send to printer and return window to normal
      const opts = options as Electron.WebContentsPrintOptions;
      return new Promise((resolve) => {
        event.sender.print(opts, (suceeded: boolean, failureReason: string) => {
          if (!suceeded) {
            log.error(failureReason);
          }
          event.sender.send('print-preview');
          resolve(suceeded);
        });
      });
    } else {
      // Return window to normal
      printPreviewTmps.forEach((f) => {
        if (f.exists()) f.remove();
      });
      event.sender.send('print-preview');
    }
  }
  return false; // failed
};

ipcMain.handle('print-preview', printPreviewHandler);

const openMainWindow = () => {
  let options: Electron.BrowserWindowConstructorOptions = {
    title: i18n.t('programTitle'),
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

  const menuBuilder = new MenuBuilder(mainWin, i18n);
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
      LibSword.quit();
      Cache.clear();
      LibSword.init();
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
        Window.modal([{ modal: 'off', window: 'all' }]);
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
