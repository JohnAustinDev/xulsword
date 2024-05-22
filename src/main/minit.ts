/* eslint-disable no-nested-ternary */
/* eslint-disable import/no-mutable-exports */
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import i18n from 'i18next';
import fontList from 'font-list';
import C from '../constant.ts';
import S from '../defaultPrefs.ts';
import VerseKey from '../verseKey.ts';
import RefParser, { RefParserOptionsType } from '../refParser.ts';
import {
  isASCII,
  JSON_parse,
  validateViewportModulePrefs,
  keep,
  normalizeFontFamily,
  pad,
  hierarchy,
  getSwordOptions,
} from '../common.ts';
import Cache from '../cache.ts';
import Subscription from '../subscription.ts';
import Dirs from './components/dirs.ts';
import Prefs from './components/prefs.ts';
import DiskCache from './components/diskcache.ts';
import LibSword from './components/libsword.ts';
import LocalFile from './components/localFile.ts';
import Window from './components/window.ts';
import { moduleUnsupported, CipherKeyModules } from './components/module.ts';
import getFontFamily from './fontfamily.js';
import parseSwordConf from './parseSwordConf.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  TabType,
  BookType,
  ModTypes,
  V11nType,
  GType,
  LocationVKType,
  FeatureMods,
  SwordConfType,
  ConfigType,
  FontFaceType,
  OSISBookType,
  SwordFeatureMods,
  XulswordFeatureMods,
  BookGroupType,
  VerseKeyAudioFile,
  GenBookAudioFile,
  ModulesCache,
  TreeNodeInfoPref,
} from '../type.ts';
import type RenderPromise from '../renderer/renderPromise.ts';

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
      i18n.language,
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

export function getBkChsInV11n(): {
  [key in V11nType]: [string, number][];
} {
  if (!Cache.has('bkChsInV11n')) {
    // Data was parsed from sword/include/*.h files using /util/readCanons.pl
    const sameAsKJV = {
      KJV: { ot: 0, nt: 0 },
      Calvin: { ot: 1, nt: 1 },
      Catholic: { ot: 0, nt: 1 },
      Catholic2: { ot: 0, nt: 1 },
      DarbyFr: { ot: 1, nt: 1 },
      German: { ot: 0, nt: 1 },
      KJVA: { ot: 0, nt: 1 },
      Leningrad: { ot: 0, nt: 1 },
      Luther: { ot: 0, nt: 0 },
      LXX: { ot: 0, nt: 1 },
      MT: { ot: 0, nt: 1 },
      NRSV: { ot: 1, nt: 1 },
      NRSVA: { ot: 0, nt: 1 },
      Orthodox: { ot: 0, nt: 1 },
      Segond: { ot: 1, nt: 1 },
      Synodal: { ot: 0, nt: 0 },
      SynodalProt: { ot: 0, nt: 1 },
      Vulg: { ot: 0, nt: 0 },
    };
    /* eslint-disable prettier/prettier */
    const bkChsInV11n: GType['BkChsInV11n'] = {
      KJV:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Esth',10],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Isa',66],['Jer',52],['Lam',5],['Ezek',48],['Dan',12],['Hos',14],['Joel',3],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4],['Matt',28],['Mark',16],['Luke',24],['John',21],['Acts',28],['Rom',16],['1Cor',16],['2Cor',13],['Gal',6],['Eph',6],['Phil',4],['Col',4],['1Thess',5],['2Thess',3],['1Tim',6],['2Tim',4],['Titus',3],['Phlm',1],['Heb',13],['Jas',5],['1Pet',5],['2Pet',3],['1John',5],['2John',1],['3John',1],['Jude',1],['Rev',22]],
      Calvin:[],
      Catholic:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Tob',14],['Jdt',16],['Esth',10],['1Macc',16],['2Macc',15],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Wis',19],['Sir',51],['Isa',66],['Jer',52],['Lam',5],['Bar',6],['Ezek',48],['Dan',14],['Hos',14],['Joel',4],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',3]],
      Catholic2:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Tob',14],['Jdt',16],['Esth',16],['1Macc',16],['2Macc',15],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Wis',19],['Sir',51],['Isa',66],['Jer',52],['Lam',5],['Bar',6],['Ezek',48],['Dan',14],['Hos',14],['Joel',4],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',3]],
      DarbyFr:[],
      German:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Esth',10],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Isa',66],['Jer',52],['Lam',5],['Ezek',48],['Dan',12],['Hos',14],['Joel',4],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',3]],
      KJVA:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Esth',10],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Isa',66],['Jer',52],['Lam',5],['Ezek',48],['Dan',12],['Hos',14],['Joel',3],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4],['1Esd',9],['2Esd',16],['Tob',14],['Jdt',16],['AddEsth',16],['Wis',19],['Sir',51],['Bar',6],['PrAzar',1],['Sus',1],['Bel',1],['PrMan',1],['1Macc',16],['2Macc',15]],
      Leningrad:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['Isa',66],['Jer',52],['Ezek',48],['Hos',14],['Joel',4],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',3],['1Chr',29],['2Chr',36],['Ps',150],['Job',42],['Prov',31],['Ruth',4],['Song',8],['Eccl',12],['Lam',5],['Esth',10],['Dan',12],['Ezra',10],['Neh',13]],
      Luther:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Esth',10],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Isa',66],['Jer',52],['Lam',5],['Ezek',48],['Dan',12],['Hos',14],['Joel',4],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',3],['Jdt',16],['Wis',19],['Tob',14],['Sir',51],['Bar',6],['1Macc',16],['2Macc',15],['AddEsth',7],['AddDan',3],['PrMan',1],['Matt',28],['Mark',16],['Luke',24],['John',21],['Acts',28],['Rom',16],['1Cor',16],['2Cor',13],['Gal',6],['Eph',6],['Phil',4],['Col',4],['1Thess',5],['2Thess',3],['1Tim',6],['2Tim',4],['Titus',3],['Phlm',1],['1Pet',5],['2Pet',3],['1John',5],['2John',1],['3John',1],['Heb',13],['Jas',5],['Jude',1],['Rev',22]],
      LXX:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['1Esd',9],['Ezra',10],['Neh',13],['Esth',16],['Jdt',16],['Tob',14],['1Macc',16],['2Macc',15],['3Macc',7],['4Macc',18],['Ps',151],['PrMan',1],['Prov',31],['Eccl',12],['Song',8],['Job',42],['Wis',19],['Sir',51],['PssSol',18],['Hos',14],['Amos',9],['Mic',7],['Joel',4],['Obad',1],['Jonah',4],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4],['Isa',66],['Jer',52],['Bar',5],['Lam',5],['EpJer',1],['Ezek',48],['PrAzar',1],['Sus',1],['Dan',12],['Bel',1],['1En',108],['Odes',14]],
      MT:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['Isa',66],['Jer',52],['Ezek',48],['Hos',14],['Joel',4],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',3],['Ps',150],['Job',42],['Prov',31],['Ruth',4],['Song',8],['Eccl',12],['Lam',5],['Esth',10],['Dan',12],['Ezra',10],['Neh',13],['1Chr',29],['2Chr',36]],
      NRSV:[],
      NRSVA:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Esth',10],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Isa',66],['Jer',52],['Lam',5],['Ezek',48],['Dan',12],['Hos',14],['Joel',3],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4],['Tob',14],['Jdt',16],['EsthGr',16],['Wis',19],['Sir',51],['Bar',6],['PrAzar',1],['Sus',1],['Bel',1],['1Macc',16],['2Macc',15],['1Esd',9],['PrMan',1],['AddPs',1],['3Macc',7],['2Esd',16],['4Macc',18]],
      Orthodox:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['1Esd',9],['Ezra',10],['Neh',13],['Tob',14],['Jdt',16],['Esth',16],['1Macc',16],['2Macc',15],['3Macc',7],['Ps',151],['PrMan',1],['Job',42],['Prov',31],['Eccl',12],['Song',8],['Wis',19],['Sir',51],['Hos',14],['Amos',9],['Mic',7],['Joel',4],['Obad',1],['Jonah',4],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4],['Isa',66],['Jer',52],['Bar',5],['Lam',5],['EpJer',1],['Ezek',48],['Sus',1],['Dan',12],['Bel',1],['4Macc',18]],
      Segond:[],
      Synodal:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['PrMan',1],['Ezra',10],['Neh',13],['1Esd',9],['Tob',14],['Jdt',16],['Esth',10],['Job',42],['Ps',151],['Prov',31],['Eccl',12],['Song',8],['Wis',19],['Sir',51],['Isa',66],['Jer',52],['Lam',5],['EpJer',1],['Bar',5],['Ezek',48],['Dan',14],['Hos',14],['Joel',3],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4],['1Macc',16],['2Macc',15],['3Macc',7],['2Esd',16],['Matt',28],['Mark',16],['Luke',24],['John',21],['Acts',28],['Jas',5],['1Pet',5],['2Pet',3],['1John',5],['2John',1],['3John',1],['Jude',1],['Rom',16],['1Cor',16],['2Cor',13],['Gal',6],['Eph',6],['Phil',4],['Col',4],['1Thess',5],['2Thess',3],['1Tim',6],['2Tim',4],['Titus',3],['Phlm',1],['Heb',13],['Rev',22]],
      SynodalProt:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Esth',10],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Isa',66],['Jer',52],['Lam',5],['Ezek',48],['Dan',12],['Hos',14],['Joel',3],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4]],
      Vulg:[['Gen',50],['Exod',40],['Lev',27],['Num',36],['Deut',34],['Josh',24],['Judg',21],['Ruth',4],['1Sam',31],['2Sam',24],['1Kgs',22],['2Kgs',25],['1Chr',29],['2Chr',36],['Ezra',10],['Neh',13],['Tob',14],['Jdt',16],['Esth',16],['Job',42],['Ps',150],['Prov',31],['Eccl',12],['Song',8],['Wis',19],['Sir',51],['Isa',66],['Jer',52],['Lam',5],['Bar',6],['Ezek',48],['Dan',14],['Hos',14],['Joel',3],['Amos',9],['Obad',1],['Jonah',4],['Mic',7],['Nah',3],['Hab',3],['Zeph',3],['Hag',2],['Zech',14],['Mal',4],['1Macc',16],['2Macc',15],['Matt',28],['Mark',16],['Luke',24],['John',21],['Acts',28],['Rom',16],['1Cor',16],['2Cor',13],['Gal',6],['Eph',6],['Phil',4],['Col',4],['1Thess',5],['2Thess',3],['1Tim',6],['2Tim',4],['Titus',3],['Phlm',1],['Heb',13],['Jas',5],['1Pet',5],['2Pet',3],['1John',5],['2John',1],['3John',1],['Jude',1],['Rev',22],['PrMan',1],['1Esd',9],['2Esd',16],['AddPs',1],['EpLao',1]],
    };
    /* eslint-enable prettier/prettier */
    const kjvot = bkChsInV11n.KJV.slice(0, 39);
    const kjvnt = bkChsInV11n.KJV.slice(39);
    Object.keys(bkChsInV11n).forEach((k) => {
      const v11n = k as keyof typeof bkChsInV11n;
      if (sameAsKJV[v11n].ot) {
        bkChsInV11n[v11n].splice(0, 0, ...kjvot);
      }
      if (sameAsKJV[v11n].nt) {
        bkChsInV11n[v11n].push(...kjvnt);
      }
    });
    Cache.write(bkChsInV11n, 'bkChsInV11n');
  }

  return Cache.read('bkChsInV11n');
}

export function GetBooksInVKModules(): { [k:string]: OSISBookType[] } {
  const r: { [k:string]: OSISBookType[] } = {};
  getTabs().forEach((t) => {
    r[t.module] = getBooksInVKModule(t.module);
  });
  return r;
}

export function getBooksInVKModule(module: string): OSISBookType[] {
  if (!Cache.has('booksInModule', module)) {
    const bkChsInV11n = getBkChsInV11n();
    const book = getBook();
    let v11n = LibSword.getModuleInformation(
      module,
      'Versification'
    ) as V11nType;
    if (v11n === C.NOTFOUND) v11n = 'KJV';
    const isVerseKey = /(text|com)/i.test(
      LibSword.getModuleInformation(module, 'ModDrv')
    );
    const options = getSwordOptions(false, C.BIBLE);
    const osis: string[] = [];
    if (isVerseKey) {
      const v11nbooks = bkChsInV11n[v11n].map((x) => x[0]);
      // When references to missing books are requested from SWORD,
      // the previous (or last?) book in the module is usually quietly
      // used and read from instead! The exception seems to be when a
      // reference to the first (or following?) missing book(s) after
      // the last included book of a module is requested, which
      // correctly returns an empty string. In any case, when ambiguous
      // results are returned, test two verses to make sure they are
      // different and are not the empty string, to determine whether
      // the book is missing from the module.
      const fake = LibSword.getVerseText(module, 'FAKE 1:1', false, options);
      v11nbooks.forEach((code: string) => {
        const bk = book[code];
        const verse1 = LibSword.getVerseText(module, `${bk.code} 1:1`, false, options);
        if (!verse1 || verse1 === fake) {
          // Lopukhin Colossians starts at verse 3, so used verse 3 instead of 2 here:
          const verse2 = LibSword.getVerseText(module, `${bk.code} 1:3`, false, options);
          if (!verse2 || verse1 === verse2) return;
        }
        osis.push(bk.code);
      });
    }
    Cache.write(osis, 'booksInModule', module);
  }

  return Cache.read('booksInModule', module);
}

// Return a locale (if any) to associate with a module:
//    Return a Locale with exact same language code as module
//    Return a Locale having same base language code as module, prefering current Locale over any others
//    Return a Locale which lists the module as an associated module
//    Return null if no match
function getLocaleOfModule(module: string) {
  const cacheName = `getLocaleOfModule-${module}`;
  if (!Cache.has(cacheName)) {
    let myLocale: string | null = null;

    const progLocale = i18n.language;
    let ml: any = LibSword.getModuleInformation(module, 'Lang').toLowerCase();
    if (ml === C.NOTFOUND) ml = undefined;

    let stop = false;
    C.Locales.forEach((l: any) => {
      const [locale] = l;
      if (stop) return;
      const lcs = locale.toLowerCase();

      if (ml && ml === lcs) {
        myLocale = locale;
        stop = true;
        return;
      }
      if (ml && lcs && ml.replace(/-.*$/, '') === lcs.replace(/-.*$/, '')) {
        myLocale = locale;
        if (myLocale === progLocale) stop = true;
      }
    });

    if (!myLocale) {
      const regex = new RegExp(`(^|s|,)+${module}(,|s|$)+`);
      C.Locales.forEach((l: any) => {
        const [locale] = l;
        const toptions = {
          lng: locale,
          ns: 'config',
        };
        if (i18n.t('DefaultModule', toptions).match(regex)) myLocale = locale;
      });
    }
    Cache.write(myLocale, cacheName);
  }

  return Cache.read(cacheName);
}

export function getTabs(): TabType[] {
  if (!Cache.has('tabs')) {
    Object.keys(CipherKeyModules).forEach((k) => delete CipherKeyModules[k]);
    const tabs: TabType[] = [];
    const modlist: any = LibSword.getModuleList();
    if (modlist === C.NOMODULES) return [];
    modlist.split('<nx>').forEach((mstring: string) => {
      const [module, mt] = mstring.split(';');
      const type = mt as ModTypes;
      if (module && moduleUnsupported(module).length === 0) {
        let label = LibSword.getModuleInformation(module, 'TabLabel');
        if (label === C.NOTFOUND)
          label = LibSword.getModuleInformation(module, 'Abbreviation');
        if (label === C.NOTFOUND) label = module;
        let tabType;
        Object.entries(C.SupportedTabTypes).forEach((entry) => {
          const [longType, shortType] = entry;
          if (longType === type) tabType = shortType;
        });
        if (!tabType) return;

        // Find conf file. First look for typical file name (lowercase of module code),
        // then search contents when necessary.
        let p = LibSword.getModuleInformation(
          module,
          'AbsoluteDataPath'
        ).replace(/[\\/]/g, path.sep);
        if (p.slice(-1) !== path.sep) p += path.sep;
        const modsd = p.replace(/[\\/]modules[\\/].*?$/, `${path.sep}mods.d`);
        let confFile: LocalFile | null = new LocalFile(
          `${modsd + path.sep + module.toLowerCase()}.conf`
        );
        if (!confFile.exists()) {
          // Try another possibility (unchanged case module code).
          confFile = new LocalFile(`${modsd + path.sep + module}.conf`);
          if (!confFile.exists()) {
            confFile = null;
            // Otherwise parse the module code from every conf file looking for a match.
            const modsdDir = new LocalFile(modsd);
            const modRE = new RegExp(`^\\[${module}\\]`);
            if (modsdDir.exists() && modsdDir.isDirectory()) {
              const files = modsdDir.directoryEntries;
              files?.forEach((file) => {
                if (confFile) return;
                const f = modsdDir.clone().append(file);
                if (!f.isDirectory() && /\.conf$/.test(f.leafName)) {
                  const cdata = f.readFile();
                  if (modRE.test(cdata)) confFile = f;
                }
              });
            }
          }
        }
        if (!confFile || !confFile.exists()) {
          log.warn(`A config file for '${module}' was not found in '${modsd}'`);
          return;
        }
        const confPath = confFile.path;
        const conf = parseSwordConf(confFile);
        const cipherKey = LibSword.getModuleInformation(module, 'CipherKey');
        if (cipherKey !== C.NOTFOUND) {
          CipherKeyModules[module] = {
            confPath,
            cipherKey,
            numBooks: cipherKey === '' ? 0 : getBooksInVKModule(module).length,
          };
          if (cipherKey === '') return;
        }
        const isVerseKey = type === C.BIBLE || type === C.COMMENTARY;

        const tab: TabType = {
          module,
          type,
          v11n: isVerseKey ? LibSword.getVerseSystem(module) : '',
          label,
          labelClass: isASCII(label) ? 'cs-LTR_DEFAULT' : `cs-${module}`,
          tabType,
          isVerseKey,
          direction: /^rt.?l$/i.test(
            LibSword.getModuleInformation(module, 'Direction')
          )
            ? 'rtl'
            : 'ltr',
          conf,
        };

        tabs.push(tab);
      }
    });
    const sorted = tabs.sort((a, b) => {
      // Sort tabs into the following order:
      // - By module type
      // - Modules matching the current locale
      // - Modules matching any installed locale
      // - By label alpha
      if (a.tabType === b.tabType) {
        const aLocale = getLocaleOfModule(a.module);
        const bLocale = getLocaleOfModule(b.module);
        const lng = i18n.language;
        const aPriority = aLocale ? (aLocale === lng ? 1 : 2) : 3;
        const bPriority = bLocale ? (bLocale === lng ? 1 : 2) : 3;
        if (aPriority !== bPriority) return aPriority > bPriority ? 1 : -1;
        // Type and Priority are same, then sort by label's alpha.
        return a.label > b.label ? 1 : -1;
      }
      const mto = C.UI.Viewport.TabTypeOrder as any;
      return mto[a.tabType] > mto[b.tabType] ? 1 : -1;
    });
    Cache.write(sorted, 'tabs');
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

export function getCipherFailConfs(): SwordConfType[] {
  getTabs(); // to insure CipherKeyModules is set
  return Object.values(CipherKeyModules)
    .filter((v) => v.numBooks === 0 || v.cipherKey === '')
    .map((v) => {
      const f = new LocalFile(v.confPath);
      return (f.exists() && !f.isDirectory() && parseSwordConf(f)) || null;
    })
    .filter(Boolean) as SwordConfType[];
}

export function getAudioConfs(): { [module: string]: SwordConfType } {
  const confs: { [module: string]: SwordConfType } = {};
  const audio = Dirs.xsAudio.clone().append('mods.d');
  audio.directoryEntries.forEach((d) => {
    const f = audio.clone().append(d);
    if (!f.isDirectory() && f.leafName.endsWith('.conf')) {
      const c = parseSwordConf(f);
      confs[c.module] = c;
    }
  });
  return confs;
}

// LibSword.getMaxChapter returns an unpredictable wrong number if
// vkeytext's book is not part of v11n, but a LibSword call is
// unnecessary with G.BooksInV11n. NOTE: rutil has this same function.
export function getMaxChapter(v11n: V11nType, vkeytext: string) {
  const [book] = vkeytext.split(/[\s.:]/);
  const bkChsInV11n = getBkChsInV11n();
  if (!(v11n in bkChsInV11n)) return 0;
  const v = bkChsInV11n[v11n].find((x) => x[0] === book);
  return v ? v[1] : 0;
}

// NOTE: rutil has this same function.
export function getMaxVerse(v11n: V11nType, vkeytext: string) {
  const maxch = getMaxChapter(v11n, vkeytext);
  return maxch ? LibSword.getMaxVerse(v11n, vkeytext) : 0;
}

export function verseKey(
  versekey: LocationVKType | string,
  v11n?: V11nType | null,
  options?: RefParserOptionsType,
  _renderPromise?: RenderPromise | null // only used in renderer implementation
): VerseKey {
  return new VerseKey(
    new RefParser(
      i18n.language,
      getLocaleDigits(true),
      getLocalizedBooks(true),
      options
    ),
    getBkChsInV11n(),
    i18n.t('locale_direction'),
    {
      convertLocation: (
        fromv11n: V11nType,
        vkeytext: string,
        tov11n: V11nType
      ) => {
        return LibSword.convertLocation(fromv11n, vkeytext, tov11n);
      },
      Book: () => {
        return getBook();
      },
      Tab: () => {
        return getTab();
      },
    },
    versekey,
    v11n
  );
}

// If a module config fontFamily specifies a URL to a font, rather
// than a fontFamily, then parse the URL. Otherwise return null.
function fontURL(mod: string) {
  const url = LibSword.getModuleInformation(mod, 'Font').match(
    /(\w+:\/\/[^"')]+)\s*$/
  );
  return url
    ? { fontFamily: `_${url[1].replace(/[^\w\d]/g, '_')}`, url: url[1] }
    : null;
}

// Link to fonts which are in xulsword's xsFonts directory. Fonts
// listed will appear in font option menus and will be available to
// all modules. The fonts pref is used to cache costly font data.
export function getModuleFonts(): FontFaceType[] {
  if (!Cache.has('ModuleFonts')) {
    // Look for xulsword local fonts, which may be included with some
    // XSM modules.
    const ret = [] as FontFaceType[];
    let fonts = Prefs.getComplexValue('fonts', 'fonts') as typeof S.fonts.fonts;
    const fontfiles = Dirs.xsFonts.directoryEntries;
    let reread = true;
    if (
      fontfiles.length === Object.keys(fonts).length &&
      fontfiles?.every((f) => {
        return Object.keys(fonts).includes(f);
      })
    ) {
      reread = false;
    }
    if (reread) {
      fonts = {};
      fontfiles?.forEach((file) => {
        const font = new LocalFile(path.join(Dirs.path.xsFonts, file));
        let fontFamily = 'dir';
        if (!font.isDirectory()) {
          const ff = getFontFamily(font.path);
          if (ff) {
            // replace is for BPG Sans Regular, because otherwise it doesn't load in Chrome
            fontFamily = ff.replace(' GPL&GNU', '');
          } else fontFamily = 'unknown';
        }
        fonts[file] = { fontFamily, path: font.path };
      });
      Prefs.setComplexValue('fonts', fonts, 'fonts');
    }

    Object.values(fonts).forEach((info) => {
      if (info.fontFamily !== 'unknown' && info.fontFamily !== 'dir')
        ret.push({ fontFamily: info.fontFamily, path: info.path });
    });

    // Look for module config Font URL. A module's Font entry may be a URL or a
    // fontFamily or font file name. All available font files were added above.
    // But URLs should also be added if any module requests them.
    const tabs = getTabs();
    if (Prefs.getBoolPref('global.InternetPermission')) {
      tabs.forEach((t) => {
        const url = fontURL(t.module);
        if (url) ret.push({ fontFamily: url.fontFamily, url: url.url });
      });
    }
    Cache.write(ret, 'ModuleFonts');
  }
  return Cache.read('ModuleFonts');
}

// Return a list of available fonts, which include both those installed on
// the system, as well as all fonts referenced by modules. Modules reference
// fonts via URL or LocalFile.
export async function getSystemFonts(): Promise<string[]> {
  if (!Cache.has('fontList')) {
    try {
      const fonts = await fontList.getFonts();
      let allfonts = getModuleFonts()
        .map((f) => f.fontFamily)
        .concat(fonts);
      allfonts = Array.from(
        new Set(allfonts.map((f) => normalizeFontFamily(f)))
      );
      if (!Cache.has('fontList')) {
        Cache.write(allfonts, 'fontList');
      }
      return allfonts;
    } catch (err: any) {
      log.error(err);
    }
  }
  return Promise.resolve(Cache.read('fontList') as string[]);
}

// Search through installed modules to find which features have
// modules installed for them.
export function getFeatureModules(): FeatureMods {
  if (!Cache.has('swordFeatureMods')) {
    const swordFeatureMods: SwordFeatureMods = {
      StrongsNumbers: [],
      GreekDef: [],
      HebrewDef: [],
      GreekParse: [],
      HebrewParse: [],
      DailyDevotion: [],
      Glossary: [],
      Images: [],
      NoParagraphs: [],
    };
    const xulswordFeatureMods: XulswordFeatureMods = {
      greek: [],
      hebrew: [],
    };
    const Tab = getTab();
    getTabs().forEach((tab) => {
      const { module, type } = tab;
      const mlang = LibSword.getModuleInformation(module, 'Lang');
      if (type === C.BIBLE && mlang === 'grc') {
        xulswordFeatureMods.greek.push(module);
      } else if (
        type === C.BIBLE &&
        (mlang === 'hbo' || ['OSMHB', 'WLC', 'Aleppo'].includes(module))
      ) {
        xulswordFeatureMods.hebrew.push(module);
      }
      // Until xulsword updates the SWORD engine, only SynodalProt and KJV versifications
      // can be supported.
      xulswordFeatureMods.greek = xulswordFeatureMods.greek.filter((m) =>
        Object.keys(C.SupportedV11nMaps).includes(Tab[m].v11n)
      );
      xulswordFeatureMods.hebrew = xulswordFeatureMods.hebrew.filter((m) =>
        Object.keys(C.SupportedV11nMaps).includes(Tab[m].v11n)
      );

      // These Strongs feature modules do not have Strongs number keys, and so cannot be used
      const notStrongsKeyed = new RegExp(
        '^(AbbottSmith|InvStrongsRealGreek|InvStrongsRealHebrew)$',
        'i'
      );
      if (!notStrongsKeyed.test(module)) {
        const feature = LibSword.getModuleInformation(module, 'Feature');
        const features = feature.split(C.CONFSEP);
        Object.keys(swordFeatureMods).forEach((k) => {
          const swordk = k as keyof SwordFeatureMods;
          if (features.includes(swordk)) {
            swordFeatureMods[swordk].push(module);
          }
        });
      }
    });
    Cache.write(
      { ...swordFeatureMods, ...xulswordFeatureMods },
      'swordFeatureMods'
    );
  }

  return Cache.read('swordFeatureMods');
}

// Xulsword state prefs and certain global prefs should only reference
// installed modules or be empty string. This function insures that is
// the case.
export function validateGlobalModulePrefs() {
  const Tabs = getTabs();

  const xsprops: (keyof typeof S.prefs.xulsword)[] = [
    'panels',
    'ilModules',
    'mtModules',
    'tabs',
  ];
  const xulsword = keep(
    Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword,
    xsprops
  );

  validateViewportModulePrefs(Tabs, xulsword);

  const globalPopup: Partial<typeof S.prefs.global.popup> = {};

  const vklookup = Prefs.getComplexValue(
    'global.popup.vklookup'
  ) as typeof S.prefs.global.popup.vklookup;
  Object.entries(vklookup).forEach((entry) => {
    const m = entry[0] as keyof typeof S.prefs.global.popup.feature;
    const lumod = entry[1];
    if (!lumod || !Tabs.find((t) => t.module === lumod)) {
      delete vklookup[m];
    }
  });
  globalPopup.vklookup = vklookup;

  const feature = Prefs.getComplexValue(
    'global.popup.feature'
  ) as typeof S.prefs.global.popup.feature;
  Object.entries(feature).forEach((entry) => {
    const f = entry[0] as keyof typeof S.prefs.global.popup.feature;
    const m = entry[1];
    if (!m || !Tabs.find((t) => t.module === m)) {
      delete feature[f];
    }
  });
  // If no pref has been set for popup.selection[feature] then choose a
  // module from the available modules, if there are any.
  const featureModules = getFeatureModules();
  Object.entries(featureModules).forEach((entry) => {
    const f = entry[0] as keyof typeof S.prefs.global.popup.feature;
    const fmods = entry[1];
    if (!(f in feature) && Array.isArray(fmods) && fmods.length) {
      const pref = C.LocalePreferredFeature[
        i18n.language === 'en' ? 'en' : 'ru'
      ][f] as string[] | undefined;
      feature[f] = (pref && pref.find((m) => fmods.includes(m))) || fmods[0];
    }
  });
  globalPopup.feature = feature;

  // IMPORTANT: Use the skipCallbacks and clearRendererCaches arguments of
  // Prefs.mergeValue() to force renderer processes to update once, after
  // module prefs are valid. Otherwise renderer exceptions may be thrown as they
  // they would re-render with invalid module prefs.
  Prefs.mergeValue('global.popup', globalPopup, 'prefs', true, false);
  Prefs.mergeValue('xulsword', xulsword, 'prefs', false, true);

  // Any viewportWin windows also need modules to be checked,
  // which happens in viewportWin component contructor.
  Window.reset('component-reset', { type: 'viewportWin' });
}

export function resetMain() {
  Subscription.publish.resetMain();
}

export function getModuleConfig(mod: string) {
  if (!Cache.has(`moduleConfig${mod}`)) {
    const moduleConfig = {} as ConfigType;

    // All config properties should be present, having a valid value or null.
    // Read values from module's .conf file
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const prop = entry[0] as keyof typeof C.ConfigTemplate;
      const keyobj = entry[1];
      let r = null;
      if (keyobj.modConf) {
        if (mod !== 'LTR_DEFAULT') {
          r = LibSword.getModuleInformation(mod, keyobj.modConf);
          if (r === C.NOTFOUND) r = null;
          // Give Hebrew language modules the SILOT.ttf 'Ezra SIL' font,
          // if none was specified.
          if (
            prop === 'fontFamily' &&
            r === null &&
            LibSword.getModuleInformation(mod, 'Lang') === 'he'
          ) {
            r = 'Ezra SIL';
          }
        }
      }
      moduleConfig[prop] = r;
    });

    // Make any PreferredCSSXHTML into a full path
    if (moduleConfig.PreferredCSSXHTML) {
      const p = LibSword.getModuleInformation(
        mod,
        'AbsoluteDataPath'
      ).replaceAll('\\', '/');
      const p2 = `${p}${p.slice(-1) === '/' ? '' : '/'}`;
      moduleConfig.PreferredCSSXHTML = `${p2}${moduleConfig.PreferredCSSXHTML}`;
    }

    // Assign associated locales
    if (mod !== 'LTR_DEFAULT') {
      moduleConfig.AssociatedLocale = getLocaleOfModule(mod) || null;
    } else {
      moduleConfig.AssociatedLocale = i18n.language;
      moduleConfig.AssociatedModules = null;
    }

    // Normalize direction value
    moduleConfig.direction =
      moduleConfig.direction && moduleConfig.direction.search(/RtoL/i) !== -1
        ? 'rtl'
        : 'ltr';

    // Insure there are single quotes around font names and that we have the actual
    // font name and not a file name (which is used in some modules).
    let { fontFamily } = moduleConfig;
    if (fontFamily) {
      const font = getModuleFonts().find(
        (f) => fontFamily && f.path?.split('/').pop()?.includes(fontFamily)
      );
      if (font) fontFamily = font.fontFamily;
      moduleConfig.fontFamily = fontFamily.replace(/"/g, "'");
      if (!/'.*'/.test(moduleConfig.fontFamily))
        moduleConfig.fontFamily = `'${moduleConfig.fontFamily}'`;
    }
    Cache.write(moduleConfig, `moduleConfig${mod}`);
  }

  return Cache.read(`moduleConfig${mod}`);
}

export function getConfig() {
  const config: { [module: string]: ConfigType } = {};
  const cacheName = 'getConfig';
  if (!Cache.has(cacheName)) {
    getTabs().forEach((t) => {
      config[t.module] = getModuleConfig(t.module);
    });
    Cache.write(config, cacheName);
  }
  return Cache.read(cacheName) as typeof config;
}

export function getModuleConfigDefault() {
  return getModuleConfig('LTR_DEFAULT');
}

export function localeConfig(locale: string) {
  const lconfig = {} as ConfigType;
  const toptions = { lng: locale, ns: 'config' };
  // All config properties should be present, having a valid value or null.
  // Read any values from locale's config.json file.
  Object.entries(C.ConfigTemplate).forEach((entry) => {
    const prop = entry[0] as keyof typeof C.ConfigTemplate;
    const keyobj = entry[1];
    let r = null;
    if (keyobj.localeConf !== null) {
      r = i18n.exists(keyobj.localeConf, toptions)
        ? i18n.t(keyobj.localeConf, toptions)
        : null;
    }
    lconfig[prop] = r;
  });
  lconfig.AssociatedLocale = locale || null;
  // Module associations...
  const tabs = getTabs();
  const { AssociatedModules } = lconfig;
  const ams = (AssociatedModules && AssociatedModules.split(/\s*,\s*/)) || [];
  lconfig.AssociatedModules = null;
  const assocmods: Set<string> = new Set(
    ams.filter((m) => tabs.find((t) => t.module === m))
  );
  // Associate with modules having configs that associate with this locale.
  tabs.forEach((t) => {
    const config = getModuleConfig(t.module);
    if ('AssociatedLocale' in config && config.AssociatedLocale === locale) {
      assocmods.add(t.module);
    }
  });
  // Associate with modules sharing this exact locale
  tabs.forEach((t) => {
    if (LibSword.getModuleInformation(t.module, 'Lang') === locale) {
      assocmods.add(t.module);
    }
  });
  // Associate with modules sharing this locale's base language
  tabs.forEach((t) => {
    if (
      LibSword.getModuleInformation(t.module, 'Lang').replace(/-.*$/, '') ===
      locale.replace(/-.*$/, '')
    ) {
      assocmods.add(t.module);
    }
  });
  if (assocmods.size) {
    lconfig.AssociatedModules = Array.from(assocmods).join(',');
  }
  // Insure there are single quotes around font names
  if (lconfig.fontFamily) {
    lconfig.fontFamily = lconfig.fontFamily.replace(/"/g, "'");
    if (!/'.*'/.test(lconfig.fontFamily))
      lconfig.fontFamily = `'${lconfig.fontFamily}'`;
  }
  return lconfig;
}

export function getLocaleConfigs(): { [i: string]: ConfigType } {
  if (!Cache.has('localeConfigs')) {
    const ret = {} as { [i: string]: ConfigType };
    // Default locale config must have all CSS settings in order to
    // override unrelated ancestor config CSS.
    ret.locale = localeConfig(i18n.language);
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const key = entry[0] as keyof ConfigType;
      const typeobj = entry[1];
      if (typeobj.CSS && !ret.locale[key]) {
        const v = C.LocaleDefaultConfigCSS[key] || 'inherit';
        ret.locale[key] = v;
      }
    });
    C.Locales.forEach((l: any) => {
      const [lang] = l;
      ret[lang] = localeConfig(lang);
    });
    Cache.write(ret, 'localeConfigs');
  }
  return Cache.read('localeConfigs');
}

export function getLocaleDigits(getAll = false): {[locale: string]: string[] | null } {
  const locs = getAll ? C.Locales.map((l) => l[0]) : [i18n.language];
  const r: {[locale: string]: string[] | null} = {};
  locs.forEach((lng: any) => {
    let l = null;
    const toptions = { lng, ns: 'numbers' };
    for (let i = 0; i <= 9; i += 1) {
      const key = `n${i}`;
      if (i18n.exists(key, toptions) && !/^\s*$/.test(i18n.t(key, toptions))) {
        if (l === null) {
          l = [];
          for (let x = 0; x <= 9; x += 1) {
            l.push(x.toString());
          }
        }
        l[i] = i18n.t(key, toptions);
      }
    }
    r[lng] = l;
  });
  return r;
}

export function getLocalizedBooks(getAll = false): {
  [locale: string]: {
    [code: string]: [string[], string[], string[]];
  };
} {
  const locs = getAll ? C.Locales.map((l) => l[0]) : [i18n.language];
  // Currently xulsword locales only include ot and nt books.
  const r: {
    [locale: string]: {
      [code: string]: [string[], string[], string[]];
    };
  } = {};
  locs.forEach((locale) => {
    r[locale] = {};
    const toptions = { lng: locale, ns: 'books' };
    ['ot', 'nt'].forEach((bgs) => {
      const bg = bgs as BookGroupType;
      C.SupportedBooks[bg].forEach((code) => {
        const keys = [code, `Long${code}`, `${code}Variations`];
        r[locale][code] = keys.map((key) => {
          let str = '';
          // Must test for key's existence. Using return === key as the
          // existence check gives false fails: ex. Job === Job.
          if (i18n && i18n.exists(key, toptions)) {
            str = i18n.t(key, toptions);
          }
          return str ? str.split(/\s*,\s*/) : [];
        }) as any;
      });
    });
  });
  return r;
}

export function inlineFile(
  fpath: string,
  encoding = 'base64' as BufferEncoding,
  noHeader = false
): string {
  const file = new LocalFile(fpath);
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    ttf: 'font/ttf',
    svg: 'image/svg+xml',
    otf: 'font/otf',
    css: 'text/css',
    pdf: 'application/pdf',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
  } as any;
  const contentType =
    // eslint-disable-next-line no-useless-escape
    mimeTypes[fpath.replace(/^.*\.([^\.]+)$/, '$1').toLowerCase()];
  if (!file.exists() || (!noHeader && !contentType)) return '';
  const rawbuf = file.readBuf();
  return noHeader
    ? rawbuf.toString(encoding)
    : `data:${contentType};${encoding},${rawbuf.toString(encoding)}`;
}

export function inlineAudioFile(
  audio: VerseKeyAudioFile | GenBookAudioFile | null
): string {
  if (audio) {
    const { path: apath, audioModule } = audio;
    const G = Subscription.doPublish('getG') as GType[];
    if (audioModule && G) {
      const file = new LocalFile(G[0].Dirs.path.xsAudio);
      file.append('modules');
      file.append(audioModule);
      const leaf = pad(apath.pop() || 0, 3, 0);
      while (apath.length) {
        const p = apath.shift() as string | number;
        if (!Number.isNaN(Number(p))) {
          file.append(pad(p, 3, 0));
        } else file.append(p.toString());
      }
      for (let x = 0; x < C.SupportedAudio.length; x += 1) {
        const ext = C.SupportedAudio[x];
        const afile = file.clone().append(`${leaf}.${ext}`);
        if (afile.exists()) {
          return inlineFile(afile.path);
        }
      }
    }
  }
  return '';
}

export function getAllDictionaryKeyList(module: string): string[] {
  const pkey = 'keylist';
  if (!DiskCache.has(pkey, module)) {
    let list = LibSword.getAllDictionaryKeys(module);
    list.pop();
    // KeySort entry enables localized list sorting by character collation.
    // Square brackets are used to separate any arbitrary JDK 1.4 case
    // sensitive regular expressions which are to be treated as single
    // characters during the sort comparison. Also, a single set of curly
    // brackets can be used around a regular expression which matches any
    // characters/patterns that need to be ignored during the sort comparison.
    // IMPORTANT: Any square or curly bracket within regular expressions must
    // have had an additional backslash added before it.
    const sort0 = LibSword.getModuleInformation(module, 'KeySort');
    if (sort0 !== C.NOTFOUND) {
      const sort = `-${sort0}0123456789`;
      const getignRE = /(?<!\\)\{(.*?)(?<!\\)\}/; // captures the ignore regex
      const getsrtRE = /^\[(.*?)(?<!\\)\]/; // captures sorting regexes
      const getescRE = /\\(?=[{}[\]])/g; // matches the KeySort escapes
      const ignoreREs: RegExp[] = [/\s/];
      const ignREm = sort.match(getignRE);
      if (ignREm) ignoreREs.push(new RegExp(ignREm[1].replace(getescRE, '')));
      let sort2 = sort.replace(getignRE, '');
      let sortREs: [number, number, RegExp][] = [];
      for (let i = 0; sort2.length; i += 1) {
        let re = sort2.substring(0, 1);
        let rlen = 1;
        const mt = sort2.match(getsrtRE);
        if (mt) {
          [, re] = mt;
          rlen = re.length + 2;
        }
        sortREs.push([i, re.length, new RegExp(`^(${re})`)]);
        sort2 = sort2.substring(rlen);
      }
      sortREs = sortREs.sort((a, b) => {
        const [, alen] = a;
        const [, blen] = b;
        if (alen > blen) return -1;
        if (alen < blen) return 1;
        return 0;
      });
      list = list.sort((aa, bb) => {
        let a = aa;
        let b = bb;
        ignoreREs.forEach((re) => {
          a = aa.replace(re, '');
          b = bb.replace(re, '');
        });
        for (; a.length && b.length; ) {
          let x;
          let am;
          let bm;
          for (x = 0; x < sortREs.length; x += 1) {
            const [, , re] = sortREs[x];
            if (am === undefined && re.test(a)) am = sortREs[x];
            if (bm === undefined && re.test(b)) bm = sortREs[x];
          }
          if (am !== undefined && bm !== undefined) {
            const [ia, , rea] = am;
            const [ib, , reb] = bm;
            if (ia < ib) return -1;
            if (ia > ib) return 1;
            a = a.replace(rea, '');
            b = b.replace(reb, '');
          } else if (am !== undefined && bm === undefined) {
            return -1;
          } else if (am === undefined && bm !== undefined) {
            return 1;
          }
          const ax = a.charCodeAt(0);
          const bx = b.charCodeAt(0);
          if (ax < bx) return -1;
          if (ax > bx) return 1;
          a = a.substring(1);
          b = b.substring(1);
        }
        if (a.length && !b.length) return -1;
        if (!a.length && b.length) return 1;
        return 0;
      });
    }
    DiskCache.write(pkey, list, module);
  }
  return DiskCache.read(pkey, module) as ModulesCache[string]['keylist'];
}

// Important: allGbKeys must be output of getGenBookTableOfContents().
export function genBookTreeNodes(
  module: string,
  expanded?: boolean
): TreeNodeInfo[] {
  const pkey = 'treenodes';
  if (!DiskCache.has(pkey, module)) {
    DiskCache.write(
      pkey,
      hierarchy(
        LibSword.getGenBookTableOfContents(module).map((gbkey) => {
          const label = gbkey.split(C.GBKSEP);
          if (gbkey.endsWith(C.GBKSEP)) label.pop();
          const n: TreeNodeInfoPref = {
            id: gbkey,
            label: label[label.length - 1],
            className: module ? `cs-${module}` : 'cs-LTR_DEFAULT',
            hasCaret: gbkey.endsWith(C.GBKSEP),
          };
          return n;
        })
      ) as ModulesCache[string]['treenodes'],
      module
    );
  }
  const nodeinfos = DiskCache.read(pkey, module) as TreeNodeInfoPref[];
  nodeinfos.forEach((n) => {
    if (expanded !== undefined && 'hasCaret' in n && n.hasCaret)
      n.isExpanded = !!expanded;
  });
  return nodeinfos;
}
