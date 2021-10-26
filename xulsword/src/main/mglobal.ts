import path from 'path';
import fs from 'fs';
import { GClass, GPublic } from '../type';
import LibSwordx from './modules/libsword';
import Dirsx from './modules/dirs';
import Prefsx from './modules/prefs';
import C from '../constant';

// Permanently store these references in main for return by getters
const main: { [i: string]: any } = {
  LibSword: LibSwordx,
  Prefs: Prefsx,
  Dirs: Dirsx,
};

const G: { [i: string]: any } = {
  cache: {} as { [i: string]: any },

  reset() {
    G.cache = {};
  },

  // Functions that are called by runtime-generated getter functions:
  getBook(): { sName: string; bName: string; bNameL: string }[] {
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
  },
};

// Add all methods to G object
const entries = Object.entries(GPublic);
entries.forEach((entry) => {
  const [name, v] = entry;
  if (v === 'readonly') {
    Object.defineProperty(G, name, {
      get() {
        if (!(name in G.cache)) {
          const fname = `get${name}`;
          const t = this as { [i: string]: any };
          const fn = t[fname];
          if (typeof fn === 'function') {
            G.cache[name] = fn();
          } else {
            throw Error(`function ${fname} has not been defined`);
          }
        }
        return G.cache[name];
      },
    });
  } else if (typeof v === 'object') {
    Object.defineProperty(G, name, {
      get() {
        const obj = main[name];
        if (obj === null) throw Error(`object ${name} has not been defined`);
        return obj;
      },
    });
  } else {
    throw Error(`unhandled GPublic entry value ${v}`);
  }
});

export default G;
