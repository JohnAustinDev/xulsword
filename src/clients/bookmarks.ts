import Cache from '../cache.ts';
import { cloneAny, getSwordOptions, localizeBookmark } from '../common.ts';
import C from '../constant.ts';
import type S from '../defaultPrefs.ts';
import { G, GI } from './G.ts';
import { updateDataAttribute, verseKey } from './htmlData.ts';
import { getMaxVerse } from './common.ts';
import bookmarkItemIcon from './app/bmManager/bookmarkItemIcon.tsx';

import type {
  BookmarkFolderType,
  BookmarkItemType,
  BookmarkTreeNode,
  BookmarkType,
  LocationORType,
  LocationVKCommType,
  LocationVKType,
  SwordFilterType,
  SwordFilterValueType,
  V11nType,
} from '../type.ts';
import type { HTMLData } from './htmlData.ts';
import type { AtextProps } from './components/atext/atext.tsx';
import type { LibSwordResponse } from './components/atext/ztext.ts';
import type { SelectVKType } from './components/libxul/selectVK.tsx';
import type RenderPromise from './renderPromise.ts';

type BookmarkMapType = Record<string, BookmarkInfoHTML[]>;

type BookmarkInfoHTML = {
  id: string;
  n: number;
  note: string;
  noteLocale: string;
  location: LocationORType | LocationVKType;
  classes: Array<'bmitem' | 'bmnote'>;
};

export function bmOsisRef(location: LocationORType | LocationVKType): string {
  let osisref = 'unavailable';
  if ('v11n' in location) {
    const { book, chapter, verse } = verseKey(location).location('KJV');
    osisref = [book, chapter, verse].join('.');
  }
  return osisref;
}

function bmInfoToData(
  type: HTMLData['type'],
  bookmarkInfo: BookmarkInfoHTML,
  module: string,
): HTMLData {
  const { location, id, n } = bookmarkInfo;
  return {
    type,
    context: module,
    reflist: [],
    location:
      'v11n' in location ? verseKey(location).location('KJV') : undefined,
    locationGB: !('v11n' in location) ? location : undefined,
    bmitem: id,
    nid: n,
    title: '',
  };
}

function marker(bookmarkInfo: BookmarkInfoHTML, module: string): string {
  const { n, location } = bookmarkInfo;
  let osisref = 'unavailable';
  if (location && 'v11n' in location) {
    const { book, chapter, verse } = location;
    osisref = `${book}.${chapter}.${verse}`;
  }
  return updateDataAttribute(
    // Match other notes from osis2xhtml_xs.cpp
    `<span class="un" data-title="${n}.${osisref}.${module}"></span>`,
    bmInfoToData('un', bookmarkInfo, module),
  );
}

export function getBookmarkInfo(
  bookmark: BookmarkType,
): BookmarkInfoHTML | null {
  const { id, note, noteLocale, location } = localizeBookmark(
    G,
    verseKey,
    bookmark,
  ) as BookmarkType;
  if (location) {
    const classes: BookmarkInfoHTML['classes'] = ['bmitem'];
    if (note) classes.push('bmnote');
    return {
      id,
      n: 1,
      note,
      noteLocale,
      location,
      classes,
    };
  }
  return null;
}

export function getBookmarkMap(): BookmarkMapType {
  if (!Cache.has('bookmarkMap')) {
    const keyBmitemIDMap: BookmarkMapType = {};
    const kmap = (f: BookmarkFolderType): void => {
      f.childNodes.forEach((item) => {
        const { type, tabType, note } = item;
        if ('childNodes' in item) kmap(item);
        else if (type === 'bookmark' && note) {
          const { location } = item;
          let k = '';
          if (location && 'v11n' in location) {
            const { vkMod } = location;
            const kjvl = verseKey(location).location('KJV');
            const { book, chapter, verse } = kjvl;
            k = [book, chapter, verse, 'KJV'].join('.');
            if (tabType === 'Comms') k += `.${vkMod}`;
          } else if (location) {
            const { otherMod: module, key } = location;
            k = [module, key].join(C.GBKSEP);
          }
          const info = getBookmarkInfo(item);
          if (info && location && k) {
            if (!(k in keyBmitemIDMap)) keyBmitemIDMap[k] = [];
            info.n = keyBmitemIDMap[k].length + 1;
            keyBmitemIDMap[k].push(info);
          }
        }
      });
    };
    kmap(
      G.Prefs.getComplexValue(
        'rootfolder',
        'bookmarks',
      ) as typeof S.bookmarks.rootfolder,
    );
    Cache.write(keyBmitemIDMap, 'bookmarkMap');
  }
  return Cache.read('bookmarkMap') as Record<string, BookmarkInfoHTML[]>;
}

// Find the bookmarks associated with either a Bible chapter or module/key
// pair.
export function findBookmarks(
  location: LocationVKType | LocationORType | SelectVKType,
  renderPromise: RenderPromise,
): BookmarkInfoHTML[] {
  const bookmarkMap = getBookmarkMap();
  if (Object.keys(bookmarkMap).length) {
    if ('v11n' in location) {
      const kjvl = verseKey(location).location('KJV');
      const { book, chapter } = kjvl;
      const chBookmarks: BookmarkInfoHTML[] = [];
      for (
        let x = 0;
        x <= getMaxVerse('KJV', `${book} ${chapter}`, renderPromise);
        x += 1
      ) {
        let k = [book, chapter, x, 'KJV'].join('.');
        if ('vkMod' in location) {
          const { vkMod } = location;
          k += `.${vkMod}`;
        }
        if (k in bookmarkMap) {
          chBookmarks.push(...bookmarkMap[k]);
        }
      }
      return chBookmarks;
    }
    if (location) {
      const { otherMod: module, key } = location;
      const k = [module, key].join(C.GBKSEP);
      if (k in bookmarkMap) return bookmarkMap[k];
    }
  }
  return [];
}

// Add note bookmarks to note HTML, or just return notes HTML.
export function addBookmarksToNotes(
  bookmarkInfos: BookmarkInfoHTML[],
  notes: string | '',
  module: string,
  sort?: boolean,
): string {
  const notehtml = notes || `<div class="notes"></div>`;
  const ns = notehtml.match(/<div[^>]+>/);
  if (ns) {
    const [divStart] = ns;
    let newnotes = notehtml.replace(divStart, '');
    newnotes = newnotes.replace(/<\/div>$/, '');
    newnotes =
      bookmarkInfos
        .filter((n) => n.note)
        .reduce((p, un) => {
          const { location: l, n, note, noteLocale } = un;
          const span = `<span class="cs-${noteLocale}">${note}</span>`;
          const t = `un.${n}.${bmOsisRef(l)}.${module}`;
          const nlist = updateDataAttribute(
            `<div class="nlist" data-title="${t}">${span}</div>`,
            bmInfoToData('nlist', un, module),
          );
          return `${p}${nlist}`;
        }, '') + newnotes;
    if (sort) {
      const nlists = newnotes.split(/(?=<div class="nlist")/);
      const re =
        /<div class="nlist" data-title="[^."]*\.[^."]*\.([^"]+)\.[^."]*"/;
      newnotes = nlists
        .sort((a, b) => {
          const ma = a.match(re);
          const mb = b.match(re);
          const ia = Number(ma?.[1].split('.')[2]) || 0;
          const ib = Number(mb?.[1].split('.')[2]) || 0;
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
  module: string,
): string {
  return textHTML.replaceAll(
    // This regex comes from xulsword.cpp:
    /(<span data-title="([^."]*)\.(\d+)\.(\d+)\.(\d+)\.([^."]*)" class="vs )([^"]*?")([^>]*?>)/g,
    (tag, start, bk, ch, vs, lv, m, cls, end) => {
      const v11n: V11nType = (m && m in G.Tab && G.Tab[m].v11n) || 'KJV';
      const kjvl = verseKey([bk, ch, vs, lv, m].join('.'), v11n).location(
        'KJV',
      );
      const { verse, lastverse } = kjvl;
      for (let x = verse || 1; x <= (lastverse || verse || 1); x += 1) {
        const infos: BookmarkInfoHTML[] = bookmarkInfos.filter(
          (info) => 'v11n' in info.location && info.location.verse === x,
        );
        if (infos.length) {
          const markerHTML = infos
            .map((info) => marker(info, module))
            .filter(Boolean)
            .join('');
          const classes = new Set<string>();
          infos.forEach((info) => {
            info.classes.forEach((c) => classes.add(c));
          });
          const c = Array.from(classes).join(' ');
          const ntag = `${start}${c} ${cls}${end}${markerHTML}`;
          return updateDataAttribute(ntag, { bmitem: infos[0].id });
        }
      }
      return tag;
    },
  );
}

export function addBookmarksToTextGB(
  bookmarkInfos: BookmarkInfoHTML[],
  textHTML: string,
  module: string,
): string {
  const markerHTML = bookmarkInfos
    .map((info) => marker(info, module))
    .filter(Boolean)
    .join('');
  const classes = new Set<string>();
  bookmarkInfos.forEach((info) => {
    info.classes.forEach((c) => classes.add(c));
  });
  const re = /(<div class=")([^"]*)("[^>]*>)/;
  return textHTML.replace(re, (_t, s, c, e) => {
    let div = `${s}${[c, ...classes].join(' ')}${e}`;
    div = updateDataAttribute(
      div,
      bmInfoToData('text', bookmarkInfos[0], module),
    );
    return `${markerHTML}${div}`;
  });
}

export default function addBookmarks(
  response: Pick<LibSwordResponse, 'textHTML' | 'notes'>,
  props: Pick<AtextProps, 'module' | 'location' | 'modkey'>,
  renderPromise: RenderPromise,
) {
  const { textHTML, notes } = response;
  const { module, location, modkey } = props;
  if (module && module in G.Tab) {
    const { isVerseKey } = G.Tab[module];
    let bmlocation: LocationORType | LocationVKType | SelectVKType | null =
      null;
    if (isVerseKey && location && G.Tab[module].tabType === 'Comms') {
      bmlocation = { ...location, vkMod: module };
    } else if (isVerseKey && location) {
      bmlocation = location;
    } else if (!isVerseKey && modkey) {
      bmlocation = { otherMod: module, key: modkey };
    }
    if (bmlocation) {
      const bookmarks = findBookmarks(bmlocation, renderPromise);
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

// Split a string from LibSword up into paragraphs
export function parseParagraphs(text: string): string[] {
  // Paragraph support was removed in xulsword 3.
  return [text];
}

export function getSampleText(
  l: LocationVKType | LocationVKCommType | LocationORType,
  renderPromise?: RenderPromise,
): string {
  let sampleText = '';
  if ('v11n' in l) {
    const { book, chapter, verse, lastverse, vkMod } = l;
    const loc = [book, chapter];
    if (verse) loc.push(verse);
    if (verse && lastverse && lastverse > verse) loc.push(lastverse);
    let module = vkMod || '';
    if ('commMod' in l) module = l.commMod;
    if (module && module in G.Tab) {
      const options = getSwordOptions(G, G.Tab[module].type);
      sampleText = G.LibSword.getVerseText(
        module,
        loc.join('.'),
        false,
        options,
      ).replace(/\n/g, ' ');
    }
  } else {
    const { otherMod, key, paragraph } = l;
    if (otherMod && otherMod in G.Tab) {
      // Turn off all SWORD filter options
      const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
      Object.entries(C.SwordFilters).forEach((entry) => {
        [options[entry[0] as SwordFilterType]] = C.SwordFilterValues;
      });
      let text = '';
      if (G.Tab[otherMod].type === C.GENBOOK) {
        ({ text } = GI.LibSword.getGenBookChapterText(
          { text: '', notes: '' },
          renderPromise,
          l.otherMod,
          l.key,
          options,
        ));
      } else if (G.Tab[otherMod].type === C.DICTIONARY) {
        ({ text } = GI.LibSword.getDictionaryEntry(
          { text: C.NOTFOUND, notes: '' },
          renderPromise,
          otherMod,
          key,
          options,
        ));
      }
      const paragraphs = parseParagraphs(text);
      const i = paragraph && paragraphs[paragraph] ? paragraph : 0;
      sampleText = paragraphs[i];
    }
  }
  sampleText = sampleText
    .replace(/<[^>]+>/g, '')
    .substring(0, C.UI.BMProperties.sampleTextLength);
  return sampleText;
}

// Convert bookmark childNodes of a folder into tree nodes.
export function bookmarkTreeNodes(
  items: BookmarkItemType[] | BookmarkTreeNode[],
  only?: 'folder' | 'bookmark', // undefined = all
  selectedIDs?: string | string[], // undefined = none
  expandedIDs?: string | string[], // undefined = all
  cloned = false,
): BookmarkTreeNode[] {
  return items
    .map((item) =>
      bookmarkTreeNode(item, only, selectedIDs, expandedIDs, cloned),
    )
    .filter(Boolean) as BookmarkTreeNode[];
}

// Convert a bookmark item into a tree node.
export function bookmarkTreeNode(
  item: BookmarkItemType | BookmarkTreeNode | null | undefined,
  only?: 'folder' | 'bookmark', // undefined = all
  selectedIDs?: string | string[], // undefined = none
  expandedIDs?: string | string[], // undefined = all
  cloned = false,
): BookmarkTreeNode | null {
  const selIDs =
    selectedIDs && typeof selectedIDs === 'string'
      ? [selectedIDs]
      : selectedIDs;
  const expIDs =
    expandedIDs && typeof expandedIDs === 'string'
      ? [expandedIDs]
      : expandedIDs;
  if (item) {
    const node = (cloned ? item : cloneAny(item)) as BookmarkTreeNode;
    if (
      !only ||
      (only === 'folder' && 'type' in node && node.type === 'folder') ||
      (only === 'bookmark' && 'type' in node && node.type === 'bookmark')
    ) {
      if (node.type === 'folder') {
        node.hasCaret = node.childNodes?.some(
          (cn) => 'type' in cn && cn.type === 'folder' && cn.childNodes,
        );
        node.isExpanded = !expIDs || expIDs.includes(node.id.toString());
      }
      node.isSelected = !!selIDs && selIDs.includes(node.id.toString());
      node.icon = bookmarkItemIcon(node);
      if (node.childNodes) {
        node.childNodes = bookmarkTreeNodes(
          node.childNodes as BookmarkTreeNode[],
          only,
          selIDs,
          expIDs,
          true,
        );
      }
      node?.childNodes?.forEach((n) =>
        bookmarkTreeNode(n as BookmarkTreeNode, only, selIDs, expIDs, true),
      );
      return node;
    }
  }
  return null;
}
