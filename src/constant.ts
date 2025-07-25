/* eslint-disable @typescript-eslint/naming-convention */
import type { LogLevel } from 'electron-log';
import type {
  BookGroupType,
  ConfigType,
  FeatureMods,
  ModTypes,
  NewModulesType,
  Repository,
  ShowType,
  SwordConfigEntries,
  SwordFilterType,
  SwordFilterValueType,
  TabType,
  TabTypes,
  V11nType,
} from './type.ts';

// COMMON GLOBAL CONSTANTS FOR SERVER AND CLIENT PROCESSES
const C = {
  // Set DevToolsopen to true to open DevTools immediately- can be helpful for
  // debugging window initialization problems.
  DevToolsopen: false,

  LogLevel: (process.env.LOGLEVEL ||
    (Build.isDevelopment ? 'debug' : 'info')) as LogLevel,

  DevSplash: 1 as 0 | 1 | 2, // 0 normal, 1 skip, 2 debug

  URL: 'https://github.com/JohnAustinDev/xulsword',

  SWORDEngineVersion: '1.9.0',

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
  FTPConnectTimeout: 20000, // ms for an ftp server to respond
  FTPPassword: 'xulsword4@xulsword.org',
  HTTPUserAgent: 'xulsword4@xulsword.org',

  SYSTEMNEWLINE:
    platform() === 'win32' ? '\r\n' : platform() === 'darwin' ? '\r' : '\n',
  FSSEP: platform() === 'win32' ? '\\' : '/',

  Server: {
    maxDataStringLength: 1000000, // bytes (search results can be large)
    maxLogJson: 10000, // bytes
    maxDataRecursion: 20, // Some Genbk TOC nodes have at least > 11
    maxDataArrayLength: 1300, // SHRDICT has 1209 entries (next IBT is KKDLDICT at 526 but StrongsHebrew has 8675)
    maxDataObjectKeys: 512,
    ipLimit: Build.isDevelopment
      ? {
          points: 10, // x ip hits
          duration: 2, // per y second
        }
      : {
          points: 25, // x ip hits
          duration: 5, // per y second
        },
    limitedMustWait: Build.isDevelopment ? 1000 : 5000, // ms
    networkRequestMinCache: 60000, // ms
    networkRequestBatchDelay: 1, // ms
  },

  // xulsword UI constants
  UI: {
    WebApp: {
      narrowW: 300, // px up to which is considered narrow screen
      mobileW: 767, // px up to which is considered mobile
      tabletW: 1027, // px up to which is tablet
    },
    AcceleratorKey: {
      openModuleManager: 'F2',
      toggleFullScreen: 'F11',
    },
    Window: {
      resizeDelay: 200, // ms between window resize and update
      large: {
        width: 1024,
        height: 728,
      },
    },
    Browser: {
      maxPanels: 4,
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
    },
    Chooser: {
      bookgroupHoverDelay: 300, // ms until bookGroup is changed
      mouseScrollMargin: 40, // px inward from top or bottom border
      headingMenuOpenDelay: 400, // ms until BIble heading menu opens
    },
    Popup: {
      openGap: 0, // open popup px below target element
      strongsOpenGap: 80, // px
      openDelay: 100, // ms between hover and popup opening
      strongsOpenDelay: 550, // ms
      wheelDeadTime: 1000, // ms of dead-time after wheel-scroll
    },
    Atext: {
      fontSize: 14, // px nominal font-size
      fontSizeOptionDelta: 1.3, // px step
      dictKeyInputDelay: 1000, // ms between keydown and update
      wheelScrollDelay: 300, // ms between UI updates while scrolling
      mobileScrollDelay: 300, // ms between UI updates while mobile scrolling
      multiColWheelScrollDelay: 100,
      prevNextDelay: 500, // ms before prev/next chapter links are rendered
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
      backgroundIndexerStartupWait: 20000, // wait before starting background indexer
      backgroundIndexerTimeout: 600000, // time working on background index before canceling
    },
    Print: {
      viewMargin: 20, // margin around and between top level components
      maxPages: 25,
    },
    BMProperties: {
      sampleTextLength: 1024,
    },
    BMManager: {
      searchResultBreakAfter: 128,
    },
    TreeScrollDelay: 100,
  },

  CompressibleCalls: {
    map: {
      Tabs: [[], 'TabType'],
      Tab: [{}, 'TabType'],
      Config: [{}, 'MConfigType'],
      LocaleConfigs: [{}, 'LConfigType'],
    },
    common: {
      TabType: {
        module: 'none',
        lang: 'none',
        description: { locale: 'none', en: 'none' },
        audioCodes: [],
        tabType: 'Texts',
        type: 'Biblical Texts',
        xsmType: 'none',
        isVerseKey: true,
        direction: 'ltr',
        features: [],
        v11n: 'KJV',
        label: 'none',
        labelClass: 'none',
      } as TabType,
      MConfigType: {
        direction: 'ltr',
        fontFamily: "'GentiumPlusCyrE'",
        fontSizeAdjust: null,
        lineHeight: null,
        fontSize: null,
        color: null,
        background: null,
        AssociatedModules: null,
        AssociatedLocale: null,
        PreferredCSSXHTML: null,
      } as ConfigType,
      LConfigType: {
        direction: 'ltr',
        fontFamily: '',
        fontSizeAdjust: '',
        lineHeight: '',
        fontSize: '',
        color: '',
        background: '',
        AssociatedModules: null,
        AssociatedLocale: null,
        PreferredCSSXHTML: null,
      } as ConfigType,
    },
  } as const,

  // These are all the properties which Config type objects will have.
  // The Config object specifies keys into the following data sources:
  //   modConf = a module config file entry
  //   localeConf = a locale config.json entry
  // It also specifies any corresponding CSS property if there is one.
  // prettier-ignore
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
  } satisfies { [key in keyof ConfigType]: {
      modConf: keyof SwordConfigEntries | null,
      localeConf: string | null,
      CSS: string | null
    }
  },

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
    ['sl', 'Slovenščina', 'ltr'],
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
    sl: 'en',
    'tk-Latn': 'en',
    'tt-Cyrl': 'ru',
    'uz-Cyrl': 'ru',
    'uz-Latn': 'en',
  } as Record<string, string>,

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
  // other verse systems. Only LXX and Orthodox currently lack maps.
  SupportedV11nMaps: [
    'KJV',
    'KJVA',
    // From C++ SWORD
    'Calvin',
    'DarbyFr',
    //'NRSV', SWORD was incorrect so replaced by JSword
    //'Segond',  SWORD was incorrect so replaced by JSword
    'Synodal',
    'Vulg',
    // From JSword
    'Catholic',
    'Catholic2',
    'German',
    'Leningrad',
    'Luther',
    'MT',
    'NRSV',
    'NRSVA',
    'Segond',
    'SynodalProt',
  ] as V11nType[],

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
  // prettier-ignore
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

  SwordBultinRepositories: [
    {
      name: 'i18n:shared.label',
      domain: 'file://',
      path: 'xulsword://xsModsCommon',
    },
    {
      name: 'i18n:program.title',
      domain: 'file://',
      path: 'xulsword://xsModsUser',
    },
    {
      name: 'i18n:audio.label',
      domain: 'file://',
      path: 'xulsword://xsAudio',
    },
  ] as Repository[],

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
    HebrewDef: /S_H/,
    GreekDef: /S_G/,
    GreekParse: /SM_G/,
  } as { [key in keyof FeatureMods]?: RegExp },

  LocalePreferredFeature: {
    en: {
      HebrewDef: ['StrongsHebrew'],
      GreekDef: ['StrongsGreek'],
      GreekParse: [''],
    },
    ru: {
      HebrewDef: ['StrongsHebrewRU'],
      GreekDef: ['StrongsGreekRU'],
      GreekParse: [''],
    },
  } as { [k in 'en' | 'ru']: Partial<FeatureMods> },

  // These Atext props can be 'pinned' to become independant state properties.
  PinProps: [
    'location',
    'selection',
    'scroll',
    'show',
    'place',
    'module',
    'ilModule',
    'modkey',
  ] as const,

  // These Atext props are used by LibSword. If these props all have the same values
  // as the previous rendering, the LibSword response will also be the same.
  LibSwordProps: {
    'Biblical Texts': [
      'location',
      'module',
      'show',
      'place',
      'columns',
      'ilModule',
      'ilModuleOption',
    ],
    Commentaries: ['location', 'module', 'show', 'place'],
    'Lexicons / Dictionaries': ['module', 'modkey', 'show'],
    'Generic Books': ['module', 'modkey', 'show'],
    XSM_audio: [],
  } as const,

  // These Atext props effect the verse scroll. If these props all have
  // the same values as the previous rendering, and the same is true of
  // the LibSwordProps, then scrolling is also unnecessary.
  ScrollPropsVK: ['module', 'location', 'scroll', 'columns'] as const,

  PanelPrefArrays: [
    'panels',
    'keys',
    'ilModules',
    'mtModules',
    'tabs',
    'isPinned',
    'noteBoxHeight',
    'maximizeNoteBox',
  ] as const,
};
export default C;

function platform() {
  if ('process' in globalThis) return globalThis.process.platform;
  if ('ProcessInfo' in window) return window.ProcessInfo.platform;
}
