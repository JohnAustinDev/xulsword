/* eslint-disable no-continue */
/* eslint-disable no-nested-ternary */
import i18n from 'i18next';
import { getPanelWidths, keep } from '../../common.ts';
import C from '../../constant.ts';
import S from '../../defaultPrefs.ts';
import Prefs from './prefs.ts';
import { getBooksInVKModule, getTab, getTabs } from '../minit.ts';

import type {
  LocationORType,
  SwordFeatures,
  TabType,
  TabTypes,
} from '../../type.ts';

type TabChangeOptions = {
  panelIndex: number; // which panel(s) (-1 is all)
  whichTab: string | string[] | TabTypes | 'all'; // which tabs in the panel(s)
  doWhat: 'show' | 'hide' | 'toggle';
};

type PanelChangeOptions = {
  whichPanel: number | number[] | null;
  whichModuleOrLocGB: string | LocationORType | (string | LocationORType)[];
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

const Viewport = {
  // Sort tabslist in place by type and then by language relevance to a locale.
  sortTabsByLocale<T extends TabType[] | string[]>(
    tablist: T,
    alocale?: string
  ): T {
    const locale = (alocale || i18n.language).replace(/-.*$/, '');
    const locale2 = C.FallbackLanguage[i18n.language].replace(/-.*$/, '');
    const Tab = getTab();
    const order: TabTypes[] = ['Texts', 'Comms', 'Genbks', 'Dicts'];
    const locales = C.Locales.map((l) => l[0].replace(/-.*$/, ''));
    const localeRelevance = (t: TabType): number => {
      let r = 0;
      const lang = t.conf.Lang?.replace(/-.*$/, '') ?? '';
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
        ).some((f) => t.conf.Feature?.includes(f))
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
  },

  // Modify xulsword state changing the tab banks of one, or all, panels. The
  // tab(s) for a module, a list of modules, a type of module, or all modules,
  // will be updated. Those tabs may be shown, hidden, or toggled.
  // NOTE: The passed state is modified in place as well as returned, unless
  // called from a renderer, in which case the passed state is NOT modified.
  getTabChange<T extends TabChangeState>(
    options: Partial<TabChangeOptions>,
    state: T
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

    const Tabs = getTabs();
    const Tab = getTab();
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
      const m = whichTabs[0];
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
        this.sortTabsByLocale(newtabs);
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
          if (
            (!state.location || !state.location.book) &&
            nextmod &&
            Tab[nextmod].isVerseKey
          ) {
            const [book] = getBooksInVKModule(nextmod);
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
  },

  // Modify xulsword state making one or more modules visible in one or more viewport
  // panels, if possible. If maintainWidePanels is true, existing wide panels will
  // not be broken during the update, and if maintainPins is true, any pinned panels
  // will not be updated (otherwise pinned panels which are updated will be unpinned).
  // If panels argument is provided, only the given panel(s) may be updated. If a
  // panel is updated and it does not have a tab for the new module, that tab will be
  // added to the panel. Viewport location may also be updated.
  // NOTE: The passed state is modified in place as well as returned, unless
  // called from a renderer, in which case the passed state is NOT modified.
  getPanelChange<T extends PanelChangeState>(
    options: Partial<PanelChangeOptions>,
    state: T
  ): T {
    const { ilModules, isPinned, keys } = state;
    let { panels, tabs, location } = state;
    const defaults: PanelChangeOptions = {
      whichPanel: null, // null is all panels
      whichModuleOrLocGB: [],
      maintainWidePanels: false,
      maintainPins: true,
    };
    const { maintainWidePanels, maintainPins, whichPanel, whichModuleOrLocGB } =
      {
        ...defaults,
        ...options,
      };
    const modules: (string | LocationORType | undefined)[] = Array.isArray(
      whichModuleOrLocGB
    )
      ? whichModuleOrLocGB
      : [whichModuleOrLocGB];
    const Tab = getTab();
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
      let key: typeof S.prefs.xulsword.keys[number] | undefined;
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
              this.getTabChange(
                { panelIndex, whichTab: [module], doWhat: 'show' },
                state
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
                this.getTabChange(
                  {
                    panelIndex: panelIndex + x,
                    whichTab: [module],
                    doWhat: 'show',
                  },
                  state
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

    if (modulesUpdated.length) {
      // Insure location will be in the scope of some viewport versekey module.
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
          state.location = {
            book: getBooksInVKModule(mfirst)[0],
            chapter: 1,
            verse: 1,
            v11n: Tab[mfirst].v11n || null,
          };
        }
      }
    }
    return state;
  },

  // Modify the xulsword state object adding new modules to tabs and panels.
  // NOTE: The passed state is modified in place as well as returned, unless
  // called from a renderer, in which case the passed state is NOT modified.
  getModuleChange<T extends PanelChangeState>(
    modules: string[],
    state: T,
    options?: Partial<TabChangeOptions & PanelChangeOptions>
  ): T {
    const Tab = getTab();
    const whichTab = modules.filter(
      (m) => m && m in Tab && Tab[m] && Tab[m].conf.xsmType !== 'XSM_audio'
    );
    if (whichTab.length) {
      this.getTabChange(
        {
          panelIndex: -1,
          doWhat: 'show',
          ...options,
          whichTab: modules,
        },
        state
      );
      this.getPanelChange(
        {
          ...options,
          whichModuleOrLocGB: modules,
        },
        state
      );
    }
    return state;
  },

  // Update xulsword state prefs to modify tabs. The only state props
  // returned are those potentially, but not necessarily, modified.
  setXulswordTabs(
    options: Partial<TabChangeOptions> & {
      skipCallbacks?: boolean;
      clearRendererCaches?: boolean;
    }
  ): Pick<
    typeof S.prefs.xulsword,
    'panels' | 'mtModules' | 'tabs' | 'location'
  > {
    const { skipCallbacks, clearRendererCaches } = {
      skipCallbacks: false,
      clearRendererCaches: true,
      ...options,
    };
    const xulsword = Prefs.getComplexValue(
      'xulsword'
    ) as typeof S.prefs.xulsword;

    this.getTabChange(options, xulsword);
    const result = keep(xulsword, ['panels', 'mtModules', 'tabs', 'location']);

    Prefs.mergeValue(
      'xulsword',
      result,
      'prefs',
      skipCallbacks,
      clearRendererCaches
    );

    return result;
  },

  // Update xulsword state prefs to modify viewport panels. The only state
  // props returned are those potentially, but not necessarily, modified
  // in the process.
  setXulswordPanels(
    options: Partial<PanelChangeOptions> & {
      skipCallbacks?: boolean;
      clearRendererCaches?: boolean;
    }
  ): Pick<
    typeof S.prefs.xulsword,
    'panels' | 'mtModules' | 'tabs' | 'keys' | 'isPinned' | 'location'
  > {
    const { skipCallbacks, clearRendererCaches } = {
      skipCallbacks: false, // default: run callbacks
      clearRendererCaches: true, // default: reset renderer caches
      ...options,
    };

    const xulsword = Prefs.getComplexValue(
      'xulsword'
    ) as typeof S.prefs.xulsword;
    this.getPanelChange(options, xulsword);
    const result = keep(xulsword, [
      'panels',
      'mtModules',
      'tabs',
      'keys',
      'isPinned',
      'location',
    ]);

    // Save the results to Prefs.
    Prefs.mergeValue(
      'xulsword',
      result,
      'prefs',
      skipCallbacks,
      clearRendererCaches
    );

    return result;
  },
};

export default Viewport;
