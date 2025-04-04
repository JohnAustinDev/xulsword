import { rootRenderPromise } from './common.tsx';
import {
  clone,
  decodeOSISRef,
  findElements,
  JSON_attrib_parse,
  JSON_attrib_stringify,
  ofClass,
  pad,
} from '../common.ts';
import { G } from './G.ts'; // web app G calls must be preloaded!

import type { LocationORType, LocationVKType, OSISBookType } from '../type.ts';
import type { HTMLElementSearchModes } from '../common.ts';
import verseKey from './verseKey.ts';

// These HTML classes are generated by LibSword. LibSwordHTMLData is parsed from
// these elements' data attributes according to LibSwordDataFormat.
const libSwordElemClasses = [
  'vs', // verse
  'fn', // textual footnote marker (in verse-key modules)
  'cr', // cross-reference note marker in verse-key modules (may include a list of references)
  'un', // user note marker
  'sr', // scripture reference link
  'sn', // Strong's number span
  'gfn', // textual footnote marker (in non-verse-key modules)
  'dt', // x-glossary link
  'dtl', // x-glosslink link or dictionary target-self link
  'nlist', // member of LibSword note list
  'slist', // member of LibSword search results list
] as const;

// These xulsword HTML classes carry HTMLData in their data-data attribute.
const otherElemClasses = [
  'text', // panel text divs,
  'snbut', // strong's number search button
  'crref', // notebox note-list cross-reference link
  'fnrow', // notebox note-list row
  'fnlink', // notebox note-list row source link
  'introlink', // versekey chapter introduction link
  'aboutlink', // module about link
  'dictkey', // dictionary key in a key list
  'requiremod', // button to install required modules
] as const;

export type DataElemClasses =
  | (typeof libSwordElemClasses)[number]
  | (typeof otherElemClasses)[number];

// HTML element data. This data is encoded in the data-data attribute.
export type HTMLData = {
  type?: DataElemClasses;
  className?: string;
  context?: string;
  reflist?: string[];
  location?: LocationVKType;
  locationGB?: LocationORType;
  bmitem?: string;
  nid?: number;
  title?: string; // data-title value from LibSword
  snphrase?: string; // the word or phrase to which a Strong's number applies
};

// LibSword HTML element data. Data is parsed from LibSword HTML output; from
// data-title and class attributes, and inner text nodes:
export type LibSwordHTMLData = {
  type: (typeof libSwordElemClasses)[number] | null;
  className: string | null;
  title: string | null;
  reflist: string[] | null;
  bk: OSISBookType | '' | null;
  ch: string | number | null;
  vs: number | null;
  lv: number | null;
  mod: string | null;
  osisref: string | null;
  nid: number | null;
  ntype: string | null;
  snphrase: string | null;
};

const classTypeRE = new RegExp(`^(${libSwordElemClasses.join('|')})([\\s-]|$)`);

type Value = {
  [key in keyof LibSwordHTMLData]?: number | null;
} & {
  re: RegExp;
};

// TitleFormat is valid with LibXulSword 1.3.1+
// TitleFormat is an object used to parse information from element classes
// and titles that are generated by libxulsword. The TitleFormat object
// is read by the getElementInfo function below to retrieve data from an
// DOM element. The libSwordElemClasses class must always be the first class
// in the element's class list, and any text after a '-' will be ignored.
// If a null parameter value exists for a particular class expression, this
// signifies the value should be provided by context. NOTE: the sr, dt, and
// dtl class may have multiple ';' or ' ' separated references in their titles.
// prettier-ignore
export const LibSwordDataFormat: Record<typeof libSwordElemClasses[number], Value[]> = {
  vs:     [ { re:/^(([^.]+)\.(\d+)\.(\d+))\.(\d+)\.([^.]+)$/,                                      bk:2,    ch:3,     vs:4,    lv:5,     mod:6, osisref:1 } ],
  fn:     [ { re:/^(\d+)\.(unavailable)\.([^.]+)$/,                                         nid:1, bk:null, ch:null,  vs:null, lv:null,  mod:3, osisref:2 },
            { re:/^(\d+)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/,                               nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  cr:     [ { re:/^(\d+)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/,                               nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  un:     [ { re:/^(.+?)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/,                               nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 },
            { re:/^(.+?)\.[^.]+\.(.*)\.(\d+)\.([^.]+)$/,                                    nid:1, bk:null, ch:2,     vs:3,    lv:3,     mod:4 } ],
  sr:     [ { re:/^(unavailable)\.([^.]+)$/,                                            reflist:1, bk:null, ch:null,  vs:null, lv:null,  mod:2, osisref:1 },
            { re:/^((([^.]+)\.(\d+)\.(\d+))(;.*?)?)\.([^.]+)$/,                         reflist:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:7, osisref:2 },
            { re:/^((([^.]+)\.(\d+)\.(\d+)\s*-\s*[^.]+\.\d+\.(\d+))(;.*?)?)\.([^.]+)$/, reflist:1, bk:3,    ch:4,     vs:5,    lv:6,     mod:8, osisref:2 },
            { re:/^(.*?)\.([^.]+)$/,                                                    reflist:1, bk:null, ch:null,  vs:null, lv:null,  mod:2 } ],
  sn:     [ { re:/^([^.]+)\.(.*)$/,                                                     reflist:2, bk:null, ch:null,  vs:null, lv:null,  mod:1 } ],
  gfn:    [ { re:/^(\d+)\.(fn|cr)\.(.*?)$/,                                            ntype:2, nid:1,                                   mod:3 } ],
  // dt and dtl allow [:.] as delineator for backward compatibility < 2.23 ([:] is correct)
  dt:     [ { re:/^((([^:.]+)[:.]([^.]+))(\s+[^:.]+[:.][^.]+)?)\.([^.]+)$/,               reflist:1, bk:null, ch:4,    vs:null, lv:null, mod:3, osisref:2 } ],
  dtl:    [ { re:/^((([^:.]+)[:.]([^.]+))(\s+[^:.]+[:.][^.]+)?)\.([^.]+)$/,               reflist:1, bk:null, ch:4,    vs:null, lv:null, mod:3, osisref:2 } ],
  nlist:  [ { re:/^(\w+)\.([^.]*)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/,              ntype:1, nid:2, bk:4,    ch:5,     vs:6,    lv:6,    mod:7, osisref:3 },
            { re:/^(\w+)\.([^.]*)\.(([^.]+)(\.(0)(\.(0))?)?)\.([^.]+)$/,            ntype:1, nid:2, bk:4,    ch:6,     vs:8,    lv:8,    mod:9, osisref:3 },
            { re:/^(un)\.([^.]*)\.[^.]*\.(.*)\.(\d+)\.([^.]+)$/,                    ntype:1, nid:2, bk:null, ch:3,     vs:4,    lv:4,    mod:5 } ],
  slist:  [ { re:/^([^.]*)\.([^.]*)$/,                                                              bk:null, ch:1,     vs:null, lv:null, mod:2 },
            { re:/^(([^.]*)\.(\d+)\.(\d+))\.([^.]*)$/,                                              bk:2,    ch:3,     vs:4,    lv:4,    mod:5, osisref:1 } ],
};

// Convert from LibSword data to xulsword data type.
export function libSwordData2XulswordData(dataIn: LibSwordHTMLData): HTMLData {
  const { type, className, title, reflist, mod, osisref, nid, snphrase } =
    dataIn;
  const { bk, vs, lv } = dataIn;
  let { ch } = dataIn;
  let locationGB: LocationORType | undefined;
  let key = '';
  if (typeof ch === 'string') {
    key = ch;
    ch = null;
  }
  let context: string | undefined = mod || undefined;
  let location: LocationVKType | undefined =
    ch !== null && !Number.isNaN(Number(ch))
      ? {
          book: bk || 'Gen',
          chapter: Number(ch),
          verse: vs ?? undefined,
          lastverse: lv ?? undefined,
          v11n: (mod && mod in G.Tab && G.Tab[mod].v11n) || null,
        }
      : undefined;
  if (type && osisref) {
    const m = osisref.match(/^([^:]+):(.*?)$/);
    if (m) {
      const [, b, r] = m;
      if (b && b in G.Tab && G.Tab[b].isVerseKey) {
        context = b;
        location = verseKey(
          { parse: r, v11n: G.Tab[b].v11n || 'KJV' },
          Build.isWebApp ? rootRenderPromise() : null,
        ).location();
      } else {
        locationGB = {
          otherMod: m[1],
          key: decodeOSISRef(m[2]), // required for dt, dtl. Others??
        };
      }
    }
  } else if (mod && mod in G.Tab && !G.Tab[mod].isVerseKey && key) {
    locationGB = { otherMod: mod, key };
  }
  const r: HTMLData = {
    type: type || undefined,
    className: className || undefined,
    context,
    reflist: reflist || undefined,
    location,
    locationGB,
    nid: nid || undefined,
    title: title || undefined,
    snphrase: snphrase || undefined,
  };
  // Make JSON string as short as possible:
  Object.keys(r).forEach(
    (k) => (r as any)[k] === undefined && delete (r as any)[k],
  );
  return r;
}

// The elem argument may be an HTML string or an HTMLelement. Only the first tag of
// string HTML is parsed. When the data attribute is found, its value will be
// immediately returned. Otherwise LibSwordHTMLData will be parsed from the element
// and returned as HTMLData.
// NOTES ABOUT LIBSWORD ENCODING:
// - nid: encoded with encodeURIComponent (for use in HTML tags)
// - osisref: encoded with _cp_ encoding (UTF8, and some other chars, require encoding in osisRef attributes)
// - reflist: is an array of UTF8 strings
// - ch: is UTF8 (may be a number or a key)
// - all other properties: are ASCII
export function getElementData(elemx: string | Element): HTMLData {
  const elem = elemx as string | HTMLElement;
  // First look for the data attribute and return it if it exists:
  if (typeof elem === 'string') {
    const m = elem.match(/^[^<]*<[^>]+data-data="([^"]*)"/);
    if (m) return JSON_attrib_parse(m[1]) as HTMLData;
  } else if (elem.dataset.data) {
    return JSON_attrib_parse(elem.dataset.data) as HTMLData;
  }

  // Otherwise, parse the LibSword element's attributes and content
  // to find LibSwordHTMLData data and convert it to HTMLData.
  let className: string | null = null;
  let title: string | null = null;
  let innerHtmlValue = '';
  if (typeof elem === 'string') {
    const mt = elem.match(/^[^<]*<[^>]+data-title\s*=\s*["']([^"']*)["']/);
    if (mt !== null) [, title] = mt;
    const mc = elem.match(/^[^<]*<[^>]+class\s*=\s*["']([^"']*)["']/);
    if (mc !== null) [, className] = mc;
    const mi = elem.match(/^[^<]*<[^>]*>(.*?)<[^>]*>[^>]*$/);
    if (mi) [, innerHtmlValue] = mi;
  } else if (elem.className) {
    title = elem.dataset.title || null;
    ({ className, innerHTML: innerHtmlValue } = elem);
  }

  // StrongsHebrew 3.0 in CrossWire Beta repo includes 'sr' links that are
  // really sn links, so convert them so they will parse as such.
  if (className?.split(' ').includes('sr') && title?.startsWith('StrongsHebrew:')) {
    const sclass = `S_H${pad(title.substring(14, title.indexOf('.')), 5, '0')}`;
    className = `sn ${sclass}`;
    title = `StrongsHebrew.${sclass}`;
  }

  const r: LibSwordHTMLData = {
    title,
    className,
    type: null,
    reflist: null,
    bk: null,
    ch: null,
    vs: null,
    lv: null,
    mod: null,
    osisref: null,
    nid: null,
    ntype: null,
    snphrase: null,
  };

  const mt = className?.match(/^([^\-\s]*)/);
  if (mt && mt[1] in LibSwordDataFormat) {
    r.type = mt[1] as (typeof libSwordElemClasses)[number];
  }
  const { type } = r;
  ({ title } = r);
  if (type && title) {
    for (let i = 0; i < LibSwordDataFormat[type].length; i += 1) {
      const m = title.match(LibSwordDataFormat[type][i].re);
      if (m) {
        const entries = Object.entries(LibSwordDataFormat[type][i]);
        entries.forEach((entry) => {
          const [prop, value] = entry;
          if (prop !== 're') {
            const p = prop as keyof LibSwordHTMLData;
            const val = value as number | null;
            if (val !== null && m[val] !== null) {
              r[p] = m[val] as any;
            }

            let parsed = r[p] as string | string[] | null;

            // convert integers into Number type, rather than String type
            if (
              typeof parsed === 'string' &&
              !parsed.includes('.') &&
              !Number.isNaN(Number(parsed))
            ) {
              r[p] = Number(parsed) as any;
              return;
            }

            if (parsed !== null) {
              // decode properties which need decodeURIComponent
              if (['osisref', 'reflist', 'ch'].includes(p)) {
                parsed = decodeURIComponent(parsed as string);
              }

              // remove unavaiable
              if (
                p === 'osisref' &&
                type === 'fn' &&
                parsed === 'unavailable'
              ) {
                parsed = null;
              }

              // convert reflist into arrays
              if (p === 'reflist') {
                if (['dtl', 'dt'].includes(type)) {
                  // Backward Compatibility to < 2.23
                  if (
                    parsed &&
                    !Array.isArray(parsed) &&
                    !parsed.includes(':')
                  ) {
                    parsed = parsed.replace(/ /g, '_32_');
                    parsed = parsed.replace(/;/g, ' ');
                    parsed = parsed.replace(/((^|\s)\w+)\./g, '$1:');
                  }
                  parsed = (parsed as string).split(/ +/);
                } else if (type === 'sr') {
                  parsed = (parsed as string).split(/\s*;\s*/);
                } else if (type === 'sn') {
                  parsed = (parsed as string).split(/\s*\.\s*/);
                } else {
                  parsed = (parsed as string).split(/\s+/);
                }
                // decode properties which need decodeOSISRef
                for (let x = 0; x < parsed.length; x += 1) {
                  parsed[x] = decodeOSISRef(parsed[x]);
                }
                // remove unavailable
                if (Array.isArray(parsed) && parsed[0] === 'unavailable')
                  parsed = null;
              }

              if (p === 'ch' && typeof parsed === 'string') {
                parsed = decodeOSISRef(parsed);
              }
            }
            r[p] = parsed as any;
          }
        });
        if (type === 'sr' && !r.reflist) {
          r.reflist = innerHtmlValue.split(/\s*;\s*/);
        } else if (type === 'sn') {
          r.snphrase = innerHtmlValue.replace(/<[^>]*>/g, '').trim();
        }
        break;
      }
    }
  }
  return libSwordData2XulswordData(r);
}

function removeDataAttribute<T extends HTMLElement | string | null>(
  elem: HTMLElement | string | null,
): T {
  if (typeof elem === 'string') {
    return elem.replace(/^([^<]*<[^>]*) data-data="[^"]*"/, '$1') as T;
  }
  if (elem && 'data' in elem.dataset) {
    delete elem.dataset.data;
    return elem as T;
  }
  return null as T;
}

export function writeDataAttribute<T extends HTMLElement | string>(
  elem: T,
  data: HTMLData | null,
): T {
  if (typeof elem === 'string') {
    const elem2: string = removeDataAttribute(elem);
    return elem2.replace(
      /^([^<]*<[^>]*)>/,
      `$1 data-data="${JSON_attrib_stringify(data)}">`,
    ) as T;
  }
  if (elem) {
    elem.dataset.data = JSON_attrib_stringify(data);
    return elem;
  }
  return removeDataAttribute(elem);
}

export function updateDataAttribute<T extends HTMLElement | string | null>(
  elem: T,
  data: HTMLData | null,
): T {
  if (elem) {
    if (!data) {
      return removeDataAttribute(elem);
    }
    const dataNow = getElementData(elem);
    Object.entries(data).forEach((e) => {
      const [k, v] = e;
      if (k && v) dataNow[k as keyof HTMLData] = v as any;
    });
    return writeDataAttribute(elem, dataNow);
  }
  return elem;
}

// Use to seek HTML data associated with an HTML element according to search mode. If
// onlyFirst is true, the first data attribute found is returned, or null if no data
// attribute is found. If returnAll is true, it returns all HTML data objects found
// according to mode as an array.
export function elementData(
  elem: HTMLElement,
  mode: HTMLElementSearchModes,
  onlyFirst?: true | undefined,
): HTMLData | null;

export function elementData(
  elem: HTMLElement,
  mode: HTMLElementSearchModes,
  onlyFirst: false,
): HTMLData[];

export function elementData(
  elem: HTMLElement,
  mode = 'self' as HTMLElementSearchModes,
  onlyFirst?: boolean,
): HTMLData | HTMLData[] | null {
  const tofind = (el: HTMLElement): boolean => {
    if ('data' in el.dataset) return true;
    return classTypeRE.test(el.className);
  };
  if (onlyFirst || onlyFirst === undefined) {
    const r = findElements(elem, mode, tofind, true);
    return r ? getElementData(r) : null;
  }
  return findElements(elem, mode, tofind, false)
    .map((el) => (el && getElementData(el)) || undefined)
    .filter(Boolean);
}

// Merge a priority ordered array of HTMLData objects into one. Certain
// attributes are kept consistent so they are guaranteed to originate
// from the same source data object.
export function mergeElementData(
  datas: Array<HTMLData | null>,
): HTMLData | null {
  const datas2 = datas.filter(Boolean) as HTMLData[];
  const r = clone(datas2.shift());
  if (r) {
    const keepConsistent: Array<keyof HTMLData> = [
      'type',
      'nid',
      'title',
    ] as const;
    datas2.forEach((d) => {
      Object.entries(d).forEach((entry) => {
        const [p, v] = entry;
        if (keepConsistent.includes(p as never)) {
          if (!r.type && p === 'type' && v) {
            keepConsistent.forEach((pc) => {
              (r as any)[pc] = d[pc];
            });
          }
        } else if (!r[p as keyof HTMLData] && v) (r as any)[p] = v;
      });
    });
    return r;
  }
  return null;
}

// Find all data objects associated with an HTMLElement, and return the merged
// result as a single data object, or return null if no data objects are found.
export function findElementData(elem: HTMLElement | null): HTMLData | null {
  if (!elem) return null;
  const datas: Array<HTMLData | null> = [];
  datas.push(elementData(elem, 'self'));
  datas.push(elementData(elem, 'descendant', true));
  datas.push(...elementData(elem, 'ancestor', false));
  const r = mergeElementData(datas);
  if (!r?.context) {
    const c = ofClass([...G.Tabs.map((t) => `cs-${t.module}`)], elem);
    if (c) {
      const context = c.type.substring(3);
      if (r) r.context = context;
    }
  }
  return r;
}
