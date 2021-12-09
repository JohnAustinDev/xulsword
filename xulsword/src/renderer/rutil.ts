/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/prefer-default-export */
import i18next from 'i18next';
import C from '../constant';
import G from './rg';
import {
  dString,
  escapeRE,
  findBookNum,
  guiDirection,
  iString,
} from '../common';

interface LocObject {
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lastverse: number | null;
  version: string | null;
  v11n: string | null;
}

export function jsdump(msg: string | Error) {
  // eslint-disable-next-line no-console
  console.log(msg);
}

export function getModuleLongType(aModule: string): string | undefined {
  const moduleList = G.LibSword.getModuleList();
  if (moduleList === C.NOMODULES) return undefined;
  return moduleList
    .split('<nx>')
    .find((m) => {
      return m.startsWith(`${aModule};`);
    })
    ?.split(';')[1];
}

// Converts a dot book reference into readable text in the locale language.
// Possible inputs: bk.c.v.lv
// Possible outputs:
//    bk
//    nk c
//    bk c:v
//    bk c:v-lv
export function dosString2LocaleString(ref: string, notHTML: boolean): string {
  const guidir = guiDirection(G);

  const entity = guidir === 'rtl' ? '&rlm;' : '&lrm;';
  const char =
    guidir === 'rtl' ? String.fromCharCode(8207) : String.fromCharCode(8206);
  const dc = notHTML ? char : entity;

  let ret = ref;
  let r = ref;
  r = r.replace(/^\s*/, '');
  // eslint-disable-next-line prefer-const
  let [bk, ch, vs, lv] = r.split('.');
  if (vs && lv && vs === lv) lv = '';
  const bki = findBookNum(G, bk);
  if (bki === null) return ret;
  ret = `${dc}${G.Book[bki].bName}`;
  if (ch) {
    ret += `${dc} ${ch}`;
    if (vs) {
      ret += `${dc}:${vs}`;
      if (lv) {
        ret += `${dc}-${lv}`;
      }
    }
  }

  return dString(ret);
}

// Takes dot-string of form bk.ch.vs.lv.v11n and returns it as tov11n verse system.
export function convertDotString(from: string, tov11n: string) {
  let loc = from.split('.');
  if (loc.length !== 5) {
    throw Error(`convertDotString must have form: bk.ch.vs.lv.v11n (${from})`);
  }
  const v11n = loc.pop();
  if (v11n && v11n !== tov11n) {
    let lv = loc.pop();
    let v = loc.pop();
    const cv = G.LibSword.convertLocation(
      v11n,
      `${loc.join('.')}.${v}`,
      tov11n
    ).split('.');
    const clv = G.LibSword.convertLocation(
      v11n,
      `${loc.join('.')}.${lv}`,
      tov11n
    ).split('.');
    lv = clv.pop();
    if (lv === undefined) lv = '1';
    v = cv.pop();
    if (v === undefined) v = '1';
    if (cv.join('.') !== clv.join('.')) {
      lv = v;
    }
    loc = cv.concat([v, lv]);
  }
  loc.push(tov11n);
  return loc.join('.');
}

export function dotStringLoc2ObjectLoc(
  loc: string,
  version?: string
): LocObject {
  const retval = {
    chapter: null,
    book: null,
    verse: null,
    lastverse: null,
    version: null,
    v11n: null,
  } as LocObject;
  const dotLocation = loc.split('.');
  const [sn, ch, vs, lv, v11n] = dotLocation;
  if (dotLocation[0] !== null) retval.book = sn;
  if (dotLocation[1] !== null) retval.chapter = Number(ch);
  if (dotLocation[2] !== null) retval.verse = Number(vs);
  if (dotLocation[3] !== null) retval.lastverse = Number(lv);
  if (dotLocation[4] !== null) retval.v11n = v11n;
  if (version !== null && version !== undefined) retval.version = version;

  return retval;
}

// Replaces character with codes <32 with " " (these may occur in text/footnotes at times- code 30 is used for sure)
function replaceASCIIcontrolChars(s: string) {
  let string = s;
  for (let i = 0; i < string.length; i += 1) {
    const c = string.charCodeAt(i);
    if (c < 32) string = `${string.substring(0, i)} ${string.substring(i + 1)}`;
  }

  return string;
}

// Breaks a book name up into "name" and "number". EX: 1st John-->"John","1"
// If the name has no number associated with it, 0 is returned as number.
function getBookNameParts(string: string, locale: string) {
  let bname = string;
  bname = bname.replace(/^\s+/, '');
  bname = bname.replace(/\s+$/, '');
  bname = replaceASCIIcontrolChars(bname);
  bname = iString(bname, locale);

  const parts = bname.split(' ');

  let number = 0;
  let name = '';
  let sp = '';
  parts.forEach((p) => {
    const fnum = p.match(/(\d+)/);
    if (fnum) {
      number = Number(fnum[1]);
      if (parts.length === 1) {
        name = p.replace(String(number), '');
      }
    } else if (p) {
      name += sp + p;
      sp = ' ';
    }
  });

  return { number, name, locale };
}

// Compares inbook against each item in the list and returns true only if:
//   exact ? one is equal to the other
//  !exact ? one is equal to, or a truncated version of the other.
function compareAgainstList(
  inbook: { number: number; name: string; locale: string },
  list: (string[] | null)[],
  exact: boolean
) {
  let s;
  let l;
  let isMatch = false;
  list.forEach((a) => {
    if (isMatch || a === null) return;
    a.forEach((v) => {
      if (isMatch || !v) return;
      const testbook = getBookNameParts(v, inbook.locale);
      if (inbook.number === testbook.number) {
        if (testbook.name.length < inbook.name.length) {
          s = testbook.name;
          l = inbook.name;
        } else {
          s = inbook.name;
          l = testbook.name;
        }
        const sre = exact
          ? new RegExp(`^${escapeRE(s)}$`, 'i')
          : new RegExp(`^${escapeRE(s)}`, 'i');
        if (l.search(sre) !== -1) isMatch = true;
      }
    });
  });

  return isMatch;
}

// cycle through each book name (including short, long, + variations) of each locale
function compareAgainstLocale(
  inbook: { number: number; name: string; locale: string },
  exact: boolean,
  noVariations: boolean,
  bookInfo: {
    bookCode: string | null;
    modules: string[] | null;
    locale: string;
  }
): number {
  const toptions = { lng: bookInfo.locale, ns: 'common/books' };
  let count = 0;
  for (let i = 0; i < G.Book.length; i += 1) {
    const keys = [G.Book[i].sName, `Long${G.Book[i].sName}`];
    if (!noVariations) keys.push(`${G.Book[i].sName}Variations`);
    const list = keys.map((k) => {
      const r = i18next.t(k, toptions);
      return !r ? null : r.split(/\s*,\s*/);
    });

    if (compareAgainstList(inbook, list, exact)) {
      const am = G.LocaleConfigs[bookInfo.locale].AssociatedModules;

      bookInfo.bookCode = G.Book[i].sName;
      bookInfo.modules = am === C.NOTFOUND ? [] : am.split(/\s*,\s*/);

      count += 1;
    }
  }

  return count;
}

// Takes a string and tries to parse out a book name and version
// null is returned if parsing is unsuccessful
function identifyBook(
  book: string,
  locale: string,
  noVariations: boolean,
  mustBeUnique: boolean
): {
  bookCode: null | string;
  modules: null | string[];
  locale: null | string;
} | null {
  const r = { bookCode: null, modules: null, locale };
  const miss = { bookCode: null, modules: null, locale };

  // book number is separated from the name to allow for variations in
  // the number's suffix/prefix and placement (ie before or after book name).
  const inbook = getBookNameParts(book, locale);

  // look for exact match over all locales, if not found look for partial match
  let count = compareAgainstLocale(inbook, true, noVariations, r);
  if (mustBeUnique && count > 1) return miss;

  if (!count) count = compareAgainstLocale(inbook, false, noVariations, r);
  if (mustBeUnique && count > 1) return miss;

  return r;
}

// Tries to parse a string to return a book code, chapter, verses, and module name.
// If the string fails to parse, null is returned. Information that cannot be
// determined from the parsed string is returned as null. If mustBeUnique is true,
// then a result will only be returned if it is the only possible match.
export function parseLocation(
  text: string,
  noVariations = false,
  mustBeUnique = false
): LocObject | null {
  let loc2parse = text;

  const dot = dotStringLoc2ObjectLoc(loc2parse);
  const bknum = findBookNum(G, dot.book as string);
  if (bknum !== null) {
    // if loc2parse started with a book code assume it's an osisRef
    return dot;
  }

  loc2parse = loc2parse.replace(/[“|”|(|)|[|\]|,]/g, ' ');
  loc2parse = loc2parse.replace(/^\s+/, '');
  loc2parse = loc2parse.replace(/\s+$/, '');

  if (loc2parse === '' || loc2parse === null) {
    return null;
  }

  const location = {
    book: null,
    version: null,
    chapter: null,
    verse: null,
    lastverse: null,
  } as LocObject;

  let has1chap;
  let shft; // book=1, chap=2, verse=3, lastVerse=4
  // eslint-disable-next-line prettier/prettier
  let parsed = loc2parse.match(/([^:-]+)\s+(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/);           shft=0; has1chap=false;  // book 1:2-3
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+(\d+)\s*:\s*(\d+)/);        shft=0; has1chap=false;} // book 4:5
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+(\d+)/);                    shft=0; has1chap=false;} // book 6
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+[v|V].*(\d+)/);             shft=0; has1chap=true;}  // book v6 THIS VARIES WITH LOCALE!!!
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/^(\d+)$/);                             shft=2; has1chap=false;} // 6
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/);       shft=1; has1chap=false;} // 1:2-3
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*:\s*(\d+)/);                   shft=1; has1chap=false;} // 4:5
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*-\s*(\d+)/);                   shft=2; has1chap=false;} // 4-5
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/^(.*?)$/);                             shft=0; has1chap=false;} // book
  // jsdump("parsed:" + parsed + " match type:" + m + "\n");

  if (parsed) {
    while (shft) {
      parsed.splice(1, 0);
      shft -= 1;
    }
    if (has1chap) parsed.splice(2, 0, '1'); // insert chapter=1 if book has only one chapter
    if (parsed[1]) {
      const book = identifyBook(
        parsed[1].replace(/["'«»“”.?]/g, ''),
        G.Prefs.getCharPref(C.LOCALEPREF),
        noVariations,
        mustBeUnique
      );
      if (book && book.bookCode) {
        const code = book.bookCode;
        location.book = code;
        if (book.modules) {
          let stop = false;
          book.modules.forEach((mod) => {
            if (stop) return;
            location.version = mod;
            if (mod in G.AvailableBooks && G.AvailableBooks[mod].includes(code))
              stop = true;
          });
        }
      } else {
        return null;
      }
    }
    if (parsed[2]) {
      location.chapter = Number(parsed[2]) > 0 ? Number(parsed[2]) : 1;
    }
    if (parsed[3]) {
      location.verse = Number(parsed[3]) > 0 ? Number(parsed[3]) : 1;
    }
    if (parsed[4]) {
      location.lastverse = Number(parsed[4]) > 0 ? Number(parsed[4]) : 1;
    }
  } else {
    return null;
  }

  // jsdump(uneval(location));
  return location;
}
