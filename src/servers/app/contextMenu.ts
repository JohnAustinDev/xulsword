import contextMenuCreator from 'electron-context-menu';
import log from 'electron-log';
import i18n from 'i18next';
import { findBookmarkItem, xulswordLocation } from '../../common.ts';
import S from '../../defaultPrefs.ts';
import { G } from './G.ts';
import ComCommands from './commands.ts';
import CommandsX from './components/commands.ts';
import Data from '../components/data.ts';

import type { BrowserWindow } from 'electron';
import type {
  GAddWindowId,
  ContextDataType,
  SwordConfType,
} from '../../type.ts';
import type { AboutWinState } from '../../clients/app/aboutWin/aboutWin.tsx';

// Require the calling window argument, since G will not add it when
// Commands are called from the main process.
const Commands = CommandsX as GAddWindowId['Commands'];

const defaultContextData: ContextDataType = { type: 'general' };

export type ContextMenuType = typeof contextMenu;

export default function contextMenu(
  window: BrowserWindow,
  dispose: Array<() => void>,
): void {
  // Custom context-menu target data is written to Data to be read when
  // the menu is being built.
  const cm = () => {
    return (Data.read('contextData') || defaultContextData) as ContextDataType;
  };

  dispose.push(
    contextMenuCreator({
      window,

      showInspectElement: Build.isDevelopment,

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

      prepend: (actions) => {
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
                  configs: modules
                    .map((m) => G.getModuleConf(m))
                    .filter(Boolean) as SwordConfType[],
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
              (d.tab || d.context) && d.panelIndex !== undefined,
            ),
            click: () => {
              const mod = d.tab || d.context;
              if (mod && d.panelIndex !== undefined)
                G.Viewport.setXulswordTabs({
                  panelIndex: d.panelIndex,
                  whichTab: mod,
                  doWhat: 'hide',
                });
            },
          },
        ];

        const Bookmarks = G.Prefs.getComplexValue(
          'rootfolder',
          'bookmarks',
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
              if (bookmarkItem?.type === 'bookmark') {
                const { location } = bookmarkItem;
                if ('v11n' in location) {
                  void ComCommands.goToLocationVK(location, location);
                } else {
                  void ComCommands.goToLocationGB(location);
                }
              }
            },
          },
        ];
        if (d.type === 'bookmarkManager') return bookmarkManagerMenu;
        return generalMenu;
      },

      append: (actions) => {
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
                  window.id,
                );
            },
          },
          {
            label: i18n.t('menu.context.openSelectedRef'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean(d.selectionParsedVK),
            click: () => {
              const loc = d.selectionParsedVK;
              if (typeof loc === 'object') {
                void ComCommands.goToLocationVK(loc, loc);
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
                void ComCommands.goToLocationVK(locationVK, locationVK);
              }
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.print'),
            visible: true,
            enabled: d.windowDescriptor && !d.windowDescriptor.notResizable,
            click: () => {
              Commands.print(
                { pageable: false, dialogEnd: 'cancel' },
                window.id,
              ).catch((er) => {
                log.error(er);
              });
            },
          },
          actions.separator(),
          {
            label: i18n.t('menu.bookmark.add'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean((d.context && d.location) || d.locationGB),
            click: () => {
              const { location, locationGB, locationCOMM } = d;
              if (location || locationGB || locationCOMM) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.bookmark.add'),
                  {},
                  {
                    location: locationCOMM || locationGB || location,
                  },
                  window.id,
                );
              }
            },
          },
          {
            label: i18n.t('menu.usernote.add'),
            visible: Object.keys(d).length > 0,
            enabled: Boolean((d.context && d.location) || d.locationGB),
            click: () => {
              const { location, locationGB, locationCOMM } = d;
              if (location || locationGB || locationCOMM) {
                Commands.openBookmarkProperties(
                  i18n.t('menu.usernote.add'),
                  {},
                  {
                    location: locationCOMM || locationGB || location,
                  },
                  window.id,
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
                  window.id,
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

        const bookmarkManagerMenu: Electron.MenuItemConstructorOptions[] = [
          {
            label: i18n.t('menu.print'),
            visible: true,
            enabled: Boolean(d.bookmark),
            click: () => {
              G.Prefs.setComplexValue(
                'bookmarkManager.printItems',
                d.bookmarks as typeof S.prefs.bookmarkManager.printItems,
              );
              Commands.print({ pageable: true, dialogEnd: 'cancel' }, window.id)
                .then(() => {
                  G.Prefs.setComplexValue(
                    'bookmarkManager.printItems',
                    null as typeof S.prefs.bookmarkManager.printItems,
                  );
                  return true;
                })
                .catch((er) => {
                  log.error(er);
                });
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
                G.Prefs.getComplexValue('bookmarkManager.copy'),
            ),
            click: () => {
              const cut = G.Prefs.getComplexValue(
                'bookmarkManager.cut',
              ) as typeof S.prefs.bookmarkManager.cut;
              const copy = G.Prefs.getComplexValue(
                'bookmarkManager.copy',
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
                  { location: xulswordLocation(G.Tab, G.Prefs) },
                  window.id,
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
                    location: undefined,
                  },
                  window.id,
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
                  window.id,
                );
              }
            },
          },
        ];

        if (d.type === 'bookmarkManager') return bookmarkManagerMenu;
        return generalMenu;
      },
    }),
  );

  // This context-menu handler must come last after contextMenuCreator, to
  // delete target data after it has been used to build the context menu.
  window.webContents.on('context-menu', () => {
    Data.readAndDelete('contextData');
  });
}
