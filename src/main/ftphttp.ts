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
import C from '../constant';
import LocalFile from './components/localFile';

export type ListingElementR = ListingElement & { subdir: string };

let MaxDomainConnections: { [domain: string]: number } = {};

let FtpCancelable: {
  key: string;
  cancel: [string, (() => void)[]][];
  canceled: boolean;
}[] = [];

// Call this function to register arbitrary cancelation functions for a
// particular cancelkey. When cancel is requested all registered functions
// will be called in reverse.
function ftpCancelable(key: string, id?: string, func?: () => void) {
  // Return unique id
  if (!id) return Math.random().toString(36).replace('0.', 'x');
  if (!key) return '';

  // Remove a cancel id from FtpCancelable
  if (!func) {
    const i = FtpCancelable.findIndex((fc) => fc.key === key);
    if (i !== -1) {
      const j = FtpCancelable[i].cancel.findIndex((x) => x[0] === id);
      if (j !== -1) {
        FtpCancelable[i].cancel.splice(j, 1);
      }
      if (!FtpCancelable[i].cancel.length) {
        // Remove after a delay, if it's still empty
        setTimeout(() => {
          const x = FtpCancelable.findIndex((fc) => fc.key === key);
          if (x !== -1) FtpCancelable.splice(x, 1);
          if (!FtpCancelable.length) {
            MaxDomainConnections = {};
          }
        }, 100);
      }
    }
    return id;
  }

  // Add another cancel function to FtpCancelable
  let i = FtpCancelable.findIndex((fc) => fc.key === key);
  if (i === -1) {
    FtpCancelable.push({ key, cancel: [], canceled: false });
    i = FtpCancelable.length - 1;
  }
  let j = FtpCancelable[i].cancel.findIndex((x) => x[0] === id);
  if (j === -1) {
    FtpCancelable[i].cancel.push([id, []]);
    j = FtpCancelable[i].cancel.length - 1;
  }
  FtpCancelable[i].cancel[j][1].push(func);
  return id;
}

export function ftpCancel(cancelkey?: string): number {
  if (cancelkey === undefined) {
    destroyFTPconnection();
    FtpCancelable = [];
    return 1;
  }
  if (cancelkey) {
    let n = 0;
    const i = FtpCancelable.findIndex((fc) => fc.key === cancelkey);
    if (i !== -1) {
      FtpCancelable[i].canceled = true;
      FtpCancelable[i].cancel.reverse().forEach((x) =>
        x[1].reverse().forEach((f) => {
          f();
          n += 1;
        })
      );
      FtpCancelable.splice(i, 1);
    }
    return n;
  }
  return 0;
}

const HttpCancelable: { url: string; wdevent: any }[] = [];

export function httpCancel(url?: string): number {
  let canceled = 0;
  const idxs = url
    ? [HttpCancelable.findIndex((hc) => hc.url === url)]
    : HttpCancelable.map((_hc, i) => i);
  idxs.forEach((i) => {
    if (i !== -1) {
      HttpCancelable[i].wdevent.preventDefault();
      log.debug(`HTTP canceled '${url}'`);
      canceled += 1;
    }
  });
  idxs.forEach((i) => {
    if (i !== -1) HttpCancelable.splice(i, 1);
  });
  return canceled;
}

function checkCancel(key: string, reject?: (value: any) => void) {
  if (key && FtpCancelable.find((fc) => fc.key === key)?.canceled) {
    const er = new Error(`${C.UI.Manager.cancelMsg}`);
    if (reject) reject(er);
    else throw er;
  }
}

// Close and free FTP connections to a particular domain, or all connections.
export function destroyFTPconnection(domain?: string | null, quiet = false) {
  if (domain) {
    if (domain in connections) {
      connections[domain].forEach((c) => c.destroy());
      delete connections[domain];
      waitingConnections[domain].forEach((c) => c.destroy());
      delete waitingConnections[domain];
      waitingFuncs[domain].forEach(() => {
        if (!quiet) log.error(`Dropping neglected FTP function.`);
        delete waitingFuncs[domain];
      });
    }
  } else {
    Object.keys(connections).forEach((d) => destroyFTPconnection(d, quiet));
  }
}

// Create or use an existing FTP connection to a remote server to run
// an arbitrary function and return an arbitrary promise. Up to
// FTPMaxConnectionsPerDomain will be created per domain. When that
// number are in use, functions will be queued, waiting for free
// connections. The cancelkey can be used to cancel any read stream
// or function even if it is waiting for a connection.
const connections: { [domain: string]: FTP[] } = {};
const waitingConnections: { [domain: string]: FTP[] } = {};
const waitingFuncs: { [domain: string]: ((c: FTP) => void)[] } = {};
export async function connect<Retval>(
  domain: string,
  cancelkey: string, // '' is uncancelable
  func: (c: FTP) => Promise<Retval>
): Promise<Retval> {
  return new Promise((resolve, reject) => {
    if (!(domain in connections)) {
      connections[domain] = [];
      waitingConnections[domain] = [];
      waitingFuncs[domain] = [];
    }
    const id = ftpCancelable(cancelkey);
    let resolved = false;
    const resolveOnce = (value: Retval) => {
      if (!resolved) {
        resolved = true;
        rejected = true;
        ftpCancelable(cancelkey, id);
        resolve(value);
      }
    };
    let rejected = false;
    const rejectOnce = (er: any) => {
      if (!rejected) {
        resolved = true;
        rejected = true;
        ftpCancelable(cancelkey, id);
        reject(er);
      }
    };
    const freeConnection = (c: FTP) => {
      const i = connections[domain]?.indexOf(c);
      if (i !== undefined && i !== -1) {
        connections[domain].splice(i, 1);
        log.debug(
          `Freed 1 connection to ${domain}, ${Object.entries(
            connections
          ).reduce((pr, cr) => pr + cr[1].length, 0)} left.`
        );
      }
    };
    const runFunc = async (c: FTP) => {
      try {
        const result = await func(c);
        freeConnection(c);
        const next = waitingFuncs[domain][0];
        if (next) {
          if (cancelkey && cancelkey in FtpCancelable) {
            log.debug(`FTP waitingFuncs canceled '${cancelkey}'`);
            rejectOnce(new Error(C.UI.Manager.cancelMsg));
          }
          waitingFuncs[domain].shift();
          log.silly(`ftp connect on-ready-wait ${domain}.`);
          next(c);
        } else {
          waitingConnections[domain].push(c);
          // IMPORTANT: All connections should be cleared at some point
          // by running Module.cancel(). At this point, free connections
          // to domains are kept for immediate reuse.
          // if (!connections[domain].length) destroyFTPconnection(domain);
        }
        resolveOnce(result);
      } catch (er: any) {
        freeConnection(c);
        rejectOnce(er);
      }
    };
    const addWaitingFunc = () => {
      const nfunc = (cf: FTP) => {
        connections[domain].push(cf);
        ftpCancelable(cancelkey, id, cancelConn(cf));
        runFunc(cf);
      };
      waitingFuncs[domain].push(nfunc);
      ftpCancelable(cancelkey, id, cancelFunc(nfunc));
    };
    const cancelFunc = (wfun: (c: FTP) => void) => {
      return () => {
        if (domain in waitingFuncs) {
          const i = waitingFuncs[domain].findIndex((f) => f === wfun);
          if (i !== -1) {
            waitingFuncs[domain].splice(i, 1);
            log.debug(`FTP canceled function '${cancelkey} ${id}'`);
            rejectOnce(new Error(C.UI.Manager.cancelMsg));
          }
        }
      };
    };
    const cancelConn = (cc: FTP) => {
      return () => {
        freeConnection(cc);
        cc.destroy();
        log.debug(`FTP canceled connection '${cancelkey} ${id}'`);
        rejectOnce(new Error(C.UI.Manager.cancelMsg));
      };
    };
    if (cancelkey && cancelkey in FtpCancelable) {
      log.debug(`FTP connect canceled '${cancelkey}'`);
      rejectOnce(new Error(C.UI.Manager.cancelMsg));
    }
    let c = waitingConnections[domain][0];
    if (c) {
      waitingConnections[domain].shift();
      connections[domain].push(c);
      ftpCancelable(cancelkey, id, cancelConn(c));
      log.silly(`ftp connect on-ready-free ${domain}.`);
      runFunc(c);
    } else if (
      connections[domain].length <
        (domain in MaxDomainConnections
          ? MaxDomainConnections[domain]
          : C.FTPMaxConnections) &&
      Object.values(connections).flat().length < C.FTPMaxConnections
    ) {
      c = new FTP();
      connections[domain].push(c);
      ftpCancelable(cancelkey, id, cancelConn(c));
      c.on('error', (er: Error) => {
        log.silly(`ftp connect on-error ${domain}: '${er}'.`);
        c.destroy();
        freeConnection(c);
        if (er.message.includes('too many connections')) {
          MaxDomainConnections[domain] = connections[domain].length;
          addWaitingFunc();
        } else rejectOnce(er);
      });
      c.on('close', (er: boolean) => {
        log.silly(`ftp connect on-close ${domain}: error='${er}'.`);
        if (er) {
          if (typeof c === 'object') c.destroy();
          freeConnection(c);
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
        runFunc(c);
      });
      try {
        log.debug(`Connecting: ${domain}`);
        c.connect({ host: domain, user: C.FTPUserName });
      } catch (er: any) {
        freeConnection(c);
        rejectOnce(er);
      }
    } else addWaitingFunc();
  });
}

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

// Convert the callback FTP API to promise with cancel.
async function listP(c: FTP, dirpath: string): Promise<ListingElement[]> {
  return new Promise((resolve, reject) => {
    log.silly(`list(${dirpath})`);
    c.list(dirpath, false, (err: Error, listing: ListingElement[]) => {
      if (err) reject(err);
      else resolve(listing);
    });
  });
}

// Convert the callback FTP API to promise with cancel.
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

// Convert the callback FTP API to promise with cancel.
async function getP(c: FTP, filepath: string): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    log.silly(`getStream(${filepath})`);
    c.get(filepath, (er: Error, stream: NodeJS.ReadableStream) => {
      if (er) reject(new Error(`${er.message} ${filepath}`));
      else {
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
  log.silly(`get(${filepath})`);
  checkCancel(cancelkey);

  const stream = await getP(c, filepath);
  const id = ftpCancelable(cancelkey);

  ftpCancelable(cancelkey, id, () => {
    const s = stream as any;
    if (s && 'destroy' in s && typeof s.destroy === 'function') {
      s.destroy();
      log.debug(`FTP destroyed stream '${cancelkey} ${id}'`);
    }
  });

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
  return streamToBuffer(stream)
    .then((result) => {
      if (progress) progress(-1);
      log.silly(`DONE get(${filepath})`);
      ftpCancelable(cancelkey, id);
      return result;
    })
    .catch((er) => {
      if (progress) progress(-1);
      ftpCancelable(cancelkey, id);
      throw er;
    });
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
      const size = await sizeP(c, filepath);
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
      throw er;
    }
    prog += 1;
    if (progress) progress(prog / total);
    return b;
  });
  // IMPORTANT: allSettled (vs all) waits until all results are
  // in, so that progress cannot be reverted after a rejection.
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
  progress?: ((p: number) => void) | null
): Promise<LocalFile> {
  return new Promise((resolve, reject) => {
    const ses = session.fromPartition('persist:audio', { cache: false });
    ses.setUserAgent(C.HTTPUserAgent);
    const destpath = typeof dest === 'string' ? dest : dest.path;
    const destFile = new LocalFile(destpath);
    ses.setDownloadPath(fpath.dirname(destpath));
    // TODO!: Get this to work with GenBook UTF8 paths.
    ses.on('will-download', (event, item) => {
      HttpCancelable.push({ url, wdevent: event });
      item.setSavePath(destpath);
      item.on('updated', (_e, state) => {
        if (state === 'interrupted') {
          reject(new Error('Download is interrupted'));
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            reject(new Error('Download is paused'));
          } else if (progress) {
            progress(item.getReceivedBytes() / item.getTotalBytes());
          }
        }
      });
      item.once('done', (_e, state) => {
        const i = HttpCancelable.findIndex((hc) => hc.url === url);
        if (i !== -1) HttpCancelable.splice(i, 1);
        if (state === 'completed') {
          resolve(destFile);
        } else {
          reject(new Error(`Download failed '${state}'`));
        }
      });
    });
    log.debug(`Downloading: '${url}'`);
    ses.downloadURL(url);
  });
}
