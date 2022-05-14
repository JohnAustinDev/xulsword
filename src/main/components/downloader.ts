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
export function ftpCancel(value?: boolean) {
  CancelFTP = !!value;
  if (CancelFTP) {
    Object.keys(connections).forEach((domain) => resetFTP(domain, true));
    log.info(`All FTP connections were canceled.`);
  }
}

function resetFTP(domain: string, quiet = false) {
  connections[domain].forEach((c) => c.destroy());
  delete connections[domain];
  freeConnections[domain].forEach((c) => c.destroy());
  delete freeConnections[domain];
  waitingFuncs[domain].forEach(() => {
    if (!quiet) log.error(`Dropping neglected FTP function.`);
    delete waitingFuncs[domain];
  });
}

// Use an FTP connection to a remote server to run an arbitrary
// function and return an arbitrary promise. Returns null if
// canceled. Up to FTPMaxConnectionsPerDomain will be created
// per domain. If that many are currently running, this function
// will use the next connection that becomes free. Once all connections
// are free they will all be closed.
const connections: { [domain: string]: FTP[] } = {};
const freeConnections: { [domain: string]: FTP[] } = {};
const waitingFuncs: { [domain: string]: ((c: FTP) => void)[] } = {};
export async function connect<Retval>(
  domain: string,
  func: (c: FTP) => Promise<Retval | null>
): Promise<Retval | null> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const resolveOnce = (value: Retval | null) => {
      if (!resolved) {
        resolved = true;
        rejected = true;
        resolve(CancelFTP ? null : value);
      }
    };
    let rejected = false;
    const rejectOnce = (er: Error) => {
      if (!rejected) {
        resolved = true;
        rejected = true;
        reject(
          new Error(`${er.toString().replace(/^error:\s*/i, '')} (${domain})`)
        );
      }
    };
    const removeConnection = (c: FTP) => {
      const i = connections[domain]?.indexOf(c);
      if (i !== undefined && i !== -1) {
        connections[domain].splice(i, 1);
        log.debug(`Connections: `, connections[domain].length);
      }
    };
    if (!(domain in connections)) {
      connections[domain] = [];
      freeConnections[domain] = [];
      waitingFuncs[domain] = [];
    }
    if (!CancelFTP) {
      const runFunc = async (c: FTP) => {
        if (!CancelFTP) {
          try {
            const result = await func(c);
            if (!CancelFTP) {
              removeConnection(c);
              const next = waitingFuncs[domain][0];
              if (next) {
                waitingFuncs[domain].shift();
                log.debug(`ftp connect on-ready-wait ${domain}.`);
                next(c);
              } else {
                freeConnections[domain].push(c);
                if (!connections[domain].length) resetFTP(domain);
              }
              resolveOnce(result);
            }
          } catch (er: any) {
            removeConnection(c);
            rejectOnce(er);
          }
        }
        removeConnection(c);
        resolveOnce(null);
      };
      let c = freeConnections[domain][0];
      if (c) {
        freeConnections[domain].shift();
        connections[domain].push(c);
        log.debug(`ftp connect on-ready-free ${domain}.`);
        runFunc(c);
      } else if (connections[domain].length < C.FTPMaxConnectionsPerDomain) {
        c = new FTP();
        connections[domain].push(c);
        c.on('error', (er: Error) => {
          log.debug(`ftp connect on-error ${domain}: '${er}'.`);
          c.destroy();
          removeConnection(c);
          rejectOnce(er);
        });
        c.on('close', (er: boolean) => {
          log.debug(`ftp connect on-close ${domain}: error='${er}'.`);
          if (er) {
            if (typeof c === 'object') c.destroy();
            removeConnection(c);
            rejectOnce(new Error(`Error during connection close.`));
          }
        });
        c.on('greeting', (msg: string) => {
          log.debug(`ftp connect on-greeting ${domain}: '${msg}'.`);
        });
        c.on('end', () => {
          log.debug(`ftp connect on-end ${domain}.`);
          if (CancelFTP) {
            removeConnection(c);
            resolveOnce(null);
          }
        });
        c.on('ready', () => {
          log.debug(`ftp connect on-ready ${domain}.`);
          runFunc(c);
        });
        try {
          log.debug(`Connecting: ${domain}`);
          c.connect({ host: domain });
        } catch (er: any) {
          removeConnection(c);
          rejectOnce(er);
        }
      } else {
        waitingFuncs[domain].push((cf: FTP) => {
          connections[domain].push(cf);
          runFunc(cf);
        });
      }
    } else resolveOnce(null);
  });
}

function streamToBuffer(
  stream: NodeJS.ReadableStream,
  uncancelable = false
): Promise<Buffer | null> {
  const buf: Buffer[] = [];
  return new Promise((resolve, reject) => {
    if (!CancelFTP) {
      stream.on('data', (chunk: Buffer) => {
        if (!uncancelable && CancelFTP) resolve(null);
        else buf.push(chunk);
      });
      stream.on('end', () => {
        log.debug(`stream on-end.`);
        resolve(CancelFTP ? null : Buffer.concat(buf));
      });
      stream.on('error', (err) => {
        log.debug(`stream on-error: '${err}'.`);
        reject(err);
      });
    } else resolve(null);
  });
}

// Convert the callback FTP API to promise with cancel.
async function listP(
  c: FTP,
  dirpath: string
): Promise<ListingElement[] | null> {
  return new Promise((resolve, reject) => {
    if (!CancelFTP) {
      log.debug(`list(${dirpath})`);
      c.list(dirpath, false, (err: Error, listing: ListingElement[]) => {
        if (err) reject(err);
        else resolve(CancelFTP ? null : listing);
      });
    } else resolve(null);
  });
}

// Convert the callback FTP API to promise with cancel.
async function sizeP(c: FTP, filepath: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    if (!CancelFTP) {
      log.debug(`size(${filepath})`);
      c.size(filepath, (err: any, size: number) => {
        if (err) {
          reject(err);
        } else resolve(CancelFTP ? null : size);
      });
    } else resolve(null);
  });
}

// Convert the callback FTP API to promise with cancel.
async function getP(
  c: FTP,
  filepath: string
): Promise<NodeJS.ReadableStream | null> {
  return new Promise((resolve, reject) => {
    if (!CancelFTP) {
      log.debug(`getStream(${filepath})`);
      c.get(filepath, (er: Error, stream: NodeJS.ReadableStream) => {
        if (er) reject(er);
        else {
          resolve(CancelFTP ? null : stream);
        }
      });
    } else resolve(null);
  });
}

// Take an FTP connection and return a single FTP file download
// as a promise Buffer. Returns null if canceled. Reports progress
// if a progress function is provided.
async function getFileP(
  c: FTP,
  filepath: string,
  progress?: (prog: number) => void,
  size?: number
): Promise<Buffer | null> {
  if (!CancelFTP) {
    log.debug(`get(${filepath})`);
    let stream;
    try {
      stream = await getP(c, filepath);
    } catch (er) {
      return Promise.reject(er);
    }
    if (stream) {
      if (progress) {
        progress(CancelFTP ? -1 : 0);
        if (size) {
          let current = 0;
          stream.on('data', (chunk: Buffer) => {
            current += chunk.length;
            progress(CancelFTP ? -1 : current / size);
          });
        }
      }
      return streamToBuffer(stream)
        .then((result) => {
          if (progress) progress(-1);
          if (!result) return null;
          log.debug(`DONE get(${filepath})`);
          return result;
        })
        .catch((er) => {
          if (progress) progress(-1);
          throw er;
        });
    }
  }
  return null;
}

// Return a buffer promise for the FTP download of domain/filepath.
// Progress is reported if a progress function is provided. Returns
// null if canceled.
export async function getFile(
  domain: string,
  filepath: string,
  progress?: ((p: number) => void) | null
): Promise<Buffer | null> {
  if (!CancelFTP) {
    return connect(domain, async (c: FTP) => {
      if (progress) {
        let size: number | null = 0;
        try {
          size = await sizeP(c, filepath);
        } catch (er) {
          if (progress) progress(-1);
          return Promise.reject(er);
        }
        if (size !== null) {
          return getFileP(c, filepath, progress, size);
        }
        if (progress) progress(-1);
        return null;
      }
      return getFileP(c, filepath);
    });
  }
  if (progress) progress(-1);
  return null;
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
  if (!CancelFTP) {
    const promises: Promise<ListingElementR[] | null>[] = [];
    let listing: ListingElement[] | null;
    try {
      listing = await connect(domain, (c: FTP) => {
        return listP(c, dirpath);
      });
      if (listing) {
        const listingR = listing as ListingElementR[];
        listingR.forEach((file) => {
          file.subdir = basepath;
        });
        promises.push(Promise.resolve(listingR as ListingElementR[]));
        if (depth < maxdepth) {
          listingR
            .filter((f) => f.type === 'd')
            .forEach((f) =>
              promises.push(
                list(
                  domain,
                  fpath.join(dirpath, f.name),
                  fpath.join(basepath, f.name),
                  maxdepth,
                  depth + 1
                )
              )
            );
        }
      } else promises.push(Promise.resolve(null));
    } catch (er) {
      promises.push(Promise.reject(er));
    }
    return Promise.all(promises).then((lists) => {
      log.debug(`list(${dirpath}):`, lists.flat().length);
      if (lists.includes(null)) return null;
      return lists.flat() as ListingElementR[];
    });
  }
  return null;
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
    try {
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
    } catch (er) {
      if (progress) progress(-1);
      return Promise.reject(er);
    }
  }
  if (progress) progress(-1);
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
  if (!CancelFTP) {
    if (progress) progress(CancelFTP ? -1 : 0);
    const total = files.length;
    let prog = 0;
    const bufpromises = files.map(async (f) => {
      let b;
      try {
        b = await getFile(domain, f);
      } catch (er) {
        return Promise.reject(er);
      }
      prog += 1;
      if (progress) progress(CancelFTP ? -1 : prog / total);
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
  if (progress) progress(-1);
  return null;
}

// Take a tar.gz or tar file as a Buffer or else a file path string,
// and decode it, returning the contents as an array of
// { header, content } objects.
export async function untargz(
  input: Buffer | string
): Promise<{ header: TAR.Headers; content: Buffer }[]> {
  const result: { header: TAR.Headers; content: Buffer }[] = [];
  let stream: Stream | null = null;
  if (typeof input === 'string') {
    const file = new LocalFile(input);
    if (file.exists() && !file.isDirectory()) {
      stream = Readable.from(file.readBuf());
    }
  } else {
    stream = Readable.from(input);
  }
  if (stream) {
    const extract = TAR.extract();
    stream.pipe(GUNZIP()).pipe(extract);
    return new Promise((resolve, reject) => {
      extract.on(
        'entry',
        (header: TAR.Headers, stream2: Readable, next: () => void) => {
          log.debug(`untargz received stream2.`);
          streamToBuffer(stream2, true)
            .then((content) => {
              return content && result.push({ header, content });
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

const Downloader: GType['Downloader'] = {
  // Return a promise for the CrossWire master repository list as an
  // array of Download objects. These can be passed to repositoryListing()
  // for retrieval of each repository's complete set of config files.
  async crossWireMasterRepoList() {
    const mr = {
      domain: 'ftp.crosswire.org',
      path: '/pub/sword/',
      file: 'masterRepoList.conf',
    };
    ftpCancel(false);
    const result: Download[] | null = [];
    let fbuffer;
    try {
      fbuffer = await getFile(mr.domain, fpath.join(mr.path, mr.file));
    } catch (er) {
      return Promise.reject(er);
    }
    if (fbuffer) {
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
      return result;
    }
    return null;
  },

  // Takes an array of SWORD repositories and returns a mapped array containing:
  // - SwordConfType object array if mods.d.tar.gz or config files were found.
  // - Or a string error message if there was an error or was canceled.
  // - Or null if the repository was null or disabled.
  // Progress on each repository is separately reported to the calling
  // window, but results are not returned until all repositories have
  // been completely handled.
  async repositoryListing(repositories) {
    const callingWin = arguments[1] || null;
    ftpCancel(false);
    const promises = repositories.map(async (repo) => {
      const progress = (prog: number) => {
        if (!repo) return;
        log.debug(`progress ${prog}`);
        callingWin?.webContents.send('progress', prog, downloadKey(repo));
      };
      let value = null;
      if (repo && !repo.disabled) {
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
              value = confs;
            } else value = `Directory not found: ${repo.path}/mods.d`;
          } else value = `Path not absolute: ${repo.path}/mods.d`;
          if (progress) progress(-1);
          return value;
        }
        let files: { header: { name: string }; content: Buffer }[] | null = [];
        try {
          const targzbuf = await getFile(
            repo.domain,
            fpath.join(repo.path, repo.file),
            progress
          );
          if (targzbuf) {
            files = await untargz(targzbuf);
          } else value = 'Canceled';
        } catch (er: any) {
          // If there is no mods.d.tar.gz, then download every conf file.
          let listing: ListingElementR[] | null = null;
          let bufs: Buffer[] | null = null;
          try {
            if (!/Could not get file size/i.test(er)) throw er;
            listing = await list(
              repo.domain,
              fpath.join(repo.path, 'mods.d'),
              '',
              1
            );
            if (listing) {
              bufs = await getFiles(
                repo.domain,
                listing.map((l) => fpath.join(repo.path, 'mods.d', l.name)),
                progress
              );
            }
            if (bufs) {
              bufs.forEach((b, i) => {
                if (files && listing) {
                  files.push({ header: { name: listing[i].name }, content: b });
                }
              });
            } else {
              value = 'Canceled';
            }
          } catch (err: any) {
            if (progress) progress(-1);
            return Promise.reject(err);
          }
        }
        if (files) {
          const confs: SwordConfType[] = [];
          files.forEach((r) => {
            const { header, content: buffer } = r;
            if (header.name.endsWith('.conf')) {
              const cobj = parseSwordConf(buffer.toString('utf8'), header.name);
              cobj.sourceRepository = repo;
              confs.push(cobj);
            }
          });
          value = confs;
        }
      }
      if (progress) progress(-1);
      return value;
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
