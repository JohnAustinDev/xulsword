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
import LocalFile from './localFile';

import type {
  GType,
  Download,
  SwordConfType,
  RepositoryListing,
} from '../../type';

type ListingElementR = ListingElement & { subdir: string };

let CancelFTP = true;

function streamToBuffer(stream: Readable): Promise<Buffer> {
  const buf: any[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      buf.push(chunk);
    });
    stream.on('end', () => {
      log.silly(`stream on-end.`);
      const buffer = Buffer.concat(buf);
      resolve(buffer);
    });
    stream.on('error', (err) => {
      log.silly(`stream on-error: '${err}'.`);
      reject(err);
    });
  });
}

// Make an FTP connection to a remote server, run an arbitrary
// function with it, and return an arbitrary promise. Returns
// null if canceled.
export async function connect<Retval>(
  domain: string,
  func: (c: FTP) => Promise<Retval>
): Promise<Retval | null> {
  if (CancelFTP) return null;
  return new Promise((resolve, reject) => {
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
      func(c)
        .then((result: Retval) => {
          c.end();
          return resolve(result);
        })
        .catch((er) => reject(er));
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
    } catch (er: any) {
      reject0(er);
    }
  });
}

async function listP(c: FTP, dirpath: string): Promise<ListingElement[]> {
  return new Promise((resolve, reject) => {
    c.list(dirpath, false, (err: Error, listing: ListingElement[]) => {
      if (err) reject(err);
      else resolve(listing);
    });
  });
}

// Takes an FTP connection and directory path and returns a promise for a
// recursive listing of the directory's contents (unless norecurse is set
// which will only list the contents of the directory itself).
export async function list(
  c: FTP,
  dirpath: string,
  basepath = '',
  maxdepth = 5,
  depth = 1
): Promise<ListingElementR[] | null> {
  if (CancelFTP) return null;
  const promises: Promise<ListingElementR[] | null>[] = [];
  const listing = (await listP(c, dirpath)) as ListingElementR[];
  listing.forEach((file) => {
    file.subdir = basepath;
  });
  promises.push(Promise.resolve(listing as ListingElementR[]));
  if (depth < maxdepth) {
    const subs = listing.filter((f) => f.type === 'd');
    const proms = subs.map((f) =>
      list(
        c,
        fpath.join(dirpath, f.name),
        fpath.join(basepath, f.name),
        maxdepth,
        depth + 1
      )
    );
    promises.push(...proms);
  }
  return Promise.all(promises).then((lists) => {
    log.silly(`list(${dirpath}):`, lists);
    if (lists.includes(null)) return null;
    return lists.flat() as ListingElementR[];
  });
}

// Takes an FTP connection and downloads a directory, returning it
// as path/data object promise. If canceled, null is returned. If a
// progress function is provided, it will be used to report progress.
export async function getDir(
  c: FTP,
  dirpath: string,
  skipPathRegex: RegExp,
  progress?: ((prog: number) => void) | null
): Promise<{ listing: ListingElementR; buffer: Buffer }[] | null> {
  if (!CancelFTP) {
    const listing = await list(c, dirpath);
    if (listing) {
      const files = listing.filter(
        (l) =>
          l.type === '-' &&
          !skipPathRegex.test(fpath.join(dirpath, l.subdir, l.name))
      );
      const buffers = await getFiles(
        c,
        files.map((l) => fpath.join(dirpath, l.subdir, l.name)),
        progress
      );
      if (buffers) {
        return files.map((l, i) => {
          return { listing: l, buffer: buffers[i] };
        });
      }
    }
  }
  return null;
}

// Take an FTP connection and filepath and return a Buffer promise.
// Progress is reported if a progress function is provided. Returns
// null if canceled.
export async function getFile(
  c: FTP,
  filepath: string,
  progress?: ((p: number) => void) | null
): Promise<Buffer | null> {
  if (CancelFTP) {
    if (progress) progress(-1);
    return null;
  }
  return new Promise((resolve, reject) => {
    log.silly(`getFile(${filepath})`);
    const getWithProgress = (size?: number) => {
      c.get(filepath, (err: Error, stream: any) => {
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
            log.silly(`DONE getFile(${filepath})`);
          });
        }
      });
    };
    if (progress) {
      c.size(filepath, (err: any, size: number) => {
        if (err) {
          reject(err);
        } else getWithProgress(size);
      });
    } else getWithProgress();
  });
}

// Takes an FTP connection and downloads an array of files, returning a
// Buffer array promise. If FTP was canceled null is returned. If a
// progress function is provided, it will be used to report progress.
export async function getFiles(
  c: FTP,
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
  const bufpromises = files.map((f) =>
    getFile(c, f).then((b) => {
      prog += 1;
      if (progress) progress(prog / total);
      return b;
    })
  );
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

export async function ftpFile(
  download: Download,
  progress?: ((prog: number) => void) | null
): Promise<Buffer | null> {
  if (CancelFTP) return null;
  const { domain, path, file } = download;
  const onready = async (c: FTP) => {
    return getFile(c, fpath.join(path, file), progress);
  };
  return connect(domain, onready);
}

export async function ftpFiles(
  directory: Download,
  filepaths: string[],
  progress?: ((prog: number) => void) | null
): Promise<Buffer[] | null> {
  if (CancelFTP) return null;
  const { domain } = directory;
  const onready = async (c: FTP) => {
    return getFiles(c, filepaths, progress);
  };
  return connect(domain, onready);
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
    return ftpFile(mr).then((fbuffer) => {
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
        const targzbuf = await ftpFile(repo, progress);
        if (targzbuf === null) return 'Canceled';
        files = await untargz(targzbuf);
      } catch {
        // If there is no mods.d.tar.gz, then download every conf file.
        const getfiles = async (c: FTP) => {
          const listing = await list(c, fpath.join(repo.path, 'mods.d'), '', 1);
          if (listing === null) return null;
          const bufs = await getFiles(
            c,
            listing.map((l) => fpath.join(repo.path, 'mods.d', l.name)),
            progress
          );
          if (bufs === null) return null;
          bufs.forEach((b, i) => {
            files?.push({ header: { name: listing[i].name }, content: b });
          });
          return files;
        };
        files = await connect(repo.domain, getfiles);
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
