import { clipboard, shell } from 'electron';
import i18next from 'i18next';
import Viewport from '../../viewport.ts';
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
  getBooksInVKModules,
  getLocalizedBooks,
  getLocaleDigits,
  inlineAudioFile,
  inlineFile,
  getAllDictionaryKeyList,
  genBookTreeNodes,
  getLanguageName,
  getAudioConf,
  getModuleConfs,
  getModuleConf,
  getBuiltInRepos,
} from '../common.ts';
import Cache from '../../cache.ts';
import { callBatch } from '../handleG.ts';
import { locationVKText } from '../versetext.ts';
import Prefs from './prefs.ts';
import { canRedo, canUndo } from '../components/bookmarks.tsx';
import Dirs from '../components/dirs.ts';
import DiskCache from '../components/diskcache.ts';
import LibSword from '../components/libsword.ts';
import Data from '../components/data.ts';
import Window, { publishSubscription } from './components/window.ts';
import Module from './components/module.ts';
import Commands from './components/commands.ts';

import type { GType, GTypeMain, WindowDescriptorType } from '../../type.ts';
import type { SubscriptionType } from '../../subscription.ts';

if (!Build.isElectronApp)
  throw new Error(`This module should only be used with an Electron server.`);

// This G object is for use in the main electron process, and it shares
// the same interface as the renderer's G object. Properties of this
// object directly access main process data and modules.

// FOR MORE EXPLANATION SEE: ./src/clients/G.ts
export const G: GTypeMain = {
  i18n: i18next,

  clipboard,

  LibSword,

  Prefs,

  DiskCache,

  Dirs,

  Commands,

  Shell: shell,

  Data,

  Window,

  Module,

  // To avoid a dependency cycle, this is set right after G is set.
  Viewport: null as unknown as Viewport,

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

  get OPSYS() {
    return process.platform;
  },

  get BuiltInRepos() {
    return getBuiltInRepos();
  },

  get BooksInVKModules() {
    return getBooksInVKModules();
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

  resetMain(
    ...args: Parameters<GType['resetMain']>
  ): ReturnType<GType['resetMain']> {
    resetMain(...args);
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

  publishSubscription<S extends keyof SubscriptionType['publish']>(
    s: S,
    ops: {
      renderers?:
        | Partial<WindowDescriptorType>
        | Array<Partial<WindowDescriptorType>>;
      main?: boolean;
    },
    ...args: Parameters<SubscriptionType['publish'][S]>
  ) {
    publishSubscription(s, ops, ...args);
  },

  canUndo(...args: Parameters<GType['canUndo']>): ReturnType<GType['canUndo']> {
    return canUndo(...args);
  },

  canRedo(...args: Parameters<GType['canRedo']>): ReturnType<GType['canRedo']> {
    return canRedo(...args);
  },

  async callBatch(
    ...args: Parameters<GType['callBatch']>
  ): ReturnType<GType['callBatch']> {
    return callBatch(G, ...args);
  },

  callBatchSync(
    ...args: Parameters<GType['callBatchSync']>
  ): ReturnType<GType['callBatchSync']> {
    return callBatch(G, ...args);
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
    return locationVKText(G, ...args);
  },

  getLanguageName(
    ...args: Parameters<GType['getLanguageName']>
  ): ReturnType<GType['getLanguageName']> {
    return getLanguageName(...args);
  },
};
Cache.write(G, 'GTypeMain');
Cache.noclear('GTypeMain');

G.Viewport = new Viewport(
  G,
  {
    getBooksInVKModule: (_default, _renderPromise, module) => {
      return G.getBooksInVKModule(module);
    },
  },
  Prefs,
  Window,
);
