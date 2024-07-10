import C from '../constant.ts';
import G from '../renderer/rg.ts';
import S from '../defaultPrefs.ts';
import { hierarchy, mergePrefRoot, randomID } from '../common.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  GType,
  OSISBookType,
  PrefRoot,
  TreeNodeInfoPref,
} from '../type.ts';
import type {
  SelectVKProps,
  SelectVKType,
} from '../renderer/libxul/selectVK.tsx';
import type {
  SelectORMType,
  SelectORProps,
} from '../renderer/libxul/selectOR.tsx';
import type { MenulistProps } from '../renderer/libxul/menulist.tsx';

declare const drupalSettings: any;

export type ChaplistVKType = { [bk in OSISBookType]?: Array<[number, string]> };

export type ChaplistORType = Array<[string, string, string]>; // [order, key, url]

export type SelectData = {
  title: string;
  base: string;
  items: FileItem[];
};

export type FileItem = {
  name: string;
  size: string;
  path: string;
  types: string[];
  osisbook: OSISBookType;
};

export type selectVKCompData = {
  component: 'selectVK';
  action: 'bible_audio_Play';
  langcode: string;
  props: SelectVKProps;
  data: ChaplistVKType;
};

export type selectORCompData = {
  component: 'selectOR';
  action: 'genbk_audio_Play';
  langcode: string;
  props: SelectORProps;
  data: ChaplistORType;
};

export type selectOptionsCompData = {
  component: 'selectOptions';
  action: 'update_url';
  langcode: string;
  props: MenulistProps;
  data: SelectData;
};

export type browserCompData = {
  component: 'bibleBrowser';
  langcode: string;
  prefs: Partial<PrefRoot>;
};

export type ComponentData =
  | browserCompData
  | selectVKCompData
  | selectORCompData
  | selectOptionsCompData;

export function componentData(elem: Element): ComponentData {
  let drupalData: Record<string, ComponentData> | undefined;
  if (elem.tagName === 'IFRAME') {
    const parentWindow = frameElement?.ownerDocument?.defaultView;
    if (parentWindow) {
      drupalData = (parentWindow as any).drupalSettings?.react;
    }
  } else {
    drupalData = drupalSettings?.react;
  }
  if (drupalData) {
    const mydata = drupalData[elem.id] as ComponentData | undefined;
    if (mydata) return mydata;
    throw new Error(`No drupalSettings data for id '${elem.id}'.`);
  }
  throw new Error('No drupalSettings data found.');
}

// Insure a partial prefs root object has a valid locale set in it.
export function setGlobalLocale(
  prefs: Partial<PrefRoot>,
  langcode?: string,
): string {
  let global: Partial<typeof S.prefs.global> = { locale: langcode };
  const { prefs: p } = prefs;
  if (!p) prefs.prefs = { global };
  else {
    const { global: g } = p;
    if (!g || typeof g !== 'object') p.global = global;
    else global = g as Partial<typeof S.prefs.global>;
  }
  let { locale: l } = global;
  if (!l || !C.Locales.some((x) => x[0] === l)) l = langcode ?? 'en';
  global.locale = l;
  return l;
}

export function getProps<T extends Record<string, any>>(
  props: T,
  defaultProps: T,
): T {
  const newProps = {};
  Object.entries(defaultProps).forEach((entry) => {
    const [prop, v] = entry;
    (newProps as any)[prop] =
      typeof props[prop] !== 'undefined' ? props[prop] : v;
  });
  return newProps as T;
}

export function writePrefsStores(G: GType, prefs: Partial<PrefRoot>): void {
  const defs = mergePrefRoot(prefs, S);
  Object.entries(prefs).forEach((entry) => {
    const [store, prefobj] = entry;
    Object.keys(prefobj).forEach((rootkey) => {
      G.Prefs.setComplexValue(
        rootkey,
        defs[store as keyof PrefRoot][rootkey],
        `${store}_default` as 'prefs',
      );
      // Read the store to initialize it.
      G.Prefs.getComplexValue(rootkey, store as 'prefs');
    });
  });
}

export function handleAction(type: string, id: string, ...args: any[]): void {
  switch (type) {
    case 'bible_audio_Play': {
      const [selection, chaplist] = args as [SelectVKType, ChaplistVKType];
      // A Drupal selectVK item follows its associated audio player item.
      const player = document
        .getElementById(id)
        ?.parentElement?.previousElementSibling?.querySelector('audio') as
        | HTMLAudioElement
        | undefined;
      if (player) {
        const { book, chapter } = selection;
        const chaparray = chaplist[book]?.find((ca) => ca[0] === chapter);
        if (chaparray) {
          player.setAttribute('src', chaparray[1].replace(/^base:/, ''));
          player.play().catch((_er) => {});
        }
      }
      break;
    }
    case 'genbk_audio_Play': {
      const [selection, chaplist] = args as [SelectORMType, ChaplistORType];
      // A Drupal selectOR item follows its associated audio player item.
      const player = document
        .getElementById(id)
        ?.parentElement?.previousElementSibling?.querySelector('audio') as
        | HTMLAudioElement
        | undefined;
      if (player) {
        const { keys } = selection;
        const [key] = keys;
        const da = chaplist.find((x) => x[1] === key);
        if (da) {
          player.setAttribute('src', da[2].replace(/^base:/, ''));
          player.play().catch((_er) => {});
        }
      }
      break;
    }
    case 'update_url': {
      const [title, base, items, index] = args as [
        string,
        string,
        FileItem[],
        number,
      ];
      const elem = document.getElementById(id)?.previousElementSibling;
      const item = items[index];
      if (elem && item && typeof item === 'object') {
        const { path, size } = item;
        const a = elem.querySelector('a');
        if (a && path) {
          a.setAttribute('href', `${base}/${path}`);
          a.textContent = optionText(item, true, title, items.length === 1);
          if (size && a.parentElement?.tagName === 'SPAN') {
            const sizeSpan = a.parentElement.nextElementSibling;
            if (sizeSpan && sizeSpan.tagName === 'SPAN') {
              sizeSpan.textContent = ` (${size})`;
            }
          }
        }
      }
      break;
    }
    default:
      throw new Error(`Unsupported action: '${type}'`);
  }
}

export function optionKey(data: unknown): string {
  if (data && typeof data === 'object' && 'path' in data) {
    return data.path as string;
  }
  return randomID();
}

export function optionText(
  data: unknown,
  long = false,
  title = '',
  onlyOption = false,
): string {
  if (data && typeof data === 'object' && 'path' in data) {
    return getEBookTitle(data as FileItem, long, title, onlyOption);
  }
  return 'unknown';
}

// Generate a short or long title for an eBook file. The forms of the title are:
// short: 'Full publication' or 'Compilation', books (for bible), title (for all others).
// long: publication-name, books: publication-name (for bible), title: publication-name (others)
export function getEBookTitle(
  data: FileItem,
  long = false,
  pubname = '',
  onlyOption = false,
): string {
  const { types, osisbook, name } = data;
  const Book = G.Book(G.i18n.language);

  if (!onlyOption && ['full', 'compilation'].some((x) => types.includes(x))) {
    return long ? pubname : G.i18n.t('Full publication');
  } else if (types.includes('part')) {
    return long ? `${Book[osisbook].name}: ${pubname}` : Book[osisbook].name;
  }
  return long && name !== pubname ? `${name}: ${pubname}` : name;
}

// Convert raw gen-book chaplist data from Drupal into a valid xulsword nodelist.
export function createNodeList(
  chaplist: ChaplistORType,
  props: SelectORProps,
): void {
  // chaplist members are like: ['2/4/5', The/chapter/titles', 'url']
  // The Drupal chaplist is file data, and so does not include any parent
  // entries required by hierarchy(). So parents must be added before sorting.
  const parent = (
    ch: ChaplistORType[number],
  ): ChaplistORType[number] | null => {
    const o = ch[0].split('/');
    const p = ch[1].split('/');
    o.pop();
    p.pop();
    if (o.length) {
      return [o.concat('').join('/'), p.concat('').join('/'), ''];
    }
    return null;
  };
  chaplist.forEach((x) => {
    const p = parent(x);
    if (p && !chaplist.find((c) => c[1] === p[1])) {
      chaplist.push(p);
    }
  });
  const treenodes: Array<TreeNodeInfo<Record<string, unknown>>> = chaplist
    .sort((a, b) => {
      const ap = a[0].split('/').map((x) => Number(x));
      const bp = b[0].split('/').map((x) => Number(x));
      for (let x = 0; x < ap.length; x++) {
        if (typeof ap[x] === 'undefined' && typeof bp[x] !== 'undefined') {
          return -1;
        } else if (
          typeof ap[x] !== 'undefined' &&
          typeof bp[x] === 'undefined'
        ) {
          return 1;
        } else if (
          typeof ap[x] !== 'undefined' &&
          typeof bp[x] !== 'undefined'
        ) {
          if (ap[x] !== bp[x]) return ap[x] - bp[x];
        }
      }
      return 0;
    })
    .map((x) => {
      const [, key] = x;
      return {
        id: key,
        label: key.replace(/\/$/, '').split('/').pop() ?? '',
        className: 'cs-LTR_DEFAULT',
        hasCaret: key.endsWith(C.GBKSEP),
      } satisfies TreeNodeInfoPref;
    });
  const nodes = hierarchy(treenodes);
  props.nodeLists = [
    {
      otherMod: props.initialORM.otherMod,
      label: 'genbk',
      labelClass: 'cs-LTR_DEFAULT',
      nodes,
    },
  ];
  if (!treenodes.find((n) => n.id === props.initialORM.keys[0])) {
    props.initialORM.keys = [nodes[0].id.toString()];
  }
}
