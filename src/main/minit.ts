/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
/* eslint-disable import/no-mutable-exports */
import path from 'path';
import fs from 'fs';
import i18next from 'i18next';
import { BrowserWindow, Menu } from 'electron';
import C from '../constant';
import VerseKey from '../versekey';
import RefParser, { RefParserOptionsType } from '../refparse';
import { isASCII, JSON_parse } from '../common';
import Cache from '../cache';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';
import LibSword from './modules/libsword';
import nsILocalFile from './components/nsILocalFile';
import { getFontFaceConfigs } from './config';
import { ElectronWindow, jsdump } from './mutil';

import type {
  TabType,
  BookType,
  ModTypes,
  V11nType,
  GType,
  BookGroupType,
  LocationVKType,
  XulswordStatePref,
  WindowType,
} from '../type';

const fontList = require('font-list');

// These exported GPublic functions are called by the runtime
// auto-generated G object.

// Get all supported books in locale order. NOTE: xulsword ignores individual
// module book order in lieu of locale book order or xulsword default order
// (see C.SupportedBooks). Doing so provides a common order for book lists
// etc., simpler data structures, and a better experience for the user.
export function getBooks(): BookType[] {
  if (!Cache.has('books')) {
    let books: BookType[] = [];
    let index = 0;
    C.SupportedBookGroups.forEach(
      (bookGroup: typeof C.SupportedBookGroups[any]) => {
        C.SupportedBooks[bookGroup].forEach((code, bgi: number) => {
          books.push({
            code,
            name: code,
            longname: code,
            bookGroup,
            index,
            indexInBookGroup: bgi,
          });
          index += 1;
        });
      }
    );
    const stfile = path.join(
      Dirs.path.xsAsset,
      'locales',
      Prefs.getCharPref(C.LOCALEPREF),
      'common',
      'books.json'
    );
    const raw = fs.readFileSync(stfile);
    let data: any;
    if (raw && raw.length) {
      const json = JSON_parse(raw.toString());
      if (json && typeof json === 'object') {
        data = json;
      } else {
        throw Error(`failed to parse books.json at ${stfile}`);
      }
    } else {
      throw Error(`failed to read books.json at ${stfile}`);
    }

    const localeIndex = (book: BookType): number | null => {
      const key = `${book.code}i`;
      return key in data && Number(data[key]) ? Number(data[key]) : null;
    };

    // sort books according to xulsword locale
    books = books.sort((a: BookType, b: BookType) => {
      const la = localeIndex(a);
      const lb = localeIndex(b);
      if (la !== null && lb !== null) return la < lb ? -1 : la > lb ? 1 : 0;
      return a.index < b.index ? -1 : a.index > b.index ? 1 : 0;
    });

    // use xulsword locale book names (using SWORD locale would be
    // another option for some languages).
    books.forEach((bk: BookType) => {
      if (bk.code in data) {
        bk.name = data[bk.code];
        bk.longname = data[bk.code];
      }
      const key = `Long${bk.code}`;
      if (key in data) {
        bk.longname = data[key];
      }
    });

    Cache.write(books, 'books');
  }

  return Cache.read('books');
}

export function getBook(): { [i: string]: BookType } {
  if (!Cache.has('book')) {
    const book: { [i: string]: BookType } = {};
    getBooks().forEach((bk: BookType) => {
      book[bk.code] = bk;
    });
    Cache.write(book, 'book');
  }
  return Cache.read('book');
}

export function getTabs(): TabType[] {
  if (!Cache.has('tabs')) {
    const tabs: TabType[] = [];
    const modlist: any = LibSword.getModuleList();
    if (modlist === C.NOMODULES) return [];
    let i = 0;
    modlist.split('<nx>').forEach((mstring: string) => {
      const [module, mt] = mstring.split(';');
      const type = mt as ModTypes;
      let label = LibSword.getModuleInformation(module, 'TabLabel');
      if (label === C.NOTFOUND)
        label = LibSword.getModuleInformation(module, 'Abbreviation');
      if (label === C.NOTFOUND) label = module;
      let tabType;
      Object.entries(C.SupportedModuleTypes).forEach((entry) => {
        const [longType, shortType] = entry;
        if (longType === type) tabType = shortType;
      });
      if (!tabType) return;

      // Find conf file. Look at file name, then search contents if necessary
      const DIRSEP = process.platform === 'win32' ? '\\' : '/';
      let p = LibSword.getModuleInformation(module, 'AbsoluteDataPath').replace(
        /[\\/]/g,
        DIRSEP
      );
      if (p.slice(-1) !== DIRSEP) p += DIRSEP;
      const dir = p;
      p = p.replace(/[\\/]modules[\\/].*?$/, `${DIRSEP}mods.d`);
      let confFile = new nsILocalFile(
        `${p + DIRSEP + module.toLowerCase()}.conf`
      );
      if (!confFile.exists()) {
        confFile = new nsILocalFile(`${p + DIRSEP + module}.conf`);
        if (!confFile.exists()) {
          const modRE = new RegExp(`^\\[${module}\\]`);
          confFile = new nsILocalFile(p);
          if (confFile.exists()) {
            const files = confFile.directoryEntries;
            files?.forEach((file) => {
              const f = new nsILocalFile(confFile.path);
              f.append(file);
              if (!f.isDirectory() && /\.conf$/.test(f.leafName)) {
                const cdata = f.readFile();
                if (modRE.test(cdata)) confFile = f;
              }
            });
          }
        }
      }
      const conf = confFile.path;
      if (!confFile.exists())
        jsdump(
          `WARNING: tab.conf bad path "${p}$/${module.toLowerCase()}.conf"`
        );
      const isCommDir =
        confFile.path
          .toLowerCase()
          .indexOf(Dirs.path.xsModsCommon.toLowerCase()) === 0;
      const isVerseKey = type === C.BIBLE || type === C.COMMENTARY;

      const tab: TabType = {
        module,
        type,
        version: LibSword.getModuleInformation(module, 'Version'),
        v11n: isVerseKey ? LibSword.getVerseSystem(module) : '',
        dir,
        label,
        labelClass: isASCII(label) ? 'cs-LTR_DEFAULT' : `cs-${module}`,
        tabType,
        isVerseKey,
        isRTL: /^rt.?l$/i.test(
          LibSword.getModuleInformation(module, 'Direction')
        ),
        index: i,
        description: LibSword.getModuleInformation(module, 'Description'),
        conf,
        isCommDir,
        audio: {}, // will be filled in later
        audioCode: LibSword.getModuleInformation(module, 'AudioCode'),
        lang: LibSword.getModuleInformation(module, 'Lang'),
      };

      tabs.push(tab);

      i += 1;
    });
    Cache.write(tabs, 'tabs');
  }

  return Cache.read('tabs');
}

export function getTab(): { [i: string]: TabType } {
  if (!Cache.has('tab')) {
    const tab: { [i: string]: TabType } = {};
    const tabs = getTabs();
    tabs.forEach((t) => {
      tab[t.module] = t;
    });
    Cache.write(tab, 'tab');
  }
  return Cache.read('tab');
}

export function getBkChsInV11n() {
  if (!Cache.has('bkChsInV11n')) {
    // Data was parsed from sword/include/*.h files
    /* eslint-disable prettier/prettier */
    const bkChsInV11n: GType['BkChsInV11n'] = {
        Calvin:{ntSameAsKJV:1,otSameAsKJV:1},
        Catholic:{ntSameAsKJV:1,'1Chr':29,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Kgs':25,'2Macc':15,'2Sam':24,Amos:9,Bar:6,Dan:14,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:3,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Sir:51,Song:8,Tob:14,Wis:19,Zech:14,Zeph:3},
        Catholic2:{ntSameAsKJV:1,'1Chr':29,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Kgs':25,'2Macc':15,'2Sam':24,Amos:9,Bar:6,Dan:14,Deut:34,Eccl:12,Esth:16,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:3,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Sir:51,Song:8,Tob:14,Wis:19,Zech:14,Zeph:3},
        DarbyFr:{ntSameAsKJV:1,otSameAsKJV:1},
        German:{ntSameAsKJV:1,'1Chr':29,'1Kgs':22,'1Sam':31,'2Chr':36,'2Kgs':25,'2Sam':24,Amos:9,Dan:12,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:3,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Song:8,Zech:14,Zeph:3},
        KJV:{'1Cor':16,'1John':5,'1Pet':5,'1Thess':5,'1Tim':6,'2Cor':13,'2John':1,'2Pet':3,'2Thess':3,'2Tim':4,'3John':1,Acts:28,Col:4,Eph:6,Gal:6,Heb:13,Jas:5,John:21,Jude:1,Luke:24,Mark:16,Matt:28,Phil:4,Phlm:1,Rev:22,Rom:16,Titus:3,'1Chr':29,'1Kgs':22,'1Sam':31,'2Chr':36,'2Kgs':25,'2Sam':24,Amos:9,Dan:12,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jer:52,Job:42,Joel:3,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Song:8,Zech:14,Zeph:3},
        KJVA:{ntSameAsKJV:1,'1Chr':29,'1Esd':9,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Esd':16,'2Kgs':25,'2Macc':15,'2Sam':24,AddEsth:16,Amos:9,Bar:6,Bel:1,Dan:12,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:3,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,PrAzar:1,PrMan:1,Prov:31,Ps:150,Ruth:4,Sir:51,Song:8,Sus:1,Tob:14,Wis:19,Zech:14,Zeph:3},
        LXX:{ntSameAsKJV:1,'1Chr':29,'1En':108,'1Esd':9,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Kgs':25,'2Macc':15,'2Sam':24,'3Macc':7,'4Macc':18,Amos:9,Bar:5,Bel:1,Dan:12,Deut:34,Eccl:12,EpJer:1,Esth:16,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Odes:14,PrAzar:1,PrMan:1,Prov:31,Ps:151,PssSol:18,Ruth:4,Sir:51,Song:8,Sus:1,Tob:14,Wis:19,Zech:14,Zeph:3},
        Leningrad:{ntSameAsKJV:1,'1Chr':29,'1Kgs':22,'1Sam':31,'2Chr':36,'2Kgs':25,'2Sam':24,Amos:9,Dan:12,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:3,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Song:8,Zech:14,Zeph:3},
        Luther:{'1Cor':16,'1John':5,'1Pet':5,'1Thess':5,'1Tim':6,'2Cor':13,'2John':1,'2Pet':3,'2Thess':3,'2Tim':4,'3John':1,Acts:28,Col:4,Eph:6,Gal:6,Heb:13,Jas:5,John:21,Jude:1,Luke:24,Mark:16,Matt:28,Phil:4,Phlm:1,Rev:22,Rom:16,Titus:3,'1Chr':29,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Kgs':25,'2Macc':15,'2Sam':24,AddDan:3,AddEsth:7,Amos:9,Bar:6,Dan:12,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:3,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,PrMan:1,Prov:31,Ps:150,Ruth:4,Sir:51,Song:8,Tob:14,Wis:19,Zech:14,Zeph:3},
        MT:{ntSameAsKJV:1,'1Chr':29,'1Kgs':22,'1Sam':31,'2Chr':36,'2Kgs':25,'2Sam':24,Amos:9,Dan:12,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:3,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Song:8,Zech:14,Zeph:3},
        NRSV:{ntSameAsKJV:1,otSameAsKJV:1},
        NRSVA:{ntSameAsKJV:1,'1Chr':29,'1Esd':9,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Esd':16,'2Kgs':25,'2Macc':15,'2Sam':24,'3Macc':7,'4Macc':18,AddPs:1,Amos:9,Bar:6,Bel:1,Dan:12,Deut:34,Eccl:12,Esth:10,EsthGr:16,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:3,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,PrAzar:1,PrMan:1,Prov:31,Ps:150,Ruth:4,Sir:51,Song:8,Sus:1,Tob:14,Wis:19,Zech:14,Zeph:3},
        Orthodox:{ntSameAsKJV:1,'1Chr':29,'1Esd':9,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Kgs':25,'2Macc':15,'2Sam':24,'3Macc':7,'4Macc':18,Amos:9,Bar:5,Bel:1,Dan:12,Deut:34,Eccl:12,EpJer:1,Esth:16,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:4,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,PrMan:1,Prov:31,Ps:151,Ruth:4,Sir:51,Song:8,Sus:1,Tob:14,Wis:19,Zech:14,Zeph:3},
        Segond:{ntSameAsKJV:1,otSameAsKJV:1},
        Synodal:{'1Cor':16,'1John':5,'1Pet':5,'1Thess':5,'1Tim':6,'2Cor':13,'2John':1,'2Pet':3,'2Thess':3,'2Tim':4,'3John':1,Acts:28,Col:4,Eph:6,Gal:6,Heb:13,Jas:5,John:21,Jude:1,Luke:24,Mark:16,Matt:28,Phil:4,Phlm:1,Rev:22,Rom:16,Titus:3,'1Chr':29,'1Esd':9,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Esd':16,'2Kgs':25,'2Macc':15,'2Sam':24,'3Macc':7,Amos:9,Bar:5,Dan:14,Deut:34,Eccl:12,EpJer:1,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:3,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,PrMan:1,Prov:31,Ps:151,Ruth:4,Sir:51,Song:8,Tob:14,Wis:19,Zech:14,Zeph:3},
        SynodalProt:{ntSameAsKJV:1,'1Chr':29,'1Kgs':22,'1Sam':31,'2Chr':36,'2Kgs':25,'2Sam':24,Amos:9,Dan:12,Deut:34,Eccl:12,Esth:10,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jer:52,Job:42,Joel:3,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Song:8,Zech:14,Zeph:3},
        Vulg:{'1Cor':16,'1Esd':9,'1John':5,'1Pet':5,'1Thess':5,'1Tim':6,'2Cor':13,'2Esd':16,'2John':1,'2Pet':3,'2Thess':3,'2Tim':4,'3John':1,Acts:28,AddPs:1,Col:4,EpLao:1,Eph:6,Gal:6,Heb:13,Jas:5,John:21,Jude:1,Luke:24,Mark:16,Matt:28,Phil:4,Phlm:1,PrMan:1,Rev:22,Rom:16,Titus:3,'1Chr':29,'1Kgs':22,'1Macc':16,'1Sam':31,'2Chr':36,'2Kgs':25,'2Macc':15,'2Sam':24,Amos:9,Bar:6,Dan:14,Deut:34,Eccl:12,Esth:16,Exod:40,Ezek:48,Ezra:10,Gen:50,Hab:3,Hag:2,Hos:14,Isa:66,Jdt:16,Jer:52,Job:42,Joel:3,Jonah:4,Josh:24,Judg:21,Lam:5,Lev:27,Mal:4,Mic:7,Nah:3,Neh:13,Num:36,Obad:1,Prov:31,Ps:150,Ruth:4,Sir:51,Song:8,Tob:14,Wis:19,Zech:14,Zeph:3},
      }
    /* eslint-enable prettier/prettier */
    Object.entries(bkChsInV11n).forEach((entry) => {
      const [k, val] = entry;
      const key = k as keyof typeof bkChsInV11n;
      ['otSameAsKJV', 'ntSameAsKJV'].forEach((sk) => {
        const bg = sk.substring(0, 2) as BookGroupType;
        if (sk in val) {
          delete val[sk];
          C.SupportedBooks[bg].forEach((bk) => {
            bkChsInV11n[key][bk] = bkChsInV11n.KJV[bk];
          });
        }
      });
    });
    Cache.write(bkChsInV11n, 'bkChsInV11n');
  }

  return Cache.read('bkChsInV11n');
}

type ModulesPref = {
  [i: string]: {
    osis: string[];
  };
};

// The pref 'global.modules' is used to cache costly module data.
// If 'books' is in the pref-value, it is used, otherwise it is added
// to the pref-value. IMPORTANT: If a module is ever updated or removed,
// the global.modules pref MUST be reset or updated.
export function getBooksInModule(): { [i: string]: string[] } {
  if (!Cache.has('booksInMdule')) {
    const modlist = LibSword.getModuleList();
    const availableBooks: { [i: string]: string[] } = {};
    if (modlist === C.NOMODULES) return availableBooks;
    const prefmod: ModulesPref = Prefs.getComplexValue('global.modules');
    const tabs = getTabs();
    const modules: string[] = [];
    tabs.forEach((t: TabType) => {
      modules.push(t.module);
      if (!(t.module in prefmod)) {
        prefmod[t.module] = { osis: [] };
        if (t.v11n && (t.type === C.BIBLE || t.type === C.COMMENTARY)) {
          const v11nbooks = Object.keys(getBkChsInV11n()[t.v11n]);
          // When references to missing books are requested from SWORD,
          // the previous (or last?) book in the module is usually quietly
          // used and read from instead! The exception seems to be when a
          // reference to the first (or following?) missing book(s) after
          // the last included book of a module is requested, which
          // correctly returns an empty string. In any case, when ambiguous
          // results are returned, test two verses to make sure they are
          // different and are not the empty string, to determine whether
          // the book is missing from the module.
          // NOTE: All books are checked for each module, even those not
          // present in a module's versification system; but since results
          // are cached to disk, it's not too slow anyway, and many of the
          // supported books are not present in any supported v11n,
          // why not check them all and log any weirdness.
          const fake = LibSword.getVerseText(t.module, 'FAKE 1:1', false);
          const osis: string[] = [];
          getBooks().forEach((bk: BookType) => {
            const verse1 = LibSword.getVerseText(
              t.module,
              `${bk.code} 1:1`,
              false
            );
            if (!verse1 || verse1 === fake) {
              const verse2 = LibSword.getVerseText(
                t.module,
                `${bk.code} 1:2`,
                false
              );
              if (!verse2 || verse1 === verse2) return;
            }
            osis.push(bk.code);
          });
          osis.forEach((bk) => {
            if (!v11nbooks.includes(bk))
              jsdump(
                `Module: '${t.module}' contains book: '${bk}' which is not part of module's v11n: '${t.v11n}'.`
              );
          });
          prefmod[t.module].osis = osis;
        }
      }
      availableBooks[t.module] = prefmod[t.module].osis;
    });
    Object.keys(prefmod).forEach((module) => {
      if (!modules.includes(module)) delete prefmod[module];
    });
    Prefs.setComplexValue('global.modules', prefmod);
    Cache.write(availableBooks, 'booksInMdule');
  }

  return Cache.read('booksInMdule');
}

// LibSword.getMaxChapter returns an unpredictable wrong number if
// vkeytext's book is not part of v11n, but a LibSword call is
// unnecessary with G.BooksInV11n. NOTE: rutil has this same function.
export function getMaxChapter(v11n: V11nType, vkeytext: string) {
  const [book] = vkeytext.split(/[\s.:]/);
  const bkChsInV11n = getBkChsInV11n();
  if (!(v11n in bkChsInV11n)) return 0;
  if (!(book in bkChsInV11n[v11n])) return 0;
  return bkChsInV11n[v11n][book];
}

// NOTE: rutil has this same function.
export function getMaxVerse(v11n: V11nType, vkeytext: string) {
  const maxch = getMaxChapter(v11n, vkeytext);
  return maxch ? LibSword.getMaxVerse(v11n, vkeytext) : 0;
}

export function refParser(options?: RefParserOptionsType): RefParser {
  const gfunctions = {
    Book: () => {
      return getBook();
    },
  };
  const localesAccessor = () => {
    const locs: string[][] = Prefs.getComplexValue('global.locales');
    return locs.map((val) => val[0]);
  };
  return new RefParser(gfunctions, localesAccessor, options);
}

export function verseKey(
  versekey: LocationVKType | string,
  v11n?: V11nType
): VerseKey {
  const lscl = (fromv11n: V11nType, vkeytext: string, tov11n: V11nType) => {
    return LibSword.convertLocation(fromv11n, vkeytext, tov11n);
  };
  const gfunctions = {
    Book: () => {
      return getBook();
    },
    BkChsInV11n: () => {
      return getBkChsInV11n();
    },
    Tab: () => {
      return getTab();
    },
  };
  return new VerseKey(
    refParser({ noOsisCode: true }),
    lscl,
    gfunctions,
    versekey,
    v11n
  );
}

// If null is returned, fonts are loading, so another call is required.
export function getSystemFonts() {
  if (!Cache.has('fontList')) {
    return fontList
      .getFonts()
      .then((fonts: string[]) => {
        const allfonts = Object.keys(getFontFaceConfigs()).concat(fonts);
        Cache.write(allfonts, 'fontList');
        return allfonts;
      })
      .catch((err: any) => console.log(err));
  }
  return Promise.resolve(Cache.read('fontList'));
}

export function setMenuFromPrefs(menu: Electron.Menu) {
  if (!menu.items) return;
  menu.items.forEach((i) => {
    if (i.id && i.type === 'checkbox') {
      const [type, pi, mod] = i.id.split('_');
      if (type === 'showtab') {
        const panelIndex = Number(pi);
        const pval = Prefs.getComplexValue(
          'xulsword.tabs'
        ) as XulswordStatePref['tabs'];
        if (panelIndex === -1) {
          i.checked = pval.every((p: any) => p?.includes(mod));
        } else {
          i.checked = Boolean(pval[panelIndex]?.includes(mod));
        }
      } else {
        i.checked = Prefs.getBoolPref(i.id);
      }
    } else if (i.id && i.type === 'radio') {
      const [pref, str] = i.id.split('_val_');
      if (pref === 'xulsword.panels') {
        const numPanels = Prefs.getComplexValue(pref).filter(
          (m: string | null) => m || m === ''
        ).length;
        if (numPanels === Number(str)) i.checked = true;
      } else if (str !== '') {
        let val: string | number = str;
        if (Number(str).toString() === str) val = Number(str);
        const pval =
          typeof val === 'number'
            ? Prefs.getIntPref(pref)
            : Prefs.getCharPref(pref);
        if (pval === val) i.checked = true;
      }
    }
    if (i.submenu) setMenuFromPrefs(i.submenu);
  });
}

export function setGlobalMenuFromPref(menu?: Electron.Menu) {
  const m = menu || Menu.getApplicationMenu();
  if (m !== null) setMenuFromPrefs(m);
}

// If window is specified, only window(s) corresponding to the
// window will be reset (and in that case the main process will
// not be reset either).
export function globalReset(
  window?: Partial<WindowType> | 'parent' | 'self' | 'children',
  caller?: BrowserWindow | null
) {
  const testwin: Partial<WindowType>[] = [];
  if (!window) Cache.clear();
  else if (window === 'parent') {
    if (caller) testwin.push(ElectronWindow[caller.getParentWindow().id]);
  } else if (window === 'self') {
    if (caller) testwin.push(ElectronWindow[caller.id]);
  } else if (window === 'children') {
    if (caller)
      testwin.concat(
        caller.getChildWindows().map((w) => {
          return ElectronWindow[w.id];
        })
      );
  } else {
    testwin.push(window);
  }
  BrowserWindow.getAllWindows().forEach((w) => {
    let resetThisWindow = true;
    if (testwin.length) {
      resetThisWindow = testwin.some((tw) => {
        return Object.entries(tw).every((entry) => {
          const p = entry[0] as keyof WindowType;
          const v = entry[1] as any;
          return ElectronWindow[w.id][p] === v;
        });
      });
    }
    if (resetThisWindow) {
      w.webContents.send('cache-reset');
      w.webContents.send('module-reset');
      w.webContents.send('component-reset');
    }
  });
}

// Pushes user preference changes to one or all windows to update their
// state prefs. Some changes require more than simply updating state prefs,
// to take full effect, such as those effecting locale or dynamic stylesheet;
// so with the exception of LOCALEPREF, such preferences MUST be included
// in the prefs argument or they will not take full effect. Normally only
// the focused window is allowed to update other windows, otherwise loops
// will occur. But to update all windows regardless, set unfocusedUpdate
// to true if you're sure there can be no cycling for the operation.
export function setGlobalStateFromPref(
  win: BrowserWindow | null,
  prefs?: string | string[],
  unfocusedUpdate = false
) {
  const requiresReset = [C.LOCALEPREF, 'global.fontSize'];
  const prefsArray = ((prefs && !Array.isArray(prefs) && [prefs]) || prefs) as
    | string[]
    | undefined;
  const doReset = prefsArray
    ? prefsArray.some((p) => requiresReset.includes(p))
    : false;

  if (unfocusedUpdate || !win || win === BrowserWindow.getFocusedWindow()) {
    const lng = Prefs.getCharPref(C.LOCALEPREF);
    if (lng !== i18next.language) {
      i18next
        .loadLanguages(lng)
        .then(() => i18next.changeLanguage(lng))
        .then(() => {
          // this does component-reset which updates state from pref
          globalReset();
          return true;
        })
        .catch((err: any) => {
          if (err) throw Error(err);
        });
    } else if (doReset) {
      globalReset();
    } else {
      BrowserWindow.getAllWindows().forEach((w) => {
        // Never update the calling window.
        if (!win || w !== win)
          w.webContents.send('update-state-from-pref', prefs);
      });
    }
  }
}
