/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlaceType, SwordFilterType, SwordFilterValueType } from '../../type';
import C from '../../constant';
import Cache from '../../cache';
import { dString, escapeRE, stringHash } from '../../common';
import G from '../rg';
import { getNoteHTML, getChapterHeading } from './zversekey';
import { getDictEntryHTML, getDictSortedKeyList } from './zdictionary';

import type { AtextProps, LibSwordResponse } from './atext';

export function addUserNotes(content: LibSwordResponse, props: AtextProps) {}

export function libswordText(props: AtextProps, n: number): LibSwordResponse {
  const { module, ilModule, book, chapter, modkey, place, show } = props;

  const r = {
    headHTML: '',
    textHTML: '',
    noteHTML: '',
    notes: '',
    intronotes: '',
  };

  if (!module) return r;

  const { type } = G.Tab[module];
  let moduleLocale = G.ModuleConfigs[module].AssociatedLocale;
  if (moduleLocale === C.NOTFOUND) moduleLocale = '';

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
  G.LibSword.setGlobalOptions(options);

  // Read Libsword according to module type
  switch (type) {
    case C.BIBLE: {
      if (
        module &&
        module in G.BooksInModule &&
        G.BooksInModule[module].includes(book)
      ) {
        if (ilModule) {
          r.textHTML += G.LibSword.getChapterTextMulti(
            `${module},${ilModule}`,
            `${book}.${chapter}`
          ).replace(/interV2/gm, `cs-${ilModule}`);
        } else {
          r.textHTML += G.LibSword.getChapterText(module, `${book}.${chapter}`);
          r.notes += G.LibSword.getNotes();
        }
      }
      break;
    }
    case C.COMMENTARY: {
      if (
        module &&
        module in G.BooksInModule &&
        G.BooksInModule[module].includes(book)
      ) {
        r.textHTML += G.LibSword.getChapterText(module, `${book}.${chapter}`);
        r.notes += G.LibSword.getNotes();
      }
      break;
    }
    case C.DICTIONARY: {
      // For dictionaries, noteHTML is a key selector. Cache both
      // the keyList and the key selector for a big speedup.
      // Cache is used rather than memoization when there is a strictly
      // limited number of cache possibliities (ie. one per module).
      if (!Cache.has('keylist', module)) {
        let list: string[] =
          G.LibSword.getAllDictionaryKeys(module).split('<nx>');
        list.pop();
        const sort = G.LibSword.getModuleInformation(module, 'KeySort');
        if (sort !== C.NOTFOUND) {
          list = getDictSortedKeyList(list, `${sort}0123456789`);
        }
        Cache.write(list, 'keylist', module);
      }

      // Get the actual key.
      let key = modkey;
      if (!key) [key] = Cache.read('keylist', module);
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
      break;
    }
    case C.GENBOOK: {
      r.textHTML += G.LibSword.getGenBookChapterText(module, modkey);
      r.noteHTML += G.LibSword.getNotes();
      break;
    }
    default:
  }

  // Add usernotes to text
  if (props.show.usernotes) addUserNotes(r, props);

  // handle footnotes.
  // NOTE: This step is by far the slowest part of Atext render,
  // particularly when crossrefs include many links.
  if (G.Tab[module].isVerseKey) {
    const notetypes: (keyof PlaceType)[] = [
      'footnotes',
      'crossrefs',
      'usernotes',
    ];
    const shownb: any = {};
    notetypes.forEach((nt) => {
      shownb[nt] = show[nt] && place[nt] === 'notebox';
    });
    if (
      Object.keys(shownb).some((s) => {
        return shownb[s];
      })
    )
      r.noteHTML += getNoteHTML(r.notes, module, shownb, n);
  }

  // Localize verse numbers to match the module
  if (
    G.Tab[module].isVerseKey &&
    moduleLocale &&
    dString(1, moduleLocale) !== dString(1, 'en')
  ) {
    const verseNm = new RegExp('(<sup class="versenum">)(\\d+)(</sup>)', 'g');
    r.textHTML = r.textHTML.replace(verseNm, (_str, p1, p2, p3) => {
      return p1 + dString(p2, moduleLocale) + p3;
    });
  }

  // Add chapter heading and intronotes
  if (G.Tab[module].isVerseKey && show.headings && r.textHTML) {
    const headInfo = getChapterHeading(props);
    r.textHTML = headInfo.textHTML + r.textHTML;
    r.intronotes = headInfo.intronotes;
  }

  return r;
}
