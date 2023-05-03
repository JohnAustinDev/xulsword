/* eslint-disable import/order */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-explicit-any */
import C from './constant';
import S from './defaultPrefs';
import Cache from './cache';

import type { Region } from '@blueprintjs/table';
import type {
  Download,
  FTPDownload,
  ModFTPDownload,
  PrefObject,
  Repository,
  SwordConfType,
  RowSelection,
  HTTPDownload,
  QuerablePromise,
  GType,
  DeprecatedAudioChaptersConf,
  VerseKeyAudioConf,
  GenBookAudioConf,
  VerseKeyAudio,
  OSISBookType,
  PrefValue,
  BookmarkFolderType,
  NewModulesType,
  BookmarkTreeNode,
  PrefStoreType,
  LocationORType,
  BookmarkItemType,
  TabType,
  TabTypes,
  GenBookAudio,
  ModulesCache,
  TreeNodeInfoPref,
  LocationVKType,
  LocationVKCommType,
  LocationTypes,
} from './type';
import type { TreeNodeInfo } from '@blueprintjs/core';
import type { SelectVKType } from './renderer/libxul/selectVK';
import type { SelectORMType } from './renderer/libxul/selectOR';
import type { getSampleText } from './renderer/bookmarks';
import type { verseKey } from './renderer/htmlData';
import type { XulswordState } from './renderer/xulsword/xulsword';

export function escapeRE(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// JSON does not encode Javascript undefined, functions or symbols. So
// what is specially encoded here can be recovered using JSON_parse(string).
// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_stringify(
  x: any,
  space?: number,
  maxlen?: number
): string {
  const str = JSON.stringify(
    x,
    (_k, v) => {
      return v === undefined ? '_undefined_' : v;
    },
    space
  );
  if (maxlen && str.length > maxlen) {
    throw new Error(`Exceeded maximum JSON string length of ${maxlen}`);
  }
  return str;
}

// NOTE: It is not possible to 100% recover arrays with undefined values
// using the JSON.parse reviver, because the reviver specification requires
// deletion of undefined array elements rather than setting to undefined.
// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_parse(s: string, anyx?: Exclude<any, undefined>): any {
  const any = anyx !== undefined ? anyx : JSON.parse(s);
  if (any === undefined || any === null) return any;
  if (typeof any === 'object') {
    Object.entries(any).forEach((entry) => {
      const [k, v] = entry;
      any[k] = v === '_undefined_' ? undefined : JSON_parse('', v);
    });
  }
  return any;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_attrib_stringify(
  x: any,
  space?: number,
  maxlen?: number
): string {
  let str = JSON_stringify(x, space);
  str = str
    .replace(/&/g, '%26') /* These 5 replacements protect from HTML/XML. */
    .replace(/'/g, '%27')
    .replace(/"/g, "'")
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
  if (maxlen && str.length > maxlen) {
    throw new Error(
      `Exceeded maximum JSON attribute string length of ${maxlen}`
    );
  }
  return str;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_attrib_parse(
  s: string,
  anyx?: Exclude<any, undefined>
): any {
  const str = s
    .replace(/%3E/g, '>')
    .replace(/%3C/g, '<')
    .replace(/'/g, '"')
    .replace(/%27/g, "'")
    .replace(/%26/g, '&'); /* These 5 replacements protect from HTML/XML. */

  return JSON_parse(str, anyx);
}

// Firefox Add-On validation throws warnings about eval(uneval(obj)), so
// this is an alternate way...
export function deepClone<T>(obj: T): T {
  return JSON_parse(JSON_stringify(obj)) as T;
}

// Copy a data object. Data objects have string keys with values that are
// either primitives, arrays or other data objects.
export function clone<T>(obj: T, ancestors: any[] = []): T {
  const anc = ancestors.slice();
  let copy: any;
  if (obj === null || typeof obj !== 'object') copy = obj;
  else if (Array.isArray(obj)) {
    copy = [];
    anc.push(obj);
    obj.forEach((p) => copy.push(clone(p, anc)));
  } else {
    copy = {};
    const o = obj as any;
    if (anc.includes(o)) {
      anc.push(o);
      throw new Error(
        `Clone reference to ancestor loop: ${anc
          .map((a) => JSON_stringify(a, 1))
          .join('\n')}`
      );
    }
    anc.push(o);
    Object.entries(o).forEach((entry) => {
      copy[entry[0]] = clone(entry[1], anc);
    });
  }
  return copy as T;
}

// Return a new source object keeping only certain keys from the original.
export function keep<T extends { [key: string]: any }>(
  source: T,
  keepkeys: readonly (keyof T)[]
): Pick<T, typeof keepkeys[number]> {
  const r = {} as any;
  Object.entries(source).forEach((entry) => {
    const [p, v] = entry;
    if (keepkeys.includes(p)) r[p] = v;
  });
  return r as Pick<T, typeof keepkeys[number]>;
}

// Return a new source object dropping certain keys from the original.
export function drop<T extends { [key: string]: any }>(
  source: T,
  dropkeys: readonly (keyof T)[]
): Omit<T, typeof dropkeys[number]> {
  const r = {} as any;
  Object.entries(source).forEach((entry) => {
    const [p, v] = entry;
    if (!dropkeys.includes(p)) r[p] = v;
  });
  return r as Omit<T, typeof dropkeys[number]>;
}

// Compare two PrefValues. It returns only the differences in pv2 compared to pv1,
// or undefined if they share the same value (recursively). If there are descendant
// objects greater than 'depth' recursion, properties are compared exhaustively but
// entire pv2 descendant objects are returned when there are differences in any child
// property. Depth is 1 by default because React setState performs shallow merging
// with existing state, meaning a partial state object would overwrite a complete one,
// resulting in unexpected states.
export function diff<T>(pv1: any, pv2: T, depth = 1): Partial<T> | undefined {
  let difference: Partial<T> | undefined;
  // Primatives
  if (
    pv1 === null ||
    pv2 === null ||
    typeof pv1 !== 'object' ||
    typeof pv2 !== 'object'
  ) {
    if (pv1 !== pv2) difference = pv2;
  } else if (Array.isArray(pv2)) {
    // Arrays
    if (
      !Array.isArray(pv1) ||
      pv1.length !== pv2.length ||
      pv2.some((v, i) => {
        return diff(pv1[i], v, depth - 1) !== undefined;
      })
    ) {
      difference = pv2;
    }
  } else if (Object.keys(pv2).length === 0) {
    if (Object.keys(pv1).length !== 0) difference = {};
  } else {
    // Data objects
    const obj1 = pv1 as PrefObject;
    const obj2 = pv2 as PrefObject;
    Object.entries(obj2).forEach((entry2) => {
      const [k2, v2] = entry2;
      if (!(k2 in obj1)) {
        if (!difference) difference = {};
        (difference as any)[k2] = v2;
      } else {
        const diff2 = diff(obj1[k2], v2, depth - 1);
        if (diff2 !== undefined) {
          if (!difference) difference = {};
          (difference as any)[k2] = diff2;
        }
      }
    });
    if (depth < 1) {
      Object.keys(obj1).forEach((k1) => {
        if (!(k1 in obj2) && !difference) difference = {};
      });
      if (difference) difference = obj2 as T;
    }
  }
  return difference;
}

// Apply a function to every PrefValue of a prefObject, recursively,
// returning a new prefObject containing the mapped results.
export function mapp(
  obj: PrefObject,
  func: (key: string, val: PrefValue) => PrefValue,
  workKey?: string
): PrefObject {
  const workObj = {} as PrefObject;
  Object.entries(obj).forEach((entry) => {
    const [k, v] = entry;
    const key = workKey ? [workKey, k].join('.') : k;
    if (v === null || Array.isArray(v) || typeof v !== 'object') {
      workObj[k] = func(key, v);
    } else {
      workObj[k] = mapp(v as PrefObject, func, key);
    }
  });
  return workObj;
}

// Font family names that are css keywords or contain numeric or punctuation
// characters require quotes. But quotes are always allowed. So to normalize,
// all font-family strings will be double quoted.
export function normalizeFontFamily(fontFamily: string): string {
  return `"${fontFamily.replace(/^['"](.*)['"]$/, '$1')}"`;
}

// Strings beginning with 'i18n:' are intended for possible localization. The
// branding namespace is checked first, followed by xulsword. If there is no
// localization, the key is returned with 'i18n:' prefix removed.
export function localizeString(i18n: GType['i18n'], str: string): string {
  if (str.startsWith('i18n:')) {
    const ans = ['branding', 'xulsword'].find((ns) =>
      i18n.exists(str.substring(5), { ns })
    );
    if (ans) return i18n.t(str.substring(5), { ns: ans });
    return str.substring(5);
  }
  return str;
}

// Resolve a xulsword:// file path into an absolute local file path.
export function resolveXulswordPath(
  DirsPath: GType['Dirs']['path'],
  path: string
): string {
  if (path.startsWith('xulsword://')) {
    const dirs = path.substring('xulsword://'.length).split('/');
    if (dirs[0] && dirs[0] in DirsPath) {
      dirs[0] = DirsPath[dirs[0] as keyof typeof DirsPath];
      return dirs.join('/');
    }
    throw new Error(`Unrecognized xulsword path: ${dirs[0]}`);
  }
  return path;
}

// Built-in local repositories cannot be disabled, deleted or changed.
// Implemented as a function to allow G.i18n to initialize.
export function builtinRepos(
  i18n: GType['i18n'],
  DirsPath: GType['Dirs']['path']
): Repository[] {
  const birs = clone(C.SwordBultinRepositories);
  birs.forEach((r) => {
    r.name = localizeString(i18n, r.name);
    r.path = resolveXulswordPath(DirsPath, r.path);
  });
  return birs;
}

export function prefType(
  pval: PrefValue
): 'string' | 'number' | 'boolean' | 'complex' {
  let t = typeof pval;
  if (t === 'bigint') t = 'number';
  return ['string', 'number', 'boolean'].includes(t)
    ? (t as 'string' | 'number' | 'boolean')
    : 'complex';
}

// Return values of key/value pairs of component state Prefs. Component
// state Prefs are permanently persisted component state values recorded in
// a json preference file.
export function getStatePref(
  prefs: GType['Prefs'],
  store: PrefStoreType,
  id: string | null,
  defaultPrefs?: PrefObject // default is all
): PrefObject {
  const state = {} as PrefObject;
  const sdef = store in S ? (S as any)[store] : null;
  if (defaultPrefs || sdef) {
    if (id) {
      Object.entries(defaultPrefs || sdef[id]).forEach((entry) => {
        const [key, value] = entry;
        state[key] = prefs.getPrefOrCreate(
          `${id}.${String(key)}`,
          prefType(value as PrefValue),
          value as PrefValue,
          store
        );
      });
    } else {
      Object.entries(defaultPrefs || sdef).forEach((entry) => {
        const [sid, value] = entry;
        state[sid] = prefs.getPrefOrCreate(
          sid,
          prefType(value as PrefValue),
          value as PrefValue,
          store
        );
      });
    }
  }
  return state;
}

// Decode an osisRef that was encoded using _(\d+)_ encoding, where
// special characters are encoded as Unicode char-code numbers with
// an underscore before and after. If the osisRef includes a work
// prefix, it will be left as-is.
export function decodeOSISRef(aRef: string) {
  const re = new RegExp(/_(\d+)_/);
  let work = '';
  let targ = aRef;
  const colon = aRef.indexOf(':');
  if (colon !== -1) {
    work = aRef.substring(0, colon);
    targ = aRef.substring(colon + 1);
  }
  let m = targ.match(re);
  while (m) {
    const r = String.fromCharCode(Number(m[1]));
    targ = targ.replaceAll(m[0], r);
    m = targ.match(re);
  }
  return work ? `${work}:${targ}` : targ;
}

// This function should always be used when writing to innerHTML.
// TODO!: Update to improve security.
export function sanitizeHTML<T extends string | HTMLElement>(
  parentOrHtml: T,
  html?: string
): T {
  const sanitize = (s?: string): string => {
    return s || '';
  };
  if (typeof parentOrHtml === 'string') {
    return sanitize(parentOrHtml) as T;
  }
  parentOrHtml.innerHTML = sanitize(html);
  return parentOrHtml;
}

// Return a hash number for a string.
export function stringHashNum(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    hash = (hash << 5) - hash + code;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// Return a hash string for any number of arguments of any type.
// Object property order is inconsequential, everything else is.
export function stringHash(...args: any): string {
  const r: string[] = [];
  args.forEach((arg: any) => {
    if (arg === null) r.push('null');
    else if (arg === undefined) r.push('undefined');
    else if (typeof arg !== 'object') {
      r.push(`${arg}`);
    } else {
      Object.entries(arg)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach((entry) => {
          const [p, v] = entry;
          if (typeof v !== 'object') {
            r.push(`${p}:${v}`);
          } else {
            r.push(`${p}:${stringHash(v)}`);
          }
        });
    }
  });

  const num = stringHashNum(r.join('y'));

  return `x${num < 0 ? 'm' : ''}${Math.abs(num)}`;
}

export function randomID(): string {
  return Math.random().toString(36).replace('0.', 'x');
}

export type HTMLElementSearchModes =
  | 'self'
  | 'ancestor'
  | 'ancestor-or-self'
  | 'descendant'
  | 'descendant-or-self';

export function findElements(
  start: HTMLElement,
  mode: HTMLElementSearchModes,
  testFunc: (elem: HTMLElement) => boolean,
  onlyFirst: false
): HTMLElement[];

export function findElements(
  start: HTMLElement,
  mode: HTMLElementSearchModes,
  testFunc: (elem: HTMLElement) => boolean,
  onlyFirst: true
): HTMLElement | null;

export function findElements(
  start: HTMLElement,
  mode: HTMLElementSearchModes,
  testFunc: (elem: HTMLElement) => boolean,
  onlyFirst: true | false
): HTMLElement | null | HTMLElement[] {
  const onlyFirst2 = onlyFirst ?? true;
  const r: HTMLElement[] = [];
  let telem: HTMLElement | undefined = start;
  if (mode !== 'self') {
    while (telem && telem.nodeType === 1) {
      const testElem = telem;
      if (mode.includes('self') && testFunc(testElem)) {
        if (onlyFirst2) return testElem;
        r.push(testElem);
      }
      if (mode.includes('ancestor')) {
        if (testFunc(testElem)) {
          if (onlyFirst2) return testElem;
          r.push(testElem);
        }
        telem = telem.parentNode as HTMLElement | undefined;
      } else {
        const es = Array.from(telem.childNodes)
          .map((chn) => {
            return chn.nodeType === 1
              ? findElements(
                  chn as HTMLElement,
                  'descendant-or-self',
                  testFunc,
                  false
                )
              : [];
          })
          .flat();
        if (onlyFirst2 && es.length) return es[0];
        r.push(...es);
        break;
      }
    }
  } else if (start.nodeType === 1 && testFunc(start)) {
    if (onlyFirst2) return start;
    r.push(start);
  }
  if (onlyFirst2) return r.length ? r[0] : null;
  return r;
}

// Searches an element and its ancestors or descendants, depending on
// chosen mode, looking for particular class-name(s). Default mode is
// ancestor-or-self which searches the element and all its ancestors
// until a match is found. It returns the first element having one of
// the class names and the class name that was found. If none of the
// class names is found, null is returned.
export function ofClass(
  search: string | string[],
  element: HTMLElement | ParentNode | EventTarget | null,
  mode?: HTMLElementSearchModes
): { element: HTMLElement; type: string } | null {
  const amode = mode || 'ancestor-or-self';
  const searchclasses = Array.isArray(search) ? search : [search];
  if (!element || !('classList' in element)) return null;
  const result = findElements(
    element,
    amode,
    (el) => searchclasses.some((x) => el.classList && el.classList.contains(x)),
    true
  );
  if (!result) return null;
  const type =
    (result && searchclasses.find((c) => result.classList.contains(c))) || '';
  if (!type) return null;
  return { element: result, type };
}

// Returns a promise whose state can be queried or can be rejected at will.
export function querablePromise<T>(promise: Promise<T>): QuerablePromise<T> {
  if ('isFulfilled' in promise) return promise as QuerablePromise<T>;
  const result = promise.then(
    (v) => {
      result.isFulfilled = true;
      result.isPending = false;
      return v;
    },
    (e) => {
      result.isRejected = true;
      result.isPending = false;
      throw e;
    }
  ) as QuerablePromise<T>;

  result.isPending = true;
  result.isRejected = false;
  result.isFulfilled = false;

  result.reject = (er: any) => {
    throw er;
  };

  return result;
}

// Replaces character with codes <32 with " " (these may occur in text/footnotes at times- code 30 is used for sure)
export function replaceASCIIcontrolChars(string: string) {
  let ret = string;
  for (let i = 0; i < ret.length; i += 1) {
    const c = ret.charCodeAt(i);
    if (c < 32) ret = `${ret.substring(0, i)} ${ret.substring(i + 1)}`;
  }

  return ret;
}

export function isASCII(text: string) {
  let notASCII = false;
  for (let c = 0; c < text.length; c += 1) {
    if (text.charCodeAt(c) > 128) {
      notASCII = true;
      break;
    }
  }
  return !notASCII;
}

// converts any normal digits in a string or number into localized digits
function getLocalizedNumerals(
  i18n: GType['i18n'],
  locale: string
): string[] | null {
  if (!Cache.has('locnums', locale)) {
    let l = null;
    const toptions = { lng: locale, ns: 'numbers' };
    for (let i = 0; i <= 9; i += 1) {
      const key = `n${i}`;
      if (i18n.exists(key, toptions) && !/^\s*$/.test(i18n.t(key, toptions))) {
        if (l === null) {
          l = [];
          for (let x = 0; x <= 9; x += 1) {
            l.push(x.toString());
          }
        }
        l[i] = i18n.t(key, toptions);
      }
    }
    Cache.write(l, 'locnums', locale);
  }
  return Cache.read('locnums', locale);
}

export function dString(
  i18n: GType['i18n'],
  string: string | number,
  locale?: string
) {
  const loc = locale || i18n.language;
  const l = getLocalizedNumerals(i18n, loc);
  let s = string.toString();
  if (l !== null) {
    for (let i = 0; i <= 9; i += 1) {
      s = s.replaceAll(i.toString(), l[i]);
    }
  }
  return s;
}

// converts any localized digits in a string into ASCII digits
export function iString(
  i18n: GType['i18n'],
  locstring: string | number,
  locale?: string
) {
  const loc = locale || i18n.language;
  const l = getLocalizedNumerals(i18n, loc);
  let s = locstring.toString();
  if (l !== null) {
    for (let i = 0; i <= 9; i += 1) {
      s = s.replaceAll(l[i], i.toString());
    }
  }
  return s;
}

export function getLocalizedChapterTerm(
  i18n: GType['i18n'],
  book: string,
  chapter: number,
  locale: string
) {
  const k1 = `${book}_Chaptext`;
  const k2 = 'Chaptext';
  const toptions = {
    v1: dString(i18n, chapter, locale),
    lng: locale,
    ns: 'books',
  };
  const r1 = i18n.exists(k1, toptions) && i18n.t(k1, toptions);
  return r1 && !/^\s*$/.test(r1) ? r1 : i18n.t(k2, toptions);
}

// Removes white-space, trailing or leading punctuation, "x" (note symbol),
// and leading digits (for verse numbers)
export function cleanDoubleClickSelection(sel: string) {
  let punc = String.fromCharCode(8220); // “
  punc += String.fromCharCode(8221); // ”
  punc += ',!":;\\-\\?\\(\\)';
  const re = new RegExp(`(^[${punc}]+|[${punc}]+$)`, 'g');
  let r = sel.replace(re, '');
  r = sel.replace(/\s+/g, ''); // remove white-space
  r = r.replace(/^\d+/, ''); // remove verse numbers

  return r;
}

// This function returns the FIRST rule matching the selector from the
// given style sheet, or the first of any style sheet if sheet is not
// specified.
export function getCSS(
  selectorStr: string,
  aSheet?: CSSStyleSheet
): { sheet: CSSStyleSheet; rule: CSSRule; index: number } | null {
  const selector = new RegExp(`^${escapeRE(selectorStr)}`);
  const sheets = aSheet ? [aSheet] : Array.from(document.styleSheets);
  let result: { sheet: CSSStyleSheet; rule: CSSRule; index: number } | null =
    null;
  sheets.forEach((sheet) => {
    Array.from(sheet.cssRules).forEach((rule, index) => {
      if (!result && selector.test(rule.cssText)) {
        result = { sheet, rule, index };
      }
    });
  });
  return result;
}

export function pad(
  padMe: string | number,
  len: number,
  char: string | number
): string {
  let r: string = padMe.toString();
  const c = char.toString().substring(0, 1);
  while (r.length < len) r = `${c}${r}`;
  return r;
}

// Modify the given state in place removing any references to viewport
// modules that are not currently installed.
export function validateViewportModulePrefs(
  Tabs: TabType[],
  state: Pick<
    typeof S.prefs.xulsword,
    'panels' | 'ilModules' | 'mtModules' | 'tabs'
  >
) {
  (['panels', 'ilModules', 'mtModules'] as const).forEach((p) => {
    const prop = state[p] as any[];
    state[p] = prop.map((m) => {
      const n = p === 'panels' ? '' : null;
      if (m && !Tabs.find((t) => t.module === m)) return n;
      return m;
    });
  });

  const { tabs } = state;
  tabs.forEach((p, i) => {
    if (p) {
      tabs[i] = p.filter((m) => Tabs.find((t) => t.module === m));
    }
  });
}

export function noAutoSearchIndex(Prefs: GType['Prefs'], module: string) {
  const csai = Prefs.getComplexValue(
    'global.noAutoSearchIndex'
  ) as typeof S.prefs.global.noAutoSearchIndex;
  if (!csai.includes(module)) {
    csai.push(module);
    Prefs.setComplexValue('global.noAutoSearchIndex', csai);
  }
}

// Figure out the relative width of each panel due to adjacent panels
// sharing common module and isPinned settings etc. In such case, the
// first panel of the matching group will widen to take up the whole
// width while the following matching panels will shrink to zero width.
// A value of null is given for null or undefined panels.
export function getPanelWidths(
  xulswordState: Pick<XulswordState, 'panels' | 'ilModules' | 'isPinned'>
): (number | null)[] {
  const { panels, ilModules, isPinned } = xulswordState;
  const panelWidths: (number | null)[] = [];
  for (let i = 0; i < panels.length; i += 1) {
    const panel = panels[i];
    panelWidths[i] = panel !== null && panel !== undefined ? 1 : null;
    if (panel !== null && panel !== undefined) {
      const key = [panel, !!ilModules[i], !!isPinned[i]].join('.');
      let f = i + 1;
      for (;;) {
        if (f === panels.length) break;
        const modulef = panels[f];
        if (
          modulef === null ||
          modulef === undefined ||
          [modulef, !!ilModules[f], !!isPinned[f]].join('.') !== key
        )
          break;
        const panelWidthsx = panelWidths as number[];
        panelWidthsx[i] += 1;
        panelWidths[f] = 0;
        f += 1;
      }
      i += f - i - 1;
    }
  }
  return panelWidths;
}

// Get the 'location' of any panel, or get the first of a particular type
// of location from all panels, or both (returning null if conditions are
// not satisfied).
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType: 'Texts',
  panelIndex?: number
): LocationVKType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType: 'Comms',
  panelIndex?: number
): LocationVKCommType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType: 'Genbks' | 'Dicts',
  panelIndex?: number
): LocationORType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType?: undefined,
  panelIndex?: number
): LocationVKType | LocationVKCommType | LocationORType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType?: TabTypes,
  panelIndex?: number
): LocationVKType | LocationVKCommType | LocationORType | undefined {
  const panels = Prefs.getComplexValue(
    'xulsword.panels'
  ) as typeof S.prefs.xulsword.panels;
  let r: LocationVKType | LocationVKCommType | LocationORType | undefined;
  for (let i = 0; i < panels.length; i += 1) {
    const m = panels[i];
    if (
      m &&
      (panelIndex === undefined || panelIndex === i) &&
      (!tabType || Tab[m].tabType === tabType)
    ) {
      switch (Tab[m].tabType) {
        case 'Texts':
        case 'Comms': {
          const location = Prefs.getComplexValue(
            'xulsword.location'
          ) as typeof S.prefs.xulsword.location;
          if (location && Tab[m].tabType === 'Comms') {
            r = { ...location, commMod: m };
          } else if (location) {
            r = { ...location, vkMod: m };
          }
          return r;
        }
        case 'Genbks':
        case 'Dicts': {
          const keys = Prefs.getComplexValue(
            'xulsword.keys'
          ) as typeof S.prefs.xulsword.keys;
          const key = keys[i];
          if (key) {
            r = { otherMod: m, key };
          }
          return r;
        }
        default:
      }
    }
  }
  return r;
}

// Convert a range-form string array into a number array.
// Ex: ['1-3', '2-4', '7'] => [1,2,3,4,7]
export function audioConfNumbers(strings: string[]): number[] {
  const r: number[] = [];
  strings.forEach((str) => {
    const m = str.match(/^(\d+)-(\d+)$/);
    if (m) {
      const [, f, t] = m;
      for (let x = Number(f); x <= Number(t); x += 1) {
        r.push(x);
      }
    } else if (!Number.isNaN(Number(str))) {
      r.push(Number(str));
    }
  });
  return r.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// Convert long form number or boolean arrays into the short form strings
// for use in human readable or text files.
// Ex: [1,2,3,4,7] => ['1-4', '7'] or [false, true, true, true] => ['1-3']
export function audioConfStrings(chapters: number[] | boolean[]): string[] {
  let nums: number[];
  if (chapters.some((ch) => typeof ch === 'number')) {
    nums = chapters.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as number[];
  } else {
    nums = chapters.map((ch, i) => (ch === true ? i : -1)) as number[];
    nums = nums.filter((ch) => ch !== -1);
  }
  const ranges: [number, number][] = [];
  nums.forEach((n) => {
    if (!ranges.length) ranges.push([n, n]);
    else if (n === ranges[ranges.length - 1][1] + 1) {
      ranges[ranges.length - 1][1] = n;
    } else ranges.push([n, n]);
  });
  return ranges.map((r) => {
    if (r[0] === r[1]) return `${r[0]}`;
    return `${r[0]}-${r[1]}`;
  });
}

// Find the module associated with any location or bookmark item,
// or return null if there is none.
export function getModuleOfObject(
  bookmarkOrLocation:
    | BookmarkItemType
    | LocationTypes[TabTypes]
    | SelectORMType
    | SelectVKType
): string | null {
  let location: LocationTypes[TabTypes] | SelectORMType | SelectVKType;
  if ('type' in bookmarkOrLocation) {
    const { type } = bookmarkOrLocation;
    if (type === 'folder') return null;
    location = bookmarkOrLocation.location;
  } else location = bookmarkOrLocation;
  if ('commMod' in location) return location.commMod;
  if ('v11n' in location) return location.vkMod || null;
  return location.otherMod;
}

export function bookmarkItemIconPath(
  G: GType,
  item: BookmarkTreeNode | BookmarkItemType
): string {
  const { note } = item;
  let fname = 'folder.png';
  if (item.type === 'bookmark') {
    if (note) fname = `${item.tabType}_note.png`;
    else fname = `${item.tabType}.png`;
  }
  return [G.Dirs.path.xsAsset, 'icons', '16x16', fname].join('/');
}

export function findParentOfBookmarkItem(
  toSearch: BookmarkFolderType,
  id: string,
  recurse = true
): BookmarkFolderType | null {
  if (toSearch.id === id) return null;
  for (let x = 0; x < toSearch.childNodes.length; x += 1) {
    const child = toSearch.childNodes[x];
    if (child.id === id) return toSearch;
    if (recurse && 'childNodes' in child) {
      const descendant = findParentOfBookmarkItem(child, id, true);
      if (descendant) return descendant;
    }
  }
  return null;
}

export function findBookmarkItem(
  searchIn: BookmarkFolderType,
  id: string,
  recurse = true
): BookmarkItemType | null {
  if (searchIn.id === id) return searchIn;
  for (let x = 0; x < searchIn.childNodes.length; x += 1) {
    const child = searchIn.childNodes[x];
    if (child.id === id) return child;
    if (recurse && 'childNodes' in child) {
      const descendant = findBookmarkItem(child, id, true);
      if (descendant) return descendant;
    }
  }
  return null;
}

// Returns null if the replacement failed, or returns the new item if successful.
export function replaceBookmarkItem(
  bookmarks: BookmarkFolderType,
  item: BookmarkItemType
): BookmarkItemType | null {
  if (item.id !== S.bookmarks.rootfolder.id) {
    const olditem = findBookmarkItem(bookmarks, item.id);
    if (olditem) {
      const parent = findParentOfBookmarkItem(bookmarks, item.id);
      if (parent) {
        const index = parent.childNodes.findIndex((n) => n.id === item.id);
        if (index !== -1) {
          parent.childNodes.splice(index, 1, item);
          return item;
        }
      }
    }
  }
  return null;
}

export function deleteBookmarkItem(
  bookmarks: BookmarkFolderType,
  itemID: string
): BookmarkItemType | null {
  if (itemID !== S.bookmarks.rootfolder.id) {
    const item = findBookmarkItem(bookmarks, itemID);
    if (item) {
      const parent = findParentOfBookmarkItem(bookmarks, item.id);
      if (parent) {
        const i = parent.childNodes.findIndex((c) => c.id === item.id);
        if (i !== -1) {
          const r = parent.childNodes.splice(i, 1);
          return r[0];
        }
      }
    }
  }
  return null;
}

export function insertBookmarkItem(
  bookmarks: BookmarkFolderType,
  item: BookmarkItemType | null,
  targetID: string
): BookmarkItemType | null {
  if (item && item.id !== S.bookmarks.rootfolder.id) {
    let index = -1;
    const target = findBookmarkItem(bookmarks, targetID);
    if (target) {
      let parent: BookmarkFolderType | null = null;
      if (target.type === 'bookmark') {
        parent = findParentOfBookmarkItem(bookmarks, targetID);
        if (parent) {
          index = parent.childNodes.findIndex((n) => n.id === targetID);
        }
      } else parent = target;
      if (parent) {
        parent.childNodes.splice(index + 1, 0, item);
        return item;
      }
    }
  }
  return null;
}

export function copyBookmarkItem(
  bookmarks: BookmarkFolderType,
  itemID: string
): BookmarkItemType | null {
  if (itemID !== S.bookmarks.rootfolder.id) {
    const copyChildNodes = (childNodes: BookmarkFolderType['childNodes']) => {
      return childNodes.map((n) => {
        const nn = clone(n);
        nn.id = randomID();
        if (nn.type === 'folder') nn.childNodes = copyChildNodes(nn.childNodes);
        return nn;
      });
    };
    const item = findBookmarkItem(bookmarks, itemID);
    if (item) {
      const copy = clone(item);
      copy.id = randomID();
      if (copy.type === 'folder') {
        copy.childNodes = copyChildNodes(copy.childNodes);
      }
      return copy;
    }
  }
  return null;
}

// itemsOrIDs = string[] - REMOVE and INSERT.
// itemsOrIDs = object[] - INSERT new object (which must have unique id to succeed).
export function moveBookmarkItems(
  bookmarks: BookmarkFolderType,
  itemsOrIDs: BookmarkItemType[] | string[],
  targetID: string
): (BookmarkItemType | null)[] {
  const itemsIncludeRoot = itemsOrIDs.some((item: any) => {
    if (typeof item === 'string' && item === S.bookmarks.rootfolder.id) {
      return true;
    }
    if (typeof item !== 'string' && item.id === S.bookmarks.rootfolder.id) {
      return true;
    }
    return false;
  });
  const objectsHaveUniqueIDs = !itemsOrIDs.some(
    (item) => typeof item !== 'string' && findBookmarkItem(bookmarks, item.id)
  );
  const targetNotDescendantOfIDs = !itemsOrIDs.some((id) => {
    if (typeof id === 'string') {
      const item = findBookmarkItem(bookmarks, id);
      if (item) {
        if (item.type === 'bookmark') return false;
        return Boolean(findBookmarkItem(item, targetID));
      }
    } else return false;
    return true;
  });
  if (!itemsIncludeRoot && objectsHaveUniqueIDs && targetNotDescendantOfIDs) {
    return itemsOrIDs.map((itemOrID) => {
      if (typeof itemOrID === 'string' && itemOrID === targetID) {
        return findBookmarkItem(bookmarks, itemOrID);
      }
      return insertBookmarkItem(
        bookmarks,
        typeof itemOrID === 'string'
          ? deleteBookmarkItem(bookmarks, itemOrID)
          : itemOrID,
        targetID
      );
    });
  }
  return [];
}

export function pasteBookmarkItems(
  bookmarks: BookmarkFolderType,
  cut: string[] | null,
  copy: string[] | null,
  targetID: string
): (BookmarkItemType | null)[] {
  const itemsIncludeRoot = (cut || [])
    .concat(copy || [])
    .some((id) => id === S.bookmarks.rootfolder.id);
  if (!itemsIncludeRoot && targetID && (cut || copy)) {
    let pasted: (BookmarkItemType | null)[] = [];
    if (cut) {
      pasted = moveBookmarkItems(bookmarks, cut, targetID);
    } else if (copy) {
      const copiedItems = copy.map((id) => copyBookmarkItem(bookmarks, id));
      if (!copiedItems.includes(null)) {
        pasted = moveBookmarkItems(
          bookmarks,
          copiedItems as BookmarkItemType[],
          targetID
        );
      }
    }
    return pasted;
  }

  return [];
}

export function bookmarkLabel(
  g: GType,
  verseKeyFunc: typeof verseKey,
  l: LocationVKType | LocationVKCommType | LocationORType
): string {
  if ('commMod' in l) {
    const { commMod } = l;
    const vk = verseKeyFunc(l);
    const readable = vk.readable(undefined, true);
    const t = (commMod in g.Tab && g.Tab[commMod]) || null;
    return `${t ? t.label : g.i18n.t('Comms')}: ${readable}`;
  }
  if ('v11n' in l) {
    const vk = verseKeyFunc(l);
    return vk.readable(undefined, true);
  }
  const ks = l.key.split(C.GBKSEP);
  const tab = (l.otherMod && l.otherMod in g.Tab && g.Tab[l.otherMod]) || null;
  ks.unshift(tab?.conf.Description ? tab.conf.Description.locale : l.otherMod);
  while (ks[2] && ks[0] === ks[1]) {
    ks.shift();
  }
  return `${ks.shift()}: ${ks[ks.length - 1]}`;
}

export function forEachBookmarkItem(
  nodes: BookmarkItemType[] | undefined,
  callback: (node: BookmarkItemType) => void
): BookmarkItemType[] {
  if (nodes === undefined) {
    return [];
  }
  nodes.forEach((node) => {
    callback(node);
    if ('childNodes' in node) forEachBookmarkItem(node.childNodes, callback);
  });
  return nodes;
}

// Apply localization to a bookmark (NOT recursive and does NOT add
// sampleText).
export function localizeBookmark(
  G: GType,
  verseKeyFunc: typeof verseKey,
  item: BookmarkItemType
): BookmarkItemType {
  const { label, note } = item;
  const nlabel = localizeString(G.i18n, label);
  if (nlabel !== label) {
    if (nlabel === 'label' && item.type === 'bookmark') {
      const { location } = item;
      item.label = location
        ? bookmarkLabel(G, verseKeyFunc, location)
        : 'label';
    } else {
      item.label = nlabel;
    }
    item.labelLocale = G.i18n.language as 'en';
  }
  const lnote = localizeString(G.i18n, note);
  if (lnote !== note) {
    item.note = lnote;
    item.noteLocale = G.i18n.language as 'en';
  }
  return item;
}

// Recursively apply localization, and optionally add sampleText, to a folder.
export function localizeBookmarks(
  g: GType,
  verseKeyFunc: typeof verseKey,
  folder: BookmarkFolderType,
  getSampleTextFunc?: typeof getSampleText
) {
  localizeBookmark(g, verseKeyFunc, folder);
  forEachBookmarkItem(folder.childNodes, (item) => {
    localizeBookmark(g, verseKeyFunc, item);
    if (
      getSampleTextFunc &&
      item.type === 'bookmark' &&
      !item.sampleText &&
      item.location
    ) {
      item.sampleText = getSampleTextFunc(item.location);
    }
  });
}

// Find the node having the id, or return undefined.
export function findTreeNode(
  searchIn: TreeNodeInfo[],
  id: string | number
): TreeNodeInfo | undefined {
  if (searchIn) {
    for (let x = 0; x < searchIn.length; x += 1) {
      if (searchIn[x].id === id) return searchIn[x];
      const { childNodes } = searchIn[x];
      if (childNodes) {
        const rc = findTreeNode(childNodes, id);
        if (rc) return rc;
      }
    }
  }
  return undefined;
}

// Return ancestor nodes of a non-versekey module key. The returned array is
// ordered from greatest ancestor down to parent. If there is no parent, an
// empty array is returned.
export function gbAncestorIDs(
  id: string | number,
  isDictMod?: boolean // don't split dict mod keys
): string[] {
  let ancestors: string[] = [];
  const r1 = isDictMod ? [id.toString()] : id.toString().split(C.GBKSEP);
  let end = '';
  if (!isDictMod && !r1[r1.length - 1]) {
    r1.pop();
    end = C.GBKSEP;
  }
  ancestors = r1.map((k, i, a) => {
    let fid = k;
    if (!isDictMod) {
      fid = a.slice(0, i + 1).join(C.GBKSEP);
      fid += i === a.length - 1 ? end : C.GBKSEP;
    }
    return fid;
  });
  ancestors.pop();
  return ancestors;
}

export function findTreeAncestors(
  id: string | number,
  nodes: TreeNodeInfo[],
  isDictMod?: boolean // don't split dict mod keys
): { ancestors: TreeNodeInfo[]; self: TreeNodeInfo } {
  const anc = gbAncestorIDs(id, isDictMod).map((ids) =>
    findTreeNode(nodes, ids)
  );
  const slf = findTreeNode(nodes, id);
  if (anc.some((x) => x === undefined) || slf === undefined) {
    throw new Error(`Node not found: '${id}'`);
  }
  return {
    ancestors: anc as TreeNodeInfo[],
    self: slf as TreeNodeInfo,
  };
}

export function findTreeSiblings(
  id: string | number,
  nodes: TreeNodeInfo[]
): TreeNodeInfo[] {
  const { ancestors } = findTreeAncestors(id, nodes);
  if (ancestors.length) {
    const parent = ancestors.pop();
    if (parent?.childNodes) return parent.childNodes;
    throw new Error(`Parent has no children: '${id}'`);
  }
  return nodes;
}

// A leaf node has no childNodes property, or else it is zero length.
export function findFirstLeafNode(
  nodes: TreeNodeInfo[],
  candidates: (string | TreeNodeInfo)[]
): TreeNodeInfo | undefined {
  const candidateNodes = candidates.map((c) => {
    if (typeof c === 'string') {
      if (!nodes)
        throw new Error(
          `'nodes' argument required when candidate is type 'string': '${c}'`
        );
      const n = findTreeNode(nodes, c);
      if (!n) throw new Error(`node does not exist in nodes: '${c}'`);
      return n;
    }
    return c;
  });
  const r = candidateNodes.find(
    (n) => !('childNodes' in n) || n.childNodes?.length === 0
  );
  if (r) return r;
  const rc = candidateNodes
    .map((n) =>
      'childNodes' in n && n.childNodes
        ? findFirstLeafNode(nodes, n.childNodes)
        : null
    )
    .filter(Boolean) as TreeNodeInfo[];
  return rc[0] || candidateNodes[0];
}

// Takes a flat list of general book nodes and arranges them according to
// their hierarchy. IMPORTANT: nodes must be in document order before
// calling this function.
export function hierarchy(nodes: TreeNodeInfo[]): TreeNodeInfo[] {
  const cachekey = nodes.map((n) => n.id).join();
  if (!Cache.has(cachekey)) {
    const r: TreeNodeInfo[] = [];
    for (let x = nodes.length - 1; x > -1; x -= 1) {
      const n = nodes[x];
      const idp = n.id.toString().split(C.GBKSEP);
      if (idp[idp.length - 1] === '') idp.pop();
      idp[idp.length - 1] = '';
      const parent = nodes.find((an) => an.id === idp.join(C.GBKSEP));
      if (parent) {
        if (!('childNodes' in parent)) parent.childNodes = [];
        if (parent.childNodes) parent.childNodes.unshift(n);
      } else r.unshift(n);
    }
    Cache.write(r, cachekey);
  }

  return Cache.read(cachekey);
}

export function dictTreeNodes(
  allDictionaryKeys: string[],
  module?: string
): TreeNodeInfo[] {
  const ckey = `dictTreeNodes.${module}`;
  if (!Cache.has(ckey)) {
    Cache.write(
      allDictionaryKeys.map((id) => {
        const r: TreeNodeInfo = {
          id,
          label: id,
          className: module ? `cs-${module}` : 'cs-LTR_DEFAULT',
          hasCaret: false,
        };
        return r;
      }),
      ckey
    );
  }
  return Cache.read(ckey);
}

// Important: allGbKeys must be output of getGenBookTableOfContents().
export function genBookTreeNodes(
  diskCache: GType['DiskCache'],
  libsword: GType['LibSword'],
  module: string,
  expanded?: boolean
): TreeNodeInfo[] {
  const pkey = 'treenodes';
  if (!diskCache.has(pkey, module)) {
    diskCache.write(
      pkey,
      hierarchy(
        libsword.getGenBookTableOfContents(module).map((gbkey) => {
          const label = gbkey.split(C.GBKSEP);
          if (gbkey.endsWith(C.GBKSEP)) label.pop();
          const n: TreeNodeInfoPref = {
            id: gbkey,
            label: label[label.length - 1],
            className: module ? `cs-${module}` : 'cs-LTR_DEFAULT',
            hasCaret: gbkey.endsWith(C.GBKSEP),
          };
          return n;
        })
      ) as ModulesCache[string]['treenodes'],
      module
    );
  }
  const nodeinfos = diskCache.read(pkey, module) as TreeNodeInfoPref[];
  nodeinfos.forEach((n) => {
    if (expanded !== undefined && 'hasCaret' in n && n.hasCaret)
      n.isExpanded = !!expanded;
  });
  return nodeinfos;
}

export function gbPaths(
  diskCache: GType['DiskCache'],
  libsword: GType['LibSword'],
  gbmod: string
): GenBookAudio {
  const r: GenBookAudio = {};
  function addPath(nodes: TreeNodeInfo[], parentPath?: number[]) {
    const pp = parentPath || [];
    const i = pp.length;
    let n = 0;
    nodes.forEach((node) => {
      const path = pp.slice();
      path[i] = n;
      r[node.id] = path;
      if (node.childNodes) addPath(node.childNodes, path);
      n += 1;
    });
    return nodes;
  }
  addPath(genBookTreeNodes(diskCache, libsword, gbmod));
  return r;
}

export function genBookAudio2TreeNodes(
  audio: GenBookAudioConf,
  module: string
): TreeNodeInfo[] {
  const nodes: TreeNodeInfo[] = [];
  Object.entries(audio).forEach((entry) => {
    const [parentPath, str] = entry;
    parentPath
      .split(C.GBKSEP)
      .filter(Boolean)
      .forEach((s, i, a) => {
        const id = a.slice(0, i + 1).join(C.GBKSEP) + C.GBKSEP;
        if (!nodes.some((n) => n.id === id)) {
          nodes.push({
            id,
            label: s,
            className: module ? `cs-${module}` : 'cs-LTR_DEFAULT',
            hasCaret: true,
          });
        }
      });
    audioConfNumbers(str)
      .map((n) => ({
        id: [parentPath, pad(n, 3, 0)].join(''),
        label: pad(n, 3, 0),
        hasCaret: false,
      }))
      .forEach((n) => {
        if (!nodes.some((n2) => n2.id === n.id)) {
          nodes.push(n);
        }
      });
  });
  return hierarchy(
    nodes.sort((a, b) => a.id.toString().localeCompare(b.id.toString()))
  );
}

export function isAudioVerseKey(
  audio: VerseKeyAudio | GenBookAudioConf
): boolean {
  const books = Object.keys(audio);
  return books.some((bk) =>
    Object.values(C.SupportedBooks).some((bg: any) => bg.includes(bk))
  );
}

export function readVerseKeyAudioConf(audio: VerseKeyAudioConf): VerseKeyAudio {
  const r = {} as VerseKeyAudio;
  Object.entries(audio).forEach((entry) => {
    const [bk, str] = entry;
    if (Object.values(C.SupportedBooks).some((bg: any) => bg.includes(bk))) {
      const book = bk as OSISBookType;
      if (!(book in r)) r[book] = [];
      const rb = r[book];
      if (rb) {
        audioConfNumbers(str).forEach((n) => {
          rb[n] = true;
        });
        for (let i = 0; i < rb.length; i += 1) {
          rb[i] = !!rb[i];
        }
      }
    }
  });
  return r;
}

export function readDeprecatedVerseKeyAudioConf(
  audio: DeprecatedAudioChaptersConf[]
): VerseKeyAudio {
  const r = {} as VerseKeyAudio;
  audio.forEach((entry) => {
    const { bk, ch1, ch2 } = entry;
    if (Object.values(C.SupportedBooks).some((bg: any) => bg.includes(bk))) {
      const book = bk as OSISBookType;
      if (!(book in r)) r[book] = [];
      const rb = r[book];
      if (rb) {
        for (let x = ch1; x <= ch2; x += 1) {
          rb[x] = true;
        }
        for (let i = 0; i < rb.length; i += 1) {
          rb[i] = !!rb[i];
        }
      }
    }
  });
  return r;
}

// The deprecated GenBook audio conf does not consider all levels
// of a module, only the 2nd, and indexing starts with 1. So these
// must be updated to the new scheme.
export function readDeprecatedGenBookAudioConf(
  audio: DeprecatedAudioChaptersConf[]
): GenBookAudioConf {
  const r: GenBookAudioConf = {};
  audio.forEach((entry) => {
    const { bk, ch1, ch2 } = entry;
    const m = bk.match(/^(\d+)(.*?)$/);
    if (m) {
      const bk2 = `000/${pad(Number(m[1]) - 1, 3, 0) + m[2]}/`;
      if (!(bk2 in r)) r[bk2] = [];
      r[bk2].push(`${Number(ch1) - 1}-${Number(ch2) - 1}`);
    }
  });
  Object.values(r).forEach((v) => audioConfStrings(audioConfNumbers(v)));
  return r;
}

export function getDeprecatedVerseKeyAudioConf(
  vkey: SelectVKType
): DeprecatedAudioChaptersConf {
  const { book, chapter, lastchapter } = vkey;
  return { bk: book, ch1: chapter, ch2: lastchapter || chapter };
}

// The deprecated GenBook audio conf does not consider all levels
// of a module, only the 2nd, and indexing starts with 1. So these
// must be updated from the new scheme. IMPORTANT: the gbsel arg
// selection must be a key to GenBookAudioConf and not GenBookAudio.
export function getDeprecatedGenBookAudioConf(
  gbsel: SelectORMType
): DeprecatedAudioChaptersConf {
  const { keys } = gbsel;
  const k = keys[0].split(C.GBKSEP);
  if (!k[k.length - 1]) k.pop(); // remove any leaf dir mark
  k.pop(); // remove leaf
  let bk = k.pop() || '';
  const m = bk.match(/^(\d+)(.*?)$/);
  if (m) bk = pad(Number(m[1]) + 1, 3, 0) + m[2];
  const ch1 = Number(keys[0].split(C.GBKSEP).pop()) + 1;
  const ch2 = Number(keys[keys.length - 1].split(C.GBKSEP).pop()) + 1;
  return { bk, ch1, ch2 };
}

export function subtractVerseKeyAudioChapters(
  audio: VerseKeyAudio,
  subtract: VerseKeyAudio
): VerseKeyAudio {
  const r = clone(audio);
  Object.entries(r).forEach((e) => {
    const [bk] = e;
    const book = bk as OSISBookType;
    const rb = r[book];
    if (bk in subtract) {
      subtract[book]?.forEach((s, i) => {
        if (s && rb) rb[i] = false;
      });
    }
    if (rb && !rb.some((v) => v)) delete r[book];
  });
  return r;
}

// Remove audio files listed in subtract from audio. The parentPath
// matching is not verbatim; only the index numbers are considered.
export function subtractGenBookAudioChapters(
  audio: GenBookAudioConf,
  subtract: GenBookAudioConf
): GenBookAudioConf {
  const r = clone(audio);
  Object.keys(subtract).forEach((subkey) => {
    const subkeys = subkey
      .split(C.GBKSEP)
      .filter(Boolean)
      .map((s) => s.replace(/^(\d+).*?$/, '$1'));
    const audiokey = Object.keys(audio).find((k) => {
      const audiokeys = k
        .split(C.GBKSEP)
        .filter(Boolean)
        .map((s) => s.replace(/^(\d+).*?$/, '$1'));
      return !diff(subkeys, audiokeys);
    });
    if (audiokey) {
      const is = audioConfNumbers(r[audiokey]);
      const st = audioConfNumbers(subtract[subkey]);
      st.forEach((i) => {
        const ix = is.indexOf(i);
        if (ix !== -1) is.splice(ix, 1);
      });
      if (is.length) r[audiokey] = audioConfStrings(is);
      else delete r[audiokey];
    }
  });
  return r;
}

// Compare \d.\d.\d type version numbers (like SWORD modules).
// Returns -1 if v1 < v2, 1 of v1 > v2 and 0 if they are the same.
export function versionCompare(v1: string | number, v2: string | number) {
  const p1 = String(v1).split('.');
  const p2 = String(v2).split('.');
  do {
    let n1: any = p1.shift();
    let n2: any = p2.shift();
    if (!n1) n1 = 0;
    if (!n2) n2 = 0;
    if (Number(n1) && Number(n2)) {
      if (n1 < n2) return -1;
      if (n1 > n2) return 1;
    } else if (n1 < n2) {
      return -1;
    } else if (n1 > n2) {
      return 1;
    }
  } while (p1.length || p2.length);

  return 0;
}

export function isRepoLocal(repo: Repository): boolean {
  return repo.domain === C.Downloader.localfile;
}

export function downloadKey(dl: Download | null): string {
  if (!dl) return '';
  if (dl.type === 'http' && !C.URLRE.test(dl.http))
    throw new Error(`Not downloadable: ${dl.http}`);
  type DLkeys = Exclude<
    keyof HTTPDownload | keyof ModFTPDownload | keyof FTPDownload,
    'disabled'
  >;
  const ms: Record<DLkeys, 1> = {
    type: 1,
    http: 1,
    file: 1,
    module: 1,
    name: 1,
    domain: 1,
    path: 1,
    confname: 1,
    custom: 1,
    builtin: 1,
  };
  const inner = Object.keys(ms)
    .filter((m) => m in dl && dl[m as keyof typeof dl])
    .map((m) => `${m}:${dl[m as keyof typeof dl]}`)
    .join('][');
  return `[${inner}]`;
}

// Return a Download object from a download key. NOTE: The 'disabled'
// property will not be restored (it will be undefined).
export function keyToDownload(downloadkey: string): Download {
  const dl: any = {};
  downloadkey
    .substring(1, downloadkey.length - 1)
    .split('][')
    .forEach((x) => {
      const i = x.indexOf(':');
      dl[x.substring(0, i)] = x.substring(i + 1);
    });
  return dl as Download;
}

// Unique string signature of a particular repository.
export function repositoryKey(r: Repository): string {
  return `[${[r.name, r.domain, r.path].join('][')}]`;
}

// Unique string signature of a particular module in a particular repository.
export function repositoryModuleKey(conf: SwordConfType): string {
  const { module, sourceRepository: r, DataPath } = conf;
  let str = `[${[r.name, r.domain, r.path, module].join('][')}]`;
  // XSM files may have multiple config files for the same module, differentiated
  // only by DataPath.
  if (conf.xsmType === 'XSM') str += `[${DataPath}]`;
  return str;
}

// Convert a Blueprint.js Region selection to a list of table data rows.
export function selectionToTableRows(regions: Region[]): number[] {
  const sels: Set<number> = new Set();
  regions?.forEach((region) => {
    if (region.rows) {
      for (let r = region.rows[0]; r <= region.rows[1]; r += 1) {
        sels.add(r);
      }
    }
  });
  return Array.from(sels).sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
}

// Convert a list of table data rows to a Blueprint.js Region.
export function tableRowsToSelection(rows: number[]): RowSelection {
  const unique = new Set(rows);
  const sorted = Array.from(unique).sort((a: number, b: number) =>
    a > b ? 1 : a < b ? -1 : 0
  );
  const selection: RowSelection = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const s = sorted[i];
    if (s > -1) {
      let e = sorted[i];
      while (sorted[i + 1] === e + 1) {
        i += 1;
        e = sorted[i];
      }
      selection.push({ rows: [s, e] });
    }
  }
  return selection;
}

// Return a new selection after toggling a data row, by adding or
// subtracting from the current selection as appropriate. If the ctrl
// or shift key is pressed, the current selection will be handled
// accordingly.
export function tableSelectDataRows(
  toggleDataRow: number,
  selectedDataRows: number[],
  e: React.MouseEvent
): number[] {
  const selectedRows = Array.from(new Set(selectedDataRows));
  selectedRows.sort((a, b) => a - b);
  const toggleSelected = selectedRows.includes(toggleDataRow);
  if (selectedRows.length && (e.ctrlKey || e.shiftKey)) {
    // Decide if selecting upwards or downwards
    if (selectedRows[0] > toggleDataRow) {
      // select upwards:
      // Get the first selected row after the clicked row.
      const prev = selectedRows[0];
      const start = e.ctrlKey ? toggleDataRow : prev - 1;
      for (let x = start; x >= toggleDataRow; x -= 1) {
        if (!toggleSelected) selectedRows.push(x);
        else if (selectedRows.includes(x)) {
          selectedRows.splice(selectedRows.indexOf(x), 1);
        }
      }
    } else {
      // select downwards:
      // Get the first selected row before the clicked row.
      const prev = selectedRows.filter((r) => r < toggleDataRow).pop();
      const start = prev === undefined || e.ctrlKey ? toggleDataRow : prev + 1;
      for (let x = start; x <= toggleDataRow; x += 1) {
        if (!toggleSelected) selectedRows.push(x);
        else if (selectedRows.includes(x)) {
          selectedRows.splice(selectedRows.indexOf(x), 1);
        }
      }
    }
    return selectedRows;
  }
  return toggleSelected ? [] : [toggleDataRow];
}

// Append entries of 'b' to 'a'. So 'a' is modified in place, while 'b'
// is untouched.
export function mergeNewModules(a: NewModulesType, b: NewModulesType) {
  Object.entries(b).forEach((entry) => {
    const [kx, v] = entry;
    const k = kx as keyof typeof C.NEWMODS;
    a[k].push(...(v as any[]));
  });
}
