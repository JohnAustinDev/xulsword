/* eslint-disable no-nested-ternary */

// Common Global Constants
export const FPERM = 511; // 0777; // 511;
export const DPERM = 511; // 0777; // 511;
export const ORIGINAL = 'ORIG'; // Value doen't really matter, just a export const
export const MAXVERSE = 176;
export const MAXCHAPTER = 150;
export const BIBLE = 'Biblical Texts';
export const DICTIONARY = 'Lexicons / Dictionaries';
export const COMMENTARY = 'Commentaries';
export const GENBOOK = 'Generic Books';
export const NOTFOUND = 'Not Found';
export const BMFileReturn = '\r\n'; // used in imported/exported bookmarks.txt because < 3.6 could only read files with this newline.
export const DEFAULTLOCALE = 'en-US';
export const DLGSTD = 'centerscreen,modal,resizable';
export const DLGALERT = 0;
export const DLGQUEST = 1;
export const DLGINFO = 2;
export const DLGOK = 0;
export const DLGOKCANCEL = 1;
export const DLGYESNO = 2;
export const WESTERNVS = 'KJV';
export const EASTERNVS = 'Synodal';
export const TOOLTIP_LEN = 96;
export const DEFAULTS = 'defaults';
export const PREFERENCES = 'preferences';
export const MODSD = 'mods.d';
export const MODS = 'modules';
export const LOCALE = 'locale';
export const LOCALED = 'locales.d';
export const CHROME = 'chrome';
export const FONTS = 'fonts';
export const AUDIO = 'audio';
export const BOOKMARKS = 'bookmarks';
export const VIDEO = 'video';
export const MANIFEST_EXT = '.manifest';
export const CONF_EXT = '.conf';
export const EXTENSION_EXT = '.xpi';
export const PMSTD = 'centerscreen, dependent';
export const PMSPLASH = 'alwaysRaised,centerscreen';
export const PMMODAL = 'alwaysRaised,centerscreen,modal';
export const PMNORMAL = 0;
export const PMSTOP = 1;
export const APPLICATIONID = 'xulsword@xulsword.org';
export const FIREFOXUID = 'ec8030f7-c20a-464f-9b0e-13a3a9e97384';
export const VERSIONPAR = 'xulswordVersion';
export const LOCALE_SEARCH_SYMBOLS = {
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
};
export const AUDMIME = { mp3: 'audio/mpeg', ogg: 'audio/ogg' };
export const LOCALEPREF = 'general.useragent.locale';
export const MSMOVE = 'mousemove';
export const MSOVER = 'mouseover';
export const MSOUT = 'mouseout';

export const NumOT = 39;
export const NumNT = 27;
export const NW = 3; // max number of text windows a single viewport supports

// scrolling
export const SCROLLTYPENONE = 0; // don't scroll un-linked windows, but scroll linked windows to center.
export const SCROLLTYPETOP = 1; // scroll to top of current chapter
export const SCROLLTYPEBEG = 2; // put selected verse at the top of the window or link
export const SCROLLTYPECENTER = 3; // put selected verse in the middle of the window or link, unless verse is already visible or verse 1
export const SCROLLTYPECENTERALWAYS = 4; // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
export const SCROLLTYPEEND = 5; // put selected verse at the end of the window or link, and don't change selection
export const SCROLLTYPEENDSELECT = 6; // put selected verse at the end of the window or link, then select first verse of link or verse 1
export const SCROLLTYPEDELTA = 7; // scroll by given delta in pixels
export const SCROLLTYPEPREVIOUS = 8; // scroll exactly as previous

// highlighting
export const HILIGHTNONE = 0; // highlight no verse
export const HILIGHTVERSE = 1; // highlight selected verse in blue
export const HILIGHT_IFNOTV1 = 2; // highlight selected verse in blue unless it is verse 1
export const HILIGHTPREVIOUS = 3; // do same hilight type as during previous update
export const HILIGHTSKIP = 4; // skip hilighting step to speed things up- any previously hilighted verse(s) will remain so
