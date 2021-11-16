/* eslint-disable no-nested-ternary */

// Common Global Constants
const C = {
  Languages: [
    ['en', 'English'],
    ['ru', 'русский'],
  ],
  FPERM: 0o666,
  DPERM: 0o666,
  ORIGINAL: 'ORIG', // Value doen't really matter, just a export const
  MAXVERSE: 176,
  MAXCHAPTER: 150,
  BIBLE: 'Biblical Texts',
  DICTIONARY: 'Lexicons / Dictionaries',
  COMMENTARY: 'Commentaries',
  GENBOOK: 'Generic Books',
  NOTFOUND: 'Not Found',
  BMFileReturn: '\r\n', // used in imported/exported bookmarks.txt because < 3.6 could only read files with this newline.
  DEFAULTLOCALE: 'en-US',
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

  NumOT: 39,
  NumNT: 27,
  BOOKGROUPS: ['ot', 'nt'],
  NW: 3, // max number of text windows a single viewport supports

  // scrolling
  SCROLLTYPENONE: 0, // don't scroll un-linked windows, but scroll linked windows to center.
  SCROLLTYPETOP: 1, // scroll to top of current chapter
  SCROLLTYPEBEG: 2, // put selected verse at the top of the window or link
  SCROLLTYPECENTER: 3, // put selected verse in the middle of the window or link, unless verse is already visible or verse 1
  SCROLLTYPECENTERALWAYS: 4, // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
  SCROLLTYPEEND: 5, // put selected verse at the end of the window or link, and don't change selection
  SCROLLTYPEENDSELECT: 6, // put selected verse at the end of the window or link, then select first verse of link or verse 1
  SCROLLTYPEDELTA: 7, // scroll by given delta in pixels
  SCROLLTYPEPREVIOUS: 8, // scroll exactly as previous

  // highlighting
  HILIGHTNONE: 0, // highlight no verse
  HILIGHTVERSE: 1, // highlight selected verse in blue
  HILIGHT_IFNOTV1: 2, // highlight selected verse in blue unless it is verse 1
  HILIGHTPREVIOUS: 3, // do same hilight type as during previous update
  HILIGHTSKIP: 4, // skip hilighting step to speed things up- any previously hilighted verse(s) will remain so

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

  GlobalToggleCommands: {
    cmd_xs_toggleHeadings: 'Headings',
    showFootnotes: 'Footnotes',
    showCrossRefs: 'Cross-references',
    showDictLinks: 'Reference Material Links',
    showStrongs: "Strong's Numbers",
    showMorph: 'Morphological Tags',
    showVerseNums: 'Verse Numbers',
    showUserNotes: 'User Notes',
    showHebCantillation: 'Hebrew Cantillation',
    showHebVowelPoints: 'Hebrew Vowel Points',
    showRedWords: 'Words of Christ in Red',
  },

  SupportedModuleTypes: {},

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
  VERSIONTAG: null,
  MINPROGVERSTAG: null,
  MINVERSION: '1.0',
};

C.VERSIONTAG = new RegExp(`${C.VERSIONPAR}\\s*=\\s*(.*)\\s*`, 'im');

C.MINPROGVERSTAG = new RegExp(`${C.MINPVERPAR}\\s*=\\s*(.*)\\s*`, 'im');

C.SupportedModuleTypes = {
  Texts: C.BIBLE,
  Comms: C.COMMENTARY,
  Dicts: C.DICTIONARY,
  Genbks: C.GENBOOK,
};

export default C;
