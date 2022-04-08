/* eslint-disable no-continue */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Window, { getBrowserWindows } from './window';
import Subscription from '../subscription';
import C from '../constant';
import nsILocalFile from './components/nsILocalFile';
import Dirs from './modules/dirs';
import LibSword from './modules/libsword';
import { jsdump } from './mutil';

import type { ModTypes, NewModulesType, SwordConfType } from '../type';

const AdmZip = require('adm-zip');

let progTot = 0;
let progNow = 0;

type ZipEntryType = {
  entryName: string;
  name: string;
  isDirectory: boolean;
  getData: () => Buffer;
  toString: () => string;
};

export function parseModConfString(conf: string): SwordConfType {
  const lines = conf.split(/[\n\r]+/);
  const r = {} as SwordConfType;
  for (let x = 0; x < lines.length; x += 1) {
    const l = lines[x];
    let m;
    if (x === 0) {
      m = l.match(/^\[([\w\d]+)\]\s*$/);
      if (m) [, r.module] = m;
    } else {
      m = l.match(/^(\w+)\s*=\s*(.*?)\s*$/);
      if (m) {
        const entry = m[1] as keyof SwordConfType;
        const value = m[2] as any;
        r[entry] = value;
      }
    }
  }
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
    const moddir = new nsILocalFile(
      sharedModuleDir ? Dirs.path.xsModsCommon : Dirs.path.xsModsUser
    );
    moddir.append('mods.d');
    const subs = moddir.directoryEntries;
    if (subs) {
      subs.forEach((conf) => {
        const f = moddir.clone();
        f.append(conf);
        if (!f.isDirectory() && f.path.endsWith('.conf')) {
          const c = parseModConfString(f.readFile());
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

function install(
  zipfile: string,
  entries: ZipEntryType[],
  sharedModuleDir = false
): NewModulesType {
  const results: NewModulesType = {
    modules: [],
    fonts: [],
    bookmarks: [],
    audio: [],
    errors: [],
  };
  const confs = {} as { [i: string]: SwordConfType };
  entries
    .sort((a, b) => {
      const ac = a.name.endsWith('.conf');
      const bc = b.name.endsWith('.conf');
      if (ac && !bc) return -1;
      if (!ac && bc) return 1;
      return a.name.localeCompare(b.name);
    })
    .forEach((entry) => {
      if (!entry.entryName.endsWith('/')) {
        jsdump(`Processing Entry:${zipfile}, ${entry.entryName}`);
        const type = entry.entryName.split('/').shift();
        switch (type) {
          case 'mods.d': {
            const moddest = new nsILocalFile(
              sharedModuleDir ? Dirs.path.xsModsCommon : Dirs.path.xsModsUser
            );
            const confstr = entry.getData().toString('utf8');
            const conf = parseModConfString(confstr);
            const reasons = moduleUnsupported(conf);
            const swmodpath = conf.DataPath && confModulePath(conf.DataPath);
            if (!swmodpath) {
              reasons.push(
                `${conf.module}: Has non-standard module path '${conf.DataPath}'`
              );
            }
            if (!reasons.length) {
              moddest.append('mods.d');
              if (!moddest.exists()) {
                moddest.create(nsILocalFile.DIRECTORY_TYPE);
              }
              moddest.append(entry.name);
              // Remove any existing module having this name.
              if (moddest.exists() && !removeModule([conf.module])) {
                results.errors.push(
                  `${conf.module}: Could not remove existing module (shared=${sharedModuleDir})`
                );
              } else if (swmodpath) {
                // Make sure module destination directory exists and is empty.
                const destdir = new nsILocalFile(
                  sharedModuleDir
                    ? Dirs.path.xsModsCommon
                    : Dirs.path.xsModsUser
                );
                destdir.append(swmodpath);
                if (destdir.exists()) {
                  destdir.remove(true);
                }
                if (
                  destdir.exists() ||
                  !destdir.create(nsILocalFile.DIRECTORY_TYPE, {
                    recursive: true,
                  })
                ) {
                  results.errors.push(
                    `${conf.module}: Failed to create new module destination directory: '${destdir.path}'`
                  );
                } else {
                  // Copy config file to mods.d
                  moddest.writeFile(confstr);
                  confs[conf.module] = conf;
                  results.modules.push(conf);
                }
              }
            } else {
              results.errors.push(...reasons);
            }
            break;
          }

          case 'modules': {
            const conf = Object.values(confs).find((c) => {
              const swmodpath = confModulePath(c.DataPath);
              return swmodpath && entry.entryName.startsWith(swmodpath);
            });
            const swmodpath = conf && confModulePath(conf.DataPath);
            if (conf && swmodpath) {
              const destdir = new nsILocalFile(
                sharedModuleDir ? Dirs.path.xsModsCommon : Dirs.path.xsModsUser
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
                    destdir.create(nsILocalFile.DIRECTORY_TYPE);
                  }
                });
              }
            } else {
              results.errors.push(
                `File does not belong to any module: ${entry.entryName}`
              );
            }
            break;
          }

          case 'fonts': {
            const fontsdir = Dirs.xsFonts;
            fontsdir.append(entry.name);
            fontsdir.writeFile(entry.getData());
            results.fonts.push(entry.name);
            break;
          }

          case 'bookmarks': {
            const bmdir = Dirs.xsBookmarks;
            bmdir.append(entry.name);
            bmdir.writeFile(entry.getData());
            results.bookmarks.push(entry.name);
            break;
          }

          case 'audio': {
            // TODO! audio install
            results.audio.push(entry.name);
            break;
          }

          case 'chrome':
          case 'locale':
          case 'video':
            // No longer supported, just ignore without error...
            break;

          default:
            jsdump(
              `WARNING: Unknown module component: ${zipfile}/${entry.name}`
            );
        }
      }
      progNow += 1;
    });
  getBrowserWindows({ type: 'xulsword' })[0].setProgressBar(progNow / progTot);
  return results;
}

// Installs an array of zip modules and returns an error string if there are
// errors, or the empty string otherwise.
export default async function installZipModules(
  paths: string[],
  toSharedModuleDir = false
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
      const modules: { [i: string]: ZipEntryType[] } = {};
      progTot = 0;
      paths.forEach((f) => {
        const fobj = new nsILocalFile(f);
        if (fobj.exists()) {
          const zip = new AdmZip(f);
          modules[f] = zip.getEntries();
          progTot += modules[f].length;
        } else {
          newmods.errors.push(`File does not exist: '${f}'`);
        }
      });
      // Then process each zip file.
      const modentries = Object.entries(modules);
      if (modentries.length) {
        progNow = 0;
        LibSword.quit();
        modentries.forEach((entry) => {
          const [f, entries] = entry;
          Object.entries(install(f, entries, toSharedModuleDir)).forEach(
            (n) => {
              const key = n[0] as keyof NewModulesType;
              const array = n[1] as any[];
              newmods[key].push(...array);
            }
          );
        });
        Subscription.publish('resetMain');
        Window.reset('all', 'all');
        Subscription.publish('modulesInstalled', newmods);
        xswin.setProgressBar(-1);
      }
    }
    resolve(newmods);
  });
}
