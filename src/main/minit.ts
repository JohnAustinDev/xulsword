/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-mutable-exports */
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import i18next from 'i18next';
import C from '../constant';
import VerseKey from '../versekey';
import RefParser, { RefParserOptionsType } from '../refparse';
import { clone, isASCII, JSON_parse, parseSwordConf, tabSort } from '../common';
import Cache from '../cache';
import Subscription from '../subscription';
import Dirs from './components/dirs';
import Prefs from './components/prefs';
import LibSword from './components/libsword';
import LocalFile from './components/localFile';
import { getFeatureModules, getModuleFonts, getModuleConfig } from './config';
import { moduleUnsupported } from './components/module';

import type {
  TabType,
  BookType,
  ModTypes,
  V11nType,
  GType,
  LocationVKType,
  GlobalPrefType,
  XulswordStatePref,
  FeatureType,
  SwordConfType,
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
      i18next.language,
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
      if (module && moduleUnsupported(module).length === 0) {
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
        let p = LibSword.getModuleInformation(
          module,
          'AbsoluteDataPath'
        ).replace(/[\\/]/g, path.sep);
        if (p.slice(-1) !== path.sep) p += path.sep;
        const directory = p;
        p = p.replace(/[\\/]modules[\\/].*?$/, `${path.sep}mods.d`);
        let confFile = new LocalFile(
          `${p + path.sep + module.toLowerCase()}.conf`
        );
        if (!confFile.exists()) {
          confFile = new LocalFile(`${p + path.sep + module}.conf`);
          if (!confFile.exists()) {
            confFile = new LocalFile(p);
            const modRE = new RegExp(`^\\[${module}\\]`);
            if (confFile.exists() && confFile.isDirectory()) {
              const files = confFile.directoryEntries;
              let found: LocalFile | null = null;
              files?.forEach((file) => {
                if (found) return;
                const f = confFile.clone().append(file);
                if (!f.isDirectory() && /\.conf$/.test(f.leafName)) {
                  const cdata = f.readFile();
                  if (modRE.test(cdata)) {
                    found = f;
                  }
                }
              });
              if (found) confFile = found;
            }
          }
        }
        const confPath = confFile.path;
        if (!confFile.exists())
          log.warn(
            `tab config file bad path "${p}$/${module.toLowerCase()}.conf"`
          );
        const isCommDir =
          confFile.path
            .toLowerCase()
            .indexOf(Dirs.path.xsModsCommon.toLowerCase()) === 0;
        const isVerseKey = type === C.BIBLE || type === C.COMMENTARY;
        const obs = LibSword.getModuleInformation(module, 'Obsoletes');
        const obsoletes: string[] =
          obs !== C.NOTFOUND ? obs.split(C.CONFSEP) : [];

        const tab: TabType = {
          module,
          type,
          version: LibSword.getModuleInformation(module, 'Version'),
          config: getModuleConfig(module),
          v11n: isVerseKey ? LibSword.getVerseSystem(module) : '',
          directory,
          label,
          labelClass: isASCII(label) ? 'cs-LTR_DEFAULT' : `cs-${module}`,
          tabType,
          isVerseKey,
          direction: /^rt.?l$/i.test(
            LibSword.getModuleInformation(module, 'Direction')
          )
            ? 'rtl'
            : 'ltr',
          index: i,
          description: LibSword.getModuleInformation(module, 'Description'),
          confPath,
          isCommDir,
          audio: {}, // will be filled in later
          audioCode: LibSword.getModuleInformation(module, 'AudioCode'),
          lang: LibSword.getModuleInformation(module, 'Lang'),
          obsoletes,
        };

        tabs.push(tab);

        i += 1;
      }
    });
    Cache.write(tabs.sort(tabSort), 'tabs');
  }
  return Cache.read('tabs');
}

export function getTab(): { [i: string]: TabType } {
  if (!Cache.has('tab')) {
    const tab: { [i: string]: TabType } = {};
    const tabs = getTabs();
    tabs.forEach((t) => {
      tab[t.module] = t;
      // Create virtual tabs for obsoleted modules, so pre-existing bookmarks
      // etc. may continue to work. NOTE: It would be good to update such
      // references the next time they are referenced.
      t.obsoletes.forEach((om) => {
        tab[om] = t;
      });
    });
    Cache.write(tab, 'tab');
  }
  return Cache.read('tab');
}

export function getSwordConf(): { [mod: string]: SwordConfType } {
  const swordConf: { [mod: string]: SwordConfType } = {};
  getTabs().forEach((t) => {
    if (t.module && t.confPath) {
      const f = new LocalFile(t.confPath);
      if (f.exists()) {
        swordConf[t.module] = parseSwordConf(f, f.leafName);
      }
    }
  });
  return swordConf;
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

// The modules pref is used to cache costly module data.
// If 'books' is in the pref-value, it is used, otherwise it is added
// to the pref-value.
export function getBooksInModule(module: string): string[] {
  if (!Cache.has('booksInModule', module)) {
    const bkChsInV11n = getBkChsInV11n();
    const book = getBook();
    const t = getTab()[module];
    const osis: string[] = [];
    if (t && t.v11n && (t.type === C.BIBLE || t.type === C.COMMENTARY)) {
      const v11nbooks = bkChsInV11n[t.v11n].map((x) => x[0]);
      // When references to missing books are requested from SWORD,
      // the previous (or last?) book in the module is usually quietly
      // used and read from instead! The exception seems to be when a
      // reference to the first (or following?) missing book(s) after
      // the last included book of a module is requested, which
      // correctly returns an empty string. In any case, when ambiguous
      // results are returned, test two verses to make sure they are
      // different and are not the empty string, to determine whether
      // the book is missing from the module.
      const fake = LibSword.getVerseText(t.module, 'FAKE 1:1', false);

      v11nbooks.forEach((code: string) => {
        const bk = book[code];
        const verse1 = LibSword.getVerseText(t.module, `${bk.code} 1:1`, false);
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
    }
    Cache.write(osis, 'booksInModule', module);
  }

  return Cache.read('booksInModule', module);
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
  v11n?: V11nType,
  options?: RefParserOptionsType
): VerseKey {
  return new VerseKey(
    new RefParser(options),
    getBkChsInV11n(),
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

export function getSystemFonts() {
  if (!Cache.has('fontList')) {
    return fontList
      .getFonts()
      .then((fonts: string[]) => {
        let allfonts = getModuleFonts()
          .map((f) => f.fontFamily)
          .concat(fonts);
        allfonts = Array.from(new Set(allfonts));
        Cache.write(allfonts, 'fontList');
        return allfonts;
      })
      .catch((err: any) => log.error(err));
  }
  return Promise.resolve(Cache.read('fontList'));
}

// Xulsword state prefs and other global prefs should only reference
// installed modules or be ''.  This function insures that is the case.
export function updateGlobalModulePrefs() {
  const currmods: string[] = [];
  const modlist = LibSword.getModuleList();
  if (modlist !== C.NOMODULES) {
    modlist.split('<nx>').forEach((mstring: string) => {
      const [module] = mstring.split(';');
      currmods.push(module);
    });
  }
  const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
  const newxulsword = clone(xulsword);
  const mps = ['panels', 'ilModules', 'mtModules'] as const;
  mps.forEach((p) => {
    newxulsword[p] = xulsword[p].map((m) => {
      const n = p === 'panels' ? '' : null;
      return m && !currmods.includes(m) ? n : m;
    });
  });
  newxulsword.tabs.forEach((p, i) => {
    if (p) {
      newxulsword.tabs[i] = p.filter((m) => currmods.includes(m));
    }
  });
  Prefs.setComplexValue('xulsword', newxulsword);
  const popupsel = Prefs.getComplexValue(
    'global.popup.selection'
  ) as GlobalPrefType['global']['popup']['selection'];
  const newpopupsel = clone(popupsel);
  Object.entries(newpopupsel).forEach((entry) => {
    const k = entry[0] as keyof FeatureType;
    const m = entry[1];
    if (!currmods.includes(m)) {
      newpopupsel[k] = '';
    }
  });
  // If no pref has been set for popup.selection[feature] then choose a
  // module from the available modules, if there are any.
  const featureModules = getFeatureModules();
  Object.entries(newpopupsel).forEach((entry) => {
    const k = entry[0] as keyof FeatureType;
    if (!entry[1] && k in featureModules) {
      const ma = (
        Array.isArray(featureModules[k]) ? featureModules[k] : []
      ) as string[];
      const sel =
        C.LocalePreferredFeature[i18next.language === 'en' ? 'en' : 'ru'];
      const preferred = (
        k in sel && Array.isArray(sel[k]) ? sel[k] : []
      ) as string[];
      const selection = preferred.find((m) => m && ma.includes(m)) || ma[0];
      newpopupsel[k] = selection;
    }
  });
  Prefs.setComplexValue('global.popup.selection', newpopupsel);
}

export function resetMain() {
  Subscription.publish('resetMain');
}
