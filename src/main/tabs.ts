/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */
import C from '../constant';
import { JSON_parse, JSON_stringify } from '../common';
import Prefs from './modules/prefs';
import { getModuleConfigs } from './config';
import {
  getAvailableBooks,
  getTab,
  getTabs,
  setGlobalStateFromPref,
} from './minit';

import type { TabType, TabTypes } from '../type';

export default function setViewportTabs(
  panelIndex: number, // -1 selects all panels
  whichTabs: string | TabTypes | 'all',
  doWhat: 'show' | 'hide' | 'toggle'
): void {
  const tabs = getTabs();
  const tab = getTab();
  const moduleConfigs = getModuleConfigs();
  const availableBooks = getAvailableBooks();
  const panels = Prefs.getComplexValue('xulsword.panels');
  const panelIndexes =
    panelIndex === -1 ? panels.map((_p: any, i: number) => i) : [panelIndex];

  let modules: TabType[];
  switch (whichTabs) {
    case 'all': {
      modules = tabs.slice();
      break;
    }
    case 'Texts':
    case 'Comms':
    case 'Dicts':
    case 'Genbks': {
      modules = tabs.filter((t) => t.tabType === whichTabs);
      break;
    }
    default:
      modules = [tab[whichTabs]];
  }

  const pval = Prefs.getComplexValue('xulsword.tabs') as (string[] | null)[];
  const nval = JSON_parse(JSON_stringify(pval)) as (string[] | null)[];

  // Set the tab bank of each panel in panelIndexes. If toggling on allwindows,
  // set tabs according to the previous state of the clicked menuitem's tab,
  // and not each tab's previous state.
  let doWhat2 = doWhat;
  if (doWhat === 'toggle' && panelIndex === -1) {
    const m = modules[0];
    const dwh =
      m !== null &&
      pval.every((t: any) => t === undefined || t?.includes(m.module));
    doWhat2 = dwh ? 'hide' : 'show';
  }
  panelIndexes.forEach((pi: number) => {
    modules.forEach((m) => {
      if (m) {
        const tabbank = pval[pi];
        const ntabbank = nval[pi];
        const show =
          doWhat2 === 'toggle'
            ? !tabbank || !tabbank.includes(m.module)
            : doWhat2 === 'show';
        if (show && (!tabbank || !tabbank.includes(m.module))) {
          if (ntabbank) ntabbank.push(m.module);
          // if creating a tab bank, create the tab banks before it as well
          else
            panels.forEach((_p: any, i: number) => {
              if (!nval[i]) nval[i] = i === pi ? [m.module] : [];
            });
        } else if (!show && ntabbank && tabbank && tabbank.includes(m.module)) {
          ntabbank.splice(ntabbank.indexOf(m.module), 1);
        }
      }
    });
  });

  // Sort tabs into the following order:
  // - By module type (see C.ModuleTypeOrder)
  // - Modules matching the current locale
  // - Modules matching any installed locale
  // - By label alpha
  nval.forEach((tabbank, i: number) => {
    if (tabbank) {
      const tmp = tabbank.filter(Boolean);
      nval[i] = tmp.sort((as: string, bs: string) => {
        const a = tab[as];
        const b = tab[bs];
        if (a.tabType === b.tabType) {
          const aLocale = moduleConfigs[a.module]?.AssociatedLocale;
          const bLocale = moduleConfigs[b.module]?.AssociatedLocale;
          const lng = Prefs.getCharPref(C.LOCALEPREF);
          const aPriority =
            aLocale && aLocale !== C.NOTFOUND ? (aLocale === lng ? 1 : 2) : 3;
          const bPriority =
            bLocale && bLocale !== C.NOTFOUND ? (bLocale === lng ? 1 : 2) : 3;
          if (aPriority !== bPriority) return aPriority > bPriority ? 1 : -1;
          // Type and Priority are same, then sort by label's alpha.
          return a.label > b.label ? 1 : -1;
        }
        const mto = C.ModuleTypeOrder as any;
        return mto[a.tabType] > mto[b.tabType] ? 1 : -1;
      });
    }
  });

  // If user is setting tabs for a panel that is not open, then open it.
  if (panelIndexes.length === 1 && panels[panelIndexes[0]] === null)
    panels[panelIndexes[0]] = '';

  // Insure a panel's module vars point to modules that are included in the
  // panel's tab bank, and rather than leave a panel's display module as
  // empty string, we can choose some module, and choose a book too if none
  // is already selected.
  const mtm = Prefs.getComplexValue('xulsword.mtModules');
  const nmtm = mtm.map((m: string | null, i: number) => {
    const nvali = nval[i];
    return m && nvali && nvali.includes(m) ? m : undefined;
  });
  Prefs.setComplexValue('xulsword.mtModules', nmtm);
  const used: any = {};
  panels.forEach((m: string | null, i: number) => {
    const nvali = nval[i];
    if (m !== null && nvali && nvali.length && !nvali.includes(m)) {
      panels[i] = '';
      let it = 0;
      let nextmod = nvali[it];
      while (nextmod in used && it + 1 < nvali.length) {
        it += 1;
        nextmod = nvali[it];
      }
      panels[i] = nextmod;
      used[nextmod] = true;
      let bk = Prefs.getCharPref('xulsword.book');
      if (!bk && nextmod && tab[nextmod].isVerseKey) {
        [bk] = availableBooks[nextmod];
        if (bk) {
          Prefs.setCharPref('xulsword.book', bk);
        }
      }
    }
  });

  Prefs.setComplexValue('xulsword.panels', panels);
  Prefs.setComplexValue('xulsword.tabs', nval);
  setGlobalStateFromPref(null, [
    'xulsword.tabs',
    'xulsword.panels',
    'xulsword.mtModules',
    'xulsword.book',
  ]);
}
