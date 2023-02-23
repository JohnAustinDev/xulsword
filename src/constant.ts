/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { LogLevel } from 'electron-log';
import type { paperSizes } from 'renderer/libxul/printSettings';
import type { SelectVKMType } from 'renderer/libxul/vkselect';
import type { TinitialRowSort } from './renderer/libxul/table';
import type {
  AtextPropsType,
  AudioPrefType,
  BookGroupType,
  BookmarkFolderType,
  ConfigType,
  EnvironmentVars,
  FeatureType,
  HistoryVKType,
  LocationVKType,
  ModTypes,
  NewModulesType,
  PinPropsType,
  PlaceType,
  Repository,
  RowSelection,
  ScrollType,
  ShowType,
  SwordConfigEntries,
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
    ? window.processR[envvar]()
    : process.env[envvar];
};

const isDevelopment =
  env('NODE_ENV') === 'development' && env('XULSWORD_ENV') !== 'production';

const productionLogLevel = env('DEBUG_PROD') === 'true' ? 'silly' : 'info';

const platform =
  typeof process === 'undefined' ? window.processR.platform : process.platform;

// COMMON GLOBAL CONSTANTS FOR MAIN AND RENDERER PROCESSES
const C = {
  DevToolsopen: isDevelopment ? false : env('DEBUG_PROD') === 'true',

  LogLevel: (/\S+/.test(env('LOGLEVEL') ?? '') ||
    (isDevelopment ? 'debug' : productionLogLevel)) as LogLevel,

  DevSplash: 1 as 0 | 1 | 2, // 0 normal, 1 skip, 2 debug

  isDevelopment,

  SWORDEngineVersion: '1.8.1',

  APPLICATIONID: 'xulsword@xulsword.org',

  MAXVERSE: 176,
  MAXCHAPTER: 150,

  // LibSword response constants
  NOTFOUND: 'Not Found',
  NOMODULES: 'No Modules',
  CONFSEP: '<nx>',
  GBKSEP: '/',

  Downloader: {
    localfile: 'file://' as const,
  },

  URLRE: /^https?:\/\//i,

  FTPMaxConnections: 48,
  FTPConnectTimeout: 10000, // ms for an ftp server to respond
  FTPUserName: 'anonymous', // TODO!: How to set: 'xulsword@xulsword.org',
  HTTPUserAgent: 'xulsword@xulsword.org',

  // xulsword UI constants
  UI: {
    AcceleratorKey: {
      openModuleManager: 'F2',
      toggleFullScreen: 'F11',
    },
    Window: {
      resizeDelay: 500, // ms between window resize and update
      persistentTypes: ['moduleManager'],
      large: {
        width: 1024,
        height: 728,
      },
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
    BMProperties: {
      maxSampleText: 1024,
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
  } as { [key in keyof ConfigType]: {
      modConf: keyof SwordConfigEntries | null,
      localeConf: string | null,
      CSS: string | null
    }
  },
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
  } as const,
  /* eslint-enable prettier/prettier */

  BIBLE: 'Biblical Texts' as ModTypes,
  DICTIONARY: 'Lexicons / Dictionaries' as ModTypes,
  COMMENTARY: 'Commentaries' as ModTypes,
  GENBOOK: 'Generic Books' as ModTypes,

  SupportedTabTypes: {
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
    delimited: {
      SwordModules: /;/,
      SwordVersions: /;/,
      Companion: /,/,
      AudioCode: /,/,
    },
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

  // Determines which files may be imported, and the prefered playback.
  SupportedAudio: ['mp3', 'ogg'],

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

  SYSTEMNEWLINE:
    platform === 'win32' ? '\r\n' : platform === 'darwin' ? '\r' : '\n',

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
    XSM_audio: [],
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
    XSM_audio: {},
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

  // These pref keys are always kept in sync across all windows.
  SyncPrefs: {
    xulsword: {
      audio: null,
      location: null,
      selection: null,
      scroll: null,
      show: null,
    } as unknown as Pick<
      typeof SP.xulsword,
      'audio' | 'location' | 'selection' | 'scroll' | 'show'
    >,
  },
};
export default C;

// The following state keys are stored in Prefs and can be kept in sync
// with their corresponding Prefs keys (optionally both directions):
//
// getStatePref() - read state pref keys from Prefs and/or initialize state
//                  Prefs to default values.
// setStatePref() - Run in componentDidUpdate() to push state changes to
//                  Prefs, thereby making state persistent.
// registerUpdateStateFromPref() - Run in componentDidMount() to register
//                  a listener for state Pref changes that will push
//                  changes into component state.
export const SP = {
  global: {
    WindowsDidClose: true,
    Contributors: [
      'Special Thanks To:',
      'Troy Griffitts and the SWORD Project',
      '',
      'Developers:',
      'John Austin',
      'David Booth',
      '',
      'Contributors:',
      'Abram Victorovich',
      'Allen Peleton',
      'David Haslam',
      'Wolfgang Stradner',
      'Tom Roth',
    ],
    crashReporterURL: '' as string,
    InternetPermission: false as boolean,
    fontSize: 2 as number,
    locale: '' as string,
    popup: {
      selection: {
        hebrewDef: '' as string,
        greekDef: '' as string,
        greekParse: '' as string,
      },
    },
  },

  xulsword: {
    location: null as LocationVKType | null,
    selection: null as LocationVKType | null,
    scroll: null as ScrollType,

    keys: [] as (string | null)[],

    audio: { open: false, file: null } as AudioPrefType,
    history: [] as HistoryVKType[],
    historyIndex: 0 as number,

    show: {
      headings: true,
      footnotes: true,
      crossrefs: true,
      dictlinks: true,
      versenums: true,
      strongs: true,
      morph: true,
      usernotes: true,
      hebcantillation: true,
      hebvowelpoints: true,
      redwords: true,
    } as ShowType,
    place: {
      footnotes: 'notebox',
      crossrefs: 'notebox',
      usernotes: 'popup',
    } as PlaceType,

    showChooser: true as boolean,
    tabs: [] as (string[] | null)[],
    panels: ['', '', null] as (string | null)[],
    ilModules: [] as (string | null)[],
    mtModules: [] as (string | null)[],

    isPinned: [false] as boolean[],
    noteBoxHeight: [200] as number[],
    maximizeNoteBox: [false] as boolean[],
  },

  moduleManager: {
    suggested: {} as { [fallbackLang: string]: string[] },
    language: {
      open: true as boolean,
      selection: [] as string[],
      rowSort: { column: 0, direction: 'ascending' } as TinitialRowSort,
      width: 150 as number,
    },
    module: {
      selection: [] as RowSelection,
      rowSort: { column: 0, direction: 'ascending' } as TinitialRowSort,
      visibleColumns: [0, 1, 14] as number[],
      columnWidths: [
        127, 190, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 88, 103, 80,
      ] as number[],
    },
    repository: {
      open: true as boolean,
      selection: [] as RowSelection,
      rowSort: { column: 2, direction: 'ascending' } as TinitialRowSort,
      visibleColumns: [0, 1, 2, 3] as number[],
      columnWidths: [124, 145, 343, 67] as number[],
      height: 200 as number,
    },
    repositories: {
      xulsword: [
        {
          name: 'IBT XSM',
          domain: 'ftp.ibt.org.ru',
          path: '/pub/modxsm',
          builtin: false,
          disabled: false,
          custom: false,
        },
        {
          name: 'IBT Audio',
          domain: 'ftp.ibt.org.ru',
          path: '/pub/modaudio',
          builtin: false,
          disabled: false,
          custom: false,
        },
      ],
      custom: [],
      disabled: null,
    } as {
      xulsword: Repository[];
      custom: Repository[];
      disabled: string[] | null;
    },
  },

  removeModule: {
    language: {
      open: false as boolean,
      selection: [] as string[],
      rowSort: { column: 0, direction: 'ascending' } as TinitialRowSort,
      width: 150 as number,
    },
    module: {
      selection: [] as RowSelection,
      rowSort: { column: 0, direction: 'ascending' } as TinitialRowSort,
      visibleColumns: [0, 1, 2, 13, 15] as number[],
      columnWidths: [
        150, 225, 71, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 105, 103, 95,
      ] as number[],
    },
    repository: null,
    repositories: null,
  },

  printPassage: {
    checkbox: {
      introduction: true,
      headings: true,
      versenums: true,
      redwords: true,
      dictlinks: true,
      footnotes: true,
      usernotes: true,
      crossrefs: true,
      crossrefsText: true,
      hebvowelpoints: true,
      hebcantillation: true,
    } as {
      [k in keyof Omit<ShowType, 'morph' | 'strongs'>]: boolean;
    } & {
      introduction: boolean;
      crossrefsText: boolean;
    },
    chapters: null as SelectVKMType | null,
  },

  print: {
    landscape: false as boolean,
    pageSize: 'Letter' as typeof paperSizes[number]['type'],
    twoColumns: false as boolean,
    scale: 100 as number,
    margins: {
      top: 30 as number,
      right: 20 as number,
      bottom: 30 as number,
      left: 20 as number,
    },
  },

  copyPassage: {
    checkboxes: {
      headings: true,
      versenums: true,
      redwords: true,
    } as { [k in keyof ShowType]?: boolean },
  },
};

// Fill out variable length default arrays
(['isPinned', 'noteBoxHeight', 'maximizeNoteBox'] as const).forEach((p) => {
  const v = SP.xulsword[p][0];
  SP.xulsword[p] = SP.xulsword.panels.map(() => v as any);
});

export const SPBM = {
  manager: {
    bookmarks: {
      type: 'folder',
      id: 'bmroot',
      label: 'bmroot',
      labelLocale: 'en',
      note: '',
      noteLocale: 'en',
      creationDate: new Date().valueOf(),
      hasCaret: true,
      childNodes: [],
    } as BookmarkFolderType,
  },
};
