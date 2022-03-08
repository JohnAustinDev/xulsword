/* eslint-disable class-methods-use-this */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { shell } from 'electron';
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
import { openDialog, openWindow, resolveHtmlPath } from './window';
import {
  setGlobalStateFromPref,
  getBooks,
  getBook,
  getTabs,
  getTab,
  getBooksInModule,
  getBkChsInV11n,
  setGlobalMenuFromPref,
  globalReset,
  getSystemFonts,
} from './minit';

import type { GType } from '../type';

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

  constructor() {
    this.LibSword = LibSword;
    this.Prefs = Prefs;
    this.Dirs = Dirs;
    this.Commands = Commands;
    this.Shell = shell;
    this.Data = Data;
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

  setGlobalMenuFromPref(
    ...args: Parameters<GType['setGlobalMenuFromPref']>
  ): ReturnType<GType['setGlobalMenuFromPref']> {
    return setGlobalMenuFromPref(...args);
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

  globalReset(
    ...args: Parameters<GType['globalReset']>
  ): ReturnType<GType['globalReset']> {
    return globalReset(...args);
  }

  setGlobalStateFromPref(
    ...args: Parameters<GType['setGlobalStateFromPref']>
  ): ReturnType<GType['setGlobalStateFromPref']> {
    return setGlobalStateFromPref(...args);
  }

  openDialog(
    ...args: Parameters<GType['openDialog']>
  ): ReturnType<GType['openDialog']> {
    return openDialog(...args);
  }

  openWindow(
    ...args: Parameters<GType['openWindow']>
  ): ReturnType<GType['openWindow']> {
    return openWindow(...args);
  }

  getSystemFonts(
    ...args: Parameters<GType['getSystemFonts']>
  ): ReturnType<GType['getSystemFonts']> {
    return getSystemFonts(...args);
  }
}

const G = new GClass();

export default G;
