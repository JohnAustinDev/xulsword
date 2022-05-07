/* eslint-disable import/order */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-explicit-any */
import i18next from 'i18next';
import C from './constant';
import Cache from './cache';

import type { Region } from '@blueprintjs/table';
import type {
  Download,
  PrefObject,
  PrefValue,
  Repository,
  SwordConfType,
  TabType,
} from './type';
import type LocalFile from './main/components/localFile';

export function escapeRE(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Return a new source object keeping only certain keys from the original.
export function keep<T extends { [i: string]: any }>(
  source: T,
  keepkeys: string[] | { [i: string]: any },
  dropInstead = false
): Partial<T> {
  const p: any = {};
  const pkeep = Array.isArray(keepkeys) ? keepkeys : Object.keys(keepkeys);
  if (dropInstead) {
    const pdrop = pkeep;
    Object.keys(source).forEach((k) => {
      if (!pdrop.includes(k)) {
        p[k] = k in source ? source[k] : undefined;
      }
    });
  } else {
    pkeep.forEach((k) => {
      p[k] = k in source ? source[k] : undefined;
    });
  }
  return p;
}

// Return a new source object dropping certain keys from the original.
export function drop<T extends { [i: string]: any }>(
  source: T,
  dropkeys: string[] | { [i: string]: any }
): Partial<T> {
  return keep(source, dropkeys, true);
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

// This function should always be used when writing to innerHTML. It
// may be updated to improve security at some point.
export function sanitizeHTML(parent: HTMLElement, html: string) {
  parent.innerHTML = html;
  return parent;
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

// JSON does not encode Javascript undefined, functions or symbols. So
// what is specially encoded here can be recovered using JSON_parse(string).
// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_stringify(x: any, _func?: null, space?: number): string {
  return JSON.stringify(
    x,
    (_k, v) => {
      return v === undefined ? '_undefined_' : v;
    },
    space
  );
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

// Firefox Add-On validation throws warnings about eval(uneval(obj)), so
// this is an alternate way...
export function deepClone(obj: any) {
  return JSON_parse(JSON_stringify(obj));
}

// Copy a data object. Data objects have string keys with values that are
// either primitives, arrays or other data objects.
export function clone<T extends unknown>(obj: T): T {
  let copy: any;
  if (obj === null || typeof obj !== 'object') copy = obj;
  else if (Array.isArray(obj)) {
    copy = [];
    obj.forEach((p) => copy.push(clone(p)));
  } else {
    copy = {};
    const o = obj as any;
    Object.entries(o).forEach((entry) => {
      copy[entry[0]] = clone(entry[1]);
    });
  }
  return copy;
}

// Compare two PrefValues. It returns only the differences in pv2 compared to pv1,
// or undefined if they share the same value (recursively). If there are children
// greater than 'depth' recursion, they are compared exhaustively but returned entirely
// if different in any way. Depth is 1 by default because React setState performs
// shallow merging with existing state, meaning a partial state object overwrites
// a complete one, resulting in unexpected states.
export function diff<T extends PrefValue>(
  pv1: T,
  pv2: T,
  depth = 1
): Partial<T> {
  let difference: any;
  const level = depth || 0;
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
  } else {
    // Data objects
    const obj1 = pv1 as PrefObject;
    const obj2 = pv2 as PrefObject;
    let different = false;
    Object.entries(obj2).forEach((entry2) => {
      const [k2, v2] = entry2;
      if (!(k2 in obj1)) {
        different = true;
        if (depth > 0) {
          if (!difference) difference = {};
          difference[k2] = v2;
        }
      } else {
        const diff2 = diff(obj1[k2], v2, level - 1);
        if (diff2 !== undefined) {
          different = true;
          if (depth > 0) {
            if (!difference) difference = {};
            difference[k2] = diff2;
          }
        }
      }
    });
    if (different && depth <= 0) difference = obj2;
    if (
      difference === undefined &&
      Object.keys(obj1).length !== Object.keys(obj2).length
    )
      difference = {};
  }
  return difference;
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
  mode?:
    | 'self'
    | 'ancestor'
    | 'ancestor-or-self'
    | 'descendant'
    | 'descendant-or-self'
): { element: HTMLElement; type: string } | null {
  const amode = mode || 'ancestor-or-self';
  const searchclasses = Array.isArray(search) ? search : [search];
  if (!element || !('classList' in element)) return null;
  let elm: HTMLElement | undefined = element;
  let type: string | undefined;
  let searchingself = true;
  if (amode !== 'self') {
    while (elm) {
      const test = elm;
      if (
        (!searchingself || amode.includes('self')) &&
        searchclasses.some((x) => test.classList && test.classList.contains(x))
      ) {
        break;
      }
      searchingself = false;
      if (amode.includes('ancestor')) {
        elm = elm.parentNode as HTMLElement | undefined;
      } else {
        let celm: HTMLElement | undefined;
        elm.childNodes.forEach((chn) => {
          const tst = ofClass(search, chn, 'descendant-or-self');
          if (!celm && tst) celm = tst.element;
        });
        elm = celm;
      }
    }
  }
  const test = elm;
  if (!test) return null;
  if (test && test.classList) {
    type = searchclasses.find((c) => test.classList.contains(c));
  }
  if (!type) return null;
  return { element: test, type };
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
function getLocalizedNumerals(locale: string): string[] | null {
  if (!Cache.has('locnums', locale)) {
    let l = null;
    const toptions = { lng: locale, ns: 'common/numbers' };
    for (let i = 0; i <= 9; i += 1) {
      const key = `n${i}`;
      if (
        i18next.exists(key, toptions) &&
        !/^\s*$/.test(i18next.t(key, toptions))
      ) {
        if (l === null) {
          l = [];
          for (let x = 0; x <= 9; x += 1) {
            l.push(x.toString());
          }
        }
        l[i] = i18next.t(key, toptions);
      }
    }
    Cache.write(l, 'locnums', locale);
  }
  return Cache.read('locnums', locale);
}

export function dString(string: string | number, locale?: string) {
  const loc = locale || i18next.language;
  const l = getLocalizedNumerals(loc);
  let s = string.toString();
  if (l !== null) {
    for (let i = 0; i <= 9; i += 1) {
      s = s.replaceAll(i.toString(), l[i]);
    }
  }
  return s;
}

// converts any localized digits in a string into ASCII digits
export function iString(locstring: string | number, locale?: string) {
  const loc = locale || i18next.language;
  const l = getLocalizedNumerals(loc);
  let s = locstring.toString();
  if (l !== null) {
    for (let i = 0; i <= 9; i += 1) {
      s = s.replaceAll(l[i], i.toString());
    }
  }
  return s;
}

export function getLocalizedChapterTerm(
  book: string,
  chapter: number,
  locale: string
) {
  const k1 = `${book}_Chaptext`;
  const k2 = 'Chaptext';
  const toptions = {
    v1: dString(chapter, locale),
    lng: locale,
    ns: 'common/books',
  };
  const r1 = i18next.exists(k1, toptions) && i18next.t(k1, toptions);
  return r1 && !/^\s*$/.test(r1) ? r1 : i18next.t(k2, toptions);
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

// Sort tabs into the following order:
// - By module type
// - Modules matching the current locale
// - Modules matching any installed locale
// - By label alpha
export function tabSort(a: TabType, b: TabType) {
  if (a.tabType === b.tabType) {
    const aLocale = a.config.AssociatedLocale;
    const bLocale = b.config.AssociatedLocale;
    const lng = i18next.language;
    const aPriority = aLocale ? (aLocale === lng ? 1 : 2) : 3;
    const bPriority = bLocale ? (bLocale === lng ? 1 : 2) : 3;
    if (aPriority !== bPriority) return aPriority > bPriority ? 1 : -1;
    // Type and Priority are same, then sort by label's alpha.
    return a.label > b.label ? 1 : -1;
  }
  const mto = C.UI.Viewport.TabTypeOrder as any;
  return mto[a.tabType] > mto[b.tabType] ? 1 : -1;
}

export function parseSwordConf(config: string | LocalFile): SwordConfType {
  const conf = typeof config === 'string' ? config : config.readFile();
  const errors = [];
  const lines = conf.split(/[\n\r]+/);
  const r = {} as SwordConfType;
  C.SwordConf.repeatable.forEach((en) => {
    r[en] = [];
  });
  const nameRE = /^\[([A-Za-z0-9_]+)\]\s*$/;
  const commentRE = /^(#.*|\s*)$/;
  for (let x = 0; x < lines.length; x += 1) {
    const l = lines[x];
    let m;
    if (commentRE.test(l)) {
      // ignore comments
    } else if (nameRE.test(l)) {
      // name might not be at the top of the file
      m = l.match(nameRE);
      if (m) [, r.module] = m;
    } else {
      m = l.match(/^([A-Za-z0-9_.]+)\s*=\s*(.*?)\s*$/);
      if (m) {
        const entry = m[1] as any;
        let value = m[2] as string;
        const entryBase = entry.substring(0, entry.indexOf('_')) || entry;
        // Handle line continuation.
        if (
          C.SwordConf.continuation.includes(entryBase) &&
          value.endsWith('\\')
        ) {
          const contRE = /[\s*]\\$/;
          let nval = value.replace(contRE, '');
          for (;;) {
            x += 1;
            nval += lines[x];
            if (!nval.endsWith('\\')) break;
            nval = nval.replace(contRE, '');
          }
          value = nval;
        }
        // Check for HTML where it shouldn't be.
        const htmlTags = value.match(/<\w+[^>]*>/g);
        if (htmlTags) {
          if (!C.SwordConf.htmllink.includes(entryBase)) {
            errors.push(`Config entry '${entry}' should not contain HTML.`);
          }
          if (htmlTags.find((t) => !t.match(/<a\s+href="[^"]*"\s*>/))) {
            errors.push(
              `HTML in entry '${entry}' can only be anchor tags with an href attribute.`
            );
          }
        }
        // Check for RTF where it shouldn't be.
        const rtfControlWords = value.match(/\\\w[\w\d]*/);
        if (rtfControlWords) {
          if (!C.SwordConf.rtf.includes(entryBase)) {
            errors.push(
              `Warning: Config entry '${entry}' should not contain RTF.`
            );
          }
        }
        // Save the value according to value type.
        if (entryBase === 'History') {
          const [, version, locale] = entry.split('_');
          if (version) {
            if (!r.History) r.History = [];
            r.History.push([version, { [locale || 'en']: value }]);
          }
        } else if (C.SwordConf.repeatable.includes(entry)) {
          const ent = entry as typeof C.SwordConf.repeatable[number];
          r[ent]?.push(value);
        } else if (C.SwordConf.integer.includes(entry)) {
          const ent = entry as typeof C.SwordConf.integer[number];
          r[ent] = Number(value);
        } else if (C.SwordConf.localization.includes(entryBase)) {
          const ent = entryBase as typeof C.SwordConf.localization[number];
          const loc = entry.substring(entryBase.length + 1) || 'en';
          const obj = r[ent] || {};
          obj[loc] = value;
          r[ent] = obj;
        } else {
          // default is string;
          const rx = r as any;
          rx[entry] = value;
        }
      }
    }
  }
  r.moduleType = 'Generic Books';
  if (r.DataPath.includes('/texts/')) r.moduleType = 'Biblical Texts';
  else if (r.DataPath.includes('/comments/')) r.moduleType = 'Commentaries';
  else if (r.DataPath.includes('/lexdict/'))
    r.moduleType = 'Lexicons / Dictionaries';
  r.errors = errors.map((er) => `${r.module}: ${er}`);
  return r;
}

export function isRepoLocal(repo: Download | Repository): boolean {
  if (Array.isArray(repo)) return repo[1] === C.Downloader.localfile;
  return repo.domain === C.Downloader.localfile;
}

export function downloadKey(dl: Download): string {
  return `[${[dl.name, dl.domain, dl.path, dl.file].join('][')}]`;
}

export function regionsToRows(regions: Region[]): number[] {
  const sels: Set<number> = new Set();
  regions?.forEach((region) => {
    if (region.rows) {
      for (let r = region.rows[0]; r <= region.rows[1]; r += 1) {
        sels.add(r);
      }
    }
  });
  return Array.from(sels).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
