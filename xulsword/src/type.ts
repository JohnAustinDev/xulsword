import nsILocalFile from 'main/components/nsILocalFile';

export interface BookType {
  sName: string;
  bName: string;
  bNameL: string;
}

export interface LocaleConfigType {
  [index: string]: string;
}

export interface ProgramConfigType extends LocaleConfigType {
  StyleRule: string;
  TreeStyleRule: string;
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
  conf: nsILocalFile;
  isCommDir: boolean;
  audio: { [index: string]: string };
  audioCode: string;
  lang: string;
}

export const GPublic = {
  // Global data objects for read only use
  Book: 'readonly',
  Tabs: 'readonly',
  Tab: 'readonly',
  ProgramConfig: 'readonly',

  // Global object methods
  Prefs: {
    getPrefOrCreate: (): any => {},
    getCharPref: () => {},
    setCharPref: () => {},
    getBoolPref: () => {},
    setBoolPref: () => {},
    getIntPref: () => {},
    setIntPref: () => {},
    clearUserPref: () => {},
  },
  LibSword: {
    getMaxChapter: () => {},
    getMaxVerse: () => {},
    getModuleInformation: () => {},
    getModuleList: () => {},
    getVerseText: () => {},
  },
  Dirs: {
    TmpD: () => {},
    xsAsset: () => {},
    xsAsar: () => {},
    xsProgram: () => {},
    xsDefaults: () => {},
    xsPrefDefD: () => {},
    ProfD: () => {},
    xsPrefD: () => {},
    xsResD: () => {},
    xsModsUser: () => {},
    xsFonts: () => {},
    xsAudio: () => {},
    xsBookmarks: () => {},
    xsVideo: () => {},
    xsLocale: () => {},
    xsModsCommon: () => {},
    path: 'readonly',
  },
};

export interface GClass {
  Book: BookType[];
  Tabs: TabType[];
  Tab: { [i: string]: TabType };
  ProgramConfig: LocaleConfigType;

  Prefs: typeof GPublic.Prefs;
  LibSword: typeof GPublic.LibSword;
  Dirs: typeof GPublic.Dirs;

  cache: { [i: string]: any };
  reset: () => void;
}
