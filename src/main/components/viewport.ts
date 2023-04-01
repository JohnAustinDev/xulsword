/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */
import { clone, getPanelWidths } from '../../common';
import S from '../../defaultPrefs';
import Prefs from './prefs';
import { getBooksInVKModule, getTab, getTabs } from '../minit';

import type { LocationGBType, TabType, TabTypes } from '../../type';

// Update the tab banks of one, or all, panels. The tab(s) for a module, a list of
// modules, a type of module, or all modules, will be updated. Those tabs may be
// shown, hidden, or toggled.
export function setViewportTabs(
  panelIndex: number, // which panel(s) (-1 is all)
  whichTab: string | string[] | TabTypes | 'all', // which tabs in the panel(s)
  doWhat: 'show' | 'hide' | 'toggle',
  skipCallbacks?: boolean,
  clearRendererCaches?: boolean
): void {
  const Tabs = getTabs();
  const Tab = getTab();
  const xulsword = Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword;
  const { location, mtModules, panels, tabs } = xulsword;
  const panelIndexes =
    panelIndex === -1 ? panels.map((_p: any, i: number) => i) : [panelIndex];

  let modules: TabType[];
  switch (whichTab) {
    case 'all': {
      modules = Tabs.slice();
      break;
    }
    case 'Texts':
    case 'Comms':
    case 'Dicts':
    case 'Genbks': {
      modules = Tabs.filter((t) => t.tabType === whichTab);
      break;
    }
    default: {
      const ms = Array.isArray(whichTab) ? whichTab : [whichTab];
      const mods: (TabType | null)[] = ms.map(
        (m) => (m && m in Tab && Tab[m]) || null
      );
      modules = mods.filter(Boolean) as TabType[];
    }
  }

  // Set the tab bank of each panel in panelIndexes. If toggling on allwindows,
  // set tabs according to the previous state of the clicked menuitem's tab,
  // and not each tab's previous state.
  let doWhat2 = doWhat;
  if (doWhat === 'toggle' && panelIndex === -1) {
    const m = modules[0];
    const dwh =
      m !== null &&
      tabs.every((t: any) => t === undefined || t?.includes(m.module));
    doWhat2 = dwh ? 'hide' : 'show';
  }
  panelIndexes.forEach((pi: number) => {
    modules.forEach((m) => {
      if (m) {
        const oldbank = clone(xulsword.tabs[pi]);
        const newbank = xulsword.tabs[pi];
        const show =
          doWhat2 === 'toggle'
            ? !oldbank || !oldbank.includes(m.module)
            : doWhat2 === 'show';
        if (show && (!oldbank || !oldbank.includes(m.module))) {
          if (newbank) newbank.push(m.module);
          // if creating a tab bank, create the tab banks before it as well
          else
            panels.forEach((_p: any, i: number) => {
              if (!xulsword.tabs[i])
                xulsword.tabs[i] = i === pi ? [m.module] : [];
            });
        } else if (!show && newbank && oldbank && oldbank.includes(m.module)) {
          newbank.splice(newbank.indexOf(m.module), 1);
        }
      }
    });
  });

  xulsword.tabs.forEach((tabbank, i: number) => {
    if (tabbank) {
      xulsword.tabs[i] = tabbank.filter(Boolean).sort((a, b) => {
        const ai = Tabs.indexOf(Tab[a]);
        const bi = Tabs.indexOf(Tab[b]);
        if (ai === bi) return 0;
        return ai < bi ? -1 : 1;
      });
    }
  });

  // If user is setting tabs for a panel that is not open, then open it.
  if (panelIndexes.length === 1 && panels[panelIndexes[0]] === null)
    xulsword.panels[panelIndexes[0]] = '';

  // Insure a panel's module vars point to modules that are included in the
  // panel's tab bank, and rather than leave a panel's display module as
  // empty string, if we can choose some module, and a book too if none
  // is selected, then do so.
  xulsword.mtModules = mtModules.map((m: string | null, i: number) => {
    const nvali = xulsword.tabs[i];
    return m && nvali && nvali.includes(m) ? m : null;
  });
  const used: any = {};
  panels.forEach((m: string | null, i: number) => {
    const tabBanki = xulsword.tabs[i];
    if (m !== null) {
      if (!tabBanki || !tabBanki.length) {
        xulsword.panels[i] = '';
      } else if (!tabBanki.includes(m)) {
        xulsword.panels[i] = '';
        let it = 0;
        let nextmod = tabBanki[it];
        while (nextmod in used && it + 1 < tabBanki.length) {
          it += 1;
          nextmod = tabBanki[it];
        }
        xulsword.panels[i] = nextmod;
        used[nextmod] = true;
        if (
          (!location || !location.book) &&
          nextmod &&
          Tab[nextmod].isVerseKey
        ) {
          const [book] = getBooksInVKModule(nextmod);
          const v11n = Tab[nextmod].v11n || null;
          if (book && v11n) {
            xulsword.location = {
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

  Prefs.mergeValue(
    'xulsword',
    xulsword,
    'prefs',
    skipCallbacks,
    clearRendererCaches
  );
}

// Make one or more modules visible in one or more viewport panels, if possible.
// If maintainWidePanels is true, existing wide panels will not be broken during
// the update, and if maintainPins is true, any pinned panels will not be updated
// (otherwise pinned panels which are updated will be unpinned). If panels argument
// is provided, only the given panel(s) may be updated. If a panel is updated and
// it does not have a tab for the new module, that tab will be added to the panel.
// Viewport location may also be updated. The new pref values are returned.
export function setViewportPanels(
  moduleOrLocGB: string | LocationGBType | (string | LocationGBType)[],
  options?: {
    maintainWidePanels?: boolean;
    maintainPins?: boolean;
    panel?: number | number[] | null;
    skipCallbacks?: boolean;
    clearRendererCaches?: boolean;
  }
): Pick<typeof S.prefs.xulsword, 'panels' | 'keys' | 'isPinned' | 'location'> {
  const {
    maintainWidePanels,
    maintainPins,
    panel,
    skipCallbacks,
    clearRendererCaches,
  } = {
    maintainWidePanels: false,
    maintainPins: true,
    panel: null, // null is all panels
    skipCallbacks: false, // default: run callbacks
    clearRendererCaches: true, // default: reset renderer caches
    ...options,
  };
  const modules: (string | LocationGBType | undefined)[] = Array.isArray(
    moduleOrLocGB
  )
    ? moduleOrLocGB
    : [moduleOrLocGB];
  const Tab = getTab();
  const xulsword = Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword;
  const { panels, keys, ilModules, isPinned, tabs } = xulsword;
  let allowedPanels: number[];
  if (panel === null) allowedPanels = panels.map((_a, i) => i);
  else if (Array.isArray(panel)) allowedPanels = panel;
  else allowedPanels = [panel];
  const panelWidths = getPanelWidths({ panels, ilModules, isPinned });
  // If a module is already showing, just update its key (if it has one).
  modules.forEach((x, ix) => {
    const m = !x || typeof x === 'string' ? x : x.module;
    const k = !x || typeof x === 'string' ? '' : x.key;
    if (m) {
      const p = panels.indexOf(m);
      if (p !== -1) {
        if (k) keys[p] = k;
        modules[ix] = undefined;
        allowedPanels = allowedPanels.filter((i) => panels[i] !== m);
      }
    }
  });
  const modulesUpdated: string[] = [];
  if (allowedPanels[0] !== undefined) {
    let panelIndex = allowedPanels[0];
    let moduleIndex = 0;
    for (
      ;
      moduleIndex < modules.length && panelIndex < panels.length;
      panelIndex += 1
    ) {
      if (!modules[moduleIndex]) {
        moduleIndex += 1;
        continue;
      }
      if (panels[panelIndex] === null) {
        panelIndex += 1;
        continue;
      }
      const m = modules[moduleIndex];
      let module: string | undefined;
      let key: typeof S.prefs.xulsword.keys[number] | undefined;
      if (typeof m === 'string') {
        module = m;
      } else if (m) {
        ({ module, key } = m);
      }
      if (module) {
        const { isVerseKey } = Tab[module];
        if (
          allowedPanels.includes(panelIndex) &&
          !(maintainPins && isPinned[panelIndex])
        ) {
          if (!maintainWidePanels) {
            panels[panelIndex] = module;
            if (key) keys[panelIndex] = key;
            else if (!isVerseKey) {
              keys[panelIndex] = null;
            }
            isPinned[panelIndex] = false;
            if (!tabs[panelIndex]?.includes(module))
              setViewportTabs(panelIndex, [module], 'show', true, false);
          } else {
            for (let x = 0; x < (panelWidths[panelIndex] ?? 1); x += 1) {
              panels[panelIndex + x] = module;
              if (key) keys[panelIndex + x] = key;
              else if (!isVerseKey) {
                keys[panelIndex + x] = null;
              }
              isPinned[panelIndex + x] = false;
              if (!tabs[panelIndex + x]?.includes(module))
                setViewportTabs(panelIndex + x, [module], 'show', true, false);
            }
          }
          modulesUpdated.push(module);
          modules[moduleIndex] = undefined;
          moduleIndex += 1;
        }
      }
    }
  }
  let { location } = xulsword;
  if (modulesUpdated.length) {
    // Insure location will be in the scope of a viewport versekey module.
    const { book } = location || {};
    if (
      !book ||
      (panels.some((m) => m && m in Tab && Tab[m].isVerseKey) &&
        !panels.some(
          (m) =>
            m &&
            m in Tab &&
            Tab[m].isVerseKey &&
            getBooksInVKModule(m).includes(book)
        ))
    ) {
      const mfirst = panels.find((m) => m && m in Tab && Tab[m].isVerseKey);
      if (mfirst) {
        location = {
          book: getBooksInVKModule(mfirst)[0],
          chapter: 1,
          verse: 1,
          v11n: Tab[mfirst].v11n || null,
        };
      }
    }
    // Save the results to Prefs.
    Prefs.mergeValue(
      'xulsword',
      { panels, keys, isPinned, location },
      'prefs',
      skipCallbacks,
      clearRendererCaches
    );
  }

  return { panels, keys, isPinned, location };
}

const Viewport = {
  setTabs: (
    ...args: Parameters<typeof setViewportTabs>
  ): ReturnType<typeof setViewportTabs> => {
    return setViewportTabs(...args);
  },
  setPanels: (
    ...args: Parameters<typeof setViewportPanels>
  ): ReturnType<typeof setViewportPanels> => {
    return setViewportPanels(...args);
  },
};

export default Viewport;
