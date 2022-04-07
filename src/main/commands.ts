/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import { dialog, OpenDialogSyncOptions, shell } from 'electron';
import i18n from 'i18next';
import { clone, JSON_stringify } from '../common';
import { verseKey, getTab, getTabs } from './minit';
import Prefs from './modules/prefs';
import nsILocalFile from './components/nsILocalFile';
import installZipModules from './installer';
import Window from './window';
import { jsdump } from './mutil';

import type {
  GType,
  LocationVKType,
  TextVKType,
  XulswordStatePref,
} from '../type';

const Commands: GType['Commands'] = {
  addRepositoryModule() {
    console.log(`Action not implemented: addRepositoryModule`);
  },

  // Install one or more ZIP modules from the local file system. The paths
  // argument may be one or more paths to installable ZIP files, or a single
  // directory. If the directory ends with '/*' then all modules in that
  // directory will be installed, otherwise the user will be asked to select
  // one or more modules. If no paths are given, the user will be shown the
  // file picker dialog with its default directory, and may select one or more
  // modules to install. Thus, a dialog will only be shown if no paths argument
  // is provided, or an existing directory path is provided.
  addLocalModule(paths) {
    const w = arguments[1];
    const options: OpenDialogSyncOptions = {
      title: i18n.t('menu.addNewModule.label'),
      filters: [
        {
          name: 'ZIP, XSM, XSB',
          extensions: ['zip', 'xsm', 'xsb'],
        },
      ],
      properties: ['openFile', 'multiSelections'],
    };
    let installpaths: string[] | undefined;
    if (paths && Array.isArray(paths)) {
      // Array of file paths
      installpaths = paths;
    } else if (paths?.endsWith('/*')) {
      // All modules in an existing directory
      installpaths = [];
      const file = new nsILocalFile(paths.substring(0, -2));
      if (file.isDirectory()) {
        file.directoryEntries?.forEach((f) => {
          if (/\.(xsm|xsb|zip)$/i.test(f)) installpaths?.push(f);
        });
      }
    } else if (paths) {
      // Existing directory to make a selection or an existing module path
      const file = new nsILocalFile(paths);
      if (file.isDirectory()) {
        options.defaultPath = paths;
        installpaths = dialog.showOpenDialogSync(w, options);
      } else installpaths = [paths];
    } else {
      // No paths argument was provided
      installpaths = dialog.showOpenDialogSync(w, options);
    }
    const mods =
      (installpaths &&
        installpaths.filter((f) => /\.(xsm|xsb|zip)$/i.test(f))) ||
      [];
    installZipModules(mods)
      .then((fails) => {
        if (fails.length) {
          shell.beep();
          jsdump(
            `ERROR: Module installation problems follow:\n${fails.join('\n')}`
          );
        }
        return true;
      })
      .catch((ers) => {
        throw Error(ers);
      });
  },

  removeModule() {
    console.log(`Action not implemented: removeModule`);
    Window.reset();
  },

  exportAudio() {
    console.log(`Action not implemented: exportAudio`);
  },

  importAudio() {
    console.log(`Action not implemented: importAudio`);
  },

  pageSetup() {
    console.log(`Action not implemented: pageSetup`);
  },

  printPreview() {
    console.log(`Action not implemented: printPreview`);
  },

  printPassage() {
    console.log(`Action not implemented: printPassage`);
  },

  print() {
    console.log(`Action not implemented: print`);
  },

  edit(which, ...args) {
    return this[which](...args);
  },

  undo(...args) {
    console.log(`Action not implemented: undo(${JSON_stringify(arguments)})`);
    return false;
  },

  redo(...args) {
    console.log(`Action not implemented: redo(${JSON_stringify(arguments)})`);
    return false;
  },

  cut(...args) {
    console.log(`Action not implemented: cut(${JSON_stringify(arguments)})`);
    return false;
  },

  copy(...args) {
    console.log(`Action not implemented: copy(${JSON_stringify(arguments)})`);
    return false;
  },

  paste(...args) {
    console.log(`Action not implemented: paste(${JSON_stringify(arguments)})`);
    return false;
  },

  search(search) {
    console.log(`Action not implemented: search(${JSON_stringify(arguments)})`);
  },

  copyPassage() {
    console.log(`Action not implemented: copyPassage`);
  },

  openFontsColors(module, window) {
    const options = {
      title: i18n.t('fontsAndColors.label'),
      parent: window || undefined,
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
    console.log(`Action not implemented: openBookmarksManager()`);
  },

  openNewDbItemDialog(userNote: boolean, textvk: TextVKType) {
    console.log(
      `Action not implemented: openNewBookmarkDialog(${JSON_stringify(
        arguments
      )})`
    );
  },

  openDbItemPropertiesDialog(bookmark) {
    console.log(
      `Action not implemented: openBookmarkPropertiesDialog(${JSON_stringify(
        arguments
      )})`
    );
  },

  deleteDbItem(bookmark) {
    console.log(
      `Action not implemented: deleteBookmark(${JSON_stringify(arguments)})`
    );
  },

  openHelp(module) {
    console.log(`Action not implemented: openHelp()`);
  },

  goToLocationVK(
    newlocation: LocationVKType,
    newselection: LocationVKType,
    newScroll = { verseAt: 'center' }
  ) {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
    const { location } = xulsword;
    const newxulsword = clone(xulsword);
    const loc = verseKey(newlocation, location?.v11n || 'KJV');
    const sel = verseKey(newselection, location?.v11n || 'KJV');
    newxulsword.location = loc.location();
    newxulsword.selection = sel.location();
    newxulsword.scroll = newScroll;
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
        v11n: textvk?.location?.v11n || loc?.v11n || 'KJV',
      },
    };

    Commands.openNewDbItemDialog(userNote, textvk2);
  }
}
