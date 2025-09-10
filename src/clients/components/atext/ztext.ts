import C from '../../../constant.ts';
import Cache from '../../../cache.ts';
import {
  clone,
  escapeRE,
  findTreeNode,
  gbAncestorIDs,
  getSwordOptions,
  JSON_attrib_parse,
  JSON_attrib_stringify,
  nextTreeSibling,
  prevTreeSibling,
  stringHash,
} from '../../../common.ts';
import VerseKey from '../../../verseKey.ts';
import { getElementData } from '../../htmlData.ts';
import { G, GI } from '../../G.ts';
import { dString } from '../../../common.ts';
import addBookmarks from '../../bookmarks.tsx';
import {
  getNoteHTML,
  getChapterHeader,
  chapterChange,
  pageChange,
} from './zversekey.ts';
import { dictKeyToday, getDictEntryHTML } from './zdictionary.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type { PinPropsType, PlaceType } from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type RenderPromise from '../../renderPromise.ts';
import type { HTMLData } from '../../htmlData.ts';
import type { AtextPropsType } from './atext.tsx';

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
  renderPromise: RenderPromise,
  xulswordState?: AtextPropsType['xulswordState'],
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
  const options = getSwordOptions(show, type);
  if (ilModule) {
    const [, on] = C.SwordFilterValues;
    options["Strong's Numbers"] = on;
    options['Morphological Tags'] = on;
  }

  // Read Libsword according to module type
  switch (type) {
    case C.BIBLE: {
      if (location?.book && module) {
        const { book, chapter } = new VerseKey(
          location,
          renderPromise,
        ).location(G.Tab[module].v11n || null);
        if (ilModule) {
          const { text } = GI.LibSword.getChapterTextMulti(
            { text: '', notes: '' },
            renderPromise,
            `${module},${ilModule}`,
            `${book}.${chapter}`,
            false,
            options,
          );
          if (!renderPromise?.waiting()) {
            r.textHTML += text.replace(/interV2/gm, `cs-${ilModule}`);
          }
        } else if (
          GI.getBooksInVKModule([], renderPromise, module).includes(book)
        ) {
          // We needed to check that the module contains the book, because
          // LibSword will silently return text from elsewhere in a module
          // if the module does not include the requested book!
          const { text, notes } = GI.LibSword.getChapterText(
            { text: '', notes: '' },
            renderPromise,
            module,
            `${book}.${chapter}`,
            options,
          );
          if (!renderPromise?.waiting()) {
            r.textHTML += text;
            r.notes += notes;
          }
        }
      }
      break;
    }
    case C.COMMENTARY: {
      if (location?.book && module) {
        const { book, chapter } = new VerseKey(
          location,
          renderPromise,
        ).location(G.Tab[module].v11n || null);
        const { text, notes } = GI.LibSword.getChapterText(
          { text: '', notes: '' },
          renderPromise,
          module,
          `${book}.${chapter}`,
          options,
        );
        if (!renderPromise?.waiting()) {
          r.textHTML += text;
          r.notes += notes;
        }
      }
      break;
    }
    case C.GENBOOK: {
      if (modkey) {
        const { text, notes } = GI.LibSword.getGenBookChapterText(
          { text: '', notes: '' },
          renderPromise,
          module,
          modkey,
          options,
        );
        if (!renderPromise?.waiting()) {
          // Genbook notes are included at the end of textHTML.
          r.textHTML += text;
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
      const key = dictKeyToday(modkey, module);
      const keylist = GI.getAllDictionaryKeyList([], renderPromise, module);
      if (!renderPromise?.waiting()) {
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
                data,
              )}">${k1}</div>`;
            });
            Cache.write(html, 'keyHTML', module);
          }

          // Set the final results.
          const de = getDictEntryHTML(key, module, renderPromise, undefined);
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
        } else if (xulswordState) {
          xulswordState((prevState: typeof S.prefs.xulsword) => {
            const { keys } = clone(prevState);
            [keys[n]] = keylist;
            return { keys };
          });
        }
      }
      break;
    }
    default:
  }

  // Add bookmarks to text and notes
  if (show.usernotes) addBookmarks(r, props, renderPromise);

  // handle footnotes.
  if (G.Tab[module].isVerseKey) {
    const notetypes: Array<keyof PlaceType> = [
      'footnotes',
      'crossrefs',
      'usernotes',
    ];
    const shownb = {} as Record<(typeof notetypes)[number], boolean>;
    notetypes.forEach((nt) => {
      shownb[nt] = show[nt] && place && place[nt] === 'notebox';
    });
    if (
      Object.keys(shownb).some((s) => {
        return shownb[s as keyof PlaceType];
      })
    )
      r.noteHTML += getNoteHTML(
        r.notes,
        shownb,
        n,
        undefined,
        undefined,
        false,
        renderPromise,
      );
  }

  // Localize verse numbers to match the module
  const digits =
    (moduleLocale && GI.getLocaleDigits(null, renderPromise, moduleLocale)) ||
    null;
  if (G.Tab[module].isVerseKey && digits) {
    const verseNm = /(<sup class="versenum">)(\d+)(<\/sup>)/g;
    r.textHTML = r.textHTML.replace(
      verseNm,
      (_str, p1: string, p2: string, p3: string) => {
        return p1 + dString(p2, moduleLocale) + p3;
      },
    );
  }

  // Add chapter heading and intronotes
  if (
    r.textHTML &&
    G.Tab[module].isVerseKey &&
    show.headings &&
    location &&
    ilModuleOption
  ) {
    const headInfo = getChapterHeader(location, module, renderPromise);
    r.textHTML = headInfo.textHTML + r.textHTML;
    r.intronotes = headInfo.intronotes;
  }

  // Add versePerLineButton
  if (G.Tab[module].tabType === 'Texts') {
    r.textHTML = r.textHTML.replace(
      /(<span[^>]*class="vs\b[^>]*>)/,
      '$1<span class="versePerLineButton"><div></div></span>',
    );
  }

  return r;
}

// Change a dictionary to the previous or next key, or return null if that
// was not possible.
function dictionaryChange(atext: HTMLElement, next: boolean): string | null {
  const keyels = atext.getElementsByClassName('dictselectkey');
  let newkey;
  if (keyels?.[0]) {
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
  next: boolean,
  renderPromise: RenderPromise,
): string | null {
  if (module) {
    const toc = GI.genBookTreeNodes([], renderPromise, module);
    if (modkey && toc.length) {
      const node = findTreeNode(modkey, toc);
      if (node) {
        const { childNodes } = node;
        if (next) {
          const ns: TreeNodeInfo | null = nextTreeSibling(node, toc);
          return (
            (childNodes ? childNodes[0]?.id.toString() : null) ||
            ns?.id.toString() ||
            null
          );
        } else {
          const ps: TreeNodeInfo | null = prevTreeSibling(node, toc);
          const pn: string | undefined = gbAncestorIDs(modkey).pop();
          return ps?.id.toString() || pn?.toString() || null;
        }
      }
    }
    // If atext key isn't in the module and next is requested, return the first good key.
    if (next && toc.length) return toc[0].id.toString();
  }

  return null;
}

// Handle Atext prev/next event by returning a new PinProps state, or null
// if the request is not possible. IMPORTANT: If prevState is not provided,
// the returned state will be incomplete and should only be used as a boolean
// test of whether the requested change is possible or not.
export function textChange(
  atext: HTMLElement,
  next: boolean,
  renderPromise: RenderPromise,
  prevState?: PinPropsType,
): PinPropsType | Partial<PinPropsType> | null {
  const { columns: cx, module } = atext.dataset;
  const columns = Number(cx);
  if (!columns || !module) return null;
  const { type } = G.Tab[module];
  const [sbe] = Array.from(atext.getElementsByClassName('sb'));
  const newPartialPinProps: Partial<PinPropsType> = prevState || {};
  switch (type) {
    case C.BIBLE:
    case C.COMMENTARY: {
      let location;
      if (type === C.BIBLE && columns > 1) {
        location = pageChange(atext, next, renderPromise);
      } else {
        const [firstVerse] = Array.from(
          sbe.getElementsByClassName('vs'),
        ) as Array<HTMLElement | undefined>;
        if (firstVerse) {
          const p = getElementData(firstVerse);
          const { location: l } = p;
          if (l) {
            if (next) {
              location = chapterChange(l, 1, renderPromise);
            } else {
              location = chapterChange(l, -1, renderPromise);
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
          atext.dataset.data,
        ) as HTMLData;
        if (locationGB) {
          const { otherMod: m, key: k } = locationGB;
          const key = genbookChange(m, k, next, renderPromise);
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
