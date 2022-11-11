/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { LogLevel } from 'electron-log';
import type {
  AtextPropsType,
  BookGroupType,
  ConfigType,
  EnvironmentVars,
  FeatureType,
  GlobalPrefType,
  ModTypes,
  NewModulesType,
  PinPropsType,
  PlaceType,
  ShowType,
  SwordFilterType,
  SwordFilterValueType,
  TabTypes,
  V11nType,
} from './type';

// Environment variables:
// - NODE_ENV - Set in package.json to control the build process
//     (will be set to either 'development' or 'production').
// - DEBUG_PROD - Set by you to 'true' BEFORE packaging to enable
//     dev source maps and dev-tools in a production build (but the
//     main process is still not accesible via current vscode config).
//     Also enables other production debug behaviour (more logging).
// - XULSWORD_ENV - Set by you to 'production' for debugging production
//     only behaviour, like i18n, splash and log, in a development
//     environment (including main process debugging via vscode).
// - LOGLEVEL - Set a particular logLevel everywhere.
const env = (envvar: EnvironmentVars) => {
  return typeof process === 'undefined'
    ? window.main.process[envvar]()
    : process.env[envvar];
};

const isDevelopment =
  env('NODE_ENV') === 'development' && env('XULSWORD_ENV') !== 'production';

const productionLogLevel = env('DEBUG_PROD') === 'true' ? 'silly' : 'info';

// Common Global Constants
const C = {
  isDevelopment,

  LogLevel: (env('LOGLEVEL') ||
    (isDevelopment ? 'debug' : productionLogLevel)) as LogLevel,

  DevToolsopen: isDevelopment ? true : env('DEBUG_PROD') === 'true',

  DevSplash: 1 as 0 | 1 | 2, // 0 normal, 1 skip, 2 debug

  SWORDEngineVersion: '1.8.1',

  APPLICATIONID: 'xulsword@xulsword.org',

  MAXVERSE: 176,
  MAXCHAPTER: 150,

  // LibSword response constants
  NOTFOUND: 'Not Found',
  NOMODULES: 'No Modules',
  CONFSEP: '<nx>',

  Downloader: {
    localfile: 'file://',
  },

  URLRE: /^https?:\/\//i,

  FTPMaxConnections: 48,
  FTPUserName: 'anonymous', // TODO!: How to set: 'xulsword@xulsword.org',
  HTTPUserAgent: 'xulsword@xulsword.org',

  // xulsword UI constants
  UI: {
    Window: {
      resizeDelay: 500, // ms between window resize and update
      persistentTypes: ['moduleManager'],
    },
    Xulsword: {
      maxHistoryMenuLength: 20,
      historyDelay: 1000, // ms before new location is saved
    },
    Viewport: {
      minPanelWidth: 200, // px
      TabTypeOrder: {
        Texts: 1,
        Comms: 2,
        Genbks: 3,
        Dicts: 4,
      },
      TabMarginFirstLast: 20, // px CSS first left and last right child tab margin
      TabMargin: 3, // px CSS tab left/right margin
      TabRowMargin: 30, // px room to leave free when moving tabs to mts-tab
    },
    Chooser: {
      bookgroupHoverDelay: 300, // ms until bookGroup is changed
      mouseScrollMargin: 80, // px inward from top or bottom border
      headingMenuOpenDelay: 400, // ms until BIble heading menu opens
    },
    Popup: {
      openGap: 0, // open popup px below target element
      strongsOpenGap: 80, // px
      openDelay: 200, // ms between hover and popup opening
      strongsOpenDelay: 750, // ms
      wheelDeadTime: 1000, // ms of dead-time after wheel-scroll
    },
    Atext: {
      fontSize: 12.7, // px nominal font-size
      fontSizeOptionDelta: 1.3, // px step
      dictKeyInputDelay: 1000, // ms between keydown and update
      wheelScrollDelay: 300, // ms between UI updates while scrolling
      multiColWheelScrollDelay: 100,
      initialNoteboxHeight: 200, // px
      bbSingleColTopMargin: 100, // px an arbitrary extra margin value
      bbBottomMargin: 20, // px
    },
    Manager: {
      cancelMsg: 'Canceled',
    },
    Search: {
      resultsPerPage: 30, // search results per page
      maxLexiconSearchResults: 500, // max number search results used for lexicon
      symbol: {
        // [UI-default-symbol, Clucene-symbol]
        SINGLECharWildCard: ['?', '?'],
        MULTICharWildCard: ['*', '*'],
        AND: ['&&', 'AND '],
        OR: ['||', 'OR '],
        NOT: ['!', 'NOT '],
        SIMILAR: ['~', '~ '],
        GROUPSTART: ['(', '('],
        GROUPEND: [')', ')'],
        QUOTESTART: ['"', '"'],
        QUOTEEND: ['"', '"'],
      },
    },
  },

  // These are all the properties which Config type objects will have.
  // The Config object specifies keys into the following data sources:
  //   modConf = a module config file entry
  //   localeConf = a locale config.json entry
  // It also specifies any corresponding CSS property if there is one.
/* eslint-disable prettier/prettier */
  ConfigTemplate: {
    direction:        { modConf:"Direction",         localeConf:"Direction",      CSS:"direction" },
    fontFamily:       { modConf:"Font",              localeConf:"Font",           CSS:"font-family" },
    fontSizeAdjust:   { modConf:"FontSizeAdjust",    localeConf:"FontSizeAdjust", CSS:"font-size-adjust" },
    lineHeight:       { modConf:"LineHeight",        localeConf:"LineHeight",     CSS:"line-height" },
    fontSize:         { modConf:"FontSize",          localeConf:"FontSize",       CSS:"font-size" },
    color:            { modConf:"FontColor",         localeConf:"FontColor",      CSS:"color" },
    background:       { modConf:"FontBackground",    localeConf:"FontBackground", CSS:"background" },
    AssociatedModules:{ modConf:null,                localeConf:"DefaultModule",  CSS:null },
    AssociatedLocale: { modConf:"Lang",              localeConf:null,             CSS:null },
    PreferredCSSXHTML:{ modConf:"PreferredCSSXHTML", localeConf:null,             CSS:null }
  } as { [key in keyof ConfigType]: { modConf: string | null, localeConf: string | null, CSS: string | null }},
  /* eslint-enable prettier/prettier */

  // This should be the same as the global-html.css html rule.
  LocaleDefaultConfigCSS: {
    fontFamily: 'arial',
    color: 'rgb(40, 40, 40)',
  } as { [key in keyof ConfigType]: string },

  Locales: [
    ['en', 'English', 'ltr'],
    ['ru', 'Русский', 'ltr'],
    ['ru-CA', 'Русский для Востока', 'ltr'],
    ['crh-Cyrl', 'Русский/Крымскотатарский', 'ltr'],
    ['fa', 'فارسی', 'rtl'],
    ['kk', 'Қазақша', 'ltr'],
    ['ko', '한국어', 'ltr'],
    ['kum', 'Къумукъ', 'ltr'],
    ['ky-Cyrl', 'Кыргызча', 'ltr'],
    ['ky-Arab', 'قىرعىزچا', 'rtl'],
    ['tk-Latn', 'Түркменче', 'ltr'],
    ['tt-Cyrl', 'Татар теле', 'ltr'],
    ['uz-Latn', 'O‘zbekcha', 'ltr'],
    ['uz-Cyrl', 'Ўзбекча', 'ltr'],
  ] as const,

  FallbackLanguage: {
    en: 'en',
    ru: 'en',
    'crh-Cyrl': 'ru',
    fa: 'en',
    kk: 'ru',
    ko: 'en',
    kum: 'ru',
    'ky-Arab': 'en',
    'ky-Cyrl': 'ru',
    'ru-CA': 'ru',
    'tk-Latn': 'en',
    'tt-Cyrl': 'ru',
    'uz-Cyrl': 'ru',
    'uz-Latn': 'en',
  } as { [i: string]: string },

  // SupportedV11ns are the versification systems supported by libxulsword's
  // current SWORD engine.
  SupportedV11ns: [
    'KJV',
    'German',
    'KJVA',
    'Synodal',
    'Leningrad',
    'NRSVA',
    'Luther',
    'Vulg',
    'SynodalProt',
    'Orthodox',
    'LXX',
    'NRSV',
    'MT',
    'Catholic',
    'Catholic2',
    'DarbyFr',
    'Segond',
    'Calvin',
  ] as V11nType[],

  // SupportedV11nMaps show which verse-systems may currently be mapped to
  // other verse systems by libxulsword. The SWORD C++ engine is not currently
  // being used for mapping. TODO: Investigate whether SWORD can now do the
  // mapping that's needed or not- it seems SWORD had (has?) limitations caused
  // by incorrect assumptions about mapping requirements.
  SupportedV11nMaps: {
    KJV: ['Synodal', 'SynodalProt'],
    Synodal: ['KJV'],
    SynodalProt: ['KJV'],
  } as { [key in V11nType]: V11nType[] },

  // SupportedBookGroups and SupportedBooks lists were taken from:
  // wiki.crosswire.org/OSIS_Book_Abbreviations (11/19/20)
  SupportedBookGroups: [
    'ot',
    'nt',
    'Apocrypha',
    'Apostolic_Fathers',
    'Armenian_Orthodox_Canon_Additions',
    'Ethiopian_Orthodox_Canon',
    'Peshitta_Syriac_Orthodox_Canon',
    'Rahlfs_LXX',
    'Rahlfs_variant_books',
    'Vulgate_and_other_later_Latin_mss',
    'Other',
  ] as BookGroupType[],
  /* eslint-disable prettier/prettier */
  SupportedBooks: {
    ot: [
      'Gen','Exod','Lev','Num','Deut','Josh','Judg','Ruth','1Sam','2Sam',
      '1Kgs','2Kgs','1Chr','2Chr','Ezra','Neh','Esth','Job','Ps','Prov',
      'Eccl','Song','Isa','Jer','Lam','Ezek','Dan','Hos','Joel','Amos',
      'Obad','Jonah','Mic','Nah','Hab','Zeph','Hag','Zech','Mal'
    ],
    nt: [
      'Matt','Mark','Luke','John','Acts','Rom','1Cor','2Cor','Gal','Eph',
      'Phil','Col','1Thess','2Thess','1Tim','2Tim','Titus','Phlm','Heb',
      'Jas','1Pet','2Pet','1John','2John','3John','Jude','Rev'
    ],
    Apocrypha: [
      'Tob','Jdt','EsthGr','AddEsth','Wis','SirP','Sir','Bar','EpJer',
      'DanGr','AddDan','PrAzar','Sus','Bel','1Macc','2Macc','3Macc',
      '4Macc','PrMan','1Esd','2Esd','AddPs'
    ],
    Apostolic_Fathers: [
      '1Clem','2Clem','IgnEph','IgnMagn','IgnTrall','IgnRom','IgnPhld',
      'IgnSmyrn','IgnPol','PolPhil','MartPol','Did','Barn','Herm',
      'Herm.Mand','Herm.Sim','Herm.Vis','Diogn','AposCreed','PapFrag',
      'RelElders','QuadFrag'
    ],
    Armenian_Orthodox_Canon_Additions: [
      'EpCorPaul','3Cor','WSir','PrEuth','DormJohn','JosAsen','T12Patr',
      'T12Patr.TAsh','T12Patr.TBenj','T12Patr.TDan','T12Patr.TGad',
      'T12Patr.TIss','T12Patr.TJos','T12Patr.TJud','T12Patr.TLevi',
      'T12Patr.TNaph','T12Patr.TReu','T12Patr.TSim','T12Patr.TZeb'
    ],
    Ethiopian_Orthodox_Canon: [
      '1En','Jub','4Bar','1Meq','2Meq','3Meq','Rep','AddJer','PsJos'
    ],
    Peshitta_Syriac_Orthodox_Canon: [
      '2Bar','EpBar','5ApocSyrPss','JosephusJWvi'
    ],
    Rahlfs_LXX: [
      'Odes','PssSol'
    ],
    Rahlfs_variant_books: [
      'JoshA','JudgB','TobS','SusTh','DanTh','BelTh'
    ],
    Vulgate_and_other_later_Latin_mss: [
      'EpLao','5Ezra','4Ezra','6Ezra','PrSol','PrJer'
    ],
    Other: [
      'TatDiat','PsMet'
    ]
  } as { [key in BookGroupType]: string[] },
  /* eslint-enable prettier/prettier */

  BIBLE: 'Biblical Texts' as ModTypes,
  DICTIONARY: 'Lexicons / Dictionaries' as ModTypes,
  COMMENTARY: 'Commentaries' as ModTypes,
  GENBOOK: 'Generic Books' as ModTypes,

  SupportedModuleTypes: {
    'Biblical Texts': 'Texts',
    Commentaries: 'Comms',
    'Lexicons / Dictionaries': 'Dicts',
    'Generic Books': 'Genbks',
  } as { [key in ModTypes]: TabTypes },

  SwordFilters: {
    Headings: 'headings',
    Footnotes: 'footnotes',
    'Cross-references': 'crossrefs',
    'Reference Material Links': 'dictlinks',
    "Strong's Numbers": 'strongs',
    'Morphological Tags': 'morph',
    'Verse Numbers': 'versenums',
    'Hebrew Cantillation': 'hebcantillation',
    'Hebrew Vowel Points': 'hebvowelpoints',
    'Words of Christ in Red': 'redwords',
  } as { [key in SwordFilterType]: keyof ShowType },

  SwordFilterValues: ['Off', 'On'] as SwordFilterValueType[],

  SwordRepoManifest: 'mods.d.tar.gz',

  SwordModuleStartRE: /^\[([A-Za-z0-9_-]+)\]\s*$/,
  SwordModuleCharsRE: /^[A-Za-z0-9_-]+$/,

  SwordConf: {
    // default is string
    integer: ['DisplayLevel', 'InstallSize'],
    localization: [
      'About',
      'Abbreviation',
      'Description',
      'Copyright',
      'CopyrightHolder',
      'CopyrightDate',
      'CopyrightNotes',
      'CopyrightContactName',
      'CopyrightContactNotes',
      'CopyrightContactAddress',
      'CopyrightContactEmail',
      'ShortPromo',
      'ShortCopyright',
      'DistributionNotes',
      'UnlockInfo',
    ],
    repeatable: ['Obsoletes', 'Feature', 'GlobalOptionFilter'],
    delimited: { SwordModules: /;/, SwordVersions: /;/ },
    // ShortCopyright is currently non-standard here, but used by NASB
    continuation: [
      'About',
      'ShortCopyright',
      'Copyright',
      'CopyrightNotes',
      'CopyrightContactName',
      'CopyrightContactNotes',
      'CopyrightContactAddress',
      'DistributionNotes',
      'TextSource',
      'UnlockInfo',
    ],
    rtf: ['About', 'UnlockInfo'],
    // About is currently non-standard here, but used by NASB
    htmllink: ['ShortPromo', 'UnlockInfo', 'About'],
  } as const,

  NEWMODS: {
    modules: [],
    nokeymods: [],
    fonts: [],
    bookmarks: [],
    audio: [],
    reports: [],
  } as NewModulesType,

  LOCALE_SEARCH_SYMBOLS: {
    SINGLECharWildCard: '?',
    MULTICharWildCard: '*',
    AND: '&&',
    OR: '||',
    NOT: '!',
    SIMILAR: '~',
    GROUPSTART: '(',
    GROUPEND: ')',
    QUOTESTART: '"',
    QUOTEEND: '"',
  },

  BM: {
    // used in imported/exported bookmarks.txt because < 3.6 could only read files with this newline.
    FileReturn: '\r\n',
    // bookmark and personal-note fields (do not change, or user exported data will become incompatible)
    TYPE: 0,
    NAME: 1,
    NOTE: 2,
    BOOK: 3,
    CHAPTER: 4,
    VERSE: 5,
    LASTVERSE: 6,
    MODULE: 7,
    LOCATION: 8,
    BMTEXT: 9,
    ICON: 10,
    CREATIONDATE: 11,
    VISITEDDATE: 12,
    NAMELOCALE: 13,
    NOTELOCALE: 14,
  },

  // Lists for each module type of LibSword features that should be always on.
  AlwaysOn: {
    'Biblical Texts': [],
    Commentaries: [
      'Headings',
      'Footnotes',
      'Cross-references',
      'Reference Material Links',
    ],
    'Lexicons / Dictionaries': [
      'Headings',
      'Footnotes',
      'Cross-references',
      'Reference Material Links',
    ],
    'Generic Books': [
      'Headings',
      'Footnotes',
      'Cross-references',
      'Reference Material Links',
    ],
  } as { [key in ModTypes]: SwordFilterType[] },

  SwordFeatureClasses: {
    hebrewDef: /S_H/,
    greekDef: /S_G/,
    greekParse: /SM_G/,
  } as { [key in keyof FeatureType]?: RegExp },

  LocalePreferredFeature: {
    en: {
      hebrewDef: ['StrongsHebrew'],
      greekDef: ['StrongsGreek'],
      greekParse: [''],
    },
    ru: {
      hebrewDef: ['StrongsHebrewRU'],
      greekDef: ['StrongsGreekRU'],
      greekParse: [''],
    },
  } as { [k in 'en' | 'ru']: Partial<FeatureType> },

  // These xulsword Pref keys are global so all windows will be kept in sync sharing
  // the same values for each of these prefs, in addition to other GlobalPref.
  GlobalXulsword: [
    'location',
    'selection',
    'scroll',
    'show',
  ] as (keyof GlobalPrefType['xulsword'])[],

  // These Atext props can be 'pinned' to become independant state properties.
  // NOTE: property types are important, but property values are not.
  PinProps: {
    location: null,
    selection: null,
    scroll: null,
    show: {} as ShowType,
    place: {} as PlaceType,
    module: '',
    ilModule: '',
    modkey: '',
  } as PinPropsType,

  // These Atext props are used by LibSword. If these props all have the same values
  // as the previous rendering, the LibSword response will also be the same.
  // NOTE: property types are important, but property values are not.
  LibSwordProps: {
    'Biblical Texts': {
      location: null,
      module: '',
      show: {} as ShowType,
      place: {} as PlaceType,
      columns: 0,
      ilModule: '',
      ilModuleOption: [],
    },
    Commentaries: {
      location: null,
      module: '',
      show: {} as ShowType,
      place: {} as PlaceType,
    },
    'Lexicons / Dictionaries': {
      module: '',
      modkey: '',
      show: {} as ShowType,
    },
    'Generic Books': {
      module: '',
      modkey: '',
      show: {} as ShowType,
    },
  } as { [key in ModTypes]: Partial<AtextPropsType> },

  // These Atext props effect the verse scroll. If these props all have
  // the same values as the previous rendering, and the same is true of
  // the LibSwordProps, then scrolling is also unnecessary.
  // NOTE: property types are important, but property values are not.
  ScrollPropsVK: {
    module: '',
    location: null,
    scroll: null,
    columns: 0,
  } as Partial<AtextPropsType>,
};
export default C;
