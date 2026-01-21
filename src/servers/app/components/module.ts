/* eslint-disable prefer-rest-params */
import fpath from 'path';
import { BrowserWindow } from 'electron';
import ZIP from 'adm-zip';
import log from 'electron-log';
import {
  clone,
  downloadKey,
  isRepoLocal,
  JSON_stringify,
  randomID,
  versionCompare,
  pad,
  unknown2String,
  resolveTemplateURL,
  encodeWindowsNTFSPath,
} from '../../../common.ts';
import Subscription from '../../../subscription.ts';
import C from '../../../constant.ts';
import {
  CipherKeyModules,
  normalizeZipEntry,
  scanAudio,
} from '../../common.ts';
import parseSwordConf from '../../parseSwordConf.ts';
import DiskCache from '../../components/diskcache.ts';
import LocalFile from '../../components/localFile.ts';
import Dirs from '../../components/dirs.ts';
import LibSword, { moduleUnsupported } from '../../components/libsword.ts';
import {
  getFile,
  getDir,
  getFileHTTP,
  getFiles,
  getListing,
  untargz,
  ftpCancelableInit,
  failCause,
  ftpThrowIfCanceled,
  downloadCancel,
  logid,
  httpThrowIfCanceled,
  resetAll,
} from '../ftphttp.ts';
import Window, { getBrowserWindows } from './window.ts';

import type {
  CipherKey,
  Download,
  FTPDownload,
  NewModulesType,
  Repository,
  RepositoryListing,
  SwordConfType,
  GenBookAudioConf,
  VerseKeyAudioConf,
  OSISBookType,
  RepositoryOperation,
  NewModuleReportType,
} from '../../../type.ts';
import type { ListingElementR } from '../ftphttp.ts';

// CrossWire SWORD Standard TODOS:
// TODO CrossWire wiki mentions LangSortOrder! Report change to KeySort
// TODO CrossWire Eusebian_vs and Eusebian_num share a single conf file.
// Support this?

// Return a path beginning with 'modules' to a specific module's
// installation directory by interpereting a SWORD DataPath config entry value.
export function confModulePath(aDataPathx: string): string | null {
  const aDataPath = aDataPathx.replace(/[/\\]/g, fpath.posix.sep);
  if (!aDataPath || !aDataPath.startsWith(`.${fpath.posix.sep}modules`))
    return null;
  const dataPath = aDataPath.substring(2);
  const subs = dataPath.split(fpath.posix.sep);
  let modDir = 4;
  if (['devotionals', 'glossaries'].includes(subs[3])) modDir = 5;
  if (subs.length === modDir) return subs.join(fpath.posix.sep);
  if (subs.length > modDir) return subs.slice(0, modDir).join(fpath.posix.sep);
  return null;
}

// Move, remove or copy one or more SWORD modules. Returns true for each module
// successfully handled, otherwise false. If toPath is falsy, the operation
// is 'remove', if copy is false the operation is 'move', otherwise it is
// 'copy'. If toPath does not exist, the operations fail (it will not be
// created). If moveTo is set, the removed modules will
// be copied to moveTo if moveTo exists. If it does not exist, nothing
// will be done and 0 is returned. If the copy destination fails to
// delete, or the copy fails, the source module will not be deleted. If
// the entire module cannot be deleted (conf file and data directory)
// the module is left as it was before the delete operation.
// NOTE: audio modules only and always exist in the xsAudio directory
// and cannot be moved.
// NOTE: LibSword can be ready upon entering this function, but it will
// be quit before modules are removed, then other functions are responsible
// for restarting it.
export function moveRemoveCopyModules(
  modules: string,
  fromPath: string,
  toPath?: string,
  copy?: boolean,
): boolean;
export function moveRemoveCopyModules(
  modules: string[],
  fromPath: string,
  toPath?: string,
  copy?: boolean,
): boolean[];
export function moveRemoveCopyModules(
  modules: string | string[],
  fromPath: string, // if the following arg is falsy, operation is 'remove'
  toPath?: string, // if the following arg is falsy, operation is 'move'
  copy?: boolean, // if no args are falsy, operation is 'copy'
): boolean | boolean[] {
  const operation = !toPath ? 'remove' : !copy ? 'move' : 'copy';
  let moveToOrCopyTo = (toPath && new LocalFile(toPath)) || null;
  if (
    moveToOrCopyTo &&
    (!moveToOrCopyTo.exists() || !moveToOrCopyTo.isDirectory())
  )
    moveToOrCopyTo = null;
  if (toPath && moveToOrCopyTo === null) {
    log.error(`Destination does not exist '${toPath}'.`);
    return Array.isArray(modules) ? modules.map(() => false) : false;
  }
  if (toPath && fromPath === Dirs.path.xsAudio) {
    log.error(`Cannot move audio '${toPath}'.`);
    return Array.isArray(modules) ? modules.map(() => false) : false;
  }
  if (LibSword.isReady()) LibSword.quit();

  // Scan source repository config files, to find our module names.
  const moddir = new LocalFile(fromPath);
  moddir.append('mods.d');
  const confs = moddir.directoryEntries.map((c) => {
    const confFile = moddir.clone().append(c);
    if (!confFile.isDirectory() && confFile.path.endsWith('.conf')) {
      return parseSwordConf(confFile);
    }
    return null;
  });

  const results = (Array.isArray(modules) ? modules : [modules]).map((m) => {
    const conf = confs.find((c) => c && c.module === m);
    if (!conf) return !moveToOrCopyTo;
    const confFile = moddir.clone().append(conf.filename);
    // If we're moving or copying, delete any destination module first, and
    // abort if that fails.
    if (
      ['move', 'copy'].includes(operation) &&
      !(moveToOrCopyTo && moveRemoveCopyModules(m, moveToOrCopyTo.clone().path))
    ) {
      return false;
    }

    // Keep contents of conf file, so it can be restored in case module
    // delete fails.
    const conftext = confFile.readFile();

    // Copy config file if requested.
    let toConfFile;
    if (['move', 'copy'].includes(operation) && moveToOrCopyTo) {
      const tomodsd = moveToOrCopyTo.clone().append('mods.d');
      // copyTo will report error if this fails
      tomodsd.create(LocalFile.DIRECTORY_TYPE);
      if (!confFile.copyTo(tomodsd)) {
        log.error(confFile.error);
        return false;
      }
      toConfFile = tomodsd.append(confFile.leafName);
      if (!toConfFile.exists()) {
        return false;
      }
    }

    // Delete original config file if requested.
    if (['move', 'remove'].includes(operation)) {
      confFile.remove();
      if (confFile.exists()) {
        return false;
      }
    }

    // Remove audio module content, if requested.
    if (operation === 'remove' && fromPath === Dirs.path.xsAudio) {
      const audiodir = new LocalFile(fromPath);
      audiodir.append('modules').append(conf.module);
      if (audiodir.isDirectory()) {
        audiodir.remove(true);
      }
      if (audiodir.exists()) {
        if (!confFile.exists() && conftext) {
          try {
            confFile.writeFile(conftext);
          } catch (er) {
            log.error(er);
          }
        }
        return false;
      }
    } else {
      // Handle other module content
      const modulePath = confModulePath(conf.DataPath);
      if (!modulePath) {
        if (!confFile.exists()) {
          try {
            confFile.writeFile(conftext);
          } catch (er) {
            log.error(er);
          }
        }
        return false;
      }

      const from = new LocalFile(fromPath);
      from.append(modulePath);

      // Copy module content, if requested
      if (['move', 'copy'].includes(operation) && moveToOrCopyTo) {
        const to = moveToOrCopyTo.clone();
        const dirs = modulePath.split(fpath.posix.sep).filter(Boolean);
        dirs.pop();
        dirs.forEach((sub) => {
          to.append(sub);
          if (!to.exists() && !to.create(LocalFile.DIRECTORY_TYPE)) {
            log.error(to.error);
            return false;
          }
        });
        if (!from.copyTo(to, null, true)) {
          log.error(from.error);
          return false;
        }
        if (!to.append(from.leafName).exists()) {
          // Don't leave a half moved module, then abort.
          toConfFile?.remove();
          return false;
        }
      }

      // Remove original module content, if requested
      if (['move', 'remove'].includes(operation)) {
        if (from.exists()) from.remove(true);
        if (from.exists()) {
          // The source module may have been partially deleted, but at least
          // be sure the config file is there, and report the failure.
          if (!confFile.exists() && conftext) {
            try {
              confFile.writeFile(conftext);
            } catch (er) {
              log.error(er);
            }
          }
          return false;
        }
      }
    }
    DiskCache.delete(null, m);
    return true;
  });

  return Array.isArray(modules) ? results : results[0];
}

// Install an array of xulsword module zip objects. Errors will be
// reported via NewModulesType (not thrown) if there are problems
// to report during installation. Progress will be sent via IPC to
// the xulsword window. NOTE: destdir will be ignored when installing
// xulsword specific module components. NOTE-2: This function does not
// require LibSword. If it's running, LibSword will be quit before
// modules are installed then another function is responsible for
// restarting it.
export async function installZIPs(
  zips: ZIP[],
  destdirs?: string | string[],
  callingWinID?: number,
): Promise<NewModulesType> {
  return await new Promise((resolve) => {
    const newmods: NewModulesType = clone(C.NEWMODS);
    if (zips.length) {
      // Get installed modules (to remove any obsoleted modules).
      const installed: Array<{
        module: string;
        repoDir: string;
        CipherKey: string | undefined;
      }> = [];
      const readRepoConfFiles = (modsd: LocalFile) => {
        modsd.directoryEntries.forEach((confFile) => {
          const file = modsd.clone().append(confFile);
          if (!file.isDirectory && file.leafName.endsWith('.conf')) {
            const conf = parseSwordConf(file);
            if (conf) {
              const { module, CipherKey } = conf;
              installed.push({
                module,
                CipherKey,
                repoDir: modsd.append('..').path,
              });
            }
          }
        });
      };
      readRepoConfFiles(Dirs.xsModsUser.append('mods.d'));
      if (Dirs.path.xsModsCommon)
        readRepoConfFiles(Dirs.xsModsCommon.append('mods.d'));

      if (LibSword.isReady()) LibSword.quit();

      // Initialize progress reporter
      let progTot = 0;
      let progNow = 0;
      const progress = (prog: number) => {
        let w = BrowserWindow.fromId(callingWinID ?? -1);
        if (w) {
          w.setProgressBar(prog);
          w.webContents.send('progress', prog);
          w = null;
        }
      };
      progress(0);
      zips.forEach((zip) => {
        progTot += zip.getEntryCount();
      });
      // Process each zip file.
      zips.forEach((zip, i) => {
        let destdir = Dirs.path.xsModsUser;
        if (typeof destdirs === 'string') {
          destdir = destdirs;
        } else if (Array.isArray(destdirs)) {
          destdir = destdirs[i];
        }
        const zipEntries = zip.getEntries();
        const sortedZipEntries = zipEntries.sort((a, b) => {
          const ac = a.name.endsWith('.conf');
          const bc = b.name.endsWith('.conf');
          if (ac && !bc) return -1;
          if (!ac && bc) return 1;
          return 0;
        });
        const confs = {} as Record<string, SwordConfType>;
        sortedZipEntries.forEach((entry) => {
          const { entryName, name } = normalizeZipEntry(entry);
          if (!entryName.endsWith(fpath.posix.sep)) {
            log.silly(`Processing Entry: ${entryName}, ${name}`);
            const type = entryName.split(fpath.posix.sep).shift();
            switch (type) {
              case 'mods.d': {
                const confstr = entry.getData().toString('utf8');
                const dest = new LocalFile(
                  /^ModDrv\s*=\s*audio\b/m.test(confstr)
                    ? Dirs.path.xsAudio
                    : destdir,
                );
                const conf = parseSwordConf({
                  confString: confstr,
                  filename: name,
                  sourceRepository: dest.path,
                });
                const modreports: NewModuleReportType[] = [];
                if (conf) {
                  // Look for any problems with the module itself
                  modreports.push(...clone(conf.reports));
                  modreports.push(...moduleUnsupported(conf));
                  const swmodpath =
                    conf.xsmType === 'XSM_audio'
                      ? 'XSM_audio'
                      : conf.DataPath && confModulePath(conf.DataPath);
                  if (!swmodpath) {
                    modreports.push({
                      warning: `(${conf.module}) Has non-standard module path '${conf.DataPath}'.`,
                    });
                  }
                  if (!dest.exists() || !dest.isDirectory()) {
                    modreports.push({
                      error: `(${conf.module}) Destination directory does not exist '${dest.path}.`,
                    });
                  }
                  // If the module requires a CipherKey, don't replace an existing encrypted
                  // module that has a key.
                  if (
                    conf.CipherKey === '' &&
                    installed.find(
                      (mo) =>
                        mo.CipherKey !== '' && mo.CipherKey !== C.NOTFOUND,
                    )
                  ) {
                    modreports.push({
                      error: `(${conf.module}) Will not replace encrypted module; new encrypted module has no encrpytion key.`,
                    });
                  }
                  // If module is ok, prepare target config location and look for problems there
                  const confdest = dest.clone();
                  if (!modreports.some((r) => r.error)) {
                    confdest.append('mods.d');
                    if (
                      !confdest.exists() &&
                      !confdest.create(LocalFile.DIRECTORY_TYPE)
                    )
                      modreports.push({
                        error: `(${conf.module}) Could not create mods.d directory '${confdest.path}' (${confdest.error}).`,
                      });
                    confdest.append(name);
                    if (!modreports.some((r) => r.error) && confdest.exists()) {
                      if (swmodpath === 'XSM_audio') {
                        // Audio is not treated as a single module but as an updatable set of audio
                        // files so just delete the conf file and it will be overwritten by the new.
                        confdest.remove();
                      } else {
                        // Remove any existing module having this name unless it would be downgraded.
                        const existing = parseSwordConf(confdest);
                        if (
                          existing &&
                          versionCompare(
                            conf.Version ?? 0,
                            existing.Version ?? 0,
                          ) === -1
                        ) {
                          modreports.push({
                            error: `(${conf.module}) ${
                              conf.Version ?? 0
                            } Will not overwrite newer module ${
                              existing.module
                            }.`,
                          });
                        } else if (
                          !moveRemoveCopyModules(conf.module, destdir)
                        ) {
                          modreports.push({
                            error: `(${conf.module}) Could not remove existing module.`,
                          });
                        }
                      }
                    }
                  }
                  // If module and target is ok, check valid swmodpath, remove obsoletes,
                  // create module directory path.
                  if (
                    !modreports.some((r) => r.error) &&
                    swmodpath &&
                    swmodpath !== 'XSM_audio'
                  ) {
                    // Remove any module(s) obsoleted by this module.
                    if (conf.Obsoletes?.length) {
                      const obsoletes = conf.Obsoletes.filter((m) => {
                        return installed.find((ins) => ins.module === m);
                      });
                      obsoletes.forEach((om) => {
                        const omdir = installed.find(
                          (ins) => ins.module === om,
                        );
                        if (
                          omdir &&
                          !moveRemoveCopyModules(om, omdir.repoDir)
                        ) {
                          modreports.push({
                            warning: `(${conf.module}) Could not remove obsoleted module(s).`,
                          });
                        }
                      });
                    }
                    // Make sure module destination directory exists and is empty.
                    const moddest = dest.clone();
                    moddest.append(swmodpath);
                    if (moddest.exists()) {
                      moddest.remove(true);
                    }
                    if (moddest.exists())
                      modreports.push({
                        error: `(${conf.module}) Could not remove directory '${moddest.path}'.`,
                      });
                    if (
                      !moddest.create(LocalFile.DIRECTORY_TYPE, {
                        recursive: true,
                      })
                    ) {
                      modreports.push({
                        error: `(${conf.module}) Could not create module directory '${moddest.path}' (${moddest.error}).`,
                      });
                    }
                  }
                  // If still ok, copy config file etc.
                  if (!modreports.some((r) => r.error)) {
                    confdest.writeFile(confstr);
                    confs[conf.module] = conf;
                    newmods.modules.push(conf);
                    if (conf.CipherKey === '') {
                      newmods.nokeymods.push(conf);
                    }
                  }
                } else {
                  modreports.push({
                    error: `(unknown) Failed to parse config file.`,
                  });
                }
                newmods.reports.push(...modreports);
                break;
              }

              case 'modules': {
                const conf = Object.values(confs).find((c) => {
                  const swmodpath = confModulePath(c.DataPath);
                  return (
                    swmodpath &&
                    entryName.startsWith(`${swmodpath}${fpath.posix.sep}`)
                  );
                });
                const swmodpath = conf && confModulePath(conf.DataPath);
                if (conf && swmodpath) {
                  const moddest = new LocalFile(destdir);
                  moddest.append(swmodpath);
                  // If this module is to be installed, the destination directory has already been
                  // succesfully created, otherwise silently skip.
                  if (moddest.exists()) {
                    const parts = entryName
                      .substring(swmodpath.length + 1)
                      .split(fpath.posix.sep);
                    parts.forEach((p, ix) => {
                      moddest.append(p);
                      if (ix === parts.length - 1) {
                        moddest.writeFile(entry.getData());
                      } else if (!moddest.exists()) {
                        moddest.create(LocalFile.DIRECTORY_TYPE);
                      }
                    });
                    if (!moddest.exists()) {
                      newmods.reports.push({
                        error: `(${conf.module}) Failed to create module file '${moddest.path}' (${moddest.error}).`,
                      });
                    }
                  } else {
                    // This error was already reported during config file copy
                  }
                  // Silently drop module contents whose config was rejected.
                }
                break;
              }

              case 'fonts': {
                const fontsdir = Dirs.xsFonts;
                fontsdir.append(name);
                fontsdir.writeFile(entry.getData());
                newmods.fonts.push(name);
                break;
              }

              case 'bookmarks': {
                const bmdir = Dirs.xsBookmarks;
                bmdir.append(name);
                bmdir.writeFile(entry.getData());
                newmods.bookmarks.push(name);
                break;
              }

              case 'audio': {
                // Deprecated paths:
                // audio/<lang-code>/<audio-code>/<book>/001.mp3
                // audio/<lang-code>/<audio-code>/001 Title/001.mp3
                //
                // Current paths:
                // audio/<audio-code>/<book>/001.mp3 (000.mp3 is book introduction)
                // audio/<audio-code>/000 title/.../000 title.mp3
                //
                // NOTES:
                // - Deprecated directory and file names are 3 digit ordinal only, but
                // new directory and file names are fully qualified paths.
                // - Deprecated system is detected if <lang-code> is present in the path.
                // Converting from deprecated to new:
                // - Verse-key systems are the same, just remove the lang-code.
                // - General-book also needs lang-code removed from path, plus it needs a
                // 000 root directory inserted, to match what is actually in Children's
                // Bible SWORD modules (the only SWORD GenBook audio published so far).
                //
                // - Chapter indexes start at 1, with 0 being introduction, except for
                //   genbk modules WITHOUT ChapterZeroIsIntro = true.
                // - But for genbk modules WITHOUT ChapterZeroIsIntro = true,
                //   introduction audio was supposed to be the nnn.mp3 sibling of the
                //   nnn parent directory, but this has not been implented in xulsword
                //   since all current audio repos use ChapterZeroIsIntro = true.
                const audio = Dirs.xsAudio;
                const pobj = fpath.posix.parse(
                  encodeWindowsNTFSPath(entryName, true),
                );
                const dirs = pobj.dir.split(fpath.posix.sep);
                const chapter = Number(pobj.name.replace(/^(\d+).*?$/, '$1'));
                dirs.shift(); // remove ./audio
                let [audioCode] = dirs;
                // For some reason path-audioCode case might not always
                // match what is in the conf file, so use the conf file value.
                const conf = Object.values(confs).pop();
                if (conf) audioCode = conf.module;
                dirs[0] = audioCode;
                dirs.unshift('modules');
                const [, , bookOrSub] = dirs;
                const isVerseKey = Object.values(C.SupportedBooks).some(
                  (bg: any) => bg.includes(bookOrSub),
                );
                // Create parent directories
                while (dirs.length) {
                  const subname = dirs.shift() as string;
                  audio.append(subname);
                  if (!audio.exists()) {
                    audio.create(LocalFile.DIRECTORY_TYPE);
                  }
                }
                if (audio.exists()) {
                  if (isVerseKey && audioCode) {
                    const book = bookOrSub as OSISBookType;
                    // VerseKey audio file...
                    if (audioCode && book && !Number.isNaN(chapter)) {
                      audio.append(pad(chapter, 3, 0) + pobj.ext);
                      audio.writeFile(entry.getData());
                    } else audioCode = '';
                  } else if (audioCode) {
                    // GenBook audio file...
                    audio.append(pobj.base);
                    audio.writeFile(entry.getData());
                  }
                  // Modify the config file to show currently installed audio.
                  if (audioCode && conf) {
                    const confFile = Dirs.xsAudio;
                    confFile.append('mods.d');
                    confFile.append(conf.filename);
                    if (confFile.exists()) {
                      const dataPath = `./modules/${audioCode}`;
                      let str = confFile.readFile();
                      str = str.replace(
                        /^DataPath\b.*$/m,
                        `DataPath=${dataPath}`,
                      );
                      const audioChapters = scanAudio(
                        Dirs.xsAudio.path,
                        dataPath,
                      );
                      str = str.replace(
                        /^AudioChapters\b.*$/m,
                        `AudioChapters=${JSON_stringify(audioChapters)}`,
                      );
                      confFile.writeFile(str);
                      const nconf = parseSwordConf(confFile);
                      if (nconf) {
                        const index = newmods.audio.findIndex(
                          (c) => c.module === nconf.module,
                        );
                        if (index === -1) newmods.audio.push(nconf);
                        else newmods.audio[index] = nconf;
                      } else {
                        newmods.reports.push({
                          error: `(${conf.module}) New config file was not parseable: ${confFile.leafName}.`,
                        });
                      }
                    }
                  }
                } else {
                  newmods.reports.push({
                    error: `(${conf?.module}) Audio path failure: ${audio.error}.`,
                  });
                }
                break;
              }

              case 'chrome':
              case 'locale':
              case 'video':
                // No longer supported, just ignore without error...
                break;

              default:
                newmods.reports.push({
                  warning: `Unknown module component ${name}.`,
                });
            }
          }
          progNow += 1;
          const prog = progNow / progTot;
          if (Math.floor(100 * prog) % 2 === 0) progress(prog);
        });
      });
      progress(-1);
    }
    resolve(newmods);
  });
}

// Install an array of zip modules from either filepaths or ZIP objects.
// When destdir is unspecified, xsModsUser is used.
// Module installation requirements:
// 1) All windows must be set to modal before calling modalInstall() or
//    moveRemoveModule().
// 2) Inside installZIPs or moveRemoveModule LibSword.quit() happens.
// 3) Modules are removed, moved and/or installed, and progress is reported to
//    callingWin.
// 4) 'modulesInstalled' subscription is run on the main process to start LibSword,
//    updateGlobalModulePrefs, and update xulsword main menu.
// 5) Windows are all reloaded, for CSS and search-options etc. to get updated.
// 6) When the callingWin sends did-finish-render to the main process, then the
//   'modulesInstalled' subscription is run on the callingWin window, where
//    errors/warnings are reported and new modules may be shown etc.
export async function modalInstall(
  zipmods: Array<ZIP | string>,
  destdir?: string | string[],
  callingWinID?: number,
  result?: NewModulesType,
): Promise<NewModulesType> {
  const r: NewModulesType = result || clone(C.NEWMODS);
  if (zipmods.length) {
    Window.modal([
      { modal: 'transparent', window: 'all' },
      { modal: 'darkened', window: { id: callingWinID } },
    ]);
    const zips: Array<ZIP | null> = [];
    zipmods.forEach((zipmod) => {
      if (typeof zipmod === 'string') {
        const zipfile = new LocalFile(zipmod);
        if (zipfile.exists()) {
          zips.push(new ZIP(zipmod));
        } else {
          log.warn(`Zip module does not exist: '${zipfile.path}'.`);
          zips.push(null);
        }
      } else {
        zips.push(zipmod);
      }
    });
    const z = zips.filter(Boolean) as ZIP[];
    const d = Array.isArray(destdir)
      ? destdir.filter((_d, i) => zips[i])
      : destdir;
    mergeNewModules(r, await installZIPs(z, d, callingWinID));
  }
  if (!result) Subscription.publish.modulesInstalled(r, callingWinID);
  return r;
}

// Append entries of 'b' to 'a'. So 'a' is modified in place, while 'b'
// is untouched.
function mergeNewModules(a: NewModulesType, b: NewModulesType) {
  Object.entries(b).forEach((entry) => {
    const [kx, vx] = entry;
    const k = kx as keyof typeof C.NEWMODS;
    const v = vx as any;
    a[k].push(...v);
  });
}

type DownloadRepoConfsType = {
  module: string;
  strconf: string;
  conf: SwordConfType;
} | null;

async function repoConfigs(
  manifest: FTPDownload,
  cancelkey: string,
  progress?: (p: number) => void,
): Promise<DownloadRepoConfsType[]> {
  const repositoryConfs: DownloadRepoConfsType[] = [];
  let files: Array<{ header: { name: string }; content: Buffer }> = [];
  try {
    const targzbuf = await getFile(
      manifest.domain,
      fpath.posix.join(manifest.path, manifest.file),
      cancelkey,
      progress,
    );
    files = await untargz(targzbuf);
  } catch (er) {
    // If there was no SwordRepoManifest, then download every conf file.
    let listing: ListingElementR[] | null = null;
    let bufs: Buffer[] | null = null;
    try {
      if (!/Could not get file size/i.test(unknown2String(er, ['message'])))
        throw er;
      listing = await getListing(
        manifest.domain,
        fpath.posix.join(manifest.path, 'mods.d'),
        cancelkey,
        '',
        1,
      );
      bufs = await getFiles(
        manifest.domain,
        listing.map((l) => fpath.posix.join(manifest.path, 'mods.d', l.name)),
        cancelkey,
        progress,
      );
      bufs.forEach((b, i) => {
        if (files && listing) {
          files.push({ header: { name: listing[i].name }, content: b });
        }
      });
    } catch (err: any) {
      if (progress) progress(-1);
      return await Promise.reject(err);
    }
  }
  files.forEach((r) => {
    const { header, content: buffer } = r;
    if (header.name.endsWith('.conf')) {
      const strconf = buffer.toString('utf8');
      let rconf = null as DownloadRepoConfsType;
      const conf = parseSwordConf({
        confString: strconf,
        filename: header.name.replace(/^.*?mods\.d[/\\]/, ''),
        sourceRepository: manifest,
      });
      if (conf) {
        const { module } = conf;
        rconf = { strconf, conf, module };
      }
      repositoryConfs.push(rconf);
      /*
      if (conf.module === 'Kapingamarangi') {
        log.info('Kapingamarangi: ', rconf.raw);
      }
      */
    }
  });
  return repositoryConfs;
}

const DownloadModuleZips = {
  ongoing: {} as Record<string, Promise<ZIP | string> | undefined>,
  finished: {} as Record<string, ZIP>,
};

function logdls() {
  const ongoing = Object.keys(DownloadModuleZips.ongoing);
  const example = ongoing.slice(-5).map((x) => logid(x));
  return `ongoing=${ongoing.length}${
    example.length ? `(${example.join(', ')})` : ''
  } finished=${Object.keys(DownloadModuleZips.finished).length}`;
}

const Module = {
  // Return a promise for the CrossWire master repository list as an
  // array of Download objects. These can be passed to repositoryListing()
  // for retrieval of each repository's complete set of config files. A
  // string is returned if there were errors or the operation was canceled.
  async crossWireMasterRepoList(): Promise<Repository[] | string> {
    const mr: FTPDownload = {
      type: 'ftp',
      domain: 'ftp.crosswire.org',
      path: fpath.posix.join('pub', 'sword'),
      file: 'masterRepoList.conf',
      name: 'CrossWire Master List',
    };
    const cancelkey = downloadKey(mr);
    if (ftpCancelableInit(cancelkey)) return C.UI.Manager.cancelMsg;
    const result: Repository[] | string = [];
    let fbuffer: Buffer;
    try {
      fbuffer = await getFile(
        mr.domain,
        fpath.posix.join(mr.path, mr.file),
        cancelkey,
      );
    } catch (er: any) {
      return er.message;
    }
    const entry = fbuffer
      .toString('utf8')
      .split(/[\n\r]+/)
      .filter((str) => !str.startsWith('#'));
    entry.forEach((mx: string) => {
      const m = mx.match(/FTPSource=([^|]+)\|([^|]+)\|([^|]+)\s*/);
      if (m) {
        result.push({
          name: m[1],
          domain: m[2],
          path: m[3],
        });
      }
    });
    return result;
  },

  // Takes an array of local and remote SWORD or XSM repository manifest
  // Download objects and returns a mapped array containing:
  // - SwordConfType object array if SwordRepoManifest or config files were found.
  // - Or a string error message if there was an error or was canceled.
  // - Or null if the repository was null or disabled.
  // Progress on each repository is separately reported to the calling
  // window, but results are not returned until all repositories have
  // been completely handled.
  async repositoryListing(
    manifests: Array<FTPDownload | null>,
  ): Promise<Array<RepositoryListing | string>> {
    const callingWinID = (arguments[1] as number) ?? -1;

    let threshProgress = 0;
    let done = false;
    const progress = (dlkey: string, prog: number) => {
      if (prog === 0) {
        threshProgress = 0;
        done = false;
      }
      if (!done && (Math.abs(prog) === 1 || prog >= threshProgress)) {
        const w = BrowserWindow.fromId(callingWinID);
        w?.webContents.send('progress', prog, dlkey);
        threshProgress = prog + 5;
        done = prog === -1;
      }
    };

    // Get an array of Promises that will progress in parallel.
    const promises: Array<Promise<RepositoryListing | string>> = manifests.map(
      async (manifest) => {
        if (manifest) {
          const cancelkey = downloadKey(manifest);
          progress(cancelkey, 0);
          // LOCAL repository conf files
          if (isRepoLocal(manifest)) {
            if (fpath.isAbsolute(manifest.path)) {
              const modsd = new LocalFile(manifest.path).append('mods.d');
              if (modsd.exists() && modsd.isDirectory()) {
                const confs: SwordConfType[] = [];
                modsd.directoryEntries.forEach((de) => {
                  const f = modsd.clone().append(de);
                  if (!f.isDirectory() && f.path.endsWith('.conf')) {
                    const conf = parseSwordConf(f);
                    if (conf) confs.push(conf);
                  }
                });
                return await Promise.resolve(confs);
              }
              return await Promise.resolve(
                `Directory not found: ${manifest.path}/mods.d`,
              );
            }
            return await Promise.resolve(
              `Path not absolute: ${manifest.path}/mods.d`,
            );
          }

          // REMOTE repository conf files.
          if (ftpCancelableInit(cancelkey)) {
            return await Promise.resolve(
              failCause(manifest, C.UI.Manager.cancelMsg),
            );
          }
          let repconfs: DownloadRepoConfsType[];
          try {
            repconfs = await repoConfigs(manifest, cancelkey, (prog) => {
              progress(cancelkey, prog);
            });
          } catch (er) {
            return await Promise.resolve(
              failCause(manifest, unknown2String(er, ['message'])),
            );
          }
          try {
            ftpThrowIfCanceled(cancelkey);
          } catch (er) {
            return await Promise.resolve(
              failCause(manifest, C.UI.Manager.cancelMsg),
            );
          }
          return await Promise.resolve(
            repconfs.filter((rc) => rc).map((rc) => rc?.conf as SwordConfType),
          );
        }
        return null;
      },
    );
    // Wait for all Promises to be settled before returning any repo data.
    return await Promise.allSettled(promises)
      .then((results) => {
        const ret: Array<RepositoryListing | string> = [];
        results.forEach((result) => {
          if (result.status === 'fulfilled')
            ret.push(result.value as RepositoryListing);
          else ret.push(result.reason.toString() as string);
        });
        return ret;
      })
      .catch((er) => {
        log.error(er);
        return [];
      })
      .finally(() => {
        manifests.forEach((man) => {
          if (man) progress(downloadKey(man), -1);
        });
      });
  },

  // Download an array of SWORD modules and save them as zip objects for later
  // installation by installDownload. Returns the number of files in each zip
  // if successful, or a string error/cancel message otherwise.
  async downloads(
    downloads: Array<Download | null>,
  ): Promise<Array<Record<string, number | string> | null>> {
    const callingWinID = (arguments[1] ?? -1) as number;

    // Init FTP downloads
    const dls: Array<Download | string | null> = downloads.map((dl) => {
      if (dl !== null) {
        const downloadkey = downloadKey(dl);
        // HTTP module downloads may also use FTP to download a config file,
        // so always init FTP cancelable.
        if (ftpCancelableInit(downloadkey)) {
          return failCause(dl, C.UI.Manager.cancelMsg);
        }
      }
      return dl;
    });

    // Download modules
    const rs = await Promise.all(
      dls.map(async (dl) => {
        if (dl === null) return await Promise.resolve(null);
        if (typeof dl === 'string') return await Promise.resolve(dl);
        else {
          const dlkey = downloadKey(dl);
          try {
            if (dl.type === 'http') httpThrowIfCanceled(dlkey);
            else ftpThrowIfCanceled(dlkey);
            return await this.download(dl, callingWinID, true);
          } catch (er) {
            return Promise.reject(C.UI.Manager.cancelMsg);
          }
        }
      }),
    );

    // Create result object
    return downloads.map((dl, i) => {
      const key = downloadKey(dl);
      const result = rs[i];
      return result ? { [key]: result } : null;
    });
  },

  // Perform a Download and save it as a zip object. If the Download has
  // already been performed, and has not been cancelled, it will not be
  // downloaded again. Returns the number of files in the zip when successful,
  // or a string error/cancel message otherwise.
  async download(
    download: Download,
    winID: number,
    alreadyReset?: boolean,
  ): Promise<number | string> {
    let callingWinID = (arguments[3] ?? -1) as number;
    if (typeof winID === 'number') callingWinID = winID;
    const dlkey = downloadKey(download);
    // HTTP module downloads may also use FTP to download a config file,
    // so always init FTP cancelable.
    if (!alreadyReset && ftpCancelableInit(dlkey)) {
      return failCause(download, C.UI.Manager.cancelMsg);
    }
    try {
      if (download.type === 'http') httpThrowIfCanceled(dlkey);
      else ftpThrowIfCanceled(dlkey);
    } catch (er) {
      return failCause(download, C.UI.Manager.cancelMsg);
    }
    let dl = DownloadModuleZips.finished[dlkey];
    if (!dl) {
      let downloadPromise = DownloadModuleZips.ongoing[dlkey];
      if (!downloadPromise) {
        downloadPromise = this.downloadModuleZip(download, callingWinID);
      }
      let dlx: ZIP | string;
      try {
        dlx = await downloadPromise;
      } catch (er) {
        log.error(er);
        return C.UI.Manager.cancelMsg;
      }
      if (typeof dlx === 'string') return dlx;
      dl = dlx;
    } else {
      // Since this was already downloaded, report finished progress
      let w = BrowserWindow.fromId(callingWinID);
      w?.webContents.send('progress', -1, dlkey);
      w = null;
    }

    return dl.getEntries().length;
  },

  async downloadModuleZip(
    download: Download,
    callingWinID: number,
  ): Promise<ZIP | string> {
    const { type } = download;
    const downloadkey = downloadKey(download);
    log.verbose(`Starting download: `, logid(downloadkey));

    let threshProgress = 0;
    let done = false;
    const progress = (prog: number) => {
      if (!done && (Math.abs(prog) === 1 || prog >= threshProgress)) {
        let w = BrowserWindow.fromId(callingWinID);
        const erobj = new Error();
        const trace = 'trace' in erobj ? erobj.trace : '';
        w?.webContents.send('progress', prog, downloadkey, trace);
        w = null;
        threshProgress = prog + 0.02;
        done = prog === -1;
      }
    };

    const zipPromise = (async () => {
      let result: ZIP | string = `Invalid Download`;
      // FTP download (non-audio XSM modules)
      if (type === 'ftp') {
        const { domain, path, file } = download;
        const fp = fpath.posix.join(path, file);
        progress(0);
        const zipBuf = await getFile(domain, fp, downloadkey, progress);
        ftpThrowIfCanceled(downloadkey);
        result = new ZIP(zipBuf);
      }

      // HTTP download (Audio XSM modules)
      else if (type === 'http') {
        const { data } = download;
        if (data) {
          const { http, confname } = download;
          progress(0);
          const tmpdir = new LocalFile(Window.tmpDir({ id: callingWinID })[0]);
          if (!tmpdir.exists()) {
            result = `Could not create tmp directory '${tmpdir.path}'.`;
          }
          const dlfile = await getFileHTTP(
            resolveTemplateURL(http, data, 'zip', '1'),
            tmpdir.append(randomID()),
            downloadkey,
            (p: number) => {
              if (p && p !== -1) progress(p);
            },
          );
          httpThrowIfCanceled(downloadkey);

          result = new ZIP(dlfile.path);

          // If a conf file is requested, add it to the zip if not already there.
          if (confname) {
            let hasConf = false;
            result.forEach((ze) => {
              const { entryName } = normalizeZipEntry(ze);
              if (entryName.endsWith(confname)) hasConf = true;
            });
            if (!hasConf) {
              const confs = await repoConfigs(
                { ...download, file: C.SwordRepoManifest, type: 'ftp' },
                downloadkey,
                (p: number) => {
                  if (p && p !== -1) progress(3 / 4 + p / 4);
                },
              );
              ftpThrowIfCanceled(downloadkey);
              const strconf = confs.find(
                (rc) => rc && rc.conf.filename === confname,
              )?.strconf;
              if (strconf) {
                result.addFile(
                  fpath.posix.join('mods.d', confname),
                  Buffer.from(strconf),
                );
              } else {
                result = `Could not locate ${confname}.`;
              }
            }
          }
        }
      } else {
        // Standard SWORD module download from a raw SWORD repository.
        // First download conf file.
        const { domain, path, confname } = download;
        if (confname) {
          const confpath = fpath.posix.join(path, 'mods.d', confname);
          progress(0);
          const confbuf = await getFile(domain, confpath, downloadkey);
          ftpThrowIfCanceled(downloadkey);
          const conf = parseSwordConf({
            confString: confbuf.toString('utf8'),
            filename: confname,
            sourceRepository: download,
          });
          if (conf) {
            // Then download module contents
            const datapath = confModulePath(conf.DataPath);
            if (!datapath) {
              result = `Unexpected DataPath in ${confname}: ${conf.DataPath}`;
            } else {
              const modpath = fpath.posix.join(path, datapath);
              const modfiles = await getDir(
                domain,
                modpath,
                /\/lucene\//,
                downloadkey,
                progress,
              );
              ftpThrowIfCanceled(downloadkey);
              result = new ZIP();
              result.addFile(fpath.posix.join('mods.d', confname), confbuf);
              modfiles.forEach((fp) => {
                (result as ZIP).addFile(
                  fpath.posix.join(
                    datapath,
                    fp.listing.subdir,
                    fp.listing.name,
                  ),
                  fp.buffer,
                );
              });
            }
          }
        }
      }
      return result;
    })();

    DownloadModuleZips.ongoing[downloadkey] = zipPromise;

    const result = await zipPromise;
    progress(-1);
    if (typeof result === 'string') {
      log.verbose(`Failed download: ${logid(downloadkey)} ${logdls()}`);
    } else {
      log.verbose(`Successful download: ${logid(downloadkey)} ${logdls()}`);
      DownloadModuleZips.finished[downloadkey] = result;
    }
    delete DownloadModuleZips.ongoing[downloadkey];

    return zipPromise;
  },

  // Cancel all or certain module downloads IF they are ongoing. Finished
  // downloads are never effected in any way by this function (unlike the
  // cancel function which cancels ongoing and forgets finished downloads).
  // This function waits for requested ongoing downloads to be canceled
  // before returning.
  async cancelModuleDownloads(downloads?: Download[]): Promise<string[]> {
    const cancelled: string[] = [];
    const toCancel = downloads
      ? downloads.reduce<typeof DownloadModuleZips.ongoing>((p, c) => {
          const k = downloadKey(c);
          if (k in DownloadModuleZips.ongoing)
            p[k] = DownloadModuleZips.ongoing[k];
          return p;
        }, {})
      : DownloadModuleZips.ongoing;
    const entries = Object.entries(toCancel);
    if (entries.length) {
      log.verbose(`CANCEL-ONGOING: ${entries.length} items! ${logdls()}`);
      downloadCancel(entries.map((e) => e[0]));
      let cancelResults: PromiseSettledResult<string | ZIP>[] = [];
      try {
        cancelResults = await Promise.allSettled(
          entries.map((e) => e[1]) as Promise<string | ZIP>[],
        );
      } catch (er) {
        // Do nothing, handled by this.download()
      }
      cancelResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          cancelled.push(entries[i][0]);
        } else {
          log.verbose(r.reason);
        }
      });
      entries.forEach((e) => delete DownloadModuleZips.ongoing[e[0]]);
      log.verbose(
        `CANCEL-ONGOING COMPLETE: ${entries.length} items! ${logdls()}`,
      );
    }
    return cancelled;
  },

  // Cancel all or some downloads, current AND previous. This function returns
  // immediately without waiting for the downloads to cancel.
  // IMPORTANT: cancel() without arguments should always be called when a
  // session is finished, to delete all waiting FTP connections and reset
  // all state variables.
  async cancel(downloads?: Download[]): Promise<void> {
    if (!downloads) {
      resetAll();
      DownloadModuleZips.ongoing = {};
      DownloadModuleZips.finished = {};
    } else downloadCancel(downloads.map((dl) => downloadKey(dl)));
    const finished = downloads
      ? downloads.reduce<typeof DownloadModuleZips.finished>((p, c) => {
          const k = downloadKey(c);
          if (k in DownloadModuleZips.finished)
            p[k] = DownloadModuleZips.finished[k];
          return p;
        }, {})
      : DownloadModuleZips.finished;
    Object.keys(finished).forEach((key) => {
      delete DownloadModuleZips.finished[key];
    });
  },

  // Set windows to modal before calling this function!
  async installDownloads(
    installs: Array<{ download: Download; toRepo: Repository }>,
    callingWinID?: number,
  ): Promise<NewModulesType> {
    const zipobj: ZIP[] = [];
    const destdir: string[] = [];
    Object.entries(DownloadModuleZips.finished).forEach((entry) => {
      const [downloadkey, zipo] = entry;
      const save = installs.find(
        (s) => downloadKey(s.download) === downloadkey,
      );
      if (zipo && save && isRepoLocal(save.toRepo)) {
        const repo = new LocalFile(save.toRepo.path);
        if (repo.exists() && repo.isDirectory()) {
          zipobj.push(zipo);
          destdir.push(repo.path);
        }
      }
    });
    Object.keys(DownloadModuleZips.finished).forEach((key) => {
      delete DownloadModuleZips.finished[key];
    });
    return await modalInstall(zipobj, destdir, callingWinID);
  },

  // Set windows to modal before calling this function!
  // After this function, if installDownloads() will not be called,
  // then modulesInstalled must be published on the main process.
  remove(modules: RepositoryOperation[]): boolean[] {
    return modules.map((m) => {
      const { module, destRepository } = m;
      if (typeof module === 'string') {
        if (isRepoLocal(destRepository)) {
          return moveRemoveCopyModules(module, destRepository.path);
        }
      }
      return false;
    });
  },

  // Set windows to modal before calling this function!
  // After this function, if installDownloads() will not be called,
  // then modulesInstalled must be published on the main process.
  move(modules: RepositoryOperation[]): boolean[] {
    return modules.map((m) => {
      const { module, sourceRepository, destRepository } = m;
      if (
        typeof module === 'string' &&
        sourceRepository &&
        isRepoLocal(sourceRepository) &&
        isRepoLocal(destRepository)
      ) {
        return moveRemoveCopyModules(
          module,
          sourceRepository.path,
          destRepository.path,
        );
      }
      return false;
    });
  },

  // Set windows to modal before calling this function!
  // After this function, if installDownloads() will not be called,
  // then modulesInstalled must be published on the main process.
  copy(modules: RepositoryOperation[]): boolean[] {
    return modules.map((m) => {
      const { module, sourceRepository, destRepository } = m;
      if (
        typeof module === 'string' &&
        sourceRepository &&
        isRepoLocal(sourceRepository) &&
        isRepoLocal(destRepository)
      ) {
        return moveRemoveCopyModules(
          module,
          sourceRepository.path,
          destRepository.path,
          true,
        );
      }
      return false;
    });
  },

  writeConf(confFilePath: string, contents: string): void {
    if (
      contents &&
      confFilePath.match(/\bmods\.d\b/) &&
      confFilePath.endsWith('.conf')
    ) {
      const conf = new LocalFile(confFilePath);
      if (conf.exists()) {
        conf.writeFile(contents);
        Subscription.publish.resetMain();
        Window.reset('cache-reset', 'all');
      }
    }
  },

  setCipherKeys(keys: CipherKey[], callerWinID?: number): void {
    if (keys.length) {
      if (LibSword.isReady()) LibSword.quit();
      keys.forEach((k) => {
        const { conf, cipherKey } = k;
        const { module } = conf;
        if (cipherKey && module && module in CipherKeyModules) {
          try {
            const confFile = new LocalFile(CipherKeyModules[module].confPath);
            const str = confFile.readFile();
            const nstr = str.replace(/(?<=^CipherKey\s*=).*$/gm, cipherKey);
            confFile.writeFile(nstr);
          } catch (er) {
            log.error(er);
          }
        }
      });
      const newmods = clone(C.NEWMODS);
      // Add these as new modules now, but they will be removed during
      // 'modulesInstalled' if they don't decrypt with the key.
      newmods.modules.push(...keys.map((k) => k.conf));
      Subscription.publish.modulesInstalled(
        newmods,
        callerWinID ?? getBrowserWindows({ type: 'xulswordWin' })[0].id,
      );
    }
  },
};

export default Module as Omit<typeof Module, 'downloadModuleZip'>;
