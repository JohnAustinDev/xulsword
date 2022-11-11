/* eslint-disable import/order */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-explicit-any */
import i18n from 'i18next';
import C from './constant';
import Cache from './cache';

import type { Region } from '@blueprintjs/table';
import type {
  Download,
  FTPDownload,
  ModFTPDownload,
  PrefObject,
  PrefValue,
  Repository,
  SwordConfType,
  RowSelection,
  NewModuleReportType,
  HTTPDownload,
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

export function dString(string: string | number, locale?: string) {
  const loc = locale || i18n.language;
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
  const loc = locale || i18n.language;
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

// Return a SwordConfType object from a config LocalFile, or else from
// the string contents of a config file plus the config file's name.
export function parseSwordConf(
  config: string | LocalFile,
  filename: string
): SwordConfType {
  const conf = typeof config === 'string' ? config : config.readFile();
  const reports: NewModuleReportType[] = [];
  const lines = conf.split(/[\n\r]+/);
  const r = { filename } as SwordConfType;
  C.SwordConf.repeatable.forEach((en) => {
    r[en] = [];
  });
  const commentRE = /^(#.*|\s*)$/;
  for (let x = 0; x < lines.length; x += 1) {
    const l = lines[x];
    let m;
    if (commentRE.test(l)) {
      // ignore comments
    } else if (C.SwordModuleStartRE.test(l)) {
      // name might not be at the top of the file
      m = l.match(C.SwordModuleStartRE);
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
          let nval = value.substring(0, value.length - 1);
          for (;;) {
            x += 1;
            nval += lines[x];
            if (!nval.endsWith('\\')) break;
            nval = nval.substring(0, nval.length - 1);
          }
          value = nval;
        }
        // Check for HTML where it shouldn't be.
        const htmlTags = value.match(/<\w+[^>]*>/g);
        if (htmlTags) {
          if (!C.SwordConf.htmllink.includes(entryBase)) {
            reports.push({
              warning: `Config entry '${entry}' should not contain HTML.`,
            });
          }
          if (htmlTags.find((t) => !t.match(/<a\s+href="[^"]*"\s*>/))) {
            reports.push({
              warning: `HTML in entry '${entry}' should be limited to anchor tags with an href attribute.`,
            });
          }
        }
        // Check for RTF where it shouldn't be.
        const rtfControlWords = value.match(/\\\w[\w\d]*/);
        if (rtfControlWords) {
          if (!C.SwordConf.rtf.includes(entryBase)) {
            reports.push({
              warning: `Config entry '${entry}' should not contain RTF.`,
            });
          }
        }
        // Save the value according to value type.
        if (entryBase === 'History') {
          const [, version, locale] = entry.split('_');
          const loc = locale || 'en';
          if (version) {
            if (!r.History) r.History = [];
            const eold = r.History.find((y) => y[0] === version);
            const enew = eold || [version as string, {}];
            enew[1][loc || 'en'] = value;
            if (loc === i18n.language || (loc === 'en' && !enew[1].locale))
              enew[1].locale = value;
            if (!eold) r.History.push(enew);
          }
        } else if (entryBase === 'AudioChapters') {
          r.AudioChapters = JSON_parse(value);
        } else if (Object.keys(C.SwordConf.delimited).includes(entry)) {
          const ent = entry as keyof typeof C.SwordConf.delimited;
          r[ent] = value.split(C.SwordConf.delimited[ent]);
        } else if (C.SwordConf.repeatable.includes(entry)) {
          const ent = entry as typeof C.SwordConf.repeatable[number];
          r[ent]?.push(value);
        } else if (C.SwordConf.integer.includes(entry)) {
          const ent = entry as typeof C.SwordConf.integer[number];
          r[ent] = Number(value);
        } else if (C.SwordConf.localization.includes(entryBase)) {
          const ent = entryBase as typeof C.SwordConf.localization[number];
          const loc = entry.substring(entryBase.length + 1) || 'en';
          if (!(ent in r)) r[ent] = {};
          const o = r[ent];
          if (o) {
            o[loc] = value;
            if (loc === i18n.language || (loc === 'en' && !o.locale))
              o.locale = value;
          }
        } else {
          // default is string;
          const rx = r as any;
          rx[entry] = value;
        }
      }
    }
  }
  r.xsmType = 'none';
  if ((r.ModDrv as any) === 'audio') r.xsmType = 'XSM_audio';
  else if (r.DataPath.endsWith('.xsm')) r.xsmType = 'XSM';
  r.moduleType = 'Generic Books';
  if (r.ModDrv.includes('Text')) r.moduleType = 'Biblical Texts';
  else if (r.ModDrv.includes('Com')) r.moduleType = 'Commentaries';
  else if (r.ModDrv.includes('LD')) r.moduleType = 'Lexicons / Dictionaries';
  r.reports = reports.map((rp) => {
    const nr: any = {};
    Object.entries(rp).forEach((entry) => {
      nr[entry[0]] = `${r.module}: ${entry[1]}`;
    });
    return nr;
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
  if ('http' in dl && !C.URLRE.test(dl.http))
    throw new Error(`Not downloadable: ${dl}`);
  const ms: (keyof HTTPDownload | keyof ModFTPDownload | keyof FTPDownload)[] =
    ['http', 'name', 'domain', 'path', 'file', 'module', 'confname'];
  const msx = ms as (keyof Download)[];
  return msx
    .filter((m) => m in dl && dl[m])
    .map((m) => `${m}:${dl[m]}`)
    .join('][');
}

export function keyToDownload(downloadkey: string): Download {
  const dl: any = {};
  downloadkey.split('][').forEach((x) => {
    const i = x.indexOf(':');
    dl[x.substring(0, i)] = x.substring(i + 1);
  });
  return dl as Download;
}

export function repositoryKey(r: Repository): string {
  return `[${[r.name, r.domain, r.path].join('][')}]`;
}

export function modrepKey(module: string, r: Repository): string {
  return `[${[r.name, r.domain, r.path, module].join('][')}]`;
}

export function selectionToRows(regions: Region[]): number[] {
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

export function rowsToSelection(rows: number[]): RowSelection {
  const unique = new Set(rows);
  const sorted = Array.from(unique).sort((a: number, b: number) =>
    a > b ? 1 : a < b ? -1 : 0
  );
  const selection: RowSelection = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const s = sorted[i];
    let e = sorted[i];
    while (sorted[i + 1] === e + 1) {
      i += 1;
      e = sorted[i];
    }
    selection.push({ rows: [s, e] });
  }
  return selection;
}
