/* eslint-disable @typescript-eslint/naming-convention */
import type C from '../../../constant.ts';
import type S from '../../../defaultPrefs.ts';
import type { AllComponentsSettings } from '../common.ts';

// Note: langcode won't set the user interface language of the Bible browser
// widget; settings.prefs.global.locale sets it.
export type BibleBrowserSettings = {
  component: 'bibleBrowser';
  langcode?: string;
  settings: {
    prefs: {
      xulsword: Partial<(typeof S)['prefs']['xulsword']>;
      global: {
        locale: (typeof C.Locales)[number][0];
      };
    };
  };
};

const defaultSettings: AllComponentsSettings = {
  react: {
    bibleBrowser_1: {
      component: 'bibleBrowser',
      langcode: 'en',
      settings: {
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
            tabs: [['KJV'], ['KJV']],
            panels: ['KJV', 'KJV'],
            ilModules: [null, null],
            mtModules: [null, null],

            isPinned: [false, false],
            noteBoxHeight: [200, 200],
            maximizeNoteBox: [false, false],
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
