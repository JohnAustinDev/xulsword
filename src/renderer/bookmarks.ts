/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */
import Cache from '../cache';
import { clone, JSON_attrib_parse, ofClass } from '../common';
import RefParser from '../refParser';
import C from '../constant';
import S from '../defaultPrefs';
import G from './rg';
import {
  findElementData,
  mergeElementData,
  updateDataAttribute,
  verseKey,
} from './htmlData';
import { bookmarkItemIcon, getMaxVerse } from './rutil';

import type {
  BookmarkFolderType,
  BookmarkTreeNode,
  BookmarkType,
  ContextData,
  LocationGBType,
  LocationVKType,
  SearchType,
  SwordFilterType,
  SwordFilterValueType,
} from '../type';
import type { HTMLData } from './htmlData';
import type { AtextProps } from './viewport/atext';
import type { LibSwordResponse } from './viewport/ztext';
import type { SelectVKMType } from './libxul/vkselect';
import { locationVKText } from './viewport/zversekey';

type BookmarkMapType = { [key: string]: BookmarkInfoHTML[] };

type BookmarkInfoHTML = {
  id: string;
  n: number;
  note: string;
  noteLocale: string;
  location: LocationGBType | LocationVKType;
  classes: ('bmitem' | 'bmnote')[];
};

export function bmOsisRef(location: LocationGBType | LocationVKType): string {
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
  module: string
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
    bmInfoToData('un', bookmarkInfo, module)
  );
}

export function getBookmarkInfo(
  bookmark: BookmarkType
): BookmarkInfoHTML | null {
  const { id, note, noteLocale, location } = bookmark;
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
        const { type, note } = item;
        if ('childNodes' in item) kmap(item);
        else if (type === 'bookmark' && note) {
          const { location } = item;
          let k = '';
          if (location && 'v11n' in location) {
            const kjvl = verseKey(location).location('KJV');
            const { book, chapter, verse } = kjvl;
            k = [book, chapter, verse, 'KJV'].join('.');
          } else if (location) {
            const { module, key } = location;
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
        'bookmarks'
      ) as typeof S.bookmarks.rootfolder
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
          const { location: l, n, note, noteLocale } = un;
          const span = `<span class="cs-${noteLocale}">${note}</span>`;
          const t = `un.${n}.${bmOsisRef(l)}.${module}`;
          const nlist = updateDataAttribute(
            `<div class="nlist" data-title="${t}">${span}</div>`,
            bmInfoToData('nlist', un, module)
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
          const c = Array.from(classes).join(' ');
          const ntag = `${start}${c} ${cls}${end}${markerHTML}`;
          return updateDataAttribute(ntag, { bmitem: infos[0].id });
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
    .map((info) => marker(info, module))
    .filter(Boolean)
    .join('');
  const classes: Set<string> = new Set();
  bookmarkInfos.forEach((info) => {
    info.classes.forEach((c) => classes.add(c));
  });
  const re = /(<div class=")([^"]*)("[^>]*>)/;
  return textHTML.replace(re, (t, s, c, e) => {
    let div = `${s}${[c, ...classes].join(' ')}${e}`;
    div = updateDataAttribute(
      div,
      bmInfoToData('text', bookmarkInfos[0], module)
    );
    return `${markerHTML}${div}`;
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

// Split a string from LibSword up into paragraphs
export function parseParagraphs(text: string): string[] {
  // Paragraph support was removed in xulsword 3.
  return [text];
}

export function getSampleText(
  l: LocationGBType | SelectVKMType,
  locale?: typeof C.Locales[number][0]
): { sampleText: string; sampleModule: string } {
  let sampleText = '';
  let sampleModule = '';
  if ('v11n' in l) {
    const vk = l as SelectVKMType;
    const { book } = vk;
    const { vkmod } = vk;
    const isComm = vkmod in G.Tab && G.Tab[vkmod].tabType === 'Comms';
    const searchMods: string[] = [vkmod];
    if (locale && book) {
      // Look for an installed sampleText module associated with the locale.
      const configs = G.LocaleConfigs;
      const locales = [locale, C.FallbackLanguage[locale]];
      searchMods.unshift(
        ...locales.reduce(
          (p, c) =>
            c in configs
              ? p.concat(configs[c].AssociatedModules?.split(/\s*,\s*/) || [])
              : p,
          [] as string[]
        )
      );
    }
    if (searchMods.length) {
      const vktxt = locationVKText(
        l,
        searchMods[0],
        searchMods,
        false,
        isComm,
        true
      );
      if (vktxt) {
        const { module, text } = vktxt;
        sampleText = text;
        sampleModule = module;
      }
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
      sampleText = paragraphs[i];
      sampleModule = module;
    }
  }
  sampleText = sampleText
    .replace(/<[^>]+>/g, '')
    .substring(0, C.UI.BMProperties.sampleTextLength);
  return { sampleText, sampleModule };
}

// Convert a bookmark item into a tree node.
export function bookmarkTreeNode(
  item: BookmarkFolderType | BookmarkType | BookmarkTreeNode | null | undefined,
  only?: 'folder' | 'bookmark', // undefined = all
  selectedIDs?: string | string[], // undefined = none
  expandedIDs?: string | string[], // undefined = all
  cloned = false
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
    const node = (cloned ? item : clone(item)) as BookmarkTreeNode;
    if (
      !only ||
      (only === 'folder' && 'type' in node && node.type === 'folder') ||
      (only === 'bookmark' && 'type' in node && node.type === 'bookmark')
    ) {
      if (node.label.startsWith('i18n:')) {
        node.label = G.i18n.t(node.label.substring(5));
        node.labelLocale = G.i18n.language as 'en';
      }
      if (node.type === 'folder') {
        node.hasCaret = node.childNodes?.some(
          (cn) => 'type' in cn && cn.type === 'folder' && cn.childNodes
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
          true
        );
      }
      node?.childNodes?.forEach((n) =>
        bookmarkTreeNode(n as BookmarkTreeNode, only, selIDs, expIDs, true)
      );
      return node;
    }
  }
  return null;
}

// Convert bookmark childNodes of a folder into tree nodes.
export function bookmarkTreeNodes(
  items: (BookmarkFolderType | BookmarkType)[] | BookmarkTreeNode[],
  only?: 'folder' | 'bookmark', // undefined = all
  selectedIDs?: string | string[], // undefined = none
  expandedIDs?: string | string[], // undefined = all
  cloned = false
): BookmarkTreeNode[] {
  return items
    .map((item) =>
      bookmarkTreeNode(item, only, selectedIDs, expandedIDs, cloned)
    )
    .filter(Boolean) as BookmarkTreeNode[];
}

// Return contextual data for use by context menus.
export function getContextData(elem: HTMLElement): ContextData {
  const atextx = ofClass(['atext'], elem);
  const atext = atextx ? atextx.element : null;
  const tabx = ofClass(['tab'], elem);
  const atab = tabx ? tabx.element : null;

  const elemData = findElementData(elem);

  // Get selection and target elements from selection
  let selection: string | undefined;
  const selElems: HTMLElement[] = [];
  const selob = getSelection();
  if (selob && !selob.isCollapsed && !/^\s*$/.test(selob.toString())) {
    selection = selob.toString();
    const fn = selob.focusNode;
    if (fn && fn.nodeType === 1) {
      selElems.push(fn as HTMLElement);
    }
    const an = selob.anchorNode;
    if (an && an.nodeType === 1) {
      selElems.push(an as HTMLElement);
    }
  }
  const selDatas = selElems.map((el) => findElementData(el));

  let atextData: HTMLData | null = null;
  if (atext?.dataset.data) {
    atextData = JSON_attrib_parse(atext.dataset.data) as HTMLData;
  }

  let atabData: HTMLData | null = null;
  if (atab?.dataset.module) {
    atabData = {
      context: atab?.dataset.module,
    };
  }

  const contextData = mergeElementData([
    elemData,
    ...selDatas,
    atextData,
    atabData,
  ]);

  let context: string | undefined;
  if (contextData) context = contextData.context;

  let location: LocationVKType | undefined;
  if (contextData) location = contextData.location;

  let locationGB: LocationGBType | undefined;
  if (contextData) locationGB = contextData.locationGB;

  let bookmark: string | undefined;
  if (contextData) bookmark = contextData.bmitem;
  if (!bookmark && (locationGB || location)) {
    const bm = findBookmarks(
      (locationGB || location) as LocationVKType | LocationGBType
    );
    if (bm[0]) bookmark = bm[0].id;
  }

  let panelIndexs;
  if (atext) panelIndexs = atext.dataset.index;
  else if (atab) panelIndexs = atab.dataset.index;
  const panelIndex = panelIndexs ? Number(panelIndexs) : undefined;

  const isPinned = Boolean(atext && atext.dataset.ispinned === 'true');

  const tab = atab?.dataset.module;

  const v11n =
    (context && context in G.Tab && G.Tab[context].v11n) || undefined;
  let selectionParsedVK: LocationVKType | undefined;
  if (selection) {
    selectionParsedVK =
      new RefParser(G.i18n, { uncertain: true }).parse(selection, v11n || null)
        ?.location || undefined;
  }

  // Find location lastverse
  if (selDatas.length > 1) {
    const l = selDatas[1]?.location || null;
    if (
      location &&
      l &&
      location.book === l.book &&
      location.chapter === l.chapter
    ) {
      location.lastverse = l.verse;
      const { verse, lastverse } = location;
      if (verse && lastverse && verse > lastverse) {
        location.verse = lastverse;
        location.lastverse = verse;
      }
    }
  }

  let search: SearchType | undefined;
  let lemma: string | undefined;
  const snx = ofClass(['sn'], elem);
  const lemmaArray: string[] = [];
  if (snx && context) {
    Array.from(snx.element.classList).forEach((cls) => {
      if (cls === 'sn') return;
      const [type, lemmaStr] = cls.split('_');
      if (type !== 'S' || !lemmaStr) return;
      const lemmaNum = Number(lemmaStr.substring(1));
      // SWORD filters >= 5627 out- not valid it says
      if (
        Number.isNaN(Number(lemmaNum)) ||
        (lemmaStr.startsWith('G') && lemmaNum >= 5627)
      )
        return;
      lemmaArray.push(`lemma: ${lemmaStr}`);
    });
    lemma = lemmaArray.length ? lemmaArray.join(' ') : undefined;
    if (lemma && context) {
      search = {
        module: context,
        searchtext: lemma,
        type: 'SearchAdvanced',
      };
    }
  }

  return {
    type: 'general',
    location,
    locationGB,
    bookmark,
    context,
    tab,
    lemma,
    panelIndex,
    isPinned,
    selection,
    selectionParsedVK,
    search,
  };
}
