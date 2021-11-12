/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Dummy func used as place holder
const func = () => {};

export interface BookType {
  sName: string;
  bName: string;
  bNameL: string;
}

export interface ConfigType {
  [index: string]: string;
}

export interface TabType {
  modName: string;
  modType:
    | 'Biblical Texts'
    | 'Lexicons / Dictionaries'
    | 'Commentaries'
    | 'Generic Books';
  modVersion: string;
  modDir: string;
  label: string;
  tabType: 'Texts' | 'Comms' | 'Dicts' | 'Genbks';
  isRTL: boolean;
  index: number;
  description: string;
  locName: string;
  conf: string;
  isCommDir: boolean;
  audio: { [index: string]: string };
  audioCode: string;
  lang: string;
}

export const DirsPublic = {
  path: 'readonly' as unknown as DirsDirectories,
};
export type DirsDirectories = {
  TmpD: string;
  xsAsset: string;
  xsAsar: string;
  xsProgram: string;
  xsDefaults: string;
  xsPrefDefD: string;
  ProfD: string;
  xsPrefD: string;
  xsResD: string;
  xsModsUser: string;
  xsFonts: string;
  xsAudio: string;
  xsBookmarks: string;
  xsVideo: string;
  xsLocale: string;
  xsModsCommon: string;
};
export const PrefsPublic = {
  getPrefOrCreate: func as unknown as (key: string, type: string, defval: boolean | string | number | undefined, aStore?: string) => any,
  getCharPref: func as unknown as (key: string, aStore?: string) => string,
  setCharPref: func as unknown as (key: string, value: string, aStore?: string) => boolean,
  getBoolPref: func as unknown as (key: string, aStore?: string) => boolean,
  setBoolPref: func as unknown as (key: string, value: string, aStore?: string) => boolean,
  getIntPref: func as unknown as (key: string, aStore?: string) => number,
  setIntPref: func as unknown as (key: string, value: string, aStore?: string) => boolean,
  clearUserPref: func as unknown as (key: string, aStore?: string) => boolean ,
  writeStore: func as unknown as (aStore: string) => boolean,
  store: 'readonly' as unknown as { [i: string]: any },
};
export const LibSwordPublic = {
  getMaxChapter: func as unknown as (modname: string, vkeytext: string) => number,
  getMaxVerse: func as unknown as (modname: string, vkeytext: string) => number,
  // getChapterText: func as unknown as (modname: string, vkeytext: string) => string,
  // getChapterTextMulti: func as unknown as (modstrlist: string, vkeytext: string) => string,
  // getFootnotes: func as unknown as () => string,
  // getCrossRefs: func as unknown as () => string,
  // getNotes: func as unknown as () => string,
  getVerseText: func as unknown as (vkeymod: string, vkeytext: string, keepTextNotes: boolean) => string,
  getModuleList: func as unknown as () => string,
  getModuleInformation: func as unknown as (modname: string, key: string) => string,
  getVerseSystem: func as unknown as (modname: string) => string,
  convertLocation: func as unknown as (fromv11n: string, vkeytext: string, tov11n: string) => string,
};

// This GPublic object will be used at runtime to create two different
// types of G objects sharing the same GType interface: one will be
// used in the main process and the other in renderer processes. The
// main process G properties access functions and data directly. But
// renderer process G properties request data through IPC from the main
// process G object. All readonly data is cached. The cache can be
//  cleared by G.reset().
export const GPublic = {
  // Global data for read only use
  Book: 'readonly',
  Tabs: 'readonly',
  Tab: 'readonly',

  ProgramConfig: 'readonly',
  LocaleConfigs: 'readonly',
  ModuleConfigs: 'readonly',
  ModuleConfigDefault: 'readonly',
  FontFaceConfigs: 'readonly',

  OPSYS: 'readonly',

  // Global functions
  resolveHtmlPath: func as unknown,

  // Global objects with methods and/or data
  Prefs: PrefsPublic,
  LibSword: LibSwordPublic,
  Dirs: DirsPublic,
};

export interface GType {
  Book: BookType[];
  Tabs: TabType[];
  Tab: { [i: string]: TabType };

  ProgramConfig: ConfigType;
  LocaleConfigs: { [i: string]: ConfigType };
  ModuleConfigs: { [i: string]: ConfigType };
  ModuleConfigDefault: ConfigType;
  FontFaceConfigs: ConfigType[];

  OPSYS: 'string';

  resolveHtmlPath: (htmlfile: string) => string;

  Prefs: typeof PrefsPublic;
  LibSword: typeof LibSwordPublic;
  Dirs: typeof DirsPublic;

  cache: { [i: string]: any };
  reset: () => void;
}
