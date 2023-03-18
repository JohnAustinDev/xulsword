/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
import type ZIP from 'adm-zip';
import { BrowserWindow, dialog, OpenDialogSyncOptions } from 'electron';
import { BrowserWindowConstructorOptions } from 'electron/main';
import fpath from 'path';
import log from 'electron-log';
import i18n from 'i18next';
import {
  clone,
  diff,
  findBookmarkItem,
  gbPaths,
  JSON_parse,
  JSON_stringify,
  pad,
  versionCompare,
  deleteBookmarkItem as DeleteBookmarkItem,
  pasteBookmarkItems as PasteBookmarkItems,
  moveBookmarkItems,
} from '../../common';
import Subscription from '../../subscription';
import C, { S } from '../../constant';
import parseSwordConf from '../parseSwordConf';
import importBookmarkObject, {
  importDeprecatedBookmarks,
  Transaction,
} from '../bookmarks';
import { verseKey, getTab, getAudioConfs } from '../minit';
import Prefs from './prefs';
import LibSword from './libsword';
import LocalFile from './localFile';
import { modalInstall, scanAudio } from './module';
import Window, { getBrowserWindows, publishSubscription } from './window';
import Dirs from './dirs';

import type {
  AudioPath,
  BookmarkFolderType,
  BookmarkType,
  GenBookAudio,
  GenBookAudioFile,
  LocationGBType,
  LocationVKType,
  NewModulesType,
  OSISBookType,
  ScrollType,
  SearchType,
  VerseKeyAudioFile,
} from '../../type';
import type { AboutWinState } from '../../renderer/about/about';
import type { PrintPassageState } from '../../renderer/printPassage/printPassage';
import type { CopyPassageState } from '../../renderer/copyPassage/copyPassage';
import type { SelectVKMType } from '../../renderer/libxul/vkselect';
import type { BMPropertiesStateWinArg } from '../../renderer/bmProperties/bmProperties';

const Commands = {
  openModuleManager(): void {
    Window.open({
      type: 'moduleManager',
      className: 'skin',
      persist: true,
      saveIfAppClosed: true,
      options: {
        title: i18n.t('menu.addNewModule'),
      },
    });
  },

  // Install one or more .zip, .xsm, .xsb, .txt or .json modules from the local
  // file system. All .zip and .xsm files will be treated as XSM modules, and
  // all other extensions will be treated as bookmark files. The paths argument
  // may be one or more paths of installable files, or a single directory con-
  // taining installable files. If the directory ends with '/*' then all modules
  // in that directory will be installed. A dialog will be shown if no paths
  // argument is provided, or an existing directory path is provided.
  async installXulswordModules(
    paths?: string[] | string, // file, file[], directory, directory/* or undefined=choose-files
    toSharedModuleDir?: boolean
  ): Promise<NewModulesType> {
    const destDir =
      Dirs.path[toSharedModuleDir ? 'xsModsCommon' : 'xsModsUser'];
    const callingWinID: number =
      arguments[2] ?? getBrowserWindows({ type: 'xulsword' })[0].id;
    const extensions = ['zip', 'xsm', 'xsb', 'txt', 'json'];
    const options: OpenDialogSyncOptions = {
      title: i18n.t('menu.addNewModule'),
      filters: [
        {
          name: extensions.map((x) => x.toUpperCase()).join(', '),
          extensions,
        },
      ],
      properties: ['openFile', 'multiSelections'],
    };
    const extRE = new RegExp(`\\.(${extensions.join('|')})$`, 'i');
    const filter = (fileArray: string[]): string[] => {
      return fileArray.filter((f) => extRE.test(f));
    };
    const modalInstall2 = async (
      mods: (ZIP | string)[],
      destdir?: string | string[],
      callingWinID2?: number
    ): Promise<NewModulesType> => {
      const r: NewModulesType = clone(C.NEWMODS);
      const bookmarkMods = mods.filter(
        (m) => typeof m === 'string' && /\.(xsb|txt|json)$/i.test(m)
      ) as string[];
      if (bookmarkMods.length) {
        await this.importBookmarks(bookmarkMods, undefined, r);
      }
      const zipmods = mods.filter(
        (m) => typeof m !== 'string' || !/\.(xsb|txt|json)$/i.test(m)
      );
      if (zipmods.length) {
        await modalInstall(zipmods, destdir, callingWinID2, r);
      }
      Subscription.publish.modulesInstalled(r, callingWinID);
      return r;
    };
    Window.modal([
      { modal: 'transparent', window: 'all' },
      { modal: 'darkened', window: { type: 'xulsword' } },
    ]);
    if (paths) {
      // Install array of file paths
      if (Array.isArray(paths)) {
        return modalInstall2(filter(paths), destDir, callingWinID);
      }
      // Install all modules in a directory
      if (paths.endsWith('/*')) {
        const list: string[] = [];
        const file = new LocalFile(paths.substring(0, -2));
        if (file.isDirectory()) {
          list.push(...filter(file.directoryEntries));
        }
        return modalInstall2(list, destDir, callingWinID);
      }
      const file = new LocalFile(paths);
      // ZIP file to install
      if (!file.isDirectory()) {
        return modalInstall2(filter([file.path]), destDir, callingWinID);
      }
      // Choose from existing directory.
      options.defaultPath = paths;
    }
    const obj = await dialog.showOpenDialog(
      getBrowserWindows({ type: 'xulsword' })[0],
      options
    );
    return modalInstall2(obj.filePaths, destDir, callingWinID);
  },

  removeModule() {
    Window.open({
      type: 'removeModule',
      className: 'skin',
      persist: true,
      saveIfAppClosed: true,
      options: {
        title: i18n.t('menu.removeModule'),
      },
    });
  },

  playAudio(audio: VerseKeyAudioFile | GenBookAudioFile | null) {
    let newxulsword = clone(
      Prefs.getComplexValue('xulsword')
    ) as typeof S.prefs.xulsword;
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
                if (!book && m2) book = verseKey(m2[2]).book;
                else if (!book) book = verseKey(sub).book;
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
    Window.open({
      type: 'printPassage',
      className: 'skin',
      persist: true,
      additionalArguments: { passageWinState },
      options: {
        title: i18n.t('menu.printPassage'),
        ...C.UI.Window.large,
      },
    });
  },

  edit(which: string, ...args: any[]): boolean {
    if (which in this) {
      const func = (this as any)[which];
      if (typeof func === 'function') return func(...args);
    }
    return false;
  },

  undo(): boolean {
    const { list, index } = Transaction;
    if (!(list.length < 2 || index < 1)) {
      Transaction.index = index - 1;
      const { prefkey, value, store } = list[Transaction.index];
      Transaction.pause = true;
      Prefs.setComplexValue(prefkey, value, store);
      Transaction.pause = false;
      Window.reset('all', 'all');
      return true;
    }
    return false;
  },

  redo(): boolean {
    const { list, index } = Transaction;
    if (!(index >= list.length - 1)) {
      Transaction.index = index + 1;
      const { prefkey, value, store } = list[Transaction.index];
      Transaction.pause = true;
      Prefs.setComplexValue(prefkey, value, store);
      Transaction.pause = false;
      Window.reset('all', 'all');
      return true;
    }
    return false;
  },

  search(search: SearchType): void {
    Window.open({
      type: 'search',
      className: 'skin',
      allowMultiple: true,
      saveIfAppClosed: true,
      additionalArguments: { search },
      options: {
        title: `${i18n.t('menu.search')} "${search.searchtext}"`,
        width: 800,
        height: 630,
      },
    });
  },

  searchHelp() {
    Window.open({
      type: 'searchHelp',
      className: 'skin',
      fitToContent: true,
      persist: true,
      options: {
        width: 800,
        title: `${i18n.t('searchHelp.title')}`,
      },
    });
  },

  copyPassage(state?: Partial<CopyPassageState>) {
    const tab = getTab();
    const xulsword = Prefs.getComplexValue(
      'xulsword'
    ) as typeof S.prefs.xulsword;
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
    Window.open({
      type: 'copyPassage',
      notResizable: true,
      fitToContent: true,
      saveIfAppClosed: true,
      additionalArguments: { copyPassageState },
      options: {
        title: i18n.t('menu.copyPassage'),
        ...C.UI.Window.large,
      },
    });
  },

  openFontsColors(module: string): void {
    let win: BrowserWindow | null =
      BrowserWindow.fromId(arguments[1] ?? -1) ||
      getBrowserWindows({ type: 'xulsword' })[0];
    Window.open({
      type: 'chooseFont',
      notResizable: true,
      fitToContent: true,
      saveIfAppClosed: true,
      additionalArguments: {
        chooseFontState: { module },
      },
      options: {
        title: i18n.t('fontsAndColors.label'),
        parent: win || undefined,
      },
    });
    win = null;
  },

  async importBookmarks(
    paths?: string[],
    toFolder?: string | string[],
    result?: NewModulesType
  ): Promise<NewModulesType> {
    const extensions = ['json', 'xsb', 'txt'];
    let importFiles: string[] | undefined = paths;
    let callingWin: BrowserWindow | undefined = getBrowserWindows({
      type: 'xulsword',
    })[0];
    if (!paths) {
      const obj = await dialog.showOpenDialog(callingWin, {
        title: i18n.t('menu.addNewModule'),
        filters: [
          {
            name: extensions.map((x) => x.toUpperCase()).join(', '),
            extensions,
          },
        ],
        properties: ['openFile', 'multiSelections'],
      });
      if (obj) importFiles = obj.filePaths;
    }
    const r = result || clone(C.NEWMODS);
    if (importFiles && importFiles.length) {
      const rootid = S.bookmarks.manager.bookmarks.id;
      let parentFolder: string[] = importFiles.map(() => rootid);
      if (toFolder) {
        if (typeof toFolder === 'string') {
          parentFolder = importFiles.map(() => toFolder);
        } else {
          parentFolder = toFolder;
        }
      }
      const bookmarks = clone(
        Prefs.getComplexValue('manager.bookmarks', 'bookmarks')
      ) as BookmarkFolderType;
      importFiles?.forEach((path, i) => {
        const folderID = parentFolder[i] || rootid;
        const findFolder = findBookmarkItem(bookmarks, folderID);
        let folder = bookmarks;
        if (findFolder && 'childNodes' in findFolder) {
          folder = findFolder as BookmarkFolderType;
        }
        const file = new LocalFile(path);
        if (file.exists() && !file.isDirectory()) {
          const content = file.readFile();
          const fnlc = file.leafName.toLowerCase();
          if (fnlc.endsWith('.json')) {
            importBookmarkObject(JSON_parse(content), folder, r);
          } else if (fnlc.endsWith('.txt') || fnlc.endsWith('.xsb')) {
            importDeprecatedBookmarks(content, folder, r);
          }
        }
      });
      Prefs.setComplexValue('manager.bookmarks', bookmarks, 'bookmarks');
    }
    if (!result) Subscription.publish.modulesInstalled(r, callingWin.id);
    callingWin = undefined;
    return r;
  },

  async exportBookmarks(folderID?: string) {
    let xswindow: BrowserWindow | null = getBrowserWindows({
      type: 'xulsword',
    })[0];
    const extensions = ['json'];
    const obj = await dialog.showSaveDialog(xswindow, {
      title: i18n.t('to.label'),
      defaultPath: fpath.join(Dirs.path.xsProgram, 'exported-bookmarks.json'),
      filters: [
        {
          name: extensions.map((x) => x.toUpperCase()).join(', '),
          extensions,
        },
      ],
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    });
    xswindow = null;
    if (obj && !obj.canceled && obj.filePath) {
      const bookmarks = Prefs.getComplexValue(
        'manager.bookmarks',
        'bookmarks'
      ) as BookmarkFolderType;
      const folder = folderID
        ? findBookmarkItem(bookmarks, folderID)
        : bookmarks;
      if (folder && 'childNodes' in folder) {
        const file = new LocalFile(obj.filePath);
        if (file.exists()) file.remove();
        if (!file.exists()) {
          file.writeFile(JSON_stringify(folder));
        }
      }
    }
  },

  openBookmarksManager() {
    Window.open({
      type: 'bmManager',
      className: 'skin',
      persist: true,
      saveIfAppClosed: true,
      options: {
        title: i18n.t('bookmark.manager.title'),
      },
    });
  },

  // Properties for either bmPropertiesState.bookmark (properties of an existing
  // bookmark item) or newitem (properties of a new item) will be shown in the new
  // window. When newitem is provided, bmPropertiesState.bookmark is ignored. But
  // the other bmPropertiesState properties are still used to control the dialog
  // window.
  openBookmarkProperties(
    titleKey: string,
    bmPropertiesState: Partial<BMPropertiesStateWinArg>,
    newitem?: {
      location: LocationVKType | LocationGBType | null | undefined;
      module?: string;
    }
  ): void {
    let parent: BrowserWindow | undefined =
      BrowserWindow.fromId(arguments[3] ?? -1) ||
      getBrowserWindows({ type: 'xulsword' })[0] ||
      undefined;
    let bookmark: any | undefined;
    let treeSelection: any | undefined;
    let anyChildSelectable: any | undefined;
    let hide: any | undefined;
    if (bmPropertiesState) {
      ({ bookmark, treeSelection, anyChildSelectable, hide } =
        bmPropertiesState);
    }
    if (!hide) hide = [];
    Window.open({
      type: 'bmProperties',
      allowMultiple: true,
      notResizable: true,
      fitToContent: true,
      additionalArguments: {
        bmPropertiesState: {
          bookmark,
          treeSelection,
          anyChildSelectable,
          hide,
        },
        newitem,
      },
      options: {
        title: i18n.t(titleKey),
        parent,
      },
    });
    parent = undefined;
  },

  deleteBookmarkItems(itemIDs: string[]): boolean {
    const bookmarks = clone(
      Prefs.getComplexValue(
        'manager.bookmarks',
        'bookmarks'
      ) as typeof S.bookmarks.manager.bookmarks
    );
    const items = itemIDs.map((id) => DeleteBookmarkItem(bookmarks, id));
    if (items.length && !items.some((i) => i === null)) {
      Prefs.setComplexValue('manager.bookmarks', bookmarks, 'bookmarks');
      Window.reset('all', 'all');
      return true;
    }
    return false;
  },

  // itemOrID = string - REMOVE and INSERT.
  // itemOrID = object - INSERT object (which must have unique id to succeed).
  // Returns true if the move was successful.
  moveBookmarkItems(
    itemsOrIDs: string[] | (BookmarkFolderType | BookmarkType)[],
    targetID: string
  ): boolean {
    const bookmarks = clone(
      Prefs.getComplexValue(
        'manager.bookmarks',
        'bookmarks'
      ) as typeof S.bookmarks.manager.bookmarks
    );
    const moved = moveBookmarkItems(bookmarks, itemsOrIDs, targetID);
    if (moved.length && !moved.includes(null)) {
      Prefs.setComplexValue('manager.bookmarks', bookmarks, 'bookmarks');
      return true;
    }
    return false;
  },

  pasteBookmarkItems(
    cut: string[] | null,
    copy: string[] | null,
    targetID: string
  ): boolean {
    const bookmarks = clone(
      Prefs.getComplexValue(
        'manager.bookmarks',
        'bookmarks'
      ) as typeof S.bookmarks.manager.bookmarks
    );
    const pasted = PasteBookmarkItems(bookmarks, cut, copy, targetID);
    if (pasted.length && !pasted.includes(null)) {
      Prefs.setComplexValue('manager.bookmarks', bookmarks, 'bookmarks');
      return true;
    }
    return false;
  },

  openAbout(state?: Partial<AboutWinState>): void {
    const tab = getTab();
    const t =
      (state?.configs &&
        state.configs.length &&
        state.configs[0].module in tab &&
        tab[state.configs[0].module]) ||
      null;
    Window.open({
      type: 'about',
      allowMultiple: true,
      saveIfAppClosed: true,
      additionalArguments: { aboutWinState: state || {} },
      options: {
        width: 510,
        height: 425,
        title: `${i18n.t('menu.help.about')} ${(t && t.label) || ''}`,
      },
    });
  },

  goToLocationGB(
    location: LocationGBType,
    scroll?: ScrollType | undefined,
    deferAction?: boolean
  ): typeof S.prefs.xulsword {
    const xulsword = Prefs.getComplexValue(
      'xulsword'
    ) as typeof S.prefs.xulsword;
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
  ): typeof S.prefs.xulsword {
    // To go to a verse system location without also changing xulsword's current
    // versekey module requires this location be converted into the current v11n.
    const xulsword = clone(
      Prefs.getComplexValue('xulsword')
    ) as typeof S.prefs.xulsword;
    const { location } = xulsword;
    const loc = verseKey(newlocation, location?.v11n || undefined);
    const sel = newselection
      ? verseKey(newselection, location?.v11n || undefined)
      : null;
    xulsword.location = loc.location();
    xulsword.selection = sel ? sel.location() : null;
    xulsword.scroll = newscroll || { verseAt: 'center' };
    if (!deferAction) Prefs.mergeValue('xulsword', xulsword);
    return xulsword;
  },
};

export default Commands;
