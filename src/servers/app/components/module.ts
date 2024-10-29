/* eslint-disable prefer-rest-params */
import fpath from 'path';
import { BrowserWindow } from 'electron';
import ZIP from 'adm-zip';
import log from 'electron-log';
import i18n from 'i18next';
import Cache from '../../../cache.ts';
import {
  clone,
  downloadKey,
  audioConfStrings,
  isRepoLocal,
  JSON_stringify,
  randomID,
  versionCompare,
  pad,
  mergeNewModules,
  unknown2String,
  validateViewportModulePrefs,
  validateGlobalModulePrefs,
  keep,
} from '../../../common.ts';
import Subscription from '../../../subscription.ts';
import C from '../../../constant.ts';
import { CipherKeyModules, getFeatureModules, getTabs } from '../../common.ts';
import parseSwordConf from '../../parseSwordConf.ts';
import {
  getFile,
  getDir,
  getFileHTTP,
  getFiles,
  getListing,
  untargz,
  ftpCancelableInit,
  failCause,
  ftpCancelable,
  downloadCancel,
  logid,
  destroyFTPconnections,
} from '../../ftphttp.ts';
import DiskCache from '../../components/diskcache.ts';
import LocalFile from '../../components/localFile.ts';
import Dirs from '../../components/dirs.ts';
import LibSword, { moduleUnsupported } from '../../components/libsword.ts';
import Prefs from '../prefs.ts';
import Window, { getBrowserWindows } from './window.ts';

import type {
  CipherKey,
  Download,
  FTPDownload,
  GenBookAudioFile,
  NewModulesType,
  Repository,
  RepositoryListing,
  SwordConfType,
  GenBookAudioConf,
  VerseKeyAudioConf,
  VerseKeyAudioFile,
  OSISBookType,
} from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type { ListingElementR } from '../../ftphttp.ts';

// CrossWire SWORD Standard TODOS:
// TODO CrossWire wiki mentions LangSortOrder! Report change to KeySort
// TODO CrossWire Eusebian_vs and Eusebian_num share a single conf file. Support this?

// Return a path beginning with 'modules/' to a specific module's installation
// directory by interpereting a SWORD DataPath config entry value.
export function confModulePath(aDataPath: string): string | null {
  if (!aDataPath || !aDataPath.startsWith('./modules')) return null;
  const dataPath = aDataPath.substring(2);
  const subs = dataPath.split('/');
  let modDir = 4;
  if (['devotionals', 'glossaries'].includes(subs[3])) modDir = 5;
  if (subs.length === modDir) return subs.join('/');
  if (subs.length > modDir) return subs.slice(0, modDir).join('/');
  return null;
}

function recurseAudioDirectory(
  dir: LocalFile,
  ancOrSelfx?: string[],
  audiox?: GenBookAudioConf,
): GenBookAudioConf {
  const audio = audiox || {};
  const ancOrSelf = ancOrSelfx?.slice() || [];
  if (ancOrSelfx) ancOrSelf.push(dir.leafName);
  const chs: number[] = [];
  dir.directoryEntries.forEach((sub) => {
    const subfile = dir.clone().append(sub);
    if (/^(\d+)/.test(sub)) {
      const m2 = subfile.leafName.match(/^(\d+)\.[^.]+$/);
      if (subfile.isDirectory()) {
        recurseAudioDirectory(subfile, ancOrSelf, audio);
      } else if (m2) {
        chs.push(Number(m2[1]));
      }
    } else log.warn(`Skipping non-number audio file: ${subfile.path}`);
  });
  if (chs.length) audio[`${[...ancOrSelf].join('/')}/`] = audioConfStrings(chs);
  return audio;
}

// Scan the file system for audio files starting at the location pointed to by
// repoPath/dataPath, and return the results.
export function scanAudio(
  repoPath: string,
  dataPath: string,
): GenBookAudioConf | VerseKeyAudioConf {
  const scan = new LocalFile(repoPath);
  if (scan.exists() && scan.isDirectory()) {
    dataPath.replace('/', fpath.sep);
    scan.append(dataPath);
    if (scan.exists() && scan.isDirectory()) {
      const subs = scan.directoryEntries;
      const isVerseKey = subs.find((bk) =>
        Object.values(C.SupportedBooks).find((bg: any) => bg.includes(bk)),
      );
      if (!isVerseKey) return recurseAudioDirectory(scan);
      const r = {} as VerseKeyAudioConf;
      scan.directoryEntries.forEach((bk) => {
        if (
          Object.values(C.SupportedBooks).find((bg: any) => bg.includes(bk))
        ) {
          const book = bk as OSISBookType;
          const boolArray: boolean[] = [];
          const scan2 = scan.clone().append(book);
          if (scan2.isDirectory()) {
            scan2.directoryEntries.forEach((chapter) => {
              const audioFile = scan2.clone().append(chapter);
              if (!audioFile.isDirectory()) {
                const chn = Number(
                  audioFile.leafName.replace(/^(\d+).*?$/, '$1'),
                );
                if (!Number.isNaN(chn)) boolArray[chn] = true;
                else {
                  log.warn(
                    `Skipping audio file with name: ${audioFile.leafName}`,
                  );
                }
              } else
                log.warn(`Skipping audio chapter subdirectory: ${chapter}`);
            });
          }
          for (let i = 0; i < boolArray.length; i += 1) {
            boolArray[i] = !!boolArray[i];
          }
          r[book] = audioConfStrings(boolArray);
        } else log.warn(`Skipping unrecognized audio subdirectory: ${bk}`);
      });
      return r;
    }
  }
  return {};
}

// Move or remove one or more modules. Returns the number of modules
// succesfully (re)moved. If moveTo is set, the removed modules will
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
export function moveRemoveModules(
  modules: string,
  repositoryPath: string,
  moveTo?: string,
): boolean;
export function moveRemoveModules(
  modules: string[],
  repositoryPath: string,
  moveTo?: string,
): boolean[];
export function moveRemoveModules(
  modules: string | string[],
  repositoryPath: string,
  moveTo?: string,
): boolean | boolean[] {
  let move = (moveTo && new LocalFile(moveTo)) || null;
  if (move && (!move.exists() || !move.isDirectory())) move = null;
  if (moveTo && move === null) {
    log.error(`Destination does not exist '${moveTo}'.`);
    return Array.isArray(modules) ? modules.map(() => false) : false;
  }
  if (moveTo && repositoryPath === Dirs.path.xsAudio) {
    log.error(`Cannot move audio '${moveTo}'.`);
    return Array.isArray(modules) ? modules.map(() => false) : false;
  }
  if (LibSword.isReady()) LibSword.quit();
  const moddir = new LocalFile(repositoryPath);
  moddir.append('mods.d');

  if (!Cache.has('RepoConfigObjects', repositoryPath)) {
    Cache.write(
      moddir.directoryEntries.map((c) => {
        const confFile = moddir.clone().append(c);
        if (!confFile.isDirectory() && confFile.path.endsWith('.conf')) {
          return parseSwordConf(confFile);
        }
        return null;
      }),
      'RepoConfigObjects',
      repositoryPath,
    );
  }
  const confs = Cache.read(
    'RepoConfigObjects',
    repositoryPath,
  ) as SwordConfType[];

  const results = (Array.isArray(modules) ? modules : [modules]).map((m) => {
    const conf = confs.find((c) => c && c.module === m);
    if (!conf) return !move;
    const confFile = moddir.clone().append(conf.filename);
    // If we're moving, delete any destination module first, so we can
    // abort the move that fails.
    if (move && !moveRemoveModules(m, move.clone().path)) {
      return false;
    }
    let toConfFile;
    if (move) {
      const tomodsd = move.clone().append('mods.d');
      tomodsd.create(LocalFile.DIRECTORY_TYPE);
      confFile.copyTo(tomodsd);
      toConfFile = tomodsd.append(confFile.leafName);
      if (!toConfFile.exists()) {
        return false;
      }
    }
    // Keep contents of conf file in case module delete fails, so
    // original state an be restored if needed.
    const conftext = confFile.readFile();
    confFile.remove();
    if (confFile.exists()) {
      return false;
    }
    if (repositoryPath === Dirs.path.xsAudio) {
      const audiodir = new LocalFile(repositoryPath);
      audiodir.append('modules').append(conf.module);
      if (audiodir.isDirectory()) {
        audiodir.remove(true);
      }
      if (audiodir.exists()) {
        if (!confFile.exists() && conftext) {
          confFile.writeFile(conftext);
        }
        return false;
      }
    } else {
      const modulePath = confModulePath(conf.DataPath);
      if (!modulePath) {
        confFile.writeFile(conftext);
        return false;
      }
      const md = new LocalFile(repositoryPath);
      md.append(modulePath);
      if (move) {
        const to = move.clone();
        const dirs = modulePath.split('/').filter(Boolean);
        dirs.pop();
        dirs.forEach((sub) => {
          to.append(sub);
          if (!to.exists()) {
            to.create(LocalFile.DIRECTORY_TYPE);
          }
        });
        md.copyTo(to, null, true);
        if (!to.append(md.leafName).exists()) {
          // Don't leave a half moved module, then abort.
          toConfFile?.remove();
          return false;
        }
      }
      if (md.exists()) md.remove(true);
      if (md.exists()) {
        if (!confFile.exists() && conftext) {
          confFile.writeFile(conftext);
        }
        return false;
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
    Cache.clear('RepoConfigObjects');
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
            const { module, CipherKey } = conf;
            installed.push({
              module,
              CipherKey,
              repoDir: modsd.append('..').path,
            });
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
          if (!entry.entryName.endsWith('/')) {
            log.silly(`Processing Entry: ${entry.entryName}`);
            const type = entry.entryName.split('/').shift();
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
                  filename: entry.name,
                  sourceRepository: dest.path,
                });
                // Look for any problems with the module itself
                const modreports = clone(conf.reports);
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
                    (mo) => mo.CipherKey !== '' && mo.CipherKey !== C.NOTFOUND,
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
                  if (!confdest.exists()) {
                    confdest.create(LocalFile.DIRECTORY_TYPE);
                  }
                  confdest.append(entry.name);
                  if (confdest.exists()) {
                    if (swmodpath === 'XSM_audio') {
                      // Audio is not treated as a single module but as an updatable set of audio
                      // files so just delete the conf file and it will be overwritten by the new.
                      confdest.remove();
                    } else {
                      // Remove any existing module having this name unless it would be downgraded.
                      const existing = parseSwordConf(confdest);
                      if (
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
                      } else if (!moveRemoveModules(conf.module, destdir)) {
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
                      const omdir = installed.find((ins) => ins.module === om);
                      if (omdir && !moveRemoveModules(om, omdir.repoDir)) {
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
                      error: `(${conf.module}) Could not create module directory '${moddest.path}'.`,
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
                newmods.reports.push(...modreports);
                break;
              }

              case 'modules': {
                const conf = Object.values(confs).find((c) => {
                  const swmodpath = confModulePath(c.DataPath);
                  return (
                    swmodpath && entry.entryName.startsWith(`${swmodpath}/`)
                  );
                });
                const swmodpath = conf && confModulePath(conf.DataPath);
                if (conf && swmodpath) {
                  const moddest = new LocalFile(destdir);
                  moddest.append(swmodpath);
                  // If this module is to be installed, the destination directory has already been
                  // succesfully created, otherwise silently skip.
                  if (moddest.exists()) {
                    const parts = entry.entryName
                      .substring(swmodpath.length + 1)
                      .split('/');
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
                        error: `(${conf.module}) Could not copy file " ${moddest.path}.`,
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
                fontsdir.append(entry.name);
                fontsdir.writeFile(entry.getData());
                newmods.fonts.push(entry.name);
                break;
              }

              case 'bookmarks': {
                const bmdir = Dirs.xsBookmarks;
                bmdir.append(entry.name);
                bmdir.writeFile(entry.getData());
                newmods.bookmarks.push(entry.name);
                break;
              }

              case 'audio': {
                // Deprecated paths:
                // audio/<lang-code>/<audio-code>/<book>/001.mp3
                // audio/<lang-code>/<audio-code>/001 Title/001.mp3
                //
                // Current paths:
                // audio/<audio-code>/<book>/001.mp3 (000.mp3 is book introduction)
                // audio/<audio-code>/000/.../000.mp3
                //
                // NOTES:
                // - Deprecated file indexes start at 1, but new indexes start at 0. For
                // verse-key modules, 0 is the book introduction.
                // - Deprecated system is detected if <lang-code> is present in the path.
                // - Introduction audio files are now different between verse-key and
                // general-book systems: a verse-key book introduction audio file is
                // 000.mp3 as a child of the book directory, but general-book introduction
                // audio is the nnn.mp3 sibling of the nnn parent directory.
                //
                // Converting from deprecated to new:
                // - Verse-key systems are the same, just remove the lang-code.
                // - General-book also needs lang-code removed from path, plus it needs a
                // 000 root directory inserted, to match what is actually in Children's
                // Bible SWORD modules (the only SWORD GenBook audio published so far).
                // Finally, general-book indexes need 1 to be subtracted from each index.
                const audio = Dirs.xsAudio;
                const pobj = fpath.posix.parse(entry.entryName);
                let dirs = pobj.dir.split(fpath.posix.sep);
                let chapter = Number(pobj.name.replace(/^(\d+).*?$/, '$1'));
                dirs.shift(); // remove ./audio
                let deprecatedZip = false;
                // Deprecated Zip files have lang-code in the path, so check and remove.
                if (
                  dirs.findIndex(
                    (d) =>
                      Object.entries(C.SupportedBooks).some((bg: any) =>
                        bg[1].includes(d),
                      ) || /^\d+/.test(d),
                  ) === 2
                ) {
                  dirs.shift();
                  deprecatedZip = true;
                }
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
                // Convert deprecated GenBook path to new form.
                if (!isVerseKey && deprecatedZip) {
                  chapter -= 1;
                  dirs = dirs.map((d, ix) =>
                    ix < 2
                      ? d
                      : pad(Number(d.replace(/^(\d+).*?$/, '$1')) - 1, 3, 0),
                  );
                  dirs.splice(2, 0, '000');
                }
                // Create parent directories
                const gbkeys: string[] = [];
                while (dirs.length) {
                  const subname = dirs.shift() as string;
                  audio.append(subname);
                  gbkeys.push(subname);
                  if (!audio.exists()) {
                    audio.create(LocalFile.DIRECTORY_TYPE);
                  }
                }
                if (isVerseKey && audioCode) {
                  const book = bookOrSub as OSISBookType;
                  // VerseKey audio file...
                  if (audioCode && book && !Number.isNaN(chapter)) {
                    audio.append(pad(chapter, 3, 0) + pobj.ext);
                    audio.writeFile(entry.getData());
                    const audiofile: VerseKeyAudioFile = {
                      audioModule: audioCode,
                      book,
                      chapter,
                      path: [book, chapter],
                    };
                    newmods.audio.push(audiofile);
                  } else audioCode = '';
                } else if (audioCode) {
                  // GenBook audio file...
                  const fname = pad(chapter, 3, 0);
                  gbkeys.push(fname);
                  audio.append(fname + pobj.ext);
                  audio.writeFile(entry.getData());
                  const audioFile: GenBookAudioFile = {
                    audioModule: audioCode,
                    key: gbkeys.join(C.GBKSEP),
                    path: gbkeys.map((k) => Number(k)),
                  };
                  newmods.audio.push(audioFile);
                }
                // Modify the config file to show the new audio.
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
                  }
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
                  warning: `Unknown module component ${entry.name}.`,
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

type DownloadRepoConfsType = {
  module: string;
  strconf: string;
  conf: SwordConfType;
};

async function downloadRepoConfs(
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
      const rconf = {} as DownloadRepoConfsType;
      rconf.strconf = buffer.toString('utf8');
      const conf = parseSwordConf({
        confString: rconf.strconf,
        filename: header.name.replace(/^.*?mods\.d\//, ''),
        sourceRepository: manifest,
      });
      rconf.conf = conf;
      rconf.module = conf.module;
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

const ModuleDownloads = {
  ongoing: {} as Record<string, Promise<ZIP | string> | undefined>,
  finished: {} as Record<string, ZIP>,
};

function logdls() {
  const ongoing = Object.keys(ModuleDownloads.ongoing);
  const example = ongoing.slice(-5).map((x) => logid(x));
  return `ongoing=${ongoing.length}(${example.join(', ')}) finished=${
    Object.keys(ModuleDownloads.finished).length
  }`;
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
      custom: false,
      builtin: true,
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
    const fstring = fbuffer.toString('utf8');
    const regex = 'FTPSource=([^|]+)\\|([^|]+)\\|([^|]+)\\s*[\\n\\r]';
    fstring.match(new RegExp(regex, 'g'))?.forEach((mx: string) => {
      const m = mx.match(new RegExp(regex));
      if (m) {
        result.push({
          name: m[1],
          domain: m[2],
          path: m[3],
          custom: false,
          builtin: false,
        });
      }
    });
    return result;
  },

  // Takes an array of local and remote SWORD or XSM repositories and returns a mapped
  // array containing:
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
    // Get an array of Promises that will progress in parallel.
    const promises: Array<Promise<RepositoryListing | string>> = manifests.map(
      async (manifest) => {
        if (manifest && !manifest.disabled) {
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
                    confs.push(conf);
                  }
                });
                return confs;
              }
              return `Directory not found: ${manifest.path}/mods.d`;
            }
            return `Path not absolute: ${manifest.path}/mods.d`;
          }

          // REMOTE repository conf files.
          const cancelkey = downloadKey(manifest);
          if (ftpCancelableInit(cancelkey)) {
            return await Promise.resolve(
              failCause(cancelkey, C.UI.Manager.cancelMsg),
            );
          }
          let threshProgress = 0;
          let done = false;
          const progress = (prog: number) => {
            if (manifest) {
              if (!done && (Math.abs(prog) === 1 || prog >= threshProgress)) {
                const dlk = downloadKey(manifest);
                const w = BrowserWindow.fromId(callingWinID);
                w?.webContents.send('progress', prog, dlk);
                threshProgress = prog + 5;
                done = prog === -1;
              }
            }
          };
          let repconfs: DownloadRepoConfsType[];
          try {
            repconfs = await downloadRepoConfs(manifest, cancelkey, progress);
          } catch (er) {
            return await Promise.resolve(
              failCause(cancelkey, unknown2String(er, ['message'])),
            );
          }
          try {
            ftpCancelable(cancelkey);
          } catch (er) {
            return await Promise.resolve(
              failCause(cancelkey, C.UI.Manager.cancelMsg),
            );
          }
          return repconfs.map((rc) => rc.conf);
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
      });
  },

  // Download an array of SWORD modules and save them as zip objects for later
  // installation by installDownload. Returns the number of files in each zip
  // if successful, or a string error/cancel message otherwise.
  async downloads(
    downloads: Array<Download | null>,
  ): Promise<Array<Record<string, number | string> | null>> {
    const callingWinID = (arguments[1] ?? -1) as number;
    const dls: Array<Download | string | null> = downloads.map((dl) => {
      if (dl !== null) {
        const downloadkey = downloadKey(dl);
        if (ftpCancelableInit(downloadkey)) {
          return failCause(downloadkey, C.UI.Manager.cancelMsg);
        }
      }
      return dl;
    });
    dls.forEach((dl) => {
      if (dl && typeof dl !== 'string') {
        const key = downloadKey(dl);
        ModuleDownloads.ongoing[key] = undefined;
      }
    });
    log.debug(`DOWNLOADS: ${downloads.length} items! ${logdls()}`);
    const rs = await Promise.all(
      dls.map(async (dl) => {
        if (dl === null) return null;
        return typeof dl === 'string'
          ? await Promise.resolve(dl)
          : await this.download(dl, callingWinID, true);
      }),
    );
    const res = downloads.map((dl, i) => {
      const key = downloadKey(dl);
      const result = rs[i];
      return result ? { [key]: result } : null;
    });

    log.debug(`DOWNLOADS COMPLETE: ${downloads.length} items! ${logdls()}`);
    return res;
  },

  // Download a SWORD module from a repository and save it as a zip object
  // for later installation by installDownload. Returns the number of files
  // if successful, or a string error/cancel message otherwise.
  async download(
    download: Download,
    winID: number,
    alreadyReset?: boolean,
  ): Promise<number | string> {
    let callingWinID = (arguments[3] ?? -1) as number;
    if (typeof winID === 'number') callingWinID = winID;
    const key = downloadKey(download);
    if (!alreadyReset && ftpCancelableInit(key)) {
      return failCause(key, C.UI.Manager.cancelMsg);
    }
    let dl = ModuleDownloads.finished[key];
    if (!dl) {
      let downloadPromise = ModuleDownloads.ongoing[key];
      if (!downloadPromise) {
        downloadPromise = this.download2(download, callingWinID);
        ModuleDownloads.ongoing[key] = downloadPromise;
      }
      if (!alreadyReset) {
        log.debug(`DOWNLOAD: 1 items! ${logdls()}`);
      }
      let dlx: ZIP | string;
      try {
        dlx = await downloadPromise;
      } catch (er) {
        log.info(`Download error follows:`);
        log.error(er);
        return C.UI.Manager.cancelMsg;
      } finally {
        delete ModuleDownloads.ongoing[key];
      }
      if (typeof dlx === 'string') {
        log.debug(`DOWNLOAD FAILED: 1 items! ${logdls()}`);
        return dlx;
      }
      dl = dlx;
      ModuleDownloads.finished[key] = dl;
    } else {
      // Since this was already downloaded, report finished progress
      let w = BrowserWindow.fromId(callingWinID);
      w?.webContents.send('progress', -1, key);
      w = null;
    }
    if (!alreadyReset) {
      log.debug(`DOWNLOAD COMPLETE: 1 items! ${logdls()}`);
    }
    return dl.getEntries().length;
  },

  async download2(
    download: Download,
    callingWinID: number,
  ): Promise<ZIP | string> {
    const { type } = download;
    const downloadkey = downloadKey(download);
    log.debug(`Starting download: `, logid(downloadkey));

    let threshProgress = 0;
    let done = false;
    const progress = (prog: number) => {
      if (!done && (Math.abs(prog) === 1 || prog >= threshProgress)) {
        let w = BrowserWindow.fromId(callingWinID);
        const erobj = new Error();
        const trace = 'trace' in erobj ? erobj.trace : '';
        w?.webContents.send('progress', prog, downloadkey, trace);
        w = null;
        threshProgress = prog + 2;
        done = prog === -1;
      }
    };

    const returnMsg = (msg: string | Error) => {
      progress(-1);
      log.debug(`Failed download: ${logid(downloadkey)} ${logdls()}`);
      return failCause(downloadkey, msg);
    };

    const returnZIP = (zip: ZIP) => {
      progress(-1);
      log.debug(`Successful download: ${logid(downloadkey)} ${logdls()}`);
      return zip;
    };

    try {
      // Audio XSM modules (HTTP download)
      if (type === 'http') {
        const { http, confname } = download;
        progress(0);
        const tmpdir = new LocalFile(Window.tmpDir({ id: callingWinID })[0]);
        if (!tmpdir.exists()) {
          return await Promise.resolve(
            returnMsg(`Could not create tmp directory '${tmpdir.path}'.`),
          );
        }
        const dlfile = await getFileHTTP(
          http,
          tmpdir.append(randomID()),
          downloadkey,
          (p: number) => {
            if (p && p !== -1) progress(p * (3 / 4));
          },
        );
        ftpCancelable(downloadkey);

        const zip = new ZIP(dlfile.path);
        // The conf file is required, so add it to the zip if not already present.
        let hasConf = false;
        zip.forEach((ze) => {
          if (ze.entryName.endsWith(confname)) hasConf = true;
        });
        if (!hasConf) {
          const confs = await downloadRepoConfs(
            { ...download, file: C.SwordRepoManifest, type: 'ftp' },
            downloadkey,
            (p: number) => {
              if (p && p !== -1) progress(3 / 4 + p / 4);
            },
          );
          ftpCancelable(downloadkey);
          const strconf = confs.find(
            (rc) => rc.conf.filename === confname,
          )?.strconf;
          if (strconf) {
            zip.addFile(
              fpath.posix.join('mods.d', confname),
              Buffer.from(strconf),
            );
          } else {
            return await Promise.resolve(
              returnMsg(`Could not locate ${confname}.`),
            );
          }
        }
        return await Promise.resolve(returnZIP(zip));
      }

      // Other XSM modules are ZIP files
      if (type === 'ftp') {
        const { domain, path, file } = download;
        const fp = fpath.posix.join(path, file);
        progress(0);
        const zipBuf = await getFile(domain, fp, downloadkey, progress);
        ftpCancelable(downloadkey);
        return await Promise.resolve(returnZIP(new ZIP(zipBuf)));
      }

      // Standard SWORD modules. First download conf file.
      const { domain, path, confname } = download;
      const confpath = fpath.posix.join(path, 'mods.d', confname);
      progress(0);
      const confbuf = await getFile(domain, confpath, downloadkey);
      ftpCancelable(downloadkey);
      const conf = parseSwordConf({
        confString: confbuf.toString('utf8'),
        filename: confname,
        sourceRepository: download,
      });
      // Then download module contents
      const datapath = confModulePath(conf.DataPath);
      if (!datapath) {
        return await Promise.resolve(
          returnMsg(`Unexpected DataPath in ${confname}: ${conf.DataPath}`),
        );
      }
      const modpath = fpath.posix.join(path, datapath);
      const modfiles = await getDir(
        domain,
        modpath,
        /\/lucene\//,
        downloadkey,
        progress,
      );
      ftpCancelable(downloadkey);
      const zip = new ZIP();
      zip.addFile(fpath.posix.join('mods.d', confname), confbuf);
      modfiles.forEach((fp) => {
        zip.addFile(
          fpath.posix.join(datapath, fp.listing.subdir, fp.listing.name),
          fp.buffer,
        );
      });
      return await Promise.resolve(returnZIP(zip));
    } catch (er) {
      return await Promise.resolve(returnMsg(unknown2String(er, ['message'])));
    }
  },

  async cancelOngoingDownloads(downloads?: Download[]): Promise<number> {
    const toCancel = downloads
      ? downloads.reduce<typeof ModuleDownloads.ongoing>((p, c) => {
          const k = downloadKey(c);
          if (k in ModuleDownloads.ongoing) p[k] = ModuleDownloads.ongoing[k];
          return p;
        }, {})
      : ModuleDownloads.ongoing;
    const keys = Object.keys(toCancel);
    const values = Object.values(toCancel);
    log.debug(`CANCEL-ONGOING: ${keys.length} items! ${logdls()}`);
    downloadCancel(keys);
    let canceled: any[] = [];
    try {
      canceled = await Promise.allSettled(values);
    } catch (er) {
      // Do nothing, handled by this.download()
    }
    let cnt = 0;
    canceled.forEach((r) => {
      if (r.status === 'fulfilled') {
        cnt += 1;
      } else {
        log.debug(r.reason);
      }
    });
    keys.forEach((key) => delete ModuleDownloads.ongoing[key]);
    log.debug(`CANCEL-ONGOING COMPLETE: ${keys.length} items! ${logdls()}`);
    return cnt;
  },

  // Cancel ongoing downloads AND previous downloads.
  // IMPORTANT: cancel() without arguments should always be
  // called when a session is finished, to delete all waiting
  // FTP connections etc.
  async cancel(downloads?: Download[]): Promise<number> {
    let cnt = await this.cancelOngoingDownloads(downloads);
    if (!downloads) destroyFTPconnections();
    const finished = downloads
      ? downloads.reduce<typeof ModuleDownloads.finished>((p, c) => {
          const k = downloadKey(c);
          if (k in ModuleDownloads.finished) p[k] = ModuleDownloads.finished[k];
          return p;
        }, {})
      : ModuleDownloads.finished;
    const nfk = Object.keys(finished).length;
    Object.keys(finished).forEach((key) => {
      delete ModuleDownloads.finished[key];
      cnt += 1;
    });
    log.debug(`CANCEL-FINISHED COMPLETE: ${nfk} items! ${logdls()}`);
    return cnt;
  },

  // Set windows to modal before calling this function!
  async installDownloads(
    installs: Array<{ download: Download; toRepo: Repository }>,
    callingWinID?: number,
  ): Promise<NewModulesType> {
    const zipobj: ZIP[] = [];
    const destdir: string[] = [];
    Object.entries(ModuleDownloads.finished).forEach((entry) => {
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
    Object.keys(ModuleDownloads.finished).forEach((key) => {
      delete ModuleDownloads.finished[key];
    });
    return await modalInstall(zipobj, destdir, callingWinID);
  },

  // Set windows to modal before calling this function!
  // After this function, if installDownloads() will not be called,
  // then modulesInstalled must be published on the main process.
  remove(modules: Array<{ name: string; repo: Repository }>): boolean[] {
    Cache.clear('RepoConfigObjects');
    return modules.map((module) => {
      const { name, repo } = module;
      if (isRepoLocal(repo)) {
        return moveRemoveModules(name, repo.path);
      }
      return false;
    });
  },

  // Set windows to modal before calling this function!
  // After this function, if installDownloads() will not be called,
  // then modulesInstalled must be published on the main process.
  move(
    modules: Array<{ name: string; fromRepo: Repository; toRepo: Repository }>,
  ): boolean[] {
    Cache.clear('RepoConfigObjects');
    return modules.map((module) => {
      const { name, fromRepo, toRepo } = module;
      if (isRepoLocal(fromRepo) && isRepoLocal(toRepo)) {
        return moveRemoveModules(name, fromRepo.path, toRepo.path);
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
      }
    }
  },

  setCipherKeys(keys: CipherKey[], callerWinID?: number): void {
    if (keys.length) {
      Window.modal([{ modal: 'darkened', window: 'all' }]);
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

export default Module as Omit<typeof Module, 'download2'>;
