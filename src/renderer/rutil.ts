/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/prefer-default-export */
import React from 'react';
import Cache from '../cache';
import C from '../constant';
import G from './rg';
import log from './log';
import RefParser, { RefParserOptionsType } from '../refparse';
import VerseKey from '../versekey';
import { ElemInfo, getElementInfo, TitleFormat } from '../libswordElemInfo';
import { clone, diff, JSON_parse, ofClass, versionCompare } from '../common';

import type {
  ContextData,
  GType,
  LocationVKType,
  ModTypes,
  PrefObject,
  Repository,
  SearchType,
  SwordConfLocalized,
  SwordConfType,
  V11nType,
} from '../type';
import type { SelectVKMType } from './libxul/vkselect';

export function component(
  comp: any
): { displayName: string; props: any } | null {
  const c1 = comp as React.Component;
  const p = c1 && typeof c1 === 'object' && 'props' in c1 ? c1.props : null;
  const c2 = comp as any;
  const displayName: string =
    (c2 && typeof c2 === 'object' && 'type' in c2 && c2.type.displayName) || '';
  if (p) {
    return { displayName, props: p };
  }
  return null;
}

// This function will retrieve the last argument passed to a window (as
// webPreferences.additionalArguments) look for a particular key, and
// return its value if found. Xulsword passes these arguments in a single
// object as key value pairs so that any React component in the hierarchy
// may retrieve data specifically provided for it.
export function windowArgument(key: string) {
  const arg = window.processR.argv().at(-1);
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

// Does location surely exist in the module? It's assumed if a book is included,
// then so are all of its chapters and verses.
export function isValidVKM(location: LocationVKType, module: string): boolean {
  if (!isValidVK(location)) return false;
  if (!module || !(module in G.Tab)) return false;
  const tab = G.Tab[module];
  if (location.v11n !== tab.v11n) return false;
  if (!G.getBooksInModule(module).includes(location.book)) return false;
  return true;
}

// Does location actually exist in v11n?
export function isValidVK(location: LocationVKType): boolean {
  const { book, chapter, v11n, verse, lastverse } = location;
  if (!book || !v11n) return false;
  if (chapter < 1 || chapter > getMaxChapter(v11n, book)) {
    return false;
  }
  const maxv = getMaxVerse(v11n, `${book} ${chapter}`);
  if (verse !== undefined && verse !== null) {
    if (verse < 1 || verse > maxv) {
      return false;
    }
  }
  if (lastverse !== undefined && lastverse !== null) {
    if (!verse || lastverse < verse || lastverse > maxv) {
      return false;
    }
  }
  return true;
}

// Return a valid LocationVK in the given module. If module is '' then
// Gen.1.1.1.KJV is returned.
export function getValidVK(module: string): LocationVKType {
  return {
    book: (module && G.getBooksInModule(module)[0]) || 'Gen',
    chapter: 1,
    verse: 1,
    lastverse: 1,
    v11n: (module && module in G.Tab && G.Tab[module].v11n) || 'KJV',
  };
}

// LibSword.getMaxChapter returns an erroneous number if vkeytext's
// book is not part of v11n, so it would be necessary to check here
// first. But a LibSword call is unnecessary with G.BooksInV11n.
// NOTE: main process has this same function.
export function getMaxChapter(v11n: V11nType, vkeytext: string) {
  const [book] = vkeytext.split(/[\s.:]/);
  if (!(v11n in G.BkChsInV11n)) return 0;
  const b = G.BkChsInV11n[v11n].find((x) => x[0] === book);
  return b ? b[1] : 0;
}

// LibSword.getMaxVerse returns an erroneous number if vkeytext's
// chapter is not part of v11n, so check here first.
// NOTE: main process has this same function.
export function getMaxVerse(v11n: V11nType, vkeytext: string) {
  const { chapter } = verseKey(null, vkeytext, v11n);
  const maxch = getMaxChapter(v11n, vkeytext);
  return chapter <= maxch && chapter > 0
    ? G.LibSword.getMaxVerse(v11n, vkeytext)
    : 0;
}

export function verseKey(
  i18n: GType['i18n'] | null,
  versekey: LocationVKType | string,
  v11n?: V11nType | null,
  options?: RefParserOptionsType
): VerseKey {
  return new VerseKey(
    new RefParser(i18n, options),
    G.BkChsInV11n,
    {
      convertLocation: (
        fromv11n: V11nType,
        vkeytext: string,
        tov11n: V11nType
      ) => {
        return G.LibSword.convertLocation(fromv11n, vkeytext, tov11n);
      },
      Book: () => {
        return G.Book;
      },
      Tab: () => {
        return G.Tab;
      },
    },
    versekey,
    v11n
  );
}

// Return the module context in which the element resides.
export function getContextModule(
  elem: ParentNode | HTMLElement | EventTarget | null
): string | null {
  if (!elem) return null;
  // get the first ancestor having one of these classes
  const c = ofClass(
    ['atext']
      .concat(Object.keys(TitleFormat))
      .concat(G.Tabs.map((t) => `cs-${t.module}`)),
    elem
  );
  if (c) {
    if (c.type === 'atext') {
      return c.element.dataset.module || null;
    }
    if (c.type.startsWith('cs-')) {
      return c.type.substring(3);
    }
    const p = getElementInfo(c.element);
    return (p && p.mod) || null;
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
  element: HTMLElement | ParentNode | EventTarget | null
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
    if (vs && (!lv || lv < vs)) lv = vs;

    if (vs) info1.vs = vs;
    if (lv) info1.lv = lv;
  }

  // save merged targ1 to target
  Object.keys(TargetInfo).forEach((key) => {
    const k = key as keyof typeof TargetInfo;
    const i1k = info1[k] as any;
    if (info[k] === null && i1k !== null) info[k] = i1k;
  });

  return true;
}

// Return contextual data for use by context menus.
export function getContextData(
  i18n: GType['i18n'],
  elem: HTMLElement | ParentNode | EventTarget
): ContextData {
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
    null;

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
        Number.isNaN(Number(lemmaNum)) ||
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
    selectedLocationVK =
      new RefParser(i18n, { uncertain: true }).parse(selection, v11n)
        ?.location || null;
    getTargetsFromSelection(info, selob);
  } else {
    getTargetsFromElement(info, elem);
  }

  const iv11n = (info.mod && info.mod in G.Tab && G.Tab[info.mod].v11n) || null;
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
    const idpref = G.Prefs.getComplexValue(id) as PrefObject;
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
        state[key] = clone(value);
      }
    });
  }

  return state;
}

// Calling this function sets a listener to update-state-from-pref. It will
// read component state Prefs and locale, and will update component state
// and window locale as needed.
export function onSetWindowState(c: React.Component, ignore?: any) {
  const listener = (prefs: string | string[]) => {
    log.debug(`Updating state from prefs:`, prefs);
    const { id } = c.props as any;
    if (id) {
      const changed = diff(c.state, getStatePref(id, prefs, ignore));
      if (changed && Object.keys(changed).length) {
        if (
          changed?.global?.locale &&
          changed.global.locale !== G.i18n.language
        ) {
          Cache.clear();
        }
        c.setState(changed);
      }
    }
  };
  return window.ipc.on('update-state-from-pref', listener);
}

let languageNames: {
  en: { [code: string]: string };
  self: { [code: string]: string };
};
export function getLangReadable(code: string): string {
  if (/^en(-*|_*)$/.test(code)) return 'English';
  if (!code || code === '?' || /^\s*$/.test(code)) return '?';
  if (!languageNames) {
    const path = `${G.Dirs.path.xsAsset}/locales/languageNames.json`;
    const json = G.inlineFile(path, 'utf8', true);
    languageNames = JSON_parse(json);
  }
  let name = code;
  const code2 = code.replace(/-.*$/, '');
  if (G.i18n.language.split('-').shift() === 'en') {
    name =
      code2 in languageNames.en
        ? languageNames.en[code2]
        : languageNames.self[code2];
  } else {
    name =
      code2 in languageNames.self
        ? languageNames.self[code2]
        : languageNames.en[code2];
  }
  return name || code;
}

export function moduleInfoHTML(configs: SwordConfType[]): string {
  const esc = (s: string): string => {
    if (!s) return '';
    return s.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#039;';
      }
    });
  };
  const gethtml = (c: SwordConfType): string => {
    const fields: (keyof SwordConfType)[] = [
      'Lang',
      'moduleType',
      'module',
      'Version',
      'sourceRepository',
      'ShortPromo',
      'ShortCopyright',
      'About',
      'UnlockInfo',
      'Description',
      'DistributionLicense',
      'Copyright',
      'CopyrightDate',
      'CopyrightHolder',
      'CopyrightNotes',
      'CopyrightContactName',
      'CopyrightContactAddress',
      'CopyrightContactEmail',
      'CopyrightContactNotes',
      'History',
    ];
    const sc = C.SwordConf;
    const lang = G.i18n.language;
    let about: string;
    if (c.About) about = lang in c.About ? c.About[lang] : c.About.en;
    return fields
      .map((f) => {
        let description;
        const rv = c[f] as SwordConfLocalized;
        if (f === 'Description' && rv)
          description = lang in rv ? rv[lang] : rv.en;
        if (c[f] && !(description && description === about)) {
          const sf = f as any;
          let value: string;
          if (sc.localization.includes(sf)) {
            const v = c[f] as SwordConfLocalized;
            value = lang in v ? v[lang] : v.en;
            if (sf.startsWith('CopyrightContact')) {
              value = `${sf.substring('CopyrightContact'.length)}: ${value}`;
            }
          } else if (sc.repeatable.includes(sf)) {
            const v = c[f] as string[];
            value = v.join(', ');
          } else if (sc.integer.includes(sf)) {
            const v = c[f] as number;
            value = v.toString();
          } else if (sf === 'moduleType') {
            const v = c[f] as ModTypes;
            value = G.i18n.t(v);
          } else if (sf === 'Lang') {
            const v = c[f] as string;
            const [l, s] = v.split('-');
            value = getLangReadable(l);
            if (s) value += ` (${s})`;
          } else if (sf === 'History') {
            const v = c[f] as [string, SwordConfLocalized][];
            value = v
              .sort((a, b) => versionCompare(a[0], b[0]))
              .map((x) => {
                const vers = esc(x[0]);
                const desc = esc(lang in x[1] ? x[1][lang] : x[1].en);
                return `<div>Version ${vers}: ${desc}</div>`;
              })
              .join('');
          } else if (sf === 'sourceRepository') {
            const v = c[f] as Repository;
            value = v.name || '';
          } else value = c[f]?.toString() || '';

          if (![sc.htmllink, 'History'].flat().includes(sf)) {
            value = esc(value);
          } else {
            value = value.replace(/<a[^>]*>/g, (m) => {
              if (m.includes('target="_blank"')) return m;
              return m.replace(/( target="[^"]*"|(?=>))/, ' target="_blank"');
            });
          }
          if (sc.rtf.includes(sf)) {
            value = value.replace(
              /\\qc([^\\]+)(?=\\)/g,
              '<div class="rtf-qc">$1</div>'
            );
            value = value.replaceAll('\\pard', '');
            value = value.replaceAll('\\par', '<br>');
          }
          return `<div class="${f}">${value}</div>`;
        }
        return '';
      })
      .join('');
  };
  const html: string[] = [];
  configs.forEach((conf) => {
    html.push(gethtml(conf));
  });
  return `<div class="module-info">${html.join(
    '<div class="separator"></div>'
  )}</div>`;
}

// Replace stylesheet and other CSS with inline CSS.
export function computed2inlineStyle(
  elemx: HTMLElement | ChildNode,
  ignore?: CSSStyleDeclaration
): HTMLElement | null {
  const elem = elemx as HTMLElement;
  const style = getComputedStyle(elem);
  // Computed style is Chrome specific, so apply some simple replacements to
  // make inline CSS more portable.
  if (elem.parentElement) {
    let replacement;
    if (style.display === 'none' || style.visibility === 'hidden') {
      replacement = 'span';
    } else if (elem.classList.contains('head-line-break')) {
      replacement = 'br';
    }
    if (replacement) {
      elem.parentElement.insertBefore(
        document.createElement(replacement),
        elem
      );
      elem.parentElement.removeChild(elem);
    }
  }
  const ign = ignore || style;
  for (let i = 0; i < style.length; i += 1) {
    const name = style[i];
    const value = style.getPropertyValue(name);
    if (value && ign.getPropertyValue(name) !== value) {
      elem.style.setProperty(name, value, style.getPropertyPriority(name));
    }
  }
  // Remove all attributes except style
  elem.getAttributeNames().forEach((name) => {
    if (name !== 'style') elem.removeAttribute(name);
  });
  Array.from(elem.children).forEach((c) => computed2inlineStyle(c, ign));
  return elem;
}

// Filter div element children (such as from LibSword HTML output)
// to just the given range of verses.
export function htmlVerses(
  div: HTMLElement,
  verse: number,
  lastverse: number | null // null means last verse of chapter
): HTMLElement {
  let keeping = lastverse === null;
  Array.from(div.children)
    .reverse()
    .forEach((ch) => {
      const child = ch as HTMLElement;
      const info = getElementInfo(child);
      if (info?.type === 'vs') {
        const vs = info.lv ?? (info.vs || 0);
        if (vs <= (lastverse || verse || 0)) keeping = true;
        if (vs < (verse || 0)) keeping = false;
      }
      if (!keeping) {
        div.removeChild(child);
      }
    });
  return div;
}

// Convert LibSword HTML into plain text.
export function elem2text(div: HTMLElement): string {
  let html = div.innerHTML;
  html = html.replace(/\s*<sup[^>]*>([\d-]+)<\/sup>\s*/gi, ' [$1] ');
  html = html.replace(/<br>/gi, C.SYSTEMNEWLINE);
  html = html.replace(/<\/div>/gi, C.SYSTEMNEWLINE);
  html = html.replace(/ *(<[^>]+> *)+/g, ' ');
  html = html.replace(/&nbsp;/gi, ' ');
  html = html.replace(/(&rlm;|&lrm;)/g, '');
  html = html.replace(/([\n\r]+ *){3,}/g, C.SYSTEMNEWLINE + C.SYSTEMNEWLINE);
  return html;
}
