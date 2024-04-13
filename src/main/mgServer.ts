/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-use-before-define */
import i18next from 'i18next';
import { canRedo, canUndo } from './bookmarks.ts';
import { inlineAudioFile, inlineFile } from './components/localFile.ts';
import Dirs from './components/dirs.ts';
import DiskCache from './components/diskcache.ts';
import Prefs from './components/prefs.ts';
import LibSword from './components/libsword.ts';
import Data from './components/data.ts';
import Module from './components/module.ts';
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
} from './minit.ts';

import type { GType } from '../type.ts';

// This G object is for use on the nodejs server, and it shares
// the same interface as the renderer's G object. Properties of this
// object directly access server data and modules.
class GClass2 implements Omit<GType, 'Window' | 'clipboard' | 'Commands' | 'Shell' | 'Viewport' | 'resolveHtmlPath' | 'publishSubscription'> {
  i18n;

  LibSword;

  Prefs;

  DiskCache;

  Dirs;

  Data;

  Module;

  constructor() {
    this.i18n = i18next;
    this.LibSword = LibSword;
    this.Prefs = Prefs;
    this.DiskCache = DiskCache;
    this.Dirs = Dirs;
    this.Data = Data;
    this.Module = Module;
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

  canUndo(...args: Parameters<GType['canUndo']>): ReturnType<GType['canUndo']> {
    return canUndo(...args);
  }

  canRedo(...args: Parameters<GType['canRedo']>): ReturnType<GType['canRedo']> {
    return canRedo(...args);
  }
}

const G = new GClass2();

export default G;
