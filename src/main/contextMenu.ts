/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import contextMenuCreator from 'electron-context-menu';
import i18next from 'i18next';
import Commands from './commands';
import target from './modules/data';
import setViewportTabs from './tabs';

import type { ContextData } from '../type';

export default function contextMenu(window: BrowserWindow): () => void {
  function targ(key: keyof ContextData) {
    const d = target.data as ContextData;
    return d ? d[key] : null;
  }
  const options: contextMenuCreator.Options = {
    window,
    labels: {
      cut: i18next.t('menu.edit.cut'),
      copy: i18next.t('menu.edit.copy'),
      paste: i18next.t('menu.edit.paste'),
      learnSpelling: 'learnSpelling',
      lookUpSelection: 'lookUpSelection',
      searchWithGoogle: 'searchWithGoogle',
      saveImage: 'saveImage',
      saveImageAs: 'saveImageAs',
      copyLink: 'copyLink',
      saveLinkAs: 'saveLinkAs',
      copyImage: 'copyImage',
      copyImageAddress: 'copyImageAddress',
      inspect: 'inspect',
      services: 'Services',
    },

    prepend: (actions, params) => [
      {
        label: `${i18next.t('Search')}: ${targ('lemma')}`,
        visible: Boolean(targ('lemma')),
        click: () => {
          const search = targ('search') as any;
          if (search) Commands.search(search);
        },
      },
      actions.separator(),
      {
        label: i18next.t('menu.help.about'),
        visible: Boolean(targ('tab') || targ('module')),
        click: () => {
          const mod = targ('module') || targ('tab');
          if (typeof mod === 'string') Commands.openHelp(mod);
        },
      },
      {
        label: i18next.t('menu.options.font'),
        visible: Boolean(targ('module')),
        click: () => {
          const mod = targ('module');
          if (typeof mod === 'string') Commands.openFontsColors(mod);
        },
      },
      {
        label: i18next.t('menu.context.tab'),
        visible: Boolean(targ('tab') && targ('panelIndex')),
        click: () => {
          const mod = targ('tab');
          const panelIndex = targ('panelIndex');
          if (typeof mod === 'string' && typeof panelIndex === 'number')
            setViewportTabs(panelIndex, mod, 'hide');
        },
      },
    ],

    append: (actions, params) => [
      {
        label: i18next.t('Search'),
        visible: Boolean(targ('selection') && targ('module')),
        click: () => {
          const searchtext = targ('selection');
          const module = targ('module');
          if (typeof searchtext === 'string' && typeof module === 'string')
            Commands.search({ module, searchtext, type: 'SearchExactText' });
        },
      },
    ],
  };
  const disposables = [contextMenuCreator(options)];

  // All the code below is to delete target data after it has been referenced.
  // This code is modeled after electron-context-menu to insure listeners are
  // in the correct order (so data is deleted after it is referenced, not before).
  const webContents = (win: any) => win.webContents || (win.id && win);

  const deleteTargetData = () => {
    target.readOnce(); // delete already used data
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
