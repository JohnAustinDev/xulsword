/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import contextMenuCreator from 'electron-context-menu';
import i18next from 'i18next';

/*
  https://www.npmjs.com/package/electron-context-menu
  To get spellchecking, “Correct Automatically”, and “Learn Spelling” in the menu,
  enable the spellcheck preference in browser window:
  new BrowserWindow({webPreferences: {spellcheck: true}})
  See https://www.electronjs.org/docs/latest/api/web-contents#event-context-menu
  for params specification.
*/

export default function contextMenu(window: BrowserWindow): () => void {
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
        label: i18next.t('Search'),
        // Only show it when right-clicking images
        visible: params.mediaType === 'image',
      },
      actions.separator(),
      {
        label: 'Search Google for “{selection}”',
        // Only show it when right-clicking text
        visible: params.selectionText.trim().length > 0,
        click: () => {},
      },
    ],
  };
  return contextMenuCreator(options);
}
