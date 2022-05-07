/* eslint-disable promise/no-promise-in-callback */
/* eslint-disable promise/param-names */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import fpath from 'path';
import log from 'electron-log';
import { Stream, Readable } from 'stream';
import { downloadKey, isRepoLocal, parseSwordConf } from '../../common';
import LocalFile from './localFile';

import type {
  GType,
  Download,
  SwordConfType,
  RepositoryListing,
} from '../../type';

type ListType = {
  type: 'd' | '-';
  name: string;
  path: string;
  size: number; // bytes
  date: any;
};

const FTP = require('ftp');

const GUNZIP = require('gunzip-maybe');

const TAR = require('tar-stream');

const ZIP = require('adm-zip');

let CancelFTP = false;

function streamToBuffer(stream: Readable, cbx?: any): Promise<Buffer> {
  const buf: any[] = [];
  const cb = cbx || (() => {});
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      buf.push(chunk);
    });
    stream.on('end', () => {
      const buffer = Buffer.concat(buf);
      resolve(buffer);
      cb(null, buffer);
    });
    stream.on('error', (err) => {
      reject(err);
      cb(err);
    });
  });
}

function connect(domain: string, reject: (er: Error) => void): any {
  const c = new FTP();
  let cancelTO: NodeJS.Timeout | null = null;
  const reject0 = (err: Error) => {
    if (cancelTO) clearInterval(cancelTO);
    c.destroy();
    reject(err);
  };
  c.on('error', (er: Error) => {
    reject0(er);
  });
  c.on('close', (er: Error) => {
    if (cancelTO) clearInterval(cancelTO);
    if (er) reject0(er);
  });
  try {
    log.info(`Connecting: ${domain}`);
    c.connect({ host: domain });
    cancelTO = setInterval(() => {
      if (CancelFTP) {
        reject0(new Error('Canceled'));
      }
    }, 300);
  } catch (er: any) {
    reject0(er);
  }
  return c;
}

async function list(
  connection: any,
  dirpath: string,
  recurse: boolean
): Promise<ListType[]> {
  const result: ListType[] = [];
  return new Promise((resolve, reject) => {
    connection.list(dirpath, false, (err: Error, listing: ListType[]) => {
      if (err) reject(err);
      else {
        const listpromises: Promise<ListType[]>[] = [];
        listing.forEach((l) => {
          l.path = dirpath;
          result.push(l);
          if (recurse && l.type === 'd') {
            listpromises.push(list(connection, l.path, true));
          }
        });
        if (listpromises) {
          Promise.all(listpromises)
            .then((r) => resolve(result.concat(r.flat())))
            .catch((er) => reject(er));
        }
        resolve(result);
      }
    });
  });
}

// Download a file using FTP and either save it to tmpdir returning the
// new file path, or, if tmpdir is undefined, return the contents of the
// file as a Buffer. If FTP was canceled null is returned. If a progress
// function is provided, it will be used to report progress.
async function ftp(
  download: Download,
  tmpdir?: string | null,
  progress?: ((prog: number) => void) | null,
  connection?: any
): Promise<Buffer | string | null> {
  if (CancelFTP) {
    if (progress) progress(-1);
    return null;
  }
  return new Promise((resolve, reject) => {
    const reject0 = (err: Error) => {
      if (progress) progress(-1);
      reject(err);
    };
    const { domain, path, file, name } = download;
    const c = connection || connect(domain, reject0);
    const outfile =
      (tmpdir && new LocalFile(tmpdir).append(name || file)) || null;
    const filepath = ['', path, file].join('/').replaceAll('//', '/');
    c.on('ready', () => {
      const get = (size?: number) => {
        c.get(filepath, (err: Error, stream: any) => {
          if (err) {
            reject0(err);
            if (!connection) c.end();
          } else {
            if (progress && size) {
              let current = 0;
              progress(0);
              stream.on('data', (chunk: Buffer) => {
                current += chunk.length;
                progress(current / size);
              });
            }
            if (!outfile) {
              streamToBuffer(stream, (er: any, buffer: Buffer) => {
                if (er) reject0(er);
                else resolve(buffer);
              });
            }
            stream.once('close', () => {
              if (progress && size) progress(-1);
              if (outfile) {
                stream.pipe(fs.createWriteStream(outfile.path));
                resolve(outfile.path);
              }
              if (!connection) c.end();
            });
          }
        });
      };
      if (progress) {
        c.size(filepath, (err: any, size: number) => {
          if (err) {
            reject0(err);
          } else get(size);
        });
      } else get();
    });
  });
}

// Download a directory using FTP and either copy it to tmpdir returning the
// new directory path, or, if tmpdir is undefined, return the contents of the
// directory as a zip Buffer. If canceled, null is returned. If a progress
// function is provided, it will be used to report progress.
async function ftpDir(
  download: Download,
  tmpdir?: string | null,
  progress?: ((prog: number) => void) | null,
  connection?: any
): Promise<Buffer | string | null> {
  if (CancelFTP) {
    if (progress) progress(-1);
    return null;
  }
  return new Promise((resolve, reject) => {
    const reject0 = (err: Error) => {
      if (progress) progress(-1);
      reject(err);
    };
    const { domain, path, file, name } = download;
    const c = connection || connect(domain, reject0);
    const outfile =
      (tmpdir && new LocalFile(tmpdir).append(name || file)) || null;
    const dirpath = ['', path, file].join('/').replaceAll('//', '/');
    c.on('ready', async () => {
      const listing = await list(ftp, dirpath, true);
      let current = 0;
      const total = listing.reduce((p, ct) => p + ct.size, 0);
      if (progress) progress(0);
      const bufpromises: Promise<Buffer | string | null>[] = [];
      listing.forEach((l) => {
        const dl = {
          domain: download.domain,
          path: l.path,
          file: l.name,
        };
        bufpromises.push(
          ftp(dl, null, null, ftp).then((result) => {
            current += l.size;
            if (progress) progress(current / total);
            return result;
          })
        );
      });
      Promise.all(bufpromises)
        .then((result) => {
          if (progress) progress(-1);
          if (result.some((r) => r === null)) return resolve(null);
          const zip = new ZIP();
          result.forEach((b, i) =>
            zip.addFile(fpath.join(listing[i].path, listing[i].name), b)
          );
          if (outfile) {
            zip.extractAllTo(outfile.path, true);
            return resolve(outfile.path);
          }
          return resolve(zip.toBuffer());
        })
        .catch((er) => reject0(er));
    });
  });
}

// Take a tar.gz or tar file as a Buffer or else a file path string,
// and decode it, returning the contents as an array of
// { header, buffer }.
async function untargz(
  inp: Buffer | string
): Promise<{ header: any; content: Buffer }[]> {
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
        (header: any, stream2: Readable, next: () => void) => {
          streamToBuffer(stream2, (err: string, content: Buffer) => {
            if (err) reject(err);
            else result.push({ header, content });
          });
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

const Downloader: GType['Downloader'] = {
  // Return the CrossWire master repository list as a Download
  // object array.
  async crossWireMasterRepoList() {
    const mr = {
      domain: 'ftp.crosswire.org',
      path: '/pub/sword/',
      file: 'masterRepoList.conf',
    };
    CancelFTP = false;
    return ftp(mr).then((fbuffer) => {
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
      CancelFTP = false;
      return result;
    });
  },

  // Takes an array of SWORD repositories and returns:
  // - An array of SwordConfType objects
  // - Or a string error message if there was an error
  // - Or null if the repository was null or disabled
  // Progress on each repository is separately reported to the calling
  // window, but results are not returned until all repositories have
  // been completely handled.
  async repositoryListing(repositories) {
    const callingWin = arguments[1] || null;
    CancelFTP = false;
    const promises = repositories.map((repo) => {
      if (repo === null) return Promise.resolve(null);
      const progress = (prog: number) => {
        callingWin?.webContents.send('progress', prog, downloadKey(repo));
      };
      if (repo.disabled) {
        progress(-1);
        return Promise.resolve(null);
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
                conf.custom = repo.custom || null;
                conf.installed = true;
                confs.push(conf);
              }
            });
            progress(-1);
            return Promise.resolve(confs);
          }
        }
        progress(-1);
        return Promise.resolve(`Directory not found: ${repo.path}/mods.d`);
      }
      return ftp(repo, null, progress)
        .then((result) => {
          if (result === null) throw new Error(`Canceled`);
          if (typeof result === 'string')
            throw new Error(`ftp returned string when tmpdir was null`);
          return untargz(result);
        })
        .then((files) => {
          const confs: SwordConfType[] = [];
          files.forEach((r) => {
            const { header, content: buffer } = r;
            if (header.name.endsWith('.conf')) {
              const conf = parseSwordConf(buffer.toString('utf8'));
              conf.sourceRepository = repo;
              conf.custom = repo.custom || null;
              confs.push(conf);
            }
          });
          return confs;
        });
    });
    return Promise.allSettled(promises).then((results) => {
      const ret: RepositoryListing[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled') ret.push(result.value);
        else ret.push(result.reason.toString());
      });
      CancelFTP = false;
      return ret;
    });
  },

  // Returns the downloaded file's path, or null if canceled.
  ftp(
    download: Download,
    tmpdir: string,
    progress?: ((prog: number) => void) | null
  ): Promise<string | null> {
    return ftp(download, tmpdir, progress) as Promise<string | null>;
  },

  // Returns the downloaded directory's path, or null if canceled.
  ftpDir(
    download: Download,
    tmpdir: string,
    progress?: ((prog: number) => void) | null
  ): Promise<string | null> {
    return ftpDir(download, tmpdir, progress) as Promise<string | null>;
  },

  ftpCancel() {
    CancelFTP = true;
  },
};

export default Downloader;
