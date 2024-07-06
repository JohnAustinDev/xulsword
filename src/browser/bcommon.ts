import C from '../constant.ts';
import G from '../renderer/rg.ts';
import S from '../defaultPrefs.ts';
import { JSON_parse, hierarchy, mergePrefRoot, randomID, strings2Numbers } from '../common.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type { GType, OSISBookType, PrefRoot, TreeNodeInfoPref } from '../type.ts';
import type { SelectVKType } from '../renderer/libxul/selectVK.tsx';
import type { SelectORMType, SelectORProps } from '../renderer/libxul/selectOR.tsx';

export type ChaplistVKType = { [bk in OSISBookType]?: Array<[number, string]> }

export type ChaplistORType = Array<[string, string, string]> // [order, key, url]

export type SelectData = {
  title: string;
  items: unknown[];
}

export type FileItems = Array<{
  format: string;
  types: string[];
  osisbooks: OSISBookType[];
  filename: string;
  size: string;
  url: string;
}>

// Insure a partial prefs root object has a valid locale set in it.
export function setGlobalLocale(prefs: Partial<PrefRoot>, langcode?: string): string {
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
  defaultProps: T
): T {
  const newProps = {};
  Object.entries(defaultProps).forEach((entry) => {
    const [prop, v] = entry;
    (newProps as any)[prop] = typeof props[prop] !== 'undefined' ? props[prop] : v;
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
        `${store}_default` as 'prefs'
      );
      // Read the store to initialize it.
      G.Prefs.getComplexValue(rootkey, store as 'prefs');
    });
  });
}

export function handleAction(type: string, id: string, ...args: any[]): void {
  switch (type) {
    case 'bible_audio_Play': {
      const [selection, chaplist] =
        args as [SelectVKType, ChaplistVKType];
      // A Drupal selectVK item follows its associated audio player item.
      const player = document.getElementById(id)?.parentElement
        ?.previousElementSibling?.querySelector('audio') as HTMLAudioElement | undefined;
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
      const player = document.getElementById(id)?.parentElement
        ?.previousElementSibling?.querySelector('audio') as HTMLAudioElement | undefined;
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
      const [pubtitle, item] = args as [string, unknown];
      const elem = document.getElementById(id)?.previousElementSibling;
      if (elem && item && typeof item === 'object') {
        const { url, size } = item as { url?: string; size?: string };
        const a = elem.querySelector('a');
        if (a && url) {
          a.setAttribute('href', url.replace(/^base:/, ''));
          a.textContent = optionText(item, true, pubtitle);
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
  if (data && typeof data === 'object' && 'url' in data) {
    return data.url as string;
  }
  return randomID();
}

export function optionText(data: unknown, long = false, title = ''): string {
  if (data && typeof data === 'object' && 'url' in data) {
    return getEBookTitle(data as FileItems[number], long, title);
  }
  return 'unknown';
}

// Generate a short or long title for an eBook file. The forms of the title are:
// short: 'Full publication', books (for bible), title (for all others).
// long: publication-name, publication-name: books (for bible), publication-name: title (others)
export function getEBookTitle(data: FileItems[number], long = false, pubname = ''): string {
  const { types, osisbooks, filename } = data;

  const Book = G.Book(G.i18n.language);
  const books = osisbooks.map((bk) => Book[bk].name).join(', ');

  const pn = filename.split('__');
  if (pn[0].length === 3) pn.shift();
  const remove: string[] = osisbooks.slice();
  remove.push(...types);
  if (pubname) remove.push(pubname);
  const pn2 = pn.filter((s) => !remove.includes(s));
  const title = pn2[pn2.length - 1] || '';

  if (['full', 'compilation'].some((x) => types.includes(x))) {
    return long ? pubname || filename : G.i18n.t('Full publication');
  } else if (types.includes('part')) {
    return long ? `${pubname || filename}: ${books}` : books;
  } else if (pubname) {
    if (title) return long ? `${pubname}: ${title}` : title;
    return long ? `${pubname}: ${G.i18n.t(types[0])}` : G.i18n.t(types[0]);
  } else if (title) return title;

  return filename;
}

// Convert raw gen-book chaplist data from Drupal into a valid xulsword nodelist.
export function createNodeList(
  chaplist: ChaplistORType,
  props: SelectORProps
): void {
  // chaplist members are like: ['2/4/5', The/chapter/titles', 'url']
  // The Drupal chaplist is file data, and so does not include any parent
  // entries required by hierarchy(). So parents must be added before sorting.
  const parent = (ch: ChaplistORType[number]): ChaplistORType[number] | null => {
    const o = ch[0].split('/');
    const p = ch[1].split('/');
    o.pop(); p.pop();
    if (o.length) {
      return [o.concat('').join('/'), p.concat('').join('/'), ''];
    }
    return null;
  };
  chaplist.forEach((x) => {
    const p = parent(x);
    if (p && !chaplist.find((c) => c[1] === p[1])) { chaplist.push(p); }
  });
  const treenodes: Array<TreeNodeInfo<Record<string, unknown>>> = chaplist.sort((a, b) => {
    const ap = a[0].split('/').map((x) => Number(x));
    const bp = b[0].split('/').map((x) => Number(x));
    for (let x = 0; x < ap.length; x++) {
      if (typeof ap[x] === 'undefined' && typeof bp[x] !== 'undefined') {
        return -1;
      } else if (typeof ap[x] !== 'undefined' && typeof bp[x] === 'undefined') {
        return 1;
      } else if (typeof ap[x] !== 'undefined' && typeof bp[x] !== 'undefined') {
        if (ap[x] !== bp[x]) return ap[x] - bp[x];
      }
    }
    return 0;
  }).map((x) => {
    const [, key] = x;
    return {
      id: key,
      label: key.replace(/\/$/, '').split('/').pop() ?? '',
      className: 'cs-LTR_DEFAULT',
      hasCaret: key.endsWith(C.GBKSEP)
    } satisfies TreeNodeInfoPref;
  });
  const nodes = hierarchy(treenodes);
  props.nodeLists = [{
    otherMod: props.initialORM.otherMod,
    label: 'genbk',
    labelClass: 'cs-LTR_DEFAULT',
    nodes
  }];
  if (!treenodes.find((n) => n.id === props.initialORM.keys[0])) { props.initialORM.keys = [nodes[0].id.toString()]; }
}

export function decodeJSData(str?: string): any {
  if (!str) return {};
  return strings2Numbers(JSON_parse(decompressString(decodeURIComponent(str))));
}

// Zip compress to reduce string length for strings that contain repetitions.
export function compressString(str: string): string {
  const e: Record<string, number> = {};
  const f = str.split('');
  const d: Array<string | number> = [];
  let a: string = f[0];
  let g = 256;
  let c: string;
  for (let b = 1; b < f.length; b++) {
    c = f[b];
    if (e[a + c] != null) a += c;
    else {
      d.push(a.length > 1 ? e[a] : a.charCodeAt(0));
      e[a + c] = g;
      g++;
      a = c;
    }
  }
  d.push(a.length > 1 ? e[a] : a.charCodeAt(0));
  for (let b = 0; b < d.length; b++) {
    d[b] = String.fromCharCode(d[b] as number);
  }
  return d.join('');
}

// Decompress a zipped compressString().
export function decompressString(str: string): string {
  let a: string;
  const e: Record<string, number | string> = {};
  const d = str.split('');
  let c: string = d[0];
  let f = d[0];
  const g = [c];
  const h = 256;
  let o = 256;
  for (let b = 1; b < d.length; b++) {
    const dbc = d[b].charCodeAt(0);
    a = h > dbc ? d[b] : e[dbc] ? e[dbc].toString() : f + c;
    g.push(a);
    c = a.charAt(0);
    e[o] = f + c;
    o++;
    f = a;
  }
  return g.join('');
}
