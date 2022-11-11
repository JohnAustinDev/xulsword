/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */
import { clone } from '../common';
import Prefs from './components/prefs';
import { getBooksInModule, getTab, getTabs } from './minit';

import type { TabType, TabTypes, XulswordStatePref } from '../type';

export default function setViewportTabs(
  panelIndex: number, // which panel(s) (-1 is all)
  whichTabs: string | TabTypes | 'all', // which tabs in the panel(s)
  doWhat: 'show' | 'hide' | 'toggle'
): void {
  const Tabs = getTabs();
  const Tab = getTab();
  const xulsword = clone(
    Prefs.getComplexValue('xulsword')
  ) as XulswordStatePref;
  const { location, mtModules, panels, tabs } = xulsword;
  const panelIndexes =
    panelIndex === -1 ? panels.map((_p: any, i: number) => i) : [panelIndex];

  let modules: TabType[];
  switch (whichTabs) {
    case 'all': {
      modules = Tabs.slice();
      break;
    }
    case 'Texts':
    case 'Comms':
    case 'Dicts':
    case 'Genbks': {
      modules = Tabs.filter((t) => t.tabType === whichTabs);
      break;
    }
    default:
      modules = [Tab[whichTabs]];
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
          const [book] = getBooksInModule(nextmod);
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

  Prefs.mergeValue('xulsword', xulsword);
}
