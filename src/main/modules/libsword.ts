/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-continue */
/* eslint-disable new-cap */
import C from '../../constant';
import Cache from '../../cache';
import { jsdump } from '../mutil';
import nsILocalFile from '../components/nsILocalFile';
import Dirs from './dirs';
import Prefs from './prefs';

import type { GType, SwordFilterType, SwordFilterValueType } from '../../type';

const { libxulsword } = require('libxulsword');

type LibSwordPrivate = {
  moduleDirectory: string;
  localeDirectory: string;
  checkCipherKeys: string[];

  libxulsword: null | Record<string, unknown>;
  paused: boolean;

  searchPointers: any[];
  upperCaseResult: string;
  throwMsg: string;

  UpperCase: (s: string) => string | null;
  ThrowJSError: (ptr: any) => void;
  ReportProgress: (i: number) => void;

  unlock: () => void;
  checkerror: () => void;
};

/*
This LibSword object is used to access all SWORD engine capabilities
and information, including texts, searches etc. This object utilizes
a node API module to access the libxulsword dynamic library. The
libxulsword dynamic library is a custom interface compiled from Cross-
Wire's C++ SWORD engine.

OPTIONAL NON-STANDARD SWORD MODULE CONFIGURATION FILE ENTRIES:
Valid for all modules:
  C.ConfigTemplate modConf keys (see constant.ts)

Valid for Bible modules:
  Scope (see https://github.com/JohnAustinDev/osis-converters)
  AudioCode (see https://github.com/JohnAustinDev/osis-converters)
  NoticeLink and NoticeText - Used to display a prominent message about a text.

Valid for Dictionary modules:
  KeySort (see https://github.com/JohnAustinDev/osis-converters)
*/
const LibSword: GType['LibSword'] & LibSwordPrivate = {
  libxulsword: null, // object returned by libxulsword node API module
  paused: false,

  moduleDirectory: '',
  localeDirectory: '',

  checkCipherKeys: [],
  searchPointers: [],

  init() {
    if (this.libxulsword) return false;

    jsdump('Initializing libsword...');

    this.moduleDirectory = Dirs.path.xsModsUser;

    this.localeDirectory = Dirs.path.xsLocale;

    // copy locale defaults if needed
    const localeConf = new nsILocalFile(this.localeDirectory);
    localeConf.append('locales.conf');
    if (!localeConf.exists()) {
      const def = Dirs.xsDefaults;
      def.append('locales.conf');
      const locdir = new nsILocalFile(this.localeDirectory);
      if (def.exists()) {
        def.copyTo(locdir);
      }
    }

    jsdump(`module directory: ${this.moduleDirectory}`);

    // These functions are used by C++ to call, and receive results from,
    // Javascript functions. This method provides a way for special tasks,
    // such as Unicode processing, or progress reporting, to be performed by
    // Mozilla Javascript rather than by libxulsword C++ (which otherwise
    // would create troublesome library dependencies).
    // var funcTypeUpperCasePtr = ctypes.FunctionType(ctypes.default_abi, ctypes.PointerType(ctypes.char), [ctypes.ArrayType(ctypes.char)]).ptr;
    // this.UpperCasePtr = funcTypeUpperCasePtr(this.UpperCase);

    // var funcTypeThrowJSErrorPtr = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, [ctypes.PointerType(ctypes.char)]).ptr;
    // this.ThrowJSErrorPtr = funcTypeThrowJSErrorPtr(this.ThrowJSError);

    // var funcTypeReportProgressPtr = ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, [ctypes.int]).ptr;
    // this.ReportProgressPtr = funcTypeReportProgressPtr(this.ReportProgress);

    // Get our xulsword instance...
    this.libxulsword = libxulsword.GetXulsword(
      this.moduleDirectory,
      this.UpperCase,
      this.ThrowJSError,
      this.ReportProgress,
      this.localeDirectory
    );
    jsdump(`CREATED libxulsword object`);

    return true;
  },

  quit() {
    if (this.libxulsword) {
      this.searchPointers.forEach((sp, i) => {
        if (!sp) return;
        libxulsword.FreeSearchPointer(sp, 'searchPointer');
        this.searchPointers[i] = null;
      });
      libxulsword.FreeLibXulsword();
      jsdump('DELETED libxulsword object');
    }
    this.libxulsword = null;
  },

  isReady() {
    if (this.libxulsword) return true;
    jsdump(
      `ERROR: libsword was called while uninitialized: ${new Error().stack}`
    );
    return false;
  },

  // Unlock encrypted SWORD modules
  unlock() {
    const mlist = this.getModuleList();
    if (!mlist || mlist === 'No Modules' || mlist.search(C.BIBLE) === -1) {
      return;
    }

    let msg = '';
    const mods = mlist.split('<nx>');
    for (let m = 0; m < mods.length; m += 1) {
      const [mod, type] = mods[m].split(';');

      if (type !== C.BIBLE) continue; // only Bible modules are encrypted?

      // We don't need to supply a cipher key if the CipherKey conf
      // entry is not present (the module is not encrypted) or else if
      // it is present with a value (cipher key is supplied in conf file).
      if (!/^\s*$/.test(this.getModuleInformation(mod, 'CipherKey'))) continue;

      // The module is encrypted but the CipherKey is not supplied in the
      // .conf file. So we need to get a key from prefs or from the
      // xulsword security module.
      let cipherKey;
      try {
        cipherKey = Prefs.getCharPref(`CipherKey${mod}`);
      } catch (er) {
        cipherKey = '0';
      }
      this.setCipherKey(mod, cipherKey, false);

      // If our key is from prefs, then later on check that it works,
      // and if it does not, the user should be asked to enter a
      // different key.
      this.checkCipherKeys.push(mod);

      if (cipherKey) msg += `${mod}(${cipherKey}) `;
    }
    jsdump(`Opening:${msg}\n`);
  },

  // reports last error logged by previous LibSword call
  checkerror() {
    if (this.throwMsg) {
      const tmp = this.throwMsg;
      this.throwMsg = '';
      throw Error(`LIBSWORD: ${tmp}`);
    }
  },

  /* ******************************************************************************
   * Callback functions available to libsword binary
   ***************************************************************************** */

  // NOTE: these are invoked as functions by libsword, so 'this' will refer to global context!

  upperCaseResult: '',
  UpperCase(aString) {
    if (aString) {
      LibSword.upperCaseResult = aString.toUpperCase();
      return LibSword.upperCaseResult; // assigning to LibSword member keeps pointer alive
    }
    return null;
  },

  throwMsg: '',
  ThrowJSError(charPtr) {
    const aString = charPtr.readString();
    libxulsword.freeMemory(charPtr, 'char');
    if (aString) LibSword.throwMsg = aString;
    else LibSword.throwMsg = 'An unknown libsword exception occurred.';
  },

  ReportProgress(intgr) {
    // NOTE: postMessage is a ChromeWorker function
    if (typeof postMessage === 'function') postMessage(intgr);
  },

  /* ******************************************************************************
   * GETTING BIBLE TEXT AND BIBLE LOCATION INFORMATION:
   ****************************************************************************** */
  /*
DEFINITION OF A 'XULSWORD REFERENCE':
  Xulsword references don't cross chapter boundaries. The smallest reference
  is to a single verse, and the largest is to a whole chapter. Xulsword references
  take one of the following forms:

  Standard OsisRef form:
    Gen.5             --> Genesis chapter 5
    Gen.5.6           --> Genesis chapter 5 verse 6
    Gen.5.6.7         --> (non-standard xulsword only) Genesis chapter 5 verses 6 through 7

  Other valid forms:
    Gen 5             --> same as Gen.5
    Gen 5:6           --> same as Gen.5.6
    Gen 5:6-7         --> same as Gen.5.6.7

  Treated as a valid form, but may not always return the complete reference text:
    Gen 5:6 - Gen 5:9 --> same as Gen.5.6.9 but the second book and chapter
                          are completely ignored; only the second verse is parsed
                          (because xulsword references never cross chapter boundaries).
*/

  // getChapterText
  // Will return a chapter of text with footnote markers from module Vkeymod.
  // Vkeymod must be a module having a key type of versekey (Bibles & commentaries),
  // otherwise null is returned.
  getChapterText(
    modname,
    vkeytext,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) {
    if (options) this.setGlobalOptions(options);
    if (!this.isReady('getChapterText')) return null;
    const chapterText = libxulsword.GetChapterText(modname, vkeytext);
    this.checkerror();
    return chapterText;
  },

  // getChapterTextMulti
  // Will return chapter text in interlinear style.
  // Footnote markers are NOT included unless keepnotes is true.
  // Vkeymodlist is formatted as follows: 'UZV,TR,RSTE'. The first module must be a
  //   versekey module or an error is returned. If any successive module is not a
  //   versekey module, it is simply ignored. Verse numbers retured are those of
  //   the first module listed, subsequent modules return the same reference as
  //   that returned by the first, even though it may have come from a different
  //   chapter or verse number than did the first.
  getChapterTextMulti(
    modstrlist,
    vkeytext,
    keepnotes = false,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) {
    if (!this.isReady('getChapterTextMulti')) return null;
    if (options) this.setGlobalOptions(options);
    const chapterTextMulti = libxulsword.GetChapterTextMulti(
      modstrlist,
      vkeytext,
      keepnotes
    );
    this.checkerror();
    return chapterTextMulti;
  },

  // IMPORTANT: THE FOLLOWING 3 ROUTINES MUST BE CALLED AFTER getChapterText or getChapterTextMulti() ARE CALLED!

  // getFootnotes
  // Will return the footnotes (or empty string if there aren't any).
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  getFootnotes() {
    if (!this.isReady('getFootnotes')) return null;
    const footnotes = libxulsword.GetFootnotes();
    this.checkerror();
    return footnotes;
  },

  // getCrossRefs
  // Will return the cross references (or empty string if there aren't any).
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  getCrossRefs() {
    if (!this.isReady('getCrossRefs')) return null;
    const crossRefs = libxulsword.GetCrossRefs();
    this.checkerror();
    return crossRefs;
  },

  // getNotes
  // Will return both footnotes and cross references interleaved.
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  // order is: v1-footnotes, v1-crossrefs, v2-footnotes, v2-crossrefs, etc
  getNotes() {
    if (!this.isReady('getNotes')) return null;
    const notes = libxulsword.GetNotes();
    this.checkerror();
    return notes;
  },

  // getVerseText
  // Will return the requested verse(s) text.
  // Vkeymod is the module from which to return text. If it's not a versekey
  //   type module, an error is returned.
  // Vkeytext is the 'xulsword reference' (see definition above) from which to
  //   return the text.
  // keepTextNotes if false returns raw text, without features such as
  //   verse numbers, note markers, red-words-of-Christ etc.
  getVerseText(vkeymod, vkeytext, keepTextNotes) {
    if (!this.isReady('getVerseText')) return null;
    const verseText = libxulsword.GetVerseText(
      vkeymod,
      vkeytext,
      keepTextNotes
    );
    this.checkerror();
    return verseText;
  },

  // getMaxChapter
  // Returns the maximum chapter number of vkeytext's book in the
  // v11n versification system.
  // IMPORTANT: If vkeytext references a book outside the v11n the
  // result will be erroneous! So this must be checked outside this
  // function first, before calling.
  getMaxChapter(v11n, vkeytext) {
    if (!this.isReady('getMaxChapter')) return null;
    const intgr = libxulsword.GetMaxChapter(v11n, vkeytext);
    this.checkerror();
    return intgr;
  },

  // getMaxVerse
  // Returns the maximum verse number of vkeytext's chapter in the
  // v11n versification system.
  // IMPORTANT: If vkeytext references a chapter outside the v11n the
  // result will be erroneous! So this must be checked outside this
  // function first, before calling.
  getMaxVerse(v11n, vkeytext) {
    if (!this.isReady('getMaxVerse')) return null;
    const intgr = libxulsword.GetMaxVerse(v11n, vkeytext);
    this.checkerror();
    return intgr;
  },

  // getVerseSystem
  // Returns the verse system of module Mod.
  getVerseSystem(modname) {
    if (!this.isReady('getVerseSystem')) return null;
    return libxulsword.GetVerseSystem(modname);
  },

  // convertLocation
  // Returns location (ie Gen.5.6.7) of Vkeytext (a xulsword reference) in
  //   FromVerseSystem as it would be specified in ToVerseSystem (so given
  //   Ps 119:1 from 'KJV', it would return Ps.118.1.1 when converted to
  //   'Synodal' or 'EASTERN' verse systems).
  // Returned value is always of the form shortBook.chapter.verse.lastVerse
  // NOTE: Currently libsword mapping is only correct for Gen-Rev of KJV,
  // Synodal and SynodalProt, so this must be checked before calling!
  // TODO! Implement full v11n conversion
  convertLocation(fromVerseSystem, vkeytext, toVerseSystem) {
    if (!this.isReady('convertLocation')) return null;

    return libxulsword.ConvertLocation(
      fromVerseSystem,
      vkeytext,
      toVerseSystem
    );
  },

  /* ******************************************************************************
   * RETRIEVING FOOTNOTES, CROSS REFERENCES, INTRODUCTIONS, DICTIONARY ENTRIES, ETC.:
   ****************************************************************************** */
  // getIntroductions
  // Will return the introduction for a given short book name in module Vkeymod,
  //   if one exists in the version. If there is not introduction, '' is returned.
  // If Vkeymod is not a versekey type module, an error is returned.
  getIntroductions(vkeymod, bname) {
    if (!this.isReady('getIntroductions')) return null;
    const introductions = libxulsword.GetIntroductions(vkeymod, bname);
    this.checkerror();
    return introductions;
  },

  // getDictionaryEntry
  // Will return the dictionary entry, or '' if the entry is not found.
  // An exception is thrown if the dictionary itself is not found, or if the
  //   Lexdictmod is not of type StrKey.
  getDictionaryEntry(
    lexdictmod,
    key,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) {
    if (!this.isReady('getDictionaryEntry')) return null;
    if (options) this.setGlobalOptions(options);
    const dictionaryEntry = libxulsword.GetDictionaryEntry(lexdictmod, key);
    this.checkerror();
    return dictionaryEntry;
  },

  // getAllDictionaryKeys
  // Returns all keys in form key1<nx>key2<nx>key3<nx>
  // Returns an error is module Lexdictmod is not of type StrKey
  getAllDictionaryKeys(lexdictmod) {
    if (!this.isReady('getAllDictionaryKeys')) return null;
    const allDictionaryKeys = libxulsword.GetAllDictionaryKeys(lexdictmod);
    this.checkerror();
    return allDictionaryKeys;
  },

  // getGenBookChapterText
  // Returns chapter text for key Treekey in GenBook module Gbmod.
  // Returns an error if module Gbmod is not a TreeKey mod.
  getGenBookChapterText(
    gbmod,
    treekey,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) {
    if (!this.isReady('getGenBookChapterText')) return null;
    if (options) this.setGlobalOptions(options);
    const genBookChapterText = libxulsword.GetGenBookChapterText(
      gbmod,
      treekey
    );
    this.checkerror();
    return genBookChapterText;
  },

  // getGenBookTableOfContents
  // Returns table of contents RDF code for GenBook module Gbmod.
  // Returns an error if module Gbmod is not a TreeKey mod.
  getGenBookTableOfContents(gbmod) {
    if (!this.isReady('getGenBookTableOfContents')) return null;
    const genBookTableOfContents = libxulsword.GetGenBookTableOfContents(gbmod);
    this.checkerror();
    return genBookTableOfContents;
  },

  /* *****************************************************************************
   * SEARCHING: USE THESE TO SEARCH MODULES:
   ***************************************************************************** */
  // luceneEnabled
  // Will return true if indexed searching is available for the current module, false otherwise.
  luceneEnabled(modname) {
    if (!this.isReady('luceneEnabled')) return null;
    const enabled = libxulsword.LuceneEnabled(modname);
    this.checkerror();
    return enabled;
  },

  // search
  // Returns the number of matches found
  // Mod is the version to search
  // Srchstr is the string you want to search for.
  // Scope is the scope of the search. For example: 'Gen', or 'Matt-Rev'.
  // type is the type of search which can take one of the following values:
  // >=0 - regex (use C++ regex matching)
  //  -1 - phrase (only matches EXACTLY the text- including punctuation etc!)
  //  -2 - multiword (match verses that contain all the words in any form or order)
  //  -3 - entryAttribute (eg. Word//Strongs/G1234/) NOT TESTED.
  //  -4 - Lucene fast indexed search (if index is available)
  //  -5 - a compound search
  // flags are many useful flags as defined in regex.h
  // newsearch should be set to false if you want the search results added to the previous results
  search(modname, srchstr, scope, type, flags, newsearch) {
    if (!this.isReady('search')) return null;
    const intgr = libxulsword.Search(
      modname,
      srchstr,
      scope,
      type,
      flags,
      newsearch
    );
    this.checkerror();
    return intgr;
  },

  // getSearchPointer
  // Returns an index to a pointer for a newly created copy of LibSword's internal search results ListKey object.
  getSearchPointer() {
    if (!this.isReady('getSearchPointer')) return null;
    const searchPointer = libxulsword.GetSearchPointer();
    this.checkerror();
    this.searchPointers.push(searchPointer);
    return searchPointer;
  },

  // getSearchVerses
  // UNEMPLEMENTED AS YET. Returns a list of verse addresses which matched the previous search.
  getSearchVerses(modname) {
    return null;
  },

  // getSearchResults
  // Will return the verse texts from previous search.
  // search() must be called before results can be read.
  getSearchResults(modname, first, num, keepStrongs, searchPointer) {
    if (!this.isReady('getSearchResults')) return null;

    // if a searchPointer is given, make sure it has not been freed by LibSword.pause() etc.
    if (searchPointer && this.searchPointers.indexOf(searchPointer) === -1)
      return null;

    if (searchPointer) {
      if (this.searchPointers.indexOf(searchPointer) === -1) return null;
      return libxulsword.GetSearchResults(
        modname,
        first,
        num,
        keepStrongs,
        searchPointer
      );
    }
    return libxulsword.GetSearchResults(modname, first, num, keepStrongs);
  },

  // searchIndexDelete
  // Deletes the search index of modname.
  searchIndexDelete(modname) {
    if (!this.isReady('searchIndexDelete')) return;
    libxulsword.SearchIndexDelete(modname);
    this.checkerror();
  },

  // searchIndexBuild
  // Before starting to build a new search index, call 'searchIndexDelete()'
  // CAUTION: Do not call any LibSword functions other than getPercentComplete until
  // getPercentComplete returns 100!
  searchIndexBuild(modname) {
    if (!this.isReady('searchIndexBuild')) return;
    libxulsword.SearchIndexBuild(modname);
    this.checkerror();
  },

  /* *****************************************************************************
   * SETTING/READING GLOBAL OPTIONS FOR RENDERING SCRIPTURE TEXTS:
   ***************************************************************************** */
  // setGlobalOption
  // 'Option' is one of the following and can have a 'Setting' of either 'Off' or 'On':
  //   'Footnotes'
  //   'Headings'
  //   'Cross-references'
  //   'Words of Christ in Red'
  //   'Verse Numbers'
  //   'Hebrew Cantillation'
  //   'Hebrew Vowel Points'
  setGlobalOption(option, setting) {
    if (!this.isReady('setGlobalOption')) return;
    libxulsword.SetGlobalOption(option, setting);
    this.checkerror();
  },

  // This is a IPC speedup function setting multiple options with a single request.
  setGlobalOptions(options) {
    Object.entries(options).forEach((entry) => {
      const option = entry[0] as SwordFilterType;
      this.setGlobalOption(option, entry[1]);
    });
  },

  // getGlobalOption
  // Option must one of the above option strings. Either 'Off' or 'On' will be returned.
  getGlobalOption(option) {
    if (!this.isReady('getGlobalOption')) return null;
    const globalOption = libxulsword.GetGlobalOption(option);
    this.checkerror();
    return globalOption;
  },

  /* *****************************************************************************
   * PROVIDING THE DECRYPTION KEY:
   ***************************************************************************** */
  // setCipherKey
  // Will set the module's key. Key can only be set once.
  setCipherKey(modname, cipherKey, useSecModule) {
    if (!this.isReady('setCipherKey')) return;
    libxulsword.setCipherKey(modname, cipherKey, useSecModule);
    this.checkerror();
  },

  /* ******************************************************************************
   * READING MODULE LIST AND MODULE INFORMATION:
   ****************************************************************************** */
  // getModuleList
  // Returns a string of form: name1;type1<nx>name2;type2<nx> etc...
  // Returns 'No Modules' if there are no modules available.
  getModuleList() {
    if (!this.isReady('getChapterText')) return null;
    if (!Cache.has('libswordModueList')) {
      Cache.write(libxulsword.GetModuleList(), 'libswordModueList');
    }
    return Cache.read('libswordModueList');
  },

  // getModuleInformation
  // Paramname can be anything that is in the module's .conf file.
  // Returns Paramname from conf file of module Mod.
  // Returns NOTFOUND if the Paramname does not exist in the conf file.
  // Returns empty string if the module Mod does not exist.
  // Returns val1<nx>val2<nx>val3 if there is more than one entry of type infotype (eg. GlobalOptionFilter)
  getModuleInformation(modname, paramname) {
    if (!this.isReady('getModuleInformation')) return null;
    const moduleInformation = libxulsword.GetModuleInformation(
      modname,
      paramname
    );
    this.checkerror();
    return moduleInformation;
  },

  // uncompressTarGz
  // Uncompresses a .tar.gz file into aDir
  uncompressTarGz(tarGzPath, aDirPath) {
    if (!this.isReady('uncompressTarGz')) return;
    libxulsword.UncompressTarGz(tarGzPath, aDirPath);
    this.checkerror();
  },

  /* *****************************************************************************
   * LOCALE RELATED INFORMATION:
   ***************************************************************************** */
  // getLanguageName
  // Returns a localized readable utf8 string correpsonding to the language code.
  // Returns null if the information is not available
  translate(text, localeName) {
    if (!this.isReady('translate')) return null;
    const cdata = libxulsword.Translate(text, localeName);
    this.checkerror();
    return cdata;
  },
};

// The LibSwordClass interface is only available in the main process directly through the LibSword object
export type LibSwordClass = GType['LibSword'] & LibSwordPrivate;

export default LibSword as GType['LibSword'];
