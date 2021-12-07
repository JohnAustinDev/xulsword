/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import path from 'path';
import fs from 'fs';
import { Menu } from 'electron';
import LibSwordx from './modules/libsword';
import Dirsx from './modules/dirs';
import Prefsx from './modules/prefs';
import Commandsx from './commands';
import {
  getProgramConfig,
  getLocaleConfigs,
  getModuleConfigs,
  getModuleConfigDefault,
  getFontFaceConfigs,
  getModuleFeature,
} from './config';
import { resolveHtmlPath } from './mutil';
import { GType, GPublic, TabType } from '../type';
import C from '../constant';

// This G object is for use in the main process, and it shares the same
// interface as the renderer's G object. Properties of this object
// directly access data and main process modules. The output of
// get<function>s are cached until G.reset().

const G: Pick<GType, 'reset' | 'cache'> & GPrivateMain = {
  cache: {},

  // Permanently store references for use by getters
  refs: {
    Book: () => getBook(),
    Tabs: () => getTabs(),
    Tab: () => getTab(),
    LocaleConfigs: () => getLocaleConfigs(),
    ModuleConfigs: () => getModuleConfigs(),
    ModuleConfigDefault: () => getModuleConfigDefault(),
    ProgramConfig: () => getProgramConfig(),
    FontFaceConfigs: () => getFontFaceConfigs(),
    ModuleFeature: () => getModuleFeature(),

    OPSYS: () => process.platform,

    setGlobalMenuFromPrefs: (menu?: Electron.Menu) => {
      const m = menu || Menu.getApplicationMenu();
      if (m !== null) setMenuFromPrefs(m);
    },
    resolveHtmlPath: (s: string) => {
      return resolveHtmlPath(s);
    },

    LibSword: LibSwordx as typeof LibSwordx,
    Prefs: Prefsx as typeof Prefsx,
    Dirs: Dirsx as typeof Dirsx,
    Commands: Commandsx as typeof Commandsx,
  },

  reset() {
    this.cache = {};
  },
};

// Add methods to the G object
const entries = Object.entries(GPublic);
entries.forEach((entry) => {
  const [name, val] = entry;
  if (val === 'readonly') {
    Object.defineProperty(G, name, {
      get() {
        if (!(name in G.cache)) {
          // Each readonly property getter calls a local get<property>
          // function and stores the result in the cache.
          const fn = this.refs[name];
          if (typeof fn === 'function') {
            G.cache[name] = fn();
          } else {
            throw Error(`function ${name} has not been defined`);
          }
        }
        return G.cache[name];
      },
    });
  } else if (typeof val === 'function') {
    const g = G as any;
    g[name] = g.refs[name];
  } else if (typeof val === 'object') {
    Object.defineProperty(G, name, {
      get() {
        const obj = this.refs[name];
        if (obj === null) throw Error(`object ${name} is not available`);
        return obj;
      },
    });
  } else {
    throw Error(`unhandled GPublic entry value ${val}`);
  }
});

type GPrivateMain = {
  refs: { [key in keyof typeof GPublic]: any };
};

export default G as unknown as GType;

// These functions are called by runtime-generated getter functions, and
// their output is cached by G until G.reset().

function getBook(): { sName: string; bName: string; bNameL: string }[] {
  // default book order is KJV
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

  const book = [];
  let i;
  for (i = 0; i < allBooks.length; i += 1) {
    book.push({ sName: '', bName: '', bNameL: '' });
  }

  const stfile = path.join(
    Dirsx.path.xsAsset,
    'locales',
    Prefsx.getCharPref(C.LOCALEPREF),
    'common',
    'books.json'
  );
  const raw = fs.readFileSync(stfile);
  let data;
  if (raw && raw.length) {
    const json = JSON.parse(raw.toString());
    if (json && typeof json === 'object') {
      data = json;
    } else {
      throw Error(`failed to parse books.json at ${stfile}`);
    }
  } else {
    throw Error(`failed to read books.json at ${stfile}`);
  }

  let x;
  for (i = 0; i < book.length; i += 1) {
    x = i;

    // implement book order from xulsword locale
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    const key: string = `${allBooks[i]}i`;
    if (key in data && Number(data[key])) {
      x = Number(data[key]);
      if (book[x].sName)
        throw Error(
          `ERROR: Two books share the same index (${x}):${book[x].sName}, ${allBooks[i]}`
        );
    }

    book[x].sName = allBooks[i];
  }

  for (i = 0; i < book.length; i += 1) {
    let bName: string = book[i].sName;
    if (bName in data) bName = data[bName];
    book[i].bName = bName;
    book[i].bNameL = bName;

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    const key: string = `Long${book[i].sName}`;
    if (key in data) book[i].bNameL = data[key];
  }

  return book;
}

const Tab: { [i: string]: TabType } = {
  KJV: {
    modName: 'KJV',
    modType: C.BIBLE,
    tabType: 'Texts',
    label: 'KJV',
    index: 0,
    description: 'The King James translation of the Bible',
  },
  RSP: {
    modName: 'RSP',
    modType: C.BIBLE,
    tabType: 'Texts',
    label: 'Russian Synodal',
    index: 1,
    description: 'The Russian Synodal translation of the Bible',
  },
  MYCOMM: {
    modName: 'MYCOMM',
    modType: C.COMMENTARY,
    tabType: 'Comms',
    label: 'My Comm',
    index: 2,
    description: 'A commentary of the Bible',
  },
  MYDICT: {
    modName: 'MYDICT',
    modType: C.DICTIONARY,
    tabType: 'Dicts',
    label: 'My Dict',
    index: 3,
    description: 'A glossary/dictionary of the Bible',
  },
  MYBOOK: {
    modName: 'MYBOOK',
    modType: C.GENBOOK,
    tabType: 'Genbks',
    label: 'My GenBook',
    index: 4,
    description: 'Some book related to the Bible',
  },
};
const Tabs: TabType[] = [Tab.RSP, Tab.KJV, Tab.MYCOMM, Tab.MYBOOK, Tab.MYDICT];
function getTabs() {
  console.log(`getTabs not yet implemented`);
  return Tabs;
}

function getTab() {
  console.log(`getTab not yet implemented`);
  return Tab;
}

function setMenuFromPrefs(menu: Electron.Menu) {
  if (!menu.items) return;
  menu.items.forEach((i) => {
    if (i.id && i.type === 'checkbox') {
      const [type, win, mod] = i.id.split('_');
      if (type === 'showtab') {
        const w = Number(win);
        const pval = Prefsx.getComplexValue('xulsword.tabs');
        if (Number.isNaN(w)) {
          i.checked = pval.every((wn: any) => wn?.includes(mod));
        } else {
          i.checked = pval[w - 1]?.includes(mod);
        }
      } else {
        i.checked = Prefsx.getBoolPref(i.id);
      }
    } else if (i.id && i.type === 'radio') {
      const [pref, str] = i.id.split('_val_');
      if (str !== '') {
        let val: string | number = str;
        if (Number(str).toString() === str) val = Number(str);
        const pval =
          typeof val === 'number'
            ? Prefsx.getIntPref(pref)
            : Prefsx.getCharPref(pref);
        if (pval === val) i.checked = true;
      }
    }
    if (i.submenu) setMenuFromPrefs(i.submenu);
  });
}
