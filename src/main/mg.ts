/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  clipboard,
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
  IpcMainInvokeEvent,
  shell,
} from 'electron';
import i18next from 'i18next';
import { GBuilder, WindowDescriptorType } from '../type';
import { canRedo, canUndo } from './bookmarks';
import Viewport from './components/viewport';
import { inlineAudioFile, inlineFile } from './components/localFile';
import Dirs from './components/dirs';
import DiskCache from './components/diskcache';
import Prefs from './components/prefs';
import LibSword from './components/libsword';
import Data from './components/data';
import Window, {
  publishSubscription,
  resolveHtmlPath,
} from './components/window';
import Module from './components/module';
import Commands from './components/commands';
import {
  getBooks,
  getBook,
  getTabs,
  getTab,
  getBooksInVKModule,
  getBkChsInV11n,
  getSystemFonts,
  resetMain,
  getAudioConfs,
  getLocaleConfigs,
  getModuleConfigDefault,
  getModuleFonts,
  getFeatureModules,
  localeConfig,
  getConfig,
} from './minit';

import type { GType } from '../type';
import type { SubscriptionType } from '../subscription';

// Handle global variable calls from renderer processes
function handleGlobal(
  event: IpcMainEvent | IpcMainInvokeEvent,
  name: keyof GType,
  ...args: any[]
) {
  let ret = null;
  const { includeCallingWindow } = GBuilder;
  const win = BrowserWindow.fromWebContents(event.sender)?.id ?? -1;
  if (name in GBuilder) {
    const gBuilder = GBuilder as any;
    const g = G as any;
    if (gBuilder[name] === 'getter') {
      ret = g[name];
    } else if (typeof gBuilder[name] === 'function') {
      ret = g[name](...args);
    } else if (typeof gBuilder[name] === 'object') {
      const m = args.shift();
      if (gBuilder[name][m] === 'getter') {
        ret = g[name][m];
      } else if (typeof gBuilder[name][m] === 'function') {
        if (
          includeCallingWindow.includes(
            name as typeof includeCallingWindow[number]
          ) &&
          typeof args[g[name][m].length] === 'undefined'
        ) {
          args[g[name][m].length] = win;
        }
        ret = g[name][m](...args);
      } else {
        throw Error(`Unhandled method type for ${name}.${m}`);
      }
    } else {
      throw Error(`Unhandled global ${name} ipc type: ${gBuilder[name]}`);
    }
  } else {
    throw Error(`Unhandled global ipc request: ${name}`);
  }

  return ret;
}
ipcMain.on(
  'global',
  (event: IpcMainEvent, name: keyof GType, ...args: any[]) => {
    event.returnValue = handleGlobal(event, name, ...args);
  }
);
ipcMain.handle(
  'global',
  (event: IpcMainInvokeEvent, name: keyof GType, ...args: any[]) => {
    return handleGlobal(event, name, ...args);
  }
);

// This G object is for use in the main process, and it shares the
// same interface as the renderer's G object. Properties of this
// object directly access main process data and modules.
class GClass implements GType {
  i18n;

  clipboard;

  LibSword;

  Prefs;

  DiskCache;

  Dirs;

  Commands;

  Shell;

  Data;

  Window;

  Module;

  Viewport;

  constructor() {
    this.i18n = i18next;
    this.clipboard = clipboard;
    this.LibSword = LibSword;
    this.Prefs = Prefs;
    this.DiskCache = DiskCache;
    this.Dirs = Dirs;
    this.Commands = Commands;
    this.Shell = shell;
    this.Data = Data;
    this.Window = Window;
    this.Module = Module;
    this.Viewport = Viewport;
  }

  get Books() {
    return getBooks();
  }

  get Book() {
    return getBook();
  }

  get Tabs() {
    return getTabs();
  }

  get Tab() {
    return getTab();
  }

  get Config() {
    return getConfig();
  }

  get AudioConfs() {
    return getAudioConfs();
  }

  get LocaleConfigs() {
    return getLocaleConfigs();
  }

  get ModuleConfigDefault() {
    return getModuleConfigDefault();
  }

  get ProgramConfig() {
    return localeConfig(i18next.language);
  }

  get ModuleFonts() {
    return getModuleFonts();
  }

  get FeatureModules() {
    return getFeatureModules();
  }

  get BkChsInV11n() {
    return getBkChsInV11n();
  }

  get OPSYS() {
    return process.platform;
  }

  resolveHtmlPath(
    ...args: Parameters<GType['resolveHtmlPath']>
  ): ReturnType<GType['resolveHtmlPath']> {
    return resolveHtmlPath(...args);
  }

  inlineFile(
    ...args: Parameters<GType['inlineFile']>
  ): ReturnType<GType['inlineFile']> {
    return inlineFile(...args);
  }

  inlineAudioFile(
    ...args: Parameters<GType['inlineAudioFile']>
  ): ReturnType<GType['inlineAudioFile']> {
    return inlineAudioFile(...args);
  }

  resetMain(
    ...args: Parameters<GType['resetMain']>
  ): ReturnType<GType['resetMain']> {
    return resetMain(...args);
  }

  getSystemFonts(
    ...args: Parameters<GType['getSystemFonts']>
  ): ReturnType<GType['getSystemFonts']> {
    return getSystemFonts(...args);
  }

  getBooksInVKModule(
    ...args: Parameters<GType['getBooksInVKModule']>
  ): ReturnType<GType['getBooksInVKModule']> {
    return getBooksInVKModule(...args);
  }

  publishSubscription<S extends keyof SubscriptionType['publish']>(
    s: S,
    ops: {
      renderers?:
        | Partial<WindowDescriptorType>
        | Partial<WindowDescriptorType>[];
      main?: boolean;
    },
    ...args: Parameters<SubscriptionType['publish'][S]>
  ) {
    return publishSubscription(s, ops, ...args);
  }

  canUndo(...args: Parameters<GType['canUndo']>): ReturnType<GType['canUndo']> {
    return canUndo(...args);
  }

  canRedo(...args: Parameters<GType['canRedo']>): ReturnType<GType['canRedo']> {
    return canRedo(...args);
  }
}

const G = new GClass();

export default G;
