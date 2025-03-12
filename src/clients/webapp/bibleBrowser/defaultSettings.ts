/* eslint-disable @typescript-eslint/naming-convention */

import Cache from '../../../cache.ts';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import { GCacheKey } from '../../../common.ts';
import type S from '../../../defaultPrefs.ts';
import type { AllComponentsData } from '../common.ts';
import type { PrefsGType } from '../../../prefs.ts';

export type BibleBrowserSettings = {
  component: 'bibleBrowser';
  langcode: string; // the fallback language if prefs.global.local is invalid.
  settings: {
    storageId: string;
    frame: string;
    css: string;
    prefs: {
      xulsword: Partial<(typeof S)['prefs']['xulsword']>;
      global: {
        locale: (typeof C.Locales)[number][0];
      };
    };
  };
};

// Certain default settings were left empty, to be filled at runtime. If prefs
// is a G.Prefs object, the prefs will be updated directly.
export function setEmptyPrefs(
  prefs: BibleBrowserSettings['settings']['prefs'] | PrefsGType,
) {
  const xulsword =
    'getComplexValue' in prefs
      ? (prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword)
      : prefs.xulsword;
  const { tabs, panels } = xulsword;

  if (Cache.has(GCacheKey(['Tabs', null, undefined]))) {
    if (G.Tabs.length && (!tabs || tabs.every((t) => !t || !t.length))) {
      const ntabs = tabs ?? [[], []];
      ntabs.forEach((tabBank) => {
        if (Array.isArray(tabBank))
          tabBank.push(...G.Tabs.map((t) => t.module));
      });
      xulsword.tabs = ntabs;
    }
    if (G.Tabs.length && (!panels || panels.every((p) => !p))) {
      const npanels = (panels ?? ['', '']).map((p) => p || G.Tabs[0].module);
      xulsword.panels = npanels;
    }
  }

  if (!xulsword.place || !Object.keys(xulsword.place).length) {
    xulsword.place =
      window.innerWidth <= C.UI.WebApp.mobileW
        ? {
            footnotes: 'popup',
            crossrefs: 'popup',
            usernotes: 'popup',
          }
        : {
            footnotes: 'notebox',
            crossrefs: 'notebox',
            usernotes: 'popup',
          };
  }

  if (!xulsword.noteBoxHeight || xulsword.noteBoxHeight[0] === -1) {
    const h = window.innerWidth <= C.UI.WebApp.mobileW ? 200 : 300;
    xulsword.noteBoxHeight = [h];
    if (xulsword.panels?.length) {
      xulsword.noteBoxHeight = xulsword.panels.map(() => h);
    }
  }

  if (xulsword.showChooser === null) {
    xulsword.showChooser = window.innerWidth > C.UI.WebApp.mobileW;
  }

  if ('setComplexValue' in prefs) {
    prefs.setComplexValue('xulsword', xulsword);
  } else {
    prefs.xulsword = xulsword;
  }
}

const defaultSettings: AllComponentsData = {
  react: {
    bibleBrowser_1: {
      component: 'bibleBrowser',
      langcode: 'en',
      settings: {
        storageId: 'after:user.0', // load user settings after prefs
        frame: '0', // is this a third party iframe?
        css: '',
        prefs: {
          xulsword: {
            location: {
              book: 'Matt',
              chapter: 1,
              v11n: 'KJV',
            },
            selection: null,
            scroll: { verseAt: 'top' },

            keys: [null, null],

            audio: { open: false, file: null },
            history: [],
            historyIndex: 0,

            show: {
              headings: true,
              footnotes: true,
              crossrefs: true,
              dictlinks: true,
              versenums: true,
              strongs: true,
              morph: true,
              usernotes: true,
              hebcantillation: true,
              hebvowelpoints: true,
              redwords: true,
            },
            place: {} as any, // leave as {} to update at runtime

            showChooser: null as unknown as boolean, // leave as null to set at runtime
            tabs: [[], []], // leave tab-bank arrays empty to show all tabs in each bank.
            panels: ['', ''], // leave panels empty to show the first installed module
            ilModules: [null, null],
            mtModules: [null, null],

            isPinned: [false, false],
            noteBoxHeight: [-1, -1], // leave at -1 to update at runtime
            maximizeNoteBox: [false, false],
            tabcntl: true,
          },
          global: {
            locale: 'en',
          },
        },
      },
    },
  },
};

export default defaultSettings;
