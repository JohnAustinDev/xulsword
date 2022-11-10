/* eslint-disable @typescript-eslint/no-use-before-define */
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
import { moduleUnsupported, CipherKeyModules } from './components/module';
import getFontFamily from './fontfamily';

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
  ConfigType,
  FontFaceType,
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
    Object.keys(CipherKeyModules).forEach((k) => delete CipherKeyModules[k]);
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
        const cipherKey = LibSword.getModuleInformation(module, 'CipherKey');
        if (cipherKey !== C.NOTFOUND) {
          CipherKeyModules[module] = {
            confPath,
            cipherKey,
            numBooks: cipherKey === '' ? 0 : getBooksInModule(module).length,
          };
          if (cipherKey === '') return;
        }
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

export function getCipherFailConfs() {
  getTabs(); // to insure CipherKeyModules is set
  return Object.values(CipherKeyModules)
    .filter((v) => v.numBooks === 0 || v.cipherKey === '')
    .map((v) => {
      const f = new LocalFile(v.confPath);
      return (
        (f.exists() && !f.isDirectory() && parseSwordConf(f, f.leafName)) ||
        null
      );
    })
    .filter(Boolean) as SwordConfType[];
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

export function getBooksInModule(module: string): string[] {
  if (!Cache.has('booksInModule', module)) {
    const bkChsInV11n = getBkChsInV11n();
    const book = getBook();
    let v11n = LibSword.getModuleInformation(
      module,
      'Versification'
    ) as V11nType;
    if (v11n === C.NOTFOUND) v11n = 'KJV';
    const isVerseKey = /(text|comm)/i.test(
      LibSword.getModuleInformation(module, 'ModDrv')
    );
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
      const fake = LibSword.getVerseText(module, 'FAKE 1:1', false);
      v11nbooks.forEach((code: string) => {
        const bk = book[code];
        const verse1 = LibSword.getVerseText(module, `${bk.code} 1:1`, false);
        if (!verse1 || verse1 === fake) {
          const verse2 = LibSword.getVerseText(module, `${bk.code} 1:2`, false);
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
  const tabs = getTabs();
  const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
  const newxulsword = clone(xulsword);
  const mps = ['panels', 'ilModules', 'mtModules'] as const;
  mps.forEach((p) => {
    newxulsword[p] = xulsword[p].map((m) => {
      const n = p === 'panels' ? '' : null;
      return m && !tabs.find((t) => t.module === m) ? n : m;
    });
  });
  newxulsword.tabs.forEach((p, i) => {
    if (p) {
      newxulsword.tabs[i] = p.filter((m) => tabs.find((t) => t.module === m));
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
    if (!tabs.find((t) => t.module === m)) {
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
  Subscription.publish.resetMain();
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
    let fonts = Prefs.getPrefOrCreate('fonts', 'complex', {}, 'fonts') as {
      [i: string]: { fontFamily: string; path: string };
    };
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

// Return a locale (if any) to associate with a module:
//    Return a Locale with exact same language code as module
//    Return a Locale having same base language code as module, prefering current Locale over any others
//    Return a Locale which lists the module as an associated module
//    Return null if no match
function getLocaleOfModule(module: string) {
  let myLocale: string | null = null;

  const progLocale = i18next.language;
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

  if (myLocale) return myLocale;

  const regex = new RegExp(`(^|s|,)+${module}(,|s|$)+`);
  C.Locales.forEach((l: any) => {
    const [locale] = l;
    const toptions = {
      lng: locale,
      ns: 'common/config',
    };
    if (i18next.t('DefaultModule', toptions).match(regex)) myLocale = locale;
  });

  return myLocale;
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
      const lom = getLocaleOfModule(mod);
      moduleConfig.AssociatedLocale = lom || null;
    } else {
      moduleConfig.AssociatedLocale = i18next.language;
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

export function getModuleConfigDefault() {
  return getModuleConfig('LTR_DEFAULT');
}

export function localeConfig(locale: string) {
  const lconfig = {} as ConfigType;
  const toptions = { lng: locale, ns: 'common/config' };
  // All config properties should be present, having a valid value or null.
  // Read any values from locale's config.json file.
  Object.entries(C.ConfigTemplate).forEach((entry) => {
    const prop = entry[0] as keyof typeof C.ConfigTemplate;
    const keyobj = entry[1];
    let r = null;
    if (keyobj.localeConf !== null) {
      r = i18next.exists(keyobj.localeConf, toptions)
        ? i18next.t(keyobj.localeConf, toptions)
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
    ret.locale = localeConfig(i18next.language);
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

export function getFeatureModules(): FeatureType {
  if (!Cache.has('featureModules')) {
    // These are CrossWire SWORD standard module features
    const sword = {
      strongsNumbers: [] as string[],
      greekDef: [] as string[],
      hebrewDef: [] as string[],
      greekParse: [] as string[],
      hebrewParse: [] as string[],
      dailyDevotion: {} as { [i: string]: string },
      glossary: [] as string[],
      images: [] as string[],
      noParagraphs: [] as string[],
    };
    // These are xulsword features that use certain modules
    const xulsword = {
      greek: [] as string[],
      hebrew: [] as string[],
    };

    getTabs().forEach((tab) => {
      const { module, type } = tab;
      let mlang = LibSword.getModuleInformation(module, 'Lang');
      const dash = mlang.indexOf('-');
      mlang = mlang.substring(0, dash === -1 ? mlang.length : dash);
      if (module !== 'LXX' && type === C.BIBLE && /^grc$/i.test(mlang))
        xulsword.greek.push(module);
      else if (
        type === C.BIBLE &&
        /^heb?$/i.test(mlang) &&
        !/HebModern/i.test(module)
      )
        xulsword.hebrew.push(module);

      // These Strongs feature modules do not have Strongs number keys, and so cannot be used
      const notStrongsKeyed = new RegExp(
        '^(AbbottSmith|InvStrongsRealGreek|InvStrongsRealHebrew)$',
        'i'
      );
      if (!notStrongsKeyed.test(module)) {
        const feature = LibSword.getModuleInformation(module, 'Feature');
        const features = feature.split(C.CONFSEP);
        Object.keys(sword).forEach((k) => {
          const swordk = k as keyof typeof sword;
          const swordf =
            swordk.substring(0, 1).toUpperCase() + swordk.substring(1);
          if (features.includes(swordf)) {
            if (swordk === 'dailyDevotion') {
              sword[swordk][module] = 'DailyDevotionToday';
            } else {
              sword[swordk].push(module);
            }
          }
        });
      }
    });
    Cache.write({ ...sword, ...xulsword }, 'featureModules');
  }

  return Cache.read('featureModules');
}
