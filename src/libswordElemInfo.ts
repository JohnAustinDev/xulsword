/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prettier/prettier */
// TitleFormat below is valid with LibXulSword 1.3.1+
// TitleFormat is an object used to parse information from element classes
// and titles. Many of these are generated by libxulsword. The TitleFormat object
// is mainly used by the getElementInfo function below to retrieve any relevant
// info from an arbitrary DOM element. DOM elements must of course have their class
// and title pattern(s) included in TitleFormat for their infos to be retreivable.
// The TitleFormat class must always be the first class in the element's
// class list, and only the part before any "-" defines its TitleFormat class.
// If a null parameter value exists for a particular class expression, this
// signifies the value should be provided by context. NOTE: the sr,
// dt, and dtl class may have multiple ";" or " " separated references
// in their titles.

import { decodeOSISRef, ofClass } from './common';

export type ElemInfo = {
  type: string | null;
  title: string | null;
  reflist: string[] | null;
  bk: string | null;
  ch: string | number | null;
  vs: number | null;
  lv: number | null;
  mod: string | null;
  osisref: string | null;
  nid: number | null;
  ntype: string | null;
}

type ElemInfoIndex = {
  [key in keyof ElemInfo]?: number|null;
}

type Value = ElemInfoIndex & {
  re: RegExp
}

type ElemTypesType = {
  vs: Value[]; // verse
  fn: Value[]; // textual footnote marker (in verse-key modules)
  gfn: Value[]; // textual footnote marker (in non-verse-key modules)
  cr: Value[]; // cross-reference note marker in verse-key modules (may include a list of references)
  un: Value[]; // user note marker
  sr: Value[]; // scripture reference link
  dt: Value[]; // x-glossary link
  dtl: Value[]; // x-glosslink link or dictionary target-self link
  snbut: Value[]; // strong's number search button
  slist: Value[]; // member of LibSword search results list
  nlist: Value[]; // member of LibSword note list
  fnrow: Value[]; // notebox note-list row
  fnlink: Value[]; // notebox note-list row source link
  crref: Value[]; // notebox note-list cross-reference link
  listenlink: Value[]; // audio link
};

export const TitleFormat: ElemTypesType = {
  vs:     [ { re:new RegExp(/^(([^.]+)\.(\d+)\.(\d+))\.(\d+)\.([^.]+)$/),                                      bk:2,    ch:3,     vs:4,    lv:5,     mod:6, osisref:1 } ],
  fn:     [ { re:new RegExp(/^(\d+)\.(unavailable)\.([^.]+)$/),                                         nid:1, bk:null, ch:null,  vs:null, lv:null,  mod:3, osisref:2 },
            { re:new RegExp(/^(\d+)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/),                               nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  cr:     [ { re:new RegExp(/^(\d+)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/),                               nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 } ],
  un:     [ { re:new RegExp(/^(.+?)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/),                               nid:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:6, osisref:2 },
            { re:new RegExp(/^(.+?)\.[^.]+\.(.*)\.(\d+)\.([^.]+)$/),                                    nid:1, bk:null, ch:2,     vs:3,    lv:3,     mod:4 } ],
  sr:     [ { re:new RegExp(/^(unavailable)\.([^.]+)$/),                                            reflist:1, bk:null, ch:null,  vs:null, lv:null,  mod:2, osisref:1 },
            { re:new RegExp(/^((([^.]+)\.(\d+)\.(\d+))(;.*?)?)\.([^.]+)$/),                         reflist:1, bk:3,    ch:4,     vs:5,    lv:5,     mod:7, osisref:2 },
            { re:new RegExp(/^((([^.]+)\.(\d+)\.(\d+)\s*-\s*[^.]+\.\d+\.(\d+))(;.*?)?)\.([^.]+)$/), reflist:1, bk:3,    ch:4,     vs:5,    lv:6,     mod:8, osisref:2 },
            { re:new RegExp(/^(.*?)\.([^.]+)$/),                                                    reflist:1, bk:null, ch:null,  vs:null, lv:null,  mod:2 } ],
  gfn:    [ { re:new RegExp (/^(\d+)\.(fn|cr)\.(.*?)$/),                                           ntype:2, nid:1,                                   mod:3 } ],
  // dt and dtl allow [:.] as delineator for backward compatibility < 2.23 ([:] is correct)
  dt:     [ { re:new RegExp(/^((([^:.]+)[:.]([^.]+))(\s+[^:.]+[:.][^.]+)?)\.([^.]+)$/),      reflist:1, bk:null, ch:4,    vs:null, lv:null, mod:3, osisref:2 } ],
  dtl:    [ { re:new RegExp(/^((([^:.]+)[:.]([^.]+))(\s+[^:.]+[:.][^.]+)?)\.([^.]+)$/),      reflist:1, bk:null, ch:4,    vs:null, lv:null, mod:3, osisref:2 } ],
  snbut:  [ { re:new RegExp(/^((\S+):(\S+))\.([^.]+)$/),                                                        bk:null, ch:3,     vs:null, lv:null, mod:4, osisref:1 } ],
  fnrow:  [ { re:new RegExp(/^([^.]+)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/),                              nid:1, bk:3,    ch:4,     vs:5,    lv:5,    mod:6, osisref:2 } ],
  fnlink: [ { re:new RegExp(/^([^.]*)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/),                              nid:1, bk:3,    ch:4,     vs:5,    lv:5,    mod:6, osisref:2 } ],
  crref:  [ { re:new RegExp(/^(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/),                                              bk:2,    ch:3,     vs:4,    lv:4,    mod:5, osisref:1 },
            { re:new RegExp(/^(([^.]+)\.(\d+)\.(\d+)\.(\d+))\.([^.]+)$/),                                       bk:2,    ch:3,     vs:4,    lv:5,    mod:6, osisref:1 } ],
  nlist:  [ { re:new RegExp(/^(\w+)\.([^.]*)\.(([^.]+)\.(\d+)\.(\d+))\.([^.]+)$/),              ntype:1, nid:2, bk:4,    ch:5,     vs:6,    lv:6,    mod:7, osisref:3 },
            { re:new RegExp(/^(\w+)\.([^.]*)\.(([^.]+)(\.(0)(\.(0))?)?)\.([^.]+)$/),            ntype:1, nid:2, bk:4,    ch:6,     vs:8,    lv:8,    mod:9, osisref:3 },
            { re:new RegExp(/^(un)\.([^.]*)\.[^.]*\.(.*)\.(\d+)\.([^.]+)$/),                    ntype:1, nid:2, bk:null, ch:3,     vs:4,    lv:4,    mod:5 } ],
  slist:  [ { re:new RegExp(/^([^.]*)\.([^.]*)$/),                                                              bk:null, ch:1,     vs:null, lv:null, mod:2 },
            { re:new RegExp(/^(([^.]*)\.(\d+)\.(\d+))\.([^.]*)$/),                                              bk:2,    ch:3,     vs:4,    lv:4,    mod:5, osisref:1 } ],
  listenlink: [ { re:new RegExp(/^(([^.]+)\.(.*?)\.(\d+))\.([^.]+)$/),                                          bk:2,    ch:3,     vs:4,    lv:4,    mod:5, osisref:1 } ],
};

// This function will accept either raw HTML or a DOM element as "elem"
// NOTES ABOUT ENCODING:
// - nid: encoded with encodeURIComponent (for use in HTML tags)
// - osisref: encoded with _cp_ encoding (UTF8, and some other chars, require encoding in osisRef attributes)
// - reflist: is an array of UTF8 strings
// - ch: is UTF8 (may be a number or a key)
// - all other properties: are ASCII
export function getElementInfo(elem: string | HTMLElement): ElemInfo | null {
  // Info is parsed from className and dataTitle, so start by getting each
  let className;
  let title;
  if (typeof elem === 'string') {
    // If elem is string HTML, parse only the first tag
    const mt = elem.match(/^[^<]*<[^>]+data-title\s*=\s*["']([^"']*)["']/);
    if (mt !== null) [, title] = mt;
    const mc = elem.match(/^[^<]*<[^>]+class\s*=\s*["']([^"']*)["']/);
    if (mc !== null) [, className] = mc;
    if (!title || !className) return null;
  } else {
    if (!elem.className || !elem.dataset.title) return null;
    className = elem.className;
    title = elem.dataset.title;
  }

  // Read info using ...
  const r: ElemInfo = {
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
  if (t === null || !(t in TitleFormat)) return null;
  const type = t as keyof typeof TitleFormat;

  r.type = type;
  r.title = title;
  let unmatched = true;
  for (let i = 0; i < TitleFormat[type].length; i += 1) {
    const m = title.match(TitleFormat[type][i].re);
    // eslint-disable-next-line no-continue
    if (!m) continue;
    unmatched = false;
    // jsdump("i=" + i + "\n" + uneval(m));
    const entries = Object.entries(TitleFormat[type][i]);
    entries.forEach((entry) => {
      const [prop, value] = entry;
      if (prop !== 're') {
        const p = prop as keyof ElemInfo;
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

export function getPopupInfo(elem: string | HTMLElement): ElemInfo {
  let info = getElementInfo(elem);
  if (!info) {
    let title: string | undefined;
    let type: string | undefined;
    let atext: ReturnType<typeof ofClass> | undefined;
    if (typeof elem !== 'string') {
      const c = ofClass(['sn', 'introlink', 'noticelink'], elem);
      title = c?.element.dataset.title;
      type = c?.type;
      atext = ofClass(['atext'], elem);
    } else {
      // If elem is a string, parse only the first tag
      const mt = elem.match(/^[^<]*<[^>]+data-title\s*=\s*["']([^"']*)["']/);
      if (mt !== null) [, title] = mt;
      const mc = elem.match(/^[^<]*<[^>]+class\s*=\s*["']([^"']*)["']/);
      if (mc !== null) {
        const [, className] = mc;
        // Use first class as type
        [type] = className.split(/\s+/);
      }
    }
    info = {
      type: type || 'unknown',
      title,
      reflist: [''],
      bk: '',
      ch: 0,
      vs: 0,
      lv: 0,
      mod: atext?.element.dataset.module,
      osisref: '',
      nid: 0,
      ntype: '',
    } as ElemInfo;
  }
  return info;
}
