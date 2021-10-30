/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
import path from 'path';
import fs from 'fs';
import LibSwordx from './modules/libsword';
import Dirsx from './modules/dirs';
import Prefsx from './modules/prefs';
import { GType, GPublic, LibSwordType, DirsType, PrefsType } from '../type';
import C from '../constant';

// This G object is for use in the main process, and it shares the same
// interface as the renderer's G object. Properties of this object
// directly access data and main process modules. The output of
// get<function>s are cached until G.reset().

const G: Pick<GType, 'reset' | 'cache'> & GPrivateMain = {
  cache: {},

  // Permanently store references for use by getters
  refs: {
    LibSword: LibSwordx as LibSwordType,
    Prefs: Prefsx as PrefsType,
    Dirs: Dirsx as DirsType,
    Book: () => getBook(),
    Tabs: () => getTabs(),
    Tab: () => getTab(),
    ProgramConfig: () => getProgramConfig(),
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

function getTabs() {
  throw Error(`getTabs not yet implemented`);
  return null;
}

function getTab() {
  throw Error(`getTab not yet implemented`);
  return null;
}

function getProgramConfig() {
  throw Error(`getProgramConfig not yet implemented`);
  return null;
}
