/* eslint-disable import/order */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  HTTPDownload,
  QuerablePromise,
  GType,
  DeprecatedAudioChaptersConf,
  GenBookKeys,
  VerseKeyAudioConf,
  GenBookAudioConf,
  GenBookAudio,
  VerseKeyAudio,
  AudioPath,
  OSISBookType,
} from './type';
import type { TreeNodeInfo } from '@blueprintjs/core';
import type { SelectVKMType } from './renderer/libxul/vkselect';
import type { SelectGBMType } from './renderer/libxul/genbookselect';

// These local repositories cannot be disabled, deleted or changed.
// Implemented as a function to allow G.i18n to initialize.
export function builtinRepos(
  i18n: GType['i18n'],
  DirsPath: GType['Dirs']['path']
): Repository[] {
  return [
    {
      name: i18n.t('shared.label'),
      domain: 'file://',
      path: DirsPath.xsModsCommon,
      builtin: true,
      disabled: false,
      custom: false,
    },
    {
      name: i18n.t('programTitle', { ns: 'branding' }),
      domain: 'file://',
      path: DirsPath.xsModsUser,
      builtin: true,
      disabled: false,
      custom: false,
    },
    {
      name: i18n.t('audio.label'),
      domain: 'file://',
      path: DirsPath.xsAudio,
      builtin: true,
      disabled: false,
      custom: false,
    },
  ];
}

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
// or undefined if they share the same value (recursively). If there are descendant
// objects greater than 'depth' recursion, properties are compared exhaustively but
// entire pv2 descendant objects are returned when there are differences in any child
// property. Depth is 1 by default because React setState performs shallow merging
// with existing state, meaning a partial state object would overwrite a complete one,
// resulting in unexpected states.
export function diff<T extends PrefValue>(
  pv1: T,
  pv2: T,
  depth = 1
): Partial<T> {
  let difference: any;
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
    Object.entries(obj2).forEach((entry2) => {
      const [k2, v2] = entry2;
      if (!(k2 in obj1)) {
        if (!difference) difference = {};
        difference[k2] = v2;
      } else {
        const diff2 = diff(obj1[k2], v2, depth - 1);
        if (diff2 !== undefined) {
          if (!difference) difference = {};
          difference[k2] = diff2;
        }
      }
    });
    if (depth < 1) {
      Object.keys(obj1).forEach((k1) => {
        if (!(k1 in obj2) && !difference) difference = {};
      });
      if (difference) difference = obj2;
    }
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

// Returns a promise whose state can be queried or can be rejected at will.
export function querablePromise<T>(promise: Promise<T>): QuerablePromise<T> {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  if ('isFulfilled' in promise) return promise as QuerablePromise<T>;
  let isPending = true;
  let isRejected = false;
  let isFulfilled = false;

  const result = promise.then(
    (v) => {
      isFulfilled = true;
      isPending = false;
      return v;
    },
    (e) => {
      isRejected = true;
      isPending = false;
      throw e;
    }
  ) as QuerablePromise<T>;

  result.reject = (er: any) => {
    result.reject(er);
  };

  return result;
  /* eslint-enable @typescript-eslint/no-unused-vars */
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

// Takes a flat list of general book nodes and arranges them according to
// their hierarchy. IMPORTANT: nodes must be in document order before
// calling this function.
function hierarchy(nodes: TreeNodeInfo[]): TreeNodeInfo[] {
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

  return r;
}

// Important: allGbKeys must be output of LibSword.getGenBookTableOfContents().
export function genBookTreeNodes(
  allGbKeys: GenBookKeys,
  module?: string,
  expanded?: boolean,
  rootID?: string
): TreeNodeInfo[] {
  return hierarchy(
    allGbKeys.map((gbkey) => {
      const label = gbkey.split(C.GBKSEP);
      if (gbkey.endsWith(C.GBKSEP)) label.pop();
      const n: TreeNodeInfo = {
        id: rootID ? [rootID, gbkey].join(C.GBKSEP) : gbkey,
        label: label[label.length - 1],
        className: module ? `cs-${module}` : 'cs-LTR_DEFAULT',
        hasCaret: gbkey.endsWith(C.GBKSEP),
      };
      if (expanded !== undefined && 'hasCaret' in n && n.hasCaret)
        n.isExpanded = !!expanded;
      return n;
    })
  );
}

// IMPORTANT: To work, this function requires allGbKeys to be the output
// of LibSword.getGenBookTableOfContents() (ie. all keys are included and
// are in the proper order).
export function gbPaths(allGbKeys: string[]): GenBookAudio {
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
  addPath(genBookTreeNodes(allGbKeys));
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

// Returns the files listed in config file as GenBookAudio.
export function readGenBookAudioConf(
  audio: GenBookAudioConf,
  allGbKeysx: string[]
): GenBookAudio {
  const r: GenBookAudio = {};
  const allGbKeys = gbPaths(allGbKeysx);
  Object.entries(audio).forEach((entry) => {
    const [pathx, str] = entry;
    const px = pathx.split('/').filter(Boolean);
    const parentPath: AudioPath = [];
    px.forEach((p, i) => {
      parentPath[i] = Number(p);
    });
    audioConfNumbers(str).forEach((n) => {
      const pp = parentPath.slice() as AudioPath;
      pp.push(n);
      const kx = Object.entries(allGbKeys).find((e) => !diff(pp, e[1]));
      if (kx) r[kx[0]] = pp;
    });
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
  vkey: SelectVKMType
): DeprecatedAudioChaptersConf {
  const { book, chapter, lastchapter } = vkey;
  return { bk: book, ch1: chapter, ch2: lastchapter || chapter };
}

// The deprecated GenBook audio conf does not consider all levels
// of a module, only the 2nd, and indexing starts with 1. So these
// must be updated from the new scheme. IMPORTANT: the gbsel arg
// must be a GenBookAudioConf selection and not a GenBookAudio
// selection.
export function getDeprecatedGenBookAudioConf(
  gbsel: SelectGBMType
): DeprecatedAudioChaptersConf {
  const { parent, children } = gbsel;
  const k = parent.split(C.GBKSEP);
  if (!k[k.length - 1]) k.pop();
  let bk = k.pop() || '';
  const m = bk.match(/^(\d+)(.*?)$/);
  if (m) bk = pad(Number(m[1]) + 1, 3, 0) + m[2];
  const ch1 = Number(children[0].split(C.GBKSEP).pop()) + 1;
  const ch2 = Number(children[children.length - 1].split(C.GBKSEP).pop()) + 1;
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
  if ('http' in dl && !C.URLRE.test(dl.http))
    throw new Error(`Not downloadable: ${dl.http}`);
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

export function tableRowsToSelection(rows: number[]): RowSelection {
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
