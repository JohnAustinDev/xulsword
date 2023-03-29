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
    cause: 'canceled' | Error | null;
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
// each operation id for that key. When the operation for which the id was
// created finishes without error, call ftpCancelable(key, id) to remove all
// registered cancel functions for that id.
function ftpCancelable(key: string, id?: string, func?: () => void) {
  if (!key) return '';

  if (
    key &&
    id === undefined &&
    func === undefined &&
    key in FtpCancelable &&
    FtpCancelable[key].cause
  ) {
    const { cause } = FtpCancelable[key];
    // Run ftpCancel(key) again in case somehow new operations were added
    // since the last ftpCancel(key) call.
    ftpCancel(key, cause);
    if (typeof cause === 'string') throw new Error(cause);
    if (cause) throw cause;
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
    FtpCancelable[key] = { callbacks: [], cause: null };
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
// deleted with ftpCancelReset(key). If 1 is returned from this call,
// then there are still registered callbcacks from a previous operation
// for the download, indicating the operation(s) threw an unhandled
// exception, or were not closed with ftpCancelable(key, id). Later,
// when the downloading window is closed, ftpCancel() should be called
// to delete all keys,  and destroy all FTP connections. To cancel a
// single download, ftpCancel(key) should be called.
export function ftpCancel(
  cancelkey?: string,
  cause?: 'canceled' | Error | null
): number {
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
      if (cause && !FtpCancelable[cancelkey].cause) {
        FtpCancelable[cancelkey].cause = cause;
      }
    }
    return n;
  }
  return 0;
}

// If an error occurs, it usually causes the entire cancelkey to be canceled.
// In this case, we need to report the root cause, not just 'canceled'.
export function ftpCancelCause(cancelkey: string): string | Error | null {
  if (cancelkey && cancelkey in FtpCancelable) {
    const { cause } = FtpCancelable[cancelkey];
    if (cause === 'canceled') {
      return C.UI.Manager.cancelMsg;
    }
    return cause;
  }
  return null;
}

export function ftpCancelReset(cancelkey: string): number {
  if (cancelkey in FtpCancelable) {
    if (FtpCancelable[cancelkey].callbacks.length) {
      return FtpCancelable[cancelkey].callbacks.length;
    }
    delete FtpCancelable[cancelkey];
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

// Close and free FTP connections to a particular domain, or all domains.
export function destroyFTPconnection(domain?: string | null, quiet = false) {
  if (domain) {
    if (domain in activeConnections) {
      activeConnections[domain].forEach((c) => {
        abortP(c)
          .then(() => c.destroy())
          .catch((er) => log.error(er));
      });
      activeConnections[domain] = [];
      waitingConnections[domain].forEach((c) => {
        abortP(c)
          .then(() => c.destroy())
          .catch((er) => log.error(er));
      });
      waitingConnections[domain] = [];
    }
  } else {
    Object.keys(activeConnections).forEach((d) =>
      destroyFTPconnection(d, quiet)
    );
  }
}

// Move a connection from active to waiting.
function freeConnection(c: FTP, domain: string) {
  waitingConnections[domain].push(c);
  const i = activeConnections[domain]?.indexOf(c);
  if (i !== undefined && i !== -1) {
    activeConnections[domain].splice(i, 1);
    log.debug(
      `Freed 1 connection to ${domain}; ${activeConnections[domain].length} still active.`
    );
  }
}

// Remove a connection from active and waiting.
function forgetConnection(c: FTP, domain: string) {
  const i0 = waitingConnections[domain]?.indexOf(c);
  if (i0 !== undefined && i0 !== -1) {
    waitingConnections[domain].splice(i0, 1);
  }
  const i1 = activeConnections[domain]?.indexOf(c);
  if (i1 !== undefined && i1 !== -1) {
    activeConnections[domain].splice(i1, 1);
  }
}

// NOTE: If a connection operation is not aborted before the connection
// is destroyed, unhandled 'Failure writing network stream.' errors will
// occur.
function createActiveConnection(
  domain: string,
  cancelkey: string
): Promise<FTP | 'too-many-connections'> {
  return new Promise((resolve, reject) => {
    let c: FTP | undefined;
    let id: string;
    try {
      const max = MaxDomainConnections[domain] || C.FTPMaxConnections;
      if (
        activeConnections[domain].length + waitingConnections[domain].length <
          max &&
        Object.values(activeConnections)
          .concat(Object.values(waitingConnections))
          .flat().length < max
      ) {
        log.debug(`Connecting: ${domain}`);
        c = new FTP();
        id = ftpCancelable(cancelkey);
        ftpCancelable(cancelkey, id, () => {
          if (c) {
            abortP(c)
              .then(() => c?.destroy())
              .catch((er) => log.error(er));
            forgetConnection(c, domain);
            reject(C.UI.Manager.cancelMsg);
          }
        });
        activeConnections[domain].push(c);
        c.connect({
          host: domain,
          user: 'anonymous',
          password: C.FTPPassword,
          connTimeout: C.FTPConnectTimeout,
        });
      } else resolve('too-many-connections');
    } catch (er: any) {
      reject(er);
    }

    if (c) {
      const cc = c;
      cc.on('error', (er: Error) => {
        log.debug(`ftp connect on-error ${domain}: '${er}'.`);
        abortP(cc)
          .then(() => cc.destroy())
          .catch((err) => log.error(err));
        if (er.message.includes('too many connections')) {
          MaxDomainConnections[domain] = activeConnections[domain].length;
          resolve('too-many-connections');
        } else reject(er);
      });
      cc.on('close', (er: boolean) => {
        log.silly(`ftp connect on-close ${domain} ${er}'.`);
        forgetConnection(cc, domain);
      });
      cc.on('end', () => {
        log.silly(`ftp connect on-end ${domain}.`);
      });
      cc.on('greeting', (msg: string) => {
        log.silly(`ftp connect on-greeting ${domain}: '${msg}'.`);
      });
      cc.on('ready', () => {
        log.silly(`ftp connect on-ready ${domain}.`);
        if (id) ftpCancelable(cancelkey, id);
        resolve(cc);
      });
    }
  });
}

async function getActiveConnection(
  domain: string,
  cancelkey: string
): Promise<FTP> {
  const waiting = async (): Promise<FTP | 'too-many-connections'> => {
    ftpCancelable(cancelkey);
    let c: FTP | null | 'too-many-connections' =
      waitingConnections[domain][0] || null;
    if (c) {
      log.silly(`ftp connect on-ready-free ${domain}.`);
      waitingConnections[domain].shift();
      activeConnections[domain].push(c);
      return c;
    }
    c = await createActiveConnection(domain, cancelkey);
    return c;
  };
  let c: FTP | 'too-many-connections';
  try {
    c = await waiting();
  } catch (er) {
    return Promise.reject(er);
  }
  let msg = `Waiting for a free connection to ${domain}.`;
  for (;;) {
    if (c !== 'too-many-connections') break;
    if (msg) log.debug(msg);
    msg = '';
    await new Promise((resolve) => setTimeout(() => resolve(true), 100));
    try {
      c = await waiting();
    } catch (er) {
      return Promise.reject(er);
    }
  }
  return c;
}

// Create or use a waiting FTP connection to a remote server to run
// an arbitrary function and return an arbitrary promise. When there
// are no connections waiting and there are too many connections to
// create a new one, then it waits. When a connection becomes available,
// it will be used. The cancelkey can be used to cancel the function
// even if it is still waiting for a connection, or it's already in
// process.
const activeConnections: { [domain: string]: FTP[] } = {};
const waitingConnections: { [domain: string]: FTP[] } = {};
export async function connect<Retval>(
  domain: string,
  cancelkey: string, // '' is uncancelable
  func: (c: FTP) => Promise<Retval>
): Promise<Retval> {
  if (!(domain in activeConnections)) {
    activeConnections[domain] = [];
    waitingConnections[domain] = [];
  }

  const id = ftpCancelable(cancelkey);
  let c: FTP;
  try {
    c = await getActiveConnection(domain, cancelkey);
  } catch (er) {
    ftpCancelable(cancelkey, id); // never throws
    return Promise.reject(er);
  }

  ftpCancelable(cancelkey, id, () => {
    abortP(c);
    freeConnection(c, domain);
  });

  let result: Retval;
  try {
    result = await func(c);
    freeConnection(c, domain);
  } catch (er) {
    abortP(c)
      .then(() => c.destroy())
      .catch((err) => log.error(err));
    forgetConnection(c, domain);
    return await Promise.reject(er);
  } finally {
    ftpCancelable(cancelkey, id); // never throws
  }

  return result;
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const buf: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      // log.silly(`data: ${chunk.length} bytes`);
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
    log.silly(`abortP(c)`);
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
      else if (listing) {
        listing.forEach((l) => log.debug(`listing: ${l.name}`));
        resolve(listing);
      }
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
      if (er) reject(`${er.message} ${filepath}`);
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

  const killstream = async (s: any) => {
    if (s && 'destroy' in s && typeof s.destroy === 'function') {
      try {
        await abortP(c);
        await s.destroy();
      } catch (er) {
        log.error(er);
      } finally {
        log.debug(`Killed FTP stream: ${filepath}`);
      }
    } else log.error(`Stream was not destroyable: ${filepath}`);
  };

  let id = '';
  let stream: NodeJS.ReadableStream;
  try {
    id = ftpCancelable(cancelkey);
    stream = await getP(c, filepath);
  } catch (er) {
    return Promise.reject(er);
  }
  ftpCancelable(cancelkey, id, async () => killstream(stream));

  let buf: Buffer;
  try {
    buf = await new Promise((resolve, reject) => {
      if (stream) {
        stream.on('error', (er) => {
          killstream(stream);
          reject(er);
        });
        stream.on('data', () => {
          try {
            ftpCancelable(cancelkey);
          } catch (er) {
            killstream(stream);
            reject(er);
          }
        });
        if (progress && size) {
          progress(0);
          let current = 0;
          stream.on('data', (chunk: Buffer) => {
            current += chunk.length;
            progress(current / size);
          });
        }
        streamToBuffer(stream)
          .then((r) => resolve(r))
          .catch((er) => reject(er));
      } else reject(`No stream: ${filepath}`);
    });
  } catch (er: any) {
    ftpCancel(cancelkey, er);
    return await Promise.reject(er);
  } finally {
    if (progress && size) progress(-1);
  }
  log.silly(`DONE getFileP(${filepath})`);
  ftpCancelable(cancelkey, id); // never throws
  return buf;
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
              fpath.posix.join(dirpath, f.name),
              cancelkey,
              fpath.posix.join(basepath, f.name),
              maxdepth,
              depth + 1
            )
          )
        );
    }
  } catch (er: any) {
    ftpCancel(cancelkey, er);
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
        !skipPathRegex.test(fpath.posix.join(dirpath, l.subdir, l.name))
    );
    const buffers = await getFiles(
      domain,
      files.map((l) => fpath.posix.join(dirpath, l.subdir, l.name)),
      cancelkey,
      progress
    );
    if (buffers) {
      return files.map((l, i) => {
        return { listing: l, buffer: buffers[i] };
      });
    }
  } catch (er: any) {
    if (progress) progress(-1);
    ftpCancel(cancelkey, er);
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
    } catch (er: any) {
      if (progress) progress(-1);
      ftpCancel(cancelkey, er);
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
      } else {
        throw pre.reason;
      }
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
