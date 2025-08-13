/* eslint-disable no-control-regex */
import DOMPurify from 'dompurify';
import C from './constant.ts';
import S, { completePanelPrefDefaultArrays } from './defaultPrefs.ts';
import Cache from './cache.ts';

import type { Logger } from 'electron-log';
import type { TreeNodeInfo } from '@blueprintjs/core';
import type { Region } from '@blueprintjs/table';
import type {
  GBuilder,
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
  LocationVKType,
  LocationVKCommType,
  LocationTypes,
  GCallType,
  SwordFilterType,
  SwordFilterValueType,
  ModTypes,
  ShowType,
  PrefRoot,
  AudioPlayerSelectionVK,
  AudioPlayerSelectionGB,
  GTypeMain,
  GIType,
  GITypeMain,
} from './type.ts';
import type { PrefsGType } from './prefs.ts';
import type { SelectVKType } from './clients/components/libxul/selectVK.tsx';
import type { SelectORMType } from './clients/components/libxul/selectOR.tsx';
import type { getSampleText } from './clients/bookmarks.ts';
import type verseKey from './clients/verseKey.ts';
import type { XulswordState } from './clients/components/xulsword/xulsword.tsx';
import type { BibleBrowserControllerGlobal } from './clients/webapp/bibleBrowser/bibleBrowser.tsx';
import type Window from './servers/app/components/window.ts';

// This file contains functions that are used in common with both xulsword
// clients and servers.

// This function may only be called in Electron and cannot be called before G
// has been created and cached, so G should be imported as early as possible.
function G(): GType | GTypeMain {
  if (Build.isElectronApp) {
    if (Cache.has('GType')) return Cache.read('GType') as GType;
    if (Cache.has('GTypeMain')) return Cache.read('GTypeMain') as GTypeMain;
    throw new Error(`G was requested before it was cached.`);
  }
  throw new Error(`Cache G may only be used by Electron.`);
}

// This function cannot be called before GI has been created and cached, so GI
// should be imported as early as possible.
function GI(): GIType | GITypeMain {
  if (Cache.has('GIType')) return Cache.read('GIType') as GIType;
  if (Cache.has('GITypeMain')) return Cache.read('GITypeMain') as GITypeMain;
  throw new Error(`GI was requested before it was cached.`);
}

export function isCallCacheable(
  gBuilder: typeof GBuilder,
  call: GCallType,
): boolean {
  let cacheable = true;
  const [name, method, args] = call;
  if (Array.isArray(args)) {
    const gb = gBuilder as any;
    cacheable = method ? gb[name][method]() : gb[name]();
  }
  return cacheable;
}

export function escapeRE(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// JSON does not encode Javascript undefined, functions or symbols. So
// what is specially encoded here can be recovered using JSON_parse(string).
// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_stringify(
  x: any,
  space?: number,
  maxlen?: number,
): string {
  const str = JSON.stringify(
    x,
    (_k, v) => {
      return v === undefined ? '_undefined_' : v;
    },
    space,
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
export function JSON_parse(
  s: string,
  varAnyx?: Exclude<unknown, undefined>,
): unknown {
  let varAny;
  try {
    varAny = varAnyx !== undefined ? varAnyx : JSON.parse(s);
  } catch (er) {
    varAny = undefined;
  }
  if (varAny === undefined || varAny === null) return varAny;
  if (varAny && typeof varAny === 'object') {
    Object.entries(varAny as Record<string, unknown>).forEach((entry) => {
      const [k, v] = entry;
      varAny[k] = v === '_undefined_' ? undefined : JSON_parse('', v);
    });
  }
  return varAny;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_attrib_stringify(
  x: any,
  space?: number,
  maxlen?: number,
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
      `Exceeded maximum JSON attribute string length of ${maxlen}`,
    );
  }
  return str;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function JSON_attrib_parse(
  s: string,
  anyx?: Exclude<any, undefined>,
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
export function clone<T extends PrefValue>(
  obj: T,
  ancestors: unknown[] = [],
  includeAny = false,
): T {
  const anc = ancestors.slice();
  let copy: any;
  if (typeof obj !== 'function' && typeof obj !== 'symbol') {
    if (obj === null || typeof obj !== 'object') copy = obj;
    else if (Array.isArray(obj)) {
      copy = [];
      anc.push(obj);
      obj.forEach((p) => copy.push(clone(p, anc, includeAny)));
    } else {
      copy = {};
      const o = obj as Record<string, unknown>;
      if (anc.includes(o)) {
        anc.push(o);
        throw new Error(
          `Clone reference to ancestor loop: ${anc
            .map((a) => JSON_stringify(a, 1))
            .join('\n')}`,
        );
      }
      anc.push(o);
      Object.entries(o).forEach((entry) => {
        const [k, v] = entry;
        if (typeof v !== 'function' && typeof v !== 'symbol') {
          copy[k] = clone(v as PrefValue, anc, includeAny);
        } else if (includeAny) {
          copy[k] = v;
        } else {
          throw new Error(
            `clone(): property ${k} is not a PrefValue ${typeof v} `,
          );
        }
      });
    }
  } else if (includeAny) {
    return obj;
  } else throw new Error(`clone(): not a PrefValue ${typeof obj} `);
  return copy as T;
}

export function cloneAny<T>(obj: T): T {
  return clone(obj as any, [], true) as T;
}

// Return a new source object keeping only certain keys from the original.
export function keep<T extends Record<string, any>>(
  source: T,
  keepkeys: ReadonlyArray<keyof T>,
): Pick<T, (typeof keepkeys)[number]> {
  const r = {} as any;
  Object.entries(source).forEach((entry) => {
    const [p, v] = entry;
    if (keepkeys.includes(p)) r[p] = v;
  });
  return r as Pick<T, (typeof keepkeys)[number]>;
}

// Return a new source object dropping certain keys from the original.
export function drop<T extends Record<string, any>>(
  source: T,
  dropkeys: ReadonlyArray<keyof T>,
): Omit<T, (typeof dropkeys)[number]> {
  const r = {} as any;
  Object.entries(source).forEach((entry) => {
    const [p, v] = entry;
    if (!dropkeys.includes(p)) r[p] = v;
  });
  return r as Omit<T, (typeof dropkeys)[number]>;
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
      difference = clone(pv2);
    }
  } else if (Object.keys(pv2).length === 0) {
    if (
      typeof pv1 === 'object' &&
      Object.keys(pv1 as Record<string, unknown>).length !== 0
    )
      difference = {};
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
      if (difference) difference = clone(obj2) as T;
    }
  }
  return difference;
}

export function drupalSetting(dotkey: string) {
  const win = window as any;
  const parentWin = frameElement?.ownerDocument?.defaultView as any;
  let setting: any;
  if ('drupalSettings' in win) {
    setting = win.drupalSettings;
    dotkey.split('.').forEach((k) => {
      if (k && setting && k in setting) setting = setting[k];
      else setting = undefined;
    });
  }
  if (!setting && parentWin && 'drupalSettings' in parentWin) {
    setting = parentWin.drupalSettings;
    dotkey.split('.').forEach((k) => {
      if (k && setting && k in setting) setting = setting[k];
      else setting = undefined;
    });
  }

  return setting;
}

// Return a reason message if data is invalid, or null if it is valid.
export function isInvalidWebAppData(
  data: unknown,
  depth = 0,
  log?: Logger,
): string | null {
  if (C.LogLevel === 'silly' && depth === 0 && log) testData(data, log);

  if (depth > C.Server.maxDataRecursion) {
    return `Argument max recursion exceeded. [was ${depth}]`;
  }
  if (['function', 'symbol'].includes(typeof data)) {
    return `Argument improper type. [was ${typeof data}]`;
  }
  if (typeof data === 'string') {
    if (data.length > C.Server.maxDataStringLength) {
      return `Argument string too long. [was ${data.length}]`;
    }
  } else if (Array.isArray(data)) {
    if (data.length > C.Server.maxDataArrayLength) {
      return `Argument array too long. [was ${data.length}]`;
    }
    const d = data.find((v) => isInvalidWebAppData(v, depth + 1) !== null);
    if (d !== undefined) return isInvalidWebAppData(d, depth + 1);
  } else if (data && typeof data === 'object') {
    if (Object.keys(data).length > C.Server.maxDataObjectKeys) {
      return `Argument object had too many keys. [was ${Object.keys(data).length}]`;
    }
    const d = Object.values(data).find(
      (v) => isInvalidWebAppData(v, depth + 1) !== null,
    );
    if (d !== undefined) return isInvalidWebAppData(d, depth + 1);
  }
  return null;
}

// This is used just to report data packet sizes and is only called during debug.
export function testData(
  data: unknown,
  log: Logger,
  depth = 0,
  info = {
    maxDataRecursion: 0,
    maxDataStringLength: 0,
    maxDataArrayLength: 0,
    maxDataObjectKeys: 0,
    serializedLength: 0,
  },
) {
  const {
    maxDataRecursion: rec,
    maxDataStringLength: stl,
    maxDataArrayLength: dal,
    maxDataObjectKeys: dok,
  } = info;
  if (depth > rec) info.maxDataRecursion = depth;
  if (typeof data === 'string') {
    if (data.length > stl) info.maxDataStringLength = data.length;
  } else if (Array.isArray(data)) {
    if (data.length > dal) info.maxDataArrayLength = data.length;
    data.forEach((v) => testData(v, log, depth + 1, info));
  } else if (data && typeof data === 'object') {
    if (Object.keys(data).length > dok) {
      info.maxDataObjectKeys = Object.keys(data).length;
    }
    Object.values(data).forEach((v) => testData(v, log, depth + 1, info));
  }
  info.serializedLength += JSON_stringify(data).length;
  if (depth === 0) log.debug(`Packet info: ${JSON_stringify(info)}`);
  return info;
}

// Convert PrefValue number-strings to numbers recursively.
export function strings2Numbers(x: unknown): unknown {
  if (typeof x === 'string' && !Number.isNaN(Number(x))) {
    return Number(x);
  } else if (Array.isArray(x)) {
    return x.map((y) => strings2Numbers(y));
  } else if (x && typeof x === 'object') {
    const z: any = {};
    Object.entries(x).forEach((entry) => {
      const [p, v] = entry;
      z[p] = strings2Numbers(v);
    });
    return z;
  }
  return x;
}

// Apply a function to every PrefValue of a prefObject, recursively,
// returning a new prefObject containing the mapped results.
export function mapp(
  obj: PrefObject,
  func: (key: string, val: PrefValue) => PrefValue,
  workKey?: string,
): PrefObject {
  const workObj: PrefObject = {};
  Object.entries(obj).forEach((entry) => {
    const [k, v] = entry;
    const key = workKey ? [workKey, k].join('.') : k;
    if (v === null || Array.isArray(v) || typeof v !== 'object') {
      workObj[k] = func(key, v);
    } else {
      workObj[k] = mapp(v, func, key);
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
export function localizeString(
  GorI: GType | GType['i18n'],
  str: string,
): string {
  const i18n = 'i18n' in GorI ? GorI.i18n : GorI;
  if (str.startsWith('i18n:')) {
    const ans = ['branding', 'xulsword'].find((ns) =>
      i18n.exists(str.substring(5), { ns }),
    );
    if (ans) return i18n.t(str.substring(5), { ns: ans });
    return str.substring(5);
  }
  return str;
}

// Resolve a xulsword:// file path into an absolute local file path.
export function resolveXulswordPath(
  DirsPath: GType['Dirs']['path'],
  path: string,
): string {
  if (path.startsWith('xulsword://')) {
    const dirs = path.substring('xulsword://'.length).split(/[/\\]/);
    if (dirs[0] && dirs[0] in DirsPath) {
      dirs[0] = DirsPath[dirs[0] as keyof typeof DirsPath];
      return dirs.join(C.FSSEP);
    }
    throw new Error(`Unrecognized xulsword path: ${dirs[0]}`);
  }
  return path;
}

export function prefType(
  pval: PrefValue,
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
  defaultPrefs?: PrefObject, // default is all
): PrefObject {
  const state: PrefObject = {};
  const sdef = store in S ? (S as any)[store] : null;
  const p1 = defaultPrefs || (sdef as Record<string, unknown>);
  if (p1) {
    const p2 = defaultPrefs || ((id && sdef[id]) as Record<string, unknown>);
    if (id && p2) {
      Object.entries(p2).forEach((entry) => {
        const [key, value] = entry;
        state[key] = prefs.getPrefOrCreate(
          `${id}.${String(key)}`,
          prefType(value as PrefValue),
          value as PrefValue,
          store,
        );
      });
    } else {
      Object.entries(p1).forEach((entry) => {
        const [sid, value] = entry;
        state[sid] = prefs.getPrefOrCreate(
          sid,
          prefType(value as PrefValue),
          value as PrefValue,
          store,
        );
      });
    }
  }
  return state;
}

// An inline data URL is limited to about 2MB. The solution is convert the data to
// a blob. The blob can then be used with URL.createObjectURL() which can be > 200MB.
export function b64toBlob(b64Data: string, contentType = '', sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
}

// Decode an osisRef that was encoded using _(\d+)_ encoding, where
// special characters are encoded as Unicode char-code numbers with
// an underscore before and after. If the osisRef includes a work
// prefix, it will be left as-is.
export function decodeOSISRef(aRef: string) {
  const re = /_(\d+)_/;
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

// Encode strings to be used as file or directory names, because NTFS does not
// allow certain characters in file names. Encoded file names must be decoded
// using decodeURIComonent() to retrieve their original value (useful when
// writing/reading genbk paths to/from the file system).
export function encodeWindowsNTFSPath(filename: string, passSlash: boolean) {
  // This includes: < > : " / \ | ? * and control characters (0-31).
  const invalidCharsRegex = passSlash
    ? /[<>:"|?*\x00-\x1F]/g
    : /[<>:"|?*\x00-\x1F\\/]/g;
  return filename.replace(invalidCharsRegex, (char) => {
    const codePoint = char.charCodeAt(0);
    const hex = codePoint.toString(16).toUpperCase().padStart(2, '0');
    return `%${hex}`;
  });
}

// This function should always be used when writing to innerHTML.
export function sanitizeHTML<T extends string | HTMLElement>(
  parentOrHtml: T,
  html?: string,
): T {
  const sanitize = (s?: string): string => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return DOMPurify.sanitize(s || '', { USE_PROFILES: { html: true } });
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
export function stringHash(...args: unknown[]): string {
  const r: string[] = [];
  args.forEach((arg: any) => {
    if (arg === null) r.push('null');
    else if (arg === undefined) r.push('undefined');
    else if (typeof arg !== 'object') {
      r.push(`${arg}`);
    } else {
      Object.entries(arg as Record<string, string | Record<string, unknown>>)
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

export function GCacheKey(acall: GCallType): string {
  const [name, m, args] = acall;
  if (
    m === null &&
    (typeof args === 'undefined' || (Build.isServer && args === null))
  ) {
    return `G.${name}`;
  } else if (m === null && Array.isArray(args)) {
    return `G.${name}(${stringHash(...(args as unknown[]))})`;
  } else if (
    typeof m === 'string' &&
    (typeof args === 'undefined' || (Build.isServer && args === null))
  ) {
    return `G.${name}.${m}`;
  } else if (typeof m === 'string' && Array.isArray(args)) {
    return `G.${name}.${m}(${stringHash(...(args as unknown[]))})`;
  } else {
    throw new Error(`GCacheKey bad call: '${JSON_stringify(acall)}'`);
  }
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
  onlyFirst: false,
): HTMLElement[];

export function findElements(
  start: HTMLElement,
  mode: HTMLElementSearchModes,
  testFunc: (elem: HTMLElement) => boolean,
  onlyFirst: true,
): HTMLElement | null;

export function findElements(
  start: HTMLElement,
  mode: HTMLElementSearchModes,
  testFunc: (elem: HTMLElement) => boolean,
  onlyFirst: true | false,
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
                  false,
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
  element: HTMLElement | EventTarget | null,
  mode?: HTMLElementSearchModes,
): { element: HTMLElement; type: string } | null {
  const amode = mode || 'ancestor-or-self';
  const searchclasses = Array.isArray(search) ? search : [search];
  if (!element || !('classList' in element)) return null;
  const result = findElements(
    element,
    amode,
    (el) => searchclasses.some((x) => el.classList && el.classList.contains(x)),
    true,
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
    },
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
  aSheet?: CSSStyleSheet,
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

// Convert an unknown variable into a string optionally checking
// a list of possible properties.
export function unknown2String(v: unknown, checkProps?: string[]): string {
  let str: string;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const prop = checkProps?.reduce((p, c) => {
      return !p && c in v && typeof v[c as never] === 'string' ? c : p;
    }, '');
    if (prop) return v[prop as never];
  }
  try {
    str = (v as any).toString();
  } catch (er) {
    str = `variable is ${typeof v}`;
  }
  return str;
}

export function pad(
  padMe: string | number,
  len: number,
  char: string | number,
): string {
  let r: string = padMe.toString();
  const c = char.toString().substring(0, 1);
  while (r.length < len) r = `${c}${r}`;
  return r;
}

// Xulsword state prefs and certain global prefs should only reference
// installed modules or be empty string. This function insures that is
// the case.
export function validateModulePrefs(
  Tabs: GType['Tabs'],
  Prefs: GType['Prefs'],
  featureModules: GType['FeatureModules'],
  windowComp?: typeof Window,
) {
  const xsprops: Array<keyof typeof S.prefs.xulsword> = [
    'panels',
    'ilModules',
    'mtModules',
    'tabs',
  ];
  const xulsword = keep(
    Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword,
    xsprops,
  );

  validateViewportModulePrefs(Tabs, xulsword);

  const globalPopup = {} as typeof S.prefs.global.popup;

  validateGlobalModulePrefs(
    Tabs,
    Prefs,
    Prefs.getCharPref('global.locale'),
    featureModules,
    globalPopup,
  );

  // IMPORTANT: Use the skipCallbacks and clearRendererCaches arguments of
  // Prefs.mergeValue() to force renderer processes to update once, after
  // module prefs are valid. Otherwise renderer exceptions may be thrown as they
  // they would re-render with invalid module prefs.
  Prefs.mergeValue('global.popup', globalPopup, 'prefs', true, false);
  Prefs.mergeValue('xulsword', xulsword, 'prefs', false, true);

  // Any viewportWin windows also need modules to be checked,
  // which happens in viewportWin component contsructor.
  if (windowComp) {
    windowComp.reset('component-reset', { type: 'viewportWin' });
  }
}

// Modify the given state in place removing any references to viewport
// modules that are not currently installed.
export function validateViewportModulePrefs(
  tabs: TabType[],
  state: Pick<
    typeof S.prefs.xulsword,
    'panels' | 'ilModules' | 'mtModules' | 'tabs'
  >,
) {
  (['panels', 'ilModules', 'mtModules'] as const).forEach((p) => {
    const prop = state[p] as any[];
    state[p] = prop.map((m) => {
      const n = p === 'panels' ? '' : null;
      if (m && !tabs.find((t) => t.module === m)) return n;
      return m;
    });
  });

  const { tabs: tbs } = state;
  tbs.forEach((p, i) => {
    if (p) {
      tbs[i] = p.filter((m) => tabs.find((t) => t.module === m));
    }
  });
}

export function validateGlobalModulePrefs(
  tabs: TabType[],
  prefs: PrefsGType,
  locale: string,
  featureModules: GType['FeatureModules'],
  globalPopup: typeof S.prefs.global.popup,
) {
  const vklookup = prefs.getComplexValue(
    'global.popup.vklookup',
  ) as typeof S.prefs.global.popup.vklookup;
  Object.entries(vklookup).forEach((entry) => {
    const m = entry[0] as keyof typeof S.prefs.global.popup.feature;
    const [, lumod] = entry;
    if (!lumod || !tabs.find((t) => t.module === lumod)) {
      delete vklookup[m];
    }
  });
  globalPopup.vklookup = vklookup;

  const feature = prefs.getComplexValue(
    'global.popup.feature',
  ) as typeof S.prefs.global.popup.feature;
  Object.entries(feature).forEach((entry) => {
    const [f, m] = entry as [keyof typeof S.prefs.global.popup.feature, string];
    if (!m || !tabs.find((t) => t.module === m)) {
      delete feature[f];
    }
  });
  // If no pref has been set for popup.selection[feature] then choose a
  // module from the available modules, if there are any.
  Object.entries(featureModules).forEach((entry) => {
    const [f, fmods] = entry as [
      keyof typeof S.prefs.global.popup.feature,
      string[],
    ];
    if (!(f in feature) && Array.isArray(fmods) && fmods.length) {
      const pref = C.LocalePreferredFeature[locale === 'en' ? 'en' : 'ru'][f];
      feature[f] = pref?.find((m) => fmods.includes(m)) || fmods[0];
    }
  });
  globalPopup.feature = feature;
}

export function noAutoSearchIndex(Prefs: GType['Prefs'], module: string) {
  const csai = Prefs.getComplexValue(
    'global.noAutoSearchIndex',
  ) as typeof S.prefs.global.noAutoSearchIndex;
  if (!csai.includes(module)) {
    csai.push(module);
    Prefs.setComplexValue('global.noAutoSearchIndex', csai);
  }
}

// Return requested valid SWORD render options:
// If show is G, then values of Prefs 'xulsword.show' will be used.
export function getSwordOptions(
  show: typeof S.prefs.xulsword.show | boolean | GType,
  modType: ModTypes,
): { [key in SwordFilterType]: SwordFilterValueType } {
  // Set SWORD filter options
  const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
  let show2: typeof S.prefs.xulsword.show;
  if (typeof show === 'object') {
    if ('headings' in show) show2 = show;
    else
      show2 = show.Prefs.getComplexValue(
        'xulsword.show',
      ) as typeof S.prefs.xulsword.show;
  } else {
    show2 = {} as any;
    Object.values(C.SwordFilters).forEach((v) => (show2[v] = show));
  }
  Object.entries(C.SwordFilters).forEach((entry) => {
    const sword = entry[0] as SwordFilterType;
    const xs = entry[1] as keyof ShowType;
    let showi = show2[xs] ? 1 : 0;
    if (C.AlwaysOn[modType].includes(sword)) showi = 1;
    options[sword] = C.SwordFilterValues[showi];
  });
  return options;
}
// Set the number of globally available text panels. If G.Prefs is passed in,
// the global preferences will read and updated, but if it is a root prefs object
// (because no preferences are stored yet, or we're checking prefs before storing
// them) it will be modified in place and not written to the store. If numPanels
// is 0, then the delta will be applied to current pref instead.
export function setGlobalPanels(
  prefs: GType['Prefs'] | Partial<PrefRoot>,
  numPanels: number,
  delta = 0,
) {
  let xs: typeof S.prefs.xulsword;
  if ('setComplexValue' in prefs) {
    xs = clone(prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword);
  } else {
    if (!('prefs' in prefs)) prefs.prefs = {};
    const p = prefs.prefs as any;
    if (!('xulsword' in p)) p.xulsword = {};
    xs = p.xulsword;
    if (!('panels' in xs)) (xs as any).panels = [''];
  }
  const { panels } = xs;
  const maxN = (window as BibleBrowserControllerGlobal).browserMaxPanels || 4;
  let newN = numPanels || panels.length + delta;
  if (newN < 1) newN = 1;
  if (newN > maxN) newN = maxN;
  C.PanelPrefArrays.forEach((pref) => {
    if (!(pref in xs)) {
      xs[pref] = S.prefs.xulsword[pref] as any[];
    }
    const a = xs[pref];
    while (a.length !== newN) {
      if (newN > a.length) {
        (a as any).push(a[a.length - 1]);
      } else {
        a.pop();
      }
    }
  });
  if ('setComplexValue' in prefs) {
    prefs.setComplexValue('xulsword', xs);
  }

  completePanelPrefDefaultArrays(newN);
  return newN;
}

// Figure out the relative width of each panel due to adjacent panels
// sharing common module and isPinned settings etc. In such case, the
// first panel of the matching group will widen to take up the whole
// width while the following matching panels will shrink to zero width.
// A value of null is given for null or undefined panels.
export function getPanelWidths(
  xulswordState: Pick<XulswordState, 'panels' | 'ilModules' | 'isPinned'>,
): Array<number | null> {
  const { panels, ilModules, isPinned } = xulswordState;
  const panelWidths: Array<number | null> = [];
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
  panelIndex?: number,
): LocationVKType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType: 'Comms',
  panelIndex?: number,
): LocationVKCommType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType: 'Genbks' | 'Dicts',
  panelIndex?: number,
): LocationORType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType?: undefined,
  panelIndex?: number,
): LocationVKType | LocationVKCommType | LocationORType | undefined;
export function xulswordLocation(
  Tab: GType['Tab'],
  Prefs: GType['Prefs'],
  tabType?: TabTypes,
  panelIndex?: number,
): LocationVKType | LocationVKCommType | LocationORType | undefined {
  const panels = Prefs.getComplexValue(
    'xulsword.panels',
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
            'xulsword.location',
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
            'xulsword.keys',
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

// Find the module associated with any location or bookmark item,
// or return null if there is none.
export function getModuleOfObject(
  bookmarkOrLocation:
    | BookmarkItemType
    | LocationTypes[TabTypes]
    | SelectORMType
    | SelectVKType,
): string | null {
  let location: LocationTypes[TabTypes] | SelectORMType | SelectVKType;
  if ('type' in bookmarkOrLocation) {
    const { type } = bookmarkOrLocation;
    if (type === 'folder') return null;
    ({ location } = bookmarkOrLocation);
  } else location = bookmarkOrLocation;
  if ('commMod' in location) return location.commMod;
  if ('v11n' in location) return location.vkMod || null;
  return location.otherMod;
}

export function bookmarkItemIconPath(
  G: GType,
  item: BookmarkTreeNode | BookmarkItemType,
): string {
  const { note } = item;
  let fname = 'folder.png';
  if (item.type === 'bookmark') {
    if (note) fname = `${item.tabType}_note.png`;
    else fname = `${item.tabType}.png`;
  }
  return [G.Dirs.path.xsAsset, 'icons', '16x16', fname].join(C.FSSEP);
}

export function findParentOfBookmarkItem(
  toSearch: BookmarkFolderType,
  id: string,
  recurse = true,
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
  recurse = true,
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
  item: BookmarkItemType,
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
  itemID: string,
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
  targetID: string,
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
  itemID: string,
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
  targetID: string,
): Array<BookmarkItemType | null> {
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
    (item) => typeof item !== 'string' && findBookmarkItem(bookmarks, item.id),
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
        targetID,
      );
    });
  }
  return [];
}

export function pasteBookmarkItems(
  bookmarks: BookmarkFolderType,
  cut: string[] | null,
  copy: string[] | null,
  targetID: string,
): Array<BookmarkItemType | null> {
  const itemsIncludeRoot = (cut || [])
    .concat(copy || [])
    .some((id) => id === S.bookmarks.rootfolder.id);
  if (!itemsIncludeRoot && targetID && (cut || copy)) {
    let pasted: Array<BookmarkItemType | null> = [];
    if (cut) {
      pasted = moveBookmarkItems(bookmarks, cut, targetID);
    } else if (copy) {
      const copiedItems = copy.map((id) => copyBookmarkItem(bookmarks, id));
      if (!copiedItems.includes(null)) {
        pasted = moveBookmarkItems(
          bookmarks,
          copiedItems as BookmarkItemType[],
          targetID,
        );
      }
    }
    return pasted;
  }

  return [];
}

export function bookmarkLabel(
  G: GType,
  verseKeyFunc: typeof verseKey,
  l: LocationVKType | LocationVKCommType | LocationORType,
): string {
  if ('commMod' in l) {
    const { commMod } = l;
    const vk = verseKeyFunc(l, null);
    const readable = vk.readable(G.i18n.language, null, true);
    const t = (commMod in G.Tab && G.Tab[commMod]) || null;
    return `${t ? t.label : G.i18n.t('Comms')}: ${readable}`;
  }
  if ('v11n' in l) {
    const vk = verseKeyFunc(l, null);
    return vk.readable(G.i18n.language, null, true);
  }
  const ks = l.key.split(C.GBKSEP);
  const tab = (l.otherMod && l.otherMod in G.Tab && G.Tab[l.otherMod]) || null;
  ks.unshift(tab?.description.locale || l.otherMod);
  while (ks[2] && ks[0] === ks[1]) {
    ks.shift();
  }
  return `${ks.shift()}: ${ks[ks.length - 1]}`;
}

export function forEachBookmarkItem(
  nodes: BookmarkItemType[] | undefined,
  callback: (node: BookmarkItemType) => void,
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
  item: BookmarkItemType,
): BookmarkItemType {
  const { label, note } = item;
  const nlabel = localizeString(G, label);
  const lang = G.i18n.language as 'en';
  if (nlabel !== label) {
    if (nlabel === 'label' && item.type === 'bookmark') {
      const { location } = item;
      item.label = location
        ? bookmarkLabel(G, verseKeyFunc, location)
        : 'label';
    } else {
      item.label = nlabel;
    }
    item.labelLocale = lang;
  }
  const lnote = localizeString(G, note);
  if (lnote !== note) {
    item.note = lnote;
    item.noteLocale = lang;
  }
  return item;
}

// Recursively apply localization, and optionally add sampleText, to a folder.
export function localizeBookmarks(
  g: GType,
  verseKeyFunc: typeof verseKey,
  folder: BookmarkFolderType,
  getSampleTextFunc?: typeof getSampleText,
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
    nums = chapters.map((ch, i) => (ch === true ? i : -1));
    nums = nums.filter((ch) => ch !== -1);
  }
  const ranges: Array<[number, number]> = [];
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

// Return the node having the id, or return undefined.
export function findTreeNode(
  id: string | number,
  searchIn: TreeNodeInfo[],
  findParent = false,
): TreeNodeInfo | undefined {
  if (searchIn) {
    for (let x = 0; x < searchIn.length; x += 1) {
      if (searchIn[x].id === id) return findParent ? undefined : searchIn[x];
      const { childNodes } = searchIn[x];
      if (childNodes) {
        const rc = findTreeNode(id, childNodes);
        if (rc) return findParent ? searchIn[x] : rc;
      }
    }
  }
  return undefined;
}

// Provide the id (or order) and return both id and order.
export function findTreeNodeOrder(
  searchIn: TreeNodeInfo[],
  idOrOrder: { id?: string | number; order?: number },
  order = null as null | { order: number },
): { id: string | number; order: number } | null {
  // Make order an object so it will be passed by reference.
  if (!order) order = { order: -1 };
  if (searchIn) {
    for (let x = 0; x < searchIn.length; x += 1) {
      order.order += 1;
      const { id, childNodes } = searchIn[x];
      if (id === idOrOrder?.id || order.order === idOrOrder?.order) {
        return { id, order: order.order };
      }
      if (childNodes) {
        const rc = findTreeNodeOrder(childNodes, idOrOrder, order);
        if (rc) return rc;
      }
    }
  }
  return null;
}

// Return ancestor nodes of a non-versekey module key. The returned array is
// ordered from greatest ancestor down to parent. If there is no parent, an
// empty array is returned.
export function gbAncestorIDs(
  id: string | number,
  isDictMod?: boolean, // don't split dict mod keys
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
  isDictMod?: boolean, // don't split dict mod keys
): { ancestors: TreeNodeInfo[]; self: TreeNodeInfo } {
  const anc = gbAncestorIDs(id, isDictMod).map((ids) =>
    findTreeNode(ids, nodes),
  );
  const slf = findTreeNode(id, nodes);
  if (anc.some((x) => x === undefined) || slf === undefined) {
    throw new Error(`Node not found: '${id}'`);
  }
  return {
    ancestors: anc as TreeNodeInfo[],
    self: slf,
  };
}

export function findTreeSiblings(
  id: string | number,
  nodes: TreeNodeInfo[],
): TreeNodeInfo[] {
  const { ancestors } = findTreeAncestors(id, nodes);
  if (ancestors.length) {
    const parent = ancestors.pop();
    if (parent?.childNodes) return parent.childNodes;
    throw new Error(`Parent has no children: '${id}'`);
  }
  return nodes;
}

export function nextTreeSibling(
  nodeOrId: TreeNodeInfo | string,
  nodes: TreeNodeInfo[],
): TreeNodeInfo | null {
  return findTreeSibling(true, nodeOrId, nodes);
}

export function prevTreeSibling(
  nodeOrId: TreeNodeInfo | string,
  nodes: TreeNodeInfo[],
): TreeNodeInfo | null {
  return findTreeSibling(false, nodeOrId, nodes);
}

export function findTreeSibling(
  nextPrev: boolean,
  nodeOrId: TreeNodeInfo | string,
  nodes: TreeNodeInfo[],
): TreeNodeInfo | null {
  let parentNode: TreeNodeInfo | undefined;
  let myid: string;
  if (typeof nodeOrId === 'string') {
    myid = nodeOrId;
    parentNode = findTreeNode(nodeOrId, nodes, true);
  } else {
    const anc = findTreeAncestors(nodeOrId.id.toString(), nodes);
    parentNode = anc.ancestors.pop();
    myid = anc.self.id.toString();
  }
  let childNodes: TreeNodeInfo[] | undefined;
  if (parentNode) ({ childNodes } = parentNode);
  else childNodes = nodes;
  if (childNodes) {
    for (let x = 0; x < childNodes.length; x++) {
      if (childNodes[x].id.toString() === myid) {
        if (nextPrev) return childNodes[x + 1] || null;
        else return (x > 0 && childNodes[x - 1]) || null;
      }
    }
  }
  return null;
}

// A leaf node has no childNodes property, or else it is zero length.
export function findFirstLeafNode(
  nodes: TreeNodeInfo[],
  candidates: Array<string | TreeNodeInfo>,
): TreeNodeInfo | undefined {
  if (!candidates.length) candidates.push(...nodes);
  const candidateNodes = candidates.map((c) => {
    if (typeof c === 'string') {
      if (!nodes)
        throw new Error(
          `'nodes' argument required when candidate is type 'string': '${c}'`,
        );
      const n = findTreeNode(c, nodes);
      if (!n) throw new Error(`node does not exist in nodes: '${c}'`);
      return n;
    }
    return c;
  });
  const r = candidateNodes.find(
    (n) => !('childNodes' in n) || n.childNodes?.length === 0,
  );
  if (r) return r;
  const rc = candidateNodes
    .map((n) =>
      'childNodes' in n && n.childNodes
        ? findFirstLeafNode(nodes, n.childNodes)
        : null,
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
  module?: string,
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
      ckey,
    );
  }
  return Cache.read(ckey);
}

export function gbPaths(genbkTreeNodes: TreeNodeInfo[]): GenBookAudio {
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
  addPath(genbkTreeNodes);
  return r;
}

export function gbQualifiedPath(key: string, gbAudio: GenBookAudio): string {
  if (key in gbAudio) {
    const ords = gbAudio[key] as number[];
    const keys = key.split(C.GBKSEP);
    if (ords.length === keys.filter(Boolean).length) {
      return ords.map((o, i) => `${pad(o, 3, 0)} ${keys[i]}`).join(C.GBKSEP);
    }
  }
  return '';
}

export function genBookAudio2TreeNodes(
  audio: GenBookAudioConf,
  module: string,
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
    nodes.sort((a, b) => a.id.toString().localeCompare(b.id.toString())),
  );
}

export function isAudioVerseKey(
  audio: VerseKeyAudio | GenBookAudioConf,
): boolean {
  const books = Object.keys(audio);
  return books.some((bk) =>
    Object.values(C.SupportedBooks).some((bg: any) => bg.includes(bk)),
  );
}

export function readVerseKeyAudioConf(audio: VerseKeyAudioConf): VerseKeyAudio {
  const r: VerseKeyAudio = {};
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

export function subtractVerseKeyAudioChapters(
  audio: VerseKeyAudio,
  subtract: VerseKeyAudio,
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
  subtract: GenBookAudioConf,
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

// Follow IBT's audio download API specification to convert a selection into
// the necessary parameter values required by the API for the request. Returns
// true if the selection could be converted, or false otherwise.
function IBTtemplateURL(
  selection:
    | SelectVKType
    | SelectORMType
    | AudioPlayerSelectionVK
    | AudioPlayerSelectionGB,
  phs: {
    XSKEY: string;
    XSPARENT: string;
    XSCHAPTER: string;
    XSCHAPTERS: string;
    XSPACKAGE: 'none' | 'zip' | 'auto';
    XSREDIRECT: '0' | '1';
  },
) {
  if ('book' in selection) {
    let { book, chapter } = selection;
    if (typeof book === 'undefined') book = 'Gen';
    if (typeof chapter === 'undefined') chapter = 1;
    const lastchapter =
      'lastchapter' in selection && selection.lastchapter
        ? selection.lastchapter
        : chapter;
    phs.XSKEY = book;
    phs.XSPARENT = book;
    phs.XSCHAPTER = chapter.toString();
    const chl = lastchapter > chapter ? lastchapter : chapter;
    phs.XSCHAPTERS = `${chapter.toString()}-${chl}`;
    if (phs.XSPACKAGE === 'auto')
      phs.XSPACKAGE = chl > chapter ? 'zip' : 'none';
    else if (phs.XSPACKAGE === 'none' && chl > chapter) return false;
  } else {
    let keys: string[] = [];
    if ('keys' in selection) ({ keys } = selection);
    if ('key' in selection && selection.key) keys = [selection.key];
    if (!keys.length) return false;
    // Multiple genbk keys are assumed to use path order or fully qualified
    // keys and to be siblings of the same parent (which is guaranteed by
    // SelectOR). In addition, keys from IBT's web app widgetOR may not include
    // redundant root segments and IBT requires that path order XSPARENT and
    // XSKEY values include any redundant root. Thus this problem is remediated
    // by using path name for XSPARENT/XSKEY whenever possible, since IBT's
    // widgetOR includes path names.
    const useOrd = /^\d+(\/\d+)*$/.test(keys[0]);
    const segs = keys[0].split(C.GBKSEP).map((seg) => {
      if (useOrd) return Number(seg);
      return seg.replace(/^\d\d\d /, '');
    });
    if (keys.length > 1) {
      let failed = false;
      const chs = keys.map((k) =>
        k.split(C.GBKSEP).map((x) => {
          const n = Number(x);
          if (Number.isNaN(n)) {
            const m = x.match(/^(\d\d\d)( .*)?$/);
            if (!m) failed = true;
            return m ? Number(m[1]) : -1;
          }
          return n;
        }),
      );
      if (failed) return false;
      phs.XSKEY = segs.join(C.GBKSEP);
      if (segs.length) segs[segs.length - 1] = '';
      const parent = segs.join(C.GBKSEP);
      let ch = -1;
      let cl = -1;
      chs.forEach((cha) => {
        const c = cha.pop();
        if (typeof c !== 'undefined') {
          if (ch === -1 || ch > c) ch = c;
          if (cl === -1 || cl < c) cl = c;
        }
      });
      phs.XSPARENT = `/${parent}`;
      phs.XSCHAPTER = ch.toString();
      const chl = cl > ch ? cl : ch;
      phs.XSCHAPTERS = `${ch}-${chl.toString()}`;
      if (phs.XSPACKAGE === 'auto') phs.XSPACKAGE = chl > ch ? 'zip' : 'none';
      else if (phs.XSPACKAGE === 'none' && chl > ch) return false;
    } else {
      phs.XSKEY = segs.join(C.GBKSEP);
      let chapter = '';
      if (segs.length) {
        chapter = segs[segs.length - 1].toString();
        segs[segs.length - 1] = '';
      }
      const parent = segs.join(C.GBKSEP);
      phs.XSPARENT = `/${parent}`;
      phs.XSCHAPTER = chapter.toString();
      phs.XSCHAPTERS = chapter.toString();
      if (phs.XSPACKAGE === 'auto') phs.XSPACKAGE = 'none';
    }
  }

  return true;
}

// The url may be an http(s) URL containing XS___ placeholder strings. This
// function returns the completed URL by replacing the placeholder strings
// with appropriate values from the selection.
export function resolveTemplateURL(
  url: string,
  selection:
    | SelectVKType
    | SelectORMType
    | AudioPlayerSelectionVK
    | AudioPlayerSelectionGB,
  // 'auto' becomes 'none' for one file, or 'zip' for multiple files.
  XSPACKAGE: 'none' | 'zip' | 'auto',
  XSREDIRECT: '0' | '1', // redirect to the file's absolute url?
) {
  // Supported replacements
  const phs = {
    XSKEY: '',
    XSPARENT: '',
    XSCHAPTER: '',
    XSCHAPTERS: '',
    XSPACKAGE,
    XSREDIRECT,
  };

  if (!IBTtemplateURL(selection, phs)) return url;

  let url2 = url;
  Object.entries(phs)
    .sort((ea, eb) => eb[0].length - ea[0].length)
    .forEach((entry) => {
      const [ph, value] = entry;
      if (value && url2.includes(ph))
        url2 = url2.replaceAll(ph, value.toString());
    });

  return url2;
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

export function isRepoCustom(
  custom: Repository[] | null,
  repo: Repository | string,
): boolean {
  const repokey = typeof repo === 'object' ? repositoryKey(repo) : repo;
  return custom !== null && !!custom.find((r) => repositoryKey(r) === repokey);
}

export function isRepoLocal(repo: Repository | string): boolean {
  let r: Repository | null = null;
  if (typeof repo === 'object') r = repo;
  else {
    r = keyToRepository(repo); // this r is not complete but does include domain
  }
  return r ? r.domain === C.Downloader.localfile : false;
}

// Return the string key of a download object. That string may also be used
// to clone the object by calling keyToDownload(dlkey).
export function downloadKey(dl: Download | null): string {
  if (!dl) return '';
  if (dl.type === 'http' && !C.URLRE.test(dl.http))
    throw new Error(`Not downloadable: ${dl.http}`);
  type DLkeys = Exclude<
    keyof HTTPDownload | keyof ModFTPDownload | keyof FTPDownload,
    'disabled'
  >;
  const ms: Record<DLkeys, boolean> = {
    type: true,
    http: true,
    file: true,
    module: true,
    name: true,
    domain: true,
    path: true,
    confname: true,
    data: false,
  };
  const inner = Object.entries(ms)
    .filter((e) => e[1] && e[0] in dl && dl[e[0] as keyof typeof dl])
    .map((e) => `${e[0]}:${dl[e[0] as keyof typeof dl]}`)
    .join('][');
  return `[${inner}]`;
}

// Return a Download object from a download key.
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

// Unique string signature of a particular repository. Although the key is
// unique among all repositories. That string may also be used to clone the
// object by calling keyToRepository(repokey)
export function repositoryKey(r: Repository): string {
  return `[${[r.name, r.domain, r.path].join('][')}]`;
}

export function keyToRepository(repokey: string): Repository {
  const ks: (keyof Repository)[] = ['name', 'domain', 'path'];
  return repokey
    .substring(1, repokey.length - 2)
    .split('][')
    .reduce((p, r) => {
      const k = ks.shift();
      if (k) p[k] = r;
      return p;
    }, {} as Repository);
}

// Unique string signature of a particular module in a particular repository.
// The key is unique among all modules everywhere in the program.
export function repositoryModuleKey(conf: SwordConfType): string {
  const { module, sourceRepository: r, DataPath } = conf;
  let str = `[${[r.name, r.domain, r.path, module].join('][')}]`;
  // XSM files may have multiple config files for the same module, differentiated
  // only by DataPath.
  if (conf.xsmType === 'XSM') str += `[${DataPath}]`;
  return str;
}

// Convert a Blueprint.js Region selection to a list of table rows.
export function selectionToTableRows(regions: Region[]): number[] {
  const sels = new Set<number>();
  regions?.forEach((region) => {
    if (region.rows) {
      for (let [r] = region.rows; r <= region.rows[1]; r += 1) {
        sels.add(r);
      }
    }
  });
  return Array.from(sels).sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
}

// Convert a list of table rows to a Blueprint.js Region.
export function tableRowsToSelection(rows: number[]): RowSelection {
  const unique = new Set(rows);
  const sorted = Array.from(unique).sort((a: number, b: number) =>
    a > b ? 1 : a < b ? -1 : 0,
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

// Return a new array of row indexes after toggling a particular index, by adding
// or subtracting from the input array as appropriate. If the ctrl or shift key
// is pressed, the current selection will be handled accordingly.
export function updateSelectedIndexes(
  toggleRowIndex: number,
  selectedRowIndexes: number[],
  e: React.MouseEvent,
): number[] {
  const newSelectedRowIndexes = Array.from(new Set(selectedRowIndexes));
  newSelectedRowIndexes.sort((a, b) => a - b);
  const toggleSelected = newSelectedRowIndexes.includes(toggleRowIndex);
  if (newSelectedRowIndexes.length && (e.ctrlKey || e.shiftKey)) {
    // Decide if selecting upwards or downwards
    if (newSelectedRowIndexes[0] > toggleRowIndex) {
      // select upwards:
      // Get the first selected row after the clicked row.
      const [prev] = newSelectedRowIndexes;
      const start = e.ctrlKey ? toggleRowIndex : prev - 1;
      for (let x = start; x >= toggleRowIndex; x -= 1) {
        if (!toggleSelected) newSelectedRowIndexes.push(x);
        else if (newSelectedRowIndexes.includes(x)) {
          newSelectedRowIndexes.splice(newSelectedRowIndexes.indexOf(x), 1);
        }
      }
    } else {
      // select downwards:
      // Get the first selected row before the clicked row.
      const prev = newSelectedRowIndexes
        .filter((r) => r < toggleRowIndex)
        .pop();
      const start = prev === undefined || e.ctrlKey ? toggleRowIndex : prev + 1;
      for (let x = start; x <= toggleRowIndex; x += 1) {
        if (!toggleSelected) newSelectedRowIndexes.push(x);
        else if (newSelectedRowIndexes.includes(x)) {
          newSelectedRowIndexes.splice(newSelectedRowIndexes.indexOf(x), 1);
        }
      }
    }
    return newSelectedRowIndexes;
  }
  return toggleSelected ? [] : [toggleRowIndex];
}

// Append entries of 'b' to 'a'. So 'a' is modified in place, while 'b'
// is untouched.
export function mergeNewModules(a: NewModulesType, b: NewModulesType) {
  Object.entries(b).forEach((entry) => {
    const [kx, vx] = entry;
    const k = kx as keyof typeof C.NEWMODS;
    const v = vx as any;
    a[k].push(...v);
  });
}

export function gcallResultCompression<R extends any[] | Record<string, any>>(
  call: GCallType,
  result: R,
  compressionFunc: <V extends Record<string, any>>(
    val: V,
    valType: keyof typeof C.CompressibleCalls.common,
  ) => V,
): R {
  const compress = Object.entries(C.CompressibleCalls.map).find(
    (e) => e[0] === call[0],
  );
  if (compress) {
    const [, [resType, valType]] = compress;
    if (Array.isArray(resType))
      return result.map((r: any) => compressionFunc(r, valType));
    return Object.entries(result).reduce((p, entry) => {
      const [k, v] = entry;
      p[k] = compressionFunc(v, valType);
      return p;
    }, {} as any);
  }

  return result;
}
