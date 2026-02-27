import C from './constant.ts';

import type { paperSizes } from './clients/components/print/printSettings.tsx';
import type { SelectVKType } from './clients/components/libxul/selectVK.tsx';
import type { StyleType } from './clients/style.ts';
import type {
  TableColumnInfo,
  TableRowSortState,
} from './clients/components/libxul/table.tsx';
import type {
  AudioPrefType,
  BookmarkFolderType,
  FeatureMods,
  HistoryVKType,
  LocationVKType,
  PlaceType,
  RepoDisabled,
  Repository,
  ScrollType,
  ShowType,
  WindowPrefsType,
} from './type.ts';

// This S object's properties define user preference stores whose values are
// default PrefObject values. These S PrefObject types determine the expected
// TypeScript types throughout xulsword source code. These default PrefObject
// values will be overridden in Prefs by default pref files (Electron only) and
// by user or build selected values, and then stored by Prefs. A Prefs store is
// not required to be included in S. But if it is, defaults for all of its
// PrefObjects must be included in S. Otherwise, those without defaults will be
// deleted from Prefs during write to the store. This provides an easy way to
// clean up outdated PrefObjects after a program update. If a store is not
// included in S, then default values for its PrefObjects must appear in
// assets/default/preferences/<store>.json or an exception will be thrown.
//
// Usage NOTE: PrefObjects are already cloned before writing and after reading.
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
      fontSize: 2 as 0 | 1 | 2 | 3 | 4,
      locale: '' as (typeof C.Locales)[number][0],
      fallbackLocale: 'en',
      popup: {
        vklookup: {} as { [anyTypeModule: string]: string },
        feature: {} as {
          [feature in keyof FeatureMods]?: string;
        },
      },
      noAutoSearchIndex: [] as string[],
      skin: '' as '' | 'arabesque' | 'dark',
    },

    xulsword: {
      location: null as LocationVKType | null,
      selection: null as LocationVKType | null,
      scroll: null as ScrollType,

      keys: [null] as Array<string | null>,

      audio: { open: false, file: null, defaults: {} } as AudioPrefType,
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
      focusPanel: -1 as number | undefined,
      tabs: [[]] as Array<string[] | null>,
      panels: [''] as Array<string | null>,
      ilModules: [null] as Array<string | null>,
      mtModules: [null] as Array<string | null>,

      isPinned: [false] as boolean[],
      noteBoxHeight: [200] as number[],
      maximizeNoteBox: [false] as boolean[],
      tabcntl: true as boolean,
    },

    moduleManager: {
      suggested: null as Record<string, string[]> | null,
      repositories: {
        xulsword: [
          {
            name: 'i18n:IBT_XSM',
            domain: 'ftp.ibt.org.ru',
            path: '/pub/modxsm',
          },
          {
            name: 'i18n:IBT_Audio',
            domain: 'ftp.ibt.org.ru',
            path: '/pub/modaudio',
          },
        ],
        custom: [],
        disabled: null,
      } as {
        xulsword: Repository[];
        custom: Repository[];
        disabled: RepoDisabled;
      },
      language: {
        open: true as boolean,
        selection: [] as string[],
        width: 150 as number,
        rowSort: {
          propColumnIndex: 0,
          direction: 'ascending',
        } as TableRowSortState,
        columns: [
          {
            datacolumn: 0,
            heading: '',
            width: 150,
            hideable: false,
            sortable: false,
            visible: true,
          },
        ] as TableColumnInfo[],
      },
      repository: {
        open: true as boolean,
        selection: [] as string[],
        height: 392 as number,
        rowSort: {
          propColumnIndex: 2,
          direction: 'ascending',
        } as TableRowSortState,
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
        ] as TableColumnInfo[],
      },
      module: {
        selection: [] as string[],
        rowSort: {
          propColumnIndex: 0,
          direction: 'ascending',
        } as TableRowSortState,
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
            heading: 'i18n:shared.label',
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
        ] as TableColumnInfo[],
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
        } as TableRowSortState,
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
        ] as TableColumnInfo[],
      },
      module: {
        selection: [] as string[],
        rowSort: {
          propColumnIndex: 0,
          direction: 'ascending',
        } as TableRowSortState,
        columns: [
          {
            datacolumn: 0,
            heading: 'i18n:Type.label',
            width: 143,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 1,
            heading: 'i18n:Description.label',
            width: 179,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 2,
            heading: 'i18n:Name.label',
            width: 102,
            hideable: true,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 3,
            heading: 'i18n:Repository.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 4,
            heading: 'i18n:Version.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 5,
            heading: 'i18n:Language.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 6,
            heading: 'i18n:Size.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 7,
            heading: 'i18n:Features.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 8,
            heading: 'i18n:Verse System.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 9,
            heading: 'i18n:Scope.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 10,
            heading: 'i18n:Copyright.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 11,
            heading: 'i18n:Distribution License.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 12,
            heading: 'i18n:Source Type.label',
            width: 76,
            hideable: true,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 13,
            heading: 'icon:folder-shared',
            width: 100,
            hideable: false,
            sortable: true,
            visible: true,
          },
          {
            datacolumn: 14,
            heading: 'icon:cloud-download',
            width: 98,
            hideable: false,
            sortable: true,
            visible: false,
          },
          {
            datacolumn: 15,
            heading: 'icon:delete',
            width: 90,
            hideable: false,
            sortable: true,
            visible: true,
          },
        ] as TableColumnInfo[],
      },
      repository: {
        open: false as boolean,
        selection: [] as string[],
        height: 160 as number,
        rowSort: {
          propColumnIndex: 2,
          direction: 'ascending',
        } as TableRowSortState,
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
        ] as TableColumnInfo[],
      },
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
      chapters: null as SelectVKType | null,
    },

    print: {
      landscape: false as boolean,
      pageSize: 'A4' as (typeof paperSizes)[number]['type'],
      twoColumns: false as boolean,
      scale: 100 as number,
      margins: {
        top: 20 as number,
        right: 20 as number,
        bottom: 20 as number,
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
      ] as TableColumnInfo[],
    },

    search: {
      moreLess: true as boolean,
    },
  },
};

export function completePanelPrefDefaultArrays(numPanels: number) {
  // Complete these variable length default arrays.
  C.PanelPrefArrays.forEach((p) => {
    const vf = [];
    for (let i = 0; i < numPanels; i++) {
      let [v] = S.prefs.xulsword[p];
      if (p === 'panels' && i > 1) v = null;
      vf.push(v);
    }
    (S.prefs.xulsword as any)[p] = vf;
  });
}

export default S;
