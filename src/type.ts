/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Dummy func used as place holder
const func = () => {};

export type SwordFilterType =
  'Headings' |
  'Footnotes' |
  'Cross-references' |
  'Reference Material Links' |
  "Strong's Numbers" |
  'Morphological Tags' |
  'Verse Numbers' |
  'Hebrew Cantillation' |
  'Hebrew Vowel Points' |
  'Words of Christ in Red'

export type SwordFilterValueType = 'Off' | 'On'

export interface ShowType {
  headings: boolean;
  footnotes: boolean;
  crossrefs: boolean;
  dictlinks: boolean;
  versenums: boolean;
  strongs: boolean;
  morph: boolean;
  usernotes: boolean;
  hebcantillation: boolean;
  hebvowelpoints: boolean;
  redwords: boolean;
}

export interface PlaceType {
  footnotes: 'notebox' | 'popup';
  crossrefs: 'notebox' | 'popup';
  usernotes: 'notebox' | 'popup';
}

export interface BookType {
  sName: string;
  bName: string;
  bNameL: string;
}

export interface ConfigType {
  [index: string]: string;
}

export type TabTypes = 'Texts' | 'Comms' | 'Dicts' | 'Genbks';

export type ModTypes =
| 'Biblical Texts'
| 'Commentaries'
| 'Lexicons / Dictionaries'
| 'Generic Books';

export interface TabType {
  modName: string;
  modType: ModTypes;
  modVersion: string;
  modDir: string;
  label: string;
  tabType: TabTypes;
  isVerseKey: boolean;
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
  getPrefOrCreate: func as unknown as (key: string, type: 'string' | 'number' | 'boolean' | 'complex', defval: any, aStore?: string) => any,
  getCharPref: func as unknown as (key: string, aStore?: string) => string,
  setCharPref: func as unknown as (key: string, value: string, aStore?: string) => boolean,
  getBoolPref: func as unknown as (key: string, aStore?: string) => boolean,
  setBoolPref: func as unknown as (key: string, value: boolean, aStore?: string) => boolean,
  getIntPref: func as unknown as (key: string, aStore?: string) => number,
  setIntPref: func as unknown as (key: string, value: number, aStore?: string) => boolean,
  getComplexValue: func as unknown as (key: string, aStore?: string) => any,
  setComplexValue: func as unknown as (key: string, value: any, aStore?: string) => boolean,
  clearUserPref: func as unknown as (key: string, aStore?: string) => boolean ,
  getStore: func as unknown as (aStore?: string) => { [s: string]: any },
  writeAllStores: func as unknown as () => void,
};
export const LibSwordPublic = {
  initLibsword: func as unknown as () => boolean,
  libSwordReady: func as unknown as (caller: string) => boolean,
  hasBible: func as unknown as () => boolean,
  getMaxChapter: func as unknown as (modname: string, vkeytext: string) => number,
  getMaxVerse: func as unknown as (modname: string, vkeytext: string) => number,
  getChapterText: func as unknown as (modname: string, vkeytext: string) => string,
  getChapterTextMulti: func as unknown as (modstrlist: string, vkeytext: string) => string,
  getFootnotes: func as unknown as () => string,
  getCrossRefs: func as unknown as () => string,
  getNotes: func as unknown as () => string,
  getVerseText: func as unknown as (vkeymod: string, vkeytext: string, keepTextNotes: boolean) => string,
  getVerseSystem: func as unknown as (modname: string) => string,
  convertLocation: func as unknown as (fromv11n: string, vkeytext: string, tov11n: string) => string,
  quitLibsword: func as unknown as () => void,
  pause: func as unknown as (callback: any) => void,
  resume: func as unknown as () => void,
  getIntroductions: func as unknown as (vkeymod: string, bname: string) => string,
  getDictionaryEntry: func as unknown as (lexdictmod: string, key: string) => string,
  getAllDictionaryKeys: func as unknown as (lexdictmod: string) => string,
  getGenBookChapterText: func as unknown as (gbmod: string, treekey: string) => string,
  getGenBookTableOfContents: func as unknown as (gbmod: string) => string,
  luceneEnabled: func as unknown as (modname: string) => boolean,
  search: func as unknown as (modname: string, srchstr: string, scope: string, type: number, flags: number, newsearch: boolean) => number,
  getSearchPointer: func as unknown as () => any,
  getSearchVerses: func as unknown as (modname: string) => void,
  getSearchResults: func as unknown as (modname: string, first: number, num: number, keepStrongs: boolean, searchPointer: any) => string,
  searchIndexDelete: func as unknown as (modname: string) => void,
  searchIndexBuild: func as unknown as (modname: string) => void,
  setGlobalOption: func as unknown as (option: SwordFilterType, setting: SwordFilterValueType) => void,
  setGlobalOptions: func as unknown as (options: { [key in SwordFilterType]: SwordFilterValueType }) => void,
  getGlobalOption: func as unknown as (option: SwordFilterType) => string,
  setCipherKey: func as unknown as (modname: string, cipherKey: string, useSecModule: boolean) => void,
  getModuleList: func as unknown as () => string,
  getModuleInformation: func as unknown as (modname: string, paramname: string) => string,
  uncompressTarGz: func as unknown as (tarGzPath: string, aDirPath: string) => void,
  translate: func as unknown as (text: string, localeName: string) => string,

};

export const CommandsPublic = {
  addRepositoryModule: func as unknown as () => void,
  addLocalModule: func as unknown as () => void,
  removeModule: func as unknown as () => void,
  exportAudio: func as unknown as () => void,
  importAudio: func as unknown as () => void,
  pageSetup: func as unknown as () => void,
  printPreview: func as unknown as () => void,
  printPassage: func as unknown as () => void,
  print: func as unknown as () => void,
  search: func as unknown as () => void,
  copyPassage: func as unknown as () => void,
  openFontsColors: func as unknown as () => void,
  openBookmarksManager: func as unknown as () => void,
  openNewBookmarkDialog: func as unknown as () => void,
  openNewUserNoteDialog: func as unknown as () => void,
  openHelp: func as unknown as () => void,
  openTextWindow: func as unknown as () => void,
}

// This GPublic object will be used at runtime to create two different
// types of G objects sharing the same GType interface: one will be
// used in the main process and the other in renderer processes. The
// main process G properties access functions and data directly. But
// renderer process G properties request data through IPC from the main
// process G object. All readonly data is cached. The cache can be
//  cleared by G.reset().
export const GPublic = {
  // Global data for read only use
  Books: 'readonly',
  Book: 'readonly',
  Tabs: 'readonly',
  Tab: 'readonly',

  ProgramConfig: 'readonly',
  LocaleConfigs: 'readonly',
  ModuleConfigs: 'readonly',
  ModuleConfigDefault: 'readonly',
  FontFaceConfigs: 'readonly',
  FeatureModules: 'readonly',
  AvailableBooks: 'readonly',

  OPSYS: 'readonly',

  // Global functions
  resolveHtmlPath: func as unknown,
  setGlobalMenuFromPrefs: func as unknown,

  // Global objects with methods and/or data
  Prefs: PrefsPublic,
  LibSword: LibSwordPublic,
  Dirs: DirsPublic,
  Commands: CommandsPublic,
};

export interface GType {
  Books: BookType[];
  Book: { [i: string]: BookType };
  Tabs: TabType[];
  Tab: { [i: string]: TabType };

  ProgramConfig: ConfigType;
  LocaleConfigs: { [i: string]: ConfigType };
  ModuleConfigs: { [i: string]: ConfigType };
  ModuleConfigDefault: ConfigType;
  FontFaceConfigs: ConfigType[];
  FeatureModules: { [i: string]: any };
  AvailableBooks: { [i: string]: string[] };

  OPSYS: 'string';

  resolveHtmlPath: (htmlfile: string) => string;
  setGlobalMenuFromPrefs: (menu?: Electron.Menu) => void;

  Prefs: typeof PrefsPublic;
  LibSword: typeof LibSwordPublic;
  Dirs: typeof DirsPublic;
  Commands: typeof CommandsPublic;

  cache: { [i: string]: any };
  reset: () => void;
}
