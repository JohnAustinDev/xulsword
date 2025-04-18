import C from '../../constant.ts';
import S from '../../defaultPrefs.ts';
import { clone, hierarchy, JSON_parse, JSON_stringify } from '../../common.ts';
import Prefs from './prefs.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  OSISBookType,
  PrefObject,
  PrefRoot,
  PrefValue,
  TreeNodeInfoPref,
} from '../../type.ts';
import type { AnalyticsInfo, AnalyticsType } from '../../analytics.ts';
import type {
  SelectORMType,
  SelectORProps,
} from '../components/libxul/selectOR.tsx';
import {
  setDefaultBibleBrowserPrefs,
  type BibleBrowserData,
} from './bibleBrowser/defaultSettings.ts';
import type {
  ChaplistORType,
  ChaplistVKType,
  WidgetMenulistData,
  WidgetORData,
  WidgetVKData,
  ZipAudioDataType,
} from './widgets/defaultSettings.ts';
import type { SelectVKType } from '../components/libxul/selectVK.tsx';

export type AllComponentsData = {
  react: {
    [id: string]: ComponentData;
  };
};

export type ComponentData =
  | BibleBrowserData
  | WidgetVKData
  | WidgetORData
  | WidgetMenulistData;

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
        setDefaultBibleBrowserPrefs(
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
  // chaplist members are like: ['2/4/5', The/chapter/titles', 'url', 1054765]
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
      return [o.concat('').join('/'), n.concat('').join('/'), '', 1, '0'];
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

export function updateAudioDownloadLinks(
  parentElement: HTMLElement,
  selection: SelectVKType | SelectORMType,
  data: ChaplistVKType | ChaplistORType,
  data2: ZipAudioDataType,
  isReset: boolean,
) {
  const { zips } = data2;
  let parent: string | undefined;
  let chapter: number | undefined;
  let size: number | undefined;
  let ch1: number | undefined;
  let ch2: number | undefined;
  let sizes: number | undefined;
  if ('keys' in selection && Array.isArray(data)) {
    const { keys } = selection;
    const [key] = keys;
    const da = data.find((x) => x[1] === key);
    if (da) {
      const [order, , , fsize] = da;
      size = fsize;
      const os = order.split('/');
      chapter = Number(os.pop());
      parent = os.join('/');
      if (parent.startsWith('/')) parent = parent.substring(1);
    }
  } else if ('book' in selection && !Array.isArray(data)) {
    const { book, chapter: ch } = selection;
    parent = book;
    chapter = ch;
    if (book in data && Array.isArray(data[book])) {
      const c = data[book].find((x) => x[0] == chapter);
      if (typeof c !== 'undefined') [, , size] = c;
    }
  }
  if (!parent) return;

  if (parent in zips && typeof chapter === 'number') {
    const file = zips[parent].find(
      (x) => typeof chapter === 'number' && x[0] <= chapter && chapter <= x[1],
    );
    if (file) [ch1, ch2, sizes] = file;
  }

  if (typeof chapter === 'number' && typeof size === 'number') {
    const slinkp = parentElement?.querySelector('.update_url_dls') as
      | HTMLElement
      | undefined;
    if (slinkp) {
      const slink = (
        slinkp.tagName === 'A'
          ? slinkp
          : slinkp.querySelector('a[type="audio/mpeg"]')
      ) as HTMLAnchorElement | undefined;
      if (slink) {
        updateAudioDownloadLink(
          data,
          data2,
          slink,
          parent,
          chapter,
          chapter,
          size,
          'none',
        );
        slinkp.removeAttribute('style');
        if (!isReset)
          jQuery(parentElement.querySelectorAll('.update_url_dls'))
            .fadeTo(1, 0)
            .fadeTo(1000, 1);
      }
    }
  }

  if (
    typeof ch1 === 'number' &&
    typeof ch2 === 'number' &&
    typeof sizes === 'number'
  ) {
    const mlinkp = parentElement?.querySelector('.update_url_dlm') as
      | HTMLElement
      | undefined;
    if (mlinkp) {
      const mlink = (
        mlinkp.tagName === 'A'
          ? mlinkp
          : mlinkp.querySelector('a[type="audio/mpeg"]')
      ) as HTMLAnchorElement | undefined;
      if (mlink) {
        updateAudioDownloadLink(
          data,
          data2,
          mlink,
          parent,
          ch1,
          ch2,
          sizes,
          'zip',
        );
        if (ch1 === ch2) mlinkp.setAttribute('style', 'display:none');
        else {
          mlinkp.removeAttribute('style');
          if (!isReset)
            jQuery(parentElement.querySelectorAll('.update_url_dlm'))
              .fadeTo(1, 0)
              .fadeTo(1000, 1);
        }
      }
    }
  }
}

function updateAudioDownloadLink(
  data: ChaplistVKType | ChaplistORType,
  data2: ZipAudioDataType,
  anchor: HTMLAnchorElement,
  parent: string,
  chapter1: number,
  chapter2: number,
  bytes: number,
  packType: 'zip' | 'none',
) {
  const { link, linkmulti, linkbook, downloadUrl } = data2;

  let href = downloadUrl;
  href = href.replace('PARENT', parent);
  href = href.replace('CHAPTER1', chapter1.toString());
  href = href.replace('CHAPTER2', chapter2.toString());
  href = href.replace('PACKAGE', packType);
  anchor.href = href;

  const isBible = !Array.isArray(data);
  let textContent = chapter1 === chapter2 ? link : linkmulti;
  if (
    isBible &&
    chapter1 == 1 &&
    !Array.isArray(data) &&
    parent in data &&
    chapter2 == (data as any)[parent].length
  ) {
    textContent = linkbook;
  }
  textContent = textContent.replace('PARENT', parent);
  if (isBible) {
    textContent = textContent.replace('CHAPTER1', chapter1.toString());
    textContent = textContent.replace('CHAPTER2', chapter2.toString());
  } else {
    // General book chapters begin at zero, but this text is for end users who
    // expect the first chapter to be one.
    textContent = textContent.replace('CHAPTER1', (chapter1 + 1).toString());
    textContent = textContent.replace('CHAPTER2', (chapter2 + 1).toString());
  }
  anchor.textContent = textContent;

  if (anchor.parentElement?.tagName === 'SPAN') {
    const selem = anchor.parentElement.nextElementSibling;
    if (selem && selem.tagName === 'SPAN') {
      const fnum = bytes / 1000000;
      const snum = fnum.toFixed(fnum > 10 ? 1 : 2);
      selem.textContent = `(${snum} MB)`;
    }
  }

  analyticsInfo(anchor, {
    chapter1: chapter1 === chapter2 ? undefined : chapter1.toString(),
    chapters:
      chapter1 === chapter2 ? undefined : (1 + chapter2 - chapter1).toString(),
  });
}

// Update the href of an anchor element by setting or changing the given
// params to new values.
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

// Convert a data object into a string suitable for merging into or replacing
// the data-info attribute of an HTML element, which is used to send analytics
// data.
export function analyticsInfo(
  element: HTMLElement | null,
  info: AnalyticsInfo,
  replace = false,
) {
  if (element) {
    const init =
      !replace && element.dataset.info
        ? (JSON_parse(
            decodeURIComponent(element.dataset.info),
          ) as AnalyticsInfo)
        : {};
    element.dataset.info = encodeURIComponent(
      JSON_stringify({ ...init, ...info }),
    );
  }
}

export function analyticsElement(
  element: HTMLElement | null | undefined,
): HTMLElement | null {
  let el: HTMLElement | null | undefined = element;
  if (element) {
    while (el && !el.classList.contains('view-row')) el = el.parentElement;
  }
  return el || element || null;
}
