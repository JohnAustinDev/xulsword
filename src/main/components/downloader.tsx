/* eslint-disable promise/param-names */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import fpath from 'path';
import log from 'electron-log';
import { Stream, Readable } from 'stream';
import { downloadKey, isRepoLocal } from '../../common';
import C from '../../constant';
import { parseSwordConf } from '../installer';
import LocalFile from './localFile';

import type { GType, Download, SwordConfType } from '../../type';

const FTP = require('ftp');

const GUNZIP = require('gunzip-maybe');

const TAR = require('tar-stream');

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

let CancelFTP = false;

const Downloader: GType['Downloader'] = {
  // Download a file using FTP and either save it to tmpdir returning the
  // new file path, or, if tmpdir is undefined, return the contents of the
  // file as a Buffer. If a progress function is provided, it will be used
  // to report progress.
  async ftp(
    download: Download,
    tmpdir?: string | null,
    progress?: (prog: number) => void
  ): Promise<string | Buffer> {
    if (CancelFTP) return '';
    return new Promise((resolve, reject0) => {
      const { domain, path, file, name } = download;
      const outfile =
        (tmpdir && new LocalFile(tmpdir).append(name || file)) || null;
      const ftp = new FTP();
      const filepath = ['', path, file].join('/').replaceAll('//', '/');
      let cancelTO: NodeJS.Timeout | null = null;
      const reject = (er: Error | string) => {
        if (cancelTO) clearInterval(cancelTO);
        ftp.destroy();
        reject0(er);
      };
      let downloaded: string | Buffer = '';
      ftp.on('ready', () => {
        const get = (size?: number) => {
          ftp.get(filepath, (err: Error, stream: any) => {
            if (err) {
              reject(err.message);
              ftp.end();
            } else if (!stream) {
              reject(`No ftp stream: ${filepath}`);
              ftp.end();
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
                  if (er) reject(er.message);
                  else downloaded = buffer;
                });
              }
              stream.once('close', () => {
                if (progress && size) progress(-1);
                if (outfile) {
                  stream.pipe(fs.createWriteStream(outfile.path));
                  downloaded = outfile.path;
                }
                ftp.end();
              });
            }
          });
        };
        if (progress) {
          ftp.size(filepath, (err: any, size: number) => {
            if (err) {
              reject(err.message);
            } else get(size);
          });
        } else get();
      });
      ftp.on('error', (er: Error) => {
        reject(er.message);
      });
      ftp.once('close', (er: Error) => {
        if (cancelTO) clearInterval(cancelTO);
        if (er) reject(er.message);
        else resolve(downloaded);
      });
      try {
        log.info(`Connecting: ${domain}${filepath}`);
        ftp.connect({ host: domain });
        cancelTO = setInterval(() => {
          if (CancelFTP) {
            reject('Canceled');
          }
        }, 300);
      } catch (er: any) {
        reject(er.message);
      }
    });
  },

  ftpCancel() {
    CancelFTP = true;
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

  // Takes SWORD repositories as mods.d.tar.gz download array and, for
  // each repository, returns either an array of SwordConfType objects
  // (one for each module in the repository) or a string which is an
  // error message except in two special cases: An empty string is
  // returned if the repository is disabled, and C.Downloader.modsd
  // string is returned if the respository is an existing mods.d directory.
  // Progress on each repository is reported to the calling window.
  async repositoryListing(repositories) {
    const callingWin = arguments[1] || null;
    CancelFTP = false;
    const promises = repositories.map((repo) => {
      if (repo.disabled) return Promise.resolve('');
      if (isRepoLocal(repo)) {
        if (fpath.isAbsolute(repo.path)) {
          if (new LocalFile(repo.path).append('mods.d').exists()) {
            return Promise.resolve('mods.d');
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
              conf.sourceRepository = repo.name || 'no-name';
              confs.push(conf);
            }
          });
          return confs;
        });
    });
    return Promise.allSettled(promises).then((results) => {
      const ret: (SwordConfType[] | string)[] = [];
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
