/* eslint-disable promise/no-nesting */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable promise/no-promise-in-callback */
/* eslint-disable promise/param-names */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fpath from 'path';
import log from 'electron-log';
import FTP, { ListingElement } from 'ftp';
import GUNZIP from 'gunzip-maybe';
import TAR from 'tar-stream';
import { Stream, Readable } from 'stream';
import { downloadKey, isRepoLocal, parseSwordConf } from '../../common';
import C from '../../constant';
import LocalFile from './localFile';

import type {
  GType,
  Download,
  SwordConfType,
  RepositoryListing,
} from '../../type';

type ListingElementR = ListingElement & { subdir: string };

let CancelFTP = true;

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const buf: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      buf.push(chunk);
    });
    stream.on('end', () => {
      log.silly(`stream on-end.`);
      resolve(Buffer.concat(buf));
    });
    stream.on('error', (err) => {
      log.silly(`stream on-error: '${err}'.`);
      reject(err);
    });
  });
}

// Use an FTP connection to a remote server to run an arbitrary
// function and return an arbitrary promise. Returns null if
// canceled. Up to FTPMaxConnectionsPerDomain will be created
// per domain. If that many are currently running, this function
// will use the next connection to become free. Once all connections
// are free for a period of time, they will all be closed.
const connections: { [domain: string]: FTP[] } = {};
const freeConnections: { [domain: string]: FTP[] } = {};
const waitingFuncs: { [domain: string]: unknown[] } = {};
const connectTimeouts: { [domain: string]: NodeJS.Timeout | null } = {};
export async function connect<Retval>(
  domain: string,
  func: (c: FTP) => Promise<Retval>
): Promise<Retval | null> {
  if (CancelFTP) return null;
  if (!(domain in connections)) {
    connections[domain] = [];
    freeConnections[domain] = [];
    waitingFuncs[domain] = [];
    connectTimeouts[domain] = null;
  }
  return new Promise((resolve, reject) => {
    const clearto = () => {
      const to = connectTimeouts[domain];
      if (to) {
        clearTimeout(to);
        connectTimeouts[domain] = null;
      }
    };
    clearto();
    const runFunc = async (c: FTP) => {
      const result = await func(c);
      if (waitingFuncs[domain].length) {
        const next = waitingFuncs[domain].shift();
        if (typeof next === 'function') {
          log.silly(`ftp connect on-ready-wait.`);
          next(c);
        }
      } else {
        const i = connections[domain].indexOf(c);
        if (i === -1)
          throw Error(`FTP connection to ${domain} does not exist.`);
        connections[domain].splice(i, 1);
        freeConnections[domain].push(c);
        console.log(connections[domain].length);
        if (!connections[domain].length) {
          clearto();
          connectTimeouts[domain] = setTimeout(() => {
            freeConnections[domain].forEach((con) => con.end());
          }, 4000);
        }
      }
      resolve(result);
    };
    if (freeConnections[domain].length) {
      const c = freeConnections[domain].shift() as FTP;
      connections[domain].push(c);
      log.silly(`ftp connect on-ready-free.`);
      runFunc(c);
    }
    if (connections[domain].length < C.FTPMaxConnectionsPerDomain) {
      const c = new FTP();
      let cancelTO: NodeJS.Timeout | null = null;
      const reject0 = (err: Error) => {
        log.silly(`ftp connect reject: '${err}.`);
        if (cancelTO) clearInterval(cancelTO);
        c.destroy();
        reject(err);
      };
      c.on('error', (er: Error) => {
        log.silly(`ftp connect on-error: '${er}'.`);
        reject0(er);
      });
      c.on('close', (er: boolean) => {
        log.silly(`ftp connect on-close: '${er}'.`);
        if (cancelTO) clearInterval(cancelTO);
        if (er) reject0(new Error(`Error during connection close.`));
      });
      c.on('greeting', (msg: string) => {
        log.silly(`ftp connect on-greeting: '${msg}'.`);
      });
      c.on('end', () => {
        log.silly(`ftp connect on-end.`);
      });
      c.on('ready', () => {
        log.silly(`ftp connect on-ready.`);
        runFunc(c);
      });
      try {
        log.info(`Connecting: ${domain}`);
        c.connect({ host: domain });
        cancelTO = setInterval(() => {
          if (CancelFTP) {
            log.silly(`ftp cancel.`);
            if (cancelTO) clearInterval(cancelTO);
            c.destroy();
            resolve(null);
          }
        }, 300);
        connections[domain].push(c);
      } catch (er: any) {
        reject0(er);
      }
    } else {
      waitingFuncs[domain].push((c: FTP) => {
        runFunc(c);
      });
    }
  });
}

async function listP(c: FTP, dirpath: string): Promise<ListingElement[]> {
  return new Promise((resolve, reject) => {
    log.silly(`list(${dirpath})`);
    c.list(dirpath, false, (err: Error, listing: ListingElement[]) => {
      if (err) reject(err);
      else resolve(listing);
    });
  });
}

async function sizeP(c: FTP, filepath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    log.silly(`size(${filepath})`);
    c.size(filepath, (err: any, size: number) => {
      if (err) {
        reject(err);
      } else resolve(size);
    });
  });
}

async function getP(
  c: FTP,
  filepath: string,
  progress?: (prog: number) => void,
  size?: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    log.silly(`get(${filepath})`);
    c.get(filepath, (err: Error, stream: NodeJS.ReadableStream) => {
      if (err) {
        reject(err);
      } else {
        if (progress) {
          progress(0);
          if (size) {
            let current = 0;
            stream.on('data', (chunk: Buffer) => {
              current += chunk.length;
              progress(current / size);
            });
          }
        }
        const buff = streamToBuffer(stream);
        stream.once('close', () => {
          if (progress) progress(-1);
          resolve(buff);
          log.silly(`DONE get(${filepath})`);
        });
      }
    });
  });
}

// Lists a directory path on a domain using FTP and returns a promise for
// a recursive listing of the directory's contents (unless norecurse is set
// which will only list the contents of the directory itself).
export async function list(
  domain: string,
  dirpath: string,
  basepath = '',
  maxdepth = 5,
  depth = 1
): Promise<ListingElementR[] | null> {
  if (CancelFTP) return null;
  const promises: Promise<ListingElementR[] | null>[] = [];
  const listing = (await connect(domain, (c: FTP) =>
    listP(c, dirpath)
  )) as ListingElementR[];
  listing.forEach((file) => {
    file.subdir = basepath;
  });
  promises.push(Promise.resolve(listing as ListingElementR[]));
  if (depth < maxdepth) {
    const subs = listing.filter((f) => f.type === 'd');
    const proms = subs.map((f) =>
      list(
        domain,
        fpath.join(dirpath, f.name),
        fpath.join(basepath, f.name),
        maxdepth,
        depth + 1
      )
    );
    promises.push(...proms);
  }
  return Promise.all(promises).then((lists) => {
    log.silly(`list(${dirpath}):`, lists.flat().length);
    if (lists.includes(null)) return null;
    return lists.flat() as ListingElementR[];
  });
}

// Take an FTP connection and filepath and return a Buffer promise.
// Progress is reported if a progress function is provided. Returns
// null if canceled.
export async function getFile(
  domain: string,
  filepath: string,
  progress?: ((p: number) => void) | null
): Promise<Buffer | null> {
  if (CancelFTP) {
    if (progress) progress(-1);
    return null;
  }
  return connect(domain, async (c: FTP) => {
    if (progress) {
      const size = await sizeP(c, filepath);
      return getP(c, filepath, progress, size);
    }
    return getP(c, filepath);
  });
}

// Downloads a directory from a domain using FTP, returning it as path/data
// object promise. If canceled, null is returned. If a progress function
// is provided, it will be used to report progress.
export async function getDir(
  domain: string,
  dirpath: string,
  skipPathRegex: RegExp,
  progress?: ((prog: number) => void) | null
): Promise<{ listing: ListingElementR; buffer: Buffer }[] | null> {
  if (!CancelFTP) {
    const listing = await list(domain, dirpath);
    if (listing) {
      const files = listing.filter(
        (l) =>
          l.type === '-' &&
          !skipPathRegex.test(fpath.join(dirpath, l.subdir, l.name))
      );
      const buffers = await getFiles(
        domain,
        files.map((l) => fpath.join(dirpath, l.subdir, l.name)),
        progress
      );
      if (buffers) {
        return files.map((l, i) => {
          return { listing: l, buffer: buffers[i] };
        });
      }
    }
    return [];
  }
  return null;
}

// Downloads an array of files from a domain, returning a Buffer array
// promise. If FTP was canceled null is returned. If a progress function
// is provided, it will be used to report progress.
export async function getFiles(
  domain: string,
  files: string[],
  progress?: ((prog: number) => void) | null
): Promise<Buffer[] | null> {
  if (CancelFTP) {
    if (progress) progress(-1);
    return null;
  }
  if (progress) progress(0);
  const total = files.length;
  let prog = 0;
  const bufpromises = files.map(async (f) => {
    const b = await getFile(domain, f);
    prog += 1;
    if (progress) progress(prog / total);
    return b;
  });
  return Promise.all(bufpromises)
    .then((bufs) => {
      if (progress) progress(-1);
      if (bufs.includes(null)) return null;
      return bufs as Buffer[];
    })
    .catch((er) => {
      if (progress) progress(-1);
      throw er;
    });
}

// Take a tar.gz or tar file as a Buffer or else a file path string,
// and decode it, returning the contents as an array of
// { header, buffer }.
export async function untargz(
  inp: Buffer | string
): Promise<{ header: TAR.Headers; content: Buffer }[]> {
  const result: { header: any; content: Buffer }[] = [];
  let stream: Stream | null = null;
  if (typeof inp === 'string') {
    const file = new LocalFile(inp);
    if (file.exists() && !file.isDirectory()) {
      stream = Readable.from(file.readBuf());
    }
  } else {
    stream = Readable.from(inp);
  }
  if (stream) {
    const extract = TAR.extract();
    stream.pipe(GUNZIP()).pipe(extract);
    return new Promise((resolve, reject) => {
      extract.on(
        'entry',
        (header: TAR.Headers, stream2: Readable, next: () => void) => {
          log.silly(`untargz received stream2.`);
          streamToBuffer(stream2)
            .then((content: Buffer) => {
              return result.push({ header, content });
            })
            .catch((er) => reject(er));
          stream2.on('end', () => next());
          stream2.resume(); // just auto drain the stream
        }
      );
      extract.on('finish', () => {
        return resolve(result);
      });
    });
  }
  return result;
}

export function ftpCancel(value?: boolean) {
  CancelFTP = !!value;
}

const Downloader: GType['Downloader'] = {
  // Return the CrossWire master repository list as a Download
  // object array.
  async crossWireMasterRepoList() {
    const mr = {
      domain: 'ftp.crosswire.org',
      path: '/pub/sword/',
      file: 'masterRepoList.conf',
    };
    ftpCancel(false);
    return getFile(mr.domain, fpath.join(mr.path, mr.file)).then((fbuffer) => {
      const result: Download[] = [];
      if (fbuffer && typeof fbuffer !== 'string') {
        const fstring = fbuffer.toString('utf8');
        const regex = 'FTPSource=([^|]+)\\|([^|]+)\\|([^|]+)\\s*[\\n\\r]';
        fstring.match(new RegExp(regex, 'g'))?.forEach((mx: string) => {
          const m = mx.match(new RegExp(regex));
          if (m) {
            result.push({
              name: m[1],
              domain: m[2],
              path: m[3],
              file: 'mods.d.tar.gz',
            });
          }
        });
      }
      return result;
    });
  },

  // Takes an array of SWORD repositories and returns an array containing:
  // - SwordConfType object array from reading mods.d.tar.gz.
  // - Or a string error message if there was an error or canceled.
  // - Or null if the repository was null or disabled.
  // Progress on each repository is separately reported to the calling
  // window, but results are not returned until all repositories have
  // been completely handled.
  async repositoryListing(repositories) {
    const callingWin = arguments[1] || null;
    ftpCancel(false);
    const promises = repositories.map(async (repo) => {
      if (repo === null) return null;
      const progress = (prog: number) => {
        log.silly(`progress ${prog}`);
        callingWin?.webContents.send('progress', prog, downloadKey(repo));
      };
      if (repo.disabled) {
        progress(-1);
        return null;
      }
      if (isRepoLocal(repo)) {
        if (fpath.isAbsolute(repo.path)) {
          const modsd = new LocalFile(repo.path).append('mods.d');
          if (modsd.exists() && modsd.isDirectory()) {
            const confs: SwordConfType[] = [];
            modsd.directoryEntries.forEach((de) => {
              const f = modsd.clone().append(de);
              if (!f.isDirectory() && f.path.endsWith('.conf')) {
                const conf = parseSwordConf(f);
                conf.sourceRepository = repo;
                confs.push(conf);
              }
            });
            progress(-1);
            return confs;
          }
        }
        progress(-1);
        return `Directory not found: ${repo.path}/mods.d`;
      }
      let files: { header: { name: string }; content: Buffer }[] | null = [];
      try {
        const targzbuf = await getFile(
          repo.domain,
          fpath.join(repo.path, repo.file),
          progress
        );
        if (targzbuf === null) return 'Canceled';
        files = await untargz(targzbuf);
      } catch {
        // If there is no mods.d.tar.gz, then download every conf file.
        const listing = await list(
          repo.domain,
          fpath.join(repo.path, 'mods.d'),
          '',
          1
        );
        if (listing === null) return null;
        const bufs = await getFiles(
          repo.domain,
          listing.map((l) => fpath.join(repo.path, 'mods.d', l.name)),
          progress
        );
        if (bufs === null) return null;
        bufs.forEach((b, i) => {
          files?.push({ header: { name: listing[i].name }, content: b });
        });
      }
      if (!files) return 'Canceled';
      const confs: SwordConfType[] = [];
      files.forEach((r) => {
        const { header, content: buffer } = r;
        if (header.name.endsWith('.conf')) {
          const cobj = parseSwordConf(buffer.toString('utf8'), header.name);
          cobj.sourceRepository = repo;
          confs.push(cobj);
        }
      });
      return confs;
    });
    return Promise.allSettled(promises).then((results) => {
      const ret: RepositoryListing[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled') ret.push(result.value);
        else ret.push(result.reason.toString());
      });
      return ret;
    });
  },

  ftpCancel() {
    ftpCancel(true);
  },
};

export default Downloader;
