/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */

import type {
  ModTypes,
  PlaceType,
  ShowType,
  SwordFilterType,
  SwordFilterValueType,
  TabTypes,
} from './type';

// Common Global Constants
const C = {
  FPERM: 0o666,
  DPERM: 0o666,
  MAXVERSE: 176,
  MAXCHAPTER: 150,
  DEVELSPLASH: 1 as 0 | 1 | 2, // 0 normal, 1 skip, 2 debug
  BIBLE: 'Biblical Texts' as ModTypes,
  DICTIONARY: 'Lexicons / Dictionaries' as ModTypes,
  COMMENTARY: 'Commentaries' as ModTypes,
  GENBOOK: 'Generic Books' as ModTypes,
  NOTFOUND: 'Not Found',
  NOMODULES: 'No Modules',
  CONFSEP: '<nx>',
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
  TextHeaderHeight: 30,
  TextBBTopMargin: 30,
  TextBBBottomMargin: 30,

  NumOT: 39,
  NumNT: 27,
  BOOKGROUPS: ['ot', 'nt'],
  NW: 3, // max number of text windows a single viewport supports

  // scrolling
  SCROLLTYPENONE: 0, // don't scroll single-column windows, but scroll multi-column windows to center.
  SCROLLTYPECHAP: 1, // scroll to top of current chapter
  SCROLLTYPEBEG: 2, // put selected verse at the top
  SCROLLTYPECENTER: 3, // put selected verse in the middle, unless verse is already visible or is verse 1
  SCROLLTYPECENTERALWAYS: 4, // put selected verse in the middle even if verse is already visible or verse 1
  SCROLLTYPEEND: 5, // put selected verse at the end
  SCROLLTYPEENDSELECT: 6, // put selected verse at the end, then select the first visible verse without scrolling
  SCROLLTYPEDELTA: 7, // scroll GenBook by given delta in pixels

  BIN: { win32: 'dll', linux: 'so', darwin: 'dylib' },

  IsExtension: false,

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

  // These props can be 'pinned' to become independant state properties.
  // NOTE: property types are important, but property values are not.
  PinProps: {
    book: '',
    chapter: 0,
    verse: 0,
    selection: '',
    flagScroll: 0,
    module: '',
    ilModule: '',
    modkey: '',
  },

  // These props are used by LibSword. If these props all have the same values
  // as the previous rendering, the LibSword response will also be the same.
  // NOTE: property types are important, but property values are not.
  LibSwordPropsTexts: {
    book: '',
    chapter: 0,
    module: '',
    columns: 0,
    versification: '',
    ilModule: '',
    show: {} as ShowType,
    place: {} as PlaceType,
  },
  LibSwordPropsComms: {
    book: '',
    chapter: 0,
    module: '',
    versification: '',
  },
  LibSwordPropsDicts: {
    module: '',
    modkey: '',
  },
  LibSwordPropsGenbks: {
    module: '',
    modkey: '',
  },
  LibSwordProps: {} as { [key in ModTypes]: { [i: string]: any } },

  // These props are used to scroll text. If these props all have the
  // same values as the previous rendering, and the same is true for
  // the LibSwordProps, then scrolling is also unnecessary.
  // NOTE: property types are important, but property values are not.
  ScrollPropsTexts: {
    module: '',
    book: '',
    chapter: '',
    verse: 0,
    columns: 0,
    flagScroll: 0,
  },
  ScrollPropsComms: {
    module: '',
    book: '',
    chapter: '',
    verse: 0,
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

C.ScrollProps[C.BIBLE] = C.ScrollPropsTexts;
C.ScrollProps[C.COMMENTARY] = C.ScrollPropsComms;
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
