/* eslint-disable class-methods-use-this */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  BrowserWindow,
  ipcMain,
  IpcMainEvent,
  IpcMainInvokeEvent,
  shell,
} from 'electron';
import { inlineFile } from './components/nsILocalFile';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';
import LibSword from './modules/libsword';
import Commands from './commands';
import Data from './modules/data';
import {
  getProgramConfig,
  getLocaleConfigs,
  getModuleConfigs,
  getModuleConfigDefault,
  getFontFaceConfigs,
  getFeatureModules,
} from './config';
import Window, { resolveHtmlPath, resetMain } from './window';
import {
  getBooks,
  getBook,
  getTabs,
  getTab,
  getBooksInModule,
  getBkChsInV11n,
  getSystemFonts,
} from './minit';

import { GPublic, GType } from '../type';

// Methods of the following classes should not use rest parameters or default
// values in their argument lists. This is because Function.length is used to
// append the calling window, and it does not include rest parameter or default
// arguments, so they would result in exceptions being thrown.
const appendCallingWindow = ['Prefs', 'Window'];

// Handle global variable calls from renderer processes
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
      ret = g[name](...args);
    } else if (typeof gPublic[name] === 'object') {
      const m = args.shift();
      if (gPublic[name][m] === 'getter') {
        ret = g[name][m];
      } else if (typeof gPublic[name][m] === 'function') {
        if (
          appendCallingWindow.includes(name) &&
          typeof args[g[name][m].length] === 'undefined'
        )
          args[g[name][m].length] = win;
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

// This G object is for use in the main process, and it shares the same
// GPublic interface as the renderer's G object. Properties of this
// object may directly access main process data and modules.
class GClass implements GType {
  LibSword;

  Prefs;

  Dirs;

  Commands;

  Shell;

  Data;

  Window;

  constructor() {
    this.LibSword = LibSword;
    this.Prefs = Prefs;
    this.Dirs = Dirs;
    this.Commands = Commands;
    this.Shell = shell;
    this.Data = Data;
    this.Window = Window;
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

  get LocaleConfigs() {
    return getLocaleConfigs();
  }

  get ModuleConfigs() {
    return getModuleConfigs();
  }

  get ModuleConfigDefault() {
    return getModuleConfigDefault();
  }

  get ProgramConfig() {
    return getProgramConfig();
  }

  get FontFaceConfigs() {
    return getFontFaceConfigs();
  }

  get FeatureModules() {
    return getFeatureModules();
  }

  get BooksInModule() {
    return getBooksInModule();
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
}

const G = new GClass();

export default G;
