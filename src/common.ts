/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-explicit-any */
import i18next from 'i18next';
import C from './constant';
import type { ConfigType } from './type';
import Cache from './cache';

export function escapeRE(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Return a new source object retaining only certain keys from the original.
export function trim(source: any, keepkeys: any, dropInstead = false) {
  const p: any = {};
  const keep = Array.isArray(keepkeys) ? keepkeys : Object.keys(keepkeys);
  if (dropInstead) {
    const drop = keep;
    Object.keys(source).forEach((k) => {
      if (!drop.includes(k)) {
        p[k] = k in source ? source[k] : undefined;
      }
    });
  } else {
    keep.forEach((k) => {
      p[k] = k in source ? source[k] : undefined;
    });
  }
  return p;
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
export function clone(obj: any) {
  let copy: any;
  if (obj === null || typeof obj !== 'object') copy = obj;
  else if (Array.isArray(obj)) copy = obj.slice();
  else {
    copy = {};
    Object.entries(obj).forEach((entry) => {
      copy[entry[0]] = clone(entry[1]);
    });
  }
  return copy;
}

// Compare two data objects. Data objects have string keys with values that are
// either primitives, arrays or other data objects. It returns all differences
// in obj2 compared to obj1, or undefined if they share all the same values
// recursively. Children greater than 'depth' recursion are compared exhaustively
// but returned entirely if different in any way. Depth is 1 by default because
// React setState performs shallow merging with existing state, meaning a partial
// state object would overwrite a complete one, resulting in unexpected states.
export function diff(obj1: any, obj2: any, depth = 1): any {
  let difference: any;
  const level = depth || 0;
  // Primatives
  if (
    obj1 === null ||
    obj2 === null ||
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object'
  ) {
    if (obj1 !== obj2) difference = obj2;
  } else if (Array.isArray(obj2)) {
    // Arrays
    if (
      !Array.isArray(obj1) ||
      obj1.length !== obj2.length ||
      obj2.some((v, i) => {
        return diff(obj1[i], v, depth - 1) !== undefined;
      })
    ) {
      difference = obj2;
    }
  } else {
    // Data objects
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

// Searches an element and its ancestors for particular class-name(s).
// It returns the first element having one of the class-names and the
// class-name that was found. If the element and its ancestors do
// not share any of the class-names, null is returned.
export function ofClass(
  search: string | string[],
  element: HTMLElement,
  selfonly = false
): { element: HTMLElement; type: string } | null {
  let elm = element;
  let typ;
  const s = Array.isArray(search) ? search : [search];
  while (
    !selfonly &&
    elm &&
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    !s.some((x) => elm.classList && elm.classList.contains(x))
  ) {
    elm = elm.parentNode as HTMLElement;
  }
  if (elm && elm.classList) {
    typ = s.find((c) => elm.classList.contains(c));
  }
  return typ ? { element: elm, type: typ } : null;
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

export function createStyleRule(
  selector: string,
  config: Partial<ConfigType>
): string {
  let rule = `${selector} {`;
  Object.entries(C.ConfigTemplate).forEach((entry) => {
    const prop = entry[0] as keyof typeof C.ConfigTemplate;
    const keyobj = entry[1];
    if (keyobj.CSS && config[prop]) {
      rule += `${keyobj.CSS}: ${config[prop]}; `;
    }
  });
  rule += '}';
  return rule;
}
