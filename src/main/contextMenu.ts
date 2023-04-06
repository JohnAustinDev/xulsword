/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import contextMenuCreator from 'electron-context-menu';
import log from 'electron-log';
import i18n from 'i18next';
import { findBookmarkItem } from '../common';
import S from '../defaultPrefs';
import G from './mg';
import CommandsX from './components/commands';
import Viewport from './components/viewport';
import Data from './components/data';

import type { GAddCaller, ContextData, LocationVKType } from '../type';
import type { AboutWinState } from '../renderer/about/about';

// Require the calling window argument, since rg will not add it when
// Commands are called from the main process.
const Commands = CommandsX as GAddCaller['Commands'];

const defaultContextData: ContextData = { type: 'general' };

export type ContextMenuType = typeof contextMenu;

export default function contextMenu(
  window: BrowserWindow,
  dispose: (() => void)[]
): void {
  // Custom context-menu target data is written to Data to be read when
  // the menu is being built.
  const cm = () => {
    return (Data.read('contextData') || defaultContextData) as ContextData;
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
      showSelectAll: false,

      labels: {
        cut: i18n.t('menu.edit.cut'),
        // copy: i18n.t('menu.edit.copy'),
        paste: i18n.t('menu.edit.paste'),
        // selectAll: i18n.t('menu.edit.selectAll'),
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

      prepend: (actions, params) => {
        const d = cm();
        const generalMenu = [
          {
            label: `${i18n.t('Search')}: ${d.lemma}`,
            visible: Boolean(d.lemma),
            click: () => {
              if (d.search) Commands.search(d.search, window.id);
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.help.about'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.tab || d.context),
            click: () => {
              const mod = d.context || d.tab;
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
            },
          },
          {
            label: i18n.t('menu.options.font'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.context),
            click: () => {
              if (d.context) {
                Commands.openFontsColors(d.context, window.id);
              }
            },
          },
          {
            label: i18n.t('menu.context.close'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(
              (d.tab || d.context) && d.panelIndex !== undefined
            ),
            click: () => {
              const mod = d.tab || d.context;
              if (mod && d.panelIndex !== undefined)
                Viewport.setTabs(d.panelIndex, mod, 'hide');
            },
          },
        ];

        const Bookmarks = G.Prefs.getComplexValue(
          'rootfolder',
          'bookmarks'
        ) as typeof S.bookmarks.rootfolder;
        const { bookmark } = d;
        const bookmarkItem =
          (bookmark && findBookmarkItem(Bookmarks, bookmark)) || null;

        const bookmarkManagerMenu: Electron.MenuItemConstructorOptions[] = [
          {
            label: i18n.t('menu.open'),
            enabled:
              bookmarkItem?.type === 'bookmark' && !!bookmarkItem.location,
            click: () => {
              if (bookmarkItem?.type === 'bookmark' && bookmarkItem.location) {
                const { location, tabType } = bookmarkItem;
                if ('v11n' in location) {
                  location.isBible = tabType === 'Texts';
                  Commands.goToLocationVK(
                    location,
                    location,
                    undefined,
                    window.id
                  );
                } else {
                  Commands.goToLocationGB(location, undefined, window.id);
                }
              }
            },
          },
        ];
        if (d.type === 'bookmarkManager') return bookmarkManagerMenu;
        return generalMenu;
      },

      append: (actions, params) => {
        const d = cm();
        const generalMenu = [
          {
            label: i18n.t('Search'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.selection && d.context),
            click: () => {
              const { selection, context: module } = d;
              if (selection && module)
                Commands.search(
                  {
                    module,
                    searchtext: selection,
                    type: 'SearchExactText',
                  },
                  window.id
                );
            },
          },
          {
            label: i18n.t('menu.context.openSelectedRef'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.selectionParsedVK),
            click: () => {
              const loc = d.selectionParsedVK as LocationVKType;
              if (typeof loc === 'object') {
                Commands.goToLocationVK(loc, loc, undefined, window.id);
              }
            },
          },
          {
            label: i18n.t('menu.context.selectVerse'),
            visible: Object.keys(d).length > 0 && !d.isPinned,
            enabled: Boolean(d.location),
            click: () => {
              const { location: locationVK } = d;
              if (locationVK && typeof locationVK === 'object') {
                Commands.goToLocationVK(
                  locationVK,
                  locationVK,
                  undefined,
                  window.id
                );
              }
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.print'),
            visible: true,
            enabled: true,
            click: () => {
              Commands.print(undefined, window.id);
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.bookmark.add'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean((d.context && d.location) || d.locationGB),
            click: () => {
              const { context: module, location, locationGB } = d;
              if ((module && location) || locationGB) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.bookmark.add'),
                  {},
                  {
                    location: locationGB || location,
                    module: module || undefined,
                  },
                  window.id
                );
              }
            },
          },
          {
            label: i18n.t('menu.usernote.add'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean((d.context && d.location) || d.locationGB),
            click: () => {
              const { context: module, location, locationGB } = d;
              if ((module && location) || locationGB) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.usernote.add'),
                  {},
                  {
                    location: locationGB || location,
                    module: module || undefined,
                  },
                  window.id
                );
              }
            },
          },
          {
            label: i18n.t('menu.usernote.properties'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.bookmark),
            click: () => {
              if (d.bookmark) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.usernote.properties'),
                  { bookmark: d.bookmark, anyChildSelectable: true },
                  undefined,
                  window.id
                );
              }
            },
          },
          {
            label: i18n.t('menu.usernote.delete'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.bookmark),
            click: () => {
              if (d.bookmark) {
                Commands.deleteBookmarkItems([d.bookmark], window.id);
              }
            },
          },
        ];

        const xulsword = G.Prefs.getComplexValue(
          'xulsword'
        ) as typeof S.prefs.xulsword;
        const { location: xslocation, panels } = xulsword;
        const module =
          d.context ||
          panels.find((m) => m && m in G.Tab && G.Tab[m].isVerseKey) ||
          G.Tabs.find((t) => t.isVerseKey)?.module ||
          '';

        const bookmarkManagerMenu: Electron.MenuItemConstructorOptions[] = [
          {
            label: i18n.t('menu.print'),
            visible: true,
            enabled: Boolean(d.bookmark),
            click: () => {
              G.Prefs.setComplexValue(
                'bookmarkManager.printItems',
                d.bookmarks as typeof S.prefs.bookmarkManager.printItems
              );
              Commands.print(undefined, window.id)
                .then(() => {
                  G.Prefs.setComplexValue(
                    'bookmarkManager.printItems',
                    null as typeof S.prefs.bookmarkManager.printItems
                  );
                  return true;
                })
                .catch((er) => log.error(er));
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.edit.cut'),
            enabled:
              Boolean(d.bookmarks) &&
              !d.bookmarks?.includes(S.bookmarks.rootfolder.id),
            click: () => {
              if (d.bookmarks) {
                G.Prefs.setComplexValue('bookmarkManager.cut', d.bookmarks);
                G.Prefs.setComplexValue('bookmarkManager.copy', null);
              }
            },
          },
          {
            label: i18n.t('menu.edit.copy'),
            enabled:
              Boolean(d.bookmarks) &&
              !d.bookmarks?.includes(S.bookmarks.rootfolder.id),
            click: () => {
              if (d.bookmarks) {
                G.Prefs.setComplexValue('bookmarkManager.copy', d.bookmarks);
                G.Prefs.setComplexValue('bookmarkManager.cut', null);
              }
            },
          },
          {
            label: i18n.t('menu.edit.paste'),
            enabled: Boolean(
              G.Prefs.getComplexValue('bookmarkManager.cut') ||
                G.Prefs.getComplexValue('bookmarkManager.copy')
            ),
            click: () => {
              const cut = G.Prefs.getComplexValue(
                'bookmarkManager.cut'
              ) as typeof S.prefs.bookmarkManager.cut;
              const copy = G.Prefs.getComplexValue(
                'bookmarkManager.copy'
              ) as typeof S.prefs.bookmarkManager.copy;
              G.Prefs.setComplexValue('bookmarkManager.cut', null);
              G.Prefs.setComplexValue('bookmarkManager.copy', null);
              if (d.bookmark) {
                G.Commands.pasteBookmarkItems(cut, copy, d.bookmark);
              }
            },
          },
          {
            label: i18n.t('menu.edit.undo'),
            enabled: G.canUndo(),
            click: () => {
              G.Commands.undo();
            },
          },
          {
            label: i18n.t('menu.edit.redo'),
            enabled: G.canRedo(),
            click: () => {
              G.Commands.redo();
            },
          },
          {
            label: i18n.t('menu.edit.delete'),
            visible: Object.keys(d).length > 0,
            enabled:
              Boolean(d.bookmark) &&
              !d.bookmarks?.includes(S.bookmarks.rootfolder.id),
            click: () => {
              if (d.bookmark) {
                Commands.deleteBookmarkItems([d.bookmark], window.id);
              }
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.bookmark.add'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.bookmark),
            click: () => {
              if (d.bookmark) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.bookmark.add'),
                  { treeSelection: d.bookmark, anyChildSelectable: true },
                  { location: xslocation, module },
                  window.id
                );
              }
            },
          },
          {
            label: i18n.t('menu.folder.add'),
            enabled: Boolean(d.bookmark),
            click: () => {
              if (d.bookmark) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.folder.add'),
                  { treeSelection: d.bookmark, anyChildSelectable: false },
                  {
                    location: null,
                  },
                  window.id
                );
              }
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.edit.properties'),
            visible: Object.keys(d).length > 0,
            enabled:
              Boolean(d.bookmark) &&
              !d.bookmarks?.includes(S.bookmarks.rootfolder.id),
            click: () => {
              if (d.bookmark) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.edit.properties'),
                  { bookmark: d.bookmark, anyChildSelectable: true },
                  undefined,
                  window.id
                );
              }
            },
          },
        ];

        if (d.type === 'bookmarkManager') return bookmarkManagerMenu;
        return generalMenu;
      },
    })
  );

  // This context-menu handler must come last after contextMenuCreator, to
  // delete target data after it has been used to build the context menu.
  window.webContents.on('context-menu', () => {
    Data.readAndDelete('contextData');
  });
}
