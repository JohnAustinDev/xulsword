/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
/* eslint-disable import/no-mutable-exports */
import path from 'path';
import fs from 'fs';
import i18next from 'i18next';
import { BrowserWindow, Menu } from 'electron';
import C from '../constant';
import { isASCII, JSON_parse } from '../common';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';
import LibSword from './modules/libsword';
import Cache from './modules/cache';
import nsILocalFile from './components/nsILocalFile';
import { jsdump } from './mutil';

import type { TabType, BookType, ModTypes } from '../type';

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

    Cache.write('books', books);
  }

  return Cache.read('books');
}

export function getBook(): { [i: string]: BookType } {
  if (!Cache.has('book')) {
    const book: { [i: string]: BookType } = {};
    getBooks().forEach((bk: BookType) => {
      book[bk.code] = bk;
    });
    Cache.write('book', book);
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
        tabType,
        isVerseKey,
        isRTL: /^rt.?l$/i.test(
          LibSword.getModuleInformation(module, 'Direction')
        ),
        index: i,
        description: LibSword.getModuleInformation(module, 'Description'),
        locName: isASCII(label) ? 'LTR_DEFAULT' : module,
        conf,
        isCommDir,
        audio: {}, // will be filled in later
        audioCode: LibSword.getModuleInformation(module, 'AudioCode'),
        lang: LibSword.getModuleInformation(module, 'Lang'),
      };

      tabs.push(tab);

      i += 1;
    });
    Cache.write('tabs', tabs);
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
    Cache.write('tab', tab);
  }
  return Cache.read('tab');
}

export function getAvailableBooks(): { [i: string]: string[] } {
  if (!Cache.has('availableBooks')) {
    const availableBooks: { [i: string]: string[] } = {
      allBooks: getBooks().map((bk) => bk.code),
    };
    const modlist = LibSword.getModuleList();
    if (modlist === C.NOMODULES) return availableBooks;
    let lastvstext = '';
    modlist.split('<nx>').forEach((m: string) => {
      const [module, type] = m.split(';');
      const books: string[] = [];
      if (type === C.BIBLE || type === C.COMMENTARY) {
        getBooks().forEach((bk: BookType) => {
          const vt = LibSword.getVerseText(module, `${bk.code} 1:1`, false);
          // When books outside the verse system are read, the last verse in the
          // verse system is returned.
          if (vt && vt !== lastvstext) books.push(bk.code);
          lastvstext = vt;
        });
      }
      availableBooks[module] = books;
    });
    Cache.write('availableBooks', availableBooks);
  }

  return Cache.read('availableBooks');
}

export function setMenuFromPrefs(menu: Electron.Menu) {
  if (!menu.items) return;
  menu.items.forEach((i) => {
    if (i.id && i.type === 'checkbox') {
      const [type, pi, mod] = i.id.split('_');
      if (type === 'showtab') {
        const panelIndex = Number(pi);
        const pval = Prefs.getComplexValue('xulsword.tabs');
        if (panelIndex === -1) {
          i.checked = pval.every((p: any) => p?.includes(mod));
        } else {
          i.checked = pval[panelIndex]?.includes(mod);
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

export function setGlobalStateFromPref(
  win: BrowserWindow | null,
  prefs?: string | string[]
) {
  function broadcast() {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!win || w !== win)
        w.webContents.send('update-state-from-pref', prefs);
    });
  }
  const lng = Prefs.getCharPref(C.LOCALEPREF);
  if (lng !== i18next.language) {
    i18next.changeLanguage(lng, (err: any) => {
      if (err) throw Error(err);
      broadcast();
    });
  } else {
    broadcast();
  }
}

export function globalReset() {
  Cache.clear();
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send('perform-resets');
  });
}
