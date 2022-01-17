/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/prefer-default-export */
import React from 'react';
import i18next from 'i18next';
import C from '../constant';
import { getElementInfo } from '../libswordElemInfo';
import {
  compareObjects,
  deepClone,
  dString,
  escapeRE,
  findBookNum,
  guiDirection,
  iString,
  ofClass,
} from '../common';
import G from './rg';

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
export function dotString2LocaleString(ref: string, notHTML: boolean): string {
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
  ret = `${dc}${G.Books[bki].bName}`;
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
  for (let i = 0; i < G.Books.length; i += 1) {
    const keys = [G.Books[i].sName, `Long${G.Books[i].sName}`];
    if (!noVariations) keys.push(`${G.Books[i].sName}Variations`);
    const list = keys.map((k) => {
      const r = i18next.t(k, toptions);
      return !r ? null : r.split(/\s*,\s*/);
    });

    if (compareAgainstList(inbook, list, exact)) {
      const am = G.LocaleConfigs[bookInfo.locale].AssociatedModules;

      bookInfo.bookCode = G.Books[i].sName;
      bookInfo.modules = am === C.NOTFOUND ? [] : am.split(/\s*,\s*/);

      count += 1;
    }
  }

  return count;
}

// Return the module context in which the element resides, NOT the
// module associated with the data of the element itself.
export function getContextModule(elem: HTMLElement) {
  let p;

  // first let's see if we're in a verse
  let telem = elem as HTMLElement | null;
  while (telem?.classList && !telem.classList.contains('vs')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  if (telem) {
    p = getElementInfo(telem);
    if (p) return p.mod;
  }

  // then see if we're in a viewport window, and use its module
  const atext = ofClass(['atext'], elem);
  if (atext) return atext.element.dataset.module;

  // are we in cross reference text?
  telem = elem as HTMLElement | null;
  while (telem?.classList && !telem.classList.contains('crtext')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  const match = telem?.className.match(/\bcs-(\S+)\b/);
  if (match) return match[1];

  // in a search lexicon list?
  telem = elem as HTMLElement | null;
  while (telem?.classList && !telem.classList.contains('snlist')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  if (telem) return telem.getAttribute('contextModule');

  // otherwise see if we're in a search results list
  telem = elem as HTMLElement | null;
  while (telem?.classList && !telem.classList.contains('slist')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  if (telem) {
    p = getElementInfo(telem);
    if (p) return p.mod;
  }

  return null;
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
// determined from the parsed string is returned as null. If noVariations is true
// then book locale name varitaions will not be considered. If mustBeUnique is true,
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
  let shft; // book=1, chap=2, verse=3, lastverse=4
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

export function getCompanionModules(mod: string) {
  const cms = G.LibSword.getModuleInformation(mod, 'Companion');
  if (cms !== C.NOTFOUND) return cms.split(/\s*,\s*/);
  return [];
}

// Converts a short book reference into readable text in the locale language, and can handle from-to cases
// Possible inputs: bk.c.v[.lv][-bk.c.v[.lv]]
// Possible outputs:
//    bk c:v
//    bk c:v-lv
//    bk c:v-lv, bk c:v-lv
export function ref2ProgramLocaleText(reference: string, notHTML?: boolean) {
  let separator = '';

  const localeRTL = G.LocaleConfigs[i18next.language].direction === 'rtl';
  const entity = localeRTL ? '&rlm;' : '&lrm;';
  const char = localeRTL
    ? String.fromCharCode(8207)
    : String.fromCharCode(8206);

  const dc = notHTML ? char : entity;

  let retv = dc;
  reference.split('-').forEach((refx) => {
    // Some ref names returned by xulsword have a leading space!! Remove it first...
    const ref = refx.replace(/^\s*/, '');
    const rp = ref.split('.');
    const [bk, ch, vs, lv] = rp;
    const bName = G.Book[bk]?.bName;
    if (vs && lv && vs === lv) {
      rp.pop();
    }
    if (rp.length === 4) {
      if (!bName) {
        jsdump(`WARNING: Didn't find ref >${ref}< in ref2ProgramLocaleText\n`);
      } else if (separator) {
        retv += `${dc}-${lv}`;
      } else {
        retv += `${separator}${bName}${dc} ${ch}:${dc}${vs}${dc}-${lv}`;
      }
      separator = ', ';
    } else if (rp.length === 3) {
      if (!bName) {
        jsdump(`WARNING: Didn't find ref >${ref}< in ref2ProgramLocaleText\n`);
      } else if (separator) {
        retv += `${dc}-${vs}`;
      } else {
        retv += `${separator}${bName}${dc} ${ch}:${dc}${vs}`;
      }
      separator = `${dc} ${dc}-${dc} `;
    }
  });

  return dString(retv);
}

// "location" may have the forms:
// "Matt 3:5", "John 3:16-John 3:21", "John.3", "John.3.5", "John.3.16-John.3.16.21", or "John.3.7.10".
// If "version" is not a Bible, or does not have the book where "location" is, then an alternate
// Bible version is used and the location is converted to the new verse system. NOTE! returned
// location is "." delimited type! Returns "" if verse text cannot be found in any Bible module.
//
// Is module a Bible, or does module specify another reference Bible in its config file? Then use that.
// If version does not yield verse text, then look at visible tabs in their order.
// If visible tabs do not yield verse text, then look at hidden tabs in their order.
export function findAVerseText(
  version: string,
  location: string,
  tabs: string[],
  keepTextNotes: boolean
): { tabindex: number; location: string; text: string } | null {
  if (!(version in G.Tab)) return null;
  const ret = { tabindex: G.Tab[version].index, location, text: '' };

  // Is version a Bible, or does version specify a Bible?
  let bibleVersion = null;
  let bibleLocation = location;
  if (getModuleLongType(version) === C.BIBLE) bibleVersion = version;
  else if (
    !G.Prefs.getPrefOrCreate('DontReadReferenceBible', 'boolean', false)
  ) {
    bibleVersion = getCompanionModules(version);
    bibleVersion =
      !bibleVersion.length || !(bibleVersion[0] in G.Tab)
        ? null
        : bibleVersion[0];
    if (bibleVersion)
      bibleLocation = G.LibSword.convertLocation(
        G.Tab[version].v11n,
        location,
        G.Tab[bibleVersion].v11n
      );
  }
  // If we have a Bible, try it first.
  if (bibleVersion && bibleVersion in G.Tab) {
    let text;
    try {
      text = G.LibSword.getVerseText(
        bibleVersion,
        bibleLocation,
        keepTextNotes
      ).replace(/\n/g, ' ');
    } catch (er) {
      text = '';
    }
    if (text && text.length > 7) {
      const vsys = G.Tab[bibleVersion].v11n;
      ret.tabindex = G.Tab[bibleVersion].index;
      ret.location = G.LibSword.convertLocation(vsys, location, vsys);
      ret.text = text;
      return ret;
    }
  }

  // Passed version does not yield verse text. So now look at tabs...
  const m = location.match(/^\W*(\w+)/);
  if (!m) return null;
  const [, book] = m;
  for (let v = 0; v < G.Tabs.length; v += 1) {
    if (G.Tabs[v].module !== C.BIBLE) continue;
    const abooks = G.AvailableBooks[G.Tabs[v].module];
    let ab;
    for (ab = 0; ab < abooks.length; ab += 1) {
      if (abooks[ab] === book) break;
    }
    if (ab === abooks.length) continue;
    const tlocation = G.LibSword.convertLocation(
      G.Tab[version].v11n,
      location,
      G.Tabs[v].v11n
    );
    const text = G.LibSword.getVerseText(
      G.Tabs[v].module,
      tlocation,
      keepTextNotes
    ).replace(/\n/g, ' ');
    if (text && text.length > 7) {
      // We have a valid result. If this version's tab is showing, then return it
      // otherwise save this result (unless a valid result was already saved). If
      // no visible tab match is found, this saved result will be returned
      const vsys = G.Tabs[v].v11n;
      if (tabs.includes(G.Tabs[v].module)) {
        ret.tabindex = v;
        ret.location = G.LibSword.convertLocation(vsys, tlocation, vsys);
        ret.text = text;
        return ret;
      }
      if (!ret.text) {
        ret.tabindex = v;
        ret.location = G.LibSword.convertLocation(vsys, tlocation, vsys);
        ret.text = text;
      }
    }
  }

  return ret;
}

// Return the values of component state Prefs. Component state Prefs are
// permanently persisted component state values. Component state prefs have
// Pref names beginning with the component id. Prefs names found in ignore
// are ignored. If prefsToGet is undefined, all state prefs will be returned.
// NOTE: The whole initial pref object (after the id) is returned if any of
// its descendants is requested.
export function getStatePref(
  id: string,
  prefsToGet?: string | string[] | null,
  ignore?: any
): {
  [i: string]: any;
} {
  const store = G.Prefs.getStore();
  if (!id || !store) {
    return {};
  }
  let prefs: undefined | string[];
  if (prefsToGet) {
    if (!Array.isArray(prefsToGet)) prefs = [prefsToGet];
    else {
      prefs = prefsToGet;
    }
    prefs = prefs.map((p) => {
      return p.split('.')[1];
    });
  }
  const state: any = {};
  Object.entries(store).forEach((entry) => {
    const [canid, value] = entry;
    if (canid === id && typeof value === 'object') {
      Object.entries(value).forEach((entry2) => {
        const [s, v] = entry2;
        if (
          (!ignore || !(s in ignore)) &&
          (prefs === undefined || prefs.includes(s))
        ) {
          state[s] = v;
        }
      });
    }
  });

  return state;
}

// Calling this function registers a set-window-states listener that, when
// called upon, will read component state Prefs and write them to new state.
export function onSetWindowStates(component: React.Component) {
  window.ipc.renderer.on('set-window-states', (prefs: string | string[]) => {
    const { id } = component.props as any;
    if (id) {
      const state = getStatePref(id, prefs);
      const lng = G.Prefs.getCharPref(C.LOCALEPREF);
      if (lng !== i18next.language) {
        i18next.changeLanguage(lng, (err) => {
          if (err) throw Error(err);
          G.reset();
          component.setState(state);
        });
      } else {
        component.setState(state);
      }
    }
  });
}

// Compare component state to lastStatePrefs and do nothing if they are the same.
// Otherwise, persist the changed state properties to Prefs (ignoring any in
// ignore) and then setGlobalMenuFromPrefs() will notify other windows of the
// changes.
export function updateGlobalState(
  id: string,
  state: React.ComponentState,
  lastStatePrefs: { [i: string]: any },
  ignore?: { [i: string]: any }
) {
  let prefsChanged = false;
  Object.entries(state).forEach((entry) => {
    const [name, value] = entry;
    if (!ignore || !(name in ignore)) {
      const type = typeof value;
      const pref = `${id}.${name}`;
      const lastval = lastStatePrefs[pref];
      const thisval = type === 'object' ? deepClone(value) : value;
      if (!compareObjects(lastval, thisval)) {
        if (type === 'string') {
          G.Prefs.setCharPref(pref, value as string);
        } else if (type === 'number') {
          G.Prefs.setIntPref(pref, value as number);
        } else if (type === 'boolean') {
          G.Prefs.setBoolPref(pref, value as boolean);
        } else {
          G.Prefs.setComplexValue(pref, value);
        }
        lastStatePrefs[pref] = thisval;
        prefsChanged = true;
      }
    }
  });
  if (prefsChanged) G.setGlobalMenuFromPrefs();
}
