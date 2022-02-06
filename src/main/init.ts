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
import nsILocalFile from './components/nsILocalFile';
import { jsdump } from './mutil';

import type { TabType, BookType, ModTypes } from '../type';

// Exported functions are called by mg.ts using runtime-generated getter functions.

/* eslint-disable prettier/prettier */
const allBooks = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg",
    "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra",
    "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer",
    "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic",
    "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal", "Matt", "Mark", "Luke",
    "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col",
    "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas",
    "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev"];
/* eslint-enable prettier/prettier */

const cache = {
  book: undefined as { [i: string]: BookType } | undefined,
  books: undefined as BookType[] | undefined,
  tab: undefined as { [i: string]: TabType } | undefined,
  tabs: undefined as TabType[] | undefined,
  getAvailableBooks: undefined as { [i: string]: string[] } | undefined,
};

i18next.on('languageChanged', () => {
  Object.keys(cache).forEach((key) => {
    const k = key as keyof typeof cache;
    cache[k] = undefined;
  });
});

export function getBooks(): { sName: string; bName: string; bNameL: string }[] {
  // default book order is KJV
  if (!cache.books) {
    const books = [];
    let i;
    for (i = 0; i < allBooks.length; i += 1) {
      books.push({ sName: '', bName: '', bNameL: '' });
    }
    const stfile = path.join(
      Dirs.path.xsAsset,
      'locales',
      Prefs.getCharPref(C.LOCALEPREF),
      'common',
      'books.json'
    );
    const raw = fs.readFileSync(stfile);
    let data;
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

    let x;
    for (i = 0; i < books.length; i += 1) {
      x = i;

      // implement book order from xulsword locale
      // eslint-disable-next-line @typescript-eslint/no-inferrable-types
      const key: string = `${allBooks[i]}i`;
      if (key in data && Number(data[key])) {
        x = Number(data[key]);
        if (books[x].sName)
          throw Error(
            `ERROR: Two books share the same index (${x}):${books[x].sName}, ${allBooks[i]}`
          );
      }

      books[x].sName = allBooks[i];
    }

    for (i = 0; i < books.length; i += 1) {
      let bName: string = books[i].sName;
      if (bName in data) bName = data[bName];
      books[i].bName = bName;
      books[i].bNameL = bName;

      // eslint-disable-next-line @typescript-eslint/no-inferrable-types
      const key: string = `Long${books[i].sName}`;
      if (key in data) books[i].bNameL = data[key];
    }
    cache.books = books;
  }

  return cache.books;
}

export function getBook() {
  if (!cache.book) {
    const book: any = {};
    const books = getBooks();
    for (let i = 0; i < allBooks.length; i += 1) {
      book[allBooks[i]] = books[i];
    }
    cache.book = book;
  }
  return cache.book;
}

export function getTabs() {
  if (!cache.tabs) {
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
    cache.tabs = tabs;
  }

  return cache.tabs;
}

export function getTab() {
  if (!cache.tab) {
    const tab: { [i: string]: TabType } = {};
    const tabs = getTabs();
    tabs.forEach((t) => {
      tab[t.module] = t;
    });
    cache.tab = tab;
  }
  return cache.tab;
}

export function getAvailableBooks() {
  if (!cache.getAvailableBooks) {
    const availableBooks: any = {
      allBooks,
    };
    const modlist = LibSword.getModuleList();
    if (modlist === C.NOMODULES) return availableBooks;
    modlist.split('<nx>').forEach((m: string) => {
      const [module, type] = m.split(';');
      const books: string[] = [];
      if (type === C.BIBLE || type === C.COMMENTARY) {
        allBooks.forEach((bk) => {
          const vt = LibSword.getVerseText(module, `${bk} 1:1`, false);
          if (vt) books.push(bk);
        });
      }
      availableBooks[module] = books;
    });
    cache.getAvailableBooks = availableBooks;
  }

  return cache.getAvailableBooks;
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
