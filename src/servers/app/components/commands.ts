/* eslint-disable prefer-rest-params */
import { BrowserWindow, dialog } from 'electron';
import fpath from 'path';
import log from 'electron-log';
import i18n from 'i18next';
import {
  clone,
  diff,
  findBookmarkItem,
  JSON_parse,
  JSON_stringify,
  pad,
  versionCompare,
  deleteBookmarkItem as DeleteBookmarkItem,
  pasteBookmarkItems as PasteBookmarkItems,
  moveBookmarkItems,
  gbPaths,
  randomID,
  gbQualifiedPath,
  encodeWindowsNTFSPath,
} from '../../../common.ts';
import Subscription from '../../../subscription.ts';
import C from '../../../constant.ts';
import S from '../../../defaultPrefs.ts';
import parseSwordConf from '../../parseSwordConf.ts';
import importBookmarkObject, {
  canRedo,
  canUndo,
  importDeprecatedBookmarks,
  Transaction,
} from '../../components/bookmarks.ts';
import { getTab, getAudioConfs, genBookTreeNodes } from '../../common.ts';
import verseKey from '../../verseKey.ts';
import Prefs from '../prefs.ts';
import LocalFile from '../../components/localFile.ts';
import { modalInstall, scanAudio } from './module.ts';
import Window, { getBrowserWindows, publishSubscription } from './window.ts';
import Dirs from '../../components/dirs.ts';

import type { OpenDialogSyncOptions } from 'electron';
import type ZIP from 'adm-zip';
import type {
  GAddWindowId,
  AudioPath,
  BookmarkItemType,
  GenBookAudio,
  AudioPlayerSelectionGB,
  LocationORType,
  LocationVKType,
  NewModulesType,
  OSISBookType,
  SearchType,
  AudioPlayerSelectionVK,
  LocationVKCommType,
} from '../../../type.ts';
import type {
  ControllerState,
  PrintOptionsType,
} from '../../../clients/controller.tsx';
import type { AboutWinState } from '../../../clients/app/aboutWin/aboutWin.tsx';
import type { PrintPassageState } from '../../../clients/components/printPassage/printPassage.tsx';
import type { CopyPassageState } from '../../../clients/app/copyPassageWin/copyPassageWin.tsx';
import type { SelectVKType } from '../../../clients/components/libxul/selectVK.tsx';
import type { BMPropertiesStateWinArg } from '../../../clients/app/bmPropertiesWin/bmPropertiesWin.tsx';
import RefParser from '../../../refParser.ts';
import { G } from '../G.ts';

// Prefs2 requires the calling window argument so that window -2 may be
// passed. The value -2 means the Pref changes should be pushed to all
// windows and the main process.
const Prefs2 = Prefs as GAddWindowId['Prefs'];

const Commands = {
  openModuleManager(): void {
    Window.open({
      type: 'moduleManagerWin',
      className: 'skin',
      typePersistBounds: true,
      saveIfAppClosed: true,
      options: {
        title: i18n.t('menu.addNewModule'),
        width: 800,
        height: 800,
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
    toSharedModuleDirX?: boolean,
  ): Promise<NewModulesType> {
    const toSharedModuleDir = Dirs.path.xsModsCommon && toSharedModuleDirX;
    const destDir =
      Dirs.path[toSharedModuleDir ? 'xsModsCommon' : 'xsModsUser'];
    const callingWinID: number =
      arguments[2] ?? getBrowserWindows({ type: 'xulswordWin' })[0].id;
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
      mods: Array<ZIP | string>,
      destdir?: string | string[],
      callingWinID2?: number,
    ): Promise<NewModulesType> => {
      const r: NewModulesType = clone(C.NEWMODS);
      const bookmarkMods = mods.filter(
        (m) => typeof m === 'string' && /\.(xsb|txt|json)$/i.test(m),
      ) as string[];
      if (bookmarkMods.length) {
        await this.importBookmarks(bookmarkMods, undefined, r);
      }
      const zipmods = mods.filter(
        (m) => typeof m !== 'string' || !/\.(xsb|txt|json)$/i.test(m),
      );
      if (zipmods.length) {
        await modalInstall(zipmods, destdir, callingWinID2, r);
      }
      Subscription.publish.modulesInstalled(r, callingWinID);
      return r;
    };
    if (paths) {
      // Install array of file paths
      if (Array.isArray(paths)) {
        return await modalInstall2(filter(paths), destDir, callingWinID);
      }
      // Install all modules in a directory
      if (paths.endsWith('/*')) {
        const list: string[] = [];
        const file = new LocalFile(paths.substring(0, -2));
        if (file.isDirectory()) {
          list.push(...filter(file.directoryEntries));
        }
        return await modalInstall2(list, destDir, callingWinID);
      }
      const file = new LocalFile(paths);
      // ZIP file to install
      if (!file.isDirectory()) {
        return await modalInstall2(filter([file.path]), destDir, callingWinID);
      }
      // Choose from existing directory.
      options.defaultPath = paths;
    }
    const obj = await dialog.showOpenDialog(
      getBrowserWindows({ type: 'xulswordWin' })[0],
      options,
    );
    return await modalInstall2(obj.filePaths, destDir, callingWinID);
  },

  removeModule() {
    Window.open({
      type: 'removeModuleWin',
      className: 'skin',
      typePersistBounds: true,
      saveIfAppClosed: true,
      options: {
        title: i18n.t('menu.removeModule'),
      },
    });
  },

  async exportAudio() {
    let [xswindow]: Array<BrowserWindow | null> = getBrowserWindows({
      type: 'xulswordWin',
    });
    const tab = getTab();

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
          const gbpaths: { [module: string]: GenBookAudio } = {};
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
                  bg.includes(dirs[0]),
                )
              ) {
                // Copy a VerseKey audio file...
                const book = dirs.shift();
                if (book) {
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
                    file.copyTo(dest, fp.base);
                    tot += 1;
                  }
                }
              } else {
                // Copy a GenBook audio file...
                let path: string[] = dirs.slice();
                path.push(fp.name);
                if (module in tab && tab[module].type === C.GENBOOK) {
                  if (!(module in gbpaths))
                    gbpaths[module] = gbPaths(genBookTreeNodes(module));
                  const gbps = gbpaths[module];
                  const ords = path.map((p) =>
                    Number(p.replace(/$(\d\d\d)( .*)?$/, '$1')),
                  );
                  const em = Object.entries(gbps).find(
                    (e) => !diff(e[1], ords),
                  );
                  if (em) {
                    path = gbQualifiedPath(em[0], gbps)
                      .split(C.GBKSEP)
                      .map((s) => encodeWindowsNTFSPath(s, false));
                  }
                }
                if (path.every((p) => /^\d\d\d( .*)?$/.test(p))) {
                  const leafname = path.pop();
                  const dest = destdir.clone().append('modules').append(module);
                  path.forEach((p) => dest.append(p));
                  if (!dest.exists())
                    dest.create(LocalFile.DIRECTORY_TYPE, {
                      recursive: true,
                    });
                  file.copyTo(dest, `${leafname}${fpath.parse(file.path).ext}`);
                  tot += 1;
                } else {
                  log.error(
                    `Failed to parse audio file path during export: ${file.path}`,
                  );
                }
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
    const newmods = clone(C.NEWMODS);
    let [xswindow]: Array<BrowserWindow | null> = getBrowserWindows({
      type: 'xulswordWin',
    });
    const callingWinID = xswindow.id;

    const obj = await dialog.showOpenDialog(
      getBrowserWindows({ type: 'xulswordWin' })[0],
      {
        title: i18n.t('from.label'),
        properties: ['openDirectory'],
      },
    );

    if (obj.filePaths[0]) {
      let tot = 0;
      let ctot = 0;
      const tab = getTab();
      const audioExtRE = new RegExp(`^\\.(${C.SupportedAudio.join('|')})$`);
      const refParse = new RefParser(
        Build.isElectronApp
          ? C.Locales.reduce(
              (p, c) => {
                p[c[0]] = G.getLocaleDigits(c[0]);
                return p;
              },
              {} as Record<string, string[] | null>,
            )
          : { [G.i18n.language]: G.getLocaleDigits() },
        G.getLocalizedBooks(Build.isElectronApp ? true : [G.i18n.language]),
        {
          locales: C.Locales.map((l) => l[0]),
        },
      );

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

      type CopyFilesType = [module: string, file: LocalFile, dest: string[]];
      const copyFiles = (files: CopyFilesType[]) => {
        files.forEach((f) => {
          const [module, file, dest] = f;
          const leafname = dest.pop();
          const destDir = Dirs.xsAudio.append('modules').append(module);
          while (dest.length) destDir.append(dest.shift() as string);
          if (!destDir.exists()) {
            destDir.create(LocalFile.DIRECTORY_TYPE, { recursive: true });
          }
          file.copyTo(destDir, `${leafname}${fpath.parse(file.path).ext}`);
          tot += 1;
        });
        progress(tot / importFiles.length);
      };

      const progress = (prog: number) => {
        xswindow?.setProgressBar(prog);
        xswindow?.webContents.send('progress', prog);
        if (prog === -1) xswindow = null;
      };

      const fromdir = new LocalFile(obj.filePaths[0]);
      const modules: string[] = [];

      // Import all audio in a repository or a single module directory.
      let singleModule: string | undefined;
      let importFiles: LocalFile[] = [];
      if (fromdir.directoryEntries.includes('modules')) {
        fromdir.append('modules');
        importFiles = getImportFiles(fromdir);
      } else {
        singleModule = getModule(fromdir.path.split(fpath.sep).pop());
        if (/^[A-Za-z0-9_]+$/.test(singleModule)) {
          fromdir.append('..');
          importFiles = getImportFiles(fromdir);
        } else {
          newmods.reports.push({
            error: `Import directory is not a valid module name or repository: ${fromdir.path}`,
          });
        }
      }

      let files: CopyFilesType[] = [];
      let moduleValid = false;
      let genbkPaths: GenBookAudio | null = null;
      let prependGenbkRedRoot: { ord: boolean; key: boolean } = {
        ord: false,
        key: false,
      };
      progress(0);
      try {
        importFiles.forEach((file) => {
          const fp = fpath.parse(fpath.relative(fromdir.path, file.path));
          const module = getModule(fp.dir.split(fpath.sep).shift());

          if (!modules.includes(module)) {
            // Copy each module's audio after file validation is complete.
            if (moduleValid && files.length) copyFiles(files);
            else modules.pop();
            files = [];
            moduleValid = true;
            genbkPaths = null;
            prependGenbkRedRoot = { ord: false, key: false };
            if (module in tab && tab[module].type === C.GENBOOK) {
              genbkPaths = gbPaths(genBookTreeNodes(module));
            }
            modules.push(module);
          }

          if (
            moduleValid &&
            module &&
            file &&
            audioExtRE.test(fp.ext.toLowerCase()) &&
            (!singleModule || singleModule === module)
          ) {
            const dest: string[] = [];
            const path = fp.dir.split(fpath.sep);
            path.push(fp.name);
            path.shift(); // remove module name
            // If a genbk module is installed to be validated against, the file
            // must be found in the TOC, or import is aborted with errors.
            if (genbkPaths) {
              // Fully qualified genbk path segments begin with a 3 digit number
              // followed by an optional title. If all path segments contain a
              // title, then the title is looked up in the genbk TOC (with or
              // without any redundant root). Otherwise the order is looked up
              // in the TOC (again with or without any redundant root). NOTE:
              // When a redundant root is required for validation, all keys of
              // that type will have the root prepended to them.
              const ords = path.map((p) =>
                Number(p.replace(/^(\d+).*$/, '$1')),
              );
              const keys = path.map((p) =>
                decodeURIComponent(p).replace(/^\d+ ?/, ''),
              );
              let em: [string, AudioPath] | undefined;
              if (ords.length !== keys.length) {
                newmods.reports.push({ error: `Invalid path. (${file.path})` });
                moduleValid = false;
              } else if (keys.every((k) => k)) {
                // gb key lookup
                const [kRedRoot] = Object.keys(genbkPaths);
                let k = keys.join(C.GBKSEP);
                if (prependGenbkRedRoot.key) k = kRedRoot + k;
                em = Object.entries(genbkPaths).find(
                  (e) => e[0].normalize() === k.normalize(),
                );
                if (!em) {
                  em = Object.entries(genbkPaths).find(
                    (e) => e[0].normalize() === (kRedRoot + k).normalize(),
                  );
                  if (em) prependGenbkRedRoot.key = true;
                }
                if (!em)
                  newmods.reports.push({
                    error: `'${k}' not found in general book ${module}. (${file.path})`,
                  });
              } else {
                // gb ord lookup
                const oRedRoot = 0;
                if (prependGenbkRedRoot.ord) ords.unshift(oRedRoot);
                em = Object.entries(genbkPaths).find((e) => !diff(e[1], ords));
                if (!em) {
                  ords.unshift(oRedRoot);
                  em = Object.entries(genbkPaths).find(
                    (e) => !diff(e[1], ords),
                  );
                  if (em) prependGenbkRedRoot.ord = true;
                  else
                    newmods.reports.push({
                      error: `'${ords.join('/')}' not found in general book ${module}. (${file.path})`,
                    });
                }
              }
              if (em) {
                gbQualifiedPath(em[0], genbkPaths)
                  .split(C.GBKSEP)
                  .forEach((p) => dest.push(encodeWindowsNTFSPath(p, false)));
              } else moduleValid = false;
            } else {
              // If files is not for an installed genbk, then only OSIS book,
              // chapter and order number are validated.
              let firstSub = true;
              while (moduleValid && path.length) {
                let p = path.shift();
                if (p) {
                  const pnum = Number(p.replace(/^(\d+).*?$/, '$1'));
                  const { book } = refParse.parse(p, null)?.location ?? {
                    book: '',
                  };
                  if (firstSub && book) {
                    p = book;
                  } else if (Number.isNaN(pnum)) {
                    newmods.reports.push({
                      error: `Path segment '${p}' must begin with a number. (${file.path})`,
                    });
                    moduleValid = false;
                  } else p = pad(p, 3, 0);

                  dest.push(p);
                  firstSub = false;
                } else {
                  newmods.reports.push({
                    error: `Empty path segment. (${file.path})`,
                  });
                  moduleValid = false;
                }
              }
            }
            if (moduleValid) files.push([module, file, dest]);
          }
        });
        if (files.length && moduleValid) copyFiles(files);
        else modules.pop();
      } finally {
        progress(-1);
      }

      // Find mods.d direcory if it exists.
      let modsd: LocalFile | null = null;
      modsd = fromdir.clone();
      modsd.append('..').append('mods.d');
      if (!modsd.exists()) modsd = null;

      // Update or create the config files
      const importedConfs = modsd?.directoryEntries.map((c) => {
        const cf = modsd?.clone().append(c);
        return !cf || cf.isDirectory() ? null : parseSwordConf(cf, Prefs);
      });
      const installedAudio = getAudioConfs();
      modules.forEach((module) => {
        const impconf =
          importedConfs && importedConfs.find((c) => c && c.module === module);
        const installedConf = Object.values(installedAudio).find(
          (c) => c && c.module === module,
        );
        const impcfile =
          (impconf && modsd?.clone().append(impconf.filename)) || null;
        let instcfile =
          (installedConf &&
            Dirs.xsAudio.append('mods.d').append(installedConf.filename)) ||
          null;
        const impvers = (impconf && impconf.Version) || 0;
        const instvers = (installedConf && installedConf.Version) || 0;
        const confname = `${module.toLowerCase()}.conf`;

        // Overwrite installed audio config only if the imported config is
        // a newer version. If there is no installed config, copy the imported
        // one if one exists, or create a minimal one.
        if (
          impcfile?.exists() &&
          (!instcfile?.exists() || versionCompare(impvers, instvers) === 1)
        ) {
          instcfile = Dirs.xsAudio.append('mods.d').append(confname);
          impcfile?.copyTo(Dirs.xsAudio.append('mods.d'), confname);
        } else if (!instcfile?.exists()) {
          // If necessary, auto-generate bare minimum config file
          instcfile = Dirs.xsAudio.append('mods.d').append(confname);
          instcfile.writeFile(
            `[${module}]\nModDrv=audio\nDataPath=./modules/${module}\nVersion=0.0.1\nDescription=Imported audio\nAudioChapters={}`,
          );
        }

        // Update config AudioChapters
        if (instcfile && instcfile.exists()) {
          const audioChapters = scanAudio(
            Dirs.xsAudio.path,
            `./modules/${module}`,
          );
          let str = instcfile.readFile();
          str = str.replace(
            /^AudioChapters\b.*$/m,
            `AudioChapters=${JSON_stringify(audioChapters)}`,
          );
          instcfile.writeFile(str);
          newmods.audio.push(parseSwordConf(instcfile, Prefs));
          ctot += 1;
        } else {
          newmods.reports.push({ error: `(${module}) Missing config file.` });
        }
      });
      log.info(
        `Imported ${tot} audio files out of ${importFiles.length} files`,
      );
      log.info(`Updated ${ctot} of ${modules.length} audio config files.`);
      if (modules.length) {
        Subscription.publish.modulesInstalled(newmods, callingWinID);
      }
    }

    Subscription.publish.modulesInstalled(newmods, callingWinID);
  },

  async print(print: PrintOptionsType): Promise<void> {
    await new Promise<void>((resolve) => {
      const callingWinID: number =
        arguments[1] ?? getBrowserWindows({ type: 'xulswordWin' })[0].id;
      const windowToPrint = BrowserWindow.fromId(callingWinID);
      if (windowToPrint) {
        publishSubscription<'setControllerState'>(
          'setControllerState',
          { renderers: { id: windowToPrint.id } },
          {
            reset: randomID(),
            print,
          },
        );
        const destroy = Subscription.subscribe.asyncTaskComplete(() => {
          destroy();
          resolve();
        });
      }
    });
  },

  printPassage(state?: Partial<PrintPassageState>) {
    const passageWinState: Partial<PrintPassageState> = state || {
      chapters: null,
    };
    Window.open({
      type: 'printPassageWin',
      className: 'skin',
      typePersistBounds: true,
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
    if (canUndo()) {
      Transaction.index = index - 1;
      const { prefkey, value, store } = list[Transaction.index];
      Transaction.pause = true;
      Prefs2.setComplexValue(prefkey, value, store, -2);
      Transaction.pause = false;
      Window.reset('all', 'all');
      return true;
    }
    return false;
  },

  redo(): boolean {
    const { list, index } = Transaction;
    if (canRedo()) {
      Transaction.index = index + 1;
      const { prefkey, value, store } = list[Transaction.index];
      Transaction.pause = true;
      Prefs2.setComplexValue(prefkey, value, store, -2);
      Transaction.pause = false;
      Window.reset('all', 'all');
      return true;
    }
    return false;
  },

  search(search: SearchType): void {
    Window.open({
      type: 'searchWin',
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
      type: 'searchHelpWin',
      className: 'skin',
      fitToContent: true,
      typePersistBounds: true,
      options: {
        width: 800,
        title: `${i18n.t('searchHelp.title')}`,
      },
    });
  },

  copyPassage(state?: Partial<CopyPassageState>) {
    const tab = getTab();
    const panels = Prefs.getComplexValue(
      'xulsword.panels',
    ) as typeof S.prefs.xulsword.panels;
    const location = Prefs.getComplexValue(
      'xulsword.location',
    ) as typeof S.prefs.xulsword.location;
    if (panels && location) {
      const vkMod = panels.find((p) => p && p in tab && tab[p].isVerseKey);
      const vk11n = (vkMod && tab[vkMod].v11n) || 'KJV';
      const passage: SelectVKType | null =
        location && vkMod
          ? {
              ...verseKey(location).location(vk11n),
              vkMod,
            }
          : null;
      const copyPassageState: Partial<CopyPassageState> = {
        passage,
        ...(state || undefined),
      };
      Window.open({
        type: 'copyPassageWin',
        notResizable: true,
        fitToContent: true,
        saveIfAppClosed: true,
        additionalArguments: { copyPassageState },
        options: {
          title: i18n.t('menu.copyPassage'),
          ...C.UI.Window.large,
        },
      });
    }
  },

  openFontsColors(module: string): void {
    let win: BrowserWindow | null =
      BrowserWindow.fromId((arguments[1] as number) ?? -1) ||
      getBrowserWindows({ type: 'xulswordWin' })[0];
    Window.open({
      type: 'chooseFontWin',
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
    result?: NewModulesType,
  ): Promise<NewModulesType> {
    const extensions = ['json', 'xsb', 'txt'];
    let importFiles: string[] | undefined = paths;
    let [callingWin]: Array<BrowserWindow | undefined> = getBrowserWindows({
      type: 'xulswordWin',
    });
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
    if (importFiles?.length) {
      const rootid = S.bookmarks.rootfolder.id;
      let parentFolder: string[] = importFiles.map(() => rootid);
      if (toFolder) {
        if (typeof toFolder === 'string') {
          parentFolder = importFiles.map(() => toFolder);
        } else {
          parentFolder = toFolder;
        }
      }
      const bookmarks = Prefs.getComplexValue(
        'rootfolder',
        'bookmarks',
      ) as typeof S.bookmarks.rootfolder;
      importFiles?.forEach((path, i) => {
        const folderID = parentFolder[i] || rootid;
        const findFolder = findBookmarkItem(bookmarks, folderID);
        let folder = bookmarks;
        if (findFolder && 'childNodes' in findFolder) {
          folder = findFolder;
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
      Prefs2.setComplexValue('rootfolder', bookmarks, 'bookmarks', -2);
      if (!result) Subscription.publish.modulesInstalled(r, callingWin.id);
    }
    callingWin = undefined;
    return r;
  },

  async exportBookmarks(folderID?: string) {
    let [xswindow]: Array<BrowserWindow | null> = getBrowserWindows({
      type: 'xulswordWin',
    });
    const extensions = ['json'];
    const obj = await dialog.showSaveDialog(xswindow, {
      title: i18n.t('to.label'),
      defaultPath: 'exported-bookmarks.json',
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
        'rootfolder',
        'bookmarks',
      ) as typeof S.bookmarks.rootfolder;
      const folder = folderID
        ? findBookmarkItem(bookmarks, folderID)
        : bookmarks;
      if (folder && 'childNodes' in folder) {
        const file = new LocalFile(obj.filePath);
        if (file.exists()) file.remove();
        if (!file.exists()) {
          file.writeFile(JSON_stringify(folder, 1));
        }
      }
    }
  },

  openBookmarksManager() {
    Window.open({
      type: 'bmManagerWin',
      className: 'skin',
      typePersistBounds: true,
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
      location?: LocationVKType | LocationVKCommType | LocationORType;
    },
  ): void {
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
      type: 'bmPropertiesWin',
      allowMultiple: true,
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
      },
    });
  },

  deleteBookmarkItems(itemIDs: string[]): boolean {
    const bookmarks = Prefs.getComplexValue(
      'rootfolder',
      'bookmarks',
    ) as typeof S.bookmarks.rootfolder;
    const items = itemIDs.map((id) => DeleteBookmarkItem(bookmarks, id));
    if (items.length && !items.some((i) => i === null)) {
      Prefs2.setComplexValue('rootfolder', bookmarks, 'bookmarks', -2);
      Window.reset('all', 'all');
      return true;
    }
    return false;
  },

  // itemOrID = string - REMOVE and INSERT.
  // itemOrID = object - INSERT object (which must have unique id to succeed).
  // Returns true if the move was successful.
  moveBookmarkItems(
    itemsOrIDs: string[] | BookmarkItemType[],
    targetID: string,
  ): boolean {
    const bookmarks = Prefs.getComplexValue(
      'rootfolder',
      'bookmarks',
    ) as typeof S.bookmarks.rootfolder;
    const moved = moveBookmarkItems(bookmarks, itemsOrIDs, targetID);
    if (moved.length && !moved.includes(null)) {
      Prefs2.setComplexValue('rootfolder', bookmarks, 'bookmarks', -2);
      return true;
    }
    return false;
  },

  pasteBookmarkItems(
    cut: string[] | null,
    copy: string[] | null,
    targetID: string,
  ): boolean {
    const bookmarks = Prefs.getComplexValue(
      'rootfolder',
      'bookmarks',
    ) as typeof S.bookmarks.rootfolder;
    const pasted = PasteBookmarkItems(bookmarks, cut, copy, targetID);
    if (pasted.length && !pasted.includes(null)) {
      Prefs2.setComplexValue('rootfolder', bookmarks, 'bookmarks', -2);
      return true;
    }
    return false;
  },

  openAbout(state?: Partial<AboutWinState>): void {
    const tab = getTab();
    const t =
      (state?.configs?.length &&
        state.configs[0].module in tab &&
        tab[state.configs[0].module]) ||
      null;
    Window.open({
      type: 'aboutWin',
      allowMultiple: true,
      saveIfAppClosed: true,
      additionalArguments: { aboutWinState: state || {} },
      options: {
        width: 510,
        height: 425,
        title: `${i18n.t('menu.help.about')} ${t?.label || ''}`,
      },
    });
  },
};

export default Commands;
