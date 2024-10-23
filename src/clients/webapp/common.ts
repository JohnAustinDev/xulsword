import C from '../../constant.ts';
import S from '../../defaultPrefs.ts';
import { clone, hierarchy } from '../../common.ts';
import Prefs from './prefs.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  PrefObject,
  PrefRoot,
  PrefValue,
  TreeNodeInfoPref,
} from '../../type.ts';
import type { SelectORProps } from '../components/libxul/selectOR.tsx';
import {
  setEmptyPrefs,
  type BibleBrowserSettings as BibleBrowserData,
} from './bibleBrowser/defaultSettings.ts';
import type {
  ChaplistORType,
  WidgetMenulistSettings,
  WidgetORSettings,
  WidgetVKSettings,
} from './widgets/defaultSettings.ts';

export type AllComponentsData = {
  react: {
    [id: string]: ComponentData;
  };
};

export type ComponentData =
  | BibleBrowserData
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
  defaultSettings: AllComponentsData,
): ComponentData | null {
  const { id } = component;
  const { reactComponent } = component.dataset;
  if (id && reactComponent) {
    const win = window as any;
    const parentWin = frameElement?.ownerDocument?.defaultView as any;
    let data: ComponentData | undefined;
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
      (data as any).component = reactComponent;
      if (data.component === 'bibleBrowser')
        setEmptyPrefs(
          data.settings.prefs as BibleBrowserData['settings']['prefs'],
        );
      return data;
    }
  }
  return null;
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

export function writeSettingsToPrefsStores(
  settings: Partial<PrefRoot>,
  userPrefs: 'before' | 'after' | 'none',
): void {
  const s = mergePrefsRoots(settings, userPrefs);
  Object.entries(s).forEach((entry) => {
    const [store, prefobj] = entry as [keyof PrefRoot, PrefObject];
    Object.keys(prefobj).forEach((key) => {
      Prefs.setComplexValue(key, s[store][key], store);
    });
  });
}

// Return a complete Prefs root object by merging sparse into default prefs,
// with the option to merge user prefs before or after sparse. If userPrefs is
// 'none' then user prefs are ignored. Note: rootkey object property values are
// merged (ie. root.prefs.global properties).
export function mergePrefsRoots(
  sparse: Partial<PrefRoot>,
  userPrefs: 'before' | 'after' | 'none',
): PrefRoot {
  const complete: PrefRoot = clone(S);
  Object.entries(complete).forEach((entry) => {
    // ex: prefs, xulsword
    const [store, prefobj] = entry as [keyof PrefRoot, PrefObject];
    Object.entries(prefobj).forEach((entry2) => {
      // ex: location, { book: Gen... }
      const [key, defValue] = entry2;
      const sparseStore = sparse[store];
      const value =
        sparseStore && key in sparseStore ? sparseStore[key] : undefined;
      let uvalue = null;
      if (userPrefs !== 'none' && Prefs.getStorageType() !== 'none') {
        try {
          const v = Prefs.getComplexValue(key, store);
          if (typeof v === typeof defValue) {
            uvalue = v as any;
          }
        } catch (er) {
          uvalue = null;
        }
      }
      // If defValue is itself a prefObject, merge its keys so it is always complete.
      if (defValue && typeof defValue === 'object') {
        const userValue: Record<string, PrefValue> =
          uvalue !== null ? uvalue : {};
        if (userPrefs === 'after') {
          complete[store][key] = {
            ...defValue,
            ...(value && typeof value === 'object' ? value : {}),
            ...userValue,
          };
        } else {
          complete[store][key] = {
            ...defValue,
            ...userValue,
            ...(value && typeof value === 'object' ? value : {}),
          };
        }
      } else {
        // Don't think this ever happens (a store key value that is not an object?)
        const userValue = uvalue !== null ? uvalue : defValue;
        if (userPrefs === 'after') {
          complete[store][key] = userValue ?? value;
        } else {
          complete[store][key] = value ?? userValue;
        }
      }
    });
  });
  return complete;
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

export function updateHrefParams(
  anchor: HTMLAnchorElement,
  params: Record<string, string | number>,
) {
  const href = anchor.getAttribute('href');
  if (href) {
    const hrefMatched = href.match(/^([^?]+)\?(.*?)$/);
    if (hrefMatched) {
      const [, url, qps] = hrefMatched;
      const updated: Record<string, string> = {};
      const inputQueryParams = qps.split('&');
      for (;;) {
        const next = inputQueryParams.shift();
        if (!next) break;
        const [param, value] = next.split('=') as [string, string];
        updated[param] = value;
      }
      Object.entries(params).forEach((entry) => {
        const [param, value] = entry;
        updated[param] = value.toString();
      });
      if (Object.keys(updated).length) {
        const query = Object.entries(updated).reduce(
          (p, c) => `${p}${p ? '&' : ''}${c[0]}=${c[1]}`,
          '',
        );
        anchor.setAttribute('href', `${url}?${query}`);
      }
    }
  }
}
