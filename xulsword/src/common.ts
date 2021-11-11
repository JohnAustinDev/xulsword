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

function decodeOSISRef(aRef: string) {
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
export function getElementInfo(
  elem: 'string' | { className: string; title: string }
): TextInfo | null {
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
      typeof G.Book !== 'undefined' && b < G.Book.length;
      b += 1
    ) {
      if (G.Book[b].sName === code) {
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
  for (let b = 0; b < G.Book.length; b += 1) {
    if (G.Book[b].bNameL === bText) {
      return b;
    }
  }
  return null;
}

// Firefox Add-On validation throws warnings about setting innerHTML
// directly, so this is a safe solution. In future, it's better to
// manipulate the DOM directly rather than use innerHTML also
// because it's faster. NOTE: This function scrubs out all Javascript
// as well as non-standard HTML attributes.
export function sanitizeHTML(parent: HTMLElement, html: string) {
  return parent;
  /*
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
  const parser = Components.classes["@mozilla.org/parserutils;1"].getService(Components.interfaces.nsIParserUtils);
  parent.appendChild(parser.parseFragment(html, parser.SanitizerAllowStyle, false, null, parent.ownerDocument.documentElement));
  */
}

// Firefox Add-On validation throws warnings about eval(uneval(obj)), so
// this is an alternate way...
export function deepClone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
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
    let n = i18next.exists(key, toptions) ? i18next.t(key, toptions) : '';
    if (n && /^\s*$/.test(n)) n = '';
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

export function getLocalizedChapterTerm(
  bookCode: string,
  chapNum: number,
  locale: string
) {
  const k1 = `${bookCode}_Chaptext`;
  const k2 = 'Chaptext';
  const toptions = {
    v1: dString(chapNum, locale),
    lng: locale,
    ns: 'common/books',
  };

  let r = i18next.exists(k1, toptions) ? i18next.t(k1, toptions) : '';
  if (!r) {
    r = i18next.exists(k2, toptions) ? i18next.t(k2, toptions) : '';
  }

  return r;
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
    G.Prefs.getPrefOrCreate('HaveInternetPermission', 'Bool', false) ||
    G.Prefs.getPrefOrCreate('SessionHasInternetPermission', 'Bool', false);

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
