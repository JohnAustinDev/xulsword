/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-use-before-define */
import i18next from 'i18next';
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
  getAudioConfs,
  getLocaleConfigs,
  getModuleConfigDefault,
  getModuleFonts,
  getFeatureModules,
  localeConfig,
  getConfig,
  cachePreload,
} from './minit.ts';

import type { GAType, GType } from '../type.ts';

// This G object is for use on the nodejs server, and it shares
// the same interface as the renderer's G object. Properties of this
// object directly access server data and modules.
class GClass2 implements Partial<GType> {

  // TODO!: Great care must be taken to insure public usage of these
  // functions is safe and secure!!
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

  cachePreload(
    ...args: Parameters<GType['cachePreload']>
  ): ReturnType<GType['cachePreload']> {
    return cachePreload(G as GType, ...args);
  }
}

const G = new GClass2();

export default G;
