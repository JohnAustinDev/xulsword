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
  gbAudioPaths,
  randomID,
  gbQualifiedPath,
  encodeWindowsNTFSPath,
  modulesOfAudioCode,
} from '../../../common.ts';
import RefParser from '../../../refParser.ts';
import VerseKey from '../../../verseKey.ts';
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
import {
  getTab,
  getAudioConfs,
  genBookTreeNodes,
  scanAudio,
} from '../../common.ts';
import Prefs from '../prefs.ts';
import LocalFile from '../../components/localFile.ts';
import { modalInstall } from './module.ts';
import Window, { getBrowserWindows, publishSubscription } from './window.ts';
import Dirs from '../../components/dirs.ts';

import type { OpenDialogSyncOptions } from 'electron';
import type ZIP from 'adm-zip';
import type {
  GAddWindowId,
  AudioPath,
  BookmarkItemType,
  GenBookAudio,
  LocationORType,
  LocationVKType,
  NewModulesType,
  SearchType,
  LocationVKCommType,
  SwordConfType,
} from '../../../type.ts';
import type { PrintOptionsType } from '../../../clients/controller.tsx';
import type { AboutWinState } from '../../../clients/app/aboutWin/aboutWin.tsx';
import type { PrintPassageState } from '../../../clients/components/printPassage/printPassage.tsx';
import type { CopyPassageState } from '../../../clients/app/copyPassageWin/copyPassageWin.tsx';
import type { SelectVKType } from '../../../clients/components/libxul/selectVK.tsx';
import type { BMPropertiesStateWinArg } from '../../../clients/app/bmPropertiesWin/bmPropertiesWin.tsx';

// Prefs2 requires the calling window argument so that window -2 may be
// passed. The value -2 means the Pref changes should be pushed to all
// windows and the main process.
const Prefs2 = Prefs as GAddWindowId['Prefs'];

const Commands = {
  openModuleManager(): void {
    Window.open({
      type: 'moduleManagerWin',
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
          const moduleGbAudioPaths: { [module: string]: GenBookAudio } = {};
          audioFiles.forEach((file) => {
            const fp = fpath.parse(fpath.relative(modulesDir.path, file.path));
            const dirs = fp.dir.split(C.FSSEP);
            const audioModule = dirs.shift();
            if (audioModule) {
              // Copy config file once...
              const confname = audioConfs[audioModule].filename;
              const conf = Dirs.xsAudio.append('mods.d').append(confname);
              if (
                conf.exists() &&
                !confWritten.includes(conf.path) &&
                !conf.isDirectory()
              ) {
                const confdest = destdir.clone().append('mods.d');
                if (
                  !confdest.exists() &&
                  !confdest.create(LocalFile.DIRECTORY_TYPE)
                )
                  log.error(confdest.error);
                if (confdest.exists() && !conf.copyTo(confdest))
                  log.error(conf.error);
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
                      .append(audioModule)
                      .append(bookFileName);
                    if (
                      !dest.exists() &&
                      !dest.create(LocalFile.DIRECTORY_TYPE, {
                        recursive: true,
                      })
                    )
                      log.error(dest.error);
                    if (dest.exists()) {
                      if (file.copyTo(dest, fp.base)) {
                        tot += 1;
                      } else log.error(file.error);
                    }
                  }
                }
              } else {
                // Copy a GenBook audio file...
                let path: string[] = dirs.slice();
                path.push(fp.name);
                const [swordModule] = modulesOfAudioCode(audioModule);
                if (swordModule in tab && tab[swordModule].type === C.GENBOOK) {
                  if (!(swordModule in moduleGbAudioPaths))
                    moduleGbAudioPaths[swordModule] = gbAudioPaths(
                      genBookTreeNodes(swordModule),
                      audioConfs[audioModule].ChapterZeroIsIntro ?? false,
                    );
                  const gbps = moduleGbAudioPaths[swordModule];
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
                  const dest = destdir
                    .clone()
                    .append('modules')
                    .append(audioModule);
                  path.forEach((p) => dest.append(p));
                  if (
                    !dest.exists() &&
                    !dest.create(LocalFile.DIRECTORY_TYPE, {
                      recursive: true,
                    })
                  )
                    log.error(dest.error);
                  if (dest.exists()) {
                    if (
                      file.copyTo(
                        dest,
                        `${leafname}${fpath.parse(file.path).ext}`,
                      )
                    ) {
                      tot += 1;
                    } else log.error(file.error);
                  }
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
    if (!obj.filePaths[0]) return;

    let tot = 0;
    let ctot = 0;
    const tab = getTab();
    const audioExtRE = new RegExp(`^\\.(${C.SupportedAudio.join('|')})$`);
    const refParse = new RefParser(null, {
      locales: C.Locales.map((l) => l[0]),
    });

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
        if (
          !destDir.exists() &&
          !destDir.create(LocalFile.DIRECTORY_TYPE, { recursive: true })
        ) {
          log.error(destDir.error);
        }
        if (destDir.exists()) {
          if (
            file.copyTo(destDir, `${leafname}${fpath.parse(file.path).ext}`)
          ) {
            tot += 1;
          } else log.error(file.error);
        }
      });
      progress(tot / importFiles.length);
    };

    const progress = (prog: number) => {
      xswindow?.setProgressBar(prog);
      xswindow?.webContents.send('progress', prog);
      if (prog === -1) xswindow = null;
    };

    const fromdir = new LocalFile(obj.filePaths[0]);
    const audioModules: string[] = [];

    // Collect importFiles from a repository or a single module directory.
    let singleModule: string | undefined;
    let importFiles: LocalFile[] = [];
    if (fromdir.directoryEntries.includes('modules')) {
      fromdir.append('modules');
      importFiles = getImportFiles(fromdir);
    } else {
      singleModule = getModule(fromdir.path.split(C.FSSEP).pop());
      if (/^[A-Za-z0-9_]+$/.test(singleModule)) {
        fromdir.append('..');
        importFiles = getImportFiles(fromdir);
      } else {
        newmods.reports.push({
          error: `Import directory is not a valid module name or repository: ${fromdir.path}`,
        });
      }
    }

    // Get module list to import
    importFiles.forEach((file) => {
      const fp = fpath.parse(fpath.relative(fromdir.path, file.path));
      const module = getModule(fp.dir.split(C.FSSEP).shift());
      if (!audioModules.includes(module)) audioModules.push(module);
    });

    // Get or create the target config file for each imported audio module
    const targetConfig: { [module: string]: LocalFile | null } = {};
    let modsd: LocalFile | null = null;
    modsd = fromdir.clone();
    modsd.append('..').append('mods.d');
    if (!modsd.exists()) modsd = null;
    const importedConfs = modsd?.directoryEntries.map((c) => {
      const cf = modsd?.clone().append(c);
      return !cf || cf.isDirectory() ? null : parseSwordConf(cf);
    });
    const installedAudio = getAudioConfs();
    audioModules.forEach((audioModule) => {
      const impconf =
        importedConfs &&
        importedConfs.find((c) => c && c.module === audioModule);
      const installedConf = Object.values(installedAudio).find(
        (c) => c && c.module === audioModule,
      );
      const impcfile =
        (impconf && modsd?.clone().append(impconf.filename)) || null;
      targetConfig[audioModule] =
        (installedConf &&
          Dirs.xsAudio.append('mods.d').append(installedConf.filename)) ||
        null;
      const impvers = (impconf && impconf.Version) || 0;
      const instvers = (installedConf && installedConf.Version) || 0;
      const confname = `${audioModule.toLowerCase()}.conf`;

      // Overwrite installed audio config only if the imported config is
      // a newer version. If there is no installed config, copy the imported
      // one if one exists, or create a minimal one.
      if (
        impcfile?.exists() &&
        (!targetConfig[audioModule]?.exists() ||
          versionCompare(impvers, instvers) === 1)
      ) {
        targetConfig[audioModule] = Dirs.xsAudio
          .append('mods.d')
          .append(confname);
        if (
          impcfile &&
          !impcfile.copyTo(Dirs.xsAudio.append('mods.d'), confname)
        )
          log.error(impcfile.error);
      } else if (!targetConfig[audioModule]?.exists()) {
        // If necessary, auto-generate bare minimum config file
        targetConfig[audioModule] = Dirs.xsAudio
          .append('mods.d')
          .append(confname);
        targetConfig[audioModule].writeFile(
          `[${audioModule}]\nModDrv=audio\nDataPath=./modules/${audioModule}\nVersion=0.0.1\nDescription=Imported audio\nAudioChapters={}\nChapterZeroIsIntro=true\n`,
        );
      }
    });

    let files: CopyFilesType[] = [];
    let genbkPaths: GenBookAudio | null = null;
    let prependGenbkRedRoot: { ord: boolean; key: boolean } = {
      ord: false,
      key: false,
    };
    progress(0);
    const copied: string[] = [];
    try {
      importFiles.forEach((file) => {
        let fileValid = true;
        const fp = fpath.parse(fpath.relative(fromdir.path, file.path));
        const audioModule = getModule(fp.dir.split(C.FSSEP).shift());

        if (!copied.includes(audioModule)) {
          // Copy previous module's audio after file validation is complete.
          if (files.length) copyFiles(files);
          else copied.pop();
          // Prepare variables for next module:
          files = [];
          genbkPaths = null;
          prependGenbkRedRoot = { ord: false, key: false };
          const [swordModule] = modulesOfAudioCode(audioModule);
          if (
            swordModule &&
            targetConfig[audioModule] &&
            swordModule in tab &&
            tab[swordModule].type === C.GENBOOK
          ) {
            const { ChapterZeroIsIntro } =
              parseSwordConf(targetConfig[audioModule]) ?? {};
            genbkPaths = gbAudioPaths(
              genBookTreeNodes(swordModule),
              ChapterZeroIsIntro ?? false,
            );
          }
          copied.push(audioModule);
        }

        if (
          audioModule &&
          file &&
          audioExtRE.test(fp.ext.toLowerCase()) &&
          (!singleModule || singleModule === audioModule)
        ) {
          const dest: string[] = [];
          const path = fp.dir.split(C.FSSEP);
          path.push(fp.name);
          path.shift(); // remove module name
          // If a genbk module is installed to be validated against, the file
          // must be found in the TOC, or import is aborted with errors.
          if (genbkPaths) {
            // Fully qualified genbk path segments begin with a 3 digit number
            // followed by a title. All path segments must contain a title so
            // the title can be looked up in the genbk TOC (with or without
            // any redundant root). NOTE: When a redundant root is required
            // for validation, all keys of that type will have the root
            // prepended to them.
            const keys = path.map((p) =>
              decodeURIComponent(p).replace(/^\d+ ?/, ''),
            );
            let em: [string, AudioPath] | undefined;
            if (keys.every((k) => k)) {
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
            }
            if (em) {
              gbQualifiedPath(em[0], genbkPaths)
                .split(C.GBKSEP)
                .forEach((p) => dest.push(encodeWindowsNTFSPath(p, false)));
            }
          } else {
            // If files is not for an installed genbk, then only OSIS book,
            // chapter and order number are validated.
            let firstSub = true;
            while (fileValid && path.length) {
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
                  fileValid = false;
                } else p = pad(p, 3, 0);

                dest.push(p);
                firstSub = false;
              } else {
                newmods.reports.push({
                  error: `Empty path segment. (${file.path})`,
                });
                fileValid = false;
              }
            }
          }
          if (fileValid) files.push([audioModule, file, dest]);
        }
      });
      if (files.length) copyFiles(files);
      else copied.pop();
    } finally {
      progress(-1);
    }

    copied.forEach((audioModule) => {
      if (targetConfig[audioModule]) {
        // Update config AudioChapters
        if (audioModule in targetConfig && targetConfig[audioModule].exists()) {
          const audioChapters = scanAudio(
            Dirs.xsAudio.path,
            `./modules/${audioModule}`,
          );
          let str = targetConfig[audioModule].readFile();
          str = str.replace(
            /^AudioChapters\b.*$/m,
            `AudioChapters=${JSON_stringify(audioChapters)}`,
          );
          targetConfig[audioModule].writeFile(str);
          const instconf = parseSwordConf(targetConfig[audioModule]);
          if (instconf) {
            newmods.audio.push(instconf);
            ctot += 1;
          } else {
            newmods.reports.push({
              error: `(${audioModule}) New config file was not parseable.`,
            });
          }
        } else {
          newmods.reports.push({
            error: `(${audioModule}) Missing config file.`,
          });
        }
      }
    });

    log.info(`Imported ${tot} audio files out of ${importFiles.length} files`);
    log.info(`Updated ${ctot} of ${audioModules.length} audio config files.`);
    if (audioModules.length) {
      Subscription.publish.modulesInstalled(newmods, callingWinID);
    }
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
          true,
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
              ...new VerseKey(location, null).location(vk11n),
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
