/* eslint-disable prefer-rest-params */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fpath from 'path';
import { BrowserWindow, ipcMain, IpcMainEvent, shell } from 'electron';
import ZIP from 'adm-zip';
import log from 'electron-log';
import { isRepoLocal, modrepKey, parseSwordConf } from '../common';
import Subscription from '../subscription';
import C from '../constant';
import Window, { getBrowserWindows, publishSubscription } from './window';
import LocalFile from './components/localFile';
import Dirs from './components/dirs';
import LibSword from './components/libsword';
import {
  ftpCancel,
  getFile,
  getDir,
  resetFTP,
  downloadFileHTTP,
} from './components/downloader';

import type {
  AudioFile,
  GenBookAudioFile,
  GType,
  ModTypes,
  NewModulesType,
  Repository,
  SwordConfType,
} from '../type';

// CrossWire SWORD Standard TODOS:
// TODO! DisplayLevel: GenBook standard display's context levels
// TODO! CrossWire wiki mentions LangSortOrder! Report change to KeySort
// TODO! UnlockInfo: Display instructions for obtaining an unlock key

function versionCompare(v1: string | number, v2: string | number) {
  const p1 = String(v1).split('.');
  const p2 = String(v2).split('.');
  do {
    let n1: any = p1.shift();
    let n2: any = p2.shift();
    if (!n1) n1 = 0;
    if (!n2) n2 = 0;
    if (Number(n1) && Number(n2)) {
      if (n1 < n2) return -1;
      if (n1 > n2) return 1;
    } else if (n1 < n2) {
      return -1;
    } else if (n1 > n2) {
      return 1;
    }
  } while (p1.length || p2.length);

  return 0;
}

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
export function moduleUnsupported(module: string | SwordConfType): string[] {
  const reasons = [];
  const conf = typeof module === 'string' ? null : module;
  const module2 = (conf ? conf.module : module) as string;
  let moddrv;
  let minimumVersion;
  if (conf) {
    moddrv = conf.ModDrv;
    minimumVersion = conf.MinimumVersion;
  } else {
    moddrv = LibSword.getModuleInformation(module2, 'ModDrv');
    minimumVersion = LibSword.getModuleInformation(module2, 'MinimumVersion');
  }
  if (!minimumVersion || minimumVersion === C.NOTFOUND) minimumVersion = '0';
  const type = getTypeFromModDrv(moddrv);
  if (type && Object.keys(C.SupportedModuleTypes).includes(type)) {
    if (versionCompare(C.SWORDEngineVersion, minimumVersion) < 0) {
      reasons.push(
        `${module2}: Requires SWORD engine version ${minimumVersion} or greater (using ${C.SWORDEngineVersion})`
      );
    }
  } else {
    reasons.push(`${module2}: Is unsupported type '${type || moddrv}'`);
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
    log.error(`Destination does not exist: '${moveTo}'.`);
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
          const c = parseSwordConf(f);
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
// are installed, then other functions are responsible for restarting it.
export async function installZIPs(
  zips: ZIP[],
  destdirs?: string | string[]
): Promise<NewModulesType> {
  return new Promise((resolve) => {
    const newmods: NewModulesType = {
      modules: [],
      fonts: [],
      bookmarks: [],
      audio: [],
      errors: [],
    };
    if (zips.length) {
      // Get installed module list.
      const installed: { module: string; dir: string }[] = [];
      if (LibSword.isReady()) {
        const mods: string = LibSword.getModuleList();
        if (mods !== C.NOMODULES) {
          mods.split(C.CONFSEP).forEach((ms) => {
            const module = ms.split(';')[0];
            let dir = LibSword.getModuleInformation(
              module,
              'AbsoluteDataPath'
            ).replace(/\/modules\/.*$/, '');
            dir = fpath.resolve(dir).split(fpath.sep).join('/');
            installed.push({ module, dir });
          });
        }
      }
      LibSword.quit();
      // Initialize progress reporter
      const xswin = getBrowserWindows({ type: 'xulsword' })[0];
      let progTot = 0;
      let progNow = 0;
      const progress = (prog: number) => {
        xswin.setProgressBar(prog);
        xswin.webContents.send('progress', prog);
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
                const conf = parseSwordConf(
                  confstr,
                  entry.entryName.split('/').pop()
                );
                const reasons = moduleUnsupported(conf);
                const swmodpath =
                  conf.DataPath && confModulePath(conf.DataPath);
                if (!swmodpath) {
                  reasons.push(
                    `${conf.module}: Has non-standard module path '${conf.DataPath}'`
                  );
                }
                if (!dest.exists() || !dest.isDirectory()) {
                  reasons.push(
                    `${conf.module}: Destination directory does not exist '${dest.path}`
                  );
                }
                if (!reasons.length) {
                  reasons.push(...conf.errors);
                  const confdest = dest.clone();
                  confdest.append('mods.d');
                  if (!confdest.exists()) {
                    confdest.create(LocalFile.DIRECTORY_TYPE);
                  }
                  confdest.append(entry.name);
                  // Remove any existing module having this name.
                  if (
                    confdest.exists() &&
                    !moveRemoveModule([conf.module], destdir)
                  ) {
                    newmods.errors.push(
                      `${conf.module}: Could not remove existing module.`
                    );
                  } else if (swmodpath) {
                    // Remove any module(s) obsoleted by this module.
                    if (conf.Obsoletes?.length) {
                      const obsoletes = conf.Obsoletes.filter((m) => {
                        return installed.find((ins) => ins.module === m);
                      });
                      obsoletes.forEach((om) => {
                        const omdir = installed.find(
                          (ins) => ins.module === om
                        );
                        if (omdir && !moveRemoveModule(om, omdir.dir)) {
                          newmods.errors.push(
                            `${conf.module}: Could not remove obsoleted module(s).`
                          );
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
                      newmods.errors.push(
                        `${conf.module}: Failed to create new module destination directory: '${moddest.path}'`
                      );
                    } else {
                      // Copy config file to mods.d
                      confdest.writeFile(confstr);
                      confs[conf.module] = conf;
                      newmods.modules.push(conf);
                    }
                  }
                } else {
                  newmods.errors.push(...reasons);
                }
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
                      newmods.errors.push(
                        `${conf.module}: Failed to copy module file" ${moddest.path}`
                      );
                    }
                  } else {
                    newmods.errors.push(
                      `${conf.module}: Module directory does not exist: ${moddest.path}`
                    );
                  }
                } else {
                  newmods.errors.push(
                    `File does not belong to any module: ${entry.entryName}`
                  );
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
                newmods.errors.push(`Unknown module component: ${entry.name}`);
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
export async function modalInstall(
  zipmods: (ZIP | string)[],
  destdir?: string | string[],
  targWin?: Electron.BrowserWindow | null,
  xenterModal?: boolean,
  xexitModal?: boolean
) {
  const enterModal = xenterModal ?? true; // default is to enter Modal at entry
  const exitModal = xexitModal ?? true; // default is to exit Modal on exit
  const xswin = getBrowserWindows({ type: 'xulsword' })[0];
  const tgwin = targWin || xswin;
  if (enterModal) {
    Window.modal('transparent', 'all');
    Window.modal('darkened', tgwin);
  }
  const zips: (ZIP | null)[] = [];
  zipmods.forEach((zipmod) => {
    if (typeof zipmod === 'string') {
      const zipfile = new LocalFile(zipmod);
      if (zipfile.exists()) {
        zips.push(new ZIP(zipmod));
      } else {
        log.warn(`Zip module does not exist: '${zipfile.path}'`);
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
  const newmods = await installZIPs(z, d);
  if (newmods.errors.length) {
    shell.beep();
    log.error(
      `Module installation problems follow:\n${newmods.errors.join('\n')}`
    );
  } else {
    log.info('ALL FILES WERE SUCCESSFULLY INSTALLED!');
  }
  Subscription.publish('resetMain');
  Subscription.publish('modulesInstalled', newmods);

  // reload was necessary to get dynamic CSS to take effect
  if (targWin) {
    Window.reset('all', xswin);
    targWin.webContents.reload();
  } else {
    xswin.webContents.reload();
  }

  if (exitModal) {
    getBrowserWindows({ type: 'search' }).forEach((w) => {
      w.webContents.reload();
    });
    Window.modal('off', 'all');
  }

  ipcMain.once('did-finish-render', (event: IpcMainEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    // So the calling window can show the newly installed modules.
    if (win) publishSubscription([win], 'modulesInstalled', newmods);
  });
  return newmods;
}

let Downloads: { [modrepoKey: string]: ZIP } = {};

const Module: GType['Module'] = {
  async downloadXSM(
    module: string,
    zipFileOrURL: string,
    repository: Repository
  ): Promise<number | string> {
    const callingWin = arguments[3] || null;
    ftpCancel(false);
    const modrepk = modrepKey(module, repository);
    const progress = (prog: number) => {
      log.silly(`progress ${prog}`);
      callingWin?.webContents.send('progress', prog, modrepk);
    };
    progress(0);
    let message = 'Canceled';
    if (/^https?:\/\//i.test(zipFileOrURL)) {
      // Audio XSM download (http)
      try {
        const tmpdir = new LocalFile(Window.tmpDir(callingWin));
        if (tmpdir.exists()) {
          log.debug(`downloadFileHTTP`, zipFileOrURL, tmpdir.path);
          const dlfile = await downloadFileHTTP(
            zipFileOrURL,
            tmpdir.append(module),
            progress
          );
          if (typeof dlfile !== 'string') {
            Downloads[modrepk] = new ZIP(dlfile.path);
            return 1;
          }
          message = dlfile;
        } else {
          throw new Error(`Could not create tmp directory: '${tmpdir.path}'`);
        }
      } catch (err: any) {
        progress(-1);
        return Promise.resolve(err.toString());
      }
    } else {
      // Regular XSM download (ftp)
      try {
        const fp = fpath.posix.join(repository.path, zipFileOrURL);
        log.debug(`downloadXSM`, repository.domain, fp);
        const zipBuf = await getFile(repository.domain, fp, progress);
        if (zipBuf) {
          Downloads[modrepk] = new ZIP(zipBuf);
          return 1;
        }
      } catch (er: any) {
        progress(-1);
        return Promise.resolve(er.toString());
      }
    }
    progress(-1);
    return message;
  },

  // Download a SWORD module from a repository and save it as a zip object
  // for later installation by saveDownload. Returns the number of files if
  // successful or a string message if error or canceled.
  async download(
    module: string,
    repository: Repository
  ): Promise<number | string> {
    const callingWin = arguments[2] || null;
    ftpCancel(false);
    const modrepk = modrepKey(module, repository);
    const progress = (prog: number) => {
      log.silly(`progress ${prog}`);
      callingWin?.webContents.send('progress', prog, modrepk);
    };
    progress(0);
    let confname = `${module.toLocaleLowerCase()}.conf`;
    let confpath = fpath.join(repository.path, 'mods.d', confname);
    let confbuf;
    try {
      confbuf = await getFile(repository.domain, confpath);
    } catch {
      confname = `${module}.conf`;
      confpath = fpath.join(repository.path, 'mods.d', confname);
      try {
        confbuf = await getFile(repository.domain, confpath);
      } catch (er: any) {
        progress(-1);
        return Promise.resolve(er.toString());
      }
    }
    if (confbuf) {
      const conf = parseSwordConf(confbuf.toString('utf8'), confname);
      const datapath = confModulePath(conf.DataPath);
      if (datapath) {
        const modpath = fpath.join(repository.path, datapath);
        let modfiles;
        try {
          modfiles = await getDir(
            repository.domain,
            modpath,
            /\/lucene\//,
            progress
          );
        } catch (er: any) {
          progress(-1);
          return Promise.resolve(er.toString());
        }
        if (modfiles && modfiles.length) {
          const zip = new ZIP();
          zip.addFile(fpath.join('mods.d', confname), confbuf);
          modfiles.forEach((fp) => {
            zip.addFile(
              fpath.join(datapath, fp.listing.subdir, fp.listing.name),
              fp.buffer
            );
          });
          Downloads[modrepk] = zip;
          return zip.getEntries().length;
        }
      }
    }
    progress(-1);
    return 'Canceled';
  },

  async saveDownloads(
    saves: { module: string; fromRepo: Repository; toRepo: Repository }[],
    enterModal?: boolean,
    exitModal?: boolean
  ): Promise<NewModulesType> {
    const zipobj: ZIP[] = [];
    const destdir: string[] = [];
    Object.entries(Downloads).forEach((entry) => {
      const [modrepok, zipo] = entry;
      const save = saves.find(
        (s) => modrepKey(s.module, s.fromRepo) === modrepok
      );
      if (zipo && save && isRepoLocal(save.toRepo)) {
        const repo = new LocalFile(save.toRepo.path);
        if (repo.exists() && repo.isDirectory()) {
          zipobj.push(zipo);
          destdir.push(repo.path);
        }
      }
    });
    return modalInstall(zipobj, destdir, null, enterModal, exitModal);
  },

  async remove(
    modules: { name: string; repo: Repository }[],
    enterModal?: boolean,
    exitModal?: boolean
  ): Promise<boolean[]> {
    const results: boolean[] | PromiseLike<boolean[]> = [];

    if (enterModal) Window.modal('darkened', 'all');

    modules.forEach((module) => {
      const { name, repo } = module;
      if (isRepoLocal(repo)) {
        results.push(!!moveRemoveModule([name], repo.path));
      }
    });

    if (exitModal) {
      Subscription.publish('resetMain');
      getBrowserWindows({ type: 'search' }).forEach((w) => {
        w.webContents.reload();
      });
      Window.reset('all', 'all');
      Window.modal('off', 'all');
    }

    return results;
  },

  async move(
    modules: { name: string; fromRepo: Repository; toRepo: Repository }[],
    enterModal?: boolean,
    exitModal?: boolean
  ): Promise<boolean[]> {
    const results: boolean[] | PromiseLike<boolean[]> = [];

    if (enterModal) Window.modal('darkened', 'all');

    modules.forEach((module) => {
      const { name, fromRepo, toRepo } = module;
      if (isRepoLocal(fromRepo) && isRepoLocal(toRepo)) {
        results.push(!!moveRemoveModule([name], fromRepo.path, toRepo.path));
      }
    });

    if (exitModal) {
      Subscription.publish('resetMain');
      getBrowserWindows({ type: 'search' }).forEach((w) => {
        w.webContents.reload();
      });
      Window.reset('all', 'all');
      Window.modal('off', 'all');
    }

    return results;
  },

  clearDownload(module?: string, repository?: Repository): boolean {
    if (!module) {
      resetFTP();
      Downloads = {};
      return true;
    }
    if (repository) {
      resetFTP(repository.domain);
      const key = modrepKey(module, repository);
      if (key in Downloads) {
        delete Downloads[key];
        return true;
      }
    }
    return false;
  },
};

export default Module;
