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
  const ftp = new FTP();
  let cancelTO: NodeJS.Timeout | null = null;
  const reject0 = (err: Error) => {
    if (cancelTO) clearInterval(cancelTO);
    ftp.destroy();
    reject(err);
  };
  ftp.on('error', (er: Error) => {
    reject0(er);
  });
  ftp.on('close', (er: Error) => {
    if (cancelTO) clearInterval(cancelTO);
    if (er) reject0(er);
  });
  try {
    log.info(`Connecting: ${domain}`);
    ftp.connect({ host: domain });
    cancelTO = setInterval(() => {
      if (CancelFTP) {
        reject0(new Error('Canceled'));
      }
    }, 300);
  } catch (er: any) {
    reject0(er);
  }
  return ftp;
}

async function list(
  ftp: any,
  dirpath: string,
  recurse: boolean
): Promise<ListType[]> {
  const result: ListType[] = [];
  return new Promise((resolve, reject) => {
    ftp.list(dirpath, false, (err: Error, listing: ListType[]) => {
      if (err) reject(err);
      else {
        const listpromises: Promise<ListType[]>[] = [];
        listing.forEach((l) => {
          l.path = dirpath;
          result.push(l);
          if (recurse && l.type === 'd') {
            listpromises.push(list(ftp, l.path, true));
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

const Downloader: GType['Downloader'] = {
  // Download a file using FTP and either save it to tmpdir returning the
  // new file path, or, if tmpdir is undefined, return the contents of the
  // file as a Buffer. If a progress function is provided, it will be used
  // to report progress.
  async ftp(
    download: Download,
    tmpdir?: string | null,
    progress?: ((prog: number) => void) | null,
    connection?: any
  ): Promise<string | Buffer> {
    if (CancelFTP) return '';
    return new Promise((resolve, reject) => {
      const { domain, path, file, name } = download;
      const ftp = connection || connect(domain, reject);
      const outfile =
        (tmpdir && new LocalFile(tmpdir).append(name || file)) || null;
      const filepath = ['', path, file].join('/').replaceAll('//', '/');
      ftp.on('ready', () => {
        const get = (size?: number) => {
          ftp.get(filepath, (err: Error, stream: any) => {
            if (err) {
              reject(err);
              if (!connection) ftp.end();
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
                  if (er) reject(er);
                  else resolve(buffer);
                });
              }
              stream.once('close', () => {
                if (progress && size) progress(-1);
                if (outfile) {
                  stream.pipe(fs.createWriteStream(outfile.path));
                  resolve(outfile.path);
                }
                if (!connection) ftp.end();
              });
            }
          });
        };
        if (progress) {
          ftp.size(filepath, (err: any, size: number) => {
            if (err) {
              reject(err);
            } else get(size);
          });
        } else get();
      });
    });
  },

  ftpCancel() {
    CancelFTP = true;
  },

  // Download a directory using FTP and either copy it to tmpdir returning the
  // new directory path, or, if tmpdir is undefined, return the contents of the
  // directory as a zip Buffer. If a progress function is provided, it will be
  // used to report progress.
  async ftpDir(
    download: Download,
    tmpdir?: string | null,
    progress?: ((prog: number) => void) | null,
    connection?: any
  ): Promise<string | Buffer> {
    if (CancelFTP) return '';
    return new Promise((resolve, reject) => {
      const { domain, path, file, name } = download;
      const ftp = connection || connect(domain, reject);
      const outfile =
        (tmpdir && new LocalFile(tmpdir).append(name || file)) || null;
      const dirpath = ['', path, file].join('/').replaceAll('//', '/');
      ftp.on('ready', async () => {
        const listing = await list(ftp, dirpath, true);
        let current = 0;
        const total = listing.reduce((p, c) => p + c.size, 0);
        if (progress) progress(0);
        const bufpromises: Promise<string | Buffer>[] = [];
        listing.forEach((l) => {
          const dl = {
            domain: download.domain,
            path: l.path,
            file: l.name,
          };
          bufpromises.push(
            this.ftp(dl, null, null, ftp).then((buf) => {
              current += l.size;
              if (progress) progress(current / total);
              return buf;
            })
          );
        });
        const zip = new ZIP();
        Promise.all(bufpromises)
          .then((bufs) => {
            if (progress) progress(-1);
            bufs.forEach((b, i) =>
              zip.addFile(fpath.join(listing[i].path, listing[i].name), b)
            );
            if (outfile) {
              zip.extractAllTo(outfile.path, true);
              return resolve(outfile.path);
            }
            return resolve(zip.toBuffer());
          })
          .catch((er) => reject(er));
      });
    });
  },

  // Take a tar.gz or tar file as a Buffer or else a file path string to
  // one of them, and decode it, returning the contents as an array of
  // { header, buffer }.
  async untargz(inp: Buffer | string) {
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
  },

  // Return the CrossWire master repository list as a Download
  // object array.
  async crossWireMasterRepoList() {
    const mr = {
      domain: 'ftp.crosswire.org',
      path: '/pub/sword/',
      file: 'masterRepoList.conf',
    };
    CancelFTP = false;
    return this.ftp(mr).then((fbuffer) => {
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
  // - An array of SwordConfType objects, one for each module in the repository.
  // - Or a string error message if there was an error.
  // - Or the empty string if the repository is disabled.
  // - Or null if the repository was null.
  // - Or the C.Downloader.modsd string if the repository is a local mods.d directory.
  // Progress on each repository is reported to the calling window.
  async repositoryListing(repositories) {
    const callingWin = arguments[1] || null;
    CancelFTP = false;
    const promises = repositories.map((repo) => {
      if (repo === null) return Promise.resolve(null);
      if (repo.disabled) return Promise.resolve('');
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
            return Promise.resolve(confs);
          }
        }
        return Promise.resolve(`Directory not found: ${repo.path}/'mods.d'`);
      }
      const progress = (prog: number) => {
        callingWin?.webContents.send('progress', prog, downloadKey(repo));
      };
      return this.ftp(repo, null, progress)
        .then((buf) => {
          return this.untargz(buf);
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
        else ret.push(result.reason);
      });
      CancelFTP = false;
      return ret;
    });
  },
};

export default Downloader;
