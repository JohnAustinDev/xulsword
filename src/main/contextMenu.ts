/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import contextMenuCreator from 'electron-context-menu';
import i18next from 'i18next';
import Commands, { newDbItemWithDefaults } from './commands';
import { getTab } from './minit';
import setViewportTabs from './tabs';
import Data from './modules/data';
import Prefs from './modules/prefs';

import type { ContextData, LocationVKType } from '../type';

export default function contextMenu(window: BrowserWindow): () => void {
  const cm = Data as { data: ContextData };

  const options: contextMenuCreator.Options = {
    window,

    showSearchWithGoogle: false,
    showCopyImage: false,
    showSaveImageAs: true,

    labels: {
      cut: i18next.t('menu.edit.cut'),
      copy: i18next.t('menu.edit.copy'),
      paste: i18next.t('menu.edit.paste'),
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
        label: `${i18next.t('Search')}: ${cm.data.lemma}`,
        visible: Boolean(cm.data.lemma),
        click: ((data) => {
          return () => {
            if (data.search) Commands.search(data.search);
          };
        })(cm.data),
      },
      actions.separator(),
      {
        label: i18next.t('menu.help.about'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.tab || cm.data.module),
        click: ((data) => {
          return () => {
            const mod = data.module || data.tab;
            if (mod) Commands.openHelp(mod);
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.options.font'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.module),
        click: ((data) => {
          return () => {
            if (data.module) Commands.openFontsColors(data.module);
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.context.close'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(
          (cm.data.tab || cm.data.module) && cm.data.panelIndex !== null
        ),
        click: ((data) => {
          return () => {
            const mod = data.tab || data.module;
            if (mod && data.panelIndex !== null)
              setViewportTabs(data.panelIndex, mod, 'hide');
          };
        })(cm.data),
      },
    ],

    append: (actions, params) => [
      {
        label: i18next.t('Search'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.selection && cm.data.module),
        click: ((data) => {
          return () => {
            const { selection, module } = data;
            if (selection && module)
              Commands.search({
                module,
                searchtext: selection,
                type: 'SearchExactText',
              });
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.context.openSelectedRef'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.selectedLocationVK),
        click: ((data) => {
          return () => {
            const loc = data.selectedLocationVK as LocationVKType;
            if (typeof loc === 'object') {
              const tab = getTab();
              const modv11n =
                loc.version && loc.version in tab
                  ? tab[loc.version].v11n
                  : 'KJV';
              const v11n = loc.v11n || modv11n;
              const verse = loc.verse && loc.verse > 1 ? loc.verse : 1;
              const selection =
                loc.lastverse && loc.lastverse > verse
                  ? [loc.book, loc.chapter, verse, loc.lastverse].join('.')
                  : '';
              Commands.goToBibleLocation(
                v11n,
                loc.book,
                loc.chapter,
                verse,
                selection
              );
            }
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.context.selectVerse'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.verse),
        click: ((data) => {
          return () => {
            const { verse } = data;
            if (typeof verse === 'number') {
              const tab = getTab();
              const panels = Prefs.getComplexValue('xulsword.panels');
              const vkm = panels.find(
                (m: string | null) => m && m in tab && tab[m].isVerseKey
              );
              let v11n = (vkm && tab[vkm].v11n) || 'KJV';
              let book = Prefs.getCharPref('xulsword.book');
              let chapter = Prefs.getIntPref('xulsword.chapter');
              if (data.book && data.chapter) {
                book = data.book as string;
                chapter = data.chapter as number;
                const mod = data.module as string | null;
                if (mod && mod in tab) {
                  v11n = tab[mod].v11n || 'KJV';
                }
              }
              let lastverse = data.lastverse as number | null;
              if (!lastverse || lastverse < verse) lastverse = verse;
              const selection = [book, chapter, verse, lastverse].join('.');
              Commands.goToBibleLocation(v11n, book, chapter, verse, selection);
            }
          };
        })(cm.data),
      },
      actions.separator(),
      {
        label: i18next.t('menu.bookmark.add'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(
          cm.data.module && cm.data.book && cm.data.chapter && cm.data.verse
        ),
        click: ((data) => {
          return () => {
            const { module, book, chapter, verse, lastverse } = data;
            if (module && book && chapter && verse) {
              newDbItemWithDefaults(
                false,
                module,
                book,
                chapter,
                verse,
                lastverse
              );
            }
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.usernote.add'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(
          cm.data.module && cm.data.book && cm.data.chapter && cm.data.verse
        ),
        click: ((data) => {
          return () => {
            const { module, book, chapter, verse, lastverse } = data;
            if (module && book && chapter && verse) {
              newDbItemWithDefaults(
                true,
                module,
                book,
                chapter,
                verse,
                lastverse
              );
            }
          };
        })(cm.data),
      },

      {
        label: i18next.t('menu.usernote.properties'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.bookmark),
        click: ((data) => {
          return () => {
            if (data.bookmark)
              Commands.openDbItemPropertiesDialog(data.bookmark);
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.usernote.delete'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.bookmark),
        click: ((data) => {
          return () => {
            if (data.bookmark) Commands.deleteDbItem(data.bookmark);
          };
        })(cm.data),
      },
    ],
  };

  const disposables = [contextMenuCreator(options)];

  // All the code below is to delete target data after it has been referenced.
  // This code is modeled after electron-context-menu to insure listeners are
  // in the correct order (so data is deleted after it is referenced, not before).
  const webContents = (win: any) => win.webContents || (win.id && win);

  const deleteTargetData = () => {
    Data.readOnce(); // delete already used data
  };

  const removeDtdListener = () => {
    if (window.isDestroyed()) return;
    window.webContents?.removeListener('context-menu', deleteTargetData);
  };
  disposables.push(removeDtdListener);

  const win = window as any;
  if (webContents(win) === undefined) {
    const onDomReady = () => {
      window.webContents.on('context-menu', () => {
        deleteTargetData();
      });
    };

    const listenerFunction = win.addEventListener || win.addListener;
    listenerFunction('dom-ready', onDomReady, { once: true });

    disposables.push(() => {
      win.removeEventListener('dom-ready', onDomReady, { once: true });
    });
  } else {
    window.webContents.on('context-menu', () => {
      deleteTargetData();
    });
  }

  return () => {
    disposables.forEach((dispose) => {
      if (typeof dispose === 'function') dispose();
    });
  };
}
