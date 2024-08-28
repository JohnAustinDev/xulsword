import C from '../../constant.ts';
import S from '../../defaultPrefs.ts';
import { hierarchy, mergePrefsRoots } from '../../common.ts';
import Prefs from './prefs.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type { PrefObject, PrefRoot, TreeNodeInfoPref } from '../../type.ts';
import type { SelectORProps } from '../components/libxul/selectOR.tsx';
import type { BibleBrowserSettings } from './bibleBrowser/defaultSettings.ts';
import type {
  ChaplistORType,
  WidgetMenulistSettings,
  WidgetORSettings,
  WidgetVKSettings,
} from './widgets/defaultSettings.ts';

export type AllComponentsSettings = {
  react: {
    [id: string]: ComponentSettings;
  };
};

export type ComponentSettings =
  | BibleBrowserSettings
  | WidgetVKSettings
  | WidgetORSettings
  | WidgetMenulistSettings;

// React components HTML elements have a data-react-component attribute
// specifying the type.
export function getReactComponents(doc: Window['document']): HTMLDivElement[] {
  const comps = doc.querySelectorAll(
    'div[data-react-component]',
  ) as NodeListOf<HTMLDivElement>;
  return comps ? Array.from(comps) : [];
}

// Find and return initial state settings of a react component.
// Return the first result of:
// - window.drupalSettings.react[component-id]
// - (iframe parent window).drupalSettings.react[component-id]
// - defaultSettings.react[component-id]
// - null
export function getComponentSettings(
  component: HTMLDivElement,
  defaultSettings: AllComponentsSettings,
): ComponentSettings | null {
  const { id } = component;
  const { reactComponent } = component.dataset;
  if (id && reactComponent) {
    const win = window as any;
    const parentWin = frameElement?.ownerDocument?.defaultView as any;
    let data;
    if (win.drupalSettings?.react && id in win.drupalSettings.react)
      data = win.drupalSettings.react[id];
    else if (
      parentWin?.drupalSettings?.react &&
      id in parentWin.drupalSettings.react
    )
      data = parentWin.drupalSettings.react[id];
    else if (defaultSettings?.react && id in defaultSettings.react)
      data = defaultSettings.react[id];
    if (typeof data !== 'undefined') {
      data.component = reactComponent;
      return data;
    }
  }
  return null;
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

export function writeSettingsToPrefsStores(settings: Partial<PrefRoot>): void {
  const s = mergePrefsRoots(settings, S);
  Object.entries(s).forEach((entry) => {
    const [store, prefobj] = entry as [keyof PrefRoot, PrefObject];
    Object.keys(prefobj).forEach((key) => {
      Prefs.setComplexValue(key, s[store][key], store);
    });
  });
}

// Convert raw gen-book chaplist data from Drupal into a valid xulsword nodelist.
export function createNodeList(
  chaplist: ChaplistORType,
  props: Omit<SelectORProps, 'onSelection'>,
): void {
  // chaplist members are like: ['2/4/5', The/chapter/titles', 'url']
  // The Drupal chaplist is file data, and so does not include any parent
  // entries (as required by hierarchy()). So parents must be added before
  // sorting.
  const parent = (
    ch: ChaplistORType[number],
  ): ChaplistORType[number] | null => {
    const n = ch[1].split('/');
    const o = ch[0].split('/');
    const fdn = n.pop();
    o.pop();
    if (!fdn) {
      n.pop();
      o.pop();
    }
    if (n.length) {
      return [o.concat('').join('/'), n.concat('').join('/'), ''];
    }
    return null;
  };
  chaplist.forEach((xx) => {
    let x = xx;
    for (;;) {
      const p = parent(x);
      if (p === null) break;
      if (!chaplist.find((c) => c[1] === p[1])) {
        chaplist.push(p);
      }
      x = p;
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
