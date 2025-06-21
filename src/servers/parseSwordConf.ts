import i18n from 'i18next';
import path from 'path';
import Dirs from './components/dirs.ts';

import C from '../constant.ts';
import {
  builtinRepos,
  isAudioVerseKey,
  JSON_parse,
  readVerseKeyAudioConf,
} from '../common.ts';

import type {
  GenBookAudioConf,
  NewModuleReportType,
  Repository,
  SwordConfType,
  VerseKeyAudioConf,
} from '../type.ts';
import type LocalFile from './components/localFile.ts';

// Return a SwordConfType object from a config LocalFile, or else from
// the string contents of a config file.
export default function parseSwordConf(
  config:
    | LocalFile
    | {
        confString: string;
        filename: string;
        sourceRepository: Repository | string;
      },
): SwordConfType {
  // Find and save sourceRepository and filename
  let confString: string;
  let filename: string;
  let sourceRepositoryOrPath: Repository | string;
  if ('confString' in config) {
    ({
      confString,
      filename,
      sourceRepository: sourceRepositoryOrPath,
    } = config);
  } else {
    confString = config.readFile();
    filename = config.leafName;
    sourceRepositoryOrPath = config.path;
  }
  if (typeof sourceRepositoryOrPath === 'string') {
    const p = path.parse(sourceRepositoryOrPath);
    const mypath = path.normalize(p.dir.replace(/[/\\]mods\.d.*$/, ''));
    const srcrepo = builtinRepos(i18n, Dirs.path).find(
      (r) => path.normalize(r.path) === mypath,
    );
    if (srcrepo) sourceRepositoryOrPath = srcrepo;
  }
  const sourceRepository =
    typeof sourceRepositoryOrPath !== 'string'
      ? sourceRepositoryOrPath
      : {
          name: 'unknown',
          domain: 'file://',
          path: sourceRepositoryOrPath,
          builtin: false,
          custom: true,
        };
  const reports: NewModuleReportType[] = [];
  const lines = confString.split(/[\n\r]+/);

  // Fill in the SwordConfType return value
  const r = { filename, sourceRepository } as SwordConfType;
  C.SwordConf.repeatable.forEach((en) => {
    r[en] = [];
  });
  const commentRE = /^(#.*|\s*)$/;
  for (let x = 0; x < lines.length; x += 1) {
    const l = lines[x];
    let m;
    if (commentRE.test(l)) {
      // ignore comments
    } else if (C.SwordModuleStartRE.test(l)) {
      // name might not be at the top of the file
      m = l.match(C.SwordModuleStartRE);
      if (m) [, r.module] = m;
    } else {
      m = l.match(/^([A-Za-z0-9_.]+)\s*=\s*(.*?)\s*$/);
      if (m) {
        // Handle an entry:
        const [, entry] = m;
        let [, , value] = m;
        const entryBase: string =
          entry.substring(0, entry.indexOf('_')) || entry;

        // Handle line continuation.
        if (
          C.SwordConf.continuation.includes(entryBase as never) &&
          value.endsWith('\\')
        ) {
          let nval = value.substring(0, value.length - 1);
          for (;;) {
            x += 1;
            nval += lines[x];
            if (!nval.endsWith('\\')) break;
            nval = nval.substring(0, nval.length - 1);
          }
          value = nval;
        }

        // Check for HTML where it shouldn't be.
        const htmlTags = value.match(/<\w+[^>]*>/g);
        if (htmlTags) {
          if (!C.SwordConf.htmllink.includes(entryBase as never)) {
            reports.push({
              warning: `Config entry '${entry}' should not contain HTML.`,
            });
          }
          if (htmlTags.find((t) => !t.match(/<a\s+href="[^"]*"\s*>/))) {
            reports.push({
              warning: `HTML in entry '${entry}' should be limited to anchor tags with an href attribute.`,
            });
          }
        }

        // Check for RTF where it shouldn't be.
        const rtfControlWords = value.match(/\\\w[\w\d]*/);
        if (rtfControlWords) {
          if (!C.SwordConf.rtf.includes(entryBase as never)) {
            reports.push({
              warning: `Config entry '${entry}' should not contain RTF.`,
            });
          }
        }

        // Save the value according to value type.
        if (entryBase === 'History') {
          const [, version, locale] = entry.split('_');
          const loc = locale || 'en';
          if (version) {
            if (!r.History) r.History = [];
            const eold = r.History.find((y) => y[0] === version);
            const enew = eold || [version as string, {}];
            enew[1][loc || 'en'] = value;
            if (loc === i18n.language || (loc === 'en' && !enew[1].locale))
              enew[1].locale = value;
            if (!eold) r.History.push(enew);
          }
        } else if (entryBase === 'AudioChapters') {
          const ac = JSON_parse(value);
          const acy = ac as VerseKeyAudioConf | GenBookAudioConf;
          if (isAudioVerseKey(acy)) {
            r.AudioChapters = readVerseKeyAudioConf(acy);
          } else {
            r.AudioChapters = acy;
          }
        } else if (
          Object.keys(C.SwordConf.delimited).includes(entry as never)
        ) {
          const ent = entry as keyof typeof C.SwordConf.delimited;
          r[ent] = value.split(C.SwordConf.delimited[ent]);
        } else if (C.SwordConf.repeatable.includes(entry as never)) {
          const ent = entry as (typeof C.SwordConf.repeatable)[number];
          r[ent]?.push(value as never);
        } else if (C.SwordConf.integer.includes(entry as never)) {
          const ent = entry as (typeof C.SwordConf.integer)[number];
          r[ent] = Number(value);
        } else if (C.SwordConf.localization.includes(entryBase as never)) {
          const ent = entryBase as (typeof C.SwordConf.localization)[number];
          const loc = entry.substring(entryBase.length + 1) || 'en';
          if (!(ent in r)) r[ent] = {};
          const o = r[ent];
          if (o) {
            o[loc] = value;
            if (loc === i18n.language || (loc === 'en' && !o.locale))
              o.locale = value;
          }
        } else {
          // default is string;
          const rx = r as any;
          rx[entry] = value;
        }
      }
    }
  }

  // Check, warn and fix SWORD enums
  const direction = ['LtoR', 'RtoL', 'BiDi'];
  if (r.Direction && !direction.includes(r.Direction)) {
    const was = r.Direction;
    r.Direction = /rt/i.test(r.Direction) ? 'RtoL' : 'LtoR';
    reports.push({
      warning: `Config Direction must be one of '${direction.toString()}'; was '${was}'; is '${r.Direction}'`,
    });
  }

  // Add remaining non-SWORD-standard entries
  r.xsmType = 'none';
  if (r.ModDrv === 'audio') r.xsmType = 'XSM_audio';
  else if (r.DataPath.endsWith('.xsm')) r.xsmType = 'XSM';
  r.moduleType = 'Generic Books';
  if (r.ModDrv.includes('Text')) r.moduleType = 'Biblical Texts';
  else if (r.ModDrv.includes('Com')) r.moduleType = 'Commentaries';
  else if (r.ModDrv.includes('LD')) r.moduleType = 'Lexicons / Dictionaries';
  else if (r.xsmType === 'XSM_audio') r.moduleType = r.xsmType;

  // Add module name to reports
  r.reports = reports.map((rp) => {
    const nr: any = {};
    Object.entries(rp).forEach((entry) => {
      nr[entry[0]] = `${r.module}: ${entry[1]}`;
    });
    return nr;
  });

  // In server mode, filter entries that contain file references.
  if (Build.isWebApp) {
    if (!r.DataPath.startsWith('http')) {
      r.DataPath = serverPublicPath(r.DataPath);
    }
    if (/^file:\/\//i.test(r.sourceRepository.domain)) {
      r.sourceRepository.domain = process.env.WEBAPP_CORS_ORIGIN || '';
      r.sourceRepository.path = serverPublicPath(r.sourceRepository.path);
    }
  }

  return r;
}

// Take a server path and return the full path IF it is public, or else return
// null if it is not public. IMPORTANT: never return a fileFullPath string in
// any response from a public server, as full server paths should be kept secret.
export function fileFullPath(serverPublicPath: string): string | null {
  // Electron public paths are already full paths and are all allowed.
  if (Build.isElectronApp) return serverPublicPath;
  const root = process.env.WEBAPP_SERVERROOT_DIR;
  const publics = process.env.WEBAPP_PUBPATHS;
  if (root && publics) {
    const pubs = publics.split(';');
    for (let i = 0; i < pubs.length; i++) {
      const pub = pubs[i].substring(1);
      const serverPublicPath2 = serverPublicPath.replace(/^\//, '');
      if (serverPublicPath2.startsWith(pub)) {
        return [root, serverPublicPath2].join('/');
      }
    }
  }
  return null;
}

// Returns a server public path or an empty string. If filePath is publicly
// accessible, the public portion of the file path is returned.
export function serverPublicPath(fileFullPath: string): string {
  // Electron public paths are always full paths and are all allowed.
  if (Build.isElectronApp) return fileFullPath;
  const root = process.env.WEBAPP_SERVERROOT_DIR;
  const publics = process.env.WEBAPP_PUBPATHS;
  if (root && publics) {
    const pubs = publics.split(';');
    for (let i = 0; i < pubs.length; i++) {
      const pub = pubs[i].substring(1);
      if (fileFullPath.startsWith([root, pub].join('/'))) {
        return fileFullPath.replace(root, '');
      }
    }
  }
  return '';
}

// Check and convert all file references according to our context. In Electron,
// file paths remain unchanged, but in server mode, file paths are converted
// into server URLs, or are filtered out if they are not in a public directory.
export function publicFiles(aString: string): string {
  if (Build.isWebApp) {
    // If running as a public server on the Internet
    return aString.replace(
      /(['"])file:\/\/(.*?)\1/gi,
      (_m, m1, m2: string) => `${m1}${serverPublicPath(m2)}${m1}`,
    );
  }
  return aString;
}
