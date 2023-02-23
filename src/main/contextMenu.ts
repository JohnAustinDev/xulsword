/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import contextMenuCreator from 'electron-context-menu';
import i18n from 'i18next';
import { findBookmarkItem } from '../common';
import { SPBM } from '../constant';
import G from './mg';
import CommandsX from './components/commands';
import setViewportTabs from './tabs';
import Data from './components/data';

import type { AddCaller, ContextData, LocationVKType } from '../type';
import type { AboutWinState } from '../renderer/about/about';

// Requires the calling window, since rg will not be adding it.
const Commands = CommandsX as AddCaller['Commands'];

const noContextData: ContextData = {
  search: null,
  locationVK: null,
  module: null,
  tab: null,
  lemma: null,
  panelIndex: null,
  bookmark: null,
  isPinned: false,
  selection: null,
  selectionParsedVK: null,
};

export type ContextMenuType = typeof contextMenu;

export default function contextMenu(
  window: BrowserWindow,
  dispose: (() => void)[]
): void {
  // Custom context-menu target data is written to Data to be read when
  // the menu is built.
  const cm = () => {
    return (Data.read('contextData') || noContextData) as ContextData;
  };

  dispose.push(
    contextMenuCreator({
      window,

      showInspectElement: Boolean(
        process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
      ),

      showSearchWithGoogle: false,
      showCopyImage: false,
      showSaveImageAs: true,

      labels: {
        cut: i18n.t('menu.edit.cut'),
        copy: i18n.t('menu.edit.copy'),
        paste: i18n.t('menu.edit.paste'),
        selectAll: i18n.t('menu.edit.selectAll'),
        learnSpelling: 'learnSpelling',
        // lookUpSelection: 'lookUpSelection',
        searchWithGoogle: 'searchWithGoogle',
        saveImage: 'saveImage',
        // saveImageAs: 'saveImageAs',
        copyLink: 'copyLink',
        saveLinkAs: 'saveLinkAs',
        copyImage: 'copyImage',
        copyImageAddress: 'copyImageAddress',
        inspect: 'inspect',
        services: 'Services',
      },

      prepend: (actions, params) => [
        {
          label: `${i18n.t('Search')}: ${cm().lemma}`,
          visible: Boolean(cm().lemma),
          click: ((data) => {
            return () => {
              if (data.search) Commands.search(data.search, window.id);
            };
          })(cm()),
        },
        actions.separator(),
        {
          label: i18n.t('menu.help.about'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().tab || cm().module),
          click: ((data) => {
            return () => {
              const mod = data.module || data.tab;
              if (mod) {
                const modules = [mod];
                if (mod && mod in G.Tab) {
                  G.LibSword.getModuleInformation(mod, 'Companion')
                    .split(/\s*,\s*/)
                    .forEach((c) => {
                      if (c && c in G.Tab) modules.push(c);
                    });
                }
                const s: Partial<AboutWinState> = {
                  showModules: true,
                  configs: modules.map((m) => G.Tab[m].conf),
                  showConf: '',
                  editConf: false,
                };
                Commands.openAbout(s, window.id);
              }
            };
          })(cm()),
        },
        {
          label: i18n.t('menu.options.font'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().module),
          click: ((data) => {
            return () => {
              if (data.module) Commands.openFontsColors(data.module, window.id);
            };
          })(cm()),
        },
        {
          label: i18n.t('menu.context.close'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(
            (cm().tab || cm().module) && cm().panelIndex !== null
          ),
          click: ((data) => {
            return () => {
              const mod = data.tab || data.module;
              if (mod && data.panelIndex !== null)
                setViewportTabs(data.panelIndex, mod, 'hide');
            };
          })(cm()),
        },
      ],

      append: (actions, params) => [
        {
          label: i18n.t('Search'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().selection && cm().module),
          click: ((data) => {
            return () => {
              const { selection, module } = data;
              if (selection && module)
                Commands.search(
                  {
                    module,
                    searchtext: selection,
                    type: 'SearchExactText',
                  },
                  window.id
                );
            };
          })(cm()),
        },
        {
          label: i18n.t('menu.context.openSelectedRef'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().selectionParsedVK),
          click: ((data) => {
            return () => {
              const loc = data.selectionParsedVK as LocationVKType;
              if (typeof loc === 'object') {
                Commands.goToLocationVK(
                  loc,
                  loc,
                  undefined,
                  undefined,
                  window.id
                );
              }
            };
          })(cm()),
        },
        {
          label: i18n.t('menu.context.selectVerse'),
          visible: Object.keys(cm()).length > 0 && !cm().isPinned,
          enabled: Boolean(cm().locationVK),
          click: ((data) => {
            return () => {
              const { locationVK } = data;
              if (locationVK && typeof locationVK === 'object') {
                Commands.goToLocationVK(
                  locationVK,
                  locationVK,
                  undefined,
                  undefined,
                  window.id
                );
              }
            };
          })(cm()),
        },
        {
          label: i18n.t('menu.print'),
          visible: true,
          enabled: true,
          click: () => {
            Commands.print(window.id);
          },
        },
        actions.separator(),
        {
          label: i18n.t('menu.bookmark.add'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().module && cm().locationVK),
          click: ((data) => {
            return () => {
              const { module, locationVK: location } = data;
              if (module && location) {
                CommandsX.openBookmarkProperties(undefined, {
                  location,
                  module,
                  usernote: false,
                });
              }
            };
          })(cm()),
        },
        {
          label: i18n.t('menu.usernote.add'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().module && cm().locationVK),
          click: ((data) => {
            return () => {
              const { module, locationVK: location } = data;
              if (module && location) {
                CommandsX.openBookmarkProperties(undefined, {
                  location,
                  module,
                  usernote: true,
                });
              }
            };
          })(cm()),
        },

        {
          label: i18n.t('menu.bookmark.properties'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().bookmark),
          click: ((data) => {
            return () => {
              if (data.bookmark) {
                const bookmarks = G.Prefs.getComplexValue(
                  'manager.bookmarks',
                  'bookmarks'
                ) as typeof SPBM.manager.bookmarks;
                const bookmark = findBookmarkItem(bookmarks, data.bookmark);
                if (bookmark) {
                  CommandsX.openBookmarkProperties({ bookmark });
                }
              }
            };
          })(cm()),
        },
        {
          label: i18n.t('menu.bookmark.delete'),
          visible: Object.keys(cm()).length > 0,
          enabled: Boolean(cm().bookmark),
          click: ((data) => {
            return () => {
              if (data.bookmark) CommandsX.deleteBookmarkItem(data.bookmark);
            };
          })(cm()),
        },
      ],
    })
  );

  // This context-menu handler must come last after contextMenuCreator, to
  // delete target data after it has been used to build the context menu.
  window.webContents.on('context-menu', () => {
    Data.readAndDelete('contextData');
  });
}
