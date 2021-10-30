/* eslint-disable import/prefer-default-export */
import C from '../constant';
import G from './gr';

import { findBookNum, getAvailableBooks } from '../common';

export function jsdump(msg: string | Error) {
  // eslint-disable-next-line no-console
  console.log(msg);
}

interface LocObject {
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lastVerse: number | null;
  version: string | null;
}

function dotStringLoc2ObjectLoc(loc: string, version?: string): LocObject {
  const retval = {
    chapter: null,
    book: null,
    verse: null,
    lastVerse: null,
    version: null,
  } as LocObject;
  const dotLocation = loc.split('.');
  const [sn, ch, vs, lv] = dotLocation;
  if (dotLocation[0] !== null) retval.book = sn;
  if (dotLocation[1] !== null) retval.chapter = Number(ch);
  if (dotLocation[2] !== null) retval.verse = Number(vs);
  if (dotLocation[3] !== null) retval.lastVerse = Number(lv);
  if (version !== null && version !== undefined) retval.version = version;

  return retval;
}

/*
// Replaces character with codes <32 with " " (these may occur in text/footnotes at times- code 30 is used for sure)
function replaceASCIIcontrolChars(string: string) {
  for (let i = 0; i < string.length; i += 1) {

    const c = string.charCodeAt(i);
    if (c < 32) string = string.substring(0,i) + ' ' + string.substring(i + 1);

  }

  return string;
}

// Breaks a book name up into "name" and "number". EX: 1st John-->"John","1"
// If the name has no number associated with it, 0 is returned as number.
function getBookNameParts(string: string) {
  let bname = string;
  bname = bname.replace(/^\s+/,"");
  bname = bname.replace(/\s+$/,"");
  bname = replaceASCIIcontrolChars(bname);
  bname += " ";
  const parts = bname.split(' ');
  parts.pop();
  let number = 0;
  let name = '';
  let sp = '';
  for (let p = 0; p < parts.length; p += 1) {
    const fnum = parts[p].match(/(\d+)/);
    if (fnum) {
      number = Number(fnum[1]);
      if (parts.length == 1) {
        name = parts[p].replace(String(number), '');
    }
    else if (parts[p]) {
      name += sp + parts[p];
      sp = " ";
    }
  }
  var retval = {number: number, name: name}
  return retval;
}

function getCurrentLocaleBundle(file: string) {
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {var bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/" + file);}
  catch (er) {bundle = null;}
  return bundle;
}

function getLocaleBundle(locale: string, file: string) {
  let bundle;
  if (!locale || !file) return null;

  var saveLocale = getLocale();
  if (locale == saveLocale) return getCurrentLocaleBundle(file);

  rootprefs.setCharPref(LOCALEPREF, locale);
  var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
  try {bundle = BUNDLESVC.createBundle("chrome://xulsword/locale/" + file);}
  catch (er) {bundle = null;}
  try {bundle.GetStringFromName("dummy");} catch (er) {} //CLUDGE to get bundle initialized before locale changes!
  rootprefs.setCharPref(LOCALEPREF, saveLocale);

  return bundle;
}

const BookNameCache: any = {};
// cycle through each book name (including short, long, + variations) of each locale
function compareAgainstLocales(inbook: string, exact: boolean, bookInfo: any) {
  for (var lc in G.LocaleConfigs) {
    let bundle = null;
    for (let i = 0; i < G.Book.length; i += 1) {
      const key = lc + '-' + G.Book[i].sName;
      if (!BookNameCache[key]) {
        if (!bundle) bundle = getLocaleBundle(lc, "common/books.properties");
        BookNameCache[key] = bundle.GetStringFromName(Book[i].sName);
        try {var add = "," + bundle.GetStringFromName("Long" + Book[i].sName);}
        catch (er) {add = "";}
        BookNameCache[key] += add;
        try {add = "," + bundle.GetStringFromName(Book[i].sName + "Variations");}
        catch (er) {add = "";}
        BookNameCache[key] += add + ",";
      }
      var variation = BookNameCache[key].split(",");
      variation.pop();
      if (compareAgainstList(inbook, variation, exact)) {
        bookInfo.shortName = Book[i].sName;
        bookInfo.version = LocaleConfigs[lc].AssociatedModules.replace(/\s*,.*$/, "");
        bookInfo.locale = lc;
//jsdump("Matched book with exact = " + exact);
        return true;
      }
    }
  }
  return false;
}
*/

// Takes a string and tries to parse out a book name and version
// null is returned if parsing is unsuccessful
function identifyBook(book: string): {
  book: null | string;
  version: null | string;
} | null {

  console.log('NOT YET IMPLEMENTED!!!');
  return null;

  const r = { book: null, version: null };
  // book number is separated from the name to allow for variations in
  // the number's suffix/prefix and placement (ie before or after book name).
  const inbook = getBookNameParts(book);
  // look for exact match over all locales, if not found look for partial match
  if (!compareAgainstLocales(inbook, true, r)) compareAgainstLocales(inbook, false, r);

  return r;
}

// Tries to parse a string to return short book name, chapter, verses, and version.
// If the string fails to parse, null is returned. Information that cannot be
// determined from the parsed string is returned as null. Parsed negative numbers are
// converted to "1"
export function parseLocation(text: string): LocObject | null {
  let loc2parse = text;

  const dot = dotStringLoc2ObjectLoc(loc2parse);
  const bknum = findBookNum(dot.book as string, G);
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
    book: null,
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
      if (book === null || book.book === null) return null;

      location.book = book.book;
      location.version = book.version as string;
      if (
        typeof location.version === 'string' &&
        location.version.indexOf(',') > -1
      ) {
        const vs = location.version.split(',');
        for (let v = 0; v < vs.length; v += 1) {
          vs[v] = vs[v].replace(/\s/g, '');
          location.version = vs[v];
          const bs = getAvailableBooks(vs[v], G);
          for (let b = 0; b < bs.length; b += 1) {
            if (bs[b] === location.book) {
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
