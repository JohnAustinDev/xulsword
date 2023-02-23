/* eslint-disable no-nested-ternary */
import C from '../constant';
import Cache from '../cache';
import G from './rg';
import { getMaxVerse, verseKey } from './rutil';

import type { AtextProps } from './viewport/atext';
import type {
  BookmarkFolderType,
  LocationGBType,
  LocationVKType,
  SwordFilterType,
  SwordFilterValueType,
} from '../type';
import type { LibSwordResponse } from './viewport/ztext';
import { SelectVKMType } from './libxul/vkselect';

type BookmarkMapType = { [key: string]: BookmarkInfoHTML[] };

type BookmarkInfoHTML = {
  id: string;
  n: number;
  note: string;
  noteLocale: string;
  location: LocationGBType | LocationVKType;
  classes: ('bmitem' | 'bmnote')[];
};

function osisRef(location: LocationGBType | LocationVKType): string {
  let osisref = 'unavailable';
  if ('v11n' in location) {
    const { book, chapter, verse } = verseKey(location).location('KJV');
    osisref = [book, chapter, verse].join('.');
  }
  return osisref;
}

function marker(bookmarkInfo: BookmarkInfoHTML, module: string): string {
  const { location, id, n } = bookmarkInfo;
  // This HTML follows osisxhtml_xs.cpp
  return `<span class="un" data-title="${n}.${osisRef(
    location
  )}.${module}" data-bmitem="${id}"></span>`;
}

export function getBookmarkMap(): BookmarkMapType {
  if (!Cache.has('bookmarkMap')) {
    const keyBmitemIDMap: BookmarkMapType = {};
    const kmap = (f: BookmarkFolderType): void => {
      f.childNodes.forEach((item) => {
        const { type, note } = item;
        if ('childNodes' in item) kmap(item);
        else if (type === 'bookmark' && note) {
          const { id, location: l, noteLocale } = item;
          let k = '';
          if (l && 'v11n' in l) {
            const kjvl = verseKey(l).location('KJV');
            const { book, chapter, verse } = kjvl;
            k = [book, chapter, verse, 'KJV'].join('.');
          } else if (l) {
            const { module: m, key } = l;
            k = [m, key].join(C.GBKSEP);
          }
          if (l && k) {
            const classes: BookmarkInfoHTML['classes'] = ['bmitem'];
            if (item.note) classes.push('bmnote');
            if (!(k in keyBmitemIDMap)) keyBmitemIDMap[k] = [];
            const n = keyBmitemIDMap[k].length + 1;
            keyBmitemIDMap[k].push({
              id,
              n,
              note,
              noteLocale,
              location: l,
              classes,
            });
          }
        }
      });
    };
    kmap(
      G.Prefs.getComplexValue(
        'manager.bookmarks',
        'bookmarks'
      ) as BookmarkFolderType
    );
    Cache.write(keyBmitemIDMap, 'bookmarkMap');
  }
  return Cache.read('bookmarkMap') as {
    [kjvkey: string]: BookmarkInfoHTML[];
  };
}

// Find the bookmarks associated with either a Bible chapter or module/key
// pair.
export function findBookmarks(
  location: LocationVKType | LocationGBType
): BookmarkInfoHTML[] {
  const bookmarkMap = getBookmarkMap();
  if ('v11n' in location) {
    const kjvl = verseKey(location).location('KJV');
    const { book, chapter } = kjvl;
    const chBookmarks: BookmarkInfoHTML[] = [];
    for (let x = 0; x <= getMaxVerse('KJV', `${book} ${chapter}`); x += 1) {
      const k = [book, chapter, x, 'KJV'].join('.');
      if (k in bookmarkMap) {
        chBookmarks.push(...bookmarkMap[k]);
      }
    }
    return chBookmarks;
  }
  if (location) {
    const { module, key } = location;
    const k = [module, key].join(C.GBKSEP);
    if (k in bookmarkMap) return bookmarkMap[k];
  }
  return [];
}

// Add note bookmarks to note HTML, or just return notes HTML.
export function addBookmarksToNotes(
  bookmarkInfos: BookmarkInfoHTML[],
  notes: string | '',
  module: string,
  sort?: boolean
): string {
  const notehtml = notes || `<div class="notes"></div>`;
  const ns = notehtml.match(/<div[^>]+>/);
  if (ns) {
    const divStart = ns[0];
    let newnotes = notehtml.replace(divStart, '');
    newnotes = newnotes.replace(/<\/div>$/, '');
    newnotes =
      bookmarkInfos
        .filter((n) => n.note)
        .reduce((p, un) => {
          const { id, location: l, n, note, noteLocale } = un;
          return `${p}<div class="nlist" data-title="un.${n}.${osisRef(
            l
          )}.${module}"><span class="cs-${noteLocale}" data-bmitem="${id}">${note}</span></div>`;
        }, '') + newnotes;
    if (sort) {
      const nlists = newnotes.split(/(?=<div class="nlist")/);
      const re =
        /<div class="nlist" data-title="[^."]*\.[^."]*\.([^"]+)\.[^."]*"/;
      newnotes = nlists
        .sort((a, b) => {
          const ma = a.match(re);
          const mb = b.match(re);
          const ia = Number(ma && ma[1].split('.')[2]) || 0;
          const ib = Number(mb && mb[1].split('.')[2]) || 0;
          return ia < ib ? -1 : ia > ib ? 1 : 0;
        })
        .join('');
    }
    return `${divStart}${newnotes}</div>`;
  }
  return '';
}

export function addBookmarksToTextVK(
  bookmarkInfos: BookmarkInfoHTML[],
  textHTML: string,
  module: string
): string {
  return textHTML.replaceAll(
    // This regex comes from xulsword.cpp:
    /(<span data-title="([^."]*)\.(\d+)\.(\d+)\.(\d+)\.([^."]*)" class="vs )([^"]*?")([^>]*?>)/g,
    (tag, start, bk, ch, vs, lv, m, cls, end) => {
      const kjvl = verseKey(
        [bk, ch, vs, lv, m].join('.'),
        (m && m in G.Tab && G.Tab[m]) || 'KJV'
      ).location('KJV');
      const { verse, lastverse } = kjvl;
      for (let x = verse || 1; x <= (lastverse || verse || 1); x += 1) {
        const infos: BookmarkInfoHTML[] = bookmarkInfos.filter(
          (info) => 'v11n' in info.location && info.location.verse === x
        );
        if (infos.length) {
          const markerHTML = infos
            .map((info) => marker(info, module))
            .filter(Boolean)
            .join('');
          const classes: Set<string> = new Set();
          infos.forEach((info) => {
            info.classes.forEach((c) => classes.add(c));
          });
          const ids = infos.map((info) => info.id).join(' ');
          return `${start}${Array.from(classes).join(
            ' '
          )} ${cls} data-bmitem="${ids}"${end}${markerHTML}`;
        }
      }
      return tag;
    }
  );
}

export function addBookmarksToTextGB(
  bookmarkInfos: BookmarkInfoHTML[],
  textHTML: string,
  module: string
): string {
  const markerHTML = bookmarkInfos
    .map((info) => marker(info, module[2]))
    .filter(Boolean)
    .join('');
  const classes: Set<string> = new Set();
  bookmarkInfos.forEach((info) => {
    info.classes.forEach((c) => classes.add(c));
  });
  const ids = bookmarkInfos.map((info) => info.id).join(' ');
  return textHTML.replace(/<div class="(cs-(\S+)[^"]*)"/, (_d, c) => {
    return `${markerHTML}<div class="${[c, ...classes].join(
      ' '
    )}" data-bmitem="${ids}"`;
  });
}

export default function addBookmarks(
  response: Pick<LibSwordResponse, 'textHTML' | 'notes'>,
  props: Pick<AtextProps, 'module' | 'location' | 'modkey'>
) {
  const { textHTML, notes } = response;
  const { module, location, modkey } = props;
  if (module && module in G.Tab) {
    const { isVerseKey } = G.Tab[module];
    let bmlocation: LocationGBType | LocationVKType | null = null;
    if (isVerseKey && location) bmlocation = location;
    else if (!isVerseKey && modkey) {
      bmlocation = { module, key: modkey };
    }
    if (bmlocation) {
      const bookmarks = findBookmarks(bmlocation);
      if (bookmarks.length) {
        response.notes = addBookmarksToNotes(bookmarks, notes, module);
        if (isVerseKey) {
          response.textHTML = addBookmarksToTextVK(bookmarks, textHTML, module);
        } else if (bookmarks.length) {
          response.textHTML = addBookmarksToTextGB(bookmarks, textHTML, module);
        }
      }
    }
  }
}

export function newLabel(l: SelectVKMType | LocationGBType): string {
  if ('v11n' in l) {
    const vk = verseKey(l);
    return vk.readable(undefined, true);
  }
  console.log(l);
  const ks = l.key.split(C.GBKSEP);
  const tab = l.module && l.module in G.Tab && G.Tab[l.module];
  ks.unshift(tab ? tab.description : l.module);
  while (ks[2] && ks[0] === ks[1]) {
    ks.shift();
  }
  return `${ks.shift()}: ${ks.join(C.GBKSEP)}`;
}

// Split a string from LibSword up into paragraphs
export function parseParagraphs(text: string): string[] {
  // Paragraph support was removed in xulsword 3.
  return [text];
}

export function getSampleText(l: LocationGBType | SelectVKMType): string {
  let r = '';
  if ('v11n' in l) {
    const vk = l as SelectVKMType;
    const { vkmod } = vk;
    if (vkmod in G.Tab && G.Tab[vkmod].isVerseKey) {
      r = G.LibSword.getVerseText(
        vk.vkmod,
        verseKey(vk).osisRef(),
        false
      ).substring(0, C.UI.BMProperties.maxSampleText);
    }
  } else {
    const { module, key, paragraph } = l;
    if (module && module in G.Tab) {
      // Set SWORD filter options
      const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
      Object.entries(C.SwordFilters).forEach((entry) => {
        [options[entry[0] as SwordFilterType]] = C.SwordFilterValues;
      });
      let text = '';
      if (G.Tab[module].type === C.GENBOOK) {
        text = G.LibSword.getGenBookChapterText(l.module, l.key, options);
      } else if (G.Tab[module].type === C.DICTIONARY) {
        text = G.LibSword.getDictionaryEntry(module, key, options);
      }
      const paragraphs = parseParagraphs(text);
      const i = paragraph && paragraphs[paragraph] ? paragraph : 0;
      r = paragraphs[i];
    }
  }
  return r
    .replace(/<[^>]+>/g, '')
    .substring(0, C.UI.BMProperties.maxSampleText);
}
