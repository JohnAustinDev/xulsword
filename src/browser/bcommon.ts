
import C from '../constant.ts';
import S from '../defaultPrefs.ts';
import { JSON_parse, hierarchy, mergePrefRoot, strings2Numbers } from '../common.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type { GType, OSISBookType, PrefRoot, TreeNodeInfoPref } from '../type.ts';
import type { SelectVKType } from "../renderer/libxul/selectVK.tsx";
import type { SelectORMType, SelectORProps } from "../renderer/libxul/selectOR.tsx";

export type ChaplistVKType = { [bk in OSISBookType]?: [number, string][] }
export type ChaplistORType = [string, string, string][]; // [order, key, url]

// Insure a partial prefs root object has a valid locale set in it.
export function setGlobalLocale(prefs: Partial<PrefRoot>, langcode?: string): string {
  let global: Partial<typeof S.prefs.global> = { locale: langcode };
  const { prefs: p } = prefs;
  if (!p) prefs.prefs = { global }
  else {
    const { global: g } = p;
    if (!g || typeof g !== 'object') p.global = global;
    else global = g as Partial<typeof S.prefs.global>;
  };
  let { locale: l } = global;
  if (!l || !C.Locales.some((x) => x[0] === l)) l = langcode ?? 'en';
  global.locale = l;
  return l;
}

export function getProps<T extends { [prop: string]: any }>(
  props: Partial<T>,
  defaultProps: T
): T {
  const newProps = {} as T;
  Object.entries(defaultProps).forEach((entry) => {
    const [prop, v] = entry;
    (newProps as any)[prop] = typeof props[prop] !== 'undefined' ? props[prop] : v;
  });
  return newProps as T;
}

export function writePrefsStores(G: GType, prefs: Partial<PrefRoot>) {
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
    })
  });
}

export function handleAction(type: string, id: string, ...args: any[]) {
  switch(type) {
    case 'bible_audio_Play': {
      const [selection, chaplist]
        = args as [SelectVKType, ChaplistVKType];
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
    }
    break;
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
          const url = da[2];
            player.setAttribute('src', url.replace(/^base:/, ''));
            player.play().catch((_er) => {});
        }
      }
    }
    break;
    default:
      throw new Error(`Unsupported action: '${type}'`);
  }
  return;
}

// Convert raw gen-book chaplist data from Drupal into a valid xulsword nodelist.
export function createNodeList(
  chaplist: ChaplistORType,
  props: SelectORProps
) {
  // chaplist members are like: ['2/4/5', The/chapter/titles', 'url']
  // The Drupal chaplist is file data, and so does not include any parent
  // entries required by hierarchy(). So parents must be added before sorting.
  const parent = (ch: ChaplistORType[number]): ChaplistORType[number] | null=> {
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
    if (p && !chaplist.find((c) => c[1] === p[1])) {chaplist.push(p);}
  });
  const treenodes: TreeNodeInfo<{}>[] = chaplist.sort((a, b) => {
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
    const [_order, key, _url] = x;
    return {
      id: key,
      label: key.replace(/\/$/, '').split('/').pop(),
      className: 'cs-LTR_DEFAULT',
      hasCaret: key.endsWith(C.GBKSEP),
      icon: undefined,
    } as TreeNodeInfoPref;
  });
  const nodes = hierarchy(treenodes as any);
  props.nodeLists = [{
    otherMod: props.initialORM.otherMod,
    label: 'genbk',
    labelClass: 'cs-LTR_DEFAULT',
    nodes,
  }];
  if (!treenodes.find((n) => n.id === props.initialORM.keys[0]))
    props.initialORM.keys = [nodes[0].id.toString()];
}

export function decodeJSData(str?: string): any {
  if (!str) return {};
  return strings2Numbers(JSON_parse(decompressString(decodeURIComponent(str))));
}

// Zip compress to reduce string length for strings that contain repetitions.
export function compressString(str: string) {
  const e: { [k: string]: number } = {};
  let f = str.split('');
  const d: (string | number)[] = [];
  let a: string = f[0];
  let g = 256;
  let c: string;
  for (let b = 1; b < f.length; b++) {
    c = f[b];
    if (null != e[a + c]) a += c;
    else {
      d.push(1 < a.length ? e[a] : a.charCodeAt(0));
      e[a + c] = g;
      g++;
      a = c;
    }
  }
  d.push(1 < a.length ? e[a] : a.charCodeAt(0));
  for (let b = 0; b < d.length; b++) {
    d[b] = String.fromCharCode(d[b] as number);
  }
  return d.join('');
}

// Decompress a zipped compressString().
export function decompressString(str: string) {
  let a: string;
  const e: { [k: string]: number | string } = {};
  const d = str.split('');
  let c: string = d[0];
  let f = d[0];
  const g = [c]
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
