/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, BrowserWindow } from 'electron';
import { fork } from 'child_process';
import log from 'electron-log';
import path from 'path';
import { repositoryKey, isRepoLocal } from '../../common';
import Cache from '../../cache';
import LocalFile from './localFile';
import Dirs from './dirs';
import Prefs from './prefs';
import Window from './window';

import type {
  Repository,
  SwordConfigEntries,
  SwordFilterType,
  SwordFilterValueType,
  V11nType,
} from '../../type';
import type { ManagerStatePref } from '../../renderer/moduleManager/manager';

const { libxulsword } = require('libxulsword');

/* ******************************************************************************
 * Callback functions available to libxulsword NodeJS addon
 ***************************************************************************** */

global.ToUpperCase = (aString) => {
  if (aString) {
    return aString.toUpperCase();
  }
  return '';
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
global.ReportSearchIndexerProgress = (_intgr) => {};

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

const LibSword = {
  libxulsword: null as null | Record<string, unknown>,

  moduleDirectories: [] as string[],

  searchedID: '' as string,

  searchingID: '' as string,

  init(): boolean {
    if (this.libxulsword) return false;

    log.verbose('Initializing libsword...');

    this.moduleDirectories = [Dirs.path.xsModsUser];
    const repos = Prefs.getComplexValue(
      'moduleManager.repositories'
    ) as ManagerStatePref['repositories'];
    if (repos) {
      const { custom, disabled } = repos;
      custom.forEach((repo: Repository) => {
        if (
          !disabled?.includes(repositoryKey(repo)) &&
          isRepoLocal(repo) &&
          path.isAbsolute(repo.path)
        ) {
          const dir = new LocalFile(repo.path);
          const test = dir.clone().append('mods.d');
          if (test.exists() && test.isDirectory()) {
            this.moduleDirectories.push(dir.path);
          }
        }
      });
    }

    log.verbose(`module directories: ${this.moduleDirectories}`);

    // Get our xulsword instance...
    this.libxulsword = libxulsword.GetXulsword(
      this.moduleDirectories.join(', ')
    );
    log.verbose(`CREATED libxulsword object`);

    return true;
  },

  quit(): void {
    if (this.libxulsword) {
      libxulsword.FreeLibXulsword();
      log.verbose('DELETED libxulsword object');
    }
    this.libxulsword = null;
  },

  isReady(err?: boolean): boolean {
    if (this.libxulsword) return true;
    if (err) {
      log.error(
        `libsword was called while uninitialized: ${new Error().stack}`
      );
    }
    return false;
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
    modname: string,
    vkeytext: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ): string {
    if (options) this.setGlobalOptions(options);
    if (this.isReady(true)) {
      const chapterText = libxulsword.GetChapterText(modname, vkeytext);
      return chapterText;
    }
    return '';
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
    modstrlist: string,
    vkeytext: string,
    keepnotes?: boolean,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ): string {
    if (this.isReady(true)) {
      if (options) this.setGlobalOptions(options);
      const chapterTextMulti = libxulsword.GetChapterTextMulti(
        modstrlist,
        vkeytext,
        keepnotes
      );
      return chapterTextMulti;
    }
    return '';
  },

  // IMPORTANT: THE FOLLOWING 3 ROUTINES MUST BE CALLED AFTER getChapterText
  // or getChapterTextMulti() ARE CALLED!

  // getFootnotes
  // Will return the footnotes (or empty string if there aren't any).
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  getFootnotes(): string {
    if (this.isReady(true)) {
      const footnotes = libxulsword.GetFootnotes();
      return footnotes;
    }
    return '';
  },

  // getCrossRefs
  // Will return the cross references (or empty string if there aren't any).
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  getCrossRefs(): string {
    if (this.isReady(true)) {
      const crossRefs = libxulsword.GetCrossRefs();
      return crossRefs;
    }
    return '';
  },

  // getNotes
  // Will return both footnotes and cross references interleaved.
  // getChapterText() or getChapterTextMulti() must be called before notes can be read.
  // order is: v1-footnotes, v1-crossrefs, v2-footnotes, v2-crossrefs, etc
  getNotes(): string {
    if (this.isReady(true)) {
      const notes = libxulsword.GetNotes();
      return notes;
    }
    return '';
  },

  // getVerseText
  // Will return the requested verse(s) text.
  // Vkeymod is the module from which to return text. If it's not a versekey
  //   type module, an error is returned.
  // Vkeytext is the 'xulsword reference' (see definition above) from which to
  //   return the text.
  // keepTextNotes if false returns raw text, without features such as
  //   verse numbers, note markers, red-words-of-Christ etc.
  getVerseText(
    vkeymod: string,
    vkeytext: string,
    keepTextNotes: boolean
  ): string {
    if (this.isReady(true)) {
      const verseText = libxulsword.GetVerseText(
        vkeymod,
        vkeytext,
        keepTextNotes
      );
      return verseText;
    }
    return '';
  },

  // getMaxChapter
  // Returns the maximum chapter number of vkeytext's book in the
  // v11n versification system.
  // IMPORTANT: If vkeytext references a book outside the v11n the
  // result will be erroneous! So this must be checked outside this
  // function first, before calling.
  getMaxChapter(v11n: V11nType, vkeytext: string): number {
    if (this.isReady(true)) {
      const intgr = libxulsword.GetMaxChapter(v11n, vkeytext);
      return intgr;
    }
    return 0;
  },

  // getMaxVerse
  // Returns the maximum verse number of vkeytext's chapter in the
  // v11n versification system.
  // IMPORTANT: If vkeytext references a chapter outside the v11n the
  // result will be erroneous! So this must be checked outside this
  // function first, before calling.
  getMaxVerse(v11n: V11nType, vkeytext: string): number {
    if (this.isReady(true)) {
      const intgr = libxulsword.GetMaxVerse(v11n, vkeytext);
      return intgr;
    }
    return 0;
  },

  // getVerseSystem
  // Returns the verse system of module Mod.
  getVerseSystem(modname: string): V11nType {
    if (this.isReady(true)) {
      return libxulsword.GetVerseSystem(modname);
    }
    return 'KJV';
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
  convertLocation(
    fromv11n: V11nType,
    vkeytext: string,
    tov11n: V11nType
  ): string {
    if (this.isReady(true)) {
      return libxulsword.ConvertLocation(fromv11n, vkeytext, tov11n);
    }
    return '';
  },

  /* ******************************************************************************
   * RETRIEVING FOOTNOTES, CROSS REFERENCES, INTRODUCTIONS, DICTIONARY ENTRIES, ETC.:
   ****************************************************************************** */
  // getIntroductions
  // Will return the introduction for a given short book name in module Vkeymod,
  //   if one exists in the version. If there is not introduction, '' is returned.
  // If Vkeymod is not a versekey type module, an error is returned.
  getIntroductions(vkeymod: string, bname: string): string {
    if (this.isReady(true)) {
      const introductions = libxulsword.GetIntroductions(vkeymod, bname);
      return introductions;
    }
    return '';
  },

  // getDictionaryEntry
  // Will return the dictionary entry, or '' if the entry is not found.
  // An exception is thrown if the dictionary itself is not found, or if the
  //   Lexdictmod is not of type StrKey.
  getDictionaryEntry(
    lexdictmod: string,
    key: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ): string {
    if (this.isReady(true)) {
      if (options) this.setGlobalOptions(options);
      const dictionaryEntry = libxulsword.GetDictionaryEntry(lexdictmod, key);
      return dictionaryEntry;
    }
    return '';
  },

  // getAllDictionaryKeys
  // Returns all keys in form key1<nx>key2<nx>key3<nx>
  // Returns an error is module Lexdictmod is not of type StrKey
  getAllDictionaryKeys(lexdictmod: string): string {
    if (this.isReady(true)) {
      const allDictionaryKeys = libxulsword.GetAllDictionaryKeys(lexdictmod);
      return allDictionaryKeys;
    }
    return '';
  },

  // getGenBookChapterText
  // Returns chapter text for key Treekey in GenBook module Gbmod.
  // Returns an error if module Gbmod is not a TreeKey mod.
  getGenBookChapterText(
    gbmod: string,
    treekey: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ): string {
    if (this.isReady(true)) {
      if (options) this.setGlobalOptions(options);
      const genBookChapterText = libxulsword.GetGenBookChapterText(
        gbmod,
        treekey
      );
      return genBookChapterText;
    }
    return '';
  },

  // getGenBookTableOfContents
  // Returns table of contents JSON code for GenBook module Gbmod.
  // Returns an error if module Gbmod is not a TreeKey mod.
  getGenBookTableOfContents(gbmod: string): string {
    if (this.isReady(true)) {
      const genBookTableOfContents =
        libxulsword.GetGenBookTableOfContents(gbmod);
      return genBookTableOfContents;
    }
    return '';
  },

  /* *****************************************************************************
   * SEARCHING: USE THESE TO SEARCH MODULES:
   ***************************************************************************** */
  // search
  // NOTE: LibSword runs in the main process, while multiple renderer processes
  // handle events asynchronously. To prevent search corruption, a search must
  // be followed by a corresponding read passing the same hash value. Until
  // then, any further search calls will immediately return null, until the
  // expected read is performed.
  //
  // Returns the number of matches found
  // modname is the module to search
  // srchstr is the string search query
  // scope is the scope of the search. For example: 'Gen', or 'Matt-Rev'.
  // type is the type of search which can take one of the following values:
  // >=0 - regex (use C++ regex matching)
  //  -1 - phrase (only matches EXACTLY the text- including punctuation etc!)
  //  -2 - multiword (match verses containing all words in any form or order)
  //  -3 - entryAttribute (eg. Word//Strongs/G1234/) NOT TESTED.
  //  -4 - Lucene fast indexed search (if index is available)
  //  -5 - a compound search
  // flags are many useful flags as defined in regex.h
  // newsearch is set to add new search results to the previous results
  async search(
    modname: string,
    srchstr: string,
    scope: string,
    type: number,
    flags: number,
    newsearch: boolean,
    searchID: string
  ): Promise<number | null> {
    return new Promise((resolve) => {
      if (
        this.isReady(true) &&
        ((newsearch && !this.searchingID) ||
          (!newsearch && searchID === this.searchedID))
      ) {
        this.searchingID = searchID;
        // IMPORTANT:
        // VerseKey module searches require a non-empty book-scope, which may
        // contain a single range. If the book(s) given in the scope value do
        // not exist in the module, SWORD may crash!
        // NOTE: This libxulsword function is not a Node-API async function, so
        // it will block Node's event loop until it finishes.
        const intgr = libxulsword.Search(
          modname,
          srchstr,
          scope,
          type,
          flags,
          newsearch
        );
        this.searchedID = searchID;
        log.debug(
          `search: modname=${modname} srchstr=${srchstr} scope=${scope} type=${type} flags=${flags} newsearch=${newsearch} searchID=${searchID} intgr=${intgr}`
        );
        resolve(intgr);
      } else resolve(null);
    });
  },

  // getSearchResults
  // Will return a range of verse texts from the searchID search, or null if
  // searchID results are unavailable or the engine is not ready. The search()
  // function must be called with the matching searchID before results can be
  // returned.
  getSearchResults(
    modname: string,
    first: number,
    num: number,
    keepStrongs: boolean,
    searchID: string
  ): string | null {
    if (this.isReady(true) && searchID === this.searchedID) {
      this.searchingID = '';

      log.debug(
        `getSearchResults: modname=${modname} first=${first} num=${num} keepStrongs=${keepStrongs} searchID=${searchID}`
      );

      if (!num) return ''; // no reason to call libxulsword
      return libxulsword.GetSearchResults(modname, first, num, keepStrongs);
    }
    return null;
  },

  // luceneEnabled
  // Will return true if indexed searching is available for the current module, false otherwise.
  luceneEnabled(modname: string): boolean {
    if (this.isReady(true)) {
      const enabled = libxulsword.LuceneEnabled(modname);
      return enabled;
    }
    return false;
  },

  // searchIndexDelete
  // Deletes the search index of modname.
  searchIndexDelete(modname: string): boolean {
    if (this.isReady(true)) {
      libxulsword.SearchIndexDelete(modname);
      return true;
    }
    return false;
  },

  // searchIndexBuild
  // Before starting to build a new search index, call 'searchIndexDelete()'
  async searchIndexBuild(
    modcode: string,
    callingWinId?: number
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.isReady(true)) {
        Window.modal([{ modal: 'darkened', window: 'all' }]);
        const workerjs = app.isPackaged
          ? path.join(__dirname, 'indexWorker.js')
          : path.join(__dirname, '../indexWorker.js');
        const indexer = fork(workerjs);
        const sendProgress = (percent: number) => {
          if (callingWinId) {
            let w = BrowserWindow.fromId(Number(callingWinId));
            if (w) {
              const progress = percent / 100;
              w.webContents.send('progress', progress, 'search.indexer');
              w = null;
            }
          }
        };
        const done = () => {
          Window.modal([{ modal: 'off', window: 'all' }]);
          sendProgress(0);
          if (indexer && indexer.exitCode === null) indexer.kill();
        };
        indexer.on('error', (er: Error) => {
          done();
          reject(er);
        });
        indexer.on(
          'message',
          (indexerMsg: { msg: string; percent: number }) => {
            const { msg, percent } = indexerMsg;
            sendProgress(percent);
            if (msg === 'finished') {
              done();
              resolve(true);
            }
          }
        );
        indexer.send({ modsd: this.moduleDirectories, modcode });
      } else resolve(false);
    });
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
  setGlobalOption(
    option: SwordFilterType,
    setting: SwordFilterValueType
  ): void {
    if (this.isReady(true)) {
      libxulsword.SetGlobalOption(option, setting);
    }
  },

  // This is a IPC speedup function setting multiple options with a single request.
  setGlobalOptions(
    options: { [key in SwordFilterType]?: SwordFilterValueType }
  ): void {
    Object.entries(options).forEach((entry) => {
      const option = entry[0] as SwordFilterType;
      this.setGlobalOption(option, entry[1]);
    });
  },

  // getGlobalOption
  // Option must one of the above option strings. Either 'Off' or 'On' will be returned.
  getGlobalOption(option: SwordFilterType): string {
    if (this.isReady(true)) {
      const globalOption = libxulsword.GetGlobalOption(option);
      return globalOption;
    }
    return '';
  },

  /* ******************************************************************************
   * READING MODULE LIST AND MODULE INFORMATION:
   ****************************************************************************** */
  // getModuleList
  // Returns a string of form: name1;type1<nx>name2;type2<nx> etc...
  // Returns 'No Modules' if there are no modules available.
  getModuleList(): string {
    if (this.isReady(true)) {
      if (!Cache.has('libswordModueList')) {
        Cache.write(libxulsword.GetModuleList(), 'libswordModueList');
      }
      return Cache.read('libswordModueList');
    }
    return '';
  },

  // getModuleInformation
  // Paramname can be anything that is in the module's .conf file.
  // Returns Paramname from conf file of module Mod.
  // Returns NOTFOUND if the Paramname does not exist in the conf file.
  // Returns empty string if the module Mod does not exist.
  // Returns val1<nx>val2<nx>val3 if there is more than one entry of
  //   type infotype (eg. GlobalOptionFilter)
  getModuleInformation(
    modname: string,
    paramname: keyof SwordConfigEntries | 'AbsoluteDataPath'
  ): string {
    if (this.isReady(true)) {
      const moduleInformation = libxulsword.GetModuleInformation(
        modname,
        paramname
      );
      return moduleInformation;
    }
    return '';
  },
};

export type LibSwordType = Omit<
  typeof LibSword,
  | 'moduleDirectories'
  | 'checkCipherKeys'
  | 'libxulsword'
  | 'paused'
  | 'upperCaseResult'
  | 'throwMsg'
  | 'UpperCase'
  | 'ThrowJSError'
  | 'ReportProgress'
  | 'unlock'
  | 'checkerror'
  | 'searchingID'
  | 'searchedID'
>;

export default LibSword as LibSwordType;
