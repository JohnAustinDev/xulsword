import { JSON_attrib_parse, ofClass } from '../common.ts';
import RefParser from '../refParser.ts';
import C from './constant.ts';
import G from './rg.ts';
import { findElementData, mergeElementData } from './htmlData.ts';
import { findBookmarks } from './bookmarks.ts';
import { windowArguments } from './rutil.tsx';

import type {
  ContextDataType,
  LocationORType,
  LocationVKType,
  LocationVKCommType,
  SearchType,
} from '../type.ts';
import type { HTMLData } from './htmlData.ts';

const windowDescriptor = windowArguments();

// Return target data usable by context menus.
export default function ContextData(elem: HTMLElement): ContextDataType {
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

  let locationGB: LocationORType | undefined;
  if (contextData) locationGB = contextData.locationGB;

  let locationCOMM: LocationVKCommType | undefined;
  if (
    contextData?.location &&
    context &&
    context in G.Tab &&
    G.Tab[context].tabType === 'Comms'
  ) {
    locationCOMM = {
      ...contextData.location,
      commMod: context,
    };
  }

  let bookmark: string | undefined;
  if (contextData) bookmark = contextData.bmitem;
  if (!bookmark && (locationGB || location)) {
    const bm = findBookmarks(
      (locationGB || location) as LocationVKType | LocationORType
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
    const parsed = new RefParser(
      G.i18n.language,
      G.getLocaleDigits(true),
      G.getLocalizedBooks(true),
      {
        locales: C.Locales.map((l) => l[0]),
        uncertain: true
      }
    ).parse(selection, v11n || null);
    selectionParsedVK = parsed && parsed.location.book ? parsed.location : undefined;
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
    locationCOMM,
    bookmark,
    context,
    tab,
    lemma,
    panelIndex,
    isPinned,
    selection,
    selectionParsedVK,
    search,
    windowDescriptor,
  };
}
