/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { paperSizes } from './renderer/libxul/printSettings';
import type { SelectVKMType } from './renderer/libxul/vkselect';
import type { StyleType } from './renderer/style';
import type { TablePropColumn, TinitialRowSort } from './renderer/libxul/table';
import type {
  AudioPrefType,
  BookmarkFolderType,
  HistoryVKType,
  LocationVKType,
  PlaceType,
  Repository,
  RowSelection,
  ScrollType,
  ShowType,
  WindowPrefsType,
} from './type';

// The S object's properties are pref stores whose values are default PrefObjects.
// S PrefObject types determine the expected type throughout xulsword. After they
// are referenced, these default PrefObjects will be overridden in Prefs by
// current user values and stored there. A pref store is not required to be
// included in S. But if it is, defaults for all of its PrefObjects must be
// included. Otherwise, S store PrefObjects which aren't will be deleted from
// Prefs during write to the store. This provides an easy way to clean up outdated
// PrefObjects after a program update. If a store is not included in S, default
// values for its PrefObjects should appear in assets/default/preferences/<store>.json
// or exceptions will be thrown if those PrefObjects aren't accessed by
// Prefs.getPrefOrCreate.
//
// Usage NOTE: PrefObjects are cloned before writing and after reading.
//
// PrefValues that are stored in S can also be kept in sync with corresponding
// state keys of React components (optionally both directions) using the following
// functions:
//
// getStatePref() - Read state pref keys from Prefs. Run in component constructor
//                - to load initial state from Prefs.
//
// setStatePref() - Run in componentDidUpdate() to push state changes to
//                  Prefs, thereby making state persistent.
//
// registerUpdateStateFromPref() - Run in componentDidMount() to register
//                  a listener for state Pref changes that will push
//                  those changes into component state.
//
// TODO: Write an installer script to delete arbitrary PrefValues during an update.
const S = {
  fonts: {
    fonts: {} as {
      [i: string]: { fontFamily: string; path: string };
    },
  },
  style: {
    style: {
      locale: {},
      module: {},
    } as StyleType,
  },
  windows: {
    OpenOnStartup: {} as WindowPrefsType,
    OpenWindows: {} as WindowPrefsType,
    PersistForType: {} as WindowPrefsType,
  },
  bookmarks: {
    rootfolder: {
      type: 'folder',
      id: 'bmroot',
      label: 'i18n:rootBookmark.label',
      labelLocale: '',
      note: '',
      noteLocale: '',
      creationDate: new Date().valueOf(),
      hasCaret: true,
      childNodes: [],
    } as BookmarkFolderType,
  },
  prefs: {
    global: {
      WindowsDidClose: true as boolean,
      Contributors: [
        'Special Thanks To:',
        'Troy Griffitts and the SWORD Project',
        '',
        'Developers:',
        'John Austin',
        'David Booth',
        '',
        'Contributors:',
        'Abram Victorovich',
        'Allen Peleton',
        'David Haslam',
        'Wolfgang Stradner',
        'Tom Roth',
      ],
      crashReporterURL: '' as string,
      InternetPermission: false as boolean,
      fontSize: 2 as number,
      locale: '' as string,
      popup: {
        selection: {
          hebrewDef: '',
          greekDef: '',
          greekParse: '',
        } as {
          [k in 'hebrewDef' | 'greekDef' | 'greekParse' | string]: string;
        },
      },
    },

    xulsword: {
      location: null as LocationVKType | null,
      selection: null as LocationVKType | null,
      scroll: null as ScrollType,

      keys: [] as (string | null)[],

      audio: { open: false, file: null } as AudioPrefType,
      history: [] as HistoryVKType[],
      historyIndex: 0 as number,

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
      } as ShowType,
      place: {
        footnotes: 'notebox',
        crossrefs: 'notebox',
        usernotes: 'popup',
      } as PlaceType,

      showChooser: true as boolean,
      tabs: [] as (string[] | null)[],
      panels: ['', '', null] as (string | null)[],
      ilModules: [] as (string | null)[],
      mtModules: [] as (string | null)[],

      isPinned: [false] as boolean[],
      noteBoxHeight: [200] as number[],
      maximizeNoteBox: [false] as boolean[],
    },

    moduleManager: {
      suggested: null as { [fallbackLang: string]: string[] } | null,
      repositories: {
        xulsword: [],
        custom: [],
        disabled: null,
      } as {
        xulsword: Repository[];
        custom: Repository[];
        disabled: string[] | null;
      },
      language: {
        open: true as boolean,
        selection: [] as string[],
        width: 150 as number,
        rowSort: {
          propColumnIndex: 0,
          direction: 'ascending',
        } as TinitialRowSort,
        columns: [
          {
            datacolumn: 0,
            heading: '',
            width: 150,
            hideable: false,
            sortable: false,
            visible: true,
          },
        ] as TablePropColumn[],
      },
      module: {
        selection: [] as RowSelection,
        rowSort: {
          propColumnIndex: 0,
          direction: 'ascending',
        } as TinitialRowSort,
        columns: [
          {
            datacolumn: 0,
            heading: 'i18n:Type.label',
            width: 127,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 1,
            heading: 'i18n:Description.label',
            width: 190,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 2,
            heading: 'i18n:Name.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 3,
            heading: 'i18n:Repository.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 4,
            heading: 'i18n:Version.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 5,
            heading: 'i18n:Language.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 6,
            heading: 'i18n:Size.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 7,
            heading: 'i18n:Features.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 8,
            heading: 'i18n:Verse System.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 9,
            heading: 'i18n:Scope.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 10,
            heading: 'i18n:Copyright.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 11,
            heading: 'i18n:Distribution License.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 12,
            heading: 'i18n:Source Type.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 13,
            heading: 'icon:folder-shared',
            width: 88,
            hideable: false,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 14,
            heading: 'icon:cloud-download',
            width: 103,
            hideable: false,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 15,
            heading: 'icon:delete',
            width: 80,
            hideable: false,
            sortable: false,
            visible: false,
          },
        ] as TablePropColumn[],
      },
      repository: {
        open: true as boolean,
        selection: [] as RowSelection,
        height: 200 as number,
        rowSort: {
          propColumnIndex: 2,
          direction: 'ascending',
        } as TinitialRowSort,
        columns: [
          {
            datacolumn: 0,
            heading: '',
            width: 124,
            hideable: false,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 1,
            heading: '',
            width: 145,
            hideable: false,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 2,
            heading: '',
            width: 343,
            hideable: false,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 3,
            heading: 'icon:folder-open',
            width: 67,
            hideable: false,
            sortable: true,
            visible: true,
          },
        ] as TablePropColumn[],
      },
    },

    removeModule: {
      repositories: null,
      language: {
        open: false as boolean,
        selection: [] as string[],
        rowSort: {
          propColumnIndex: 0,
          direction: 'ascending',
        } as TinitialRowSort,
        width: 150 as number,
        columns: [
          {
            datacolumn: 0,
            heading: '',
            width: 150,
            hideable: false,
            sortable: false,
            visible: true,
          },
        ] as TablePropColumn[],
      },
      module: {
        selection: [] as RowSelection,
        rowSort: {
          propColumnIndex: 0,
          direction: 'ascending',
        } as TinitialRowSort,
        columns: [
          {
            datacolumn: 0,
            heading: 'i18n:Type.label',
            width: 150,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 1,
            heading: 'i18n:Description.label',
            width: 225,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 2,
            heading: 'i18n:Name.label',
            width: 71,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 3,
            heading: 'i18n:Repository.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 4,
            heading: 'i18n:Version.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 5,
            heading: 'i18n:Language.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 6,
            heading: 'i18n:Size.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 7,
            heading: 'i18n:Features.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 8,
            heading: 'i18n:Verse System.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 9,
            heading: 'i18n:Scope.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 10,
            heading: 'i18n:Copyright.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 11,
            heading: 'i18n:Distribution License.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 12,
            heading: 'i18n:Source Type.label',
            width: 80,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 13,
            heading: 'icon:folder-shared',
            width: 105,
            hideable: false,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 14,
            heading: 'icon:cloud-download',
            width: 103,
            hideable: false,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 15,
            heading: 'icon:delete',
            width: 95,
            hideable: false,
            sortable: false,
            visible: true,
          },
        ] as TablePropColumn[],
      },
      repository: null,
    },

    printPassage: {
      checkbox: {
        introduction: true,
        headings: true,
        versenums: true,
        redwords: true,
        dictlinks: true,
        footnotes: true,
        usernotes: true,
        crossrefs: true,
        crossrefsText: true,
        hebvowelpoints: true,
        hebcantillation: true,
      } as {
        [k in keyof Omit<ShowType, 'morph' | 'strongs'>]: boolean;
      } & {
        introduction: boolean;
        crossrefsText: boolean;
      },
      chapters: null as SelectVKMType | null,
    },

    print: {
      landscape: false as boolean,
      pageSize: 'Letter' as typeof paperSizes[number]['type'],
      twoColumns: false as boolean,
      scale: 100 as number,
      margins: {
        top: 30 as number,
        right: 20 as number,
        bottom: 30 as number,
        left: 20 as number,
      },
    },

    copyPassage: {
      checkboxes: {
        headings: true,
        versenums: true,
        redwords: true,
      } as {
        [k in keyof ShowType]?: boolean;
      },
    },

    bookmarkManager: {
      treeWidth: 210 as number,
      selectedFolder: 'bmroot' as string,
      cut: null as string[] | null,
      copy: null as string[] | null,
      printItems: null as string[] | null,
      columns: [
        {
          datacolumn: 0,
          heading: '',
          width: 237,
          hideable: false,
          sortable: false,
          visible: true,
        },
        {
          datacolumn: 1,
          heading: 'icon:annotation',
          width: 80,
          hideable: true,
          sortable: false,
          visible: true,
        },
        {
          datacolumn: 2,
          heading: 'icon:manual',
          width: 80,
          hideable: true,
          sortable: false,
          visible: true,
        },
        {
          datacolumn: 3,
          heading: 'icon:calendar',
          width: 80,
          hideable: true,
          sortable: false,
          visible: true,
        },
      ] as TablePropColumn[],
    },
  },
};

// Fill out these variable length default arrays
(['isPinned', 'noteBoxHeight', 'maximizeNoteBox'] as const).forEach((p) => {
  const v = S.prefs.xulsword[p][0];
  (S.prefs.xulsword as any)[p] = S.prefs.xulsword.panels.map(() => v as any);
});

export default S;
