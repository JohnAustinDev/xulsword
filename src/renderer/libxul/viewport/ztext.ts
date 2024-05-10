/* eslint-disable no-nested-ternary */
/* eslint-disable no-restricted-syntax */
import C from '../../../constant.ts';
import Cache from '../../../cache.ts';
import {
  dString,
  escapeRE,
  JSON_attrib_parse,
  JSON_attrib_stringify,
  stringHash,
  trySyncOrRenderPromise,
} from '../../../common.ts';
import { getElementData } from '../../htmlData.ts';
import G, { GA } from '../../rg.ts';
import addBookmarks from '../../bookmarks.ts';
import {
  getNoteHTML,
  getChapterHeading,
  chapterChange,
  pageChange,
} from './zversekey.ts';
import { dictKeyToday, getDictEntryGCalls, getDictEntryHTML } from './zdictionary.ts';

import type {
  AtextPropsType,
  PinPropsType,
  PlaceType,
  SwordFilterType,
  SwordFilterValueType,
} from '../../../type.ts';
import type RenderPromise from '../../renderPromise.ts';
import type { HTMLData } from '../../htmlData.ts';
import type { AtextStateType } from './atext.tsx';

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
  n: number,
  newState?: Partial<AtextStateType>,
  renderPromise?: RenderPromise
): LibSwordResponse {
  const r: LibSwordResponse = {
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
      if (location && location.book && module) {
        const { book, chapter } = location;
        if (ilModule) {
          const chtxt = trySyncOrRenderPromise(
            G, GA,
            ['LibSword', 'getChapterTextMulti', [
              `${module},${ilModule}`,
              `${book}.${chapter}`,
              false,
              options
            ]],
            renderPromise
          );
          if (!renderPromise?.waiting() && typeof chtxt === 'string') {
            r.textHTML += chtxt.replace(/interV2/gm, `cs-${ilModule}`);
          }
        } else if (G.getBooksInVKModule(module).includes(book)) {
          // We needed to check that the module contains the book, because
          // LibSword will silently return text from elsewhere in a module
          // if the module does not include the requested book!
          const results = trySyncOrRenderPromise(
            G, GA,
            ['callBatch', null, [[
              ['LibSword', 'getChapterText', [
                module,
                `${book}.${chapter}`,
                options
              ]],
              ['LibSword', 'getNotes', []]
            ]]],
            renderPromise
          );
          if (!renderPromise?.waiting() && Array.isArray(results)) {
            r.textHTML += results[0];
            r.notes += results[1];
          }
        }
      }
      break;
    }
    case C.COMMENTARY: {
      if (location && location.book && module) {
        const { book, chapter } = location;
        const results = trySyncOrRenderPromise(
          G, GA,
          ['callBatch', null, [[
            ['LibSword', 'getChapterText', [
              module,
              `${book}.${chapter}`,
              options
            ]],
            ['LibSword', 'getNotes', []]
          ]]],
          renderPromise
        );
        if (!renderPromise?.waiting() && Array.isArray(results)) {
          r.textHTML += results[0];
          r.notes += results[1];
        }
      }
      break;
    }
    case C.GENBOOK: {
      if (modkey) {
        const results = trySyncOrRenderPromise(
          G, GA,
          ['callBatch', null, [[
            ['LibSword', 'getGenBookChapterText', [
              module,
              modkey,
              options
            ]],
            ['LibSword', 'getNotes', []]
          ]]],
          renderPromise
        );
        if (!renderPromise?.waiting() && Array.isArray(results)) {
          r.textHTML += results[0];
          r.noteHTML += results[1];
        }
      }
      break;
    }
    case C.DICTIONARY: {
      // For dictionaries, noteHTML is a key selector. Cache both
      // the keyList and the key selector for a big speedup.
      // Cache is used rather than memoization when there is a strictly
      // limited number of cache possibliities (ie. one per module).
      // Cache is also used for DailyDevotion - if the key is not in the
      // Cache use today's date instead of the key.
      const results = trySyncOrRenderPromise(
        G, GA,
        ['callBatch', null, [[
          ['getAllDictionaryKeyList', null, [module]],
          ...getDictEntryGCalls(modkey, module),
        ]]],
        renderPromise
      );
      if (!renderPromise?.waiting() && Array.isArray(results)) {
        results.shift(); // drop the first result
        const keylist = results.shift() as string[];
        const key = dictKeyToday(modkey, module);
        if (key && keylist.includes(key)) {
          // Build and cache the selector list.
          if (!Cache.has('keyHTML', module)) {
            let html = '';
            keylist.forEach((k1: any) => {
              const id = `${stringHash(k1)}.0`;
              const data: HTMLData = {
                type: 'dictkey',
                locationGB: { otherMod: module, key: k1 },
              };
              html += `<div id="${id}" class="dictkey" data-data="${JSON_attrib_stringify(
                data
              )}">${k1}</div>`;
            });
            Cache.write(html, 'keyHTML', module);
          }

          // Set the final results.
          let de = getDictEntryHTML(key, module, undefined, [results as [string, string, string]]);
          r.textHTML += `<div class="dictentry">${de}</div>`;
          const sel = new RegExp(`(dictkey)([^>]*">${escapeRE(key)}<)`);
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
        } else if (newState?.pin) {
          newState.pin = {
            ...newState.pin,
            modkey: keylist[0],
          };
        }
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
    dString(G.getLocaleDigits(true), 1, moduleLocale) !== dString(G.getLocaleDigits(true), 1, 'en')
  ) {
    const verseNm = new RegExp('(<sup class="versenum">)(\\d+)(</sup>)', 'g');
    r.textHTML = r.textHTML.replace(verseNm, (_str, p1, p2, p3) => {
      return p1 + dString(G.getLocaleDigits(true), p2, moduleLocale) + p3;
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
    const headInfo = getChapterHeading(location, module);
    r.textHTML = headInfo.textHTML + r.textHTML;
    r.intronotes = headInfo.intronotes;
  }

  // Add versePerLineButton
  if (G.Tab[module].tabType === 'Texts') {
    r.textHTML = r.textHTML.replace(
      /(<span[^>]*class="vs\b[^>]*>)/,
      '$1<span class="versePerLineButton"><div></div></span>'
    );
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
    tocs = G.LibSword.getGenBookTableOfContents(module);
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
): PinPropsType | Partial<PinPropsType> | null {
  const { columns: cx, module } = atext.dataset;
  const columns = Number(cx);
  if (!columns || !module) return null;
  const { type } = G.Tab[module];
  const sbe = atext.getElementsByClassName('sb')[0];
  const newPartialPinProps: Partial<PinPropsType> = prevState || {};
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
          const p = getElementData(firstVerse);
          const { location: l } = p;
          if (l) {
            if (next) {
              location = chapterChange(l, 1);
            } else {
              location = chapterChange(l, -1);
            }
          }
        }
      }
      if (location) {
        newPartialPinProps.location = location;
      } else return null;
      break;
    }
    case C.GENBOOK: {
      if (atext.dataset.data) {
        const { locationGB } = JSON_attrib_parse(
          atext.dataset.data
        ) as HTMLData;
        if (locationGB) {
          const { otherMod: m, key: k } = locationGB;
          const key = genbookChange(m, k, next);
          if (key) {
            newPartialPinProps.modkey = key;
          } else return null;
        }
      }
      break;
    }
    case C.DICTIONARY: {
      const key = dictionaryChange(atext, next);
      if (key) {
        newPartialPinProps.modkey = key;
      } else return null;
      break;
    }
    default:
  }
  if (!prevState) return newPartialPinProps;
  const newPinProps = newPartialPinProps as PinPropsType;
  newPinProps.scroll = null;
  if (type === C.BIBLE && columns > 1) {
    newPinProps.scroll = next
      ? { verseAt: 'top' }
      : {
          verseAt: 'bottom',
          skipWindowUpdate: true,
        };
  } else if (type === C.BIBLE || type === C.COMMENTARY) {
    newPinProps.scroll = { verseAt: 'top' };
  }
  if (type === C.BIBLE) {
    newPinProps.selection = null;
  }
  if (newPinProps && Object.keys(newPinProps).length) return newPinProps;
  return null;
}
