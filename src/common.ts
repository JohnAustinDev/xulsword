/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-explicit-any */
import i18next from 'i18next';
import C from './constant';
import type { GType, LocationVKType, V11nType } from './type';
import Cache from './cache';

export function escapeRE(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

export function compareObjects(obj1: any, obj2: any, deep = false): boolean {
  if (
    obj1 === null ||
    obj2 === null ||
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object'
  ) {
    return obj1 === obj2;
  }
  return (
    Object.keys(obj1).length === Object.keys(obj2).length &&
    Object.keys(obj1).every(
      (key) =>
        Object.prototype.hasOwnProperty.call(obj2, key) &&
        (deep
          ? compareObjects(obj1[key], obj2[key], true)
          : obj1[key] === obj2[key])
    )
  );
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

export function guiDirection(G: GType) {
  const locale = G.Prefs.getCharPref(C.LOCALEPREF);
  const c = G.LocaleConfigs[locale];
  if (c && c.direction) return c.direction;
  return 'ltr';
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

export function isProgramPortable() {
  return false;
}

// Returns whether the user has given permission to use Internet during
// this session, and prompts the user if the answer is unknown.
export function internetPermission(G: GType) {
  // prefs.clearUserPref("HaveInternetPermission");

  // never allow access to internet until we have express permission!
  const haveInternetPermission =
    G.Prefs.getPrefOrCreate('HaveInternetPermission', 'boolean', false) ||
    G.Prefs.getPrefOrCreate('SessionHasInternetPermission', 'boolean', false);

  if (!haveInternetPermission) {
    /*
    var bundle = getCurrentLocaleBundle("dialogs/addRepositoryModule/addRepositoryModule.properties");
    var title = bundle.GetStringFromName("arm.internetPromptTitle");
    var msg = bundle.GetStringFromName("arm.internetPromptMessage");
    msg += "\n\n";
    msg += bundle.GetStringFromName("arm.wishToContinue");
    var cbText = bundle.GetStringFromName("arm.rememberMyChoice");

    var result = {};
    var dlg = win.openDialog(
      "chrome://xulsword/content/dialogs/dialog/dialog.xul",
      "dlg",
      DLGSTD,
      result,
      fixWindowTitle(title),
      msg,
      DLGALERT,
      DLGYESNO,
      null,
      null,
      cbText
    );
    haveInternetPermission = result.ok;

    // if user wants this choice to be permanent...
    if (result.checked2) {
      prefs.setBoolPref("HaveInternetPermission", haveInternetPermission);

      // there is no way for regular users to undo this, so I've commented it out...
      //prefs.setBoolPref("AllowNoInternetAccess", !haveInternetPermission);
    }
    */
  }

  G.Prefs.setBoolPref('SessionHasInternetPermission', haveInternetPermission);

  return haveInternetPermission;
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
// given style sheet, or the first of all style sheets if sheet not specified.
export function getCSS(
  selectorStr: string,
  sheetIndex?: number
): { rule: CSSRule; sheet: number; index: number } | null {
  const selector = new RegExp(`^${escapeRE(selectorStr)}`);

  let ss1 = 0;
  let ss2 = document.styleSheets.length - 1;
  if (sheetIndex !== undefined && (sheetIndex < ss1 || sheetIndex > ss2)) {
    return null;
  }
  if (sheetIndex != null) {
    ss1 = sheetIndex;
    ss2 = sheetIndex;
  }

  let myRule = null;
  let zend;
  for (let ssn = ss1; ssn <= ss2; ssn += 1) {
    try {
      zend = document.styleSheets[ssn].cssRules.length;
    } catch (er) {
      zend = 0;
    }
    for (let z = 0; z < zend; z += 1) {
      myRule = document.styleSheets[ssn].cssRules[z];
      if (myRule.cssText.search(selector) !== -1)
        return { rule: myRule, sheet: ssn, index: z };
    }
  }
  return null;
}

// Dot location is:
// bk.ch or
// bk.ch.vs or
// bk.ch.vs.lv
export function dotLocation2LocationVK(
  loc: string,
  v11n: V11nType,
  version?: string
): LocationVKType {
  const retval = {
    book: '',
    chapter: 0,
    verse: null,
    lastverse: null,
    version: null,
    v11n,
  } as LocationVKType;
  const dotLocation = loc.split('.');
  const [sn, ch, vs, lv] = dotLocation;
  if (dotLocation[0] !== undefined) retval.book = sn;
  if (dotLocation[1] !== undefined) retval.chapter = Number(ch);
  if (dotLocation[2] !== undefined) retval.verse = Number(vs);
  if (dotLocation[3] !== undefined) retval.lastverse = Number(lv);
  if (version) retval.version = version;

  return retval;
}

// Convert the following reference forms:
//   Gen, Gen 1, Gen 1:1, Gen 1:1-1, Gen 1:1 - Gen 1:1, Gen.1, Gen.1.1, Gen.1.1.1
// To this type: LocationTypeVK
export function string2LocationVK(vkeytext: string): LocationVKType {
  const vk = vkeytext.trim();
  let book = '';
  let chapter = '';
  let verse = '';
  let lastverse = '';
  if (vk.indexOf('.') !== -1) {
    [book, chapter, verse, lastverse] = vk.split('.');
  } else {
    vk.split(/\s*-\s*/).forEach((seg) => {
      const [bx, cx, vx] = seg.split(/[\s:]+/);
      if (bx && !book) book = bx;
      if (cx && !chapter) chapter = cx;
      if (vx) {
        if (!verse) verse = vx;
        else lastverse = vx;
      }
    });
  }
  return {
    book,
    chapter: Number(chapter) || 1,
    verse: Number(verse) || 1,
    lastverse: Number(lastverse) || Number(verse) || 1,
    v11n: 'KJV',
  };
}

// LibSword.convertLocation returns unpredictable locations if vkeytext's
// book, chapter, verse and lastverse are not in the verse system or
// if the book is not included in tov11n. Also LibSword only converts
// between systems in C.SupportedV11nMaps. So these things must be
// checked before ever calling LibSword.
export function canDoConvertLocation(
  bkChsInV11n: GType['BkChsInV11n'],
  l: LocationVKType,
  tov11n: V11nType
): boolean {
  const fromv11n = l.v11n;
  if (!fromv11n) throw Error(`No versification provided`);
  if (fromv11n === tov11n) return false;
  if (!(fromv11n in C.SupportedV11nMaps)) return false;
  if (!C.SupportedV11nMaps[fromv11n].includes(tov11n)) return false;
  const { book, chapter, verse, lastverse } = l;
  if (!(tov11n in bkChsInV11n)) return false;
  if (!(book in bkChsInV11n[tov11n])) return false;
  const maxch =
    fromv11n in bkChsInV11n && book in bkChsInV11n[fromv11n]
      ? bkChsInV11n[fromv11n][book]
      : 0;
  if (chapter < 1 || chapter > maxch) return false;
  if (verse) {
    const maxv = 200; // slow: getMaxVerse(fromv11n, [b, c].join('.'));
    if (
      verse < 1 ||
      verse > maxv ||
      (lastverse && lastverse < verse) ||
      (lastverse && lastverse > maxv)
    )
      return false;
  }
  return true;
}
