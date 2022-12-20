/* eslint-disable prefer-rest-params */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fpath from 'path';
import { BrowserWindow } from 'electron';
import ZIP from 'adm-zip';
import log from 'electron-log';
import {
  clone,
  downloadKey,
  isRepoLocal,
  parseSwordConf,
  randomID,
  versionCompare,
} from '../../common';
import Subscription from '../../subscription';
import C from '../../constant';
import Window, { getBrowserWindows } from './window';
import LocalFile from './localFile';
import Dirs from './dirs';
import LibSword from './libsword';
import {
  ftpCancel,
  getFile,
  getDir,
  destroyFTPconnection,
  getFileHTTP,
  getFiles,
  list,
  untargz,
  ListingElementR,
  httpCancel,
} from '../ftphttp';

import type {
  AudioFile,
  CipherKey,
  Download,
  FTPDownload,
  GenBookAudioFile,
  ModTypes,
  NewModuleReportType,
  NewModulesType,
  Repository,
  RepositoryListing,
  SwordConfType,
  V11nType,
} from '../../type';

export const CipherKeyModules: {
  [module: string]: {
    confPath: string;
    cipherKey: string;
    numBooks: number | null; // null means unknown
  };
} = {};

// CrossWire SWORD Standard TODOS:
// TODO! DisplayLevel: GenBook standard display's context levels
// TODO! CrossWire wiki mentions LangSortOrder! Report change to KeySort
// TODO! UnlockInfo: Display instructions for obtaining an unlock key
// TODO! CrossWire Eusebian_vs and Eusebian_num share a single conf file. Support this?

let Downloads: { [downloadKey: string]: ZIP } = {};

// Return the ModTypes type derived from a module config's ModDrv entry,
// or return null if it's not a ModTypes type.
export function getTypeFromModDrv(modDrv: string): ModTypes | null {
  if (modDrv.includes('Text')) return 'Biblical Texts';
  if (modDrv.includes('LD')) return 'Lexicons / Dictionaries';
  if (modDrv.includes('Com')) return 'Commentaries';
  if (modDrv.includes('RawGenBook')) return 'Generic Books';
  if (modDrv.includes('RawFiles')) return null;
  return null;
}

// Check a module's version and return rejection message(s) if it is not supported.
// Returns [] if the module is supported. If the module is passed by name, LibSword
// will be used to read config information, otherwise LibSword will not be called.
export function moduleUnsupported(
  module: string | SwordConfType
): NewModuleReportType[] {
  const reasons: NewModuleReportType[] = [];
  const conf = typeof module === 'string' ? null : module;
  const module2 = (conf ? conf.module : module) as string;
  let moddrv;
  let minimumVersion;
  let v11n;
  if (conf) {
    moddrv = conf.ModDrv;
    minimumVersion = conf.MinimumVersion;
    v11n = conf.Versification || 'KJV';
  } else {
    moddrv = LibSword.getModuleInformation(module2, 'ModDrv');
    minimumVersion = LibSword.getModuleInformation(module2, 'MinimumVersion');
    v11n = LibSword.getModuleInformation(module2, 'Versification');
    if (v11n === C.NOTFOUND) v11n = 'KJV';
  }
  if (!minimumVersion || minimumVersion === C.NOTFOUND) minimumVersion = '0';
  const type = getTypeFromModDrv(moddrv);
  if (type && Object.keys(C.SupportedModuleTypes).includes(type)) {
    if (versionCompare(C.SWORDEngineVersion, minimumVersion) < 0) {
      reasons.push({
        error: `(${module2}) Requires SWORD engine version > ${minimumVersion} (using ${C.SWORDEngineVersion}).`,
      });
    }
  } else {
    reasons.push({
      error: `(${module2}) Unsupported type '${type || moddrv}'.`,
    });
  }
  if (!C.SupportedV11ns.includes(v11n as V11nType)) {
    reasons.push({
      error: `(${module2}) Unsupported verse system '${v11n}'.`,
    });
  }
  return reasons;
}

// Return a path beginning with 'modules/' to a specific module's installation
// directory by interpereting a SWORD DataPath config entry value. Returns
// null if the path does not satisfy the SWORD standard (see
// https://wiki.crosswire.org/DevTools:conf_Files)
export function confModulePath(aDataPath: string): string | null {
  if (!aDataPath || !aDataPath.startsWith('./modules')) return null;
  let dataPath = aDataPath.substring(2);
  dataPath = dataPath.replace(/\/[^/]*$/, '');
  const subs = dataPath.split('/');
  let requiredSubs = 4;
  if (['devotionals', 'glossaries'].includes(subs[3])) requiredSubs = 5;
  return subs.length === requiredSubs ? subs.join('/') : null;
}

// Move or remove one or more modules. Returns the number of modules
// succesfully (re)moved. If moveTo is set, the removed modules will
// be moved (copied) there if it is an existing path, otherwise nothing
// will be done and 0 is returned. NOTE: audio modules only and always
// exist in the xsAudio directory and cannot be moved. NOTE-2: LibSword
// can be ready upon entering this function, but it will be quit before
// modules are removed, then other functions are responsible for
// restarting it.
export function moveRemoveModule(
  modules: string | string[],
  repositoryPath: string,
  moveTo?: string
): number {
  let move = (moveTo && new LocalFile(moveTo)) || null;
  if (move && (!move.exists() || !move.isDirectory())) move = null;
  if (moveTo && move === null) {
    log.error(`Destination does not exist '${moveTo}'.`);
    return 0;
  }
  LibSword.quit();
  let num = 0;
  const ma = Array.isArray(modules) ? modules : [modules];
  ma.forEach((m) => {
    const moddir = new LocalFile(repositoryPath);
    moddir.append('mods.d');
    const subs = moddir.directoryEntries;
    if (subs) {
      subs.forEach((conf) => {
        const f = moddir.clone();
        f.append(conf);
        if (!f.isDirectory() && f.path.endsWith('.conf')) {
          const c = parseSwordConf(f, f.leafName);
          if (c.module === m) {
            if (move && repositoryPath !== Dirs.path.xsAudio) {
              const tomodsd = move.clone().append('mods.d');
              tomodsd.create(LocalFile.DIRECTORY_TYPE);
              f.copyTo(tomodsd);
            }
            f.remove();
            if (repositoryPath === Dirs.path.xsAudio) {
              const audiodir = new LocalFile(repositoryPath);
              audiodir.append(c.module);
              if (audiodir.isDirectory()) {
                audiodir.remove(true);
              }
              num += 1;
            } else {
              const modulePath = confModulePath(c.DataPath);
              if (modulePath) {
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
                }
                if (md.exists()) md.remove(true);
                num += 1;
              }
            }
          }
        }
      });
    }
  });
  return num;
}

// Install an array of xulsword module zip objects. Errors will be
// reported via NewModulesType (not thrown) if there are problems
// to report during installation. Progress will be sent via IPC to
// the xulsword window. NOTE: destdir will be ignored when installing
// xulsword specific module components. NOTE-2: LibSword should be ready
// upon entering this function, but it will be quit before modules
// are installed, then another function must be responsible for
// restarting it.
export async function installZIPs(
  zips: ZIP[],
  destdirs?: string | string[],
  callingWinID?: number
): Promise<NewModulesType> {
  return new Promise((resolve) => {
    const newmods: NewModulesType = clone(C.NEWMODS);
    if (zips.length) {
      // Get installed module list to remove any obsoleted modules.
      const installed: { module: string; dir: string; cipherKey: string }[] =
        [];
      if (!LibSword.isReady()) LibSword.init();
      const mods: string = LibSword.getModuleList();
      if (mods !== C.NOMODULES) {
        mods.split(C.CONFSEP).forEach((ms) => {
          const module = ms.split(';')[0];
          let dir = LibSword.getModuleInformation(
            module,
            'AbsoluteDataPath'
          ).replace(/\/modules\/.*$/, '');
          dir = fpath.resolve(dir).split(fpath.sep).join('/');
          const cipherKey = LibSword.getModuleInformation(module, 'CipherKey');
          installed.push({ module, dir, cipherKey });
        });
      }
      LibSword.quit();
      // Initialize progress reporter
      let progTot = 0;
      let progNow = 0;
      const progress = (prog: number) => {
        let w = BrowserWindow.fromId(callingWinID ?? -1);
        if (w) {
          w?.setProgressBar(prog);
          w?.webContents.send('progress', prog);
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
        const confs = {} as { [i: string]: SwordConfType };
        sortedZipEntries.forEach((entry) => {
          if (!entry.entryName.endsWith('/')) {
            log.silly(`Processing Entry: ${entry.entryName}`);
            const type = entry.entryName.split('/').shift();
            switch (type) {
              case 'mods.d': {
                const dest = new LocalFile(destdir);
                const confstr = entry.getData().toString('utf8');
                const conf = parseSwordConf(confstr, entry.name);
                // Look for any problems with the module itself
                const modreports = clone(conf.reports);
                modreports.push(...moduleUnsupported(conf));
                const swmodpath =
                  conf.DataPath && confModulePath(conf.DataPath);
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
                    (mo) => mo.cipherKey !== '' && mo.cipherKey !== C.NOTFOUND
                  )
                ) {
                  modreports.push({
                    error: `(${conf.module}) Will not replace encrypted module because new encrypted module has no encrpytion key.`,
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
                  // Remove any existing module having this name unless it would be downgraded.
                  if (confdest.exists()) {
                    const existing = parseSwordConf(confdest, entry.name);
                    const replace =
                      versionCompare(
                        conf.Version ?? 0,
                        existing.Version ?? 0
                      ) !== -1;
                    if (!replace) {
                      modreports.push({
                        error: `(${conf.module}) ${
                          conf.Version ?? 0
                        } Will not overwrite newer module ${existing.module}.`,
                      });
                    } else if (!moveRemoveModule([conf.module], destdir)) {
                      modreports.push({
                        error: `(${conf.module}) Could not remove existing module.`,
                      });
                    }
                  }
                }
                // If module and target is ok, check valid swmodpath, remove obsoletes,
                // create module directory path, and if still ok, copy config file.
                if (!modreports.some((r) => r.error) && swmodpath) {
                  // Remove any module(s) obsoleted by this module.
                  if (conf.Obsoletes?.length) {
                    const obsoletes = conf.Obsoletes.filter((m) => {
                      return installed.find((ins) => ins.module === m);
                    });
                    obsoletes.forEach((om) => {
                      const omdir = installed.find((ins) => ins.module === om);
                      if (omdir && !moveRemoveModule(om, omdir.dir)) {
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
                  if (
                    moddest.exists() ||
                    !moddest.create(LocalFile.DIRECTORY_TYPE, {
                      recursive: true,
                    })
                  ) {
                    modreports.push({
                      error: `(${conf.module}) Could not create module directory '${moddest.path}'.`,
                    });
                  } else {
                    // Copy config file to mods.d
                    confdest.writeFile(confstr);
                    confs[conf.module] = conf;
                    newmods.modules.push(conf);
                    if (conf.CipherKey === '') {
                      newmods.nokeymods.push(conf);
                    }
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
                const audio = Dirs.xsAudio;
                const parts = fpath.posix.parse(entry.entryName);
                const audiotype = parts.ext.substring(1).toLowerCase();
                let audioCode: string | undefined;
                if (/^\d+$/.test(parts.name)) {
                  // Bible audio files...
                  const chapter = Number(parts.name.replace(/^0+(?!$)/, ''));
                  const dirs = parts.dir.split('/');
                  const book = dirs.pop();
                  audioCode = dirs.pop();
                  if (
                    audioCode &&
                    book &&
                    !Number.isNaN(chapter) &&
                    (audiotype === 'mp3' || audiotype === 'ogg')
                  ) {
                    audio.append(audioCode);
                    if (!audio.exists()) {
                      audio.create(LocalFile.DIRECTORY_TYPE);
                    }
                    audio.append(book);
                    if (!audio.exists()) {
                      audio.create(LocalFile.DIRECTORY_TYPE);
                    }
                    audio.append(entry.name);
                    audio.writeFile(entry.getData());
                    const ret: AudioFile = {
                      audioCode,
                      book,
                      chapter,
                      file: parts.base,
                      type: audiotype,
                    };
                    newmods.audio.push(ret);
                  } else audioCode = undefined;
                } else {
                  // Genbook audio files...
                  const path = parts.dir.split('/');
                  path.shift(); // don't need language code
                  audioCode = path.shift();
                  if (
                    audioCode &&
                    (audiotype === 'mp3' || audiotype === 'ogg')
                  ) {
                    const n: GenBookAudioFile = {
                      genbook: true,
                      audioCode,
                      path,
                      file: parts.base,
                      type: audiotype,
                    };
                    newmods.audio.push(n);
                  } else audioCode = undefined;
                }
                // Write a config file to allow repository listing
                if (audioCode) {
                  const conf = Dirs.xsAudio;
                  conf.append('mods.d');
                  conf.append(`${audioCode.toLowerCase()}.conf`);
                  if (!conf.exists()) {
                    conf.writeFile(
                      `[${audioCode}]\nDataPath=./${audioCode}/\nModDrv=audio\n`
                    );
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
  zipmods: (ZIP | string)[],
  destdir?: string | string[],
  callingWinID?: number
) {
  let newmods: NewModulesType;
  if (zipmods.length) {
    const zips: (ZIP | null)[] = [];
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
    newmods = await installZIPs(z, d, callingWinID);
  } else {
    newmods = clone(C.NEWMODS);
  }
  Subscription.publish.modulesInstalled(newmods, callingWinID);
  return newmods;
}

const Module = {
  // Return a promise for the CrossWire master repository list as an
  // array of Download objects. These can be passed to repositoryListing()
  // for retrieval of each repository's complete set of config files. A
  // string is returned if there were errors or the operation was canceled.
  async crossWireMasterRepoList(): Promise<Repository[] | string> {
    const mr = {
      domain: 'ftp.crosswire.org',
      path: fpath.posix.join('pub', 'sword'),
      file: 'masterRepoList.conf',
      name: 'CrossWire Master List',
    };
    const cancelkey = downloadKey(mr);
    if (ftpCancel(cancelkey, true)) return C.UI.Manager.cancelMsg;
    const result: Repository[] | string = [];
    let fbuffer: Buffer;
    try {
      fbuffer = await getFile(
        mr.domain,
        fpath.posix.join(mr.path, mr.file),
        cancelkey
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
    manifests: (FTPDownload | null)[]
  ): Promise<(RepositoryListing | string)[]> {
    const callingWinID = (arguments[1] ?? -1) as number;
    const promises = manifests.map(async (manifest) => {
      const progress = (prog: number) => {
        if (!manifest) return;
        const dlk = downloadKey(manifest);
        log.silly(`REPO progress ${dlk}: ${prog}`);
        const w = BrowserWindow.fromId(callingWinID);
        w?.webContents.send('progress', prog, dlk);
      };
      let value = null;
      if (manifest && !manifest.disabled) {
        if (isRepoLocal(manifest)) {
          if (fpath.isAbsolute(manifest.path)) {
            const modsd = new LocalFile(manifest.path).append('mods.d');
            if (modsd.exists() && modsd.isDirectory()) {
              const confs: SwordConfType[] = [];
              modsd.directoryEntries.forEach((de) => {
                const f = modsd.clone().append(de);
                if (!f.isDirectory() && f.path.endsWith('.conf')) {
                  const conf = parseSwordConf(f, de);
                  conf.sourceRepository = manifest;
                  confs.push(conf);
                }
              });
              value = confs;
            } else value = `Directory not found: ${manifest.path}/mods.d`;
          } else value = `Path not absolute: ${manifest.path}/mods.d`;
          return value;
        }
        let files: { header: { name: string }; content: Buffer }[] | null = [];
        const cancelkey = downloadKey(manifest);
        if (ftpCancel(cancelkey, true)) return C.UI.Manager.cancelMsg;
        try {
          const targzbuf = await getFile(
            manifest.domain,
            fpath.posix.join(manifest.path, manifest.file),
            cancelkey,
            progress
          );
          files = await untargz(targzbuf);
        } catch (er: any) {
          // If there was no SwordRepoManifest, then download every conf file.
          let listing: ListingElementR[] | null = null;
          let bufs: Buffer[] | null = null;
          try {
            if (!/Could not get file size/i.test(er)) throw er;
            listing = await list(
              manifest.domain,
              fpath.posix.join(manifest.path, 'mods.d'),
              cancelkey,
              '',
              1
            );
            bufs = await getFiles(
              manifest.domain,
              listing.map((l) =>
                fpath.posix.join(manifest.path, 'mods.d', l.name)
              ),
              cancelkey,
              progress
            );
            bufs.forEach((b, i) => {
              if (files && listing) {
                files.push({ header: { name: listing[i].name }, content: b });
              }
            });
          } catch (err: any) {
            if (progress) progress(-1);
            return err.message;
          }
        }

        if (files) {
          const confs: SwordConfType[] = [];
          files.forEach((r) => {
            const { header, content: buffer } = r;
            if (header.name.endsWith('.conf')) {
              const cobj = parseSwordConf(
                buffer.toString('utf8'),
                header.name.replace(/^.*?mods\.d\//, '')
              );
              cobj.sourceRepository = manifest;
              confs.push(cobj);
              /*
              if (cobj.module === 'Kapingamarangi') {
                log.info('Kapingamarangi: ', buffer.toString('utf8'));
              }
              */
            }
          });
          value = confs;
        }
      }
      if (progress) progress(-1);
      return value;
    });

    return Promise.allSettled(promises).then((results) => {
      const ret: (RepositoryListing | string)[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled')
          ret.push(result.value as RepositoryListing);
        else ret.push(result.reason.toString() as string);
      });
      return ret;
    });
  },

  // Download a SWORD module from a repository and save it as a zip object
  // for later installation by installDownload. Returns the number of files
  // if successful, or a string error/cancel message otherwise.
  async download(download: Download): Promise<number | string> {
    const callingWinID = (arguments[1] ?? -1) as number;
    const downloadkey = downloadKey(download);
    if (ftpCancel(downloadkey, true)) return C.UI.Manager.cancelMsg;
    const progress = (prog: number) => {
      log.silly(`SWORD progress ${downloadkey}: ${prog}`);
      let w = BrowserWindow.fromId(callingWinID);
      w?.webContents.send('progress', prog, downloadkey);
      w = null;
    };
    if ('http' in download) {
      // Audio XSM modules are HTTP downloads
      const { http } = download;
      progress(0);
      try {
        const tmpdir = new LocalFile(Window.tmpDir({ id: callingWinID }));
        if (tmpdir.exists()) {
          log.silly(`downloadFileHTTP`, http, tmpdir.path);
          const dlfile = await getFileHTTP(
            http,
            tmpdir.append(randomID()),
            downloadkey,
            progress
          );
          Downloads[downloadkey] = new ZIP(dlfile.path);
          progress(-1);
          return 1;
        }
        throw new Error(`Could not create tmp directory '${tmpdir.path}'.`);
      } catch (er: any) {
        progress(-1);
        log.silly(er);
        return Promise.resolve(er.message);
      }
    } else if ('file' in download) {
      // Other XSM modules are ZIP files
      const { domain, path, file } = download;
      const fp = fpath.posix.join(path, file);
      log.silly(`downloadXSM`, domain, fp);
      progress(0);
      try {
        const zipBuf = await getFile(domain, fp, downloadkey, progress);
        Downloads[downloadkey] = new ZIP(zipBuf);
        progress(-1);
        return 1;
      } catch (er: any) {
        progress(-1);
        log.silly(er);
        return Promise.resolve(er.message);
      }
    }
    // Standard SWORD modules. First download conf file.
    const { domain, path, confname } = download;
    const confpath = fpath.posix.join(path, 'mods.d', confname);
    let confbuf;
    progress(0);
    try {
      confbuf = await getFile(domain, confpath, downloadkey);
    } catch (er: any) {
      progress(-1);
      log.silly(er);
      return Promise.resolve(er.message);
    }
    const conf = parseSwordConf(confbuf.toString('utf8'), confname);

    // Download module contents
    const datapath = confModulePath(conf.DataPath);
    if (datapath) {
      const modpath = fpath.posix.join(path, datapath);
      let modfiles;
      try {
        modfiles = await getDir(
          domain,
          modpath,
          /\/lucene\//,
          downloadkey,
          progress
        );
      } catch (er: any) {
        progress(-1);
        log.silly(er);
        return Promise.resolve(er.message);
      }
      const zip = new ZIP();
      zip.addFile(fpath.posix.join('mods.d', confname), confbuf);
      modfiles.forEach((fp) => {
        zip.addFile(
          fpath.posix.join(datapath, fp.listing.subdir, fp.listing.name),
          fp.buffer
        );
      });
      Downloads[downloadkey] = zip;
      progress(-1);
      return zip.getEntries().length;
    }
    progress(-1);
    const msg = `Unexpected DataPath in ${confname}: ${conf.DataPath}`;
    log.silly(msg);
    return msg;
  },

  // Cancel in-process downloads and/or previous downloads.
  // IMPORTANT: cancel() should also always be called when a session
  // is finished, to delete all waiting connections.
  cancel(downloads?: Download[]): number {
    let canceled = 0;
    if (downloads === undefined) {
      canceled += httpCancel();
      canceled += ftpCancel();
      destroyFTPconnection();
      canceled += Object.keys(Downloads).length;
      Downloads = {};
      return canceled;
    }
    downloads?.forEach((dl) => {
      let cnt = 0;
      const downloadkey = downloadKey(dl);
      if ('http' in dl) {
        cnt += httpCancel(downloadkey);
      } else {
        cnt += ftpCancel(downloadkey);
      }
      log.verbose(`Module.cancel(${downloadkey}) = ${cnt}`);
      if (downloadkey in Downloads) {
        delete Downloads[downloadkey];
        cnt += 1;
      }
      canceled += cnt;
    });
    return canceled;
  },

  // Set windows to modal before calling this function!
  async installDownloads(
    installs: { download: Download; toRepo: Repository }[],
    callingWinID?: number
  ): Promise<NewModulesType> {
    const zipobj: ZIP[] = [];
    const destdir: string[] = [];
    Object.entries(Downloads).forEach((entry) => {
      const [downloadkey, zipo] = entry;
      const save = installs.find(
        (s) => downloadKey(s.download) === downloadkey
      );
      if (zipo && save && isRepoLocal(save.toRepo)) {
        const repo = new LocalFile(save.toRepo.path);
        if (repo.exists() && repo.isDirectory()) {
          zipobj.push(zipo);
          destdir.push(repo.path);
        }
      }
    });
    Downloads = {};
    return modalInstall(zipobj, destdir, callingWinID);
  },

  // Set windows to modal before calling this function!
  // After this function, if installDownloads() will not be called,
  // then modulesInstalled must be published on the main process.
  async remove(
    modules: { name: string; repo: Repository }[]
  ): Promise<boolean[]> {
    const results: boolean[] | PromiseLike<boolean[]> = [];
    modules.forEach((module) => {
      const { name, repo } = module;
      if (isRepoLocal(repo)) {
        results.push(!!moveRemoveModule([name], repo.path));
      }
    });

    return results;
  },

  // Set windows to modal before calling this function!
  // After this function, if installDownloads() will not be called,
  // then modulesInstalled must be published on the main process.
  async move(
    modules: { name: string; fromRepo: Repository; toRepo: Repository }[]
  ): Promise<boolean[]> {
    const results: boolean[] | PromiseLike<boolean[]> = [];
    modules.forEach((module) => {
      const { name, fromRepo, toRepo } = module;
      if (isRepoLocal(fromRepo) && isRepoLocal(toRepo)) {
        results.push(!!moveRemoveModule([name], fromRepo.path, toRepo.path));
      }
    });

    return results;
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
      LibSword.quit();
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
        callerWinID ?? getBrowserWindows({ type: 'xulsword' })[0].id
      );
    }
  },
};

export default Module;
