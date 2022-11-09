/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable promise/no-nesting */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable promise/no-promise-in-callback */
/* eslint-disable promise/param-names */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { session } from 'electron';
import fpath from 'path';
import log from 'electron-log';
import FTP, { ListingElement } from 'ftp';
import GUNZIP from 'gunzip-maybe';
import TAR from 'tar-stream';
import { Stream, Readable } from 'stream';
import { keyToDownload, randomID } from '../common';
import C from '../constant';
import LocalFile from './components/localFile';

import type { HTTPDownload } from '../type';

export type ListingElementR = ListingElement & { subdir: string };

let MaxDomainConnections: { [domain: string]: number } = {};

let FtpCancelable: {
  [cancelkey: string]: {
    canceled: boolean;
    // callbacks is array of [ operation-id, callback[] ]
    callbacks: [string, (() => void)[]][];
  };
} = {};

const HttpCancelable: {
  [cancelkey: string]: { canceled: boolean; callback: () => void };
} = {};

// Call ftpCancelable(key) to throw if key has been canceled, otherwise
// return a unique id. Then call ftpCancelable(key, id, func) as necessary
// to register arbitrary cancelation functions for the key. If ftpCancel(key)
// is called, all registered functions will be called in reverse to cancel
// each operation id for that key. At the end of an operation, be sure  to
// call ftpCancelable(key, id) to remove registered functions of that id.
function ftpCancelable(key: string, id?: string, func?: () => void) {
  if (!key) return '';

  // Don't throw during ftpCancelable(key, id) since this should be called
  // after an operation has already succesfully completed.
  if (
    !(key && id && !func) &&
    key in FtpCancelable &&
    FtpCancelable[key].canceled
  ) {
    // Run ftpCancel(key) again in case somehow new operations were added
    // since the last ftpCancel(key) call.
    ftpCancel(key);
    throw new Error(`${C.UI.Manager.cancelMsg}`);
  }

  // Return a unique operation id
  if (!id) return randomID();

  // Remove an operation id
  if (!func) {
    if (key in FtpCancelable) {
      const j = FtpCancelable[key].callbacks.findIndex((x) => x[0] === id);
      if (j !== -1) {
        FtpCancelable[key].callbacks.splice(j, 1);
      }
    }
    return id;
  }

  // Add another callback to an operation id
  if (!(key in FtpCancelable)) {
    FtpCancelable[key] = { callbacks: [], canceled: false };
  }
  let j = FtpCancelable[key].callbacks.findIndex((x) => x[0] === id);
  if (j === -1) {
    FtpCancelable[key].callbacks.push([id, []]);
    j = FtpCancelable[key].callbacks.length - 1;
  }
  FtpCancelable[key].callbacks[j][1].push(func);
  return id;
}

// When a cancelable download is started, any existing key should be
// deleted with ftpCancel(key, true). If 1 is returned from this call,
// then there are still registered callbcacks from a previous operation
// for the download, indicating the operation(s) threw an unhandled
// exception, or were not closed with ftpCancelable(key, id). Later,
// when the downloading window is closed, ftpCancel() should be called
// to delete all keys, clear MaxDomainConnections and destroy all FTP
// connections. To cancel a single download, ftpCancel(key) should be
// called.
export function ftpCancel(
  cancelkey?: string,
  resetFTPCancelable?: boolean
): number {
  if (resetFTPCancelable && cancelkey) {
    if (cancelkey in FtpCancelable) {
      if (FtpCancelable[cancelkey].callbacks.length) return 1;
      delete FtpCancelable[cancelkey];
    }
    return 0;
  }
  if (cancelkey === undefined) {
    destroyFTPconnection();
    FtpCancelable = {};
    MaxDomainConnections = {};
    return 1;
  }
  if (cancelkey) {
    let n = 0;
    if (cancelkey in FtpCancelable) {
      FtpCancelable[cancelkey].callbacks.reverse().forEach((x) =>
        x[1].reverse().forEach((f) => {
          f();
          n += 1;
        })
      );
      FtpCancelable[cancelkey].callbacks = [];
      FtpCancelable[cancelkey].canceled = true;
    }
    return n;
  }
  return 0;
}

// The cancelkey for XSM audio modules may not be exactly the downloadkey,
// but rather a DataPath URL without a specific bk, ch or vs. If so, keys
// are truncated and multiple downloads may conceivably be canceled by the
// one cancelkey. HttpCancelable should be regsitered and unregistered
// directly by a cancelable downloading function.
export function httpCancel(cancelkey?: string): number {
  let canceled = 0;
  const callCallback = (value: typeof HttpCancelable[string]) => {
    canceled += 1;
    value.canceled = true;
    value.callback();
  };
  log.debug(`httpCancel: ${cancelkey}`);
  if (!cancelkey) {
    Object.entries(HttpCancelable).forEach((entry) => {
      log.debug(`HTTP canceled '${entry[0]}'`);
      callCallback(entry[1]);
    });
  } else {
    const cancelobjx = keyToDownload(cancelkey);
    if ('http' in cancelobjx) {
      const cancelobj = cancelobjx as HTTPDownload;
      const truncate = !cancelobj.http.includes('&bk=');
      Object.entries(HttpCancelable).forEach((entry) => {
        const keyobj = keyToDownload(entry[0]) as HTTPDownload;
        if (
          cancelobj.http ===
          (truncate ? keyobj.http.replace(/&bk=.*$/, '') : keyobj.http)
        ) {
          log.debug(`HTTP canceled '${keyobj.http}'`);
          callCallback(entry[1]);
        }
      });
    }
  }
  return canceled;
}

// Close and free FTP connections to a particular domain, or all connections.
export function destroyFTPconnection(domain?: string | null, quiet = false) {
  if (domain) {
    if (domain in activeConnections) {
      activeConnections[domain].forEach((c) => c.destroy());
      delete activeConnections[domain];
      waitingConnections[domain].forEach((c) => c.destroy());
      delete waitingConnections[domain];
      waitingFuncs[domain].forEach(() => {
        if (!quiet) log.error(`Dropping neglected FTP function.`);
        delete waitingFuncs[domain];
      });
    }
  } else {
    Object.keys(activeConnections).forEach((d) =>
      destroyFTPconnection(d, quiet)
    );
  }
}

// Create or use an existing FTP connection to a remote server to run
// an arbitrary function and return an arbitrary promise. Up to
// FTPMaxConnectionsPerDomain will be created per domain. When that
// number are in use, functions will be queued, waiting for free
// connections. The cancelkey can be used to cancel any read stream
// or function even if it is waiting for a connection.
const activeConnections: { [domain: string]: FTP[] } = {};
const waitingConnections: { [domain: string]: FTP[] } = {};
const waitingFuncs: { [domain: string]: ((c: FTP) => void)[] } = {};
export async function connect<Retval>(
  domain: string,
  cancelkey: string, // '' is uncancelable
  func: (c: FTP) => Promise<Retval>
): Promise<Retval> {
  return new Promise((resolve, reject) => {
    if (!(domain in activeConnections)) {
      activeConnections[domain] = [];
      waitingConnections[domain] = [];
      waitingFuncs[domain] = [];
    }
    let id = '';
    let rejected = false;
    const rejectOnce = (er: any) => {
      if (!rejected) {
        ftpCancelable(cancelkey, id); // never throws
        reject(er);
      }
      rejected = true;
    };
    const freeConnection = (c: FTP, failed?: boolean) => {
      if (!failed) waitingConnections[domain].push(c);
      else c.destroy();
      const i = activeConnections[domain]?.indexOf(c);
      if (i !== undefined && i !== -1) {
        activeConnections[domain].splice(i, 1);
        log.debug(
          `Freed 1 connection to ${domain}, ${
            activeConnections[domain].length
          }/${Object.entries(activeConnections).reduce(
            (pr, cr) => pr + cr[1].length,
            0
          )} left.`
        );
      }
    };
    const startNextWaitingFunc = (c: FTP) => {
      const next = waitingFuncs[domain][0];
      if (next) {
        waitingFuncs[domain].shift();
        log.silly(`ftp connect on-ready-wait ${domain}.`);
        next(c);
      } else freeConnection(c);
    };
    const runFunc = async (c: FTP) => {
      try {
        ftpCancelable(cancelkey, id, () => {
          abortP(c);
        });
        try {
          const result = await func(c);
          startNextWaitingFunc(c);
          resolve(result);
        } catch (er: any) {
          freeConnection(c, true);
          rejectOnce(er);
        } finally {
          ftpCancelable(cancelkey, id); // never throws
        }
      } catch (er) {
        ftpCancelable(cancelkey, id); // never throws
        startNextWaitingFunc(c);
        rejectOnce(er);
      }
    };
    const addWaitingFunc = () => {
      const nfunc = (cf: FTP) => {
        try {
          runFunc(cf);
        } catch (er) {
          rejectOnce(er);
        }
      };
      try {
        ftpCancelable(cancelkey, id, () => {
          const i = waitingFuncs[domain].indexOf(nfunc);
          if (i !== -1) {
            waitingFuncs[domain].splice(i, 1);
            log.silly(`Canceled waiting function: ${id}`);
          }
          rejectOnce({ message: C.UI.Manager.cancelMsg });
        });
        waitingFuncs[domain].push(nfunc);
      } catch (er) {
        rejectOnce(er);
      }
    };
    try {
      id = ftpCancelable(cancelkey);
      let c = waitingConnections[domain][0];
      if (c) {
        log.silly(`ftp connect on-ready-free ${domain}.`);
        waitingConnections[domain].shift();
        activeConnections[domain].push(c);
        runFunc(c);
      } else if (
        activeConnections[domain].length <
          (domain in MaxDomainConnections
            ? MaxDomainConnections[domain]
            : C.FTPMaxConnections) &&
        Object.values(activeConnections).flat().length < C.FTPMaxConnections
      ) {
        c = new FTP();
        c.on('error', (er: Error) => {
          log.silly(`ftp connect on-error ${domain}: '${er}'.`);
          freeConnection(c, true);
          if (er.message.includes('too many connections')) {
            MaxDomainConnections[domain] = activeConnections[domain].length;
            addWaitingFunc();
          } else rejectOnce(er);
        });
        c.on('close', (er: boolean) => {
          log.silly(`ftp connect on-close ${domain}: error='${er}'.`);
          if (er) {
            rejectOnce(new Error(`Error during connection close.`));
          }
        });
        c.on('greeting', (msg: string) => {
          log.silly(`ftp connect on-greeting ${domain}: '${msg}'.`);
        });
        c.on('end', () => {
          log.silly(`ftp connect on-end ${domain}.`);
        });
        c.on('ready', () => {
          log.silly(`ftp connect on-ready ${domain}.`);
          activeConnections[domain].push(c);
          runFunc(c);
        });
        try {
          log.debug(`Connecting: ${domain}`);
          c.connect({ host: domain, user: C.FTPUserName });
        } catch (er: any) {
          rejectOnce(er);
        }
      } else addWaitingFunc();
    } catch (er) {
      rejectOnce(er);
    }
  });
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const buf: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      log.silly(`data: ${chunk.length} bytes`);
      buf.push(chunk);
    });
    stream.on('end', () => {
      log.silly(`stream on-end.`);
      resolve(Buffer.concat(buf));
    });
    stream.on('error', (er) => {
      log.silly(`stream on-error: '${er}'.`);
      reject(er);
    });
  });
}

// Convert the callback FTP API to promise.
async function abortP(c: FTP): Promise<void> {
  return new Promise((resolve, reject) => {
    log.silly(`abortP() before ${c.status}`);
    c.abort((er: Error) => {
      if (er) reject(er);
      else resolve();
    });
  });
}

// Convert the callback FTP API to promise.
async function listP(c: FTP, dirpath: string): Promise<ListingElement[]> {
  return new Promise((resolve, reject) => {
    log.silly(`listP(${dirpath})`);
    c.list(dirpath, false, (er: Error, listing: ListingElement[]) => {
      if (er) reject(er);
      else resolve(listing);
    });
  });
}

// Convert the callback FTP API to promise.
async function sizeP(c: FTP, filepath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    log.silly(`sizeP(${filepath})`);
    c.size(filepath, (er: any, size: number) => {
      if (er) {
        reject(er);
      } else resolve(size);
    });
  });
}

// Convert the callback FTP API to promise.
async function getP(c: FTP, filepath: string): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    c.get(filepath, (er: Error, stream: NodeJS.ReadableStream) => {
      if (er) reject(new Error(`${er.message} ${filepath}`));
      else {
        log.silly(`getStream(${filepath})`);
        resolve(stream);
      }
    });
  });
}

// Take an FTP connection and return a single FTP file download
// as a promise Buffer. Reports progress if a progress function
// is provided.
async function getFileP(
  c: FTP,
  filepath: string,
  cancelkey: string,
  progress?: (prog: number) => void,
  size?: number
): Promise<Buffer> {
  log.silly(`getFileP(${filepath})`);
  let id = '';
  let stream: NodeJS.ReadableStream;
  try {
    id = ftpCancelable(cancelkey);
    stream = await getP(c, filepath);

    const killstream = async (s: any) => {
      if (s && 'destroy' in s && typeof s.destroy === 'function') {
        try {
          await s.destroy();
        } catch (er) {
          log.debug(er);
        } finally {
          if (progress) progress(-1);
          log.debug(`Canceled FTP stream '${cancelkey} ${id}'`);
        }
      }
    };

    ftpCancelable(cancelkey, id, async () => killstream(stream));

    if (progress) {
      progress(0);
      if (size) {
        let current = 0;
        stream.on('data', (chunk: Buffer) => {
          try {
            ftpCancelable(cancelkey);
            current += chunk.length;
            progress(current / size);
          } catch (er) {
            killstream(stream);
          }
        });
      }
    }
  } catch (er) {
    return Promise.reject(er);
  }

  try {
    const buf = await streamToBuffer(stream);
    log.silly(`DONE getFileP(${filepath})`);
    return buf;
  } catch (er) {
    if (cancelkey in FtpCancelable && FtpCancelable[cancelkey].canceled) {
      return Promise.reject({ message: C.UI.Manager.cancelMsg });
    }
    return Promise.reject(er);
  } finally {
    if (progress) progress(-1);
    ftpCancelable(cancelkey, id); // never throws
  }
}

// Return a buffer promise for the FTP download of domain/filepath.
// Progress is reported if a progress function is provided.
export async function getFile(
  domain: string,
  filepath: string,
  cancelkey: string,
  progress?: ((p: number) => void) | null
): Promise<Buffer> {
  return connect(domain, cancelkey, async (c: FTP) => {
    if (progress) {
      let size;
      try {
        ftpCancelable(cancelkey);
        size = await sizeP(c, filepath);
      } catch (er) {
        return Promise.reject(er);
      }
      return getFileP(c, filepath, cancelkey, progress, size);
    }
    return getFileP(c, filepath, cancelkey);
  });
}

// Lists a directory path on a domain using FTP and returns a promise for
// a recursive listing of the directory's contents (unless norecurse is set
// which will only list the contents of the directory itself).
export async function list(
  domain: string,
  dirpath: string,
  cancelkey: string,
  basepath = '',
  maxdepth = 5,
  depth = 1
): Promise<ListingElementR[]> {
  const promises: Promise<ListingElementR[]>[] = [];
  let listing: ListingElement[];
  try {
    listing = await connect(domain, cancelkey, (c: FTP) => {
      return listP(c, dirpath);
    });
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
              cancelkey,
              fpath.join(basepath, f.name),
              maxdepth,
              depth + 1
            )
          )
        );
    }
  } catch (er) {
    promises.push(Promise.reject(er));
  }
  return Promise.all(promises).then((lists) => {
    log.silly(`list(${dirpath}):`, lists.flat().length);
    return lists.flat() as ListingElementR[];
  });
}

// FTP downloads a directory from a domain using FTP, returning it as path/data
// object promise. If a progress function is provided, it will be used to report
// progress.
export async function getDir(
  domain: string,
  dirpath: string,
  skipPathRegex: RegExp,
  cancelkey: string,
  progress?: ((prog: number) => void) | null
): Promise<{ listing: ListingElementR; buffer: Buffer }[]> {
  try {
    const listing = await list(domain, dirpath, cancelkey);
    const files = listing.filter(
      (l) =>
        l.type === '-' &&
        !skipPathRegex.test(fpath.join(dirpath, l.subdir, l.name))
    );
    const buffers = await getFiles(
      domain,
      files.map((l) => fpath.join(dirpath, l.subdir, l.name)),
      cancelkey,
      progress
    );
    if (buffers) {
      return files.map((l, i) => {
        return { listing: l, buffer: buffers[i] };
      });
    }
  } catch (er) {
    if (progress) progress(-1);
    return Promise.reject(er);
  }
  return [];
}

// FTP download an array of files from a domain, returning a Buffer array
// promise. If a progress function is provided, it will be used to report
// progress.
export async function getFiles(
  domain: string,
  files: string[],
  cancelkey: string,
  progress?: ((prog: number) => void) | null
): Promise<Buffer[]> {
  if (progress) progress(0);
  const total = files.length;
  let prog = 0;
  const bufpromises = files.map(async (f) => {
    let b;
    try {
      b = await getFile(domain, f, cancelkey);
    } catch (er) {
      if (progress) progress(-1);
      return Promise.reject(er);
    }
    prog += 1;
    if (progress) progress(prog / total);
    return b;
  });
  // IMPORTANT: allSettled (vs all) waits until all results are
  // in, so that progress cannot be reverted after a rejection
  // by one of the promises.
  return Promise.allSettled(bufpromises).then((pres) => {
    if (progress) progress(-1);
    const bufs: Buffer[] = [];
    pres.forEach((pre) => {
      if (pre.status === 'fulfilled') {
        bufs.push(pre.value);
      } else throw pre.reason;
    });

    return bufs;
  });
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
          log.silly(`untargz received stream2.`);
          streamToBuffer(stream2)
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

export async function getFileHTTP(
  url: string,
  dest: LocalFile | string,
  cancelkey?: string,
  progress?: ((p: number) => void) | null
): Promise<LocalFile> {
  return new Promise((resolve, reject) => {
    let rejected = false;
    const rejectme = (er: any) => {
      if (!rejected) {
        if (progress) progress(-1);
        reject(er);
      }
      rejected = true;
    };
    const canceled = () => {
      if (
        cancelkey &&
        cancelkey in HttpCancelable &&
        HttpCancelable[cancelkey].canceled
      ) {
        rejectme({ message: C.UI.Manager.cancelMsg });
        return true;
      }
      return false;
    };
    if (!canceled()) {
      const ses = session.fromPartition(randomID(), { cache: false });
      const destpath = typeof dest === 'string' ? dest : dest.path;
      const destFile = new LocalFile(destpath);
      // TODO!: Get this to work with GenBook UTF8 paths.
      ses.on('will-download', (ev, item) => {
        if (progress) progress(0);
        if (cancelkey) {
          HttpCancelable[cancelkey] = {
            canceled: false,
            callback: () => {
              item.cancel();
              ev.preventDefault();
              rejectme({ message: C.UI.Manager.cancelMsg });
            },
          };
        }
        item.setSavePath(destpath);
        item.on('updated', (ev2, state) => {
          if (state === 'interrupted') {
            item.cancel();
            rejectme(new Error('Download was interrupted'));
          } else if (state === 'progressing') {
            if (item.isPaused()) {
              item.cancel();
              ev2.preventDefault();
              rejectme(new Error('Download was paused'));
            } else if (progress) {
              progress(item.getReceivedBytes() / item.getTotalBytes());
            }
          }
        });
        item.once('done', (_e, state) => {
          if (progress) progress(-1);
          if (cancelkey) delete HttpCancelable[cancelkey];
          if (state === 'completed') {
            if (!canceled()) {
              resolve(destFile);
            }
          } else if (state === 'cancelled') {
            rejectme({ message: C.UI.Manager.cancelMsg });
          } else {
            rejectme(new Error(`Download failed '${state}'`));
          }
        });
      });
      try {
        log.debug(`Downloading: '${url}'`);
        ses.setUserAgent(C.HTTPUserAgent);
        ses.setDownloadPath(fpath.dirname(destpath));
        ses.downloadURL(url);
      } catch (er) {
        if (!canceled()) {
          rejectme(er);
        }
      }
    }
  });
}
