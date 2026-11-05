import fs from 'fs';
import fpath from 'path';
import { createHash } from 'crypto';
import log from 'electron-log';
import C from '../../constant.ts';
import Dirs from '../components/dirs.ts';

// Files obtained by URL are cached on disk for C.DownloadCacheTime, so that
// opening the Module Manager again does not download masterRepoList.conf and
// every repository manifest again. Each URL has a data file and a JSON info
// file in Dirs.xsDownloadCache. The info file is written last, so its
// modification time is the time the entry was cached, and an entry without
// one is ignored. Errors and canceled downloads are never cached.

export type DownloadCacheInfo = {
  url: string;
  // HTTP only: response headers and the final URL after any redirects.
  headers?: Array<[string, string]>;
  finalURL?: string;
};

// Entries that expired are removed at most this often.
const PruneInterval = 60000;
let LastPrune = 0;

function entryPaths(url: string): { data: string; info: string } {
  const hash = createHash('sha256').update(url).digest('hex');
  const dir = Dirs.path.xsDownloadCache;
  return {
    data: fpath.join(dir, `${hash}.dat`),
    info: fpath.join(dir, `${hash}.json`),
  };
}

function isFresh(infoPath: string): boolean {
  try {
    const { mtimeMs } = fs.statSync(infoPath);
    const age = Date.now() - mtimeMs;
    return age >= 0 && age < C.DownloadCacheTime;
  } catch {
    return false;
  }
}

function removeEntry(paths: { data: string; info: string }) {
  [paths.info, paths.data].forEach((p) => {
    try {
      fs.rmSync(p, { force: true });
    } catch (er) {
      log.warn(`Could not remove download cache file: ${p}: ${er}`);
    }
  });
}

// Remove expired entries, and any files left by an interrupted write.
function prune() {
  const now = Date.now();
  if (now - LastPrune < PruneInterval) return;
  LastPrune = now;
  const dir = Dirs.path.xsDownloadCache;
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  names.forEach((name) => {
    const p = fpath.join(dir, name);
    if (name.endsWith('.json')) {
      if (!isFresh(p)) {
        removeEntry({ info: p, data: p.replace(/\.json$/, '.dat') });
      }
    } else if (name.endsWith('.dat')) {
      if (!names.includes(name.replace(/\.dat$/, '.json'))) {
        removeEntry({ info: '', data: p });
      }
    } else {
      // Temporary files of an interrupted write.
      try {
        if (now - fs.statSync(p).mtimeMs > C.DownloadCacheTime)
          fs.rmSync(p, { force: true });
      } catch {
        // ignore
      }
    }
  });
}

// Return the info of a fresh cache entry for url, or null if there is none.
function freshEntry(
  url: string,
): { info: DownloadCacheInfo; data: string } | null {
  if (!C.DownloadCacheTime) return null;
  prune();
  const paths = entryPaths(url);
  if (!isFresh(paths.info) || !fs.existsSync(paths.data)) return null;
  try {
    const info = JSON.parse(
      fs.readFileSync(paths.info, 'utf8'),
    ) as DownloadCacheInfo;
    // A hash collision is practically impossible, but check anyway.
    if (info.url !== url) return null;
    return { info, data: paths.data };
  } catch (er) {
    log.warn(`Bad download cache entry for ${url}: ${er}`);
    removeEntry(paths);
    return null;
  }
}

function writeEntry(
  url: string,
  writeData: (tmpPath: string) => void,
  info?: Omit<DownloadCacheInfo, 'url'>,
) {
  if (!C.DownloadCacheTime) return;
  const paths = entryPaths(url);
  const tmp = `${paths.data}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.mkdirSync(Dirs.path.xsDownloadCache, { recursive: true });
    writeData(tmp);
    fs.renameSync(tmp, paths.data);
    fs.writeFileSync(paths.info, JSON.stringify({ ...info, url }));
    log.silly(`Download cached: ${url}`);
  } catch (er) {
    log.warn(`Could not cache download ${url}: ${er}`);
    fs.rmSync(tmp, { force: true });
    removeEntry(paths);
  }
  prune();
}

const DownloadCache = {
  // Return the cached contents of url, or null if not cached.
  read(url: string): { buffer: Buffer; info: DownloadCacheInfo } | null {
    const entry = freshEntry(url);
    if (!entry) return null;
    try {
      const buffer = fs.readFileSync(entry.data);
      log.silly(`Download cache hit: ${url}`);
      return { buffer, info: entry.info };
    } catch (er) {
      log.warn(`Could not read download cache for ${url}: ${er}`);
      return null;
    }
  },

  // Copy the cached contents of url to the dest path and return its info, or
  // return null if not cached.
  readToFile(url: string, dest: string): DownloadCacheInfo | null {
    const entry = freshEntry(url);
    if (!entry) return null;
    try {
      fs.copyFileSync(entry.data, dest);
      log.silly(`Download cache hit: ${url}`);
      return entry.info;
    } catch (er) {
      log.warn(`Could not copy download cache for ${url}: ${er}`);
      return null;
    }
  },

  write(url: string, buffer: Buffer, info?: Omit<DownloadCacheInfo, 'url'>) {
    writeEntry(url, (tmp) => fs.writeFileSync(tmp, buffer), info);
  },

  // Cache a copy of the downloaded file at path src.
  writeFromFile(
    url: string,
    src: string,
    info?: Omit<DownloadCacheInfo, 'url'>,
  ) {
    writeEntry(url, (tmp) => fs.copyFileSync(src, tmp), info);
  },

  // Remove all cached downloads.
  clear() {
    const dir = Dirs.path.xsDownloadCache;
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return;
    }
    names.forEach((name) => {
      try {
        fs.rmSync(fpath.join(dir, name), { force: true });
      } catch (er) {
        log.warn(`Could not remove download cache file: ${name}: ${er}`);
      }
    });
    log.verbose(`Cleared download cache`);
  },
};

export default DownloadCache;
