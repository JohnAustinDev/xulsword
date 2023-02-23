/* eslint-disable no-nested-ternary */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
import C from '../../constant';
import Cache from '../../cache';
import { dString, escapeRE, stringHash } from '../../common';
import { getElementInfo } from '../../libswordElemInfo';
import G from '../rg';
import addBookmarks from '../bookmarks';
import {
  getNoteHTML,
  getChapterHeading,
  chapterChange,
  pageChange,
} from './zversekey';
import { getDictEntryHTML } from './zdictionary';

import type {
  AtextPropsType,
  LocationVKType,
  PinPropsType,
  PlaceType,
  SwordFilterType,
  SwordFilterValueType,
} from '../../type';

export type LibSwordResponse = {
  textHTML: string;
  noteHTML: string;
  notes: string;
  intronotes: string;
};

export function libswordText(
  props: Pick<
    AtextPropsType,
    | 'module'
    | 'ilModule'
    | 'ilModuleOption'
    | 'location'
    | 'modkey'
    | 'place'
    | 'show'
  >,
  n: number
): LibSwordResponse {
  const r = {
    textHTML: '',
    noteHTML: '',
    notes: '',
    intronotes: '',
  };
  const { module, ilModule, ilModuleOption, location, modkey, place, show } =
    props;
  if (!module || !show) return r;

  const { type } = G.Tab[module];
  const moduleLocale = G.Config[module].AssociatedLocale;

  // Set SWORD filter options
  const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
  Object.entries(C.SwordFilters).forEach((entry) => {
    const sword = entry[0] as SwordFilterType;
    let showi = show[entry[1]] ? 1 : 0;
    if (C.AlwaysOn[type].includes(sword)) showi = 1;
    options[sword] = C.SwordFilterValues[showi];
  });
  if (ilModule) {
    const [, on] = C.SwordFilterValues;
    options["Strong's Numbers"] = on;
    options['Morphological Tags'] = on;
  }

  // Read Libsword according to module type
  switch (type) {
    case C.BIBLE: {
      if (
        location &&
        module &&
        G.getBooksInModule(module).includes(location.book)
      ) {
        const { book, chapter } = location;
        if (ilModule) {
          r.textHTML += G.LibSword.getChapterTextMulti(
            `${module},${ilModule}`,
            `${book}.${chapter}`,
            false,
            options
          ).replace(/interV2/gm, `cs-${ilModule}`);
        } else {
          r.textHTML += G.LibSword.getChapterText(
            module,
            `${book}.${chapter}`,
            options
          );
          r.notes += G.LibSword.getNotes();
        }
      }
      break;
    }
    case C.COMMENTARY: {
      if (
        location &&
        module &&
        G.getBooksInModule(module).includes(location.book)
      ) {
        const { book, chapter } = location;
        r.textHTML += G.LibSword.getChapterText(
          module,
          `${book}.${chapter}`,
          options
        );
        r.notes += G.LibSword.getNotes();
      }
      break;
    }
    case C.GENBOOK: {
      if (modkey) {
        r.textHTML += G.LibSword.getGenBookChapterText(module, modkey, options);
        r.noteHTML += G.LibSword.getNotes();
      }
      break;
    }
    case C.DICTIONARY: {
      G.LibSword.setGlobalOptions(options);
      // For dictionaries, noteHTML is a key selector. Cache both
      // the keyList and the key selector for a big speedup.
      // Cache is used rather than memoization when there is a strictly
      // limited number of cache possibliities (ie. one per module).
      if (!Cache.has('keylist', module)) {
        let list: string[] =
          G.LibSword.getAllDictionaryKeys(module).split('<nx>');
        list.pop();
        // KeySort entry enables localized list sorting by character collation.
        // Square brackets are used to separate any arbitrary JDK 1.4 case
        // sensitive regular expressions which are to be treated as single
        // characters during the sort comparison. Also, a single set of curly
        // brackets can be used around a regular expression which matches any
        // characters/patterns that need to be ignored during the sort comparison.
        // IMPORTANT: Any square or curly bracket within regular expressions must
        // have had an additional backslash added before it.
        const sort0 = G.LibSword.getModuleInformation(module, 'KeySort');
        if (sort0 !== C.NOTFOUND) {
          const sort = `-${sort0}0123456789`;
          const getignRE = /(?<!\\)\{(.*?)(?<!\\)\}/; // captures the ignore regex
          const getsrtRE = /^\[(.*?)(?<!\\)\]/; // captures sorting regexes
          const getescRE = /\\(?=[{}[\]])/g; // matches the KeySort escapes
          const ignoreREs: RegExp[] = [/\s/];
          const ignREm = sort.match(getignRE);
          if (ignREm)
            ignoreREs.push(new RegExp(ignREm[1].replace(getescRE, '')));
          let sort2 = sort.replace(getignRE, '');
          let sortREs: [number, number, RegExp][] = [];
          for (let i = 0; sort2.length; i += 1) {
            let re = sort2.substring(0, 1);
            let rlen = 1;
            const mt = sort2.match(getsrtRE);
            if (mt) {
              [, re] = mt;
              rlen = re.length + 2;
            }
            sortREs.push([i, re.length, new RegExp(`^(${re})`)]);
            sort2 = sort2.substring(rlen);
          }
          sortREs = sortREs.sort((a, b) => {
            const [, alen] = a;
            const [, blen] = b;
            if (alen > blen) return -1;
            if (alen < blen) return 1;
            return 0;
          });
          list = list.sort((aa, bb) => {
            let a = aa;
            let b = bb;
            ignoreREs.forEach((re) => {
              a = aa.replace(re, '');
              b = bb.replace(re, '');
            });
            for (; a.length && b.length; ) {
              let x;
              let am;
              let bm;
              for (x = 0; x < sortREs.length; x += 1) {
                const [, , re] = sortREs[x];
                if (am === undefined && re.test(a)) am = sortREs[x];
                if (bm === undefined && re.test(b)) bm = sortREs[x];
              }
              if (am !== undefined && bm !== undefined) {
                const [ia, , rea] = am;
                const [ib, , reb] = bm;
                if (ia < ib) return -1;
                if (ia > ib) return 1;
                a = a.replace(rea, '');
                b = b.replace(reb, '');
              } else if (am !== undefined && bm === undefined) {
                return -1;
              } else if (am === undefined && bm !== undefined) {
                return 1;
              }
              const ax = a.charCodeAt(0);
              const bx = b.charCodeAt(0);
              if (ax < bx) return -1;
              if (ax > bx) return 1;
              a = a.substring(1);
              b = b.substring(1);
            }
            if (a.length && !b.length) return -1;
            if (!a.length && b.length) return 1;
            return 0;
          });
        }
        Cache.write(list, 'keylist', module);
      }

      // Get the actual key.
      let key = modkey;
      const keylist = Cache.read('keylist', module);
      if (!key || !keylist.includes(key)) [key] = keylist;
      if (key) {
        if (key === 'DailyDevotionToday') {
          const today = new Date();
          const mo = today.getMonth() + 1;
          const dy = today.getDate();
          key = `${mo < 10 ? '0' : ''}${String(mo)}.${dy < 10 ? '0' : ''}${dy}`;
        }

        // Build and cache the selector list.
        if (!Cache.has('keyHTML', module)) {
          let html = '';
          Cache.read('keylist', module).forEach((k1: any) => {
            const id = `${stringHash(k1)}.0`;
            html += `<div id="${id}" class="dict-key">${k1}</div>`;
          });
          Cache.write(html, 'keyHTML', module);
        }

        // Set the final results
        const de = getDictEntryHTML(key, module, true);
        r.textHTML += `<div class="dictentry">${de}</div>`;
        const sel = new RegExp(`(dict-key)(">${escapeRE(key)}<)`);
        const list = Cache.read('keyHTML', module)
          .replace(sel, '$1 dictselectkey$2')
          .replace(/(?<=id="[^"]+\.)0(?=")/g, n.toString());
        r.noteHTML += `
          <div class="dictlist">
            <div class="headerbox">
              <input type="text" value="${key}" class="cs-${module} dictkeyinput" spellcheck="false"/ >
            </div>
            <div class="keylist">${list}</div>
          </div>`;
      }
      break;
    }
    default:
  }

  // Add bookmarks to text and notes
  if (show.usernotes) addBookmarks(r, props);

  // handle footnotes.
  if (G.Tab[module].isVerseKey) {
    const notetypes: (keyof PlaceType)[] = [
      'footnotes',
      'crossrefs',
      'usernotes',
    ];
    const shownb: any = {};
    notetypes.forEach((nt) => {
      shownb[nt] = show[nt] && place && place[nt] === 'notebox';
    });
    if (
      Object.keys(shownb).some((s) => {
        return shownb[s];
      })
    )
      r.noteHTML += getNoteHTML(r.notes, shownb, n);
  }

  // Localize verse numbers to match the module
  if (
    G.Tab[module].isVerseKey &&
    moduleLocale &&
    dString(G.i18n, 1, moduleLocale) !== dString(G.i18n, 1, 'en')
  ) {
    const verseNm = new RegExp('(<sup class="versenum">)(\\d+)(</sup>)', 'g');
    r.textHTML = r.textHTML.replace(verseNm, (_str, p1, p2, p3) => {
      return p1 + dString(p2, moduleLocale) + p3;
    });
  }

  // Add chapter heading and intronotes
  if (
    G.Tab[module].isVerseKey &&
    show.headings &&
    r.textHTML &&
    location &&
    ilModuleOption
  ) {
    const headInfo = getChapterHeading(
      location,
      module,
      ilModuleOption,
      ilModule
    );
    r.textHTML = headInfo.textHTML + r.textHTML;
    r.intronotes = headInfo.intronotes;
  }

  return r;
}

// Change a dictionary to the previous or next key, or return null if that
// was not possible.
function dictionaryChange(atext: HTMLElement, next: boolean): string | null {
  const keyels = atext.getElementsByClassName('dictselectkey');
  let newkey;
  if (keyels && keyels[0]) {
    let key = keyels[0] as any;
    key = next ? key.nextSibling : key.previousSibling;
    if (key) newkey = key.innerText;
  }
  return newkey || null;
}

// Change a general book to the previous or next chapter.
export function genbookChange(
  module: string,
  modkey: string,
  next: boolean
): string | null {
  let tocs: string[] = [];
  if (module) {
    if (!Cache.has('genbkTOC', module)) {
      Cache.write(
        G.LibSword.getGenBookTableOfContents(module),
        'genbkTOC',
        module
      );
    }
    tocs = Cache.read('genbkTOC', module);
    if (modkey) {
      const toc = tocs.indexOf(modkey);
      if (toc !== -1) {
        if (next && toc + 1 < tocs.length) return tocs[toc + 1];
        if (!next && toc - 1 > -1) return tocs[toc - 1];
        return null;
      }
    }
  }
  // If atext key isn't in the module and next is requested, return the first good key.
  if (next && tocs.length) return tocs[0];
  return null;
}

// Handle Atext prev/next event by returning a new PinProps state, or null
// if the request is not possible. IMPORTANT: If prevState is not provided,
// the returned state will be incomplete and should only be used as a boolean
// test of whether the requested change is possible or not.
export function textChange(
  atext: HTMLElement,
  next: boolean,
  prevState?: PinPropsType
): PinPropsType | null {
  const { columns: cx, module, index } = atext.dataset;
  const panelIndex = Number(index);
  const columns = Number(cx);
  if (!columns || !module) return null;
  const { type } = G.Tab[module];
  const sbe = atext.getElementsByClassName('sb')[0];
  const newPinProps = prevState || C.PinProps;
  switch (type) {
    case C.BIBLE:
    case C.COMMENTARY: {
      let location;
      if (type === C.BIBLE && columns > 1) {
        location = pageChange(atext, next);
      } else {
        const firstVerse = sbe.getElementsByClassName('vs')[0] as
          | HTMLElement
          | undefined;
        if (firstVerse) {
          const p = getElementInfo(firstVerse);
          const t = (module && G.Tab[module]) || null;
          const v11n = t?.v11n || null;
          const chapter = p && !Number.isNaN(Number(p.ch)) ? Number(p.ch) : 0;
          if (p && p.bk && chapter && v11n) {
            const vk: LocationVKType = {
              book: p.bk,
              chapter,
              verse: 1,
              v11n,
            };
            if (next) {
              location = chapterChange(vk, 1);
            } else {
              location = chapterChange(vk, -1);
            }
          }
        }
      }
      if (location) {
        newPinProps.location = location;
      } else return null;
      break;
    }
    case C.GENBOOK: {
      const { module: m, modkey } = atext.dataset;
      if (m && modkey) {
        const key = genbookChange(m, modkey, next);
        if (key) {
          newPinProps.modkey = key;
        } else return null;
      }
      break;
    }
    case C.DICTIONARY: {
      const key = dictionaryChange(atext, next);
      if (key) {
        newPinProps.modkey = key;
      } else return null;
      break;
    }
    default:
  }
  if (!prevState) return newPinProps;
  newPinProps.scroll = null;
  if (type === C.BIBLE && columns > 1) {
    const skipTextUpdate: boolean[] = [];
    atext.parentNode?.childNodes.forEach((_n, i) => {
      skipTextUpdate[i] = panelIndex !== i;
    });
    newPinProps.scroll = next
      ? { verseAt: 'top' }
      : {
          verseAt: 'bottom',
          skipWindowUpdate: true,
          skipTextUpdate,
        };
  } else if (type === C.BIBLE || type === C.COMMENTARY) {
    newPinProps.scroll = { verseAt: 'top' };
  }
  if (type === C.BIBLE) {
    newPinProps.selection = null;
  }
  return newPinProps && Object.keys(newPinProps).length ? newPinProps : null;
}
