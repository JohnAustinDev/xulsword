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
  GetBooksInVKModules,
  getLocalizedBooks,
  getLocaleDigits,
} from './minit.ts';

import type { GAType, GType } from '../type.ts';

// This G object is for use on the nodejs server, and it shares
// the same interface as the renderer's G object. Properties of this
// object directly access server data and modules.
class GAClass implements GAType {
  gtype;

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
    this.gtype = 'async' as 'async';
    this.i18n = i18next;
    this.LibSword = LibSword;
    this.Prefs = Prefs;
    this.DiskCache = DiskCache;
    this.Dirs = Dirs;
    this.Data = Data;
    this.Module = Module;
  }

  get Books() {
    return getBooks() as any;
  }

  get Book() {
    return getBook() as any;
  }

  get Tabs() {
    return getTabs() as any;
  }

  get Tab() {
    return getTab() as any;
  }

  get Config() {
    return getConfig() as any;
  }

  get AudioConfs() {
    return getAudioConfs() as any;
  }

  get LocaleConfigs() {
    return getLocaleConfigs() as any;
  }

  get ModuleConfigDefault() {
    return getModuleConfigDefault() as any;
  }

  get ProgramConfig() {
    return localeConfig(i18next.language) as any;
  }

  get ModuleFonts() {
    return getModuleFonts() as any;
  }

  get FeatureModules() {
    return getFeatureModules() as any;
  }

  get BkChsInV11n() {
    return getBkChsInV11n() as any;
  }

  get GetBooksInVKModules() {
    return GetBooksInVKModules() as any;
  }

  getSystemFonts(
    ...args: Parameters<GType['getSystemFonts']>
  ): Promise<ReturnType<GType['getSystemFonts']>> {
    return getSystemFonts(...args) as any;
  }

  getBooksInVKModule(
    ...args: Parameters<GType['getBooksInVKModule']>
  ): Promise<ReturnType<GType['getBooksInVKModule']>> {
    return getBooksInVKModule(...args) as any;
  }

  getLocalizedBooks(
    ...args: Parameters<GType['getLocalizedBooks']>
  ): Promise<ReturnType<GType['getLocalizedBooks']>> {
    return getLocalizedBooks(...args) as any;
  }

  getLocaleDigits(
    ...args: Parameters<GType['getLocaleDigits']>
  ): Promise<ReturnType<GType['getLocaleDigits']>> {
    return getLocaleDigits(...args) as any;
  }

  cachePreload(
    ...args: Parameters<GType['cachePreload']>
  ): Promise<ReturnType<GType['cachePreload']>> {
    return cachePreload(G as any, ...args) as any;
  }
}

const G = new GAClass();

export default G;
