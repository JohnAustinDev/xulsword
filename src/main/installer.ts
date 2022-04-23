/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { getBrowserWindows } from './window';
import C from '../constant';
import LocalFile from './components/localFile';
import Dirs from './components/dirs';
import LibSword from './components/libsword';

import type {
  ModTypes,
  NewModulesType,
  SwordConfType,
  ZipEntryType,
} from '../type';

// CrossWire SWORD Standard TODOS:
// TODO! DisplayLevel: GenBook standard display's context levels
// TODO! CrossWire wiki mentions LangSortOrder! Report change to KeySort
// TODO! UnlockInfo: Display instructions for obtaining an unlock key

const AdmZip = require('adm-zip');

export function parseSwordConf(config: string | LocalFile): SwordConfType {
  const conf = typeof config === 'string' ? config : config.readFile();
  const errors = [];
  const lines = conf.split(/[\n\r]+/);
  const r = {} as SwordConfType;
  C.SwordConf.repeatable.forEach((en) => {
    r[en] = [];
  });
  const nameRE = /^\[([A-Za-z0-9_]+)\]\s*$/;
  const commentRE = /^(#.*|\s*)$/;
  for (let x = 0; x < lines.length; x += 1) {
    const l = lines[x];
    let m;
    if (commentRE.test(l)) {
      // ignore comments
    } else if (nameRE.test(l)) {
      // name might not be at the top of the file
      m = l.match(nameRE);
      if (m) [, r.module] = m;
    } else {
      m = l.match(/^([A-Za-z0-9_.]+)\s*=\s*(.*?)\s*$/);
      if (m) {
        const entry = m[1] as any;
        let value = m[2] as string;
        const entryBase = entry.substring(0, entry.indexOf('_')) || entry;
        // Handle line continuation.
        if (
          C.SwordConf.continuation.includes(entryBase) &&
          value.endsWith('\\')
        ) {
          const contRE = /[\s*]\\$/;
          let nval = value.replace(contRE, '');
          for (;;) {
            x += 1;
            nval += lines[x];
            if (!nval.endsWith('\\')) break;
            nval = nval.replace(contRE, '');
          }
          value = nval;
        }
        // Check for HTML where it shouldn't be.
        const htmlTags = value.match(/<\w+[^>]*>/g);
        if (htmlTags) {
          if (!C.SwordConf.htmllink.includes(entryBase)) {
            errors.push(`Config entry '${entry}' should not contain HTML.`);
          }
          if (htmlTags.find((t) => !t.match(/<a\s+href="[^"]*"\s*>/))) {
            errors.push(
              `HTML in entry '${entry}' can only be anchor tags with an href attribute.`
            );
          }
        }
        // Check for RTF where it shouldn't be.
        const rtfControlWords = value.match(/\\\w[\w\d]*/);
        if (rtfControlWords) {
          if (!C.SwordConf.rtf.includes(entryBase)) {
            errors.push(
              `Warning: Config entry '${entry}' should not contain RTF.`
            );
          }
        }
        // Save the value according to value type.
        if (entryBase === 'History') {
          const [, version, locale] = entry.split('_');
          if (version) {
            if (!r.History) r.History = [];
            r.History.push([version, { [locale || 'en']: value }]);
          }
        } else if (C.SwordConf.repeatable.includes(entry)) {
          const ent = entry as typeof C.SwordConf.repeatable[number];
          r[ent].push(value);
        } else if (C.SwordConf.integer.includes(entry)) {
          const ent = entry as typeof C.SwordConf.integer[number];
          r[ent] = Number(value);
        } else if (C.SwordConf.string.includes(entry)) {
          const ent = entry as typeof C.SwordConf.string[number];
          r[ent] = value as SwordConfType['ModDrv'];
        } else if (C.SwordConf.localization.includes(entryBase)) {
          const ent = entryBase as typeof C.SwordConf.localization[number];
          const loc = entry.substring(entryBase.length + 1) || 'en';
          if (!r[ent]) r[ent] = {};
          r[ent][loc] = value;
        }
      }
    }
  }
  r.errors = errors.map((er) => `${r.module}: ${er}`);
  log.silly(`${r.module} conf: `, r);
  return r;
}

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

// Remove one or more modules from either the user module directory or the shared one.
// Returns the number of modules succesfully removed.
export function removeModule(
  modules: string | string[],
  sharedModuleDir = false
): number {
  let num = 0;
  const ma = Array.isArray(modules) ? modules : [modules];
  ma.forEach((m) => {
    const moddir = new LocalFile(
      sharedModuleDir ? Dirs.path.xsModsCommon : Dirs.path.xsModsUser
    );
    moddir.append('mods.d');
    const subs = moddir.directoryEntries;
    if (subs) {
      subs.forEach((conf) => {
        const f = moddir.clone();
        f.append(conf);
        if (!f.isDirectory() && f.path.endsWith('.conf')) {
          const c = parseSwordConf(f);
          if (c.module === m) {
            f.remove();
            const modulePath = confModulePath(c.DataPath);
            if (modulePath) {
              const md = moddir.clone();
              md.append(modulePath);
              if (md.exists()) md.remove(true);
              num += 1;
            }
          }
        }
      });
    }
  });
  return num;
}

// Installs an array of xulsword module files either to the xulsword module directory,
// or the shared SWORD module directory. Errors will be reported (not thrown) if a file
// does not exist or there is a problem during installation. If progressWin is prov-
// ided, then progress will be reported to that window.
export default async function installList(
  paths: string[],
  toSharedDir = false,
  progressWin?: BrowserWindow
): Promise<NewModulesType> {
  return new Promise((resolve) => {
    const newmods: NewModulesType = {
      modules: [],
      fonts: [],
      bookmarks: [],
      audio: [],
      errors: [],
    };
    if (paths.length) {
      // First get a listing of the contents of all zip files (to init the progress bar)
      const xswin = getBrowserWindows({ type: 'xulsword' })[0];
      const zipEntries: ZipEntryType[] = [];
      paths.forEach((f) => {
        const zipfile = new LocalFile(f);
        if (zipfile.exists()) {
          zipEntries.push(...new AdmZip(f).getEntries());
        } else {
          newmods.errors.push(`File does not exist: '${f}'`);
        }
      });
      const progTot = zipEntries.length;
      let progNow = 0;
      progressWin?.webContents.send('progress', 0);
      const updateProgress = (prognow: number) => {
        if (prognow === -1) {
          xswin.setProgressBar(-1);
          progressWin?.webContents.send('progress', -1);
        } else {
          const progress = prognow / progTot;
          xswin.setProgressBar(progress);
          progressWin?.webContents.send('progress', progress);
        }
      };
      updateProgress(0);
      // Then process each zip file entry.
      if (zipEntries.length) {
        const sortedZipEntries = zipEntries.sort((a, b) => {
          const ac = a.name.endsWith('.conf');
          const bc = b.name.endsWith('.conf');
          if (ac && !bc) return -1;
          if (!ac && bc) return 1;
          return 0;
        });
        const installed: string[] = [];
        if (LibSword.isReady()) {
          const mods: string = LibSword.getModuleList();
          if (mods !== C.NOMODULES) {
            mods.split(C.CONFSEP).forEach((ms) => {
              installed.push(ms.split(';')[0]);
            });
          }
        }
        LibSword.quit();
        const confs = {} as { [i: string]: SwordConfType };
        sortedZipEntries.forEach((entry) => {
          if (!entry.entryName.endsWith('/')) {
            log.silly(`Processing Entry: ${entry.entryName}`);
            const type = entry.entryName.split('/').shift();
            switch (type) {
              case 'mods.d': {
                const moddest = new LocalFile(
                  toSharedDir ? Dirs.path.xsModsCommon : Dirs.path.xsModsUser
                );
                const confstr = entry.getData().toString('utf8');
                const conf = parseSwordConf(confstr);
                const reasons = moduleUnsupported(conf);
                const swmodpath =
                  conf.DataPath && confModulePath(conf.DataPath);
                if (!swmodpath) {
                  reasons.push(
                    `${conf.module}: Has non-standard module path '${conf.DataPath}'`
                  );
                }
                if (!reasons.length) {
                  reasons.push(...conf.errors);
                  moddest.append('mods.d');
                  if (!moddest.exists()) {
                    moddest.create(LocalFile.DIRECTORY_TYPE);
                  }
                  moddest.append(entry.name);
                  // Remove any existing module having this name.
                  if (moddest.exists() && !removeModule([conf.module])) {
                    newmods.errors.push(
                      `${conf.module}: Could not remove existing module.`
                    );
                  } else if (swmodpath) {
                    // Remove any module(s) obsoleted by this module.
                    if (conf.Obsoletes.length) {
                      const obsoletes = conf.Obsoletes.filter((m) => {
                        return installed.includes(m);
                      });
                      if (obsoletes.length && !removeModule(obsoletes)) {
                        newmods.errors.push(
                          `${conf.module}: Could not remove obsoleted module(s).`
                        );
                      }
                    }
                    // Make sure module destination directory exists and is empty.
                    const destdir = new LocalFile(
                      toSharedDir
                        ? Dirs.path.xsModsCommon
                        : Dirs.path.xsModsUser
                    );
                    destdir.append(swmodpath);
                    if (destdir.exists()) {
                      destdir.remove(true);
                    }
                    if (
                      destdir.exists() ||
                      !destdir.create(LocalFile.DIRECTORY_TYPE, {
                        recursive: true,
                      })
                    ) {
                      newmods.errors.push(
                        `${conf.module}: Failed to create new module destination directory: '${destdir.path}'`
                      );
                    } else {
                      // Copy config file to mods.d
                      moddest.writeFile(confstr);
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
                  const destdir = new LocalFile(
                    toSharedDir ? Dirs.path.xsModsCommon : Dirs.path.xsModsUser
                  );
                  destdir.append(swmodpath);
                  // If this module is to be installed, the destination directory has already been
                  // succesfully created, otherwise silently skip.
                  if (destdir.exists()) {
                    const parts = entry.entryName
                      .substring(swmodpath.length + 1)
                      .split('/');
                    parts.forEach((p, i) => {
                      destdir.append(p);
                      if (i === parts.length - 1) {
                        destdir.writeFile(entry.getData());
                      } else if (!destdir.exists()) {
                        destdir.create(LocalFile.DIRECTORY_TYPE);
                      }
                    });
                    if (!destdir.exists()) {
                      newmods.errors.push(
                        `${conf.module}: Failed to copy module file" ${destdir.path}`
                      );
                    }
                  } else {
                    newmods.errors.push(
                      `${conf.module}: Module directory does not exist: ${destdir.path}`
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
                // TODO! audio install
                newmods.audio.push(entry.name);
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
          updateProgress(progNow);
        });
        updateProgress(-1);
      }
    }
    resolve(newmods);
  });
}
