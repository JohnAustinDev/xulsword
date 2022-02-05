/* eslint-disable no-nested-ternary */
/* eslint-disable new-cap */
/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import path from 'path';
import { JSON_parse, JSON_stringify } from '../common';
import { TabTypes } from '../type';
import C from '../constant';
import G from './mg';
import nsILocalFile from './components/nsILocalFile';

// creates only allowable file types
export function createSafeFile(
  nsIFile: nsILocalFile,
  perm: number,
  createUnique = false
) {
  if (!nsIFile) return false;

  // only create a file if it has one of these file extensions
  if (!/\.(txt|xsb|rdf|conf|xpi)$/i.test(nsIFile.leafName)) {
    return false;
  }

  if (createUnique) nsIFile.createUnique(nsILocalFile.NORMAL_FILE_TYPE, perm);
  else nsIFile.create(nsILocalFile.NORMAL_FILE_TYPE, perm);

  return true;
}

// writes to only allowable file types
export function writeSafeFile(
  nsIFile: nsILocalFile,
  str: string,
  overwrite: boolean,
  toEncoding = 'utf8'
) {
  if (!nsIFile) return false;

  // only write to a file if it has one of these file extensions
  if (!/\.(txt|xsb|rdf|conf)$/i.test(nsIFile.leafName)) {
    return false;
  }

  if (nsIFile.exists()) {
    if (!overwrite) return false;
    nsIFile.remove(true);
  }
  createSafeFile(nsIFile, C.FPERM);

  nsIFile.writeFile(str, { encoding: toEncoding, mode: C.FPERM });

  return true;
}

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 1212;
  resolveHtmlPath = (htmlFileName: string) => {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  };
} else {
  resolveHtmlPath = (htmlFileName: string) => {
    return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
  };
}

// Sort tabs to particular order
function tabOrder(as: string, bs: string) {
  const a = G.Tab[as];
  const b = G.Tab[bs];
  if (a.tabType === b.tabType) {
    // Priority: 1) Modules matching current locale, 2) Other tabs that have
    // locales installed, 3) remaining tabs.
    const aLocale = G.ModuleConfigs[a.module]?.AssociatedLocale;
    const bLocale = G.ModuleConfigs[b.module]?.AssociatedLocale;
    const lng = G.Prefs.getCharPref(C.LOCALEPREF);
    const aPriority =
      aLocale && aLocale !== C.NOTFOUND ? (aLocale === lng ? 1 : 2) : 3;
    const bPriority =
      bLocale && bLocale !== C.NOTFOUND ? (bLocale === lng ? 1 : 2) : 3;
    if (aPriority !== bPriority) return aPriority > bPriority ? 1 : -1;
    // Type and Priority are same. Sort by label's alpha.
    return a.label > b.label ? 1 : -1;
  }
  const mto = C.ModuleTypeOrder as any;
  return mto[a.tabType] > mto[b.tabType] ? 1 : -1;
}

export function setTabs(
  type: TabTypes | 'all',
  panelLabel: string | 'all',
  modOrAll: string,
  doWhat: 'show' | 'hide' | 'toggle'
) {
  const panels = G.Prefs.getComplexValue('xulsword.panels');
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const pix = Number(panelLabel.substring(panelLabel.length - 1));
  const panelIndexes = Number.isNaN(pix)
    ? panels.map((_p: any, i: number) => i)
    : [pix - 1];

  const modules =
    modOrAll === 'all'
      ? G.Tabs.map((t) => {
          return type === 'all' || type === t.tabType ? t : null;
        })
      : [G.Tab[modOrAll]];

  const pval = G.Prefs.getComplexValue('xulsword.tabs') as (string[] | null)[];
  const nval = JSON_parse(JSON_stringify(pval)) as (string[] | null)[];

  // If toggling on allwindows, set them according to the clicked
  // menuitem, and not each item separately.
  let doWhat2 = doWhat;
  if (doWhat === 'toggle' && panelLabel === 'menu.view.allwindows') {
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
          // if creating a tab bank, create tab banks before it as well
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

  nval.forEach((tabs, i: number) => {
    if (tabs) {
      const tmp = tabs.filter(Boolean);
      nval[i] = tmp.sort(tabOrder);
    }
  });

  // If user is setting tabs for a panel that is not open, then open it.
  if (panelIndexes.length === 1 && panels[panelIndexes[0]] === null)
    panels[panelIndexes[0]] = '';

  // Insure a panel's module vars point to modules within the panel's tab bank,
  // and rather than leave a panel's display module as empty string, we can
  // choose a new module, and choose a book too if none is already selected.
  const mtm = G.Prefs.getComplexValue('xulsword.mtModules');
  const nmtm = mtm.map((m: string | null, i: number) => {
    const nvali = nval[i];
    return m && nvali && nvali.includes(m) ? m : undefined;
  });
  G.Prefs.setComplexValue('xulsword.mtModules', nmtm);
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
      let bk = G.Prefs.getCharPref('xulsword.book');
      if (!bk && nextmod && G.Tab[nextmod].isVerseKey) {
        [bk] = G.AvailableBooks[nextmod];
        if (bk) {
          G.Prefs.setCharPref('xulsword.book', bk);
        }
      }
    }
  });

  G.Prefs.setComplexValue('xulsword.panels', panels);
  G.Prefs.setComplexValue('xulsword.tabs', nval);

  // Update global states corresponding to prefs which could have been changed.
  G.setGlobalStateFromPref(null, [
    'xulsword.tabs',
    'xulsword.panels',
    'xulsword.mtModules',
    'xulsword.book',
  ]);
}

export function jsdump(msg: string | Error) {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  )
    // eslint-disable-next-line no-console
    console.log(msg);
}
