/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-use-before-define */
import i18next from 'i18next';
import LibSword from './components/libsword.ts';
import Viewport from './components/viewport.ts';
import { getExtRefHTML, locationVKText } from './versetext.ts';
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
  GetBooksInVKModules,
  getLocalizedBooks,
  getLocaleDigits,
  getAllDictionaryKeyList,
  genBookTreeNodes,
  inlineFile,
  inlineAudioFile,
} from './minit.ts';
import { callBatch } from './handleGlobal.ts';

import type { GITypeMain, GType } from '../type.ts';

// Methods of GI are the same as G but without those that are Electron
// only or not used by the server (such as Prefs).
// This G object is for use on the nodejs server, and it shares
// the same interface as the renderer's G object. Properties of this
// object directly access server data and modules.
class GIClass implements GITypeMain {
  // TODO!: Great care must be taken to insure public usage of these
  // functions is safe and secure!!
  i18n;

  LibSword;

  Viewport;

  constructor() {
    this.i18n = i18next;
    this.LibSword = LibSword;
    this.Viewport = Viewport;
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

  Books(...args: Parameters<GType['Books']>): ReturnType<GType['Books']> {
    return getBooks(...args);
  }

  Book(...args: Parameters<GType['Book']>): ReturnType<GType['Book']> {
    return getBook(...args);
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

  async getSystemFonts(
    ...args: Parameters<GType['getSystemFonts']>
  ): ReturnType<GType['getSystemFonts']> {
    return await getSystemFonts(...args);
  }

  getBooksInVKModule(
    ...args: Parameters<GType['getBooksInVKModule']>
  ): ReturnType<GType['getBooksInVKModule']> {
    return getBooksInVKModule(...args);
  }

  getLocalizedBooks(
    ...args: Parameters<GType['getLocalizedBooks']>
  ): ReturnType<GType['getLocalizedBooks']> {
    return getLocalizedBooks(...args);
  }

  getLocaleDigits(
    ...args: Parameters<GType['getLocaleDigits']>
  ): ReturnType<GType['getLocaleDigits']> {
    return getLocaleDigits(...args);
  }

  async callBatch(
    ...args: Parameters<GType['callBatch']>
  ): ReturnType<GType['callBatch']> {
    return callBatch(GI, ...args);
  }

  callBatchSync(
    ...args: Parameters<GType['callBatchSync']>
  ): ReturnType<GType['callBatchSync']> {
    return callBatch(GI, ...args);
  }

  getAllDictionaryKeyList(
    ...args: Parameters<GType['getAllDictionaryKeyList']>
  ): ReturnType<GType['getAllDictionaryKeyList']> {
    return getAllDictionaryKeyList(...args);
  }

  genBookTreeNodes(
    ...args: Parameters<GType['genBookTreeNodes']>
  ): ReturnType<GType['genBookTreeNodes']> {
    return genBookTreeNodes(...args);
  }

  getExtRefHTML(
    ...args: Parameters<GType['getExtRefHTML']>
  ): ReturnType<GType['getExtRefHTML']> {
    return getExtRefHTML(...args);
  }

  locationVKText(
    ...args: Parameters<GType['locationVKText']>
  ): ReturnType<GType['locationVKText']> {
    return locationVKText(...args);
  }
}

const GI = new GIClass();

export default GI;
