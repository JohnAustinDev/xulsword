/* eslint-disable prefer-rest-params */
import { G, getPanelWidths, GICall, keep } from './common.ts';
import C from './constant.ts';

import type S from './defaultPrefs.ts';
import type {
  GAddWindowId,
  GType,
  GTypeMain,
  LocationORType,
  SwordFeatures,
  TabType,
  TabTypes,
} from './type.ts';
import type RenderPromise from './clients/renderPromise.ts';
import type { XulswordState } from './clients/components/xulsword/xulsword.tsx';

// This file contains functions for manipulating the panels and tab-banks of
// a viewport. A viewport consists of one or more text panels plus a 'chooser'
// widget.

type TabChangeOptions = {
  panelIndex: number; // which panel(s) (-1 is all)
  whichTab: string | string[] | TabTypes | 'all'; // which tabs in the panel(s)
  doWhat: 'show' | 'hide' | 'toggle';
};

export type PanelChangeOptions = {
  whichPanel: number | number[] | null;
  whichModuleOrLocGB: string | LocationORType | Array<string | LocationORType>;
  maintainWidePanels: boolean;
  maintainPins: boolean;
};

type TabChangeState = Pick<
  typeof S.prefs.xulsword,
  'panels' | 'tabs' | 'mtModules' | 'location'
>;

type PanelChangeState = Pick<
  typeof S.prefs.xulsword,
  | 'panels'
  | 'mtModules'
  | 'tabs'
  | 'location'
  | 'ilModules'
  | 'isPinned'
  | 'keys'
>;

// Update xulsword state prefs to modify tabs. The only state props
// returned are those potentially, but not necessarily, modified.
export function setXulswordTabs(
  options: Partial<TabChangeOptions> & {
    skipCallbacks?: boolean;
    clearRendererCaches?: boolean;
  },
  renderPromise: RenderPromise | null,
  callback?: (xulsword: typeof S.prefs.xulsword) => void,
): Pick<typeof S.prefs.xulsword, 'panels' | 'mtModules' | 'tabs' | 'location'> {
  const id = (arguments[3] as number) ?? -1;
  const { skipCallbacks, clearRendererCaches } = {
    skipCallbacks: false,
    clearRendererCaches: true,
    ...options,
  };

  let isViewportWin: GAddWindowId['Window'] | null = null;
  if (Build.isElectronApp) {
    const winobj = (G() as GType).Window;
    if (id !== -1 && winobj) {
      const [d] = winobj.descriptions({ id });
      if (d?.type === 'viewportWin') isViewportWin = winobj;
    }
  }

  const xulsword = isViewportWin
    ? (isViewportWin.getComplexValue('xulswordState', id) as XulswordState)
    : ((G().Prefs as GAddWindowId['Prefs']).getComplexValue(
        'xulsword',
        undefined,
        id,
      ) as typeof S.prefs.xulsword);

  getTabChange(options, xulsword, renderPromise);
  const result = keep(xulsword, ['panels', 'mtModules', 'tabs', 'location']);

  if (!isViewportWin) {
    (G().Prefs as GAddWindowId['Prefs']).mergeValue(
      'xulsword',
      result,
      'prefs',
      skipCallbacks,
      clearRendererCaches,
      id,
    );
    // The previous prefs mergeValue will not reset the calling window to
    // prevent cycling (usually the calling window updates itself). In this
    // case the calling window needs an explicit reset to apply the new pref
    // values.
    if (Build.isElectronApp) (G() as GType).Window.reset('all', { id });
  } else {
    isViewportWin.setComplexValue('xulswordState', xulsword, id);
    isViewportWin.reset('all', 'self', id);
  }

  if (callback) callback(xulsword);

  return result;
}

// Sort tabslist in place by type and then by language relevance to a locale.
export function sortTabsByLocale<T extends TabType[] | string[]>(
  tablist: T,
  alocale?: string,
): T {
  const { Tab } = G();
  const defloc = G().i18n.language;
  const locale = (alocale || defloc).replace(/-.*$/, '');
  const locale2 = C.FallbackLanguage[defloc].replace(/-.*$/, '');
  const order: TabTypes[] = ['Texts', 'Comms', 'Genbks', 'Dicts'];
  const locales = C.Locales.map((l) => l[0].replace(/-.*$/, ''));
  const localeRelevance = (t: TabType): number => {
    let r = 0;
    const lang = t.lang?.replace(/-.*$/, '') ?? '';
    if (lang && lang === locale) {
      r -= 3;
    } else if (lang && lang === locale2) {
      r -= 2;
    } else if (lang && locales.includes(lang)) {
      r -= 1;
    } else if (
      (
        [
          'GreekDef',
          'HebrewDef ',
          'GreekParse',
          'HebrewParse',
          'Glossary',
        ] as SwordFeatures[]
      ).some((f) => t.features?.includes(f))
    ) {
      r += 1;
    }
    return r;
  };
  tablist.sort((ax, bx) => {
    const a = typeof ax === 'string' ? Tab[ax] : ax;
    const b = typeof bx === 'string' ? Tab[bx] : bx;
    const ai = order.findIndex((t) => a.tabType === t);
    const ar = localeRelevance(a);
    const bi = order.findIndex((t) => b.tabType === t);
    const br = localeRelevance(b);
    if (ai !== bi) return ai - bi;
    if (ar === 1 && br < 1) return 1;
    if (br === 1 && ar < 1) return -1;
    if (ar === br) return 0;
    return ar - br;
  });
  return tablist;
}

// Modify the xulsword state object adding new modules to tabs and panels.
// NOTE: The passed state is modified in place as well as returned, unless
// called from a renderer, in which case the passed state is NOT modified.
export function getModuleChange<T extends PanelChangeState>(
  modules: string[],
  state: T,
  renderPromise: RenderPromise | null,
  options?: Partial<TabChangeOptions & PanelChangeOptions>,
): T {
  const { Tab } = G();
  const whichTab = modules.filter(
    (m) => m && m in Tab && Tab[m] && Tab[m].xsmType !== 'XSM_audio',
  );
  if (whichTab.length) {
    getTabChange(
      {
        panelIndex: -1,
        doWhat: 'show',
        ...options,
        whichTab: modules,
      },
      state,
      renderPromise,
    );
    getPanelChange(
      {
        ...options,
        whichModuleOrLocGB: modules,
      },
      state,
      renderPromise,
    );
  }
  return state;
}

// Modify xulsword state making one or more modules visible in one or more viewport
// panels, if possible. If maintainWidePanels is true, existing wide panels will
// not be broken during the update, and if maintainPins is true, any pinned panels
// will not be updated (otherwise pinned panels which are updated will be unpinned).
// If panels argument is provided, only the given panel(s) may be updated. If a
// panel is updated and it does not have a tab for the new module, that tab will be
// added to the panel. Viewport location may also be updated.
// NOTE: The passed state is modified in place as well as returned, unless
// called from a renderer, in which case the passed state is NOT modified.
export function getPanelChange<T extends PanelChangeState>(
  options: Partial<PanelChangeOptions>,
  state: T,
  renderPromise: RenderPromise | null,
): T {
  const { ilModules, isPinned, keys } = state;
  let { panels, tabs, location } = state;
  const defaults: PanelChangeOptions = {
    whichPanel: null, // null is all panels
    whichModuleOrLocGB: [],
    maintainWidePanels: false,
    maintainPins: true,
  };
  const { maintainWidePanels, maintainPins, whichPanel, whichModuleOrLocGB } = {
    ...defaults,
    ...options,
  };
  const modules: Array<string | LocationORType | undefined> = Array.isArray(
    whichModuleOrLocGB,
  )
    ? whichModuleOrLocGB
    : [whichModuleOrLocGB];
  const { Tab } = G();
  let allowedPanels: number[];
  if (whichPanel === null) allowedPanels = panels.map((_a, i) => i);
  else if (Array.isArray(whichPanel)) allowedPanels = whichPanel;
  else allowedPanels = [whichPanel];
  const panelWidths = getPanelWidths({ panels, ilModules, isPinned });
  const modulesUpdated: string[] = [];
  let panelIndex = 0;
  let moduleIndex = 0;
  for (; moduleIndex < modules.length && panelIndex < panels.length; ) {
    if (!modules[moduleIndex]) {
      moduleIndex += 1;
      continue;
    }
    if (
      panels[panelIndex] === null ||
      !allowedPanels.includes(panelIndex) ||
      (maintainPins && isPinned[panelIndex])
    ) {
      const n =
        maintainWidePanels && (panelWidths[panelIndex] ?? 0) > 1
          ? (panelWidths[panelIndex] as number)
          : 1;
      panelIndex += n;
      continue;
    }
    const m = modules[moduleIndex];
    let module: string | undefined;
    let key: (typeof S.prefs.xulsword.keys)[number] | undefined;
    if (typeof m === 'string') {
      module = m;
    } else if (m) {
      ({ otherMod: module, key } = m);
    }
    if (module) {
      // Check if this module is already showing; if so we can just call it done
      // (after updating its key if it has one, and dis-allowing changes to the
      // existing panel).
      const p = panels.indexOf(module);
      if (p !== -1) {
        if (key) keys[p] = key;
        let n =
          maintainWidePanels && (panelWidths[p] ?? 0) > 1
            ? (panelWidths[p] as number)
            : 1;
        do {
          allowedPanels.splice(allowedPanels.indexOf(p + n - 1), 1);
          n -= 1;
        } while (n);
      } else {
        const { isVerseKey } = Tab[module];
        if (!maintainWidePanels) {
          panels[panelIndex] = module;
          if (key) keys[panelIndex] = key;
          else if (!isVerseKey) {
            keys[panelIndex] = null;
          }
          isPinned[panelIndex] = false;
          if (!tabs[panelIndex]?.includes(module)) {
            getTabChange(
              { panelIndex, whichTab: [module], doWhat: 'show' },
              state,
              renderPromise,
            );
            ({ panels, tabs, location } = state);
          }
        } else {
          for (let x = 0; x < (panelWidths[panelIndex] ?? 1); x += 1) {
            panels[panelIndex + x] = module;
            if (key) keys[panelIndex + x] = key;
            else if (!isVerseKey) {
              keys[panelIndex + x] = null;
            }
            isPinned[panelIndex + x] = false;
            if (!tabs[panelIndex + x]?.includes(module)) {
              getTabChange(
                {
                  panelIndex: panelIndex + x,
                  whichTab: [module],
                  doWhat: 'show',
                },
                state,
                renderPromise,
              );
              ({ panels, tabs, location } = state);
            }
          }
        }
        modulesUpdated.push(module);
      }
      panelIndex += 1;
    }
    modules[moduleIndex] = undefined;
    moduleIndex += 1;
  }

  type BimsType = { [mod: string]: ReturnType<GType['getBooksInVKModule']> };
  const bims = panels.reduce((p, c) => {
    if (c) p[c] = GICall([], renderPromise, ['getBooksInVKModule', null, [c]]);
    return p;
  }, {} as BimsType);

  if (modulesUpdated.length) {
    // Insure location will be in the scope of some viewport versekey module.
    const { book } = location || {};
    if (
      !book ||
      (panels.some((m) => m && m in Tab && Tab[m].isVerseKey) &&
        !panels.some(
          (m) => m && m in Tab && Tab[m].isVerseKey && bims[m].includes(book),
        ))
    ) {
      const mfirst = panels.find((m) => m && m in Tab && Tab[m].isVerseKey);
      if (mfirst) {
        state.location = {
          book: bims[mfirst][0] ?? 'Gen',
          chapter: 1,
          verse: 1,
          v11n: Tab[mfirst].v11n || null,
        };
      }
    }
  }
  return state;
}

// Modify xulsword state changing the tab banks of one, or all, panels. The
// tab(s) for a module, a list of modules, a type of module, or all modules,
// will be updated. Those tabs may be shown, hidden, or toggled.
// NOTE: The passed state is modified in place as well as returned, unless
// called from a renderer, in which case the passed state is NOT modified.
export function getTabChange<T extends TabChangeState>(
  options: Partial<TabChangeOptions>,
  state: T,
  renderPromise: RenderPromise | null,
): T {
  const { panels, mtModules, tabs } = state;
  const defaults: TabChangeOptions = {
    panelIndex: -1,
    whichTab: 'all',
    doWhat: 'show',
  };
  const { panelIndex, whichTab, doWhat } = {
    ...defaults,
    ...options,
  };

  const { Tabs, Tab } = G();
  const panelIndexes =
    panelIndex === -1 ? panels.map((_p: any, i: number) => i) : [panelIndex];

  let whichTabs: TabType[];
  switch (whichTab) {
    case 'all': {
      whichTabs = Tabs.slice();
      break;
    }
    case 'Texts':
    case 'Comms':
    case 'Dicts':
    case 'Genbks': {
      whichTabs = Tabs.filter((t) => t.tabType === whichTab);
      break;
    }
    default: {
      const ms = Array.isArray(whichTab) ? whichTab : [whichTab];
      const mods = ms.map((m) => (m && m in Tab && Tab[m]) || null);
      whichTabs = mods.filter(Boolean) as TabType[];
    }
  }

  // Set the tab bank of each panel in panelIndexes, unless the tab bank is
  // set to null. If toggling on allwindows, set tabs according to the previous
  // state of the clicked menuitem's tab, and not each tab's previous state.
  let doWhat2 = doWhat;
  if (doWhat === 'toggle' && panelIndex === -1) {
    const [m] = whichTabs;
    const dwh =
      m !== null &&
      tabs.every((t: any) => t === undefined || t?.includes(m.module));
    doWhat2 = dwh ? 'hide' : 'show';
  }
  panelIndexes.forEach((pi: number) => {
    const bank = tabs[pi] === undefined ? [] : tabs[pi];
    if (bank) {
      const newtabs = bank
        .map((m) => m && m in Tab && Tab[m])
        .filter(Boolean) as TabType[];
      whichTabs.forEach((t) => {
        if (t) {
          const show =
            doWhat2 === 'toggle'
              ? !bank.includes(t.module)
              : doWhat2 === 'show';
          if (show && !newtabs.includes(t)) {
            newtabs.push(t);
          } else if (!show && newtabs.includes(t)) {
            newtabs.splice(newtabs.indexOf(t), 1);
          }
        }
      });
      sortTabsByLocale(newtabs);
      tabs[pi] = newtabs.map((t) => t.module);
    }
  });

  // If user is setting tabs for a panel that is not open, then open it.
  if (panelIndexes.length === 1 && panels[panelIndexes[0]] === null)
    panels[panelIndexes[0]] = '';

  // Insure the module showing in each panel is one of the panel's tabs, and rather
  // than leave a panel's display module as empty string, if we can choose some
  // module do so, and choose a book too if none is selected.
  state.mtModules = mtModules.map((m: string | null, i: number) => {
    const nvali = tabs[i];
    return m && nvali && nvali.includes(m) ? m : null;
  });
  const used: any = {};
  panelIndexes.forEach((i) => {
    const m = panels[i];
    const bank = tabs[i];
    if (bank && m !== null) {
      if (!bank.length) {
        panels[i] = '';
      } else if (!bank.includes(m)) {
        panels[i] = '';
        let it = 0;
        let nextmod = bank[it];
        while (nextmod in used && it + 1 < bank.length) {
          it += 1;
          nextmod = bank[it];
        }
        panels[i] = nextmod;
        used[nextmod] = true;
        if (!state.location?.book && nextmod && Tab[nextmod].isVerseKey) {
          const [book] = GICall('Gen', renderPromise, [
            'getBooksInVKModule',
            null,
            [nextmod],
          ]);
          const v11n = Tab[nextmod].v11n || null;
          if (book && v11n) {
            state.location = {
              book,
              chapter: 1,
              verse: 1,
              v11n,
            };
          }
        }
      }
    }
  });
  return state;
}
