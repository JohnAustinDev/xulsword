/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import contextMenuCreator from 'electron-context-menu';
import i18next from 'i18next';
import Commands, { newDbItemWithDefaults } from './commands';
import setViewportTabs from './tabs';
import Data from './modules/data';

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
        enabled: Boolean(cm.data.selectionParsedVK),
        click: ((data) => {
          return () => {
            const loc = data.selectionParsedVK as LocationVKType;
            if (typeof loc === 'object') {
              Commands.goToLocationVK(loc, loc);
            }
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.context.selectVerse'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.locationVK),
        click: ((data) => {
          return () => {
            const { locationVK } = data;
            if (locationVK && typeof locationVK === 'object') {
              Commands.goToLocationVK(locationVK, locationVK);
            }
          };
        })(cm.data),
      },
      actions.separator(),
      {
        label: i18next.t('menu.bookmark.add'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.module && cm.data.locationVK),
        click: ((data) => {
          return () => {
            const { module, locationVK: location } = data;
            if (module && location) {
              newDbItemWithDefaults(false, {
                location,
                module,
                text: '',
              });
            }
          };
        })(cm.data),
      },
      {
        label: i18next.t('menu.usernote.add'),
        visible: Object.keys(cm.data).length > 0,
        enabled: Boolean(cm.data.module && cm.data.locationVK),
        click: ((data) => {
          return () => {
            const { module, locationVK: location } = data;
            if (module && location) {
              newDbItemWithDefaults(true, {
                location,
                module,
                text: '',
              });
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
