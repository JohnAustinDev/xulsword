/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { BrowserWindow, shell } from 'electron';
import i18next from 'i18next';
import { DataPublic, GPublic, ShellPublic } from '../type';
import { inlineFile } from './components/nsILocalFile';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';
import LibSword from './modules/libsword';
import Commands from './commands';
import Data from './modules/data';
import Cache from './modules/cache';
import {
  getProgramConfig,
  getLocaleConfigs,
  getModuleConfigs,
  getModuleConfigDefault,
  getFontFaceConfigs,
  getFeatureModules,
} from './config';
import { openDialog, openWindow, resolveHtmlPath } from './window';
import {
  setGlobalStateFromPref,
  getBooks,
  getBook,
  getTabs,
  getTab,
  getAvailableBooks,
  setGlobalMenuFromPref,
} from './init';

import type { GType } from '../type';

// This G object is for use in the main process, and it shares the same
// interface as the renderer's G object. Properties of this object
// directly access data and main process modules. The output of
// get<function>s are cached until G.reset().

const G: Pick<GType, 'reset' | 'cache'> & GPrivateMain = {
  cache: {},

  // Permanently store references to be used by G
  refs: {
    Books: () => getBooks(),
    Book: () => getBook(),
    Tabs: () => getTabs(),
    Tab: () => getTab(),
    LocaleConfigs: () => getLocaleConfigs(),
    ModuleConfigs: () => getModuleConfigs(),
    ModuleConfigDefault: () => getModuleConfigDefault(),
    ProgramConfig: () => getProgramConfig(),
    FontFaceConfigs: () => getFontFaceConfigs(),
    FeatureModules: () => getFeatureModules(),
    AvailableBooks: () => getAvailableBooks(),

    OPSYS: () => process.platform,

    setGlobalMenuFromPref: (menu?: Electron.Menu) =>
      setGlobalMenuFromPref(menu),

    resolveHtmlPath: (s: string) => {
      return resolveHtmlPath(s);
    },

    inlineFile: (
      fpath: string,
      encoding = 'base64' as BufferEncoding
    ): string => {
      return inlineFile(fpath, encoding);
    },

    globalReset: () => {
      G.reset();
      Cache.clear();
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send('perform-resets');
      });
    },

    setGlobalStateFromPref: (
      win: BrowserWindow | null,
      prefs?: string | string[]
    ) => setGlobalStateFromPref(win, prefs),

    openDialog: (
      type: string,
      options: Electron.BrowserWindowConstructorOptions
    ): number => {
      return openDialog(type, options);
    },

    openWindow: (
      type: string,
      options: Electron.BrowserWindowConstructorOptions
    ): number => {
      return openWindow(type, options);
    },

    LibSword: LibSword as typeof LibSword,
    Prefs: Prefs as typeof Prefs,
    Dirs: Dirs as typeof Dirs,
    Commands: Commands as typeof Commands,
    Shell: shell as typeof ShellPublic,
    Data: Data as typeof DataPublic,
  },

  reset() {
    this.cache = {};
  },
};
G.refs.globalReset = G.refs.globalReset.bind(G);

// Add methods to the G object
const entries = Object.entries(GPublic);
entries.forEach((entry) => {
  const [name, val] = entry;
  if (val === 'readonly') {
    Object.defineProperty(G, name, {
      get() {
        const fn = this.refs[name];
        if (typeof fn === 'function') {
          return fn();
        }
        throw Error(`function ${name} has not been defined`);
      },
    });
  } else if (typeof val === 'function') {
    const g = G as any;
    g[name] = g.refs[name];
  } else if (typeof val === 'object') {
    Object.defineProperty(G, name, {
      get() {
        const obj = this.refs[name];
        if (obj === null) throw Error(`object ${name} is not available`);
        return obj;
      },
    });
  } else {
    throw Error(`unhandled GPublic entry value ${val}`);
  }
});

type GPrivateMain = {
  refs: { [key in keyof typeof GPublic]: any };
};

i18next.on('languageChanged', () => G.reset());

export default G as unknown as GType;
