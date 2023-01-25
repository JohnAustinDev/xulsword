/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import { BrowserWindow, dialog, OpenDialogSyncOptions } from 'electron';
import { BrowserWindowConstructorOptions } from 'electron/main';
import log from 'electron-log';
import i18n from 'i18next';
import { clone, JSON_stringify } from '../../common';
import C from '../../constant';
import { verseKey, getTab, getTabs } from '../minit';
import Prefs from './prefs';
import LocalFile from './localFile';
import { modalInstall } from './module';
import Window, { getBrowserWindows, publishSubscription } from './window';
import Dirs from './dirs';

import type {
  LocationSKType,
  LocationVKType,
  NewModulesType,
  ScrollType,
  SearchType,
  TextVKType,
  XulswordStatePref,
} from '../../type';
import type { AboutWinState } from '../../renderer/about/about';
import type { PrintPassageState } from '../../renderer/printPassage/printPassage';
import type { CopyPassageState } from '../../renderer/copyPassage/copyPassage';
import type { SelectVKMType } from '../../renderer/libxul/vkselect';

const Commands = {
  openModuleManager(): void {
    const options: BrowserWindowConstructorOptions = {
      title: i18n.t('menu.addNewModule.label'),
    };
    Window.openSingleton({
      type: 'moduleManager',
      category: 'dialog-window',
      options,
    });
  },

  // Install one or more ZIP modules from the local file system. The paths
  // argument may be one or more paths to installable ZIP files, or a single
  // directory. If the directory ends with '/*' then all modules in that
  // directory will be installed. A dialog will be shown if no paths argument
  // is provided, or an existing directory path is provided.
  async installXulswordModules(
    paths?: string[] | string, // file, file[], directory, directory/* or undefined=choose-files
    toSharedModuleDir?: boolean
  ): Promise<NewModulesType> {
    const destDir =
      Dirs.path[toSharedModuleDir ? 'xsModsCommon' : 'xsModsUser'];
    const callingWinID: number =
      arguments[2] ?? getBrowserWindows({ type: 'xulsword' })[0].id;
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
    Window.modal([
      { modal: 'transparent', window: 'all' },
      { modal: 'darkened', window: { type: 'xulsword' } },
    ]);
    if (paths) {
      // Install array of file paths
      if (Array.isArray(paths)) {
        return modalInstall(filter(paths), destDir, callingWinID);
      }
      // Install all modules in a directory
      if (paths.endsWith('/*')) {
        const list: string[] = [];
        const file = new LocalFile(paths.substring(0, -2));
        if (file.isDirectory()) {
          list.push(...filter(file.directoryEntries));
        }
        return modalInstall(list, destDir, callingWinID);
      }
      const file = new LocalFile(paths);
      // ZIP file to install
      if (!file.isDirectory()) {
        return modalInstall(filter([file.path]), destDir, callingWinID);
      }
      // Choose from existing directory.
      options.defaultPath = paths;
    }
    const obj = await dialog.showOpenDialog(
      getBrowserWindows({ type: 'xulsword' })[0],
      options
    );
    return modalInstall(obj.filePaths, destDir, callingWinID);
  },

  removeModule() {
    const options = {
      title: i18n.t('menu.removeModule.label'),
    };
    Window.openSingleton({
      type: 'removeModule',
      category: 'dialog-window',
      options,
    });
  },

  exportAudio() {
    process.crash();
  },

  importAudio() {
    log.error(`Action not implemented: importAudio`);
  },

  print() {
    const callingWinID: number =
      arguments[0] ?? getBrowserWindows({ type: 'xulsword' })[0].id;
    const windowToPrint = BrowserWindow.fromId(callingWinID);
    if (windowToPrint) {
      log.info(`Printing window id ${windowToPrint.id}`);
      publishSubscription<'setWindowRootState'>(
        'setWindowRootState',
        { id: windowToPrint.id },
        false,
        {
          showPrintOverlay: true,
          modal: 'outlined',
        }
      );
    }
  },

  printPassage(state?: Partial<PrintPassageState>) {
    const passageWinState: Partial<PrintPassageState> = state || {
      chapters: null,
    };
    const options = {
      title: i18n.t('print.printpassage'),
      ...C.UI.Window.large,
      webPreferences: {
        additionalArguments: [JSON_stringify({ passageWinState })],
      },
    };
    Window.open({ type: 'printPassage', category: 'dialog-window', options });
  },

  edit(
    which: 'undo' | 'redo' | 'cut' | 'copy' | 'paste',
    ...args: any
  ): boolean {
    return this[which](...args);
  },

  undo(...args: any): boolean {
    log.info(`Action not implemented: undo(${JSON_stringify(args)})`);
    return false;
  },

  redo(...args: any): boolean {
    log.info(`Action not implemented: redo(${JSON_stringify(args)})`);
    return false;
  },

  cut(...args: any): boolean {
    log.info(`Action not implemented: cut(${JSON_stringify(args)})`);
    return false;
  },

  copy(...args: any): boolean {
    log.info(`Action not implemented: copy(${JSON_stringify(args)})`);
    return false;
  },

  paste(...args: any): boolean {
    log.info(`Action not implemented: paste(${JSON_stringify(args)})`);
    return false;
  },

  search(search: SearchType): void {
    const options = {
      title: `${i18n.t('search.label')} "${search.searchtext}"`,
      width: 800,
      height: 630,
      webPreferences: {
        additionalArguments: [JSON_stringify({ search })],
      },
    };
    Window.open({ type: 'search', category: 'window', options });
  },

  searchHelp() {
    const options = {
      width: 800,
      title: `${i18n.t('searchHelp.title')}`,
    };
    Window.open({ type: 'searchHelp', category: 'dialog-window', options });
  },

  copyPassage(state?: Partial<CopyPassageState>) {
    const tab = getTab();
    const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
    const vkmod = xulsword.panels.find(
      (p) => p && p in tab && tab[p].isVerseKey
    );
    const vk11n = (vkmod && tab[vkmod].v11n) || 'KJV';
    const passage: SelectVKMType | null =
      xulsword.location && vkmod
        ? {
            ...verseKey(xulsword.location).location(vk11n),
            vkmod,
          }
        : null;
    const copyPassageState: Partial<CopyPassageState> = {
      passage,
      ...(state || undefined),
    };
    const options = {
      title: i18n.t('menu.copypassage'),
      ...C.UI.Window.large,
      webPreferences: {
        additionalArguments: [JSON_stringify({ copyPassageState })],
      },
    };
    Window.open({ type: 'copyPassage', category: 'dialog', options });
  },

  openFontsColors(module: string): void {
    let win: BrowserWindow | null =
      BrowserWindow.fromId(arguments[1] ?? -1) ||
      getBrowserWindows({ type: 'xulsword' })[0];
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
    win = null;
  },

  openBookmarksManager() {
    log.info(`Action not implemented: openBookmarksManager()`);
  },

  openNewDbItemDialog(userNote: boolean, textvk: TextVKType): void {
    log.info(
      `Action not implemented: openNewBookmarkDialog(${JSON_stringify(
        userNote
      )})`
    );
  },

  openDbItemPropertiesDialog(bookmark: unknown): void {
    log.info(
      `Action not implemented: openBookmarkPropertiesDialog(${JSON_stringify(
        bookmark
      )})`
    );
  },

  deleteDbItem(bookmark: unknown): void {
    log.info(
      `Action not implemented: deleteBookmark(${JSON_stringify(bookmark)})`
    );
  },

  openAbout(state?: Partial<AboutWinState>): void {
    const tab = getTab();
    const t =
      (state?.configs &&
        state.configs.length &&
        state.configs[0].module in tab &&
        tab[state.configs[0].module]) ||
      null;
    const label = (t && t.label) || '';
    const options = {
      width: 510,
      height: 425,
      title: `${i18n.t('menu.help.about')} ${label}`,
      webPreferences: {
        additionalArguments: [JSON_stringify({ aboutWinState: state || {} })],
      },
    };
    Window.open({ type: 'about', category: 'dialog-window', options });
  },

  goToLocationSK(
    location: LocationSKType,
    scroll?: ScrollType | undefined
  ): void {
    const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
    const newxulsword = clone(xulsword);
    const { panels, keys } = newxulsword;
    let p = panels.findIndex((m) => m && m === location.module);
    if (p === -1) {
      p = 0;
      panels[p] = location.module;
    }
    keys[p] = location.key;
    newxulsword.scroll = scroll || { verseAt: 'center' };
    Prefs.mergeValue('xulsword', newxulsword);
  },

  goToLocationVK(
    newlocation: LocationVKType,
    newselection: LocationVKType,
    newscroll?: ScrollType
  ): void {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
    const { location } = xulsword;
    const newxulsword = clone(xulsword);
    const loc = verseKey(newlocation, location?.v11n || undefined);
    const sel = verseKey(newselection, location?.v11n || undefined);
    newxulsword.location = loc.location();
    newxulsword.selection = sel.location();
    newxulsword.scroll = newscroll || { verseAt: 'center' };
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
