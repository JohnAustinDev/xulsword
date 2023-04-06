/* eslint-disable @typescript-eslint/no-explicit-any */
import i18n from 'i18next';
import path from 'path';
import Dirs from './components/dirs';

import C from '../constant';
import {
  builtinRepos,
  isAudioVerseKey,
  JSON_parse,
  readDeprecatedGenBookAudioConf,
  readDeprecatedVerseKeyAudioConf,
  readVerseKeyAudioConf,
} from '../common';
import {
  DeprecatedAudioChaptersConf,
  GenBookAudioConf,
  NewModuleReportType,
  Repository,
  SwordConfType,
  VerseKeyAudioConf,
} from '../type';
import type LocalFile from './components/localFile';

// Return a SwordConfType object from a config LocalFile, or else from
// the string contents of a config file.
export default function parseSwordConf(
  config:
    | LocalFile
    | {
        confString: string;
        filename: string;
        sourceRepository: Repository | string;
      }
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
      (r) => path.normalize(r.path) === mypath
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
        const entry = m[1] as any;
        let value = m[2] as string;
        const entryBase = entry.substring(0, entry.indexOf('_')) || entry;

        // Handle line continuation.
        if (
          C.SwordConf.continuation.includes(entryBase) &&
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
          if (!C.SwordConf.htmllink.includes(entryBase)) {
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
          if (!C.SwordConf.rtf.includes(entryBase)) {
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
          let ac = JSON_parse(value);
          if (Array.isArray(ac) && 'bk' in ac[0]) {
            // Deprecated bk, ch1, ch2 API
            ac = ac as DeprecatedAudioChaptersConf[];
            if (
              Object.values(C.SupportedBooks).some((bg: any) =>
                bg.includes(ac[0].bk)
              )
            ) {
              r.AudioChapters = readDeprecatedVerseKeyAudioConf(ac);
            } else {
              r.AudioChapters = readDeprecatedGenBookAudioConf(ac);
            }
          } else {
            ac = ac as VerseKeyAudioConf | GenBookAudioConf;
            if (isAudioVerseKey(ac)) {
              r.AudioChapters = readVerseKeyAudioConf(ac);
            } else {
              r.AudioChapters = ac;
            }
          }
        } else if (Object.keys(C.SwordConf.delimited).includes(entry)) {
          const ent = entry as keyof typeof C.SwordConf.delimited;
          r[ent] = value.split(C.SwordConf.delimited[ent]);
        } else if (C.SwordConf.repeatable.includes(entry)) {
          const ent = entry as typeof C.SwordConf.repeatable[number];
          r[ent]?.push(value as any);
        } else if (C.SwordConf.integer.includes(entry)) {
          const ent = entry as typeof C.SwordConf.integer[number];
          r[ent] = Number(value);
        } else if (C.SwordConf.localization.includes(entryBase)) {
          const ent = entryBase as typeof C.SwordConf.localization[number];
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
  const direction: SwordConfType['Direction'][] = ['LtoR', 'RtoL', 'BiDi'];
  if (r.Direction && !direction.includes(r.Direction)) {
    const was = r.Direction;
    r.Direction = /rt/i.test(r.Direction) ? 'RtoL' : 'LtoR';
    reports.push({
      warning: `Config Direction must be one of '${direction}'; was '${was}'; is '${r.Direction}'`,
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

  return r;
}
