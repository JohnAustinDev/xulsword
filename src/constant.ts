/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BookGroupType,
  ConfigType,
  LocationVKType,
  ModTypes,
  PlaceType,
  ShowType,
  SwordFilterType,
  SwordFilterValueType,
  TabTypes,
  V11nType,
} from './type';

// Common Global Constants
const C = {
  DEVELSPLASH: 1 as 0 | 1 | 2, // 0 normal, 1 skip, 2 debug
  MAXVERSE: 176,
  MAXCHAPTER: 150,
  BIBLE: 'Biblical Texts' as ModTypes,
  DICTIONARY: 'Lexicons / Dictionaries' as ModTypes,
  COMMENTARY: 'Commentaries' as ModTypes,
  GENBOOK: 'Generic Books' as ModTypes,
  NOTFOUND: 'Not Found',
  NOMODULES: 'No Modules',
  CONFSEP: '<nx>',

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

  FallbackLanguage: {
    en: 'en',
    ru: 'en',
    'crh-Cyrl': 'ru',
    fa: 'ru',
    kk: 'ru',
    ko: 'en',
    kum: 'ru',
    'ky-Arab': 'ru',
    'ky-Cyrl': 'ru',
    'ru-CA': 'ru',
    'tk-Latn': 'ru',
    'tt-Cyrl': 'ru',
    'uz-Cyrl': 'ru',
    'uz-Latn': 'ru',
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

  BMFileReturn: '\r\n', // used in imported/exported bookmarks.txt because < 3.6 could only read files with this newline.
  DEFAULTLOCALE: 'en',
  DLGSTD: 'centerscreen,modal,resizable',
  DLGALERT: 0,
  DLGQUEST: 1,
  DLGINFO: 2,
  DLGOK: 0,
  DLGOKCANCEL: 1,
  DLGYESNO: 2,
  WESTERNVS: 'KJV',
  EASTERNVS: 'Synodal',
  TOOLTIP_LEN: 96,
  DEFAULTS: 'defaults',
  PREFERENCES: 'preferences',
  MODSD: 'mods.d',
  MODS: 'modules',
  LOCALE: 'locale',
  LOCALED: 'locales.d',
  CHROME: 'chrome',
  FONTS: 'fonts',
  AUDIO: 'audio',
  BOOKMARKS: 'bookmarks',
  VIDEO: 'video',
  MANIFEST_EXT: '.manifest',
  CONF_EXT: '.conf',
  EXTENSION_EXT: '.xpi',
  PMSTD: 'centerscreen, dependent',
  PMSPLASH: 'alwaysRaised,centerscreen',
  PMMODAL: 'alwaysRaised,centerscreen,modal',
  PMNORMAL: 0,
  PMSTOP: 1,
  APPLICATIONID: 'xulsword@xulsword.org',
  FIREFOXUID: 'ec8030f7-c20a-464f-9b0e-13a3a9e97384',
  VERSIONPAR: 'xulswordVersion',
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
  AUDMIME: { mp3: 'audio/mpeg', ogg: 'audio/ogg' },
  LOCALEPREF: 'global.locale',
  MSMOVE: 'mousemove',
  MSOVER: 'mouseover',
  MSOUT: 'mouseout',

  // bookmark/personal-note fields
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

  // xulsword UI constants
  UI: {
    Window: {
      resizeDelay: 500, // ms between window resize and update
    },
    Xulsword: {
      maxHistoryMenuLength: 20,
      historyDelay: 1000, // ms before new location is saved
    },
    Viewport: {
      minPanelWidth: 200, // px
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
      prevNextHeight: 30, // px
      bbTopMargin: 60, // px
      bbBottomMargin: 30, // px
    },
  },

  SwordFilterValues: [] as SwordFilterValueType[],

  SwordFilters: {} as { [key in SwordFilterType]: keyof ShowType },

  SupportedModuleTypes: {} as { [key in ModTypes]: TabTypes },

  AlwaysOn: {} as { [key in ModTypes]: SwordFilterType[] },

  ModuleTypeOrder: {
    Texts: 1,
    Comms: 2,
    Genbks: 3,
    Dicts: 4,
  },

  SEP: ',',
  TIMEOUT: 25,
  XSMODEXT: ['zip', 'xsm'],
  XSBMEXT: ['txt', 'xsb'],
  XSVIDEXT: ['wmv', 'mov', 'mpeg', 'mpg', 'avi'],
  NOVALUE: -1,
  NORESET: 0,
  SOFTRESET: 1,
  HARDRESET: 2,
  NEWINSTALLFILE: 'newInstalls.txt',
  MINPVERPAR: 'minMKVersion',
  VERSIONTAG: null as any,
  MINPROGVERSTAG: null as any,
  MINVERSION: '1.0',

  // These Atext props can be 'pinned' to become independant state properties.
  // NOTE: property types are important, but property values are not.
  PinProps: {
    location: null as LocationVKType | null,
    selection: null as LocationVKType | null,
    flagScroll: 0,
    module: '' as string | null,
    ilModule: '' as string | null,
    modkey: '' as string | null,
  },

  // These Atext props are used by LibSword. If these props all have the same values
  // as the previous rendering, the LibSword response will also be the same.
  // NOTE: property types are important, but property values are not.
  LibSwordPropsTexts: {
    location: null as LocationVKType | null,
    module: '',
    show: {} as ShowType,
    place: {} as PlaceType,
    columns: 0,
    ilModule: '',
  },
  LibSwordPropsComms: {
    location: null as LocationVKType | null,
    module: '',
    show: {} as ShowType,
    place: {} as PlaceType,
  },
  LibSwordPropsDicts: {
    module: '',
    modkey: '',
    show: {} as ShowType,
  },
  LibSwordPropsGenbks: {
    module: '',
    modkey: '',
    show: {} as ShowType,
  },
  LibSwordProps: {} as { [key in ModTypes]: { [i: string]: any } },

  // Versekey (that is Bible and commentary) verse scrolling
  VSCROLL: {
    none: 0, // skip the scroll step (which comes after Atext render)
    chapter: 1, // put state chapter heading at the top of the first panel
    verse: 2, // put state verse at the top of the first panel
    center: 3, // put state verse in the middle of the first panel, unless verse is already visible or is verse 1
    centerAlways: 4, // try to put state verse in the middle of the first panel in any case
    end: 5, // put state verse at the end of the last panel
    endAndUpdate: 6, // put state verse at the end of the last panel, then change state to the resulting first visible verse
  },

  // These Atext props are used to scroll text. If these props all have
  // the same values as the previous rendering, and the same is true of
  // the LibSwordProps, then scrolling is also unnecessary.
  // NOTE: property types are important, but property values are not.
  ScrollPropsVK: {
    module: '',
    location: null as LocationVKType | null,
    columns: 0,
    flagScroll: 0,
  },
  ScrollPropsDicts: {},
  ScrollPropsGenbks: {},
  ScrollProps: {} as { [key in ModTypes]: { [i: string]: any } },
};

C.VERSIONTAG = new RegExp(`${C.VERSIONPAR}\\s*=\\s*(.*)\\s*`, 'im');

C.MINPROGVERSTAG = new RegExp(`${C.MINPVERPAR}\\s*=\\s*(.*)\\s*`, 'im');

C.SwordFilters.Headings = 'headings';
C.SwordFilters.Footnotes = 'footnotes';
C.SwordFilters['Cross-references'] = 'crossrefs';
C.SwordFilters['Reference Material Links'] = 'dictlinks';
C.SwordFilters["Strong's Numbers"] = 'strongs';
C.SwordFilters['Morphological Tags'] = 'morph';
C.SwordFilters['Verse Numbers'] = 'versenums';
C.SwordFilters['Hebrew Cantillation'] = 'hebcantillation';
C.SwordFilters['Hebrew Vowel Points'] = 'hebvowelpoints';
C.SwordFilters['Words of Christ in Red'] = 'redwords';

C.SwordFilterValues.push('Off');
C.SwordFilterValues.push('On');

C.SupportedModuleTypes[C.BIBLE] = 'Texts';
C.SupportedModuleTypes[C.COMMENTARY] = 'Comms';
C.SupportedModuleTypes[C.DICTIONARY] = 'Dicts';
C.SupportedModuleTypes[C.GENBOOK] = 'Genbks';

C.LibSwordProps[C.BIBLE] = C.LibSwordPropsTexts;
C.LibSwordProps[C.COMMENTARY] = C.LibSwordPropsComms;
C.LibSwordProps[C.DICTIONARY] = C.LibSwordPropsDicts;
C.LibSwordProps[C.GENBOOK] = C.LibSwordPropsGenbks;

C.ScrollProps[C.BIBLE] = C.ScrollPropsVK;
C.ScrollProps[C.COMMENTARY] = C.ScrollPropsVK;
C.ScrollProps[C.DICTIONARY] = C.ScrollPropsDicts;
C.ScrollProps[C.GENBOOK] = C.ScrollPropsGenbks;

// Each module type may have LibSword features that should be always on.
C.AlwaysOn[C.BIBLE] = [];
C.AlwaysOn[C.COMMENTARY] = [
  'Headings',
  'Footnotes',
  'Cross-references',
  'Reference Material Links',
];
C.AlwaysOn[C.DICTIONARY] = [
  'Headings',
  'Footnotes',
  'Cross-references',
  'Reference Material Links',
];
C.AlwaysOn[C.GENBOOK] = [
  'Headings',
  'Footnotes',
  'Cross-references',
  'Reference Material Links',
];

export default C;
