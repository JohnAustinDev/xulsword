/* eslint-disable import/prefer-default-export */
import C from '../constant';
import G from './rglobal';

import { findBookNum, getAvailableBooks } from '../common';

const R = window.ipc.renderer;

export function jsdump(msg: string | Error) {
  // eslint-disable-next-line no-console
  console.log(msg);
}

interface LocObject {
  shortName: string | null;
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lastVerse: number | null;
  version: string | null;
}

function dotStringLoc2ObjectLoc(loc: string, version?: string): LocObject {
  const retval = {
    chapter: null,
    shortName: null,
    book: null,
    verse: null,
    lastVerse: null,
    version: null,
  } as LocObject;
  const dotLocation = loc.split('.');
  const [sn, ch, vs, lv] = dotLocation;
  if (dotLocation[0] !== null) retval.shortName = sn;
  if (dotLocation[1] !== null) retval.chapter = Number(ch);
  if (dotLocation[2] !== null) retval.verse = Number(vs);
  if (dotLocation[3] !== null) retval.lastVerse = Number(lv);
  if (version !== null && version !== undefined) retval.version = version;

  return retval;
}

// Takes a string and tries to parse out a book name and version
// null is returned if parsing is unsuccessfull
function identifyBook(book: string): {
  shortName: null | string;
  version: null | string;
} | null {
  return null;

  // //jsdump(">" + book + "<");
  //   var bookInfo = {shortName: null, version: null}
  //   // book number is separated from the name to allow for variations in
  //   // the number's suffix/prefix and placement (ie before or after book name).
  //   var inbook = getBookNameParts(book);
  // //jsdump(inbook.number + " >" + inbook.name + "<");
  //   // look for exact match over all locales, if not found look for partial match
  //   if (!compareAgainstLocales(inbook, true, bookInfo)) compareAgainstLocales(inbook, false, bookInfo);
  // //jsdump("bookInfo.shortName:" + bookInfo.shortName + " bookInfo.version:" + bookInfo.version + "\n");
  //   return bookInfo;
}

// Tries to parse a string to return short book name, chapter, verses, and version.
// If the string fails to parse, null is returned. Information that cannot be
// determined from the parsed string is returned as null. Parsed negative numbers are
// converted to "1"
export function parseLocation(text: string): LocObject | null {
  let loc2parse = text;

  const dot = dotStringLoc2ObjectLoc(loc2parse);
  const bknum = findBookNum(G, dot.shortName as string);
  if (bknum !== null) {
    // loc2parse started with something like Gen. so we assume it's a valid osisRef
    return dot;
  }

  loc2parse = loc2parse.replace(/[“|”|(|)|[|\]|,]/g, ' ');
  loc2parse = loc2parse.replace(/^\s+/, '');
  loc2parse = loc2parse.replace(/\s+$/, '');
  // loc2parse = iString(loc2parse);
  // jsdump("reference:\"" + loc2parse + "\"\n");
  if (loc2parse === '' || loc2parse == null) {
    return null;
  }
  const location = {
    shortName: null,
    version: null,
    chapter: null,
    verse: null,
    lastVerse: null,
  } as LocObject;
  let m; // used for debugging only
  let has1chap;
  let shft; // book=1, chap=2, verse=3, lastVerse=4
  // eslint-disable-next-line prettier/prettier
  let parsed = loc2parse.match(/([^:-]+)\s+(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/);           shft=0; m=0; has1chap=false;  // book 1:2-3
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+(\d+)\s*:\s*(\d+)/);        shft=0; m=1; has1chap=false;} // book 4:5
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+(\d+)/);                    shft=0; m=2; has1chap=false;} // book 6
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/([^:-]+)\s+[v|V].*(\d+)/);             shft=0; m=3; has1chap=true;}  // book v6 THIS VARIES WITH LOCALE!!!
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/^(\d+)$/);                             shft=2; m=4; has1chap=false;} // 6
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*:\s*(\d+)\s*-\s*(\d+)/);       shft=1; m=5; has1chap=false;} // 1:2-3
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*:\s*(\d+)/);                   shft=1; m=6; has1chap=false;} // 4:5
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/(\d+)\s*-\s*(\d+)/);                   shft=2; m=7; has1chap=false;} // 4-5
  // eslint-disable-next-line prettier/prettier
  if (parsed==null) {parsed = loc2parse.match(/^(.*?)$/);                             shft=0; m=8; has1chap=false;} // book
  // jsdump("parsed:" + parsed + " match type:" + m + "\n");

  if (parsed) {
    while (shft) {
      parsed.splice(1, 0);
      shft -= 1;
    }
    if (has1chap) parsed.splice(2, 0, '1'); // insert chapter=1 if book has only one chapter
    if (parsed[1]) {
      const book = identifyBook(parsed[1].replace(/["'«»“”.?]/g, ''));
      if (book === null) return null;
      if (book.shortName == null) return null;

      location.shortName = book.shortName;
      location.version = book.version as string;
      if (
        typeof location.version === 'string' &&
        location.version.indexOf(',') > -1
      ) {
        const vs = location.version.split(',');
        for (let v = 0; v < vs.length; v += 1) {
          vs[v] = vs[v].replace(/\s/g, '');
          location.version = vs[v];
          const bs = getAvailableBooks(G, vs[v]);
          for (let b = 0; b < bs.length; b += 1) {
            if (bs[b] === location.shortName) {
              b = bs.length;
              v = vs.length;
            }
          }
        }
      }
    }
    if (parsed[2]) {
      location.chapter = Number(parsed[2]) > 0 ? Number(parsed[2]) : 1;
    }
    if (parsed[3]) {
      location.verse = Number(parsed[3]) > 0 ? Number(parsed[3]) : 1;
    }
    if (parsed[4]) {
      location.lastVerse = Number(parsed[4]) > 0 ? Number(parsed[4]) : 1;
    }
  } else {
    return null;
  }

  // jsdump(uneval(location));
  return location;
}
