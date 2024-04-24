/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-use-before-define */
import i18next from 'i18next';
import LibSword from './components/libsword.ts';
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

import type { GType } from '../type.ts';

// This G object is for use on the nodejs server, and it shares
// the same interface as the renderer's G object. Properties of this
// object directly access server data and modules.
class GAClass implements Partial<GType> {
  gtype;

  // TODO!: Great care must be taken to insure public usage of these
  // functions is safe and secure!!
  i18n;

  LibSword;

  constructor() {
    this.gtype = 'async' as any;
    this.i18n = i18next;
    this.LibSword = LibSword;
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

  get GetBooksInVKModules() {
    return GetBooksInVKModules();
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

  getLocalizedBooks(
    ...args: Parameters<GType['getLocalizedBooks']>
  ): ReturnType<GType['getLocalizedBooks']>{
    return getLocalizedBooks(...args);
  }

  getLocaleDigits(
    ...args: Parameters<GType['getLocaleDigits']>
  ): ReturnType<GType['getLocaleDigits']> {
    return getLocaleDigits(...args);
  }

  cachePreload(
    ...args: Parameters<GType['cachePreload']>
  ): ReturnType<GType['cachePreload']> {
    return cachePreload(G as any, ...args);
  }
}

const G = new GAClass();

export default G;
