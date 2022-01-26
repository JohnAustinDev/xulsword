/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-continue */
/* eslint-disable new-cap */
import C from '../../constant';
import nsILocalFile from '../components/nsILocalFile';
import Dirs from './dirs';
import Prefs from './prefs';
import { jsdump } from '../mutil';

import type { LibSwordPublic, SwordFilterType } from '../../type';

const { libxulsword } = require('libxulsword');

/*
This LibSword object is used to access all SWORD engine capabilities
and information- including texts, searches etc. This object utilizes
Firefox's ctypes component to access the libxulsword dynamic library.
The libxulsword dynamic library was compiled from The SWORD Project's
C++ SWORD engine.

NON-STANDARD SWORD MODULE CONFIGURATION FILE PARAMETERS (OPTIONAL):
Valid for all modules:
  'Font' - The font to use for the module
  'FontSizeAdjust' - The relative size of the module's font
  'LineHeight' - The relative line height of the module's font
  'xulswordVersion' - Min version of xulsword this SWORD mod is compatible with

Valid for Bible modules:
  'DictionaryModule' - (DEPRECATED and replaced by 'Companion' - see CrossWire's
      documentation) Associate a dictionary with the module. There may be
      more than one DictionaryModule entry.
  'AudioCode' - Audio files located in this directory (within the Audio dir) will
      be avaialble in this Bible module.
  'NoticeLink' and 'NoticeText' - Used to display a prominent message about a text.

Valid for Dictionary modules:
  'LangSortOrder' - Allows for sorting entries alphabetically in any language.
  'LangSortSkipChars' - Used in conjunction with LangSortOrder
  'ReferenceBible' - (DEPRECATED and replaced by 'Companion' - see CrossWire's
      documentation) Preffered Bible module to use for Scripture references.
*/

const LibSword: typeof LibSwordPublic & LibSwordPrivate = {
  libsword: null, // reference to the libxulsword dynamic library
  initialized: false, // the LibSword (Cpp xulsword class) instance returned by libxulsword
  callback: null, // an object used to implement callbacks from Javascript
  _hasBible: false,
  _moduleList: '',
  fdata: null,
  paused: false,

  ModuleDirectory: '',
  LocaleDirectory: '',

  CheckTheseCipherKeys: [],
  searchPointers: [],

  initLibsword() {
    if (this.initialized) return false;

    jsdump('Initializing libsword...');

    this.fdata = {};

    this.ModuleDirectory = Dirs.path.xsModsUser;

    this.LocaleDirectory = Dirs.path.xsLocale;

    // copy locale defaults if needed
    const localeConf = new nsILocalFile(this.LocaleDirectory);
    localeConf.append('locales.conf');
    if (!localeConf.exists()) {
      const def = Dirs.xsDefaults;
      def.append('locales.conf');
      const locdir = new nsILocalFile(this.LocaleDirectory);
      if (def.exists()) {
        def.copyTo(locdir);
      }
    }

    jsdump(`module directory: ${this.ModuleDirectory}`);

    this.initInstance();

    return true;
  },

  initInstance() {
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
    this.initialized = libxulsword.GetXulsword(
      this.ModuleDirectory,
      this.UpperCase,
      this.ThrowJSError,
      this.ReportProgress,
      this.LocaleDirectory
    );
    jsdump(`CREATED new xulsword object`);
  },

  freeSearchPointer(sp) {
    if (!sp) return;
    const i = this.searchPointers.indexOf(sp);
    if (i === -1) return; // this pointer was already freed or never existed
    libxulsword.FreeSearchPointer(this.searchPointers[i], 'searchPointer');
    this.searchPointers[i] = null;
  },

  quitLibsword() {
    if (this.initialized) {
      jsdump('  ... freeing search pointers ...');
      for (let i = 0; i < this.searchPointers.length; i += 1) {
        this.freeSearchPointer(this.searchPointers[i]);
      }
      jsdump('  ... closing xulsword');
      libxulsword.FreeLibXulsword();
      // napi.libsword.close();
    }

    this._hasBible = false;
    this._moduleList = '';
    this.fdata = null;

    jsdump('CLOSED libsword');
  },

  hasBible() {
    return this._hasBible;
  },

  // pause() saves LibSword info and closes LibSword so that it may be
  // re-opened by another thread. pause() should only be called at the
  // end of a thread, if LibSword has already been initialized. In this
  // case, any required processing after pausing should be initiated
  // by providing a callback.libswordPauseComplete() function.
  pause(callback) {
    // already paused, or not yet initialized? then just callback now...
    if (this.paused || !this.initialized) {
      this.paused = true;
      if (callback && typeof callback.libswordPauseComplete === 'function')
        callback.libswordPauseComplete();
      return;
    }

    // When pausing, save current global option settings of this libsword
    // object, so they can be recovered when we resume.
    /*
    if (typeof(prefs) !== 'undefined' && prefs && Location) {
      for (var cmd in GlobalToggleCommands) {
        if (GlobalToggleCommands[cmd] == 'User Notes') continue;
        prefs.setCharPref(GlobalToggleCommands[cmd], LibSword.getGlobalOption(GlobalToggleCommands[cmd]));
      }
    } */

    // save our callback if it exists
    this.callback =
      callback && typeof callback.libswordPauseComplete === 'function'
        ? callback
        : null;

    // call quitLibsword only after any currently pending calls to LibSword have been handled
    window.setTimeout(() => {
      LibSword.quitLibsword();
      LibSword.paused = true;
      if (LibSword.callback) {
        LibSword.callback.libswordPauseComplete();
      }
      LibSword.callback = null;
    }, 1);
  },

  resume() {
    if (!this.paused) return;

    this.paused = false;

    this.unlock();

    jsdump('LibSword resumed with no Bible modules.');
  },

  // unlock encrypted SWORD modules
  unlock() {
    const mlist = this.getModuleList();
    if (!mlist || mlist === 'No Modules' || mlist.search(C.BIBLE) === -1) {
      this._hasBible = false;
      return;
    }
    this._hasBible = true;

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
      this.CheckTheseCipherKeys.push(mod);

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

  libSwordReady(caller) {
    if (this.paused) {
      jsdump(`ERROR: libsword paused, "${caller}" inaccessible.`);
      return false;
    }

    if (!this.initialized) this.initLibsword();

    // if (!this.inst) this.initInstance();
    // if (!this.inst) return false;

    return true;
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

  Preffered forms (because most xulsword subroutines use these forms). These forms are
  often refered to as locations:
    Gen.5             --> Genesis chapter 5 (in this case Verse=1 and LastVerse=maxverse)
    Gen.5.6           --> Genesis chapter 5 verse 6 (in this case LastVerse=Verse)
    Gen.5.6.7         --> Genesis chapter 5 verses 6 through 7

  Other valid forms (but may need subsequent conversion for use by some subroutines in xulsword):
    Gen 5             --> same as Gen.5
    Gen 5:6           --> same as Gen.5.6
    Gen 5:6-7         --> same as Gen.5.6.7

  Valid form, but may not always return what is expected:
    Gen 5:6 - Gen 5:7 --> same as Gen.5.6.7 but note that the book and chapter
                          number mentioned after the '-' are completely ignored,
                          and only the verse is used (because xulsword references
                          never cross chapter boundaries).
*/

  // getChapterText
  // Will return a chapter of text with footnote markers from module Vkeymod.
  // Vkeymod must be a module having a key type of versekey (Bibles & commentaries),
  // otherwise null is returned.
  getChapterText(modname, vkeytext) {
    if (!this.libSwordReady('getChapterText')) return null;
    const chapterText = libxulsword.GetChapterText(modname, vkeytext);
    this.checkerror();
    return chapterText;
  },

  // getChapterTextMulti
  // Will return chapter text in interlinear style.
  // Footnote markers are NOT included.
  // Vkeymodlist is formatted as follows: 'UZV,TR,RSTE'. The first module must be a
  //   versekey module or an error is returned. If any successive module is not a
  //   versekey module, it is simply ignored. Verse numbers retured are those of
  //   the first module listed, subsequent modules return the same reference as
  //   that returned by the first, even though it may have come from a different
  //   chapter or verse number than did the first.
  getChapterTextMulti(modstrlist, vkeytext, keepnotes = false) {
    if (!this.libSwordReady('getChapterTextMulti')) return null;
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
    if (!this.libSwordReady('getFootnotes')) return null;
    const footnotes = libxulsword.GetFootnotes();
    this.checkerror();
    return footnotes;
  },

  // getCrossRefs
  // Will return the cross references (or empty string if there aren't any).
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  getCrossRefs() {
    if (!this.libSwordReady('getCrossRefs')) return null;
    const crossRefs = libxulsword.GetCrossRefs();
    this.checkerror();
    return crossRefs;
  },

  // getNotes
  // Will return both footnotes and cross references interleaved.
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  // order is: v1-footnotes, v1-crossrefs, v2-footnotes, v2-crossrefs, etc
  getNotes() {
    if (!this.libSwordReady('getNotes')) return null;
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
    if (!this.libSwordReady('getVerseText')) return null;
    const verseText = libxulsword.GetVerseText(
      vkeymod,
      vkeytext,
      keepTextNotes
    );
    this.checkerror();
    return verseText;
  },

  // getMaxChapter
  // Returns the maximum chapter number of the chapter refered to by the
  //   xulsword reference Vkeytext, when using the verse system of Mod.
  getMaxChapter(modname, vkeytext) {
    if (!this.libSwordReady('getMaxChapter')) return null;
    const intgr = libxulsword.GetMaxChapter(modname, vkeytext);
    this.checkerror();
    return intgr;
  },

  // getMaxVerse
  // Returns the maximum verse number of the chapter refered to by the
  //   xulsword reference Vkeytext, when using the verse system of Mod.
  getMaxVerse(modname, vkeytext) {
    if (!this.libSwordReady('getMaxVerse')) return null;
    const intgr = libxulsword.GetMaxVerse(modname, vkeytext);
    this.checkerror();
    return intgr;
  },

  // getVerseSystem
  // Returns the verse system of module Mod.
  getVerseSystem(modname) {
    if (!this.libSwordReady('getVerseSystem')) return null;
    return libxulsword.GetVerseSystem(modname);
  },

  // convertLocation
  // Returns location (ie Gen.5.6.7) of Vkeytext (a xulsword reference) in
  //   FromVerseSystem as it would be specified in ToVerseSystem (so given
  //   Ps 119:1 from 'KJV', it would return Ps.118.1.1 when converted to
  //   'Synodal' or 'EASTERN' verse systems).
  // Returned value is always of the form shortBook.chapter.verse.lastVerse
  // NOTE: Currently libsword mapping only works for KJV, Synodal and SynodalProt,
  // so if the verse system is other than those, it must be treated as KJV.
  // TODO! Implement full v11n conversion
  convertLocation(fromVerseSystem, vkeytext, toVerseSystem) {
    if (!this.libSwordReady('convertLocation')) return null;
    let from = fromVerseSystem;
    if (!from.startsWith('Synodal')) from = 'KJV';
    let to = toVerseSystem;
    if (!to.startsWith('Synodal')) to = 'KJV';
    return libxulsword.ConvertLocation(from, vkeytext, to);
  },

  /* ******************************************************************************
   * RETRIEVING FOOTNOTES, CROSS REFERENCES, INTRODUCTIONS, DICTIONARY ENTRIES, ETC.:
   ****************************************************************************** */
  // getIntroductions
  // Will return the introduction for a given short book name in module Vkeymod,
  //   if one exists in the version. If there is not introduction, '' is returned.
  // If Vkeymod is not a versekey type module, an error is returned.
  getIntroductions(vkeymod, bname) {
    if (!this.libSwordReady('getIntroductions')) return null;
    const introductions = libxulsword.GetIntroductions(vkeymod, bname);
    this.checkerror();
    return introductions;
  },

  // getDictionaryEntry
  // Will return the dictionary entry, or '' if the entry is not found.
  // An exception is thrown if the dictionary itself is not found, or if the
  //   Lexdictmod is not of type StrKey.
  getDictionaryEntry(lexdictmod, key) {
    if (!this.libSwordReady('getDictionaryEntry')) return null;
    const dictionaryEntry = libxulsword.GetDictionaryEntry(lexdictmod, key);
    this.checkerror();
    return dictionaryEntry;
  },

  // getAllDictionaryKeys
  // Returns all keys in form key1<nx>key2<nx>key3<nx>
  // Returns an error is module Lexdictmod is not of type StrKey
  getAllDictionaryKeys(lexdictmod) {
    if (!this.libSwordReady('getAllDictionaryKeys')) return null;
    const allDictionaryKeys = libxulsword.GetAllDictionaryKeys(lexdictmod);
    this.checkerror();
    return allDictionaryKeys;
  },

  // getGenBookChapterText
  // Returns chapter text for key Treekey in GenBook module Gbmod.
  // Returns an error if module Gbmod is not a TreeKey mod.
  getGenBookChapterText(gbmod, treekey) {
    if (!this.libSwordReady('getGenBookChapterText')) return null;
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
    if (!this.libSwordReady('getGenBookTableOfContents')) return null;
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
    if (!this.libSwordReady('luceneEnabled')) return null;
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
    if (!this.libSwordReady('search')) return null;
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
    if (!this.libSwordReady('getSearchPointer')) return null;
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
    if (!this.libSwordReady('getSearchResults')) return null;

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
    if (!this.libSwordReady('searchIndexDelete')) return;
    libxulsword.SearchIndexDelete(modname);
    this.checkerror();
  },

  // searchIndexBuild
  // Before starting to build a new search index, call 'searchIndexDelete()'
  // CAUTION: Do not call any LibSword functions other than getPercentComplete until
  // getPercentComplete returns 100!
  searchIndexBuild(modname) {
    if (!this.libSwordReady('searchIndexBuild')) return;
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
    if (!this.libSwordReady('setGlobalOption')) return;
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
    if (!this.libSwordReady('getGlobalOption')) return null;
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
    if (!this.libSwordReady('setCipherKey')) return;
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
    if (!this._moduleList) {
      this._moduleList = libxulsword.GetModuleList();
    }
    return this._moduleList;
  },

  // getModuleInformation
  // Paramname can be anything that is in the module's .conf file.
  // Returns Paramname from conf file of module Mod.
  // Returns NOTFOUND if the Paramname does not exist in the conf file.
  // Returns empty string if the module Mod does not exist.
  // Returns val1<nx>val2<nx>val3 if there is more than one entry of type infotype (eg. GlobalOptionFilter)
  getModuleInformation(modname, paramname) {
    if (!this.libSwordReady('getModuleInformation')) return null;
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
    if (!this.libSwordReady('uncompressTarGz')) return;
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
    if (!this.libSwordReady('translate')) return null;
    const cdata = libxulsword.Translate(text, localeName);
    this.checkerror();
    return cdata;
  },
};
type LibSwordPrivate = {
  ModuleDirectory: string;
  LocaleDirectory: string;
  CheckTheseCipherKeys: string[];

  libsword: any;
  initialized: false;
  callback: any;
  fdata: any;
  paused: boolean;

  _hasBible: boolean;
  _moduleList: string;
  searchPointers: any[];

  upperCaseResult: string;
  throwMsg: string;

  UpperCase: (s: string) => string | null;
  ThrowJSError: (ptr: any) => void;
  ReportProgress: (i: number) => void;

  initInstance: () => void;
  freeSearchPointer: (sp: any) => void;
  unlock: () => void;
  checkerror: () => void;
};

// The LibSwordClass interface is only available in the main process directly through the LibSword object
export type LibSwordClass = typeof LibSwordPublic & LibSwordPrivate;

export default LibSword as typeof LibSwordPublic;
