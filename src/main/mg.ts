/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { clipboard, shell } from 'electron';
import i18next from 'i18next';
import { WindowDescriptorType } from '../type.ts';
import { canRedo, canUndo } from './bookmarks.ts';
import Viewport from './components/viewport.ts';
import Dirs from './components/dirs.ts';
import DiskCache from './components/diskcache.ts';
import Prefs from './components/prefs.ts';
import LibSword from './components/libsword.ts';
import Data from './components/data.ts';
import Window, {
  publishSubscription,
  resolveHtmlPath,
} from './components/window.ts';
import Module from './components/module.ts';
import Commands from './components/commands.ts';
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
  GetBooksInVKModules,
  getLocalizedBooks,
  getLocaleDigits,
  inlineAudioFile,
  inlineFile,
  getAllDictionaryKeyList,
  genBookTreeNodes
} from './minit.ts';
import { callBatch } from './handleGlobal.ts';

import type { GType } from '../type.ts';
import type { SubscriptionType } from '../subscription.ts';

// This G object is for use in the main electron process, and it shares
// the same interface as the renderer's G object. Properties of this
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

  get GetBooksInVKModules() {
    return GetBooksInVKModules();
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

  async callBatch(...args: Parameters<GType['callBatch']>): ReturnType<GType['callBatch']> {
    return callBatch(G, ...args);
  }

  callBatchSync(...args: Parameters<GType['callBatchSync']>): ReturnType<GType['callBatchSync']> {
    return callBatch(G, ...args);
  }

  getAllDictionaryKeyList(...args: Parameters<GType['getAllDictionaryKeyList']>): ReturnType<GType['getAllDictionaryKeyList']> {
    return getAllDictionaryKeyList(...args);
  }

  genBookTreeNodes(...args: Parameters<GType['genBookTreeNodes']>): ReturnType<GType['genBookTreeNodes']> {
    return genBookTreeNodes(...args);
  }
}

const G = new GClass();

export default G;
