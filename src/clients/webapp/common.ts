import S from '../../defaultPrefs.ts';
import {
  clone,
  drupalSetting,
  hierarchy,
  ofClass,
  resolveTemplateURL,
} from '../../common.ts';
import { Analytics } from '../analytics.ts';
import Prefs from './prefs.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type { PrefObject, PrefRoot, PrefValue } from '../../type.ts';
import type { SelectORMType } from '../components/libxul/selectOR.tsx';
import {
  setDefaultBibleBrowserPrefs,
  type BibleBrowserData,
} from './bibleBrowser/defaultSettings.ts';
import type {
  ChaplistType,
  WidgetMenulistData,
  WidgetORData,
  WidgetVKData,
  UpdateLUrlDataType,
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
    let data = drupalSetting(`react.${id}`);
    if (
      typeof data === 'undefined' &&
      defaultSettings?.react &&
      id in defaultSettings.react
    ) {
      data = defaultSettings.react[id];
    }
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

// Convert genbk chaplist data from Drupal into a valid xulsword nodelist.
// This function assumes that chaplist contains fully qualified genbk paths
// (ie. '001 My Title') which are necessary for proper sorting. But labels
// have these three digit chapter numbers removed.
export function createNodeList(chaplist: ChaplistType): TreeNodeInfo[] {
  const flatNodesSorted: TreeNodeInfo[] = [];

  Object.entries(chaplist)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach((e) => {
      const [parent, chapdata] = e;
      const parentLabel = parent.replace(/(^|\/)\d\d\d /g, '$1');
      flatNodesSorted.push({
        id: `${parent}/`,
        label: parentLabel.split('/').pop() ?? '',
        className: 'cs-LTR_DEFAULT',
        hasCaret: true,
      });
      chapdata
        .sort((a, b) => {
          if (typeof a[0] === 'number' && typeof b[0] === 'number')
            return a[0] - b[0];
          if (typeof a[0] === 'string' && typeof b[0] === 'string')
            return a[0].localeCompare(b[0]);
          return 0;
        })
        .forEach((d) => {
          const [chapter] = d;
          const chapterLabel = chapter
            .toString()
            .replace(/(^|\/)\d\d\d /g, '$1');
          flatNodesSorted.push({
            id: `${parent}/${chapter}`,
            label: chapterLabel,
            className: 'cs-LTR_DEFAULT',
            hasCaret: false,
          });
        });
    });

  return hierarchy(flatNodesSorted);
}

export function updateLinks(
  selection: SelectVKType | SelectORMType,
  anchor: HTMLAnchorElement,
  data: ChaplistType,
  updateUrl: UpdateLUrlDataType,
  isReset: boolean,
) {
  let parent = '';
  let chapter: number | string | undefined;
  if ('otherMod' in selection) {
    const segs = selection.keys[0].split('/');
    chapter = segs.pop();
    parent = segs.join('/');
  } else {
    ({ book: parent, chapter } = selection);
  }

  // Find data index of the selection
  const index = data[parent].findIndex((x) => x[0] === chapter);
  if (index !== -1) {
    const [, , sizeSingle, , zip, dlkey] = data[parent][index];
    const [ch1, ch2, sizeMultiple] = zip;
    let { urlTemplate } = updateUrl;
    let linkText = '';

    // Read Drupal update_url info for this anchor element. The linkText string
    // may contain 'CHAPTER', 'CHAPTER1' or 'CHAPTER2' placeholders to be
    // replaced with current values.
    let myclass = '';
    Object.entries(updateUrl).forEach((e) => {
      const [k, v] = e;
      const classElem = ofClass(k, anchor);
      if (classElem) {
        myclass = k;
        if (k !== 'chapters' || ch1 !== ch2)
          classElem.element.removeAttribute('style'); // remove display: none
        if (typeof v === 'string') linkText = v;
        else {
          if ('urlTemplate' in v) ({ urlTemplate } = v);
          if ('all' in v) linkText = v.all;
          else if (dlkey in v) linkText = v[dlkey];
        }
      }
    });
    Object.entries({
      CHAPTER1: ch1,
      CHAPTER2: ch2,
      CHAPTER: chapter,
    }).forEach((e) => {
      const [placeholder, value] = e;
      if (typeof value !== 'undefined')
        linkText = linkText.replace(
          new RegExp(`\\b${placeholder}\\b`, 'g'),
          value.toString(),
        );
    });

    // Update the link text, as well as any size text found in parenthesis.
    if (linkText) {
      anchor.textContent = linkText;
      if (anchor.parentElement?.tagName === 'SPAN') {
        const size = myclass === 'dl_chapters' ? sizeMultiple : sizeSingle;
        const selem = anchor.parentElement.nextElementSibling;
        if (
          selem &&
          selem.tagName === 'SPAN' &&
          selem.textContent &&
          /^\(.*\)$/.test(selem.textContent)
        ) {
          const fnum = size / 1000000;
          const snum = fnum.toFixed(fnum > 10 ? 1 : 2);
          selem.textContent = `(${snum} MB)`;
        }
      }
    }

    // Update URL using the urlTemplate
    if (urlTemplate) {
      const sel = clone(selection);
      if (myclass === 'dl_chapters') {
        if ('book' in sel) {
          sel.chapter = ch1;
          sel.lastchapter = ch2;
        } else {
          const segsq = sel.keys[0].split('/') ?? '';
          const qualParent = segsq.slice(0, -1).join('/');
          const keys = [];
          for (let i = ch1 - 1; i <= ch2 - 1; i++) {
            const qualName = data[parent].find(
              (q) =>
                Number(q[0].toString().replace(/^(\d\d\d)( .*)?$/, '$1')) === i,
            );
            if (qualName) {
              keys.push(`${qualParent}/${qualName[0]}`);
            }
          }
          sel.keys = keys;
        }
      }
      anchor.setAttribute('href', resolveTemplateURL(urlTemplate, sel));
    }

    // Animate the link so the user sees the change
    const animate = ofClass('update_url', anchor);
    if (!isReset && animate) {
      jQuery(anchor).fadeTo(1, 0).fadeTo(1000, 1);
    }

    // Update analytics info so it will be recorded when anchor is clicked.
    Analytics.addInfo(
      {
        event: 'download',
        chapter1: ch1 === ch2 ? undefined : ch1,
        chapters: ch1 === ch2 ? undefined : 1 + ch2 - ch1,
      },
      anchor,
    );
  }
}
