/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import { BrowserWindow, dialog, OpenDialogSyncOptions } from 'electron';
import { BrowserWindowConstructorOptions } from 'electron/main';
import fpath from 'path';
import log from 'electron-log';
import i18n from 'i18next';
import {
  clone,
  diff,
  gbPaths,
  JSON_stringify,
  pad,
  versionCompare,
} from '../../common';
import Subscription from '../../subscription';
import C from '../../constant';
import parseSwordConf from '../parseSwordConf';
import { verseKey, getTab, getTabs, getAudioConfs } from '../minit';
import Prefs from './prefs';
import LibSword from './libsword';
import LocalFile from './localFile';
import { modalInstall, scanAudio } from './module';
import Window, { getBrowserWindows, publishSubscription } from './window';
import Dirs from './dirs';

import type {
  AudioPath,
  GenBookAudio,
  GenBookAudioFile,
  LocationGBType,
  LocationVKType,
  NewModulesType,
  OSISBookType,
  ScrollType,
  SearchType,
  TextVKType,
  VerseKeyAudioFile,
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

  playAudio(audio: VerseKeyAudioFile | GenBookAudioFile | null) {
    let newxulsword = clone(
      Prefs.getComplexValue('xulsword')
    ) as XulswordStatePref;
    if (audio) {
      if (
        'book' in audio &&
        Object.values(C.SupportedBooks).some((bg: any) =>
          bg.includes(audio.book)
        )
      ) {
        const { book, chapter, swordModule } = audio;
        const tab = getTab();
        newxulsword = this.goToLocationVK(
          {
            book,
            chapter: chapter || 1,
            verse: 1,
            v11n: (swordModule && tab[swordModule].v11n) || null,
          },
          undefined,
          undefined,
          true
        );
      } else if ('key' in audio) {
        const { key, swordModule } = audio;
        if (swordModule) {
          newxulsword = this.goToLocationGB(
            {
              module: swordModule,
              key,
            },
            undefined,
            true
          );
        }
      }
      newxulsword.audio = {
        open: true,
        file: audio,
      };
    } else newxulsword.audio = { open: false, file: null };
    Prefs.mergeValue('xulsword', newxulsword);
  },

  async exportAudio() {
    let xswindow: BrowserWindow | null = getBrowserWindows({
      type: 'xulsword',
    })[0];
    const tab = getTab();
    const gbpaths = {} as { [module: string]: GenBookAudio };
    function title(module: string, path: number[]): string {
      let paths = {} as GenBookAudio;
      if (module in gbpaths) {
        paths = gbpaths[module];
      } else if (module && module in tab) {
        paths = gbPaths(LibSword.getGenBookTableOfContents(module));
        gbpaths[module] = paths;
      }
      const entry = Object.entries(paths).find((e) => !diff(path, e[1]));
      let t = '';
      if (entry) {
        const keys = entry[0].split(C.GBKSEP);
        if (!keys[keys.length - 1]) keys.pop();
        t = ` ${keys.pop()}`;
      }
      return t;
    }
    function getFiles(dir: LocalFile) {
      let r: LocalFile[] = [];
      dir.directoryEntries.forEach((fn) => {
        const f = dir.clone().append(fn);
        if (f.isDirectory()) {
          const rsub = getFiles(f);
          if (rsub.length) r = r.concat(rsub);
        } else r.push(f);
      });
      return r;
    }
    const progress = (prog: number) => {
      xswindow?.setProgressBar(prog);
      xswindow?.webContents.send('progress', prog);
      if (prog === -1) xswindow = null;
    };
    const modulesDir = Dirs.xsAudio.append('modules');
    const audioFiles = getFiles(modulesDir);
    if (audioFiles.length) {
      const obj = await dialog.showOpenDialog(xswindow, {
        title: i18n.t('to.label'),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (obj.filePaths[0]) {
        progress(0);
        let tot = 0;
        try {
          const audioConfs = getAudioConfs();
          const destdir = new LocalFile(obj.filePaths[0]);
          const confWritten: string[] = [];
          audioFiles.forEach((file) => {
            const fp = fpath.parse(fpath.relative(modulesDir.path, file.path));
            const dirs = fp.dir.split(fpath.sep);
            const module = dirs.shift();
            if (module) {
              // Copy config file once...
              const confname = audioConfs[module].filename;
              const conf = Dirs.xsAudio.append('mods.d').append(confname);
              if (
                conf.exists() &&
                !confWritten.includes(conf.path) &&
                !conf.isDirectory()
              ) {
                const confdest = destdir.clone().append('mods.d');
                if (!confdest.exists())
                  confdest.create(LocalFile.DIRECTORY_TYPE);
                conf.copyTo(confdest);
                confWritten.push(conf.path);
              }
              if (
                dirs[0] &&
                Object.values(C.SupportedBooks).some((bg: any) =>
                  bg.includes(dirs[0])
                )
              ) {
                // Copy VerseKey audio file...
                const book = dirs.shift();
                if (book) {
                  const chapFileName = dirs.shift();
                  if (!dirs.length) {
                    const bookFileName = i18n.exists(book, { ns: 'books' })
                      ? i18n.t(book, { ns: 'books' })
                      : book;
                    const dest = destdir
                      .clone()
                      .append('modules')
                      .append(module)
                      .append(bookFileName);
                    if (!dest.exists())
                      dest.create(LocalFile.DIRECTORY_TYPE, {
                        recursive: true,
                      });
                    file.copyTo(dest, chapFileName);
                    tot += 1;
                  }
                }
              } else {
                // Copy GenBook audio file...
                const path: number[] = [];
                const dest = destdir.clone().append('modules').append(module);
                while (dirs.length) {
                  const sub = dirs.shift();
                  if (sub) {
                    if (!Number.isNaN(Number(sub))) {
                      path.push(Number(sub));
                    }
                    dest.append(`${sub}${title(module, path)}`);
                  }
                }
                if (!Number.isNaN(Number(fp.name))) {
                  path.push(Number(fp.name));
                }
                const chapFileName = `${fp.name}${title(module, path)}${
                  fp.ext
                }`;
                if (!dest.exists())
                  dest.create(LocalFile.DIRECTORY_TYPE, {
                    recursive: true,
                  });
                file.copyTo(dest, chapFileName);
                tot += 1;
              }
            }
            progress(tot / audioFiles.length);
          });
        } finally {
          progress(-1);
          log.info(`Exported ${tot} of ${audioFiles.length} audio files.`);
        }
      }
    }
  },

  async importAudio() {
    const obj = await dialog.showOpenDialog(
      getBrowserWindows({ type: 'xulsword' })[0],
      {
        title: i18n.t('from.label'),
        properties: ['openDirectory'],
      }
    );
    if (obj.filePaths[0]) {
      let tot = 0;
      let ctot = 0;
      const tab = getTab();
      let xswindow: BrowserWindow | null = getBrowserWindows({
        type: 'xulsword',
      })[0];
      const callingWinID = xswindow.id;
      const audioExtRE = new RegExp(`^\\.(${C.SupportedAudio.join('|')})$`);
      const getImportFiles = (dir: LocalFile): LocalFile[] => {
        const r: LocalFile[] = [];
        dir.directoryEntries.forEach((fn) => {
          const file = dir.clone().append(fn);
          if (file.isDirectory()) r.push(...getImportFiles(file));
          else r.push(file);
        });
        return r;
      };
      const getModule = (moddir?: string): string => {
        if (!moddir) return '';
        let r = moddir;
        // Legacy module directory has locale appended
        const m = r?.match(/^(.*?)_([a-z]{2,3}(-[A-Za-z]+)?)$/);
        if (m) [, r] = m;
        if (r && !C.SwordModuleCharsRE.test(r)) r = '';
        return !m ? r : r?.toUpperCase(); // Legacy dir name was lowercase
      };
      const progress = (prog: number) => {
        xswindow?.setProgressBar(prog);
        xswindow?.webContents.send('progress', prog);
        if (prog === -1) xswindow = null;
      };
      let modsd: LocalFile | null = null;
      const gbpaths = {} as { [module: string]: GenBookAudio };
      const newmods = clone(C.NEWMODS);
      const smodules: Set<string> = new Set();
      let singleModule: string | undefined;
      const fromdir = new LocalFile(obj.filePaths[0]);
      const parent = fpath
        .normalize(fpath.join(fromdir.path, '..'))
        .split(fpath.sep)
        .pop();
      if (fromdir.directoryEntries.includes('modules')) {
        fromdir.append('modules');
      } else if (parent === 'modules') {
        singleModule = getModule(fromdir.path.split(fpath.sep).pop());
        fromdir.append('..');
      }
      modsd = fromdir.clone();
      modsd.append('..').append('mods.d');
      if (!modsd.exists()) modsd = null;
      const importFiles = getImportFiles(fromdir);
      progress(0);
      try {
        importFiles.forEach((file) => {
          const dest = Dirs.xsAudio;
          const fp = fpath.parse(fpath.relative(fromdir.path, file.path));
          fp.ext = fp.ext.toLowerCase();
          const dirs = fp.dir.split(fpath.sep);
          const module = getModule(dirs.shift());
          if (
            module &&
            audioExtRE.test(fp.ext) &&
            (!singleModule || singleModule === module)
          ) {
            let paths = {} as GenBookAudio;
            if (module in gbpaths) {
              paths = gbpaths[module];
            } else if (module in tab && tab[module].type === C.GENBOOK) {
              paths = gbPaths(LibSword.getGenBookTableOfContents(module));
              gbpaths[module] = paths;
            }
            dest.append('modules').append(module);
            const path: AudioPath = [];
            const chapter = Number(fp.name.replace(/^(\d+).*?$/, '$1'));
            let book: OSISBookType | '' = '';
            while (dirs.length) {
              let sub = dirs.shift();
              if (sub) {
                const subn = Number(sub.replace(/^(\d+).*?$/, '$1'));
                const m2 = sub.match(/^(\d+)[-\s](.*?)$/); // legacy VerseKey markup
                if (!book && m2)
                  book = verseKey(m2[2]).book as OSISBookType | '';
                else if (!book) book = verseKey(sub).book as OSISBookType | '';
                if (book) {
                  sub = book;
                  path.push(book);
                } else {
                  sub = pad(subn, 3, 0);
                  path.push(subn);
                }
                dest.append(sub);
              }
            }
            path.push(chapter);
            // Only accept the file if it has a proper AudioPath.
            if (
              path.length &&
              (Object.values(C.SupportedBooks).some((bg: any) =>
                bg.includes(path[0])
              ) ||
                !Number.isNaN(Number(path[0]))) &&
              !path.slice(1).some((x) => Number.isNaN(Number(x)))
            ) {
              smodules.add(module);
              if (!dest.exists()) {
                dest.create(LocalFile.DIRECTORY_TYPE, { recursive: true });
              }
              const name = pad(chapter, 3, 0);
              file.copyTo(dest, `${name}${fp.ext}`);
              let audiofile: VerseKeyAudioFile | GenBookAudioFile;
              if (
                book &&
                Object.values(C.SupportedBooks).some((bg: any) =>
                  bg.includes(book)
                )
              ) {
                audiofile = {
                  audioModule: module,
                  book,
                  chapter,
                  path: [book, chapter],
                };
              } else {
                const entry = Object.entries(paths).find(
                  (e) => !diff(path, e[1])
                );
                audiofile = {
                  audioModule: module,
                  key: (entry && entry[0]) || '',
                  path,
                };
              }
              newmods.audio.push(audiofile);
              tot += 1;
            }
          }
          progress(tot / importFiles.length);
        });
      } finally {
        progress(-1);
      }
      // Update or create the config files
      const myconfs = modsd?.directoryEntries.map((c) => {
        const cf = modsd?.clone().append(c);
        return !cf || cf.isDirectory() ? null : parseSwordConf(cf);
      });
      const destconfs = getAudioConfs();
      const modules = Array.from(smodules);
      modules.forEach((module) => {
        const myconf = myconfs && myconfs.find((c) => c && c.module === module);
        const destconf = Object.values(destconfs).find(
          (c) => c && c.module === module
        );
        const mycfile =
          (myconf && modsd?.clone().append(myconf.filename)) || null;
        let destcfile =
          (destconf &&
            Dirs.xsAudio.append('mods.d').append(destconf.filename)) ||
          null;
        const myvers = (myconf && myconf.Version) || 0;
        const destvers = (destconf && destconf.Version) || 0;
        const confname = `${module.toLowerCase()}.conf`;
        if (
          mycfile?.exists() &&
          (!destcfile?.exists() || versionCompare(myvers, destvers) === 1)
        ) {
          destcfile = Dirs.xsAudio.append('mods.d').append(confname);
          mycfile?.copyTo(Dirs.xsAudio.append('mods.d'), confname);
        } else if (!destcfile?.exists()) {
          // If necessary, auto-generate bare minimum config file
          destcfile = Dirs.xsAudio.append('mods.d').append(confname);
          destcfile.writeFile(
            `[${module}]\nModDrv=audio\nDataPath=./modules/${module}\nVersion=0.0.1\nDescription=Imported audio\nAudioChapters={}`
          );
        }
        // Update config AudioChapters
        if (destcfile && destcfile.exists()) {
          const audioChapters = scanAudio(
            Dirs.xsAudio.path,
            `./modules/${module}`
          );
          let str = destcfile.readFile();
          str = str.replace(
            /^AudioChapters\b.*$/m,
            `AudioChapters=${JSON_stringify(audioChapters)}`
          );
          destcfile.writeFile(str);
          newmods.modules.push(parseSwordConf(destcfile));
          ctot += 1;
        } else {
          newmods.reports.push({ error: `(${module}) Missing config file.` });
        }
      });
      log.info(
        `Imported ${tot} audio files out of ${importFiles.length} files`
      );
      log.info(`Updated ${ctot} of ${modules.length} audio config files.`);
      if (modules.length) {
        Subscription.publish.modulesInstalled(newmods, callingWinID);
      }
    }
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

  goToLocationGB(
    location: LocationGBType,
    scroll?: ScrollType | undefined,
    deferAction?: boolean
  ): XulswordStatePref {
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
    if (!deferAction) Prefs.mergeValue('xulsword', newxulsword);
    return newxulsword;
  },

  goToLocationVK(
    newlocation: LocationVKType,
    newselection?: LocationVKType,
    newscroll?: ScrollType,
    deferAction?: boolean
  ): XulswordStatePref {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    const xulsword = Prefs.getComplexValue('xulsword') as XulswordStatePref;
    const { location } = xulsword;
    const newxulsword = clone(xulsword);
    const loc = verseKey(newlocation, location?.v11n || undefined);
    const sel = newselection
      ? verseKey(newselection, location?.v11n || undefined)
      : null;
    newxulsword.location = loc.location();
    newxulsword.selection = sel ? sel.location() : null;
    newxulsword.scroll = newscroll || { verseAt: 'center' };
    if (!deferAction) Prefs.mergeValue('xulsword', newxulsword);
    return newxulsword;
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
        book: (textvk?.location?.book || loc?.book || 'Gen') as OSISBookType,
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
