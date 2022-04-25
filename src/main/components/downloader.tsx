/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import log from 'electron-log';
import { Stream, Readable } from 'stream';
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
    const { domain, path, file, name } = download;
    const outfile =
      (tmpdir && new LocalFile(tmpdir).append(name || file)) || null;
    const ftp = new FTP();
    const filepath = [path, file].join('/').replaceAll('//', '/');
    return new Promise((resolve, reject) => {
      let downloaded: string | Buffer;
      ftp.on('ready', () => {
        const get = (size?: number) => {
          ftp.get(filepath, (err: Error, stream: any) => {
            if (err) {
              reject(err);
              ftp.end();
            } else if (!stream) {
              reject(new Error(`No ftp stream: ${filepath}}`));
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
                streamToBuffer(stream, (er: string, buffer: Buffer) => {
                  if (er) reject(er);
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
          ftp.size(filepath, (err: string, sizex: number) => {
            let size = sizex;
            if (err) {
              reject(err);
              size = 0;
            }
            get(size);
          });
        } else get();
      });
      ftp.on('error', (er: Error) => reject(er));
      ftp.once('close', (er: Error) => {
        if (er) reject(er);
        else resolve(downloaded);
      });
      try {
        log.info(`Connecting ftp: ${domain}/${filepath}`);
        ftp.connect({ host: domain });
      } catch (er) {
        reject(er);
      }
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
    const fbuffer = await this.ftp(mr);
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
    log.debug(result);
    return result;
  },

  // Takes SWORD repositories as mods.d.tar.gz download array and, for
  // each repository, returns either an array of SwordConfType objects
  // (one for each module in the repository) or a string error message.
  // Progress on each repository is reported to the calling window.
  async repositoryListing(repositories) {
    const callingWin = arguments[1] || null;
    const promises = repositories.map((repo) => {
      const progress = (prog: number) => {
        callingWin?.webContents.send('progress', prog, repo.name || 'unknown');
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
              conf.SourceRepository = repo.name || 'unknown';
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
        else {
          ret.push(result.reason);
        }
      });
      return ret;
    });
  },
};

export default Downloader;
