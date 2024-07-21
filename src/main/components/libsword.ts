import { BrowserWindow } from 'electron'; // undefined in server mode
import { fork } from 'child_process';
import log from 'electron-log';
import path from 'path';
import libxulsword from 'libxulsword';
import {
  repositoryKey,
  isRepoLocal,
  JSON_parse,
  noAutoSearchIndex,
  unknown2String,
  JSON_stringify,
  versionCompare,
} from '../../common.ts';
import Cache from '../../cache.ts';
import C from '../../constant.ts';
import { publicFiles } from '../parseSwordConf.ts';
import LocalFile from './localFile.ts';
import Dirs from './dirs.ts';
import Data from './data.ts';
import Prefs from './prefs.ts';
import DiskCache from './diskcache.ts';

import type { ChildProcess } from 'child_process';
import type { LogLevel } from 'electron-log';
import type {
  GenBookTOC,
  Repository,
  SwordConfigEntries,
  SwordFilterType,
  SwordFilterValueType,
  V11nType,
  GenBookKeys,
  ModulesCache,
  NewModuleReportType,
  SwordConfType,
  ModTypes,
} from '../../type.ts';
import type S from '../../defaultPrefs.ts';
import type { ManagerStatePref } from '../../renderer/moduleManager/manager.tsx';

export type CppGlobalMethods = {
  ToUpperCase: (str: string) => string;
  ReportSearchIndexerProgress: (percent: number) => void;
} & typeof globalThis;

export type MessagesToIndexWorker =
  | {
      command: 'start';
      directories: string[];
      module: string;
    }
  | {
      command: 'log';
      logfile: string;
      loglevel: LogLevel;
    };

export type MessagesFromIndexWorker =
  | {
      msg: 'finished' | 'failed';
    }
  | {
      msg: 'working';
      percent: number;
    };

// Convert the raw GenBookTOC (output of LibSword.getGenBookTableOfContents())
// into an array of C.GBKSEP delimited keys.
function readGenBookLibSword(toc: GenBookTOC, parent?: string[]): GenBookKeys {
  if (typeof toc !== 'object') return [];
  const r: string[] = [];
  const p = parent || [];
  Object.entries(toc).forEach((entry) => {
    const [chapter, sub] = entry;
    const c = p.slice();
    c.push(chapter);
    if (sub === 1) {
      r.push(c.join(C.GBKSEP));
    } else {
      r.push(c.concat('').join(C.GBKSEP));
      r.push(...readGenBookLibSword(sub, c));
    }
  });
  return r;
}

/* ******************************************************************************
 * Callback functions available to libxulsword NodeJS addon
 ***************************************************************************** */

(globalThis as CppGlobalMethods).ToUpperCase = (aString) => {
  if (aString) {
    return aString.toUpperCase();
  }
  return '';
};

(globalThis as CppGlobalMethods).ReportSearchIndexerProgress = (_intgr) => {};

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
  libxulsword: null as any,

  initialized: false as boolean,

  moduleDirectories: [] as string[],

  searchedID: '' as string,

  searchingID: '' as string,

  indexingID: {} as Record<string, ChildProcess>,

  backgroundIndexerTO: null as NodeJS.Timeout | null,

  init(): boolean {
    if (this.initialized) return false;

    this.libxulsword = libxulsword;

    log.verbose('Initializing libsword...');

    this.moduleDirectories = [
      Dirs.path.xsModsCommon,
      Dirs.path.xsModsUser,
    ].filter(Boolean);
    const repos = Prefs.getComplexValue(
      'moduleManager.repositories',
    ) as ManagerStatePref['repositories'];
    if (repos) {
      const { custom, disabled } = repos;
      custom.forEach((repo: Repository) => {
        if (
          !disabled?.includes(repositoryKey(repo)) &&
          !this.moduleDirectories.includes(repo.path) &&
          isRepoLocal(repo) &&
          path.isAbsolute(repo.path)
        ) {
          this.moduleDirectories.push(repo.path);
        }
      });
    }

    this.moduleDirectories = this.moduleDirectories.filter((md) => {
      const test = new LocalFile(md).append('mods.d');
      return test.exists() && test.isDirectory();
    });

    log.verbose(`module directories: ${this.moduleDirectories.join(', ')}`);

    // Get our xulsword instance...
    this.libxulsword.GetXulsword(this.moduleDirectories.join(', '));
    log.verbose(`CREATED libxulsword object`);
    this.initialized = true;

    return true;
  },

  quit(): void {
    if (this.initialized) {
      Object.keys(this.indexingID).forEach((module) => {
        this.searchIndexCancel(module);
      });
      this.libxulsword.FreeLibXulsword();
      log.verbose('DELETED libxulsword object');
    }
    this.initialized = false;
  },

  isReady(err?: boolean): boolean {
    if (this.initialized) return true;
    if (err) {
      log.error(
        `libsword was called while uninitialized: ${new Error().stack}`,
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
  // Will return a chapter of text with footnote markers, and associated footnotes
  // from module Vkeymod. Vkeymod must be a module having a key type of versekey
  // (Bibles & commentaries), otherwise empty string is returned.
  getChapterText(
    modname: string,
    vkeytext: string,
    options: { [key in SwordFilterType]: SwordFilterValueType },
  ): { text: string; notes: string } {
    if (this.isReady(true)) {
      Object.entries(options).forEach((entry) => {
        this.libxulsword.SetGlobalOption(entry[0], entry[1]);
      });
      const text: string = this.libxulsword.GetChapterText(modname, vkeytext);
      const notes: string = this.libxulsword.GetNotes();
      return { text: publicFiles(text), notes: publicFiles(notes) };
    }
    return { text: '', notes: '' };
  },

  // getChapterTextMulti
  // Will return chapter text and notes in interlinear style.
  // Footnote markers are NOT included unless keepnotes is true.
  // modstrlist is formatted as follows: 'UZV,TR,RSTE'. The first module must be a
  //   versekey module or an error is returned. If any successive module is not a
  //   versekey module, it is simply ignored. Verse numbers retured are those of
  //   the first module listed, subsequent modules return the same reference as
  //   that returned by the first, even though it may have come from a different
  //   chapter or verse number than did the first.
  getChapterTextMulti(
    modstrlist: string,
    vkeytext: string,
    keepnotes: boolean,
    options: { [key in SwordFilterType]: SwordFilterValueType },
  ): { text: string; notes: string } {
    if (this.isReady(true)) {
      Object.entries(options).forEach((entry) => {
        this.libxulsword.SetGlobalOption(entry[0], entry[1]);
      });
      const text: string = this.libxulsword.GetChapterTextMulti(
        modstrlist,
        vkeytext,
        keepnotes,
      );
      const notes: string = this.libxulsword.GetNotes();
      return { text: publicFiles(text), notes: publicFiles(notes) };
    }
    return { text: '', notes: '' };
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
    keepTextNotes: boolean,
    options: { [key in SwordFilterType]?: SwordFilterValueType },
  ): string {
    if (this.isReady(true)) {
      Object.entries(options).forEach((entry) => {
        this.libxulsword.SetGlobalOption(entry[0], entry[1]);
      });
      const verseText = this.libxulsword.GetVerseText(
        vkeymod,
        vkeytext,
        keepTextNotes,
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
      const intgr = this.libxulsword.GetMaxChapter(v11n, vkeytext);
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
      const intgr = this.libxulsword.GetMaxVerse(v11n, vkeytext);
      return intgr;
    }
    return 0;
  },

  // getVerseSystem
  // Returns the verse system of module Mod.
  getVerseSystem(modname: string): V11nType {
    if (this.isReady(true)) {
      return this.libxulsword.GetVerseSystem(modname);
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
  // TODO Implement full v11n conversion
  convertLocation(
    fromv11n: V11nType,
    vkeytext: string,
    tov11n: V11nType,
  ): string {
    if (this.isReady(true)) {
      return this.libxulsword.ConvertLocation(fromv11n, vkeytext, tov11n);
    }
    return '';
  },

  /* ******************************************************************************
   * RETRIEVING FOOTNOTES, CROSS REFERENCES, INTRODUCTIONS, DICTIONARY ENTRIES, ETC.:
   ****************************************************************************** */
  // getIntroductions
  // Will return the introduction and associated notes for a given short book name in
  // module Vkeymod, if one exists in the version. If there is not introduction, ''
  // is returned. If Vkeymod is not a versekey type module, an error is returned.
  getIntroductions(
    vkeymod: string,
    bname: string,
    options: { [key in SwordFilterType]: SwordFilterValueType },
  ): { text: string; notes: string } {
    if (this.isReady(true)) {
      options.Headings = 'On';
      Object.entries(options).forEach((entry) => {
        this.libxulsword.SetGlobalOption(entry[0], entry[1]);
      });
      const introductions: string = this.libxulsword.GetIntroductions(
        vkeymod,
        bname,
      );
      const notes: string = this.libxulsword.GetNotes();
      return { text: publicFiles(introductions), notes: publicFiles(notes) };
    }
    return { text: '', notes: '' };
  },

  // getDictionaryEntry
  // Will return the dictionary entry, and its notes, or NOTFOUND if the entry
  // is not found. An exception is thrown if the dictionary itself is not found,
  // or if the Lexdictmod is not of type StrKey.
  getDictionaryEntry(
    lexdictmod: string,
    key: string,
    options: { [key in SwordFilterType]: SwordFilterValueType },
  ): { text: string; notes: string } {
    if (this.isReady(true)) {
      Object.entries(options).forEach((entry) => {
        this.libxulsword.SetGlobalOption(entry[0], entry[1]);
      });
      let text: string;
      let notes: string;
      try {
        text = this.libxulsword.GetDictionaryEntry(lexdictmod, key);
        notes = this.libxulsword.GetNotes();
      } catch (er) {
        text = C.NOTFOUND;
        notes = '';
      }
      return { text: publicFiles(text), notes: publicFiles(notes) };
    }
    return { text: C.NOTFOUND, notes: '' };
  },

  // getAllDictionaryKeys
  // Returns all keys in form key1<nx>key2<nx>key3<nx>
  // Returns an error is module Lexdictmod is not of type StrKey
  getAllDictionaryKeys(lexdictmod: string): string[] {
    if (this.isReady(true)) {
      const pkey = 'keylist';
      if (!DiskCache.has(pkey, lexdictmod)) {
        // Don't save this version to prefs; the sorted version will be saved later!
        return this.libxulsword
          .GetAllDictionaryKeys(lexdictmod)
          .split('<nx>') as string[];
      }
      return DiskCache.read(
        pkey,
        lexdictmod,
      ) as ModulesCache[string]['keylist'];
    }
    return [];
  },

  // getGenBookChapterText
  // Returns chapter text and notes for key Treekey in GenBook module Gbmod.
  // Returns an error if module Gbmod is not a TreeKey mod.
  getGenBookChapterText(
    gbmod: string,
    treekey: string,
    options: { [key in SwordFilterType]: SwordFilterValueType },
  ): { text: string; notes: string } {
    if (this.isReady(true)) {
      Object.entries(options).forEach((entry) => {
        this.libxulsword.SetGlobalOption(entry[0], entry[1]);
      });
      const text: string = this.libxulsword.GetGenBookChapterText(
        gbmod,
        treekey,
      );
      const notes: string = this.libxulsword.GetNotes();
      return { text: publicFiles(text), notes: publicFiles(notes) };
    }
    return { text: '', notes: '' };
  },

  // getGenBookTableOfContents
  // Returns table of contents JSON code for GenBook module Gbmod.
  // Returns an error if module Gbmod is not a TreeKey mod.
  getGenBookTableOfContents(gbmod: string): GenBookKeys {
    if (this.isReady(true)) {
      const pkey = 'toc';
      if (!DiskCache.has(pkey, gbmod)) {
        const t: string = this.libxulsword
          .GetGenBookTableOfContents(gbmod)
          // EnumaElish module has a TOC entry with this illegal control character:
          // eslint-disable-next-line no-control-regex
          .replace(/[	]/g, ' ');
        const toc = JSON_parse(t) as GenBookTOC;
        DiskCache.write(pkey, readGenBookLibSword(toc), gbmod);
      }
      return DiskCache.read(pkey, gbmod) as ModulesCache[string]['toc'];
    }
    return [];
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
    searchID: string,
  ): Promise<number | null> {
    return await new Promise((resolve) => {
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
        const intgr: number = this.libxulsword.Search(
          modname,
          srchstr,
          scope,
          type,
          flags,
          newsearch,
        );
        this.searchedID = searchID;
        log.debug(
          `search: modname=${modname} srchstr=${srchstr} scope=${scope} type=${type} flags=${flags} newsearch=${newsearch} searchID=${searchID} intgr=${intgr}`,
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
    searchID: string,
  ): string | null {
    if (this.isReady(true) && searchID === this.searchedID) {
      this.searchingID = '';

      log.debug(
        `getSearchResults: modname=${modname} first=${first} num=${num} keepStrongs=${keepStrongs} searchID=${searchID}`,
      );

      if (!num) return ''; // no reason to call libxulsword
      return this.libxulsword.GetSearchResults(
        modname,
        first,
        num,
        keepStrongs,
      );
    }
    return null;
  },

  // luceneEnabled
  // Will return true if indexed searching is available for the current module, false otherwise.
  luceneEnabled(modname: string): boolean {
    if (this.isReady(true)) {
      const enabled = this.libxulsword.LuceneEnabled(modname);
      return enabled;
    }
    return false;
  },

  // Build a search index for a module, cancelling it if a timeout is reached
  // before completion. Returns Promise<success>
  async timedIndexer(module: string, timeout: number): Promise<boolean> {
    if (this.backgroundIndexerTO) {
      throw new Error(
        `Attempted timedIndexer() with backgroundIndexerTO already set.`,
      );
    }
    const start = new Date().valueOf();
    this.backgroundIndexerTO = setTimeout(() => {
      const tom = Math.floor(timeout / 60000);
      log.warn(`Index timeout reached: ${module} (${tom} minutes)`);
      this.backgroundIndexerTO = null;
      this.searchIndexCancel(module);
    }, timeout);
    let success: boolean;
    try {
      success = await this.searchIndexBuild(module);
      log.debug(`searchIndexBuild ${module} success=${success}`);
    } catch (er) {
      success = false;
      log.debug(`searchIndexBuild failed: ${unknown2String(er, ['message'])}`);
    }
    if (this.backgroundIndexerTO) {
      clearTimeout(this.backgroundIndexerTO);
      this.backgroundIndexerTO = null;
    }

    log.debug(
      `Finished background index, success=${success}: ${module} (${Math.ceil((new Date().valueOf() - start) / 1000)}s)`,
    );
    return success;
  },

  // Index each unindexed module in the background. Does nothing if any modules are
  // already being indexed. If an index fails, or takes too long and is canceled, it
  // will not be attempted again unless the module is re-installed. However the user
  // can always click the create index button.
  async startBackgroundSearchIndexer() {
    if (Object.keys(this.indexingID).length !== 0 || !this.isReady()) return;
    const start = new Date().valueOf();
    const timeout = C.UI.Search.backgroundIndexerTimeout; // milliseconds
    const modlist = LibSword.getModuleList();
    const modules = Array.from(
      new Set(
        modlist === C.NOMODULES
          ? []
          : modlist.split('<nx>').map((x) => x.split(';')[0]),
      ),
    );
    const modulesToIndex = modules.filter(
      (m) =>
        !(
          Prefs.getComplexValue(
            'global.noAutoSearchIndex',
          ) as typeof S.prefs.global.noAutoSearchIndex
        ).includes(m) && !this.luceneEnabled(m),
    );

    if (modulesToIndex.length) {
      log.info(
        `Starting background indexer. (${modulesToIndex.length} modules to index, ${
          modules.length - modulesToIndex.length
        } skipped, ${Math.floor(timeout / 60000)} minute timeout per module)`,
      );
    }

    // Index one module at a time, don't try and break their PC...
    let passed = 0;
    let failed = 0;
    while (modulesToIndex.length) {
      const module = modulesToIndex.pop();
      if (module) {
        let result: boolean;
        try {
          result = await this.timedIndexer(module, timeout);
        } catch (er: unknown) {
          result = false;
          log.error(er);
        }
        if (result) passed += 1;
        else {
          failed += 1;
          log.warn(`Failed background index: ${module}`);
          noAutoSearchIndex(Prefs, module);
        }
      }
    }

    if (passed || failed) {
      const end = new Date().valueOf();
      log.info(
        `Finished background indexer. (${failed} failed, ${
          Math.round((end - start) / 600) / 100
        } minutes)`,
      );
    } else {
      log.info(`No modules to index. (${modulesToIndex.length} modules)`);
    }
  },

  // searchIndexDelete
  // Deletes the search index of modname.
  searchIndexDelete(modname: string): boolean {
    if (this.isReady(true)) {
      return this.libxulsword.SearchIndexDelete(modname);
    }
    return false;
  },

  // searchIndexBuild
  // Note: Workers handle messages synchronously (ie worker handlers are always
  // run synchronously, even if they are async functions). So the only way to
  // interrupt a worker that is working, is indexer.kill(), which will be
  // effective. However in this case, the worker is of course immediately killed
  // with no further responses from it. Therefore, the only to know when a worker
  // has been terminated is to periodically check indexer.killed.
  async searchIndexBuild(
    modcode: string,
    callingWinId?: number,
  ): Promise<boolean> {
    return await new Promise((resolve, reject) => {
      if (this.isReady(true) && !(modcode in this.indexingID)) {
        const workerjs = Dirs.xsAsar.append(`dist/main/indexWorker.cjs`).path;
        const indexer = fork(workerjs);
        this.indexingID[modcode] = indexer;

        const watchForKill = setInterval(() => {
          if (indexer.killed) {
            doneError();
            resolve(false);
          }
        }, 200);

        const sendProgress = (percent: number) => {
          if (callingWinId) {
            let w = BrowserWindow?.fromId(Number(callingWinId)) ?? null;
            if (w) {
              const progress = percent / 100;
              w.webContents.send('progress', progress, 'search.indexer');
              w = null;
            }
          }
        };

        const send = (msg: MessagesToIndexWorker) => {
          log.silly(`Xulsword sending to Index Worker: ${JSON_stringify(msg)}`);
          indexer.send(msg);
        };

        const done = () => {
          sendProgress(0);
          clearInterval(watchForKill);
          delete this.indexingID[modcode];
        };

        const doneError = () => {
          done();
          if (indexer && !indexer.killed) {
            indexer.kill();
            log.debug(`indexer killed`);
          }
          if (this.luceneEnabled(modcode)) {
            if (!this.searchIndexDelete(modcode)) {
              log.error(`Failed to delete index after failure: ${modcode}`);
            }
          }
        };

        indexer.on('error', (er: Error) => {
          doneError();
          reject(er);
        });

        indexer.on('message', (indexerMsg: MessagesFromIndexWorker) => {
          log.silly(
            `Xulsword recieved from Index Worker: ${JSON_stringify(indexerMsg)}`,
          );
          const { msg } = indexerMsg;
          switch (msg) {
            case 'working': {
              const { percent } = indexerMsg;
              sendProgress(percent);
              break;
            }
            case 'finished': {
              done();
              resolve(true);
              break;
            }
            case 'failed': {
              doneError();
              resolve(false);
              break;
            }
            default:
              throw new Error(
                `Unhandled message from index worker: ${JSON_stringify(indexerMsg)}`,
              );
          }
        });

        send({
          command: 'log',
          logfile: Data.read('logfile'),
          loglevel: C.LogLevel,
        });

        send({
          command: 'start',
          directories: this.moduleDirectories,
          module: modcode,
        });
      } else resolve(false);
    });
  },

  searchIndexCancel(modcode: string, callingWinId?: number) {
    if (modcode in this.indexingID) {
      this.indexingID[modcode].kill();
      if (callingWinId) {
        let w = BrowserWindow?.fromId(Number(callingWinId)) ?? null;
        if (w) {
          w.webContents.send('progress', -1, 'search.indexer');
          w = null;
        }
      }
    }
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
        Cache.write(this.libxulsword.GetModuleList(), 'libswordModueList');
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
    paramname: keyof SwordConfigEntries | 'AbsoluteDataPath',
  ): string {
    if (this.isReady(true)) {
      const moduleInformation = this.libxulsword.GetModuleInformation(
        modname,
        paramname,
      );
      return moduleInformation;
    }
    return '';
  },
};

// Return the ModTypes type derived from a module config's ModDrv entry,
// or return null if it's not a ModTypes type.
export function getTypeFromModDrv(
  modDrv: string,
): ModTypes | 'XSM_audio' | null {
  if (modDrv.includes('Text')) return 'Biblical Texts';
  if (modDrv.includes('LD')) return 'Lexicons / Dictionaries';
  if (modDrv.includes('Com')) return 'Commentaries';
  if (modDrv.includes('RawGenBook')) return 'Generic Books';
  if (modDrv === 'audio') return 'XSM_audio';
  if (modDrv.includes('RawFiles')) return null;
  return null;
}

// Check a module's version and return rejection message(s) if it is not supported.
// Returns [] if the module is supported. If the module is passed by name, LibSword
// will be used to read config information, otherwise LibSword will not be called.
export function moduleUnsupported(
  module: string | SwordConfType,
): NewModuleReportType[] {
  const reasons: NewModuleReportType[] = [];
  const conf = typeof module === 'string' ? null : module;
  const module2 = (conf ? conf.module : module) as string;
  let moddrv;
  let minimumVersion;
  let v11n;
  if (conf) {
    moddrv = conf.ModDrv;
    minimumVersion = conf.MinimumVersion;
    v11n = conf.Versification || 'KJV';
  } else {
    moddrv = LibSword.getModuleInformation(module2, 'ModDrv');
    minimumVersion = LibSword.getModuleInformation(module2, 'MinimumVersion');
    v11n = LibSword.getModuleInformation(module2, 'Versification');
    if (v11n === C.NOTFOUND) v11n = 'KJV';
  }
  if (!minimumVersion || minimumVersion === C.NOTFOUND) minimumVersion = '0';
  const type = getTypeFromModDrv(moddrv);
  if (type && type in C.SupportedTabTypes) {
    if (versionCompare(C.SWORDEngineVersion, minimumVersion) < 0) {
      reasons.push({
        error: `(${module2}) Requires SWORD engine version > ${minimumVersion} (using ${C.SWORDEngineVersion}).`,
      });
    }
  } else if (!type && moddrv !== 'audio') {
    reasons.push({
      error: `(${module2}) Unsupported type '${type || moddrv}'.`,
    });
  }
  if (!C.SupportedV11ns.includes(v11n as V11nType)) {
    reasons.push({
      error: `(${module2}) Unsupported verse system '${v11n}'.`,
    });
  }
  return reasons;
}

export type LibSwordType = Omit<
  typeof LibSword,
  | 'initialized'
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
  | 'timedIndexer'
  | 'searchingID'
  | 'searchedID'
  | 'indexingID'
  | 'backgroundIndexerTO'
>;

export default LibSword as LibSwordType;
