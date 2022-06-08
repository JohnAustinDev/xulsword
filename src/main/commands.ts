/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import { dialog, OpenDialogSyncOptions } from 'electron';
import { BrowserWindowConstructorOptions } from 'electron/main';
import log from 'electron-log';
import i18n from 'i18next';
import { clone, JSON_stringify } from '../common';
import { verseKey, getTab, getTabs } from './minit';
import Prefs from './components/prefs';
import LocalFile from './components/localFile';
import { modalInstall } from './installer';
import Window, { getBrowserWindows } from './window';

import type {
  GType,
  LocationVKType,
  ScrollType,
  TextVKType,
  XulswordStatePref,
} from '../type';

const Commands: GType['Commands'] = {
  openModuleManager() {
    const win = arguments[1] || getBrowserWindows({ type: 'xulsword' })[0];
    const options: BrowserWindowConstructorOptions = {
      title: i18n.t('menu.addNewModule.label'),
      parent: win || undefined,
    };
    Window.open({
      type: 'moduleManager',
      category: 'window',
      options,
    });
  },

  // Install one or more ZIP modules from the local file system. The paths
  // argument may be one or more paths to installable ZIP files, or a single
  // directory. If the directory ends with '/*' then all modules in that
  // directory will be installed. A dialog will be shown if no paths argument
  // is provided, or an existing directory path is provided.
  async installXulswordModules(paths) {
    const extensions = ['zip', 'xsm', 'xsb'];
    const options: OpenDialogSyncOptions = {
      title: i18n.t('menu.addNewModule.label'),
      filters: [
        {
          name: extensions.map((x) => x.toUpperCase()).join(', '),
          extensions,
        },
      ],
      properties: ['openFile', 'multiSelections'],
    };
    const extRE = new RegExp(`\\.(${extensions.join('|')})$`, 'i');
    function filter(fileArray: string[]): string[] {
      return fileArray.filter((f) => extRE.test(f));
    }
    if (paths) {
      // Install array of file paths
      if (Array.isArray(paths)) {
        return modalInstall(filter(paths));
      }
      // Install all modules in a directory
      if (paths.endsWith('/*')) {
        const list: string[] = [];
        const file = new LocalFile(paths.substring(0, -2));
        if (file.isDirectory()) {
          list.push(...filter(file.directoryEntries));
        }
        return modalInstall(list);
      }
      const file = new LocalFile(paths);
      // ZIP file to install
      if (!file.isDirectory()) {
        return modalInstall(filter([file.path]));
      }
      // Choose from existing directory.
      options.defaultPath = paths;
    }
    const progwin = getBrowserWindows({ type: 'xulsword' })[0];
    return dialog
      .showOpenDialog(progwin, options)
      .then((obj) => {
        return modalInstall(obj.filePaths);
      })
      .catch((err) => {
        throw Error(err);
      });
  },

  removeModule() {
    const win = arguments[1] || getBrowserWindows({ type: 'xulsword' })[0];
    const options = {
      title: i18n.t('menu.removeModule.label'),
      parent: win || undefined,
    };
    Window.open({
      type: 'removeModule',
      category: 'window',
      options,
    });
  },

  exportAudio() {
    throw Error(`Action not implemented: exportAudio`);
  },

  importAudio() {
    log.error(`Action not implemented: importAudio`);
  },

  pageSetup() {
    log.info(`Action not implemented: pageSetup`);
  },

  printPreview() {
    log.info(`Action not implemented: printPreview`);
  },

  printPassage() {
    log.info(`Action not implemented: printPassage`);
  },

  print() {
    log.info(`Action not implemented: print`);
  },

  edit(which, ...args) {
    return this[which](...args);
  },

  undo(...args) {
    log.info(`Action not implemented: undo(${JSON_stringify(args)})`);
    return false;
  },

  redo(...args) {
    log.info(`Action not implemented: redo(${JSON_stringify(args)})`);
    return false;
  },

  cut(...args) {
    log.info(`Action not implemented: cut(${JSON_stringify(args)})`);
    return false;
  },

  copy(...args) {
    log.info(`Action not implemented: copy(${JSON_stringify(args)})`);
    return false;
  },

  paste(...args) {
    log.info(`Action not implemented: paste(${JSON_stringify(args)})`);
    return false;
  },

  search(search) {
    log.info(`Action not implemented: search(${JSON_stringify(search)})`);
  },

  copyPassage() {
    log.info(`Action not implemented: copyPassage`);
  },

  openFontsColors(module) {
    const win = arguments[1] || getBrowserWindows({ type: 'xulsword' })[0];
    const options = {
      title: i18n.t('fontsAndColors.label'),
      parent: win || undefined,
      webPreferences: {
        additionalArguments: [
          JSON_stringify({
            chooseFontState: {
              module,
            },
          }),
        ],
      },
    };
    Window.open({ type: 'chooseFont', category: 'dialog', options });
  },

  openBookmarksManager() {
    log.info(`Action not implemented: openBookmarksManager()`);
  },

  openNewDbItemDialog(userNote: boolean, textvk: TextVKType) {
    log.info(
      `Action not implemented: openNewBookmarkDialog(${JSON_stringify(
        userNote
      )})`
    );
  },

  openDbItemPropertiesDialog(bookmark) {
    log.info(
      `Action not implemented: openBookmarkPropertiesDialog(${JSON_stringify(
        bookmark
      )})`
    );
  },

  deleteDbItem(bookmark) {
    log.info(
      `Action not implemented: deleteBookmark(${JSON_stringify(bookmark)})`
    );
  },

  openHelp(module) {
    log.info(`Action not implemented: openHelp()`);
  },

  goToLocationVK(
    newlocation: LocationVKType,
    newselection: LocationVKType,
    newScroll: ScrollType | undefined
  ) {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
    const { location } = xulsword;
    const newxulsword = clone(xulsword);
    const loc = verseKey(newlocation, location?.v11n || undefined);
    const sel = verseKey(newselection, location?.v11n || undefined);
    newxulsword.location = loc.location();
    newxulsword.selection = sel.location();
    newxulsword.scroll = newScroll || { verseAt: 'center' };
    Prefs.mergeValue('xulsword', newxulsword);
  },
};

export default Commands;

export function newDbItemWithDefaults(
  userNote: boolean,
  textvk: TextVKType | null
) {
  const tab = getTab();
  const tabs = getTabs();
  const panels = Prefs.getComplexValue(
    'xulsword.panels'
  ) as XulswordStatePref['panels'];
  const vkm = panels.find(
    (m: string | null) => m && m in tab && tab[m].isVerseKey
  );
  if (vkm) {
    const loc = Prefs.getComplexValue(
      'xulsword.location'
    ) as XulswordStatePref['location'];
    const sel = Prefs.getComplexValue(
      'xulsword.selection'
    ) as XulswordStatePref['selection'];
    const textvk2 = {
      module: textvk?.module || tabs[0].module,
      text: textvk?.text || '',
      location: {
        book: textvk?.location?.book || loc?.book || '',
        chapter: textvk?.location?.chapter || loc?.chapter || 0,
        verse: textvk?.location?.verse || sel?.verse || loc?.verse || null,
        lastverse:
          textvk?.location?.lastverse ||
          sel?.lastverse ||
          loc?.lastverse ||
          null,
        v11n: textvk?.location?.v11n || loc?.v11n || null,
      },
    };

    Commands.openNewDbItemDialog(userNote, textvk2);
  }
}
