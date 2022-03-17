/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/prefer-default-export */
import React from 'react';
import i18next from 'i18next';
import C from '../constant';
import RefParser, { RefParserOptionsType } from '../refparse';
import VerseKey from '../versekey';
import { ElemInfo, getElementInfo } from '../libswordElemInfo';
import { clone, JSON_parse, ofClass } from '../common';
import G from './rg';

import type {
  ContextData,
  LocationVKType,
  SearchType,
  TextVKType,
  V11nType,
} from '../type';

export function jsdump(msg: string | Error) {
  // eslint-disable-next-line no-console
  console.log(msg);
}

// This function will retrieve the last argument passed to a window (as
// webPreferences.additionalArguments) look for a particular key, and
// return its value if found. Xulsword passes these arguments in a single
// object as key value pairs so that any React component in the hierarchy
// may retrieve data specifically provided for it.
export function windowArgument(key: string) {
  const arg = window.shell.process.argv().at(-1);
  if (typeof arg === 'string' && arg.includes('{')) {
    const argobj = JSON_parse(arg);
    if (key in argobj) {
      return argobj[key];
    }
  }
  return null;
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

export function refParser(options?: RefParserOptionsType): RefParser {
  const gfunctions = {
    Book: () => {
      return G.Book;
    },
  };
  const localesAccessor = () => {
    const locs: string[][] = G.Prefs.getComplexValue('global.locales');
    return locs.map((val) => val[0]);
  };
  return new RefParser(gfunctions, localesAccessor, options);
}

export function verseKey(
  versekey: LocationVKType | string,
  v11n?: V11nType
): VerseKey {
  const lscl = (fromv11n: V11nType, vkeytext: string, tov11n: V11nType) => {
    return G.LibSword.convertLocation(fromv11n, vkeytext, tov11n);
  };
  const gfunctions = {
    Book: () => {
      return G.Book;
    },
    BkChsInV11n: () => {
      return G.BkChsInV11n;
    },
    Tab: () => {
      return G.Tab;
    },
  };
  return new VerseKey(
    refParser({ noOsisCode: true }),
    lscl,
    gfunctions,
    versekey,
    v11n
  );
}

// If textvk module is not a Bible, or does not contain the location, then an alternate
// module is used. First any companion module is checked, and if it does not have the
// text, then visible tabs are searched in order. If still not found, all tabs are
// searched in order. The textvk object reference is updated in place for any located
// text and module. If a text was found, true is returned. Otherwise false is returned.
export function findAVerseText(
  textvk: TextVKType,
  tabs: string[] | null,
  keepNotes: boolean
): boolean {
  const vk = verseKey(textvk.location);
  // Is module a Bible, or is there a companion Bible?
  if (!(textvk.module in G.Tab) || G.Tab[textvk.module].type !== C.BIBLE) {
    const bibles = getCompanionModules(textvk.module);
    const bible = !bibles.length || !(bibles[0] in G.Tab) ? null : bibles[0];
    const tov11n = bible && G.Tab[bible].v11n;
    if (tov11n) {
      vk.v11n = tov11n;
      textvk.module = bible;
      textvk.location = vk.location();
    }
  }

  // If we have a Bible, try it.
  if (
    textvk.module &&
    textvk.module in G.Tab &&
    G.Tab[textvk.module].type === C.BIBLE
  ) {
    textvk.text = G.LibSword.getVerseText(
      textvk.module,
      vk.osisRef(),
      keepNotes
    ).replace(/\n/g, ' ');
    if (textvk.text && textvk.text.length > 7) {
      return true;
    }
    textvk.text = '';
  }

  // Still no verse text. So now look at tabs...
  const { book } = vk;
  for (let v = 0; v < G.Tabs.length; v += 1) {
    const tab = G.Tabs[v];
    if (tab.module !== C.BIBLE || !tab.v11n) continue;
    const abooks = G.BooksInModule[tab.module];
    let ab;
    for (ab = 0; ab < abooks.length; ab += 1) {
      if (abooks[ab] === book) break;
    }
    if (ab === abooks.length) continue;
    const text = G.LibSword.getVerseText(
      tab.module,
      vk.osisRef(tab.v11n),
      keepNotes
    ).replace(/\n/g, ' ');
    if (text && text.length > 7) {
      // We have a valid result. If this version's tab is showing, then return it
      // otherwise save this result (unless a valid result was already saved). If
      // no visible tab match is found, this saved result will be returned.
      if (!textvk.text) {
        textvk.text = text;
        textvk.module = tab.module;
        vk.v11n = tab.v11n;
        textvk.location = vk.location();
      }
      if (tabs && tabs.includes(tab.module)) return true;
    }
  }

  return Boolean(textvk.text);
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
  const info1 = clone(TargetInfo);
  const focusNode = selob.focusNode as HTMLElement | null;
  if (!getTargetsFromElement(info1, focusNode)) return false;

  const info2 = clone(TargetInfo);
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
const parser = refParser({ uncertain: true });
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

  const isPinned = Boolean(atext && atext.dataset.ispinned === 'true');

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
  const info = clone(TargetInfo) as typeof TargetInfo;
  if (selob && !selob.isCollapsed && !/^\s*$/.test(selob.toString())) {
    selection = selob.toString();
    selectedLocationVK = parser.parse(selection, v11n)?.location || null;
    getTargetsFromSelection(info, selob);
  } else {
    getTargetsFromElement(info, elem);
  }

  const iv11n =
    (info.mod && info.mod in G.Tab && G.Tab[info.mod].v11n) || 'KJV';
  const locationVK = info.bk
    ? {
        v11n: iv11n,
        book: info.bk,
        chapter: info.ch || 1,
        verse: info.vs,
        lastverse: info.lv,
      }
    : null;

  return {
    locationVK,
    bookmark: info.bookmark,
    module,
    tab,
    lemma,
    panelIndex,
    isPinned,
    selection,
    selectionParsedVK: selectedLocationVK,
    search,
  };
}

export function getCompanionModules(mod: string) {
  const cms = G.LibSword.getModuleInformation(mod, 'Companion');
  if (cms !== C.NOTFOUND) return cms.split(/\s*,\s*/);
  return [];
}

// Return the values of component state Prefs. Component state Prefs are
// permanently persisted component state values recorded in prefs.json
// whose key begins with the component id. Pref keys found in ignore
// are ignored. If prefsToGet is undefined or null, all state prefs will
// be returned. NOTE: The whole pref object (the property name following
// the id) is returned if any of its descendants is requested.
type StateKeysType =
  | {
      [i: string]: any;
    }
  | string[];
export function getStatePref(
  id: string,
  prefsToGet?: string | string[] | null,
  ignore?: StateKeysType
) {
  const state: StateKeysType = {};
  if (id) {
    let ignoreKeys: string[] = [];
    if (ignore)
      ignoreKeys = Array.isArray(ignore) ? ignore : Object.keys(ignore);
    const idpref = G.Prefs.getComplexValue(id);
    let keys: undefined | string[];
    if (prefsToGet) {
      if (!Array.isArray(prefsToGet)) keys = [prefsToGet];
      else {
        keys = prefsToGet;
      }
      keys = keys
        .map((k) => {
          const kp = k.split('.');
          return kp[0] === id ? kp[1] : '';
        })
        .filter(Boolean);
    }
    Object.entries(idpref).forEach((entry) => {
      const [key, value] = entry;
      if (!ignoreKeys.includes(key) && (!prefsToGet || keys?.includes(key))) {
        state[key] = value;
      }
    });
  }

  return state;
}

// Calling this function sets a listener to update-state-from-pref. It will
// read component state Prefs and locale, and will update component state
// and window locale as needed.
export function onSetWindowState(component: React.Component, ignore?: any) {
  const listener = (prefs: string | string[]) => {
    const { id } = component.props as any;
    if (id) {
      const state = component.state as any;
      const newstate = getStatePref(id, prefs, ignore);
      Object.entries(newstate).forEach((entry) => {
        const [p, v] = entry;
        if (p in state && state[p] === v) delete newstate[p];
      });

      // VSCROLL.none on a single panel (when location is sent from other windows)
      // should not be obeyed because it is only intended for the one panel on the
      // one window that the user is manually scrolling.
      let { flagScroll } = 'flagScroll' in newstate ? newstate : state;
      flagScroll = clone(flagScroll);
      if (
        'location' in newstate &&
        flagScroll.filter((v: number) => v === C.VSCROLL.none).length === 1
      ) {
        const ns = flagScroll.find((v: number) => v !== C.VSCROLL.none);
        if (ns !== undefined) {
          newstate.flagScroll = flagScroll.map(() => ns);
        }
      }

      const lng = G.Prefs.getCharPref(C.LOCALEPREF);
      if (lng !== i18next.language) {
        i18next
          .loadLanguages(lng)
          .then(() => i18next.changeLanguage(lng))
          .then(() => {
            if (Object.keys(newstate).length) component.setState(newstate);
            return true;
          })
          .catch((err) => {
            throw Error(err);
          });
      } else if (Object.keys(newstate).length) component.setState(newstate);
    }
  };
  return window.ipc.renderer.on('update-state-from-pref', listener);
}
