/* eslint-disable @typescript-eslint/naming-convention */
import { G } from '../../G.ts';

import type C from '../../../constant.ts';
import type S from '../../../defaultPrefs.ts';
import type { AllComponentsSettings } from '../common.ts';

// Note: langcode won't set the user interface language of the Bible browser
// widget; settings.prefs.global.locale will set it.
export type BibleBrowserSettings = {
  component: 'bibleBrowser';
  langcode?: string; // currently unused by this widget.
  settings: {
    frame: string;
    prefs: {
      xulsword: Partial<(typeof S)['prefs']['xulsword']>;
      global: {
        locale: (typeof C.Locales)[number][0];
      };
    };
  };
};

// The 'tabs' and 'panels' default settings may be left empty, to be filled with
// available modules at run-time.
export function setEmptySettings(settings: BibleBrowserSettings['settings']) {
  const { tabs, panels } = settings.prefs.xulsword;
  if (G.Tabs.length && (!tabs || tabs.every((t) => !t || !t.length))) {
    const ntabs = tabs ?? [[], []];
    ntabs.forEach((tabBank) => {
      if (Array.isArray(tabBank)) tabBank.push(...G.Tabs.map((t) => t.module));
    });
    settings.prefs.xulsword.tabs = ntabs;
  }
  if (G.Tabs.length && (!panels || panels.every((p) => !p))) {
    const npanels = (panels ?? ['', '']).map((p) => p || G.Tabs[0].module);
    settings.prefs.xulsword.panels = npanels;
  }
}

const defaultSettings: AllComponentsSettings = {
  react: {
    bibleBrowser_1: {
      component: 'bibleBrowser',
      langcode: 'en',
      settings: {
        frame: '0',
        prefs: {
          xulsword: {
            location: {
              book: 'Matt',
              chapter: 1,
              v11n: 'KJV',
            },
            selection: null,
            scroll: null,

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
            place: {
              footnotes: 'notebox',
              crossrefs: 'notebox',
              usernotes: 'popup',
            },

            showChooser: true,
            tabs: [[], []], // leave tab-bank arrays empty to show all tabs in each bank.
            panels: ['', ''], // leave panels empty to show the first installed module
            ilModules: [null, null],
            mtModules: [null, null],

            isPinned: [false, false],
            noteBoxHeight: [200, 200],
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
