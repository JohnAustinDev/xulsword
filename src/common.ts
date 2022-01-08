/* eslint-disable @typescript-eslint/no-explicit-any */
import i18next from 'i18next';
import C from './constant';
import { GType } from './type';
import TextClasses, { TextInfo } from './textclasses';

export function escapeRE(text: string) {
  // eslint-disable-next-line no-useless-escape
  const ESCAPE_RE = /([\-\[\]\(\)\{\}\=\!\+\*\.\:\^\$\?\|\/\\])/g;
  return text.replace(ESCAPE_RE, '\\$1');
}

export function decodeOSISRef(aRef: string) {
  let ret = aRef;
  const re = new RegExp(/_(\d+)_/);
  let m = aRef.match(re);
  while (m) {
    const r = String.fromCharCode(Number(m[1]));
    ret = aRef.replace(new RegExp(escapeRE(m[0]), 'g'), r);
    m = aRef.match(re);
  }
  return ret;
}

// This function will accept either raw HTML or a DOM element as "elem"
// NOTES ABOUT ENCODING:
// - nid: encoded with encodeURIComponent (for use in HTML tags)
// - osisref: encoded with _cp_ encoding (UTF8, and some other chars, require encoding in osisRef attributes)
// - reflist: is an array of UTF8 strings
// - ch: is UTF8 (may be a number or a key)
// - all other properties: are ASCII
export function getElementInfo(elem: 'string' | HTMLElement): TextInfo | null {
  // Info is parsed from className and title, so start by getting each
  let className;
  let title;
  if (typeof elem === 'string') {
    // If elem is string HTML, parse only the first tag
    const mt = elem.match(/^[^<]*<[^>]+title\s*=\s*["']([^"']*)["']/);
    if (mt !== null) [, title] = mt;
    const mc = elem.match(/^[^<]*<[^>]+class\s*=\s*["']([^"']*)["']/);
    if (mc !== null) [, className] = mc;
    if (!title || !className) return null;
  } else {
    if (!elem.className || !elem.title) return null;
    className = elem.className;
    title = elem.title;
  }

  // jsdump("getElementInfo class=" + className + ", title=" + title);

  // Read info using TextClasses...
  const r: TextInfo = {
    type: null,
    title: null,
    reflist: null,
    bk: null,
    ch: null,
    vs: null,
    lv: null,
    mod: null,
    osisref: null,
    nid: null,
    ntype: null,
  };

  const mt = className.match(/^([^\-\s]*)/);
  let t = null;
  if (mt !== null) [, t] = mt;
  if (t === null || !(t in TextClasses)) return null;
  const type = t as keyof typeof TextClasses;

  r.type = type;
  r.title = title;
  let unmatched = true;
  for (let i = 0; i < TextClasses[type].length; i += 1) {
    const m = title.match(TextClasses[type][i].re);
    // eslint-disable-next-line no-continue
    if (!m) continue;
    unmatched = false;
    // jsdump("i=" + i + "\n" + uneval(m));
    const entries = Object.entries(TextClasses[type][i]);
    entries.forEach((entry) => {
      const [prop, value] = entry;
      if (prop !== 're') {
        const p = prop as keyof TextInfo;
        const val = value as number | null;
        if (val !== null && m[val] !== null) {
          r[p] = m[val] as any;
        }

        let parsed = r[p] as any;

        // convert integers into Number type, rather than String type
        if (
          typeof parsed === 'string' &&
          parsed.indexOf('.') === -1 &&
          Number(parsed)
        ) {
          r[p] = Number(parsed) as any;
          return;
        }

        if (parsed !== null) {
          // decode properties which need decodeURIComponent
          if (['osisref', 'reflist', 'ch'].includes(p)) {
            parsed = decodeURIComponent(parsed) as any;
          }

          // fix incorrect dictionary osisRefs for backward compatibility to <2.23
          if (p === 'osisref' && ['dtl', 'dt'].includes(type)) {
            parsed = parsed.replace(/(^|\s)([^.:]+)\./g, '$1$2:');
          }

          // convert reflist into arrays
          if (p === 'reflist') {
            if (['dtl', 'dt'].includes(type)) {
              // Backward Compatibility to < 2.23
              if (parsed.indexOf(':') === -1) {
                parsed = parsed.replace(/ /g, '_32_');
                parsed = parsed.replace(/;/g, ' ');
                parsed = parsed.replace(/((^|\s)\w+)\./g, '$1:');
              }
              parsed = parsed.split(/ +/);
            } else if (type === 'sr') {
              parsed = parsed.split(';');
            } else {
              throw Error(`Unknown type of reflist: ${type}`);
            }

            // decode properties which need decodeOSISRef
            for (let x = 0; x < parsed.length; x += 1) {
              parsed[x] = decodeOSISRef(parsed[x]);
            }
          }

          if (p === 'ch') parsed = decodeOSISRef(parsed);
        }
        r[p] = parsed;
      }
    });

    break;
  }
  if (unmatched) return null;

  // jsdump(uneval(r));

  return r;
}

export function bookGroupLength(bookGroup: string) {
  if (bookGroup === 'ot') return 39;
  if (bookGroup === 'nt') return 27;
  return 0;
}

export function firstIndexOfBookGroup(bookGroup: string) {
  let i = 0;
  for (let x = 0; x < C.BOOKGROUPS.length; x += 1) {
    if (bookGroup === C.BOOKGROUPS[x]) break;
    i += bookGroupLength(C.BOOKGROUPS[x]);
  }
  return i;
}

// Returns the index number of a book or null if none was found.
// The book may be specified by an OSIS book code, or else by
// a bookGroup code and index number within that bookGroup.
export function findBookNum(
  G: GType,
  code: string | null,
  n?: number
): number | null {
  let retv = null;
  if (
    code &&
    C.BOOKGROUPS.includes(code) &&
    n !== undefined &&
    Number.isInteger(n)
  ) {
    if (n >= bookGroupLength(code)) {
      return null;
    }
    retv = 0;
    for (let x = 0; x < C.BOOKGROUPS.length; x += 1) {
      if (C.BOOKGROUPS[x] === code) {
        retv += n;
        break;
      }
      retv += bookGroupLength(C.BOOKGROUPS[x]);
    }
  } else {
    for (
      let b = 0;
      typeof G.Books !== 'undefined' && b < G.Books.length;
      b += 1
    ) {
      if (G.Books[b].sName === code) {
        retv = b;
      }
    }
  }

  return retv;
}

// Returns the bookGroup and bookGroup index of a given book code
export function findBookGroup(
  G: GType,
  code: string
): { group: string; index: number } | null {
  const i = findBookNum(G, code);
  if (i === null) return null;

  const r = { group: '', index: -1 };
  let ileft = i;
  for (let x = 0; x < C.BOOKGROUPS.length; x += 1) {
    const bgl = bookGroupLength(C.BOOKGROUPS[x]);
    r.group = C.BOOKGROUPS[x];
    if (ileft < bgl) {
      r.index = ileft;
      return r;
    }
    ileft -= bgl;
  }
  return null;
}

// Returns the number of a given long book name
function findBookNumL(G: GType, bText: string | null): number | null {
  for (let b = 0; b < G.Books.length; b += 1) {
    if (G.Books[b].bNameL === bText) {
      return b;
    }
  }
  return null;
}

export function sanitizeHTML(parent: HTMLElement, html: string) {
  parent.innerHTML = html;
  return parent;
}

export function stringHash(...args: any): string {
  let r = '';
  args.forEach((arg: any) => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg !== 'object') {
      return `${arg}`;
    }
    Object.entries(arg)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach((entry) => {
        const [p, v] = entry;
        if (typeof v !== 'object') {
          r += `${p}:${v},`;
        } else {
          r += `${p}:${stringHash(v)},`;
        }
      });
    return r;
  });
  return r;
}

// Firefox Add-On validation throws warnings about eval(uneval(obj)), so
// this is an alternate way...
export function deepClone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
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

// getDataUI(name) = t(name)
// getLocale() = i18next.language || G.Prefs.getCharPref(C.LOCALEPREF)
// getLocaleBundle() = i18next.getFixedT()

// converts any normal digits in a string or number into localized digits
const LocaleNumerals: { [i: string]: any } = {};
function getDisplayNumerals(locale: string) {
  LocaleNumerals[locale] = new Array(11);
  LocaleNumerals[locale][10] = false;

  const toptions = { lng: locale, ns: 'common/numbers' };
  for (let i = 0; i <= 9; i += 1) {
    const key = `n${String(i)}`;
    const n = i18next.t(key, toptions);
    if (n) LocaleNumerals[locale][10] = true;
    LocaleNumerals[locale][i] = n || i;
  }
}
export function dString(x: string | number, locale?: string) {
  const loc = locale || i18next.language;

  if (!(loc in LocaleNumerals)) getDisplayNumerals(loc);
  const l = LocaleNumerals[loc];

  let s = String(x);
  if (!l[10]) return s; // then no numbers are localized

  s = s.replace(/0/g, l[0]);
  s = s.replace(/1/g, l[1]);
  s = s.replace(/2/g, l[2]);
  s = s.replace(/3/g, l[3]);
  s = s.replace(/4/g, l[4]);
  s = s.replace(/5/g, l[5]);
  s = s.replace(/6/g, l[6]);
  s = s.replace(/7/g, l[7]);
  s = s.replace(/8/g, l[8]);
  s = s.replace(/9/g, l[9]);

  return s;
}
// converts any localized digits in a string into normal digits
export function iString(x: number | string, locale: string) {
  const loc = locale || i18next.language;

  if (!(loc in LocaleNumerals)) getDisplayNumerals(loc);
  const l = LocaleNumerals[loc];

  let s = String(x);
  if (!l[10]) return s; // then no numbers are localized

  s = s.replace(new RegExp(escapeRE(l[0]), 'g'), '0');
  s = s.replace(new RegExp(escapeRE(l[1]), 'g'), '1');
  s = s.replace(new RegExp(escapeRE(l[2]), 'g'), '2');
  s = s.replace(new RegExp(escapeRE(l[3]), 'g'), '3');
  s = s.replace(new RegExp(escapeRE(l[4]), 'g'), '4');
  s = s.replace(new RegExp(escapeRE(l[5]), 'g'), '5');
  s = s.replace(new RegExp(escapeRE(l[6]), 'g'), '6');
  s = s.replace(new RegExp(escapeRE(l[7]), 'g'), '7');
  s = s.replace(new RegExp(escapeRE(l[8]), 'g'), '8');
  s = s.replace(new RegExp(escapeRE(l[9]), 'g'), '9');

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

  return i18next.exists(k1, toptions)
    ? i18next.t(k1, toptions)
    : i18next.t(k2, toptions);
}

export function isProgramPortable() {
  return false;
}

export function openWindowXS(
  url: string,
  name: string,
  args: any,
  windowtype: string,
  parentWindow: any
) {
  throw Error('openWindowXS not yet implemented');
  /*
  if (!parentWindow) parentWindow = window;

  var existingWin = null;
  if (windowtype) {
    existingWin = Components.classes['@mozilla.org/appshell/window-mediator;1'].
    getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow(windowtype);
  }
  else name += "-" + Math.round(10000*Math.random());

  if (existingWin) {
    existingWin.focus();
    return existingWin;
  }

  return window.open(url, name, args);
  */
}

export function closeWindowXS(aWindow: any) {
  throw Error('closeWindowXS not yet implemented');
  /*
  if (typeof(G.AllWindows) == "object" &&
      G.AllWindows instanceof Array &&
      G.AllWindows.length) {
    var i = G.AllWindows.indexOf(aWindow);
    if (i != -1) G.AllWindows.splice(i, 1);
  }
  aWindow.close();
  */
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

// Return the module context in which the element resides, NOT the
// module associated with the data of the element itself.
export function getContextModule(elem: HTMLElement) {
  let p;

  // first let's see if we're in a verse
  let telem = elem as HTMLElement | null;
  while (telem && !telem.classList.contains('vs')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  if (telem) {
    p = getElementInfo(telem);
    if (p) return p.mod;
  }

  // then see if we're in a viewport window, and use its module
  const atext = ofClass(['atext'], elem);
  if (atext) return atext.element.dataset.module;

  // are we in cross reference text?
  telem = elem as HTMLElement | null;
  while (telem && !telem.classList.contains('crtext')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  const match = telem?.className.match(/\bcs-(\S+)\b/);
  if (match) return match[1];

  // in a search lexicon list?
  telem = elem as HTMLElement | null;
  while (telem && !telem.classList.contains('snlist')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  if (telem) return telem.getAttribute('contextModule');

  // otherwise see if we're in a search results list
  telem = elem as HTMLElement | null;
  while (telem && !telem.classList.contains('slist')) {
    telem = telem.parentNode as HTMLElement | null;
  }
  if (telem) {
    p = getElementInfo(telem);
    if (p) return p.mod;
  }

  return null;
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
export function getCSS(selectorStr: string, sheetIndex?: number) {
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
