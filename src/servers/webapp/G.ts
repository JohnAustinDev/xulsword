import i18next from 'i18next';
import { locationVKText } from '../versetext.ts';
import LibSword from '../components/libsword.ts';
import Cache from '../../cache.ts';
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
  getLanguageName,
  getAudioConf,
  getModuleConf,
  getModuleConfs,
} from '../common.ts';
import { callBatch } from '../handleG.ts';

import type { GITypeMain, GType } from '../../type.ts';

if (Build.isElectronApp)
  throw new Error(`This module should not be used with Electron.`);

// Methods of GI are the same as G but without those that are Electron
// only or are not allowed by the web app server (such as Prefs). Properties
// of this object directly access server data and modules.

// FOR MORE EXPLANATION SEE: ./src/clients/G.ts
export const GI: GITypeMain = {
  // IMPORTANT: Care must be taken to insure public usage of these
  // functions is safe and secure!
  i18n: i18next,

  LibSword,

  get Tabs() {
    return getTabs();
  },

  get Tab() {
    return getTab();
  },

  get Config() {
    return getConfig();
  },

  get ModuleConfs() {
    return getModuleConfs();
  },

  get AudioConfs() {
    return getAudioConfs();
  },

  get LocaleConfigs() {
    return getLocaleConfigs();
  },

  get ModuleConfigDefault() {
    return getModuleConfigDefault();
  },

  get ProgramConfig() {
    return localeConfig(i18next.language);
  },

  get ModuleFonts() {
    return getModuleFonts();
  },

  get FeatureModules() {
    return getFeatureModules();
  },

  get GetBooksInVKModules() {
    return GetBooksInVKModules();
  },

  Books(...args: Parameters<GType['Books']>): ReturnType<GType['Books']> {
    return getBooks(...args);
  },

  Book(...args: Parameters<GType['Book']>): ReturnType<GType['Book']> {
    return getBook(...args);
  },

  inlineFile(
    ...args: Parameters<GType['inlineFile']>
  ): ReturnType<GType['inlineFile']> {
    return inlineFile(...args);
  },

  inlineAudioFile(
    ...args: Parameters<GType['inlineAudioFile']>
  ): ReturnType<GType['inlineAudioFile']> {
    return inlineAudioFile(...args);
  },

  getModuleConf(
    ...args: Parameters<GType['getModuleConf']>
  ): ReturnType<GType['getModuleConf']> {
    return getModuleConf(...args);
  },

  getAudioConf(
    ...args: Parameters<GType['getAudioConf']>
  ): ReturnType<GType['getAudioConf']> {
    return getAudioConf(...args);
  },

  async getSystemFonts(
    ...args: Parameters<GType['getSystemFonts']>
  ): ReturnType<GType['getSystemFonts']> {
    return await getSystemFonts(...args);
  },

  getBooksInVKModule(
    ...args: Parameters<GType['getBooksInVKModule']>
  ): ReturnType<GType['getBooksInVKModule']> {
    return getBooksInVKModule(...args);
  },

  getBkChsInV11n(
    ...args: Parameters<GType['getBkChsInV11n']>
  ): ReturnType<GType['getBkChsInV11n']> {
    return getBkChsInV11n(...args);
  },

  getLocalizedBooks(
    ...args: Parameters<GType['getLocalizedBooks']>
  ): ReturnType<GType['getLocalizedBooks']> {
    return getLocalizedBooks(...args);
  },

  getLocaleDigits(
    ...args: Parameters<GType['getLocaleDigits']>
  ): ReturnType<GType['getLocaleDigits']> {
    return getLocaleDigits(...args);
  },

  async callBatch(
    ...args: Parameters<GType['callBatch']>
  ): ReturnType<GType['callBatch']> {
    return callBatch(GI, ...args);
  },

  callBatchSync(
    ...args: Parameters<GType['callBatchSync']>
  ): ReturnType<GType['callBatchSync']> {
    return callBatch(GI, ...args);
  },

  getAllDictionaryKeyList(
    ...args: Parameters<GType['getAllDictionaryKeyList']>
  ): ReturnType<GType['getAllDictionaryKeyList']> {
    return getAllDictionaryKeyList(...args);
  },

  genBookTreeNodes(
    ...args: Parameters<GType['genBookTreeNodes']>
  ): ReturnType<GType['genBookTreeNodes']> {
    return genBookTreeNodes(...args);
  },

  locationVKText(
    ...args: Parameters<GType['locationVKText']>
  ): ReturnType<GType['locationVKText']> {
    return locationVKText(GI, ...args);
  },

  getLanguageName(
    ...args: Parameters<GType['getLanguageName']>
  ): ReturnType<GType['getLanguageName']> {
    return getLanguageName(...args);
  },
};
Cache.write(GI, 'GITypeMain');
Cache.noclear('GITypeMain');
