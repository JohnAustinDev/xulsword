import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import i18n from 'i18next';
import fontList from 'font-list';
import C from '../constant.ts';
import VerseKey from '../verseKey.ts';
import RefParser from '../refParser.ts';
import {
  isASCII,
  JSON_parse,
  normalizeFontFamily,
  pad,
  hierarchy,
  getSwordOptions,
  JSON_stringify,
  resolveAudioDataPathURL,
  stringHash,
} from '../common.ts';
import Cache from '../cache.ts';
import Subscription from '../subscription.ts';
import Dirs from './components/dirs.ts';
import DiskCache from './components/diskcache.ts';
import LibSword, { moduleUnsupported } from './components/libsword.ts';
import LocalFile from './components/localFile.ts';
import getFontFamily from './fontfamily.ts';
import { allBkChsInV11n } from './allBkChsInV11n.ts';
import parseSwordConf, {
  fileFullPath,
  serverPublicPath,
} from './parseSwordConf.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  TabType,
  BookType,
  ModTypes,
  V11nType,
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
  GCallType,
} from '../type.ts';
import PrefsElectron from './app/prefs.ts';
import type { RefParserOptionsType } from '../refParser.ts';
import type RenderPromise from '../clients/renderPromise.ts';

// Get all supported books in locale order. NOTE: xulsword ignores individual
// module book order in lieu of locale book order or xulsword default order
// (see C.SupportedBooks). Doing so provides a common order for book lists
// etc., simpler data structures, and a better experience for the user.
export function getBooks(locale?: string): BookType[] {
  const loc: string =
    (C.Locales.find((l) => l[0] === locale) && locale) || i18n.language;
  if (!Cache.has('books', loc)) {
    let books: BookType[] = [];
    let index = 0;
    C.SupportedBookGroups.forEach(
      (bookGroup: (typeof C.SupportedBookGroups)[any]) => {
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
      },
    );
    const stfile = path.join(Dirs.path.xsAsset, 'locales', loc, 'books.json');
    const raw = fs.readFileSync(stfile);
    let data: any;
    if (raw?.length) {
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

    Cache.write(books, 'books', loc);
  }

  return Cache.read('books', loc);
}

export function getBook(locale?: string): Record<string, BookType> {
  const loc: string =
    (C.Locales.find((l) => l[0] === locale) && locale) || i18n.language;
  const book: ReturnType<typeof getBook> = {};
  getBooks(loc).forEach((bk: BookType) => {
    book[bk.code] = bk;
  });
  return book;
}

export function getAllBkChsInV11n(): {
  [key in V11nType]: Array<[OSISBookType, number]>;
} {
  if (!Cache.has('getAllBkChsInV11n')) {
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

    const kjvot = allBkChsInV11n.KJV.slice(0, 39);
    const kjvnt = allBkChsInV11n.KJV.slice(39);
    Object.keys(allBkChsInV11n).forEach((k) => {
      const v11n = k as keyof typeof allBkChsInV11n;
      if (sameAsKJV[v11n].ot) {
        allBkChsInV11n[v11n].splice(0, 0, ...kjvot);
      }
      if (sameAsKJV[v11n].nt) {
        allBkChsInV11n[v11n].push(...kjvnt);
      }
    });
    Cache.write(allBkChsInV11n, 'getAllBkChsInV11n');
  }

  return Cache.read('getAllBkChsInV11n');
}

export function getBkChsInV11n(
  v11n: V11nType,
): Array<[OSISBookType, number]> | null {
  const all = getAllBkChsInV11n();
  if (v11n in all) return all[v11n];
  return null;
}

export function GetBooksInVKModules(): Record<string, OSISBookType[]> {
  const r: Record<string, OSISBookType[]> = {};
  getTabs().forEach((t) => {
    r[t.module] = getBooksInVKModule(t.module);
  });
  return r;
}

export function getBooksInVKModule(module: string): OSISBookType[] {
  if (!Cache.has('booksInModule', module)) {
    const allBkChsInV11n = getAllBkChsInV11n();
    const book = getBook();
    let v11n = LibSword.getModuleInformation(
      module,
      'Versification',
    ) as V11nType;
    if (v11n === C.NOTFOUND) v11n = 'KJV';
    const isVerseKey = /(text|com)/i.test(
      LibSword.getModuleInformation(module, 'ModDrv'),
    );
    const options = getSwordOptions(false, C.BIBLE);
    const osis: string[] = [];
    if (isVerseKey) {
      const v11nbooks = allBkChsInV11n[v11n].map((x: any) => x[0]);
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
        const verse1 = LibSword.getVerseText(
          module,
          `${bk.code} 1:1`,
          false,
          options,
        );
        if (!verse1 || verse1 === fake) {
          // Lopukhin Colossians starts at verse 3, so used verse 3 instead of 2 here:
          const verse2 = LibSword.getVerseText(
            module,
            `${bk.code} 1:3`,
            false,
            options,
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

const ParsedConfigFiles: Record<string, SwordConfType> = {};
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

        const isVerseKey = type === C.BIBLE || type === C.COMMENTARY;

        const confFile = moduleConfFile(module);
        if (!confFile) return;
        ParsedConfigFiles[module] = parseSwordConf(confFile);
        const cipherKey = LibSword.getModuleInformation(module, 'CipherKey');
        if (confFile && cipherKey !== C.NOTFOUND) {
          CipherKeyModules[module] = {
            confPath: confFile.path,
            cipherKey,
            numBooks: cipherKey === '' ? 0 : getBooksInVKModule(module).length,
          };
          if (cipherKey === '') return;
        }

        const tab: TabType = {
          module,
          lang: LibSword.getModuleInformation(module, 'Lang'),
          description: ParsedConfigFiles[module].Description || {
            locale: '',
            en: '',
          },
          audioCodes: ParsedConfigFiles[module].AudioCode || [],
          type,
          xsmType: ParsedConfigFiles[module].xsmType,
          features: ParsedConfigFiles[module].Feature || [],
          v11n: isVerseKey ? LibSword.getVerseSystem(module) : '',
          label,
          labelClass: isASCII(label) ? 'cs-LTR_DEFAULT' : `cs-${module}`,
          tabType,
          isVerseKey,
          direction: /^rt.?l$/i.test(
            LibSword.getModuleInformation(module, 'Direction'),
          )
            ? 'rtl'
            : 'ltr',
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

export function getTab(): Record<string, TabType> {
  if (!Cache.has('tab')) {
    const tab: Record<string, TabType> = {};
    const tabs = getTabs();
    tabs.forEach((t) => {
      tab[t.module] = t;
    });
    Cache.write(tab, 'tab');
  }
  return Cache.read('tab');
}

export function moduleConfFile(module: string): LocalFile | null {
  // Find conf file. First look for typical file name (lowercase of module code),
  // then search contents when necessary.
  let p = LibSword.getModuleInformation(module, 'AbsoluteDataPath').replace(
    /[\\/]/g,
    path.sep,
  );
  if (p.slice(-1) !== path.sep) p += path.sep;
  const modsd = p.replace(/[\\/]modules[\\/].*?$/, `${path.sep}mods.d`);
  let confFile: LocalFile | null = new LocalFile(
    `${modsd + path.sep + module.toLowerCase()}.conf`,
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
    return null;
  }

  return confFile;
}

export function getModuleConfs(): Record<string, SwordConfType> {
  if (!Cache.has('getModuleConfs')) {
    const confs: Record<string, SwordConfType> = {};
    getTabs().forEach((t) => {
      confs[t.module] = ParsedConfigFiles[t.module];
    });
    Cache.write(confs, 'getModuleConfs');
  }
  return Cache.read('getModuleConfs');
}

export function getModuleConf(module: string): SwordConfType | null {
  const moduleConfs = getModuleConfs();
  return module in moduleConfs ? moduleConfs[module] : null;
}

export function getAudioConfs(): Record<string, SwordConfType> {
  if (!Cache.has('getAudioConfs')) {
    const confs: Record<string, SwordConfType> = {};
    const audio = Dirs.xsAudio.clone().append('mods.d');
    audio.directoryEntries.forEach((d) => {
      const f = audio.clone().append(d);
      if (!f.isDirectory() && f.leafName.endsWith('.conf')) {
        const c = parseSwordConf(f);
        confs[c.module] = c;
      }
    });
    Cache.write(confs, 'getAudioConfs');
  }
  return Cache.read('getAudioConfs');
}

export function getAudioConf(module: string): SwordConfType | null {
  const audioConfs = getAudioConfs();
  return module in audioConfs ? audioConfs[module] : null;
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

// LibSword.getMaxChapter returns an unpredictable wrong number if
// vkeytext's book is not part of v11n, but a LibSword call is
// unnecessary with G.BooksInV11n. NOTE: rutil has this same function.
export function getMaxChapter(v11n: V11nType, vkeytext: string) {
  const [book] = vkeytext.split(/[\s.:]/);
  const allBkChsInV11n = getAllBkChsInV11n();
  if (!(v11n in allBkChsInV11n)) return 0;
  const v = allBkChsInV11n[v11n].find((x: any) => x[0] === book);
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
  _renderPromise?: RenderPromise | null, // only used in renderer implementation
): VerseKey {
  const digits = C.Locales.reduce(
    (p, c) => {
      p[c[0]] = getLocaleDigits(c[0]);
      return p;
    },
    {} as Record<string, string[] | null>,
  );
  return new VerseKey(
    new RefParser(digits, getLocalizedBooks(true), options),
    {
      convertLocation: (
        fromv11n: V11nType,
        vkeytext: string,
        tov11n: V11nType,
      ) => {
        return LibSword.convertLocation(fromv11n, vkeytext, tov11n);
      },
      Book: (locale?: string) => {
        return getBook(locale);
      },
      Tab: () => {
        return getTab();
      },
      getBkChsInV11n,
    },
    (str: string | number, locale?: string) => {
      let s = str.toString();
      const digits = getLocaleDigits(locale ?? i18n.language);
      if (digits) {
        for (let i = 0; i <= 9; i += 1) {
          s = s.replaceAll(i.toString(), digits[i]);
        }
      }
      return s;
    },
    versekey,
    v11n,
  );
}

// If a module config fontFamily specifies a URL to a font, rather
// than a fontFamily, then parse the URL. Otherwise return null.
function fontURL(mod: string) {
  const prefs = Cache.has('PrefsElectron')
    ? (Cache.read('PrefsElectron') as typeof PrefsElectron)
    : null;
  if (Build.isWebApp || prefs?.getBoolPref('global.InternetPermission')) {
    const url = LibSword.getModuleInformation(mod, 'Font').match(
      /(\w+:\/\/[^"')]+)\s*$/,
    );
    if (url)
      return { fontFamily: `_${url[1].replace(/[^\w\d]/g, '_')}`, url: url[1] };
  }
  return null;
}

// Link to fonts which are in xulsword's xsFonts directory. Fonts
// listed will appear in font option menus and will be available to
// all modules. Costly font data is cached in a local file.
type FontsType = Record<string, { fontFamily: string; path: string }>;
export function getModuleFonts(): FontFaceType[] {
  if (!Cache.has('ModuleFonts')) {
    // Look for xulsword local fonts, which may be included with some
    // XSM modules.
    const fontDataFilename = 'font-data.json';
    const ret = [] as FontFaceType[];
    let writeFileFonts = true;
    let fileFonts: FontsType | undefined = undefined;
    const dataFile = Dirs.xsResD.append(fontDataFilename);
    if (dataFile.exists()) {
      fileFonts = JSON_parse(dataFile.readFile()) as FontsType;
    }
    const fontfiles = Dirs.xsFonts.directoryEntries;
    if (
      fileFonts &&
      fontfiles.length === Object.keys(fileFonts).length &&
      fontfiles?.every((f) => {
        return fileFonts && Object.keys(fileFonts).includes(f);
      })
    ) {
      writeFileFonts = false;
    }
    let fonts: FontsType = fileFonts ?? {};
    if (writeFileFonts) {
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
      dataFile.writeFile(JSON_stringify(fonts));
    }

    Object.values(fonts).forEach((info) => {
      if (info.fontFamily !== 'unknown' && info.fontFamily !== 'dir') {
        let { path } = info;
        if (Build.isWebApp) path = serverPublicPath(path);
        ret.push({ fontFamily: info.fontFamily, path });
      }
    });

    // Look for module config Font URL. A module's Font entry may be a URL or a
    // fontFamily or font file name. All available font files were added above.
    // But URLs should also be added if any module requests them.
    const tabs = getTabs();
    tabs.forEach((t) => {
      const url = fontURL(t.module);
      if (url) ret.push({ fontFamily: url.fontFamily, url: url.url });
    });
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
        new Set(allfonts.map((f) => normalizeFontFamily(f))),
      );
      if (!Cache.has('fontList')) {
        Cache.write(allfonts, 'fontList');
      }
      return allfonts;
    } catch (err: any) {
      log.error(err);
    }
  }
  return await Promise.resolve(Cache.read('fontList') as string[]);
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
        Object.keys(C.SupportedV11nMaps).includes(Tab[m].v11n),
      );
      xulswordFeatureMods.hebrew = xulswordFeatureMods.hebrew.filter((m) =>
        Object.keys(C.SupportedV11nMaps).includes(Tab[m].v11n),
      );

      // These Strongs feature modules do not have Strongs number keys, and so cannot be used
      const notStrongsKeyed =
        /^(AbbottSmith|InvStrongsRealGreek|InvStrongsRealHebrew)$/i;
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
      'swordFeatureMods',
    );
  }

  return Cache.read('swordFeatureMods');
}

export function resetMain() {
  Subscription.publish.resetMain();
}

export function getModuleConfig(mod: string): ConfigType {
  if (!Cache.has(`moduleConfig${mod}`)) {
    const moduleConfig = {} as ConfigType;

    // All config properties should be present, having a valid value or null.
    // Read values from module's .conf file
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const [prop, keyobj] = entry as [
        keyof typeof C.ConfigTemplate,
        (typeof entry)[1],
      ];
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
        'AbsoluteDataPath',
      ).replaceAll('\\', '/');
      const p2 = `${p}${p.slice(-1) === '/' ? '' : '/'}`;
      let pcx = `${p2}${moduleConfig.PreferredCSSXHTML}`;
      if (Build.isWebApp) pcx = serverPublicPath(pcx);
      moduleConfig.PreferredCSSXHTML = pcx;
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
        (f) => fontFamily && f.path?.split('/').pop()?.includes(fontFamily),
      );
      if (font) ({ fontFamily } = font);
      moduleConfig.fontFamily = fontFamily.replace(/"/g, "'");
      if (!/'.*'/.test(moduleConfig.fontFamily))
        moduleConfig.fontFamily = `'${moduleConfig.fontFamily}'`;
    }
    Cache.write(moduleConfig, `moduleConfig${mod}`);
  }

  return Cache.read(`moduleConfig${mod}`);
}

export function getConfig() {
  const config: Record<string, ConfigType> = {};
  const cacheName = 'getConfig';
  if (!Cache.has(cacheName)) {
    getTabs().forEach((t) => {
      config[t.module] = getModuleConfig(t.module);
    });
    Cache.write(config, cacheName);
  }
  return Cache.read(cacheName) as typeof config;
}

export function getModuleConfigDefault(): ConfigType {
  return getModuleConfig('LTR_DEFAULT');
}

export function localeConfig(locale: string) {
  const lconfig = {} as ConfigType;
  const toptions = { lng: locale, ns: 'config' };
  // All config properties should be present, having a valid value or null.
  // Read any values from locale's config.json file.
  Object.entries(C.ConfigTemplate).forEach((entry) => {
    const [prop, keyobj] = entry as [
      keyof typeof C.ConfigTemplate,
      (typeof entry)[1],
    ];
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
  const ams = AssociatedModules?.split(/\s*,\s*/) || [];
  lconfig.AssociatedModules = null;
  const assocmods = new Set<string>(
    ams.filter((m) => tabs.find((t) => t.module === m)),
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

export function getLocaleConfigs(): Record<string, ConfigType> {
  if (!Cache.has('localeConfigs')) {
    const ret = {} as Record<string, ConfigType>;
    // Default locale config must have all CSS settings in order to
    // override unrelated ancestor config CSS.
    ret.locale = localeConfig(i18n.language);
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const key = entry[0] as keyof ConfigType;
      const [, typeobj] = entry;
      if (typeobj.CSS && !ret.locale[key]) {
        const v = C.LocaleDefaultConfigCSS[key] || 'inherit';
        ret.locale[key] = v;
      }
    });
    C.Locales.forEach((l: (typeof C.Locales)[number]) => {
      const [lang] = l;
      ret[lang] = localeConfig(lang);
    });
    Cache.write(ret, 'localeConfigs');
  }
  return Cache.read('localeConfigs');
}

export function getLocaleDigits(locale?: string): string[] | null {
  const lng = locale || i18n.language;
  let r: string[] | null = null;
  const toptions = { lng, ns: 'numbers' };
  for (let i = 0; i <= 9; i += 1) {
    const key = `n${i}`;
    if (i18n.exists(key, toptions) && !/^\s*$/.test(i18n.t(key, toptions))) {
      if (r === null) {
        r = [];
        for (let x = 0; x <= 9; x += 1) {
          r.push(x.toString());
        }
      }
      r[i] = i18n.t(key, toptions);
    }
  }

  return r;
}

export function getLocalizedBooks(
  getAll = false as boolean | string[],
): Record<string, Record<string, [string[], string[], string[]]>> {
  const ckey = `getLocalizedBooks(${stringHash(getAll)})`;
  if (!Cache.has(ckey)) {
    const locs: string[] = [];
    if (Array.isArray(getAll)) locs.push(...getAll);
    else if (getAll) locs.push(...C.Locales.map((l) => l[0]));
    else locs.push(i18n.language);
    // Currently xulsword locales only include ot and nt books.
    const r: ReturnType<typeof getLocalizedBooks> = {};
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
    Cache.write(r, ckey);
  }

  return Cache.read(ckey);
}

// Return the contents of a file. In Electron mode, filepath is an absolute
// path. In public server mode, it is a server path and must be public or else
// empty string will be returned.
export function inlineFile(
  filepath: string,
  encoding = 'base64' as BufferEncoding,
  noHeader = false,
): string {
  let fpath = filepath;
  if (Build.isWebApp) {
    const spath = fileFullPath(filepath);
    if (!spath) return '';
    fpath = spath;
  }
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

// Return the audio src attribute value for an audio file. The audio argument
// provides the audio module and path that will be used. The module's In Electron mode, filepath is an absolute
// path. In public server mode, it is a server path and must be public or else
// empty string will be returned.
export function inlineAudioFile(
  audio: VerseKeyAudioFile | GenBookAudioFile | null,
): string {
  if (audio) {
    const { path: apath, audioModule } = audio;
    if (audioModule) {
      const file = new LocalFile(Dirs.path.xsAudio);
      const confe = Object.entries(getAudioConfs()).find(
        (e) => e[0] === audioModule,
      );
      if (confe) {
        const [, conf] = confe;
        const { DataPath } = conf;
        if (DataPath.startsWith('http')) {
          return resolveAudioDataPathURL(DataPath, audio);
        } else if (DataPath.startsWith('.')) {
          file.append(DataPath);
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
              const { path } = afile;
              if (path) return inlineFile(path);
            }
          }
        }
      }
    }
  }
  return '';
}

export function getLanguageName(code: string): { en: string; local: string } {
  const result = { en: '', local: '' };
  if (!Cache.has('languageNames')) {
    let languageNames = {} as {
      en: Record<string, string>;
      self: Record<string, string>;
    };
    const path = Dirs.xsAsset.clone();
    path.append('locales');
    path.append('languageNames.json');
    if (path.exists()) {
      const fc = path.readFile();
      if (fc) languageNames = JSON_parse(fc) as typeof languageNames;
    }
    Cache.write(languageNames, 'languageNames');
  }
  const names = Cache.read('languageNames');
  const code2 = code.split('-').shift();
  if (code2 && code2 in names.en) result.en = names.en[code2];
  if (code2 && code2 in names.self) result.local = names.self[code2];

  return result;
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
      let sortREs: Array<[number, number, RegExp]> = [];
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
  expanded?: boolean,
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
        }),
      ),
      module,
    );
  }
  const nodeinfos = DiskCache.read(pkey, module) as TreeNodeInfoPref[];
  nodeinfos.forEach((n) => {
    if (expanded !== undefined && 'hasCaret' in n && n.hasCaret)
      n.isExpanded = !!expanded;
  });
  return nodeinfos;
}

export const CipherKeyModules: Record<
  string,
  {
    confPath: string;
    cipherKey: string;
    numBooks: number | null; // null means unknown
  }
> = {};

// Use in conjunction with callResultDecompress to compress G request results
// for transmission over the Internet.
export function callResultCompress<V extends Record<string, any>>(
  val: V,
  valType: keyof typeof C.CompressibleCalls.common,
): V {
  const common = C.CompressibleCalls.common[valType];
  return Object.entries(val).reduce((p, entry) => {
    const [k, v] = entry;
    if (!(k in common) || stringHash(v) !== stringHash((common as any)[k])) {
      (p as any)[k] = v;
    }
    return p;
  }, {} as V);
}
