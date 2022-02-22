/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/prefer-default-export */
import React from 'react';
import i18next from 'i18next';
import C from '../constant';
import { ElemInfo, getElementInfo } from '../libswordElemInfo';
import {
  compareObjects,
  deepClone,
  canDoConvertLocation,
  dotLocation2LocationVK,
  dString,
  escapeRE,
  guiDirection,
  iString,
  ofClass,
  string2LocationVK,
} from '../common';
import G from './rg';

import type {
  BookGroupType,
  ContextData,
  LocationVKType,
  SearchType,
  V11nType,
} from '../type';

export function jsdump(msg: string | Error) {
  // eslint-disable-next-line no-console
  console.log(msg);
}

// Read libsword data-src attribute file URLs and convert them into src inline data.
export function libswordImgSrc(container: HTMLElement) {
  Array.from(container.getElementsByTagName('img')).forEach((img) => {
    if (img.dataset.src) {
      // Show red box on failure
      let src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
      const m = img.dataset.src.match(/^file:\/\/(.*)$/i);
      if (m) src = G.inlineFile(m[1], 'base64');
      img.src = src;
      img.removeAttribute('data-src');
    }
  });
}

export function clearPending(
  obj: any,
  name: string[] | string,
  isInterval = false
) {
  const names = Array.isArray(name) ? name : [name];
  names.forEach((n) => {
    if (n in obj) {
      const cl = obj[n];
      if (cl) {
        if (isInterval) clearInterval(cl);
        else clearTimeout(cl);
        obj[n] = undefined;
      }
    }
  });
}

// Javascript's scrollIntoView() also scrolls ancestors in ugly
// ways. So this util sets scrollTop of all ancestors greater than
// ancestor away, to zero. At this time (Jan 2022) Electron (Chrome)
// scrollIntoView() arguments do not work. So percent 0 scrolls elem
// to the top, 50 to the middle and 100 to the bottom.
export function scrollIntoView(
  elem: HTMLElement,
  ancestor: HTMLElement,
  percent = 30
) {
  elem.scrollIntoView();
  let st: HTMLElement | null = elem;
  let setToZero = false;
  let adjust = true;
  while (st) {
    const max = st.scrollHeight - st.clientHeight;
    if (!setToZero && adjust && st.scrollTop > 0 && st.scrollTop < max) {
      st.scrollTop -= (st.clientHeight - elem.offsetHeight) * (percent / 100);
      adjust = false;
    }
    if (setToZero && st.scrollTop) st.scrollTop = 0;
    if (st === ancestor) setToZero = true;
    st = st.parentNode as HTMLElement | null;
  }
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

// Convert a LocationVKType to a readable string like 'Genesis 4:5-6'
export function locationVK2String(l: LocationVKType, notHTML = false): string {
  const guidir = guiDirection(G);

  let dc = guidir === 'rtl' ? '&rlm;' : '&lrm;';
  if (notHTML)
    dc =
      guidir === 'rtl' ? String.fromCharCode(8207) : String.fromCharCode(8206);

  const book = l.book && l.book in G.Book ? G.Book[l.book].name : l.book;
  let ret = dc + l.chapter ? `${book}${dc} ${l.chapter}` : book;
  if (l.chapter && l.verse) {
    ret += `${dc}:${l.verse}`;
    if (l.lastverse && l.lastverse > l.verse) {
      ret += `${dc}-${l.lastverse}`;
    }
  }

  return dString(ret);
}

// LibSword.getMaxChapter returns an erroneous number if vkeytext's
// book is not part of v11n, so it would be necessary to check here
// first. But a LibSword call is unnecessary with G.BooksInV11n.
// NOTE: mutil has this same function.
export function getMaxChapter(v11n: V11nType, vkeytext: string) {
  const [book] = vkeytext.split(/[\s.:]/);
  if (!(v11n in G.BkChsInV11n)) return 0;
  if (!(book in G.BkChsInV11n[v11n])) return 0;
  return G.BkChsInV11n[v11n][book];
}

// LibSword.getMaxVerse returns an erroneous number if vkeytext's
// chapter is not part of v11n, so check here first.
// NOTE: mutil has this same function.
export function getMaxVerse(v11n: V11nType, vkeytext: string) {
  const maxch = getMaxChapter(v11n, vkeytext);
  return maxch ? G.LibSword.getMaxVerse(v11n, vkeytext) : 0;
}

export function convertLocationVK(
  l: LocationVKType,
  tov11n: V11nType
): LocationVKType {
  const fromv11n = l.v11n;
  if (!canDoConvertLocation(G.BkChsInV11n, l, tov11n)) return l;
  const conv = dotLocation2LocationVK(
    G.LibSword.convertLocation(
      fromv11n,
      [l.book, l.chapter, l.verse, l.lastverse].filter(Boolean).join('.'),
      tov11n
    ),
    tov11n
  );
  return conv;
}

// Input location may have the forms:
// Matt 3:5, John 3:16-John 3:21, John.3, John.3.5, John.3.16-John.3.16.21, or John.3.7.10.
// If version is not a Bible, or does not have the book where location is, then an alternate
// Bible version is used and the location is converted to the new verse system.
//
// The returned LocationVKType applies to the returned text that was found.
// Null is returned if verse text cannot be found in any Bible module.
//
// Is module a Bible, or does module specify another reference Bible in its config file? Then use that.
// If version does not yield verse text, then look at visible tabs in their order.
// If visible tabs do not yield verse text, then look at hidden tabs in their order.
export function findAVerseText(
  module: string,
  reference: string,
  tabs: string[],
  keepNotes: boolean
): (LocationVKType & { text: string }) | null {
  if (!(module in G.Tab)) return null;

  const { v11n } = G.Tab[module];
  if (!v11n) return null;
  let location = { ...string2LocationVK(reference), text: '' };
  location.v11n = v11n;

  // Is module a Bible, or does it specify a Bible?
  if (getModuleLongType(module) === C.BIBLE) {
    location.version = module;
  } else {
    const bibles = getCompanionModules(module);
    const bible = !bibles.length || !(bibles[0] in G.Tab) ? null : bibles[0];
    const tov11n = bible && G.Tab[bible].v11n;
    if (tov11n) {
      location.version = bible;
      location = { ...convertLocationVK(location, tov11n), text: '' };
    }
  }

  // If we have a Bible, try it first.
  if (location.version && location.version in G.Tab) {
    location.text = G.LibSword.getVerseText(
      location.version,
      [location.book, location.chapter, location.verse, location.lastverse]
        .filter(Boolean)
        .join('.'),
      keepNotes
    ).replace(/\n/g, ' ');
    if (location.text && location.text.length > 7) {
      return location;
    }
    location.text = '';
  }

  // Passed version did not yield verse text. So now look at tabs...
  const { book } = location;
  for (let v = 0; v < G.Tabs.length; v += 1) {
    const tab = G.Tabs[v];
    if (tab.module !== C.BIBLE || !tab.v11n) continue;
    const abooks = G.BooksInModule[tab.module];
    let ab;
    for (ab = 0; ab < abooks.length; ab += 1) {
      if (abooks[ab] === book) break;
    }
    if (ab === abooks.length) continue;
    const tlocation = convertLocationVK(location, tab.v11n);
    const text = G.LibSword.getVerseText(
      tab.module,
      [tlocation.book, tlocation.chapter, tlocation.verse, tlocation.lastverse]
        .filter(Boolean)
        .join('.'),
      keepNotes
    ).replace(/\n/g, ' ');
    if (text && text.length > 7) {
      // We have a valid result. If this version's tab is showing, then return it
      // otherwise save this result (unless a valid result was already saved). If
      // no visible tab match is found, this saved result will be returned.
      if (!location.text) {
        location = { ...tlocation, text };
      }
      if (tabs.includes(tab.module)) return location;
    }
  }

  return location.text ? location : null;
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
  const bgs: BookGroupType[] = ['ot', 'nt'];
  bgs.forEach((bg: BookGroupType) => {
    C.SupportedBooks[bg].forEach((bk) => {
      const keys = [G.Book[bk].code, `Long${G.Book[bk].code}`];
      if (!noVariations) keys.push(`${G.Book[bk].code}Variations`);
      const list = keys.map((k) => {
        const r = i18next.t(k, toptions);
        return !r ? null : r.split(/\s*,\s*/);
      });

      if (compareAgainstList(inbook, list, exact)) {
        const am = G.LocaleConfigs[bookInfo.locale].AssociatedModules;

        bookInfo.bookCode = G.Book[bk].code;
        bookInfo.modules = am === C.NOTFOUND ? [] : am.split(/\s*,\s*/);

        count += 1;
      }
    });
  });

  return count;
}

// Return the module context in which the element resides, NOT the
// module associated with the data of the element itself.
export function getContextModule(elem: HTMLElement): string | null {
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
  if (atext) return atext.element.dataset.module || null;

  // are we in cross reference text?
  telem = elem as HTMLElement | null;
  while (telem?.classList && !telem.classList.contains('crtext')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  const match = telem?.className && telem?.className.match(/\bcs-(\S+)\b/);
  if (match) return match[1];

  // in a search lexicon list?
  telem = elem as HTMLElement | null;
  while (telem?.classList && !telem.classList.contains('snlist')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  if (telem && 'getAttribute' in telem)
    return telem.getAttribute('contextModule');

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

const TargetInfo = {
  mod: null as string | null,
  bk: null as string | null,
  ch: null as number | null,
  vs: null as number | null,
  lv: null as number | null,
  bookmark: null as string | null,
};

// Returns target information associated with an element.
// NOTE: bk, ch, vs, and lv may be interpreted differently depending
// on the module type of "mod".
function readDataFromElement(info: typeof TargetInfo, element: HTMLElement) {
  const eleminfo = getElementInfo(element);
  if (!eleminfo) return false;

  Object.entries(eleminfo).forEach((entry) => {
    const p0 = entry[0] as keyof ElemInfo;
    const p = p0 as keyof typeof TargetInfo;
    const val = entry[1] as any;

    if (p0 === 'nid') {
      /* TODO!:
      if (!info.bookmark && BM && typeof BookmarkFuns !== undefined) {
        const aItem = BM.RDF.GetResource(decodeURIComponent(val));
        const aParent = ResourceFuns.getParentOfResource(aItem, BMDS);
        if (aParent) {
          info.bookmark = XS_window.BookmarksUtils.getSelectionFromResource(aItem, aParent);
        }
      }
      */
      return;
    }

    // first come, first served- don't overwrite existing data
    if (!(p0 in info) || info[p] !== null) return;

    // some params use "0" as a placeholder which should not be propagated
    if (['bk', 'ch', 'vs', 'lv'].includes(p) && info[p] === 0) return;

    if (val !== null && val !== undefined) info[p] = val; // got it!
  });

  return true;
}

// Read target info from an element and its parents.
function getTargetsFromElement(
  info: typeof TargetInfo,
  element: HTMLElement | null
): typeof TargetInfo {
  let elem = element as HTMLElement | null;
  while (elem) {
    // if this is a user-note hilight verse, get un info from inside it
    if (elem.className && elem.classList.contains('un-hilight')) {
      const child = elem.getElementsByClassName('un');
      if (child && child.length) {
        const chl = child[0] as HTMLElement;
        readDataFromElement(info, chl);
      }
    }
    readDataFromElement(info, elem);
    elem = elem.parentNode as HTMLElement | null;
  }

  return info;
}

// Read two targets, one from each end of the selection, merge the two and return the results.
function getTargetsFromSelection(
  info: typeof TargetInfo,
  selob: Selection
): boolean {
  const info1 = deepClone(TargetInfo);
  const focusNode = selob.focusNode as HTMLElement | null;
  if (!getTargetsFromElement(info1, focusNode)) return false;

  const info2 = deepClone(TargetInfo);
  const anchorNode = selob.anchorNode as HTMLElement | null;
  if (!getTargetsFromElement(info2, anchorNode)) return false;

  // merge bookmarks
  if (!info1.bookmark && info2.bookmark) info1.bookmark = info2.bookmark;

  // merge targ2 into targ1 if mod, bk and ch are the same (otherwise ignore targ2)
  if (
    info1.mod &&
    info1.mod === info2.mod &&
    info1.bk &&
    info1.bk === info2.bk &&
    info1.ch &&
    info1.ch === info2.ch
  ) {
    let vs =
      info2.vs && (!info1.vs || info2.vs < info1.vs) ? info2.vs : info1.vs;
    let lv =
      info2.lv && (!info1.lv || info2.lv > info1.lv) ? info2.lv : info1.lv;

    if (lv && !vs) vs = lv;
    if ((vs && !lv) || lv < vs) lv = vs;

    if (vs) info1.vs = vs;
    if (lv) info1.lv = lv;
  }

  // save merged targ1 to target
  Object.keys(TargetInfo).forEach((key) => {
    const k = key as keyof typeof TargetInfo;
    if (info[k] === null && info1[k] !== null) info[k] = info1[k];
  });

  return true;
}

// Return contextual data for use by context menus.
export function getContextData(elem: HTMLElement): ContextData {
  const atextx = ofClass(['atext'], elem);
  const atext = atextx ? atextx.element : null;
  const tabx = ofClass(['tab'], elem);
  const atab = tabx ? tabx.element : null;

  let module;
  if (atext) module = atext.dataset.module;
  else if (atab) module = atab.dataset.module;
  module = module || null;

  let panelIndexs;
  if (atext) panelIndexs = atext.dataset.index;
  else if (atab) panelIndexs = atab.dataset.index;
  const panelIndex = panelIndexs ? Number(panelIndexs) : null;

  const tab = atab?.dataset.module || null;

  const contextModule = getContextModule(elem);
  if (contextModule) module = contextModule;

  const v11n =
    (contextModule && contextModule in G.Tab && G.Tab[contextModule].v11n) ||
    'KJV';

  let search: SearchType | null = null;
  let lemma = null;
  const snx = ofClass(['sn'], elem);
  const lemmaArray: string[] = [];
  if (snx && contextModule) {
    Array.from(snx.element.classList).forEach((cls) => {
      if (cls === 'sn') return;
      const [type, lemmaStr] = cls.split('_');
      if (type !== 'S' || !lemmaStr) return;
      const lemmaNum = Number(lemmaStr.substring(1));
      // SWORD filters >= 5627 out- not valid it says
      if (
        Number.isNaN(lemmaNum) ||
        (lemmaStr.startsWith('G') && lemmaNum >= 5627)
      )
        return;
      lemmaArray.push(`lemma: ${lemmaStr}`);
    });
    lemma = lemmaArray.length ? lemmaArray.join(' ') : null;
    if (lemma && module) {
      search = {
        module,
        searchtext: lemma,
        type: 'SearchAdvanced',
      };
    }
  }

  // Get targets from mouse pointer or selection
  let selection = null;
  let selectedLocationVK = null;
  const selob = getSelection();
  const info = deepClone(TargetInfo);
  if (selob && !selob.isCollapsed && !/^\s*$/.test(selob.toString())) {
    selection = selob.toString();
    selectedLocationVK = parseLocation(selection, v11n);
    getTargetsFromSelection(info, selob);
  } else {
    getTargetsFromElement(info, elem);
  }

  return {
    book: info.bk,
    chapter: info.ch,
    verse: info.vs,
    lastverse: info.lv,
    bookmark: info.bookmark,
    module,
    tab,
    lemma,
    panelIndex,
    selection,
    selectedLocationVK,
    search,
  };
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
  v11n: V11nType,
  noVariations = false,
  mustBeUnique = false
): LocationVKType | null {
  let loc2parse = text;

  const dot = dotLocation2LocationVK(loc2parse, v11n);
  // if loc2parse started with a book code assume it's a valid osisRef
  if (dot.book && dot.book in G.Book) {
    return dot;
  }

  loc2parse = loc2parse.replace(/[^\s\p{L}\p{N}:-]/gu, '');
  loc2parse = loc2parse.replace(/\s+/g, ' ');
  loc2parse = loc2parse.trim();

  if (loc2parse === '' || loc2parse === null) {
    return null;
  }

  const location = {
    v11n,
    book: '',
    chapter: 0,
    verse: null,
    lastverse: null,
    version: null,
  } as LocationVKType;

  let has1chap;
  let shft; // book=1, chap=2, verse=3, lastverse=4
  /* eslint-disable prettier/prettier */
  let parsed = null;
  if (parsed === null) {parsed = loc2parse.match(/^(.+?)\s+(\d+):(\d+)-(\d+)$/); shft=0; has1chap=false;} // book 1:2-3
  if (parsed === null) {parsed = loc2parse.match(/^(.+?)\s+(\d+):(\d+)$/);       shft=0; has1chap=false;} // book 4:5
  if (parsed === null) {parsed = loc2parse.match(/^(.+?)\s+(\d+)$/);             shft=0; has1chap=false;} // book 6
  if (parsed === null) {parsed = loc2parse.match(/^(.+?)\s+[v|V].*(\d+)$/);      shft=0; has1chap=true; } // book v6 THIS VARIES WITH LOCALE!
  if (parsed === null) {parsed = loc2parse.match(/^(\d+)$/);                     shft=2; has1chap=false;} // 6
  if (parsed === null) {parsed = loc2parse.match(/^(\d+):(\d+)-(\d+)$/);         shft=1; has1chap=false;} // 1:2-3
  if (parsed === null) {parsed = loc2parse.match(/^(\d+):(\d+)$/);               shft=1; has1chap=false;} // 4:5
  if (parsed === null) {parsed = loc2parse.match(/^(\d+)-(\d+)$/);               shft=2; has1chap=false;} // 4-5
  if (parsed === null) {parsed = loc2parse.match(/^(.*?)$/);                     shft=0; has1chap=false;} // book
  /* eslint-enable prettier/prettier */
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
            location.v11n = (mod in G.Tab && G.Tab[mod].v11n) || 'KJV';
            if (mod in G.BooksInModule && G.BooksInModule[mod].includes(code))
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

// Write state to Prefs and then update all window states from statePrefs.
export function setStatePref(id: string, state: Partial<React.ComponentState>) {
  const prefs: string[] = [];
  Object.entries(state).forEach((entry) => {
    const [key, value] = entry;
    if (value !== undefined) {
      const pref = `${id}.${key}`;
      if (typeof value === 'string') G.Prefs.setCharPref(pref, value);
      else if (typeof value === 'number') G.Prefs.setIntPref(pref, value);
      else if (typeof value === 'boolean') G.Prefs.setBoolPref(pref, value);
      else G.Prefs.setComplexValue(pref, value);
      prefs.push(pref);
    }
  });
  setTimeout(() => {
    G.setGlobalStateFromPref(null, prefs);
  }, 1);
}

// Calling this function registers a update-state-from-pref listener that, when
// called upon, will read component state Prefs and write them to new state.
export function onSetWindowState(component: React.Component) {
  const listener = (prefs: string | string[]) => {
    const { id } = component.props as any;
    if (id) {
      const state = getStatePref(id, prefs);
      const lng = G.Prefs.getCharPref(C.LOCALEPREF);
      if (lng !== i18next.language) {
        i18next
          .loadLanguages(lng)
          .then(() => i18next.changeLanguage(lng))
          .then(() => {
            return component.setState(state);
          })
          .catch((err) => {
            throw Error(err);
          });
      } else {
        component.setState(state);
      }
    }
  };
  return window.ipc.renderer.on('update-state-from-pref', listener);
}

// Compare component state to lastStatePrefs and do nothing if they are the same.
// Otherwise, persist the changed state properties to Prefs (ignoring any in
// ignore) and then setGlobalMenuFromPref() will update the application menu to
// keep them in sync. Returns true if any prefs were changed, false otherwise.
export function setPrefFromState(
  id: string,
  state: React.ComponentState,
  lastStatePrefs: { [i: string]: any },
  ignore?: { [i: string]: any }
): boolean {
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
  if (prefsChanged) G.setGlobalMenuFromPref();
  return prefsChanged;
}
